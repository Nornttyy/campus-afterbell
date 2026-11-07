import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound,BUBBLE_TUNING} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {DETENTION} from '../dist/classroom-layout.js';

const DT=1/60;
function quiet(Round=ClassroomRound){const r=new Round({seed:44,target:120});r.start();for(const s of r.students)s._decisionAt=Infinity;silenceTeacher(r);return r;}
function silenceTeacher(r){r._thinkAt=r._plan.until=Infinity;r.teacher.x=r.teacher.z=30;}
function bind(r,actor,index=0){
 r.teacher.x=actor.x;r.teacher.z=actor.z-.9;r._stun(actor);assert.ok(r._grab(actor));
 r.teacher.x=DETENTION[index].x;r.teacher.z=DETENTION[index].z-1.1;assert.ok(r._bind(index));silenceTeacher(r);
}

test('a bound pupil can blow while movement, ordinary items and self-rescue remain unavailable',()=>{
 const r=quiet();bind(r,r.player);const stock=r.snapshot().drawer.slots,position={x:r.player.x,z:r.player.z};
 assert.equal(r.snapshot().player.bubble.available,true);assert.equal(r.hold(true),true);
 assert.equal(r.setMovement(1,0),false);assert.equal(r.toggleDrawer(),false);assert.equal(r.takeSlot(0),false);assert.equal(r.interact(),false);assert.equal(r.setRescue(r.player.id),false);
 r.step(3);const s=r.snapshot();assert.equal(s.player.bubble.blowing,true);assert.equal(s.player.bubble.progress,.3);assert.equal(s.score,0,'unverified bubble scoring stays disabled');
 assert.deepEqual(s.drawer.slots,stock);assert.deepEqual({x:s.player.x,z:s.player.z},position);assert.equal(s.bubbles.length,0);
 assert.ok(Object.values(s.completed).every(n=>n===0));
});

test('release creates one partial bubble with its source and starts the ten-second cooldown',()=>{
 const r=quiet();bind(r,r.player);r.hold(true);r.step(2.5);assert.equal(r.releaseUse(),true);
 const s=r.snapshot(),bubble=s.bubbles[0];assert.equal(s.bubbles.length,1);assert.equal(bubble.studentId,r.player.id);assert.equal(bubble.charge,.25);assert.equal(bubble.age,0);
 for(const key of ['x','y','z','yaw'])assert.ok(Number.isFinite(bubble[key]));
 assert.equal(s.player.bubble.cooldown,10);assert.equal(s.player.bubble.progress,0);assert.equal(s.player.bubble.blowing,false);assert.equal(s.player.bubble.available,false);
 assert.equal(r.releaseUse(),false);assert.equal(r.hold(true),false);assert.equal(r.drainEvents().filter(e=>e.type==='bubble-release').length,1);
 r.step(1);const moved=r.snapshot().bubbles[0];assert.ok(moved.age>.99);assert.ok(Math.hypot(moved.x-bubble.x,moved.z-bubble.z)>.5);assert.ok(moved.y>bubble.y);
 r.step(9-DT);assert.equal(r.snapshot().player.bubble.available,false);assert.equal(r.snapshot().bubbles.length,0);
 r.step(DT);assert.equal(r.snapshot().player.bubble.cooldown,0);assert.equal(r.hold(true),true);
});

test('full inflation releases once, never consumes stock, and cannot repeat while held',()=>{
 const r=quiet();bind(r,r.player);const stock=r.snapshot().drawer.slots;r.hold(true);r.step(BUBBLE_TUNING.duration-DT);
 assert.equal(r.snapshot().bubbles.length,0);assert.ok(r.snapshot().player.bubble.progress<1);
 r.step(DT);let s=r.snapshot();assert.equal(s.bubbles.length,1);assert.equal(s.bubbles[0].charge,1);assert.equal(s.player.bubble.cooldown,10);assert.equal(s.holding,false);
 assert.equal(r.releaseUse(),false);r.step(20);s=r.snapshot();assert.equal(s.bubbles.length,0);assert.equal(s.score,0);assert.deepEqual(s.drawer.slots,stock);
 assert.equal(r.drainEvents().filter(e=>e.type==='bubble-release').length,1);
});

test('pause freezes inflation and cooling; rescue and finish cancel without releasing a bubble',()=>{
 const r=quiet();bind(r,r.player);r.hold(true);r.step(2);r.pause();const paused=r.snapshot();r.step(8);assert.deepEqual(r.snapshot(),paused);assert.equal(r.hold(true),false);
 r.pause(false);r.step(1);assert.equal(r.snapshot().player.bubble.progress,.2);assert.equal(r.snapshot().player.bubble.blowing,false);r.hold(true);r.step(1);assert.equal(r.snapshot().player.bubble.progress,.3);
 r._release(r.player);assert.equal(r.snapshot().player.bubble.available,false);assert.equal(r.snapshot().player.bubble.progress,0);assert.equal(r.snapshot().holding,false);assert.equal(r.snapshot().bubbles.length,0);
 bind(r,r.player);r.hold(true);r.step(1);r.releaseUse();r.pause();const cooldown=r.snapshot().player.bubble.cooldown;r.step(9);assert.equal(r.snapshot().player.bubble.cooldown,cooldown);r.pause(false);r.step(10);r.hold(true);r.step(1);
 r._finish('won','mischief');assert.equal(r.snapshot().player.bubble.blowing,false);assert.equal(r.snapshot().player.bubble.progress,0);const finished=r.snapshot();r.step(10);assert.deepEqual(r.snapshot(),finished);
});

test('only bound team AI blows; an ordinary misidentified pupil never gets the action',()=>{
 const r=quiet(TeacherRound),team=r.students[[...r._team][0]],ordinary=r.students.find(s=>!r._team.has(s.id));
 bind(r,team,0);bind(r,ordinary,1);team._decisionAt=ordinary._decisionAt=0;r.step(14);
 const events=r.drainEvents().filter(e=>e.type==='bubble-release');assert.equal(events.length,1);assert.equal(events[0].studentId,team.id);
 assert.equal(r.snapshot().students[ordinary.id].bubble.available,false);assert.equal(r.snapshot().students[ordinary.id].bubble.progress,0);assert.equal(r.score,0);
});

test('five captures resolve at the next fixed tick with no extended grace period and goal priority',()=>{
 for(const reachedGoal of [false,true]){
  const r=quiet();let index=0;for(const id of r._team)bind(r,r.students[id],index++);
  if(reachedGoal)r.score=r.target;
  assert.equal(r.status,'playing');r.step(DT);assert.equal(r.status,reachedGoal?'won':'lost');assert.equal(r.resultReason,reachedGoal?'mischief':'all-caught');
  const final=r.snapshot();r.step(20);assert.deepEqual(r.snapshot(),final);assert.equal(r.drainEvents().filter(e=>e.type==='finish').length,1);
 }
});
