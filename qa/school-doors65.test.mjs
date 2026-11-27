import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {createLayoutContext,queueLayoutDoors,advanceLayoutDoors,layoutDoorSnapshot,updateLayoutDoors,DOORS,OFFICE,START_BELL_POSITION,clearWallSegment,moveInRoom,blocked} from '../dist/classroom-layout.js';
import {createSchoolDoorMotion,setSchoolDoorTargets,advanceSchoolDoors,schoolDoorSegments} from '../dist/school-door-motion65.js';
import {reachesSchoolDoor} from '../dist/door-interaction54.js';
import {interactionIntent} from '../dist/interaction-intent54.js';
const geometry={doors:DOORS,office:OFFICE};

test('break starts with all school doors physically closed and forbids manual operation',()=>{
 for(const Round of [ClassroomRound,TeacherRound]){
  const r=new Round();r.start({gathering:true});
  for(const id of ['rear','front','office']){
   assert.equal(r.layout.doorMotion[id].amount,0);
   assert.equal(r.setSchoolDoor(id,false),false);
   assert.equal(r.setSchoolDoor(id,true),false);
  }
  r.step(2);assert.ok(Object.values(r.layout.doorMotion).every(d=>d.amount===0));
 }
});

test('door motion is frame-rate independent and reverses from current pose',()=>{
 const results=[];for(const fps of[20,30,60,144]){const motion=createSchoolDoorMotion();setSchoolDoorTargets(motion,{front:true,rear:true,office:true});for(let i=0;i<fps/2;i++)advanceSchoolDoors(motion,1/fps);results.push(motion.front.amount);setSchoolDoorTargets(motion,{front:false});const previous=motion.front.amount;advanceSchoolDoors(motion,1/fps);assert.ok(motion.front.amount>previous&&motion.front.amount<1);}
 assert.ok(Math.max(...results)-Math.min(...results)<1e-12);
});

test('collision follows the same halfway leaf and closed openings cannot be crossed',()=>{
 const ctx=createLayoutContext();queueLayoutDoors(ctx,{rearDoorClosed:true,frontDoorClosed:true,officeDoorClosed:true});advanceLayoutDoors(ctx,.10,[]);const state=layoutDoorSnapshot(ctx),replica=createLayoutContext();updateLayoutDoors(replica,{doorMotion:state});assert.deepEqual(ctx.walls,replica.walls);
 const expected=schoolDoorSegments('front',state.front.amount,geometry);assert.deepEqual(ctx.walls.filter(s=>s.doorId==='front'),expected);
 for(const leaf of expected){const x=(leaf.minX+leaf.maxX)/2,z=(leaf.minZ+leaf.maxZ)/2;assert.equal(blocked(x,z,.02,ctx),true);}
 advanceLayoutDoors(ctx,2,[]);
 for(const id of['rear','front']){const d=DOORS.find(d=>d.id===id),p={x:6.8,z:d.center};assert.equal(clearWallSegment(p,{x:9,z:d.center},ctx),false);assert.ok(moveInRoom(p,3,0,.18,ctx).x<7.2);}
 assert.equal(clearWallSegment({x:OFFICE.doorX,z:OFFICE.doorZ+1},{x:OFFICE.doorX,z:OFFICE.doorZ-1},ctx),false);
});

test('moving door waits for an actor entering its next swept segment, then continues',()=>{
 const ctx=createLayoutContext();queueLayoutDoors(ctx,{rearDoorClosed:true});const actor={x:8.45,z:-7.32,visible:true},original={...actor};advanceLayoutDoors(ctx,.10,[actor]);assert.equal(ctx.doorMotion.rear.amount,1);assert.equal(ctx.doorMotion.rear.blocked,true);assert.deepEqual(actor,original,'never teleport a trapped player');advanceLayoutDoors(ctx,2,[]);assert.equal(ctx.doorMotion.rear.amount,0);assert.equal(ctx.doorMotion.rear.blocked,false);
});

test('the bell opens both classroom entrances and releases the office after the countdown',()=>{
 const r=new ClassroomRound();r.start({gathering:true});
 Object.assign(r.player,{x:START_BELL_POSITION.x+1.17,z:START_BELL_POSITION.z+.35,yaw:Math.atan2(-1.17,-.35)});
 assert.equal(r.startBell(),true);r.step(.1);
 for(const id of ['front','rear']){assert.ok(r.layout.doorMotion[id].amount>0&&r.layout.doorMotion[id].amount<1);assert.equal(r.setSchoolDoor(id,true),false);}
 assert.equal(r.layout.doorMotion.office.amount,0);assert.equal(r.layout.officeLocked,true);assert.equal(r.setSchoolDoor('office',false),false);
 r.step(30);assert.equal(r.layout.officeLocked,false);assert.equal(r.layout.doorMotion.office.target,1);
 r.step(2);assert.equal(r.layout.doorMotion.office.amount,1);assert.equal(r.setSchoolDoor('office',true),false);
 for(const key of ['E','Q'])assert.equal(interactionIntent(r.snapshot(),{kind:'rear-door',doorId:'office'},key),null);
});

test('two room members see the same eased opening and cannot close classroom or office manually',async()=>{
 const {CampusRoom}=await import('../server/room-simulation.js');
 const room=new CampusRoom({code:'650065',seed:73}),a=room.join({rolePreference:'teacher'}),b=room.join();
 room.begin(a);for(let i=0;i<310;i++)room.tick(.1);
 updateLayoutDoors(room.sim.layout,{frontDoorClosed:true});
 Object.assign(b.context.player,{x:6.2,z:7,yaw:Math.PI/2,seated:false});
 assert.equal(reachesSchoolDoor(b.context.player,room.sim.layout,'front'),true);
 assert.equal(room.command(b,'setDoorUse',[true,false,'front']),true);
 for(let i=0;i<21;i++)room.tick(.1);
 const leaf=room.snapshot(b).doorMotion.front;
 assert.equal(leaf.target,1);assert.ok(leaf.amount>0&&leaf.amount<1);
 assert.deepEqual(room.snapshot(a).doorMotion,room.snapshot(b).doorMotion);
 for(let i=0;i<20;i++)room.tick(.1);
 assert.equal(room.snapshot(a).doorMotion.front.amount,1);
 for(const id of ['front','office'])assert.equal(room.command(a,'setDoorUse',[true,true,id]),false);
 assert.equal(room.elevator.phase,'idle');
});
