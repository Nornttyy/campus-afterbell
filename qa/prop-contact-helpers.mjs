import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {propSurface} from './whole-palm-geometry54.mjs';
const V=(...a)=>new T.Vector3(...a);
const surfaces=new WeakMap();
// A curled finger contacts through its distal skin pad, not necessarily the
// single furthest vertex along the parent joint's axis (often its outer back).
// Inspect every vertex dominated by the distal bone, including blended skin.
export function fingerPadSurfaceDistance(prop,actor,finger,side='Left'){
 const bone=actor.bones[side+'Hand'+finger+'3'];assert.ok(bone,'distal finger bone missing');
 prop.updateWorldMatrix(true,true);let surface=surfaces.get(prop);if(!surface){surface=propSurface(prop);surfaces.set(prop,surface);}const inverse=prop.matrixWorld.clone().invert();let closest=Infinity,count=0;
 actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const wanted=mesh.skeleton.bones.indexOf(bone);if(wanted<0)return;const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<indices.count;i++){let index=-1,maximum=-1;for(let j=0;j<4;j++)if(weights.getComponent(i,j)>maximum){maximum=weights.getComponent(i,j);index=indices.getComponent(i,j);}if(index!==wanted)continue;
   const world=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld),local=world.clone().applyMatrix4(inverse),q=surface.query(local);closest=Math.min(closest,q.point.clone().applyMatrix4(prop.matrixWorld).distanceTo(world));count++;
  }
 });assert.ok(count,'actual distal finger skin missing');return closest;
}
export function fingertip(actor,finger,side='Left'){
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
export function surfaceDistance(prop,worldPoint){
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
