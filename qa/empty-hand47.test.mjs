import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createDeskHands} from '../dist/game-actors.js?v=campus-64';
import {createRiggedPalm} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';
const [left,right]=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
for(const seated of [true,false])test(`one-handed use leaves the empty palm relaxed throughout pickup and return (${seated?'seated':'standing'})`,()=>{
 for(const action of ['snack','drink','burger','smoke','flash','ink']){
  const hands=createDeskHands({createHand:(side,scale)=>createRiggedPalm(side<0?left:right,side,scale)}),hand=hands.getHand('right').group;
  // Allow the sit-to-stand transition to finish before measuring pickup.
  for(let frame=0;frame<120;frame++)hands.update(frame/60,{action,seated});
  let before=null,maxMotion=0,maxTurn=0;
  for(let frame=0;frame<300;frame++){
   const carrying=frame>=60&&frame<200;
   hands.update((frame+120)/60,{action,seated,carrying,holding:carrying&&frame>120,progress:carrying?(frame-60)/140:0,viewPitch:.08});
   hands.group.updateMatrixWorld(true);
   const position=hand.getWorldPosition(new T.Vector3()),rotation=hand.getWorldQuaternion(new T.Quaternion());
   if(before){maxMotion=Math.max(maxMotion,position.distanceTo(before.position));maxTurn=Math.max(maxTurn,rotation.angleTo(before.rotation));}
   before={position,rotation};
  }
  assert.ok(maxMotion<1e-6,`${action}: empty palm follows the other hand into the drawer (${maxMotion} m)`);
  assert.ok(maxTurn<1e-6,`${action}: empty wrist rotates with the working hand (${maxTurn} rad)`);
 }
});
