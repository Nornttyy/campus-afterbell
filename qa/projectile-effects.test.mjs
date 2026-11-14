import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound,CLASSROOM_ACTIONS} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {CORRIDOR,BOARD,DOORS} from '../dist/classroom-layout.js';
import {createThrowableProjectile,stepThrowableProjectile,flashExposure,inkExposure,effectEye} from '../dist/projectile-effects-rules.js';

const DT=1/60;
function quiet(){
 const r=new ClassroomRound({target:100000});r.start();r.teacher.x=r.teacher.z=30;r._thinkAt=Infinity;r._plan.until=Infinity;
 for(const s of r.students)if(s.isTeammate)s._decisionAt=Infinity;
 return r;
}
function take(r,kind){Object.assign(r.player._slots[0],{action:kind,progress:0,readyAt:0});r.toggleDrawer();assert.equal(r.takeSlot(0),true);}
function projectile(kind,values={}){return Object.assign(createThrowableProjectile({id:0,x:1.42,z:0,yaw:0,pitch:0,seated:false},1,kind,.5),values);}

test('flash and ink are drawer items used on deliberate release, and pause cancels charge without consumption',()=>{
 const drawn=new Set();for(let seed=0;seed<80;seed++)for(const s of new ClassroomRound({seed}).player._slots)drawn.add(s.action);
 assert.ok(drawn.has('flash')&&drawn.has('ink'));assert.equal(drawn.has('computer'),false);
 for(const kind of ['flash','ink']){
  assert.equal(CLASSROOM_ACTIONS[kind].releaseToUse,true);
  const r=quiet();take(r,kind);r.hold(true);r.step(.6);assert.ok(Math.abs(r.player.progress-.3)<1e-6);assert.equal(r.projectiles.length,0);
  r.pause();assert.equal(r.player._slots[0].action,kind);assert.equal(r.player.progress,0);assert.equal(r.releaseUse(),false);r.pause(false);
  r.hold(true);assert.equal(r.releaseUse(),true);assert.equal(r.projectiles.length,1);assert.equal(r.projectiles[0].kind,kind);assert.equal(r.projectiles[0].charge,0);
  assert.equal(r.completed[kind],1);assert.equal(r.score,0);assert.equal(r.releaseUse(),false);assert.equal(r.player._slots[0].action,null);
  r.step(3);assert.ok(r.player._slots[0].action);assert.equal(r.completed[kind],1);
 }
});

test('throw animation time survives first-frame ink shattering, freezes with pause, and resets independently of projectile lifetime',()=>{
 const r=quiet();assert.equal(r.snapshot().player.itemThrowAge,999);take(r,'ink');r.interact();Object.assign(r.player,{x:CORRIDOR.maxX-.085,z:0,yaw:Math.PI/2});r.hold(true);r.releaseUse();
 assert.equal(r.snapshot().player.itemThrowAge,0);r.step(DT);assert.equal(r.projectiles.length,0);assert.equal(r.drainEvents().filter(e=>e.type==='ink-splash').length,1);
 assert.ok(r.snapshot().player.itemThrowAge<.02);r.step(.1);const age=r.snapshot().player.itemThrowAge;assert.ok(age>.1&&age<.2);
 r.pause();r.step(2);assert.equal(r.snapshot().player.itemThrowAge,age);r.pause(false);
 const peer=r.students.find(s=>s.isTeammate);r._throwProjectile(peer,'flash',.6);assert.equal(r.snapshot().students[peer.id].itemThrowAge,0);
 r.step(.1);assert.equal(r.snapshot().students[peer.id].itemThrowAge,.1);r.reset();assert.equal(r.snapshot().player.itemThrowAge,999);assert.ok(r.snapshot().students.every(s=>s.itemThrowAge===999));
});

test('flash follows gravity then bursts once at the local 1.2-second fuse rather than waiting for floor contact',()=>{
 const p=projectile('flash'),start={y:p.y,vy:p.vy};let result=stepThrowableProjectile(p,.1,[]);
 assert.equal(result.effect,null);assert.ok(Math.abs(p.y-(start.y+start.vy*.1-.5*9.8*.01))<1e-8);
 result=stepThrowableProjectile(p,1.09,[]);assert.equal(result.effect,null);result=stepThrowableProjectile(p,.01,[]);
 assert.equal(result.effect.kind,'flash');assert.ok(Math.abs(p.age-1.2)<1e-8);assert.equal(p.retired,true);assert.equal(stepThrowableProjectile(p,1,[]).effect,null);
});

test('flash exposure respects range, head direction, wall occlusion and open doorways',()=>{
 const actor={id:8,x:1.42,z:0,yaw:0,seated:false},origin={x:1.42,y:1.65,z:2};
 const forward=flashExposure(origin,actor),backward=flashExposure(origin,{...actor,yaw:Math.PI});assert.ok(forward>.7);assert.ok(backward>0&&backward<forward*.3);
 assert.equal(flashExposure({...origin,z:9},actor),0);
 assert.equal(flashExposure({x:6.7,y:1.65,z:0},{...actor,x:8.1,z:0,yaw:-Math.PI/2}),0);
 assert.ok(flashExposure({x:6.7,y:1.65,z:DOORS[1].center},{...actor,x:8.1,z:DOORS[1].center,yaw:-Math.PI/2})>0);
 assert.ok(flashExposure({x:1.42,y:2.8,z:0},{...actor,pitch:-1.2})>flashExposure({x:1.42,y:2.8,z:0},{...actor,pitch:1.2}));
});

test('ink shatters on swept character contact or first solid impact, without bouncing or blooming smoke',()=>{
 const actor={id:8,x:1.42,z:.5,seated:false};
 const hit=projectile('ink',{x:1.42,y:1.5,z:0,vx:0,vy:0,vz:20});const contact=stepThrowableProjectile(hit,.05,[actor]);
 assert.equal(contact.effect.kind,'ink');assert.equal(contact.effect.hitActorId,8);assert.ok(contact.effect.z<actor.z);assert.equal(hit.retired,true);
 for(const values of [{x:7.12,y:1.5,z:0,vx:20,vy:0,vz:0},{x:1.42,y:.08,z:0,vx:0,vy:-2,vz:0}]){
  const p=projectile('ink',values),solid=stepThrowableProjectile(p,.05,[]);assert.equal(solid.effect.kind,'ink');assert.equal(solid.effect.hitActorId,null);assert.equal(p.retired,true);assert.equal(p.emitting,false);
  assert.equal(stepThrowableProjectile(p,.5,[]).effect,null);
 }
 const owner={id:0,x:1.42,z:.5,seated:false},p=projectile('ink',{x:1.42,y:1.5,z:0,vx:0,vy:0,vz:20});assert.equal(stepThrowableProjectile(p,.05,[owner]).effect,null);
});

test('ink affects nearby clear views but cannot splash through classroom walls',()=>{
 const actor={id:8,x:1.42,z:0,seated:false};assert.equal(inkExposure({x:1.42,y:1.4,z:1},actor),true);assert.equal(inkExposure({x:1.42,y:1.4,z:3},actor),false);
 assert.equal(inkExposure({x:6.9,y:1.4,z:0},{...actor,x:7.7}),false);
});

test('both students and teachers receive visual effects; state expires with simulation time and does not lock controls',()=>{
 for(const Round of [ClassroomRound,TeacherRound]){
  const r=new Round({target:100000});r.start();for(const s of r.students)s._decisionAt=Infinity;
  if(Round===ClassroomRound){r._thinkAt=Infinity;r._plan.until=Infinity;r.teacher.x=r.teacher.z=30;r.interact();}
  Object.assign(r.player,{x:1.42,z:0,yaw:0,pitch:0});if(Round===TeacherRound)Object.assign(r.teacher,r.player);
  const origin={x:1.42,y:Round===TeacherRound?1.95:1.65,z:1};
  r._applyProjectileEffect({id:3,ownerId:2},{kind:'flash',...origin});r._applyProjectileEffect({id:4,ownerId:2},{kind:'ink',...origin});
  let s=r.snapshot();assert.ok(s.player.flashStrength>0&&s.player.flashLeft>0);assert.equal(s.player.inkLeft,7);assert.equal(s.player.inkDuration,7);
  const events=r.drainEvents();assert.ok(events.find(e=>e.type==='flash-burst').affected.includes(r.player.id));assert.ok(events.find(e=>e.type==='ink-splash').affected.includes(r.player.id));
  assert.equal(r.setMovement(0,1),true);r.step(.2);assert.ok(r.player.z>.1);assert.equal(r.player.captivity,'free');r.setMovement(0,0);
  r.pause();const paused=r.snapshot().player;r.step(20);assert.deepEqual(r.snapshot().player,paused);r.pause(false);r.step(7);
  s=r.snapshot();assert.equal(s.player.flashLeft,0);assert.equal(s.player.flashStrength,0);assert.equal(s.player.inkLeft,0);
 }
});

test('an ink-covered human teacher can write and throw; the effect is not a stun',()=>{
 const r=new TeacherRound({target:100000});r.start();for(const s of r.students)s._decisionAt=Infinity;
 Object.assign(r.player,{x:BOARD.x,z:BOARD.z,yaw:0,pitch:0});Object.assign(r.teacher,{...r.player,stamina:30});
 r._applyProjectileEffect({id:1,ownerId:2},{kind:'ink',...effectEye(r.teacher)});
 assert.equal(r.snapshot().player.inkLeft,7);assert.equal(r.setWriting(true),true);r.step(1);assert.ok(r.teacher.stamina>39);assert.equal(r.snapshot().teacher.writing,true);
 r.setWriting(false);assert.equal(r.throwChalk(),true);assert.equal(r.snapshot().player.inkLeft,6);
});

test('obscured AI cannot gain visual evidence or throw precise chalk, but still follows its remembered route',()=>{
 const r=quiet(),actor=r.player;Object.assign(actor,{x:1.42,z:0,seated:false});Object.assign(r.teacher,{x:1.42,z:2,yaw:Math.PI,warning:false});
 actor._drawnSlot=0;actor.action='phone';actor.holding=true;
 const memory=r._remember(actor);memory.confirmed=true;memory.evidence=100;memory.x=actor.x;memory.z=actor.z;
 r._plan={intent:'catch',targetId:actor.id,since:0,until:100,route:[{x:1.42,z:1.7}],routeLength:.3,arrivedAt:null,utility:1000};r._turnLeft=0;
 r._cast={id:actor.id,time:.69,aim:{x:actor.x,y:1.5,z:actor.z}};r.teacher._inkUntil=7;
 const before=r.teacher.z;r._advanceTeacher(DT);assert.ok(r.teacher.z<before);assert.equal(r._cast,null);assert.equal(r.chalks.length,0);
 r._memory.clear();r._perceive(1);assert.equal(r._memory.size,0);assert.equal(r.teacher.looking,false);assert.equal(r.teacher.attention,0);
 actor.captivity='stunned';assert.equal(r._advanceStunChase(1),false);assert.equal(r.teacher.carriedId,null);
});
