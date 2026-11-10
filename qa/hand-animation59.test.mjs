import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createHandAnimationDocument,validateHandAnimationDocument,sampleHandAnimationClip,HAND_CLIP_IDS,HAND_ANIMATION_MAX_BYTES} from '../dist/hand-animation-data59.js';
import {createHandAnimationRuntime,loadHandAnimations,saveHandAnimations,clearHandAnimations,selectHandAnimationClip,HAND_ANIMATION_STORAGE_KEY,HAND_ANIMATION_CHANGE_EVENT} from '../dist/hand-animation-runtime59.js';
import {createDeskHands} from '../dist/game-actors.js';
import {createRiggedPalm} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';
const clone=o=>JSON.parse(JSON.stringify(o)),Q=()=>new T.Quaternion(),V=()=>new T.Vector3(),DT=1/60;
const storage=()=>{const data=new Map();return{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const near=(a,b,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<epsilon,`${a} differs from ${b}`);
test('initial templates contain five independent stationary poses; creating them does not save',()=>{
 const a=createHandAnimationDocument(),b=createHandAnimationDocument();assert.equal(validateHandAnimationDocument(a).ok,true);
 assert.equal(HAND_CLIP_IDS.length,5);for(const id of HAND_CLIP_IDS){const c=a.clips[id];assert.equal(c.keyframes.length,1);assert.equal(c.keyframes[0].time,0);assert.deepEqual(sampleHandAnimationClip(c,0),sampleHandAnimationClip(c,c.duration));}
 a.clips['student-walk'].keyframes[0].left.position[0]=2;assert.notDeepEqual(a,b);assert.equal(loadHandAnimations(storage()),null);
});
for(const [name,change]of [
 ['wrong version',d=>d.version=2],['unknown clip',d=>d.clips.run=d.clips['student-walk']],
 ['negative duration',d=>d.clips['student-walk'].duration=-1],['infinite position',d=>d.clips['student-walk'].keyframes[0].left.position[0]=Infinity],
 ['too distant',d=>d.clips['student-walk'].keyframes[0].left.position[0]=3.01],['bad rotation',d=>d.clips['student-walk'].keyframes[0].right.rotation[0]='0'],
 ['bad finger',d=>d.clips['student-walk'].keyframes[0].left.fingers={Thumb:2}],['extra finger',d=>d.clips['student-walk'].keyframes[0].left.fingers={Ring:.5}],
 ['bad curl',d=>d.clips['student-walk'].keyframes[0].left.curl=NaN],['same time',d=>d.clips['student-walk'].keyframes.push(clone(d.clips['student-walk'].keyframes[0]))],
 ['no first key',d=>d.clips['student-walk'].keyframes[0].time=.1],['too many frames',d=>d.clips['student-walk'].keyframes=Array(129).fill(d.clips['student-walk'].keyframes[0])]
])test(`invalid data rejected: ${name}`,()=>{const d=createHandAnimationDocument();change(d);assert.equal(validateHandAnimationDocument(d).ok,false);});
test('validator copies only supported fields, preserving optional fingers and safe partial clips',()=>{
 const d=createHandAnimationDocument();delete d.clips['teacher-walk'];d.secret='not allowed';d.clips['student-walk'].keyframes[0].left.fingers={Thumb:.1,Index:.9};d.clips['student-walk'].url='javascript:unsafe';const v=validateHandAnimationDocument(d);assert.equal(v.ok,true);assert.equal(v.value.secret,undefined);assert.equal(v.value.clips['student-walk'].url,undefined);assert.equal(v.value.clips['teacher-walk'],undefined);d.clips['student-walk'].keyframes[0].left.position[0]=2;assert.notEqual(v.value.clips['student-walk'].keyframes[0].left.position[0],2);
});
function linearClip(){const d=createHandAnimationDocument().clips['student-walk'];d.duration=1;d.easing='linear';d.keyframes=[clone(d.keyframes[0]),clone(d.keyframes[0])];d.keyframes[1].time=1;for(const s of ['left','right']){d.keyframes[0][s].position=[0,0,0];d.keyframes[1][s].position=[1,2,3];d.keyframes[0][s].rotation=[0,0,Math.PI*179/180];d.keyframes[1][s].rotation=[0,0,-Math.PI*179/180];d.keyframes[0][s].curl=0;d.keyframes[1][s].curl=1;}return d;}
test('scrubbing interpolates positions/fingers, takes shortest quaternion arc and clamps final key instead of looping',()=>{
 const c=linearClip(),before=clone(c);c.keyframes[0].left.fingers={Thumb:1,Index:.2};c.keyframes[1].left.fingers={Thumb:0,Index:.4};const p=sampleHandAnimationClip(c,.5);assert.deepEqual(p.left.position,[.5,1,1.5]);near(p.left.curl,.5);near(p.left.fingers.Thumb,.5);near(p.left.fingers.Index,.3);const q=Q().fromArray(p.left.quaternion);assert.ok(q.angleTo(Q().setFromEuler(new T.Euler(0,0,Math.PI)))<1e-6);assert.deepEqual(sampleHandAnimationClip(c,1).left.position,[1,2,3]);assert.deepEqual(sampleHandAnimationClip(c,4).left.position,[1,2,3]);assert.deepEqual(sampleHandAnimationClip(c,-1).left.position,[0,0,0]);assert.deepEqual(c.keyframes[0].left.position,before.keyframes[0].left.position);
 c.easing='smoothstep';near(sampleHandAnimationClip(c,.25).left.position[0],.15625);c.easing='step';near(sampleHandAnimationClip(c,.99).left.position[0],0);near(sampleHandAnimationClip(c,1).left.position[0],1);
});
test('storage rejects corrupt/unavailable/oversize content and saves only validated serializable data',()=>{
 const s=storage();for(const raw of ['<html>',JSON.stringify({version:1}),' '.repeat(HAND_ANIMATION_MAX_BYTES+1)]){s.setItem(HAND_ANIMATION_STORAGE_KEY,raw);assert.equal(loadHandAnimations(s),null);}assert.equal(loadHandAnimations({getItem(){throw Error('denied');}}),null);assert.throws(()=>saveHandAnimations(createHandAnimationDocument(),null),/无法保存/);assert.throws(()=>saveHandAnimations(createHandAnimationDocument(),{setItem(){throw Error('quota');}}),/空间不足/);const d=createHandAnimationDocument();saveHandAnimations(d,s);assert.deepEqual(loadHandAnimations(s),d);clearHandAnimations(s);assert.equal(loadHandAnimations(s),null);
});
test('runtime is opt-in, guards all special poses, fades, loops and cleans up listeners',()=>{
 const s=storage(),events=new EventTarget(),r=createHandAnimationRuntime({storage:s,eventTarget:events});assert.equal(r.sample({role:'student',movement:1},0),null);assert.equal(r.sample({role:'student',movement:1},.1),null);const oldDocument=createHandAnimationDocument();delete oldDocument.clips['student-idle'];delete oldDocument.clips['teacher-idle'];saveHandAnimations(oldDocument,s);events.dispatchEvent(new Event(HAND_ANIMATION_CHANGE_EVENT));assert.equal(r.sample({movement:1},0),null);let p=r.sample({movement:1},.07);near(p.weight,.5);p=r.sample({movement:1},.14);near(p.weight,1);assert.equal(p.clipId,'student-walk');p=r.sample({movement:0},.21);near(p.weight,.5);assert.equal(r.sample({movement:0},.28),null);
 for(const extra of [{freeLook:false},{seated:true},{carrying:true},{holding:true},{eating:true},{penWriting:true},{penTwirling:true},{caught:true},{computer:true},{bookAmount:.5},{drawerOpen:true},{surveillance:true},{writing:true},{carryingStudent:true},{throwing:true},{teacherPhase:'grabbing'},{captivity:'bound'}])assert.equal(selectHandAnimationClip({movement:1,...extra}),null);
 assert.equal(selectHandAnimationClip({role:'teacher',movement:1,crawlBlend:1}),null);assert.equal(selectHandAnimationClip({role:'student',movement:1,crawlBlend:1}),'student-crawl');assert.equal(selectHandAnimationClip({role:'teacher',movement:1}),'teacher-walk');
 r.sample({movement:1},1);p=r.sample({movement:1},1.1);const paused=r.sample({movement:1},1.1);assert.deepEqual(paused,p);for(let i=1;i<40;i++)p=r.sample({movement:1},1.1+i*.05);assert.ok(p&&p.left.position.every(Number.isFinite));r.dispose();events.dispatchEvent(new Event(HAND_ANIMATION_CHANGE_EVENT));assert.equal(r.sample({movement:1},4),null);
});
test('runtime does not apply absent clips or a different storage key',()=>{
 const s=storage(),events=new EventTarget(),d=createHandAnimationDocument();delete d.clips['teacher-walk'];saveHandAnimations(d,s);const r=createHandAnimationRuntime({storage:s,eventTarget:events});for(let i=0;i<10;i++)assert.equal(r.sample({role:'teacher',movement:1},i*.02),null);r.sample({movement:1},1);const p=r.sample({movement:1},1.1);assert.ok(p);s.setItem(HAND_ANIMATION_STORAGE_KEY,'invalid');const e=new Event('storage');e.key='unrelated';events.dispatchEvent(e);assert.ok(r.sample({movement:1},1.2));const changed=new Event('storage');changed.key=HAND_ANIMATION_STORAGE_KEY;events.dispatchEvent(changed);assert.ok(r.sample({movement:1},1.3).weight<1);assert.equal(r.sample({movement:1},1.4),null);r.dispose();
});
test('editing and clearing a saved clip transition without resetting the visible pose',()=>{
 const s=storage(),events=new EventTarget(),d=createHandAnimationDocument();saveHandAnimations(d,s);const r=createHandAnimationRuntime({storage:s,eventTarget:events});let p;for(let i=0;i<20;i++)p=r.sample({movement:1},i*.02);for(const key of d.clips['student-walk'].keyframes)key.left.position[0]+=.15;saveHandAnimations(d,s);events.dispatchEvent(new Event(HAND_ANIMATION_CHANGE_EVENT));const updated=r.sample({movement:1},.40);assert.deepEqual(updated.left.position,p.left.position);near(updated.weight,1);for(let i=1;i<12;i++)p=r.sample({movement:1},.40+i*.02);clearHandAnimations(s);events.dispatchEvent(new Event(HAND_ANIMATION_CHANGE_EVENT));const fading=r.sample({movement:1},.64);assert.ok(fading.weight>0&&fading.weight<1);r.sample({movement:1},.74);assert.equal(r.sample({movement:1},.84),null);r.dispose();
});
test('walking to crawling crossfades from the last rendered pose rather than snapping to either default',()=>{
 const s=storage();saveHandAnimations(createHandAnimationDocument(),s);const r=createHandAnimationRuntime({storage:s,eventTarget:null});let p;for(let i=0;i<20;i++)p=r.sample({movement:1},i*.02);const firstCrawl=r.sample({movement:1,crawlBlend:1},.40);assert.deepEqual(firstCrawl.left.position,p.left.position);near(firstCrawl.weight,1);let maxStep=0,previous=firstCrawl;
 for(let i=1;i<15;i++){const next=r.sample({movement:1,crawlBlend:1},.40+i*.02);maxStep=Math.max(maxStep,new T.Vector3(...next.left.position).distanceTo(new T.Vector3(...previous.left.position)));previous=next;}assert.ok(maxStep<.15,`switch teleports ${maxStep}m`);assert.equal(previous.clipId,'student-crawl');r.dispose();
});
test('empty standing student and teacher select their own idle, never a stopped or rising crawler',()=>{
 for(const role of ['student','teacher']){
  assert.equal(selectHandAnimationClip({role,movement:0,freeLook:true}),`${role}-idle`);
  assert.equal(selectHandAnimationClip({role,movement:.01}),`${role}-idle`);
  assert.equal(selectHandAnimationClip({role,movement:.02}),`${role}-walk`);
  for(const special of [{seated:true},{carrying:true},{holding:true},{eating:true},{drawerOpen:true},{computerActive:true},{bookRaised:true},{caught:true},{captivity:'carried'},{writing:true},{throwing:true},{penTwirling:true},{penWriting:true},{freeLook:false}])assert.equal(selectHandAnimationClip({role,movement:0,...special}),null);
 }
 for(const extra of [{crouched:true},{crawling:true},{crawlBlend:1},{crawlBlend:.25}])assert.equal(selectHandAnimationClip({role:'student',movement:0,...extra}),null);
 assert.equal(selectHandAnimationClip({role:'teacher',movement:1,crouched:true}),null);
});
test('stationary idle advances on scene time and walk/idle transitions preserve the last visible pose for either role',()=>{
 for(const role of ['student','teacher']){
  const s=storage(),d=createHandAnimationDocument();
  for(const [kind,x]of [['idle',-.3],['walk',.3]]){
   const c=d.clips[`${role}-${kind}`];c.duration=1;c.easing='linear';c.keyframes=[clone(c.keyframes[0]),clone(c.keyframes[0])];c.keyframes[1].time=1;
   c.keyframes[0].left.position[0]=x;c.keyframes[1].left.position[0]=x+.1;
  }
  saveHandAnimations(d,s);const r=createHandAnimationRuntime({storage:s,eventTarget:null});let previous;
  // Round elapsed may still be zero in preparation; renderer passes scene time.
  for(let i=0;i<20;i++)previous=r.sample({role,movement:0},i*.02);
  assert.equal(previous.clipId,`${role}-idle`);near(previous.weight,1);assert.ok(previous.left.position[0]>-.3);
  const switched=r.sample({role,movement:1},.4);assert.deepEqual(switched.left.position,previous.left.position);near(switched.weight,1);
  for(let i=1;i<20;i++)previous=r.sample({role,movement:1},.4+i*.02);
  assert.equal(previous.clipId,`${role}-walk`);assert.ok(previous.left.position[0]>.3);
  const stopped=r.sample({role,movement:0},.8);assert.deepEqual(stopped.left.position,previous.left.position);
  for(let i=1;i<20;i++)previous=r.sample({role,movement:0},.8+i*.02);
  assert.equal(previous.clipId,`${role}-idle`);assert.ok(previous.left.position[0]<0);
  assert.equal(r.sample({role,movement:0,seated:true},1.2),null);r.dispose();
 }
});
test('legacy walk-only documents leave idle to the game and fade a stopped crawler out',()=>{
 const s=storage(),d=createHandAnimationDocument();delete d.clips['student-idle'];delete d.clips['teacher-idle'];saveHandAnimations(d,s);
 const r=createHandAnimationRuntime({storage:s,eventTarget:null});for(let i=0;i<10;i++)assert.equal(r.sample({movement:0},i*.02),null);
 let p;for(let i=0;i<20;i++)p=r.sample({movement:1,crouched:true},1+i*.02);assert.equal(p.clipId,'student-crawl');
 p=r.sample({movement:0,crouched:true},1.4);assert.ok(p.weight>0&&p.weight<1);r.sample({movement:0,crouched:true},1.5);assert.equal(r.sample({movement:0,crouched:true},1.6),null);r.dispose();
});
const sources=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb','teacher-hand-left-v1.glb','teacher-hand-right-v1.glb'].map(loadGeometry));
function make(teacher=false){return createDeskHands({createHand:(side,scale)=>{const h=createRiggedPalm(sources[(teacher?2:0)+(side<0?0:1)],side,scale);if(teacher)h.group.userData.characterRole='teacher';return h;}});}
function skin(h){h.group.updateMatrixWorld(true);const result=[];for(const side of ['left','right'])h.getHand(side).group.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();for(let i=0;i<o.geometry.attributes.position.count;i+=53)result.push(o.getVertexPosition(i,V()).applyMatrix4(o.matrixWorld));});return result;}
function sameSkin(a,b,eps=1e-8){assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)assert.ok(a[i].distanceTo(b[i])<eps,`skin sample ${i} changed by ${a[i].distanceTo(b[i])}`);}
for(const teacher of [false,true])test(`${teacher?'teacher':'student'}: exact editor scrub uses real four-finger skin, editable fingers and immutable bone lengths`,()=>{
 const h=make(teacher),fresh=make(teacher),lengths=[],meshes=[];h.group.traverse(o=>{if(o.isBone)lengths.push([o,o.position.clone(),o.scale.clone()]);if(o.isSkinnedMesh)meshes.push([o,o.geometry,o.skeleton.bones.length]);});const c=createHandAnimationDocument().clips[teacher?'teacher-walk':'student-walk'],p=sampleHandAnimationClip(c,.43);p.left.fingers={Thumb:.8,Index:.1,Middle:.7,Pinky:.3};
 for(let i=0;i<90;i++)h.update(i*DT,{carrying:true,holding:true,action:'snack',freeLook:true});for(const t of [0,.8,.2,1.2,.43])h.update(27-t,{animationPose:sampleHandAnimationClip(c,t),seated:false,freeLook:true});h.update(7,{animationPose:p,seated:false,freeLook:true});fresh.update(700,{animationPose:p,seated:false,freeLook:true});sameSkin(skin(h),skin(fresh));
 for(const s of ['left','right']){const hand=h.getHand(s);assert.equal(hand.group.userData.fingersPerHand,4);assert.ok(hand.group.getWorldPosition(V()).distanceTo(new T.Vector3(...p[s].position))<1e-8);assert.ok(hand.group.getWorldQuaternion(Q()).angleTo(Q().setFromEuler(new T.Euler(...p[s].rotation)))<1e-7);}
 for(const[o,pos,scale]of lengths){assert.ok(o.position.distanceTo(pos)<1e-10);assert.ok(o.scale.distanceTo(scale)<1e-10);}for(const[o,g,n]of meshes){assert.equal(o.geometry,g);assert.equal(o.skeleton.bones.length,n);}const before=skin(h);p.left.fingers.Index=.95;h.update(7,{animationPose:p,seated:false,freeLook:true});assert.ok(skin(h).some((v,i)=>v.distanceTo(before[i])>.003),'individual finger slider does not deform actual skin');assert.equal(h.getDebug().authoredAnimation,true);
});
test('full-weight runtime and editor render identical actual GLB skin in body space',()=>{
 const d=createHandAnimationDocument(),p=sampleHandAnimationClip(d.clips['student-crawl'],.48),a=make(),b=make();for(let i=0;i<120;i++)b.update(i*DT,{seated:false,freeLook:true,movement:1,crawlBlend:.9,walkPhase:i*.1});a.update(5,{seated:false,freeLook:true,animationPose:p});b.update(5,{seated:false,freeLook:true,movement:1,crawlBlend:.9,animationPose:{...p,source:'runtime',weight:1}});sameSkin(skin(a),skin(b));
});
test('no custom data preserves original paths and custom animation cannot override held, seated or caught gestures',()=>{
 const p=sampleHandAnimationClip(createHandAnimationDocument().clips['student-walk'],.5);
 for(const state of [{seated:true,bookAmount:1},{seated:true,computer:true,typing:true},{seated:false,carrying:true,action:'burger'},{seated:false,caught:true}]){const a=make(),b=make();for(let i=0;i<40;i++){const input={freeLook:true,...state};a.update(i*DT,input);b.update(i*DT,{...input,animationPose:p});}sameSkin(skin(a),skin(b));assert.equal(b.getDebug().authoredAnimation,false);}
 const runtime=createHandAnimationRuntime({storage:storage(),eventTarget:null}),a=make(),b=make();for(let i=0;i<100;i++){const s={seated:false,movement:1,freeLook:true,crawlBlend:i/100,walkPhase:i/8};a.update(i*DT,s);b.update(i*DT,{...s,animationPose:runtime.sample(s,i*DT)});}sameSkin(skin(a),skin(b));runtime.dispose();
});
