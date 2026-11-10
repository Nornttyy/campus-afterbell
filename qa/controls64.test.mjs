import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTROL_KEY,normalizeControls,readControls,rebindControl,actionForCode,applyTouchStyle} from '../dist/control-settings64.js';

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
