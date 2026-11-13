import * as T from './vendor/three.module.js';
import {FIRST_PERSON_PEN_FITS} from './first-person-pen-fit58.js?v=campus-78';
import {createPenFingerContact} from './pen-motion.js?v=campus-78';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Q=()=>new T.Quaternion();
const ease=(t,a,b)=>T.MathUtils.smootherstep(t,a,b);

// A complete use is three seconds. The endpoints have zero velocity, so a
// completed bite returns to the same carry pose before the item is removed.
export function sampleFoodGesture(seconds){
 const t=T.MathUtils.clamp(seconds,0,3),out=1-ease(t,2.12,3);
 const turn=ease(t,0,.45)*out,reach=ease(t,.25,.85)*out;
 const chewing=ease(t,.65,.90)*(1-ease(t,2.20,2.45));
 return {turn,reach,bob:.040*Math.sin((t-.70)*Math.PI*2/.72)*chewing,chewing};
}

// Bounding-box contacts can land inside a curved banana. Fit that authored
// point to its actual triangles once, with a skin-sized outward clearance.
export function fitFirstPersonSurface(prop,point){
 prop.updateMatrixWorld(true);let distance=Infinity,result=point.clone();const inverse=prop.matrixWorld.clone().invert();
 prop.traverse(mesh=>{if(!mesh.isMesh)return;const local=mesh.worldToLocal(prop.localToWorld(point.clone())),p=mesh.geometry.attributes.position,index=mesh.geometry.index,a=V(),b=V(),c=V(),q=V(),triangle=new T.Triangle(a,b,c);
  for(let i=0;i<(index?.count||p.count);i+=3){a.fromBufferAttribute(p,index?index.getX(i):i);b.fromBufferAttribute(p,index?index.getX(i+1):i+1);c.fromBufferAttribute(p,index?index.getX(i+2):i+2);triangle.closestPointToPoint(local,q);const d=q.distanceToSquared(local);if(d<distance){distance=d;const normal=triangle.getNormal(V()).transformDirection(mesh.matrixWorld);result=q.clone().applyMatrix4(mesh.matrixWorld).addScaledVector(normal,.003).applyMatrix4(inverse);}}
 });return result;
}

// Cache the imported chain once. Its original rotations, scale, mesh and
// weights remain intact; neither frame sampling nor posing scans vertices.
export function createFirstPersonHandMotion(hand,side){
 const root=hand.group,bones={};root.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
 const prefix=side<0?'Left':'Right',wrist=bones[prefix+'Hand'],forearm=bones[prefix+'ForeArm'];
 const thumb=bones[prefix+'HandThumb1'],thumbTip=thumb?createPenFingerContact(root,bones,{side:prefix,finger:'Thumb'}):null;
 root.updateMatrixWorld(true);
 const rootQ=root.getWorldQuaternion(Q()),restWristQ=wrist?rootQ.clone().invert().multiply(wrist.getWorldQuaternion(Q())):Q();
 const joints=[forearm,wrist].filter(Boolean).map(bone=>{
  const inverse=bone.getWorldQuaternion(Q()).invert().multiply(rootQ);
  return {bone,rest:bone.quaternion.clone(),axes:[V(1,0,0),V(0,1,0),V(0,0,1)].map(v=>v.applyQuaternion(inverse))};
 });
 const before=new T.Matrix4(),after=new T.Matrix4(),delta=new T.Matrix4(),inverse=new T.Matrix4();
 function frame(out){root.updateWorldMatrix(true,true);return out.copy(wrist?wrist.matrixWorld:root.matrixWorld);}
 function canonical(){return (wrist?wrist.getWorldQuaternion(Q()).multiply(restWristQ.clone().invert()):root.getWorldQuaternion(Q()));}
 function bend(joint,x,y,z){if(!joint)return;joint.bone.quaternion.copy(joint.rest);for(const [i,a]of [x,y,z].entries())joint.bone.quaternion.multiply(Q().setFromAxisAngle(joint.axes[i],a));}
 const twirlFits=Object.entries(FIRST_PERSON_PEN_FITS).filter(([key])=>key.startsWith('twirl')).map(([,fit])=>fit).sort((a,b)=>a.phase-b.phase);
 return {
  fitPen(time,writing,weight=1){
   const phase=((time%1.6)+1.6)%1.6;let right=twirlFits.findIndex(f=>f.phase>phase);if(right<0)right=0;const next=twirlFits[right],previous=twirlFits[(right+twirlFits.length-1)%twirlFits.length];
   const span=(next.phase-previous.phase+1.6)%1.6,offset=(phase-previous.phase+1.6)%1.6,t=span?offset/span:0;
   for(const [name,delta]of Object.entries(FIRST_PERSON_PEN_FITS.write.bones)){
    const bone=bones[name];if(!bone)continue;const a=Q().fromArray(previous.bones[name]||[0,0,0,1]),b=Q().fromArray(next.bones[name]||[0,0,0,1]),fit=a.slerp(b,t).slerp(Q().fromArray(delta),writing);bone.quaternion.multiply(Q().slerp(fit,weight));
   }
  },
  restore(){for(const j of joints)j.bone.quaternion.copy(j.rest);},
  applyAuthoredFingers(pose,weight=1){
   // Scrubbing starts from the source joint frames, never from the preceding
   // preview frame. Keep every bone position/scale and the original skin intact.
   for(const j of joints)j.bone.quaternion.slerp(j.rest,weight);
   const oldCurl=hand.diagnostics?.().curl??.18,curl=oldCurl+(pose.curl-oldCurl)*weight;
   hand.setCurl(curl);
   if(pose.fingers&&hand.setFingerCurl){for(const finger of ['Thumb','Index','Middle','Pinky']){const value=pose.fingers[finger]??pose.curl;hand.setFingerCurl(finger,oldCurl+(value-oldCurl)*weight);}
    const middle=pose.fingers.Middle??pose.curl,pinky=pose.fingers.Pinky??pose.curl;hand.setFingerCurl('Ring',oldCurl+((middle+pinky)/2-oldCurl)*weight);
   }
  },
  aimThumb(target,amount=1){
   if(!thumbTip){hand.aimThumb(target,amount);return;}
   root.updateWorldMatrix(true,true);const origin=thumb.getWorldPosition(V()),from=thumbTip().sub(origin).normalize(),to=root.localToWorld(target.clone()).sub(origin).normalize();
   const change=Q().setFromUnitVectors(from,to),parentQ=thumb.parent.getWorldQuaternion(Q());
   thumb.quaternion.premultiply(parentQ.clone().invert().multiply(Q().slerp(change,amount)).multiply(parentQ));
  },
  pinchThumb(target,amount=1){
   if(!thumbTip)return;
   root.updateWorldMatrix(true,true);const goal=root.localToWorld(target.clone());
   // Solve the real thumb surface around the barrel/page with its own three
   // joints. Rotating only the thumb root aims at it but leaves a visible gap.
   for(let pass=0;pass<7;pass++)for(const n of [3,2,1]){
    const bone=bones[prefix+'HandThumb'+n];if(!bone)continue;
    root.updateWorldMatrix(true,true);const origin=bone.getWorldPosition(V()),from=thumbTip().sub(origin),to=goal.clone().sub(origin);if(from.lengthSq()<1e-8||to.lengthSq()<1e-8)continue;
    const turn=Q().setFromUnitVectors(from.normalize(),to.normalize()),angle=2*Math.acos(Math.min(1,Math.abs(turn.w))),parentQ=bone.parent.getWorldQuaternion(Q());
    const limited=Q().slerp(turn,amount*Math.min(1,.30/Math.max(angle,.00001)));bone.quaternion.premultiply(parentQ.clone().invert().multiply(limited).multiply(parentQ));
   }
  },
  apply({parent,prop=null,food=null,amount=0,movement=0,phase=0,empty=false,palmRoll=0}={}){
   if(!food&&!empty)return;
   parent.updateWorldMatrix(true,true);frame(before);
   const baseCanonical=canonical(),baseWrist=V().setFromMatrixPosition(before),baseProp=prop?.getWorldPosition(V());
   const beat=Math.sin(phase+(side>0?Math.PI:0)),lag=Math.sin(phase+(side>0?Math.PI:0)-.42);
   const turn=(food?.turn||0)*amount,reach=(food?.reach||0)*amount,bob=(food?.bob||0)*amount;
   if(wrist){
    const elbow=joints.find(j=>j.bone===forearm),palm=joints.find(j=>j.bone===wrist);
    bend(elbow,food?.18*reach+bob*.65:.09*beat*movement,food?.65*turn:side*.12*lag*movement,0);
    bend(palm,food?.20*turn+bob*1.4:.10*lag*movement,food?.45*turn:side*.19*lag*movement,food?.035*turn:side*.07*beat*movement);
   }
   // Let the elbow and wrist articulate while the arm's unseen upper part
   // carries the palm to its target. The palm faces the eye, not the floor.
   if(food){
    const bodyQ=parent.parent?.getWorldQuaternion(Q())||Q();
    const target=bodyQ.multiply(Q().setFromEuler(new T.Euler(-.18,Math.PI,-.10+palmRoll)));
    const desired=baseCanonical.clone().slerp(target,turn),current=canonical();
    const parentQ=root.parent.getWorldQuaternion(Q());
    root.quaternion.premultiply(parentQ.clone().invert().multiply(desired.multiply(current.invert())).multiply(parentQ));
   }
   // Keep the wrist on the authored path while its actual forearm bends.
   frame(after);const shift=baseWrist.clone().sub(V().setFromMatrixPosition(after));
   const origin=root.parent.worldToLocal(V()),localShift=root.parent.worldToLocal(shift).sub(origin);root.position.add(localShift);
   frame(after);
   if(prop){
    parent.updateWorldMatrix(true,false);inverse.copy(parent.matrixWorld).invert();
    delta.copy(inverse).multiply(after).multiply(before.clone().invert()).multiply(parent.matrixWorld);
    prop.updateMatrix();delta.multiply(prop.matrix).decompose(prop.position,prop.quaternion,prop.scale);
    // Remove roundoff only. Source dimensions never change during a gesture.
    prop.scale.set(1,1,1);
    if(food&&baseProp){
     // The source forearm is deliberately short. Bringing it nearer keeps
     // its open sleeve below the lower frame while the food reaches centre;
     // moving the same crop upwards at carry depth made a floating cut wrist.
     const anchor=parent.parent,goal=V(-.015,-.145+bob,-.46);if(anchor)anchor.localToWorld(goal);
     const wanted=baseProp.lerp(goal,reach);prop.updateWorldMatrix(true,false);
     const travel=wanted.sub(prop.getWorldPosition(V()));
     const local=parent.worldToLocal(travel).sub(parent.worldToLocal(V()));root.position.add(local);prop.position.add(local);
    }
   }
   root.updateWorldMatrix(true,true);
  },
  diagnostics(){root.updateWorldMatrix(true,true);const palm=V(0,0,-1).applyQuaternion(canonical());return {rigged:Boolean(wrist&&forearm),palm:palm.toArray(),wristAngle:wrist?joints.find(j=>j.bone===wrist).rest.angleTo(wrist.quaternion):0,elbowAngle:forearm?joints.find(j=>j.bone===forearm).rest.angleTo(forearm.quaternion):0};}
 };
}

// Actual uprightBook geometry: two .335 × .45m leaves, each yawed .14rad,
// hinged .50m ahead of the seated eye at desk height .88m. Contacts follow
// that existing fold; there is no duplicate viewmodel book or scaled page.
export function firstPersonBookContacts(side,amount,eyeHeight=1.43){
 const leafSide=-side,leaf=new T.Quaternion().setFromAxisAngle(V(0,1,0),leafSide*.14),fold=new T.Quaternion().setFromAxisAngle(V(1,0,0),(1-T.MathUtils.clamp(amount,0,1))*Math.PI/2);
 const point=(z,edge=.325,height=.19)=>{const p=V(leafSide*edge,height,z).applyQuaternion(leaf).applyQuaternion(fold);return V(-p.x,.88-eyeHeight+p.y,-.50-p.z);};
 const turn=new T.Quaternion().setFromEuler(new T.Euler(-.20,side*.45,-side*1.18));
 return{index:point(.009),thumb:point(-.009,.275,.16),quaternion:turn};
}
