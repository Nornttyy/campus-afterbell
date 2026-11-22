import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';

const manifestUrl=new URL('./assets/stream93/models.json?v=campus-93',import.meta.url);
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

// Original authoring files are also the fallback on older browsers and when
// delivery data fails. Caller-supplied loaders still receive the original URLs.
export class CampusModelLoader extends GLTFLoader{
 async loadAsync(url,onProgress){
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
  return super.loadAsync(url,onProgress);
 }
}
