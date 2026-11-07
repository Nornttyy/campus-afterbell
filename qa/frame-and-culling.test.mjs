import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createClassroomGame} from '../dist/classroom-game.js';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {DETENTION} from '../dist/classroom-layout.js';
import {createRiggedStudent} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';

// Exercise the real input/frame controller with an event-only DOM; no browser
// or WebGL is involved, and the fixed-step rules remain the production rules.
function gameFixture(){
  const saved=new Map(),elements=new Map(),callbacks=new Map();let now=0,nextFrame=0;
  class Element extends EventTarget{
    constructor(){super();this.dataset={};this.style={};this.open=false;this.classList={add(){},remove(){},toggle(){}};}
    setAttribute(){} removeAttribute(){} focus(){} showModal(){this.open=true;} close(){this.open=false;}
  }
  const doc=new EventTarget(),win=new EventTarget();doc.body=new Element();
  doc.querySelector=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const canvas=doc.querySelector('#classroom');doc.pointerLockElement=canvas;
  doc.exitPointerLock=()=>{doc.pointerLockElement=null;};canvas.requestPointerLock=()=>{doc.pointerLockElement=canvas;};
  const globals={document:doc,window:win,performance:{now:()=>now},requestAnimationFrame:fn=>{const id=++nextFrame;callbacks.set(id,fn);return id;},cancelAnimationFrame:id=>callbacks.delete(id)};
  for(const [name,value]of Object.entries(globals)){saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});}
  const round=new ClassroomRound({target:100000});round._advanceTeacher=()=>{};round._perceive=()=>{};round._hear=()=>{};
  const scene={setGameplay(){},getInteraction:()=>null,playFeedback(){}};
  const game=createClassroomGame({round,scene,audio:{apply(){},start(){},effect(){},click(){}}});game.start();
  const send=(target,type,props={})=>{const e=new Event(type,{cancelable:true});for(const[k,v]of Object.entries(props))Object.defineProperty(e,k,{value:v});target.dispatchEvent(e);};
  return{round,doc,send,element:doc.querySelector,tick(seconds){now+=seconds*1000;const pending=[...callbacks.values()];callbacks.clear();for(const fn of pending)fn(now);},close(){game.exit();for(const[name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}};
}

test('15 and 5 FPS advance the actual rules clock at the same rate as 60 FPS',()=>{
  for(const hz of [60,15,5]){
    const f=gameFixture();try{for(let i=0;i<hz*10;i++)f.tick(1/hz);assert.ok(Math.abs(f.round.elapsed-10)<1e-6,`${hz} FPS advanced ${f.round.elapsed}s`);}finally{f.close();}
  }
});
test('paused frames do not catch up hidden time; a long foreground stall stays bounded',()=>{
  const f=gameFixture();try{
    f.tick(.1);const before=f.round.elapsed;f.send(f.doc,'keydown',{code:'Escape'});f.tick(5);assert.equal(f.round.elapsed,before);
    f.send(f.element('#resume-game'),'click');f.tick(1/60);assert.ok(Math.abs(f.round.elapsed-before-1/60)<1e-6);
    const resumed=f.round.elapsed;f.tick(4);assert.ok(f.round.elapsed-resumed<=.250001);
  }finally{f.close();}
});
test('binding does not snap the next mouse pixel, and rescue movement follows the current camera heading',()=>{
  const f=gameFixture();try{
    const r=f.round,p=r.player;Object.assign(r.teacher,{x:p.x,z:p.z-.5,yaw:0});assert.ok(r._stun(p));assert.ok(r._grab(p));
    Object.assign(r.teacher,{x:DETENTION[0].x,z:DETENTION[0].z-.9});assert.ok(r._bind(0));
    const before=p.yaw;f.send(f.doc,'mousemove',{movementX:1,movementY:0});
    const turn=Math.atan2(Math.sin(p.yaw-before),Math.cos(p.yaw-before));assert.ok(Math.abs(turn+.0024)<1e-9,`one pixel turned ${turn} radians`);
    r._release(p);const z=p.z;f.send(f.doc,'keydown',{code:'KeyW',repeat:false});f.tick(1/60);assert.ok(p.z<z,'W went backward after the authority changed yaw');
  }finally{f.close();}
});

for(const variant of ['boy','girl'])test(`${variant}: culling does not replay a completed bind/release transition`,async()=>{
  const [continuous,culled]=await Promise.all([0,1].map(async()=>createRiggedStudent(await loadGeometry(`student-${variant}-v2.glb`),{variant,seated:false})));
  for(const actor of [continuous,culled]){
    actor.setMood('resting');actor.setMotion({seated:false});for(let i=1;i<=60;i++)actor.update(i/60);
    actor.setMotion({seated:false,restraint:'carried',restraintStartedAt:1});for(let i=61;i<=120;i++)actor.update(i/60);
  }
  continuous.setMotion({seated:false,restraint:'bound',restraintStartedAt:2});for(let i=121;i<=480;i++)continuous.update(i/60);
  culled.setMotion({seated:false,restraint:'bound',restraintStartedAt:2});culled.update(8);
  assert.equal(culled.diagnostics().capture.age,6);
  for(const side of ['Left','Right']){
    const a=continuous.bones[side+'Hand'].getWorldPosition(new T.Vector3()),b=culled.bones[side+'Hand'].getWorldPosition(new T.Vector3());
    assert.ok(a.distanceTo(b)<.018,`${side} wrist replayed the binding path: ${a.distanceTo(b)}m`);
  }
  culled.setMotion({seated:false,restraint:'free',restraintStartedAt:9});culled.update(12);
  assert.equal(culled.diagnostics().capture.kind,'free');assert.equal(culled.diagnostics().capture.weight,0);
  // The same cached actor is reused when starting a new round from the menu.
  continuous.setMotion({seated:true,restraint:'free',restraintStartedAt:0});continuous.update(0);
  assert.equal(continuous.diagnostics().capture.kind,'free');assert.equal(continuous.diagnostics().capture.weight,0);
  continuous.dispose();culled.dispose();
});
