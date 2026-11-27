import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,createRiggedPalm,STUDENT_ASSETS} from '../dist/student-assets.js';
import {createDeskHands} from '../dist/game-actors.js';
import {COACH_CUSHION,BUS_SEATS} from '../dist/bus-layout86.js';
import {ordinaryStudyState} from '../dist/npc-study58.js';
import {SoloStudentRound} from '../dist/solo-round.js';
import {loadGeometry} from './gltf-geometry.mjs';

const v=()=>new T.Vector3();
function soleMin(actor,side){
 let min=Infinity;actor.group.updateMatrixWorld(true);
 actor.group.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  mesh.skeleton.update();
  const {skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let i=0;i<skinIndex.count;i++){
   let weight=0;
   for(let j=0;j<4;j++){
    const joint=mesh.skeleton.bones[skinIndex.getComponent(i,j)].name;
    if(joint.includes(side+'Foot')||joint.includes(side+'ToeBase'))weight+=skinWeight.getComponent(i,j);
   }
   if(weight>.68)min=Math.min(min,actor.group.worldToLocal(mesh.getVertexPosition(i,v()).applyMatrix4(mesh.matrixWorld)).y);
  }
 });
 return min;
}

for(const [variant,{file}] of Object.entries(STUDENT_ASSETS))test(variant+' rides on the G-floor cushion, looks around and frees the hand that picks up food',async()=>{
 const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:false,seed:5});
 const pivot=new T.Group();pivot.position.set(4.85,.7,-14.32);pivot.rotation.y=Math.PI/2;pivot.add(actor.group);pivot.updateMatrixWorld(true);
 const point=name=>actor.group.worldToLocal(actor.bones[name].getWorldPosition(v()));
 let time=0;
 function advance(seconds){for(let i=0;i<Math.round(seconds*60);i++)actor.update(time+=1/60);}
 actor.setMotion({seated:true,seatSurface:'bus-seat'});actor.setMood('riding');advance(2);
 const posture=actor.diagnostics();
 assert.ok(posture.weights.Sit<.001&&posture.weights.Write<.001&&posture.coach.legs>.99);
 assert.equal(actor.group.getObjectByName('held-writing-pencil').visible,false);
 assert.ok(point('Hips').y-COACH_CUSHION['bus-seat'].top>.115&&point('Hips').y-COACH_CUSHION['bus-seat'].top<.175);
 for(const side of ['Left','Right']){
  const knee=point(side+'Leg'),hand=point(side+'HandMiddle1'),heel=point(side+'Foot');
  assert.ok(hand.y<.63&&hand.y>knee.y+.06&&Math.abs(hand.x-knee.x)<.10&&Math.abs(hand.z-knee.z)<.14,'knuckles must follow this knee');
  assert.ok(heel.z>.23&&knee.y-heel.y>.20);
  const sole=soleMin(actor,side);assert.ok(sole>-.012&&sole<.017,'shoe to deck gap '+sole);
 }
 const shoulder=point('LeftArm'),hip=point('Hips'),left=point('LeftHand');
 let shoulderShift=0;
 for(let i=0;i<300;i++){actor.update(time+=1/60);shoulderShift=Math.max(shoulderShift,point('LeftArm').distanceTo(shoulder));}
 assert.ok(shoulderShift>.020,'upper body never shifted');assert.ok(point('Hips').distanceTo(hip)<.002);
 actor.setMotion({seated:true,seatSurface:'bus-seat',drawerOpen:true});advance(1);
 assert.ok(point('LeftHand').z>left.z+.095,'opening the actual cabinet leaves both hands on the lap');
 actor.setMood('burger');actor.setMotion({seated:true,seatSurface:'bus-seat',carrying:true,heldAction:'burger',using:true,lookYaw:.44});advance(1.5);
 assert.ok(actor.diagnostics().coach.Left<.01&&actor.diagnostics().coach.Right>.99);
 assert.ok(actor.group.getObjectByName('layered-burger').visible);assert.ok(actor.diagnostics().headLook.yaw>.4);
 assert.ok(point('Hips').distanceTo(hip)<.002);
 actor.setMood('writing');actor.setMotion({seated:true,seatSurface:'bus-table',penWriting:true,heldAction:'pen',carrying:true});advance(1.6);
 assert.equal(actor.group.getObjectByName('held-writing-pencil').visible,true);assert.ok(actor.diagnostics().coach.Left<.01);
 actor.setMood('riding');actor.setMotion({seated:true,seatSurface:'bus-seat',carrying:false});advance(1.2);
 actor.setMotion({seated:false,speed:1.8});actor.setMood('walking');advance(1.8);
 assert.equal(actor.diagnostics().coach.surface,null);assert.ok(actor.diagnostics().weights.Walk>.999);
 actor.dispose();
});

test('lower bus riders and human passengers never write or read an absent book; the upper table has real actions',()=>{
 function board(i){
  const round=new SoloStudentRound({map:'bus'});round.start({gathering:true});assert.ok(round.startBell());
  const seat=BUS_SEATS[i];Object.assign(round.player,{x:seat.exitX,z:seat.exitZ,busDeck:seat.busDeck});
  assert.equal(round.interact(i),'seated');
  for(let tick=0;tick<30;tick++)round.step(1);
  round.step(.1);return round;
 }
 const r=board(9);assert.equal(r.snapshot().students.find(s=>s.isPlayer).mood,'riding');
 assert.equal(r.toggleBook(),false);assert.equal(r.takePen(),false);
 const a={...BUS_SEATS[9],seatYaw:Math.PI/2};let low=Infinity,high=-Infinity;
 for(let t=0;t<38;t+=.25){const s=ordinaryStudyState(a,null,t,82,'bus');assert.equal(s.mood,'riding');assert.equal(s.studyBookHeld,false);low=Math.min(low,s.pitch);high=Math.max(high,s.pitch);}
 assert.ok(high-low>.25);
 const upper=board(23);upper.setBookRaised(false);upper.step(.1);assert.equal(upper.snapshot().students.find(s=>s.isPlayer).mood,'listening');
 assert.equal(upper.toggleBook(),true);upper.step(.1);assert.equal(upper.snapshot().students.find(s=>s.isPlayer).mood,'reading');
});

test('first-person empty hands are low on a bus seat, can reach the cabinet and return to their knees',async()=>{
 const [left,right]=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
 const hands=createDeskHands({createHand:(s,scale)=>createRiggedPalm(s<0?left:right,s,scale)});
 let time=0;
 function settle(config){for(let i=0;i<120;i++)hands.update(time+=1/60,{seated:true,freeLook:true,eyeHeight:1.43,...config});return hands.getHand('left').group.getWorldPosition(v());}
 const desk=settle({deskSurface:true}),lap=settle({deskSurface:false,coachSeat:'bus-seat'});
 assert.ok(lap.y<desk.y-.17&&lap.z>desk.z+.16);
 const drawer=settle({deskSurface:false,coachSeat:'bus-seat',drawer:{amount:1,centerX:0,centerZ:-.95,width:.48,depth:.34,floor:.38,lip:.52}});
 assert.ok(drawer.z<lap.z-.24);
 const back=settle({deskSurface:false,coachSeat:'bus-seat'});assert.ok(back.distanceTo(lap)<.014);
});
