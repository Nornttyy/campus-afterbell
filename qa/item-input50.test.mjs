import test from 'node:test';
import assert from 'node:assert/strict';
import {createClassroomGame} from '../dist/classroom-game.js';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {DETENTION} from '../dist/classroom-layout.js';

// Keep the production mouse/keyboard handlers, frame loop, HUD and simulation.
// Only DOM rendering and WebGL are replaced; this is not a screenshot test.
function fixture({map='classroom',teacher=false}={}){
 const saved=new Map(),nodes=new Map(),frames=new Map();let now=0,nextFrame=0,target=null,commands,rendered=null,computer=false,playback=null,axes={side:0,forward:0,crawl:false};const sounds=[],worldEffects=[];
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.style={};this.attrs={};this.open=false;this.classList={add(){},remove(){},toggle(){}};}
  setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}focus(){}showModal(){this.open=true;}close(){this.open=false;}
 }
 const doc=new EventTarget(),win=new EventTarget();doc.body=new Element();
 doc.querySelector=id=>{if(id==='#locker-dialog[open]')return null;if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 const canvas=doc.querySelector('#classroom');doc.pointerLockElement=canvas;doc.exitPointerLock=()=>doc.pointerLockElement=null;canvas.requestPointerLock=()=>doc.pointerLockElement=canvas;
 for(const[name,value]of Object.entries({document:doc,window:win,performance:{now:()=>now},requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id)})){saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});}
 const round=new (teacher?TeacherRound:ClassroomRound)({map,target:100000});round._advanceTeacher=()=>{};round._perceive=()=>{};round._hear=()=>{};
 const game=createClassroomGame({round,scene:{getComputerPlayback:()=>typeof playback==='function'?playback(now/1000):playback,setGameplay:s=>rendered=s,getInteraction:()=>target,playFeedback(){},playWorldEffect:e=>worldEffects.push(e)},audio:{apply(){},start(){},effect:(...args)=>sounds.push(args),click(){}},sessionFactory:options=>{commands=options.commands;return{touch:false,get computer(){return computer;},axes:()=>axes,update:s=>computer=!!s.player.computerActive,reset(){computer=false;},dispose(){}};}});game.start();
 for(const s of round.students)s._decisionAt=Infinity;round.teacher.x=round.teacher.z=40;
 const send=(type,props={})=>{const e=new Event(type,{cancelable:true});for(const[k,v]of Object.entries(props))Object.defineProperty(e,k,{value:v});doc.dispatchEvent(e);};
 const advance=seconds=>{for(let left=seconds;left>1e-9;){const dt=Math.min(1/60,left);left-=dt;now+=dt*1000;const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(now);}};
 return{round,commands,sounds,worldEffects,setPlayback:value=>playback=value,setAxes:value=>axes={...axes,...value},get rendered(){return rendered;},element:doc.querySelector,advance,mouse:pressed=>send(pressed?'mousedown':'mouseup',{button:0}),key:code=>{send('keydown',{code});send('keyup',{code});},target:t=>target=t,
  take(kind){round.player.pitch=.55;round.player._slots[0]={id:0,action:kind,progress:0,readyAt:0};round.player._selectedSlot=0;round.player._drawnSlot=null;round.selected=round.player.action=kind;target={kind:'desk'};if(!round.player._drawerOpen)this.key('KeyE');target={kind:'item',slot:0};this.key('KeyE');target=null;assert.equal(round.snapshot().drawer.drawnSlot,0);},
  close(){game.dispose();for(const[name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
 };
}

test('production E and mouse input show one gum circle per 1.5 seconds, grow it and pop at four',()=>{
 const f=fixture();try{f.take('gum');f.mouse(true);f.advance(.375);let ring=f.element('#use-progress');assert.equal(ring.hidden,false);assert.ok(Math.abs(Number(ring.attrs['aria-valuenow'])-25)<=1);assert.equal(ring.style.width,'54px');
  f.advance(1.5);assert.ok(Math.abs(Number(ring.attrs['aria-valuenow'])-25)<=1);assert.equal(ring.style.width,'67px');assert.equal(f.round.score,1);
  f.advance(4.125);assert.equal(f.round.score,6);assert.equal(f.round.player._slots[0].action,null);assert.equal(ring.hidden,true);assert.equal(f.rendered.player.bubble.progress,0);f.mouse(false);
 }finally{f.close();}
});
test('bound mouse hold stays at four circles, and release without contact launches orange bubble',()=>{
 const f=fixture();try{const r=f.round,p=r.player;Object.assign(r.teacher,{x:p.x,z:p.z-.7});r._stun(p);r._grab(p);Object.assign(r.teacher,{x:DETENTION[0].x,z:DETENTION[0].z-.9});r._bind(0);r.teacher.x=r.teacher.z=40;f.advance(.02);f.mouse(true);f.advance(7);
  assert.equal(f.element('#use-progress').attrs['aria-valuenow'],'100');assert.equal(f.element('#use-progress').style.width,'106px');assert.equal(f.rendered.player.bubble.cycles,4);assert.equal(r.bubbles.length,0);f.mouse(false);assert.equal(f.rendered.bubbles.length,1);assert.equal(f.rendered.bubbles[0].kind,'orange');assert.equal(f.rendered.player.bubble.progress,0);
 }finally{f.close();}
});
test('production food input converts banana to a throwable peel and garlic to a five-second click ability',()=>{
 const f=fixture();try{f.take('banana');f.mouse(true);f.advance(3);assert.equal(f.rendered.selected,'bananaPeel');assert.equal(f.rendered.drawer.drawnSlot,0);f.mouse(false);assert.equal(f.round.peels.length,0);f.mouse(true);f.mouse(false);assert.equal(f.rendered.peels.length,1);assert.equal(f.rendered.drawer.drawnSlot,null);
  f.take('garlic');f.mouse(true);f.advance(3);assert.equal(f.rendered.player.burpReadyLeft,5);assert.equal(f.round.burps.length,0);f.mouse(false);f.mouse(true);assert.equal(f.rendered.burps.length,1);assert.equal(f.rendered.player.burpReadyLeft,0);f.mouse(false);
 }finally{f.close();}
});
test('E takes a harmless twirling pen, toggles writing, and Q returns without opening storage',()=>{
 const f=fixture();try{f.target({kind:'pen'});f.key('KeyE');f.target(null);f.advance(4);assert.equal(f.rendered.player.penTwirling,true);assert.equal(f.rendered.player.penWriting,false);assert.equal(f.round.score,0);assert.equal(f.element('#use-progress').hidden,true);
  f.target({kind:'desk'});f.key('KeyE');f.advance(.1);assert.equal(f.rendered.player.penWriting,true);assert.equal(f.rendered.drawer.open,false);f.mouse(true);f.advance(3);f.mouse(false);assert.equal(f.round.score,0);assert.equal(f.rendered.player.penWriting,true);
  f.key('KeyQ');f.advance(.1);assert.equal(f.rendered.player.penTaken,false);assert.equal(f.rendered.player.penWriting,false);assert.equal(f.rendered.drawer.drawnSlot,null);assert.equal(f.rendered.drawer.open,false);
 }finally{f.close();}
});
test('computer E entry, app command and arrow keys score real snake food and preserve one three-second slot',()=>{
 const f=fixture({map:'computer7'});try{f.target({kind:'computer'});f.key('KeyE');f.advance(.1);assert.equal(f.rendered.player.computerActive,true);assert.equal(f.rendered.player.computer.app,'desktop');f.commands.app('snake');f.advance(.65);assert.equal(f.round.score,1);assert.equal(f.rendered.player.computer.snake.score,1);f.key('ArrowUp');f.advance(.16);assert.equal(f.rendered.player.computer.snake.direction,'up');f.key('KeyQ');f.advance(.1);assert.equal(f.rendered.player.computer.app,'desktop');assert.equal(f.rendered.player.computerActive,true);f.key('KeyQ');f.advance(.1);assert.equal(f.rendered.player.computerActive,false);
  f.take('burger');f.mouse(true);f.advance(3);f.mouse(false);assert.equal(f.rendered.drawer.slots.length,1);assert.equal(f.rendered.drawer.slots[0].readyIn,3);f.advance(3-1/60);assert.equal(f.rendered.drawer.slots[0].action,null);f.advance(1/60);assert.ok(f.rendered.drawer.slots[0].action);
 }finally{f.close();}
});
test('teacher production left click requires but does not consume stamina and is blocked while stunned',()=>{
 const f=fixture({teacher:true});try{const r=f.round;r.teacher.stamina=20;f.mouse(true);f.mouse(false);assert.equal(r.teacher.stamina,20);f.advance(.8);f.mouse(true);f.mouse(false);assert.equal(r.teacher.stamina,20);r.teacher.stamina=100;r._stunAny(r.teacher,4,'bananaPeel');f.mouse(true);f.mouse(false);assert.equal(r.teacher.stamina,100);assert.equal(f.rendered.teacher.phase,'stunned');assert.ok(f.rendered.teacher.stunLeft>0);
 }finally{f.close();}
});


test('production mouse release clears a partly eaten meal, raised head pauses, and low head resumes only while held',()=>{
 const f=fixture();try{f.take('burger');f.round.setLook(0,0);f.mouse(true);f.advance(1);assert.equal(f.rendered.actionProgress,0);assert.equal(f.rendered.player.eating,false);f.round.setLook(0,.55);f.advance(1);assert.ok(f.rendered.actionProgress>.30);f.round.setLook(0,.1);const before=f.round.snapshot().actionProgress;f.advance(.5);assert.equal(f.rendered.actionProgress,before);f.mouse(false);assert.equal(f.round.snapshot().actionProgress,0);f.round.setLook(0,.55);f.mouse(true);f.advance(3);assert.equal(f.round.score,1);f.mouse(false);assert.equal(f.sounds.filter(([kind])=>kind==='food-complete').length,1);assert.equal(f.worldEffects.filter(e=>e.type==='food-complete').length,1);}finally{f.close();}
});
test('production WASD and touch stick choose desktop apps without moving the seated player, E opens and Q goes back',()=>{
 const f=fixture({map:'computer'});try{f.target({kind:'computer'});f.key('KeyE');f.advance(.1);const before={x:f.round.player.x,z:f.round.player.z};f.key('KeyD');f.key('KeyE');assert.equal(f.round.snapshot().player.computer.app,'unity');f.key('KeyQ');assert.equal(f.round.snapshot().player.computer.app,'desktop');f.setAxes({forward:-1});f.advance(.1);f.setAxes({forward:0});f.key('KeyE');assert.equal(f.round.snapshot().player.computer.app,'valorant');f.advance(1);assert.equal(f.round.score,0);assert.deepEqual({x:f.round.player.x,z:f.round.player.z},before);f.key('KeyQ');f.key('KeyQ');assert.equal(f.round.player._computerActive,false);}finally{f.close();}
});
test('production audio dispatch keeps private chewing local and world sound markers public only',()=>{
 const f=fixture();try{const id=f.round.player.id;f.round._events.push({type:'use-crunch',studentId:id,recipientId:id},{type:'use-gulp',studentId:id+1,recipientId:id+1},{type:'gum-inflate',studentId:id,recipientId:id},{type:'food-complete',studentId:id+1,x:f.round.player.x,y:1.4,z:f.round.player.z},{type:'chalk-hit',x:1,y:1,z:1});f.advance(.1);assert.equal(f.sounds.filter(([kind])=>kind==='use-crunch').length,1);assert.equal(f.sounds.filter(([kind])=>kind==='use-gulp').length,0);assert.equal(f.sounds.filter(([kind])=>kind==='gum-inflate').length,1);assert.deepEqual(f.worldEffects.map(e=>e.type),['food-complete','chalk-hit']);}finally{f.close();}
});


test('unverified score, capture, AI observation and interaction messages never become gameplay subtitles',()=>{
 const f=fixture();try{const p=f.round.player;f.take('burger');f.mouse(true);f.advance(3);f.mouse(false);assert.equal(f.round.score,1);assert.ok(!f.element('#round-feedback').textContent,'food score stays in the score HUD');
  for(const event of [{type:'observation',public:true,text:'老师已认出你'}, {type:'elevator-denied',message:'等待其他玩家'}, {type:'rear-door-blocked'}, {type:'gum-score',studentId:p.id,points:2}, {type:'snake-food',studentId:p.id,points:1}, {type:'stunned',studentId:p.id}, {type:'grabbed',studentId:p.id}, {type:'bound',studentId:p.id}, {type:'rescued',studentId:p.id}, {type:'correct-capture'}, {type:'wrong-grab'}]){f.round._events.push(event);f.advance(.02);assert.ok(!f.element('#round-feedback').textContent,event.type+' must not add a student subtitle');}
  assert.ok(f.sounds.some(([type])=>type==='food-complete'),'removing subtitles must retain public food audio');
 }finally{f.close();}
});
test('teacher subtitles only show reference-verified capture and recovery notices, ignoring arbitrary event text',()=>{
 const f=fixture({teacher:true});try{for(const[type,text]of [['correct-capture','抓到了！恢复20体力'],['wrong-grab','抓错了！体力 -40'],['stamina-low','讲课可恢复体力']]){f.round._events.push({type,text:'do not show this',message:'or this'});f.advance(.02);assert.equal(f.element('#round-feedback').textContent,text);}
  f.round._events.push({type:'observation',public:true,text:'新增状态播报'});f.advance(.02);assert.equal(f.element('#round-feedback').textContent,'讲课可恢复体力','unknown events do not replace an approved notice');
 }finally{f.close();}
});

test('production computer controller scores only visible advancing playback and stops on buffer, hide or Q',()=>{
 const f=fixture({map:'computer'});try{
  f.target({kind:'computer'});f.key('KeyE');f.commands.app('valorant');f.setPlayback(time=>({playing:true,visible:true,mediaTime:time}));f.advance(3.35);assert.equal(f.round.score,1);
  f.setPlayback(time=>({playing:false,visible:true,mediaTime:time}));f.advance(6);assert.equal(f.round.score,1);
  f.setPlayback(time=>({playing:true,visible:false,mediaTime:time}));f.advance(6);assert.equal(f.round.score,1);
  f.setPlayback(time=>({playing:true,visible:true,mediaTime:time}));f.advance(3.35);assert.equal(f.round.score,2);
  f.key('KeyQ');f.advance(6);assert.equal(f.round.score,2);assert.equal(f.rendered.player.computer.app,'desktop');assert.equal(f.round.player._computerProgress,0);
 }finally{f.close();}
});

for(const teacher of [false,true])test(`production ${teacher?'teacher':'student'} movement sounds steps only while actually travelling`,()=>{
 const f=fixture({teacher});try{
  const p=f.round.player;Object.assign(p,{x:9,z:-4,yaw:0,seated:false,seatId:null,crouched:false});f.advance(.1);f.sounds.length=0;
  f.advance(1.2);assert.equal(f.sounds.filter(([kind])=>kind==='step').length,0,'standing still must not make steps');
  const before={x:p.x,z:p.z};f.setAxes({forward:1});f.advance(1.2);
  assert.ok(Math.abs(Math.hypot(p.x-before.x,p.z-before.z)-(teacher?2.2:1.8)*1.2)<.001,'use real role movement through the controller');
  const steps=f.sounds.filter(([kind])=>kind==='step');assert.ok(steps.length>=2&&steps.length<=3,'normal walking has distinct, bounded foot contacts');assert.ok(steps.every(([,gain])=>gain>0&&gain<1));
  f.sounds.length=0;f.setAxes({forward:0});f.advance(1.2);assert.equal(f.sounds.filter(([kind])=>kind==='step').length,0,'stopping must stop footsteps immediately');
 }finally{f.close();}
});

test('production seated and crawling inputs never play upright walking contacts',()=>{
 const f=fixture();try{
  f.advance(.1);f.sounds.length=0;f.setAxes({forward:1});f.advance(1.2);assert.equal(f.round.player.seated,true);assert.equal(f.sounds.filter(([kind])=>kind==='step').length,0);
  Object.assign(f.round.player,{x:9,z:-4,yaw:0,seated:false,seatId:null});f.setAxes({forward:1,crawl:true});const before=f.round.player.z;f.advance(1.2);
  assert.ok(f.round.player.crouched&&f.round.player.z>before+.4,'the fixture must really crawl');assert.equal(f.sounds.filter(([kind])=>kind==='step').length,0);
 }finally{f.close();}
});

test('remote teacher footsteps fade with distance and are silent sixty metres away',()=>{
 const levels=[];
 for(const distance of [1,6,60]){
  const f=fixture();try{
   const p=f.round.player,t=f.round.teacher;Object.assign(t,{x:p.x+distance,z:p.z,seated:false,captivity:'free'});f.advance(.1);f.sounds.length=0;
   for(let i=0;i<90;i++){t.z+=2.2/60;f.advance(1/60);}
   const steps=f.sounds.filter(([kind])=>kind==='step');if(distance===60)assert.equal(steps.length,0,'distant movement must not sound beside the listener');else{assert.ok(steps.length>=2);levels.push(steps[0][1]);}
  }finally{f.close();}
 }
 assert.ok(levels[0]>levels[1]*3&&levels[1]>0,'distance attenuation must meaningfully reduce the received volume');
});

test('nearby visible students have footsteps; hidden, seated and moved-by-capture classmates do not',()=>{
 for(const state of [{visible:true,seated:false,captivity:'free'}, {visible:false,seated:false,captivity:'free'}, {visible:true,seated:true,captivity:'free'}, {visible:true,seated:false,captivity:'carried'}]){
  const f=fixture();try{
   const p=f.round.player,s=f.round.students.find(actor=>actor!==p);Object.assign(s,{x:p.x+1,z:p.z,...state,_decisionAt:Infinity});f.advance(.1);f.sounds.length=0;
   for(let i=0;i<80;i++){s.z+=1.8/60;f.advance(1/60);}
   const count=f.sounds.filter(([kind])=>kind==='step').length;
   if(state.visible&&!state.seated&&state.captivity==='free')assert.ok(count>=2);else assert.equal(count,0);
  }finally{f.close();}
 }
});

test('teleporting to another place does not count as a long walking stride',()=>{
 const f=fixture();try{
  const p=f.round.player,t=f.round.teacher;Object.assign(t,{x:p.x+2,z:p.z,seated:false});f.advance(.1);f.sounds.length=0;
  t.z+=3;f.advance(.1);assert.equal(f.sounds.filter(([kind])=>kind==='step').length,0);
 }finally{f.close();}
});
