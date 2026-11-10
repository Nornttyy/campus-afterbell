import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {createRiggedTeacher} from '../dist/imported-actors.js';
import {AI_WALK_SPEEDS} from '../dist/classroom-rules.js';
import {normalWalkCycleRate,NORMAL_WALK_SPEEDS} from '../dist/movement55.js';
import {loadGeometry} from './gltf-geometry.mjs';

// Count actual limb reversals after mixer blending settles. Merely extending
// the clip duration does not slow cadence if speed-matching cancels it out.
test('authored-to-game cadence transition is continuous and slow movement retains its stride contract',()=>{
 for(const role of ['student','teacher'])for(const authored of [.78,.81]){
  assert.equal(normalWalkCycleRate(role,0,authored),0);
  for(const fraction of [.1,.5,.9,1])assert.ok(Math.abs(normalWalkCycleRate(role,authored*fraction,authored)-fraction)<1e-10);
  let prior=normalWalkCycleRate(role,0,authored);
  for(let speed=.0001;speed<NORMAL_WALK_SPEEDS[role]*1.5;speed+=.0001){
   const next=normalWalkCycleRate(role,speed,authored);
   assert.ok(Number.isFinite(next)&&next>=0&&next<=1,'cadence exceeds the authored source gait');
   assert.ok(Math.abs(next-prior)<.001,'cadence jumps at the transition from authored to game movement');prior=next;
  }
 }
});
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
for(const [variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: normal 1.8 m/s walking retains the calmer measured arm and leg cadence`,async t=>{
 assert.equal(AI_WALK_SPEEDS.student,1.8);
 for(const carrying of [false,true]){
  const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:false,seed:0});
  actor.setMood('resting');actor.setMotion({speed:AI_WALK_SPEEDS.student,seated:false,carrying});
  // A held object intentionally steadies the hand; count foot reversals only.
  const steps=sampleLimbs(actor,t=>actor.update(t),!carrying);
  assert.ok(steps>=1.90&&steps<=2.12,`ordinary gait still takes ${steps.toFixed(2)} steps per second`);
  t.diagnostic(`${variant} ${carrying?'carrying':'free'}: ${steps.toFixed(3)} steps/s at ${AI_WALK_SPEEDS.student} m/s`);
  if(carrying)assert.ok(actor.diagnostics().weights.WalkCarry>.99,'fixture did not enter carried-object walking');
  actor.dispose();
 }
});
for(const [name,speed,limit]of [
 ['patrol',()=>AI_WALK_SPEEDS.teacherPatrol,1.8],
 ['entry',()=>AI_WALK_SPEEDS.teacherEntry,2.35],
 ['escort',()=>AI_WALK_SPEEDS.teacherEscort,2.05]
])test(`teacher ${name}: normal movement no longer uses a rapid walking rhythm`,async t=>{
 const actor=createRiggedTeacher(await loadGeometry('teacher-v2.glb'));
 const steps=sampleLimbs(actor,t=>actor.update(t,{speed:speed(),phase:'patrol'}));
 assert.ok(steps>1.4&&steps<limit,`${name} still takes ${steps.toFixed(2)} steps per second`);
 if(name!=='escort')assert.equal(speed(),2.2);t.diagnostic(`teacher ${name}: ${steps.toFixed(3)} steps/s at ${speed()} m/s`);
 actor.dispose();
});

for(const role of ['student','teacher'])test(`${role}: slower/backward and faster travel only modestly affect real limb cadence`,async()=>{
 const steps=[];
 for(const ratio of [.6,1,1.4]){
  const actor=role==='student'?createRiggedStudent(await loadGeometry(STUDENT_ASSETS.boy.file+'.glb'),{variant:'boy',seated:false}):createRiggedTeacher(await loadGeometry('teacher-v2.glb'));
  const speed=(role==='student'?1.8:2.2)*ratio;
  if(role==='student'){actor.setMood('resting');actor.setMotion({speed,seated:false});}
  steps.push(sampleLimbs(actor,t=>role==='student'?actor.update(t):actor.update(t,{speed,phase:'patrol'})));actor.dispose();
 }
 assert.ok(steps[0]<steps[1]&&steps[2]>steps[1]);
 assert.ok(steps[0]>=steps[1]*.88&&steps[2]<=steps[1]*1.10,'world-speed changes reintroduced rapid limb cycling');
});
