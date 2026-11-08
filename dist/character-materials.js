import * as T from './vendor/three.module.js';

// Keep the authored colour texture, including palm-cap vertex colours.
// Share replacements across classmates without changing source GLB materials.
const baseMaterials=new WeakMap();
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
// Cast shadows may remain on the floor; the character never receives them.
export function useCharacterBaseColor(model){
 model.traverse(mesh=>{
  if(!mesh.isMesh)return;
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(baseColorMaterial):baseColorMaterial(mesh.material);
  mesh.receiveShadow=false;
  mesh.userData.characterSurface=true;
 });
 return model;
}
