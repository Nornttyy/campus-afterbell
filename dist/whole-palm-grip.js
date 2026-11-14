import * as T from './vendor/three.module.js';
import {createFingerRig,handFrame} from './hand-motion.js?v=campus-83';
import {WHOLE_PALM_PROFILES} from './whole-palm-profiles54.js?v=campus-83';
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();

// The four visible digits wrap around separate actual surface patches. Fits
// are made offline; rendering only blends their real joint rotations.
export function createWholePalmGrip(hand,side){
 const bones={};hand.group.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
 const prefix=side<0?'Left':'Right';if(!bones[prefix+'Hand']||side>0||hand.group.userData.characterRole==='teacher')return{fit:()=>null,apply:()=>false};
 hand.setCurl(0);hand.group.updateMatrixWorld(true);const rig=createFingerRig(hand.group,bones,prefix),frame=handFrame(bones,prefix),chains={};
 for(const finger of ['Index','Middle','Pinky','Thumb','Ring']){const digits=rig.digits.filter(d=>d.finger===finger),inverse=digits[0].bone.getWorldQuaternion(Q()).invert();chains[finger]={digits,spread:frame.normal.clone().applyQuaternion(inverse),opposition:frame.along.clone().applyQuaternion(inverse)};}
 return {
  fit(kind){return WHOLE_PALM_PROFILES[kind]||null;},
  apply(kind,weight=1){const fit=WHOLE_PALM_PROFILES[kind];if(!fit)return false;
   for(const [finger,angles]of Object.entries(fit.profile)){const chain=chains[finger];for(const [i,d]of chain.digits.entries()){const target=d.rest.clone().multiply(Q().setFromAxisAngle(d.axis,angles[i]));if(i===0){target.multiply(Q().setFromAxisAngle(chain.spread,angles[3]||0));if(finger==='Thumb')target.multiply(Q().setFromAxisAngle(chain.opposition,angles[4]||0));}d.bone.quaternion.slerp(target,weight);}}
   return true;
  }
 };
}
