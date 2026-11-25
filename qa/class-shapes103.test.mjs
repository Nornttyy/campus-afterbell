import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {applyClassShape} from '../dist/model-delivery93.js';
import {loadGeometry} from './gltf-geometry.mjs';

const raw=await readFile(new URL('../dist/assets/models/class-shapes103.bin',import.meta.url));
const boundaries=raw.readUInt32LE(0),table=JSON.parse(raw.toString('utf8',4,boundaries));
const indices=new Uint16Array(raw.buffer,raw.byteOffset+boundaries,(raw.length-boundaries)/2);
for(const [name,parts] of Object.entries(table))test(name+' uses the lighter geometry with the original rig and UVs',async()=>{
 const model=await loadGeometry(name+'.glb'),before=new Map();
 model.scene.traverse(mesh=>{if(mesh.isMesh)before.set(mesh,{count:mesh.geometry.index.count,attributes:mesh.geometry.attributes,skeleton:mesh.skeleton});});
 applyClassShape(model,parts,indices);
 let removed=0;
 for(const [mesh,old] of before){
  const g=mesh.geometry;
  assert.equal(g.attributes,old.attributes);assert.equal(mesh.skeleton,old.skeleton);
  assert.equal(g.index.count%3,0);assert.ok(g.index.array.every(i=>i<g.attributes.position.count));
  removed+=old.count-g.index.count;
 }
 assert.ok(removed>0,'a verified GLB must render fewer triangles');
});

test('daylight shading is baked for all five bodies and both pairs of first-person hands',async()=>{
 const {applyCharacterOcclusion}=await import('../dist/model-delivery93.js');
 const raw=await readFile(new URL('../dist/assets/models/character-occlusion108.bin',import.meta.url));
 const offset=raw.readUInt32LE(0),parts=JSON.parse(raw.toString('utf8',4,offset)),bytes=raw.subarray(offset);
 const names=['student-boy-v4','student-girl-v4','student-glasses-v2','student-ponytail-v1','teacher-v2','hand-left-v3','hand-right-v3','teacher-hand-left-v1','teacher-hand-right-v1'];
 for(const name of names){
  const model=await loadGeometry(name+'.glb');applyCharacterOcclusion(model,parts[name],bytes);
  let shaded=false;
  model.scene.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const ao=mesh.geometry.attributes.campusOcclusion;
   assert.equal(ao.count,mesh.geometry.attributes.position.count);assert.ok(ao.normalized);
   shaded||=ao.array.some(x=>x>80)&&ao.array.some(x=>x<12);
  });
  assert.ok(shaded,name);
 }
});
