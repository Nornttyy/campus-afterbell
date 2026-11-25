import * as T from './vendor/three.module.js';
// One half of the opened book is a page block plus its bound outer cover.
export const BOOK_PAPER_FACE=.0092,BOOK_COVER_FACE=.0113;
export const bookSpineHeight=angle=>.875+BOOK_COVER_FACE*Math.sin(angle);
export const writingPageY=x=>bookSpineHeight(Math.PI/2)+BOOK_PAPER_FACE/Math.cos(.14)+Math.abs(x)*Math.tan(.14);
export const STUDY_BOOK_POSE=Object.freeze({position:Object.freeze([0,bookSpineHeight(0),.50]),rotation:Object.freeze([0,0,0])});
export function studyBookPose(){
 return STUDY_BOOK_POSE;
}

// The held copy reuses this seat's real paper/cover geometry and material.
// Instanced source meshes are intentionally invisible; the held copy is not
// part of that instancing batch and must restore their original visibility.
export function createStudyBook(group){
 const holder=new T.Group();holder.name='held-study-book';holder.visible=false;group.add(holder);
 let source=null,copy=null,blend=0,contact=0;
 const parentRotation=new T.Quaternion(),xAxis=new T.Vector3(1,0,0),up=new T.Vector3(),fold=new T.Quaternion();
 return {
  setSource(next){if(next===source)return;source=next;if(copy)holder.remove(copy);copy=null;blend=contact=0;holder.visible=false;if(!next)return;copy=next.clone(true);copy.name='held-original-desk-book';copy.position.set(0,0,0);copy.quaternion.identity();copy.scale.set(1,1,1);copy.matrixAutoUpdate=true;copy.visible=true;copy.traverse(o=>{if(o.userData.rigidInstanceSource){o.visible=true;delete o.userData.rigidInstanceSource;}});holder.add(copy);},
  update(enabled,dt,reset=false){
   if(!copy||(!enabled&&contact===0&&blend===0))return;
   // Reach the cover, lift it, return it to the desk, then release the grip.
   // The same pose drives both the real book and the arm IK, including when
   // a network mood update interrupts a lift halfway through.
   let remaining=Math.max(0,Math.min(.25,dt));
   if(reset){contact=blend=Number(enabled);}
   else if(enabled){const reach=Math.min(remaining,(1-contact)*.35);contact=Math.min(1,contact+reach/.35);remaining-=reach;if(contact>=1-1e-8){contact=1;blend=Math.min(1,blend+remaining/.55);}}
   else {const lower=Math.min(remaining,blend*.55);blend=Math.max(0,blend-lower/.55);remaining-=lower;if(blend<1e-8){blend=0;contact=Math.max(0,contact-remaining/.25);}}
   const eased=blend*blend*(3-2*blend);
   const currentAngle=source.rotation.x,angle=currentAngle*(1-eased);
   source.getWorldPosition(holder.position);
   source.getWorldQuaternion(holder.quaternion);
   // Rotate about the desk spine in the desk's coordinate system. The book
   // stays on the same desk when a seated pupil turns or changes posture.
   holder.quaternion.multiply(fold.setFromAxisAngle(xAxis,-currentAngle));
   up.set(0,1,0).applyQuaternion(holder.quaternion);
   holder.position.addScaledVector(up,bookSpineHeight(angle)-bookSpineHeight(currentAngle));
   group.worldToLocal(holder.position);
   holder.quaternion.multiply(fold.setFromAxisAngle(xAxis,angle));
   holder.quaternion.premultiply(group.getWorldQuaternion(parentRotation).invert());
   holder.visible=contact>0;
  },
  pose:()=>({position:holder.position.toArray(),quaternion:holder.quaternion.toArray(),contact,blend,active:contact>0}),
  clear(){blend=contact=0;holder.visible=false;},
  visible:()=>holder.visible,
  diagnostics:()=>({visible:holder.visible,blend,contact,source:Boolean(source),position:holder.position.toArray()}),
  dispose(){holder.removeFromParent();}
 };
}
