import test from 'node:test';
import assert from 'node:assert/strict';
import {CampusRoom} from '../server/room-simulation.js';
import {createCampusServer} from '../server/server.js';
import {LAYOUT_PATTERNS,DETENTION} from '../dist/classroom-layout.js';

function census(room){
 const capacity=room.sim.seats.length,actors=room.sim.students,students=[...room.members.values()].filter(m=>m.role==='student');
 const humans=students.filter(m=>m.connected),offline=students.filter(m=>!m.connected),retired=actors.filter(a=>a._networkDeparted),ai=actors.filter(a=>!a.networkHuman);
 assert.equal(actors.length,capacity);assert.equal(new Set(actors.map(a=>a.id)).size,capacity);
 assert.equal(humans.length+offline.length+retired.length+ai.length,capacity,'human, retained offline and ordinary AI slots fill the seat capacity');
 for(const member of students){assert.equal(member.context.player,actors[member.studentId]);assert.equal(member.context.player.networkHuman,true);assert.equal(room.sim._team.has(member.studentId),true);}
 for(const actor of ai){assert.equal(actor.isTeammate,false);assert.equal(actor._profile,null);assert.equal(actor._slots.length,0);assert.equal(room.sim._team.has(actor.id),false);}
 for(const actor of retired)assert.equal(room.sim._team.has(actor.id),false);
 const seated=actors.filter(a=>a.seated&&a.seatId>=0);assert.equal(new Set(seated.map(a=>a.seatId)).size,seated.length,'no two students occupy one seat');
 return{capacity,humans,offline,retired,ai};
}
function fixture(count=3,seed=76){const room=new CampusRoom({code:'575757',seed});const people=Array.from({length:count},(_,i)=>room.join({name:`玩家${i}`,character:'ponytail',rolePreference:i===0?'teacher':'student'}));return{room,people};}
function beginClass(room,host){room.begin(host);for(let i=0;i<301;i++)room.tick(.1);assert.equal(room.sim.stage,'class');}

for(const [index,pattern]of LAYOUT_PATTERNS.entries())test(`${pattern}: 1–8 humans replace ordinary AI within the actual 20/30-seat capacity`,()=>{
 for(let count=1;count<=8;count++){
  const {room,people}=fixture(count,72+index);assert.equal(room.sim.seats[0].pattern,pattern);assert.equal(room.sim.seats.length,pattern.startsWith('rows-')?20:30);
  assert.equal(census(room).ai.length,room.sim.seats.length-count);
  assert.throws(()=>{while(room.members.size<8)room.join({});room.join({});},/房间已满/);
  // Use a fresh room so the capacity-limit check does not change this roster.
  const current=fixture(count,72+index),r=current.room;
  if(count===1){assert.throws(()=>r.begin(current.people[0]),/两位/);continue;}
  r.begin(current.people[0]);const tally=census(r);assert.equal(tally.humans.length,count-1);assert.equal(tally.ai.length,tally.capacity-(count-1));assert.equal(r.teacherActor.id,-1);
  const formerStudent=r.sim.students[r.teacherMember.studentId];assert.equal(formerStudent.networkHuman,false);assert.equal(formerStudent.name,'同学');assert.equal(formerStudent.character,undefined,'teacher promotion restores the original AI identity');
  assert.equal(r.sim._seatingRoutes.size,tally.ai.length,'only the remaining ordinary AI join the arrival queue');
  const state=r.snapshot(current.people.find(p=>p.role==='student'));assert.equal(state.students.length,tally.capacity);assert.equal(state.teamSize,count-1);
 }
});

test('teacher random selection works for each possible volunteer without consuming a student slot',()=>{
 for(let chosen=0;chosen<6;chosen++){
  const {room,people}=fixture(6);for(const member of people)room.preference(member,{rolePreference:'teacher'});
  room.sim._random=()=>((chosen+.1)/people.length);room.begin(people[0]);assert.equal(room.teacherMember,people[chosen]);assert.equal(census(room).ai.length,15);
 }
});

test('lobby departure restores a clean AI slot and a later join reuses it once',()=>{
 const {room,people}=fixture(),leaving=people[1],id=leaving.studentId;room.leave(leaving);assert.equal(room.sim.students[id].name,'同学');assert.equal(room.sim.students[id].visible,false);census(room);
 const incoming=room.join({name:'后来者',character:'girl'});assert.equal(incoming.studentId,id);assert.equal(incoming.context.player.name,'后来者');assert.equal(incoming.context.player.character,'girl');census(room);
});

test('a student disconnected before the bell retains the same reserved actor and team on reconnect',()=>{
 const {room,people}=fixture(),guest=people[2],actor=guest.context.player;room.disconnect(guest);room.begin(people[0]);assert.equal(census(room).offline.length,1);
 room.reconnect(guest);assert.equal(guest.context.player,actor);assert.equal(room.sim._team.has(guest.studentId),true);assert.equal(census(room).humans.length,2);
});

test('the start bell counts online members and agrees with the authoritative minimum-player check',()=>{
 const {room,people}=fixture(1),host=people[0];assert.equal(room.snapshot(host).startBellAvailable,false);
 const second=room.join({});assert.equal(room.snapshot(host).startBellAvailable,true);room.disconnect(second);assert.equal(room.snapshot(host).startBellAvailable,false);assert.throws(()=>room.begin(host),/两位/);
 const third=room.join({});assert.equal(room.snapshot(host).startBellAvailable,true);room.disconnect(third);assert.equal(room.snapshot(host).startBellAvailable,false);
 room.reconnect(second);assert.equal(room.snapshot(host).startBellAvailable,true);assert.equal(room.begin(host),true);assert.equal(room.snapshot(host).startBellAvailable,false);
});

test('class departure preserves a bound body without creating a new AI or blocking the remaining capture outcome',()=>{
 const {room,people}=fixture(),left=people[1],remaining=people[2];beginClass(room,people[0]);const actor=left.context.player;
 Object.assign(actor,{captivity:'bound',caught:true,postId:0,seated:false,seatId:null,x:7,z:1});room.disconnect(left);census(room);room.reconnect(left);assert.equal(left.context.player,actor);assert.equal(actor.captivity,'bound');
 room.leave(left);assert.equal(room.sim.students[left.studentId],actor);assert.equal(actor.networkHuman,true,'departed humans must not start AI behavior mid-class');assert.equal(actor._networkDeparted,true);assert.equal(actor.captivity,'bound');assert.equal(actor.postId,0);assert.equal(actor.x,7);assert.equal(census(room).retired.length,1);
 Object.assign(remaining.context.player,{captivity:'bound',caught:true});room.sim._pendingAllCaught=true;room.tick(.1);assert.equal(room.sim.status,'lost');assert.equal(room.sim.resultReason,'all-caught');
 const host=room.teacherMember;room.rematch(host);const tally=census(room);assert.equal(tally.retired.length,0);assert.equal(tally.humans.length,2);assert.equal(tally.ai.length,tally.capacity-2);assert.equal(room.sim.students[left.studentId].captivity,'free');
});

test('a departing uncaptured student cannot leave a finished capture condition pending forever',()=>{
 const {room,people}=fixture();beginClass(room,people[0]);Object.assign(people[1].context.player,{captivity:'bound',caught:true});room.leave(people[2]);room.tick(.1);assert.equal(room.sim.status,'lost');assert.equal(room.sim.resultReason,'all-caught');
 const next=fixture(2);next.room.begin(next.people[0]);next.room.leave(next.people[1]);assert.equal(next.room.sim.status,'lost','no remaining student must not stall the preparation round');
});

test('changing maps and rematching repartitions capacities while retaining members only once',()=>{
 const {room,people}=fixture(8,75);room._rebuild('computer7',76);assert.equal(census(room).capacity,20);assert.equal(room.sim._team.size,8);room.begin(people[0]);census(room);
 room.sim._finish('won','mischief');room.rematch(people[0]);census(room);assert.equal(room.sim._team.size,8);room.begin(people[0]);census(room);
 room.sim._finish('won','mischief');room.rematch(people[0]);assert.equal(census(room).capacity,30);room.begin(people[0]);assert.equal(census(room).ai.length,23);
});

test('human seating before AI arrival makes the arriving AI choose a free seat',()=>{
 const {room,people}=fixture(3,76);room.begin(people[0]);const human=people[1].context.player,ai=room.sim.students.find(a=>!a.networkHuman&&a.id!==room.teacherMember.studentId),seat=room.sim.seats[ai.id];
 Object.assign(human,{x:seat.x,z:seat.z,seated:false,seatId:null});assert.equal(room.command(people[1],'interact',[seat.id]),'seated');
 for(let i=0;i<800;i++)room.tick(.1);
 census(room);assert.equal(human.seatId,seat.id);assert.notEqual(ai.seatId,human.seatId);assert.equal(room.sim.score,0,'ordinary AI do not become extra mischievous teammates');
});

test('released AI return to a free chair instead of sitting inside the human who took their old chair',()=>{
 const {room,people}=fixture(3,76);beginClass(room,people[0]);const ai=room.sim.students.find(a=>!a.networkHuman&&a.seated),human=people[1].context.player,seat=room.sim.seats[ai.seatId];
 const originalHome=ai.id;Object.assign(ai,{seated:false,seatId:null,captivity:'bound',caught:true,postId:DETENTION[0].id,x:DETENTION[0].x,z:DETENTION[0].z-.3});
 Object.assign(human,{x:seat.x,z:seat.z,seated:false,seatId:null});assert.equal(room.command(people[1],'interact',[seat.id]),'seated');
 room.sim._release(ai);for(let i=0;i<800&&!ai.seated;i++){room.tick(.1);census(room);}
 assert.equal(ai.seated,true);assert.equal(human.seatId,seat.id);assert.notEqual(ai.seatId,human.seatId);assert.equal(ai.id,originalHome,'reassignment never creates or renumbers an actor');
});

test('the server preserves the 60-second reconnect lease, then retires that slot until the next round',async()=>{
 const {room,people}=fixture(),guest=people[1];beginClass(room,people[0]);const actor=guest.context.player;
 const runtime=createCampusServer({rooms:new Map([[room.code,room]])});
 try{
  room.disconnect(guest);guest.lastSeen=Date.now()-59000;await new Promise(r=>setTimeout(r,45));assert.equal(room.findToken(guest.token),guest);assert.equal(guest.context.player,actor);census(room);
  guest.lastSeen=Date.now()-61000;for(let i=0;i<20&&room.members.has(guest.id);i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(room.findToken(guest.token),null);assert.equal(room.sim.students[guest.studentId],actor);assert.equal(actor._networkDeparted,true);assert.equal(census(room).retired.length,1);
 }finally{await runtime.close();}
});
