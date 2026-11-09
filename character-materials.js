import * as T from './vendor/three.module.js';

// Keep the authored colour texture, including palm-cap vertex colours.
// Share replacements across classmates without changing source GLB materials.
const baseMaterials=new WeakMap();
const nightMaterials=new WeakMap(),dayMaterials=new WeakMap();
function baseColorMaterial(source){
 if(source.userData.characterBaseColor)return source;
 let material=baseMaterials.get(source);
 if(!material){
  material=new T.MeshBasicMaterial({
   map:source.map||null,alphaMap:source.alphaMap||null,
   color:source.color||0xffffff,vertexColors:!!source.vertexColors,
   side:source.side,transparent:source.transparent,opacity:source.opacity,
   alphaTest:source.alphaTest,alphaHash:source.alphaHash,
   depthWrite:source.depthWrite,depthTest:source.depthTest,
   blending:source.blending,premultipliedAlpha:source.premultipliedAlpha,
   polygonOffset:source.polygonOffset,polygonOffsetFactor:source.polygonOffsetFactor,
   polygonOffsetUnits:source.polygonOffsetUnits,
   toneMapped:false,fog:false
  });
  material.name=source.name;
  material.userData={...source.userData,characterBaseColor:true};
  baseMaterials.set(source,material);
 }
 return material;
}

// Apply only to a character's model, before attaching held objects.
// Daytime keeps authored colours; the power-cut variant enables diffuse light.
export function useCharacterBaseColor(model){
 model.traverse(mesh=>{
  if(!mesh.isMesh)return;
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(baseColorMaterial):baseColorMaterial(mesh.material);
  mesh.receiveShadow=false;
  mesh.userData.characterSurface=true;
 });
 return model;
}

// The authored daytime colour remains untouched. In the power-cut classroom
// use real diffuse lighting, so white eyes, clothes and hands cannot glow in
// darkness. Cache both states; switching floors does not recreate textures.
export function setCharacterNight(model,night=false){
 function select(source){
  const day=dayMaterials.get(source)||source;
  if(!night)return day;
  let lit=nightMaterials.get(day);
  if(!lit){
   lit=new T.MeshLambertMaterial();
   for(const key of ['map','alphaMap','vertexColors','side','transparent','opacity','alphaTest','alphaHash','depthWrite','depthTest','blending','premultipliedAlpha','polygonOffset','polygonOffsetFactor','polygonOffsetUnits'])lit[key]=day[key];
   lit.color.copy(day.color);lit.emissive.set(0);lit.toneMapped=true;lit.fog=true;
   lit.name=day.name+'-night';lit.userData={...day.userData,characterNight:true};
   lit.onBeforeCompile=day.onBeforeCompile;lit.customProgramCacheKey=day.customProgramCacheKey;
   nightMaterials.set(day,lit);dayMaterials.set(lit,day);
   day.addEventListener('dispose',()=>{lit.dispose();nightMaterials.delete(day);dayMaterials.delete(lit);});
  }
  return lit;
 }
 model.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.userData.characterSurface)return;
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(select):select(mesh.material);
  mesh.receiveShadow=Boolean(night);
 });
}
