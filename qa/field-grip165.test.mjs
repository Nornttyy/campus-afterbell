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
   const eating=i>45;
   hands.update(i/60,{action:kind,carrying:true,seated:false,freeLook:true,movement:1,walkPhase:i/10,eating,holding:eating});
   if(i!==40&&i!==95)continue;
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

test('standing wrists stay at body height and both palms use the authored idle angle',async()=>{
 const {Vector3,Euler,Quaternion}=await import('../dist/vendor/three.module.js');
 const {createRiggedStudent,STUDENT_ASSETS}=await import('../dist/student-assets.js');
 const {createRiggedTeacher}=await import('../dist/imported-actors.js');
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
   const key=side.toLowerCase();
   const authored=PUBLISHED_HAND_ANIMATIONS.clips[role+'-idle'].keyframes[0][key].rotation;
   const actual=hands.getHand(key).group.getWorldQuaternion(new Quaternion());
   assert.ok(actual.angleTo(new Quaternion().setFromEuler(new Euler(...authored)))<.00001,character+' '+side+' palm');
  }
  animation.dispose();body.dispose?.();
 }
});
