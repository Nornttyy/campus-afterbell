import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createDeskHands} from '../dist/game-actors.js?v=campus-84';
import {createRiggedPalm} from '../dist/student-assets.js';
import {handSamplingRig} from './whole-palm-geometry54.mjs';
import {loadGeometry} from './gltf-geometry.mjs';

const [left,right]=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
const dt=1/60,V=()=>new T.Vector3();
function makeHands(){return createDeskHands({createHand:(side,scale)=>createRiggedPalm(side<0?left:right,side,scale)});}
function tick(actor,time,frames,options){for(let i=0;i<frames;i++)actor.update(time+=dt,options);actor.group.updateMatrixWorld(true);return time;}
function bones(hand){const result={};hand.group.traverse(o=>{if(o.isBone)result[o.name.replace(/^mixamorig[:_]?/,'')]=o;});return result;}
function localProp(prop,hand){return hand.matrixWorld.clone().invert().multiply(prop.matrixWorld);}
function pose(hand){return {position:hand.group.getWorldPosition(V()),quaternion:hand.group.getWorldQuaternion(new T.Quaternion())};}
function assertRigid(a,b,label){
  const ap=V(),aq=new T.Quaternion(),as=V(),bp=V(),bq=new T.Quaternion(),bs=V();
  a.decompose(ap,aq,as);b.decompose(bp,bq,bs);
  assert.ok(ap.distanceTo(bp)<.00001,`${label}: object slipped in palm`);
  assert.ok(aq.angleTo(bq)<.00001,`${label}: object rotated separately from palm`);
  assert.ok(as.distanceTo(bs)<.00001,`${label}: object changed size`);
}

test('standing keeps separate snack, phone and smoke wrist orientations',()=>{
  const orientations={};
  for(const action of ['snack','phone','smoke']){
    const actor=makeHands();tick(actor,0,150,{action,carrying:true,holding:false,seated:false});
    orientations[action]=actor.getHand('left').group.quaternion.clone();
  }
  assert.ok(orientations.snack.angleTo(orientations.phone)>.15,'Standing erased the phone grip');
  assert.ok(orientations.snack.angleTo(orientations.smoke)<.01,'Normal carry should use the same palm direction');
});

test('taking and returning an object turn the palm and flex real finger joints; idle hands settle',()=>{
  const actor=makeHands(),hand=actor.getHand('left'),rig=bones(hand);
  let time=tick(actor,0,90,{carrying:false,seated:false});
  const idle=pose(hand),open=rig.LeftHandIndex2.quaternion.clone();
  const baselineLengths=new Map(Object.values(rig).map(b=>[b,b.position.clone()]));
  time=tick(actor,time,150,{action:'phone',carrying:true,holding:false,seated:false});
  const held=pose(hand),closed=rig.LeftHandIndex2.quaternion.clone();
  assert.ok(idle.quaternion.angleTo(held.quaternion)>.5,'Taking the phone did not rotate the palm');
  assert.ok(open.angleTo(closed)>.35,'Taking the phone did not close actual finger joints');
  time=tick(actor,time,100,{action:'phone',carrying:false,holding:false,seated:false});
  assert.ok(rig.LeftHandIndex2.quaternion.angleTo(open)<.0001,'Returning the phone did not relax the fingers');
  const returned=pose(hand);
  for(let i=0;i<120;i++){
    actor.update(time+=dt,{carrying:false,seated:false});actor.group.updateMatrixWorld(true);
    const current=pose(hand);
    assert.ok(current.position.distanceTo(returned.position)<.00001,'Idle palm wanders');
    assert.ok(current.quaternion.angleTo(returned.quaternion)<.00001,'Idle wrist keeps waving');
  }
  for(const [bone,position]of baselineLengths)assert.ok(position.distanceTo(bone.position)<.000001,`${bone.name}: finger length changed`);
});

for(const seated of [true,false])test(`left thumb pad taps and leaves the lit display (${seated?'seated':'standing'})`,()=>{
 const actor=makeHands(),hand=actor.getHand('left'),sampling=handSamplingRig(hand,{samples:100000}),phone=actor.group.getObjectByName('handheld-phone');
 let time=tick(actor,0,140,{action:'phone',carrying:true,holding:true,seated});
 let nearest=Infinity,farthest=0,hits=0;
 for(let i=0;i<204;i++){
  actor.update(time+=dt,{action:'phone',carrying:true,holding:true,seated});if(i%4)continue;actor.group.updateMatrixWorld(true);
  const inv=phone.matrixWorld.clone().invert();
  const pads=sampling.points('Thumb').filter(p=>p.pad).map(p=>p.applyMatrix4(hand.group.matrixWorld).applyMatrix4(inv)).filter(p=>Math.abs(p.x)<.0485&&Math.abs(p.y)<.076&&p.z>0);
  assert.ok(pads.length);const z=Math.min(...pads.map(p=>p.z));nearest=Math.min(nearest,z);farthest=Math.max(farthest,z);if(Math.abs(z-.012)<.004)hits++;
 }
 assert.ok(hits>1&&nearest>.007&&nearest<.016,'skin must meet the glass in successive taps');
 assert.ok(farthest-nearest>.009,'thumb pad must lift back off the glass');
});

test('imported palms keep rigid object contact while taking, standing and looking around',()=>{
  for(const [action,name,side]of [['snack','snack-packet','left'],['drink','red-drink-can','left'],['burger','layered-burger','left'],['phone','handheld-phone','left'],['smoke','smoke-canister','left']]){
    const actor=makeHands(),hand=actor.getHand(side),prop=actor.group.getObjectByName(name);
    assert.ok(prop,`Missing ${name}`);let baseline=null;
    for(let frame=1;frame<230;frame++){
      actor.update(frame*dt,{action,carrying:true,holding:false,seated:frame<115,viewPitch:Math.sin(frame*.02)*.7,crouched:frame>170});actor.group.updateMatrixWorld(true);
      if(prop.visible){const current=localProp(prop,hand.group);if(baseline)assertRigid(baseline,current,action);else baseline=current;}
    }
    assert.ok(baseline,`${action}: never appeared in hand`);
  }
});

test('click throw holds a steady wrist until release, then swings forward and opens real fingers',()=>{
  const actor=makeHands(),hand=actor.getHand('left'),rig=bones(hand);
  let time=tick(actor,0,120,{action:'smoke',carrying:true,holding:true,progress:0,seated:false});
  const ready=pose(hand);
  for(let i=1;i<=90;i++)actor.update(time+=dt,{action:'smoke',carrying:true,holding:true,progress:i/90,seated:false});
  actor.group.updateMatrixWorld(true);const charged=pose(hand),closed=rig.LeftHandIndex2.quaternion.clone();
  assert.ok(charged.quaternion.angleTo(ready.quaternion)<.01,'Click throw should keep a steady grip');
  let previous=charged,maxTurn=0,maxStep=0,forwardTurn=0,openTurn=0;
  for(let i=0;i<36;i++){
    actor.update(time+=dt,{action:'smoke',carrying:false,holding:false,progress:0,seated:false,throwAge:i*dt});actor.group.updateMatrixWorld(true);
    const current=pose(hand);maxTurn=Math.max(maxTurn,current.quaternion.angleTo(previous.quaternion));maxStep=Math.max(maxStep,current.position.distanceTo(previous.position));
    if(i<18){forwardTurn=Math.max(forwardTurn,current.quaternion.angleTo(charged.quaternion));openTurn=Math.max(openTurn,rig.LeftHandIndex2.quaternion.angleTo(closed));}
    previous=current;
  }
  assert.ok(forwardTurn>.65,'Release does not visibly rotate the wrist forward');
  assert.ok(openTurn>.35,'Release does not open the bound index joints');
  assert.ok(maxTurn<.45,`Throw snaps wrist ${maxTurn} rad in one frame`);
  assert.ok(maxStep<.10,`Throw jumps palm ${maxStep} m in one frame`);
});

for(const seated of [true,false])test(`food use stays low, bobs and returns while the other hand rests (${seated?'seated':'standing'})`,()=>{
  const actor=makeHands(),food=actor.group.getObjectByName('snack-packet'),other=actor.getHand('right');
  let time=tick(actor,0,120,{action:'snack',carrying:true,holding:false,seated});
  const positions=[],empty=pose(other);
  for(let i=0;i<=180;i++){
    actor.update(time+=dt,{action:'snack',carrying:true,holding:true,progress:i/180,seated});actor.group.updateMatrixWorld(true);positions.push(food.getWorldPosition(new T.Vector3()));
    const current=pose(other);assert.ok(current.position.distanceTo(empty.position)<.00001);assert.ok(current.quaternion.angleTo(empty.quaternion)<.00001);
  }
  const range=axis=>Math.max(...positions.map(p=>p[axis]))-Math.min(...positions.map(p=>p[axis]));
  assert.ok(positions.every(p=>p.x<-.06),'Food must stay beside the player');
  assert.ok(range('y')>.045,'Food has no visible eating strokes');
  assert.ok(positions.at(-1).distanceTo(positions[0])<.002,'The complete gesture did not return to carry');
});
