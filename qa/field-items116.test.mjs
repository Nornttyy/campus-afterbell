import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {advanceLoose,spawnLoose,takeLoose,nextSnack} from '../dist/field-items116.js';
import {PLAYGROUND_LAYOUT} from '../dist/playground-layout70.js';
import {createThrowableProjectile} from '../dist/projectile-effects-rules.js';
import {stepSmokeProjectile} from '../dist/smoke-physics.js';

function field(){
 const r=new ClassroomRound({map:'playground'});r.start();
 Object.assign(r.player,{x:PLAYGROUND_LAYOUT.track.cx,z:PLAYGROUND_LAYOUT.track.cz,seated:false});
 return r;
}
test('loose items slide off cans and off unsupported edges, while a flat lid supports a centred packet',()=>{
 const r=field(),p=r.player;
 const drop=(action,dx=0)=>Object.assign(spawnLoose(r,p,action),{x:p.x+dx,z:p.z,y:1.2,vx:0,vy:0,vz:0});
 const settle=()=>{for(let i=0;i<210;i++)advanceLoose(r,1/60);};
 const base=drop('lunch');settle();const gum=drop('gum');settle();
 assert.equal(gum.supportId,base.id);assert.ok(Math.abs(gum.y-base.y-.054)<.001);
 assert.ok(takeLoose(r,base.id));settle();
 assert.equal(gum.supportId,undefined);assert.ok(Math.abs(gum.y-base.y)<.001);
 const can=drop('drink',1);settle();const next=drop('drink',1);settle();
 assert.ok(next.settled&&Math.hypot(next.x-can.x,next.z-can.z)>.08);
 assert.ok(Math.abs(next.y-can.y)<.001);
 const lunch=drop('lunch',-1);settle();const edge=drop('gum',-.89);settle();
 assert.ok(edge.settled&&Math.abs(edge.y-lunch.y)<.001);
});
test('repeated drops at the same spot spread on the ground instead of building a tower',()=>{
 const r=field(),p=r.player,items=[];
 for(let n=0;n<22;n++){
  items.push(Object.assign(spawnLoose(r,p,['drink','burger','snack','gum'][n%4]),{x:p.x,z:p.z,y:1.3,vx:0,vy:0,vz:0}));
  for(let i=0;i<75;i++)advanceLoose(r,1/60);
 }
 for(let i=0;i<300;i++)advanceLoose(r,1/60);
 assert.equal(r.groundItems.size,22);assert.ok(items.every(i=>i.settled));
 const floor=Math.min(...items.map(i=>i.y));
 assert.ok(items.every(i=>i.y-floor<.06));
});
test('two seconds on the vending switch always dispenses a new collectible, even beyond thirty on the floor',()=>{
 const r=field(),v=PLAYGROUND_LAYOUT.vending[0];Object.assign(r.player,{x:v.x+1.16,z:v.z});
 for(let i=0;i<34;i++){assert.ok(r.setFixtureUse(v.id));r._advanceFixtures(2);}
 assert.equal(r.groundItems.size,34);assert.equal(new Set(r.groundItems.keys()).size,34);
 const choices=new Set();for(let i=0;i<1000;i++){r._random=()=>i/1000;choices.add(nextSnack(r));}
 for(const k of ['flash','smoke','banana','chips','drink','noodles','burger'])assert.ok(choices.has(k),k);
});
test('upward aim reaches a higher apex than level aim and a vertical throw falls back under gravity',()=>{
 const r=field(),p=r.player;
 function arc(pitch){p.pitch=pitch;const obj=createThrowableProjectile(p,1,'smoke',1,r.map,r.layout);let top=obj.y;
 const start={x:obj.x,z:obj.z};for(let i=0;i<650&&obj.firstImpact===null;i++){stepSmokeProjectile(obj,.008,r.layout);top=Math.max(top,obj.y);}
 return {top,range:Math.hypot(start.x-obj.x,start.z-obj.z),impacted:obj.firstImpact!==null};}
 const level=arc(0),up=arc(-Math.PI/2);assert.ok(up.top>level.top+3);assert.ok(up.range<.02);assert.ok(up.impacted);
});
