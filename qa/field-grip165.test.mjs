import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeskHands,createDeskItem,loadPropAssets} from '../dist/game-actors.js';
import {CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-83';
import {createRiggedPalm} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {handSamplingRig,propSurface} from './whole-palm-geometry54.mjs';
import {createSoloRound} from '../dist/solo-round.js';
import {onRunningTrack} from '../dist/playground-layout70.js';

test('published student hand grips both sides of the packet throughout a bite',async()=>{
 await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:{loadAsync:url=>loadGeometry(url.split('/').pop())}});
 const models=await Promise.all(['left','right'].map(s=>loadGeometry('ponytail-hand-'+s+'-v2.glb')));
 const hands=createDeskHands({createHand:(side,k)=>createRiggedPalm(models[side<0?0:1],side,k)});
 const hand=hands.getHand('left'),rig=handSamplingRig(hand,{samples:1000});
 for(const kind of ['chips','snack','noodles']){
  const prop=hands.group.getObjectByName(createDeskItem(kind).name),surface=propSurface(prop);
  for(let i=0;i<100;i++){
   const eating=i>45&&i<97;
   hands.update(i/60,{action:kind,carrying:true,seated:false,freeLook:true,movement:1,walkPhase:i/10,eating,holding:eating,progress:eating?(i-45)/52:0});
   if(![40,46,57,72,95,98].includes(i))continue;
   hands.group.updateMatrixWorld(true);assert.ok(prop.visible);
   const local=prop.matrixWorld.clone().invert().multiply(hand.group.matrixWorld);
   for(const digit of ['Index','Middle','Pinky','Thumb']){
    const gap=Math.min(...rig.points(digit).filter(p=>p.pad).map(p=>p.applyMatrix4(local))
     .filter(p=>digit==='Thumb'?p.z>0:p.z<0).map(p=>surface.query(p).distance));
    assert.ok(gap<.003,kind+' '+digit+' distance '+gap);
   }
  }
 }
});

test('hotpot food and plates touch the original thumb and index finger',async()=>{
 const models=await Promise.all(['left','right'].map(s=>loadGeometry('ponytail-hand-'+s+'-v2.glb')));
 const hands=createDeskHands({createHand:(side,k)=>createRiggedPalm(models[side<0?0:1],side,k)});
 const hand=hands.getHand('left'),rig=handSamplingRig(hand,{samples:1000});
 for(const action of ['hotpotBite','hotpotPlate']){
  const eating=action==='hotpotBite';
  for(let frame=0;frame<48;frame++){
   hands.update(frame/60,{action,carrying:true,seated:true,holding:eating,eating,progress:eating?frame/48:0});
  }
  hands.group.updateMatrixWorld(true);
  const food=hands.group.children.find(child=>child.visible&&child.userData.foodStyle);
  assert.ok(food,action+' must use the visible dish');
  const surface=propSurface(food),local=food.matrixWorld.clone().invert().multiply(hand.group.matrixWorld);
  for(const digit of ['Thumb','Index']){
   const gap=Math.min(...rig.points(digit).filter(p=>p.pad).map(p=>surface.query(p.applyMatrix4(local)).distance));
   assert.ok(gap<.003,action+' '+digit+' distance '+gap);
  }
 }
});

test('ordinary playground pupils enter the track, sustain a run and follow the oval',()=>{
 const round=createSoloRound({map:'playground',seed:765});round.start();
 const npc=round.students.find(a=>!a.isPlayer&&!a.networkHuman&&!a.isTeammate);
 let samples=0,fast=0;
 for(let i=0;i<600;i++){
  const {x,z}=npc;round.step(.1);
  if(i<200||!onRunningTrack(x,z))continue;
  samples++;if(Math.hypot(npc.x-x,npc.z-z)>.26)fast++;
 }
 assert.ok(samples>330,'left the track repeatedly: '+samples);
 assert.ok(fast/samples>.9,'failed to run at track pace: '+fast+'/'+samples);
});

test('standing first-person wrists and palms align to the visible bodies for both roles',async()=>{
 const {Vector3}=await import('../dist/vendor/three.module.js');
 const {createRiggedStudent,STUDENT_ASSETS}=await import('../dist/student-assets.js');
 const {createRiggedTeacher}=await import('../dist/imported-actors.js');
 const {handFrame}=await import('../dist/hand-motion.js');
 const {firstPersonEyeHeight}=await import('../dist/first-person-view.js');
 const {createHandAnimationRuntime}=await import('../dist/hand-animation-runtime59.js');
 const {PUBLISHED_HAND_ANIMATIONS}=await import('../dist/published-hand-animations61.js');
 for(const character of [...Object.keys(STUDENT_ASSETS),'teacher']){
  const teacher=character==='teacher',role=teacher?'teacher':'student';
  const source=await loadGeometry((teacher?'teacher-v2':STUDENT_ASSETS[character].file)+'.glb');
  const body=teacher?createRiggedTeacher(source):createRiggedStudent(source,{variant:character,seated:false});
  const models=await Promise.all(['left','right'].map(side=>loadGeometry((teacher?'teacher':'ponytail')+'-hand-'+side+'-v'+(teacher?1:2)+'.glb')));
  const hands=createDeskHands({createHand:(side,k)=>createRiggedPalm(models[side<0?0:1],side,k,role)});
  const animation=createHandAnimationRuntime({bodyRelativeStanding:true,storage:null,eventTarget:null,fallbackDocument:PUBLISHED_HAND_ANIMATIONS});
  const state={role,character,seated:false,movement:0,freeLook:true};
  body.setMood?.('resting');body.setMotion?.({seated:false,speed:0});
  for(let i=0;i<100;i++){
   body.update(i/60,{walking:0,speed:0,phase:'patrolling'});
   hands.update(i/60,{...state,animationPose:animation.sample(state,i/60)});
  }
  body.group.updateMatrixWorld(true);hands.group.updateMatrixWorld(true);
  const toView=v=>v.applyAxisAngle(new Vector3(0,1,0),Math.PI);
  for(const side of ['Left','Right']){
   const bones={};hands.getHand(side.toLowerCase()).group.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
   const target=toView(body.bones[side+'Hand'].getWorldPosition(new Vector3()));target.y-=firstPersonEyeHeight(state,role);
   assert.ok(target.distanceTo(bones[side+'Hand'].getWorldPosition(new Vector3()))<.025,character+' wrist '+side);
   const frame=handFrame(bones,side),outside=handFrame(body.bones,side);
   for(const axis of ['along','normal'])assert.ok(frame[axis].dot(toView(outside[axis]))>.985,character+' '+side+' '+axis);
  }
  animation.dispose();body.dispose?.();
 }
});

test('food surfaces remain clear of the skin as the fingers close and during a bite',async()=>{
 const {countGripIntersections}=await import('./whole-palm-geometry54.mjs');
 await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:{loadAsync:url=>loadGeometry(url.split('/').pop())}});
 const models=await Promise.all(['left','right'].map(side=>loadGeometry('ponytail-hand-'+side+'-v2.glb')));
 const hands=createDeskHands({createHand:(side,scale)=>createRiggedPalm(models[side<0?0:1],side,scale)});
 const left=hands.getHand('left'),skin=handSamplingRig(left,{samples:1000});
 for(const action of ['chips','snack','noodles','burger','drink','gum','banana','lunch']){
  hands.update(0,{carrying:false});
  const food=hands.group.getObjectByName(createDeskItem(action).name),surface=propSurface(food);
  for(let frame=0;frame<=28;frame++){
   const eating=frame>=20;
   hands.update(frame/120,{action,seated:true,carrying:true,holding:eating,eating,progress:eating?(frame-20)/10:0});
   hands.group.updateMatrixWorld(true);
   assert.equal(countGripIntersections(left.group,food),0,action+' intersects skin at frame '+frame);
  }
  const local=food.matrixWorld.clone().invert().multiply(left.group.matrixWorld);
  for(const digit of ['Thumb','Index','Middle','Pinky']){
   const gaps=skin.points(digit).filter(p=>p.pad).map(p=>surface.query(p.applyMatrix4(local)).distance);
   assert.ok(Math.min(...gaps)<.003,action+' '+digit+' should touch the surface');
  }
 }
});
