import * as T from './vendor/three.module.js';
export const STUDY_BOOK_POSE=Object.freeze({position:[0,1.04,.39],rotation:[.90,0,0]});
// Hands and held pages share this small breathing motion, so neither slides
// against the other. It never resizes the source book.
export function studyBookPose(time=0){const breath=Math.sin(time*1.35);return{position:[0,1.04+.002*breath,.39],rotation:[.90+.006*breath,0,0]};}

// The held copy reuses this seat's real paper/cover geometry and material.
// Instanced source meshes are intentionally invisible; the held copy is not
// part of that instancing batch and must restore their original visibility.
export function createStudyBook(group){
 const holder=new T.Group();holder.name='held-study-book';holder.visible=false;group.add(holder);
 let source=null,copy=null,blend=0;
 const rest=new T.Vector3(0,.88,.50),raised=new T.Vector3(...STUDY_BOOK_POSE.position);
 const flat=new T.Quaternion().setFromEuler(new T.Euler(Math.PI/2,0,0)),upright=new T.Quaternion().setFromEuler(new T.Euler(...STUDY_BOOK_POSE.rotation));
 return {
  setSource(next){if(!next||next===source)return;source=next;if(copy)holder.remove(copy);copy=next.clone(true);copy.name='held-original-desk-book';copy.position.set(0,0,0);copy.quaternion.identity();copy.scale.set(1,1,1);copy.matrixAutoUpdate=true;copy.visible=true;copy.traverse(o=>{if(o.userData.rigidInstanceSource){o.visible=true;delete o.userData.rigidInstanceSource;}});holder.add(copy);},
  update(enabled,dt,reset=false,time=0){
   if(!enabled&&(reset||blend===0)){blend=0;holder.visible=false;return;}
   const pose=studyBookPose(time);raised.fromArray(pose.position);upright.setFromEuler(new T.Euler(...pose.rotation));
   blend=reset?Number(enabled):T.MathUtils.damp(blend,Number(enabled),6,dt);
   if(source&&source.parent){source.updateWorldMatrix(true,false);group.updateWorldMatrix(true,false);rest.copy(group.worldToLocal(source.getWorldPosition(new T.Vector3())));flat.copy(group.getWorldQuaternion(new T.Quaternion()).invert().multiply(source.getWorldQuaternion(new T.Quaternion())));}
   holder.position.copy(rest).lerp(raised,blend);holder.quaternion.copy(flat).slerp(upright,blend);holder.visible=Boolean(copy)&&(enabled||blend>.002);if(!holder.visible)blend=0;
  },
  clear(){blend=0;holder.visible=false;},
  visible:()=>holder.visible,
  diagnostics:()=>({visible:holder.visible,blend,source:Boolean(source),position:holder.position.toArray()}),
  dispose(){holder.removeFromParent();}
 };
}
