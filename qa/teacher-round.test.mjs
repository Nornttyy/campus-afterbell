import test from 'node:test';
import assert from 'node:assert/strict';
import {TeacherRound,chalkHit} from '../dist/teacher-rules.js';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {SEATS} from '../dist/classroom-layout.js';
function setup(){const r=new TeacherRound({seed:44,target:100000});r.start();for(const s of r.students)s._decisionAt=Infinity;return r;}
function aim(r,s,dist=1.4){r.player.x=s.x;r.player.z=s.z+dist;r.setLook(Math.PI,Math.atan2(.16,dist));}
test('teacher has five hidden random students and does not automatically observe or capture them',()=>{
 const a=setup(),b=new TeacherRound({seed:45});assert.equal(a._team.size,5);assert.notDeepEqual([...a._team],[...b._team]);assert.equal(a.students.filter(s=>s.isPlayer).length,0);
 assert.equal(a.snapshot().role,'teacher');assert.equal(a.snapshot().player.seated,false);a.step(20);assert.equal(a._memory.size,0);assert.equal(a.snapshot().caughtCount,0);
});
test('chalk must hit a body; hit is not itself a red card; red card needs closeness and aim',()=>{
 const r=setup(),s=r.students[[...r._team][0]];aim(r,s);assert.ok(r.throwChalk());assert.equal(r.throwChalk(),false);r.step(.15);assert.ok(s._chalkUntil>r.elapsed);assert.equal(s.caught,false);
 r.player.z+=3;assert.equal(r.redCard(),false);aim(r,s);r.setLook(0,0);assert.equal(r.redCard(),false);aim(r,s);assert.ok(r.redCard());assert.equal(s.caught,true);assert.equal(r.snapshot().caughtCount,1);
});
test('missing with chalk cannot grant a red card and an NPC is not a real target',()=>{
 const r=setup(),s=r.students.find(s=>!r._team.has(s.id));aim(r,s);r.setLook(Math.PI,-1);r.throwChalk();r.step(.8);assert.equal(s._chalkUntil,0);assert.equal(r.redCard(),false);
 aim(r,s);r.throwChalk();r.step(.15);assert.ok(s._chalkUntil>r.elapsed);assert.equal(r.redCard(),false);assert.equal(s.caught,false);assert.equal(r.wrongCards,1);assert.equal(r.snapshot().caughtCount,0);
});
test('chalk collides with desks and computer cases instead of passing through',()=>{
 const s=SEATS[27],a={x:s.x,y:.73,z:s.deskZ+1},b={x:s.x,y:.73,z:s.z};
 assert.equal(chalkHit(a,b,[{...s,seated:true}],[],'classroom')?.kind,'desk');
 assert.equal(chalkHit({...a,y:1.2},{...b,y:1.2},[{...s,seated:true}],[],'computer')?.kind,'desk');
});
test('smoke prevents red card targeting; pause freezes chalk; restart clears it',()=>{
 const r=setup(),s=r.students[[...r._team][0]];aim(r,s);s._chalkUntil=10;r.smokes=[{x:s.x,z:s.z+.7,radius:.6,density:1,remaining:10,age:0}];assert.equal(r.redCard(),false);
 r.smokes=[];r.throwChalk();const before=r.snapshot().chalks;r.pause();r.step(3);assert.deepEqual(r.snapshot().chalks,before);r.reset();assert.equal(r.snapshot().chalks.length,0);assert.equal(r.snapshot().caughtCount,0);
});
test('teacher wins only after all five active students are detained',()=>{
 const r=setup();for(const id of r._team){const s=r.students[id];aim(r,s);s._chalkUntil=r.elapsed+5;r._cardUntil=0;r.redCard();}assert.equal(r.status,'lost');assert.equal(r.snapshot().caughtCount,5);
});
function computer(){const r=new ClassroomRound({map:'computer',seed:7,target:100000});r.start();r.teacher.x=r.teacher.z=30;r._plan.until=Infinity;r._thinkAt=Infinity;for(const s of r.students)if(s.isTeammate)s._decisionAt=Infinity;return r;}
test('PC gameplay requires starting a computer and holding; Q stops it without consuming drawer items',()=>{
 const r=computer(),slots=r.snapshot().drawer.slots;r.hold(true);r.step(4);assert.equal(r.score,0);assert.ok(r.startComputer());r.hold(true);r.step(1.5);assert.equal(r.score,0);r.hold(false);r.step(3);assert.equal(r.score,0);r.hold(true);r.step(1.5);assert.equal(r.score,2.5);assert.equal(r.completed.computer,1);assert.deepEqual(r.snapshot().drawer.slots,slots);assert.ok(r.stopComputer());assert.equal(r.snapshot().player.computerActive,false);r.step(4);assert.equal(r.score,2.5);
});
test('PC gameplay cannot start in a classroom, standing, paused or holding a drawer item',()=>{
 const normal=new ClassroomRound();normal.start();assert.equal(normal.startComputer(),false);const r=computer();r.interact();assert.equal(r.startComputer(),false);r.interact();r.pause();assert.equal(r.startComputer(),false);r.pause(false);r.toggleDrawer();r.takeSlot(0);assert.equal(r.startComputer(),false);
});
test('computer actions never appear as a drawer item and AI can play the PCs',()=>{
 const r=new ClassroomRound({map:'computer',seed:9,target:100000});r.start();r._thinkAt=Infinity;r._plan.until=Infinity;r.teacher.x=r.teacher.z=30;
 for(let i=0;i<20;i++)r.step(1);assert.ok(r.students.some(s=>s.completed.computer>0));assert.ok(r.students.flatMap(s=>s._slots).every(s=>s.action!=='computer'));
});
