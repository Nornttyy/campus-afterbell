import {BufferAttribute} from './vendor/three.module.js';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';

const manifestUrl=new URL('./assets/stream93/models.json?v=campus-107',import.meta.url);
const cacheName='campus-afterbell-models-93';
let manifest,storage;

function catalog(){
 if(!manifest)manifest=fetch(manifestUrl).then(response=>{
  if(!response.ok)throw Error('Model manifest '+response.status);
  return response.json();
 }).catch(error=>{manifest=null;throw error;});
 return manifest;
}

async function modelBytes(url,onProgress){
 // The immutable file name includes a content hash. Keeping these compressed
 // bytes on disk also helps mobile browsers whose ordinary HTTP cache is small.
 storage??=Promise.resolve().then(()=>globalThis.caches?.open(cacheName)).catch(()=>null);
 const cache=await storage;
 const saved=await cache?.match(url).catch(()=>null);
 const response=saved||await fetch(url);
 if(!response.ok)throw Error('Model download '+response.status);
 const bytes=await response.arrayBuffer();
 const data=new Uint8Array(bytes);
 let decoded=bytes;
 try{
  if(data[0]===31&&data[1]===139){
   decoded=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  const header=new DataView(decoded);
  if(header.byteLength<20||header.getUint32(0,true)!==0x46546c67||header.getUint32(8,true)!==header.byteLength)throw Error('Invalid model data');
 }catch(error){
  if(saved)await cache.delete(url).catch(()=>{});
  throw error;
 }
 if(!saved&&cache)cache.put(url,new Response(bytes)).catch(()=>{});
 onProgress?.(new ProgressEvent('progress',{lengthComputable:true,loaded:bytes.byteLength,total:bytes.byteLength}));
 return decoded;
}

let occlusionPack;
function loadOcclusion(){
 if(!occlusionPack)occlusionPack=fetch(new URL('./assets/models/character-occlusion108.bin',import.meta.url)).then(async response=>{
  if(!response.ok)throw Error('Character shading '+response.status);
  const bytes=await response.arrayBuffer(),offset=new DataView(bytes).getUint32(0,true);
  return {parts:JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,4,offset-4))),values:new Uint8Array(bytes,offset)};
 }).catch(error=>{occlusionPack=null;console.warn('Using unbaked character lighting',error);return null;});
 return occlusionPack;
}
export function applyCharacterOcclusion(model,parts,values){
 if(!parts)return;
 model.scene.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const id=model.parser.associations.get(mesh),range=parts[id?.meshes+'/'+id?.primitives];
  if(!range)return;
  const [start,count]=range;
  if(count!==mesh.geometry.attributes.position.count||start+count>values.length)return;
  mesh.geometry.setAttribute('campusOcclusion',new BufferAttribute(values.subarray(start,start+count),1,true));
 });
}

let shapePack;
function loadClassShapes(){
 if(!shapePack){
  shapePack=fetch(new URL('./assets/models/class-shapes103.bin?v=campus-111',import.meta.url)).then(async response=>{
   if(!response.ok)throw Error('Classroom geometry '+response.status);
   const bytes=await response.arrayBuffer(),offset=new DataView(bytes).getUint32(0,true);
   const table=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,4,offset-4)));
   return {table,indices:new Uint16Array(bytes,offset)};
  }).catch(error=>{shapePack=null;console.warn('Using source geometry',error);return null;});
 }
 return shapePack;
}
export function applyClassShape(model,parts,indices){
 if(!parts)return model;
 model.scene.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const id=model.parser.associations.get(mesh),g=mesh.geometry;
  const part=parts[id?.meshes+'/'+id?.primitives];
  if(!part)return;
  const [start,count,original,vertices]=part;
  if(g.index.count!==original||g.attributes.position.count!==vertices)return;
  g.setIndex(new BufferAttribute(indices.subarray(start,start+count),1));
 });
 return model;
}

// Original authoring files are also the fallback on older browsers and when
// delivery data fails. Caller-supplied loaders still receive the original URLs.
export class CampusModelLoader extends GLTFLoader{
 async loadAsync(url,onProgress){
  const asset=new URL(url,import.meta.url),file=asset.pathname.split('/').pop().replace(/\.glb$/,'');
  const packed=typeof window!=='undefined'&&asset.origin===manifestUrl.origin?loadClassShapes():null;
  const baked=packed&&/^(student-|teacher-|hand-)/.test(file)?loadOcclusion():null;
  const [model,shapes,shade]=await Promise.all([this.loadSource(url,onProgress),packed,baked]);
  if(shade)applyCharacterOcclusion(model,shade.parts[file],shade.values);
  return shapes?applyClassShape(model,shapes.table[file],shapes.indices):model;
 }
 async loadSource(url,onProgress){
  if(typeof DecompressionStream==='function'&&typeof window!=='undefined'){
   const original=new URL(url,import.meta.url),name=original.pathname.split('/').pop();
   if(original.origin===manifestUrl.origin&&name.endsWith('.glb')){
    try{
     const files=await catalog(),file=files[name.slice(0,-4)];
     if(file){
      const location=new URL(file,manifestUrl),data=await modelBytes(location.href,onProgress);
      return await this.parseAsync(data,new URL('.',location).href);
     }
    }catch(error){console.warn('Using original model',name,error);}
   }
  }
  const source=new URL(url,import.meta.url),file=source.pathname.split('/').pop();
  if(typeof window!=='undefined'&&source.origin===manifestUrl.origin&&
     /^(student-(boy-v4|girl-v4|glasses-v2|ponytail-v1)|teacher-v2)\.glb$/.test(file)){
   const atlas=new URL('./assets/materials/'+file.slice(0,-4)+'-cloth107.webp',import.meta.url);
   // A separate parser keeps simultaneous raw GLB loads and hand models isolated.
   const loader=new GLTFLoader(this.manager);
   loader.register(parser=>({name:'CampusUniformAtlas',beforeRoot(){
    const material=parser.json.materials[0].pbrMetallicRoughness;
    const image=parser.json.images[parser.json.textures[material.baseColorTexture.index].source];
    delete image.bufferView;image.uri=atlas.href;image.mimeType='image/webp';
   }}));
   try{return await loader.loadAsync(url,onProgress);}
   catch(error){console.warn('Using embedded character atlas',file,error);}
  }
  return super.loadAsync(url,onProgress);
 }
}
