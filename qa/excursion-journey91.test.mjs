import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {CampusRoom} from '../dist/room-simulation.js';
import {BUS,BUS_SEATS,onBus,busBlocked} from '../dist/bus-layout86.js';
import {createSoloRound} from '../dist/solo-round.js';
import {COACH_DOOR_SECONDS,coachDistanceAt,roadSectionAt,ROAD_RADIUS,ROAD_SECTION_LENGTH} from '../dist/excursion-journey91.js';
import {createExcursionRoad} from '../dist/excursion-road91.js';

test('all eight room members board exactly on zero, including a disconnected member and a teacher outside',()=>{
 const room=new CampusRoom({code:'919292',map:'bus',seed:219,maxPlayers:8});
 const members=Array.from({length:8},(_,i)=>room.join({name:'乘客'+i,rolePreference:i===0?'teacher':'student'}));
 room.begin(members[0]);
 room.disconnect(members[7]);
 // Already aboard, upstairs and standing: this player keeps their chosen deck.
 Object.assign(members[1].context.player,{x:3.0,z:-12.85,busDeck:1,seated:false,seatId:null});
 // Another passenger has already chosen an upstairs seat while a decoy is walking.
 const rider=members[2].context.player,chosen=BUS_SEATS.find(s=>s.busDeck===1);
 Object.assign(rider,{x:chosen.x,z:chosen.z,busDeck:1,seated:true,seatId:chosen.id});
 for(let i=0;i<29;i++)room.tick(1);
 Object.assign(members[0].context.player,{x:10.5,z:2,busDeck:0,seated:false});
 const before=room.snapshot(members[3]);assert.equal(before.stage,'seating');assert.equal(before.busDeparted,false);
 assert.ok(!onBus(before.player.x,before.player.z));
 room.tick(1);
 assert.equal(room.sim.stage,'class');
 const leaving=room.snapshot(members[0]);
 assert.equal(leaving.busDistance,0);assert.ok(Math.abs(leaving.busDepartureAt-30)<.001);
 assert.equal(leaving.player.x,BUS.driver.x);
 const occupied=room.sim.students.filter(a=>a.seated).map(a=>a.seatId);assert.equal(new Set(occupied).size,occupied.length);
 assert.equal(rider.seatId,chosen.id);
 const upstairs=members[1].context.player;assert.equal(upstairs.busDeck,1);assert.equal(upstairs.seated,false);assert.ok(Math.abs(upstairs.x-3)<.01);
 room.reconnect(members[7]);
 for(const m of members){const s=room.snapshot(m);assert.equal(s.busDeparted,true);assert.equal(s.busDepartureAt,leaving.busDepartureAt);assert.ok(onBus(s.player.x,s.player.z));}
 for(let i=0;i<8;i++)room.tick(1);
 for(const m of members)assert.ok(room.snapshot(m).busDistance>34);
 assert.ok(busBlocked(10.05,BUS.body.maxZ+.8,.18,0,room.sim.layout));assert.ok(busBlocked(10,2,.18,0,room.sim.layout));
});
test('excursion motion closes the door, accelerates continuously, freezes when paused, and resets next round',()=>{
 const r=createSoloRound({role:'student',map:'bus'});r.start({gathering:true});r.startBell();
 for(let i=0;i<30;i++)r.step(1);
 const at=r.busDepartureAt;
 assert.equal(coachDistanceAt(at+COACH_DOOR_SECONDS,at),0);
 const samples=Array.from({length:18},(_,i)=>coachDistanceAt(at+COACH_DOOR_SECONDS+i,at));
 for(let i=1;i<samples.length;i++)assert.ok(samples[i]>samples[i-1]);
 assert.ok(samples[3]-samples[2]>samples[2]-samples[1]);assert.ok(samples[15]-samples[14]>8);
 for(let i=0;i<7;i++)r.step(1);
 const travelled=r.snapshot().busDistance;assert.ok(travelled>0);
 r.pause(true);r.step(1);assert.equal(r.snapshot().busDistance,travelled);
 r.pause(false);r.step(1);assert.ok(r.snapshot().busDistance>travelled);
 r.reset(11);r.start({gathering:true});assert.equal(r.snapshot().busDistance,0);assert.equal(r.snapshot().busDeparted,false);
});
test('streamed route stays contiguous, deterministic and bounded across seams and distant stations',()=>{
 const root=new T.Group(),mirror=new T.Group(),a=createExcursionRoad(root),b=createExcursionRoad(mirror);
 const ids=()=>root.children.map(s=>s.userData.section).sort((x,y)=>x-y);
 a.update(0,8302);const identities=root.children.map(s=>s.uuid);
 const keep=root.children.find(c=>c.userData.section===1),initial=keep.children.find(m=>m.name==='road-shell').instanceMatrix.array.slice();
 a.update(ROAD_SECTION_LENGTH+.05,8302);assert.ok(root.children.includes(keep)&&keep.userData.section===1);
 assert.deepEqual(keep.children.find(m=>m.name==='road-shell').instanceMatrix.array,initial);
 for(const distance of [192.1,1131,18000,1e7+.3]){
  a.update(distance,8302);b.update(distance,8302);
  assert.deepEqual(root.children.map(s=>s.uuid),identities);
  const centre=roadSectionAt(distance);
  assert.deepEqual(ids(),Array.from({length:2*ROAD_RADIUS+1},(_,i)=>centre+i-ROAD_RADIUS));
  for(const s of root.children){
   assert.equal(s.position.x,s.userData.section*ROAD_SECTION_LENGTH);
   const mirrorSlot=mirror.children.find(c=>c.userData.section===s.userData.section);
   for(const mesh of s.children){assert.ok(mesh.count<=mesh.instanceMatrix.count);const other=mirrorSlot.children.find(m=>m.name===mesh.name);
    assert.deepEqual(mesh.instanceMatrix.array.subarray(0,mesh.count*16),other.instanceMatrix.array.subarray(0,other.count*16));}
  }
 }
 const distant=root.children.find(c=>c.userData.section===ids()[3]).children.find(m=>m.name==='road-shell');
 assert.notDeepEqual(distant.instanceMatrix.array,initial);
 a.dispose();b.dispose();assert.equal(root.children.length,0);
});
