import assert from 'node:assert/strict';
import test from 'node:test';
import {loadGeometry} from './gltf-geometry.mjs';
import {createRiggedPalm} from '../dist/student-assets.js';
import {Box3,Vector3} from '../dist/vendor/three.module.js';

for(const side of [-1,1])test('student forearm tapers without changing palm or finger positions, side '+side,async()=>{
 const source=await loadGeometry('hand-'+(side<0?'left':'right')+'-v3.glb');
 const hand=createRiggedPalm(source,side);
 const meshes=root=>{const list=[];root.traverse(o=>{if(o.isSkinnedMesh)list.push(o);});return list;};
 const before=meshes(source.scene),after=meshes(hand.group),oldEnd=new Box3(),end=new Box3();
 let handVertices=0;
 before.forEach((mesh,k)=>{
  const p=mesh.geometry.attributes.position,q=after[k].geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const a=new Vector3().fromBufferAttribute(p,i),b=new Vector3().fromBufferAttribute(q,i);
   assert.equal(a.y,b.y);
   if(a.y>=-.041){assert.ok(a.equals(b));handVertices++;}
   if(a.y<-.099){oldEnd.expandByPoint(a);end.expandByPoint(b);}
  }
 });
 assert.ok(handVertices>1500);const size=oldEnd.getSize(new Vector3()),reduced=end.getSize(new Vector3());
 for(const axis of ['x','z'])assert.ok(Math.abs(reduced[axis]/size[axis]-.66)<.002,'forearm thickness along '+axis);
});
