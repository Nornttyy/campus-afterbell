import * as T from './vendor/three.module.js';
import {STUDENT_EYE_REGIONS} from './student-eyes56.js?v=campus-81';

// Masks use the original model's metre-space rest pose, before skinning. They
// therefore follow the head through sitting, struggling and floor stuns without
// placing a flat sticker in front of the face or tinting the shared shirt atlas.
const profiles={
 boy:{bounds:[1.16,1.65,.32,-.025],skin:'#ffc8a5'},
 girl:{bounds:[1.16,1.64,.32,-.025],skin:'#ffd1b2'},
 ponytail:{bounds:[1.12,1.59,.31,-.025],skin:'#fbc9a4'},
 glasses:{bounds:[1.16,1.65,.32,-.025],skin:'#ffc8a5'},
 teacher:{bounds:[1.48,2.04,.36,-.025],skin:'#ffdc71',eyes:[{center:[-.116,1.827,.219],radius:[.089,.107]},{center:[.114,1.827,.219],radius:[.089,.107]}]}
};
export function createFacialEffects(model,{variant='boy'}={}){
 const profile=profiles[variant]||profiles.boy,rawEyes=profile.eyes||STUDENT_EYE_REGIONS[variant]||[],owned=[];
 // Gaze regions deliberately cover only the pupil/front. A closed eyelid must
 // cover the full sclera, including its bottom rim and curved side surface.
 const eyeRegions=rawEyes.map(eye=>({center:[eye.center[0],eye.center[1]-(variant==='teacher'?.003:.012),eye.center[2]],radius:eye.radius.map(v=>v*(variant==='teacher'?1.12:1.38))}));
 const uniforms={faceClosed:{value:0},faceInk:{value:0},faceBounds:{value:new T.Vector4(...profile.bounds)},faceSkin:{value:new T.Color(profile.skin)},faceEyeL:{value:new T.Vector4(...(eyeRegions[0]?[...eyeRegions[0].center.slice(0,2),...eyeRegions[0].radius]:[0,0,0,0]))},faceEyeR:{value:new T.Vector4(...(eyeRegions[1]?[...eyeRegions[1].center.slice(0,2),...eyeRegions[1].radius]:[0,0,0,0]))}};
 model.updateWorldMatrix(true,true);
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const rest=mesh.matrixWorld.clone();
  const patch=source=>{
   const material=source.clone(),previous=source.onBeforeCompile,cache=source.customProgramCacheKey.bind(source);
   material.onBeforeCompile=shader=>{
    previous.call(source,shader);Object.assign(shader.uniforms,uniforms,{faceRestFromLocal:{value:rest}});
    shader.vertexShader='varying vec3 faceRestPosition;\nuniform mat4 faceRestFromLocal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfaceRestPosition=(faceRestFromLocal*vec4(position,1.)).xyz;');
    shader.fragmentShader=`varying vec3 faceRestPosition;
uniform float faceClosed;uniform float faceInk;uniform vec4 faceBounds;
uniform vec4 faceEyeL;uniform vec4 faceEyeR;uniform vec3 faceSkin;
vec2 lidMask(vec4 eye){
 if(eye.z<.001)return vec2(0.);
 vec2 p=(faceRestPosition.xy-eye.xy)/eye.zw;
 float disc=1.-smoothstep(.90,1.04,length(p));
 float slit=(1.-smoothstep(.035,.09,abs(p.y+.12-.16*p.x*p.x)))*(1.-smoothstep(.72,.88,abs(p.x)));
 return vec2(disc,slit);
}
`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec2 lids=max(lidMask(faceEyeL),lidMask(faceEyeR));
 float front=smoothstep(.07,.16,faceRestPosition.z);
 diffuseColor.rgb=mix(diffuseColor.rgb,mix(faceSkin,vec3(.035,.022,.014),lids.y),lids.x*front*faceClosed);
 float face=smoothstep(faceBounds.x,faceBounds.x+.02,faceRestPosition.y)*(1.-smoothstep(faceBounds.y-.025,faceBounds.y,faceRestPosition.y));
 face*=1.-smoothstep(faceBounds.z-.025,faceBounds.z,abs(faceRestPosition.x));
 face*=smoothstep(faceBounds.w,faceBounds.w+.025,faceRestPosition.z);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.002,.0025,.003),face*faceInk);
`);
   };
   material.customProgramCacheKey=()=>cache()+'-face64-'+variant;owned.push(material);return material;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(patch):patch(mesh.material);
 });
 let disposed=false;
 return{update({stunned=false,inkLeft=0}={},dt=0,reset=false){
  const goal=stunned?1:0;uniforms.faceClosed.value=reset?goal:T.MathUtils.damp(uniforms.faceClosed.value,goal,stunned?28:12,Math.max(0,dt));
  uniforms.faceInk.value=T.MathUtils.smoothstep(Math.max(0,Number(inkLeft)||0),0,1.5);
 },diagnostics:()=>({closed:uniforms.faceClosed.value,ink:uniforms.faceInk.value}),dispose(){if(disposed)return;disposed=true;owned.forEach(m=>m.dispose());}};
}
