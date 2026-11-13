import * as T from './vendor/three.module.js';

// The source's raised dots are repaired once. A locally refined sclera mesh
// then forms a real recessed cup around each moving pupil in the vertex shader.
// The original model, UV atlas, skeleton and outside eye silhouette are retained.
export const STUDENT_EYE_REGIONS = Object.freeze({
 boy: [
  {center:[-.108,1.443,.213], radius:[.082,.075], front:[.232,.273]},
  {center:[ .104,1.443,.213], radius:[.082,.075], front:[.232,.273]}
 ],
 girl: [
  {center:[-.105,1.442,.188], radius:[.078,.072], front:[.202,.242]},
  {center:[ .103,1.442,.191], radius:[.078,.072], front:[.204,.244]}
 ],
 ponytail: [
  {center:[-.106,1.382,.162], radius:[.074,.068], front:[.173,.213]},
  {center:[ .101,1.382,.163], radius:[.074,.068], front:[.173,.213]}
 ]
});
const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function eyeSurfaceWeight(point,region){
 const [x,y]=region.center,[rx,ry]=region.radius;
 const r=Math.hypot((point.x-x)/rx,(point.y-y)/ry);
 return (1-smooth(.78,1.10,r))*smooth(...region.front,point.z);
}
const fract=x=>x-Math.floor(x);
const noise=x=>fract(Math.sin(x*12.9898+78.233)*43758.5453);
const geometryCache=new WeakMap();
// Sclera curvature measured on the ring 24–50 mm around each old pupil,
// excluding the raised black mesh. z = a + bx + cy + dx² + exy + fy²,
// where x/y are offsets from the old pupil divided by 50 mm. Only the small
// old pupil cap is repaired; the outside eye silhouette and UV atlas stay intact.
const SCLERA_PATCHES={
 boy:[[-.108,1.427,[.2822579514,.0000388158,-.0002413579,-.0146130331,.0002103991,-.0147186454]],
      [.103,1.428,[.2820567285,-.0011893837,-.0009193112,-.0143577315,-.0003606693,-.0144745694]]],
 girl:[[-.102,1.434,[.2498868218,.0038492490,-.0014707851,-.0129853674,-.0003089654,-.0134635139]],
       [.095,1.435,[.2528206396,-.0039233651,-.0021115136,-.0138677735,.0001339006,-.0136287255]]],
 ponytail:[[-.102,1.371,[.2220822585,.0103657331,.0004752270,-.0105302385,-.0005955867,-.0123597565]],
           [.094,1.370,[.2222629082,-.0095294672,.0009520317,-.0100726589,.0002528328,-.0122947233]]]
};
function repairPupilCaps(geometry,restFromLocal,variant){
 const position=geometry.attributes.position,normal=geometry.attributes.normal;
 const localFromRest=restFromLocal.clone().invert(),point=new T.Vector3(),n=new T.Vector3();
 const normalToLocal=new T.Matrix3().getNormalMatrix(localFromRest);
 for(let i=0;i<position.count;i++){
  point.fromBufferAttribute(position,i).applyMatrix4(restFromLocal);
  for(const [e,[cx,cy,a]] of SCLERA_PATCHES[variant].entries()){
   const dx=point.x-cx,dy=point.y-cy,d=Math.hypot(dx,dy);
   if(d>=.027||point.z<STUDENT_EYE_REGIONS[variant][e].front[1]-.012)continue;
   const x=dx/.05,y=dy/.05,w=1-smooth(.019,.027,d);
   const z=a[0]+a[1]*x+a[2]*y+a[3]*x*x+a[4]*x*y+a[5]*y*y;
   point.z=T.MathUtils.lerp(point.z,z,w);point.applyMatrix4(localFromRest);
   position.setXYZ(i,point.x,point.y,point.z);
   if(normal){
    n.set(-(a[1]+2*a[3]*x+a[4]*y)/.05,-(a[2]+a[4]*x+2*a[5]*y)/.05,1).applyMatrix3(normalToLocal).normalize();
    n.lerp(new T.Vector3().fromBufferAttribute(normal,i),1-w).normalize();
    normal.setXYZ(i,n.x,n.y,n.z);
   }
   break;
  }
 }
 position.needsUpdate=true;if(normal)normal.needsUpdate=true;
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
}
// Refine only the visible eye front. Midpoints preserve UVs and merge bone
// influences by joint ID, so the new triangles follow the existing head rig.
// No per-frame CPU mesh upload and no extra meshes/materials/draw calls.
export function refineStudentEyeGeometry(geometry,restFromLocal,regions){
 const names=Object.keys(geometry.attributes),arrays=Object.fromEntries(names.map(name=>[name,Array.from(geometry.attributes[name].array)]));
 const itemSizes=Object.fromEntries(names.map(name=>[name,geometry.attributes[name].itemSize]));
 const points=[],point=new T.Vector3(),p=geometry.attributes.position;
 for(let i=0;i<p.count;i++)points.push(point.fromBufferAttribute(p,i).applyMatrix4(restFromLocal).clone());
 const midpoints=new Map();
 function midpoint(a,b){
  const key=a<b?a+','+b:b+','+a;if(midpoints.has(key))return midpoints.get(key);
  const index=points.length;points.push(points[a].clone().add(points[b]).multiplyScalar(.5));
  for(const name of names){
   if(name==='skinIndex'||name==='skinWeight')continue;
   const size=itemSizes[name],src=arrays[name];for(let j=0;j<size;j++)src.push((src[a*size+j]+src[b*size+j])*.5);
   if(name==='normal'){const offset=index*size,n=Math.hypot(...src.slice(offset,offset+3));for(let j=0;j<3;j++)src[offset+j]/=n||1;}
  }
  if(arrays.skinIndex&&arrays.skinWeight){
   const influence=new Map(),size=itemSizes.skinIndex;
   for(const v of [a,b])for(let j=0;j<size;j++){const joint=arrays.skinIndex[v*size+j],w=arrays.skinWeight[v*size+j]*.5;influence.set(joint,(influence.get(joint)||0)+w);}
   const chosen=[...influence].sort((a,b)=>b[1]-a[1]).slice(0,size),sum=chosen.reduce((n,i)=>n+i[1],0);
   for(let j=0;j<size;j++){arrays.skinIndex.push(chosen[j]?.[0]||0);arrays.skinWeight.push((chosen[j]?.[1]||0)/(sum||1));}
  }
  midpoints.set(key,index);return index;
 }
 let triangles=geometry.index?Array.from(geometry.index.array):Array.from({length:p.count},(_,i)=>i);
 // Mark shared edges first, then split every incident triangle. This keeps
 // the patch watertight; independently subdividing faces can create cracks
 // when the cup moves across an edge containing a hanging midpoint.
 const edgeKey=(a,b)=>a<b?a+','+b:b+','+a;
 for(let pass=0;pass<5;pass++){
  const split=new Set();
  for(let i=0;i<triangles.length;i+=3){
   const [a,b,c]=triangles.slice(i,i+3),pa=points[a],pb=points[b],pc=points[c],center=pa.clone().add(pb).add(pc).multiplyScalar(1/3);
   const front=regions.some(r=>eyeSurfaceWeight(center,r)>.025||[pa,pb,pc].some(v=>eyeSurfaceWeight(v,r)>.04));
   if(!front)continue;
   for(const [u,v] of [[a,b],[b,c],[c,a]])if(points[u].distanceToSquared(points[v])>.010*.010)split.add(edgeKey(u,v));
  }
  if(!split.size)break;
  const result=[];
  for(let i=0;i<triangles.length;i+=3){
   const [a,b,c]=triangles.slice(i,i+3),ab=split.has(edgeKey(a,b))?midpoint(a,b):-1,bc=split.has(edgeKey(b,c))?midpoint(b,c):-1,ca=split.has(edgeKey(c,a))?midpoint(c,a):-1;
   const mask=(ab>=0?1:0)|(bc>=0?2:0)|(ca>=0?4:0);
   if(mask===0)result.push(a,b,c);
   else if(mask===1)result.push(a,ab,c,ab,b,c);
   else if(mask===2)result.push(a,b,bc,a,bc,c);
   else if(mask===4)result.push(a,b,ca,ca,b,c);
   else if(mask===3)result.push(b,bc,ab,a,ab,c,ab,bc,c);
   else if(mask===5)result.push(a,ab,ca,ab,b,c,ab,c,ca);
   else if(mask===6)result.push(c,ca,bc,a,b,ca,b,bc,ca);
   else result.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
  }
  triangles=result;
 }
 for(const name of names){const old=geometry.attributes[name];geometry.setAttribute(name,new T.BufferAttribute(new old.array.constructor(arrays[name]),old.itemSize,old.normalized));}
 geometry.setIndex(triangles);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
function pupilCenter(region,variant){const index=STUDENT_EYE_REGIONS[variant].indexOf(region),[x,y]=SCLERA_PATCHES[variant][Math.max(0,index)];return new T.Vector3(x,y,region.center[2]);}
export const STUDENT_PUPIL_GEOMETRY=Object.freeze({boy:{radius:.18,depth:.0035},girl:{radius:.18,depth:.0035},ponytail:{radius:.225,depth:.0045}});
// CPU counterpart used to inspect actual GPU vertex positions, not a visual
// assertion. It is also useful for tooling that exports a static eye pose.
export function studentEyeVertex(point,region,variant,yaw=0,pitch=0){
 const spec=STUDENT_PUPIL_GEOMETRY[variant],radius=new T.Vector3(...region.radius,variant==='boy'?.075:variant==='girl'?.064:.063);
 const center=pupilCenter(region,variant),surface=point.clone().sub(center).divide(radius).normalize();
 const direction=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
 const amount=smooth(Math.cos(spec.radius+.09),Math.cos(spec.radius*.46),surface.dot(direction))*smooth(.015,.12,eyeSurfaceWeight(point,region));
 const normal=surface.clone().divide(radius).normalize();
 return point.clone().addScaledVector(normal,-spec.depth*amount);
}
// Large side glances, upward looks and occasional crossed-eye poses.
// Hold each direction instead of continuously shaking; the second eye follows
// 70 ms later. Both eyes still use the same bounded sclera surface.
export function studentEyeGaze(time,seed=0){
 const period=3.6+noise(seed+4)*2.2,offset=noise(seed+17)*period;
 function eye(delay,index){
  const t=(Math.max(0,time)+offset-delay)/period,k=Math.floor(t),phase=fract(t);
  const target=n=>{
   if(noise(seed*5+n*7+44)<.12)return [index===0?.58:-.58,.13];
   const side=noise(seed*17+n*3+8)*2-1;
   return clampStudentEyeLook(Math.sign(side)*(.16+.62*Math.pow(Math.abs(side),.6)),
     (noise(seed*11+n*7+21)*2-1)*.62);
  };
  const before=target(k-1),after=target(k),alpha=smooth(0,.085,phase);
  return before.map((v,i)=>T.MathUtils.lerp(v,after[i],alpha));
 }
 return [...eye(0,0),...eye(.07,1)];
}
export function clampStudentEyeLook(yaw=0,pitch=0){
 const x=T.MathUtils.clamp(Number(yaw)||0,-.78,.78),y=T.MathUtils.clamp(Number(pitch)||0,-.62,.62);
 const scale=Math.min(1,.82/Math.hypot(x,y));
 return [x*scale,y*scale];
}
function shaderPatch(shader,uniforms){
 Object.assign(shader.uniforms,uniforms);
 shader.vertexShader=`attribute vec2 studentEyeWeights;
 varying vec2 studentEyeMask;
 varying vec3 studentEyeRest;
 uniform mat4 studentEyeRestFromLocal;
 uniform mat4 studentEyeLocalFromRest;
 uniform mat3 studentEyeRestNormalFromLocal;
 uniform mat3 studentEyeLocalNormalFromRest;
 uniform vec4 studentEyeGaze;
 uniform vec3 studentEyeCenterL;
 uniform vec3 studentEyeCenterR;
 uniform vec3 studentEyeRadius;
 uniform vec3 studentPupilCup;
 vec3 studentEyeCup(vec3 rest,vec3 center,vec2 angles,float coverage){
  vec3 surface=normalize((rest-center)/studentEyeRadius);
  vec3 direction=vec3(sin(angles.x)*cos(angles.y),sin(angles.y),cos(angles.x)*cos(angles.y));
  float amount=smoothstep(studentPupilCup.x,studentPupilCup.y,dot(surface,direction))*smoothstep(.015,.12,coverage);
  vec3 outward=normalize(surface/studentEyeRadius);
  return -outward*studentPupilCup.z*amount;
 }
 vec3 studentEyeBothCups(vec3 rest){
  return studentEyeCup(rest,studentEyeCenterL,studentEyeGaze.xy,studentEyeWeights.x)
       + studentEyeCup(rest,studentEyeCenterR,studentEyeGaze.zw,studentEyeWeights.y);
 }
 `+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
 if(studentEyeWeights.x+studentEyeWeights.y>.001){
  vec3 p=(studentEyeRestFromLocal*vec4(position,1.)).xyz;
  vec3 n=normalize(studentEyeRestNormalFromLocal*objectNormal);
  vec3 tangent=normalize(cross(n,abs(n.z)<.95?vec3(0.,0.,1.):vec3(0.,1.,0.)));
  vec3 bitangent=normalize(cross(n,tangent));
  float stepSize=.00035;
  vec3 dx=tangent+(studentEyeBothCups(p+tangent*stepSize)-studentEyeBothCups(p-tangent*stepSize))/(2.*stepSize);
  vec3 dy=bitangent+(studentEyeBothCups(p+bitangent*stepSize)-studentEyeBothCups(p-bitangent*stepSize))/(2.*stepSize);
  objectNormal=normalize(studentEyeLocalNormalFromRest*cross(dx,dy));
 }
 `);
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 studentEyeRest=(studentEyeRestFromLocal*vec4(position,1.)).xyz;
 studentEyeMask=studentEyeWeights;
 if(studentEyeWeights.x+studentEyeWeights.y>.001){
  vec3 studentEyeInset=studentEyeBothCups(studentEyeRest);
  transformed=(studentEyeLocalFromRest*vec4(studentEyeRest+studentEyeInset,1.)).xyz;
 }
 `);
 shader.fragmentShader=`varying vec2 studentEyeMask;
 varying vec3 studentEyeRest;
 uniform vec4 studentEyeGaze;
 uniform vec3 studentEyeCenterL;
 uniform vec3 studentEyeCenterR;
 uniform vec3 studentEyeRadius;
 uniform vec2 studentPupilEdge;
 vec3 studentEyeSurface(vec3 base,vec3 center,vec2 angles,float coverage){
  vec3 surface=normalize((studentEyeRest-center)/studentEyeRadius);
  vec3 direction=vec3(sin(angles.x)*cos(angles.y),sin(angles.y),cos(angles.x)*cos(angles.y));
  float alignment=dot(surface,direction);
  float edge=max(fwidth(alignment),.00015);
  float pupil=smoothstep(studentPupilEdge.x-edge,studentPupilEdge.x+edge,alignment);
  vec3 white=vec3(.96,.965,.95);
  // The white blends into the authored eye boundary. The black pupil must
  // not inherit that translucent blend when a glance reaches the edge.
  vec3 sclera=mix(base,white,coverage);
  float visible=smoothstep(.015,.12,coverage);
  // Solid black at the bottom of the geometrically recessed cup. No painted
  // shadow ring: the inward edge is supplied by the vertex displacement.
  vec3 inner=vec3(.002,.0025,.003);
  return mix(sclera,inner,pupil*visible);
 }
 `+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 if(studentEyeMask.x+studentEyeMask.y>.001){
  diffuseColor.rgb=studentEyeSurface(diffuseColor.rgb,studentEyeCenterL,studentEyeGaze.xy,studentEyeMask.x);
  diffuseColor.rgb=studentEyeSurface(diffuseColor.rgb,studentEyeCenterR,studentEyeGaze.zw,studentEyeMask.y);
 }
 `);
}

export function createStudentEyes(model,{variant='boy',seed=0,enabled=true}={}){
 const regions=enabled&&STUDENT_EYE_REGIONS[variant],entries=[],materials=new Set();
 let current=[0,0,0,0],disposed=false;
 // The glasses source has opaque lenses and no visible pupil. Leave the entire
 // frame and lenses untouched instead of inventing eyes over the original art.
 if(!regions)return {update(){},dispose(){},diagnostics:()=>({enabled:false,reason:variant==='glasses'?'opaque-original-lenses':'unsupported-legacy-model',gaze:[0,0,0,0],vertices:0})};
 model.updateWorldMatrix(true,true);
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const sourceGeometry=mesh.geometry,position=sourceGeometry.attributes.position;
  const restFromLocal=mesh.matrixWorld.clone();
  let cache=geometryCache.get(sourceGeometry);if(!cache){cache=new Map();geometryCache.set(sourceGeometry,cache);}
  const cacheKey=variant+':'+restFromLocal.elements.join(',');let prepared=cache.get(cacheKey);
  if(!prepared){
   const geometry=sourceGeometry.clone();repairPupilCaps(geometry,restFromLocal,variant);
   refineStudentEyeGeometry(geometry,restFromLocal,regions);
   const refined=geometry.attributes.position,weights=new Float32Array(refined.count*2),point=new T.Vector3();let count=0;
   for(let i=0;i<refined.count;i++){
    point.fromBufferAttribute(refined,i).applyMatrix4(restFromLocal);
    for(let e=0;e<2;e++)weights[i*2+e]=eyeSurfaceWeight(point,regions[e]);
    if(weights[i*2]+weights[i*2+1]>.0001)count++;
   }
   if(!count){geometry.dispose();return;}
   geometry.setAttribute('studentEyeWeights',new T.BufferAttribute(weights,2));
   prepared={geometry,count,refs:0};cache.set(cacheKey,prepared);
  }
  prepared.refs++;const {geometry,count}=prepared;mesh.geometry=geometry;
  const {radius:pupilRadius,depth}=STUDENT_PUPIL_GEOMETRY[variant];
  const uniforms={studentEyeGaze:{value:new T.Vector4()},studentEyeCenterL:{value:pupilCenter(regions[0],variant)},studentEyeCenterR:{value:pupilCenter(regions[1],variant)},studentEyeRestFromLocal:{value:restFromLocal},studentEyeLocalFromRest:{value:restFromLocal.clone().invert()},studentEyeRestNormalFromLocal:{value:new T.Matrix3().getNormalMatrix(restFromLocal)},studentEyeLocalNormalFromRest:{value:new T.Matrix3().getNormalMatrix(restFromLocal.clone().invert())},studentPupilCup:{value:new T.Vector3(Math.cos(pupilRadius+.09),Math.cos(pupilRadius*.46),depth)},studentEyeRadius:{value:new T.Vector3(...regions[0].radius,variant==='boy'?.075:variant==='girl'?.064:.063)},studentPupilEdge:{value:new T.Vector2(Math.cos(pupilRadius),Math.cos(pupilRadius+.016))}};
  function materialFor(source){
   const material=source.clone(),previousCompile=source.onBeforeCompile;
   material.name=source.name+'-moving-eyes';material.userData={...source.userData,studentEyes:true};
   material.onBeforeCompile=function(shader,renderer){previousCompile.call(this,shader,renderer);shaderPatch(shader,uniforms);};
   material.customProgramCacheKey=()=>`student-eyes70-inset-geometry:${source.customProgramCacheKey()}`;
   materials.add(material);return material;
  }
  const sourceMaterial=mesh.material;
  mesh.material=Array.isArray(sourceMaterial)?sourceMaterial.map(materialFor):materialFor(sourceMaterial);
  entries.push({mesh,geometry,sourceGeometry,sourceMaterial,uniforms,count,prepared,cache,cacheKey});
 });
 return {
  update(time,look=null){if(disposed)return;current=look?[...clampStudentEyeLook(look.yaw,look.pitch),...clampStudentEyeLook(look.yaw,look.pitch)]:studentEyeGaze(time,seed);for(const entry of entries)entry.uniforms.studentEyeGaze.value.fromArray(current);},
  diagnostics:()=>({enabled:entries.length>0,gaze:[...current],vertices:entries.reduce((n,e)=>n+e.count,0),pupilDepthMm:STUDENT_PUPIL_GEOMETRY[variant].depth*1000,geometry:'subdivided-sclera-with-inward-vertex-cup',triangles:entries.reduce((n,e)=>n+e.geometry.index.count/3,0)}),
  dispose(){if(disposed)return;disposed=true;for(const entry of entries){entry.mesh.geometry=entry.sourceGeometry;entry.mesh.material=entry.sourceMaterial;if(--entry.prepared.refs===0){entry.geometry.dispose();entry.cache.delete(entry.cacheKey);}}for(const material of materials)material.dispose();entries.length=0;materials.clear();}
 };
}
