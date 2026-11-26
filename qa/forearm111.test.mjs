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
   assert.equal(a.y,b.y);
   if(a.y>=.025){assert.ok(a.equals(b));fingers++;}
   if(Math.abs(a.y+.1)<.000001){
    const ellipse=Math.hypot((b.x-side*.003)/.05,(b.z-.004)/.04);
    assert.ok(Math.abs(ellipse-1)<.0001,'wrist section has a bulge or dent');rim.push({p:b,n:new Vector3().fromBufferAttribute(n,i)});
   }
   if(a.y<=-.11499){assert.ok(Math.hypot(b.x-side*.003,b.z-.004)<.0001,'forearm cap has a hole');capTips++;}
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
