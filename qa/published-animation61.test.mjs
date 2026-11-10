import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PUBLISHED_HAND_ANIMATIONS as published} from '../dist/published-hand-animations61.js';
import {validateHandAnimationDocument,createHandAnimationDocument,sampleHandAnimationClip} from '../dist/hand-animation-data59.js';
import {createHandAnimationRuntime,loadHandAnimations,saveHandAnimations,clearHandAnimations,HAND_ANIMATION_STORAGE_KEY,HAND_ANIMATION_CHANGE_EVENT} from '../dist/hand-animation-runtime59.js';
const memory=()=>{const values=new Map();let writes=0;return{getItem:k=>values.get(k)??null,setItem(k,v){writes++;values.set(k,v);},removeItem(k){writes++;values.delete(k);},get writes(){return writes;}};};
const runtime=(storage,eventTarget=null)=>createHandAnimationRuntime({storage,eventTarget,fallbackDocument:published});
const settle=(r,state,start=0)=>{let p;for(let i=0;i<20;i++)p=r.sample(state,start+i/60);return p;};

test('release contains only the confirmed student idle and matches the portable JSON',async()=>{
 const source=JSON.parse(await readFile(new URL('../dist/assets/animations/user-hands-20261110.json',import.meta.url),'utf8'));
 assert.deepEqual(published,source);assert.equal(validateHandAnimationDocument(published).ok,true);
 assert.deepEqual(Object.keys(published.clips),['student-idle']);
 const idle=published.clips['student-idle'];assert.equal(idle.duration,1);assert.equal(idle.keyframes.length,1);
 assert.deepEqual(idle.keyframes[0].left.position,[-0.2586505367912693,-0.4890046217712004,-0.62]);
 assert.deepEqual(idle.keyframes[0].right.rotation,[0.1286985353709653,1.440693143608363,-1.4483995182237313]);
});

test('new players receive the authored idle without importing or writing browser storage',()=>{
 const s=memory(),r=runtime(s),p=settle(r,{role:'student',movement:0});
 assert.equal(p.clipId,'student-idle');assert.equal(p.weight,1);
 assert.deepEqual(p.left,sampleHandAnimationClip(published.clips['student-idle'],0).left);
 assert.equal(s.writes,0);assert.equal(loadHandAnimations(s),null);
 const copy=r.getDocument();copy.clips['student-idle'].duration=9;
 assert.equal(r.getDocument().clips['student-idle'].duration,1);r.dispose();
});

test('denied or corrupt browser storage still uses the published idle',()=>{
 for(const s of [null,{getItem(){throw Error('denied');}},{getItem(){return '<html>';}}]){
  const r=runtime(s);assert.equal(settle(r,{movement:0}).clipId,'student-idle');r.dispose();
 }
});

test('local applied files retain whole-document priority and unrelated drafts remain intact',()=>{
 const s=memory(),custom=createHandAnimationDocument();delete custom.clips['student-idle'];
 custom.clips['student-walk'].keyframes[0].left.position[0]=-.51;
 s.setItem('campus.handAnimations.editor.v2','private unfinished draft');saveHandAnimations(custom,s);
 const before=s.writes,r=runtime(s);
 assert.deepEqual(r.getDocument(),custom);assert.equal(settle(r,{movement:0}),null);
 assert.equal(settle(r,{movement:1},1).left.position[0],-.51);
 assert.equal(s.writes,before);assert.equal(s.getItem('campus.handAnimations.editor.v2'),'private unfinished draft');r.dispose();
});

test('clearing a local override returns smoothly to the published idle without altering drafts',()=>{
 const s=memory(),events=new EventTarget(),custom=structuredClone(published);
 custom.clips['student-idle'].keyframes[0].left.position[0]=-.6;
 saveHandAnimations(custom,s);s.setItem('campus.handAnimations.editor.v2','draft');
 const r=runtime(s,events),last=settle(r,{movement:0});
 clearHandAnimations(s);events.dispatchEvent(new Event(HAND_ANIMATION_CHANGE_EVENT));
 const first=r.sample({movement:0},20/60);assert.deepEqual(first.left.position,last.left.position);
 const final=settle(r,{movement:0},21/60);assert.deepEqual(final.left.position,published.clips['student-idle'].keyframes[0].left.position);
 assert.equal(s.getItem('campus.handAnimations.editor.v2'),'draft');assert.equal(s.getItem(HAND_ANIMATION_STORAGE_KEY),null);r.dispose();
});

test('other motions and special interactions are not replaced by this publication',()=>{
 for(const state of [{movement:1},{movement:1,crouched:true},{role:'teacher',movement:0},{role:'teacher',movement:1},{seated:true},{carrying:true},{drawerOpen:true},{penWriting:true},{computerActive:true},{caught:true}]){
  const r=runtime(memory());assert.equal(settle(r,state),null,JSON.stringify(state));r.dispose();
 }
 const r=runtime(memory());settle(r,{movement:0});assert.equal(settle(r,{movement:1},1),null);r.dispose();
});

test('published defaults are wired into the production scene, not into editor draft loading',async()=>{
 const scene=await readFile(new URL('../dist/classroom.js',import.meta.url),'utf8');
 assert.match(scene,/createHandAnimationRuntime\(\{fallbackDocument:PUBLISHED_HAND_ANIMATIONS\}\)/);
 const editor=await readFile(new URL('../dist/animation-editor59.js',import.meta.url),'utf8');
 assert.doesNotMatch(editor,/published-hand-animations61|PUBLISHED_HAND_ANIMATIONS/);
 const r=createHandAnimationRuntime({storage:memory(),fallbackDocument:{invalid:true}});
 assert.equal(settle(r,{movement:0}),null);r.dispose();
});
