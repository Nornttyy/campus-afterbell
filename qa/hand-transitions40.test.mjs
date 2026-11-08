import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createDeskHands} from '../dist/game-actors.js';
import {createRiggedPalm} from '../dist/student-assets.js';
import {createRiggedTeacher} from '../dist/imported-actors.js';
import {loadGeometry} from './gltf-geometry.mjs';

const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
const [left,right]=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
const makeHands=()=>createDeskHands({createHand:(side,scale)=>createRiggedPalm(side<0?left:right,side,scale)});
function updateSkin(group){group.updateMatrixWorld(true);group.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}

for(const seated of [true,false])test(`paper completion withdraws continuously and does not restore consumed paper (${seated?'seated':'standing'})`,()=>{
 const actor=makeHands(),hand=actor.getHand('right').group,note=actor.group.getObjectByName('folded-note');let time=0;
 for(let i=0;i<240;i++)actor.update(time+=1/60,{action:'note',carrying:true,holding:true,progress:Math.min(.99,i/240),seated,freeLook:true});
 updateSkin(actor.group);let previous=hand.getWorldPosition(V()),maxStep=0;assert.equal(note.visible,true);
 // ClassroomRound clears progress and drawnSlot in the same completion tick.
 for(let i=0;i<55;i++){
  actor.update(time+=1/60,{action:'note',carrying:false,holding:false,progress:0,seated,freeLook:true});updateSkin(actor.group);
  const point=hand.getWorldPosition(V());maxStep=Math.max(maxStep,point.distanceTo(previous));previous=point;
  assert.equal(note.visible,false,'consumed paper reappeared during withdrawal');
 }
 assert.ok(maxStep<.075,`paper completion jumped the wrist ${maxStep} m`);
 for(let i=0;i<90;i++)actor.update(time+=1/60,{action:'note',carrying:true,holding:false,progress:0,seated,freeLook:true});
 assert.equal(note.visible,true,'the completion flag leaked into the next paper');
});

test('returning unfinished paper still shows it during the hand withdrawal',()=>{
 const actor=makeHands(),note=actor.group.getObjectByName('folded-note');let time=0;
 for(let i=0;i<120;i++)actor.update(time+=1/60,{action:'note',carrying:true,holding:true,progress:.8,freeLook:true});
 actor.update(time+=1/60,{action:'note',carrying:false,holding:false,progress:.8,freeLook:true});
 assert.equal(note.visible,true,'putting back an unfinished item was mistaken for consumption');
});

for(const side of [-1,1])test(`${side<0?'left':'right'} v3 palm flexes both distal thumb joints and the actual weighted skin`,()=>{
 const hand=createRiggedPalm(side<0?left:right,side),prefix=side<0?'Left':'Right',bones={};
 hand.group.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
 hand.setCurl(0);updateSkin(hand.group);
 const rests=new Map([2,3].map(n=>[bones[prefix+'HandThumb'+n],bones[prefix+'HandThumb'+n].quaternion.clone()]));
 const lengths=new Map([...rests.keys()].map(b=>[b,b.position.length()])),samples=[];
 hand.group.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;const indices=new Set([...rests.keys()].map(b=>mesh.skeleton.bones.indexOf(b)));
  const {skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let i=0;i<skinIndex.count;i++){
   let weight=0;for(let k=0;k<4;k++)if(indices.has(skinIndex.getComponent(i,k)))weight+=skinWeight.getComponent(i,k);
   if(weight>.5)samples.push({mesh,index:i,before:mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld)});
  }
 });
 assert.ok(samples.length>10,'distal thumb bones do not influence enough visible skin');
 hand.setCurl(.8);updateSkin(hand.group);
 for(const [bone,rest]of rests){const angle=bone.quaternion.clone().normalize().angleTo(rest.clone().normalize());assert.ok(angle>.12&&angle<.4,'thumb remained rigid or overbent');assert.ok(Math.abs(bone.position.length()-lengths.get(bone))<1e-8,'thumb flexion stretched a joint');}
 const displacement=Math.max(...samples.map(({mesh,index,before})=>mesh.getVertexPosition(index,V()).applyMatrix4(mesh.matrixWorld).distanceTo(before)));
 assert.ok(displacement>.004&&displacement<.07,`visible thumb deformation ${displacement} m`);
 hand.setCurl(0);updateSkin(hand.group);
 for(const {mesh,index,before}of samples)assert.ok(mesh.getVertexPosition(index,V()).applyMatrix4(mesh.matrixWorld).distanceTo(before)<1e-6,'releasing did not restore source thumb shape');
});

test('teacher neck contact blends in, reaches its target, and blends out instead of teleporting the wrist',async()=>{
 const [source,reference]=await Promise.all([loadGeometry('teacher-v2.glb'),loadGeometry('teacher-v2.glb')]);
 const actor=createRiggedTeacher(source),idle=createRiggedTeacher(reference),target=new T.Vector3(-.18,1.4,.42),goal=target.clone().addScaledVector(new T.Vector3(0,.72,.69).normalize(),-.075);let time=0;
 const lengths=new Map(['RightArm','RightForeArm','RightHand'].map(n=>[n,actor.bones[n].position.length()]));
 for(let i=0;i<90;i++){time+=1/60;actor.update(time,{speed:0,phase:'watching'});idle.update(time,{speed:0,phase:'watching'});}
 let previous=actor.bones.RightHand.getWorldPosition(V()),rotation=actor.bones.RightHand.getWorldQuaternion(Q()),maxStep=0,maxTurn=0;
 for(const grabbing of [true,false])for(let i=0;i<120;i++){
  time+=1/60;actor.update(time,{speed:0,phase:'watching'});idle.update(time,{speed:0,phase:'watching'});if(grabbing)actor.gripNeck(target);
  const point=actor.bones.RightHand.getWorldPosition(V()),q=actor.bones.RightHand.getWorldQuaternion(Q());maxStep=Math.max(maxStep,point.distanceTo(previous));maxTurn=Math.max(maxTurn,q.angleTo(rotation));previous=point;rotation=q;
  for(const [name,length]of lengths)assert.ok(Math.abs(actor.bones[name].position.length()-length)<1e-8,'neck reach stretched the imported arm');
  assert.ok(actor.getHand('right').getWorldPosition(V()).distanceTo(point)<1e-6,'grip anchor separated from animated wrist');
  if(grabbing&&i===119)assert.ok(point.distanceTo(goal)<.008,'smoothed grasp never reaches its target');
 }
 assert.ok(maxStep<.12,`neck transition jumped wrist ${maxStep} m in one frame`);
 assert.ok(maxTurn<.5,`neck transition jumped wrist orientation ${maxTurn} radians`);
 assert.ok(actor.bones.RightHand.getWorldPosition(V()).distanceTo(idle.bones.RightHand.getWorldPosition(V()))<.002,'released arm did not settle into its current animation');
 actor.dispose();idle.dispose();
});
