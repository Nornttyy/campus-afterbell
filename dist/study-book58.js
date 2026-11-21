import * as T from './vendor/three.module.js';
export const STUDY_BOOK_POSE=Object.freeze({position:[0,.80,.34],rotation:[.58,0,0]});
// Hands and held pages share this small breathing motion, so neither slides
// against the other. It never resizes the source book.
export function studyBookPose(time=0){
 const breath=Math.sin(time*1.35),{position:[x,y,z],rotation:[tilt]}=STUDY_BOOK_POSE;
 return{position:[x,y+.002*breath,z],rotation:[tilt+.006*breath,0,0]};
}

// The held copy reuses this seat's real paper/cover geometry and material.
// Instanced source meshes are intentionally invisible; the held copy is not
// part of that instancing batch and must restore their original visibility.
export function createStudyBook(group){
 const holder=new T.Group();holder.name='held-study-book';holder.visible=false;group.add(holder);
 let source=null,copy=null,blend=0,contact=0;
 const rest=new T.Vector3(0,.88,.50),raised=new T.Vector3(...STUDY_BOOK_POSE.position);
 const flat=new T.Quaternion().setFromEuler(new T.Euler(Math.PI/2,0,0)),upright=new T.Quaternion().setFromEuler(new T.Euler(...STUDY_BOOK_POSE.rotation));
 const parentRotation=new T.Quaternion(),readingTilt=new T.Euler();
 return {
  setSource(next){if(next===source)return;source=next;if(copy)holder.remove(copy);copy=null;blend=contact=0;holder.visible=false;if(!next)return;copy=next.clone(true);copy.name='held-original-desk-book';copy.position.set(0,0,0);copy.quaternion.identity();copy.scale.set(1,1,1);copy.matrixAutoUpdate=true;copy.visible=true;copy.traverse(o=>{if(o.userData.rigidInstanceSource){o.visible=true;delete o.userData.rigidInstanceSource;}});holder.add(copy);},
  update(enabled,dt,reset=false,time=0){
   if(!copy||(!enabled&&contact===0&&blend===0))return;
   // Reach the cover, lift it, return it to the desk, then release the grip.
   // The same pose drives both the real book and the arm IK, including when
   // a network mood update interrupts a lift halfway through.
   let remaining=Math.max(0,Math.min(.25,dt));
   if(reset){contact=blend=Number(enabled);}
   else if(enabled){const reach=Math.min(remaining,(1-contact)*.35);contact=Math.min(1,contact+reach/.35);remaining-=reach;if(contact>=1-1e-8){contact=1;blend=Math.min(1,blend+remaining/.55);}}
   else {const lower=Math.min(remaining,blend*.55);blend=Math.max(0,blend-lower/.55);remaining-=lower;if(blend<1e-8){blend=0;contact=Math.max(0,contact-remaining/.25);}}
   const pose=studyBookPose(time);raised.fromArray(pose.position);upright.setFromEuler(readingTilt.set(...pose.rotation));
   // Only the lift and return need the desk's current transform. The held
   // endpoint already lives in the student's coordinates.
   if(blend<1&&source.parent){
    source.getWorldPosition(rest);group.worldToLocal(rest);
    source.getWorldQuaternion(flat);flat.premultiply(group.getWorldQuaternion(parentRotation).invert());
   }
   const eased=blend*blend*(3-2*blend);
   holder.position.copy(rest).lerp(raised,eased);holder.quaternion.copy(flat).slerp(upright,eased);holder.visible=contact>0;
  },
  pose:()=>({position:holder.position.toArray(),quaternion:holder.quaternion.toArray(),contact,blend,active:contact>0}),
  clear(){blend=contact=0;holder.visible=false;},
  visible:()=>holder.visible,
  diagnostics:()=>({visible:holder.visible,blend,contact,source:Boolean(source),position:holder.position.toArray()}),
  dispose(){holder.removeFromParent();}
 };
}
