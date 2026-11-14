import test from 'node:test';
import assert from 'node:assert/strict';
import {SoloStudentRound} from '../dist/solo-round.js';
import {CampusRoom} from '../server/room-simulation.js';
import {OFFICE_CHAIR} from '../dist/classroom-layout.js';
import {interactionIntent} from '../dist/interaction-intent54.js';
const DT=1/60;
function quiet(map='classroom'){
 const r=new SoloStudentRound({seed:59,map,target:10000});r.start();r._advanceTeacher=()=>{};r._perceive=()=>{};r._hear=()=>{};r._seatingRoutes.clear();
 for(const a of r.students)if(a!==r.player)Object.assign(a,{seated:false,seatId:null,visible:false,x:-50-a.id,z:-50,_decisionAt:Infinity});
 return r;
}
function take(r,kind='burger'){
 const p=r.player;Object.assign(p._slots[0],{action:kind,progress:0,readyAt:0});assert.equal(r.setDrawerOpen(true),true);assert.equal(r.takeSlot(0),true);return p._slots[0];
}
function sit(r,id){const s=r.seats[id];Object.assign(r.player,{x:s.x,z:s.z});assert.equal(r.interact(id),'seated');}
for(const map of ['classroom','computer7'])test(`${map}: carrying exits with E, walking alone is quiet, low-head eating consumes the original slot and refills it after three seconds`,()=>{
 const r=quiet(map),p=r.player,origin=p.seatId,slots=p._slots,item=take(r),intent=interactionIntent(r.snapshot(),{kind:'desk'},'E');
 assert.equal(intent.method,'interact');assert.equal(r[intent.method](...intent.args),'stood');assert.equal(p._slots,slots);assert.equal(p._drawnSlot,0);assert.equal(item.heldBy,p.id);assert.equal(p._drawerOpen,false);
 Object.assign(p,{x:8.8,z:2});r.setMovement(0,.4);r.step(.4);assert.equal(r.score,0);assert.equal(item.progress,0);
 r.setLook(0,0);r.hold(true);r.step(.5);assert.equal(item.progress,0);assert.equal(r.snapshot().player.eating,false);
 r.setLook(0,.55);r.step(1);assert.ok(item.progress>.32);r.hold(false);assert.equal(item.progress,0);
 r.hold(true);r.step(2-DT);assert.equal(item.action,'burger');r.step(DT);assert.equal(item.action,null);assert.equal(p._drawnSlot,null);assert.equal(r.score,1);assert.equal(item.heldBy,undefined);
 r.hold(false);r.setMovement(0,0);sit(r,origin===0?1:0);assert.notEqual(p._slots,slots);assert.equal(r.classSlotsBySeat.get(origin),slots);assert.equal(p._slots.length,map==='classroom'?3:1);
 r.step(3-DT);assert.equal(item.action,null);r.step(DT);assert.ok(item.action);assert.equal(slots.length,map==='classroom'?3:1);
});

test('changing seats while carrying cannot move stock, take a second item or remotely return the first',()=>{
 const r=quiet(),p=r.player,origin=p.seatId,original=p._slots,item=take(r,'drink');r.interact();const destination=0;sit(r,destination);
 assert.equal(p._slots,original);assert.deepEqual(r.snapshot().drawer.source,{office:false,seatId:origin,deskId:null});assert.equal(r.takeSlot(1),false);assert.equal(r.setDrawerOpen(true),false);assert.equal(r.returnItem(),false);assert.equal(item.heldBy,p.id);
 assert.equal(r.snapshot().drawer.canReturn,false);assert.equal(interactionIntent(r.snapshot(),null,'Q'),null);
 r.interact();Object.assign(p,{x:r.seats[origin].x,z:r.seats[origin].z});assert.equal(r.returnItem(),true);assert.equal(p.seated,false);assert.equal(item.action,'drink');assert.equal(item.heldBy,undefined);assert.equal(p._drawnSlot,null);
 sit(r,destination);assert.notEqual(p._slots,original);assert.equal(r.classSlotsBySeat.get(origin),original);
});

test('office lunch keeps the office source when carried to a classroom, and the original lunch replenishes once',()=>{
 const r=quiet(),p=r.player;r.interact();Object.assign(p,{x:OFFICE_CHAIR.x,z:OFFICE_CHAIR.z});assert.equal(r.openOfficeDrawer(),true);assert.equal(r.takeSlot(0),true);const lunch=r.officeSlots[0];r.interact();sit(r,0);
 assert.equal(r.snapshot().drawer.source.office,true);assert.equal(p._slots,r.officeSlots);r.setLook(0,.55);r.hold(true);r.step(3);assert.equal(lunch.action,null);assert.equal(p._usingOfficeStock,false);assert.equal(p._slots.length,3);assert.notEqual(p._slots,r.officeSlots);r.step(3);assert.equal(lunch.action,'lunch');assert.equal(r.officeSlots.length,1);
});

test('a carried pen keeps its original desk, twirls while walking, and cannot be taken twice',()=>{
 const r=quiet(),p=r.player,source=p.seatId;assert.equal(r.takePen(),true);assert.equal(r.togglePenMode(),true);const intent=interactionIntent(r.snapshot(),{kind:'chair',id:source},'E');assert.equal(intent.method,'interact');r.interact();
 assert.equal(r.snapshot().player.penWriting,false);assert.equal(r.snapshot().player.penTwirling,true);assert.equal(r.snapshot().player.penTaken,true);assert.equal(r.snapshot().player.penSeatId,source);assert.equal(r.togglePenMode(),false);r.step(3);assert.equal(r.score,0);
 const other=r.students[0];r.player=other;Object.assign(other,{x:r.seats[source].x,z:r.seats[source].z});assert.equal(r.interact(source),'seated');assert.equal(r.takePen(),false);r.interact();r.player=p;
 Object.assign(p,{x:r.seats[source].x,z:r.seats[source].z});assert.equal(r.returnItem(),true);assert.equal(r.penOwners.has(source),false);assert.equal(p._slots.some(s=>s.temporary),false);
});

test('banana peel keeps the one original reservation until thrown; capture returns held food without duplication',()=>{
 const r=quiet(),p=r.player,item=take(r,'banana'),source=p.seatId;r.interact();Object.assign(p,{x:8.8,z:2});r.setLook(0,.55);r.hold(true);r.step(3);
 assert.equal(item.action,'bananaPeel');assert.equal(item.heldBy,p.id);assert.equal(p._drawnSlot,0);assert.equal(r.snapshot().drawer.source.seatId,source);r.hold(true);r.releaseUse();assert.equal(item.action,null);assert.equal(item.heldBy,undefined);assert.equal(p._drawnSlot,null);r.step(3);assert.ok(item.action);
 sit(r,source);r.setDrawerOpen(true);r.takeSlot(0);r.interact();assert.equal(r._stun(p),true);assert.equal(item.heldBy,undefined);assert.equal(p._drawnSlot,null);assert.equal(r.classSlotsBySeat.get(source)[0],item);
});

for(const map of ['classroom','computer7'])test(`${map}: two authenticated pupils share physical stock without duplicate pickup, with moving food use and reconnect reservation`,()=>{
 const room=new CampusRoom({code:'590001',seed:59,map,target:10000}),host=room.join({rolePreference:'teacher'}),a=room.join({name:'甲'}),b=room.join({name:'乙'});room.begin(host);for(let i=0;i<301;i++)room.tick(.1);
 room.sim._seatingRoutes.clear();for(const s of room.sim.students)if(!s.networkHuman)Object.assign(s,{visible:false,seated:false,seatId:null,x:-50-s.id,z:-50});
 const seat=room.sim.seats[9],first=a.context.player,second=b.context.player;Object.assign(first,{x:seat.x,z:seat.z});assert.equal(room.command(a,'interact',[seat.id]),'seated');Object.assign(first._slots[0],{action:'burger',readyAt:0,progress:0});
 room.command(a,'setDrawerOpen',[true]);assert.equal(room.command(a,'takeSlot',[0]),true);const item=first._slots[0];room.command(a,'interact');Object.assign(first,{x:8.8,z:2});Object.assign(second,{x:seat.x,z:seat.z});assert.equal(room.command(b,'interact',[seat.id]),'seated');room.command(b,'setDrawerOpen',[true]);
 assert.equal(second._slots,first._slots);assert.equal(room.command(b,'takeSlot',[0]),false);assert.equal(room.snapshot(b).drawer.slots[0].action,null);assert.equal(room.snapshot(b).students.find(s=>s.id===a.studentId).heldAction,'burger');
 room.disconnect(a);room.tick(.5);assert.equal(item.heldBy,first.id);assert.equal(room.command(b,'takeSlot',[0]),false);room.reconnect(a);room.command(a,'setLook',[0,.55]);room.command(a,'hold',[true]);for(let i=0;i<120;i++)room.tick(DT);
 assert.equal(item.action,null);assert.equal(first._drawnSlot,null);assert.equal(room.snapshot(a).score,1);assert.equal(room.snapshot(b).drawer.slots[0].readyIn,3);for(let i=0;i<180;i++)room.tick(DT);assert.ok(item.action);assert.equal(room.command(b,'takeSlot',[0]),true);
});


test('stopping an ordinary classmate never creates drawer inventory or a new mischief participant',()=>{
 const r=quiet(),npc=r.students.find(s=>s!==r.player&&!s.isTeammate);npc.seated=true;npc.seatId=npc.id;const size=r.classSlotsBySeat.size,team=[...r._team];
 r._stopActor(npc);assert.deepEqual(npc._slots,[]);assert.equal(r.classSlotsBySeat.size,size);assert.deepEqual([...r._team],team);
});
