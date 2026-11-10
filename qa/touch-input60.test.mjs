import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionUI} from '../dist/session-ui.js';

function fixture({room}={}){
 class Element extends EventTarget{
  constructor(){super();this.nodes=new Map();this.style={};this.attrs={};this.firstElementChild={style:{}};this.captures=new Set();}
  set innerHTML(html){for(const m of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){const n=new Element();n.value=m[0].match(/\bvalue="([^"]*)"/)?.[1]||'';this.nodes.set('#'+m[1],n);}}
  querySelector(k){if(!this.nodes.has(k))this.nodes.set(k,new Element());return this.nodes.get(k);}
  querySelectorAll(){return[];}append(c){this.child=c;}remove(){}setAttribute(k,v){this.attrs[k]=v;}
  getBoundingClientRect(){return{x:0,y:0,width:100,height:100};}
  setPointerCapture(id){this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}
  releasePointerCapture(id){this.captures.delete(id);this.dispatchEvent(pointer('lostpointercapture',id));}
  showModal(){this.open=true;}close(){this.open=false;}
 }
 const doc=Object.assign(new EventTarget(),{createElement:()=>new Element(),hidden:false}),win=new EventTarget(),saved=new Map(),root=new Element(),events=[];
 for(const[k,v]of Object.entries({document:doc,window:win,navigator:{maxTouchPoints:3},matchMedia:()=>({matches:true})})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 const names=['interact','interactEnd','return','returnEnd','hold','cancel','look','suspend','unlock','resumeLook'],commands=Object.fromEntries(names.map(k=>[k,(...args)=>events.push([k,...args])])),ui=createSessionUI({root,commands}),el=id=>root.child.querySelector(id);
 const snapshot={stage:'gathering',status:'playing',role:'student',player:{},settings:{duration:600,target:120}},round={room};ui.update(snapshot,round);
 return{ui,events,el,doc,win,update:patch=>ui.update({...snapshot,...patch},round),send(id,type,pid,x=50,y=0){el(id).dispatchEvent(pointer(type,pid,x,y));},close(){ui.dispose();for(const[k,d]of saved){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}};
}
function pointer(type,id,x=50,y=0){const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:id,clientX:x,clientY:y});return e;}

test('normal E/Q release and its lost-capture do not cancel a second finger holding Use',()=>{
 const f=fixture();try{f.send('#touch-use','pointerdown',1);for(const id of['#touch-e','#touch-q']){f.send(id,'pointerdown',2);f.send(id,'pointerup',2);f.send(id,'lostpointercapture',2);}assert.deepEqual(f.events,[['hold',true],['interact'],['interactEnd'],['return'],['returnEnd']]);f.send('#touch-use','pointerup',1);f.send('#touch-use','lostpointercapture',1);assert.deepEqual(f.events.at(-1),['hold',false]);assert.equal(f.events.filter(x=>x[0]==='cancel').length,0);}finally{f.close();}
});
test('a second finger cannot steal joystick, look, or held-use ownership',()=>{
 const f=fixture();try{
  f.send('#touch-stick','pointerdown',1);f.send('#touch-stick','pointerdown',2,100,50);f.send('#touch-stick','pointerup',2);assert.deepEqual(f.ui.axes(),{side:0,forward:1,crawl:false});f.send('#touch-stick','pointerup',1);assert.equal(f.ui.axes().forward,0);
  f.send('#touch-look','pointerdown',3,50,50);f.send('#touch-look','pointerdown',4,100,100);f.send('#touch-look','pointerup',4);f.send('#touch-look','pointermove',3,60,55);assert.deepEqual(f.events.at(-1),['look',15,7.5]);
  f.send('#touch-use','pointerdown',5);f.send('#touch-use','pointerdown',6);f.send('#touch-use','pointerup',6);assert.equal(f.events.filter(x=>x[0]==='hold').length,1);f.send('#touch-use','pointerup',5);assert.deepEqual(f.events.at(-1),['hold',false]);
 }finally{f.close();}
});
test('pause, blur and hidden page clear touch input; late releases cannot restart or complete an action',()=>{
 const f=fixture();try{for(const stop of[()=>f.update({paused:true}),()=>f.win.dispatchEvent(new Event('blur')),()=>{f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));}]){
  f.doc.hidden=false;f.update({paused:false});f.send('#touch-stick','pointerdown',1);f.el('#touch-crawl').dispatchEvent(new Event('click'));assert.equal(f.ui.axes().crawl,true);f.send('#touch-use','pointerdown',2);stop();assert.deepEqual(f.ui.axes(),{side:0,forward:0,crawl:false});const n=f.events.length;f.send('#touch-use','pointerup',2);f.send('#touch-use','lostpointercapture',2);assert.equal(f.events.length,n);f.update({paused:false});assert.equal(f.ui.axes().forward,0);
 }}finally{f.close();}
});
test('opening a modal clears moving fingers; unexpected lost capture ends the active action once',()=>{
 const f=fixture();try{f.send('#touch-stick','pointerdown',1);f.el('#touch-crawl').dispatchEvent(new Event('click'));assert.equal(f.ui.openLocker(),true);assert.deepEqual(f.ui.axes(),{side:0,forward:0,crawl:false});f.send('#touch-use','pointerdown',3);f.send('#touch-use','lostpointercapture',3);f.send('#touch-use','pointerup',3);assert.equal(f.events.filter(x=>x[0]==='cancel').length,1);}finally{f.close();}
});

test('solo preparation does not duplicate its HUD phase label, while room lobby retains its host controls',()=>{
 const solo=fixture();try{assert.equal(solo.el('#session-lobby').hidden,true);assert.equal(solo.el('#session-status').textContent,'');}finally{solo.close();}
 const online=fixture({room:{code:'640001',members:[{},{}],hostId:'a',selfId:'a'}});try{assert.equal(online.el('#session-lobby').hidden,false);assert.equal(online.el('#session-status').textContent,'在更衣柜选择身份');assert.equal(online.el('#session-bell').hidden,false);assert.equal(online.el('#session-bell').disabled,false);online.update({stage:'seating'});assert.equal(online.el('#session-lobby').hidden,true);}finally{online.close();}
});
