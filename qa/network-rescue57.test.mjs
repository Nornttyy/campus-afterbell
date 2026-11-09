import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {CampusRoom} from '../server/room-simulation.js';
import {DETENTION,FRIEND_SEATS} from '../dist/classroom-layout.js';

function pose(sim,rescuer,target){
 const post=DETENTION[0];Object.assign(target,{x:post.x,z:post.z-.3,seated:false,seatId:null,captivity:'bound',caught:true,postId:post.id,_boundAt:0});
 Object.assign(rescuer,{x:post.x,z:post.z-1.1,yaw:0,pitch:0,seated:false,seatId:null,captivity:'free',caught:false});
 for(const actor of sim.students)actor._decisionAt=Infinity;
}
function solo(){const sim=new ClassroomRound({seed:76});sim.start();const rescuer=sim.player,target=sim.students[FRIEND_SEATS[0]];pose(sim,rescuer,target);return{sim,rescuer,target,start:()=>sim.setRescue(target.id),cancel:()=>sim.setRescue(null),tick:()=>sim.step(1/60)};}
function network(){
 const room=new CampusRoom({code:'575757',seed:76}),host=room.join({rolePreference:'teacher'}),student=room.join({}),other=room.join({});room.begin(host);for(let i=0;i<301;i++)room.tick(.1);
 const sim=room.sim,rescuer=student.context.player,target=other.context.player;pose(sim,rescuer,target);
 return{room,student,sim,rescuer,target,start:()=>room.command(student,'setRescue',[target.id]),cancel:()=>room.command(student,'setRescue',[null]),tick:()=>room.tick(1/60)};
}

test('solo and multiplayer both finish a real held rescue at 1.6 seconds, never before it',()=>{
 for(const [name,make]of[['solo',solo],['network',network]]){
  const f=make();assert.equal(f.start(),true,name);
  for(let i=0;i<95;i++)f.tick();assert.equal(f.target.captivity,'bound',`${name} at 95/60 seconds`);
  f.tick();assert.equal(f.target.captivity,'free',`${name} at 96/60 seconds`);assert.equal(f.target.caught,false);
 }
});

test('cancelled rescue progress resets in both modes instead of completing after only the remaining time',()=>{
 for(const [name,make]of[['solo',solo],['network',network]]){
  const f=make();assert.equal(f.start(),true);for(let i=0;i<48;i++)f.tick();f.cancel();for(let i=0;i<12;i++)f.tick();assert.equal(f.target.captivity,'bound');
  assert.equal(f.start(),true);for(let i=0;i<95;i++)f.tick();assert.equal(f.target.captivity,'bound',name);f.tick();assert.equal(f.target.captivity,'free',name);
 }
});

test('disconnect cancels a half-completed rescue; reconnect requires a fresh full hold',()=>{
 const f=network();assert.equal(f.start(),true);for(let i=0;i<48;i++)f.tick();assert.ok(f.student.context._rescueProgress>.49);
 f.room.disconnect(f.student);assert.equal(f.student.context._rescueId,null);assert.equal(f.student.context._rescueProgress,0);
 for(let i=0;i<96;i++)f.tick();assert.equal(f.target.captivity,'bound','an offline player cannot finish the rescue');
 f.room.reconnect(f.student);for(let i=0;i<96;i++)f.tick();assert.equal(f.target.captivity,'bound','reconnection alone must not resume the old hold');
 assert.equal(f.start(),true);for(let i=0;i<95;i++)f.tick();assert.equal(f.target.captivity,'bound');f.tick();assert.equal(f.target.captivity,'free');
});
