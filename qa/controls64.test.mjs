import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTROL_KEY,ACTION_KEYS,normalizeControls,readControls,rebindControl,actionForCode,applyTouchStyle,setupControlSettings} from '../dist/control-settings64.js';

test('saved bindings and touch layout survive reload, reject invalid keys and constrain touch targets',()=>{
 const settings=normalizeControls();assert.equal(rebindControl(settings,'interact','KeyF'),true);settings.touch={size:86,spacing:20,edge:36,bottom:40,leftHanded:true,sensitivity:1.4};
 const loaded=readControls({getItem:key=>{assert.equal(key,CONTROL_KEY);return JSON.stringify(settings);}});
 assert.deepEqual(loaded,settings);assert.equal(actionForCode('KeyF',loaded),'interact');assert.equal(actionForCode('KeyE',loaded),null);
 const bad=normalizeControls({keys:{interact:'F5',return:'Escape'},touch:{size:2,edge:10000,sensitivity:NaN}});assert.equal(bad.keys.interact,'KeyE');assert.equal(bad.keys.return,'KeyQ');assert.equal(bad.touch.size,56);assert.equal(bad.touch.edge,80);assert.equal(bad.touch.sensitivity,1);
 assert.deepEqual(readControls({getItem(){throw Error('blocked')}}),normalizeControls());
});
test('a conflicting remap swaps keys so movement and interactions stay reachable',()=>{
 const settings=normalizeControls();rebindControl(settings,'interact','KeyW');assert.equal(settings.keys.interact,'KeyW');assert.equal(settings.keys.forward,'KeyE');
 assert.equal(new Set(Object.values(settings.keys)).size,Object.keys(settings.keys).length);
 assert.equal(rebindControl(settings,'left','Mouse0'),false);assert.equal(rebindControl(settings,'pause','KeyP'),true);assert.equal(actionForCode('Escape',settings),'pause');assert.equal(actionForCode('KeyP',settings),'pause');
 rebindControl(settings,'crawl','KeyC');assert.equal(actionForCode('KeyC',settings),'crawl');assert.equal(actionForCode('ShiftLeft',settings),null);
 assert.deepEqual(normalizeControls(settings),settings,'normalization changes a saved key swap');
});
test('touch sizes, edge, bottom and handedness all reach the actual control container',()=>{
 const values={},el={style:{setProperty:(k,v)=>values[k]=v},dataset:{}},settings=normalizeControls({touch:{size:90,spacing:22,edge:35,bottom:42,leftHanded:true}});applyTouchStyle(el,settings);
 assert.deepEqual(values,{'--touch-size':'90px','--touch-gap':'22px','--touch-edge':'35px','--touch-bottom':'42px'});assert.equal(el.dataset.leftHanded,'true');
});

test('mouse and escape bindings never get swapped onto a movement action',()=>{for(const action of ['use','pause']){const settings=normalizeControls();assert.equal(rebindControl(settings,action,'KeyW'),false);assert.equal(settings.keys.forward,'KeyW');const loaded=normalizeControls({keys:{[action]:'KeyW'}});assert.equal(loaded.keys.forward,'KeyW');assert.equal(loaded.keys[action],action==='use'?'Mouse0':'Escape');}});

test('a browser refusing localStorage access keeps default controls reachable',()=>{const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('storage unavailable');}});try{assert.deepEqual(readControls(),normalizeControls());}finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}});

// Exercise the real binding listeners and storage writes without a browser
// profile, so the regression suite itself cannot change a player's controls.
function fixture({saved,search=''}={}){
 const local=new Map(saved?[[CONTROL_KEY,JSON.stringify(saved)]]:[]),session=new Map(),writes=[],doc=new EventTarget(),win=new EventTarget();
 doc.hidden=false;doc.activeElement=null;
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.attrs={};this.style={setProperty(){}};this.open=true;this.hidden=false;this.isConnected=true;}
  setAttribute(k,v){this.attrs[k]=v;}contains(n){return this===n;}append(){}
  focus(){if(doc.activeElement===this)return;const old=doc.activeElement;doc.activeElement=this;old?.dispatchEvent(new Event('blur'));send(doc,'focusin',{target:this});}
 }
 const host=new Element(),dialog=new Element(),section=new Element(),status=new Element(),reset=new Element(),other=new Element(),preview=new Element(),grid=new Element();
 const buttons=Object.fromEntries(Object.keys(ACTION_KEYS).map(action=>{const el=new Element();el.dataset.bind=action;return[action,el];}));
 const inputs=Object.fromEntries(['size','spacing','edge','bottom','sensitivity','leftHanded'].map(id=>{const el=new Element();el.dataset.touch=id;el.type=id==='leftHanded'?'checkbox':'range';return[id,el];}));
 const outputs=Object.fromEntries(Object.keys(inputs).map(id=>[id,new Element()]));
 host.querySelectorAll=selector=>selector==='[data-bind]'?Object.values(buttons):Object.values(inputs);
 host.querySelector=selector=>({'#bind-status':status,'.control-section':section,'.touch-preview':preview,'.binding-grid':grid,'#controls-reset':reset})[selector]||outputs[selector.match(/data-output="([^"]+)"/)?.[1]];
 doc.querySelector=selector=>selector==='#control-settings'?host:selector==='#settings-dialog'?dialog:null;doc.createElement=()=>new Element();
 const storage=(map,name)=>({getItem:key=>map.get(key)??null,setItem(key,value){map.set(key,value);writes.push({name,key,value});}}),originals=new Map();
 for(const[k,v]of Object.entries({location:{search},localStorage:storage(local,'local'),sessionStorage:storage(session,'session')})){originals.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 const controls=setupControlSettings({document:doc,window:win});
 function send(target,type,values={}){const e=new Event(type,{cancelable:true});for(const[k,v]of Object.entries(values))Object.defineProperty(e,k,{value:v});target.dispatchEvent(e);return e;}
 function click(el){send(doc,'pointerdown',{target:el});el.focus();send(doc,'click',{target:el});send(el,'click');}
 return{host,dialog,section,status,buttons,inputs,other,doc,win,writes,local,session,click,send,controls,
  arm(action='interact'){click(buttons[action]);assert.equal(buttons[action].attrs['aria-pressed'],'true');},
  key(code,more={}){return send(doc,'keydown',{code,...more});},
  close(){controls.dispose();for(const[k,d]of originals){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}
 };
}

test('visible focused rebinding persists only an explicit key; opening settings preserves existing custom choices',()=>{
 const custom=normalizeControls({keys:{crawl:'KeyC'},touch:{size:90,leftHanded:true}}),f=fixture({saved:custom});
 try{
  assert.equal(f.buttons.interact.textContent,'E');assert.equal(f.buttons.return.textContent,'Q');assert.equal(f.writes.length,0);assert.deepEqual(readControls(),custom);
  f.arm();assert.equal(f.key('KeyF').defaultPrevented,true);const saved=readControls();assert.equal(saved.keys.interact,'KeyF');assert.equal(saved.keys.crawl,'KeyC');assert.deepEqual(saved.touch,custom.touch);assert.equal(f.writes.length,1);
  f.arm();f.key('Escape');f.key('KeyG');assert.equal(readControls().keys.interact,'KeyF');assert.equal(f.writes.length,1,'cancel must not write or reset an existing custom binding');
 }finally{f.close();}
});

test('focus, other controls, collapsed sections, hidden pages and closed settings cancel pending capture',()=>{
 const exits=[
  ['focus',f=>f.other.focus()],['click',f=>f.send(f.doc,'click',{target:f.other})],['pointer',f=>f.send(f.doc,'pointerdown',{target:f.other})],
  ['collapse',f=>{f.section.open=false;f.send(f.section,'toggle');}],['window blur',f=>f.send(f.win,'blur')],
  ['hidden',f=>{f.doc.hidden=true;f.send(f.doc,'visibilitychange');}],['close',f=>{f.dialog.open=false;f.send(f.dialog,'close');}],
  ['touch input',f=>{f.inputs.size.value='86';f.send(f.inputs.size,'input');}],['Tab',f=>assert.equal(f.key('Tab').defaultPrevented,false)]
 ];
 for(const[name,leave]of exits){const f=fixture();try{
  f.arm();leave(f);assert.equal(f.buttons.interact.attrs['aria-pressed'],'false',name);assert.equal(f.key('KeyF').defaultPrevented,false,name+' swallowed ordinary input');assert.equal(readControls().keys.interact,'KeyE',name+' saved F');
  assert.equal(f.writes.length,name==='touch input'?1:0,name+' unexpectedly wrote storage');
 }finally{f.close();}}
});

test('capture checks actual visibility and focus even before queued DOM lifecycle events arrive',()=>{
 for(const hide of[f=>{f.dialog.open=false;},f=>{f.section.open=false;},f=>{f.doc.hidden=true;},f=>{f.host.hidden=true;},f=>{f.host.isConnected=false;},f=>{f.doc.activeElement=f.other;}]){
  const f=fixture();try{f.arm();hide(f);assert.equal(f.key('KeyF').defaultPrevented,false);assert.equal(f.writes.length,0);assert.equal(f.buttons.interact.attrs['aria-pressed'],'false');}finally{f.close();}
 }
});

test('held keys and browser shortcuts cannot save a binding, and disposed listeners cannot capture keys',()=>{
 const f=fixture();try{f.arm();for(const more of[{repeat:true},{isComposing:true},{ctrlKey:true},{metaKey:true},{altKey:true}])f.key('KeyF',more);assert.equal(f.writes.length,0);f.controls.dispose();assert.equal(f.key('KeyF').defaultPrevented,false);assert.equal(f.writes.length,0);}finally{f.close();}
});

test('QA preview reads and writes an isolated session namespace without touching real custom bindings',()=>{
 const custom=normalizeControls({keys:{interact:'KeyG',crawl:'KeyC'},touch:{size:91}}),f=fixture({saved:custom,search:'?v=campus-79&qaControls=1'});
 try{
  const production=f.local.get(CONTROL_KEY);assert.equal(readControls().keys.interact,'KeyE','preview must start with its own preferences');
  f.arm();f.key('KeyF');assert.equal(readControls().keys.interact,'KeyF');assert.equal(f.local.get(CONTROL_KEY),production);assert.equal(f.writes[0].name,'session');assert.notEqual(f.writes[0].key,CONTROL_KEY);
  globalThis.location.search='?v=campus-79';assert.deepEqual(readControls(),custom,'returning to production keeps all existing preferences');
  globalThis.location.search='?qaControls=1';assert.equal(readControls().keys.interact,'KeyF','reloading this QA tab retains only its test preferences');
 }finally{f.close();}
});
