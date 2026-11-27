import * as T from './vendor/three.module.js';
import {STUDENT_EYE_REGIONS} from './student-eyes56.js?v=campus-109&rev=119';

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
const hairPalette={boy:'#403b34',girl:'#906e83',ponytail:'#876e59',glasses:'#4d493e'};
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
 diffuseColor.rgb=mix(diffuseColor.rgb,whiteCloth,shoulder*(1.-max(blueDye,badge)));
 // A single cut of white cloth crosses the top of each outer sleeve. Its
 // edge follows the shoulder instead of the irregular source UV islands.
 float outer=cloth*smoothstep(.162,.234,ax)*smoothstep(.86,.90,p.y)*(1.-smoothstep(1.13,1.16,p.y));
 float seamY=uniformYoke-.32*max(0.,ax-.20)+.045*p.z;
 float aa=max(fwidth(p.y-seamY),.0014);
 float panel=smoothstep(-aa,aa,p.y-seamY);
 vec3 sleeve=mix(uniformTone*(.94+.07*smoothstep(-.10,.09,p.z)),vec3(.957,.954,.949),panel);
 diffuseColor.rgb=mix(diffuseColor.rgb,sleeve,outer);
 float back=(1.-smoothstep(-.042,.034,p.z))*(1.-smoothstep(.19,.24,ax));
 float yokeBack=cloth*back*smoothstep(.886,.91,p.y)*(1.-smoothstep(1.117,1.154,p.y));
 diffuseColor.rgb=mix(diffuseColor.rgb,sleeve,yokeBack);`;
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
 ${variant==='girl'?`float nape=smoothstep(1.21,1.27,p.y)*(1.-smoothstep(.00,.07,p.z));
 hairMask=max(hairMask,nape*(1.-smoothstep(.12,.26,c.g))*skinReject);`:''}
 hairMask*=1.-cloth;
 ${variant==='glasses'?'hairMask=max(hairMask,smoothstep(1.565,1.590,p.y)*(1.-cloth));':''}
 float value=dot(c,vec3(.30,.59,.11));
 float crownLight=smoothstep(1.37,1.68,faceRestPosition.y+.20*faceRestPosition.z-.17*faceRestPosition.x);
 float shade=.56+.37*crownLight+.17*smoothstep(.001,.052,value);
 ${variant==='ponytail'?`float t=clamp((faceRestPosition.y-1.442)/.154,0.,1.);
 float notch=min(abs(faceRestPosition.x+.063-.023*t),abs(faceRestPosition.x-.070+.018*t));
 float width=.015*(1.-t);
 float crease=(1.-smoothstep(width*.5,width+.0025,notch))*smoothstep(.17,.205,faceRestPosition.z)*smoothstep(1.435,1.448,faceRestPosition.y)*(1.-smoothstep(.88,1.,t));
 shade*=1.-.53*crease;`:''}
 vec3 hairColor=hairTone*shade;
 vec3 n=normalize(hairNormal);
 ${variant==='boy'?`// The raised forelock shades its underside; the swept crown shares a
 // continuous warm plane with the temples in the classroom reference.
 vec3 dome=normalize((p-vec3(0.,1.50,-.020))/vec3(.25,.23,.28));
 vec3 flow=normalize(mix(n,dome,.36));
 float upper=smoothstep(-.56,.90,dot(flow,normalize(vec3(.40,.82,-.27))));
 float crest=smoothstep(.105,.252,p.z+.12*p.x)*smoothstep(1.48,1.62,p.y);
 float underside=1.-smoothstep(-.58,.65,n.y);
 hairColor=mix(vec3(.021,.017,.014),vec3(.157,.132,.102),upper);
 hairColor*=1.-crest*(.25+.44*underside);`:''}
 ${variant==='girl'||variant==='ponytail'?`float plane=smoothstep(-.45,.85,dot(n,normalize(vec3(.36,.83,.25))));
 hairColor*=.71+.32*plane;`:''}
 ${variant==='girl'?`float hemShade=1.-smoothstep(1.20,1.41,p.y);
 hairColor*=mix(vec3(1.),vec3(.80,.75,.84),hemShade);`:''}
 diffuseColor.rgb=mix(c,hairColor,hairMask);
 // Unify the clay skin midtone and keep the small folds from the original atlas.
 float complexion=smoothstep(.105,.28,c.r-c.g)*smoothstep(.045,.13,c.g-c.b)*smoothstep(.33,.65,c.r);
 vec3 warmSkin=mix(c,vec3(.990,.640,.435),.25);
 diffuseColor.rgb=mix(diffuseColor.rgb,warmSkin,complexion*(1.-hairMask));
 ${variant==='glasses'?`// Only the front discs get this finish. Keep the frame, bridge and arms.
 float lensFront=smoothstep(.132,.194,p.z)*smoothstep(1.332,1.363,p.y)*(1.-smoothstep(1.52,1.558,p.y));
 float lens= lensFront*smoothstep(.21,.51,min(c.r,min(c.b,c.g)))*(1.-smoothstep(.038,.13,c.r-c.b));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.931,.909,.800),lens);
 float t=clamp((p.y-1.535)/.18,0.,1.);
 float gap=min(abs(p.x+.111-.031*t),abs(p.x-.035+.025*t));
 float part=(1.-smoothstep(.001,.004+.009*(1.-t),gap))*(1.-smoothstep(.50,1.,t))*smoothstep(.12,.19,p.z);
 diffuseColor.rgb*=1.-.61*part*hairMask;`:''}
 ${variant==='girl'||variant==='ponytail'?`
 // On the two girls the lip reads as one short pen-like stroke from a desk away.
 float mouthY=${variant==='girl'?'1.303':'1.250'};
 float mouthX=p.x+.004;
 float lipZone=(1.-smoothstep(.052,.068,abs(mouthX)))*(1.-smoothstep(.012,.022,abs(p.y-mouthY)))*smoothstep(.09,.13,p.z);
 float oldLip=smoothstep(.10,.28,c.r-c.g)*(1.-smoothstep(.43,.65,c.g));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.974,.603,.407),oldLip*lipZone);
 float strokeY=mouthY+.025*mouthX-.26*mouthX*mouthX;
 float lipDist=length(vec2(max(abs(mouthX)-.049,0.),p.y-strokeY))-.0029;
 float lipAA=max(fwidth(lipDist)*.60,.00045);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.165,.058,.028),lipZone*(1.-smoothstep(-lipAA,lipAA,lipDist)));`:''}
 ${variant==='girl'?`// The little light-coloured bar belongs to this side of the bob.
 float temple=smoothstep(.185,.220,p.x)*smoothstep(1.526,1.548,p.y)*(1.-smoothstep(1.636,1.655,p.y))*
              smoothstep(-.012,.008,p.z)*(1.-smoothstep(.116,.135,p.z));
 diffuseColor.rgb=mix(diffuseColor.rgb,hairColor,temple);
 // The pale arrow follows the curvature of the original barrette.
 float z=p.z-.061, y=p.y-(1.603-.42*z);
 float stem=max(abs(y)-.0058,abs(z)-.033);
 float tip=max(abs(abs(y)-(.035-z)*.72)-.0038,abs(z-.026)-.012);
 float dist=min(stem,tip),aa=max(fwidth(dist),.00045);
 float pin=1.-smoothstep(-aa,aa,dist);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.98,.79,.84),temple*pin);`:''}`:''}
 ${variant==='teacher'?`float axis=1.680+.73*p.x*p.x;
 float band=(1.-smoothstep(.017,.024,abs(p.y-axis)))*(1.-smoothstep(.163,.188,abs(p.x)))*smoothstep(.142,.162,p.z);
 float stain=1.-smoothstep(.54,.96,c.r);
 vec3 skin=mix(vec3(.965,.63,.15),vec3(.89,.56,.13),smoothstep(.03,.19,abs(p.x)));
 diffuseColor.rgb=mix(diffuseColor.rgb,skin,band*stain);
 float tri=1.-4.*abs(fract((p.x+.006)/.022)-.5);
 float taper=1.-smoothstep(.105,.177,abs(p.x));
 float d=abs(p.y-axis-tri*(.002+.0054*taper))-(.0015+.0019*taper);
 float aa=max(fwidth(d)*.63,.0005);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.035,.023,.013),(1.-smoothstep(-aa,aa,d))*band);`:''}
 vec2 lids=max(lidMask(faceEyeL),lidMask(faceEyeR));
 float front=smoothstep(.07,.16,faceRestPosition.z);
 diffuseColor.rgb=mix(diffuseColor.rgb,mix(faceSkin,vec3(.035,.022,.014),lids.y),lids.x*front*faceClosed);
 float face=smoothstep(faceBounds.x,faceBounds.x+.02,faceRestPosition.y)*(1.-smoothstep(faceBounds.y-.025,faceBounds.y,faceRestPosition.y));
 face*=1.-smoothstep(faceBounds.z-.025,faceBounds.z,abs(faceRestPosition.x));
 face*=smoothstep(faceBounds.w,faceBounds.w+.025,faceRestPosition.z);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.002,.0025,.003),face*faceInk);
`);
   if(variant==='glasses'){
    // The broad, opaque panes have a continuous face. Interpolating the
    // imported fan's cavity at its centre produces a spurious pinwheel.
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
     #ifndef CAMPUS_NIGHT
      float paneLight=.94+.045*smoothstep(1.355,1.52,p.y);
      outgoingLight=mix(outgoingLight,diffuseColor.rgb*paneLight,.97*lens*(1.-faceInk));
     #endif
     #include <opaque_fragment>`);
   }

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
