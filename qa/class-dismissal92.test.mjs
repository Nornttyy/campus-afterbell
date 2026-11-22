import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoloRound} from '../dist/solo-round.js';
import {CAMPUS_MAPS,LIFT} from '../dist/classroom-layout.js';
import {reachedHall} from '../dist/class-dismissal92.js';
import {CampusRoom} from '../server/room-simulation.js';

for(const map of [...CAMPUS_MAPS,'bus']){
 test(map+' dismisses each visible AI through the lift and waits for the human to leave',()=>{
  const round=createSoloRound({seed:243,role:'student',map,duration:1});
  round.start();const result=round.step(1.1),live=round.step(.20);
  assert.equal(live.status,'lost');assert.ok(live.sceneElapsed>result.sceneElapsed);
  assert.equal(live.score,result.score);assert.equal(live.timeLeft,result.timeLeft);
  assert.ok(round.continueAfterClass());const dismissal=round._dismissal,entries=dismissal.queue;
  assert.ok(entries.length>=12);assert.ok(entries.every(e=>e.actor.visible!==false));
  const seen=new Set();let lastArrival=-1;
  for(let tick=0;tick<850&&seen.size<entries.length;tick++){
   round.step(.20);
   const arrived=entries.filter(e=>e.actor.visible===false&&!seen.has(e));
   assert.ok(arrived.length<=1,'the lift took multiple actors together');
   for(const e of arrived){
    assert.ok(Math.hypot(e.actor.x-LIFT.x,e.actor.z-LIFT.z)<.49,'an actor disappeared before reaching the cabin');
    const arrival=dismissal.nextExit-.36;assert.ok(arrival-lastArrival>=.35);lastArrival=arrival;seen.add(e);
   }
  }
  assert.equal(seen.size,entries.length,'every actor needs a route out');
  assert.equal(round.stage,'dismissal');assert.equal(reachedHall(round.player,map),false);
  assert.equal(round.layout.frontDoorClosed,false);
  Object.assign(round.player,{x:10,z:5,seated:false,busDeck:0});
  round.step(4);assert.equal(round.stage,'gathering');assert.equal(round.seed,244);
  assert.ok(Object.values(round.layout.doorMotion).every(leaf=>leaf.amount===0));
  assert.ok(reachedHall(round.player,map));
 });
}

test('a guest can acknowledge first and the last connected human controls the return to break',()=>{
 const room=new CampusRoom({code:'920092',seed:7}),host=room.join({rolePreference:'teacher'}),guest=room.join();
 room.begin(host);for(let i=0;i<310;i++)room.tick(.10);
 const seed=room.seed;
 room.sim._finish('lost','timeout');
 assert.ok(room.command(guest,'continueAfterClass'));
 assert.equal(room.snapshot(guest).continued,true);assert.equal(room.snapshot(host).continued,false);
 Object.assign(guest.context.player,{x:10,z:3,seated:false});
 Object.assign(host.context.player,{x:5,z:6,seated:false});
 for(let i=0;i<750;i++)room.tick(.10);
 assert.equal(room.sim.stage,'dismissal');assert.equal(room.sim.layout.frontDoorClosed,false);
 assert.ok(room.command(host,'continueAfterClass'));room.tick(.10);
 assert.equal(room.sim.stage,'dismissal');
 Object.assign(host.context.player,{x:10,z:4,seated:false});for(let i=0;i<45;i++)room.tick(.10);
 assert.equal(room.sim.stage,'gathering');assert.equal(room.seed,seed+1);
 assert.equal(room.snapshot(guest).room.code,'920092');assert.equal(room.members.size,2);
});
