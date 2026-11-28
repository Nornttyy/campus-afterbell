import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../dist/vendor/three.module.js';
import {createRiggedStudent, STUDENT_ASSETS} from '../dist/student-assets.js';
import {createRiggedTeacher} from '../dist/imported-actors.js';
import {firstPersonEyeHeight} from '../dist/first-person-view.js';
import {PUBLISHED_HAND_ANIMATIONS} from '../dist/published-hand-animations61.js';
import {createHandAnimationRuntime} from '../dist/hand-animation-runtime59.js';
import {loadGeometry} from './gltf-geometry.mjs';

const stateAt = (role, character, moving) => ({role, character, movement: moving ? 1 : 0, seated:false});
const runtime = bodyRelativeStanding => createHandAnimationRuntime({
  bodyRelativeStanding, fallbackDocument:PUBLISHED_HAND_ANIMATIONS, storage:null, eventTarget:null
});

for(const character of [...Object.keys(STUDENT_ASSETS), 'teacher']){
 test(character+' first-person idle and walk occupy the external wrist envelope',async()=>{
  const teacher=character==='teacher', role=teacher?'teacher':'student';
  const file=teacher?'teacher-v2':STUDENT_ASSETS[character].file;
  const model=await loadGeometry(file+'.glb');
  const actor=teacher?createRiggedTeacher(model):createRiggedStudent(model,{variant:character,seated:false});
  actor.setMood?.('resting');
  for(const moving of [false,true]){
   const state=stateAt(role,character,moving), body=runtime(true), original=runtime(false);
   const speed=moving?1.4:0, eye=firstPersonEyeHeight(state,role);
   actor.setMotion?.({seated:false,speed});
   const first=[],outside=[];
   for(let frame=0;frame<240;frame++){
    const time=frame/60;
    actor.update((moving?5:0)+time,{walking:moving?1:0,speed,phase:'patrolling'});
    const posed=body.sample(state,time),authored=original.sample(state,time);
    if(frame<60)continue;
    for(const [name,side] of [['LeftHand','left'],['RightHand','right']]){
     const {position,...fingerPose}=posed[side];
     const {position:unused,...source}=authored[side];
     assert.deepEqual(fingerPose,source);
     const wrist=actor.bones[name].getWorldPosition(new Vector3());
     outside.push([Math.abs(wrist.x),wrist.y,wrist.z]);
     first.push([Math.abs(position[0]),position[1]+eye,-position[2]]);
    }
   }
   for(const axis of [0,1,2])for(const limit of [Math.min,Math.max]){
    const difference=limit(...first.map(p=>p[axis]))-limit(...outside.map(p=>p[axis]));
    assert.ok(Math.abs(difference)<.051,character+' '+moving+' '+axis+' error '+difference);
   }
   body.dispose();original.dispose();
  }
 });
}
test('crawling keeps the authored placement',()=>{
 const body=runtime(true),original=runtime(false);
 for(let frame=0;frame<150;frame++){
  const state={role:'student',crouched:true,movement:frame<75?0:1};
  assert.deepEqual(body.sample(state,frame/60),original.sample(state,frame/60));
 }
 body.dispose();original.dispose();
});
