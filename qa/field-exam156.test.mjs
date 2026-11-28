import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoloRound} from '../dist/solo-round.js';
import {COOLER} from '../dist/field-items116.js';
import {PLAYGROUND_LAYOUT} from '../dist/playground-layout70.js';
import {radioBeats} from '../dist/radio-beats156.js';

test('the cart lid gates pickup between two machines',()=>{
 const r=createSoloRound({map:'playground'});r.start();
 const [a,b]=PLAYGROUND_LAYOUT.vending;assert.equal(COOLER.z,(a.z+b.z)/2);
 Object.assign(r.player,{seated:false,x:COOLER.x+1,z:COOLER.z});
 assert.equal(r.takeCoolerItem(1),false);assert.equal(r.setCoolerOpen(true),true);
 assert.equal(r.snapshot().coolerOpen,true);assert.equal(r.setCoolerOpen(false),true);assert.equal(r.takeCoolerItem(1),false);
 assert.equal(r.setCoolerOpen(true),true);assert.equal(r.takeCoolerItem(1),true);
});
test('field pupils start independently when the bell rings',()=>{
 const r=createSoloRound({map:'playground',seed:813});r.start({gathering:true});r.step(1);assert.equal(r.startBell(),true);
 const npcs=r.students.filter(a=>!a.isPlayer);const starts=npcs.map(a=>[a.x,a.z]);assert.equal(r._seatingRoutes.size,0);
 r.step(.25);assert.ok(npcs.every((a,i)=>a.visible&&Math.hypot(a.x-starts[i][0],a.z-starts[i][1])>.1));
 const origin=r.snapshot().fieldMarchAt;r.step(30);assert.equal(r.snapshot().fieldMarchAt,origin);
});
test('copying reads one solved question, requires uninterrupted aim and is limited per copier',()=>{
 const r=createSoloRound({map:'exam'});r.start();const p=r.player;
 const other=r.students.find(a=>a!==p&&Math.hypot(a.x-p.x,a.z-p.z)<4.5);
 const yaw=Math.atan2(other.x-p.x,other.z-p.z);r.setLook(yaw,0);other._examAnswers=7;
 assert.equal(r.setExamCopy(other.id),true);r.step(.9);r.setLook(yaw+1.4,0);r.step(.1);
 assert.equal(r.snapshot().exam.answered,0);assert.equal(r.snapshot().exam.using,false);
 r.setLook(yaw,0);for(const mask of [1,3]){assert.equal(r.setExamCopy(other.id),true);r.step(2);assert.equal(r.snapshot().exam.answered,mask);}
 assert.equal(r.setExamCopy(other.id),false);assert.equal(r.snapshot().exam.copies,2);
});
test('four inspirations coexist, expire independently and consuming one preserves the rest',()=>{
 const r=createSoloRound({map:'exam',seed:35});r.start();const p=r.player;
 for(let i=0;i<4;i++){r.setDrawerOpen(true);assert.ok(r.setExamMode('card',0));assert.ok(r.setExamUse(-1));r.step(2);r.setExamMode('close');}
 const hints=r.snapshot().exam.hints;assert.equal(hints.length,4);assert.equal(new Set(hints.map(h=>h.question)).size,4);
 r.setExamMode('paper');assert.ok(r.setExamUse(hints[0].question));r.step(2);assert.equal(r.snapshot().exam.hints.length,3);
});
test('song grids have increasing beat times and cover both full tracks',()=>{
 for(const {duration,beats} of Object.values(radioBeats)){assert.ok(beats.length>300);assert.ok(beats.every((b,i)=>i===0||b>beats[i-1]));assert.ok(duration-beats.at(-1)/1000<.6);}
});
