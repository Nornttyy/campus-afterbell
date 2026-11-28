import {HAND_ANIMATION_MAX_BYTES,validateHandAnimationDocument,sampleHandAnimationClip} from './hand-animation-data59.js?v=campus-111';
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
export async function saveCurrentHandAnimation(id,clip,storage=defaultStorage()){
 // Load the published base only for a first single-clip save. Keep a prior
 // explicit partial import authoritative and read the latest edits after await.
 const initial=loadHandAnimations(storage);
 const base=initial||(await import('./published-hand-animations61.js?v=campus-83')).PUBLISHED_HAND_ANIMATIONS;
 const latest=loadHandAnimations(storage)||base;
 return saveHandAnimations({...latest,clips:{...latest.clips,[id]:clip}},storage);
}
export function clearHandAnimations(storage=defaultStorage()){try{storage?.removeItem(HAND_ANIMATION_STORAGE_KEY);}catch{throw new Error('无法清除已保存动画');}signal();}
function blocked(s){return Boolean(s.freeLook===false||s.seated||s.carrying||s.holding||s.eating||s.penWriting||s.penTwirling||s.caught||s.computer||s.computerActive||s.bookAmount>0||s.bookRaised||s.drawerOpen||s.surveillance||s.writing||s.carryingStudent||s.throwing||s.teacherPhase&& !['patrolling','watching','idle','moving','chasing'].includes(s.teacherPhase)||s.captivity&&s.captivity!=='free');}
export function selectHandAnimationClip(state={}){
 if(state.role==='student'&&state.carrying&&!state.seated&&!state.holding&&!state.eating&&!state.caught&&!state.computer&&(!state.captivity||state.captivity==='free')){
  return selectHandAnimationClip({...state,carrying:false,drawerOpen:false});
 }
 if(state.foodItem&&state.role==='student'&&state.carrying&&!state.caught&&(!state.captivity||state.captivity==='free')&&!state.computer&&!state.bookAmount)return state.eating?'student-eat-food':'student-carry-food';
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
 // Match copies of the published clips too. An edited clip keeps its exact editor coordinates.
 const stockStanding=new WeakMap();
 function identifyStandingClips(){
  for(const id of ['student-idle','student-walk','teacher-idle','teacher-walk']){
   const clip=document?.clips[id],base=fallback?.clips[id];
   if(!clip||!base||(clip!==base&&JSON.stringify(clip)!==JSON.stringify(base)))continue;
   // The submitted walk has a slightly different wrist angle at its endpoints.
   // Close only the playback copy so the next stride starts at the same pose.
   const frames=clip.keyframes;
   const loop=id.endsWith('-walk')&&clip.loop&&frames.length>1
    ?{...clip,keyframes:[...frames.slice(0,-1),{...frames[0],time:frames.at(-1).time}]}:clip;
   stockStanding.set(clip,loop);
  }
 }
 identifyStandingClips();
 const reset=()=>{activeId=activeClip=null;clipTime=weight=0;lastTime=null;lastPose=transitionPose=null;transitionAge=0;};
 // A saved edit transitions from the pose actually on screen. Clearing or
 // rejecting a corrupt file restores the published default, if present.
 const reload=()=>{document=readDocument();identifyStandingClips();return document;};
 const onStorage=e=>{if(!e||e.key==null||e.key===HAND_ANIMATION_STORAGE_KEY)reload();};eventTarget?.addEventListener?.('storage',onStorage);eventTarget?.addEventListener?.(HAND_ANIMATION_CHANGE_EVENT,reload);
 return{
  reload,getDocument:()=>document?JSON.parse(JSON.stringify(document)):null,
  sample(state={},time=0){if(disposed)return null;const now=Number.isFinite(time)?time:0,dt=lastTime===null?0:Math.max(0,Math.min(.1,now-lastTime));if(lastTime!==null&&now<lastTime)reset();lastTime=now;const requested=selectHandAnimationClip(state),clip=requested&&document?.clips[requested];
   if(blocked(state)&&!clip){reset();lastTime=now;return null;}
   if(clip){if(activeId!==requested||activeClip!==clip){transitionPose=lastPose;transitionAge=0;activeId=requested;activeClip=clip;clipTime=0;}else clipTime+=dt;weight=Math.min(1,weight+dt/Math.max(.001,fadeDuration));}
   else weight=Math.max(0,weight-dt/Math.max(.001,fadeDuration));
   if(!activeClip||weight<=0){if(!clip)reset();lastTime=now;return null;}
   const standing=stockStanding.has(activeClip)&&Number.isFinite(state.walkPhase)&&!state.carrying;
   const walking=activeId.endsWith('-walk');
   const cycle=(state.walkPhase||0)*.82/(2*Math.PI);
   const sampleTime=standing&&walking?(cycle-Math.floor(cycle))*activeClip.duration:
    activeClip.loop?clipTime%activeClip.duration:Math.min(clipTime,activeClip.duration);
   let sampled=sampleHandAnimationClip(standing?stockStanding.get(activeClip):activeClip,sampleTime);
   if(standing){
    // Fit the editor's metre-long stride to a first-person view. At the front
    // of each step the fingers enter frame; on the return the wrist drops below it.
    const teacher=activeId.startsWith('teacher-'),stride=walking?Math.min(1,state.movement):0;
    const stridePose=sampled;
    const rest=fallback.clips[teacher?'teacher-idle':'student-idle']?.keyframes[0];
    if(walking&&rest){
     sampled=sampleHandAnimationClip({duration:1,keyframes:[rest,{...stridePose,time:1}]},stride*.58);
    }
    for(const side of ['left','right']){
     const hand=sampled[side];
     const sign=side==='left'?-1:1;
     const reach=Math.max(0,Math.min(1,(.44-stridePose[side].position[2])/(teacher?1.44:1.30)));
     const swing=(2*reach-1)*stride;
     if(walking)hand.curl+=stride*(teacher?.20:.10)*(.6+.4*reach);
     hand.position=[sign*((teacher?.225:.202)-.023*swing),
      (teacher?-.401:-.358)+(teacher?.089:.066)*swing-.024*stride*(1-swing*swing),
      -.52-(teacher?.115:.092)*swing];
    }
   }
   if(transitionPose){const duration=Math.max(.001,fadeDuration);sampled=sampleHandAnimationClip({duration,easing:'smoothstep',keyframes:[{time:0,...transitionPose},{time:duration,...sampled}]},transitionAge);transitionAge+=dt;if(transitionAge>=duration)transitionPose=null;}
   lastPose=sampled;return{...sampled,weight,source:'runtime',clipId:activeId,originalUpright:stockStanding.has(activeClip)&&activeId.startsWith('student-')};
  },
  dispose(){disposed=true;eventTarget?.removeEventListener?.('storage',onStorage);eventTarget?.removeEventListener?.(HAND_ANIMATION_CHANGE_EVENT,reload);reset();}
 };
}
