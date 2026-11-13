import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../dist/vendor/three.module.js';
import {TOILET_STALLS,TOILET_SEATS,TOILET_SOLIDS,TOILET_DOOR,TOILET_CABINET,toiletDoorPose,toiletDoorSolids,toiletCabinetDoorPose,toiletCabinetDoorSolids,toiletDynamicSolids} from '../dist/toilet-layout70.js';
import {createToiletRoom} from '../dist/toilet-room70.js';
import {hotpotHelpers} from './hotpot70-helpers.mjs';
const intersects=(x,z,solids,r=.2)=>solids.some(s=>x>s.minX-r&&x<s.maxX+r&&z>s.minZ-r&&z<s.maxZ+r&&s.minY<1.5&&s.maxY>.12);

test('toilet layout is immutable server-compatible data, with genuine cubicle seat and cabinet anchors',async()=>{
 const code=await readFile(new URL('../dist/toilet-layout70.js',import.meta.url),'utf8');assert.doesNotMatch(code,/^import\s/m);
 assert.ok(Object.isFrozen(TOILET_SEATS)&&Object.isFrozen(TOILET_SOLIDS));assert.ok(TOILET_SEATS.length>=12&&TOILET_SEATS.length<=30);assert.equal(new Set(TOILET_SEATS.map(s=>s.id)).size,TOILET_SEATS.length);
 for(const s of TOILET_SEATS){assert.ok(s.hideBook&&s.hidePen);assert.equal(s.surface,'toilet');assert.ok(Math.hypot(s.deskX-s.x,s.deskZ-s.z)>.7);assert.equal(s.deskX,s.cabinetX);assert.ok(Number.isFinite(s.yaw));}
});
test('open cubicle doors connect every seat approach to a common aisle, while both right-hand classroom doors stay clear',()=>{
 const solids=[...TOILET_SOLIDS,...TOILET_STALLS.flatMap(s=>toiletDoorSolids(s.id,1))];
 const minX=-6.4,minZ=-9.75,step=.10,nx=134,nz=183,index=(x,z)=>[Math.round((x-minX)/step),Math.round((z-minZ)/step)],clear=(i,j)=>i>=0&&j>=0&&i<nx&&j<nz&&!intersects(minX+i*step,minZ+j*step,solids,.18);
 const start=index(6.4,7),queue=[start],seen=new Set([start.join(',')]);for(let n=0;n<queue.length;n++){const[i,j]=queue[n];for(const[di,dj]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj,key=a+','+b;if(clear(a,b)&&!seen.has(key)){seen.add(key);queue.push([a,b]);}}}
 for(const s of TOILET_SEATS){assert.ok(seen.has(index(s.x,s.z+.9).join(',')),'front of toilet '+s.id+' unreachable');assert.ok(seen.has(index(s.exitX,s.exitZ).join(',')),'exit '+s.id+' unreachable');}
 for(const z of[-8,7])assert.ok(!intersects(6.9,z,solids,.25));for(let x=-6;x<6.8;x+=.2)assert.ok(!intersects(x,6.5,solids,.2));
});
test('door collider follows the actual hinge over opening travel and is not one oversized diagonal box',()=>{
 for(const s of TOILET_STALLS)for(const open of[0,.25,.5,.75,1]){const pose=toiletDoorPose(s.id,open),boxes=toiletDoorSolids(s.id,open);assert.equal(boxes.length,12);for(let i=0;i<=80;i++){const u=TOILET_DOOR.width*i/80,x=pose.x+Math.cos(pose.angle)*u,z=pose.z-Math.sin(pose.angle)*u;assert.ok(boxes.some(b=>x>=b.minX-1e-9&&x<=b.maxX+1e-9&&z>=b.minZ-1e-9&&z<=b.maxZ+1e-9));}const c=toiletCabinetDoorPose(s.id,open);assert.ok(Number.isFinite(c.angle));assert.equal(toiletCabinetDoorSolids(s.id,open).length,12);}
 assert.deepEqual(toiletDoorSolids(999,1),[]);assert.equal(toiletDoorPose(0,NaN).openness,0);assert.equal(toiletDoorPose(0,2).openness,1);
 assert.equal(toiletDynamicSolids(new Map([[0,{open:true}]]),{0:{openness:.5}}).length,TOILET_SEATS.length*24);
});
test('cubicle doors never swing through their toilet bowl, tank or food cupboard',()=>{
 const overlap=(a,b)=>Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)>.001&&Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ)>.001&&Math.min(a.maxY,b.maxY)-Math.max(a.minY,b.minY)>.001;
 const fixtures=TOILET_SOLIDS.filter(s=>/toilet-(bowl|tank|cabinet)-/.test(s.id));
 for(const stall of TOILET_STALLS)for(let i=0;i<=24;i++)for(const door of toiletDoorSolids(stall.id,i/24))for(const fixture of fixtures)assert.ok(!overlap(door,fixture),`door ${stall.id} at ${i/24} clips ${fixture.id}`);
});
test('renderer creates hollow toilet fixtures, separate two-level food cabinets, door picking targets and no desks/books',()=>{
 const helpers=hotpotHelpers(new T.Group()),room=createToiletRoom(helpers);assert.equal(room.seats.size,TOILET_SEATS.length);assert.equal(room.cabinets.size,TOILET_SEATS.length);assert.equal(room.doors.size,TOILET_SEATS.length);
 room.group.updateMatrixWorld(true);for(const s of TOILET_SEATS){const seat=room.seats.get(s.id),cab=room.cabinets.get(s.id);assert.equal(seat.toilet.userData.interaction,'sit');assert.equal(cab.target.userData.interaction,'cabinet');assert.equal(cab.foodAnchors.length,2);assert.ok(cab.foodAnchors[1].position.y>cab.foodAnchors[0].position.y+.5);const p=new T.Vector3();cab.foodAnchor.getWorldPosition(p);assert.ok(Math.abs(p.x-s.cabinetX)<1e-9);let triangles=0;seat.fixture.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));}});assert.ok(triangles<8000,'fixture '+s.id+': '+triangles);assert.ok(seat.fixture.children.some(o=>o.geometry?.type==='LatheGeometry'));assert.ok(seat.fixture.children.some(o=>o.geometry?.type==='ExtrudeGeometry'&&o.geometry.parameters.shapes.holes.length===1));}
 room.group.traverse(o=>assert.doesNotMatch(o.name,/desk-|book-|school-chair/));room.dispose();helpers.dispose();
});
test('each cubicle and cabinet animates independently, occupancy indicators update without changing geometry size',()=>{
 const helpers=hotpotHelpers(new T.Group()),room=createToiletRoom(helpers),d=room.doors.get(0),c=room.cabinets.get(1);
 room.update({toiletDoors:{0:true},toiletCabinets:new Map([[1,true]]),students:[{id:'a',seated:true,seatId:0}]},.016);
 assert.ok(d.open>0&&d.open<.2);assert.equal(room.doors.get(1).open,0);assert.ok(c.open>0);assert.equal(room.cabinets.get(0).open,0);assert.equal(d.occupied,true);assert.equal(d.hinge.rotation.y,TOILET_DOOR.angle*d.open);assert.equal(c.door.rotation.y,TOILET_CABINET.doorAngle*c.open);
 for(let i=0;i<70;i++)room.update({toiletDoors:{0:true},toiletCabinets:{1:true}},.016);assert.ok(d.open>.999);assert.equal(d.occupied,false);
 room.update({toiletDoors:{0:false},toiletCabinets:{1:false}},.016);assert.ok(d.open<.999&&d.open>.5);assert.ok(c.open<.999&&c.open>.5);
 assert.equal(room.dynamicSolids().length,TOILET_SEATS.length*24);room.dispose();helpers.dispose();
});
test('scene disposal releases owned meshes once, leaves shared helper geometry intact and can be called repeatedly',()=>{
 const parent=new T.Group(),helpers=hotpotHelpers(parent);let disposedShared=0;for(const g of helpers.sharedGeometries)g.addEventListener('dispose',()=>disposedShared++);const room=createToiletRoom(helpers),bowl=room.seats.get(0).fixture.children[1];let ownDisposed=0;bowl.geometry.addEventListener('dispose',()=>ownDisposed++);room.dispose();room.dispose();room.update({},1);assert.equal(parent.children.length,0);assert.equal(ownDisposed,1);assert.equal(disposedShared,0);helpers.dispose();
});
