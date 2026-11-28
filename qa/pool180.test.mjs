import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {moveInRoom,blocked,actorEyePosition} from '../dist/classroom-layout.js';
import {POOL_LOCKERS,POOL_RADIO,poolFloor} from '../dist/pool-layout.js';
import {advancePoolStock} from '../dist/pool-stock.js';
import {CampusRoom} from '../dist/room-simulation.js';
const make=()=>{const r=new ClassroomRound({map:'pool',seed:18});r.start();return r;};
test('both changing rooms connect to the deck, submerged floor and return route',()=>{
 const r=make();
 for(const z of [-8,7]){
  let p={x:8.4,z};
  for(let i=0;i<325;i++)p=moveInRoom(p,-.075,0,.18,r.layout);
  assert.ok(p.x< -15,'pool exit at z='+z);
  const dz=z<0?.075:-.075;
  for(let i=0;i<125&&Math.abs(p.z)>.08;i++)p=moveInRoom(p,0,dz,.18,r.layout);
  assert.ok(Math.abs(p.z)<=.08);
  assert.ok(actorEyePosition({...p,id:9},'pool').y<0);
  for(let i=0;i<325;i++)p=moveInRoom(p,0,-dz,.18,r.layout);
  assert.ok(poolFloor(p.x,p.z)===0);
 }
 assert.ok(blocked(4,-.6,.18,r.layout),'changing rooms are separated');
 for(const s of r.seats.filter(s=>s.surface==='toilet')){
  Object.assign(r.player,{seated:false,x:s.exitX,z:s.exitZ});
  assert.equal(r.interact(s.id),'seated');assert.equal(r.interact(),'stood');
 }
});
test('locker and submerged stock have separate caps, item odds, timers and pickup ownership',()=>{
 const r=make(),stock=k=>[...r.groundItems.values()].filter(i=>i.poolSource===k);
 for(let i=1;i<=120;i++){r.elapsed=i;advancePoolStock(r);}
 assert.equal(stock('snack').length,5);
 const item=stock('snack')[0];Object.assign(r.player,{seated:false,x:item.x,z:item.z});
 assert.ok(r.takeGroundItem(item.id));assert.equal(r.takeGroundItem(item.id),false);
 r.elapsed=160;advancePoolStock(r);assert.equal(stock('snack').length,5);
 for(const [i,l] of POOL_LOCKERS.entries())assert.equal(stock('locker-'+i)[0].x,l.x);
 r._drawerRoll=()=>.9;r.groundItems.clear();r.elapsed=200;advancePoolStock(r);assert.equal(stock('tool').length,0);
 r._drawerRoll=()=>.03;r.elapsed=230;advancePoolStock(r);r.elapsed=290;advancePoolStock(r);assert.equal(stock('tool').length,1);
 r.reset();assert.equal(stock('tool').length,0);
});
test('shared pool round broadcasts one pickup, music starts on the two-second hold',()=>{
 const room=CampusRoom.forPlay({map:'pool',code:'180180',seed:6});
 const a=room.join({name:'A'}),b=room.join({name:'B'});const sim=room.sim;
 sim.stage='class';const item=Array.from(sim.groundItems.values())[0];
 for(const m of [a,b])Object.assign(m.context.player,{x:item.x,z:item.z,seated:false,id:m.context.player.id});
 assert.ok(room.withMember(a,r=>r.takeGroundItem(item.id)));
 assert.equal(room.withMember(b,r=>r.takeGroundItem(item.id)),false);
 assert.ok(!room.snapshot(b).groundItems.some(i=>i.id===item.id));
 const r=make();Object.assign(r.player,{seated:false,x:POOL_RADIO.x,z:POOL_RADIO.z+1});
 assert.ok(r.setFixtureUse('radio'));r.step(1.9);assert.equal(r.radio,null);r.step(.11);assert.ok(['track-window','track-weekend'].includes(r.radio.track));
});
