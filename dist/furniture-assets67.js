import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
import {requireModelBudget} from './model-budget64.js';
const registry=new Map();
export const FURNITURE_SOURCES67=Object.freeze(Object.assign(Object.fromEntries(['mouse','keyboard','computer-tower','monitor','office-desk','office-chair','cabinet'].map(name=>[name,`./assets/models/${name}-v67.glb?v=tripo67`])),{toilet:'./assets/models/toilet-v78.glb?v=campus-83'}));
export const MONITOR67=Object.freeze({width:.598,height:.328,x:0,y:.305,z:-.037});
export async function loadFurniture67({loader=new GLTFLoader()}={}){
 return Promise.all(Object.entries(FURNITURE_SOURCES67).map(async([name,path])=>{
  try{const url=new URL(path,import.meta.url).href,gltf=await loader.loadAsync(url);requireModelBudget(gltf,name);if(gltf.animations?.length)throw Error('Furniture must be static');const root=gltf.scene;root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root,true);if(bounds.isEmpty()||bounds.min.y<-.01)throw Error('Invalid floor contact');root.traverse(o=>{if(o.isSkinnedMesh)throw Error('Unexpected skin');if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});root.userData.furnitureAsset=url;registry.set(name,root);return{name,ok:true};}catch(e){registry.delete(name);return{name,ok:false,error:String(e)};}
 }));
}
export function cloneFurniture67(name){const template=registry.get(name);if(!template)return null;const root=new T.Group();root.name='tripo67-'+name;root.userData.furnitureAsset=template.userData.furnitureAsset;root.add(template.clone(true));return root;}
export function placeFurniture67(parent,name,x=0,y=0,z=0){const root=cloneFurniture67(name);if(!root)return null;root.position.set(x,y,z);parent.add(root);return root;}
export function hasComputer67(){return ['monitor','keyboard','mouse','computer-tower'].every(name=>registry.has(name));}
