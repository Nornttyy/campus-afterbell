import test from 'node:test';
import assert from 'node:assert/strict';
import {floatingBubblePosition,bubbleTouchesHead} from '../dist/bubble-flight69.js';
import {ClassroomRound} from '../dist/classroom-rules.js';
const bubble=()=>({id:3,kind:'orange',studentId:999,attachedId:null,charge:.5,sourceCharge:.5,radius:.1,origin:{x:0,y:1.4,z:0},x:0,y:1.4,z:0,vx:0,vz:2.4,age:0,lifetime:6});
test('orange bubbles wander both horizontally and vertically while progressing forward, with no release jump',()=>{const b=bubble();assert.deepEqual(floatingBubblePosition(b,0),b.origin);let xs=[],ys=[];for(let t=0;t<3;t+=1/60){const p=floatingBubblePosition(b,t);xs.push(p.x);ys.push(p.y);assert.ok(Math.abs(p.z-t*2.4)<1e-9);assert.ok(Math.hypot(p.x,p.y-1.4)<.48);}assert.ok(Math.max(...xs)-Math.min(...xs)>.45);assert.ok(Math.max(...ys)-Math.min(...ys)>.20);assert.ok(xs.some(x=>x<-.1)&&xs.some(x=>x>.1));});
test('server curve is independent of snapshot rate and partitioning',()=>{function run(hz){const r=new ClassroomRound();r.students=[];r.teacher.visible=false;r._bubbleVolumes=()=>[];r.bubbles=[bubble()];for(let i=0;i<hz*2;i++)r._advanceBubbles(1/hz);return r.bubbles[0];}const a=run(15),b=run(60);for(const k of ['x','y','z'])assert.ok(Math.abs(a[k]-b[k])<1e-9);});
test('curve collision checks swept segments and cannot tunnel through a thin wall',()=>{const r=new ClassroomRound();r.students=[];r.teacher.visible=false;r._bubbleVolumes=()=>[{minX:-1,maxX:1,minY:0,maxY:3,minZ:1,maxZ:1.01}];r.bubbles=[bubble()];r._advanceBubbles(1);assert.equal(r.bubbles.length,0);assert.equal(bubbleTouchesHead({x:-1,y:1,z:0},{x:1,y:1,z:0},{x:0,y:1,z:0},.2),true);});
test('a released wavy bubble still attaches with its original charge',()=>{const r=new ClassroomRound();r._bubbleVolumes=()=>[];r._clearWallSegment=()=>true;r.teacher.visible=false;const b=bubble(),p=floatingBubblePosition(b,.5),actor=r.students[0];Object.assign(actor,{x:p.x,z:p.z,visible:true});r._bubbleHeadHeight=()=>p.y;r.students=[actor];r.bubbles=[b];r._advanceBubbles(.5);assert.equal(r.bubbles.length,1);assert.equal(r.bubbles[0].attachedId,actor.id);assert.equal(r.bubbles[0].sourceCharge,.5);});

test('wandering curve rotates with the release direction and never depends on camera orientation',()=>{
 const north=bubble(),east={...bubble(),vx:2.4,vz:0};for(let i=0;i<120;i++){const t=i/60,a=floatingBubblePosition(north,t),b=floatingBubblePosition(east,t);assert.ok(Math.abs(a.z-b.x)<1e-9);assert.ok(Math.abs(a.x+b.z)<1e-9);assert.equal(a.y,b.y);}
});
test('head collision checks the entire segment but rejects distant and behind-segment heads',()=>{
 const from={x:0,y:1,z:0},to={x:0,y:1,z:3};assert.equal(bubbleTouchesHead(from,to,{x:0,y:1,z:1.5},.2),true);assert.equal(bubbleTouchesHead(from,to,{x:.21,y:1,z:1.5},.2),false);assert.equal(bubbleTouchesHead(from,to,{x:0,y:1,z:-.3},.2),false);assert.equal(bubbleTouchesHead(from,to,{x:0,y:1,z:3.3},.2),false);assert.equal(bubbleTouchesHead(from,from,from,.2),true);
});
