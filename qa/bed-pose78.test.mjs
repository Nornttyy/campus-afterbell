import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {dormBodyOffset,DORM_BEDS} from '../dist/dorm-layout70.js';
const V=()=>new T.Vector3();
function weightedBounds(group,pattern){const box=new T.Box3();group.updateMatrixWorld(true);group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;for(let i=0;i<indices.count;i++){let w=0;for(let j=0;j<4;j++)if(pattern.test(mesh.skeleton.bones[indices.getComponent(i,j)].name))w+=weights.getComponent(i,j);if(w>.8)box.expandByPoint(mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld));}});return box;}
for(const[variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: real side-lying mesh contacts pillow/mattress and waking stays reclined`,async()=>{
 const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:false}),pivot=new T.Group();pivot.add(actor.group);const lengths=Object.values(actor.bones).map(b=>[b,b.position.clone()]);let t=0;
 for(const level of[0,1]){const support=DORM_BEDS[level].supportHeight,o=dormBodyOffset(0,true,variant);pivot.position.set(o.x,support+o.y,o.z);pivot.rotation.set(o.pitch,0,o.roll,'YXZ');actor.setMotion({onBed:true,lying:true,sleeping:true,seated:false,speed:0});for(let i=0;i<120;i++)actor.update(t+=1/60);
  const head=weightedBounds(actor.group,/Head/),back=weightedBounds(actor.group,/Leg|ForeArm/);
  assert.ok(head.min.y>=support+.085&&head.min.y<=support+.12,`pillow contact ${head.min.y-support}`);
  assert.ok(back.min.y>=support-.015&&back.min.y<=support+.035,`supporting leg/elbow is floating or inside mattress: ${back.min.y-support}`);
  assert.ok(head.min.x>-1.12&&head.max.x<-.2,'head remains at pillow end');
  for(const side of['Left','Right']){const hip=actor.bones[side+'UpLeg'].getWorldPosition(V()),knee=actor.bones[side+'Leg'].getWorldPosition(V()),ankle=actor.bones[side+'Foot'].getWorldPosition(V());assert.ok(knee.clone().sub(hip).normalize().dot(ankle.clone().sub(knee).normalize())>.55,'knees retained a seated bend');}
  const facing=new T.Vector3(0,0,1).applyQuaternion(pivot.quaternion);assert.ok(Math.abs(facing.y)<1e-6,'side lying must face horizontally');
  const before=Object.values(actor.bones).map(b=>[b,b.quaternion.clone()]);actor.setMotion({onBed:true,lying:true,sleeping:false,seated:false,speed:0});actor.update(t);for(const[b,q]of before)assert.ok(b.quaternion.clone().normalize().angleTo(q.normalize())<1e-6,'waking changed the body pose: '+b.name);
 }
 actor.setMotion({onBed:false,seated:false,sleeping:false,speed:0});for(let i=0;i<180;i++)actor.update(t+=1/60);for(const[b,p]of lengths)assert.ok(b.position.distanceTo(p)<1e-6,'bed pose changed a bone length');assert.ok(actor.bones.Head.position.length()>0);assert.equal(actor.diagnostics().bed.lyingWeight,0);actor.dispose();
});
