import * as T from './vendor/three.module.js';

// Exact linear skinning for a fixed contact vertex. Move the unchanging bind
// transforms to setup; keep every weight and evaluate the current bone pose.
// This avoids rebuilding every bone matrix for each finger contact/IK pass.
export function createSkinContact(mesh,index){
 const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
 const point=new T.Vector3().fromBufferAttribute(position,index).applyMatrix4(mesh.bindMatrix),influences=[];
 for(let i=0;i<4;i++){
  const weight=skinWeight.getComponent(index,i);if(!weight)continue;
  const joint=skinIndex.getComponent(index,i);
  influences.push({bone:mesh.skeleton.bones[joint],weight,point:point.clone().applyMatrix4(mesh.skeleton.boneInverses[joint])});
 }
 const scratch=new T.Vector3();
 return target=>{
  // Morphing geometry needs the engine's full path; current contact meshes
  // have no morph targets, but do not silently ignore them if later added.
  if(mesh.morphTargetInfluences?.some(v=>v!==0))return mesh.getVertexPosition(index,target).applyMatrix4(mesh.matrixWorld);
  target.set(0,0,0);
  for(const influence of influences)target.addScaledVector(scratch.copy(influence.point).applyMatrix4(influence.bone.matrixWorld),influence.weight);
  return target.applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(mesh.matrixWorld);
 };
}
