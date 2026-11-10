import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {STUDENT_ASSETS,createRiggedStudent} from '../dist/student-assets.js';
import {loadPropAssets,CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-65';
import {createDeskItem} from '../dist/game-actors.js?v=campus-65';

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



const names={banana:'curved-banana',bananaPeel:'banana-peel',garlic:'garlic-clove',gum:'bubblegum-wrapper',lunch:'teacher-lunchbox',pen:'red-school-pen'},result={};
function trianglesFor(prop){const triangles=[],inverse=prop.matrixWorld.clone().invert();prop.traverse(m=>{if(!m.isMesh)return;const matrix=inverse.clone().multiply(m.matrixWorld),p=m.geometry.attributes.position,index=m.geometry.index;for(let i=0;i<(index?.count||p.count);i+=3)triangles.push(new T.Triangle(...[0,1,2].map(k=>V().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(matrix))));});return triangles;}
for(const[variant,{file}]of Object.entries(STUDENT_ASSETS)){result[variant]={};for(const[kind,name]of Object.entries(names)){
 const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true});actor.setMood(kind);actor.setMotion({carrying:true});for(let i=0;i<180;i++)actor.update(i/60);actor.group.updateMatrixWorld(true);actor.group.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
 const prop=actor.group.getObjectByName(name),tips=['Index','Thumb'].map(f=>prop.parent.worldToLocal(fingertip(actor,f))),triangles=trianglesFor(prop),out=V(),testPoint=V(),rotation=new T.Quaternion();
 const distance=(tip)=>{let d=Infinity;for(const tr of triangles){tr.closestPointToPoint(tip,out);d=Math.min(d,tip.distanceToSquared(out));}return d;};
 const measure=(a)=>{rotation.setFromEuler(new T.Euler(a[3],a[4],a[5])).invert();let sum=0;for(const tip of tips){testPoint.copy(tip).sub(V(a[0],a[1],a[2])).applyQuaternion(rotation);sum+=distance(testPoint);}return sum;};
 let current=[...prop.position.toArray(),prop.rotation.x,prop.rotation.y,prop.rotation.z],cost=measure(current);
 for(const[step,ang]of [[.03,.7],[.015,.35],[.008,.18],[.004,.09],[.002,.045],[.001,.022]])for(let turn=0;turn<4;turn++){let improved=false;for(let d=0;d<6;d++){for(const sign of [-1,1]){const next=[...current];next[d]+=sign*(d<3?step:ang);const n=measure(next);if(n<cost){current=next;cost=n;improved=true;}}}if(!improved)break;}
 const localTips=tips.map(p=>p.clone().sub(V(...current.slice(0,3))).applyQuaternion(new T.Quaternion().setFromEuler(new T.Euler(...current.slice(3))).invert()));result[variant][kind]=[current.slice(0,3).map(n=>+n.toFixed(6)),current.slice(3).map(n=>+n.toFixed(6))];console.log(variant,kind,localTips.map(p=>Math.sqrt(distance(p)).toFixed(4)).join(','));actor.dispose();
 }}
await (await import('node:fs/promises')).writeFile('/tmp/campus50-new-grips.json',JSON.stringify(result,null,2));
