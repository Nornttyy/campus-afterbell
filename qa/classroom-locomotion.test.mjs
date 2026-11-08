import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleActorMotion} from '../dist/classroom.js';
import {ClassroomRound,AI_WALK_SPEEDS} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {CORRIDOR,blocked,walkRoute} from '../dist/classroom-layout.js';

const DT=1/60;
const corridorX=(CORRIDOR.minX+CORRIDOR.maxX)/2;
test('actor playback follows measured metres per second and stops despite walking mood',()=>{
  const actor={x:0,z:0,seated:false,captivity:'free',mood:'walking'};
  let sample=sampleActorMotion(null,actor,0);assert.equal(sample.speed,0);
  for(let frame=1;frame<=60;frame++){actor.z=frame*DT*1.45;sample=sampleActorMotion(sample,actor,frame*DT);}
  assert.ok(Math.abs(sample.speed-1.45)<.00001,'rescue speed was replaced by ordinary walk speed');
  const duplicate=sampleActorMotion(sample,actor,1);assert.equal(duplicate.speed,sample.speed,'render-only frame changes stride');
  sample=sampleActorMotion(sample,actor,1+DT);assert.equal(sample.speed,0,'blocked pupil keeps walking in place');
});

test('spawn, pause, seating, captivity, teleport and time reset do not produce walk impulses',()=>{
  const actor={x:0,z:0,seated:false,captivity:'free'};
  let sample=sampleActorMotion(null,actor,1);
  actor.z=.02;sample=sampleActorMotion(sample,actor,1+DT);assert.ok(sample.speed>0);
  sample=sampleActorMotion(sample,actor,1+DT,false);assert.equal(sample.speed,0);
  actor.z=2;sample=sampleActorMotion(sample,actor,1+2*DT);assert.equal(sample.speed,0,'teleport became a fast stride');
  actor.z+=.02;sample=sampleActorMotion(sample,actor,1+3*DT);assert.ok(sample.speed>0);
  actor.z+=.1;sample=sampleActorMotion(sample,actor,1+3*DT);assert.equal(sample.speed,0,'same-time relocation retained old velocity');
  for(const captivity of ['stunned','carried','bound']){
    actor.captivity=captivity;actor.z+=.02;sample=sampleActorMotion(sample,actor,sample.time+DT);assert.equal(sample.speed,0);
  }
  actor.captivity='free';actor.z+=.02;sample=sampleActorMotion(sample,actor,sample.time+DT);assert.equal(sample.speed,0,'release relocation became a stride');
  actor.seated=true;sample=sampleActorMotion(sample,actor,sample.time+DT);assert.equal(sample.speed,0);
  actor.seated=false;sample=sampleActorMotion(sample,actor,sample.time+DT);assert.equal(sample.speed,0,'first standing frame used sitting displacement');
  actor.z+=.02;sample=sampleActorMotion(sample,actor,sample.time+DT);assert.ok(sample.speed>0);
  sample=sampleActorMotion(sample,actor,0);assert.equal(sample.speed,0,'new round retained previous stride');
});

test('real classroom arrivals yield physical walk speed and zero speed after sitting',()=>{
  const round=new ClassroomRound({seed:73});round.start({gathering:true});round.startBell();
  const samples=new Map();let moving=0,stopped=0,seated=0,peak=0;
  // The first pupil now leaves the lift with twenty preparation seconds left.
  // Preserve their ordinary walking pace over the larger school: late arrivals
  // continue walking after the bell instead of snapping into distant seats.
  let allSeated=false;
  for(let frame=0;frame<90/DT;frame++){
    const state=round.step(DT);
    for(const student of state.students){
      const previous=samples.get(student.id),next=sampleActorMotion(previous,student,state.sceneElapsed,state.status==='playing'&&!state.paused);
      samples.set(student.id,next);peak=Math.max(peak,next.speed);
      if(next.speed>AI_WALK_SPEEDS.student-.01)moving++;
      if(student.seated){seated++;assert.equal(next.speed,0);}
      if(previous&&previous.x===student.x&&previous.z===student.z){stopped++;assert.equal(next.speed,0);}
    }
    if(frame===30/DT-2)assert.ok(state.students.some(s=>!s.isPlayer&&!s.seated),'far pupils teleported into their seats to meet the bell');
    if(state.students.filter(s=>!s.isPlayer).every(s=>s.seated)){allSeated=true;break;}
  }
  assert.equal(allSeated,true,'a pupil never reached an available chair along the real route');
  assert.ok(moving>60,'actual arrivals never reach walking speed');
  assert.ok(stopped>60&&seated>60,'arrival test did not cover waiting and sitting');
  assert.ok(Math.abs(peak-AI_WALK_SPEEDS.student)<.001,`unexpected arrival speed ${peak}`);
});

test('returning students and teacher entry follow their distinct ordinary movement speeds',()=>{
  const round=new ClassroomRound({seed:73});round.start({gathering:true});
  const pupil=round.students.find(s=>!s.isPlayer);
  pupil._returnRoute=walkRoute(pupil,round.seats[pupil.id],.2,round.layout);assert.ok(pupil._returnRoute.length);
  let peak=0;
  for(let frame=0;frame<2400&&!pupil.seated;frame++){
    const before={x:pupil.x,z:pupil.z};round._advanceRescuer(pupil,DT);
    if(!pupil.seated)peak=Math.max(peak,Math.hypot(pupil.x-before.x,pupil.z-before.z)/DT);
  }
  assert.ok(pupil.seated,'student never returned to the reserved seat');assert.ok(Math.abs(peak-AI_WALK_SPEEDS.student)<.001);
  const entry=new ClassroomRound({seed:73});entry.start({gathering:true});entry.startBell();entry.step(30);
  let teacherPeak=0;
  for(let frame=0;frame<120;frame++){
    const before={x:entry.teacher.x,z:entry.teacher.z};entry.step(DT);
    teacherPeak=Math.max(teacherPeak,Math.hypot(entry.teacher.x-before.x,entry.teacher.z-before.z)/DT);
  }
  assert.ok(Math.abs(teacherPeak-AI_WALK_SPEEDS.teacherEntry)<.001,'teacher entry uses the wrong movement speed');
});

test('teacher patrol and escort walk at their own physical speed with matching route budget',()=>{
  for(const intent of ['patrol','escort']){
    const round=new ClassroomRound();round.start();Object.assign(round.teacher,{x:corridorX,z:0,yaw:0});round._thinkAt=Infinity;
    assert.equal(blocked(round.teacher.x,round.teacher.z,.23,round.layout),false,'patrol must start clear of the partition');
    if(intent==='patrol'){
      round._setPlan('investigate',null,{x:corridorX,z:3},20);round._turnLeft=0;
      assert.ok(Math.abs(round._plan.until-round.elapsed-Math.min(18,round._plan.routeLength/AI_WALK_SPEEDS.teacherPatrol+1.7))<1e-9,'route budget would expire at the old patrol pace');
    }else round._escortRoute=walkRoute(round.teacher,{x:corridorX,z:3},.2,round.layout);
    let distance=0;
    for(let frame=0;frame<30;frame++){
      const old={x:round.teacher.x,z:round.teacher.z};
      if(intent==='patrol')round._advanceTeacher(DT);else round._advanceEscort(DT);
      distance+=Math.hypot(round.teacher.x-old.x,round.teacher.z-old.z);
    }
    const speed=intent==='patrol'?AI_WALK_SPEEDS.teacherPatrol:AI_WALK_SPEEDS.teacherEscort;
    assert.ok(Math.abs(distance-speed*.5)<1e-7,`${intent} did not move half a second at ${speed} m/s`);
  }
});

test('urgent chase, teammate rescue and human movement retain their original speeds',()=>{
  const chase=new ClassroomRound();chase.start();Object.assign(chase.teacher,{x:corridorX,z:0,yaw:0});
  const target=chase.students.find(s=>!s.isPlayer);Object.assign(target,{x:corridorX,z:4,seated:false,captivity:'stunned'});chase._memory.set(target.id,{confirmed:true});
  assert.equal(chase._advanceStunChase(DT),true);assert.ok(Math.abs(Math.hypot(chase.teacher.x-corridorX,chase.teacher.z)-1.6*DT)<1e-9,'teacher urgent chase was slowed');

  const rescue=new ClassroomRound();rescue.start();const helper=rescue.students.find(s=>s.isTeammate),bound=rescue.students.find(s=>s.isTeammate&&s!==helper);
  Object.assign(helper,{x:corridorX,z:0,seated:false,_rescueTarget:bound.id});Object.assign(bound,{x:corridorX,z:4,seated:false,captivity:'bound'});
  helper._rescueRoute=walkRoute(helper,{x:corridorX,z:3.3},.2,rescue.layout);assert.equal(rescue._advanceRescuer(helper,DT),true);
  assert.ok(Math.abs(Math.hypot(helper.x-corridorX,helper.z)-1.45*DT)<1e-9,'urgent rescue was slowed with ordinary walking');

  for(const Round of [ClassroomRound,TeacherRound]){
    const round=new Round();round.start();Object.assign(round.player,{x:corridorX,z:0,seated:false});round.setMovement(0,1);round.step(.5);
    assert.ok(Math.abs(round.player.z-.9)<1e-8,'ordinary AI walk changed human movement');
  }
  const carrying=new TeacherRound();carrying.start();Object.assign(carrying.player,{x:corridorX,z:0,seated:false});
  carrying.teacher.carriedId=0;Object.assign(carrying.students[0],{captivity:'carried',_grabAt:0,_grabStart:{x:corridorX,z:0}});
  carrying.setMovement(0,1);carrying.step(.5);assert.ok(Math.abs(carrying.player.z-1.15*.5)<1e-8,'AI escort tuning changed human carrying movement');
});
