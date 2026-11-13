import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createDeskHands} from '../dist/game-actors.js';
import {createRiggedPalm,createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {loadPropAssets,CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-75';
import {createBubbleEffects,ATTACHED_GUM_RADIUS} from '../dist/bubble-effects.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {surfaceDistance} from './prop-contact-helpers.mjs';
const V=(...a)=>new T.Vector3(...a),Q=()=>new T.Quaternion(),DT=1/60;
const [left,right]=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:{loadAsync:url=>loadGeometry(url.split('/').pop())}});
const make=()=>createDeskHands({createHand:(side,scale)=>createRiggedPalm(side<0?left:right,side,scale)});
const names={snack:'snack-packet',drink:'red-drink-can',burger:'layered-burger',banana:'curved-banana',garlic:'garlic-clove',gum:'bubblegum-wrapper',lunch:'teacher-lunchbox'};

for(const [action,name]of Object.entries(names))test(`${action}: complete 3-second real-skin eating turns palm to eye, centres, bobs and returns with a rigid wrist grip`,()=>{
 const h=make(),prop=h.group.getObjectByName(name),hand=h.getHand('left'),wrist=hand.group.getObjectByName('mixamorigLeftHand'),middle=hand.group.getObjectByName('mixamorigLeftHandMiddle2');
 let time=0;for(let i=0;i<120;i++)h.update(time+=DT,{action,carrying:true,freeLook:true});h.group.updateMatrixWorld(true);
 const original=prop.getWorldPosition(V()),scale=hand.group.scale.clone(),bones=[];hand.group.traverse(o=>{if(o.isBone)bones.push([o,o.position.clone()]);});
 let grip=null,previous=null,maxStep=0,maxTurn=0;const bob=[],digits=[];
 for(let frame=0;frame<=180;frame++){
  h.update(time+=DT,{action,carrying:true,holding:true,progress:frame/180,freeLook:true});h.group.updateMatrixWorld(true);
  const fit=wrist.matrixWorld.clone().invert().multiply(prop.matrixWorld),p=prop.getWorldPosition(V()),q=wrist.getWorldQuaternion(Q());
  if(grip)assert.ok(fit.elements.every((x,i)=>Math.abs(x-grip.elements[i])<.00001),'prop detached from the actual wrist');else grip=fit;
  if(previous){maxStep=Math.max(maxStep,p.distanceTo(previous.p));maxTurn=Math.max(maxTurn,q.angleTo(previous.q));}previous={p,q};
  assert.deepEqual(prop.scale.toArray(),[1,1,1]);assert.ok(hand.group.scale.distanceTo(scale)<1e-10);
  if(frame>=60&&frame<=132){const d=h.getDebug().articulation[0];assert.ok(d.rigged&&d.wristAngle>.35&&d.elbowAngle>.5,'gesture only moved the outer group');assert.ok(V(...d.palm).dot(p.clone().negate().normalize())>.85,'palm faces away from player');assert.ok(Math.abs(p.x)<.025);bob.push(p.y);digits.push(middle.quaternion.clone());}
  // Full finger/palm surfaces and winding parity are checked in hand-motion55;
  // a wrapped finger need not contact at its single most distal vertex.
 }
 assert.ok(Math.max(...bob)-Math.min(...bob)>.075,'eating has no visible vertical strokes');
 assert.ok(maxStep<.025&&maxTurn<.18,`gesture snaps: ${maxStep}m, ${maxTurn}rad`);assert.ok(prop.getWorldPosition(V()).distanceTo(original)<.002);
 for(const [bone,p]of bones)assert.ok(bone.position.distanceTo(p)<1e-10,'source bone length changed');
});

test('stopping, resuming, pausing and switching food preserve continuous real wrist and prop motion',()=>{
 const h=make();let time=0;for(let i=0;i<120;i++)h.update(time+=DT,{action:'snack',carrying:true,freeLook:true});
 const prop=h.group.getObjectByName('snack-packet'),hand=h.getHand('left').group.getObjectByName('mixamorigLeftHand');let before=null;
 for(let f=0;f<200;f++){
  const holding=f<70||f>=78&&f<130,progress=f<70?f/180:f>=78?(f-78)/180:0;
  h.update(time+=DT,{action:f<145?'snack':'phone',carrying:true,holding,progress,freeLook:true});h.group.updateMatrixWorld(true);
  const p=prop.getWorldPosition(V()),q=hand.getWorldQuaternion(Q());if(before&&prop.visible){assert.ok(p.distanceTo(before.p)<.055,'interrupted food jumped');assert.ok(q.angleTo(before.q)<.21,'interrupted wrist snapped');}before={p,q};
  if(f===90){const paused=prop.matrixWorld.clone();for(let i=0;i<20;i++)h.update(time,{action:'snack',carrying:true,holding,progress,freeLook:true});h.group.updateMatrixWorld(true);assert.ok(paused.elements.every((x,i)=>Math.abs(x-prop.matrixWorld.elements[i])<1e-6),'pause advances the gesture');}
 }
});

test('first-person pen rolls at the real right index, then continuously settles into page writing without resizing',()=>{
 const h=make(),pen=h.group.getObjectByName('red-school-pen'),hand=h.getHand('right');let time=0;
 for(let i=0;i<120;i++)h.update(time+=DT,{action:'pen',carrying:true,freeLook:true});
 let previous=null;const angles=[],tips=[];
 for(let f=0;f<420;f++){
  const writing=f>=120&&f<300;h.update(time+=DT,{action:'pen',carrying:true,penWriting:writing,freeLook:true});h.group.updateMatrixWorld(true);
  const contact=V(0,pen.userData.pen.gripY,-pen.userData.pen.gripRadius).applyMatrix4(pen.matrixWorld),index=hand.indexTip().applyMatrix4(hand.group.matrixWorld),p=pen.getWorldPosition(V()),q=pen.getWorldQuaternion(Q());
  assert.ok(p.distanceTo(index)<.10,'pen leaves the finger region'); // Full pad/shaft surface contacts are checked in first-person58.assert.deepEqual(pen.scale.toArray(),[1,1,1]);
  if(previous){assert.ok(p.distanceTo(previous.p)<.045,'mode change throws pen out of hand');assert.ok(q.angleTo(previous.q)<.50,'pen mode change snaps');}previous={p,q};
  if(f<120)angles.push(q);if(f>=240&&f<300){const tip=V(0,-.0875,0).applyMatrix4(pen.matrixWorld),page=.88+Math.abs(tip.x)*Math.tan(.14)+.005-1.43;assert.ok(Math.abs(tip.y-page)<.001);tips.push(tip);}
 }
 assert.ok(angles.some(q=>q.angleTo(angles[0])>2.8),'pen never completes a turn');assert.ok(tips.some(p=>p.distanceTo(tips[0])>.02),'writing is static');
});

for(const [variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: third-person pen twirls above desk and transitions back to the authored page contact`,async()=>{
 const a=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true}),pencil=a.group.getObjectByName('held-writing-pencil');a.setMood('pen');let time=0,previous=null;
 const lengths=new Map(Object.values(a.bones).map(b=>[b,b.position.clone()])),rotations=[];
 for(let f=0;f<480;f++){
  const writing=f>=240;a.setMotion({seated:true,carrying:true,heldAction:'pen',using:false,penWriting:writing,penTwirling:!writing});a.update(time+=DT);a.group.updateMatrixWorld(true);
  const p=pencil.getWorldPosition(V()),q=pencil.getWorldQuaternion(Q());if(previous&&f>15){assert.ok(p.distanceTo(previous.p)<.05,'twirl/write transition jumps');assert.ok(q.angleTo(previous.q)<.5,'twirl/write snaps its pencil');}previous={p,q};
  assert.deepEqual(pencil.scale.toArray(),[1,1,1]);assert.equal(a.group.getObjectByName('red-school-pen'),undefined,'duplicate food pen');
  if(f>90&&f<235){rotations.push(q);for(const y of [-.129,.115]){const end=V(0,y,0).applyMatrix4(pencil.matrixWorld);assert.ok(end.y>.89,`rotating pen enters desk: ${end.y}`);}}
  if(f>400){const nib=V(0,-.129,0).applyMatrix4(pencil.matrixWorld),page=.88+.005/Math.cos(.14)+Math.abs(nib.x)*Math.tan(.14);assert.ok(Math.abs(nib.y-page)<.003,'writing no longer reaches page');}
 }
 assert.ok(rotations.some(q=>q.angleTo(rotations[0])>2.8),'remote pen does not turn');for(const [b,p]of lengths)assert.ok(b.position.distanceTo(p)<.00002);a.dispose();
});

test('pink head-attached gum keeps a fixed radius while mouth inflation still grows',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),fx=createBubbleEffects(scene,camera),state={player:{id:9,bubble:{progress:.2}},students:[{id:1,x:0,z:0}],bubbles:[]};
 fx.update(state);const own=camera.getObjectByName('first-person-gum-bubble').children[0],small=own.scale.x;assert.ok(own.material.fragmentShader.includes('vec3(1.0,.28,.58)'));
 state.player.bubble.progress=.9;fx.update(state);assert.ok(own.scale.x>small);
 for(const charge of [.1,.5,1]){state.bubbles=[{id:1,x:0,y:1.7,z:0,charge,age:0,lifetime:10,attachedId:1}];fx.update(state);const bubble=scene.getObjectByName('released-gum-bubbles').children[0];assert.deepEqual(bubble.scale.toArray(),[ATTACHED_GUM_RADIUS,ATTACHED_GUM_RADIUS*.88,ATTACHED_GUM_RADIUS*.72]);}fx.dispose();
});
