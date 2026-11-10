import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {CLASSROOM_PROP_SOURCES,loadPropAssets,restDeskItem} from '../dist/prop-assets.js?v=campus-59c';
import {createDeskItem} from '../dist/game-actors.js?v=campus-59c';
import {createDrawerPickTarget,pickDrawerItem} from '../dist/drawer-picking.js';
import {ClassroomRound} from '../dist/classroom-rules.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:{loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())}});
const source=(await loadGeometry('desk-v2.glb')).scene;
function fixture({kind='garlic',yaw=0,open=true}={}){
 const scene=new T.Group(),body=source.getObjectByName('DeskBody').clone(true),drawer=source.getObjectByName('DeskDrawer').clone(true),host=new T.Group(),items=[],targets=[];
 scene.position.set(2,0,-3);scene.rotation.y=yaw;scene.add(body,host);host.position.z=open?-.24:0;host.add(drawer);
 for(let slot=0;slot<3;slot++){
  const group=new T.Group();group.position.set((slot-1)*.28,.680,-.16);host.add(group);
  const object=createDeskItem(kind);object.rotation.set(kind==='burger'?0:-Math.PI/2,0,(slot===1?.04:slot===0?-.07:.08)+(object.userData.propAsset&&kind!=='burger'?Math.PI:0));restDeskItem(object,.659-group.position.y);group.add(object);items.push(object);targets.push(createDrawerPickTarget(object,slot));
 }
 scene.updateMatrixWorld(true);
 const origin=scene.localToWorld(V(0,1.43,-.78)),ray=new T.Raycaster();
 function castAt(slot,offset=V()){
  const point=new T.Box3().setFromObject(items[slot],true).getCenter(V());
  point.add(offset.clone().applyAxisAngle(V(0,1,0),yaw));ray.set(origin,point.sub(origin).normalize());
  return pickDrawerItem(ray,targets,[body,host]);
 }
 return{scene,body,host,items,targets,ray,origin,castAt};
}
for(const yaw of [0,Math.PI])for(const slot of [0,1,2])test(`real garlic GLB: exact centre can be picked at yaw ${yaw}, slot ${slot}`,()=>{
 const f=fixture({yaw});assert.equal(f.castAt(slot),slot);assert.deepEqual(f.items[slot].scale.toArray(),[1,1,1]);
});
test('a 1 cm silhouette miss on the six-centimetre garlic stays selectable without mesh scaling',()=>{
 const f=fixture();f.castAt(1,V(.04,0,0));
 assert.equal(f.ray.intersectObject(f.items[1],true).length,0,'probe must miss the original triangles');
 assert.equal(pickDrawerItem(f.ray,f.targets,[f.body,f.host],{margin:0}),null,'original exact geometry must miss');
 assert.equal(pickDrawerItem(f.ray,f.targets,[f.body,f.host]),1);assert.deepEqual(f.items[1].scale.toArray(),[1,1,1]);
});
test('the real banana concavity is selectable instead of selecting the drawer floor',()=>{
 const f=fixture({kind:'banana'});f.castAt(1);assert.equal(f.ray.intersectObject(f.items[1],true).length,0,'banana centre is in the curved empty area');assert.equal(pickDrawerItem(f.ray,f.targets,[f.body,f.host]),1);
});
test('tabletop and front plate still occlude closed drawers, including all facing directions',()=>{
 for(const yaw of [0,Math.PI])for(const slot of [0,1,2]){const f=fixture({yaw,open:false});assert.equal(f.castAt(slot),null,`closed drawer ${yaw}/${slot}`);}
 const f=fixture();const blocker=new T.Mesh(new T.BoxGeometry(.6,.4,.025),new T.MeshBasicMaterial());blocker.position.set(0,.95,-.57);f.scene.add(blocker);f.scene.updateMatrixWorld(true);f.castAt(1);assert.equal(pickDrawerItem(f.ray,f.targets,[f.body,f.host,blocker]),null);
});
test('margin does not steal adjacent slots, select empty space, or hidden/held stock',()=>{
 const f=fixture();f.castAt(1,V(.14,0,0));assert.equal(pickDrawerItem(f.ray,f.targets,[f.body,f.host]),null,'14 cm slot gap is empty');
 f.items[1].visible=false;assert.equal(f.castAt(1),null,'held or empty slot is unpickable');f.items[1].visible=true;f.host.visible=false;assert.equal(f.castAt(1),null,'hidden drawer is unpickable');
});
test('direct visible surfaces win over nearby bounds and blocked surfaces cannot be reached around',()=>{
 const f=fixture();f.castAt(1);const original=f.targets[0].bounds.clone();f.targets[0].bounds.expandByScalar(.4);assert.equal(pickDrawerItem(f.ray,f.targets,[f.body,f.host]),1,'exact middle hit takes priority over larger bounds');f.targets[0].bounds.copy(original);
 const wall=new T.Mesh(new T.BoxGeometry(.4,.4,.03),new T.MeshBasicMaterial());wall.position.copy(f.origin).addScaledVector(f.ray.ray.direction,.45);wall.lookAt(f.origin);wall.updateMatrixWorld(true);assert.equal(pickDrawerItem(f.ray,f.targets,[f.body,f.host,wall]),null);
});
test('real geometry selection drives take/use/return and garlic five-second burp',()=>{
 const f=fixture(),r=new ClassroomRound({target:1000});r.start();r.player.pitch=.55;r.teacher.x=r.teacher.z=40;r._thinkAt=r._plan.until=Infinity;for(const s of r.students)s._decisionAt=Infinity;
 r.player._slots=Array.from({length:3},(_,id)=>({id,action:'garlic',progress:0,readyAt:0}));r.player._drawnSlot=null;r.player._drawerOpen=true;
 assert.equal(r.takeSlot(f.castAt(1,V(.04,0,0))),true);assert.equal(r.snapshot().drawer.drawnSlot,1);assert.equal(r.returnItem(),true);assert.equal(r.takeSlot(f.castAt(0)),true);r.hold(true);r.step(3);assert.equal(r.snapshot().player.burpReadyLeft,5);assert.equal(r.snapshot().completed.garlic,1);
});
