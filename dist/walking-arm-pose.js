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
  apply({run=0,weight=0,seated=false,crawling=false,restraint='free',mood='resting',carrying=false,walkTime=0,cycleDuration=1,teacher=false,jumpHeight=0}={}){
   if(seated||crawling||restraint!=='free'||mood==='rescuing'||(weight<.00001&&jumpHeight<=0))return;
   group.updateMatrixWorld(true);
   group.getWorldQuaternion(character);
   if(jumpHeight>0){
    const lift=T.MathUtils.smoothstep(jumpHeight,0,.55);
    for(const [side,lead] of [['Left',.83],['Right',1]]){
     rotate(bones[side+'UpLeg'],1,0,0,-.39*lift*lead);
     rotate(bones[side+'Leg'],1,0,0,.65*lift*lead);
     rotate(bones[side+'Foot'],1,0,0,-.20*lift);
     if(!carrying)rotate(bones[side+'ForeArm'],1,0,0,-.23*lift);
    }
    weight*=1-lift;
   }
   // Allow the free elbow to pass the widest part of each student's jacket.
   const degrees=teacher?0:group.userData.character==='ponytail'?21:group.userData.character==='glasses'?22:17;
   const blend=T.MathUtils.clamp(weight,0,1),angle=degrees*Math.PI/180*blend;
   const phase=walkTime/Math.max(.001,cycleDuration)*Math.PI*2;
   for(const [side,sign]of [['Left',1],['Right',-1]]){
    const step=Math.cos(phase)*sign;
    if(run>0){
     rotate(bones[side+'UpLeg'],1,0,0,-.28*step*run*blend);
     rotate(bones[side+'Leg'],1,0,0,.44*Math.max(0,-step)*run*blend);
     if(!carrying||side==='Right'){
      rotate(bones[side+'Arm'],1,0,0,.28*step*run*blend);
      rotate(bones[side+'ForeArm'],1,0,0,-.55*run*blend);
     }
    }
    // The working hand keeps its prop contact; only the other arm swings.
    if(carrying&&side==='Left')continue;
    const ph=phase+(side==='Right'?Math.PI:0);
    // Clearance is widest as the elbow passes the jacket; ahead of the
    // torso the arm can swing closer to the body's direction of travel.
    const travel=Math.cos(ph);
    rotate(bones[side+'Arm'],0,0,1,sign*angle*(1-.14*travel*travel));
    rotate(bones[side+'Arm'],1,0,0,(teacher?.12:group.userData.character==='glasses'?.25:.18)*travel*blend);
    // The elbow folds as the hand comes forward, then relaxes behind the hip.
    // A delayed wrist follows that arc instead of holding a rigid palm.
    rotate(bones[side+'ForeArm'],1,0,0,-.23*(.5-.5*Math.cos(ph-.43))*blend);
    rotate(bones[side+'Hand'],1,0,0,.055*Math.sin(ph-.55)*blend);
   }
   group.updateMatrixWorld(true);
  }
 };
}
