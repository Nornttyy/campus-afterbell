import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {campusScene} from './campus-geometry54-helpers.mjs';
import {CLASSROOM,CORRIDOR,OFFICE,LIFT,ALCOVE_ENTRY,ROLE_LOCKER,DOORS,OFFICE_CHAIRS,OFFICE_DESKS,LAB_DIVIDER,createLayoutContext,createSeatLayout,walkRoute} from '../dist/classroom-layout.js';
import {DORM_ROOMS,dormPoint} from '../dist/dorm-layout70.js';
import {chalkHit} from '../dist/teacher-rules.js';

test('the hall landmarks follow the walkthrough and every relocated office target matches its mesh',()=>{
 const f=campusScene();
 try{
  assert.ok(LIFT.z>CORRIDOR.maxZ&&OFFICE.maxZ<CORRIDOR.minZ);
  assert.ok(CLASSROOM.maxX<CORRIDOR.minX);
  // Looking from the car towards the office (-Z), left is -X.
  assert.ok(ALCOVE_ENTRY.wallX<LIFT.x&&CLASSROOM.maxX<LIFT.x&&ROLE_LOCKER.x>LIFT.x);
  assert.ok(LIFT.z>ALCOVE_ENTRY.maxZ&&ALCOVE_ENTRY.minZ>Math.max(...DOORS.map(d=>d.maxZ)));
  assert.ok(f.campus.roleLocker.getObjectsByProperty('name','locker-door').length===3);
  const targets=f.campus.getTargets(),ctx=createLayoutContext(createSeatLayout());
  for(const desk of OFFICE_DESKS){
   const target=targets.officeDesks.find(t=>t.id===desk.id);
   const pos=target.object.getWorldPosition(new T.Vector3());
   assert.ok(Math.hypot(pos.x-desk.x,pos.z-desk.z)<1e-6);
   assert.ok(Math.hypot(target.point.x-desk.drawerX,target.point.z-desk.drawerZ)<.10);
  }
  for(const chair of OFFICE_CHAIRS){
   const target=targets.officeChairs.find(t=>t.id===chair.id);
   assert.ok(Math.hypot(target.point.x-chair.x,target.point.z-chair.z)<1e-6);
   assert.ok(walkRoute(LIFT,chair,.23,ctx).length);
  }
 }finally{f.dispose();}
});

test('from the dorm corridor facing the lift, door 2 is on the left and 3 is on the right; both open onto reachable rooms',()=>{
 const [two,three]=[2,3].map(id=>DORM_ROOMS.find(r=>r.id===id));
 assert.equal(two.z,three.z);assert.ok(two.x>three.x);
 const ctx=createLayoutContext(createSeatLayout(1,null,'dorm'),{map:'dorm'});
 for(const r of [two,three]){
  const inside=dormPoint(r,.90,1.9);
  assert.ok(walkRoute({x:(two.x+three.x)/2,z:r.z},inside,.23,ctx).length);
 }
});

test('lab divider height and rotation stop chalk between desks, leaving an open sightline above the frame',()=>{
 for(const pattern of ['single','quads']){
  const seats=createSeatLayout(73,pattern,'computer'),ctx=createLayoutContext(seats,{map:'computer'});
  for(const seat of [seats[0],seats.at(-1)]){
   const target=ctx.furnitureVolumes.find(v=>v.id==='lab-divider-'+seat.id+'-1');
   assert.equal(target.minY,LAB_DIVIDER.bottom);assert.equal(target.maxY,LAB_DIVIDER.top);
   const x=(target.minX+target.maxX)/2,z=(target.minZ+target.maxZ)/2;
   const ray=y=>chalkHit({x:x-.05,y,z},{x:x+.05,y,z},[],[],'computer',ctx);
   assert.ok(ray(1.30));assert.equal(ray(LAB_DIVIDER.top+.15),null);
  }
 }
 const plain=createLayoutContext(createSeatLayout());assert.equal(plain.furnitureVolumes.some(v=>v.id?.startsWith('lab-divider-')),false);
});

test('toilet high windows and the hotpot piers only appear on their respective floors',()=>{
 const f=campusScene();
 try{
  for(const [id,map] of ['classroom','tiered','toilet','hotpot'].entries()){
   f.campus.setMap(map);
   assert.deepEqual(f.campus.facades.map(g=>g.visible),[0,1,2,3].map(x=>x===id));
  }
  const panes=f.campus.facades[2].getObjectsByProperty('name','clear-exterior-pane');
  assert.ok(panes.length);for(const pane of panes)assert.ok(new T.Box3().setFromObject(pane,true).min.y>2.8);
  f.campus.setMap('dorm');assert.equal(f.campus.corridorSkin.visible,false);
  assert.equal(f.campus.facades.some(g=>g.visible),false);
 }finally{f.dispose();}
});
