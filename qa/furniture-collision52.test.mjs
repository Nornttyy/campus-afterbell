import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {ClassroomRound,chalkHit} from '../dist/classroom-rules.js';
import {LAYOUT_PATTERNS,createSeatLayout,createLayoutContext,moveInRoom,blocked,chairExit,OFFICE_CHAIR} from '../dist/classroom-layout.js';
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const chair=(await loadGeometry('chair-v2.glb')).scene.getObjectByName('ChairBody');
const desk=(await loadGeometry('desk-v2.glb')).scene.getObjectByName('DeskBody');
function crossesMesh(object,a,b){object.updateWorldMatrix(true,true);const delta=b.clone().sub(a);return new T.Raycaster(a,delta.clone().normalize(),0,delta.length()).intersectObject(object,true).length>0;}

test('movement stops in front of actual Tripo chair backs in both chair orientations',()=>{
 for(const yaw of [0,Math.PI]){
  const s={id:0,x:0,z:0,deskX:0,deskZ:Math.cos(yaw)*.78,yaw},layout=createLayoutContext([s]);
  const mesh=chair.clone(true);mesh.rotation.y=yaw;
  const start={x:0,z:-Math.cos(yaw)*.90},attempt={x:0,z:Math.cos(yaw)*.12};
  assert.equal(crossesMesh(mesh,v(start.x,.85,start.z),v(attempt.x,.85,attempt.z)),true,'the old move crossed real backrest triangles');
  const end=moveInRoom(start,attempt.x-start.x,attempt.z-start.z,.18,layout);
  assert.equal(crossesMesh(mesh,v(start.x,.85,start.z),v(end.x,.85,end.z)),false);
  assert.ok(Math.hypot(end.x-attempt.x,end.z-attempt.z)>.4);
  assert.equal(blocked(s.x,s.z,.20,layout),false,'AI can still approach its sitting anchor from the side');
 }
});

test('desk collision encloses the visible imported top including its front lip',()=>{
 desk.updateWorldMatrix(true,true);const b=new T.Box3().setFromObject(desk,true),s={id:0,x:0,z:-.78,deskX:0,deskZ:0,yaw:0},d=createLayoutContext([s]).desks[0];
 assert.ok(d.minX<=b.min.x&&d.maxX>=b.max.x&&d.minZ<=b.min.z&&d.maxZ>=b.max.z&&d.maxY>=b.max.y);
 const hit=chalkHit({x:0,y:.87,z:-.6},{x:0,y:.87,z:-.40},[],[],'classroom',createLayoutContext([s]));assert.equal(hit?.kind,'desk');
});

test('standing exits each chair beside its mesh, including reversed islands and office chair',()=>{
 for(const pattern of LAYOUT_PATTERNS){const seats=createSeatLayout(73,pattern),layout=createLayoutContext(seats);
  for(const s of seats){const end=chairExit(s,.18,layout);assert.ok(end,pattern+' seat '+s.id);assert.equal(blocked(end.x,end.z,.18,layout),false);const mesh=chair.clone(true);mesh.position.set(s.x,0,s.z);mesh.rotation.y=s.yaw;assert.equal(crossesMesh(mesh,v(end.x,.8,end.z),v(end.x,.05,end.z)),false,'feet must not be inside the chair seat');}
 }
 const r=new ClassroomRound({seed:73});r.start();const s=r.seats[r.player.seatId];assert.equal(r.interact(),'stood');assert.ok(Math.hypot(r.player.x-s.x,r.player.z-s.z)>.5);assert.equal(r.player.seated,false);
 Object.assign(r.player,{...OFFICE_CHAIR,seated:true,_officeChair:true,seatId:-1});assert.equal(r.interact(),'stood');assert.ok(Math.abs(r.player.x-OFFICE_CHAIR.x)>.5);
});

test('computer monitors stop chalk at their visible depth, for front and reversed seats',()=>{
 for(const yaw of [0,Math.PI]){const sign=Math.cos(yaw),s={id:0,x:0,z:-sign*.78,deskX:0,deskZ:0,yaw},ctx=createLayoutContext([s]);const hit=chalkHit({x:0,y:1.22,z:sign*.30},{x:0,y:1.22,z:sign*.10},[],[],'computer',ctx);assert.equal(hit?.kind,'desk');assert.equal(hit?.id,0);assert.ok(hit.t>0&&hit.t<1);}
});
