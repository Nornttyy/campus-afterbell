import * as T from './vendor/three.module.js';
import {CLASSROOM,CORRIDOR,OFFICE} from './classroom-layout.js?v=campus-95';

// The three colour channels store window bounce near the floor, window bounce
// at eye height, and diffuse light near the suspended hall tubes. One bilinear
// lookup covers the architecture on both desktop and touch devices.
const margin=.44;
const left=CLASSROOM.minX-margin,right=CORRIDOR.maxX+margin;
const back=CORRIDOR.minZ-margin,front=CLASSROOM.maxZ+margin;
const partition=(CLASSROOM.maxX+CORRIDOR.minX)/2;
const width=80,height=112;

function makeDaySky(){
 const w=256,h=128,pixels=new Uint8Array(w*h*4);
 const horizon=[231,237,229],zenith=[111,181,220];
 for(let y=0;y<h;y++){
  const altitude=Math.sin(((y+.5)/h-.5)*Math.PI);
  const rise=Math.pow(Math.max(0,altitude),.70);
  for(let x=0;x<w;x++){
   const towardWindows=.5-.5*Math.cos(((x+.5)/w-.5)*2*Math.PI);
   const haze=towardWindows*.08*(1-rise);
   const i=(y*w+x)*4;
   for(let c=0;c<3;c++)pixels[i+c]=Math.round(T.MathUtils.lerp(horizon[c],zenith[c],rise*(1-haze)));
   pixels[i+3]=255;
  }
 }
 const sky=new T.DataTexture(pixels,w,h,T.RGBAFormat);
 sky.name='ordinary-classroom-day-sky';sky.mapping=T.EquirectangularReflectionMapping;
 sky.colorSpace=T.SRGBColorSpace;sky.magFilter=sky.minFilter=T.LinearFilter;sky.needsUpdate=true;return sky;
}

function makeBounceMap(openings,lamps){
 const data=new Uint8Array(width*height*4);
 for(let row=0;row<height;row++)for(let col=0;col<width;col++){
  const x=left+(col+.5)/width*(right-left),z=back+(row+.5)/height*(front-back);
  const hall=x>partition;
  let low=0,high=0,nearestLamp=Infinity;
  for(const pane of openings){
   if(hall?pane.side===-1:pane.side===2)continue;
   const dx=Math.max(.36,Math.abs(x-pane.x)),dz=Math.max(0,pane.minZ-z,z-pane.maxZ);
   const d=Math.hypot(dx,dz),arc=Math.atan2(pane.maxZ-z,dx)-Math.atan2(pane.minZ-z,dx);
   const weight=arc*(pane.side===1?(hall?.42:.23):1);
   low+=weight*(Math.atan2(pane.top-.28,d)-Math.atan2(pane.bottom-.28,d));
   high+=weight*(Math.atan2(pane.top-2.05,d)-Math.atan2(pane.bottom-2.05,d));
  }
  if(hall)for(const p of lamps)nearestLamp=Math.min(nearestLamp,(x-p.x)**2+Math.max(0,Math.abs(z-p.z)-.58)**2);
  const edge=hall?Math.min(x-partition,CORRIDOR.maxX-x,z-CORRIDOR.minZ,CORRIDOR.maxZ-z)
   :Math.min(x-CLASSROOM.minX,partition-x,z-CLASSROOM.minZ,CLASSROOM.maxZ-z);
  const i=(row*width+col)*4;
  data[i]=Math.round(255*(1-Math.exp(-1.05*low)));
  data[i+1]=Math.round(255*(1-Math.exp(-.83*high)));
  data[i+2]=Math.round(255*Math.exp(-nearestLamp/1.65));
  data[i+3]=Math.round(255*T.MathUtils.smoothstep(edge,-.15,1.35));
 }
 const map=new T.DataTexture(data,width,height,T.RGBAFormat);
 map.name='ordinary-classroom-window-bounce';map.magFilter=map.minFilter=T.LinearFilter;map.needsUpdate=true;
 return map;
}

// Parentheses keep a negative building coordinate from forming the GLSL
// decrement token when it follows a subtraction in a projected ray.
const f=n=>'('+n.toFixed(4)+')';
const location=`
 vec3 p88=vCampusPosition88;
 bool hall88=p88.x>${f(partition)};
 bool inside88=p88.x>${f(left)}&&p88.x<${f(right)}&&p88.z<${f(front)}&&p88.z>(hall88?${f(back)}:${f(CLASSROOM.minZ-margin)});
 vec2 uv88=(p88.xz-vec2(${f(left)},${f(back)}))/vec2(${f(right-left)},${f(front-back)});
`;

// A mipmapped transmission mask follows the actual aperture, aluminium meeting
// rail and transom of each window. Distant light pools have broader penumbrae.
function makeWindowMask(openings){
 const w=256,h=64,data=new Uint8Array(w*h*4),height=4.51,span=CLASSROOM.maxZ-CLASSROOM.minZ;
 const side=openings.filter(o=>o.side===-1);
 for(let row=0;row<h;row++)for(let col=0;col<w;col++){
  const z=CLASSROOM.minZ+(col+.5)*span/w,y=(row+.5)*height/h;
  const pane=side.find(o=>z>o.minZ&&z<o.maxZ&&y>o.bottom&&y<o.top);
  let value=0;
  if(pane){
   const jamb=Math.min(z-pane.minZ,pane.maxZ-z,y-pane.bottom,pane.top-y);
   const stile=Math.abs(z-(pane.minZ+pane.maxZ)/2),rail=Math.abs(y-(pane.top-.50));
   value=T.MathUtils.smoothstep(Math.min(jamb-.065,stile-.035,rail-.04),0,.075);
  }
  const index=(row*w+col)*4;data[index]=data[index+1]=data[index+2]=Math.round(value*255);data[index+3]=255;
 }
 const mask=new T.DataTexture(data,w,h,T.RGBAFormat);mask.name='ordinary-window-transmission';
 mask.minFilter=T.LinearMipmapLinearFilter;mask.magFilter=T.LinearFilter;mask.generateMipmaps=true;mask.needsUpdate=true;return mask;
}
const sunlight=`
 uniform sampler2D campusWindow94;
 float windowTransmission94(vec3 p,float blur){
  float distanceToWindow=max(0.0,p.x-${f(CLASSROOM.minX-.10)});
  vec2 hit=vec2(p.z+distanceToWindow*(9.0/17.0),p.y+distanceToWindow*(6.75/17.0));
  vec2 uv=(hit-vec2(${f(CLASSROOM.minZ)},0.0))/vec2(${f(CLASSROOM.maxZ-CLASSROOM.minZ)},4.51);
  if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))return 0.0;
  return texture2D(campusWindow94,uv,blur).r;
 }
`;
const portableSun=`
 #ifndef USE_SHADOWMAP
  reflectedLight.directDiffuse*=mix(.42,1.0,hall88?0.0:windowTransmission94(p88,1.5));
 #endif`;

const finishes={
 wall:`diffuseColor.rgb*=mix(vec3(.86,.83,.77),vec3(1.05,1.015,.94),day88);
  if(hall88){
   float end88=smoothstep(0.0,4.0,p88.z-${f(CORRIDOR.minZ)});
   float cove88=smoothstep(0.0,.48,4.50-p88.y);
   diffuseColor.rgb*=mix(.83,1.0,end88)*mix(.89,1.0,cove88);
  }
  diffuseColor.rgb*=1.0-.095*(1.0-smoothstep(.06,.65,p88.y));`,
 frame:`diffuseColor.rgb*=mix(vec3(.75,.74,.66),vec3(.92,.89,.84),day88);`,
 floor:`diffuseColor.rgb*=mix(vec3(.65,.74,.73),vec3(.99,1.00,.98),day88);
  diffuseColor.rgb*=mix(.88,1.0,field88.a);
  if(!hall88){
   float pool=windowTransmission94(p88,2.8);
   diffuseColor.rgb*=mix(vec3(.88,.91,.96),vec3(1.13,1.10,1.065),pool);
  }`,
 furniture:`float wood88=smoothstep(1.22,1.72,diffuseColor.r/max(.001,diffuseColor.g))*(1.0-smoothstep(.50,.86,diffuseColor.b/max(.001,diffuseColor.g)));
  diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.90,1.04,.89),wood88);`,
 ceiling:`if(hall88){
   vec2 course88=vec2((p88.x-${f(CORRIDOR.minX)})/.67,p88.z/2.8);
   course88.y+=.5*mod(floor(course88.x),2.0);
   vec2 cell88=abs(fract(course88+.5)-.5),aa88=max(fwidth(course88),vec2(.00025));
   vec2 joint88=(1.0-smoothstep(vec2(0.0),aa88+vec2(.0045,.0012),cell88))*min(vec2(1.0),vec2(.015,.005)/aa88);
   diffuseColor.rgb*=vec3(.63,.73,.75)*mix(.82,1.17,.32*day88+.68*field88.b)*mix(.78,1.0,field88.a);
   diffuseColor.rgb*=1.0-.18*max(joint88.x,joint88.y);
  }else{
   vec3 perimeter=mix(vec3(.80,.82,.80),vec3(.90,.83,.77),field88.a);
   diffuseColor.rgb*=perimeter*mix(.84,1.12,day88)*mix(.78,1.0,field88.a);
  }`,
 glass:`vec2 border88=min(vPaneUv88,1.0-vPaneUv88);
  float edge88=smoothstep(.015,.19,min(border88.x,border88.y));
  float grazing88=1.0-max(0.0,abs(dot(normal,normalize(vViewPosition))));
  diffuseColor.rgb*=mix(vec3(.70,.69,.70),vec3(.89,.83,.86),.52*vPaneUv88.y+.35*(1.0-edge88)+.13*day88);
  float overhead=smoothstep(.16,.96,vPaneUv88.y);
  diffuseColor.rgb*=mix(vec3(.81,.88,.92),vec3(1.06,1.035,.98),overhead);
  diffuseColor.a=mix(.77,.91,clamp(.66*edge88+.34*grazing88,0.0,1.0));`
};

export function createClassroomDaylight(openings,lamps){
 const map=makeBounceMap(openings,lamps),windowMask=makeWindowMask(openings),enabled={value:false},bound=new Set(),glassMaterials=[];
 // Include both poses of the swinging classroom doors and the office door.
 const paneBounds=[
  new T.Box3(new T.Vector3(partition-1.7,1.04,CLASSROOM.minZ-.2),new T.Vector3(partition+1.7,4.22,CLASSROOM.maxZ+.2)),
  new T.Box3(new T.Vector3(OFFICE.doorMinX-.2,1.28,OFFICE.doorZ-1.7),new T.Vector3(OFFICE.doorMaxX+.2,4.22,OFFICE.doorZ+1.7))
 ];
 const frustum=new T.Frustum(),viewProjection=new T.Matrix4();
 function bind(material,finish){
  if(!material?.isMeshStandardMaterial||bound.has(material))return;
  bound.add(material);
  if(finish==='glass')glassMaterials.push(material);
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
   previous.call(this,shader,renderer);
   shader.uniforms.campusWindow94={value:windowMask};shader.uniforms.campusDay88=enabled;shader.uniforms.campusBounce88={value:map};
   const vary='varying vec3 vCampusPosition88;\n'+(finish==='glass'?'varying vec2 vPaneUv88;\n':'');
   shader.vertexShader=vary+shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
    vec4 local88=vec4(transformed,1.0);
    #ifdef USE_BATCHING
     local88=batchingMatrix*local88;
    #endif
    #ifdef USE_INSTANCING
     local88=instanceMatrix*local88;
    #endif
    vCampusPosition88=(modelMatrix*local88).xyz;
    ${finish==='glass'?'vPaneUv88=uv;':''}`);
   shader.fragmentShader=sunlight+vary+'uniform bool campusDay88;\nuniform sampler2D campusBounce88;\n'+shader.fragmentShader
    .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
     ${location}
     float day88=0.0;vec4 field88=vec4(1.0);
     if(campusDay88&&inside88){
      field88=texture2D(campusBounce88,uv88);
      day88=mix(field88.r,field88.g,smoothstep(.4,2.25,p88.y));
      ${finishes[finish]}
     }`)
    .replace('#include <aomap_fragment>',`#include <aomap_fragment>
     if(campusDay88&&inside88){
      reflectedLight.indirectDiffuse*=mix(vec3(.86,.89,.87),vec3(1.14,1.11,1.07),day88);
      ${portableSun}
     }`);
  };
  material.customProgramCacheKey=()=>key+'-daylight88-'+finish;material.needsUpdate=true;
 }
 return{map,windowMask,sky:makeDaySky(),bind,
  setActive(value){
   if(enabled.value===Boolean(value))return;
   enabled.value=Boolean(value);
   // Keep normal source-alpha colour. Clear only the destination alpha at
   // visible frosted fragments, so the compositor can identify the real panes.
   for(const m of glassMaterials){
    m.blending=value?T.CustomBlending:T.NormalBlending;
    m.blendSrcAlpha=m.blendDstAlpha=value?T.ZeroFactor:null;
   }
  },
  glassInView(camera){
   if(!enabled.value)return false;
   frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
   return paneBounds.some(box=>frustum.intersectsBox(box));
  }
 };
}
