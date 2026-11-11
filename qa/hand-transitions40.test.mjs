import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createDeskHands} from '../dist/game-actors.js?v=campus-67';
import {createRiggedPalm} from '../dist/student-assets.js';
import {createRiggedTeacher} from '../dist/imported-actors.js';
import {loadGeometry} from './gltf-geometry.mjs';

const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
const [left,right]=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
const makeHands=()=>createDeskHands({createHand:(side,scale)=>createRiggedPalm(side<0?left:right,side,scale)});
function updateSkin(group){group.updateMatrixWorld(true);group.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}

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
