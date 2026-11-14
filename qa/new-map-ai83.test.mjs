import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound,canSee} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {createSoloRound} from '../dist/solo-round.js';
import {inspectionPoints} from '../dist/new-map-ai83.js';
import {PLAYGROUND_LAYOUT} from '../dist/playground-layout70.js';
import {HOTPOT_SEATS,HOTPOT_SCREENS} from '../dist/hotpot-layout70.js';
import {TOILET_STALLS} from '../dist/toilet-layout70.js';
import {NORMAL_WALK_SPEEDS,TEACHER_RUN_SPEED} from '../dist/movement55.js';
import {CampusRoom} from '../server/room-simulation.js';
const ticks=(r,seconds)=>{for(let i=0;i<seconds*10;i++)r.step(.1);};
function quiet(map){const r=createSoloRound({map,target:10000});r.start();return r;}
function face(a,b){return {...a,yaw:Math.atan2(b.x-a.x,b.z-a.z),fov:180,viewRange:50};}

test('playground opponents actually walk to food sources, leave them and consume; decoys exercise without scoring',()=>{
 const r=new TeacherRound({map:'playground',seed:73,target:10000});r.start();Object.assign(r.player,{x:9.8,z:-14});
 const starts=r.students.map(a=>({x:a.x,z:a.z})),taken=new Set;let hanging=0,walking=0,earnedAway=false;
 for(let i=0;i<1000;i++){
  r.step(.1);for(const a of r.students){
   if(a._slots.some(s=>s.action))taken.add(a.id);
   if(a.holding)earnedAway ||= PLAYGROUND_LAYOUT.vending.every(v=>Math.hypot(a.x-v.x,a.z-v.z)>2);
   if(a.mapActivity)hanging++;else if(a.mood==='walking')walking++;
   if(!a.isTeammate){assert.equal(a._earnedPoints,0);assert.equal(a.holding,false);}
  }
  const bars=r.students.filter(a=>a.mapActivity).map(a=>a.mapActivity.id);assert.equal(new Set(bars).size,bars.length);
 }
 assert.ok(r.score>0);assert.ok(taken.size>=3);assert.ok(earnedAway);assert.ok(hanging>0&&walking>0);
 for(const a of r.students.filter(a=>taken.has(a.id)))assert.ok(Math.hypot(a.x-starts[a.id].x,a.z-starts[a.id].z)>5);
});

test('solo pupil remains the only scorer outside, AI does not move human-controlled players',()=>{
 const r=quiet('playground'),p=r.player,before={x:p.x,z:p.z};ticks(r,20);assert.equal(r.score,0);assert.deepEqual({x:p.x,z:p.z},before);
 const a=r.students.find(a=>a!==p);a.networkHuman=true;a._outdoorGoal=null;a.mapActivity=null;const q={x:a.x,z:a.z};ticks(r,2);assert.deepEqual({x:a.x,z:a.z},q);
});

for(const map of ['dorm','toilet','hotpot'])test(`${map} patrol reaches checkpoints rather than marking unreachable places remotely`,()=>{
 const r=quiet(map),seen=new Set,levels=new Set;
 for(let i=0;i<2400;i++){
  r.step(.1);
  if(map==='dorm'){assert.notEqual(r.teacher.phase,'board');if(r._plan.intent==='inspect'&&!r._plan.route.length)levels.add(r.teacher.pitch>0?'lower':'upper');}
  for(const [key,at] of Object.entries(r._inspectionVisits))if(!seen.has(key)){
   seen.add(key);const p=inspectionPoints(map).find(p=>p.checkpointId===key);
   assert.ok(Math.hypot(p.x-r.teacher.x,p.z-r.teacher.z)<.3,`${key} marked at a distance`);
  }
 }
 assert.ok(seen.size>=(map==='toilet'?12:6),[...seen].join(','));
 if(map==='dorm'){assert.equal(levels.size,2);assert.ok(r.teacher.stamina>0);}
 if(map==='toilet')assert.ok(Object.values(r.toiletDoors).some(v=>v>.9));
});

test('toilet closed door hides seated food user and opened door reveals them',()=>{
 const r=quiet('toilet'),a=r.students[10],s=TOILET_STALLS[10],t=face({...r.teacher,x:s.x-.18,z:s.z+4.1},a);
 assert.equal(canSee(t,a,[],r.layout),false);r.toiletDoors[10]=1;r._toiletDoorTargets[10]=true;r._advanceFurniture(0);assert.equal(canSee(t,a,[],r.layout),true);
});

test('dorm lower and upper bunk visibility uses their real heights and each room wall',()=>{
 const r=quiet('dorm'),point=inspectionPoints('dorm')[0];
 for(const a of r.students.filter(a=>r.seats[a.seatId].roomId===1&&r.seats[a.seatId].row===0))assert.equal(canSee(face({...r.teacher,...point},a),a,[],r.layout),true);
 const remote=r.students.find(a=>r.seats[a.seatId].roomId===2);assert.equal(canSee(face({...r.teacher,...point},remote),remote,[],r.layout),false);
});

test('hotpot all four orientations preserve their own book, drawer and chair exit',()=>{
 const r=quiet('hotpot');r._advanceTeacher=()=>{};r._perceive=()=>{};
 for(const a of r.students)if(a!==r.player){a.seated=false;a.visible=false;a.seatId=null;}
 for(const seat of HOTPOT_SEATS){
  Object.assign(r.player,{seated:false,seatId:null,x:seat.x,z:seat.z,_drawnSlot:null,_heldSource:null,_slots:[]});
  assert.equal(r.interact(seat.id),'seated');assert.equal(r.setDrawerOpen(true),true);
  Object.assign(r.player._slots[0],{action:'burger',progress:0,readyAt:0});assert.equal(r.takeSlot(0),true);assert.equal(r.returnItem(),true);
  r.books[seat.id].raised=false;assert.equal(r.setBookRaised(true),true);assert.equal(r.books[seat.id].raised,true);assert.equal(r.interact(),'stood');
 }
 const screen=HOTPOT_SCREENS[1],a={id:0,x:screen.x,z:screen.z-1,seated:true};assert.equal(canSee(face({...r.teacher,x:screen.x,z:screen.z+1},a),a,[],r.layout),false);
});

test('teacher sprint is hold/release, keeps standing and carry speed, stops on pause, student still crawls',()=>{
 const r=new TeacherRound({map:'playground'});r.start();Object.assign(r.player,{x:0,z:-20,yaw:0});r.setMovement(0,1);ticks(r,1);assert.ok(Math.abs(r.player.z+20-NORMAL_WALK_SPEEDS.teacher)<1e-5);
 const z=r.player.z;assert.equal(r.setSprint(true),true);ticks(r,1);assert.ok(Math.abs(r.player.z-z-TEACHER_RUN_SPEED)<1e-5);assert.equal(r.player.crouched,false);assert.equal(r.snapshot().player.sprinting,true);
 r.teacher.carriedId=0;Object.assign(r.students[0],{captivity:'carried',_grabAt:r.elapsed,_grabStart:{x:r.students[0].x,z:r.students[0].z}});const carryZ=r.player.z;ticks(r,1);assert.ok(Math.abs(r.player.z-carryZ-TEACHER_RUN_SPEED)<1e-5);
 r.setSprint(false);assert.equal(r.snapshot().player.sprinting,false);r.setSprint(true);r.pause(true);assert.equal(r.player.sprinting,false);assert.equal(r.setSprint(true),false);
 const s=quiet('playground');assert.equal(s.setSprint(true),false);assert.equal(s.setCrouch(true),true);assert.equal(s.player.crouched,true);
});

test('authenticated teacher sprint is authoritative, visible to peers and rejects student spoofing',()=>{
 const room=new CampusRoom({map:'playground'}),host=room.join({rolePreference:'teacher'}),guest=room.join({rolePreference:'student'});room.begin(host);room.sim.stage='class';room.sim._seatingRoutes.clear();
 const p=host.context.player;Object.assign(p,{x:0,z:-20,yaw:0});room.command(host,'setMovement',[0,1]);room.command(host,'setSprint',[true]);room.tick(.1);
 assert.ok(Math.abs(p.z+20-TEACHER_RUN_SPEED*.1)<1e-5);assert.equal(room.snapshot(host).player.sprinting,true);assert.equal(room.snapshot(guest).teacher.sprinting,true);
 assert.throws(()=>room.command(guest,'setSprint',[true]));room.command(host,'setSprint',[false]);assert.equal(p.sprinting,false);
 room.command(host,'setSprint',[true]);host.lastInput=Date.now()-700;room.tick(.1);assert.equal(p.sprinting,false);
});

test('network pause sends a boolean stop for the matching role',async()=>{
 const {NetworkRound}=await import('../dist/network-client.js');
 for(const id of[-1,0]){const r=Object.create(NetworkRound.prototype),calls=[];r._state={player:{id}};r.command=(...a)=>calls.push(a);r.snapshot=()=>({});r.pause(true);assert.ok(calls.some(c=>c[0]===(id===-1?'setSprint':'setCrouch')&&c[1]===false));assert.ok(calls.every(c=>c[0]!=='setSprint'||c.length===2));}
});
