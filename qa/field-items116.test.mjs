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
test('a pile stands on each actual package and falls back to the field after its base is picked up',()=>{
 const r=field(),p=r.player;
 const drop=(action,y)=>Object.assign(spawnLoose(r,p,action),{x:p.x,z:p.z,y,vx:0,vy:0,vz:0});
 const run=()=>{for(let i=0;i<160;i++)advanceLoose(r,1/60);};
 const base=drop('burger',.65);run();const packet=drop('gum',.75);run();const top=drop('phone',.85);run();
 assert.ok(base.settled&&packet.settled&&top.settled);
 assert.ok(Math.abs(packet.y-base.y-.141)<.001);assert.ok(Math.abs(top.y-packet.y-.017)<.001);
 assert.ok(takeLoose(r,base.id));run();
 assert.ok(Math.abs(packet.y-base.y)<.001);assert.ok(Math.abs(top.y-packet.y-.017)<.001);
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
