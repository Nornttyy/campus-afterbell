import * as T from './vendor/three.module.js';
import {barById,toiletBowl} from './map-activities77.js?v=campus-78';
import {createFingerRig,handFrame} from './hand-motion.js?v=campus-78';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Q=()=>new T.Quaternion();
export function activityHandTargets(activity){
 if(!activity)return null;
 if(activity.kind==='hang'){const b=barById(activity.id);return b?{Left:V(b.x-.025,b.height-.115,b.z-.23),Right:V(b.x-.025,b.height-.115,b.z+.23)}:null;}
 const b=toiletBowl(activity.id);if(!b)return null;
 const h=.86+.065*Math.sin(activity.age*Math.PI*4);
 return{Left:V(b.x-.035,h,b.z+.05),Right:V(b.x+.035,h-.105,b.z+.05)};
}
function frameQuaternion(along,dorsal){const y=along.clone().normalize(),z=dorsal.clone().addScaledVector(y,-dorsal.dot(y)).normalize(),x=V().crossVectors(y,z);return Q().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
export function createMapActivityPose(group,bones){
 const saved=new Map(),positions=new Map(),rigs=Object.fromEntries(['Left','Right'].map(s=>[s,createFingerRig(group,bones,s)]));
 const save=b=>{if(b&&!saved.has(b))saved.set(b,b.quaternion.clone());};
 function aim(b,child,target){if(!b||!child)return;const from=b.getWorldPosition(V()),a=child.getWorldPosition(V()).sub(from).normalize(),delta=Q().setFromUnitVectors(a,target.clone().sub(from).normalize()),parent=b.parent.getWorldQuaternion(Q());save(b);b.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));group.updateMatrixWorld(true);}
 function reach(side,target){
  const arm=bones[side+'Arm'],fore=bones[side+'ForeArm'],hand=bones[side+'Hand'];if(!arm||!fore||!hand)return;
  const origin=arm.getWorldPosition(V()),span=origin.distanceTo(fore.getWorldPosition(V()))+fore.getWorldPosition(V()).distanceTo(hand.getWorldPosition(V())),reachScale=T.MathUtils.clamp(origin.distanceTo(target)/Math.max(.01,span)+.025,1,2.3);
  for(const bone of [fore,hand]){if(!positions.has(bone))positions.set(bone,bone.position.clone());bone.position.multiplyScalar(reachScale);}group.updateMatrixWorld(true);
  const root=arm.getWorldPosition(V()),mid=fore.getWorldPosition(V()),end=hand.getWorldPosition(V()),upper=root.distanceTo(mid),lower=mid.distanceTo(end),dir=target.clone().sub(root),d=T.MathUtils.clamp(dir.length(),Math.abs(upper-lower)+.001,upper+lower-.001);dir.normalize();
  const pole=V(side==='Left'?-.6:.6,0,-1).applyQuaternion(group.getWorldQuaternion(Q()));pole.addScaledVector(dir,-pole.dot(dir)).normalize();const along=(upper*upper+d*d-lower*lower)/(2*d),rise=Math.sqrt(Math.max(0,upper*upper-along*along));
  aim(arm,fore,root.clone().addScaledVector(dir,along).addScaledVector(pole,rise));aim(fore,hand,root.addScaledVector(dir,d));
 }
 return{restore(){for(const[b,q]of saved)b.quaternion.copy(q);saved.clear();for(const[b,p]of positions)b.position.copy(p);positions.clear();},apply(activity){
  const targets=activityHandTargets(activity);if(!targets)return;
  group.updateMatrixWorld(true);
  for(const side of ['Left','Right']){
   reach(side,targets[side]);const hand=bones[side+'Hand'],frame=handFrame(bones,side);if(frame){const along=activity.kind==='hang'?V(0,1,0):V(side==='Left'?1:-1,0,0),dorsal=activity.kind==='hang'?V(-1,0,0):V(0,0,1),delta=frameQuaternion(along,dorsal).multiply(frameQuaternion(frame.along,frame.normal).invert()),parent=hand.parent.getWorldQuaternion(Q());save(hand);hand.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));}
   for(const digit of rigs[side].digits){save(digit.bone);digit.bone.quaternion.copy(digit.rest).multiply(Q().setFromAxisAngle(digit.axis,digit.finger==='Thumb'?.52:[.65,1.1,.85][digit.n-1]));}
  }
  if(activity.kind==='hang')for(const side of ['Left','Right']){
   const thigh=bones[side+'UpLeg'],shin=bones[side+'Leg'];for(const[b,n]of [[thigh,-.25],[shin,.62]])if(b){save(b);b.quaternion.multiply(Q().setFromAxisAngle(V(1,0,0),n));}
  }
  group.updateMatrixWorld(true);
 }};
}
