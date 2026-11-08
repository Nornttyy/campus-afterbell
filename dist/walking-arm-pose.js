import * as T from './vendor/three.module.js';

// Keep the authored fore/aft swing, elbow flexion and wrist lag. The extra
// rotation opens each free upper arm about the character's forward axis;
// translating the wrist alone would stretch the limb or snap its elbow.
export function createWalkingArmPose(group,bones){
 const saved=new Map(),axis=new T.Vector3(),parent=new T.Quaternion(),turn=new T.Quaternion();
 return {
  restore(){for(const [bone,q] of saved)bone.quaternion.copy(q);saved.clear();},
  apply({weight=0,seated=false,crawling=false,restraint='free',mood='resting',carrying=false}={}){
   if(seated||crawling||restraint!=='free'||mood==='rescuing'||weight<.00001)return;
   group.updateMatrixWorld(true);
   axis.set(0,0,1).applyQuaternion(group.getWorldQuaternion(new T.Quaternion()));
   // The ponytail student's jacket is wider below the sleeve. Give that
   // model two extra degrees of clearance, without widening every student.
   const degrees=group.userData.character==='ponytail'?28:26;
   const angle=degrees*Math.PI/180*T.MathUtils.clamp(weight,0,1);
   for(const [side,sign]of [['Left',1],['Right',-1]]){
    // The working hand keeps its prop contact; only the other arm swings.
    if(carrying&&side===(mood==='note'?'Right':'Left'))continue;
    const arm=bones[side+'Arm'];if(!arm)continue;
    saved.set(arm,arm.quaternion.clone());
    arm.parent.getWorldQuaternion(parent);
    turn.setFromAxisAngle(axis,sign*angle);
    arm.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));
   }
   group.updateMatrixWorld(true);
  }
 };
}
