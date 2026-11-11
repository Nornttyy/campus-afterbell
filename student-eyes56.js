import * as T from './vendor/three.module.js';

// Remove the source model's raised pupil once, then keep the eyeballs stationary.
// Repaint only the central sclera
// and evaluate a small pupil on its curved surface, in head-rest coordinates.
// The pupil therefore sits within the eye rather than floating in front of it.
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
 return (1-smooth(.72,1,r))*smooth(...region.front,point.z);
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
// A glance every 3.6–5.8 seconds, with a long steady hold. The second eye
// catches up 70 ms later, instead of continuously shaking or crossing eyes.
export function studentEyeGaze(time,seed=0){
 const period=3.6+noise(seed+4)*2.2,offset=noise(seed+17)*period;
 function eye(delay){
  const t=(Math.max(0,time)+offset-delay)/period,k=Math.floor(t),phase=fract(t);
  const target=n=>[ (noise(seed*17+n*3+8)-.5)*.76,
    (noise(seed*11+n*7+21)-.5)*.38 ];
  const before=target(k-1),after=target(k),alpha=smooth(0,.065,phase);
  return before.map((v,i)=>T.MathUtils.lerp(v,after[i],alpha));
 }
 return [...eye(0),...eye(.07)];
}
export function clampStudentEyeLook(yaw=0,pitch=0){
 return [T.MathUtils.clamp(Number(yaw)||0,-.52,.52),T.MathUtils.clamp(Number(pitch)||0,-.34,.34)];
}
function shaderPatch(shader,uniforms){
 Object.assign(shader.uniforms,uniforms);
 shader.vertexShader=`attribute vec2 studentEyeWeights;
 varying vec2 studentEyeMask;
 varying vec3 studentEyeRest;
 uniform mat4 studentEyeRestFromLocal;
 `+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 studentEyeRest=(studentEyeRestFromLocal*vec4(position,1.)).xyz;
 studentEyeMask=studentEyeWeights;
 `);
 shader.fragmentShader=`varying vec2 studentEyeMask;
 varying vec3 studentEyeRest;
 uniform vec4 studentEyeGaze;
 uniform vec3 studentEyeCenterL;
 uniform vec3 studentEyeCenterR;
 uniform vec3 studentEyeRadius;
 vec3 studentEyeSurface(vec3 center,vec2 angles){
  vec3 surface=normalize((studentEyeRest-center)/studentEyeRadius);
  vec3 direction=vec3(sin(angles.x)*cos(angles.y),sin(angles.y),cos(angles.x)*cos(angles.y));
  float alignment=dot(surface,direction);
  float edge=max(fwidth(alignment),.00015);
  float pupil=smoothstep(.9905-edge,.9905+edge,alignment);
  vec3 white=vec3(.96,.965,.95);
  return mix(white,vec3(.004,.004,.005),pupil);
 }
 `+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 if(studentEyeMask.x+studentEyeMask.y>.001){
  diffuseColor.rgb=mix(diffuseColor.rgb,studentEyeSurface(studentEyeCenterL,studentEyeGaze.xy),studentEyeMask.x);
  diffuseColor.rgb=mix(diffuseColor.rgb,studentEyeSurface(studentEyeCenterR,studentEyeGaze.zw),studentEyeMask.y);
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
   const weights=new Float32Array(position.count*2),point=new T.Vector3();let count=0;
   for(let i=0;i<position.count;i++){
    point.fromBufferAttribute(position,i).applyMatrix4(restFromLocal);
    for(let e=0;e<2;e++)weights[i*2+e]=eyeSurfaceWeight(point,regions[e]);
    if(weights[i*2]+weights[i*2+1]>.0001)count++;
   }
   if(!count)return;
   const geometry=sourceGeometry.clone();repairPupilCaps(geometry,restFromLocal,variant);
   geometry.setAttribute('studentEyeWeights',new T.BufferAttribute(weights,2));
   prepared={geometry,count,refs:0};cache.set(cacheKey,prepared);
  }
  prepared.refs++;const {geometry,count}=prepared;mesh.geometry=geometry;
  const uniforms={studentEyeGaze:{value:new T.Vector4()},studentEyeCenterL:{value:new T.Vector3(...regions[0].center)},studentEyeCenterR:{value:new T.Vector3(...regions[1].center)},studentEyeRestFromLocal:{value:restFromLocal},studentEyeRadius:{value:new T.Vector3(...regions[0].radius,variant==='boy'?.075:variant==='girl'?.064:.063)}};
  function materialFor(source){
   const material=source.clone(),previousCompile=source.onBeforeCompile;
   material.name=source.name+'-moving-eyes';material.userData={...source.userData,studentEyes:true};
   material.onBeforeCompile=function(shader,renderer){previousCompile.call(this,shader,renderer);shaderPatch(shader,uniforms);};
   material.customProgramCacheKey=()=>`student-eyes68-inset:${source.customProgramCacheKey()}`;
   materials.add(material);return material;
  }
  const sourceMaterial=mesh.material;
  mesh.material=Array.isArray(sourceMaterial)?sourceMaterial.map(materialFor):materialFor(sourceMaterial);
  entries.push({mesh,geometry,sourceGeometry,sourceMaterial,uniforms,count,prepared,cache,cacheKey});
 });
 return {
  update(time,look=null){if(disposed)return;current=look?[...clampStudentEyeLook(look.yaw,look.pitch),...clampStudentEyeLook(look.yaw,look.pitch)]:studentEyeGaze(time,seed);for(const entry of entries)entry.uniforms.studentEyeGaze.value.fromArray(current);},
  diagnostics:()=>({enabled:entries.length>0,gaze:[...current],vertices:entries.reduce((n,e)=>n+e.count,0)}),
  dispose(){if(disposed)return;disposed=true;for(const entry of entries){entry.mesh.geometry=entry.sourceGeometry;entry.mesh.material=entry.sourceMaterial;if(--entry.prepared.refs===0){entry.geometry.dispose();entry.cache.delete(entry.cacheKey);}}for(const material of materials)material.dispose();entries.length=0;materials.clear();}
 };
}
