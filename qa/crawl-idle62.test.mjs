import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHandAnimationDocument,validateHandAnimationDocument,sampleHandAnimationClip} from '../dist/hand-animation-data59.js';
import {prepareAnimationEditorDocument} from '../dist/animation-editor-start59.js';
import {createHandAnimationRuntime,saveHandAnimations,selectHandAnimationClip} from '../dist/hand-animation-runtime59.js';
import {PUBLISHED_HAND_ANIMATIONS} from '../dist/published-hand-animations61.js';
const memory=()=>{const data=new Map();return{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const settle=(r,state,start=0)=>{let pose;for(let i=0;i<20;i++)pose=r.sample(state,start+i*.02);return pose;};

test('five-clip drafts gain only a stationary crawl idle; original authored content is untouched',()=>{
 const old=createHandAnimationDocument();delete old.clips['student-crawl-idle'];
 old.clips['student-crawl'].duration=3;old.clips['student-crawl'].keyframes[0].left.fingers={Thumb:.9};
 old.clips['student-idle']=structuredClone(PUBLISHED_HAND_ANIMATIONS.clips['student-idle']);
 const before=structuredClone(old),{document}=prepareAnimationEditorDocument(old);
 assert.deepEqual(old,before);
 for(const[id,clip]of Object.entries(before.clips))assert.deepEqual(document.clips[id],clip);
 const idle=document.clips['student-crawl-idle'];assert.equal(idle.keyframes.length,1);
 assert.deepEqual(sampleHandAnimationClip(idle,0),sampleHandAnimationClip(idle,1.73));
 assert.deepEqual(idle.keyframes[0].left.position,createHandAnimationDocument().clips['student-crawl'].keyframes[0].left.position);
 idle.keyframes[0].left.position[0]=-.61;assert.deepEqual(old,before);
});

test('authored crawl idle survives validation, JSON round trip and reopening a draft',()=>{
 const doc=createHandAnimationDocument(),idle=doc.clips['student-crawl-idle'];
 idle.duration=3;idle.easing='linear';idle.keyframes.push(structuredClone(idle.keyframes[0]));
 idle.keyframes[1].time=3;idle.keyframes[1].right.rotation[2]=.9;
 idle.keyframes[1].left.fingers={Index:.8,Pinky:.1};
 const saved=JSON.parse(JSON.stringify(doc)),checked=validateHandAnimationDocument(saved);
 assert.equal(checked.ok,true);assert.deepEqual(checked.value,doc);
 assert.deepEqual(prepareAnimationEditorDocument(checked.value).document,doc);
});

test('prone idle and locomotion are distinct; teachers and occupied hands cannot use them',()=>{
 for(const flag of [{crouched:true},{crawling:true},{crawlBlend:1}]){
  assert.equal(selectHandAnimationClip({movement:0,...flag}),'student-crawl-idle');
  assert.equal(selectHandAnimationClip({movement:1,...flag}),'student-crawl');
  for(const movement of [0,1])assert.equal(selectHandAnimationClip({role:'teacher',movement,...flag}),null);
 }
 assert.equal(selectHandAnimationClip({movement:0,crawlBlend:.25}),null);
 assert.equal(selectHandAnimationClip({movement:0,crawlBlend:0}),'student-idle');
 for(const state of [{seated:true},{holding:true},{drawerOpen:true},{computerActive:true},{caught:true},{penWriting:true},{freeLook:false}])
  assert.equal(selectHandAnimationClip({crouched:true,movement:0,...state}),null);
});

test('crawl move to idle to move crossfades from the visible pose, and idle continues its own timeline',()=>{
 const s=memory(),doc=createHandAnimationDocument();
 for(const[id,x]of [['student-crawl',-.18],['student-crawl-idle',-.5]]){
  const clip=doc.clips[id];clip.duration=2;clip.easing='linear';
  clip.keyframes[0].left.position[0]=x;clip.keyframes.push(structuredClone(clip.keyframes[0]));
  clip.keyframes[1].time=2;clip.keyframes[1].left.position[0]=x+.08;
 }
 saveHandAnimations(doc,s);const r=createHandAnimationRuntime({storage:s,eventTarget:null});
 const moving={crouched:true,crawlBlend:1,movement:1},idle={...moving,movement:0};
 let last=settle(r,moving),first=r.sample(idle,.4);assert.deepEqual(first.left.position,last.left.position);
 last=settle(r,idle,.42);assert.equal(last.clipId,'student-crawl-idle');assert.equal(last.weight,1);
 assert.ok(last.left.position[0]>-.5&&last.left.position[0]<-.46);
 first=r.sample(moving,.82);assert.deepEqual(first.left.position,last.left.position);
 last=settle(r,moving,.84);assert.equal(last.clipId,'student-crawl');assert.ok(last.left.position[0]>-.18);
 assert.equal(r.sample({...idle,seated:true},1.25),null);r.dispose();
});

test('without an authored crawl idle the current published release and older local files retain procedural prone rest',()=>{
 for(const oldLocal of [false,true]){
  const s=memory();if(oldLocal){const old=createHandAnimationDocument();delete old.clips['student-crawl-idle'];saveHandAnimations(old,s);}
  const r=createHandAnimationRuntime({storage:s,eventTarget:null,fallbackDocument:PUBLISHED_HAND_ANIMATIONS});
  assert.equal(settle(r,{crouched:true,movement:0}),null);r.dispose();
 }
 assert.deepEqual(Object.keys(PUBLISHED_HAND_ANIMATIONS.clips),['student-idle']);
});

test('editor exposes both crawl states, shares the low viewpoint and stays paused without changing draft keys',async()=>{
 const [html,script]=await Promise.all(['animation-editor.html','animation-editor59.js'].map(p=>readFile(new URL('../dist/'+p,import.meta.url),'utf8')));
 assert.match(html,/data-clip="student-crawl-idle"[^>]*>.*?学生爬行待机/);
 assert.match(html,/data-clip="student-crawl"[^>]*>.*?学生爬行移动/);
 assert.match(script,/crawl=clipId\.startsWith\('student-crawl'\),eye=crawl\?\.65/);
 assert.match(script,/playing=false/);assert.match(script,/DRAFT='campus\.handAnimationDraft\.v2'/);
 assert.match(script,/LEGACY_DRAFT='campus\.handAnimationDraft\.v1'/);
});
