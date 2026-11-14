import * as T from './vendor/three.module.js';
import {STUDENT_PROPORTIONS} from './student-proportions73.js?v=campus-82';
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
// Retarget the accepted pose to a shorter body. Keep the furniture and held
// objects in physical units, and preserve the calibrated arm and palm/finger size.
// Source meshes/clips are not rewritten; first-person user clips are separate.
export function createStudentSize(group,model,bones){
 const factor=STUDENT_PROPORTIONS.height/STUDENT_PROPORTIONS.sourceHeight;
 const sourceScale=model.scale.clone(),sourcePosition=model.position.clone(),saved=new Map();let seatedBlend=0;
 const spinePosition=bones.Spine.position.clone();
 const armRoots=['LeftArm','RightArm'].map(n=>bones[n]),armScales=armRoots.map(b=>b.scale.clone());
 function save(b){if(!saved.has(b))saved.set(b,b.quaternion.clone());}
 function aim(a,b,target){const from=b.getWorldPosition(V()).sub(a.getWorldPosition(V())).normalize(),to=target.clone().sub(a.getWorldPosition(V())).normalize(),parent=a.parent.getWorldQuaternion(Q()),turn=Q().setFromUnitVectors(from,to);save(a);a.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));a.updateWorldMatrix(false,true);}
 function limb(a,b,end,target,rotation){
  const origin=a.getWorldPosition(V()),middle=b.getWorldPosition(V()),tip=end.getWorldPosition(V()),upper=origin.distanceTo(middle),lower=middle.distanceTo(tip),direction=target.clone().sub(origin),distance=T.MathUtils.clamp(direction.length(),Math.abs(upper-lower)+.001,upper+lower-.001);direction.normalize();
  const bend=middle.clone().sub(origin).addScaledVector(direction,-middle.clone().sub(origin).dot(direction));if(bend.lengthSq()<1e-8)bend.set(0,0,1).applyQuaternion(group.getWorldQuaternion(Q())).addScaledVector(direction,-direction.z);bend.normalize();
  const along=(upper*upper+distance*distance-lower*lower)/(2*distance),rise=Math.sqrt(Math.max(0,upper*upper-along*along));save(end);aim(a,b,origin.clone().addScaledVector(direction,along).addScaledVector(bend,rise));aim(b,end,origin.addScaledVector(direction,distance));end.quaternion.copy(end.parent.getWorldQuaternion(Q()).invert().multiply(rotation));end.updateWorldMatrix(false,true);
 }
 return {
  restore(){for(const [b,q] of saved)b.quaternion.copy(q);saved.clear();bones.Spine.position.copy(spinePosition);model.scale.copy(sourceScale);model.position.copy(sourcePosition);armRoots.forEach((b,i)=>b.scale.copy(armScales[i]));},
  apply({seated,crawling,restraint,dt,reset,tableSupport=true,pairedHands=false}){
   seatedBlend=reset?(seated?1:0):T.MathUtils.damp(seatedBlend,seated?1:0,10,dt);
   group.updateMatrixWorld(true);
   const support={};for(const side of ['Left','Right'])for(const part of ['Hand','Foot']){const b=bones[side+part];if(b)support[side+part]={position:group.worldToLocal(b.getWorldPosition(V())),rotation:b.getWorldQuaternion(Q())};}
   const pivot=group.worldToLocal(bones[restraint==='carried'?'Neck':'Hips'].getWorldPosition(V()));
   const anchorY=restraint==='carried'?pivot.y:pivot.y*seatedBlend;
   model.scale.copy(sourceScale).multiplyScalar(factor);model.position.copy(sourcePosition);model.position.y+=anchorY*(1-factor);
   armRoots.forEach((b,i)=>b.scale.copy(armScales[i]).multiplyScalar(1/factor));group.updateMatrixWorld(true);
   // Raise the seated chest slightly without moving the pelvis off the chair.
   // A small forward lean keeps the existing tabletop contacts within reach;
   // elbows solve to those exact contacts without stretching either limb.
   if(tableSupport&&seatedBlend>.001&&restraint==='free'){
    const spine=bones.Spine;
    const lift=new T.Vector3(0,.05*seatedBlend,0).applyQuaternion(group.getWorldQuaternion(Q()));
    spine.position.copy(spine.parent.worldToLocal(spine.getWorldPosition(V()).add(lift)));spine.updateWorldMatrix(false,true);
    const headRotation=bones.Head.getWorldQuaternion(Q()),world=group.getWorldQuaternion(Q()),parent=spine.parent.getWorldQuaternion(Q()),turn=Q().setFromAxisAngle(new T.Vector3(1,0,0).applyQuaternion(world),.11*seatedBlend);
    save(spine);spine.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));spine.updateWorldMatrix(false,true);
    save(bones.Head);bones.Head.quaternion.copy(bones.Head.parent.getWorldQuaternion(Q()).invert().multiply(headRotation));bones.Head.updateWorldMatrix(false,true);
   }
   for(const side of ['Left','Right']){
    if(restraint==='free'){
     const foot=support[side+'Foot'],target=foot.position.clone();target.x*=factor;target.z*=factor;
     limb(bones[side+'UpLeg'],bones[side+'Leg'],bones[side+'Foot'],group.localToWorld(target),foot.rotation);
    }
    const hand=support[side+'Hand'];
    if(((tableSupport||pairedHands||side==='Right')&&seatedBlend>.001)||crawling||restraint==='bound'){
     const current=group.worldToLocal(bones[side+'Hand'].getWorldPosition(V())),weight=crawling||restraint==='bound'?1:seatedBlend;
     current.lerp(hand.position,weight);limb(bones[side+'Arm'],bones[side+'ForeArm'],bones[side+'Hand'],group.localToWorld(current),hand.rotation);
    }
   }
  },
  diagnostics:()=>({height:STUDENT_PROPORTIONS.height,factor,seatedBlend})
 };
}
