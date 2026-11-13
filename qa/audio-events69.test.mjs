import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeacherFootsteps,soundForEvent} from '../dist/audio-events69.js';
import {createSoloRound} from '../dist/solo-round.js';
import {CampusRoom} from '../server/room-simulation.js';
import {audibleCue} from '../dist/sound-cue55.js';

const tick=(r,seconds)=>{for(let left=seconds;left>1e-8;){const dt=Math.min(1/60,left);r.step(dt);left-=dt;}};
function quietComputer(app){const r=createSoloRound({map:'computer',target:160,seed:73});r.start();r._advanceTeacher=()=>{};r._perceive=()=>{};r.teacher.x=r.teacher.z=50;for(const a of r.students)a._decisionAt=Infinity;assert.equal(r.startComputer(),true);assert.equal(r.computerApp(app),true);r.drainEvents();return r;}
function stepState(){return{role:'student',status:'playing',map:'classroom',paused:false,player:{id:0,x:0,z:0},teacher:{id:-1,x:0,z:0,visible:true},students:[{id:1,x:0,z:0}]};}
function walk(track,s,distance=2.6){const gains=[];track.sample(s);for(let i=0;i<Math.round(distance/.1);i++){const a=s.role==='teacher'?s.player:s.teacher;a.x+=.1;gains.push(track.sample(s));}return gains;}

test('local and remote students never create footsteps, even while running or crawling',()=>{
 const track=createTeacherFootsteps(),s=stepState();track.sample(s);
 for(let i=0;i<180;i++){s.player.x+=.1;s.students[0].x-=.1;s.player.crouched=i>90;assert.equal(track.sample(s),0);}
});
test('only teacher movement creates contacts, with monotonic listener distance attenuation and a finite range',()=>{
 const gainAt=z=>{const s=stepState();s.player.z=z;return walk(createTeacherFootsteps(),s).filter(Boolean)[0]||0;};
 assert.ok(gainAt(0)>gainAt(5));assert.ok(gainAt(5)>gainAt(10));assert.equal(gainAt(12),0);
 const local=stepState();local.role='teacher';assert.deepEqual(walk(createTeacherFootsteps(),local).filter(Boolean),[.54,.54]);
});
test('stationary, paused, seated, stunned, hidden, teleport and map-change states cannot emit phantom contacts',()=>{
 const s=stepState(),track=createTeacherFootsteps();track.sample(s);
 for(let i=0;i<100;i++)assert.equal(track.sample(s),0);
 s.teacher.x=100;assert.equal(track.sample(s),0);s.player.x=100;
 s.teacher.x+=1.2;s.map='computer';assert.equal(track.sample(s),0);
 for(const patch of[{paused:true},{status:'won'},{teacher:{seated:true}},{teacher:{stunLeft:2}},{teacher:{visible:false}},{teacher:{phase:'stunned'}}]){
  const base=stepState(),t=createTeacherFootsteps();walk(t,base,1.2);
  if(patch.teacher)Object.assign(base.teacher,patch.teacher);else Object.assign(base,patch);
  base.teacher.x+=.2;assert.equal(t.sample(base),0);
  Object.assign(base,{paused:false,status:'playing'});Object.assign(base.teacher,{seated:false,stunLeft:0,visible:true,phase:'patrol'});
  assert.equal(t.sample(base),0,'resuming establishes a fresh origin');
 }
 track.reset();assert.equal(track.sample(s),0);
});
test('teacher footstep contact counts depend on distance instead of rendering frame rate',()=>{
 for(const hz of[30,60,120]){const track=createTeacherFootsteps(),s=stepState();s.role='teacher';track.sample(s);let count=0;for(let i=0;i<hz*2;i++){s.player.x=6.5*(i+1)/(hz*2);if(track.sample(s))count++;}assert.equal(count,5);}
});
test('gum pop and phone alerts are global at identical gain, including remote teachers',()=>{
 for(const type of['gum-pop','phone-notification'])for(const listener of[{id:0,x:0,z:0},{id:9,x:1000,z:-1000},{id:-1,x:30,z:25}])assert.deepEqual(soundForEvent({type,studentId:0,x:0,z:0},listener),{kind:type,gain:.8});
});
test('chewing, drinking, inflation and computer effects are private regardless of proximity or recipient mistakes',()=>{
 for(const type of['use-crunch','use-gulp','gum-inflate','snake-food','snake-failed','valorant-watch']){
  const event={type,studentId:2,x:0,z:0,killIndex:3},owner={id:2,x:0,z:0};
  assert.ok(soundForEvent(event,owner));for(const id of[-1,0,3])assert.equal(soundForEvent(event,{id,x:0,z:0}),null);
  assert.equal(soundForEvent({...event,recipientId:3},owner),null);
 }
});
test('food completion, burp and chalk remain positional; unrelated score events do not duplicate sounds',()=>{
 for(const type of['food-complete','drink-complete','burp','chalk-throw','chalk-hit']){
  const event={type,x:0,z:0};const near=soundForEvent(event,{id:-1,x:0,z:0}),far=soundForEvent(event,{id:-1,x:8,z:0});assert.ok(near.gain>far.gain);assert.equal(soundForEvent(event,{id:-1,x:14,z:0}),null);
 }
 for(const type of['complete','gum-score','bubble-score','class-started'])assert.equal(soundForEvent({type,studentId:0},{id:0,x:0,z:0}),null);
 assert.equal(soundForEvent({type:'chalk',x:0,z:0},{id:0,x:0,z:0}).kind,'chalk-throw');
});
test('snake failure is emitted once on the alive-to-dead transition and again only after a new game',()=>{
 const r=quietComputer('snake'),kill=()=>{Object.assign(r.player._snake,{body:[{x:15,y:5}],direction:'right',pending:'right',tick:0});tick(r,.2);};
 kill();const first=r.drainEvents().filter(e=>e.type==='snake-failed');assert.equal(first.length,1);assert.equal(first[0].recipientId,r.player.id);
 tick(r,3);assert.equal(r.drainEvents().filter(e=>e.type==='snake-failed').length,0);
 r.computerBack();r.computerApp('snake');kill();assert.equal(r.drainEvents().filter(e=>e.type==='snake-failed').length,1);
});
test('actual advancing video awards cycle kill-feedback 1 through 5 once per score, then restart at 1',()=>{
 const r=quietComputer('valorant');r.setComputerPlayback({playing:true,visible:true,mediaTime:10});
 for(let n=1;n<=84;n++){tick(r,.25);r.setComputerPlayback({playing:true,visible:true,mediaTime:10+n*.25});}tick(r,1/60);
 const events=r.drainEvents().filter(e=>e.type==='valorant-watch');assert.equal(r.score,7);assert.deepEqual(events.map(e=>e.killIndex),[1,2,3,4,5,1,2]);assert.ok(events.every(e=>e.points===1));
 assert.deepEqual(events.map(e=>soundForEvent(e,r.player).kind),['game-kill-1','game-kill-2','game-kill-3','game-kill-4','game-kill-5','game-kill-1','game-kill-2']);
});
test('room snapshots route private cues to their owner while phone and gum events reach everyone exactly once',()=>{
 const room=new CampusRoom({code:'690071',seed:73}),teacher=room.join({rolePreference:'teacher'}),pupil=room.join({}),peer=room.join({});room.begin(teacher);for(let n=0;n<301;n++)room.tick(.1);
 for(const m of[teacher,pupil,peer])room.snapshot(m);
 const id=pupil.studentId;for(const type of['use-crunch','use-gulp','gum-inflate','snake-failed'])room.sim._events.push({type,studentId:id,recipientId:id});
 for(const type of['phone-notification','gum-pop'])room.sim._events.push({type,studentId:id,x:0,z:0});room.tick(1/60);
 for(const m of[teacher,pupil,peer]){const s=room.snapshot(m),events=s.events.filter(e=>['use-crunch','use-gulp','gum-inflate','snake-failed','phone-notification','gum-pop'].includes(e.type));assert.equal(events.length,m===pupil?6:2);assert.equal(events.filter(e=>e.type==='gum-pop').length,1);assert.equal(events.filter(e=>e.type==='phone-notification').length,1);assert.equal(room.snapshot(m).events.length,0);}
});
test('using a real phone or popping gum emits one located global cue and a distant teacher also receives its sound trace',()=>{
 for(const [action,seconds,eventType]of[['phone',3.05,'phone-notification'],['gum',6.05,'gum-pop']]){
  const r=createSoloRound({seed:73,target:160});r.start();r._advanceTeacher=()=>{};r._perceive=()=>{};r.teacher.x=r.teacher.z=100;
  for(const s of r.students)if(s!==r.player)Object.assign(s,{_decisionAt:Infinity,x:-100,z:-100});
  Object.assign(r.player,{action,_selectedSlot:0,_drawnSlot:0,seated:true,pitch:.55});r.player._slots[0]={id:0,action,progress:0,readyAt:0};r.selected=action;r.drainEvents();r.hold(true);tick(r,seconds);
  const events=r.drainEvents().filter(e=>e.type===eventType);assert.equal(events.length,1,action);assert.equal(events[0].recipientId,undefined);assert.ok([events[0].x,events[0].y,events[0].z].every(Number.isFinite));
  assert.equal(soundForEvent(events[0],{id:-1,x:100,z:100}).gain,.8);assert.equal(audibleCue(events[0],{id:-1,x:100,z:100}),true);
  tick(r,2);assert.equal(r.drainEvents().filter(e=>e.type===eventType).length,0);
 }
});
