import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createDeskHands} from '../dist/game-actors.js';
import {createRiggedPalm} from '../dist/student-assets.js';
import {createHandAnimationRuntime} from '../dist/hand-animation-runtime59.js';
import {PUBLISHED_HAND_ANIMATIONS} from '../dist/published-hand-animations61.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {handSamplingRig} from './whole-palm-geometry54.mjs';

const models=await Promise.all(['left','right'].map(side=>loadGeometry('ponytail-hand-'+side+'-v2.glb')));
const hands=()=>createDeskHands({createHand:(side,scale)=>createRiggedPalm(models[Number(side>0)],side,scale)});
test('leaving the desk with a pen keeps the authored stride and a horizontal right-hand roll',()=>{
 const view=hands(),pen=view.group.getObjectByName('red-school-pen');
 const runtime=createHandAnimationRuntime({fallbackDocument:PUBLISHED_HAND_ANIMATIONS,bodyRelativeStanding:true});
 let previous,turn=0;
 for(let frame=0;frame<180;frame++){
  const time=frame/60,seated=frame<30,movement=frame>60?.9:0;
  const state={role:'student',action:'pen',carrying:true,seated,movement,penTwirling:true,walkPhase:time*8,freeLook:true};
  const animationPose=runtime.sample(state,time);
  view.update(time,{...state,animationPose});view.group.updateMatrixWorld(true);
  if(frame<62)continue;
  assert.equal(animationPose.clipId,'student-walk');
  const right=view.getHand('right').group;
  assert.ok(right.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(...animationPose.right.position))<.015,'wrist must track the authored stride within the finger-roll excursion');
  const where=pen.getWorldPosition(new T.Vector3());
  assert.ok(where.x>0&&where.distanceTo(right.getWorldPosition(new T.Vector3()))<.18);
  const axis=new T.Vector3(0,1,0).transformDirection(pen.matrixWorld);
  assert.ok(Math.abs(axis.y)<.001);
  if(previous)turn+=axis.angleTo(previous);
  previous=axis;
 }
 assert.ok(turn>Math.PI*2);
 view.update(3,{action:'pen',carrying:false,seated:false});
 assert.equal(view.getItemState().visible,false);
});
for(const seated of [true,false])test('live student thumb touches the phone glass and lifts, seated='+seated,()=>{
 const view=hands(),left=view.getHand('left'),skin=handSamplingRig(left,{samples:900});
 const screen=view.group.getObjectByName('phone-active-display'),inverse=new T.Matrix4();
 let touch=Infinity,lift=0;
 for(let frame=0;frame<240;frame++){
  view.update(frame/60,{action:'phone',carrying:true,holding:true,seated,freeLook:true});
  if(frame<60||frame%4)continue;
  assert.equal(view.group.getObjectByName('right-desk-arm').visible,false);
  view.group.updateMatrixWorld(true);
  inverse.copy(screen.matrixWorld).invert().multiply(left.group.matrixWorld);
  for(const finger of ['Index','Middle','Pinky']){
   const overDisplay=skin.points(finger).filter(p=>p.pad).map(p=>p.applyMatrix4(inverse))
    .filter(p=>Math.abs(p.x)<.043&&Math.abs(p.y)<.0685);
   assert.ok(overDisplay.every(p=>p.z<0),finger+' must stay behind the display');
  }
  const points=skin.points('Thumb').filter(p=>p.pad).map(p=>p.applyMatrix4(inverse))
   .filter(p=>Math.abs(p.x)<.043&&Math.abs(p.y)<.0685);
  const nearest=Math.min(...points.map(p=>p.z));
  if(Number.isFinite(nearest)){touch=Math.min(touch,Math.abs(nearest));lift=Math.max(lift,nearest);}
 }
 assert.ok(touch<.004&&lift>.006,'glass contact and lift (m) '+[touch,lift]);
 view.update(4,{action:'phone',carrying:true,holding:false,seated});
 assert.equal(view.group.getObjectByName('right-desk-arm').visible,true);
});
