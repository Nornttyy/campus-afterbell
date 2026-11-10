import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {STUDENT_ASSETS,createRiggedStudent} from '../dist/student-assets.js';
import {loadPropAssets,CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-64';
import {createDeskItem} from '../dist/game-actors.js?v=campus-64';
import {fingerPadSurfaceDistance} from './prop-contact-helpers.mjs';

const V=(...a)=>new T.Vector3(...a);
await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:{loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())}});

// Use the real skinned fingertip, rather than testing a configured anchor
// against itself. The final phalanx direction selects its outermost tip.
function fingertip(actor,finger,side='Left'){
 const bone=actor.bones[side+'Hand'+finger+'3'],origin=bone.getWorldPosition(V());
 const axis=origin.clone().sub(bone.parent.getWorldPosition(V())).normalize();
 let maximum=-Infinity,tip=null;
 actor.group.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const boneIndex=mesh.skeleton.bones.indexOf(bone);if(boneIndex<0)return;
  const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<indices.count;i++){
   let weight=0;for(let j=0;j<4;j++)if(indices.getComponent(i,j)===boneIndex)weight+=weights.getComponent(i,j);
   if(weight<.3)continue;
   const p=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld),distance=p.clone().sub(origin).dot(axis);
   if(distance>maximum){maximum=distance;tip=p;}
  }
 });
 assert.ok(tip,'actual fingertip vertices missing');return tip;
}
function surfaceDistance(prop,worldPoint){
 let squared=Infinity;
 prop.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const point=mesh.worldToLocal(worldPoint.clone()),{position}=mesh.geometry.attributes,index=mesh.geometry.index;
  const a=V(),b=V(),c=V(),q=V(),triangle=new T.Triangle(a,b,c);
  for(let i=0;i<(index?.count||position.count);i+=3){
   a.fromBufferAttribute(position,index?index.getX(i):i);
   b.fromBufferAttribute(position,index?index.getX(i+1):i+1);
   c.fromBufferAttribute(position,index?index.getX(i+2):i+2);
   triangle.closestPointToPoint(point,q);mesh.localToWorld(q);squared=Math.min(squared,q.distanceToSquared(worldPoint));
  }
 });
 return Math.sqrt(squared);
}

for(const [variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: new user model actually touches every held prop without resizing it`,async()=>{
 for(const kind of ['snack','drink','burger','ink','smoke','flash','phone']){
  const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true});actor.setMood(kind);actor.setMotion({carrying:true});
  for(let i=0;i<180;i++)actor.update(i/60);
  actor.group.updateMatrixWorld(true);actor.group.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
  const side='left',anchor=actor.getHand(side);
  let prop=anchor.children.find(o=>o.visible&&(o.userData.propAsset||['smoke-canister','flash-perforated-canister'].includes(o.name)));
  if(['phone'].includes(kind)){prop=createDeskItem(kind);const attachment=anchor.userData.attachments[kind];prop.position.fromArray(attachment.position);prop.rotation.fromArray(attachment.rotation);anchor.add(prop);actor.group.updateMatrixWorld(true);}
  assert.ok(prop,`${kind} never appears`);
  const position=prop.position.clone(),rotation=prop.quaternion.clone();
  for(const finger of ['Index','Thumb'])assert.ok(fingerPadSurfaceDistance(prop,actor,finger,side==='left'?'Left':'Right')<.012,`${variant} ${kind} ${finger}: distal-skin contact gap exceeds 12 mm`);
  assert.deepEqual(prop.scale.toArray(),[1,1,1],'Fit must not resize the imported item');
  for(let i=180;i<210;i++){actor.update(i/60);assert.ok(prop.position.distanceTo(position)<1e-8);assert.ok(prop.quaternion.angleTo(rotation)<1e-7);}
  actor.dispose();
 }
});

for(const variant of ['boy','girl'])for(const kind of ['snack','drink','burger','ink']){
 test(`${variant} ${kind}: replacement retains NPC contact without deforming the mesh or changing the clip`,async()=>{
  const actor=createRiggedStudent(await loadGeometry(`student-${variant}-v3.glb`),{variant,seated:true});
  actor.setMood(kind);actor.setMotion({carrying:true});for(let i=0;i<200;i++)actor.update(i/60);
  actor.group.updateMatrixWorld(true);actor.group.traverse(mesh=>{if(mesh.isSkinnedMesh)mesh.skeleton.update();});
  const prop=actor.getHand('left').children.find(child=>child.visible&&child.userData.propAsset);assert.ok(prop);
  const fitted=prop.position.clone(),quaternion=prop.quaternion.clone();
  const tips=['Index','Thumb'].map(finger=>fingertip(actor,finger));
  const fittedGap=tips.reduce((sum,p)=>sum+surfaceDistance(prop,p),0)/tips.length;
  prop.position.set(0,kind==='burger'?.047:kind==='ink'?.061:.065,kind==='ink'?-.028:-.035);
  actor.group.updateMatrixWorld(true);
  const oldOffsetGap=tips.reduce((sum,p)=>sum+surfaceDistance(prop,p),0)/tips.length;
  assert.ok(fittedGap<=oldOffsetGap+.002,`fitting increases actual finger gap: ${fittedGap} vs ${oldOffsetGap}`);
  assert.deepEqual(prop.scale.toArray(),[1,1,1]);assert.ok(prop.quaternion.angleTo(quaternion)<1e-7);
  prop.position.copy(fitted);
  for(let i=200;i<240;i++){actor.update(i/60);assert.ok(prop.position.distanceTo(fitted)<1e-8,'prop slides inside the palm during animation');}
  actor.dispose();
 });
}
