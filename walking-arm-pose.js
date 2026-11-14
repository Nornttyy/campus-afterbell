import * as T from './vendor/three.module.js';

// Enlarge the existing gait in its own phase. Rotate real shoulder, elbow and
// wrist joints; keep the original foot timing and limb lengths.
export function createWalkingArmPose(group,bones){
 const saved=new Map(),axis=new T.Vector3(),parent=new T.Quaternion(),turn=new T.Quaternion(),character=new T.Quaternion();
 function rotate(bone,x,y,z,angle){
  if(!bone||Math.abs(angle)<.000001)return;
  if(!saved.has(bone))saved.set(bone,bone.quaternion.clone());
  axis.set(x,y,z).applyQuaternion(character);bone.parent.getWorldQuaternion(parent);
  turn.setFromAxisAngle(axis,angle);
  bone.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));
  bone.updateWorldMatrix(false,true);
 }
 return {
  restore(){for(const [bone,q] of saved)bone.quaternion.copy(q);saved.clear();},
  apply({weight=0,seated=false,crawling=false,restraint='free',mood='resting',carrying=false,walkTime=0,cycleDuration=1,teacher=false}={}){
   if(seated||crawling||restraint!=='free'||mood==='rescuing'||weight<.00001)return;
   group.updateMatrixWorld(true);
   group.getWorldQuaternion(character);
   // The ponytail student's jacket is wider below the sleeve. Give that
   // model two extra degrees of clearance, without widening every student.
   const degrees=teacher?0:group.userData.character==='ponytail'?18:group.userData.character==='glasses'?20:16;
   const blend=T.MathUtils.clamp(weight,0,1),angle=degrees*Math.PI/180*blend;
   const phase=walkTime/Math.max(.001,cycleDuration)*Math.PI*2;
   for(const [side,sign]of [['Left',1],['Right',-1]]){
    // The working hand keeps its prop contact; only the other arm swings.
    if(carrying&&side==='Left')continue;
    const ph=phase+(side==='Right'?Math.PI:0);
    rotate(bones[side+'Arm'],0,0,1,sign*angle);
    rotate(bones[side+'Arm'],1,0,0,.24*Math.cos(ph)*blend);
    // The elbow folds as the hand comes forward, then relaxes behind the hip.
    // A delayed wrist follows that arc instead of holding a rigid palm.
    rotate(bones[side+'ForeArm'],1,0,0,-.20*(.5-.5*Math.cos(ph-.30))*blend);
    rotate(bones[side+'Hand'],1,0,0,.055*Math.sin(ph-.55)*blend);
   }
   group.updateMatrixWorld(true);
  }
 };
}
