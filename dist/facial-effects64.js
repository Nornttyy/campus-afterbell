import * as T from './vendor/three.module.js';
import {STUDENT_EYE_REGIONS} from './student-eyes56.js?v=campus-106';

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
const hairPalette={boy:'#403b34',girl:'#906e83',ponytail:'#876e59',glasses:'#4b4138'};
// Rest-pose heights of the white shoulder yokes and midtones sampled on each
// imported jacket. The sewn panels keep their shape when an arm is raised.
const jackets={
 boy:[1.009,'#298ef9'],girl:[1.018,'#3187fb'],
 ponytail:[.990,'#1e6cf5'],glasses:[.954,'#2d84f9']
};
function garmentFragment(variant){
 if(variant==='teacher')return `
 // Repair colour transferred from the arms onto the exposed shirt side.
 // The original buttons, collar and pen sit on the front of the torso.
 float sideCloth=cloth*smoothstep(.095,.15,abs(p.x))*(1.-smoothstep(.215,.255,abs(p.x)))*(1.-smoothstep(.09,.15,abs(p.z)));
 float shirt=sideCloth*smoothstep(.86,.91,p.y)*(1.-smoothstep(1.32,1.39,p.y));
 float gold=smoothstep(.035,.12,c.r-c.b);
 float dirty=max(gold,1.-smoothstep(.26,.52,min(c.r,c.g)));
 diffuseColor.rgb=mix(c,uniformTone*(.95+.05*smoothstep(.86,1.32,p.y)),shirt*dirty);`;
 return `
 float ax=abs(p.x);
 float sideCloth=cloth*smoothstep(.103,.161,ax)*(1.-smoothstep(.082,.148,abs(p.z)));
 float yoke=uniformYoke-.12*max(0.,ax-.22);
 float flank=sideCloth*smoothstep(.672,.694,p.y)*(1.-smoothstep(yoke-.041,yoke-.008,p.y));
 float shade=.90+.10*smoothstep(-.13,.11,p.z);
 diffuseColor.rgb=mix(c,uniformTone*shade,flank);
 float shoulder=cloth*smoothstep(.080,.146,ax)*smoothstep(yoke-.028,yoke+.002,p.y)*(1.-smoothstep(1.15,1.19,p.y));
 float blueDye=smoothstep(.18,.48,c.b-c.r)*smoothstep(.08,.23,c.g-c.r);
 float badge=smoothstep(.10,.24,c.r-c.b)*smoothstep(.035,.085,p.z);
 vec3 whiteCloth=vec3(.995,.990,1.)*clamp(dot(c,vec3(.30,.59,.11)),.912,.997);
 diffuseColor.rgb=mix(diffuseColor.rgb,whiteCloth,shoulder*(1.-max(blueDye,badge)));`;
}
export function createFacialEffects(model,{variant='boy'}={}){
 const profile=profiles[variant]||profiles.boy,rawEyes=profile.eyes||STUDENT_EYE_REGIONS[variant]||[],owned=[];
 // Gaze regions deliberately cover only the pupil/front. A closed eyelid must
 // cover the full sclera, including its bottom rim and curved side surface.
 const eyeRegions=rawEyes.map(eye=>({center:[eye.center[0],eye.center[1]-(variant==='teacher'?.003:.012),eye.center[2]],radius:eye.radius.map(v=>v*(variant==='teacher'?1.12:1.38))}));
 const hair=hairPalette[variant];
 const uniforms={...(hair?{hairTone:{value:new T.Color(hair)}}:{}),faceClosed:{value:0},faceInk:{value:0},faceBounds:{value:new T.Vector4(...profile.bounds)},faceSkin:{value:new T.Color(profile.skin)},faceEyeL:{value:new T.Vector4(...(eyeRegions[0]?[...eyeRegions[0].center.slice(0,2),...eyeRegions[0].radius]:[0,0,0,0]))},faceEyeR:{value:new T.Vector4(...(eyeRegions[1]?[...eyeRegions[1].center.slice(0,2),...eyeRegions[1].radius]:[0,0,0,0]))}};
 model.updateWorldMatrix(true,true);
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const joints=mesh.skeleton.bones;
  const index=name=>joints.findIndex(b=>b.name.replace(/^mixamorig[:_]?/,'')===name);
  const garmentBones=new T.Vector4(index('Spine'),index('LeftForeArm'),index('RightShoulder'),index('RightForeArm'));
  const rest=mesh.matrixWorld.clone(),normalFromLocal=new T.Matrix3().getNormalMatrix(rest);
  const patch=source=>{
   const material=source.clone(),previous=source.onBeforeCompile,cache=source.customProgramCacheKey.bind(source);
   material.onBeforeCompile=shader=>{
    previous.call(source,shader);Object.assign(shader.uniforms,uniforms,{faceRestFromLocal:{value:rest},hairNormalFromLocal:{value:normalFromLocal},garmentBones:{value:garmentBones},uniformTone:{value:new T.Color(jackets[variant]?.[1]||'#dce5d1')},uniformYoke:{value:jackets[variant]?.[0]||0}});
    shader.vertexShader='uniform vec4 garmentBones; varying float garmentWeight; varying vec3 faceRestPosition, hairNormal;\nuniform mat4 faceRestFromLocal; uniform mat3 hairNormalFromLocal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec4 armBones=step(garmentBones.x-.5,skinIndex)*(1.-step(garmentBones.y+.5,skinIndex))+step(garmentBones.z-.5,skinIndex)*(1.-step(garmentBones.w+.5,skinIndex));garmentWeight=dot(armBones+vec4(1.)-step(vec4(.5),skinIndex),skinWeight);faceRestPosition=(faceRestFromLocal*vec4(position,1.)).xyz;hairNormal=hairNormalFromLocal*normal;');
    shader.fragmentShader=`varying float garmentWeight; uniform vec3 uniformTone; uniform float uniformYoke; varying vec3 faceRestPosition, hairNormal;
${hair?'uniform vec3 hairTone;':''}
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
 vec3 p=faceRestPosition,c=diffuseColor.rgb;
 float cloth=smoothstep(.58,.93,garmentWeight);
 { ${garmentFragment(variant)} }
 ${hair?`c=diffuseColor.rgb;
 // The dark hair in the existing atlas shares a material with brows, lenses,
 // pupils and skin. Restrict the change to the cranium and side/back locks.
 float crown=smoothstep(${variant==='ponytail'?'1.428,1.455':'1.485,1.52'},faceRestPosition.y);
 float backHair=1.-smoothstep(.035,.105,faceRestPosition.z);
 float lock=smoothstep(.18,.23,abs(faceRestPosition.x))*step(faceRestPosition.z,.15);
 float head=smoothstep(${variant==='girl'?'1.01,1.09':'1.17,1.24'},faceRestPosition.y)*max(crown,max(backHair,lock));
 float skinReject=1.-smoothstep(.10,.29,c.r-c.b);
 float hairMask=head*skinReject*(1.-smoothstep(.18,.33,c.g));
 ${variant==='girl'?`float violet=smoothstep(.018,.065,c.r-c.g)*smoothstep(.007,.05,c.b-c.g);
 hairMask=violet*smoothstep(.96,1.04,faceRestPosition.y);`:''}
 hairMask*=1.-smoothstep(.055,.18,c.b-1.6*c.r);
 hairMask*=1.-cloth;
 float value=dot(c,vec3(.30,.59,.11));
 float crownLight=smoothstep(1.37,1.68,faceRestPosition.y+.20*faceRestPosition.z-.17*faceRestPosition.x);
 float shade=.56+.37*crownLight+.17*smoothstep(.001,.052,value);
 ${variant==='ponytail'?`float t=clamp((faceRestPosition.y-1.442)/.154,0.,1.);
 float notch=min(abs(faceRestPosition.x+.063-.023*t),abs(faceRestPosition.x-.070+.018*t));
 float width=.015*(1.-t);
 float crease=(1.-smoothstep(width*.5,width+.0025,notch))*smoothstep(.17,.205,faceRestPosition.z)*smoothstep(1.435,1.448,faceRestPosition.y)*(1.-smoothstep(.88,1.,t));
 shade*=1.-.79*crease;`:''}
 vec3 hairColor=hairTone*shade;
 vec3 n=normalize(hairNormal);
 ${variant==='boy'?`// The raised forelock shades its underside; the swept crown shares a
 // continuous warm plane with the temples in the classroom reference.
 float upper=smoothstep(-.42,.85,dot(n,normalize(vec3(.46,.84,-.29))));
 float crest=faceRestPosition.z+.12*faceRestPosition.x;
 float forelock=smoothstep(.145,.197,crest)*smoothstep(1.50,1.61,faceRestPosition.y);
 hairColor=mix(vec3(.013,.012,.009),vec3(.34,.289,.212),upper);
 float upperEdge=smoothstep(.06,.58,n.y);
 hairColor=mix(hairColor,mix(vec3(.0023,.0027,.0019),vec3(.070,.060,.041),upperEdge),forelock);`:''}
 ${variant==='girl'||variant==='ponytail'?`float plane=smoothstep(-.45,.85,dot(n,normalize(vec3(.36,.83,.25))));
 hairColor*=.71+.32*plane;`:''}
 ${variant==='girl'?`float t=clamp((faceRestPosition.y-1.50)/.145,0.,1.);
 float part=min(abs(faceRestPosition.x+.089-.017*t),abs(faceRestPosition.x-.034-.019*t));
 float seam=(1.-smoothstep(.002,.012*(1.-t)+.003,part))*smoothstep(.17,.235,faceRestPosition.z)*smoothstep(1.49,1.53,faceRestPosition.y)*(1.-smoothstep(.62,1.,t));
 hairColor*=1.-.48*seam;`:''}
 diffuseColor.rgb=mix(c,hairColor,hairMask);
 // Retain the warmer baked folds around the ears and nose, cooling just the
 // peach pigment shared by visible skin on the original student atlas.
 float complexion=smoothstep(.105,.28,c.r-c.g)*smoothstep(.045,.13,c.g-c.b)*smoothstep(.33,.65,c.r);
 diffuseColor.rgb*=mix(vec3(1.),vec3(.839,.938,1.024),complexion);
 ${variant==='girl'?`// The little light-coloured bar belongs to this side of the bob.
 float clip=smoothstep(.12,.20,faceRestPosition.x)*smoothstep(1.49,1.55,faceRestPosition.y)*smoothstep(.40,.70,min(c.r,c.g))*(1.-smoothstep(.13,.29,c.r-c.g));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.99,.83,.87),clip);`:''}`:''}
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
