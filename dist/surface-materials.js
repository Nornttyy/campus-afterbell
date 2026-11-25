import * as T from './vendor/three.module.js';

const root='./assets/materials/';
export const CAMPUS_SURFACE_SOURCES=Object.freeze({
 bookCover:root+'grade7-cover-107.webp',bookLeft:root+'lunyu-12-107.webp',bookRight:root+'laozi-4-107.webp',
 officeOak:root+'office-oak92.webp',floor:root+'classroom-aggregate91.webp',wall:root+'paint-plaster-34-lossless93.webp',board:root+'chalkboard-34-lossless93.webp',veneer:root+'maple-veneer91.webp',
 turf:root+'field-turf91.webp',track:root+'track-granules91.webp',tile:root+'washroom-tile91.webp',cloth:root+'dorm-flannel91.webp',facade:root+'school-facade91.webp',upholstery:root+'coach-upholstery91.webp',broth:root+'hotpot-broth91.webp'
});
// Generated albedo stays free of painted scene shadows; scene lights supply them.
export async function loadCampusSurfaces(files=CAMPUS_SURFACE_SOURCES){
 const loader=new T.TextureLoader();
 const entries=await Promise.all(Object.entries(files).map(async([key,file])=>{
  const map=await loader.loadAsync(new URL(file,import.meta.url).href);
  map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=key.startsWith('book')?T.ClampToEdgeWrapping:['wall','board'].includes(key)?T.MirroredRepeatWrapping:T.RepeatWrapping;
  map.anisotropy=4;return[key,map];
 }));
 return Object.fromEntries(entries);
}

export function surfaceHeight(source,assets,repeatX=1,repeatY=1){
 const detail=source.clone();detail.colorSpace=T.NoColorSpace;
 detail.repeat.set(repeatX,repeatY);detail.needsUpdate=true;assets.add(detail);return detail;
}

export function drawBoardSurface(context,width,height,source){
 if(!source?.image){context.fillStyle='#274338';context.fillRect(0,0,width,height);return;}
 // Square grain is repeated at its original aspect ratio, never stretched across a board.
 for(let x=0,n=0;x<width;x+=height,n++){
  context.save();context.translate(x+(n%2?height:0),0);context.scale(n%2?-1:1,1);
  context.drawImage(source.image,0,0,height,height);context.restore();
 }
}

export function addTerrazzoGrout(material){
 const strength={value:.18,moonlight:{value:0}};
 material.onBeforeCompile=shader=>{
  shader.uniforms.terrazzoJointStrength=strength;
  shader.uniforms.schoolMoonlight=strength.moonlight;
  shader.vertexShader='varying vec3 vTerrazzoPosition;\n'+shader.vertexShader.replace('#include <worldpos_vertex>',
   '#include <worldpos_vertex>\nvTerrazzoPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='uniform float schoolMoonlight; varying vec3 vTerrazzoPosition; uniform float terrazzoJointStrength;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   #ifdef USE_MAP
    vec2 slabUv=vTerrazzoPosition.xz/.81;
    vec2 cellEdge=min(fract(slabUv),1.0-fract(slabUv));
    vec2 antialias=max(fwidth(slabUv),vec2(0.0001));
    vec2 seam=(1.0-smoothstep(vec2(0.0013),vec2(0.0013)+antialias,cellEdge))
                   *min(vec2(1.0),vec2(.009)/antialias);
    float slabTone=fract(sin(mod(dot(floor(slabUv),vec2(13.1,27.7)),6.283))*476.48);
    diffuseColor.rgb*=(.967+.045*slabTone)*(1.0-terrazzoJointStrength*max(seam.x,seam.y));
   #endif`).replace('#include <aomap_fragment>',`#include <aomap_fragment>
    if(schoolMoonlight>.0){
     vec2 q=vTerrazzoPosition.xz;
     float d=q.x+6.65, windowZ=(q.y+d*.32+10.)/3.134;
     float aperture=abs(fract(windowZ)-.5);
     float moonPatch=smoothstep(.025,.12,aperture)*(1.-smoothstep(.34,.52,aperture));
     moonPatch*=smoothstep(.45,1.65,d)*(1.-smoothstep(4.7,7.15,d))*step(0.,windowZ)*step(windowZ,6.);
     reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.014,.024,.051)*moonPatch;
    }`);
 };
 material.customProgramCacheKey=()=> 'terrazzo-grout-88';
 return strength;
}

// Box walls use metres, so a narrow pier and a long corridor have the same grain size.
export function setWallSurfaceUV(object,assets,metres=1){
 const geometry=object.geometry.clone(),p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)*object.scale.x+object.position.x,y=p.getY(i)*object.scale.y+object.position.y,z=p.getZ(i)*object.scale.z+object.position.z;
  if(Math.abs(n.getX(i))>.5)uv.setXY(i,z/metres,y/metres);
  else if(Math.abs(n.getY(i))>.5)uv.setXY(i,x/metres,z/metres);
  else uv.setXY(i,x/metres,y/metres);
 }
 object.geometry=geometry;assets.add(geometry);return object;
}

// Fixed architectural contact only attenuates indirect bounce. Sunlight and
// moving-object shadows remain real scene lights. No full-screen dark overlay.
export function addWallContact(material){
 const previous=material.onBeforeCompile;
 material.onBeforeCompile=shader=>{
  previous?.(shader);
  shader.vertexShader='varying vec3 vWallPosition72;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',
   '#include <worldpos_vertex>\nvWallPosition72 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader='varying vec3 vWallPosition72;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
   float lowerContact = 1.0-smoothstep(0.13,0.43,vWallPosition72.y);
   float ceilingContact = 1.0-smoothstep(0.0,0.22,abs(vWallPosition72.y-4.51));
   reflectedLight.indirectDiffuse *= 1.0 - 0.16*lowerContact - 0.12*ceilingContact;`);
 };
 material.customProgramCacheKey=()=> 'classroom-wall-contact72';
}
