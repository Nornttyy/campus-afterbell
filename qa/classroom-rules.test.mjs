import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound, CLASSROOM_ACTIONS, canSee, propVisibility} from '../dist/classroom-rules.js';
import {SEATS, PLAYER_SEAT, FRIEND_SEATS, AISLES, DESKS, blocked} from '../dist/classroom-layout.js';
const DT=1/60;
function advanceUntil(round,condition,seconds=120,control=()=>{}){
  for(let i=0;i<seconds*60;i++){const s=round.snapshot();if(condition(s))return s;control(s,round);round.step(DT);}
  assert.fail('Expected simulation condition was not reached.');
}
// Controlled perception fixture: an actual unobstructed seat observation, not an
// injected identification. It isolates vision/capture from other AI decisions.
function focusSeat(round,id){
  const actor=round.students[id],aisle=AISLES.reduce((a,x)=>Math.abs(x-actor.x)<Math.abs(a-actor.x)?x:a,AISLES[0]);
  round.teacher.x=aisle;round.teacher.z=actor.z;round.teacher.yaw=Math.atan2(actor.x-aisle,0);round.teacher.warning=false;
  round._turnLeft=0;round._perceive(0);
  round._plan={intent:'investigate',targetId:id,since:round.elapsed,until:round.elapsed+100,route:[],routeLength:0,arrivedAt:round.elapsed,utility:999};
  round.teacher.intent='investigate';round.teacher.targetId=id;round._thinkAt=round.elapsed+100;
  for(const s of round.students)if(s.isTeammate){s._decisionAt=Infinity;s.holding=false;s._smoke=0;}
  actor._smoke=0;actor.action='phone';actor.holding=true;
  if(actor.isPlayer){round.selectAction('phone');round.hold(true);}
}

test('30 shared seats, five team members, no default countdown and no ambient points',()=>{
  const r=new ClassroomRound();const s=r.snapshot();
  assert.equal(s.students.length,30);assert.equal(s.player.id,PLAYER_SEAT);
  assert.deepEqual(s.students.filter(s=>s.isTeammate).map(s=>s.id),[...FRIEND_SEATS]);
  assert.equal(s.students.filter(s=>!s.isPlayer&&!s.isTeammate).length,25);
  assert.equal(s.timed,false);assert.equal(s.timeLeft,0);assert.equal(s.target,100);
  r.step(100);assert.equal(r.snapshot().elapsed,0);assert.equal(r.snapshot().score,0);
  assert.deepEqual(s.teacher.observedIds,[]);
  s.students[0].x=999;s.teacher.memory.push({id:999});assert.notEqual(r.snapshot().students[0].x,999);assert.deepEqual(r.snapshot().teacher.memory,[]);
});

test('same seed, controls and elapsed time are deterministic across caller dt partitions',()=>{
  function run(chunk){const r=new ClassroomRound({seed:'观察教室',target:100000});r.start();const events=[];
    for(let second=0;second<25;second++){
      if(second===2)r.selectAction('phone');if(second===7)r.interact();if(second===10)r.setMovement(1,0);if(second===11)r.setMovement(0,0);if(second===12)r.useItem();
      r.hold(second%4<2);for(let n=0;n<Math.round(1/chunk);n++)r.step(chunk);events.push(...r.drainEvents());
    }return{state:r.snapshot(),events};}
  assert.deepEqual(run(1),run(DT));assert.deepEqual(run(.25),run(DT));
  const r=new ClassroomRound({seed:4});const initial=r.snapshot();r.start();r.step(3);r.reset();assert.deepEqual(r.snapshot(),initial);
});

test('FOV and range use actual geometry; smoke blocks the segment, not the whole room',()=>{
  const t={x:0,z:0,yaw:0};
  assert.equal(canSee(t,{x:0,z:8.9}),true);assert.equal(canSee(t,{x:0,z:9.1}),false);
  assert.equal(canSee(t,{x:0,z:-1}),false);assert.equal(canSee(t,{x:4,z:1}),false);
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
  const r=new ClassroomRound({target:100000});r.start();r._plan.until=100;
  r.hold(true);r.step(5);
  const s=r.snapshot(),memory=s.teacher.memory.find(m=>m.id===PLAYER_SEAT);
  assert.ok(memory&&memory.lastHeard!==null);assert.equal(memory.evidence,0);assert.equal(memory.confirmed,false);
  assert.equal(s.player.caught,false);assert.equal(s.teacher.looking,false);
  assert.equal(r.drainEvents().some(e=>e.type==='caught'),false);
});

test('movement collides with desks, can use an aisle, and standing actions earn no points',()=>{
  const r=new ClassroomRound({target:100000});r.start();assert.equal(r.interact(),'stood');
  r.hold(true);r.setMovement(0,1);r.step(2);
  let s=r.snapshot();const desk=DESKS[PLAYER_SEAT];assert.ok(s.player.z<=desk.minZ-.18+1e-6);assert.equal(blocked(s.player.x,s.player.z),false);assert.equal(s.actionProgress,0);
  r.setMovement(1,0);r.step(.62);r.setMovement(0,1);r.step(2);
  s=r.snapshot();assert.ok(s.player.z>SEATS[PLAYER_SEAT].z+1);assert.equal(blocked(s.player.x,s.player.z),false);
  assert.equal(s.completed.snack,0);assert.equal(s.holding,true);
  const other=new ClassroomRound();other.start();assert.equal(other.interact(),'stood');assert.equal(other.interact(),'seated');assert.equal(other.snapshot().player.seatId,PLAYER_SEAT);
});

test('pause freezes perception, AI, movement and smoke and resume needs fresh held input',()=>{
  const r=new ClassroomRound({target:100000});r.start();r.useItem();r.hold(true);r.step(1);r.interact();r.setMovement(1,0);r.pause(true);
  const before=r.snapshot();r.step(20);r.hold(true);r.setMovement(0,1);r.setLook(1,.5);r.useItem();r.requestHelp();assert.deepEqual(r.snapshot(),before);
  r.pause(false);assert.equal(r.snapshot().holding,false);r.step(.1);assert.equal(r.snapshot().player.x,before.player.x);
});

test('four classmates plan and complete actual actions; ordinary NPCs never score or generate evidence',()=>{
  const r=new ClassroomRound({seed:73,target:100000});r.start();r.step(15);
  const s=r.snapshot(),events=r.drainEvents(),completed=events.filter(e=>e.type==='complete');
  assert.ok(completed.length>0);assert.equal(s.score,completed.reduce((n,e)=>n+e.points,0));
  assert.ok(completed.every(e=>FRIEND_SEATS.includes(e.studentId)&&e.actor==='ai'));
  assert.equal(new Set(s.students.filter(s=>s.isTeammate).map(s=>s.personality)).size,4);
  assert.ok(new Set(s.students.filter(s=>s.isTeammate).map(s=>s.action)).size>1);
  for(const npc of s.students.filter(s=>!s.isPlayer&&!s.isTeammate)){assert.equal(npc.action,null);assert.equal(npc.holding,false);assert.deepEqual(npc.completed,{snack:0,note:0,phone:0});}
  for(const memory of s.teacher.memory.filter(m=>!FRIEND_SEATS.includes(m.id)&&m.id!==PLAYER_SEAT))assert.equal(memory.evidence,0);
  assert.equal(events.some(e=>e.type==='speech'),false);
});

test('teacher revisits remembered individuals and targets only previously seen or heard people',()=>{
  const r=new ClassroomRound({seed:73,target:100000});r.start();let targeted=0;
  for(let i=0;i<120*60;i++){r.step(DT);const t=r.snapshot().teacher;if(t.targetId!==null){assert.ok(t.observedIds.includes(t.targetId));targeted++;}}
  const memories=r.snapshot().teacher.memory;
  assert.ok(targeted>0);assert.ok(memories.some(m=>m.visits>1&&m.lastHeard!==null));
  assert.ok(memories.some(m=>m.evidence>15));
});

test('smoke is limited inventory, blocks evidence in world space and expires after seven seconds',()=>{
  const r=new ClassroomRound({target:100000});r.start();focusSeat(r,PLAYER_SEAT);r.player._smoke=1;
  assert.equal(r.useItem(),true);assert.equal(r.useItem(),false);assert.equal(r.snapshot().inventory.smoke,0);
  r.step(6.8);assert.equal(r.snapshot().smokes.length,1);assert.equal(r.snapshot().suspicion,0);assert.equal(r.snapshot().player.caught,false);
  r.step(.25);assert.equal(r.snapshot().smokes.length,0);assert.ok(r.snapshot().suspicion>0);
});

test('confirmed identification survives hiding, winds up chalk, then sends only that student to detention',()=>{
  const r=new ClassroomRound({target:100000});r.start();focusSeat(r,PLAYER_SEAT);
  advanceUntil(r,s=>s.teacher.memory.find(m=>m.id===PLAYER_SEAT)?.confirmed,10);
  r.hold(false);const before=r.snapshot().elapsed;
  advanceUntil(r,s=>s.teacher.castProgress>0,10);
  const windup=r.snapshot().elapsed;r.step(.3);assert.equal(r.snapshot().player.caught,false);
  const s=advanceUntil(r,s=>s.player.caught,10);
  assert.ok(s.elapsed-windup>=.7-DT-1e-6);assert.ok(s.elapsed>before);
  assert.equal(s.status,'playing');assert.equal(s.player.seated,false);assert.equal(s.player.seatId,null);assert.equal(s.player.z,5.1);
  assert.equal(r.hold(true),false);assert.equal(r.interact(),false);assert.equal(r.setMovement(1,0),false);assert.equal(r.setLook(1,0),true);
  const events=r.drainEvents();assert.equal(events.filter(e=>e.type==='caught'&&e.studentId===PLAYER_SEAT).length,1);assert.equal(events.filter(e=>e.type==='chalk'&&e.studentId===PLAYER_SEAT).length,1);
  assert.equal(events.some(e=>e.type==='finish'),false);
});

test('teacher victory requires all five team members, with one terminal event',()=>{
  const r=new ClassroomRound({target:100000});r.start();
  for(const [index,id] of [PLAYER_SEAT,...FRIEND_SEATS].entries()){
    focusSeat(r,id);advanceUntil(r,s=>s.students[id].caught,15);
    assert.equal(r.snapshot().status,index===4?'lost':'playing');
  }
  const s=r.snapshot();assert.equal(s.caughtCount,5);assert.equal(s.resultReason,'all-caught');
  assert.equal(r.drainEvents().filter(e=>e.type==='finish').length,1);r.step(30);r.start();r.hold(true);assert.deepEqual(r.snapshot(),s);assert.deepEqual(r.drainEvents(),[]);
});

test('a live cooperative session can fill the mischief meter without a task checklist',()=>{
  for(const seed of [1,27,73]){
    const r=new ClassroomRound({seed});r.start();
    const s=advanceUntil(r,s=>s.status!=='playing',480,(s,r)=>r.hold(!s.teacher.looking&&!s.teacher.warning));
    assert.equal(s.status,'won');assert.equal(s.score,s.target);assert.equal(s.resultReason,'mischief');
    assert.equal(s.completed.phone,0);assert.equal(s.completed.note,0);
    assert.ok(s.students.filter(v=>v.isTeammate).some(v=>Object.values(v.completed).some(n=>n>0)));
  }
});

test('development pacing permits observation and reckless play can naturally lose all five students',()=>{
  // These bounds protect the local prototype rhythm; they are not original-game values.
  for(const seed of [7,42,101]){
    const idle=new ClassroomRound({seed});idle.start();idle.step(30);
    assert.equal(idle.snapshot().status,'playing');assert.ok(idle.snapshot().score<40);
    const reckless=new ClassroomRound({seed});reckless.start();let s=reckless.snapshot(),walked=0,previous=s.teacher;
    for(let i=0;i<1200&&s.status==='playing';i++){
      reckless.hold(true);s=reckless.step(.25);
      walked+=Math.hypot(s.teacher.x-previous.x,s.teacher.z-previous.z);previous=s.teacher;
      if(s.teacher.targetId!==null)assert.ok(s.teacher.observedIds.includes(s.teacher.targetId));
    }
    assert.equal(s.status,'lost');assert.equal(s.resultReason,'all-caught');assert.equal(s.caughtCount,5);
    assert.ok(walked>50);assert.ok(s.teacher.memory.filter(m=>m.detained).every(m=>m.confirmed&&m.lastSeen!==null));
  }
});

test('help is assessed, cannot force a timed distracted phase, and invalid inputs are harmless',()=>{
  const r=new ClassroomRound();r.start();const before=r.snapshot();
  for(const n of [NaN,Infinity,-1,0,'1',null])r.step(n);
  for(const a of ['',null,'__proto__','run'])assert.equal(r.selectAction(a),false);
  assert.equal(r.setMovement(NaN,0),false);assert.equal(r.setLook(Infinity,0),false);assert.deepEqual(r.snapshot(),before);
  r.requestHelp();assert.notEqual(r.snapshot().teacher.phase,'distracted');assert.equal(r.snapshot().score,0);assert.equal(r.requestHelp(),false);
  const refused=new ClassroomRound();refused.start();for(const id of FRIEND_SEATS)refused.students[id].caught=true;
  assert.equal(refused.requestHelp(),false);assert.ok(refused.drainEvents().some(e=>e.type==='help'&&e.accepted===false));
  const bounded=new ClassroomRound({target:100000});bounded.start();bounded.step(1e9);assert.ok(bounded.snapshot().elapsed<=30);assert.ok(Number.isFinite(bounded.snapshot().elapsed));
});
