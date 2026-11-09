import {teacherViewHeight} from '../dist/camera-height58.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {TeacherRound,chalkHit} from '../dist/teacher-rules.js';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {SEATS,DETENTION,BOARD} from '../dist/classroom-layout.js';
function setup(){const r=new TeacherRound({seed:44,target:100000});r.start();for(const s of r.students)s._decisionAt=Infinity;return r;}
function aim(r,s,dist=1.4){r.player.x=s.x;r.player.z=s.z+dist;r.setLook(Math.PI,Math.atan2(teacherViewHeight(r.player)-1.49,dist));}
test('teacher has five hidden random students and does not automatically observe or capture them',()=>{
 const a=setup(),b=new TeacherRound({seed:45});assert.equal(a._team.size,5);assert.notDeepEqual([...a._team],[...b._team]);assert.equal(a.students.filter(s=>s.isPlayer).length,0);
 assert.equal(a.snapshot().role,'teacher');assert.equal(a.snapshot().player.seated,false);a.step(20);assert.equal(a._memory.size,0);assert.equal(a.snapshot().caughtCount,0);
});
test('chalk only stuns; grabbing requires close aim; only a post can bind',()=>{
 const r=setup(),s=r.students[[...r._team][0]];aim(r,s);assert.ok(r.throwChalk());assert.equal(r.throwChalk(),false);r.step(.15);assert.equal(s.captivity,'stunned');assert.equal(s.caught,false);
 r.player.z+=3;assert.equal(r.grabStudent(),false);aim(r,s);r.setLook(0,0);assert.equal(r.grabStudent(),false);aim(r,s);assert.ok(r.grabStudent());assert.equal(s.captivity,'carried');assert.equal(r.snapshot().caughtCount,0);assert.equal(r.bindStudent(),false);assert.equal(r.throwChalk(),false);
 const post=DETENTION[0];r.player.x=post.x;r.player.z=post.z-1.1;r.setLook(0,0);r.step(.5);assert.ok(r.bindStudent());assert.equal(s.captivity,'bound');assert.equal(r.snapshot().caughtCount,1);assert.equal(r.teacher.carriedId,null);
});
test('a miss cannot grant a grab and an ordinary NPC is not counted as a target',()=>{
 const r=setup(),s=r.students.find(s=>!r._team.has(s.id));aim(r,s);r.setLook(Math.PI,-1);r.throwChalk();r.step(.8);assert.equal(s.captivity,'free');assert.equal(r.grabStudent(),false);
 aim(r,s);r.throwChalk();r.step(.15);assert.equal(s.captivity,'stunned');assert.equal(r.grabStudent(),true);assert.equal(s.captivity,'carried');assert.equal(r.wrongGrabs,0);
 const post=DETENTION[0];r.player.x=post.x;r.player.z=post.z-1.1;r.setLook(0,0);r.step(.4);const before=r.teacher.stamina;
 assert.ok(r.bindStudent());assert.equal(s.captivity,'bound');assert.equal(r.wrongGrabs,1);assert.equal(r.snapshot().caughtCount,0);assert.equal(r.teacher.stamina,before-40);
 assert.equal(r.bindStudent(),false);assert.equal(r.teacher.stamina,before-40);assert.ok(r.drainEvents().some(e=>e.type==='wrong-grab'&&e.penalty===40));
 assert.equal(r.releaseTarget()?.id,s.id);assert.ok(r.releaseBoundStudent());r.step(30);assert.equal(s.captivity,'free');assert.equal(s.seated,true);assert.equal(s.action,null);
});
test('chalk collides with desks and computer cases instead of passing through',()=>{
 const s=SEATS[27],a={x:s.x,y:.73,z:s.deskZ+1},b={x:s.x,y:.73,z:s.z};
 assert.equal(chalkHit(a,b,[{...s,seated:true}],[],'classroom')?.kind,'desk');
 assert.equal(chalkHit({...a,y:1.2},{...b,y:1.2},[{...s,seated:true}],[],'computer')?.kind,'desk');
});
test('smoke prevents grabbing; pause freezes chalk and reset clears captures',()=>{
 const r=setup(),s=r.students[[...r._team][0]];aim(r,s);r._stun(s);r.smokes=[{x:s.x,z:s.z+.7,radius:.6,density:1,remaining:10,age:0}];assert.equal(r.grabStudent(),false);
 r.smokes=[];r.throwChalk();const before=r.snapshot().chalks;r.pause();r.step(3);assert.deepEqual(r.snapshot().chalks,before);r.reset();assert.equal(r.snapshot().chalks.length,0);assert.equal(r.snapshot().caughtCount,0);assert.equal(r.teacher.carriedId,null);
});
test('teacher victory requires all five bound, not merely stunned or carried',()=>{
 const r=setup();let index=0;for(const id of r._team){const s=r.students[id];aim(r,s);r._stun(s);r.grabStudent();assert.equal(r.status,'playing');const post=DETENTION[index++];r.player.x=post.x;r.player.z=post.z-1.1;r.setLook(0,0);r.step(.4);assert.ok(r.bindStudent());}r.step(1/60);assert.equal(r.status,'lost');assert.equal(r.snapshot().caughtCount,5);
});
function computer(){const r=new ClassroomRound({map:'computer',seed:7,target:100000});r.start();r.teacher.x=r.teacher.z=30;r._plan.until=Infinity;r._thinkAt=Infinity;for(const s of r.students)if(s.isTeammate)s._decisionAt=Infinity;return r;}
test('PC desktop and study never score; actual snake food earns one and closing preserves drawer stock',()=>{
 const r=computer(),slots=r.snapshot().drawer.slots;r.hold(true);r.step(4);assert.equal(r.score,0);assert.ok(r.startComputer());r.hold(true);r.step(4);assert.equal(r.score,0);assert.equal(r.computerApp('study'),true);r.step(2);assert.equal(r.score,0);assert.equal(r.computerApp('snake'),true);r.step(.65);assert.equal(r.score,1);assert.equal(r.completed.computer,1);assert.deepEqual(r.snapshot().drawer.slots,slots);assert.ok(r.stopComputer());assert.equal(r.snapshot().player.computerActive,false);r.step(4);assert.equal(r.score,1);
});
test('PC gameplay cannot start in a classroom, standing, paused or holding a drawer item',()=>{
 const normal=new ClassroomRound();normal.start();assert.equal(normal.startComputer(),false);const r=computer();r.interact();assert.equal(r.startComputer(),false);r.interact();r.pause();assert.equal(r.startComputer(),false);r.pause(false);r.toggleDrawer();r.takeSlot(0);assert.equal(r.startComputer(),false);
});
test('computer actions never appear as a drawer item and AI can play the PCs',()=>{
 const r=new ClassroomRound({map:'computer',seed:9,target:100000});r.start();r._thinkAt=Infinity;r._plan.until=Infinity;r.teacher.x=r.teacher.z=30;
 for(let i=0;i<20;i++)r.step(1);assert.ok(r.students.some(s=>s.completed.computer>0));assert.ok(r.students.flatMap(s=>s._slots).every(s=>s.action!=='computer'));
});


test('correct binding restores twenty stamina once; holding and dropping do not reveal identity',()=>{
 const r=setup(),s=r.students[[...r._team][0]];r.teacher.stamina=45;aim(r,s);r._stun(s);assert.ok(r.grabStudent());
 assert.equal(r.teacher.stamina,45);assert.ok(r.dropStudent());assert.equal(r.teacher.stamina,45);assert.equal(r.snapshot().caughtCount,0);
 aim(r,s);r._stun(s);r.grabStudent();const post=DETENTION[0];r.player.x=post.x;r.player.z=post.z-1.1;r.setLook(0,0);r.step(.4);const before=r.teacher.stamina;
 assert.ok(r.bindStudent());assert.equal(r.teacher.stamina,before+20);assert.equal(r.bindStudent(),false);assert.equal(r.teacher.stamina,before+20);
 assert.equal(r.drainEvents().filter(e=>e.type==='correct-capture').length,1);
});

test('blackboard writing restores stamina, and releasing, moving or pausing stops it',()=>{
 const r=setup();r.teacher.stamina=20;assert.equal(r.setWriting(true),false);
 Object.assign(r.player,{x:BOARD.x,z:BOARD.z-.35,yaw:0,pitch:0});assert.equal(r.canWriteBoard(),true);assert.ok(r.setWriting(true));r.step(2);
 assert.ok(Math.abs(r.teacher.stamina-40)<.001);assert.equal(r.snapshot().teacher.phase,'board');assert.equal(r.snapshot().teacher.writing,true);
 assert.equal(r.throwChalk(),false);r.setWriting(false);r.step(1);assert.ok(Math.abs(r.teacher.stamina-40)<.001);
 r.setWriting(true);r.setMovement(1,0);r.step(.1);assert.equal(r.teacher.writing,false);r.setMovement(0,0);
 r.setWriting(true);r.pause();const saved=r.teacher.stamina;r.step(5);assert.equal(r.teacher.stamina,saved);assert.equal(r.teacher.writing,false);r.pause(false);r.step(.1);assert.equal(r.teacher.stamina,saved);
 r.teacher.stamina=0;assert.equal(r.throwChalk(),false);assert.ok(r.drainEvents().some(e=>e.type==='stamina-low'));
 r.reset();assert.equal(r.teacher.stamina,100);assert.equal(r.teacher.writing,false);
});

test('blackboard facing accepts full turns without accepting a genuinely sideways view',()=>{
 const r=setup();Object.assign(r.player,{x:BOARD.x,z:BOARD.z-.35,pitch:0});
 for(const turns of [-8,-2,0,2,8]){
   r.player.yaw=turns*Math.PI*2+.4;r.teacher.stamina=20;
   assert.equal(r.canWriteBoard(),true);assert.equal(r.snapshot().writeBoardAvailable,true);assert.equal(r.setWriting(true),true);
   r.step(.1);assert.equal(r.snapshot().teacher.writing,true);assert.ok(Math.abs(r.teacher.stamina-21)<.001);
   r.player.yaw=turns*Math.PI*2+1.1;r.step(1/60);assert.equal(r.canWriteBoard(),false);assert.equal(r.snapshot().teacher.writing,false);
 }
});

test('binding and release snapshots update posts, caught count and stamina without stale aliases',()=>{
 const r=setup(),s=r.students[[...r._team][0]],post=DETENTION[0];aim(r,s);r._stun(s);assert.ok(r.grabStudent());
 Object.assign(r.player,{x:post.x,z:post.z-1.1});r.setLook(0,0);r.step(.4);r.teacher.stamina=95;assert.ok(r.bindStudent());
 const bound=r.snapshot();assert.equal(bound.teacher.stamina,100);assert.equal(bound.teacher.carriedId,null);assert.equal(bound.caughtCount,1);assert.equal(bound.posts[post.id].studentId,s.id);assert.equal(bound.releaseStudent,s.id);
 assert.ok(r.releaseBoundStudent());const released=r.snapshot();assert.equal(released.teacher.stamina,100);assert.equal(released.caughtCount,0);assert.equal(released.posts[post.id].studentId,null);assert.equal(released.releaseStudent,null);
 assert.equal(bound.caughtCount,1);assert.equal(bound.posts[post.id].studentId,s.id);bound.teacher.stamina=-500;assert.equal(r.snapshot().teacher.stamina,100);
 assert.equal(r.releaseBoundStudent(),false);assert.equal(r.bindStudent(),false);assert.equal(r.teacher.stamina,100);
});

test('chalk collision respects crouched students instead of using standing head height',()=>{
 const a={x:1.42,y:1.45,z:2},b={x:1.42,y:1.45,z:0},s={id:99,x:1.42,z:.1,seated:false,crouched:true};
 assert.equal(chalkHit(a,b,[s],[],'classroom'),null);assert.equal(chalkHit(a,b,[{...s,crouched:false}],[],'classroom')?.kind,'student');
});
