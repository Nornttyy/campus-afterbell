import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {syncDrawerCollisions} from '../dist/drawer-collision58.js';
import {createLayoutContext,blocked,moveInRoom,updateLayoutDoors,enclosureVolumes} from '../dist/classroom-layout.js';
const seat=(id,x=0)=>({id,deskX:x,deskZ:0,x,z:-.78,yaw:0,map:'classroom'});
function fixture(seats=[seat(0)]){const layout=createLayoutContext(seats),actors=seats.map(s=>({id:s.id,seatId:s.id,seated:true,_drawerOpen:false}));return{layout,actors,sync:()=>syncDrawerCollisions(layout,'classroom',actors)};}

test('opening blocks an actual walking route and closing restores it without changing its length or teleporting',()=>{
 const f=fixture(),start={x:1,z:-.78};f.sync();assert.equal(blocked(start.x,start.z,.18,f.layout),false);
 f.actors[0]._drawerOpen=true;f.sync();let p=start;
 for(let i=0;i<60;i++)p=moveInRoom(p,-.03,0,.18,f.layout);
 assert.ok(p.x>=.68&&p.x<.72,'walk must stop at the opened drawer side');assert.equal(p.z,start.z);
 f.actors[0]._drawerOpen=false;f.sync();const stopped=p.x;
 for(let i=0;i<60;i++)p=moveInRoom(p,-.03,0,.18,f.layout);
 assert.ok(Math.abs(p.x-(stopped-1.8))<1e-9);assert.equal(blocked(p.x,p.z,.18,f.layout),false);
});

test('a drawer opened beside a standing player permits gradual outward escape, never deeper entry or a crossing to its other side',()=>{
 const r=new ClassroomRound({seed:73,target:10000});r.start();r._advanceTeacher=()=>{};r._perceive=()=>{};for(const s of r.students)s._decisionAt=Infinity;
 const owner=r.students[6],p=r.player;Object.assign(p,{x:owner.x+.55,z:owner.z+.13,seated:false,seatId:null});
 syncDrawerCollisions(r.layout,r.map,r.students);assert.equal(blocked(p.x,p.z,.18,r.layout),false);
 owner._drawerOpen=true;syncDrawerCollisions(r.layout,r.map,r.students);assert.equal(blocked(p.x,p.z,.18,r.layout),true);
 const before={x:p.x,z:p.z};assert.deepEqual(moveInRoom(before,-.06,0,.18,r.layout),before,'must not move further into the new drawer');
 const first=moveInRoom(before,.03,0,.18,r.layout);assert.ok(Math.abs(first.x-before.x-.03)<1e-9);assert.equal(first.z,before.z);assert.equal(blocked(first.x,first.z,.18,r.layout),true,'first step stays overlapped: this must be an escape, not a teleport');
 r.setMovement(1,0);r.step(.2);assert.ok(p.x>before.x+.3);assert.equal(blocked(p.x,p.z,.18,r.layout),false);
 const end=moveInRoom(p,-1,0,.18,r.layout);assert.ok(end.x>=owner.x+.68,'after leaving, normal collision prevents walking back through');
});

test('two adjacent opened drawers act as one overlap region, allowing escape between the chairs instead of mutually trapping the player',()=>{
 const f=fixture([seat(0),seat(1,1.28)]);for(const a of f.actors)a._drawerOpen=true;f.sync();let p={x:.64,z:-.78};
 assert.equal(blocked(p.x,p.z,.18,f.layout),true);
 for(let i=0;i<6;i++)p=moveInRoom(p,0,-.03,.18,f.layout);
 assert.ok(Math.abs(p.x-.64)<1e-9);assert.ok(p.z<-.913);assert.equal(blocked(p.x,p.z,.18,f.layout),false);
});

test('dynamic escape still respects static walls, including when the actor already starts inside one',()=>{
 const f=fixture();f.actors[0]._drawerOpen=true;f.sync();const initial={x:.55,z:-.78},wall={minX:.57,maxX:.59,minZ:-1.2,maxZ:-.3,minY:0,maxY:3};f.layout.walkSolids.push(wall);
 assert.deepEqual(moveInRoom(initial,.03,0,.18,f.layout),initial);assert.deepEqual(moveInRoom(initial,0,-.03,.18,f.layout),initial,'dynamic overlap must not disable an initial static-wall collision');
 // A wall outside the player blocks the shortest exit; the longer clear front
 // exit remains available without walking into that wall.
 f.layout.walkSolids.pop();f.layout.walkSolids.push({...wall,minX:.80,maxX:.85});let p=initial;
 assert.deepEqual(moveInRoom(p,.03,0,.18,f.layout),p);
 for(let i=0;i<6;i++)p=moveInRoom(p,0,-.03,.18,f.layout);
 assert.ok(p.z<-.913);assert.equal(blocked(p.x,p.z,.18,f.layout),false);
});

test('door changes retain opened drawer collision and closing invalidates navigation and projectile caches',()=>{
 const f=fixture();f.actors[0]._drawerOpen=true;f.sync();const drawer=f.layout.dynamicSolids[0];
 updateLayoutDoors(f.layout,{rearDoorClosed:true});assert.ok(f.layout.walkSolids.includes(drawer));assert.ok(enclosureVolumes('classroom',f.layout).includes(drawer));
 f.layout.routeGrids.set('probe',{});f.layout.projectileColliderCache=new Map([['probe',{}]]);f.actors[0]._drawerOpen=false;assert.equal(f.sync(),true);
 assert.equal(f.layout.dynamicSolids.length,0);assert.equal(f.layout.walkSolids.includes(drawer),false);assert.equal(f.layout.routeGrids.size,0);assert.equal(f.layout.projectileColliderCache.size,0);
});
