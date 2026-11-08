import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {createRiggedTeacher} from '../dist/imported-actors.js';
import {AI_WALK_SPEEDS} from '../dist/classroom-rules.js';
import {loadGeometry} from './gltf-geometry.mjs';

// Count actual limb reversals after mixer blending settles. Merely extending
// the clip duration does not slow cadence if speed-matching cancels it out.
function cycleSeconds(samples){
 const peaks=[];
 for(let i=1;i<samples.length-1;i++)if(samples[i].z>samples[i-1].z&&samples[i].z>=samples[i+1].z)peaks.push(samples[i].t);
 assert.ok(peaks.length>=4,'limb does not complete repeated walking cycles');
 const intervals=peaks.slice(1).map((t,i)=>t-peaks[i]).sort((a,b)=>a-b);
 return intervals[Math.floor(intervals.length/2)];
}
function sampleLimbs(actor,update,checkArms=true){
 const foot=[],hand=[],v=new T.Vector3();
 for(let i=0;i<=1080;i++){
  const t=i/120;update(t);actor.group.updateMatrixWorld(true);
  if(t<2)continue;
  foot.push({t,z:actor.bones.LeftFoot.getWorldPosition(v).z});
  hand.push({t,z:actor.bones.LeftHand.getWorldPosition(v).z});
 }
 const period=cycleSeconds(foot);
 if(checkArms)assert.ok(Math.abs(period-cycleSeconds(hand))<.025,'arms and legs drift into different rhythms');
 return 2/period;
}
for(const [variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: ordinary walking has a calmer measured arm and leg cadence`,async()=>{
 for(const carrying of [false,true]){
  const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:false,seed:0});
  actor.setMood('resting');actor.setMotion({speed:AI_WALK_SPEEDS.student,seated:false,carrying});
  // A held object intentionally steadies the hand; count foot reversals only.
  const steps=sampleLimbs(actor,t=>actor.update(t),!carrying);
  assert.ok(steps>=2.05&&steps<=2.3,`ordinary gait still takes ${steps.toFixed(2)} steps per second`);
  if(carrying)assert.ok(actor.diagnostics().weights.WalkCarry>.99,'fixture did not enter carried-object walking');
  actor.dispose();
 }
});
for(const [name,speed,limit]of [
 ['patrol',()=>AI_WALK_SPEEDS.teacherPatrol,1.8],
 ['entry',()=>AI_WALK_SPEEDS.teacherEntry,2.35],
 ['escort',()=>AI_WALK_SPEEDS.teacherEscort,2.05]
])test(`teacher ${name}: normal movement no longer uses a rapid walking rhythm`,async()=>{
 const actor=createRiggedTeacher(await loadGeometry('teacher-v2.glb'));
 const steps=sampleLimbs(actor,t=>actor.update(t,{speed:speed(),phase:'patrol'}));
 assert.ok(steps>1.5&&steps<limit,`${name} still takes ${steps.toFixed(2)} steps per second`);
 actor.dispose();
});
