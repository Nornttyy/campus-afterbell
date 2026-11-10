import test from 'node:test';
import assert from 'node:assert/strict';
import {createClassroomGame} from '../dist/classroom-game.js';
import {ClassroomRound,CLASSROOM_ACTIONS} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {CampusRoom} from '../server/room-simulation.js';
import {DOORS,OFFICE_CHAIR,ROLE_LOCKER} from '../dist/classroom-layout.js';
import {interactionIntent} from '../dist/interaction-intent54.js';
import {hud54Model} from '../dist/reference-hud54.js';
import {readFileSync} from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import {campusScene} from './campus-geometry54-helpers.mjs';
function fixture({map='classroom',teacher=false}={}){
 const saved=new Map(),nodes=new Map(),frames=new Map();let now=0,nextFrame=0,target=null,commands,rendered=null,computer=false,lockerOpens=0;
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.style={};this.attrs={};this.open=false;this.classList={add(){},remove(){},toggle(){}};}
  setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}focus(){}showModal(){this.open=true;}close(){this.open=false;}
 }
 const doc=new EventTarget(),win=new EventTarget();doc.body=new Element();
 doc.querySelector=id=>{if(id==='#locker-dialog[open]')return null;if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 const canvas=doc.querySelector('#classroom');doc.pointerLockElement=canvas;doc.exitPointerLock=()=>doc.pointerLockElement=null;canvas.requestPointerLock=()=>doc.pointerLockElement=canvas;
 for(const[name,value]of Object.entries({document:doc,window:win,performance:{now:()=>now},requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id)})){saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});}
 const round=new (teacher?TeacherRound:ClassroomRound)({map,target:100000});round._advanceTeacher=()=>{};round._perceive=()=>{};round._hear=()=>{};
 const game=createClassroomGame({round,scene:{setGameplay:s=>rendered=s,getInteraction:()=>target,playFeedback(){}},audio:{apply(){},start(){},effect(){},click(){}},sessionFactory:options=>{commands=options.commands;return{touch:false,openLocker(){lockerOpens++;return true;},get computer(){return computer;},axes:()=>({side:0,forward:0,crawl:false}),update:s=>computer=!!s.player.computerActive,reset(){computer=false;},dispose(){}};}});game.start();round.reset(73);round.start();
 for(const s of round.students)s._decisionAt=Infinity;round.teacher.x=round.teacher.z=40;
 const send=(type,props={})=>{const e=new Event(type,{cancelable:true});for(const[k,v]of Object.entries(props))Object.defineProperty(e,k,{value:v});doc.dispatchEvent(e);};
 const advance=seconds=>{for(let left=seconds;left>1e-9;){const dt=Math.min(1/60,left);left-=dt;now+=dt*1000;const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(now);}};
 return{round,commands,get lockerOpens(){return lockerOpens;},get rendered(){return rendered;},element:doc.querySelector,advance,mouse:pressed=>send(pressed?'mousedown':'mouseup',{button:0}),key:code=>{send('keydown',{code});send('keyup',{code});},target:t=>target=t,
  take(kind){round.player._slots[0]={id:0,action:kind,progress:0,readyAt:0};round.player._selectedSlot=0;round.player._drawnSlot=null;round.selected=round.player.action=kind;target={kind:'desk'};if(!round.player._drawerOpen)this.key('KeyE');target={kind:'item',slot:0};this.key('KeyE');target=null;assert.equal(round.snapshot().drawer.drawnSlot,0);},
  close(){game.dispose();for(const[name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
 };
}


test('Q returns a pen over the drawer without opening it or standing; E can open only on the next action',()=>{
 const f=fixture();try{f.target({kind:'pen'});f.key('KeyE');f.target({kind:'desk'});assert.equal(f.round.player._drawerOpen,false);f.key('KeyQ');assert.equal(f.round.player._drawerOpen,false);assert.equal(f.round.player._drawnSlot,null);assert.equal(f.round.player.seated,true);f.key('KeyE');assert.equal(f.round.player._drawerOpen,true);}finally{f.close();}
});
test('E carries food out of the chair; Q returns at the original desk without forcing a seat',()=>{
 const f=fixture();try{f.take('burger');const origin=f.round.player.seatId;f.round.books[origin].raised=false;f.target({kind:'desk'});f.key('KeyE');assert.equal(f.round.player._drawnSlot,0);assert.equal(f.round.player.seated,false);assert.equal(f.round.player._drawerOpen,false);f.key('KeyQ');assert.equal(f.round.player._drawnSlot,null);assert.equal(f.round.player._drawerOpen,false);assert.equal(f.round.player.seated,false);f.target({kind:'chair',id:origin});f.key('KeyE');assert.equal(f.round.player.seated,true);f.target({kind:'desk'});f.key('KeyE');assert.equal(f.round.player._drawerOpen,true);f.key('KeyQ');assert.equal(f.round.player._drawerOpen,false);assert.equal(f.round.player.seated,true);f.target({kind:'chair',id:origin});f.key('KeyQ');assert.equal(f.round.player.seated,false);}finally{f.close();}
});
test('book E/Q are explicit, and holding a pen makes E change only pen mode',()=>{
 const f=fixture();try{f.target({kind:'book'});f.key('KeyE');assert.equal(f.round.snapshot().player.bookRaised,true);f.key('KeyE');assert.equal(f.round.snapshot().player.bookRaised,true);f.key('KeyQ');assert.equal(f.round.snapshot().player.bookRaised,false);f.target({kind:'pen'});f.key('KeyE');assert.equal(f.round.snapshot().player.penTwirling,true);f.target({kind:'book'});f.key('KeyE');assert.equal(f.round.snapshot().player.penWriting,true);assert.equal(f.round.snapshot().player.bookRaised,false);f.key('KeyE');assert.equal(f.round.snapshot().player.penTwirling,true);assert.equal(f.round.score,0);}finally{f.close();}
});
test('computer E does not close; touch return and Q share the same close path',()=>{
 const f=fixture({map:'computer'});try{f.target({kind:'computer'});f.key('KeyE');f.advance(.1);f.key('KeyE');assert.equal(f.round.player._computerActive,true);f.commands.return();assert.equal(f.round.player._computerApp,'desktop');assert.equal(f.round.player._computerActive,true);f.commands.return();assert.equal(f.round.player._computerActive,false);f.key('KeyE');f.advance(.1);f.key('KeyQ');assert.equal(f.round.player._computerActive,false);assert.equal(f.round.player._drawerOpen,false);assert.equal(f.round.player.seated,true);}finally{f.close();}
});
test('Q cancels a charged throwable without throwing, consuming, closing or standing',()=>{
 const f=fixture();try{f.take('smoke');f.mouse(true);f.advance(.7);f.commands.return();assert.equal(f.round.projectiles.length,0);assert.equal(f.round.player._slots[0].action,'smoke');assert.equal(f.round.player._drawnSlot,null);assert.equal(f.round.player._drawerOpen,true);assert.equal(f.round.player.seated,true);f.mouse(false);assert.equal(f.round.projectiles.length,0);}finally{f.close();}
});
test('local held Q closes the visible leaf in 3 seconds; repeated desired state cannot toggle it back',()=>{
 const r=new ClassroomRound();r.start();r.player.pitch=.55;r._advanceTeacher=()=>{};for(const p of r.students)p._decisionAt=Infinity;Object.assign(r.player,{x:8,z:-6.7,yaw:Math.PI,seated:false});assert.equal(r.setDoorUse(true,true),true);r.step(2.99);assert.equal(r.layout.rearDoorClosed,false);r.step(.02);assert.equal(r.layout.rearDoorClosed,true);assert.equal(r.setDoorUse(true,true),false);r.step(3);assert.equal(r.layout.rearDoorClosed,true);Object.assign(r.player,{x:6.7,z:DOORS[0].center,yaw:Math.PI/2});assert.equal(r.setDoorUse(true,false),true);r.step(3);assert.equal(r.layout.rearDoorClosed,false);
});
test('two clients share explicit drawer/book/pen states and simultaneous close commands cannot reopen the door',()=>{
 const room=new CampusRoom({code:'540001',seed:54}),t=room.join({name:'老师',rolePreference:'teacher'}),a=room.join({name:'甲'}),b=room.join({name:'乙'});room.begin(t);for(let i=0;i<300;i++)room.tick(.1);room.sim._seatingRoutes.clear();for(const p of room.sim.students)if(!p.networkHuman)Object.assign(p,{seated:false,x:-100,z:-100});
 const actor=a.context.player;Object.assign(actor,{seated:true,seatId:0,x:room.sim.seats[0].x,z:room.sim.seats[0].z});assert.equal(room.command(a,'setDrawerOpen',[true]),true);assert.equal(room.command(a,'setDrawerOpen',[true]),false);assert.equal(room.command(a,'setDrawerOpen',[false]),true);assert.equal(room.command(a,'takePen'),true);assert.equal(room.snapshot(b).students[a.studentId].penTwirling,true);assert.equal(room.command(a,'togglePenMode'),true);assert.equal(room.snapshot(b).students[a.studentId].penWriting,true);assert.equal(room.command(a,'returnItem'),true);assert.equal(room.snapshot(a).drawer.open,false);
 for(const m of[a,b])Object.assign(m.context.player,{x:8,z:-6.7,yaw:Math.PI,seated:false});assert.equal(room.command(a,'setDoorUse',[true,true]),true);assert.equal(room.command(b,'setDoorUse',[true,true]),true);for(let i=0;i<31;i++)room.tick(.1);assert.equal(room.sim.layout.rearDoorClosed,true);assert.equal(room.snapshot(a).interaction.kind,null);assert.equal(room.snapshot(b).interaction.kind,null);
});
test('food rewards, bubble stages and ranking all use the awarded amount, with a 10-minute default',()=>{
 const r=new ClassroomRound({target:1000});r.start();r.player.pitch=.55;r._advanceTeacher=()=>{};for(const p of r.students)p._decisionAt=Infinity;assert.equal(r.duration,600);
 for(const [kind,points]of[['snack',1],['drink',1],['burger',1],['banana',1],['garlic',1],['lunch',3]]){assert.equal(CLASSROOM_ACTIONS[kind].points,points);const before=r.score;r.player._burpUntil=0;r.player._slots[0]={id:0,action:kind,progress:0,readyAt:0};r.player._selectedSlot=r.player._drawnSlot=0;r.selected=r.player.action=kind;r.hold(true);r.step(3);assert.equal(r.score-before,points);}
 r.player._slots[0]={id:0,action:'gum',progress:0,readyAt:0};r.player._selectedSlot=r.player._drawnSlot=0;r.selected=r.player.action='gum';r.player._burpUntil=0;r.hold(true);const prior=r.score;for(const points of[1,2,3,0]){const before=r.score;r.step(1.5);assert.equal(r.score-before,points);}assert.equal(r.score-prior,6);assert.equal(r.player._drawnSlot,null);
 const model=hud54Model(r.snapshot());assert.equal(model.rows.find(p=>p.id===r.player.id).points,r.score);assert.equal(model.rows.reduce((n,p)=>n+p.points,0),r.score);assert.equal(model.rows[0].isSelf,true);assert.ok(model.rows.slice(1).every(p=>p.points===0));
});
test('touch has a dedicated Q return command and pause controls describe the new semantics',()=>{
 const source=readFileSync(new URL('../dist/session-ui.js',import.meta.url),'utf8');assert.match(source,/id="touch-q"/);assert.match(source,/commands\.return\(\)/);assert.doesNotMatch(source,/id="computer-desktop"/);
});

test('pink mouth bubbles never travel, never attach to self or through a wall; charge changes duration not attached size',()=>{
 const r=new ClassroomRound({target:1000});r.start();r._advanceTeacher=()=>{};const p=r.player;for(const other of r.students)if(other!==p)Object.assign(other,{x:-100,z:-100,seated:false});r.teacher.x=r.teacher.z=40;
 Object.assign(p,{x:6.9,z:0,yaw:Math.PI/2,seated:false,_bubbleElapsed:4});const other=r.students.find(s=>s!==p);Object.assign(other,{x:8,z:0});assert.equal(r._touchMouthBubble(p),false,'solid classroom wall must prevent adhesion');assert.equal(r.bubbles.length,0);
 Object.assign(p,{x:0,z:0,yaw:0,_bubbleElapsed:3});Object.assign(other,{x:0,z:.8});assert.equal(r._touchMouthBubble(p),true);assert.equal(r.bubbles[0].attachedId,other.id);assert.equal(r.bubbles[0].charge,1);assert.equal(r.bubbles[0].lifetime,6);r.bubbles=[];other._bubbleUntil=0;p._bubbleElapsed=6;other.z=1.27;assert.equal(r._touchMouthBubble(p),true);assert.equal(r.bubbles[0].charge,1);assert.equal(r.bubbles[0].lifetime,10);
 other.x=30;other.z=30;r.bubbles=[];p._bubbleElapsed=4;assert.equal(r._releaseBubble(p),true);assert.equal(r.bubbles.length,0);r._advanceBubbles(2);assert.equal(r.bubbles.length,0);
});

test('surveillance E deploys or views, and Q closes surveillance before touching an item underneath',()=>{
 const s={status:'playing',stage:'class',role:'teacher',player:{},teacher:{carriedId:null},drawer:{drawnSlot:null},surveillance:{viewing:null}};
 assert.equal(interactionIntent(s,{kind:'surveillance',id:'wall-a',ready:true,installed:false},'E').method,'deploySurveillance');
 assert.equal(interactionIntent(s,{kind:'surveillance',id:'wall-a',ready:false,installed:true},'E').method,'viewSurveillance');
 assert.equal(interactionIntent(s,{kind:'surveillance',id:'wall-a',ready:false,installed:false},'E'),null);
 s.surveillance.viewing='wall-a';s.teacher.carriedId=3;assert.equal(interactionIntent(s,{kind:'rear-door'},'Q').method,'closeSurveillance');
});

test('raised books limit the visible mouth bubble and block adhesion; lowering the book clears the route',()=>{
 const r=new ClassroomRound({target:1000});r.start();const p=r.player,target=r.students.find(s=>s!==p);for(const actor of r.students)if(actor!==p)Object.assign(actor,{x:-100,z:-100});r.teacher.x=r.teacher.z=40;
 Object.assign(p,{_bubbleElapsed:4,action:'gum',_drawnSlot:0});Object.assign(target,{x:p.x,z:p.z+.8,seated:true});
 const book=r.books[p.seatId];book.amount=1;book.raised=true;const blocked=r._mouthBubbleGeometry(p),bookZ=r.seats[p.seatId].deskZ-.28;
 assert.ok(blocked.radius<.11);assert.ok(Math.hypot(Math.max(0,Math.abs(blocked.center.z-bookZ)-.02),blocked.center.y-1.35)>blocked.radius);assert.equal(r._touchMouthBubble(p),false);assert.equal(r.bubbles.length,0);assert.equal(r.snapshot().player.bubble.radius,blocked.radius);
 book.amount=0;book.raised=false;assert.ok(r._mouthBubbleGeometry(p).radius>blocked.radius);assert.equal(r._touchMouthBubble(p),true);assert.equal(r.bubbles[0].attachedId,target.id);
 Object.assign(p,{x:6.9,z:0,yaw:Math.PI/2,seated:false});const wallBubble=r._mouthBubbleGeometry(p);assert.ok(wallBubble.center.x+wallBubble.radius<=7.20+.001,'displayed sphere cannot extend into the classroom wall');
});

test('rear door rejects students, teachers and AI in the full swing, retaining both their positions and old door state',()=>{
 const r=new ClassroomRound();r.start();for(const actor of r.students)Object.assign(actor,{x:-100,z:-100});Object.assign(r.player,{x:8,z:-6.7,seated:false});r.teacher.x=r.teacher.z=40;const blocker=r.students.find(s=>s!==r.player);
 for(const point of[{x:7.30,z:-8},{x:8.1,z:-7.2},{x:8.2,z:-8}]){Object.assign(blocker,point);assert.equal(r.setRearDoor(true),false);assert.equal(r.layout.rearDoorClosed,false);assert.equal(blocker.x,point.x);assert.equal(blocker.z,point.z);}
 blocker.x=blocker.z=-100;assert.equal(r.setRearDoor(true),true);Object.assign(r.teacher,{x:8.1,z:-7.2});assert.equal(r.setRearDoor(false),false);assert.equal(r.layout.rearDoorClosed,true);r.teacher.x=r.teacher.z=40;assert.equal(r.setRearDoor(false),true);
});

test('server door completion checks a second human and AI entering during the 3-second hold',()=>{
 const room=new CampusRoom({code:'540009',seed:54}),host=room.join({name:'老师',rolePreference:'teacher'}),a=room.join({name:'甲'}),b=room.join({name:'乙'});room.begin(host);for(let i=0;i<301;i++)room.tick(.1);room.sim._seatingRoutes.clear();for(const p of room.sim.students)Object.assign(p,{seated:false,x:-100,z:-100,_decisionAt:Infinity});
 Object.assign(a.context.player,{x:8,z:-6.7,yaw:Math.PI,seated:false});Object.assign(b.context.player,{x:7.3,z:-8,seated:false});assert.equal(room.command(a,'setDoorUse',[true,true]),true);for(let i=0;i<31;i++)room.tick(.1);assert.equal(room.sim.layout.rearDoorClosed,false);assert.equal(b.context.player.x,7.3);
 Object.assign(b.context.player,{x:9.5,z:-6.2});const ai=room.sim.students.find(s=>!s.networkHuman);Object.assign(ai,{x:8.2,z:-8});assert.equal(room.command(a,'setDoorUse',[true,true]),true);for(let i=0;i<31;i++)room.tick(.1);assert.equal(room.sim.layout.rearDoorClosed,false);ai.x=ai.z=-100;assert.equal(room.command(a,'setDoorUse',[true,true]),true);for(let i=0;i<31;i++)room.tick(.1);assert.equal(room.sim.layout.rearDoorClosed,true);
});


test('formal E opens the locker selected by a centre ray at the real approach position',()=>{
 const f=fixture(),world=campusScene();try{f.round.stage='gathering';Object.assign(f.round.player,{x:ROLE_LOCKER.x-1.79,z:ROLE_LOCKER.z,seated:false,yaw:Math.PI/2,pitch:.06});
 const locker=world.campus.getTargets().lockers[0],ray=new T.Raycaster(new T.Vector3(ROLE_LOCKER.x-1.79,1.65,ROLE_LOCKER.z),new T.Vector3(1,-Math.tan(.06),0).normalize(),0,2.5),hit=ray.intersectObject(locker.object,true)[0];assert.ok(hit);f.target({kind:hit.object.userData.campusTarget.type,id:locker.id});f.key('KeyE');assert.equal(f.lockerOpens,1);f.round.stage='class';f.key('KeyE');assert.equal(f.lockerOpens,1,'role changes remain pre-class only');
 }finally{world.dispose();f.close();}
});


test('pen E still changes mode, while targeting its own chair uses the same E action to stand carrying it',()=>{
 const f=fixture();try{f.target({kind:'pen'});f.key('KeyE');f.key('KeyE');assert.equal(f.round.snapshot().player.penWriting,true);f.target({kind:'chair',id:f.round.player.seatId});f.key('KeyE');assert.equal(f.round.player.seated,false);assert.equal(f.round.snapshot().player.penTwirling,true);assert.equal(f.round.snapshot().player.penWriting,false);f.key('KeyQ');assert.equal(f.round.player._drawnSlot,null);}finally{f.close();}
});


test('carrying a pen into the office cannot trap a pupil in the chair or write on a missing book',()=>{
 const f=fixture();try{
  const p=f.round.player,source=p.seatId;f.target({kind:'pen'});f.key('KeyE');f.target({kind:'chair',id:source});f.key('KeyE');assert.equal(p.seated,false);
  Object.assign(p,{x:OFFICE_CHAIR.x,z:OFFICE_CHAIR.z});f.target({kind:'office-chair',id:OFFICE_CHAIR.id});f.key('KeyE');assert.equal(p.seated,true);assert.equal(p._officeChair,true);assert.equal(f.round.snapshot().drawer.canReturn,false);
  assert.equal(f.round.togglePenMode(),false,'there is no classroom book at the office chair');assert.equal(f.round.snapshot().player.penTwirling,true);
  f.target({kind:'office-desk',id:p._officeDeskId});f.key('KeyE');assert.equal(p.seated,false,'E must offer a way out while Q cannot reach the original desk');assert.equal(p._penTaken,true);assert.equal(p._penSeatId,source);assert.equal(f.round.score,0);
 }finally{f.close();}
});
