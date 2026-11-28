import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {gameMeshes} from '../dist/game-models158.js';
import {inventoryPacks} from '../dist/inventory-packs160.js';

const directory=new URL('../dist/assets/stream93/',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('models.json',directory),'utf8'));
async function unpack(file){
  const raw=gunzipSync(await readFile(new URL(file,directory)));
  const end=20+raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,end));
  function view(index){
    const {byteOffset=0,byteLength}=doc.bufferViews[index];
    return raw.subarray(end+8+byteOffset,end+8+byteOffset+byteLength);
  }
  return {doc,view};
}
for(const [key,[meshFile,finishFile]] of Object.entries(inventoryPacks)){
  test(key+' retains every vertex, primitive, material, sampler and image',async()=>{
    const [original,mesh,finish]=await Promise.all([gameMeshes[key]||catalog[key],meshFile,finishFile].map(unpack));
    for(const property of ['nodes','scenes','meshes'])assert.deepEqual(mesh.doc[property],original.doc[property]);
    for(const property of ['materials','samplers','textures','extensionsUsed','extensionsRequired'])assert.deepEqual(finish.doc[property],original.doc[property]);
    for(const [part,field] of [[mesh,'accessors'],[finish,'images']]){
      assert.equal(part.doc[field].length,original.doc[field].length);
      for(const [i,entry] of part.doc[field].entries()){
        const source=original.doc[field][i];
        assert.deepEqual({...entry,bufferView:undefined},{...source,bufferView:undefined});
        if(source.bufferView!==undefined)assert.deepEqual(part.view(entry.bufferView),original.view(source.bufferView));
      }
    }
    assert.equal(mesh.doc.images,undefined);
    assert.equal(finish.doc.meshes,undefined);
  });
}
