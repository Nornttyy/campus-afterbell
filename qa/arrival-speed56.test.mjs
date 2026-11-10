import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound,AI_WALK_SPEEDS,DEVELOPMENT_TUNING} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {CampusRoom} from '../server/room-simulation.js';
import {CAMPUS_MAPS,LAYOUT_PATTERNS,blocked,BOARD} from '../dist/classroom-layout.js';
import {NORMAL_WALK_SPEEDS} from '../dist/movement55.js';
const DT=1/60,dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function record(round,advance,callback){
 const ai=round.students.filter(s=>!s.isPlayer&&!s.networkHuman),poses=new Map(ai.map(s=>[s.id,{x:s.x,z:s.z,seated:s.seated,visible:s.visible}]));
 let lastSeated=0,peak=0,lastExit=-Infinity,departures=0;
 for(let frame=0;frame<1800;frame++){
  callback?.(frame*DT);advance(DT);let emerged=0;
  for(const s of ai){
   const old=poses.get(s.id),speed=dist(s,old)/DT;
   // Includes the last movement into the chair, not just moving frames.
   assert.ok(speed<=AI_WALK_SPEEDS.student+1e-6,`${round.map}/${round.seed} AI ${s.id} accelerated to ${speed} at ${(frame*DT).toFixed(2)}s`);peak=Math.max(peak,speed);
   if(s.visible!==false&&old.visible===false){emerged++;departures++;assert.ok((frame+1)*DT-lastExit>=.35-1e-8,`two pupils left the same lift queue too closely`);lastExit=(frame+1)*DT;}
   if(s.seated&&!old.seated)lastSeated=(frame+1)*DT;
   if(s.visible!==false&&frame%12===0)assert.equal(blocked(s.x,s.z,.2,round.layout),false,`${s.id} left the real walkable path`);
   poses.set(s.id,{x:s.x,z:s.z,seated:s.seated,visible:s.visible});
  }
  assert.ok(emerged<=1,'pupils appeared as a crowd rather than one at a time');
 }
 assert.equal(ai.filter(s=>!s.seated).length,0,`${round.map}/${round.seed}: AI did not finish by 30 seconds`);
 assert.ok(lastSeated<30);assert.equal(departures,ai.length);assert.ok(peak>AI_WALK_SPEEDS.student-.001);
 const seats=round.students.filter(s=>s.seated);assert.equal(new Set(seats.map(s=>s.seatId)).size,seats.length,'two actors share a physical seat');
 return {lastSeated:+lastSeated.toFixed(3),peak:+peak.toFixed(6),count:ai.length};
}
for(const map of CAMPUS_MAPS)test(`${map}: all six layouts finish 20/30-seat arrivals at one normal speed for either role`,t=>{
 const results=[];
 for(const Round of [ClassroomRound,TeacherRound])for(let seed=0;seed<LAYOUT_PATTERNS.length;seed++){
  const round=new Round({map,seed});round.start({gathering:true});assert.ok(round.startBell());
  const lengths=[...round._seatingRoutes].map(([id,path])=>path.reduce((n,p,i)=>n+dist(i?path[i-1]:round.students[id],p),0));
  assert.ok(lengths.every((length,i)=>!i||lengths[i-1]>=length-1e-8),'longer trips must enter first');
  results.push(record(round,dt=>round.step(dt)));
 }
 t.diagnostic(JSON.stringify({map,cases:results.length,lastSeated:Math.max(...results.map(s=>s.lastSeated)),peak:Math.max(...results.map(s=>s.peak))}));
});

for(let seed=0;seed<LAYOUT_PATTERNS.length;seed++)test(`${LAYOUT_PATTERNS[seed]}: a full 8-person room supports human seat claims without AI boosts`,t=>{
 const room=new CampusRoom({code:'speed56',seed,map:seed%2?'tiered':'classroom'}),people=[];
 for(let i=0;i<8;i++)people.push(room.join({name:'P'+i,rolePreference:i?'student':'teacher'}));
 assert.ok(room.begin(people[0]));const claims=new Set();let redirected=0;
 const result=record(room.sim,dt=>room.tick(dt),time=>{
  // Humans can choose AI-reserved seats while the queue is still arriving.
  // Place the test human beside a real free chair before sending the normal
  // interaction command; no AI is repositioned or force-seated in this test.
  if(Math.abs(time-5)>DT/4&&Math.abs(time-11)>DT/4)return;
  for(const human of people.filter(p=>p.role==='student'&&!p.context.player.seated).slice(0,time<6?4:7)){
   const reserved=[...room.sim._seatingRoutes.keys()].map(id=>room.sim.students[id]).filter(s=>!s.seated&&!claims.has(s._targetSeatId));
   const seat=reserved.length?room.sim.seats[reserved.at(-1)._targetSeatId]:room.sim.seats.find(s=>!claims.has(s.id)&&!room.sim.students.some(a=>a.seated&&a.seatId===s.id));
   if(!seat)continue;Object.assign(human.context.player,{x:seat.x,z:seat.z,seated:false});assert.equal(room.command(human,'interact',[seat.id]),'seated');claims.add(seat.id);if(reserved.length)redirected++;
  }
 });
 assert.ok(redirected>0);assert.equal(people.filter(p=>p.role==='student'&&p.context.player.seated).length,7);t.diagnostic(JSON.stringify({...result,redirected}));
});

test('normal teacher movement is faster than students in solo and authoritative multiplayer',()=>{
 assert.equal(NORMAL_WALK_SPEEDS.student,1.8);assert.equal(NORMAL_WALK_SPEEDS.teacher,2.2);
 for(const key of ['teacherEntry','teacherPatrol','teacherPursuit'])assert.ok(AI_WALK_SPEEDS[key]>AI_WALK_SPEEDS.student);
 for(const Round of [ClassroomRound,TeacherRound]){
  const round=new Round();round.start();Object.assign(round.player,{x:9,z:0,yaw:0,seated:false});for(const s of round.students)s._decisionAt=Infinity;
  round.setMovement(0,1);round.step(.5);assert.ok(Math.abs(round.player.z-(Round===TeacherRound?2.2:1.8)*.5)<1e-8);
 }
 const room=new CampusRoom({code:'roles56'}),teacher=room.join({name:'Teacher',rolePreference:'teacher'}),student=room.join({name:'Student'});room.begin(teacher);room.tick(30);
 Object.assign(teacher.context.player,{x:9,z:0,yaw:0,seated:false});Object.assign(student.context.player,{x:10,z:0,yaw:0,seated:false});
 for(const p of[teacher,student])room.command(p,'setMovement',[0,1]);for(let i=0;i<30;i++)room.tick(DT);
 assert.ok(Math.abs(teacher.context.player.z-1.1)<1e-8);assert.ok(Math.abs(student.context.player.z-.9)<1e-8);
 // Teacher AI entry and patrol also use the same role pace, not just constants.
 const ai=new ClassroomRound();ai.start();ai._thinkAt=Infinity;ai._perceive=()=>{};Object.assign(ai.teacher,{x:9,z:0,yaw:0});ai._setPlan('investigate',null,{x:9,z:4},20);ai._turnLeft=0;
 let covered=0;for(let i=0;i<30;i++){const before={x:ai.teacher.x,z:ai.teacher.z};ai._advanceTeacher(DT);covered+=dist(ai.teacher,before);}assert.ok(Math.abs(covered-1.1)<1e-7);
});
