import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleActorHeading} from '../dist/classroom.js';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {createRiggedTeacher} from '../dist/imported-actors.js';
import {loadGeometry} from './gltf-geometry.mjs';
const DT=1/60,angle=n=>Math.atan2(Math.sin(n),Math.cos(n));

test('free pupil turns take the shortest arc and preserve exact action alignment',()=>{
 const actor={yaw:Math.PI-.05,seated:false,captivity:'free',mood:'walking',itemThrowAge:999};
 let sample=sampleActorHeading(null,actor,0);assert.equal(sample.yaw,actor.yaw,'first appearance must not turn from a fabricated heading');
 actor.yaw=-Math.PI+.05;
 sample=sampleActorHeading(sample,actor,DT);assert.ok(sample.yaw>Math.PI-.05,'crossing pi takes the long route');assert.ok(Math.abs(angle(sample.yaw-actor.yaw))<.1);
 const frozen=sampleActorHeading(sample,actor,DT);assert.equal(frozen.yaw,sample.yaw,'paused render changes the heading');
 actor.yaw=-1;
 for(let frame=2;frame<=90;frame++)sample=sampleActorHeading(sample,actor,frame*DT);
 assert.ok(Math.abs(angle(sample.yaw-actor.yaw))<.00001,'turn never converges after stopping');
 for(const state of [{seated:true},{captivity:'carried'},{captivity:'bound'},{mood:'rescuing'},{itemThrowAge:.1},{holding:true,action:'smoke'}]){
  const aligned={yaw:1,seated:false,captivity:'free',mood:'walking',itemThrowAge:999,...state};
  assert.equal(sampleActorHeading(sample,aligned,2).yaw,1,'interaction/capture was offset from its authoritative pose');
 }
 assert.equal(sampleActorHeading(sample,{...actor,yaw:2},0).yaw,2,'new scene retains old facing');
});

test('real arrival corners no longer snap the visible body without changing navigation',()=>{
 const round=new ClassroomRound({seed:73});round.start({gathering:true});round.startBell();
 const samples=new Map(),previous=new Map();let abrupt=0,checked=0;
 for(let frame=0;frame<1800;frame++){
  const state=round.step(DT);
  for(const pupil of state.students){
   const before=JSON.stringify(pupil),prior=samples.get(pupil.id),old=previous.get(pupil.id);
   const next=sampleActorHeading(prior,pupil,state.sceneElapsed);
   assert.equal(JSON.stringify(pupil),before,'visual smoothing changed collision/target coordinates');
   if(prior?.free&&next.free&&old){
    const elapsed=state.sceneElapsed-prior.time;
    assert.ok(Math.abs(angle(next.yaw-prior.yaw))<=5.5*elapsed+1e-8,'visible student turned instantaneously');
    if(Math.abs(angle(pupil.yaw-old.yaw))>.8)abrupt++;
    checked++;
   }
   samples.set(pupil.id,next);previous.set(pupil.id,pupil);
  }
 }
 assert.ok(abrupt>100,'fixture did not exercise real grid corners');assert.ok(checked>1000);
});

test('teacher walk clock keeps all accepted simulation time during slow frames',async()=>{
 const actor=createRiggedTeacher(await loadGeometry('teacher-v2.glb'));
 let time=0;const speed=actor.diagnostics().animation.nominalWalkSpeed;
 for(let i=0;i<120;i++)actor.update(time+=DT,{speed,phase:'patrol'});
 const start=actor.diagnostics().animation.time;
 for(let i=0;i<8;i++)actor.update(time+=.125,{speed,phase:'patrol'});
 assert.ok(Math.abs(actor.diagnostics().animation.time-start-1)<1e-8,'slow frames dropped accepted simulation time');
 const before=actor.diagnostics().animation.time;actor.update(time,{speed,phase:'patrol'});
 assert.equal(actor.diagnostics().animation.time,before,'repainting a paused snapshot advances gait');
 actor.update(time+=.25,{speed,phase:'patrol'});
 assert.ok(Math.abs(actor.diagnostics().animation.time-before-.25)<1e-8);
 actor.dispose();
});
