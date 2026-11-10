import {requireModelBudget} from './model-budget64.js';
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';

const names=Object.freeze({snack:'snack-packet',drink:'red-drink-can',burger:'layered-burger',ink:'ink-glass-bottle',banana:'curved-banana',bananaPeel:'banana-peel',garlic:'garlic-clove',gum:'bubblegum-wrapper',lunch:'teacher-lunchbox',pen:'red-school-pen'});
const templates=new Map();
export const CLASSROOM_PROP_SOURCES=Object.freeze(Object.fromEntries(['snack','drink','burger','ink','banana','garlic'].map(kind=>[kind,`./assets/models/${kind}-v1.glb?v=mesh-64`])));
const referenceSizes={snack:[.1721,.209,.056],drink:[.088,.1756,.0904],burger:[.2159,.1409,.2129],ink:[.094,.1575,.0975],banana:[.13,.25,.06],bananaPeel:[.20,.14,.20],garlic:[.09,.12,.06],gum:[.13,.06,.03],lunch:[.22,.07,.15],pen:[.023,.175,.023]};

// Move the contact point, not the imported mesh: wider/shorter source props keep
// their authored proportions while the thumb and index meet the actual surface.
export function propContact(prop,point){
  const fit=prop.userData.contactFit;
  return fit?point.clone().multiply(new THREE.Vector3(...fit.scale)).add(new THREE.Vector3(...fit.center)):point.clone();
}

export function restDeskItem(prop,floorY=.659){
  prop.position.y=0;prop.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(prop,true);
  prop.position.y=floorY-bounds.min.y+.003;
}

function makeTemplate(kind,gltf,url){
  requireModelBudget(gltf,kind);
  if(!gltf.scene?.isObject3D)throw new Error('Prop asset has no scene');
  if(gltf.animations?.length)throw new Error('Prop assets must be static');
  const model=gltf.scene.clone(true);let meshCount=0;
  model.traverse(o=>{
    if(o.isSkinnedMesh)throw new Error('Prop assets must not contain a skeleton');
    if(!o.isMesh)return;
    if(!o.geometry?.getAttribute('position')?.count)throw new Error('Prop mesh has no positions');
    meshCount++;o.castShadow=true;o.receiveShadow=true;
  });
  const bounds=new THREE.Box3().setFromObject(model,true);
  if(!meshCount||bounds.isEmpty()||![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite))throw new Error('Prop asset has invalid bounds');
  // Source exports already use metres, +Y up, +Z front and the existing grip
  // pivot. Keep all authored transforms and UVs beneath an identity wrapper.
  const template=new THREE.Group();template.name=names[kind];template.add(model);
  template.userData.propAsset=url;
  template.userData.contactFit={scale:bounds.getSize(new THREE.Vector3()).toArray().map((v,i)=>v/referenceSizes[kind][i]),center:bounds.getCenter(new THREE.Vector3()).toArray()};
  if(kind==='ink')template.userData.throwableKind='ink';
  return template;
}

/**
 * Preload only explicitly supplied assets before creating actors or inventory.
 * Relative URLs resolve beside this module. Omitted kinds stay unchanged; a
 * failed requested kind falls back to its procedural model. Existing clones
 * are not replaced or disposed. No sources means no requests or game changes.
 * Import this module without a query string so all callers share one registry.
 * An optional loader allows local GLB parsing in Node without browser image IO.
 */
export async function loadPropAssets(sources={}, {loader=new GLTFLoader()}={}){
  const results=await Promise.all(Object.entries(sources).map(async([kind,source])=>{
    try{
      if(!Object.hasOwn(names,kind))throw new RangeError(`Unsupported imported prop: ${kind}`);
      if(!(source instanceof URL)&&(typeof source!=='string'||!source.trim()))throw new TypeError(`Missing asset URL for ${kind}`);
      const url=new URL(source,import.meta.url).href;
      const template=makeTemplate(kind,await loader.loadAsync(url),url);
      templates.set(kind,template);return{kind};
    }catch(error){
      templates.delete(kind);return{kind,error};
    }
  }));
  return{loaded:results.filter(r=>!r.error).map(r=>r.kind),failed:results.filter(r=>r.error)};
}

// Object transforms are independent; geometry, materials and textures remain
// shared. Their lifetime belongs to the scene that uses the returned clones.
export function clonePropAsset(kind){return templates.get(kind)?.clone(true)||null;}
