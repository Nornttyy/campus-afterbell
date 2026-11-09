import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {FOLEY_KINDS,createFoleySamples,playCampusFoley} from '../dist/foley-audio54.js';

class Parameter{constructor(){this.value=0;this.targets=[];}setTargetAtTime(v,t,d){this.value=v;this.targets.push([v,t,d]);}}
class Node{constructor(){this.gain=new Parameter();this.frequency=new Parameter();this.connections=[];}connect(n){this.connections.push(n);return n;}disconnect(){this.disconnected=true;}}
class AudioContextFake{
 constructor(){this.state='suspended';this.sampleRate=24000;this.currentTime=0;this.destination=new Node();this.sources=[];this.gains=[];this.resumeCount=0;}
 createGain(){const n=new Node();this.gains.push(n);return n;}createBiquadFilter(){return new Node();}
 createDynamicsCompressor(){const n=new Node();for(const k of ['threshold','knee','ratio','attack','release'])n[k]=new Parameter();return n;}
 createBuffer(channels,length,rate){const data=new Float32Array(length);return{getChannelData:()=>data,length,sampleRate:rate};}
 createBufferSource(){const n=new Node();n.start=t=>n.started=t;n.stop=()=>n.stopped=true;this.sources.push(n);return n;}
 async resume(){this.state='running';this.resumeCount++;}async suspend(){this.state='suspended';}async close(){this.state='closed';}
}

test('every Foley event generates bounded finite audio with a silent release, and unknown events stay silent',()=>{
 assert.equal(createFoleySamples('background-music'),null);
 for(const kind of FOLEY_KINDS)for(const variant of[0,3]){const data=createFoleySamples(kind,{variant});let peak=0,sum=0,energy=0;for(const sample of data){assert.equal(Number.isFinite(sample),true,kind);peak=Math.max(peak,Math.abs(sample));sum+=sample;energy+=sample*sample;}assert.ok(peak>.015&&peak<=.90001,`${kind} peak ${peak}`);assert.ok(Math.sqrt(energy/data.length)>.002,`${kind} is inaudible`);assert.ok(Math.abs(sum/data.length)<.03,`${kind} has DC offset`);assert.ok(Math.abs(data.at(-1))<.002,`${kind} ends with a click`);}
});

test('repeated foot, paper and food contacts have multiple distinct deterministic takes',()=>{
 for(const kind of ['step','pen-write','snack','burger','drink','drawer-open']){const a=createFoleySamples(kind,{variant:0}),b=createFoleySamples(kind,{variant:1});assert.deepEqual(a,createFoleySamples(kind,{variant:0}));assert.notDeepEqual(a,b);let difference=0;for(let i=0;i<a.length;i++)difference+=Math.abs(a[i]-b[i]);assert.ok(difference/a.length>.005,kind);}
});

test('Foley overlaps sounds without stopping earlier voices and reuses bounded per-context samples',()=>{
 const context=new AudioContextFake(),audio={context,fx:context.createGain()};context.state='running';
 assert.equal(playCampusFoley(audio,'drawer-open'),true);context.currentTime=.1;playCampusFoley(audio,'step',.4);context.currentTime=.2;playCampusFoley(audio,'book-open');assert.equal(context.sources.length,3);assert.ok(context.sources.every(n=>!n.stopped));assert.equal(context.gains.at(-2).gain.value,.4);
 const first=context.sources[0],buffer=first.buffer;first.onended();assert.equal(first.disconnected,true);
 for(let i=0;i<6;i++){context.currentTime+=.2;playCampusFoley(audio,'drawer-open');context.sources.at(-1).onended();}assert.equal(context.sources.at(-1).buffer,buffer);
 const count=context.sources.length;playCampusFoley(audio,'drawer-open');assert.equal(context.sources.length,count,'duplicate same-frame event is coalesced');playCampusFoley(audio,'step',0);assert.equal(context.sources.length,count);
 assert.equal(playCampusFoley(audio,'unknown'),false);
});

test('opening or resuming audio never schedules music, while sound volume and mute still work',async()=>{
 const source=await readFile(new URL('../dist/app.js',import.meta.url),'utf8'),body=source.slice(source.indexOf('class MenuAudio {'),source.indexOf('\nconst audio = new MenuAudio();'));
 const settings={sfx:55,muted:false},sandbox={window:{AudioContext:AudioContextFake},settings,playCampusFoley,setInterval(){throw Error('no periodic audio scheduler allowed');}};
 vm.runInNewContext(body+';globalThis.audio=new MenuAudio();',sandbox);const audio=sandbox.audio;await audio.start();assert.equal(audio.context.sources.length,0);assert.equal(audio.started,true);assert.equal(audio.music,undefined);assert.equal(audio.timer,undefined);
 audio.click('tap');assert.equal(audio.context.sources.length,1);assert.ok(Math.abs(audio.fx.gain.value-.55*.55)<1e-9);settings.muted=true;audio.apply();audio.effect('step');assert.equal(audio.context.sources.length,1);assert.equal(audio.fx.gain.value,0);
 settings.muted=false;settings.sfx=20;audio.apply();assert.ok(Math.abs(audio.fx.gain.value-.11)<1e-9);await audio.pause();await audio.start();assert.equal(audio.context.sources.length,1);audio.dispose();assert.equal(audio.context.state,'closed');
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/music-volume|music-output/);assert.doesNotMatch(source,/settings\.music|saved\.music|melody|this\.schedule\(/);assert.match(html,/sfx-volume/);
});
