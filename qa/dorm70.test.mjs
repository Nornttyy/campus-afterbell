import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../dist/vendor/three.module.js';
import {DORM_BUNKS,DORM_BEDS,DORM_SEATS,DORM_SOLIDS,DORM_WALK_SOLIDS,DORM_CABINET,DORM_BOUNDS,DORM_SHELL_SOLIDS,dormBodyOffset,dormCabinetDoorPose,dormCabinetDoorSolids} from '../dist/dorm-layout70.js';
import {createDormRoom} from '../dist/dorm-room70.js';
import {createLayoutContext,walkRoute,blocked,moveInRoom,enclosureVolumes,clearWallSegment,ceilingVolumes} from '../dist/classroom-layout.js';
import {hotpotHelpers} from './hotpot70-helpers.mjs';
const inside=(x,z,r=.2)=>DORM_WALK_SOLIDS.some(s=>x>s.minX-r&&x<s.maxX+r&&z>s.minZ-r&&z<s.maxZ+r);
test('dorm server layout is pure frozen data and upper/lower beds have independent seats, cupboards and support heights',async()=>{
 const code=await readFile(new URL('../dist/dorm-layout70.js',import.meta.url),'utf8');assert.doesNotMatch(code,/^import\s/m);assert.equal(DORM_SEATS,DORM_BEDS);assert.ok(Object.isFrozen(DORM_BEDS)&&Object.isFrozen(DORM_SOLIDS));assert.ok(DORM_BEDS.length>=12&&DORM_BEDS.length<=30);assert.equal(new Set(DORM_BEDS.map(b=>b.id)).size,DORM_BEDS.length);
 for(const bunk of DORM_BUNKS){const beds=DORM_BEDS.filter(b=>b.bunkId===bunk.id);assert.equal(beds.length,2);assert.equal(beds[1].supportHeight-beds[0].supportHeight,1.44);assert.notEqual(beds[0].cabinetId,beds[1].cabinetId);for(const b of beds){assert.equal(b.id,b.seatId);assert.equal(b.id,b.bedId);assert.equal(b.map,'dorm');assert.ok(b.hidePen&&b.hideBook);assert.ok(b.foodY>b.cabinetY&&b.foodY<b.cabinetY+DORM_CABINET.height);assert.ok(!inside(b.exitX,b.exitZ),'unblocked exit '+b.id);}}
});
test('the inspection dorm is a narrow two-wall bunk room with one entrance and reachable beds',()=>{
 const c=createLayoutContext(DORM_SEATS),entrance={x:9.2,z:-8};
 assert.equal(DORM_BUNKS.length,6);assert.equal(new Set(DORM_BUNKS.map(b=>b.x)).size,2);
 assert.ok(DORM_BOUNDS.maxX-DORM_BOUNDS.minX<7);assert.equal(blocked(4.1,0,.23,c),false);
 for(const b of DORM_BEDS){const dest={x:b.exitX,z:b.exitZ};assert.equal(blocked(dest.x,dest.z,.2,c),false,'exit '+b.id);const route=walkRoute(entrance,dest,.2,c);assert.ok(route.length,'path to '+b.id);let p=entrance;for(const next of route){const steps=Math.ceil(Math.hypot(next.x-p.x,next.z-p.z)/.04),dx=(next.x-p.x)/steps,dz=(next.z-p.z)/steps;for(let i=0;i<steps;i++)p=moveInRoom(p,dx,dz,.2,c);assert.ok(Math.hypot(p.x-next.x,p.z-next.z)<1e-5,'walkable path '+b.id);}}
 assert.equal(clearWallSegment({x:8,z:-8},{x:6.6,z:-8},c),true);
 assert.equal(clearWallSegment({x:8,z:7},{x:6.6,z:7},c),false,'old front door is a solid wall');
 for(const p of [{x:0,z:0},{x:4,z:6}])assert.equal(blocked(p.x,p.z,.18,c),true,'unused classroom area is inaccessible');
 assert.equal(ceilingVolumes('dorm')[0].minY,DORM_BOUNDS.height);
 const all=enclosureVolumes('dorm',c);for(const v of DORM_SHELL_SOLIDS)assert.ok(all.some(w=>w.minX===v.minX&&w.maxX===v.maxX&&w.minZ===v.minZ&&w.maxZ===v.maxZ));
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
 for(const bed of DORM_BEDS){const cabinet=room.cabinets.get(bed.id);for(const amount of[0,.1,.3,.5,.75,1]){const pose=dormCabinetDoorPose(bed.id,amount);cabinet.door.rotation.y=pose.angle;parent.updateMatrixWorld(true);const panelBounds=new T.Box3().setFromObject(cabinet.panel),segments=dormCabinetDoorSolids(bed.id,amount);const colliderBounds=new T.Box3(new T.Vector3(Math.min(...segments.map(s=>s.minX)),Math.min(...segments.map(s=>s.minY)),Math.min(...segments.map(s=>s.minZ))),new T.Vector3(Math.max(...segments.map(s=>s.maxX)),Math.max(...segments.map(s=>s.maxY)),Math.max(...segments.map(s=>s.maxZ))));assert.ok(panelBounds.min.distanceTo(colliderBounds.min)<.00001);assert.ok(panelBounds.max.distanceTo(colliderBounds.max)<.00001);for(const v of DORM_SOLIDS.filter(v=>v.id.startsWith('dorm-post-'+bed.bunkId+'-')||v.id.startsWith('dorm-endrail-'+bed.bunkId+'-'))){const obstacle=new T.Box3(new T.Vector3(v.minX,v.minY,v.minZ),new T.Vector3(v.maxX,v.maxY,v.maxZ));assert.equal(panelBounds.intersectsBox(obstacle),false,'cabinet leaf must clear bedpost and rails');}}}
 const c=room.cabinets.get(0);c.open=0;c.door.rotation.y=dormCabinetDoorPose(0,0).angle;room.update({dormCabinets:{0:true}},1/60);assert.ok(c.open>0&&c.open<.3);const first=c.open;for(let i=0;i<90;i++)room.update({dormCabinets:new Map([[0,{open:true}]])},1/60);assert.ok(c.open>.999&&c.open>first);room.update({dormCabinets:{0:false}},1/60);assert.ok(c.open>.7&&c.open<1);room.dispose();helpers.dispose();
});
test('lower and upper cupboard updates stay independent, support current drawer state, and freeze with dt zero',()=>{
 const parent=new T.Group(),helpers=hotpotHelpers(parent),room=createDormRoom(helpers);for(let i=0;i<60;i++)room.update({player:{seated:true,seatId:1},drawer:{open:true}},1/60);assert.ok(room.cabinets.get(1).open>.99);assert.equal(room.cabinets.get(0).open,0);const before=room.cabinets.get(1).open;room.update({dormCabinets:{1:false}},0);assert.equal(room.cabinets.get(1).open,before);for(let i=0;i<60;i++)room.update({students:[{seated:true,seatId:0,drawerOpen:true}]},1/60);assert.ok(room.cabinets.get(0).open>.99);assert.ok(room.cabinets.get(1).open<.01);room.dispose();helpers.dispose();
});
test('every upper bunk has a reachable ladder target ahead of its solid frame',()=>{
 const parent=new T.Group(),helpers=hotpotHelpers(parent),room=createDormRoom(helpers);parent.updateMatrixWorld(true);
 for(const bed of DORM_BEDS.filter(b=>b.level===1)){
  const access=room.beds.get(bed.id).target.getObjectByName('dorm-upper-ladder-target-'+bed.id);assert.ok(access);
  const origin=new T.Vector3(bed.exitX,1.53,bed.exitZ),aim=access.getWorldPosition(new T.Vector3());
  const ray=new T.Raycaster(origin,aim.clone().sub(origin).normalize(),0,2.15),hit=ray.intersectObject(room.beds.get(bed.id).target,true)[0];
  assert.ok(hit,'upper bunk selectable '+bed.id);
  const barrier=ray.intersectObject(room.group,true).find(h=>h.object.material?.visible!==false&&!h.object.material?.transparent);
  assert.ok(!barrier||hit.distance<=barrier.distance+.035,'no picking through bunk frame '+bed.id);
 }
 room.dispose();helpers.dispose();
});
test('disposing a dormant map releases owned resources once without freeing shared helper geometries',()=>{
 const parent=new T.Group(),helpers=hotpotHelpers(parent),room=createDormRoom(helpers);let borrowedDisposed=0,quiltDisposed=0;for(const g of helpers.sharedGeometries)g.addEventListener('dispose',()=>borrowedDisposed++);room.group.getObjectByName('dorm-plaid-blanket-0').geometry.addEventListener('dispose',()=>quiltDisposed++);room.dispose();room.dispose();room.update({},1);assert.equal(parent.children.length,0);assert.equal(borrowedDisposed,0);assert.equal(quiltDisposed,1);helpers.dispose();
});

test('sleeping pupils lie lengthwise with their heads on the pillow in both wall rows',()=>{
 for(const bed of DORM_BEDS){
  const off=dormBodyOffset(bed.lieYaw,true),frame=new T.Object3D();frame.position.set(bed.lieX+off.x,bed.supportHeight+off.y,bed.lieZ+off.z);frame.rotation.set(0,bed.lieYaw,off.roll);frame.updateMatrixWorld(true);
  const head=frame.localToWorld(new T.Vector3(0,1.49,0));assert.ok(Math.hypot(head.x-bed.headX,head.z-bed.headZ)<.001,'head on pillow '+bed.id);
  const feet=frame.localToWorld(new T.Vector3(0,0,0));assert.ok(Math.abs(head.distanceTo(feet)-1.49)<1e-6);
  const facing=new T.Vector3(0,0,1).transformDirection(frame.matrixWorld);assert.ok(facing.x*(bed.col?-1:1)>.99,'face towards the aisle '+bed.id);
 }
});
