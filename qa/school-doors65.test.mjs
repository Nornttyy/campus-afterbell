import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {createLayoutContext,queueLayoutDoors,advanceLayoutDoors,layoutDoorSnapshot,updateLayoutDoors,DOORS,OFFICE,clearWallSegment,moveInRoom,blocked} from '../dist/classroom-layout.js';
import {createSchoolDoorMotion,setSchoolDoorTargets,advanceSchoolDoors,schoolDoorSegments} from '../dist/school-door-motion65.js';
import {reachesSchoolDoor} from '../dist/door-interaction54.js';
import {interactionIntent} from '../dist/interaction-intent54.js';
const geometry={doors:DOORS,office:OFFICE};

test('all school doors default closed in break, but front/rear/office remain individually operable',()=>{
 for(const Round of[ClassroomRound,TeacherRound]){
  const r=new Round();r.start({gathering:true});r.step(2);
  for(const id of['rear','front','office'])assert.equal(r.layout.doorMotion[id].amount,0);
  assert.equal(r.layout.officeLocked,false);
  const start=layoutDoorSnapshot(r.layout);assert.equal(r.setSchoolDoor('front',false),true);assert.deepEqual(layoutDoorSnapshot(r.layout).rear,start.rear);assert.equal(r.layout.doorMotion.front.amount,0,'command cannot instantly jump the leaf');r.step(.10);assert.ok(r.layout.doorMotion.front.amount>0&&r.layout.doorMotion.front.amount<1);r.step(2);assert.equal(r.layout.doorMotion.front.amount,1);assert.equal(r.layout.doorMotion.rear.amount,0);assert.equal(r.setSchoolDoor('office',false),true);r.step(2);assert.equal(r.layout.doorMotion.office.amount,1);
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
 assert.equal(clearWallSegment({x:9.2,z:8},{x:9.2,z:10},ctx),false);
});

test('moving door waits for an actor entering its next swept segment, then continues',()=>{
 const ctx=createLayoutContext();queueLayoutDoors(ctx,{rearDoorClosed:true});const actor={x:8.45,z:-7.32,visible:true},original={...actor};advanceLayoutDoors(ctx,.10,[actor]);assert.equal(ctx.doorMotion.rear.amount,1);assert.equal(ctx.doorMotion.rear.blocked,true);assert.deepEqual(actor,original,'never teleport a trapped player');advanceLayoutDoors(ctx,2,[]);assert.equal(ctx.doorMotion.rear.amount,0);assert.equal(ctx.doorMotion.rear.blocked,false);
});

test('front and office use actual aiming and E/Q commands, office lock only applies during seating',()=>{
 const r=new ClassroomRound();r.start({gathering:true});r.step(2);for(const [id,p]of[['front',{x:6.2,z:7,yaw:Math.PI/2}],['office',{x:9.2,z:7.3,yaw:0}]]){Object.assign(r.player,p);assert.equal(reachesSchoolDoor(r.player,r.layout,id),true);const intent=interactionIntent(r.snapshot(),{kind:'rear-door',doorId:id},'E');assert.deepEqual(intent.args,[true,false,id]);assert.equal(r.setDoorUse(...intent.args),true);r.step(3);assert.equal(r.layout.doorMotion[id].target,1);r.step(2);const close=interactionIntent(r.snapshot(),{kind:'rear-door',doorId:id},'Q');assert.deepEqual(close.args,[true,true,id]);}
 Object.assign(r.player,{x:8.6,z:3.5,yaw:Math.atan2(7.43-8.6,3.15-3.5)});assert.equal(r.startBell(),true);assert.equal(r.layout.officeLocked,true);assert.equal(r.setSchoolDoor('office',false),false);r.step(30);assert.equal(r.layout.officeLocked,false);assert.equal(r.layout.doorMotion.office.target,1);
});

test('two authenticated room members share front and office opening, independent from the lift',async()=>{
 const {CampusRoom}=await import('../server/room-simulation.js');const room=new CampusRoom({code:'650065',seed:73}),a=room.join({name:'甲'}),b=room.join({name:'乙'});for(let i=0;i<20;i++)room.tick(.1);
 for(const [id,p]of[['front',{x:6.2,z:7,yaw:Math.PI/2}],['office',{x:9.2,z:7.3,yaw:0}]]){
  Object.assign(a.context.player,p,{seated:false});Object.assign(b.context.player,{x:11.5,z:2,seated:false});
  assert.equal(room.command(a,'setDoorUse',[true,false,id]),true);for(let i=0;i<21;i++)room.tick(.1);
  assert.equal(room.snapshot(a).doorMotion[id].target,1);assert.deepEqual(room.snapshot(a).doorMotion,room.snapshot(b).doorMotion);
  const before=room.snapshot(a).doorMotion[id].amount;room.tick(.1);const after=room.snapshot(a).doorMotion[id].amount;assert.ok(after>before&&after<1);assert.deepEqual(room.snapshot(a).doorMotion,room.snapshot(b).doorMotion);
  for(let i=0;i<20;i++)room.tick(.1);assert.equal(room.snapshot(b).doorMotion[id].amount,1);assert.equal(room.elevator.phase,'idle');assert.equal(room.sim.layout.elevatorClosed,false);
 }
});
