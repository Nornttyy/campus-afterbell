import {createHandAnimationDocument} from './hand-animation-data59.js?v=campus-62';
import {HAND_ANIMATION_BASELINE} from './hand-animation-baseline59.js?v=campus-62';
import {completeAnimationDocument} from './animation-editor-state59.js?v=campus-62';

// Only untouched legacy motion is removed during the v1 → v2 draft migration.
// Duration/easing edits survive. Any authored hand pose, finger, or key timing
// preserves the entire clip so a user's work is never silently discarded.
function untouchedLegacy(clip,base){
 if(!base||clip.keyframes.length!==base.keyframes.length)return false;
 const near=(a,b)=>Math.abs(a-b)<1e-6;
 return clip.keyframes.every((frame,i)=>{
  const old=base.keyframes[i];if(!near(frame.time/clip.duration,old.time/base.duration))return false;
  return ['left','right'].every(side=>{
   const a=frame[side],b=old[side];return !a.fingers&&near(a.curl,b.curl)&&['position','rotation'].every(k=>a[k].every((n,j)=>near(n,b[k][j])));
  });
 });
}
export function prepareAnimationEditorDocument(saved,{legacy=false}={}){
 const defaults=createHandAnimationDocument(),document=saved?completeAnimationDocument(saved,defaults):defaults,cleared=[];
 if(legacy)for(const [id,clip]of Object.entries(document.clips))if(untouchedLegacy(clip,HAND_ANIMATION_BASELINE[id])){
  document.clips[id]={...clip,keyframes:defaults.clips[id].keyframes};cleared.push(id);
 }
 return{document,cleared};
}
