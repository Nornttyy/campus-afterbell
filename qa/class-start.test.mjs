import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound,START_BELL} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {SEATS,BOARD,blocked} from '../dist/classroom-layout.js';

const DT=1/60;
test('default start remains direct play, while gathering keeps the class clock and gameplay idle',()=>{
 const direct=new ClassroomRound();assert.equal(direct.start().stage,'class');assert.equal(direct.snapshot().timed,false);
 const r=new ClassroomRound();let s=r.start({gathering:true});assert.equal(s.status,'playing');assert.equal(s.stage,'gathering');assert.equal(s.player.seated,false);assert.equal(s.player.x,7.25);assert.equal(s.player.z,3.5);assert.equal(s.startBellAvailable,true);assert.deepEqual(s.startBell,START_BELL);
 for(const pupil of s.students){if(pupil.isTeammate)assert.equal(pupil.seated,false);else if(!pupil.isPlayer)assert.equal(pupil.seated,true);}
 assert.equal(r.toggleDrawer(),false);assert.equal(r.takeSlot(0),false);assert.equal(r.hold(true),false);assert.equal(r.startComputer(),false);
 r.step(15);s=r.snapshot();assert.equal(s.elapsed,0);assert.equal(s.timeLeft,600);assert.equal(s.score,0);assert.equal(s.chalks.length,0);assert.equal(s.sceneElapsed,15);assert.equal(s.stageElapsed,15);
 assert.ok(s.students.every(p=>!p.holding));assert.equal(r.setMovement(0,-1),true);r.step(1);assert.ok(r.player.z<3.5);assert.equal(blocked(r.player.x,r.player.z),false);
});

test('only a nearby aimed bell starts preparation; pause freezes it and there is only one bell event',()=>{
 const r=new ClassroomRound();r.start({gathering:true});r.setLook(0,0);assert.equal(r.startBell(),false);r.setLook(Math.atan2(START_BELL.x-r.player.x,START_BELL.z-r.player.z),0);
 r.pause();assert.equal(r.startBell(),false);r.pause(false);assert.equal(r.startBell(),true);assert.equal(r.startBell(),false);
 assert.equal(r.snapshot().stage,'seating');assert.equal(r.snapshot().stageTimeLeft,30);assert.equal(r.snapshot().startBellAvailable,false);
 const initial=r.snapshot();assert.ok([...r._seatingRoutes.values()].every(route=>route.length>0));
 r.step(3);const moving=r.snapshot();assert.ok(moving.students.some(p=>p.isTeammate&&Math.hypot(p.x-initial.students[p.id].x,p.z-initial.students[p.id].z)>.5));
 r.pause();const paused=r.snapshot();r.step(20);assert.deepEqual(r.snapshot(),paused);r.pause(false);r.step(1);assert.equal(r.snapshot().stageTimeLeft,26);
 assert.equal(r.drainEvents().filter(e=>e.type==='school-bell').length,1);
});

test('thirty preparation seconds seat pupils and only then start the ten-minute class timer',()=>{
 const r=new ClassroomRound();r.start({gathering:true});r.step(5);r.startBell();r.step(30-DT);
 let s=r.snapshot();assert.equal(s.stage,'seating');assert.equal(s.elapsed,0);assert.equal(s.score,0);assert.ok(s.stageTimeLeft>0);assert.equal(s.player.seated,false);
 r.step(DT);s=r.snapshot();assert.equal(s.stage,'class');assert.equal(s.elapsed,0);assert.equal(s.timeLeft,600);assert.equal(s.sceneElapsed,35);assert.equal(s.stageTimeLeft,0);assert.equal(s.player.seated,true);
 assert.ok(s.students.filter(p=>p.isPlayer||p.isTeammate).every(p=>p.seated&&p.seatId===p.id));assert.equal(s.teacher.x,BOARD.x);assert.equal(s.teacher.z,BOARD.z);
 const event=r.drainEvents().find(e=>e.type==='class-started');assert.equal(event.autoSeatedPlayer,true);
 assert.equal(r.toggleDrawer(),true);r.step(1);assert.equal(r.snapshot().timeLeft,599);assert.equal(r.snapshot().elapsed,1);
 r.reset();assert.equal(r.snapshot().timed,false);assert.deepEqual(r.snapshot(),new ClassroomRound().snapshot());
});

test('manual seating is allowed during preparation without enabling early item use',()=>{
 const r=new ClassroomRound();r.start({gathering:true});r.startBell();Object.assign(r.player,{x:SEATS[r.player.id].x,z:SEATS[r.player.id].z});
 assert.equal(r.interact(),'seated');assert.equal(r.toggleDrawer(),false);assert.equal(r.selectSlot(0),false);assert.equal(r.hold(true),false);r.step(30);
 assert.equal(r.drainEvents().find(e=>e.type==='class-started').autoSeatedPlayer,false);assert.equal(r.player.seatId,r.player.id);
});

test('human teachers can move through preparation but cannot throw, grab or write early',()=>{
 const r=new TeacherRound();r.start({gathering:true});assert.equal(r.throwChalk(),false);assert.equal(r.grabStudent(),false);assert.equal(r.setWriting(true),false);assert.equal(r.snapshot().teacherAim,null);
 r.startBell();assert.equal(r.setMovement(-1,0),true);r.step(.2);r.setMovement(0,0);const x=r.player.x;assert.ok(x<7);r.step(29.8);
 assert.equal(r.snapshot().stage,'class');assert.equal(r.snapshot().teacher.stamina,100);assert.equal(r.player.x,x);assert.equal(r.player.seated,false);assert.ok(r.students.filter(s=>r._team.has(s.id)).every(s=>s.seated));assert.equal(r.throwChalk(),true);
});

test('explicit result continuation returns to the same campus and role, with a fresh gathering phase',()=>{
 for(const Round of [ClassroomRound,TeacherRound]){
  const r=new Round({map:'tiered'});r.start();r.score=8;r._finish('won','mischief');const s=r.returnToGathering();
  assert.equal(s.map,'tiered');assert.equal(s.role,Round===TeacherRound?'teacher':'student');assert.equal(s.stage,'gathering');assert.equal(s.status,'playing');assert.equal(s.score,0);assert.equal(s.elapsed,0);assert.equal(s.player.seated,false);assert.equal(s.timeLeft,600);
  assert.equal(s.projectiles.length,0);assert.equal(s.bubbles.length,0);assert.equal(s.caughtCount,0);
 }
});


test('preparation seats are reserved for their owners; class-time free-seat changes remain allowed',()=>{
 const r=new ClassroomRound();r.start({gathering:true});r.startBell();const peer=r.students.find(s=>s.isTeammate),otherSeat=SEATS[peer.id];
 Object.assign(r.player,{x:otherSeat.x,z:otherSeat.z});assert.equal(r.interact(),false);assert.equal(r.player.seated,false);
 const own=SEATS[r.player.id];Object.assign(r.player,{x:own.x,z:own.z});assert.equal(r.interact(),'seated');r.step(30);
 const ids=r.students.filter(s=>s.seated).map(s=>s.seatId);assert.equal(new Set(ids).size,ids.length);assert.equal(r.player.seatId,r.player.id);
 assert.equal(r.interact(),'stood');peer.seated=false;peer.seatId=null;peer.x=7;peer.z=0;Object.assign(r.player,{x:otherSeat.x,z:otherSeat.z});
 assert.equal(r.interact(),'seated');assert.equal(r.player.seatId,otherSeat.id);
});


test('gathering pupils leave the initial camera and bell sightline clear in both roles',()=>{
 for(const Round of [ClassroomRound,TeacherRound]){
  const s=new Round().start({gathering:true}),p=s.player,dx=START_BELL.x-p.x,dz=START_BELL.z-p.z,len2=dx*dx+dz*dz;
  for(const pupil of s.students.filter(x=>x.isTeammate||x.isPlayer&&x.id!==p.id)){
   assert.equal(blocked(pupil.x,pupil.z,.30),false);
   assert.ok(Math.hypot(pupil.x-p.x,pupil.z-p.z)>1.1,'a pupil head overlaps the spawn camera');
   const t=Math.max(0,Math.min(1,((pupil.x-p.x)*dx+(pupil.z-p.z)*dz)/len2));
   assert.ok(Math.hypot(pupil.x-p.x-t*dx,pupil.z-p.z-t*dz)>.65,'a pupil head obscures the bell');
  }
 }
});
