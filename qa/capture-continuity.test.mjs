import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent} from '../dist/student-assets.js';
import {strugglePose} from '../dist/capture-poses.js';
import {loadGeometry} from './gltf-geometry.mjs';

const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
const cases=[['boy','student-boy-v2.glb'],['girl','student-girl-v2.glb'],['glasses','student-glasses-v1.glb']];
function fingerSamples(actor){
 const samples=[];
 actor.group.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const {skinIndex,skinWeight}=mesh.geometry.attributes;
  for(const side of ['Left','Right'])for(const digit of ['Index','Middle','Pinky','Thumb']){
   const joint=mesh.skeleton.bones.indexOf(actor.bones[side+'Hand'+digit+'3']);
   if(joint<0)continue;
   const indices=[];
   for(let i=0;i<skinIndex.count;i++){
    let weight=0;for(let k=0;k<4;k++)if(skinIndex.getComponent(i,k)===joint)weight+=skinWeight.getComponent(i,k);
    if(weight>.55)indices.push(i);
   }
   const stride=Math.max(1,Math.ceil(indices.length/6));
   for(let i=0;i<indices.length;i+=stride)samples.push({mesh,index:indices[i]});
  }
 });
 return samples;
}
function skinPoints(actor,samples){
 actor.group.updateMatrixWorld(true);
 actor.group.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
 return samples.map(({mesh,index})=>{
  const p=V().fromBufferAttribute(mesh.geometry.attributes.position,index);
  mesh.applyBoneTransform(index,p);return actor.group.worldToLocal(mesh.localToWorld(p));
 });
}

// Turning a carried student through a doorway must transport the palms with
// the body. Their old world directions must not remain behind while the
// teacher turns. Compare actual skinned digits against the same motion under
// a stationary parent, including a mid-capture change of parent orientation.
for(const [name,file]of cases)test(`${name}: turning the carrier does not twist wrists or pull four fingers off their grip`,async()=>{
 const stationary=createRiggedStudent(await loadGeometry(file),{variant:name==='girl'?'girl':'boy',seated:false});
 const turning=createRiggedStudent(await loadGeometry(file),{variant:name==='girl'?'girl':'boy',seated:false});
 const carrier=new T.Group();carrier.add(turning.group);
 const sampleA=fingerSamples(stationary),sampleB=fingerSamples(turning);
 assert.equal(sampleA.length,sampleB.length);assert.ok(sampleA.length>=32);
 let time=0,maxPalmError=0,maxSkinError=0;
 for(const state of ['carried','bound','free']){
  for(const actor of [stationary,turning]){actor.setMood('resting');actor.setMotion({restraint:state,seated:false});}
  for(let frame=0;frame<120;frame++){
   time+=1/60;
   carrier.rotation.set(Math.sin(time*1.7)*.06,time*1.8,0);
   carrier.position.set(Math.sin(time)*2,.2,Math.cos(time)*2);carrier.updateMatrixWorld(true);
   stationary.update(time);turning.update(time);
   const inverseA=stationary.group.getWorldQuaternion(Q()).invert(),inverseB=turning.group.getWorldQuaternion(Q()).invert();
   for(const side of ['Left','Right']){
    const a=inverseA.clone().multiply(stationary.bones[side+'Hand'].getWorldQuaternion(Q()));
    const b=inverseB.clone().multiply(turning.bones[side+'Hand'].getWorldQuaternion(Q()));
    maxPalmError=Math.max(maxPalmError,a.angleTo(b));
   }
   if(frame%4===0){const a=skinPoints(stationary,sampleA),b=skinPoints(turning,sampleB);for(let i=0;i<a.length;i++)maxSkinError=Math.max(maxSkinError,a[i].distanceTo(b[i]));}
  }
 }
 stationary.dispose();turning.dispose();
 assert.ok(maxPalmError<.015,`carrier rotation twists the local palm by ${(maxPalmError*180/Math.PI).toFixed(2)} degrees`);
 assert.ok(maxSkinError<.004,`carrier rotation pulls the visible fingertips by ${maxSkinError.toFixed(4)} m`);
});

test('carried wrist keeps travelling between pull and release instead of stopping at sampled poses',()=>{
 const epsilon=.0001,speed=t=>(strugglePose(t+epsilon).left[1]-strugglePose(t-epsilon).left[1])/(2*epsilon);
 // The reference changes continuously from a high left wrist to a low one.
 // A reconstruction must not introduce three extra full stops mid-stroke.
 for(let t=.20;t<.90;t+=.002)assert.ok(speed(t)<-.055,`left wrist stalls during its downward stroke at ${t.toFixed(3)} s (${speed(t)})`);
 // Loop joins also preserve velocity rather than creating a separate reset.
 for(const key of ['roll','pitch']){
  const before=(strugglePose(2-epsilon)[key]-strugglePose(2-2*epsilon)[key])/epsilon;
  const after=(strugglePose(2*epsilon)[key]-strugglePose(epsilon)[key])/epsilon;
  assert.ok(Math.abs(before-after)<.02,`${key} jumps in velocity at the loop seam`);
 }
});
