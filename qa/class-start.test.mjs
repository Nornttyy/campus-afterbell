import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound,START_BELL,AI_WALK_SPEEDS,CLASS_START_TIMING} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {BOARD,TEACHER_SPAWN,CAMPUS_MAPS,DOORS,blocked} from '../dist/classroom-layout.js';
const DT=1/60;
// Latest flow: AI leaves the lift in a spaced queue at normal student speed,
// the teacher stays locked for thirty seconds, and players choose their chairs.
test('gathering pauses the class clock, leaves the classroom empty and keeps the bell visible',()=>{
 const r=new ClassroomRound();let s=r.start({gathering:true});assert.equal(s.stage,'gathering');assert.equal(s.player.seated,false);assert.equal(s.startBellAvailable,true);assert.deepEqual(s.startBell,START_BELL);assert.ok(s.students.filter(p=>!p.isPlayer).every(p=>!p.seated&&!p.visible));
 assert.equal(r.toggleDrawer(),false);assert.equal(r.hold(true),false);r.step(15);s=r.snapshot();assert.equal(s.elapsed,0);assert.equal(s.timeLeft,600);assert.equal(s.score,0);assert.equal(s.sceneElapsed,15);assert.equal(r.setMovement(0,-1),true);r.step(.1);assert.equal(blocked(r.player.x,r.player.z,.18,r.layout),false);
});
test('only an aimed nearby bell starts one thirty-second preparation; pause freezes it',()=>{
 const r=new ClassroomRound();r.start({gathering:true});r.setLook(0,0);assert.equal(r.startBell(),false);r.setLook(Math.atan2(START_BELL.x-r.player.x,START_BELL.z-r.player.z),0);r.pause();assert.equal(r.startBell(),false);r.pause(false);assert.equal(r.startBell(),true);assert.equal(r.startBell(),false);r.step(3);r.pause();const frozen=r.snapshot();r.step(20);assert.deepEqual(r.snapshot(),frozen);r.pause(false);r.step(1);assert.equal(r.snapshot().stageTimeLeft,26);assert.equal(r.drainEvents().filter(e=>e.type==='school-bell').length,1);
});
test('the office stays locked until the class starts; no automatic player seating on any floor',()=>{
 for(const map of CAMPUS_MAPS){const r=new ClassroomRound({map});r.start({gathering:true});r.startBell();const before={x:r.player.x,z:r.player.z};r.step(30-DT);assert.equal(r.stage,'seating');assert.equal(r.layout.officeLocked,true);assert.equal(r.teacher.x,TEACHER_SPAWN.x);assert.equal(r.teacher.z,TEACHER_SPAWN.z);r.step(DT);assert.equal(r.stage,'class');assert.equal(r.layout.officeLocked,false);assert.equal(r.elapsed,0);assert.deepEqual({x:r.player.x,z:r.player.z},before);assert.equal(r.player.seated,false);assert.equal(r.drainEvents().find(e=>e.type==='class-started').autoSeatedPlayer,false);}
});
test('AI departs early one at a time, follows real paths at normal speed and gradually takes seats',()=>{
 const r=new ClassroomRound();r.start({gathering:true});r.startBell();r.step(CLASS_START_TIMING.firstArrival-DT);assert.ok(r.students.filter(s=>!s.isPlayer).every(s=>s.visible===false));r.step(DT);assert.equal(r.snapshot().stageTimeLeft,30-CLASS_START_TIMING.firstArrival);assert.equal(r.students.filter(s=>!s.isPlayer&&s.visible).length,1);
 const count=r.students.filter(s=>!s.isPlayer).length;let previous=r.snapshot(),seated=0;const seatTimes=new Set();for(let i=0;i<(30-CLASS_START_TIMING.firstArrival)/DT;i++){r.step(DT);const snap=r.snapshot();for(const s of snap.students.filter(s=>!s.isPlayer&&s.visible)){const old=previous.students[s.id];if(old.visible)assert.ok(Math.hypot(s.x-old.x,s.z-old.z)<=AI_WALK_SPEEDS.student*DT+2e-6,'arrival including the last chair step must remain continuous at normal speed');assert.equal(blocked(s.x,s.z,.2,r.layout),false);if(!old.seated&&s.seated)seatTimes.add(snap.sceneElapsed);}seated=snap.students.filter(s=>!s.isPlayer&&s.seated).length;previous=snap;if(seated===count)break;}
 assert.equal(seated,count);assert.ok(seatTimes.size>Math.min(15,count/2));assert.equal(new Set(r.students.filter(s=>s.seated).map(s=>s.seatId)).size,count);
});
test('manual free seating is allowed before class and an arriving AI chooses another seat',()=>{
 const r=new ClassroomRound();r.start({gathering:true});r.startBell();const seat=r.seats[2];Object.assign(r.player,{x:seat.x,z:seat.z});assert.equal(r.interact(2),'seated');assert.equal(r.toggleDrawer(),false);r.step(30);assert.equal(r.player.seatId,2);assert.notEqual(r.students[2]._targetSeatId,2);assert.equal(r.students.filter(s=>s.seated&&s.seatId===2).length,1);assert.equal(r.toggleDrawer(),true);
});
test('human teacher is teleported to the office before preparation and cannot throw early',()=>{
 const r=new TeacherRound();r.start({gathering:true});assert.equal(r.throwChalk(),false);r.startBell();assert.equal(r.player.x,TEACHER_SPAWN.x);assert.equal(r.player.z,TEACHER_SPAWN.z);assert.equal(r.layout.officeLocked,true);r.step(30);assert.equal(r.stage,'class');assert.equal(r.teacher.stamina,100);assert.equal(r.throwChalk(),true);assert.equal(r.teacher.stamina,100,'throwing chalk is free under the current stamina rule');
});
test('AI teacher exits only after preparation, follows a continuous physical path and ignores evidence while entering',()=>{
 const r=new ClassroomRound();r.start({gathering:true});r.startBell();r.step(30);assert.equal(r.teacher.intent,'enter');const budget=r._teacherEntryLength/AI_WALK_SPEEDS.teacherEntry;r._hear(r.player,4);assert.equal(r._memory.size,0);let steps=0;
 while(r._teacherEntryRoute&&steps++<Math.ceil(budget/DT)+5){const old={x:r.teacher.x,z:r.teacher.z};r.step(DT);assert.ok(Math.hypot(r.teacher.x-old.x,r.teacher.z-old.z)<=AI_WALK_SPEEDS.teacherEntry*DT+1e-7);assert.equal(blocked(r.teacher.x,r.teacher.z,.23,r.layout),false);if(r._teacherEntryRoute){assert.equal(r.teacher.looking,false);assert.equal(r._memory.size,0);}}
 assert.equal(r._teacherEntryRoute,null);assert.ok(Math.hypot(r.teacher.x-BOARD.x,r.teacher.z-BOARD.z)<.08);assert.equal(r.drainEvents().filter(e=>e.type==='teacher-entered').length,1);
});
test('result continuation preserves floor and role while resetting countdown, effects and doors',()=>{
 for(const Round of [ClassroomRound,TeacherRound]){const r=new Round({map:'tiered8'});r.start();r.score=8;r.setRearDoor(true);r._finish('won','mischief');const s=r.returnToGathering();assert.equal(s.map,'tiered8');assert.equal(s.role,Round===TeacherRound?'teacher':'student');assert.equal(s.stage,'gathering');assert.equal(s.score,0);assert.equal(s.elapsed,0);assert.equal(s.rearDoorClosed,false);assert.equal(s.officeLocked,false);assert.equal(s.projectiles.length,0);assert.equal(s.bubbles.length,0);assert.equal(r._seatingRoutes.size,0);}
});
