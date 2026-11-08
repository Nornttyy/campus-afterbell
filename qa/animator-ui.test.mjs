import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAnimatorApp} from '../dist/animator/app.js';
import {getBoneEuler} from '../dist/animator/pose-store.js';

const html=await readFile(new URL('../dist/animator/index.html',import.meta.url),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
const bone=name=>({position:[0,0,0],quaternion:[0,0,0,1],scale:[1,1,1]});
const bindPose={mixamorigHips:bone(),mixamorigLeftArm:bone(),mixamorigRightArm:bone(),mixamorigLeftHandIndex1:bone()};
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};

async function fixture({storage=new Map(),failFirst=false}={}){
  const doc=new EventTarget();doc.hidden=false;doc.activeElement=null;
  class Element extends EventTarget{
    constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.dataset={};this.style={};this.attrs={};this.checked=false;this.disabled=false;this.hidden=false;this._value='';this.textContent='';}
    set value(v){this._value=String(v);}get value(){return this._value||(this.tagName==='SELECT'?this.children[0]?.value||'':'');}
    get options(){return this.children;}
    setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k];}
    append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
    replaceChildren(...nodes){for(const node of this.children)node.parentElement=null;this.children=[];this.append(...nodes);}
    querySelectorAll(selector){const match=selector.match(/^\[data-([\w-]+)\]$/),key=match?.[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());const all=[];for(const child of this.children){if(key&&key in child.dataset)all.push(child);all.push(...child.querySelectorAll(selector));}return all;}
    closest(selector){const key=selector.match(/^\[data-([\w-]+)\]$/)?.[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());for(let node=this;node;node=node.parentElement)if(key&&key in node.dataset)return node;return null;}
    focus(){doc.activeElement=this;}click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
    getBoundingClientRect(){return{left:0,top:0,width:600,height:45};}setPointerCapture(){}releasePointerCapture(){}
  }
  const nodes=new Map();
  for(const match of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
    const node=new Element(match[1]);node.id=match[3];node.value=match[2].match(/\bvalue="([^"]*)"/)?.[1]||'';node.checked=/\bchecked\b/.test(match[2]);node.hidden=/\bhidden\b/.test(match[2]);nodes.set(node.id,node);
  }
  for(const match of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g))for(const optionMatch of match[2].matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)){
    const option=new Element('option');option.value=optionMatch[1].match(/\bvalue="([^"]*)"/)?.[1]??optionMatch[2];option.textContent=optionMatch[2];nodes.get(match[1]).append(option);if(/selected/.test(optionMatch[1]))nodes.get(match[1]).value=option.value;
  }
  doc.getElementById=id=>nodes.get(id);doc.createElement=tag=>new Element(tag);doc.body=new Element('body');
  const win=new EventTarget(),raf=new Map();let rafId=0;
  win.requestAnimationFrame=fn=>{raf.set(++rafId,fn);return rafId;};win.cancelAnimationFrame=id=>raf.delete(id);
  let callbacks,currentPose=clone(bindPose),loaded=0;const calls={loaded:[],pose:[],selected:[],sampled:[],exports:[],focus:0},sourceBytes=new ArrayBuffer(16);
  const rig={
    async loadModel(id){loaded++;if(failFirst&&loaded===1)throw new Error('网络暂时不可用');calls.loaded.push(id);return{bones:[{name:'mixamorigHips',label:'骨盆',group:'躯干'},{name:'mixamorigLeftArm',label:'左上臂',group:'左臂'},{name:'mixamorigRightArm',label:'右上臂',group:'右臂'},{name:'mixamorigLeftHandIndex1',label:'左食指 1',group:'左手指'}],clips:[{name:'Walk',duration:.85}],bindPose:clone(bindPose),initialPose:clone(bindPose)};},
    setPose(pose){currentPose=clone(pose);calls.pose.push(clone(pose));},getPose:()=>clone(currentPose),selectBone:name=>calls.selected.push(name),setMode(){},setView(){},setSkeletonVisible(){},setPlaying(){},focusSelectedBone(){calls.focus++;},
    sampleClip(name,time){calls.sampled.push(time);const pose=clone(bindPose);pose.mixamorigHips.position[0]=time;return pose;},getSourceBytes:()=>sourceBytes,dispose(){calls.disposed=true;}
  };
  const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  const io={downloadProject:project=>calls.exports.push({type:'project',project}),exportGameClip:project=>calls.exports.push({type:'clip',project}),downloadAnimatedGLB:(source,project)=>calls.exports.push({type:'glb',source,project}),importProjectFile:async file=>file.project};
  const app=await createAnimatorApp({document:doc,window:win,storage:localStorage,rigFactory:async(canvas,options)=>{callbacks=options;return rig;},io});
  function send(id,type,values={}){const target=typeof id==='string'?nodes.get(id):id,event=new Event(type,{cancelable:true});for(const [key,value]of Object.entries(values))Object.defineProperty(event,key,{value});target.dispatchEvent(event);return event;}
  function click(id){nodes.get(id).click();}
  function field(id,value,type='change'){nodes.get(id).value=String(value);send(id,type);}
  function select(name){const button=nodes.get('bone-tree').querySelectorAll('[data-bone]').find(b=>b.dataset.bone===name);assert.ok(button);send('bone-tree','click',{target:button});}
  function tick(now){const work=[...raf.values()];raf.clear();for(const fn of work)fn(now);}
  return{app,doc,win,nodes,storage,calls,callbacks,sourceBytes,click,field,select,send,tick,close:()=>app.dispose()};
}

test('a range drag edits the actual pose, creates one auto-key, and undoes as one operation',async()=>{
  const f=await fixture();try{
    assert.equal(f.app.getState().busy,false);f.select('mixamorigLeftArm');f.field('current-time',1);
    for(let angle=5;angle<=90;angle+=5)f.field('rotation-z-range',angle,'input');
    assert.equal(f.app.getState().project.keys.length,1,'live drag prematurely committed keys');
    f.send('rotation-z-range','change');assert.equal(f.app.getState().project.keys.length,2);
    assert.ok(Math.abs(getBoneEuler(f.app.getState().pose,'mixamorigLeftArm',bindPose)[2]-90)<1e-6);
    f.click('undo');assert.equal(f.app.getState().project.keys.length,1,'one drag created multiple undo entries');
    f.click('redo');assert.equal(f.app.getState().project.keys.length,2);f.click('focus-bone');assert.equal(f.calls.focus,1);
  }finally{f.close();}
});

test('gizmo dragging commits only on release and preserves model independent projects',async()=>{
  const f=await fixture();try{
    f.field('current-time',.5);const pose=clone(bindPose);pose.mixamorigHips.position[1]=.2;
    for(let i=0;i<20;i++)f.callbacks.onPoseChange(pose);
    assert.equal(f.app.getState().project.keys.length,1);f.callbacks.onDragEnd(pose);assert.equal(f.app.getState().project.keys.length,2);
    await f.app.loadModel('girl');assert.equal(f.app.getState().project.keys.length,1);await f.app.loadModel('boy');assert.equal(f.app.getState().project.keys.length,2);
    assert.equal(f.app.getState().pose.mixamorigHips.position[1],.2);f.click('undo');assert.equal(f.app.getState().project.keys.length,1);
  }finally{f.close();}
});

test('autokey-off drafts survive scrubbing, playback, model changes and a reload',async()=>{
  const storage=new Map(),f=await fixture({storage});try{
    f.select('mixamorigLeftArm');f.nodes.get('auto-key').checked=false;f.field('current-time',.5);f.field('rotation-x',45,'input');f.send('rotation-x','change');
    f.field('current-time',1);f.field('current-time',.5);assert.equal(f.app.getState().dirtyPose,true);assert.ok(Math.abs(getBoneEuler(f.app.getState().pose,'mixamorigLeftArm',bindPose)[0]-45)<1e-6);
    assert.equal(f.app.getState().project.keys.length,1);f.click('play');f.tick(100);f.tick(150);f.click('play');assert.equal(f.app.getState().project.keys.length,1,'previewing silently records a draft');
    f.field('current-time',.5);await f.app.loadModel('teacher');await f.app.loadModel('boy');assert.equal(f.app.getState().dirtyPose,true);assert.equal(f.app.getState().project.keys.length,1);
  }finally{f.close();}
  const restored=await fixture({storage});try{assert.equal(restored.app.getState().dirtyPose,true);assert.ok(Math.abs(getBoneEuler(restored.app.getState().pose,'mixamorigLeftArm',bindPose)[0]-45)<1e-6);}finally{restored.close();}
});

test('timeline key dragging preserves pose and is undoable; text fields own their keyboard input',async()=>{
  const f=await fixture();try{
    f.field('current-time',1);f.click('add-key');const key=f.app.getState().selectedKey,marker=f.nodes.get('key-markers').querySelectorAll('[data-key-id]').find(b=>b.dataset.keyId===key);
    f.send('timeline-track','pointerdown',{target:marker,clientX:300,pointerId:1,button:0});f.send('timeline-track','pointermove',{clientX:450,pointerId:1});f.send('timeline-track','pointerup',{clientX:450,pointerId:1});
    assert.equal(f.app.getState().project.keys.find(k=>k.id===key).time,1.5);f.click('undo');assert.equal(f.app.getState().project.keys.find(k=>k.id===key).time,1);
    const typingEvent=f.send(f.doc,'keydown',{target:f.nodes.get('rotation-x'),code:'Space'});assert.equal(typingEvent.defaultPrevented,false);assert.equal(f.app.getState().playing,false);
    const shortcut=f.send(f.doc,'keydown',{target:f.doc.body,code:'Space'});assert.equal(shortcut.defaultPrevented,true);assert.equal(f.app.getState().playing,true);
  }finally{f.close();}
});

test('existing clips are sampled on the chosen frame grid and exact endpoint, then export source GLB',async()=>{
  const f=await fixture();try{
    f.click('load-clip');await flush();const p=f.app.getState().project;assert.equal(p.name,'Walk');assert.equal(p.duration,.85);
    for(const key of p.keys){assert.ok(Math.abs(key.pose.mixamorigHips.position[0]-key.time)<1e-8,'pose sampled at a different time than its key');if(key.time!==p.duration)assert.ok(Math.abs(key.time*p.fps-Math.round(key.time*p.fps))<1e-8);}
    assert.equal(p.keys.at(-1).time,.85);f.click('export-glb');await flush();assert.equal(f.calls.exports[0].source,f.sourceBytes);assert.equal(f.calls.exports[0].project.modelId,'boy');
  }finally{f.close();}
});

test('failed model load exposes recovery and JSON imports switch to the matching model',async()=>{
  const f=await fixture({failFirst:true});try{
    assert.equal(f.nodes.get('retry-load').hidden,false);f.click('retry-load');await flush();assert.equal(f.app.getState().busy,false);
    const imported={...f.app.getState().project,modelId:'ponytail',name:'挥手'};f.nodes.get('project-file').files=[{project:imported}];f.send('project-file','change');await flush();
    assert.equal(f.app.getState().modelId,'ponytail');assert.equal(f.app.getState().project.name,'挥手');assert.equal(f.nodes.get('model-select').value,'ponytail');
  }finally{f.close();}
});


test('FPS changes keep the first pose when it rounds to frame zero',async()=>{
 const f=await fixture();try{const p=f.app.getState().project;p.fps=60;p.keys[0].time=1/60;p.keys[0].pose.mixamorigHips.position[0]=.1;p.keys.push({id:'second',time:1,pose:clone(bindPose)});await f.app.loadModel('boy',p);f.field('fps',24);const keys=f.app.getState().project.keys;assert.equal(keys.length,2);assert.equal(keys[0].time,0);assert.equal(keys[0].pose.mixamorigHips.position[0],.1);f.click('undo');assert.equal(f.app.getState().project.fps,60);}finally{f.close();}
});

test('an incompatible imported skeleton cannot overwrite an existing project',async()=>{
 const f=await fixture();try{f.field('project-name','保留这个动作');const p=f.app.getState().project;p.name='无效项目';for(const key of p.keys){key.pose.invalidBone=key.pose.mixamorigLeftArm;delete key.pose.mixamorigLeftArm;}await f.app.loadModel('boy',p);assert.equal(f.app.getState().busy,false);assert.equal(f.app.getState().project.name,'保留这个动作');assert.match(f.nodes.get('notification').textContent,/骨架不匹配/);f.close();assert.equal(JSON.parse(f.storage.get('campus.animator.v1.boy')).project.name,'保留这个动作');}finally{f.close();}
});

test('loading a clip and undoing restores prior unrecorded poses',async()=>{
 const f=await fixture();try{f.nodes.get('auto-key').checked=false;f.select('mixamorigLeftArm');f.field('current-time',.5);f.field('rotation-x',45,'input');f.send('rotation-x','change');f.field('current-time',1);assert.equal(f.app.getState().time,1);f.click('load-clip');await flush();f.click('undo');f.field('current-time',.5);assert.equal(f.app.getState().dirtyPose,true);assert.ok(Math.abs(getBoneEuler(f.app.getState().pose,'mixamorigLeftArm',bindPose)[0]-45)<1e-6);}finally{f.close();}
});

test('corrupt local projects are backed up before a new draft is saved',async()=>{
 const raw='{broken',storage=new Map([['campus.animator.v1.boy',raw]]),f=await fixture({storage});try{f.close();assert.ok([...storage].some(([key,value])=>key.startsWith('campus.animator.v1.boy.recovery.')&&value===raw));assert.equal(JSON.parse(storage.get('campus.animator.v1.boy')).project.modelId,'boy');}finally{f.close();}
});

test('saving a project records all draft times in one undoable operation',async()=>{
 const f=await fixture();try{f.nodes.get('auto-key').checked=false;f.select('mixamorigLeftArm');for(const [at,angle]of [[.5,45],[1,90]]){f.field('current-time',at);f.field('rotation-x',angle,'input');f.send('rotation-x','change');}f.click('export-project');await flush();const p=f.calls.exports[0].project;assert.deepEqual(p.keys.map(k=>k.time),[0,.5,1]);assert.equal(f.app.getState().dirtyPose,false);for(const [index,angle]of [[1,45],[2,90]])assert.ok(Math.abs(getBoneEuler(p.keys[index].pose,'mixamorigLeftArm',bindPose)[0]-angle)<1e-6);f.click('undo');assert.equal(f.app.getState().project.keys.length,1);f.field('current-time',.5);assert.equal(f.app.getState().dirtyPose,true);}finally{f.close();}
});
