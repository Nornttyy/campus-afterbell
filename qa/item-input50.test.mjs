import test from 'node:test';
import assert from 'node:assert/strict';
import {createClassroomGame} from '../dist/classroom-game.js';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {DETENTION} from '../dist/classroom-layout.js';

// Keep the production mouse/keyboard handlers, frame loop, HUD and simulation.
// Only DOM rendering and WebGL are replaced; this is not a screenshot test.
function fixture({map='classroom',teacher=false}={}){
 const saved=new Map(),nodes=new Map(),frames=new Map();let now=0,nextFrame=0,target=null,commands,rendered=null,computer=false;
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.style={};this.attrs={};this.open=false;this.classList={add(){},remove(){},toggle(){}};}
  setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}focus(){}showModal(){this.open=true;}close(){this.open=false;}
 }
 const doc=new EventTarget(),win=new EventTarget();doc.body=new Element();
 doc.querySelector=id=>{if(id==='#locker-dialog[open]')return null;if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 const canvas=doc.querySelector('#classroom');doc.pointerLockElement=canvas;doc.exitPointerLock=()=>doc.pointerLockElement=null;canvas.requestPointerLock=()=>doc.pointerLockElement=canvas;
 for(const[name,value]of Object.entries({document:doc,window:win,performance:{now:()=>now},requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id)})){saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});}
 const round=new (teacher?TeacherRound:ClassroomRound)({map,target:100000});round._advanceTeacher=()=>{};round._perceive=()=>{};round._hear=()=>{};
 const game=createClassroomGame({round,scene:{setGameplay:s=>rendered=s,getInteraction:()=>target,playFeedback(){}},audio:{apply(){},start(){},effect(){},click(){}},sessionFactory:options=>{commands=options.commands;return{touch:false,get computer(){return computer;},axes:()=>({side:0,forward:0,crawl:false}),update:s=>computer=!!s.player.computerActive,reset(){computer=false;},dispose(){}};}});game.start();
 for(const s of round.students)s._decisionAt=Infinity;round.teacher.x=round.teacher.z=40;
 const send=(type,props={})=>{const e=new Event(type,{cancelable:true});for(const[k,v]of Object.entries(props))Object.defineProperty(e,k,{value:v});doc.dispatchEvent(e);};
 const advance=seconds=>{for(let left=seconds;left>1e-9;){const dt=Math.min(1/60,left);left-=dt;now+=dt*1000;const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(now);}};
 return{round,commands,get rendered(){return rendered;},element:doc.querySelector,advance,mouse:pressed=>send(pressed?'mousedown':'mouseup',{button:0}),key:code=>{send('keydown',{code});send('keyup',{code});},target:t=>target=t,
  take(kind){round.player._slots[0]={id:0,action:kind,progress:0,readyAt:0};round.player._selectedSlot=0;round.player._drawnSlot=null;round.selected=round.player.action=kind;target={kind:'desk'};if(!round.player._drawerOpen)this.key('KeyE');target={kind:'item',slot:0};this.key('KeyE');target=null;assert.equal(round.snapshot().drawer.drawnSlot,0);},
  close(){game.dispose();for(const[name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
 };
}

test('production E and mouse input show one gum circle per second, grow it and pop at four',()=>{
 const f=fixture();try{f.take('gum');f.mouse(true);f.advance(.25);let ring=f.element('#use-progress');assert.equal(ring.hidden,false);assert.equal(ring.attrs['aria-valuenow'],'25');assert.equal(ring.style.width,'54px');
  f.advance(1);assert.equal(ring.attrs['aria-valuenow'],'25');assert.equal(ring.style.width,'67px');assert.equal(f.round.score,1);
  f.advance(2.75);assert.equal(f.round.score,10);assert.equal(f.round.player._slots[0].action,null);assert.equal(ring.hidden,true);assert.equal(f.rendered.player.bubble.progress,0);f.mouse(false);
 }finally{f.close();}
});
test('bound mouse hold stays at four circles, and release sends the snapshot bubble',()=>{
 const f=fixture();try{const r=f.round,p=r.player;Object.assign(r.teacher,{x:p.x,z:p.z-.7});r._stun(p);r._grab(p);Object.assign(r.teacher,{x:DETENTION[0].x,z:DETENTION[0].z-.9});r._bind(0);r.teacher.x=r.teacher.z=40;f.advance(.02);f.mouse(true);f.advance(5);
  assert.equal(f.element('#use-progress').attrs['aria-valuenow'],'100');assert.equal(f.element('#use-progress').style.width,'106px');assert.equal(f.rendered.player.bubble.cycles,4);assert.equal(r.bubbles.length,0);f.mouse(false);assert.equal(f.rendered.bubbles.length,1);assert.equal(f.rendered.bubbles[0].charge,1);
 }finally{f.close();}
});
test('production food input converts banana to a throwable peel and garlic to a five-second click ability',()=>{
 const f=fixture();try{f.take('banana');f.mouse(true);f.advance(3);assert.equal(f.rendered.selected,'bananaPeel');assert.equal(f.rendered.drawer.drawnSlot,0);f.mouse(false);assert.equal(f.round.peels.length,0);f.mouse(true);f.mouse(false);assert.equal(f.rendered.peels.length,1);assert.equal(f.rendered.drawer.drawnSlot,null);
  f.take('garlic');f.mouse(true);f.advance(3);assert.equal(f.rendered.player.burpReadyLeft,5);assert.equal(f.round.burps.length,0);f.mouse(false);f.mouse(true);assert.equal(f.rendered.burps.length,1);assert.equal(f.rendered.player.burpReadyLeft,0);f.mouse(false);
 }finally{f.close();}
});
test('E takes the pen for automatic writing, no use ring or points; E returns it',()=>{
 const f=fixture();try{f.target({kind:'pen'});f.key('KeyE');f.target(null);f.advance(4);assert.equal(f.rendered.player.penWriting,true);assert.equal(f.round.score,0);assert.equal(f.element('#use-progress').hidden,true);assert.match(f.element('#interaction-prompt').textContent,/写字中/);f.mouse(true);f.advance(3);f.mouse(false);assert.equal(f.round.score,0);assert.equal(f.rendered.player.penWriting,true);f.target({kind:'book'});f.key('KeyE');f.advance(.1);assert.equal(f.rendered.player.penTaken,false);assert.equal(f.rendered.player.penWriting,false);assert.equal(f.rendered.drawer.drawnSlot,null);}finally{f.close();}
});
test('computer E entry, app command and arrow keys score real snake food and preserve one five-second slot',()=>{
 const f=fixture({map:'computer7'});try{f.target({kind:'computer'});f.key('KeyE');f.advance(.1);assert.equal(f.rendered.player.computerActive,true);assert.equal(f.rendered.player.computer.app,'desktop');f.commands.app('snake');f.advance(.65);assert.equal(f.round.score,1);assert.equal(f.rendered.player.computer.snake.score,1);f.key('ArrowUp');f.advance(.16);assert.equal(f.rendered.player.computer.snake.direction,'up');f.key('KeyE');f.advance(.1);assert.equal(f.rendered.player.computerActive,false);
  f.take('burger');f.mouse(true);f.advance(3);f.mouse(false);assert.equal(f.rendered.drawer.slots.length,1);assert.equal(f.rendered.drawer.slots[0].readyIn,5);f.advance(5);assert.ok(f.rendered.drawer.slots[0].action);
 }finally{f.close();}
});
test('teacher production left click costs ten stamina and is blocked while stunned',()=>{
 const f=fixture({teacher:true});try{const r=f.round;r.teacher.stamina=20;f.mouse(true);f.mouse(false);assert.equal(r.teacher.stamina,10);f.advance(.8);f.mouse(true);f.mouse(false);assert.equal(r.teacher.stamina,0);r.teacher.stamina=100;r._stunAny(r.teacher,4,'bananaPeel');f.mouse(true);f.mouse(false);assert.equal(r.teacher.stamina,100);assert.equal(f.rendered.teacher.phase,'stunned');assert.ok(f.rendered.teacher.stunLeft>0);
 }finally{f.close();}
});
