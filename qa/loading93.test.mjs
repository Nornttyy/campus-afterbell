import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const assets=new URL('../dist/assets/',import.meta.url);
function splitGlb(bytes){
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const length=bytes.readUInt32LE(12);
 return {doc:JSON.parse(bytes.toString('utf8',20,20+length)),bin:bytes.subarray(28+length)};
}
function view(asset,index){
 const {byteOffset=0,byteLength}=asset.doc.bufferViews[index];
 return asset.bin.subarray(byteOffset,byteOffset+byteLength);
}
const hash=data=>createHash('sha256').update(data).digest('hex');
test('delivery models retain every mesh, skin, animation, accessor and its complete source buffer',async()=>{
 const files=JSON.parse(await readFile(new URL('stream93/models.json',assets),'utf8'));
 assert.equal(Object.keys(files).length,29);
 let originalBytes=0,packedBytes=0;
 const shared=new Set();
 for(const [name,file] of Object.entries(files)){
  const original=await readFile(new URL('models/'+name+'.glb',assets));
  const packed=await readFile(new URL('stream93/'+file,assets));
  assert.ok(file.includes(hash(packed).slice(0,20)));
  const source=splitGlb(original),web=splitGlb(gunzipSync(packed));
  for(const key of ['asset','scenes','nodes','meshes','skins','animations'])assert.deepEqual(web.doc[key],source.doc[key],name+' '+key);
  assert.equal(web.doc.accessors.length,source.doc.accessors.length);
  for(const [i,a] of source.doc.accessors.entries()){
   const b=web.doc.accessors[i];
   assert.deepEqual({...a,bufferView:b.bufferView},b,name+' accessor '+i);
   if(a.bufferView!=null)assert.ok(view(source,a.bufferView).equals(view(web,b.bufferView)),name+' accessor bytes '+i);
  }
  for(const [i,image] of (web.doc.images||[]).entries()){
   const old=source.doc.images[i],raw=view(source,old.bufferView);
   if(i===0&&/^(student-(boy-v4|girl-v4|glasses-v2|ponytail-v1)|teacher-v2)$/.test(name)){
    assert.equal(image.uri,'../materials/'+name+'-cloth107.webp');
    assert.deepEqual(web.doc.textures[0].extensions.EXT_texture_webp,{source:0});
    const atlas=await readFile(new URL('stream93/'+image.uri,assets));
    assert.equal(atlas.toString('ascii',8,12),'WEBP');
    assert.equal(atlas.toString('ascii',12,16),'VP8 ');
    assert.equal(atlas.readUInt16LE(26)&0x3fff,4096);
    assert.equal(atlas.readUInt16LE(28)&0x3fff,4096);
    shared.add(image.uri);
   }else if(image.uri){const data=await readFile(new URL('stream93/'+image.uri,assets));assert.ok(data.equals(raw));shared.add(image.uri);}
   else if(image.mimeType===old.mimeType)assert.ok(view(web,image.bufferView).equals(raw));
   else {assert.equal(image.mimeType,'image/webp');assert.ok(web.doc.extensionsRequired.includes('EXT_texture_webp'));}
  }
  originalBytes+=original.length;packedBytes+=packed.length;
 }
 for(const name of shared)packedBytes+=(await readFile(new URL('stream93/'+name,assets))).length;
 assert.ok(packedBytes<originalBytes*.50,'compressed and shared models must stay below half of their original combined size');
});
