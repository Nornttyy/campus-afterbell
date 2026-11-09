import test from 'node:test';
import assert from 'node:assert/strict';
import {drawerHandTarget} from '../dist/drawer-hand-target58.js';
import {createSeatLayout,LAYOUT_PATTERNS,OFFICE_DESKS,OFFICE_CHAIRS} from '../dist/classroom-layout.js';

test('all classroom layouts keep the open tray in front of seated hands without double applying floor height',()=>{
 for(const map of ['classroom','computer','tiered'])for(const pattern of LAYOUT_PATTERNS){
  const seats=createSeatLayout(19,pattern,map);
  for(const seat of seats){const player={...seat,seatId:seat.id,seatYaw:seat.yaw,seated:true};
   const target=drawerHandTarget({player,drawer:{open:true},seats,map,amount:1});
   assert.ok(Math.abs(target.centerX)<1e-9);assert.ok(Math.abs(target.centerZ+.46)<1e-9);
   assert.equal(target.floor,map==='computer'?.620:.659);assert.equal(target.width,map==='computer'?.51:.93);
  }
 }
});
test('office targets follow each real desk and retain its full drawer width',()=>{
 for(const desk of OFFICE_DESKS){const chair=OFFICE_CHAIRS.find(c=>c.deskId===desk.id),p={...chair,seated:true,seatYaw:chair.yaw,officeChair:true,officeDeskId:desk.id};
  const target=drawerHandTarget({player:p,drawer:{open:true},seats:[],map:'classroom',amount:1});
  assert.ok(Math.abs(target.centerX)<1e-9);assert.ok(Math.abs(target.centerZ+.54)<1e-9);
  assert.equal(target.floor,.57);assert.equal(target.lip,.82);assert.equal(target.width,1.38);
 }
});
test('drawer target travels with the physical tray, and drops when standing or captured',()=>{
 const seats=createSeatLayout(),s=seats[0],player={...s,seatId:s.id,seated:true,seatYaw:s.yaw};
 const get=(amount,p=player)=>drawerHandTarget({player:p,drawer:{open:true},seats,map:'classroom',amount});
 const shut=get(0),half=get(.5),open=get(1);
 assert.ok(Math.abs(half.centerZ-(shut.centerZ+open.centerZ)/2)<1e-9);
 assert.ok(Math.abs(open.centerZ-shut.centerZ-.24)<1e-9);
 assert.equal(get(1,{...player,seated:false}),null);assert.equal(get(1,{...player,caught:true}),null);
});
