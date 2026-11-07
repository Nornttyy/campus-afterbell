import * as T from './vendor/three.module.js';

// Generated albedo stays free of painted scene shadows; scene lights supply them.
export async function loadCampusSurfaces(){
 const loader=new T.TextureLoader();
 const files={floor:'./assets/materials/terrazzo-34.png',wall:'./assets/materials/paint-plaster-34.png',board:'./assets/materials/chalkboard-34.png'};
 const entries=await Promise.all(Object.entries(files).map(async([key,file])=>{
  const map=await loader.loadAsync(new URL(file,import.meta.url).href);
  map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.MirroredRepeatWrapping;
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
 material.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   #ifdef USE_MAP
    vec2 cellEdge=min(fract(vMapUv),1.0-fract(vMapUv));
    vec2 antialias=max(fwidth(vMapUv),vec2(0.0001));
    vec2 seam=1.0-smoothstep(vec2(0.0008),vec2(0.0008)+antialias,cellEdge);
    diffuseColor.rgb*=1.0-0.18*max(seam.x,seam.y);
   #endif`);
 };
 material.customProgramCacheKey=()=> 'terrazzo-grout-34';
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
