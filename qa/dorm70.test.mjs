import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../dist/vendor/three.module.js';
import {DORM_BUNKS,DORM_BEDS,DORM_SEATS,DORM_SOLIDS,DORM_WALK_SOLIDS,DORM_CABINET,dormCabinetDoorPose,dormCabinetDoorSolids} from '../dist/dorm-layout70.js';
import {createDormRoom} from '../dist/dorm-room70.js';
import {hotpotHelpers} from './hotpot70-helpers.mjs';
const inside=(x,z,r=.2)=>DORM_WALK_SOLIDS.some(s=>x>s.minX-r&&x<s.maxX+r&&z>s.minZ-r&&z<s.maxZ+r);
test('dorm server layout is pure frozen data and upper/lower beds have independent seats, cupboards and support heights',async()=>{
 const code=await readFile(new URL('../dist/dorm-layout70.js',import.meta.url),'utf8');assert.doesNotMatch(code,/^import\s/m);assert.equal(DORM_SEATS,DORM_BEDS);assert.ok(Object.isFrozen(DORM_BEDS)&&Object.isFrozen(DORM_SOLIDS));assert.ok(DORM_BEDS.length>=12&&DORM_BEDS.length<=30);assert.equal(new Set(DORM_BEDS.map(b=>b.id)).size,DORM_BEDS.length);
 for(const bunk of DORM_BUNKS){const beds=DORM_BEDS.filter(b=>b.bunkId===bunk.id);assert.equal(beds.length,2);assert.equal(beds[1].supportHeight-beds[0].supportHeight,1.44);assert.notEqual(beds[0].cabinetId,beds[1].cabinetId);for(const b of beds){assert.equal(b.id,b.seatId);assert.equal(b.id,b.bedId);assert.equal(b.map,'dorm');assert.ok(b.hidePen&&b.hideBook);assert.ok(b.foodY>b.cabinetY&&b.foodY<b.cabinetY+DORM_CABINET.height);assert.ok(!inside(b.exitX,b.exitZ),'unblocked exit '+b.id);}}
});
test('every bedside exit reaches both door passages, with front-wall teaching/detention space kept clear',()=>{
 const minX=-6.4,minZ=-9.7,step=.1,nx=133,nz=181,idx=(x,z)=>[Math.round((x-minX)/step),Math.round((z-minZ)/step)],free=(i,j)=>i>=0&&i<nx&&j>=0&&j<nz&&!inside(minX+i*step,minZ+j*step);
 const initial=idx(6.6,7),queue=[initial],seen=new Set([initial.join(',')]);for(let n=0;n<queue.length;n++){const[i,j]=queue[n];for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=i+dx,b=j+dz,key=a+','+b;if(free(a,b)&&!seen.has(key)){seen.add(key);queue.push([a,b]);}}}
 for(const b of DORM_BEDS)assert.ok(seen.has(idx(b.exitX,b.exitZ).join(',')),'bed '+b.id+' exit must connect to corridor');assert.ok(seen.has(idx(6.6,-8).join(',')));
 for(let x=-6;x<=6.5;x+=.2)assert.ok(!inside(x,6.5));for(let z=-9.6;z<8.4;z+=.2)assert.ok(!inside(6.8,z));
});
test('bunk and cupboard geometry uses actual rails, ladder, volume bedding and stays below 8000 triangles per frame',()=>{
 const parent=new T.Group(),helpers=hotpotHelpers(parent),room=createDormRoom(helpers);parent.updateMatrixWorld(true);
 assert.equal(room.beds.size,DORM_BEDS.length);assert.equal(room.cabinets.size,DORM_BEDS.length);
 for(const b of DORM_BUNKS){const frame=room.group.getObjectByName('dorm-bunk-'+b.id);let tris=0;frame.traverse(o=>{if(o.isMesh){tris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert.ok(o.geometry.attributes.normal);assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));}});assert.ok(tris<8000,'bunk '+b.id+' has '+tris+' triangles');}
 for(const b of DORM_BEDS){const anchor=room.beds.get(b.id).seatTarget;assert.equal(anchor.position.y,b.supportHeight);const blanket=room.group.getObjectByName('dorm-plaid-blanket-'+b.id);assert.ok(blanket.geometry.attributes.position.count>200);const cupboard=room.cabinets.get(b.id);assert.equal(cupboard.foodAnchor.position.y,b.foodY);assert.ok(cupboard.door.children.every(o=>o.userData.animated));assert.equal(cupboard.target.userData.cabinetId,b.id);}
 room.dispose();helpers.dispose();
});
test('cabinet doors open outward smoothly with synchronized collider geometry and no bunk overlap over the full travel',()=>{
 const parent=new T.Group(),helpers=hotpotHelpers(parent),room=createDormRoom(helpers);
 for(const bed of DORM_BEDS){const cabinet=room.cabinets.get(bed.id);for(const amount of[0,.1,.3,.5,.75,1]){const pose=dormCabinetDoorPose(bed.id,amount);cabinet.door.rotation.y=pose.angle;parent.updateMatrixWorld(true);const panelBounds=new T.Box3().setFromObject(cabinet.panel),segments=dormCabinetDoorSolids(bed.id,amount);const colliderBounds=new T.Box3(new T.Vector3(Math.min(...segments.map(s=>s.minX)),Math.min(...segments.map(s=>s.minY)),Math.min(...segments.map(s=>s.minZ))),new T.Vector3(Math.max(...segments.map(s=>s.maxX)),Math.max(...segments.map(s=>s.maxY)),Math.max(...segments.map(s=>s.maxZ))));assert.ok(panelBounds.min.distanceTo(colliderBounds.min)<.00001);assert.ok(panelBounds.max.distanceTo(colliderBounds.max)<.00001);const bunk=DORM_BUNKS[bed.bunkId];assert.ok(panelBounds.max.x<bunk.x-1.28,'cabinet leaf must clear bedpost');}}
 const c=room.cabinets.get(0);c.open=0;c.door.rotation.y=0;room.update({dormCabinets:{0:true}},1/60);assert.ok(c.open>0&&c.open<.3);const first=c.open;for(let i=0;i<90;i++)room.update({dormCabinets:new Map([[0,{open:true}]])},1/60);assert.ok(c.open>.999&&c.open>first);room.update({dormCabinets:{0:false}},1/60);assert.ok(c.open>.7&&c.open<1);room.dispose();helpers.dispose();
});
test('lower and upper cupboard updates stay independent, support current drawer state, and freeze with dt zero',()=>{
 const parent=new T.Group(),helpers=hotpotHelpers(parent),room=createDormRoom(helpers);for(let i=0;i<60;i++)room.update({player:{seated:true,seatId:1},drawer:{open:true}},1/60);assert.ok(room.cabinets.get(1).open>.99);assert.equal(room.cabinets.get(0).open,0);const before=room.cabinets.get(1).open;room.update({dormCabinets:{1:false}},0);assert.equal(room.cabinets.get(1).open,before);for(let i=0;i<60;i++)room.update({students:[{seated:true,seatId:0,drawerOpen:true}]},1/60);assert.ok(room.cabinets.get(0).open>.99);assert.ok(room.cabinets.get(1).open<.01);room.dispose();helpers.dispose();
});
test('disposing a dormant map releases owned resources once without freeing shared helper geometries',()=>{
 const parent=new T.Group(),helpers=hotpotHelpers(parent),room=createDormRoom(helpers);let borrowedDisposed=0,quiltDisposed=0;for(const g of helpers.sharedGeometries)g.addEventListener('dispose',()=>borrowedDisposed++);room.group.getObjectByName('dorm-plaid-blanket-0').geometry.addEventListener('dispose',()=>quiltDisposed++);room.dispose();room.dispose();room.update({},1);assert.equal(parent.children.length,0);assert.equal(borrowedDisposed,0);assert.equal(quiltDisposed,1);helpers.dispose();
});
