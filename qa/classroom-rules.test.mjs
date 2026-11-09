import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound, CLASSROOM_ACTIONS, DEVELOPMENT_TUNING, canSee, propVisibility} from '../dist/classroom-rules.js';
import {SEATS, PLAYER_SEAT, FRIEND_SEATS, AISLES, DESKS, DETENTION, blocked} from '../dist/classroom-layout.js';
const DT=1/60;
function advanceUntil(round,condition,seconds=120,control=()=>{}){
  for(let i=0;i<seconds*60;i++){const s=round.snapshot();if(condition(s))return s;control(s,round);round.step(DT);}
  assert.fail('Expected simulation condition was not reached.');
}
function takeAndUse(round){round.setLook(round.player.yaw,.55);const s=round.snapshot();if(s.drawer.drawnSlot===null)round.takeSlot(s.drawer.selectedSlot);return round.hold(true);}
function choose(round,index){if(round.snapshot().drawer.drawnSlot!==null)round.returnItem();return round.selectSlot(index);}
function useAvailable(round,state=round.snapshot()){
  if(state.player.caught)return;
  if(!state.drawer.open)round.toggleDrawer();
  if(!state.drawer.slots[state.drawer.selectedSlot].action){const slot=state.drawer.slots.find(slot=>slot.action);if(slot)round.selectSlot(slot.id);}
  if(state.holding&&CLASSROOM_ACTIONS[state.selected]?.releaseToUse&&state.actionProgress>=.5)round.releaseUse();else takeAndUse(round);
}
function quietFixture(seed=73){
  const round=new ClassroomRound({seed,target:100000});round.start();round.player.pitch=.55;
  round.teacher.x=30;round.teacher.z=30;round._thinkAt=Infinity;round._plan.route=[];round._plan.until=Infinity;
  for(const actor of round.students)if(actor.isTeammate){actor._decisionAt=Infinity;actor.holding=false;}
  return round;
}
// Controlled perception fixture: an actual unobstructed seat observation, not an
// injected identification. It isolates vision/capture from other AI decisions.
function focusSeat(round,id){
  const actor=round.students[id],aisle=AISLES.reduce((a,x)=>Math.abs(x-actor.x)<Math.abs(a-actor.x)?x:a,AISLES[0]);
  round.teacher.x=aisle;round.teacher.z=actor.z;round.teacher.yaw=Math.atan2(actor.x-aisle,0);round.teacher.warning=false;
  round._turnLeft=0;round._perceive(0);
  round._plan={intent:'investigate',targetId:id,since:round.elapsed,until:round.elapsed+100,route:[],routeLength:0,arrivedAt:round.elapsed,utility:999};
  round.teacher.intent='investigate';round.teacher.targetId=id;round._thinkAt=round.elapsed+100;
  for(const s of round.students)if(s.isTeammate){s._decisionAt=Infinity;s.holding=false;}
  // A stocked phone isolates perception from the randomly drawn item mix.
  actor._selectedSlot=0;Object.assign(actor._slots[0],{action:'phone',progress:0,readyAt:0});actor.action='phone';actor.holding=true;
  if(actor.isPlayer){if(!round.snapshot().drawer.open)round.toggleDrawer();round.selectAction('phone');takeAndUse(round);}
}

test('30 shared seats, five team members, a ten-minute clock and no ambient points',()=>{
  const r=new ClassroomRound();const s=r.snapshot();
  assert.equal(s.students.length,30);assert.equal(s.player.id,PLAYER_SEAT);
  assert.deepEqual(s.students.filter(s=>s.isTeammate).map(s=>s.id),[...FRIEND_SEATS]);
  assert.equal(s.students.filter(s=>!s.isPlayer&&!s.isTeammate).length,25);
  assert.equal(s.timed,true);assert.equal(s.timeLeft,600);assert.equal(s.target,120);
  r.step(100);assert.equal(r.snapshot().elapsed,0);assert.equal(r.snapshot().score,0);
  assert.deepEqual(s.teacher.observedIds,[]);
  s.students[0].x=999;s.teacher.memory.push({id:999});assert.notEqual(r.snapshot().students[0].x,999);assert.deepEqual(r.snapshot().teacher.memory,[]);
});

test('same seed, controls and elapsed time are deterministic across caller dt partitions',()=>{
  function run(chunk){const r=new ClassroomRound({seed:'观察教室',target:100000});r.start();r.toggleDrawer();const events=[];
    for(let second=0;second<25;second++){
      if(second===2)r.selectAction('phone');if(second===7)r.interact();if(second===10)r.setMovement(1,0);if(second===11)r.setMovement(0,0);if(second===12)r.returnItem();
      r.hold(second%4<2);for(let n=0;n<Math.round(1/chunk);n++)r.step(chunk);events.push(...r.drainEvents());
    }return{state:r.snapshot(),events};}
  assert.deepEqual(run(1),run(DT));assert.deepEqual(run(.25),run(DT));
  const r=new ClassroomRound({seed:4});const initial=r.snapshot();r.start();r.step(3);r.reset();assert.deepEqual(r.snapshot(),initial);
});

test('FOV and range use actual geometry; smoke blocks the segment, not the whole room',()=>{
  const t={x:0,z:-3,yaw:0};
  assert.equal(canSee(t,{x:0,z:5.9}),true);assert.equal(canSee(t,{x:0,z:6.1}),false);
  assert.equal(canSee(t,{x:0,z:-4}),false);assert.equal(canSee(t,{x:4,z:-2}),false);
  assert.equal(canSee(t,{x:0,z:6},[{x:0,z:3,radius:1,remaining:2}]),false);
  assert.equal(canSee(t,{x:0,z:6},[{x:4,z:3,radius:1,remaining:2}]),true);
  assert.equal(canSee(t,{x:0,z:6},[{x:0,z:3,radius:1,remaining:0}]),true);
});

test('book protection is directional and weakens when the teacher approaches or stands beside the desk',()=>{
  const pupil={x:0,z:0,seated:true,crouched:false};
  const front={x:0,z:5,yaw:Math.PI},side={x:4,z:0,yaw:-Math.PI/2},near={x:0,z:1.8,yaw:Math.PI};
  assert.ok(propVisibility(front,pupil)<propVisibility(side,pupil));
  assert.ok(propVisibility(front,pupil)<propVisibility(near,pupil));
  assert.ok(propVisibility(front,{...pupil,crouched:true})<propVisibility(front,pupil));
});

test('heard noise can be remembered without visual evidence or a red card',()=>{
  const r=new ClassroomRound({target:100000});r.start();r._plan.until=100;r.teacher.x=r.player.x;r.teacher.z=r.player.z+5;r.teacher.yaw=0;
  r.player._slots[0].action='snack';
  r.toggleDrawer();assert.equal(r.selectAction('snack'),true);takeAndUse(r);r.step(5);
  const s=r.snapshot(),memory=s.teacher.memory.find(m=>m.id===PLAYER_SEAT);
  assert.ok(memory&&memory.lastHeard!==null);assert.equal(memory.evidence,0);assert.equal(memory.confirmed,false);
  assert.equal(s.player.caught,false);assert.equal(s.teacher.looking,false);
  assert.equal(r.drainEvents().some(e=>e.type==='caught'),false);
});

test('movement collides with desks, can use an aisle, and standing actions earn no points',()=>{
  const r=new ClassroomRound({target:100000});r.start();r.player._slots[0].action='snack';r.toggleDrawer();takeAndUse(r);assert.equal(r.interact(),'stood');
  takeAndUse(r);r.setMovement(0,1);r.step(2);
  let s=r.snapshot();const desk=DESKS[PLAYER_SEAT];assert.ok(s.player.z<=desk.minZ-.18+1e-6);assert.equal(blocked(s.player.x,s.player.z),false);assert.equal(s.actionProgress,0);
  r.setMovement(-1,0);r.step((r.player.x-AISLES[0])/DEVELOPMENT_TUNING.walkSpeed);r.setMovement(0,1);r.step(2);
  s=r.snapshot();assert.ok(s.player.z>SEATS[PLAYER_SEAT].z+1);assert.equal(blocked(s.player.x,s.player.z),false);
  assert.equal(s.completed.snack,0);assert.equal(s.holding,true);
  const other=new ClassroomRound();other.start();assert.equal(other.interact(),'stood');assert.equal(other.interact(),'seated');assert.equal(other.snapshot().player.seatId,PLAYER_SEAT);
});

test('pause freezes perception, AI, movement and smoke and resume needs fresh held input',()=>{
  const r=quietFixture();r.toggleDrawer();Object.assign(r.player._slots[0],{action:'smoke',progress:0,readyAt:0});r.takeSlot(0);r.hold(true);r.step(.6);r.releaseUse();
  assert.equal(r.snapshot().projectiles.length,1);r.selectSlot(1);takeAndUse(r);r.step(1);r.interact();r.setMovement(1,0);r.pause(true);
  const before=r.snapshot();r.step(20);takeAndUse(r);r.setMovement(0,1);r.setLook(1,.5);r.toggleBook();assert.deepEqual(r.snapshot(),before);
  r.pause(false);assert.equal(r.snapshot().holding,false);r.step(.1);assert.equal(r.snapshot().player.x,before.player.x);
});

test('four classmates plan and complete actual actions; ordinary NPCs never score or generate evidence',()=>{
  const r=new ClassroomRound({seed:73,target:100000});r.start();r.step(15);
  const s=r.snapshot(),events=r.drainEvents(),completed=events.filter(e=>e.type==='complete');
  assert.ok(completed.length>0);assert.equal(s.score,completed.reduce((n,e)=>n+e.points,0));
  assert.ok(completed.every(e=>FRIEND_SEATS.includes(e.studentId)&&e.actor==='ai'));
  assert.equal(new Set(s.students.filter(s=>s.isTeammate).map(s=>s.personality)).size,4);
  assert.ok(new Set(s.students.filter(s=>s.isTeammate).map(s=>s.action)).size>1);
  for(const npc of s.students.filter(s=>!s.isPlayer&&!s.isTeammate)){assert.equal(npc.action,null);assert.equal(npc.holding,false);assert.deepEqual(npc.completed,Object.fromEntries(Object.keys(CLASSROOM_ACTIONS).map(k=>[k,0])));}
  for(const memory of s.teacher.memory.filter(m=>!FRIEND_SEATS.includes(m.id)&&m.id!==PLAYER_SEAT))assert.equal(memory.evidence,0);
  assert.equal(events.some(e=>e.type==='speech'),false);
});

test('teacher revisits remembered individuals and targets only previously seen or heard people',()=>{
  const r=new ClassroomRound({seed:73,target:100000});r.start();let targeted=0,revisited=false,observedEvidence=false;
  for(let i=0;i<120*60;i++){r.step(DT);const t=r.snapshot().teacher;revisited ||= t.memory.some(m=>m.visits>1&&m.lastHeard!==null);observedEvidence ||= t.memory.some(m=>m.evidence>15);if(t.targetId!==null){assert.ok(t.observedIds.includes(t.targetId));targeted++;}}
  const memories=r.snapshot().teacher.memory;
  assert.ok(targeted>0);assert.ok(revisited,'teacher revisited a known source before rescue could clear the memory');
  assert.ok(observedEvidence);
});

test('smoke must be thrown from a consumed drawer slot before impact creates a growing cloud',()=>{
  const r=quietFixture();Object.assign(r.player._slots[0],{action:'smoke',progress:0,readyAt:0});
  assert.equal(r.hold(true),false);r.step(1);assert.equal(r.snapshot().projectiles.length,0);
  r.toggleDrawer();r.takeSlot(0);r.step(1);assert.equal(r.snapshot().projectiles.length,0);
  r.hold(true);r.step(.6);assert.equal(r.snapshot().projectiles.length,0);r.releaseUse();
  let s=r.snapshot();assert.equal(s.completed.smoke,1);assert.equal(s.score,0);assert.equal(s.drawer.slots[0].action,null);
  assert.equal(s.drawer.slots[0].readyIn,3);assert.equal(s.projectiles.length,1);assert.equal(s.smokes.length,0);assert.equal(r.hold(true),false);
  const launch=s.projectiles[0];r.step(.15);s=r.snapshot();assert.ok(Math.hypot(s.projectiles[0].x-launch.x,s.projectiles[0].z-launch.z)>.5);assert.equal(s.smokes.length,0);
  s=advanceUntil(r,s=>s.smokes.length===1,3);const cloud=s.smokes[0];assert.equal(cloud.ownerId,r.player.id);assert.ok(s.projectiles[0].bounces>0);
  const source={x:cloud.x-1,z:cloud.z,yaw:Math.PI/2},target={x:cloud.x+1,z:cloud.z};
  assert.equal(canSee(source,target,s.smokes),true,'A just-starting wisp is not opaque');
  r.step(1.5);s=r.snapshot();assert.ok(s.smokes[0].radius>cloud.radius);assert.equal(canSee(source,target,s.smokes),false);
  const ready=r.snapshot();r.pause();r.step(10);assert.deepEqual(r.snapshot().projectiles,ready.projectiles);r.pause(false);
  r.step(6);assert.equal(r.snapshot().smokes.length,0);assert.equal(r.snapshot().projectiles.length,0);assert.equal(canSee(source,target,r.snapshot().smokes),true);
});

test('confirmed identification survives hiding, stuns, physically escorts and binds only that student',()=>{
  const r=new ClassroomRound({target:100000});r.start();focusSeat(r,PLAYER_SEAT);
  advanceUntil(r,s=>s.teacher.memory.find(m=>m.id===PLAYER_SEAT)?.confirmed,10);
  r.hold(false);const before=r.snapshot().elapsed;
  advanceUntil(r,s=>s.teacher.castProgress>0,10);
  const windup=r.snapshot().elapsed;r.step(.3);assert.equal(r.snapshot().player.caught,false);
  const carried=advanceUntil(r,s=>s.player.captivity==='carried',10);assert.equal(carried.caughtCount,0);assert.notEqual(carried.player.z,DETENTION[0].z-.39);
  const s=advanceUntil(r,s=>s.player.caught,35);
  assert.ok(s.elapsed-windup>=.7-DT-1e-6);assert.ok(s.elapsed>before);
  assert.equal(s.status,'playing');assert.equal(s.player.seated,false);assert.equal(s.player.seatId,null);assert.ok(Math.abs(s.player.z-(DETENTION[0].z-.39))<1e-9);
  assert.equal(r.takeSlot(0),false);assert.equal(r.hold(true),true);assert.equal(r.snapshot().player.bubble.blowing,true);r.hold(false);assert.equal(r.interact(),false);assert.equal(r.setMovement(1,0),false);assert.equal(r.setLook(1,0),true);
  const events=r.drainEvents();assert.equal(events.filter(e=>e.type==='bound'&&e.studentId===PLAYER_SEAT).length,1);assert.equal(events.filter(e=>e.type==='chalk'&&e.studentId===PLAYER_SEAT).length,1);
  assert.equal(events.some(e=>e.type==='finish'),false);
});

test('teacher victory requires all five team members, with one terminal event',()=>{
  const r=new ClassroomRound({target:100000});r.start();
  for(const [index,id] of [PLAYER_SEAT,...FRIEND_SEATS].entries()){
    // Isolate terminal capture accounting; recovery travel is verified in view-movement55.
    r.teacher.stamina=100;r.teacher._recoveringStamina=false;focusSeat(r,id);advanceUntil(r,s=>s.students[id].caught,60);
    if(index===4&&r.status==='playing')r.step(DT);
    assert.equal(r.snapshot().status,index===4?'lost':'playing');
  }
  const s=r.snapshot();assert.equal(s.caughtCount,5);assert.equal(s.resultReason,'all-caught');
  assert.equal(r.drainEvents().filter(e=>e.type==='finish').length,1);r.step(30);r.start();takeAndUse(r);assert.deepEqual(r.snapshot(),s);assert.deepEqual(r.drainEvents(),[]);
});

test('a live cooperative session can fill the mischief meter without a task checklist',()=>{
  for(const seed of [1,27,73]){
    const r=new ClassroomRound({seed});r.start();
    const s=advanceUntil(r,s=>s.status!=='playing',480,(s,r)=>{if(!s.teacher.looking&&!s.teacher.warning)useAvailable(r,s);else{r.hold(false);r.returnItem();}});
    assert.equal(s.status,'won');assert.equal(s.score,s.target);assert.equal(s.resultReason,'mischief');
    assert.ok(Object.values(s.completed).some(n=>n>0));
    assert.ok(s.students.filter(v=>v.isTeammate).some(v=>Object.values(v.completed).some(n=>n>0)));
  }
});

test('three-second pacing permits observation, actual scoring and valid terminal results',()=>{
  // These bounds protect the local prototype rhythm; they are not original-game values.
  for(const seed of [7,42,101]){
    const idle=new ClassroomRound({seed});idle.start();idle.step(30);
    assert.equal(idle.snapshot().status,'playing');assert.ok(idle.snapshot().score<40);
    // Isolate defeat from the faster three-second scoring target.
    const reckless=new ClassroomRound({seed});reckless.start();focusSeat(reckless,PLAYER_SEAT);for(const friend of reckless.students.filter(s=>s.isTeammate))friend._decisionAt=.5;let s=reckless.snapshot(),walked=0,previous=s.teacher;
    for(let i=0;i<2400&&s.status==='playing';i++){
      useAvailable(reckless,s);s=reckless.step(.25);
      walked+=Math.hypot(s.teacher.x-previous.x,s.teacher.z-previous.z);previous=s.teacher;
      if(s.teacher.targetId!==null)assert.ok(s.teacher.observedIds.includes(s.teacher.targetId));
    }
    assert.ok(['won','lost'].includes(s.status));
    if(s.status==='lost'){assert.equal(s.resultReason,'all-caught');assert.equal(s.caughtCount,5);}
    else{assert.equal(s.resultReason,'mischief');assert.equal(s.score,s.target);assert.ok(reckless.drainEvents().some(e=>e.type==='bound'),'students should have been bound before possible rescues');}
    assert.ok(walked>50);assert.ok(s.teacher.memory.filter(m=>m.detained).every(m=>m.confirmed&&m.lastSeen!==null));
  }
});

test('drawers start with three independent seeded draws, permit repeats, and cannot reroll by opening',()=>{
  const mixes=new Set();
  for(let seed=1;seed<=24;seed++){
    const r=new ClassroomRound({seed}),initial=r.snapshot().drawer;
    assert.equal(initial.open,false);assert.equal(initial.drawnSlot,null);assert.equal(initial.slots.length,3);
    assert.deepEqual(initial.slots.map(slot=>slot.id),[0,1,2]);
    assert.ok(initial.slots.every(slot=>Object.hasOwn(CLASSROOM_ACTIONS,slot.action)&&slot.readyIn===0));
    mixes.add(initial.slots.map(slot=>slot.action).join(','));
    r.start();for(let i=0;i<6;i++)assert.equal(r.toggleDrawer(),true);
    assert.deepEqual(r.snapshot().drawer,initial);
    initial.slots[0].action=null;assert.notEqual(r.snapshot().drawer.slots[0].action,null);
    r.reset();assert.deepEqual(r.snapshot(),new ClassroomRound({seed}).snapshot());
  }
  assert.ok(mixes.size>6,'The pool must be sampled with replacement, rather than just shuffled.');
  assert.ok([...mixes].some(mix=>new Set(mix.split(',')).size<3));assert.ok([...mixes].some(mix=>mix.includes('smoke')));
  for(const kind of ['drink','burger'])assert.ok([...mixes].some(mix=>mix.split(',').includes(kind)),`${kind} must be in ordinary drawers`);
});

test('a stocked item must be taken from an open drawer, then may be held while closed or standing',()=>{
  const r=quietFixture();
  r.player._slots.forEach((slot,index)=>slot.action=['drink','snack','snack'][index]);
  assert.equal(takeAndUse(r),false);assert.equal(r.selectSlot(1),true);assert.equal(r.snapshot().drawer.open,false);assert.equal(takeAndUse(r),false);
  assert.equal(r.toggleDrawer(),true);assert.equal(takeAndUse(r),true);assert.equal(r.snapshot().drawer.drawnSlot,1);
  assert.equal(r.toggleDrawer(),true);r.step(1);assert.equal(r.snapshot().holding,true);assert.equal(r.snapshot().actionProgress,.333333);
  r.hold(false);assert.equal(takeAndUse(r),true); // A concealed, already taken item remains available.
  const stock=r.snapshot().drawer.slots;r.interact();r.step(1);
  assert.equal(r.snapshot().drawer.open,false);assert.equal(r.toggleDrawer(),false);assert.equal(r.selectSlot(2),false);
  assert.equal(r.snapshot().actionProgress,0);assert.deepEqual(r.snapshot().drawer.slots,stock);assert.equal(r.snapshot().score,0);
  r.interact();assert.equal(r.selectSlot(2),false);assert.equal(r.returnItem(),true);r.toggleDrawer();assert.equal(r.selectSlot(2),true);assert.equal(r.snapshot().drawer.drawnSlot,null);assert.equal(takeAndUse(r),false);
  assert.equal(r.selectAction('phone'),false);assert.equal(r.selectAction('snack'),true);assert.equal(r.snapshot().drawer.selectedSlot,2);
  const before=r.snapshot();for(const index of [-1,3,.5,'1',null,NaN])assert.equal(r.selectSlot(index),false);assert.deepEqual(r.snapshot(),before);
});

test('duplicate objects keep independent progress and only the completed slot is consumed',()=>{
  const r=quietFixture(1);r.player._slots.forEach(s=>s.action='drink');r.toggleDrawer();takeAndUse(r);r.step(2);
  assert.equal(r.snapshot().actionProgress,.666667);
  choose(r,1);assert.equal(r.snapshot().actionProgress,0);assert.equal(r.snapshot().holding,false);
  takeAndUse(r);r.step(1);assert.equal(r.snapshot().actionProgress,.333333);
  choose(r,0);assert.equal(r.snapshot().actionProgress,0);takeAndUse(r);r.step(3);
  const s=r.snapshot();assert.equal(s.completed.drink,1);assert.equal(s.score,CLASSROOM_ACTIONS.drink.points);assert.equal(s.holding,false);assert.equal(s.drawer.drawnSlot,null);
  assert.deepEqual(s.drawer.slots[0],{id:0,action:null,readyIn:DEVELOPMENT_TUNING.drawerRefill});
  assert.equal(s.drawer.slots[1].action,'drink');assert.equal(s.drawer.slots[2].action,'drink');
  assert.equal(r.selectSlot(0),false);assert.equal(r.selectAction('drink'),true);assert.equal(r.snapshot().drawer.selectedSlot,1);assert.equal(r.snapshot().actionProgress,0);
});

test('consumed slots refill independently after three active seconds, with no automatic scoring',()=>{
  const r=quietFixture();r.player._slots.forEach(s=>s.action='snack');r.toggleDrawer();
  r.takeSlot(2);r.hold(true);r.step(1.5);r.returnItem();assert.equal(r.player._slots[2].progress,0);r.takeSlot(0);r.hold(true);r.step(3);
  assert.equal(r.snapshot().drawer.slots[0].readyIn,3);assert.equal(r.hold(true),false);
  r.takeSlot(2);r.hold(true);r.step(3);let s=r.snapshot();
  assert.equal(s.drawer.slots[0].readyIn,0);assert.equal(s.drawer.slots[2].readyIn,3);assert.equal(s.score,2);
  r.pause();const paused=r.snapshot();r.step(20);r.toggleDrawer();r.takeSlot(1);assert.deepEqual(r.snapshot(),paused);r.pause(false);
  assert.ok(r.snapshot().drawer.slots[0].action);r.step(1.5);s=r.snapshot();
  assert.ok(Object.hasOwn(CLASSROOM_ACTIONS,s.drawer.slots[0].action));assert.equal(s.drawer.slots[0].readyIn,0);assert.equal(s.drawer.slots[2].readyIn,1.5);
  r.step(1.5);s=r.snapshot();assert.ok(s.drawer.slots[2].action);assert.equal(s.holding,false);assert.equal(s.score,2);
  r.step(10);assert.equal(r.snapshot().score,2);assert.equal(r.snapshot().actionProgress,0);
});

test('AI completions consume their own stocked slots and empty AI drawers wait for refills',()=>{
  const r=quietFixture(42),ids=[...FRIEND_SEATS];
  for(const id of ids){const actor=r.students[id];actor._decisionAt=0;for(const slot of actor._slots)Object.assign(slot,{action:null,readyAt:3,progress:0});}
  r.step(3-DT);let s=r.snapshot();assert.equal(s.score,0);assert.ok(s.students.filter(actor=>actor.isTeammate).every(actor=>!actor.holding&&actor.drawer.slots.every(slot=>slot.action===null)));
  r.step(DT);assert.ok(r.snapshot().students.filter(actor=>actor.isTeammate).every(actor=>actor.drawer.slots.every(slot=>slot.action)));
  r.drainEvents();let completions=0,earned=0;
  for(let frame=0;frame<35*60;frame++){
    const before=r.snapshot();s=r.step(DT);
    const events=r.drainEvents();earned+=events.filter(e=>['complete','gum-score','snake-food'].includes(e.type)).reduce((sum,e)=>sum+(e.points||0),0);for(const event of events.filter(event=>event.type==='complete')){
      completions++;assert.equal(event.actor,'ai');assert.ok(ids.includes(event.studentId));
      const previous=before.students[event.studentId].drawer.slots[event.slotId],actor=s.students[event.studentId],slot=actor.drawer.slots[event.slotId];
      assert.equal(previous.action,event.action);assert.equal(slot.action,event.action==='banana'?'bananaPeel':null);assert.equal(slot.readyIn,event.action==='banana'?0:3);assert.equal(actor.holding,false);
    }
  }
  assert.ok(completions>=4);assert.equal(s.score,earned);
});

test('invalid inputs are harmless and removed help skill is unavailable',()=>{
  const r=new ClassroomRound();r.start();const before=r.snapshot();
  for(const n of [NaN,Infinity,-1,0,'1',null])r.step(n);
  for(const a of ['',null,'__proto__','run'])assert.equal(r.selectAction(a),false);
  assert.equal(r.setMovement(NaN,0),false);assert.equal(r.setLook(Infinity,0),false);assert.deepEqual(r.snapshot(),before);
  assert.equal(r.requestHelp,undefined);
  const bounded=new ClassroomRound({target:100000});bounded.start();bounded.step(1e9);assert.ok(bounded.snapshot().elapsed<=30);assert.ok(Number.isFinite(bounded.snapshot().elapsed));
});

test('E takes without using, left release retains the item, Q returns without duplicating stock',()=>{
 const r=quietFixture(1);r.player._slots[1].action='phone';r.toggleDrawer();const original=r.snapshot().drawer.slots;
 assert.equal(r.hold(true),false,'Left click must not take from the drawer');
 assert.equal(r.takeSlot(1),true);assert.equal(r.snapshot().drawer.drawnSlot,1);assert.equal(r.snapshot().holding,false);
 r.step(1);assert.equal(r.snapshot().actionProgress,0);assert.equal(r.snapshot().score,0);
 assert.equal(r.takeSlot(2),false);assert.equal(r.selectSlot(2),false);
 assert.equal(r.hold(true),true);r.step(1);r.hold(false);const progress=r.snapshot().actionProgress;
 assert.ok(progress>0);r.step(1);assert.equal(r.snapshot().drawer.drawnSlot,1);assert.equal(r.snapshot().actionProgress,progress);
 r.toggleDrawer();assert.equal(r.returnItem(),true);assert.equal(r.snapshot().drawer.open,true);assert.equal(r.snapshot().drawer.drawnSlot,null);
 assert.deepEqual(r.snapshot().drawer.slots,original);assert.equal(r.returnItem(),false);assert.equal(r.hold(true),false);
 assert.equal(r.takeSlot(1),true);assert.equal(r.snapshot().actionProgress,progress);
 r.pause();const paused=r.snapshot();assert.equal(r.returnItem(),false);assert.deepEqual(r.snapshot(),paused);r.pause(false);
 r.interact();assert.equal(r.returnItem(),false,'Cannot put an item back from another place in the room');
 r.interact();assert.equal(r.returnItem(),true);
});

// Measure the public interaction clock, including an interrupted hold.
test('ordinary drawer actions complete at exactly three active held seconds',()=>{
 for(const action of ['snack','phone','drink','burger']){
  const r=quietFixture();Object.assign(r.player._slots[0],{action,progress:0,readyAt:0});r.toggleDrawer();r.takeSlot(0);
  assert.equal(CLASSROOM_ACTIONS[action].duration,3);r.step(5);assert.equal(r.snapshot().actionProgress,0);
  r.hold(true);r.step(1);r.hold(false);r.step(2);assert.equal(r.snapshot().completed[action],0);
  r.hold(true);r.step((action==='phone'?2:3)-DT);assert.equal(r.snapshot().completed[action],0);assert.ok(r.snapshot().actionProgress<1);
  r.step(DT);assert.equal(r.snapshot().completed[action],1);assert.equal(r.snapshot().drawer.slots[0].readyIn,3);assert.equal(r.snapshot().drawer.drawnSlot,null);assert.equal(r.snapshot().score,CLASSROOM_ACTIONS[action].points);
 }
});

test('classmates use drinks and burgers through the same stock, scoring and refill rules',()=>{
 for(const kind of ['drink','burger']){
  const r=quietFixture(),actor=r.students[FRIEND_SEATS[0]];actor._decisionAt=0;
  for(const slot of actor._slots)Object.assign(slot,{action:kind,readyAt:0,progress:0});
  const done=advanceUntil(r,s=>s.students[actor.id].completed[kind]===1,10);
  const event=r.drainEvents().find(e=>e.type==='complete'&&e.studentId===actor.id);
  assert.equal(event.action,kind);assert.equal(event.actor,'ai');assert.equal(event.points,1);assert.equal(done.score,1);
  assert.deepEqual(done.students[actor.id].drawer.slots[event.slotId],{id:event.slotId,action:null,readyIn:3});
  assert.equal(done.completed[kind],0,'AI statistics must not count as player completions');
  assert.ok(Object.values(done.students[actor.id].completed).every(Number.isFinite));
  r.step(3-DT);assert.equal(r.snapshot().students[actor.id].drawer.slots[event.slotId].action,null);
  r.step(DT);assert.ok(r.snapshot().students[actor.id].drawer.slots[event.slotId].action);
 }
});

function heldSmoke(){const r=quietFixture();Object.assign(r.player._slots[0],{action:'smoke',progress:0,readyAt:0});r.toggleDrawer();r.takeSlot(0);return r;}
test('a smoke tap throws immediately on release, consumes exactly one item and cannot repeat',()=>{
 const r=heldSmoke();r.hold(true);assert.equal(r.releaseUse(),true);const s=r.snapshot();
 assert.equal(s.elapsed,0);assert.equal(s.projectiles.length,1);assert.equal(s.projectiles[0].charge,0);
 assert.equal(s.completed.smoke,1);assert.equal(s.drawer.slots[0].readyIn,3);assert.equal(s.drawer.drawnSlot,null);
 assert.equal(r.releaseUse(),false);assert.equal(r.snapshot().projectiles.length,1);
});
test('smoke charge increases throw distance, saturates and waits indefinitely for release',()=>{
 const speeds=[];
 for(const seconds of [0,.6,1.2,6]){
  const r=heldSmoke();r.hold(true);r.step(seconds);const s=r.snapshot();
  assert.equal(s.projectiles.length,0);assert.equal(s.completed.smoke,0);assert.equal(s.drawer.drawnSlot,0);
  assert.equal(s.actionProgress,Math.min(seconds/1.2,1));
  r.releaseUse();const p=r.snapshot().projectiles[0];speeds.push(Math.hypot(p.vx,p.vy,p.vz));
 }
 assert.ok(speeds[0]<speeds[1]&&speeds[1]<speeds[2]);assert.ok(Math.abs(speeds[2]-speeds[3])<1e-9);
});
test('put back, pause and input cancellation cancel charge without throwing or losing the grenade',()=>{
 for(const cancel of [r=>r.hold(false),r=>r.returnItem(),r=>r.pause(true)]){
  const r=heldSmoke();r.hold(true);r.step(.8);cancel(r);r.releaseUse();const s=r.snapshot();
  assert.equal(s.projectiles.length,0);assert.equal(s.completed.smoke,0);assert.equal(s.drawer.slots[0].action,'smoke');assert.equal(s.actionProgress,0);
 }
 const r=heldSmoke();r.interact();r.hold(true);r.setLook(Math.PI/2,0);r.releaseUse();assert.ok(r.snapshot().projectiles[0].vx>4);
});

test('smoke waits half a second after settling; wall hits and airborne bounces never start it',()=>{
 for(const aim of [{yaw:0,pitch:0,charge:0},{yaw:Math.PI/2,pitch:-.6,charge:1},{yaw:Math.PI,pitch:.6,charge:.5}]){
  const r=heldSmoke();r.setLook(aim.yaw,aim.pitch);r.hold(true);r.step(aim.charge*1.2);r.releaseUse();
  let p,previousRest=0,hadImpactInAir=false;
  for(let i=0;i<600;i++){
   r.step(DT);p=r.projectiles[0];
   if(p.firstImpact!==null&&!p.settled)hadImpactInAir=true;
   if(!p.settled||p.restTime<.5-1e-9)assert.equal(r.smokes.length,0,'No smoke during flight or the landing delay');
   if(r.smokes.length){
    assert.equal(p.settled,true);assert.ok(p.restTime>=.5-1e-9&&previousRest<.5);
    assert.deepEqual([r.smokes[0].x,r.smokes[0].y,r.smokes[0].z],[p.x,p.y,p.z]);break;
   }
   previousRest=p.restTime;
  }
  assert.ok(hadImpactInAir);assert.equal(r.smokes.length,1);
 }
});
test('pausing during the half-second landing delay cannot ignite a grenade',()=>{
 const r=heldSmoke();r.hold(true);r.releaseUse();advanceUntil(r,s=>s.projectiles[0].settled,5);r.step(.2);
 const before=r.snapshot();r.pause();r.step(20);assert.deepEqual(r.snapshot().projectiles,before.projectiles);assert.equal(r.smokes.length,0);
 r.pause(false);r.step(.2);assert.equal(r.smokes.length,0);r.step(.15);assert.equal(r.smokes.length,1);
});


test('book interaction changes real cover, survives leaving the seat, and freezes on pause',()=>{
 const r=quietFixture(11);const id=r.player.seatId;
 assert.equal(r.snapshot().books[id].raised,true);r.toggleBook();r.step(.25);
 assert.equal(r.snapshot().books[id].amount,0);
 const observer={x:r.player.x+Math.sin(r.player.seatYaw)*3,z:r.player.z+Math.cos(r.player.seatYaw)*3,yaw:r.player.seatYaw+Math.PI};
 assert.ok(Math.abs(propVisibility(observer,r.player)-1)<1e-8);
 r.pause(true);assert.equal(r.toggleBook(),false);r.step(1);assert.equal(r.snapshot().books[id].amount,0);
 r.pause(false);r.toggleBook();r.step(.25);assert.ok(propVisibility(observer,r.player)<.3);
 r.interact();assert.equal(r.toggleBook(),false);assert.equal(r.snapshot().books[id].raised,true);
});


test('AI chalk telegraphs a fixed aim, stays physical and permits dodging during windup',()=>{
  const r=quietFixture(),p=r.player,t=r.teacher;
  Object.assign(p,{x:1.42,z:0,seated:false,seatId:null});Object.assign(t,{x:1.42,z:2.7,yaw:Math.PI,warning:false});
  const m=r._remember(p);Object.assign(m,{confirmed:true,x:p.x,z:p.z});
  r._plan={intent:'catch',targetId:p.id,since:0,until:100,route:[],routeLength:0,arrivedAt:0};r._turnLeft=0;
  Object.assign(p._slots[0],{action:'phone',progress:0});p._selectedSlot=0;p._drawnSlot=0;r.selected=p.action='phone';r.hold(true);
  r.step(.1);assert.ok(r.snapshot().teacher.castProgress>0);assert.equal(r.holding,true,'windup must not confiscate the player action');
  p.x+=.85;r.step(.6);
  assert.ok(r.snapshot().chalks.length>0,'windup ends by launching visible chalk');assert.equal(p.captivity,'free');
  r.step(.35);assert.equal(p.captivity,'free','a miss must not stun the remembered target');
});

test('AI chalk cannot cross classroom walls to stun the remembered player',()=>{
  const r=quietFixture();Object.assign(r.player,{x:8.25,z:0,seated:false,seatId:null});
  r.chalks.push({id:0,x:6.4,y:1.5,z:0,vx:16,vy:0,vz:0,age:0});r.step(.2);
  assert.equal(r.player.captivity,'free');assert.equal(r.chalks.length,0);assert.ok(r.drainEvents().some(e=>e.type==='chalk-hit'&&e.kind==='wall'));
});
