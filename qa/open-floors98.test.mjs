import test from 'node:test';
import assert from 'node:assert/strict';
import {OPEN_CAMPUS_MAPS,playableCampusMap,assetsForOpenMaps} from '../dist/campus-destinations.js';
import {CAMPUS_MAPS,LIFT,campusFloor} from '../dist/classroom-layout.js';
import {createSoloRound} from '../dist/solo-round.js';
import {PeerRoomHost} from '../dist/peer-room-host79.js';
import {CampusRoom} from '../dist/room-simulation.js';
import {NetworkRound,readEvent} from '../dist/network-client.js';
import {CAMPUS_SURFACE_SOURCES} from '../dist/surface-materials.js';
import {CAMPUS_ARTWORK_SOURCES} from '../dist/campus-artwork.js';
import {FURNITURE_SOURCES67} from '../dist/furniture-assets67.js';

const archived=['bus','playground','cafeteria','exam','toilet','hotpot','dorm'];
const board=p=>Object.assign(p,{x:LIFT.x,z:LIFT.z,seated:false});

test('the public lift lists all and only the open canonical destinations in floor order',()=>{
 const expected=['classroom','night','tiered','computer'];
 assert.deepEqual(OPEN_CAMPUS_MAPS,expected);
 assert.deepEqual(['bus',...CAMPUS_MAPS].filter(map=>!archived.includes(map)),expected);
 for(const map of archived)assert.equal(playableCampusMap(map),null);
 assert.equal(playableCampusMap('missing'),null);
 assert.equal(playableCampusMap('tiered8'),'tiered');
 for(const map of expected){
  const room=CampusRoom.forPlay({map,code:'980098',floor:10});
  assert.equal(room.sim.map,map);assert.equal(room.floor,campusFloor(map));
 }
});

test('playable rooms load their furnishings and artwork while map-exclusive assets remain in the authoring catalogue',()=>{
 const only=(all,removed)=>{
  const selected=assetsForOpenMaps(all);
  for(const key of removed){assert.ok(Object.hasOwn(all,key));assert.ok(!Object.hasOwn(selected,key));}
  for(const [key,path] of Object.entries(all))if(!removed.includes(key))assert.equal(selected[key],path);
 };
 only(CAMPUS_SURFACE_SOURCES,['turf','track','tile','cloth','facade','upholstery','broth']);
 only(CAMPUS_ARTWORK_SOURCES,['hotpotMenus','hotpotVegetables']);
 only(FURNITURE_SOURCES67,['toilet']);
});

test('blocked requests cannot move either solo role, close the doors, or spend the elevator trip',()=>{
 for(const role of ['student','teacher']){
  const r=createSoloRound({role});r.start({gathering:true});board(r.player);
  for(const map of archived){
   assert.equal(r.travelFloor(map),false);
   assert.equal(r.elevator.targetMap,null);assert.equal(r.elevator.used,false);assert.equal(r.layout.elevatorClosed,false);
  }
  assert.ok(r.travelFloor('tiered8'));assert.equal(r.elevator.targetMap,'tiered');
  assert.equal(r.elevator.duration,4);r.step(4);assert.equal(r.snapshot().floor,4);
 }
});

test('stale room creation and floor requests resolve consistently for the host and its guest',()=>{
 for(const map of archived){
  const host=new PeerRoomHost({code:'980098',map,floor:10,settings:{duration:600,target:120,map}},()=>{});
  try{
   for(const client of ['host','guest']){
    const {room,state}=host.request(client,'/join',{});
    assert.equal(room.map,'classroom');assert.equal(state.map,'classroom');assert.equal(state.floor,2);
    board(host.clients.get(client).context.player);
   }
   const floor=target=>host.request('host','/api/command',{name:'travelFloor',args:[target]});
   assert.throws(()=>floor(map),/暂未开放/);assert.equal(host.room.elevator.used,false);
   assert.deepEqual(floor('night').results,[true]);host.room.tick(3);
   for(const member of host.clients.values()){
    const state=host.room.snapshot(member);assert.equal(state.map,'night');assert.equal(state.room.floor,3);
   }
  }finally{host.close();}
 }
});

test('a client detects an obsolete host on any suspended map on joining and when the host changes floors',()=>{
 for(const map of archived){
  const oldRoom=new CampusRoom({code:'980098',map});
  const member=oldRoom.join({}),room=oldRoom.publicRoom(member),state=oldRoom.snapshot(member);
  assert.throws(()=>new NetworkRound({result:{room,state}}),/地图暂未开放/);
  assert.throws(()=>readEvent(JSON.stringify(state),'state',room,{...state,map:'classroom'}),/地图暂未开放/);
 }
});
