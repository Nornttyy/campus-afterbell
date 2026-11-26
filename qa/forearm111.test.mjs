import assert from 'node:assert/strict';
import test from 'node:test';
import {loadGeometry} from './gltf-geometry.mjs';
import {createRiggedPalm} from '../dist/student-assets.js';
import {Vector3} from '../dist/vendor/three.module.js';

for(const side of [-1,1])test('bare forearm has one closed tapered section and preserves the student finger skin, side '+side,async()=>{
 const source=await loadGeometry('hand-'+(side<0?'left':'right')+'-v3.glb');
 const hand=createRiggedPalm(source,side);
 function surfaces(root){const list=[];root.traverse(o=>{if(o.isSkinnedMesh)list.push(o.geometry);});return list;}
 const originals=surfaces(source.scene),repaired=surfaces(hand.group),rings=[];
 let fingers=0,capTips=0;
 originals.forEach((before,k)=>{
  const after=repaired[k],p=before.attributes.position,q=after.attributes.position,n=after.attributes.normal;
  for(const key of ['uv','skinIndex','skinWeight'])assert.deepEqual(after.attributes[key].array,before.attributes[key].array);
  assert.deepEqual(after.index.array,before.index.array);
  const rim=[];rings.push(rim);
  for(let i=0;i<p.count;i++){
   const a=new Vector3().fromBufferAttribute(p,i),b=new Vector3().fromBufferAttribute(q,i);
   if(a.y<-.06)assert.ok(b.y-a.y>.017,'short forearm still has its old length');
   if(a.y>=.040){assert.ok(a.equals(b));fingers++;}
   if(Math.abs(a.y+.1)<.000001){
    const u=(b.x-side*.002)/.048,v=(b.z-.002)/.037,theta=Math.atan2(v,u);
    const sector=Math.PI/4,expected=Math.cos(sector/2)/Math.cos(theta-sector*Math.round(theta/sector));
    assert.ok(Math.abs(b.y+.061)<.00001&&Math.abs(Math.hypot(u,v)-expected)<.0001,'short faceted rim');rim.push({p:b,n:new Vector3().fromBufferAttribute(n,i)});
   }
   if(a.y<=-.11499){assert.ok(Math.abs(b.y+.0645)<.00001&&Math.hypot(b.x-side*.002,b.z-.002)<.0001,'forearm cap has a hole');capTips++;}
  }
 });
 assert.ok(fingers>1500&&capTips>0);
 assert.ok(rings.length===2&&rings.every(r=>r.length>25),'both sides of the stitched end should exist');
 for(const vertex of rings[0])assert.ok(rings[1].some(other=>vertex.p.distanceTo(other.p)<.00001&&vertex.n.dot(other.n)>.9999),'cap seam split');
});

for(const side of [-1,1])test('resting fingertips extend in the desk plane, side '+side,async()=>{
 const prefix=side<0?'Left':'Right',source=await loadGeometry('hand-'+prefix.toLowerCase()+'-v3.glb');
 const hand=createRiggedPalm(source,side),bones={};
 hand.group.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
 hand.setCurl(.8);hand.layFlat();hand.group.updateMatrixWorld(true);
 function point(finger,number){return hand.group.worldToLocal(bones[prefix+'Hand'+finger+number].getWorldPosition(new Vector3()));}
 for(const finger of ['Index','Middle','Pinky','Thumb'])for(const n of [1,2]){
  const segment=point(finger,n+1).sub(point(finger,n)).normalize();
  assert.ok(Math.abs(segment.z)<(finger==='Thumb'?.25:.06),'finger points into or away from the desk');
  assert.ok(finger==='Thumb'?-side*segment.x>.63:segment.y>.98,'finger folded under palm');
 }
});

for(const side of [-1,1])test('the wrist shading and skin stay joined when the palm bends, side '+side,async()=>{
 const prefix=side<0?'Left':'Right',source=await loadGeometry('hand-'+prefix.toLowerCase()+'-v3.glb'),hand=createRiggedPalm(source,side);
 const sourceMeshes=[],meshes=[];
 source.scene.traverse(o=>{if(o.isSkinnedMesh)sourceMeshes.push(o);});
 hand.group.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 const pairs=[],seen=new Map();
 sourceMeshes.forEach((mesh,k)=>{
  const attr=mesh.geometry.attributes.position;
  for(let i=0;i<attr.count;i++){
   const p=new Vector3().fromBufferAttribute(attr,i);
   if(p.y>.04)continue;
   const key=p.toArray().map(v=>Math.round(v*1e6)).join(',');
   const vertex=[meshes[k],i];
   if(seen.has(key))pairs.push([seen.get(key),vertex]);else seen.set(key,vertex);
  }
 });
 assert.ok(pairs.length>200);
 const wrist=hand.group.getObjectByName('mixamorig'+prefix+'Hand');
 for(const bend of [0,.6,-.9]){
  wrist.rotateX(bend);hand.setCurl(.68);hand.group.updateMatrixWorld(true);
  for(const mesh of meshes)mesh.skeleton.update();
  for(const [[a,i],[b,j]] of pairs){
   assert.ok(a.getVertexPosition(i,new Vector3()).distanceTo(b.getVertexPosition(j,new Vector3()))<1e-5);
   const n1=new Vector3().fromBufferAttribute(a.geometry.attributes.normal,i),n2=new Vector3().fromBufferAttribute(b.geometry.attributes.normal,j);
   assert.ok(n1.dot(n2)>.9998,'hard shading line at stitched vertex');
  }
 }
});
