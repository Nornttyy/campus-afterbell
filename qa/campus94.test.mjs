import {checkFoodScore} from './food-award156.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {CampusRoom} from '../dist/room-simulation.js';
import {createSoloRound} from '../dist/solo-round.js';
import {CAMPUS_MAPS,campusFloor,actorEyeHeight,blocked,createSeatLayout,createLayoutContext,enclosureVolumes,detentionForMap} from '../dist/classroom-layout.js';
import {HOTPOT_RECIPES} from '../dist/hotpot-rules94.js';
import {createDeskHands} from '../dist/game-actors.js';
import {interactionIntent} from '../dist/interaction-intent54.js';

function lookAtPot(round,actor,pot){
 actor.yaw=Math.atan2(pot.x-actor.x,pot.z-actor.z);
 actor.pitch=Math.atan2(actorEyeHeight(actor,'hotpot')-1.10,Math.hypot(actor.x-pot.x,actor.z-pot.z));
}
test('public floor numbers, preserved floor aliases, and the four complete exam seating plans',()=>{
 assert.deepEqual(CAMPUS_MAPS,['playground','classroom','night','tiered','computer','toilet','hotpot','dorm','cafeteria','exam']);
 assert.equal(campusFloor('computer7'),7);assert.equal(campusFloor('bus'),0);
 const plans=[0,1,2,3].map(seed=>createSeatLayout(seed,null,'exam'));assert.equal(new Set(plans.map(s=>s[0].pattern)).size,4);
 for(const seats of plans){assert.equal(seats.length,32);const ctx=createLayoutContext(seats);for(const s of seats)assert.equal(blocked(s.x,s.z,.18,ctx),false);}
});
test('the visible post shafts block players and chalk in each classroom, including the dorm and upper deck',()=>{
 for(const map of CAMPUS_MAPS.filter(m=>m!=='playground').concat('bus')){
  const ctx=createLayoutContext(createSeatLayout(4,null,map));const volumes=enclosureVolumes(map,ctx);
  for(const post of detentionForMap(map)){
   if(map!=='bus')assert.equal(blocked(post.x,post.z,.18,ctx),true,map);
   assert.ok(volumes.some(v=>v.minX<post.x&&v.maxX>post.x&&v.minZ<post.z&&v.maxZ>post.z&&v.maxY-v.minY>1.9),map);
  }
 }
});
test('drawing, clicking to add ingredients, cooking and eating are separate physical actions in both plans',()=>{
 for(const seed of [6,73]){
  const r=createSoloRound({map:'hotpot',seed});r.start();r._perceive=()=>{};
  const p=r.player,pot=r.hotpots[r.seats[p.seatId].tableId];
  r.setDrawerOpen(true);assert.equal(r.takeSlot(0),true);const dish=r.snapshot().drawer.source.dish;assert.ok(HOTPOT_RECIPES[dish]);lookAtPot(r,p,pot);p.yaw+=Math.PI;assert.equal(r.hold(true),false);r.step(1);r.hold(false);
  assert.equal(pot.pieces.length,0);assert.equal(r.snapshot().actionProgress,0);
  r.hold(true);r.step(3);assert.equal(pot.pieces.length,0);r.hold(false);
  lookAtPot(r,p,pot);assert.equal(r.hold(true),true);assert.equal(r.hold(true),false);assert.equal(pot.pieces.length,HOTPOT_RECIPES[dish]);assert.equal(r.score,0);
  const id=pot.pieces[0].id;assert.equal(r.takeCookedPiece(pot.id,id),false);r.step(9.8);assert.equal(r.takeCookedPiece(pot.id,id),false);r.step(.25);
  assert.equal(r.takeCookedPiece(pot.id,id),true);assert.equal(r.returnItem(),true);assert.equal(r.takeCookedPiece(pot.id,id),true);
  p.pitch=0;r.hold(true);r.step(2.1);assert.equal(r.score,0);p.pitch=1.20;r.step(2.1);checkFoodScore(r.score,'hotpotBite');assert.equal(r.takeCookedPiece(pot.id,id),false);
 }
});
test('two guests share one pot, cannot take raw food or double-claim the last piece',()=>{
 const room=new CampusRoom({code:'cook',map:'hotpot',seed:73}),host=room.join({rolePreference:'teacher'}),a=room.join({}),b=room.join({});room.begin(host);room.sim.stage='class';const pot=room.sim.hotpots[0];
 for(const [i,m] of [a,b].entries()){
  const seat=room.sim.seats[i];Object.assign(m.context.player,{x:seat.x,z:seat.z,seated:true,seatId:seat.id});lookAtPot(room.sim,m.context.player,pot);
 }
 pot.pieces.push({id:99,dish:'lotus',readyAt:1});assert.equal(room.command(a,'takeCookedPiece',[0,99]),false);
 room.sim.elapsed=2;const before=room.snapshot(b);assert.equal(before.hotpots[0].pieces[0].dish,'lotus');
 assert.deepEqual(interactionIntent(before,{kind:'cooked-piece',id:0,piece:99},'E').args,[0,99]);assert.equal(room.command(a,'takeCookedPiece',[0,99]),true);
 assert.equal(room.command(b,'takeCookedPiece',[0,99]),false);assert.equal(room.snapshot(b).hotpots[0].pieces.length,0);
});

test('both cooking items have a visible stable first-person grip when seated and walking',()=>{
 const hands=createDeskHands();let tick=0;
 for(const action of ['hotpotPlate','hotpotBite']){
  for(const seated of [true,false]){
   for(let i=0;i<65;i++)hands.update(++tick/60,{action,mealDish:'lotus',seated,carrying:true,holding:true,eating:action==='hotpotBite',progress:i/65});
   const state=hands.getDebug();assert.equal(state.active,action);assert.equal(state.visible,true);assert.ok(state.propNDC.every(Number.isFinite));
  }
  for(let i=0;i<45;i++)hands.update(++tick/60,{seated:true,carrying:false});
 }
});

test('teacher practice opponents cook and eat from their table without changing the teacher hands',()=>{
 const r=createSoloRound({map:'hotpot',role:'teacher',seed:73});r.start();r._localRisk=()=>0;
 const student=r.students.find(a=>a.isTeammate),pot=r.hotpots[r.seats[student.seatId].tableId];
 for(const a of r.students)if(a!==student){a.isTeammate=false;a._slots=[];}
 student._decisionAt=0;student._restUntil=0;student._speed=1;student._profile.distraction=0;
 const held=r.selected;
 for(let t=0;t<46&&student.completed.hotpotBite===0;t++)r.step(1);
 assert.ok(student.completed.hotpotPlate>0);assert.ok(student.completed.hotpotBite>0);
 assert.ok(student._earnedPoints>0);assert.equal(r.selected,held);
 const solo=createSoloRound({map:'hotpot',seed:73});solo.start();solo.step(25);assert.ok(solo.hotpots.every(p=>!p.pieces.length));assert.equal(solo.score,0);
});

test('28 restroom stalls seat 20 individual classmates with independent doors and room for passing',()=>{
 const r=createSoloRound({map:'toilet',seed:73});r.start();const c=r.layout;
 assert.equal(r.seats.length,28);assert.equal(r.students.length,20);assert.equal(new Set(r.students.map(s=>s.seatId)).size,20);
 assert.equal(Object.keys(r.toiletDoors).length,28);
 for(const s of r.seats)assert.equal(blocked(s.exitX,s.exitZ,.20,c),false);
});

test('restroom snacks leave food scraps; flushing a phone or scraps rolls for a clog and never scores twice',()=>{
 for(const [item,roll,clogs] of [['snack',.049999,true],['phone',.05,false]]){
  const r=createSoloRound({map:'toilet',seed:6});r.start();const p=r.player,id=p.seatId;r._perceive=()=>{};
  p._slots[0].action=item;r.setDrawerOpen(true);r.takeSlot(0);r.setLook(p.yaw,1.20);
  if(item==='snack'){r.hold(true);r.step(2.05);assert.equal(p._drawnSlot,null);const trash=[...r.groundItems.values()].find(t=>t.action==='foodWaste');assert.ok(trash);assert.ok(r.takeGroundItem(trash.id));assert.equal(r.snapshot().selected,'foodWaste');assert.equal(r.hold(true),false);}
  const score=r.score;assert.equal(r.dropIntoToilet((id+1)%r.seats.length),false);
  r._drawerRoll=()=>roll;assert.equal(r.dropIntoToilet(id),true);assert.equal(r.toiletClogs[id],clogs);
  assert.equal(r.dropIntoToilet(id),false);assert.equal(r._events.filter(e=>e.type==='toilet-flush'&&e.toiletId===id).length,1);assert.equal(r.snapshot().drawer.drawnSlot,null);assert.equal(r.score,score);
  assert.equal(r.snapshot().toiletFlushes[id].item,item==='snack'?'foodWaste':'phone');
 }
});

test('finishing food in a cubicle drops one retrievable piece of waste while gum leaves none',()=>{
 for(const kind of ['snack','chips','noodles','drink','burger','banana','lunch','gum']){
  const round=createSoloRound({map:'toilet',seed:6});
  round.start();
  const player=round.player,slot=player._slots[0];
  slot.action=kind;
  assert.ok(round.setDrawerOpen(true));
  assert.ok(round.takeSlot(0));
  round._completeAction(player,slot);
  assert.equal(player._drawnSlot,null);
  const items=[...round.groundItems.values()];
  assert.equal(items.length,kind==='gum'?0:1,kind);
  if(items.length){
   assert.equal(items[0].action,'foodWaste');
   assert.ok(round.takeGroundItem(items[0].id),kind);
   assert.equal(round.takeGroundItem(items[0].id),false);
  }
 }
});
