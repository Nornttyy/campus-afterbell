import {HAND_ANIMATION_MAX_BYTES,validateHandAnimationDocument,sampleHandAnimationClip} from './hand-animation-data59.js?v=campus-64';
export const HAND_ANIMATION_STORAGE_KEY='campus.handAnimations.v1';
export const HAND_ANIMATION_CHANGE_EVENT='campus:hand-animations-changed';
function defaultStorage(){try{return globalThis.localStorage||null;}catch{return null;}}
function defaultEvents(){return typeof window==='object'?window:null;}
function signal(){const target=defaultEvents();if(target&&typeof Event==='function')target.dispatchEvent(new Event(HAND_ANIMATION_CHANGE_EVENT));}
export function loadHandAnimations(storage=defaultStorage()){
 try{const text=storage?.getItem(HAND_ANIMATION_STORAGE_KEY);if(!text||text.length>HAND_ANIMATION_MAX_BYTES)return null;const result=validateHandAnimationDocument(JSON.parse(text));return result.ok?result.value:null;}catch{return null;}
}
export function saveHandAnimations(value,storage=defaultStorage()){
 const result=validateHandAnimationDocument(value);if(!result.ok)throw new Error(result.errors[0]);const text=JSON.stringify(result.value);if(text.length>HAND_ANIMATION_MAX_BYTES)throw new Error('动画文件过大');if(!storage?.setItem)throw new Error('浏览器无法保存，请先导出动画文件');
 try{storage.setItem(HAND_ANIMATION_STORAGE_KEY,text);}catch{throw new Error('浏览器存储空间不足，请先导出动画文件');}signal();return result.value;
}
export function clearHandAnimations(storage=defaultStorage()){try{storage?.removeItem(HAND_ANIMATION_STORAGE_KEY);}catch{throw new Error('无法清除已保存动画');}signal();}
function blocked(s){return Boolean(s.freeLook===false||s.seated||s.carrying||s.holding||s.eating||s.penWriting||s.penTwirling||s.caught||s.computer||s.computerActive||s.bookAmount>0||s.bookRaised||s.drawerOpen||s.surveillance||s.writing||s.carryingStudent||s.throwing||s.teacherPhase&& !['patrolling','watching','idle','moving','chasing'].includes(s.teacherPhase)||s.captivity&&s.captivity!=='free');}
export function selectHandAnimationClip(state={}){
 if(blocked(state))return null;
 const teacher=state.role==='teacher',moving=state.movement>.01,crawling=state.crawlBlend>.5||state.crouched||state.crawling;
 if(crawling)return teacher?null:moving?'student-crawl':'student-crawl-idle';
 // Keep the prone pose while the body rises; a
 // standing idle must never pull the hands up during that transition.
 if(!moving)return state.crawlBlend>.01?null:teacher?'teacher-idle':'student-idle';
 return teacher?'teacher-walk':'student-walk';
}
export function createHandAnimationRuntime({storage=defaultStorage(),eventTarget=defaultEvents(),fadeDuration=.14,fallbackDocument=null}={}){
 // Published clips are a read-only game default. An explicitly saved local
 // document still owns its entire clip selection; never overwrite drafts.
 const checkedFallback=validateHandAnimationDocument(fallbackDocument),fallback=checkedFallback.ok?checkedFallback.value:null;
 const readDocument=()=>loadHandAnimations(storage)||fallback;
 let document=readDocument(),activeId=null,activeClip=null,clipTime=0,lastTime=null,weight=0,disposed=false,lastPose=null,transitionPose=null,transitionAge=0;
 const reset=()=>{activeId=activeClip=null;clipTime=weight=0;lastTime=null;lastPose=transitionPose=null;transitionAge=0;};
 // A saved edit transitions from the pose actually on screen. Clearing or
 // rejecting a corrupt file restores the published default, if present.
 const reload=()=>{document=readDocument();return document;};
 const onStorage=e=>{if(!e||e.key==null||e.key===HAND_ANIMATION_STORAGE_KEY)reload();};eventTarget?.addEventListener?.('storage',onStorage);eventTarget?.addEventListener?.(HAND_ANIMATION_CHANGE_EVENT,reload);
 return{
  reload,getDocument:()=>document?JSON.parse(JSON.stringify(document)):null,
  sample(state={},time=0){if(disposed)return null;const now=Number.isFinite(time)?time:0,dt=lastTime===null?0:Math.max(0,Math.min(.1,now-lastTime));if(lastTime!==null&&now<lastTime)reset();lastTime=now;if(blocked(state)){reset();lastTime=now;return null;}
   const requested=selectHandAnimationClip(state),clip=requested&&document?.clips[requested];
   if(clip){if(activeId!==requested||activeClip!==clip){transitionPose=lastPose;transitionAge=0;activeId=requested;activeClip=clip;clipTime=0;}else clipTime+=dt;weight=Math.min(1,weight+dt/Math.max(.001,fadeDuration));}
   else weight=Math.max(0,weight-dt/Math.max(.001,fadeDuration));
   if(!activeClip||weight<=0){if(!clip)reset();lastTime=now;return null;}
   let sampled=sampleHandAnimationClip(activeClip,activeClip.loop?clipTime%activeClip.duration:Math.min(clipTime,activeClip.duration));
   if(transitionPose){const duration=Math.max(.001,fadeDuration);sampled=sampleHandAnimationClip({duration,easing:'smoothstep',keyframes:[{time:0,...transitionPose},{time:duration,...sampled}]},transitionAge);transitionAge+=dt;if(transitionAge>=duration)transitionPose=null;}
   lastPose=sampled;return{...sampled,weight,source:'runtime',clipId:activeId};
  },
  dispose(){disposed=true;eventTarget?.removeEventListener?.('storage',onStorage);eventTarget?.removeEventListener?.(HAND_ANIMATION_CHANGE_EVENT,reload);reset();}
 };
}
