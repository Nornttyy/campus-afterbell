import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRoomVariants} from '../dist/room-variants.js?v=campus-64';
import {createSeatLayout,createLayoutContext,blocked} from '../dist/classroom-layout.js?v=campus-64';
import {ClassroomRound,chalkHit} from '../dist/classroom-rules.js?v=campus-64';
import {COMPUTER_DRAWER_FOODS} from '../dist/item-rules50.js?v=campus-64';
import {interactionIntent} from '../dist/interaction-intent54.js?v=campus-64';
import {CLASSROOM_PROP_SOURCES,loadPropAssets,restDeskItem} from '../dist/prop-assets.js?v=campus-64';
import {createDeskItem} from '../dist/game-actors.js?v=campus-64';
import {createDrawerPickTarget,pickDrawerItem} from '../dist/drawer-picking.js?v=campus-64';
import {CampusRoom} from '../server/room-simulation.js';
import {loadGeometry} from './gltf-geometry.mjs';
const DT=1/60,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:{loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())}});

function fixture(yaw=0,kind='burger'){
 const scene=new T.Scene(),mat=(color,opts={})=>new T.MeshStandardMaterial({color,...opts});
 const make=(m,p,s,r,g)=>{const mesh=new T.Mesh(new T.BoxGeometry(...s),m);mesh.position.set(...p);if(r)mesh.rotation.set(...r);g.add(mesh);return mesh;};
 const variants=createRoomVariants({scene,box:make,rounded:(m,p,s,rad,r,g)=>make(m,p,s,r,g),mat,bakeStatic:()=>{},texture:()=>new T.Texture()});
 variants.setMap('computer');const seat={id:0,deskX:2,deskZ:-3,yaw};variants.setSeats([seat]);
 const drawer=variants.drawers.get(0),station=variants.stations.get(0),slot=new T.Group();slot.position.set(0,.68,drawer.itemZ);drawer.group.add(slot);
 const object=createDeskItem(kind);object.rotation.set(kind==='burger'?0:-Math.PI/2,0,-.07+(object.userData.propAsset&&kind!=='burger'?Math.PI:0));restDeskItem(object,drawer.floor-slot.position.y);slot.add(object);
 const target=createDrawerPickTarget(object,0),state={player:{id:0,seatId:0,seated:true},drawer:{open:false},students:[]};
 const settle=open=>{state.drawer.open=open;for(let n=0;n<90;n++)variants.updateDrawers(state,DT);scene.updateMatrixWorld(true);};
 const origin=station.localToWorld(V(0,1.43,-.78)),ray=new T.Raycaster();
 const cast=()=>{scene.updateMatrixWorld(true);const centre=new T.Box3().setFromObject(object,true).getCenter(V());ray.set(origin,centre.sub(origin).normalize());return pickDrawerItem(ray,[target],[variants.group]);};
 return{scene,variants,drawer,station,slot,object,target,state,ray,origin,settle,cast,dispose(){variants.dispose();const materials=new Set();scene.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});for(const m of materials)m.dispose();}};
}
function quiet(map='computer',seed=73){const round=new ClassroomRound({map,seed,target:10000});round.start();round.player.pitch=.9;round._advanceTeacher=()=>{};round._perceive=()=>{};for(const actor of round.students)actor._decisionAt=Infinity;return round;}
function key(round,target,code){const intent=interactionIntent(round.snapshot(),target,code);return intent?round[intent.method](...intent.args):false;}

test('computer storage draws one food at creation and every refill, while ordinary and office stock keep their own pools',()=>{
 const seen=new Set(),ordinary=new Set();
 for(let seed=0;seed<32;seed++)for(const map of['computer','computer7']){
  const r=quiet(map,seed);assert.equal(r.player._slots.length,1);
  for(let n=0;n<24;n++){
   const action=r.player._slots[0].action;assert.ok(COMPUTER_DRAWER_FOODS.includes(action),`${map}/${seed}: ${action}`);seen.add(action);
   r.player._slots[0].action=null;r.player._slots[0].readyAt=r.elapsed;r._refillDrawers();assert.equal(r.player._slots.length,1);
  }
  assert.deepEqual(r.officeSlots.map(s=>s.action),['lunch']);
 }
 assert.deepEqual(seen,new Set(COMPUTER_DRAWER_FOODS));
 const normal=quiet('classroom');assert.equal(normal.player._slots.length,3);for(let i=0;i<100;i++)ordinary.add(normal._drawItem());assert.ok(ordinary.has('phone')&&ordinary.has('smoke'),'ordinary drawers retain non-food items');
});

for(const kind of COMPUTER_DRAWER_FOODS)for(const yaw of[0,Math.PI])test(`${kind}: real GLB fits the single drawer, becomes visible/selectable only when open, yaw ${yaw}`,()=>{
 const f=fixture(yaw,kind);try{
  assert.ok(f.object.userData.propAsset?.includes(`${kind}-v1.glb`));assert.deepEqual(f.object.scale.toArray(),[1,1,1]);
  const local=new T.Box3();f.slot.updateWorldMatrix(true,true);const inverse=f.drawer.group.matrixWorld.clone().invert(),vertex=V(),matrix=new T.Matrix4();f.object.traverse(mesh=>{if(mesh.isMesh){matrix.multiplyMatrices(inverse,mesh.matrixWorld);const position=mesh.geometry.attributes.position;for(let i=0;i<position.count;i++)local.expandByPoint(vertex.fromBufferAttribute(position,i).applyMatrix4(matrix));}});
  assert.ok(local.min.y>=f.drawer.floor&&local.min.y<f.drawer.floor+.004,`${kind} floor contact ${local.min.y}`);
  assert.ok(local.max.y<.7765,'food must fit below the real desktop trim');assert.ok(local.min.x>-.258&&local.max.x<.258,'food must clear tray sides');assert.ok(local.min.z>-.393&&local.max.z<.233,'food must clear front and back walls');
  f.settle(false);assert.equal(f.cast(),null,'closed desktop blocks picking');
  f.settle(true);assert.ok(f.drawer.open>.999);assert.equal(f.cast(),0,'open drawer allows the actual food triangles or small silhouette margin');
  f.object.visible=false;assert.equal(f.cast(),null,'a held/empty food cannot be selected');f.object.visible=true;
  f.variants.setMap('classroom');assert.equal(f.cast(),null,'hidden computer lab must not leak pick targets');
 }finally{f.dispose();}
});

test('formal E intents open the real computer drawer, pick its food, and replenish exactly 180 frames after use',()=>{
 const f=fixture(),r=quiet();try{
  r.player._slots[0].action='burger';r.player.action=r.selected='burger';
  f.scene.updateMatrixWorld(true);const handle=f.drawer.group.localToWorld(V(0,.701,-.454));f.ray.set(f.origin,handle.sub(f.origin).normalize());assert.ok(f.ray.intersectObject(f.drawer.group,true).length,'real front/handle is an E target');
  assert.equal(key(r,{kind:'desk'},'E'),true);f.settle(r.snapshot().drawer.open);const slot=f.cast();assert.equal(slot,0);assert.equal(key(r,{kind:'item',slot},'E'),true);
  assert.equal(r.snapshot().drawer.drawnSlot,0);r.hold(true);r.step(3);assert.equal(r.completed.burger,1);assert.equal(r.snapshot().drawer.slots[0].action,null);assert.equal(r.snapshot().drawer.slots[0].readyIn,3);assert.equal(r.snapshot().drawer.drawnSlot,null);
  r.step(179*DT);assert.equal(r.snapshot().drawer.slots[0].action,null);r.step(DT);assert.ok(COMPUTER_DRAWER_FOODS.includes(r.snapshot().drawer.slots[0].action));assert.equal(r.snapshot().drawer.slots.length,1);
  assert.equal(key(r,{kind:'desk'},'Q'),true);assert.equal(r.snapshot().drawer.open,false);
 }finally{f.dispose();}
});

test('returning food is not consumption, and a banana peel occupies its slot until thrown before the three-second refill',()=>{
 const r=quiet();r.player._slots[0].action='banana';r.player.action=r.selected='banana';
 assert.equal(key(r,{kind:'desk'},'E'),true);assert.equal(key(r,{kind:'item',slot:0},'E'),true);assert.equal(key(r,null,'Q'),true);r.step(4);assert.equal(r.player._slots[0].action,'banana');assert.equal(r.player._slots[0].readyAt,0);
 assert.equal(key(r,{kind:'item',slot:0},'E'),true);r.hold(true);r.step(3);assert.equal(r.player._slots.length,1);assert.equal(r.player._slots[0].action,'bananaPeel');assert.equal(r.player._drawnSlot,0);
 r.step(4);assert.equal(r.player._slots[0].action,'bananaPeel');r.setLook(r.player.yaw,0);r.hold(true);assert.equal(r.releaseUse(),true);assert.equal(r.snapshot().drawer.slots[0].readyIn,3);
 r.step(179*DT);assert.equal(r.player._slots[0].action,null);r.step(DT);assert.ok(COMPUTER_DRAWER_FOODS.includes(r.player._slots[0].action));
});

test('twenty/thirty-seat layouts, reversed seats and remote drawer states keep independent full-size sliding trays',()=>{
 const f=fixture();try{
  for(const pattern of['rows-wide','pairs','fours']){
   const seats=createSeatLayout(73,pattern);f.variants.setSeats(seats);assert.equal([...f.variants.stations.values()].filter(o=>o.visible).length,seats.length);
   const seat=seats.find(s=>s.yaw===Math.PI)||seats[2],drawer=f.variants.drawers.get(seat.id),station=f.variants.stations.get(seat.id);
   for(let i=0;i<90;i++)f.variants.updateDrawers({player:{id:99,seated:false},students:[{id:2,seatId:seat.id,seated:true,drawerOpen:true}]},DT);
   station.updateWorldMatrix(true,true);const p=drawer.group.getWorldPosition(V());assert.ok(Math.abs(p.x-(seat.deskX-Math.sin(seat.yaw)*.24))<1e-5);assert.ok(Math.abs(p.z-(seat.deskZ-Math.cos(seat.yaw)*.24))<1e-5);
   assert.deepEqual(station.scale.toArray(),[1,1,1]);assert.deepEqual(drawer.group.scale.toArray(),[1,1,1]);
   assert.ok([...f.variants.drawers].filter(([id])=>id!==seat.id).every(([,d])=>d.open<1e-5),'other drawers close independently');
  }
 }finally{f.dispose();}
});

test('multiplayer human stock uses the same one-food pool before and after role assignment',()=>{
 const room=new CampusRoom({code:'585858',map:'computer7',seed:74}),a=room.join({name:'a'}),b=room.join({name:'b'});
 for(const member of[a,b]){const slots=room.snapshot(member).drawer.slots;assert.equal(slots.length,1);assert.ok(COMPUTER_DRAWER_FOODS.includes(slots[0].action));}
 room.begin(a);const student=[a,b].find(m=>m.role==='student'),slots=room.snapshot(student).drawer.slots;assert.equal(slots.length,1);assert.ok(COMPUTER_DRAWER_FOODS.includes(slots[0].action));
});

test('sliding computer drawer and original-size food clear desktop trim, tower and frame throughout travel',()=>{
 const overlaps=(a,b)=>['x','y','z'].every(axis=>Math.min(a.max[axis],b.max[axis])-Math.max(a.min[axis],b.min[axis])>1e-6);
 for(const kind of COMPUTER_DRAWER_FOODS){const f=fixture(0,kind);try{
  const fixed=[];f.station.children[0].traverse(o=>{if(o.isMesh)fixed.push(o);});
  for(let frame=0;frame<=30;frame++){
   f.drawer.group.position.z=-f.drawer.travel*frame/30;f.scene.updateMatrixWorld(true);const solids=fixed.map(o=>new T.Box3().setFromObject(o,true));
   f.drawer.group.traverse(o=>{if(o.isMesh){const b=new T.Box3().setFromObject(o,true);assert.ok(solids.every(s=>!overlaps(b,s)),`${kind} at ${frame}/30: drawer/food intersects fixed hardware`);}});
  }
 }finally{f.dispose();}}
});

test('computer collision includes its real 1.22m desktop side strips without enlarging ordinary desks',()=>{
 for(const yaw of[0,Math.PI]){const f=fixture(yaw);try{
  const seat={id:0,deskX:2,deskZ:-3,x:2,z:-3-Math.cos(yaw)*.78,yaw,map:'computer'},layout=createLayoutContext([seat]);f.scene.updateMatrixWorld(true);
  assert.equal(layout.map,'computer');assert.ok(Math.abs(layout.desks[0].maxX-layout.desks[0].minX-1.22)<1e-9);
  for(const side of[-1,1]){
   const a=f.station.localToWorld(V(side*.7,.83,0)),b=f.station.localToWorld(V(side*.602,.83,0)),delta=b.clone().sub(a);
   const hits=new T.Raycaster(a,delta.clone().normalize(),0,delta.length()).intersectObject(f.station,true);assert.ok(hits.length,'probe must cross actual desktop triangles');
   const hit=chalkHit(a,b,[],[],'computer',layout);assert.equal(hit?.kind,'desk');assert.equal(hit.id,0);
   const p=f.station.localToWorld(V(side*.785,0,0));assert.equal(blocked(p.x,p.z,.18,layout),true,'player radius cannot enter the visible side strip');
  }
 }finally{f.dispose();}}
 const ordinary=createLayoutContext(createSeatLayout(73,null,'classroom'));assert.ok(ordinary.desks.every(d=>Math.abs(d.maxX-d.minX-1.20)<1e-9));
});
