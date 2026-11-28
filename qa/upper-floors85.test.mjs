import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoloRound} from '../dist/solo-round.js';
import {CampusRoom,MAX_ROOM_PLAYERS} from '../dist/room-simulation.js';
import {CAMPUS_MAPS,LIFT,campusFloor,blocked} from '../dist/classroom-layout.js';
import {elevatorDuration} from '../dist/elevator-session.js';
import {MEAL_COUNT,QUESTION_COUNT,mealPortion} from '../dist/upper-floors85.js';
import {paperQuestion} from '../dist/upper-floor-view85.js';
import {interactionIntent} from '../dist/interaction-intent54.js';

const enterLift=(p,i=0)=>Object.assign(p,{seated:false,x:LIFT.x+i*.25,z:LIFT.z});
for(const [index,map] of ['cafeteria','exam'].entries())test('the reopened '+map+' retains its floor number in solo and multiplayer',()=>{
 const floor=9+index;
 assert.equal(CAMPUS_MAPS[floor-1],map);assert.equal(campusFloor(map),floor);
 assert.equal(elevatorDuration('classroom',map),floor);assert.equal(elevatorDuration('cafeteria','exam'),3);
 for(const role of ['teacher','student']){
  const r=createSoloRound({role});r.start({gathering:true});enterLift(r.player);
  assert.equal(r.travelFloor(map),true);r.step(floor);
  assert.equal(r.snapshot().floor,floor);assert.equal(r.seats[0].map,map);assert.equal(r.snapshot().elevator.canTravel,false);
 }
 const room=new CampusRoom({code:'100009'}),host=room.join({name:'甲'}),guest=room.join({name:'乙'});
 enterLift(host.context.player);
 enterLift(guest.context.player,1);assert.throws(()=>room.command(guest,'travelFloor',[map]),/房主/);
 assert.ok(room.command(host,'travelFloor',[map]));room.tick(floor+1);
 for(const m of [host,guest]){const s=room.snapshot(m);assert.equal(s.floor,floor);assert.equal(s.map,map);assert.equal(s.elevator.used,true);}
 assert.equal(MAX_ROOM_PLAYERS,8);assert.throws(()=>new CampusRoom({code:'x',maxPlayers:9}),/2–8/);
});

test('two students cannot collect the same passing portion; return and next circuit work',()=>{
 const room=new CampusRoom({code:'caf',map:'cafeteria',seed:18});
 const lead=room.join({name:'老师',rolePreference:'teacher'}),a=room.join({name:'甲'}),b=room.join({name:'乙'});
 room.begin(lead);room.sim.stage='class';
 const food=mealPortion(0,0);
 assert.equal(blocked(food.x,food.z,.15,room.sim.layout),true);
 for(const m of [a,b])Object.assign(m.context.player,{x:food.x+.82,z:food.z,seated:false});
 assert.equal(room.command(a,'takeMeal',[0]),true);assert.equal(room.command(b,'takeMeal',[0]),false);
 assert.deepEqual(room.snapshot(b).mealsTaken,{0:0});assert.equal(room.snapshot(a).drawer.slots[0].action,food.action);
 assert.equal(room.command(a,'returnItem'),true);assert.equal(room.command(b,'takeMeal',[0]),true);
 room.sim._sessionElapsed=26;const next=mealPortion(0,26);assert.equal(next.lap,1);
 Object.assign(a.context.player,{x:next.x+.8,z:next.z});assert.equal(room.command(a,'takeMeal',[0]),true);
 assert.throws(()=>room.command(a,'takeMeal',[MEAL_COUNT]),/餐位/);assert.equal(room.snapshot(a).mealsTaken[0],1);
});

test('the exam requires reading a real card and writing its matching row, with interruptible holds',()=>{
 const r=createSoloRound({map:'exam',seed:73});r.start();const p=r.player;
 assert.equal(r.snapshot().drawer.slots.length,0);assert.equal(r.takePen(),false);
 assert.equal(r.setExamMode('card',0),false);r.setDrawerOpen(true);assert.equal(r.setExamMode('card',0),true);
 const q=r.snapshot().exam.card;r.setExamUse(-1);r.step(.7);assert.ok(r.snapshot().exam.progress>0);r.setExamUse(null);assert.equal(r.snapshot().exam.progress,0);
 r.setExamUse(-1);r.step(2);assert.equal(r.snapshot().exam.hint,q);assert.equal(r.score,0);r.setExamMode('close');
 assert.equal(r.setExamMode('paper'),true);assert.equal(r.setExamUse((q+1)%QUESTION_COUNT),false);
 assert.equal(r.setExamUse(q),true);r.step(.8);r.pause(true);assert.equal(r.snapshot().exam.progress,0);
 r.pause(false);r.setExamUse(q);r.step(2);assert.equal(r.score,q===11?4:2);assert.equal(r.snapshot().exam.answered,1<<q);assert.equal(r.setExamUse(q),false);
 r.setExamMode('close');r.setDrawerOpen(true);r.setExamMode('card',1);r.setExamUse(-1);r.step(2);const expired=r.snapshot().exam.card;r.setExamMode('close');r.step(10.1);
 assert.equal(r.setExamMode('paper'),true);assert.equal(r.setExamUse(expired),false);
 for(let i=0;i<12;i++)assert.equal(paperQuestion(i<6?.25:.70,1-(.193+(.5+i%6)*.12)),i);
 assert.equal(paperQuestion(.5,.98),null);assert.equal(p._examUse,null);
});
test('each exam guest gets a private card and the shared room scores the solved answer once',()=>{
 const room=new CampusRoom({code:'exam',map:'exam',seed:73}),h=room.join({name:'监考',rolePreference:'teacher'}),a=room.join({name:'甲'}),b=room.join({name:'乙'});
 room.begin(h);room.sim.stage='class';for(const m of [a,b]){const p=m.context.player,seat=room.sim.seats[p.id];Object.assign(p,{x:seat.x,z:seat.z,seated:true,seatId:seat.id});}
 assert.equal(room.snapshot(a).drawer.slots.length,0);assert.equal(room.command(a,'setDrawerOpen',[true]),true);
 assert.equal(room.command(a,'setExamMode',['card',0]),true);assert.equal(room.command(a,'setExamUse',[-1]),true);
 for(let i=0;i<121;i++)room.tick(1/60);const q=room.snapshot(a).exam.hint;assert.ok(Number.isInteger(q));assert.equal(room.snapshot(b).exam.hint,null);
 room.command(a,'setExamMode',['close']);room.command(a,'setExamMode',['paper']);room.command(a,'setExamUse',[q]);
 for(let i=0;i<121;i++)room.tick(1/60);assert.equal(room.snapshot(a).score,q===11?4:2);assert.equal(room.snapshot(b).score,q===11?4:2);
 assert.equal(room.snapshot(b).exam.answered,0);assert.equal(room.snapshot(a).exam.answered,1<<q);
 assert.throws(()=>room.command(h,'takeMeal',[0]),/不支持/);
});
test('live E and Q select one exam or meal action each',()=>{
 const r=createSoloRound({map:'exam'});r.start();let s=r.snapshot();assert.equal(interactionIntent(s,{kind:'exam-paper',id:2},'E').method,'setExamMode');
 r.setDrawerOpen(true);r.setExamMode('card',1);s=r.snapshot();assert.deepEqual(interactionIntent(s,{kind:'desk'},'Q').args,['close']);
 assert.equal(interactionIntent(s,{kind:'desk'},'E'),null);
});

test('a finished paper awards its completion bonus once and the desk supplies ordinary items afterwards',()=>{
 const r=createSoloRound({map:'exam',target:60,seed:73});r.start();
 // Keep the teacher looking at the board while exercising a long sequence of player input.
 r._perceive=()=>{};
 for(let i=0;i<12;i++){
  r.setDrawerOpen(true);assert.equal(r.setExamMode('card',i%2),true);
  assert.equal(r.setExamUse(-1),true);r.step(2);const q=r.snapshot().exam.hint;
  assert.ok(Number.isInteger(q));r.setExamMode('close');r.setExamMode('paper');r.setExamUse(q);r.step(2.02);r.setExamMode('close');
 }
 assert.equal(r.score,31);assert.equal(r.snapshot().exam.complete,true);assert.equal(r.setDrawerOpen(true),true);assert.equal(r.setExamMode('card',0),false);assert.equal(r.snapshot().drawer.slots.length,3);assert.equal(r.takeSlot(0),true);
});

test('the chicken bucket and layer cake keep the same appearance on the belt and in inventory',async()=>{
 const {createServingDish}=await import('../dist/game-actors.js');
 const r=createSoloRound({map:'cafeteria',seed:73});r.start();
 for(const [id,dish]of [[4,'chickenBucket'],[5,'layerCake']]){
  const p=mealPortion(id,r._sessionElapsed);assert.equal(p.dish,dish);
  const mesh=createServingDish(dish);assert.equal(mesh.name,dish);let triangles=0;
  mesh.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});assert.ok(triangles>0&&triangles<=8000);
  Object.assign(r.player,{seated:false,x:p.x+.8,z:p.z});assert.equal(r.takeMeal(id),true);assert.equal(r.snapshot().drawer.source.dish,dish);
  r.setLook(0,1.20);assert.equal(r.hold(true),true);r.step(2.05);assert.equal(r.snapshot().drawer.drawnSlot,null);
 }
 assert.ok(r.score>=2&&r.score<=3.6);
});

test('both conveyor prints travel with the meals through a serving-slot wrap',async()=>{
 const T=await import('../dist/vendor/three.module.js');
 const {createUpperFloorView}=await import('../dist/upper-floor-view85.js');
 const {SERVING_BELTS}=await import('../dist/upper-floors85.js');
 const view=createUpperFloorView({scene:new T.Scene(),box(){},mat:(color,opts)=>new T.MeshBasicMaterial({color,map:opts?.map||null}),texture:()=>new T.Texture()});
 try{
  view.setMap('cafeteria');
  const strips=[];
  view.root.traverse(o=>{if(o.material?.map?.wrapT===T.RepeatWrapping)strips.push(o);});
  assert.equal(strips.length,2);
  function printPhase(strip,z){
   const local=strip.worldToLocal(new T.Vector3(strip.position.x,strip.position.y,z));
   const uv=local.y/strip.geometry.parameters.height+.5;
   const map=strip.material.map;return uv*map.repeat.y+map.offset.y;
  }
  function sample(time){
   view.update({sceneElapsed:time});
   return strips.map((strip,i)=>{
    const carrier=view.target('meal',i*MEAL_COUNT/2+1);
    assert.equal(carrier.children.length,1);
    const bounds=new T.Box3().setFromObject(carrier,true);
    assert.ok(Math.abs(bounds.min.y-SERVING_BELTS[i].top)<.009);
    return printPhase(strip,carrier.position.z);
   });
  }
  const before=sample(24.9),after=sample(25.1);
  for(let i=0;i<2;i++){const delta=after[i]-before[i];assert.ok(Math.abs(delta-Math.round(delta))<1e-6);}
 }finally{view.dispose();}
});

test('first-person answer slip shares the palm render pass and leaves the hand on return',async()=>{
 const T=await import('../dist/vendor/three.module.js');
 const {createUpperFloorView}=await import('../dist/upper-floor-view85.js');
 const scene=new T.Scene(),handScene=new T.Scene(),palm=new T.Group(),observerHand=new T.Group();
 handScene.add(palm);scene.add(observerHand);
 const view=createUpperFloorView({scene,box(){},mat:(color,opts)=>new T.MeshBasicMaterial({color,map:opts?.map||null}),texture:()=>new T.Texture()});
 const seat={id:0,deskX:1,deskZ:2,yaw:.7};view.setMap('exam');view.setSeats([seat]);
 const state={player:{seated:true,seatId:0},students:[{readingAnswer:true,seated:true,seatId:1}],exam:{mode:'card',cards:[0,1],card:0},drawer:{open:true}};
 try{
  view.setReaderHand(1,observerHand);view.update(state);
  const tip=new T.Vector3(.02,.04,.01),hand={group:palm,setCurl(){},indexTip:()=>tip.clone(),aimThumb(){}};
  view.gripAnswerSlip(hand);
  const card=palm.getObjectByName('answer-card-in-hand');assert.ok(card?.visible);assert.equal(card.parent,palm);
  assert.ok(card.localToWorld(new T.Vector3(-.113,-.103,-.005)).distanceTo(palm.localToWorld(tip.clone()))<1e-6);
  assert.equal(observerHand.children.filter(o=>o.visible).length,1);
  state.exam.mode=null;state.students=[];view.update(state);assert.equal(card.visible,false);assert.equal(observerHand.children[0].visible,false);
 }finally{view.dispose();}
 assert.equal(palm.children.length,0);assert.equal(observerHand.children.length,0);
});
