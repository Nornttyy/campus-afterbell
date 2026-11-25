import * as T from './vendor/three.module.js';
// One half of the opened book is a page block plus its bound outer cover.
export const BOOK_PAPER_FACE=.0092,BOOK_COVER_FACE=.0113;
const readingDistance=.698;
export const TEXTBOOK=Object.freeze({leafWidth:.296,leafHeight:.395,seatDistance:readingDistance,flatSeatDistance:.405,deskInset:.78-readingDistance,leafYaw:.14,readingTilt:.025});
export const bookAngle=raised=>T.MathUtils.lerp(Math.PI/2,TEXTBOOK.readingTilt,T.MathUtils.clamp(raised,0,1));
// A reader props the book farther across the desk than a writer lays it flat.
export function setDeskBookReach(book,raised){
 const shift=raised?0:TEXTBOOK.flatSeatDistance-TEXTBOOK.seatDistance;
 const delta=shift-(book.userData.studyReachOffset??0);
 if(delta){
  book.position.x+=Math.sin(book.rotation.y)*delta;
  book.position.z+=Math.cos(book.rotation.y)*delta;
 }
 book.userData.studyReachOffset=shift;
}
export const bookSpineHeight=angle=>.875+Math.max(BOOK_COVER_FACE*Math.sin(angle),-(TEXTBOOK.leafWidth*Math.sin(TEXTBOOK.leafYaw)+BOOK_PAPER_FACE)*Math.sin(angle));
export const writingPageY=x=>bookSpineHeight(Math.PI/2)+BOOK_PAPER_FACE/Math.cos(TEXTBOOK.leafYaw)+Math.abs(x)*Math.tan(TEXTBOOK.leafYaw);
export const STUDY_BOOK_POSE=Object.freeze({position:Object.freeze([0,bookSpineHeight(TEXTBOOK.readingTilt),TEXTBOOK.seatDistance]),rotation:Object.freeze([TEXTBOOK.readingTilt,0,0])});
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
  update(enabled){
   if(!copy||(!enabled&&contact===0&&blend===0))return;
   contact=blend=Number(enabled);
   const currentAngle=source.rotation.x,angle=enabled?TEXTBOOK.readingTilt:currentAngle;
   source.getWorldPosition(holder.position);
   source.getWorldQuaternion(holder.quaternion);
   // Rotate about the desk spine in the desk's coordinate system. The book
   // stays on the same desk when a seated pupil turns or changes posture.
   holder.quaternion.multiply(fold.setFromAxisAngle(xAxis,-currentAngle));
   const reachOffset=source.userData.studyReachOffset||0;
   if(enabled&&reachOffset)holder.position.addScaledVector(up.set(0,0,1).applyQuaternion(holder.quaternion),-reachOffset);
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
