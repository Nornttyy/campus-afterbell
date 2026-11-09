import * as T from './vendor/three.module.js';

// These are the existing eyes in the original, metre-space Tripo meshes.
// The heads are welded, so only the front eye surface turns; a smooth falloff
// keeps the eye sockets, eyelids, face and every shared boundary vertex still.
// No replacement eyeballs, pupil decals, new texture, or head model is used.
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
 return (1-smooth(.48,1,r))*smooth(...region.front,point.z);
}
const fract=x=>x-Math.floor(x);
const noise=x=>fract(Math.sin(x*12.9898+78.233)*43758.5453);
const geometryCache=new WeakMap();
// A glance every 3.6–5.8 seconds, with a long steady hold. The second eye
// catches up 70 ms later, instead of continuously shaking or crossing eyes.
export function studentEyeGaze(time,seed=0){
 const period=3.6+noise(seed+4)*2.2,offset=noise(seed+17)*period;
 function eye(delay){
  const t=(Math.max(0,time)+offset-delay)/period,k=Math.floor(t),phase=fract(t);
  const target=n=>[ (noise(seed*17+n*3+8)-.5)*.20,
    (noise(seed*11+n*7+21)-.5)*.08 ];
  const before=target(k-1),after=target(k),alpha=smooth(0,.065,phase);
  return before.map((v,i)=>T.MathUtils.lerp(v,after[i],alpha));
 }
 return [...eye(0),...eye(.07)];
}
const declarations=`
attribute vec2 studentEyeWeights;
uniform vec4 studentEyeGaze;
uniform vec3 studentEyeCenterL;
uniform vec3 studentEyeCenterR;
uniform mat4 studentEyeRestFromLocal;
uniform mat4 studentEyeLocalFromRest;
mat3 studentEyeRotation(vec2 angle) {
 float sy=sin(angle.x), cy=cos(angle.x), sx=sin(angle.y), cx=cos(angle.y);
 mat3 yaw=mat3(cy,0.,-sy, 0.,1.,0., sy,0.,cy);
 mat3 pitch=mat3(1.,0.,0., 0.,cx,sx, 0.,-sx,cx);
 return yaw*pitch;
}
`;
function shaderPatch(shader,uniforms){
 Object.assign(shader.uniforms,uniforms);
 shader.vertexShader=declarations+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vec3 studentEyeRest=(studentEyeRestFromLocal*vec4(transformed,1.)).xyz;
 vec3 studentEyeMoved=studentEyeRest;
 studentEyeMoved+=(studentEyeRotation(studentEyeGaze.xy)*(studentEyeRest-studentEyeCenterL)-(studentEyeRest-studentEyeCenterL))*studentEyeWeights.x;
 studentEyeMoved+=(studentEyeRotation(studentEyeGaze.zw)*(studentEyeRest-studentEyeCenterR)-(studentEyeRest-studentEyeCenterR))*studentEyeWeights.y;
 transformed=(studentEyeLocalFromRest*vec4(studentEyeMoved,1.)).xyz;
 `);
 shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
 vec3 studentEyeNormal=mat3(studentEyeRestFromLocal)*objectNormal;
 vec3 studentEyeTurnedNormal=studentEyeNormal;
 studentEyeTurnedNormal+=(studentEyeRotation(studentEyeGaze.xy)*studentEyeNormal-studentEyeNormal)*studentEyeWeights.x;
 studentEyeTurnedNormal+=(studentEyeRotation(studentEyeGaze.zw)*studentEyeNormal-studentEyeNormal)*studentEyeWeights.y;
 objectNormal=mat3(studentEyeLocalFromRest)*studentEyeTurnedNormal;
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
  const restFromLocal=mesh.matrixWorld.clone(),localFromRest=restFromLocal.clone().invert();
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
   const geometry=sourceGeometry.clone();geometry.setAttribute('studentEyeWeights',new T.BufferAttribute(weights,2));
   prepared={geometry,count,refs:0};cache.set(cacheKey,prepared);
  }
  prepared.refs++;const {geometry,count}=prepared;mesh.geometry=geometry;
  const uniforms={studentEyeGaze:{value:new T.Vector4()},studentEyeCenterL:{value:new T.Vector3(...regions[0].center)},studentEyeCenterR:{value:new T.Vector3(...regions[1].center)},studentEyeRestFromLocal:{value:restFromLocal},studentEyeLocalFromRest:{value:localFromRest}};
  function materialFor(source){
   const material=source.clone(),previousCompile=source.onBeforeCompile;
   material.name=source.name+'-moving-eyes';material.userData={...source.userData,studentEyes:true};
   material.onBeforeCompile=function(shader,renderer){previousCompile.call(this,shader,renderer);shaderPatch(shader,uniforms);};
   material.customProgramCacheKey=()=>`student-eyes56-v1:${source.customProgramCacheKey()}`;
   materials.add(material);return material;
  }
  const sourceMaterial=mesh.material;
  mesh.material=Array.isArray(sourceMaterial)?sourceMaterial.map(materialFor):materialFor(sourceMaterial);
  entries.push({mesh,geometry,sourceGeometry,sourceMaterial,uniforms,count,prepared,cache,cacheKey});
 });
 return {
  update(time){if(disposed)return;current=studentEyeGaze(time,seed);for(const entry of entries)entry.uniforms.studentEyeGaze.value.fromArray(current);},
  diagnostics:()=>({enabled:entries.length>0,gaze:[...current],vertices:entries.reduce((n,e)=>n+e.count,0)}),
  dispose(){if(disposed)return;disposed=true;for(const entry of entries){entry.mesh.geometry=entry.sourceGeometry;entry.mesh.material=entry.sourceMaterial;if(--entry.prepared.refs===0){entry.geometry.dispose();entry.cache.delete(entry.cacheKey);}}for(const material of materials)material.dispose();entries.length=0;materials.clear();}
 };
}
