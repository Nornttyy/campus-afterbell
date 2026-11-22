import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoloRound} from '../dist/solo-round.js';
import {createCampusServer} from '../server/server.js';
import {connectCampusRoom} from '../dist/network-client.js';
import {CampusRoom} from '../dist/room-simulation.js';
import {actorFloorHeight,floorHeight} from '../dist/classroom-layout.js';
import {JUMP_SPEED,stepJump} from '../dist/actor-jump90.js';

for(const role of ['student','teacher']){
 test(role+' leaves the floor once, falls back to the same support, and respects restricted poses',()=>{
  const r=createSoloRound({role,map:'tiered',seed:90});r.start({gathering:true});const p=r.player;
  Object.assign(p,{x:0,z:-7,seated:false,crouched:false,captivity:'free',caught:false});
  const start=actorFloorHeight(p,r.map);assert.ok(start>0);
  assert.equal(r.jump(),true);assert.equal(r.jump(),false);
  for(let i=0;i<15;i++)r.step(1/60);
  const apex=r.snapshot().player.jumpHeight;assert.ok(apex>.60&&apex<.64,String(apex));assert.equal(r.jump(),false);
  assert.ok(Math.abs(actorFloorHeight(p,r.map)-start-apex)<.002);
  if(role==='teacher'){
   assert.equal(r.throwChalk(),true);const here=r.chalks.at(-1).y;
   const grounded=createSoloRound({role,map:'tiered',seed:90});grounded.start({gathering:true});Object.assign(grounded.player,{x:p.x,z:p.z,seated:false});
   assert.equal(grounded.throwChalk(),true);assert.ok(Math.abs(here-grounded.chalks.at(-1).y-apex)<.002);
  }
  for(let i=0;i<30;i++)r.step(1/60);
  assert.equal(p.jumpSpeed,undefined);assert.equal(actorFloorHeight(p,r.map),floorHeight(p.x,p.z,r.map));
  for(const [key,value] of [['seated',true],['crouched',true],['captivity','bound'],['stunLeft',1],['mapActivity',{kind:'bed'}]]){
   const old=p[key];p[key]=value;assert.equal(r.jump(),false,key);p[key]=old;
  }
  r.pause(true);assert.equal(r.jump(),false);
 });
}
test('a low lintel clips ascent at impact time, including large frames',()=>{
 const a={y:0,speed:JUMP_SPEED},b={...a};stepJump(a,.2,0,.29);
 for(let i=0;i<12;i++)stepJump(b,1/60,0,.29);
 assert.ok(a.y>0&&a.y<.29&&a.speed<0);assert.ok(Math.abs(a.y-b.y)<1e-8);
});
test('room owns student and teacher jump heights, acknowledges repeated input and shares both with another player',()=>{
 const room=new CampusRoom({code:'909090',seed:90}),teacher=room.join({rolePreference:'teacher'}),student=room.join({}),peer=room.join({});room.begin(teacher);
 Object.assign(student.context.player,{x:9,z:0,seated:false,crouched:false});
 assert.equal(room.command(student,'jump',[],7),true);assert.equal(room.command(teacher,'jump',[],8),true);
 assert.equal(room.command(student,'jump',[],9),false);
 assert.throws(()=>room.command(peer,'jump',[4]));
 for(let i=0;i<6;i++)room.tick(1/30);
 const view=room.snapshot(peer);
 assert.ok(view.students.find(s=>s.id===student.studentId).jumpHeight>.53);assert.ok(view.teacher.jumpHeight>.53);
 assert.equal(room.snapshot(student).inputAck.jump,9);assert.equal(room.snapshot(teacher).inputAck.jump,8);
 for(let i=0;i<16;i++)room.tick(1/30);
 assert.equal(room.snapshot(student).player.jumpSpeed,undefined);assert.equal(room.snapshot(peer).teacher.jumpSpeed,undefined);
 assert.equal(room.command(student,'jump',[],7),false,'a delayed retry after landing must not launch again');
});

test('two connected HTTP clients see each other take off and land using the live state stream',async()=>{
 const runtime=createCampusServer();await new Promise(resolve=>runtime.server.listen(0,'127.0.0.1',resolve));
 const endpoint='http://127.0.0.1:'+runtime.server.address().port;let teacher,student;
 async function until(check){
  const deadline=performance.now()+5000;
  while(!check()){if(performance.now()>deadline)assert.fail('timed out waiting for the live room');await new Promise(resolve=>setTimeout(resolve,10));}
 }
 try{
  teacher=await connectCampusRoom({endpoint,rolePreference:'teacher'});student=await connectCampusRoom({endpoint,code:teacher.room.code});
  await until(()=>teacher._connected&&student._connected);assert.equal(teacher.startBell(),true);
  await until(()=>teacher.snapshot().role==='teacher'&&student.snapshot().stage==='seating');
  const id=student.player.id;assert.equal(student.jump(),true);assert.equal(teacher.jump(),true);
  assert.equal(student.jump(),false);
  await until(()=>teacher.snapshot().students.find(s=>s.id===id)?.jumpHeight>.25&&student.snapshot().teacher.jumpHeight>.25);
  await until(()=>teacher._state.inputAck.jump>0&&student._state.inputAck.jump>0&&
   !student._pendingJump&&!teacher._pendingJump&&!(student.snapshot().teacher.jumpHeight>.001)&&
   !(teacher.snapshot().students.find(s=>s.id===id)?.jumpHeight>.001));
  assert.equal(teacher.player.jumpSpeed,undefined);assert.equal(student.player.jumpSpeed,undefined);
 }finally{await Promise.all([teacher?.leave(),student?.leave()]);await runtime.close();}
});
