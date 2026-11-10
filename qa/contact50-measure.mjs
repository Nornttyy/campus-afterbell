import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {STUDENT_ASSETS,createRiggedStudent} from '../dist/student-assets.js';
import {loadPropAssets,CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-64';
import {createDeskItem} from '../dist/game-actors.js?v=campus-64';

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


const names={banana:'curved-banana',bananaPeel:'banana-peel',garlic:'garlic-clove',gum:'bubblegum-wrapper',lunch:'teacher-lunchbox',pen:'red-school-pen'};for(const[variant,{file}]of Object.entries(STUDENT_ASSETS)){for(const[kind,name]of Object.entries(names)){const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true});actor.setMood(kind);actor.setMotion({carrying:true});for(let i=0;i<180;i++)actor.update(i/60);actor.group.updateMatrixWorld(true);actor.group.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});const prop=actor.group.getObjectByName(name);console.log(variant,kind,['Index','Thumb'].map(f=>surfaceDistance(prop,fingertip(actor,f)).toFixed(3)).join(','));actor.dispose();}}
