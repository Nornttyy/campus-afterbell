import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createDeskItem,createDeskHands,THROWABLE_ITEM_KINDS} from '../dist/game-actors.js?v=campus-65';
import {createRiggedPalm,createRiggedStudent} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const names={smoke:'smoke-canister',flash:'flash-perforated-canister',ink:'ink-glass-bottle',bananaPeel:'banana-peel'};

test('flash sleeve has actual apertures through to its recessed baffle',()=>{
 const prop=createDeskItem('flash');prop.updateMatrixWorld(true);
 const at=angle=>{const radial=V(Math.sin(angle),0,Math.cos(angle));const ray=new T.Raycaster(radial.clone().multiplyScalar(.13),radial.clone().negate());return ray.intersectObject(prop,true)[0]?.point.length();};
 for(let i=0;i<8;i++){
  const hole=at((i+.5)/8*Math.PI*2),wall=at((i+.25)/8*Math.PI*2);
  assert.ok(hole>.031&&hole<.037,`aperture ${i} is painted shut or has no baffle: ${hole}`);
  assert.ok(wall>.041&&wall<.047,`sleeve wall ${i} missing: ${wall}`);
 }
});

test('ink has a translucent bottle surrounding a separate dark liquid volume',()=>{
 const ink=createDeskItem('ink'),smoke=createDeskItem('smoke');
 const glass=ink.children.find(m=>m.material?.isMeshPhysicalMaterial),liquid=ink.children.find(m=>m.material?.color?.getHex()===0x071b30);
 assert.ok(glass&&liquid);assert.ok(glass.material.transparent&&glass.material.opacity<.7&&!glass.material.depthWrite);
 const bottleBox=new T.Box3().setFromObject(glass),liquidBox=new T.Box3().setFromObject(liquid);
 assert.ok(bottleBox.containsBox(liquidBox));assert.ok(bottleBox.max.y-liquidBox.max.y>.04,'liquid fills the cap/neck');
 assert.notDeepEqual(ink.children.map(m=>m.geometry.attributes.position.count),smoke.children.map(m=>m.geometry.attributes.position.count),'new bottle reused smoke geometry');
});

test('all eighteen sesame seeds are visible above the actual upper bun mesh',()=>{
 const burger=createDeskItem('burger');burger.updateMatrixWorld(true);
 const seedMesh=burger.children.find(m=>m.material.color?.getHex()===0xffe0a1),p=seedMesh.geometry.attributes.position;
 assert.equal(p.count%18,0);const stride=p.count/18;
 for(let seed=0;seed<18;seed++){
  const bounds=new T.Box3();for(let i=seed*stride;i<(seed+1)*stride;i++)bounds.expandByPoint(V().fromBufferAttribute(p,i));
  const c=bounds.getCenter(V()),hits=new T.Raycaster(V(c.x,.3,c.z),V(0,-1,0)).intersectObject(burger,true);
  assert.equal(hits[0]?.object,seedMesh,`seed ${seed} is buried under the bun`);
 }
});

const [left,right]=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
for(const kind of THROWABLE_ITEM_KINDS)test(`${kind}: imported first-person palm maintains grip, winds up and opens on both quick and charged release`,()=>{
 for(const charge of [0,1]){
  const actor=createDeskHands({createHand:(side,scale)=>createRiggedPalm(side<0?left:right,side,scale)}),hand=actor.getHand('left'),prop=actor.group.getObjectByName(names[kind]);let t=0,anchor;
  for(let i=0;i<120;i++){actor.update(t+=1/60,{action:kind,carrying:true,holding:true,progress:charge});actor.group.updateMatrixWorld(true);if(prop.visible){const relative=new T.Matrix4().copy(hand.group.matrixWorld).invert().multiply(prop.matrixWorld);if(anchor)assert.ok(relative.elements.every((n,j)=>Math.abs(n-anchor.elements[j])<.0001),'object slipped away from palm');else anchor=relative.clone();}}
  assert.ok(prop.visible);const closed=hand.indexTip().y,previous=hand.group.position.clone();let open=-Infinity,maxStep=0;
  for(let i=0;i<25;i++){
   actor.update(t+=1/60,{action:kind,carrying:false,holding:false,progress:0,throwAge:i/60});
   assert.equal(prop.visible,false,'a second projectile remains stuck in hand');maxStep=Math.max(maxStep,previous.distanceTo(hand.group.position));previous.copy(hand.group.position);
   if(i>=7&&i<=13)open=Math.max(open,hand.indexTip().y);
  }
  assert.ok(open>closed+.012,`${kind}/${charge}: real index skin did not open (${closed}→${open})`);assert.ok(maxStep<.11,`release snapped ${maxStep}`);
 }
});

for(const variant of ['boy','girl'])test(`${variant}: NPC thrown items use the left grip and articulated release without changing bone lengths`,async()=>{
 const source=await loadGeometry(`student-${variant}-v3.glb`);let middleRest;
 source.scene.traverse(o=>{if(o.name.replace(/^mixamorig[:_]?/,'')==='LeftHandMiddle3')middleRest=o.quaternion.clone();});
 const actor=createRiggedStudent(source,{variant,seated:true}),lengths=new Map(Object.entries(actor.bones).filter(([name])=>/^(Left|Right)(Arm|ForeArm|Hand|UpLeg|Leg|Foot)/.test(name)).map(([,b])=>[b,b.position.clone()]));let t=0;
 for(const kind of THROWABLE_ITEM_KINDS){
  actor.setMood(kind);
  for(let i=0;i<90;i++){actor.setMotion({seated:true,carrying:true,throwProgress:i/90});actor.update(t+=1/60);}
  const prop=actor.group.getObjectByName(names[kind]);assert.ok(prop.visible&&prop.parent===actor.getHand('left'));
  const closed=actor.bones.LeftHandMiddle3.quaternion.angleTo(middleRest),heldPoint=actor.bones.LeftHand.getWorldPosition(V());let farthest=0;
  for(let i=0;i<22;i++){
   actor.setMotion({seated:true,carrying:false,throwProgress:1,throwAge:i/60});actor.update(t+=1/60);
   assert.equal(prop.visible,false);farthest=Math.max(farthest,heldPoint.distanceTo(actor.bones.LeftHand.getWorldPosition(V())));
   if(i===8)assert.ok(actor.bones.LeftHandMiddle3.quaternion.angleTo(middleRest)<closed*.3,'NPC fingers stayed clenched after release');
   for(const [bone,position]of lengths)assert.ok(bone.position.distanceTo(position)<1e-5,`${bone.name}: throw changed a bone length`);
   actor.group.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),'invalid throwing transform'));
  }
  assert.ok(farthest>.08,'NPC arm never moves through the throw');
  actor.setMotion({carrying:false,restraint:'bound'});actor.update(t+=1/60);assert.equal(prop.visible,false);
  actor.setMood('resting');actor.setMotion({carrying:false,restraint:'free'});for(let i=0;i<90;i++)actor.update(t+=1/60);
 }
 actor.dispose();
});
