import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound,chalkHit,ROOM_INTERACTION_TUNING} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {ordinaryStudyState} from '../dist/npc-study58.js';
import {actorFloorHeight,actorEyeHeight,blocked,boardForMap,detentionForMap} from '../dist/classroom-layout.js';
import {PLAYGROUND_LAYOUT} from '../dist/playground-layout70.js';
import {HOTPOT_TABLES} from '../dist/hotpot-layout70.js';
import {CampusRoom} from '../server/room-simulation.js';
import {STUDENT_PROPORTIONS} from '../dist/student-proportions73.js';

function quiet(map){const r=new ClassroomRound({map,target:10000});r.start();r._advanceTeacher=()=>{};r._perceive=()=>{};r._hear=()=>{};for(const a of r.students)if(a!==r.player){a.isTeammate=false;a._profile=null;a._slots=[];}return r;}
function clearSeat(r,id){const a=r.students.find(s=>s!==r.player&&s.seatId===id);if(a)Object.assign(a,{x:9,z:4,seated:false,seatId:null,bedId:null,lying:false,visible:false});}
function food(r){Object.assign(r.player._slots[0],{action:'burger',progress:0,readyAt:0});assert.equal(r.setDrawerOpen(true),true);assert.equal(r.takeSlot(0),true);r.setLook(r.player.yaw,.55);assert.equal(r.hold(true),true);}

test('all eight modes initialize finite actor snapshots; legacy saved map names retain their mode',()=>{
 for(const map of ['classroom','night','tiered','computer','hotpot','toilet','dorm','playground','computer7','tiered8']){const r=quiet(map),s=r.step(.05);assert.equal(s.map,map);assert.ok(s.students.length>=12);assert.ok(Number.isFinite(s.player.supportHeight+s.player.eyeHeight));assert.equal(s.drawer.slots.length,map==='playground'?0:map.startsWith('computer')?1:3);}
});
for(const map of ['toilet','dorm'])test(`${map}: actual cabinet pickup, use, consumption and local refill preserve a single shared stock`,()=>{
 const r=quiet(map),p=r.player,seatId=p.seatId;assert.equal(r.toggleBook(),false);assert.equal(r.takePen(),false);food(r);const stock=p._slots,slot=stock[0];r.step(.25);const before=r.snapshot()[map==='toilet'?'toiletCabinets':'dormCabinets'][seatId];assert.ok(before>0&&before<1);r.pause();r.step(3);assert.equal(r.snapshot()[map==='toilet'?'toiletCabinets':'dormCabinets'][seatId],before);r.pause(false);r.hold(true);r.step(3);assert.equal(r.score,1);assert.equal(slot.action,null);assert.equal(p._drawnSlot,null);assert.equal(r.classSlotsBySeat.get(seatId),stock);r.step(3);assert.ok(slot.action);assert.equal(stock.length,3);assert.ok(r.snapshot().books.every(b=>!b.raised&&b.amount===0));
});

test('toilet door is independent of food cabinet, has real reach, and must open before leaving or sitting',()=>{
 const r=quiet('toilet'),p=r.player,id=p.seatId;assert.equal(r.interact(),false);assert.equal(r.toggleToiletDoor(999),false);assert.equal(r.toggleToiletDoor(0),false);assert.equal(r.toggleToiletDoor(id),true);r.step(.1);assert.ok(r.toiletDoors[id]>0&&r.toiletDoors[id]<1);assert.equal(r.snapshot().drawer.open,false);r.step(1);assert.equal(r.interact(),'stood');assert.equal(p.seatId,null);assert.ok(!blocked(p.x,p.z,.18,r.layout));assert.equal(r.interact(id),'seated');assert.equal(r.toggleToiletDoor(id),true);r.step(2);assert.equal(r.toiletDoors[id],0);assert.equal(r.interact(),false);
});

test('toilet door pauses its sweep at a standing occupant and resumes once the opening clears',()=>{
 const r=quiet('toilet'),id=r.player.seatId,seat=r.seats[id],other=r.students[0];assert.equal(r.toggleToiletDoor(id),true);Object.assign(other,{seated:false,seatId:null,visible:true,x:seat.x+.3,z:seat.z+1.67});r.step(.2);assert.equal(r.toiletDoors[id],0);Object.assign(other,{x:9,z:4});r.step(.2);assert.ok(r.toiletDoors[id]>.5);
});

test('toilet interaction reaches the bowl from inside its cubicle, without crossing a partition or closed door',()=>{
 const r=quiet('toilet'),p=r.player,seat=r.seats[9];clearSeat(r,seat.id);
 Object.assign(p,{seated:false,seatId:null,x:seat.x,z:seat.z+1.15});
 r._toiletDoorTargets[seat.id]=true;r.step(1);
 assert.ok(r.toiletDoors[seat.id]>.85);
 assert.equal(r.interact(seat.id),'seated');
 assert.equal(r.interact(),'stood');
 Object.assign(p,{x:seat.x+1.3,z:seat.z+1.35});
 assert.equal(r.interact(seat.id),false,'adjacent cubicle cannot sit through partition');
 Object.assign(p,{x:9,z:4});r._toiletDoorTargets[seat.id]=false;r.step(1);
 Object.assign(p,{x:seat.x,z:seat.z+1.15});
 assert.equal(r.interact(seat.id),false,'closed door still blocks sitting');
});

test('both bunks stay reclined awake and asleep, with stable support height and an explicit exit',()=>{
 const r=quiet('dorm'),p=r.player;assert.equal(r.interact(),'stood');for(const id of [0,1]){clearSeat(r,id);const bed=r.seats[id];Object.assign(p,{x:bed.exitX,z:bed.exitZ});assert.equal(r.interact(id),'seated');let snap=r.snapshot().player;assert.equal(snap.onBed,true);assert.equal(snap.bedId,id);assert.equal(snap.supportHeight,bed.supportHeight);assert.equal(snap.eyeHeight,.23);assert.equal(snap.lying,true);assert.equal(snap.sleeping,false);assert.equal(r.toggleBedLie(),'sleeping');snap=r.snapshot().player;assert.equal(snap.lying,true);assert.equal(snap.eyeHeight,.23);assert.equal(p.x,bed.lieX);assert.equal(p.z,bed.lieZ);assert.equal(r.setCrouch(true),'awake');assert.equal(p.lying,true);assert.equal(p.sleeping,false);assert.equal(p.crouched,false);assert.equal(r.toggleBedLie(),'sleeping');assert.equal(r.interact(),'stood');snap=r.snapshot().player;assert.equal(snap.onBed,false);assert.equal(snap.lying,false);assert.equal(snap.bedId,null);assert.equal(snap.supportHeight,0);assert.equal(snap.eyeHeight,STUDENT_PROPORTIONS.eyeHeight);assert.ok(!blocked(p.x,p.z,.18,r.layout));}assert.equal(r.toggleBedLie(),false);
});

test('a stunned pupil stays supported by the bunk until actually grabbed, without falling through its solid frame',()=>{
 const r=quiet('dorm'),p=r.player,bed=r.seats[p.seatId];r.toggleBedLie();assert.equal(r._stun(p),true);assert.equal(actorFloorHeight(p,r.map),bed.supportHeight);assert.equal(actorEyeHeight(p,r.map),.23);assert.equal(r.toggleBedLie(),false);r.step(5.1);assert.equal(p.captivity,'free');assert.equal(r.interact(),'stood');
});

test('waking and using the bedside cupboard preserve the player look direction and side-lying body heading',()=>{
 const r=quiet('dorm'),p=r.player,bodyYaw=p.seatYaw;
 r.setLook(-1.51,-.38);const gaze={yaw:p.yaw,pitch:p.pitch};
 r.toggleBedLie();r.setDrawerOpen(true);r.takeSlot(0);
 assert.equal(p.sleeping,false);assert.equal(p.lying,true);
 assert.equal(p.yaw,gaze.yaw);assert.equal(p.pitch,gaze.pitch);assert.equal(p.seatYaw,bodyYaw);
});

test('new room background actors use rest, sitting and standing states without phantom reading props',()=>{
 for(const map of ['dorm','toilet','playground']){const r=quiet(map);for(let i=0;i<4;i++){const s=r.step(.2);for(const a of s.students.filter(a=>!a.isPlayer)){assert.equal(a.studyBookHeld,false);assert.equal(a.holding,false);if(map==='playground')assert.ok(['standing','walking','hanging'].includes(a.mood));else assert.equal(a.mood,map==='dorm'?'resting':'sitting');if(map==='playground')assert.equal(a.seated,false);if(map==='dorm')assert.equal(a.lying,true);}}const state=ordinaryStudyState({id:1,seatYaw:0},{x:3,z:2},20,73,map);assert.equal(state.studyBookHeld,false);assert.equal(state.action,null);}
});

test('playground has standing spawns and nearby vending pickup; only eating earns points, stock never auto-refills',()=>{
 const r=quiet('playground'),p=r.player;assert.equal(p.seated,false);assert.equal(r.interact(p.id),false);assert.equal(r.toggleDrawer(),false);assert.equal(r.takePlaygroundFood(),false);const v=PLAYGROUND_LAYOUT.vending[0];Object.assign(p,{x:v.x+Math.sin(v.yaw)*.8,z:v.z+Math.cos(v.yaw)*.8});assert.equal(blocked(p.x,p.z,.18,r.layout),false);assert.equal(r.takePlaygroundFood('unknown'),false);assert.equal(r.takePlaygroundFood('burger'),true);assert.equal(r.takePlaygroundFood('snack'),false);assert.equal(r.score,0);r.setLook(-Math.PI/2,.55);r.hold(true);r.step(3);assert.equal(r.score,1);assert.equal(p._slots[0].action,null);r.step(4);assert.equal(p._slots[0].action,null);assert.equal(r.takePlaygroundFood('snack'),true);assert.equal(ROOM_INTERACTION_TUNING.vendingCooldown,3);
});

test('hotpot chalk hits all four rotated books and the actual full pot, with no phantom outdoor desktop',()=>{
 const r=quiet('hotpot');for(const s of r.seats){const f={x:Math.sin(s.yaw),z:Math.cos(s.yaw)},c={x:s.deskX-f.x*.28,y:1.25,z:s.deskZ-f.z*.28},a={x:c.x-f.x*.3,y:c.y,z:c.z-f.z*.3},b={x:c.x+f.x*.1,y:c.y,z:c.z+f.z*.1};r.books.forEach(book=>{book.amount=0;});r.books[s.id].amount=1;const hit=chalkHit(a,b,[],r.books,r.map,r.layout);assert.equal(hit?.kind,'desk','book '+s.id);assert.equal(hit.id,s.id);const side={x:Math.cos(s.yaw)*.5,z:-Math.sin(s.yaw)*.5};assert.equal(chalkHit({...a,x:a.x+side.x,z:a.z+side.z},{...b,x:b.x+side.x,z:b.z+side.z},[],r.books,r.map,r.layout),null);}
 r.books.forEach(book=>{book.amount=0;});for(const t of HOTPOT_TABLES)assert.ok(chalkHit({x:t.x-1.2,y:1.1,z:t.z},{x:t.x+1.2,y:1.1,z:t.z},[],r.books,r.map,r.layout));const p=quiet('playground'),s=p.seats[0];assert.equal(chalkHit({x:s.x-.3,y:.7,z:s.z},{x:s.x+.3,y:.7,z:s.z},[],p.books,p.map,p.layout),null);
});

test('playground teacher writes at the rendered outdoor board and binds at outdoor stage posts',()=>{
 const r=new TeacherRound({map:'playground'});r.start();const board=boardForMap(r.map);Object.assign(r.player,{x:board.x,z:board.z,yaw:0,pitch:0});assert.equal(r.canWriteBoard(),true);assert.deepEqual(r.snapshot().posts.map(p=>[p.x,p.z]),detentionForMap(r.map).map(p=>[p.x,p.z]));const actor=r.students[0],post=r.posts[0];actor.captivity='carried';r.teacher.carriedId=actor.id;Object.assign(r.player,{x:post.x,z:post.z-.9,yaw:0});Object.assign(r.teacher,{x:r.player.x,z:r.player.z});assert.equal(r.bindTarget()?.id,post.id);assert.equal(r.bindStudent(),true);assert.equal(r.snapshot().posts[0].studentId,actor.id);
});

// Exercise the existing shared authoritative context: the controls themselves
// are the public ClassroomRound actions, not hand-edited inventory snapshots.
test('two authenticated dorm peers keep bed pose and cabinet food ownership private while sharing visible cabinet motion',()=>{
 const room=new CampusRoom({code:'710071',seed:71,map:'dorm'}),host=room.join({rolePreference:'teacher'}),guest=room.join({rolePreference:'student'});room.begin(host);room.sim.stage='class';room.sim._seatingRoutes.clear();const p=guest.context.player,bed=room.sim.seats[p.id];for(const a of room.sim.students)if(a!==p&&a.seatId===bed.id){a.seated=false;a.seatId=null;}Object.assign(p,{x:bed.exitX,z:bed.exitZ,seated:false,seatId:null});const call=(method,...args)=>room.withMember(guest,sim=>ClassroomRound.prototype[method].apply(sim,args));assert.equal(call('interact',bed.id),'seated');assert.equal(call('toggleBedLie'),'sleeping');assert.equal(call('setDrawerOpen',true),true);assert.equal(call('takeSlot',0),true);room.tick(.2);const own=room.snapshot(guest),other=room.snapshot(host);assert.equal(own.player.lying,true);assert.equal(own.player.sleeping,false);assert.equal(own.player.bedId,bed.id);assert.equal(own.drawer.drawnSlot,0);assert.ok(own.dormCabinets[bed.id]>0);assert.equal(other.dormCabinets[bed.id],own.dormCabinets[bed.id]);assert.ok(other.students.every(s=>!s.drawer));assert.equal(call('returnItem'),true);assert.equal(p._drawnSlot,null);assert.equal(call('interact'),'stood');
});
