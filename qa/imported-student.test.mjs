import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedPalm,createRiggedStudent} from '../dist/student-assets.js';
import {createDeskHands} from '../dist/game-actors.js';
import {loadGeometry} from './gltf-geometry.mjs';
const [student,left,right]=await Promise.all(['student-boy-v2.glb','hand-left-v1.glb','hand-right-v1.glb'].map(loadGeometry));
const factory=(side,scale)=>createRiggedPalm(side<0?left:right,side,scale);
test('first person contains only two wrist-capped skinned palms, no sleeves or body',()=>{
 const h=createDeskHands({createHand:factory});
 for(const side of ['left','right']){
  const arm=h.group.getObjectByName(`${side}-desk-arm`);assert.equal(arm.children.length,1);
  const meshes=[];arm.traverse(o=>{if(o.isMesh)meshes.push(o)});assert.ok(meshes.length<=2);assert.ok(meshes.every(m=>m.isSkinnedMesh));
  assert.equal(arm.children[0].userData.fingersPerHand,4);
 }
});
test('palms remain finite and continuous through all three actions and interruptions',()=>{
 const h=createDeskHands({createHand:factory});let time=0;
 for(const action of ['snack','phone','note','smoke']){
  let previous=null,maxStep=0;
  for(let i=0;i<180;i++){
   h.update(time+=1/60,{action,holding:i<135,seated:i<150,viewPitch:Math.sin(time)*.3});h.group.updateMatrixWorld(true);
   const hand=h.group.getObjectByName('left-desk-hand'),p=hand.getWorldPosition(new T.Vector3());if(previous)maxStep=Math.max(maxStep,p.distanceTo(previous));previous=p;
   h.group.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.isSkinnedMesh){o.skeleton.update();for(let v=0;v<o.geometry.attributes.position.count;v+=61){const p=new T.Vector3().fromBufferAttribute(o.geometry.attributes.position,v);o.applyBoneTransform(v,p);assert.ok(p.toArray().every(Number.isFinite));assert.ok(p.length()<1,'Palm skin exploded');}}});
  }
  assert.ok(maxStep<.13,`${action}: hand snapped ${maxStep}`);
 }
});
test('ten student clips deform the imported skin within the classroom bounds',()=>{
 const a=createRiggedStudent({scene:student.scene,animations:student.animations},{seated:true});
 assert.equal(a.diagnostics().clips.length,10);
 let t=0;
 for(const mood of ['writing','snack','phone','note','thinking','resting']){
  a.setMood(mood);for(let i=0;i<60;i++)a.update(t+=1/60);
  const bounds=new T.Box3().setFromObject(a.group,true);assert.ok(bounds.max.y<2&&bounds.min.y>-.08);assert.ok(bounds.getSize(new T.Vector3()).x<1.4);
 }
});
test('empty hands stay visible in camera space while looking, standing and crouching',()=>{
 const h=createDeskHands({createHand:factory}),camera=new T.PerspectiveCamera(62,16/9,.08,70);camera.add(h.group);let t=0;
 for(const seated of [true,false])for(const crouched of [false,true])for(const pitch of [-1.3,0,1.3]){
  camera.position.set(0,seated?1.43:1.65,0);camera.rotation.x=-pitch;
  for(let i=0;i<90;i++)h.update(t+=1/60,{holding:false,seated,crouched,viewPitch:pitch});
  camera.updateMatrixWorld(true);
  for(const side of ['left','right']){
   const hand=h.group.getObjectByName(`${side}-desk-hand`),p=hand.getWorldPosition(new T.Vector3()).project(camera);
   assert.ok(Math.abs(p.x)<.92&&p.y>-.95&&p.y<.95&&p.z<1,`${side} hand left view: ${p.toArray()}`);
  }
  assert.equal(h.getDebug().idleHandsVisible,true);
 }
});

test('carried objects remain framed while freely looking up and down, without changing camera aim',()=>{
 for(const action of ['snack','phone','note','smoke']){
  const h=createDeskHands({createHand:factory}),camera=new T.PerspectiveCamera(62,16/9,.08,70);camera.add(h.group);let t=0;
  for(const pitch of [-1.15,0,.88]){
   camera.rotation.x=-pitch;const rotation=camera.quaternion.clone();
   for(let i=0;i<90;i++)h.update(t+=1/60,{action,holding:false,carrying:true,freeLook:true,viewPitch:pitch});
   camera.updateMatrixWorld(true);const d=h.getDebug();
   assert.equal(d.visible,true);assert.ok(Math.abs(d.propNDC[0])<.8&&Math.abs(d.propNDC[1])<.8&&d.propNDC[2]<1,JSON.stringify(d));
   assert.deepEqual(camera.quaternion.toArray(),rotation.toArray());
  }
 }
});


for(const variant of ['boy','girl'])test(`${variant}: seated pelvis lowers, knees bend, and standing transition is continuous`,async()=>{
 const gltf=await loadGeometry(`student-${variant}-v2.glb`),a=createRiggedStudent(gltf,{variant,seated:false});
 a.setMood('resting');a.setMotion({seated:false});let t=0;
 for(let i=0;i<60;i++)a.update(t+=1/30);
 const stand=a.bones.Hips.getWorldPosition(new T.Vector3()).y;
 a.setMotion({seated:true});let previous=stand,maxStep=0;
 for(let i=0;i<60;i++){a.update(t+=1/30);const y=a.bones.Hips.getWorldPosition(new T.Vector3()).y;maxStep=Math.max(maxStep,Math.abs(y-previous));previous=y;}
 assert.ok(stand-previous>.14,'pelvis animation was lost on export');assert.ok(maxStep<.065,'sit pose snapped');
 const points=['LeftUpLeg','LeftLeg','LeftFoot'].map(n=>a.bones[n].getWorldPosition(new T.Vector3()));
 const bend=points[0].clone().sub(points[1]).angleTo(points[2].clone().sub(points[1]));
 assert.ok(bend<2.6&&bend>1,'knee remains almost straight or folds backward');
 a.setMotion({seated:false,speed:.475,carrying:true});for(let i=0;i<60;i++)a.update(t+=1/30);
 assert.ok(a.diagnostics().weights.WalkCarry>.99);
 const bounds=new T.Box3().setFromObject(a.group,true);assert.ok(bounds.min.y>-.09&&bounds.max.y<1.95,'deformed skin escaped bounds');
});

for(const variant of ['boy','girl'])test(`${variant}: restrained poses bend actual limbs without changing bone lengths or exploding skin`,async()=>{
 const gltf=await loadGeometry(`student-${variant}-v2.glb`),a=createRiggedStudent(gltf,{variant,seated:false});let t=0;
 a.setMotion({seated:false});for(let i=0;i<60;i++)a.update(t+=1/60);
 const lengths=['LeftArm','LeftForeArm','LeftHand','LeftUpLeg','LeftLeg','LeftFoot'].map(n=>a.bones[n].position.length());
 for(const kind of ['carried','bound','stunned','free']){
  a.setMotion({seated:false,restraint:kind});let previous=null,maxStep=0;
  for(let i=0;i<120;i++){
   a.update(t+=1/60);const hand=a.bones.LeftHand.getWorldPosition(new T.Vector3());if(previous)maxStep=Math.max(maxStep,hand.distanceTo(previous));previous=hand;
   a.group.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));});
  }
  assert.ok(maxStep<.11,`${kind}: wrist snaps ${maxStep}`);
  const next=['LeftArm','LeftForeArm','LeftHand','LeftUpLeg','LeftLeg','LeftFoot'].map(n=>a.bones[n].position.length());next.forEach((v,i)=>assert.ok(Math.abs(v-lengths[i])<.005));
  const bounds=new T.Box3().setFromObject(a.group,true);assert.ok(bounds.max.y<2&&bounds.min.y>-.08);assert.ok(bounds.getSize(new T.Vector3()).x<1.5);
 }
});
