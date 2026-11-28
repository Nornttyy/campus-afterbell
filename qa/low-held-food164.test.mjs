import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3, Quaternion} from '../dist/vendor/three.module.js';
import {createDeskHands, FOOD_ITEM_KINDS} from '../dist/game-actors.js';
import {createRiggedPalm} from '../dist/student-assets.js';
import {createHandAnimationRuntime} from '../dist/hand-animation-runtime59.js';
import {PUBLISHED_HAND_ANIMATIONS} from '../dist/published-hand-animations61.js';
import {loadGeometry} from './gltf-geometry.mjs';

const models=await Promise.all(['left','right'].map(s=>loadGeometry('ponytail-hand-'+s+'-v2.glb')));
function hands(){return createDeskHands({createHand:(s,k)=>createRiggedPalm(models[s<0?0:1],s,k)});}
function runtime(){return createHandAnimationRuntime({fallbackDocument:PUBLISHED_HAND_ANIMATIONS,
  bodyRelativeStanding:true,storage:null,eventTarget:null});}
const position=o=>o.getWorldPosition(new Vector3());
for(const [action,propName] of Object.entries({chips:'potato-chip-bag',noodles:'crunchy-noodle-bag',
  snack:'snack-packet',gum:'bubblegum-wrapper',phone:'handheld-phone',smoke:'smoke-canister'})){
 test(action+' follows the same uninterrupted walk as the empty hands',()=>{
  const empty=hands(),held=hands(),emptyRun=runtime(),heldRun=runtime();
  const foodItem=FOOD_ITEM_KINDS.includes(action);
  for(let frame=0;frame<180;frame++){
   const t=frame/60,eating=foodItem&&frame>=70&&frame<155;
   const state={role:'student',character:'ponytail',seated:false,movement:1,freeLook:true,action};
   const withItem={...state,foodItem,carrying:frame>=25,holding:eating,eating,progress:eating?(frame-70)/120:0};
   const sampled=heldRun.sample(withItem,t),baseline=emptyRun.sample(state,t);
   held.update(t,{...withItem,animationPose:sampled});
   empty.update(t,{...state,animationPose:baseline});
   if(frame<25)continue;
   assert.deepEqual(sampled,baseline,'taking or using food reset the walk cycle');
   const right=held.getHand('right').group,reference=empty.getHand('right').group;
   assert.ok(position(right).distanceTo(position(reference))<1e-6);
   assert.ok(right.getWorldQuaternion(new Quaternion()).angleTo(reference.getWorldQuaternion(new Quaternion()))<1e-6);
   const left=held.getHand('left').group;
   if(frame<70)assert.ok(position(left).distanceTo(position(empty.getHand('left').group))<1e-6);
   if(foodItem&&frame>=115&&frame<=145){
    const prop=held.group.getObjectByName(propName),p=position(prop);
    assert.ok(p.y<-.69&&p.x<-.05,'food too high or centred');
    const facing=new Vector3(0,0,1).applyQuaternion(prop.getWorldQuaternion(new Quaternion()));
    assert.ok(facing.dot(p.normalize().negate())>.88,'printed back facing player');
   }
  }
  emptyRun.dispose();heldRun.dispose();
 });
}

test('seated items share the original packet wrist, including during a bite',async()=>{
 const {createWholePalmGrip}=await import('../dist/whole-palm-grip.js');
 const palm=createRiggedPalm(models[0],-1,1.38);
 const reference=createWholePalmGrip(palm,-1).palmUp;
 for(const action of ['chips','snack','noodles','gum','drink','burger','banana','lunch','smoke','ink','flash','phone']){
  const actor=hands();
  for(const eating of [false,true]){
   if(eating&&!FOOD_ITEM_KINDS.includes(action))continue;
   for(let frame=0;frame<60;frame++){
    actor.update((eating?1:0)+frame/60,{seated:true,freeLook:true,action,carrying:true,holding:eating,eating,progress:eating?.5:0});
   }
   const wrist=actor.getHand('left').group;
   assert.ok(wrist.getWorldQuaternion(new Quaternion()).angleTo(reference)<1e-6,action+' switched to another grip');
   assert.ok(position(wrist).y<-.70,action+' hand raised above the open drawer');
  }
 }
});
