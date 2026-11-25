import * as T from './vendor/three.module.js';

// Eye dimensions are measured in the authored bind pose, before gameplay scaling.
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
// Lower the height of the visible bulb slightly without moving its interior.
function shapeSclera(geometry,points,restFromLocal,variant,weights){
 const positions=geometry.attributes.position,inverse=restFromLocal.clone().invert(),local=new T.Vector3();
 for(let i=0;i<points.length;i++){
  const p=points[i];
  for(const [side,r] of STUDENT_EYE_REGIONS[variant].entries()){
   const [cx,cy]=SCLERA_PATCHES[variant][side];
   const radius=Math.hypot((p.x-cx)/r.radius[0],(p.y-cy)/r.radius[1]);
   const weight=(1-smooth(.99,1.43,radius))*smooth(r.center[2]-.026,r.center[2]+.01,p.z);
   if(weight<=0)continue;
   weights[2*i+side]=Math.max(weight,weights[2*i+side]);
   local.copy(p);local.y-=.12*(p.y-cy)*weight;
   local.applyMatrix4(inverse);positions.setXYZ(i,local.x,local.y,local.z);break;
  }
 }
 positions.needsUpdate=true;
}
// Reuse the authored eye surface for the corneal optics.
// The rest of the head stays in the normal opaque pass. Shared positions,
// skinning and UVs keep the material boundary welded even while the head turns.
function prepareEyeShell(source,restFromLocal,variant){
 const regions=STUDENT_EYE_REGIONS[variant],body=source.clone();
 repairPupilCaps(body,restFromLocal,variant);
 const pos=body.attributes.position,weights=new Float32Array(pos.count*2),p=new T.Vector3();
 const points=Array.from({length:pos.count},(_,i)=>p.fromBufferAttribute(pos,i).applyMatrix4(restFromLocal).clone());
 for(let i=0;i<points.length;i++)for(let e=0;e<2;e++)weights[i*2+e]=eyeSurfaceWeight(points[i],regions[e]);
 shapeSclera(body,points,restFromLocal,variant,weights);
 body.setAttribute('studentEyeWeights',new T.BufferAttribute(weights,2));
 const outer=[],opaque=[],idx=body.index.array;
 const rim=(v,r)=>Math.hypot((v.x-r.center[0])/r.radius[0],(v.y-r.center[1])/r.radius[1])<1.38&&v.z>r.center[2]-.020;
 for(let i=0;i<idx.length;i+=3){
  const a=idx[i],b=idx[i+1],c=idx[i+2];
  const eyeFace=regions.some(r=>[a,b,c].some(v=>rim(points[v],r)))||
    regions.some(r=>eyeSurfaceWeight(p.copy(points[a]).add(points[b]).add(points[c]).multiplyScalar(1/3),r)>0);
  (eyeFace?outer:opaque).push(a,b,c);
 }
 if(!outer.length){body.dispose();return null;}
 const shell=new T.BufferGeometry();
 for(const [name,attribute] of Object.entries(body.attributes))shell.setAttribute(name,attribute);
 shell.setIndex(outer);body.setIndex(opaque);
 return {body,shell,count:new Set(outer).size,refs:0};
}
function eyeShellMaterial(source,regions,rest,optics){
 const mat=source.clone();mat.name='student-milky-eye-wall';mat.transparent=false;
 // The shell includes adjacent skin triangles. Writing depth keeps the far eye
 // and skin behind the near sclera when their silhouettes overlap.
 mat.depthWrite=true;mat.side=T.FrontSide;mat.userData.opticalShell=true;
 mat.onBeforeCompile=function(shader,renderer){
  source.onBeforeCompile.call(this,shader,renderer);
  Object.assign(shader.uniforms,optics);
  shader.uniforms.eyeRestFromLocal={value:rest};
  for(const [i,r] of regions.entries()){
   shader.uniforms['eyeArea'+i]={value:new T.Vector4(r.center[0],r.center[1],...r.radius)};
   shader.uniforms['eyeFront'+i]={value:new T.Vector2(...r.front)};
  }
  shader.vertexShader='uniform mat4 eyeRestFromLocal; varying vec3 eyeRest,eyeView;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\neyeRest=(eyeRestFromLocal*vec4(position,1.)).xyz;');
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\neyeView=mvPosition.xyz;');
  shader.fragmentShader=`varying vec3 eyeRest,eyeView;
   uniform mat4 eyeBindFromView;
   uniform vec4 eyeBall0,eyeBall1; uniform vec3 pupilColor;
   // Sample the fixed sphere through the cornea. The refracted side view
   // must use the sphere at its actual depth, even when skin lies behind it.
   float pupilCoverage(vec4 sphere,vec3 origin,vec3 incident){
    // Effective index ratio for this stylized forward-facing lens.
    vec3 direction=refract(incident,vec3(0.,0.,1.),.85);
    vec3 offset=sphere.xyz-origin;
    float t=dot(offset,direction);
    float d=length(offset-direction*t);
    float aa=max(fwidth(d)*.45,.00008);
    return step(0.,t)*(1.-smoothstep(sphere.w-aa,sphere.w+aa,d));
   }
   uniform vec4 eyeArea0,eyeArea1; uniform vec2 eyeFront0,eyeFront1;
   float eyeWall(vec4 area,vec2 front){
    return (1.-smoothstep(.78,1.10,length((eyeRest.xy-area.xy)/area.zw)))*smoothstep(front.x,front.y,eyeRest.z);
   }
   `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float wall=max(eyeWall(eyeArea0,eyeFront0),eyeWall(eyeArea1,eyeFront1));
   // The original atlas has an ivory-to-gray gradient along the bulb rim.
   // Isolate the neutral sclera texels to leave adjacent warm skin intact.
   float low=min(min(diffuseColor.r,diffuseColor.g),diffuseColor.b);
   float high=max(max(diffuseColor.r,diffuseColor.g),diffuseColor.b);
   float neutral=smoothstep(.25,.49,low)*(1.-smoothstep(.06,.16,high-low));
   float eyeRadius=min(length((eyeRest.xy-eyeArea0.xy)/eyeArea0.zw),length((eyeRest.xy-eyeArea1.xy)/eyeArea1.zw));
   float rim=1.-smoothstep(1.18,1.35,eyeRadius);
   float sclera=max(wall,neutral*rim);
   float white=1.-.088*smoothstep(.64,1.10,eyeRadius);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(white),sclera);
   vec3 origin=(eyeBindFromView*vec4(eyeView,1.)).xyz;
   vec3 ray=normalize(mat3(eyeBindFromView)*(isOrthographic?vec3(0.,0.,-1.):normalize(eyeView)));
   vec4 pupil=abs(eyeRest.x-eyeArea0.x)<abs(eyeRest.x-eyeArea1.x)?eyeBall0:eyeBall1;
   float pupilMask=pupilCoverage(pupil,origin,ray)*sclera;
   diffuseColor.rgb=mix(diffuseColor.rgb,pupilColor,pupilMask);
  `);
 };
 mat.customProgramCacheKey=()=>source.customProgramCacheKey()+'-milky-eye103';
 return mat;
}
// The pupils sit at the rear of the eye sockets. Their actual mesh centres
// drive the optical mask, so a turn of either the head or the camera produces
// parallax without moving a dot on the white surface.
function createInteriors(head,variant){
 const geometry=new T.SphereGeometry(1,12,8);
 const material=new T.MeshBasicMaterial({color:0x141319,toneMapped:false,fog:false});
 const eyes=new T.InstancedMesh(geometry,material,2);eyes.name='student-eye-interiors';
 eyes.userData.characterSurface=true;eyes.frustumCulled=false;eyes.matrixAutoUpdate=false;
 eyes.matrix.copy(head.matrixWorld).invert();head.add(eyes);
 const optics={pupilColor:{value:material.color},eyeBindFromView:{value:new T.Matrix4()},eyeBall0:{value:new T.Vector4()},eyeBall1:{value:new T.Vector4()}};
 const transform=new T.Matrix4(),regions=STUDENT_EYE_REGIONS[variant];
 for(const [i,region] of regions.entries()){
  const [cx,cy,profile]=SCLERA_PATCHES[variant][i];
  const radius=variant==='boy'?.0125:variant==='ponytail'?.016:.014,z=region.center[2]-.33*(profile[0]-region.center[2]);
  transform.makeScale(radius,radius,radius).setPosition(cx,cy,z);
  eyes.setMatrixAt(i,transform);optics['eyeBall'+i].value.set(cx,cy,z,radius);
 }
 eyes.instanceMatrix.needsUpdate=true;
 return {optics,beforeDraw(camera){
  optics.eyeBindFromView.value.copy(eyes.matrixWorld).invert().multiply(camera.matrixWorld);
 },dispose(){eyes.removeFromParent();eyes.dispose();geometry.dispose();material.dispose();}};
}

export function createStudentEyes(model,{variant='boy',enabled=true}={}){
 const regions=enabled&&STUDENT_EYE_REGIONS[variant],entries=[];let disposed=false;
 if(!regions)return {dispose(){},diagnostics:()=>({enabled:false,reason:variant==='glasses'?'opaque-original-lenses':'unsupported-legacy-model',fixed:true,vertices:0})};
 model.updateWorldMatrix(true,true);
 const targets=[];model.traverse(mesh=>{if(mesh.isSkinnedMesh)targets.push(mesh);});
 for(const mesh of targets){
  const source=mesh.geometry,rest=mesh.matrixWorld.clone(),key=variant+':'+rest.elements.join(',');
  let cache=geometryCache.get(source);if(!cache){cache=new Map();geometryCache.set(source,cache);}
  let part=cache.get(key);if(!part){part=prepareEyeShell(source,rest,variant);if(!part)continue;cache.set(key,part);}
  const head=mesh.skeleton.bones.find(b=>/Head$/.test(b.name));
  const interiors=createInteriors(head,variant),material=eyeShellMaterial(mesh.material,regions,rest,interiors.optics);
  const shell=new T.SkinnedMesh(part.shell,material);shell.name='student-sclera-shell';
  shell.bindMode=mesh.bindMode;shell.bind(mesh.skeleton,mesh.bindMatrix);
  shell.frustumCulled=false;shell.castShadow=mesh.castShadow;shell.userData.characterSurface=true;
  shell.onBeforeRender=(_renderer,_scene,camera)=>interiors.beforeDraw(camera);
  mesh.add(shell);mesh.geometry=part.body;part.refs++;
  entries.push({mesh,source,cache,key,part,shell,material,interiors});
 }
 return {
  diagnostics:()=>({enabled:!!entries.length,fixed:true,vertices:entries.reduce((n,e)=>n+e.part.count,0),geometry:'two-inner-spheres-behind-milky-sclera'}),
  dispose(){if(disposed)return;disposed=true;for(const e of entries){
   e.interiors.dispose();e.mesh.geometry=e.source;e.shell.removeFromParent();e.material.dispose();
   if(--e.part.refs===0){e.part.body.dispose();e.part.shell.dispose();e.cache.delete(e.key);}
  }entries.length=0;}
 };
}
