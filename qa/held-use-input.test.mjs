import test from 'node:test';
import assert from 'node:assert/strict';
import {bindHeldUseInput} from '../dist/held-use-input.js';
function fixture(locked=false){
  const doc=new EventTarget(),win=new EventTarget(),canvas=new EventTarget(),calls=[];
  canvas.focus=()=>{};canvas.setPointerCapture=()=>{throw new Error('Mouse pointer capture is forbidden during Pointer Lock');};
  doc.pointerLockElement=locked?canvas:null;
  let allowed=true;
  const binding=bindHeldUseInput({canvas,document:doc,window:win,canInput:()=>allowed,onHold:v=>calls.push(v),onRelease:()=>calls.push('release'),onLock:()=>{doc.pointerLockElement=canvas;doc.dispatchEvent(new Event('pointerlockchange'));}});
  function send(target,type,props={}){const e=new Event(type,{cancelable:true});for(const [k,v] of Object.entries(props))Object.defineProperty(e,k,{value:v});target.dispatchEvent(e);}
  return{doc,win,canvas,calls,binding,send,allow:v=>allowed=v};
}
test('acquiring Pointer Lock on the same mouse-down keeps using until mouse-up',()=>{
  const f=fixture();f.send(f.doc,'mousedown',{button:0,target:f.canvas});
  f.send(f.canvas,'lostpointercapture',{pointerType:'mouse',pointerId:1});
  assert.deepEqual(f.calls,[true]);f.send(f.doc,'mouseup',{button:0});assert.deepEqual(f.calls,[true,false]);
});
test('locked mouse input works with retargeted events and never requests pointer capture',()=>{
  const f=fixture(true);f.send(f.doc,'mousedown',{button:0,target:f.doc});f.send(f.canvas,'pointerdown',{button:0,pointerType:'mouse',pointerId:1});
  assert.deepEqual(f.calls,[true]);f.send(f.doc,'mouseup',{button:0});assert.deepEqual(f.calls,[true,false]);
});
test('losing lock or focus releases use; menu clicks and paused input do not consume objects',()=>{
  const f=fixture();f.send(f.doc,'mousedown',{button:0,target:f.doc});assert.deepEqual(f.calls,[]);
  f.send(f.doc,'mousedown',{button:0,target:f.canvas});f.doc.pointerLockElement=null;f.send(f.doc,'pointerlockchange');assert.equal(f.calls.at(-1),'release');
  f.allow(false);const n=f.calls.length;f.send(f.doc,'mousedown',{button:0,target:f.canvas});assert.equal(f.calls.length,n);
  f.send(f.win,'blur');assert.equal(f.calls.at(-1),'release');f.binding.dispose();
});
test('touch cancellation stops use even if capture is unavailable',()=>{
  const f=fixture();f.send(f.canvas,'pointerdown',{button:0,pointerType:'touch',pointerId:7});assert.deepEqual(f.calls,[true]);
  f.send(f.canvas,'pointercancel',{pointerType:'touch',pointerId:7});assert.deepEqual(f.calls,[true,'release']);
});

test('normal touch release uses the item, unlike capture loss which only cancels',()=>{
 const f=fixture();f.send(f.canvas,'pointerdown',{button:0,pointerType:'touch',pointerId:7});
 f.send(f.doc,'pointerup',{pointerType:'touch',pointerId:7});assert.deepEqual(f.calls,[true,false]);
 f.send(f.canvas,'lostpointercapture',{pointerType:'touch',pointerId:7});assert.deepEqual(f.calls,[true,false]);
 f.send(f.canvas,'pointerdown',{button:0,pointerType:'touch',pointerId:8});
 f.send(f.canvas,'lostpointercapture',{pointerType:'touch',pointerId:8});assert.equal(f.calls.at(-1),'release');
});
