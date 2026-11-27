import test from 'node:test';
import assert from 'node:assert/strict';
import {OPEN_CAMPUS_MAPS,playableCampusMap,assetsForOpenMaps} from '../dist/campus-destinations.js';
import {CAMPUS_MAPS,LIFT,campusFloor} from '../dist/classroom-layout.js';
import {elevatorDuration} from '../dist/elevator-session.js';
import {createSoloRound} from '../dist/solo-round.js';
import {PeerRoomHost} from '../dist/peer-room-host79.js';
import {CampusRoom} from '../dist/room-simulation.js';
import {readEvent} from '../dist/network-client.js';
import {CAMPUS_SURFACE_SOURCES} from '../dist/surface-materials.js';
import {CAMPUS_ARTWORK_SOURCES} from '../dist/campus-artwork.js';
import {FURNITURE_SOURCES67} from '../dist/furniture-assets67.js';

const reopened=['cafeteria','exam','toilet','dorm'];
const board=p=>Object.assign(p,{x:LIFT.x,z:LIFT.z,seated:false});
test('only the ten numbered destinations can be selected for a room',()=>{
 assert.deepEqual(OPEN_CAMPUS_MAPS,CAMPUS_MAPS);assert.equal(OPEN_CAMPUS_MAPS.length,10);assert.equal(playableCampusMap('bus'),null);
 assert.equal(playableCampusMap('missing'),null);assert.equal(playableCampusMap('tiered8'),'tiered');
 for(const map of OPEN_CAMPUS_MAPS){const r=CampusRoom.forPlay({map,code:'980098'});assert.equal(r.sim.map,map);assert.equal(r.floor,campusFloor(map));}
 for(const assets of [CAMPUS_SURFACE_SOURCES,CAMPUS_ARTWORK_SOURCES,FURNITURE_SOURCES67])assert.deepEqual(assetsForOpenMaps(assets),Object.fromEntries(Object.entries(assets).filter(([key])=>key!=='upholstery')));
});
test('solo lift takes both roles to the reopened floors',()=>{
 for(const role of ['student','teacher'])for(const map of reopened){
  const r=createSoloRound({role});r.start({gathering:true});board(r.player);
  assert.ok(r.travelFloor(map));assert.equal(r.elevator.targetMap,map);r.step(elevatorDuration('classroom',map));assert.equal(r.snapshot().map,map);
 }
});
test('peer hosted rooms and client snapshots accept every reopened map',()=>{
 for(const map of reopened){
  const host=new PeerRoomHost({code:'980098',map,floor:campusFloor(map)},()=>{});
  try{
   for(const client of ['host','guest']){
    const result=host.request(client,'/join',{});assert.equal(result.room.map,map);assert.equal(result.state.floor,campusFloor(map));
    assert.doesNotThrow(()=>readEvent(JSON.stringify(result.state),'state',result.room,result.state));board(host.clients.get(client).context.player);
   }
   assert.deepEqual(host.request('host','/api/command',{name:'travelFloor',args:['classroom']}).results,[true]);host.room.tick(elevatorDuration(map,'classroom'));
   for(const member of host.clients.values())assert.equal(host.room.snapshot(member).map,'classroom');
  }finally{host.close();}
 }
});
