import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedPalm,createRiggedStudent} from '../dist/student-assets.js';
import {createDeskHands} from '../dist/game-actors.js?v=campus-75';
import {createFirstPersonView,sampleFirstPersonMotion} from '../dist/first-person-view.js';
import {loadGeometry} from './gltf-geometry.mjs';
const [student,left,right]=await Promise.all(['student-boy-v3.glb','hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
const factory=(side,scale)=>createRiggedPalm(side<0?left:right,side,scale);
function inView(p){return Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&p.z>=-1&&p.z<=1;}
function viewRig(seated=true,captivity='free'){
 const h=createDeskHands({createHand:factory}),camera=new T.PerspectiveCamera(62,16/9,.08,70),view=createFirstPersonView({},camera,[h.group]);
 const player={x:0,z:0,yaw:0,seated,captivity,caught:captivity!=='free'};
 camera.position.set(0,seated?1.43:1.65,0);
 let t=0,motion=null;
 return{h,camera,view,player,
  tick({pitch=.08,yaw=0,...state}={}){
   player.yaw=yaw;camera.rotation.set(-pitch,yaw+Math.PI,0,'YXZ');
   motion=sampleFirstPersonMotion(motion,player,t+=1/60);
   h.update(t,{holding:false,carrying:false,seated,caught:player.caught,freeLook:true,viewPitch:pitch,...state});
   view.align(player,motion,camera.position);camera.updateMatrixWorld(true);
  }
 };
}
function projectedSkinParts(hand,camera){
 const parts={palm:[],thumb:[],fingers:[]};
 hand.group.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
  const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let i=0;i<position.count;i++){
   let maxWeight=-1,name='';
   for(let j=0;j<4;j++)if(skinWeight.getComponent(i,j)>maxWeight){maxWeight=skinWeight.getComponent(i,j);name=mesh.skeleton.bones[skinIndex.getComponent(i,j)].name;}
   const part=/Hand$/.test(name)?'palm':name.includes('HandThumb')?'thumb':name.includes('Hand')?'fingers':null;
   if(part)parts[part].push(mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).project(camera));
  }
 });return parts;
}
test('first person uses source skinned palms and short capped forearms without generated sleeves or body',()=>{
 const h=createDeskHands({createHand:factory});
 for(const [i,side] of ['left','right'].entries()){
  const arm=h.group.getObjectByName(`${side}-desk-arm`);assert.equal(arm.children.length,1);
  const meshes=[];arm.traverse(o=>{if(o.isMesh)meshes.push(o)});assert.ok(meshes.length<=2);assert.ok(meshes.every(m=>m.isSkinnedMesh));
  assert.equal(arm.children[0].userData.fingersPerHand,4);
  assert.equal(arm.children[0].userData.shortForearm,true);
  const source=i?right:left,meta=source.parser.json.asset.extras.characters40;
  const actual=new T.Box3().setFromObject(factory(i?1:-1,1).group,true);
  assert.equal(meta.shortForearm,true);assert.equal(meta.forearmLength,.1);
  assert.ok(Math.abs(actual.min.y-(meta.proximalCutY-meta.capDepth))<1e-4,'short forearm/cap missing or cropped back to the wrist');
  assert.ok(actual.max.y>.18&&actual.max.y<.26&&actual.getSize(new T.Vector3()).y<.38,'asset includes more than the source hand and short forearm');
 }
 assert.equal(h.getDebug().palmsOnly,false);
});
test('palms remain finite and continuous through all three actions and interruptions',()=>{
 const h=createDeskHands({createHand:factory});let time=0;
 for(const action of ['snack','phone','smoke']){
  let previous=null,maxStep=0;
  for(let i=0;i<180;i++){
   h.update(time+=1/60,{action,holding:i<135,seated:i<150,viewPitch:Math.sin(time)*.3});h.group.updateMatrixWorld(true);
   const hand=h.group.getObjectByName('left-desk-hand'),p=hand.getWorldPosition(new T.Vector3());if(previous)maxStep=Math.max(maxStep,p.distanceTo(previous));previous=p;
   h.group.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.isSkinnedMesh){o.skeleton.update();for(let v=0;v<o.geometry.attributes.position.count;v+=61){const p=new T.Vector3().fromBufferAttribute(o.geometry.attributes.position,v);o.applyBoneTransform(v,p);assert.ok(p.toArray().every(Number.isFinite));assert.ok(p.length()<1,'Palm skin exploded');}}});
  }
  assert.ok(maxStep<.13,`${action}: hand snapped ${maxStep}`);
 }
});
test('ten student clips deform the imported skin within the classroom bounds',()=>{
 const a=createRiggedStudent({scene:student.scene,animations:student.animations},{seated:true});
 assert.equal(a.diagnostics().clips.length,10);
 let t=0;
 for(const mood of ['writing','snack','phone','thinking','resting']){
  a.setMood(mood);for(let i=0;i<60;i++)a.update(t+=1/60);
  const bounds=new T.Box3().setFromObject(a.group,true);assert.ok(bounds.max.y<2&&bounds.min.y>-.08);assert.ok(bounds.getSize(new T.Vector3()).x<1.4);
 }
});
test('real desk-supported palms are visible looking at the desk; standing palms stay low in the default view',()=>{
 for(const seated of [true,false]){
  const rig=viewRig(seated);for(let i=0;i<180;i++)rig.tick({pitch:seated?.55:.08});
  for(const side of ['left','right']){
   const parts=projectedSkinParts(rig.h.getHand(side),rig.camera);
   // A wrist origin can be offscreen while the actual fingers are visible.
   // Check hand skin, excluding the added forearm and its cap, instead.
   for(const [part,minimum] of [['palm',.50],['thumb',.25],['fingers',.90]]){
    const points=parts[part],visible=points.filter(inView);
    assert.ok(points.length>100,`${side} ${part}: no real skin sampled`);
    assert.ok(visible.length/points.length>=minimum,`${seated?'seated':'standing'} ${side} ${part}: only ${visible.length}/${points.length} vertices visible`);
   }
   const points=Object.values(parts).flat(),top=Math.max(...points.map(p=>p.y));
   assert.ok(top>-.85&&top<(seated?.5:-.4),`${side}: palm moved away from the lower screen: ${top}`);
   assert.ok(points.every(p=>Math.abs(p.x)<(seated?.95:.55)&&p.z>-1&&p.z<1),'hand escaped horizontal framing or camera depth');
  }
  assert.equal(rig.h.getDebug().idleHandsVisible,true);
 }
});

test('seated and restrained source fingertips stay body anchored when the camera looks away',()=>{
 for(const captivity of ['seated','carried','bound','stunned']){
  const rig=viewRig(captivity==='seated',captivity==='seated'?'free':captivity);
  for(let i=0;i<180;i++)rig.tick();
  const hand=rig.h.getHand('left'),point=()=>hand.group.localToWorld(hand.indexTip());
  const base=point(),screen=base.clone().project(rig.camera),rotation=hand.group.getWorldQuaternion(new T.Quaternion());
  let viewChange=0;
  for(const [pitch,yaw] of [[-.7,.9],[.8,-.9],[.08,0]]){
   rig.tick({pitch,yaw});const now=point();
   assert.ok(now.distanceTo(base)<1e-5,`${captivity}: head turn drags the hand through the world`);
   assert.ok(hand.group.getWorldQuaternion(new T.Quaternion()).angleTo(rotation)<1e-6,`${captivity}: palm turns with the head`);
   viewChange=Math.max(viewChange,now.project(rig.camera).distanceTo(screen));
  }
  assert.ok(viewChange>.5,`${captivity}: the hand was pinned to the camera instead of the body`);
 }
});

test('standing held objects follow horizontal turns but stay in the same world pose through camera pitch',()=>{
 for(const action of ['snack','phone','smoke']){
  const rig=viewRig(false),names={snack:'snack-packet',phone:'handheld-phone',smoke:'smoke-canister'};
  for(let i=0;i<240;i++)rig.tick({action,pitch:0,carrying:true});
  const prop=rig.h.group.getObjectByName(names[action]);assert.ok(prop,`${action}: held prop missing`);
  const position=prop.getWorldPosition(new T.Vector3()),rotation=prop.getWorldQuaternion(new T.Quaternion()),screen=position.clone().project(rig.camera);
  let screenTravel=0;
  for(const pitch of [-1.15,0,.88]){
   for(let i=0;i<60;i++)rig.tick({action,pitch,carrying:true});
   const expected=new T.Quaternion().setFromEuler(new T.Euler(-pitch,Math.PI,0,'YXZ'));
   assert.ok(rig.camera.quaternion.angleTo(expected)<1e-7);assert.equal(prop.visible,true);
   const now=prop.getWorldPosition(new T.Vector3());
   assert.ok(now.distanceTo(position)<1e-5,`${action}: head pitch moves the held object`);
   assert.ok(prop.getWorldQuaternion(new T.Quaternion()).angleTo(rotation)<1e-6);
   screenTravel=Math.max(screenTravel,now.project(rig.camera).distanceTo(screen));
  }
  assert.ok(screenTravel>.5,'held object is incorrectly pinned to the screen');
  rig.tick({action,pitch:0,yaw:.8,carrying:true});
  assert.ok(prop.getWorldPosition(new T.Vector3()).distanceTo(position)>.2,'horizontal turn does not turn the arms');
 }
});


for(const variant of ['boy','girl'])test(`${variant}: seated pelvis lowers, knees bend, and standing transition is continuous`,async()=>{
 const gltf=await loadGeometry(`student-${variant}-v3.glb`),a=createRiggedStudent(gltf,{variant,seated:false});
 a.setMood('resting');a.setMotion({seated:false});let t=0;
 for(let i=0;i<60;i++)a.update(t+=1/30);
 const stand=a.bones.Hips.getWorldPosition(new T.Vector3()).y;
 a.setMotion({seated:true});let previous=stand,maxStep=0;
 for(let i=0;i<60;i++){a.update(t+=1/30);const y=a.bones.Hips.getWorldPosition(new T.Vector3()).y;maxStep=Math.max(maxStep,Math.abs(y-previous));previous=y;}
 assert.ok(stand-previous>.14,'pelvis animation was lost on export');assert.ok(maxStep<.065,'sit pose snapped');
 const points=['LeftUpLeg','LeftLeg','LeftFoot'].map(n=>a.bones[n].getWorldPosition(new T.Vector3()));
 const bend=points[0].clone().sub(points[1]).angleTo(points[2].clone().sub(points[1]));
 assert.ok(bend<2.6&&bend>1,'knee remains almost straight or folds backward');
 a.setMotion({seated:false,speed:.475,carrying:true});for(let i=0;i<60;i++)a.update(t+=1/30);
 assert.ok(a.diagnostics().weights.WalkCarry>.99);
 const bounds=new T.Box3().setFromObject(a.group,true);assert.ok(bounds.min.y>-.09&&bounds.max.y<1.95,'deformed skin escaped bounds');
});

for(const variant of ['boy','girl'])test(`${variant}: restrained poses bend actual limbs without changing bone lengths or exploding skin`,async()=>{
 const gltf=await loadGeometry(`student-${variant}-v3.glb`),a=createRiggedStudent(gltf,{variant,seated:false});let t=0;
 a.setMotion({seated:false});for(let i=0;i<60;i++)a.update(t+=1/60);
 const lengths=['LeftArm','LeftForeArm','LeftHand','LeftUpLeg','LeftLeg','LeftFoot'].map(n=>a.bones[n].position.length());
 for(const kind of ['carried','bound','stunned','free']){
  a.setMotion({seated:false,restraint:kind});let previous=null,maxStep=0;
  for(let i=0;i<120;i++){
   a.update(t+=1/60);const hand=a.bones.LeftHand.getWorldPosition(new T.Vector3());if(previous)maxStep=Math.max(maxStep,hand.distanceTo(previous));previous=hand;
   a.group.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));});
  }
  assert.ok(maxStep<.11,`${kind}: wrist snaps ${maxStep}`);
  const next=['LeftArm','LeftForeArm','LeftHand','LeftUpLeg','LeftLeg','LeftFoot'].map(n=>a.bones[n].position.length());next.forEach((v,i)=>assert.ok(Math.abs(v-lengths[i])<.005));
  const bounds=new T.Box3().setFromObject(a.group,true);assert.ok(bounds.max.y<2&&bounds.min.y>-.08);assert.ok(bounds.getSize(new T.Vector3()).x<1.5);
 }
});
