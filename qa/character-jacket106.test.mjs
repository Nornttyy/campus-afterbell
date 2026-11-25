import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from '../dist/vendor/three.module.js';
import {repairJacketWeights} from '../dist/character-jacket106.js';
import {loadGeometry} from './gltf-geometry.mjs';

for(const file of ['student-boy-v4','student-girl-v4','student-glasses-v2','student-ponytail-v1','teacher-v2']){
 test(file+' jacket follows torso above waist and retains the original lower-leg weights',async()=>{
  const {scene}=await loadGeometry(file+'.glb');
  scene.updateMatrixWorld(true);
  let mesh;scene.traverse(node=>{if(node.isSkinnedMesh)mesh=node;});
  const {position,uv,skinIndex,skinWeight}=mesh.geometry.attributes;
  const point=new T.Vector3(),bones=mesh.skeleton.bones;
  const hip=bones.find(b=>/Hips$/.test(b.name)).getWorldPosition(point).y;
  const rows=Array.from({length:position.count},(_,i)=>({
   y:point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld).y,
   before:[0,1,2,3].map(j=>[skinIndex.getComponent(i,j),skinWeight.getComponent(i,j)])
  }));
  repairJacketWeights(scene);
  let corrected=0;
  for(const [i,{y,before}] of rows.entries()){
   const after=[0,1,2,3].map(j=>[skinIndex.getComponent(i,j),skinWeight.getComponent(i,j)]);
   const thigh=entries=>entries.reduce((sum,[id,w])=>sum+(/(UpLeg|Leg)$/.test(bones[id].name)?w:0),0);
   if(y<hip-.04)assert.deepEqual(after,before);
   if(y>hip+.055&&thigh(before)>.001){corrected++;assert.ok(thigh(after)<.00011);}
   assert.ok(Math.abs(after.reduce((sum,[,w])=>sum+w,0)-1)<.001);
  }
  assert.ok(corrected>0,'the check samples previously misweighted cloth');
  assert.equal(mesh.geometry.attributes.position,position);assert.equal(mesh.geometry.attributes.uv,uv);
 });
}
