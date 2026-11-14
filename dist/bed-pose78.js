import * as T from './vendor/three.module.js';
import {createFingerRig,handFrame} from './hand-motion.js?v=campus-82';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Q=()=>new T.Quaternion();

// A separate bed pose, evaluated after desk, walk and size retargeting.
// It restores every modified bone before the next mixer update. No bone length
// changes, seated animation reuse, or edits to the user's first-person clips.
export function createBedPose(group,bones,variant='boy'){
 const rest=new Map(Object.values(bones).map(b=>[b,{q:b.quaternion.clone(),p:b.position.clone()}]));
 const saved=new Map(),fingers=Object.fromEntries(['Left','Right'].map(s=>[s,createFingerRig(group,bones,s)]));
 let weight=0;
 function save(b){if(b&&!saved.has(b))saved.set(b,{q:b.quaternion.clone(),p:b.position.clone()});}
 function aim(b,child,target){
  if(!b||!child)return;const origin=b.getWorldPosition(V()),from=child.getWorldPosition(V()).sub(origin).normalize(),to=target.clone().sub(origin).normalize(),parent=b.parent.getWorldQuaternion(Q());
  save(b);b.quaternion.premultiply(parent.clone().invert().multiply(Q().setFromUnitVectors(from,to)).multiply(parent));group.updateMatrixWorld(true);
 }
 function frame(along,normal){const y=along.clone().normalize(),z=normal.clone().addScaledVector(y,-normal.dot(y)).normalize(),x=V().crossVectors(y,z);return Q().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
 return{
  restore(){for(const[b,p]of saved){b.quaternion.copy(p.q);b.position.copy(p.p);}saved.clear();},
  apply({onBed=false,lying=false,time=0,dt=0,reset=false,carrying=false,using=false}){
   weight=reset?+onBed:T.MathUtils.damp(weight,+onBed,12,dt);if(!onBed){weight=0;return;}
   if(weight>.0001){
    // Remove the 90-degree seated hip/knee bends, writing wrists and head look.
    for(const[b,r]of rest){if(carrying&&/RightHand(?:Thumb|Index|Middle|Ring|Pinky)/.test(b.name))continue;save(b);b.quaternion.slerp(r.q,weight);b.position.lerp(r.p,weight);}
    // Side-lying: offset knees mildly, with the upper leg slightly further
    // forward. Both feet follow the shins rather than pointing at the ceiling.
    group.updateMatrixWorld(true);
    for(const side of ['Left','Right']){
     const hip=bones[side+'UpLeg'],knee=bones[side+'Leg'],foot=bones[side+'Foot'],toe=bones[side+'ToeBase'];
     const p=group.worldToLocal(hip.getWorldPosition(V())),upper=side==='Left';
     aim(hip,knee,group.localToWorld(p.add(V(0,-.38,upper?.19:.12))));
     const k=group.worldToLocal(knee.getWorldPosition(V()));
     aim(knee,foot,group.localToWorld(k.add(V(0,-.37,upper?-.16:-.10))));
     if(toe){const a=group.worldToLocal(foot.getWorldPosition(V()));aim(foot,toe,group.localToWorld(a.add(V(0,-.12,.08))));}
    }
    const chest=bones.Spine2;if(chest){save(chest);chest.quaternion.multiply(Q().setFromAxisAngle(V(1,0,0),Math.sin(time*1.45)*.004*weight));}
   }
   group.updateMatrixWorld(true);
   // Rest the lower shoulder on the mattress and support the head sideways
   // on the pillow; bend around the anatomical front axis, not bone-local X.
   const neckAngle={boy:-.755,glasses:-.735,girl:-.95,ponytail:-.715}[variant]??-.755;
   for(const name of ['Neck','Head']){const b=bones[name];if(!b)continue;save(b);const parent=b.parent.getWorldQuaternion(Q()),axis=V(0,0,1).applyQuaternion(group.getWorldQuaternion(Q()));b.quaternion.premultiply(parent.clone().invert().multiply(Q().setFromAxisAngle(axis,neckAngle*.5*weight)).multiply(parent));group.updateMatrixWorld(true);}
   for(const side of ['Left','Right']){
    const sign=side==='Left'?1:-1,arm=bones[side+'Arm'],elbow=bones[side+'ForeArm'],hand=bones[side+'Hand'];
    const shoulder=group.worldToLocal(arm.getWorldPosition(V())),hip=group.worldToLocal(bones.Hips.getWorldPosition(V()));
    // Forearms rest together in front of the chest in a relaxed side pose.
    // Awake and asleep share this same reclining body pose.
    const ep=V(sign*.17,shoulder.y-.19,.23),hp=side==='Right'&&carrying&&using?V(-.06,hip.y+.45,.42):V(side==='Left'?.12:-.10,hip.y+.35,.37);
    aim(arm,elbow,group.localToWorld(ep));aim(elbow,hand,group.localToWorld(hp));
    const current=handFrame(bones,side);if(current){
     const world=group.getWorldQuaternion(Q()),desired=frame(V(0,.45,1).applyQuaternion(world),V(sign,0,0).applyQuaternion(world)),delta=desired.multiply(frame(current.along,current.normal).invert()),parent=hand.parent.getWorldQuaternion(Q());save(hand);hand.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
    }
    for(const d of carrying&&side==='Right'?[]:fingers[side].digits){save(d.bone);d.bone.quaternion.copy(d.rest).multiply(Q().setFromAxisAngle(d.axis,d.finger==='Thumb'?.18:[.17,.24,.16][d.n-1]));}
   }
   group.updateMatrixWorld(true);
  },
  diagnostics:()=>({lyingWeight:weight})
 };
}
