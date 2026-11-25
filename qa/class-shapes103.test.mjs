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
