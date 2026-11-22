import test from 'node:test';
import assert from 'node:assert/strict';
import {createRadioUI} from '../dist/radio-player93.js';
import {interactionIntent} from '../dist/interaction-intent54.js';
import {radioAnchor} from '../dist/campus-radio93.js';

// Keep a real EventTarget for settings/dialog events and count the actual
// iframe nodes the production player creates, without contacting a provider.
class Element extends EventTarget {
  constructor(tag){super();this.tag=tag;this.dataset={};this.children=[];this.named=new Map();}
  set innerHTML(html){
    for(const m of html.matchAll(/<([a-z]+)\b([^>]*)>/g)){
      const node=new Element(m[1]);
      this.children.push(node);this.named.set(m[1],node);
      for(const attr of m[2].matchAll(/\b(data-[\w-]+)/g))this.named.set('['+attr[1]+']',node);
      for(const c of (m[2].match(/class="([^"]+)"/)?.[1]||'').split(' '))if(c)this.named.set('.'+c,node);
    }
  }
  querySelector(selector){return this.named.get(selector);}
  get lastElementChild(){return this.children.at(-1);}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(name,value){this[name]=value;}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent(new Event('close'));}
}
const station=(track='friends',activation=1)=>({track,activation,startedAt:10,studentId:7});
const playing=(radio,time=19)=>({radio,status:'playing',stage:'class',sceneElapsed:time});
function fixture(){
  const doc=new EventTarget();doc.body=new Element('body');doc.createElement=tag=>new Element(tag);
  let muted=false;const ui=createRadioUI(doc,()=>muted);const [panel]=doc.body.children;
  return {ui,panel,frame:()=>panel.lastElementChild.children[0],
    mute(value){muted=value;doc.dispatchEvent(new Event('campus-audio-settings'));}};
}
test('a power switch has no song picker and both roles see only their available world action',()=>{
 const map='playground',a=radioAnchor(map),p={x:a.x,z:a.z-.85,captivity:'free'},target={kind:'radio'};
 const s={...playing(null),map,role:'student',player:p,teacher:{carriedId:null}};
 assert.deepEqual(interactionIntent(s,target,'E'),{method:'changeRadio',args:[true],label:'开启播音器',hold:false});
 assert.equal(interactionIntent({...s,radio:station()},target,'E'),null);
 assert.equal(interactionIntent({...s,radio:station()},target,'Q'),null);
 s.role='teacher';assert.equal(interactionIntent(s,target,'E'),null);
 for(const key of ['E','Q'])assert.deepEqual(interactionIntent({...s,radio:station()},target,key),{method:'changeRadio',args:[false],label:'关闭播音器',hold:false});
 const f=fixture();assert.equal(f.panel.querySelector('dialog'),undefined);assert.equal(f.frame(),undefined);
});
test('all listeners follow a single host clock and teacher power-off removes every player',()=>{
 const a=fixture(),b=fixture(),on=station();
 for(const f of [a,b]){
  f.ui.update(playing(on));assert.equal(f.panel.dataset.mode,'room');assert.equal(f.panel.querySelector('[data-end]').hidden,true);
  assert.equal(new URL(f.frame().src).searchParams.get('t'),'9');
  const first=f.frame();f.ui.update(playing({...on},20));assert.equal(first,f.frame());
  f.ui.update(playing(null));assert.equal(f.frame(),undefined);assert.equal(f.panel.hidden,true);
  f.ui.update({status:'won',stage:'class'});assert.equal(f.frame(),undefined);
 }
});
test('only a broadcast still powered at the bell keeps its very same iframe; a fresh startup takes priority',()=>{
 const f=fixture(),on=station();f.ui.update(playing(on));
 const first=f.frame();f.ui.update({status:'won',radioAtFinish:on});f.ui.reset();f.ui.update(playing(null));
 assert.equal(f.frame(),first);assert.equal(f.panel.dataset.mode,'after-class');
 f.ui.update(playing(station('friends',2),10));assert.notEqual(f.frame(),first);assert.equal(new URL(f.frame().src).searchParams.get('t'),'0');
 const second=f.frame();f.ui.update(playing(station('friends',3),10));assert.notEqual(f.frame(),second);
 f.ui.update({status:'won'});assert.equal(f.frame(),undefined);
 const late=fixture();late.ui.update({status:'won',radioAtFinish:on});assert.equal(late.frame(),undefined);
});
test('room mute applies only to the listener and rejoining starts at the shared clock',()=>{
 const f=fixture(),on=station('rain');f.ui.update(playing(on));f.mute(true);assert.equal(f.frame(),undefined);
 f.ui.update(playing(on,36));f.mute(false);assert.equal(new URL(f.frame().src).searchParams.get('t'),'26');
 f.ui.update({status:'lost',radioAtFinish:on});assert.equal(f.panel.querySelector('[data-end]').hidden,false);
 f.panel.querySelector('[data-end]').onclick();assert.equal(f.frame(),undefined);assert.ok(f.panel.hidden);
});
