import * as T from './vendor/three.module.js';
const V=()=>new T.Vector3();

// One actual skinned fingertip, chosen once from the imported weights. Pen
// posing reads this cached vertex instead of traversing a character per frame.
export function createPenFingerContact(group,bones,{side='Right',finger='Index'}={}){
 const bone=bones[side+'Hand'+finger+'3'];group.updateMatrixWorld(true);
 const origin=bone.getWorldPosition(V()),axis=origin.clone().sub(bone.parent.getWorldPosition(V())).normalize();
 let chosen=null,best=-Infinity;
 group.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const bi=mesh.skeleton.bones.indexOf(bone);if(bi<0)return;
  const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;mesh.skeleton.update();
  for(let i=0;i<indices.count;i++){
   let w=0;for(let j=0;j<4;j++)if(indices.getComponent(i,j)===bi)w+=weights.getComponent(i,j);
   if(w<.3)continue;
   const score=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).sub(origin).dot(axis);
   if(score>best){best=score;chosen={mesh,i};}
  }
 });
 return ()=>{if(!chosen)return bone.getWorldPosition(V());chosen.mesh.skeleton.update();return chosen.mesh.getVertexPosition(chosen.i,V()).applyMatrix4(chosen.mesh.matrixWorld);};
}

export function penTwirlQuaternion(time){return new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),time*Math.PI*2/1.6);}
