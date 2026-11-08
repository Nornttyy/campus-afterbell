import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {createDeskItem} from '../dist/game-actors.js';
import {loadGeometry} from './gltf-geometry.mjs';
const V=(...v)=>new T.Vector3(...v),DT=1/60;
function tick(actor,t,seconds=2){for(let i=0;i<seconds/DT;i++)actor.update(t+=DT);actor.group.updateMatrixWorld(true);return t;}
function wristBend(actor,side){const fore=actor.bones[side+'ForeArm'].getWorldPosition(V()),wrist=actor.bones[side+'Hand'].getWorldPosition(V()),frame=actor.diagnostics().hands.find(h=>h.side===side);return V(...frame.along).angleTo(wrist.sub(fore))*180/Math.PI;}
function phoneMatrix(actor){const hand=actor.getHand('left'),fit=hand.userData.attachments.phone;return hand.matrixWorld.clone().multiply(new T.Matrix4().compose(V(...fit.position),new T.Quaternion().setFromEuler(new T.Euler(...fit.rotation)),V(1,1,1)));}
test('boy: switching from crawling to phone leaves real phone and finger skin below the chin and above the desk',async()=>{
 const actor=createRiggedStudent(await loadGeometry(STUDENT_ASSETS.boy.file+'.glb'),{variant:'boy',seated:false}),pivot=new T.Group();pivot.rotation.y=.75;pivot.add(actor.group);
 const anchor=actor.getHand('left'),fit=anchor.userData.attachments.phone,phone=createDeskItem('phone');phone.position.fromArray(fit.position);phone.rotation.fromArray(fit.rotation);anchor.add(phone);
 actor.setMood('crawling');actor.setMotion({crawling:true,seated:false,speed:.55});tick(actor,0,3);
 // Match the QA page's action reset, including the old crawl's final frame.
 actor.update(0);actor.setMood('phone');actor.setMotion({crawling:false,seated:true,speed:0,carrying:true});let time=tick(actor,0,12);
 const samples=[];actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const {position,skinIndex,skinWeight}=mesh.geometry.attributes;for(let i=0;i<position.count;i++){let weight=-1,name='';for(let j=0;j<4;j++)if(skinWeight.getComponent(i,j)>weight){weight=skinWeight.getComponent(i,j);name=mesh.skeleton.bones[skinIndex.getComponent(i,j)].name;}if(name.includes('Head')||name.includes('Hand'))samples.push({mesh,index:i,head:name.includes('Head')});}});
 for(let frame=0;frame<120;frame++){
  actor.update(time+=DT);if(frame%15)continue;actor.group.updateMatrixWorld(true);const inverse=actor.group.matrixWorld.clone().invert();let chin=Infinity,handTop=-Infinity;
  actor.group.traverse(mesh=>{if(mesh.isSkinnedMesh)mesh.skeleton.update();});
  for(const {mesh,index,head}of samples){const p=mesh.getVertexPosition(index,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);if(head)chin=Math.min(chin,p.y);else handTop=Math.max(handTop,p.y);}
  const box=new T.Box3();phone.traverse(mesh=>{if(!mesh.isMesh)return;for(let i=0;i<mesh.geometry.attributes.position.count;i++)box.expandByPoint(mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse));});
  assert.ok(box.min.y>.885,`phone cuts into the .88m desktop: ${box.min.y}`);
  assert.ok(box.max.y<chin-.025,`phone intersects the actual chin skin: phone ${box.max.y}, chin ${chin}`);
  assert.ok(handTop<chin-.004,`phone tapping puts real finger/palm skin in the chin: ${handTop} / ${chin}`);
 }
 actor.dispose();
});
for(const [variant,{file}]of Object.entries(STUDENT_ASSETS)){
 test(`${variant}: handheld gestures bend elbows instead of folding wrists and preserve rig lengths`,async()=>{
  const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant});
  const lengths=new Map(Object.entries(actor.bones).filter(([name])=>/^(Left|Right)(Arm|ForeArm|Hand)/.test(name)).map(([,b])=>[b,b.position.clone()]));let time=0;
  for(const [mood,seated]of [['snack',true],['drink',true],['burger',true],['note',true],['phone',true],['phone',false],['note',false]]){
   actor.setMood(mood);actor.setMotion({seated,carrying:!seated});time=tick(actor,time);
   const side=mood==='note'?'Right':'Left';
   for(let i=0;i<120;i++){actor.update(time+=DT);actor.group.updateMatrixWorld(true);assert.ok(wristBend(actor,side)<55,`${mood} ${side} folds at the wrist`);if(mood==='phone'&&seated)assert.ok(wristBend(actor,'Right')<60,'phone tapping folds the right wrist');}
   if(!seated&&mood==='phone')assert.ok(actor.bones.RightHand.getWorldPosition(V()).y<actor.bones.LeftHand.getWorldPosition(V()).y-.2,'empty hand remains raised beside the item');
   for(const [bone,p]of lengths)assert.ok(bone.position.distanceTo(p)<.00002,`${bone.name} length changed`);
  }
  actor.dispose();
 });
 test(`${variant}: phone use moves the real index skin to the screen and lifts between taps`,async()=>{
  const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant});actor.setMood('phone');let time=tick(actor,0),z=[],rotations=[];
  for(let i=0;i<180;i++){actor.update(time+=DT);actor.group.updateMatrixWorld(true);const tip=V(...actor.diagnostics().gestures.indexTip).applyMatrix4(phoneMatrix(actor).invert());assert.ok(Math.abs(tip.x)<.04&&Math.abs(tip.y)<.07,'finger misses screen rectangle');z.push(tip.z);rotations.push(actor.bones.RightHandIndex2.quaternion.clone());}
  assert.ok(Math.min(...z)>.013&&Math.min(...z)<.019,`finger does not contact screen: ${Math.min(...z)}`);assert.ok(Math.max(...z)-Math.min(...z)>.010,'finger never lifts');assert.ok(Math.max(...rotations.map(q=>q.angleTo(rotations[0])))>.035,'real finger joint never flexes');actor.dispose();
 });
 test(`${variant}: paper passing moves its held hand while the other hand supports on the desk`,async()=>{
  const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant});actor.setMood('note');let time=tick(actor,0),z=[];const left=actor.bones.LeftHand.getWorldPosition(V());
  for(let i=0;i<180;i++){actor.update(time+=DT);actor.group.updateMatrixWorld(true);z.push(actor.bones.RightHand.getWorldPosition(V()).z);assert.ok(actor.bones.LeftHand.getWorldPosition(V()).distanceTo(left)<.0001,'supporting hand drifts');}
  assert.ok(Math.max(...z)-Math.min(...z)>.02,'note remains completely static');actor.dispose();
 });
}

for(const [variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: interrupting phone use and returning to writing does not snap or leave a stale grip`,async()=>{
 const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true}),reference=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true});let time=0;
 const pose=()=>Object.fromEntries(['Left','Right'].map(side=>[side,{p:actor.bones[side+'Hand'].getWorldPosition(V()),q:actor.bones[side+'Hand'].getWorldQuaternion(new T.Quaternion())}]));
 actor.setMood('writing');time=tick(actor,time);let previous=pose();
 for(const [mood,frames]of [['phone',7],['writing',120],['phone',150],['writing',150]]){
  actor.setMood(mood);actor.setMotion({seated:true,carrying:false});
  for(let i=0;i<frames;i++){actor.update(time+=DT);actor.group.updateMatrixWorld(true);const next=pose();for(const side of ['Left','Right']){assert.ok(next[side].p.distanceTo(previous[side].p)<.055,`${side} hand jumps when ${mood} is interrupted`);assert.ok(next[side].q.angleTo(previous[side].q)<.50,`${side} wrist snaps when changing to ${mood}`);assert.ok(next[side].p.toArray().every(Number.isFinite));}previous=next;}
 }
 reference.setMood('writing');tick(reference,0,time);reference.group.updateMatrixWorld(true);
 for(const side of ['Left','Right']){const actual=actor.bones[side+'Hand'],expected=reference.bones[side+'Hand'];assert.ok(actual.getWorldPosition(V()).distanceTo(expected.getWorldPosition(V()))<.001,'stale gesture offsets writing contact');assert.ok(actual.getWorldQuaternion(new T.Quaternion()).angleTo(expected.getWorldQuaternion(new T.Quaternion()))<.01,'stale phone wrist persists in writing');}
 actor.dispose();reference.dispose();
});
