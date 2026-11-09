import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {sampleActorHeading,captureBodyYaw,captureHeadLook} from '../dist/classroom.js';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {DETENTION} from '../dist/classroom-layout.js';
const V=(...args)=>new T.Vector3(...args);
const cases=[['boy','student-boy-v4.glb'],['girl','student-girl-v4.glb'],['glasses','student-glasses-v2.glb'],['ponytail','student-ponytail-v1.glb']];
for(const [variant,file] of cases)test(`${variant}: original rig bends both arms behind the post without hiding fingers in wood, then releases`,async()=>{
 const source=await loadGeometry(file),actor=createRiggedStudent(source,{variant,seated:false,seed:.37});let time=0;
 const rest=new Map(Object.values(actor.bones).map(b=>[b,{position:b.position.clone(),scale:b.scale.clone()}]));
 const point=name=>actor.group.worldToLocal(actor.bones[name].getWorldPosition(V()));
 function advance(state,seconds){actor.setMood('resting');actor.setMotion({seated:false,speed:0,carrying:false,restraint:state});for(let i=0;i<Math.round(seconds*60);i++)actor.update(time+=1/60);actor.group.updateMatrixWorld(true);actor.group.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}
 advance('free',1);const idle=Object.fromEntries(['Left','Right'].map(side=>[side,point(side+'Hand')]));
 advance('stunned',.4);advance('carried',1.2);advance('bound',2);
 const head=actor.bones.Head.quaternion.clone();
 for(const side of ['Left','Right']){
  const shoulder=point(side+'Arm'),elbow=point(side+'ForeArm'),wrist=point(side+'Hand');
  assert.ok(elbow.z<-.08&&wrist.z<-.29,`${side}: arms must bend behind the body`);
  // Preserve the original arm lengths: the latest glasses rig has a 24°
  // right elbow here, while the longer-armed rigs bend up to 69°.
  assert.ok(elbow.clone().sub(shoulder).angleTo(wrist.clone().sub(elbow))>Math.PI/9,`${side}: elbow stays straight`);
  let validDigits=0;
  for(const finger of ['Index','Middle','Pinky']){
   const bone=actor.bones[side+'Hand'+finger+'3'],points=[];
   actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const joint=mesh.skeleton.bones.indexOf(bone);if(joint<0)return;const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
    for(let i=0;i<position.count;i++){let weight=0;for(let j=0;j<4;j++)if(skinIndex.getComponent(i,j)===joint)weight+=skinWeight.getComponent(i,j);if(weight<=.55)continue;const p=V().fromBufferAttribute(position,i);mesh.applyBoneTransform(i,p);points.push(actor.group.worldToLocal(mesh.localToWorld(p)));}
   });
   assert.ok(points.length>3,'sample the actual skin, not only bone tips');
   const center=points.reduce((sum,p)=>sum.add(p),V()).multiplyScalar(1/points.length),outside=points.filter(p=>Math.hypot(p.x,p.z+.39)>.085).length/points.length;
   if(center.z<-.31&&outside>.6)validDigits++;
  }
  assert.ok(validDigits>=2,`${side}: fingers should remain behind and outside the post`);
 }
 advance('bound',.65);assert.ok(head.angleTo(actor.bones.Head.quaternion)>.005,'bound struggle must remain animated');
 advance('free',1.8);assert.equal(actor.diagnostics().capture.kind,'free');
 for(const side of ['Left','Right'])assert.ok(point(side+'Hand').distanceTo(idle[side])<.012,'rescue restores the original neutral arms');
 for(const [bone,saved]of rest){assert.ok(bone.scale.distanceTo(saved.scale)<.00001,'do not reshape original character');if(!/^(Hips|Head|Neck|Spine)/.test(bone.name.replace(/^mixamorig[:_]?/,'')))assert.ok(bone.position.distanceTo(saved.position)<.00001,'do not alter bone lengths');}
 actor.dispose();
});
test('production capture creates no visible ropes and outlines the actual bound student',async()=>{
 const source=await readFile(new URL('../dist/classroom.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/restraint-rope|ropeMaterial|ropes\.get|rescueHandle/);
 assert.doesNotMatch(source,/rescueTarget=rounded/);
 assert.match(source,/pupilRecords\[target\.id\]\?\.actor\?\.group/);
});

// Reproduce the production order: old seated heading -> real rule bind ->
// scene body heading -> relative head look -> full rig update -> skinned face.
// A wrist-only local-Z assertion missed a torso still facing its previous seat
// while the head had turned 180 degrees to look in the authoritative direction.
for(const [variant,file] of cases)test(`${variant}: full rule/scene/rig chain puts both hands behind the visible face and around the actual post`,async()=>{
 const round=new ClassroomRound({seed:73}),actor=createRiggedStudent(await loadGeometry(file),{variant,seated:false}),record=new T.Group();record.add(actor.group);round.start();const pupil=round.students[2],post=DETENTION[2];let time=0,heading=null;
 actor.setMotion({seated:false,restraint:'free'});for(let i=0;i<60;i++)actor.update(time+=1/60);actor.group.updateMatrixWorld(true);
 const faceSamples=[];
 actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const j=mesh.skeleton.bones.indexOf(actor.bones.Head),{position,skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let i=0;i<position.count;i++){let w=0;for(let k=0;k<4;k++)if(skinIndex.getComponent(i,k)===j)w+=skinWeight.getComponent(i,k);if(w<.8)continue;const p=V().fromBufferAttribute(position,i);mesh.applyBoneTransform(i,p);actor.group.worldToLocal(mesh.localToWorld(p));if(p.z>.13&&p.y>1.3)faceSamples.push({mesh,index:i});}
 });assert.ok(faceSamples.length>20,'measure the actual protruding face mesh');
 const facePoint=()=>{const center=V();for(const {mesh,index}of faceSamples){const p=V().fromBufferAttribute(mesh.geometry.attributes.position,index);mesh.applyBoneTransform(index,p);center.add(mesh.localToWorld(p));}return center.multiplyScalar(1/faceSamples.length);};
 function renderState(state,seconds){const s=state.students.find(s=>s.id===pupil.id),started=time;for(let i=0;i<Math.round(seconds*60);i++){time+=1/60;heading=sampleActorHeading(heading,s,time,captureBodyYaw(s,state));record.position.set(s.x,s.captivity==='bound'?.2:0,s.z);record.rotation.y=heading.yaw;record.updateMatrixWorld(true);actor.setMood('resting');actor.setMotion({seated:s.seated,speed:0,carrying:false,restraint:s.captivity,restraintStartedAt:started,lookYaw:captureHeadLook(s,heading.yaw).yaw,lookPitch:captureHeadLook(s,heading.yaw).pitch});actor.update(time);}record.updateMatrixWorld(true);actor.group.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}
 renderState(round.snapshot(),1);assert.equal(heading.yaw,0);
 round.teacher.x=pupil.x;round.teacher.z=pupil.z+.9;round._stun(pupil);round._grab(pupil);round.teacher.x=post.x;round.teacher.z=post.z-1.1;assert.equal(round._bind(post.id),true);renderState(round.snapshot(),2);
 const head=actor.bones.Head.getWorldPosition(V()),forward=facePoint().sub(head);forward.y=0;forward.normalize();const away=V(pupil.x-post.x,0,pupil.z-post.z).normalize();assert.ok(forward.dot(away)>.98,'visible face must point away from its wooden post');
 for(const side of ['Left','Right']){const wrist=actor.bones[side+'Hand'].getWorldPosition(V());assert.ok(wrist.clone().sub(head).dot(forward)<-.28,'wrist appears in front of the actual visible face');const finger=actor.bones[side+'HandMiddle3'].getWorldPosition(V());assert.ok(finger.clone().sub(V(post.x,finger.y,post.z)).dot(forward)<.025,'fingers must reach around the sides of the actual wood, not an assumed local axis');assert.ok(Math.hypot(finger.x-post.x,finger.z-post.z)>.085,'fingers buried in wood');}
 const held=sampleActorHeading(heading,{...pupil,yaw:0},time+1/60,captureBodyYaw(pupil,round.snapshot()));assert.ok(Math.abs(Math.atan2(Math.sin(held.yaw-Math.PI),Math.cos(held.yaw-Math.PI)))<1e-6,'mouse head turn changes bound body alignment');
 actor.dispose();
});

for(const [variant,file]of cases)test(`${variant}: actual head/hair and finger skin clear the tapered wood throughout bound struggle and camera turns`,async()=>{
 const actor=createRiggedStudent(await loadGeometry(file),{variant,seated:false});let time=0;
 const samples={head:[],digits:[]};
 actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let i=0;i<position.count;i++){let head=0,digits=0;for(let j=0;j<4;j++){const name=mesh.skeleton.bones[skinIndex.getComponent(i,j)]?.name||'',w=skinWeight.getComponent(i,j);if(/(Head|Neck)$/.test(name))head+=w;if(/Hand(Index|Middle|Pinky)/.test(name))digits+=w;}if(head>.5)samples.head.push({mesh,i});if(digits>.5)samples.digits.push({mesh,i});}
 });
 assert.ok(samples.head.length>1000&&samples.digits.length>100,'use original skinned geometry');
 const shape={head:Infinity,digits:Infinity,contact:Infinity};
 for(const [yaw,pitch]of [[0,0],[Math.PI,-1],[1,.7],[-1,0],[0,0]]){
  const look=captureHeadLook({captivity:'bound',yaw,pitch},0);actor.setMotion({seated:false,restraint:'bound',lookYaw:look.yaw,lookPitch:look.pitch});
  for(let i=0;i<120;i++){
   actor.update(time+=1/60);if(i<65||i%10)continue;actor.group.updateMatrixWorld(true);actor.group.traverse(m=>{if(m.isSkinnedMesh)m.skeleton.update();});
   for(const [kind,list]of Object.entries(samples)){let nearest=Infinity;for(const {mesh,i}of list){const p=V().fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,p);actor.group.worldToLocal(mesh.localToWorld(p));
    // The formal scene lifts a bound pupil 20cm and uses a tapered cylinder:
    // bottom radius .10m, top .085m, height 2.06m.
    const radius=.10-.015*Math.max(0,Math.min(1,(p.y+.20)/2.06));nearest=Math.min(nearest,Math.hypot(p.x,p.z+.39)-radius);
   }shape[kind]=Math.min(shape[kind],nearest);if(kind==='digits')shape.contact=Math.max(shape.contact===Infinity?0:shape.contact,nearest);}
  }
 }
 assert.ok(shape.head>.005,`${variant} hair enters post: ${shape.head}m`);
 assert.ok(shape.digits>-.002,`${variant} finger skin enters wood: ${shape.digits}m`);
 assert.ok(shape.contact<.03,`${variant} hands float away from wood: ${shape.contact}m`);
 actor.dispose();
});
