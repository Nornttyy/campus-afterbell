import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadGeometry} from './gltf-geometry.mjs';
import {modelTriangles,requireModelBudget,MODEL_TRIANGLE_LIMIT} from '../dist/model-budget64.js';
const manifest=JSON.parse(await readFile(new URL('../docs/runtime-model-budget64.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex');
function parse(bytes){const length=bytes.readUInt32LE(12);return {json:JSON.parse(bytes.subarray(20,20+length)),binary:bytes.subarray(28+length)};}
function immutableData({json,binary}){
 const accessor=id=>{const a=json.accessors[id],v=json.bufferViews[a.bufferView];return hash(binary.subarray((v.byteOffset||0)+(a.byteOffset||0),(v.byteOffset||0)+v.byteLength));};
 return {nodes:json.nodes,skins:json.skins,materials:json.materials,textures:json.textures,
 images:(json.images||[]).map(i=>{const v=json.bufferViews[i.bufferView];return hash(binary.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));}),
 animations:(json.animations||[]).map(a=>({...a,samplers:a.samplers.map(s=>({...s,input:accessor(s.input),output:accessor(s.output)}))})),
 bindMatrices:(json.skins||[]).map(s=>accessor(s.inverseBindMatrices))};
}
for(const asset of manifest.assets)test(`${asset.file}: shipping triangles and rig/texture preservation`,async()=>{
 const current=await readFile(new URL('../dist/assets/models/'+asset.file,import.meta.url));assert.equal(hash(current),asset.outputSha256);
 const parsed=parse(current),triangles=parsed.json.meshes.reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+parsed.json.accessors[p.indices].count/3,0),0);
 assert.equal(triangles,asset.afterTriangles);assert.ok(triangles<=MODEL_TRIANGLE_LIMIT);
 const loaded=await loadGeometry(asset.file);assert.equal(modelTriangles(loaded),triangles);requireModelBudget(loaded,asset.file);
 // Originals are local working evidence, not required to build the public site.
 try{const original=parse(await readFile(new URL('../art-source/mesh-budget64/originals/'+asset.file,import.meta.url)));assert.deepEqual(immutableData(parsed),immutableData(original));}catch(e){if(e.code!=='ENOENT')throw e;}
});
test('loader gate rejects over-budget assets and counts instances only once',()=>{
 const geometry={index:{count:24003}},mesh={isMesh:true,geometry},source={traverse(fn){fn(mesh);fn(mesh);}};
 assert.equal(modelTriangles(source),8001);assert.throws(()=>requireModelBudget(source));geometry.index.count=24000;assert.equal(requireModelBudget(source),source);
});

// Import no prop files here: this exercises every procedural replacement used
// when an optional GLB request fails, as well as the permanently procedural items.
const {createDeskItem,DESK_ITEM_KINDS}=await import('../dist/game-actors.js');
const T=await import('../dist/vendor/three.module.js');
const procedural=new Map(manifest.proceduralItems.map(asset=>[asset.kind,asset]));
test('every desk item, including optional-asset fallbacks, is covered by the budget manifest',()=>{
 assert.deepEqual([...procedural.keys()].sort(),[...DESK_ITEM_KINDS].sort());
});
for(const kind of DESK_ITEM_KINDS)test(`${kind}: procedural fallback stays below 8000 without resizing the item`,()=>{
 const asset=procedural.get(kind),model=createDeskItem(kind),size=new T.Box3().setFromObject(model,true).getSize(new T.Vector3()).toArray();
 assert.equal(modelTriangles(model),asset.afterTriangles);requireModelBudget(model,kind);
 size.forEach((n,i)=>assert.ok(Math.abs(n-asset.boundsBefore[i])<.00001,`${kind}: source dimensions changed on axis ${i}`));
 model.traverse(node=>{if(node.isMesh){assert.ok(node.geometry.attributes.normal);for(const material of Array.isArray(node.material)?node.material:[node.material])assert.ok(material?.isMaterial);}});
});
test('an over-budget optional GLB is rejected and its usable procedural fallback still respects the budget',async()=>{
 const {loadPropAssets}=await import('../dist/prop-assets.js?v=campus-75');
 const scene=new T.Group(),geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(24003*3),3));scene.add(new T.Mesh(geometry,new T.MeshStandardMaterial()));
 const result=await loadPropAssets({burger:'./invalid-oversized-test.glb'},{loader:{loadAsync:async()=>({scene,animations:[]})}});
 assert.deepEqual(result.loaded,[]);assert.equal(result.failed.length,1);assert.match(result.failed[0].error.message,/8001/);
 const fallback=createDeskItem('burger');assert.equal(fallback.userData.propAsset,undefined);assert.equal(modelTriangles(fallback),procedural.get('burger').afterTriangles);
});
