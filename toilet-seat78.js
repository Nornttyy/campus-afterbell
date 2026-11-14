import * as T from './vendor/three.module.js';
import {handFrame} from './hand-motion.js?v=campus-80';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Q=()=>new T.Quaternion();
// Toilet support differs from the school chair. Keep feet on the floor and
// hands on the knees instead of using the invisible desktop as a support.
export function createToiletSeatPose(group,bones,variant){
 const saved=new Map();
 function save(b){if(!saved.has(b))saved.set(b,{q:b.quaternion.clone(),p:b.position.clone()});}
 function aim(a,b,target){const origin=a.getWorldPosition(V()),from=b.getWorldPosition(V()).sub(origin).normalize(),to=target.clone().sub(origin).normalize(),parent=a.parent.getWorldQuaternion(Q());save(a);a.quaternion.premultiply(parent.clone().invert().multiply(Q().setFromUnitVectors(from,to)).multiply(parent));a.updateWorldMatrix(false,true);}
 function limb(a,b,end,target,bend,rotation){
  const origin=a.getWorldPosition(V()),middle=b.getWorldPosition(V()),tip=end.getWorldPosition(V()),u=origin.distanceTo(middle),l=middle.distanceTo(tip),dir=target.clone().sub(origin),d=T.MathUtils.clamp(dir.length(),Math.abs(u-l)+.001,u+l-.001);dir.normalize();bend=bend.clone().addScaledVector(dir,-bend.dot(dir)).normalize();const along=(u*u+d*d-l*l)/(2*d),rise=Math.sqrt(Math.max(0,u*u-along*along));aim(a,b,origin.clone().addScaledVector(dir,along).addScaledVector(bend,rise));aim(b,end,origin.addScaledVector(dir,d));save(end);end.quaternion.copy(end.parent.getWorldQuaternion(Q()).invert().multiply(rotation));end.updateWorldMatrix(false,true);
 }
 function frame(along,normal){const y=along.clone().normalize(),z=normal.clone().addScaledVector(y,-normal.dot(y)).normalize(),x=V().crossVectors(y,z);return Q().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
 return{
  restore(){for(const[b,s]of saved){b.quaternion.copy(s.q);b.position.copy(s.p);}saved.clear();},
  apply({active=false,carrying=false}){
   if(!active)return;group.updateMatrixWorld(true);const world=group.getWorldQuaternion(Q()),feet={};
   for(const side of ['Left','Right']){const b=bones[side+'Foot'];feet[side]={p:b.getWorldPosition(V()).add(V(0,-({boy:.043,girl:.037,glasses:.044,ponytail:.035}[variant]??.04),.245).applyQuaternion(world)),q:b.getWorldQuaternion(Q())};}
   const hips=bones.Hips,delta={boy:.045,girl:.052,glasses:.06,ponytail:.037}[variant]??.045,p=hips.getWorldPosition(V()).add(V(0,delta,.22).applyQuaternion(world));save(hips);hips.position.copy(hips.parent.worldToLocal(p));hips.updateWorldMatrix(false,true);
   for(const side of ['Left','Right']){
    const foot=feet[side];limb(bones[side+'UpLeg'],bones[side+'Leg'],bones[side+'Foot'],foot.p,V(0,0,1).applyQuaternion(world),foot.q);
    // Preserve the complete fitted grip when carrying a prop.
    if(carrying)continue;
    const arm=bones[side+'Arm'],fore=bones[side+'ForeArm'],hand=bones[side+'Hand'],knee=group.worldToLocal(bones[side+'Leg'].getWorldPosition(V())),h=group.worldToLocal(hips.getWorldPosition(V())),sign=side==='Left'?1:-1;
    const current=handFrame(bones,side),desired=frame(V(0,-.15,1).applyQuaternion(world),V(0,1,0).applyQuaternion(world)),rotation=current?desired.multiply(frame(current.along,current.normal).invert()).multiply(hand.getWorldQuaternion(Q())):hand.getWorldQuaternion(Q());
    limb(arm,fore,hand,group.localToWorld(V(sign*.17,knee.y+.12,knee.z-.06)),V(sign,.05,-.30).applyQuaternion(world),rotation);
   }
   group.updateMatrixWorld(true);
  }
 };
}
