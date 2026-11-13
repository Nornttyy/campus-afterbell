import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createStudentFaceShape} from '../dist/student-face-shape75.js';
import {STUDENT_ASSETS,createRiggedStudent} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {STUDENT_EYE_REGIONS,eyeSurfaceWeight} from '../dist/student-eyes56.js';

for(const [variant,{file}]of Object.entries(STUDENT_ASSETS)){
 test(`${variant}: local facial sculpt preserves originals, eye surfaces, rig, UVs, hands and topology`,async()=>{
  const gltf=await loadGeometry(file+'.glb'),originals=new Map();gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(m=>{if(m.isSkinnedMesh)originals.set(m,{geometry:m.geometry,bytes:m.geometry.attributes.position.array.slice(),matrix:m.matrixWorld.clone()});});
  const edit=createStudentFaceShape(gltf.scene,{variant});
  assert.ok(edit.diagnostics().changedVertices>30);assert.ok(edit.diagnostics().maxDisplacement<.04);
  for(const [mesh,s]of originals){
   assert.deepEqual(s.geometry.attributes.position.array,s.bytes,'source model was edited');
   assert.deepEqual(mesh.geometry.index.array,s.geometry.index.array,'sculpt changed topology');
   for(const [name,a]of Object.entries(s.geometry.attributes))if(!['position','normal'].includes(name))assert.deepEqual(mesh.geometry.attributes[name].array,a.array,`lost ${name}`);
   const p=s.geometry.attributes.position,q=mesh.geometry.attributes.position,v=new T.Vector3(),w=new T.Vector3();
   for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i).applyMatrix4(s.matrix);w.fromBufferAttribute(q,i).applyMatrix4(s.matrix);
    assert.ok(w.toArray().every(Number.isFinite));
    const delta=v.distanceTo(w);
    if(v.y<1.135||v.y>1.385||v.z<.045||Math.abs(v.x)>.27)assert.ok(delta<1e-9,'sculpt escaped lower face');
    if(STUDENT_EYE_REGIONS[variant]?.some(r=>eyeSurfaceWeight(v,r)>.01))assert.ok(delta<1e-7,'eye white/pupil was distorted');
    if(delta>1e-7)assert.ok(delta<.04,'unexpected facial displacement');
   }
  }
  edit.dispose();edit.dispose();for(const [mesh,s]of originals)assert.equal(mesh.geometry,s.geometry,'dispose did not restore original');
 });
 test(`${variant}: face revision cannot change the authored bone motion or palm contact`,async()=>{
  const old=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,referenceShape:false,seed:3}),next=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seed:3});
  let time=0;
  for(const pose of ['resting','writing','reading','computer','snack','crawling']){
   for(const a of [old,next]){a.setMood(pose==='crawling'?'resting':pose);a.setMotion({seated:!['resting','crawling'].includes(pose),crawling:pose==='crawling',speed:0,lookYaw:.25,lookPitch:.13});}
   for(let i=0;i<65;i++){time+=1/60;old.update(time);next.update(time);}
   for(const [name,b]of Object.entries(old.bones)){const n=next.bones[name];assert.ok(b.position.distanceTo(n.position)<1e-10,`${pose} ${name} moved`);assert.deepEqual(b.quaternion.toArray(),n.quaternion.toArray(),`${pose} ${name} rotated`);}
  }
  old.dispose();next.dispose();
 });
}
