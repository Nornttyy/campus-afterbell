import test from 'node:test';
import assert from 'node:assert/strict';
import {createRadioUI} from '../dist/radio-player93.js';
import {interactionIntent} from '../dist/interaction-intent54.js';
import {radioAnchor,broadcastLift,broadcastBeat,broadcastScale,RADIO_SONGS,EXERCISE_SONG} from '../dist/campus-radio93.js';
import {readFile} from 'node:fs/promises';

const state=(radio=null,time=19)=>({radio,status:'playing',stage:'class',map:'playground',sceneElapsed:time,elapsed:time-3});
const station={track:RADIO_SONGS[0].id,activation:1,startedAt:10};
function fixture(){
 const doc=new EventTarget();let muted=false;const audio=new EventTarget();
 Object.assign(audio,{paused:true,duration:60,currentTime:0,play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;},removeAttribute(k){delete this[k];},load(){}});
 doc.createElement=tag=>{assert.equal(tag,'audio');return audio;};
 return {audio,ui:createRadioUI(doc,()=>muted),mute(v){muted=v;doc.dispatchEvent(new Event('campus-audio-settings'));}};
}
test('public tracks are bundled AAC recordings with a marching default',async()=>{
 for(const song of [EXERCISE_SONG,...RADIO_SONGS]){
  const data=await readFile(new URL('../dist/assets/audio/'+song.id+'.m4a',import.meta.url));
  assert.ok(data.length>300000);assert.ok(data.subarray(0,40).includes(Buffer.from('ftyp')));
 }
 const a=radioAnchor('playground'),target={kind:'radio'},s={...state(),player:{x:a.x,z:a.z+.9},role:'student'};
 assert.deepEqual(interactionIntent(s,target,'E'),{method:'setFixtureUse',args:['radio'],label:'换歌',hold:true});
 assert.equal(interactionIntent({...s,radio:station},target,'E'),null);
 assert.equal(interactionIntent({...s,role:'teacher',radio:station},target,'Q').method,'changeRadio');
});
test('late joins, local mute, return to the march and the shared beat follow the room clock',()=>{
 const a=fixture(),b=fixture();
 for(const f of [a,b]){
  f.ui.update(state());assert.ok(f.audio.src.endsWith('field-march.m4a'));assert.equal(f.audio.currentTime,16);
  f.ui.update(state(station,19));assert.ok(new URL(f.audio.src).pathname.endsWith(station.track+'.m4a'));assert.equal(f.audio.currentTime,9);
  f.mute(true);assert.equal(f.audio.paused,true);f.ui.update(state(station,42));f.mute(false);assert.equal(f.audio.currentTime,32);
  f.ui.update(state(null));assert.ok(f.audio.src.endsWith('field-march.m4a'));
  f.ui.update({...state(),map:'bus'});assert.equal(f.audio.src,undefined);f.ui.dispose();
 }
 assert.equal(broadcastLift(state()),0);assert.equal(broadcastLift(state(station,10)),0);for(const [fraction,sign] of [[.25,1],[.75,-1]]){
  const s=state(station,10+fraction*60/RADIO_SONGS[0].bpm);
  const {height,width}=broadcastScale(broadcastBeat(s));
  assert.ok(Math.abs(broadcastLift(s)-sign*.015)<1e-8);
  assert.ok(Math.sign(1-height)===sign&&Math.sign(width-1)===sign);
  assert.ok(Math.abs(height*width*width-1)<1e-8);
 }
});

test('both maps directly play the same two complete recordings on a fresh client',async()=>{
 const settings=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(settings,/radio-import|radio-library118/);
 for(const map of ['playground','bus']){
  const f=fixture();
  for(const song of RADIO_SONGS){
   f.ui.update({...state({...station,track:song.id}),map});
   const src=new URL(f.audio.src);
   assert.ok(src.pathname.endsWith('/assets/audio/'+song.id+'.m4a'));
   assert.equal(f.audio.paused,false);
   const file=await readFile(src);
   assert.ok(file.length>4_000_000);
  }
  f.ui.dispose();
 }
});
