import {Euler,Quaternion} from './vendor/three.module.js';
import {STUDENT_VIEW_HEIGHT,TEACHER_VIEW_HEIGHT} from './camera-height58.js?v=campus-83';
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
 if(state.role==='student'&&state.carrying&&!state.seated&&(!state.holding&&!state.eating||state.foodItem)&&!state.caught&&!state.computer&&(!state.captivity||state.captivity==='free')){
  // The working hand layers its bite onto locomotion. Keep the stride clock
  // running for the empty hand, including while a bite is held or cancelled.
  return selectHandAnimationClip({...state,carrying:false,holding:false,eating:false,drawerOpen:false});
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
// World-space wrist measurements from the standing character rigs (metres).
// Columns: idle half-width, idle height, walking half-width, walking mid-height.
const wristPositions={
 boy:[.20,.66,.29,.69],girl:[.18,.65,.275,.70],
 glasses:[.20,.66,.31,.71],ponytail:[.15,.61,.27,.66],teacher:[.23,1.04,.23,1.075]
};
// Resting wrists and hand-frame corrections measured on both sides of the
// displayed bodies. Detached view hands have different anatomical axes.
const idleMounts={
 boy:{
  left:{position:[-0.20405, -0.87258, -0.02033],rotation:[0.68408, 0.03333, -0.02741, -0.72812]},
  right:{position:[0.20424, -0.87657, -0.02162],rotation:[-0.68408, 0.03334, -0.02741, 0.72812]},
 },
 girl:{
  left:{position:[-0.18443, -0.87508, -0.02894],rotation:[0.68409, 0.03334, -0.02741, -0.72812]},
  right:{position:[0.18469, -0.88063, -0.03074],rotation:[-0.68408, 0.03334, -0.02741, 0.72812]},
 },
 glasses:{
  left:{position:[-0.2017, -0.87158, -0.03126],rotation:[0.68409, 0.03334, -0.02741, -0.72812]},
  right:{position:[0.20166, -0.87061, -0.03094],rotation:[-0.68408, 0.03334, -0.02741, 0.72813]},
 },
 ponytail:{
  left:{position:[-0.14848, -0.92368, -0.02085],rotation:[0.68408, 0.03333, -0.02741, -0.72812]},
  right:{position:[0.1487, -0.92839, -0.02238],rotation:[-0.68408, 0.03333, -0.02741, 0.72812]},
 },
 teacher:{
  left:{position:[-0.23086, -1.19282, -0.0633],rotation:[0.47258, 0.05908, -0.02799, -0.87886]},
  right:{position:[0.23096, -1.19508, -0.06403],rotation:[-0.47258, 0.05908, -0.02799, 0.87886]},
 },
};
const idleEuler=new Euler(),idleRotation=new Quaternion(),mountRotation=new Quaternion();
function placeStandingWrists(pose,id,character){
 const teacher=id.startsWith('teacher'),walking=id.endsWith('-walk');
 if(!walking&&!id.endsWith('-idle')||id.includes('crawl'))return;
 const [,,walkWidth,walkHeight]=teacher?wristPositions.teacher:
   wristPositions[Object.hasOwn(wristPositions,character)&&character!=='teacher'?character:'boy'];
 const eye=teacher?TEACHER_VIEW_HEIGHT:STUDENT_VIEW_HEIGHT;
 // Convert the authored viewmodel sweep to the distance travelled at the hip.
 // Keep the authored walk rotation and timing.
 for(const [key,sign] of [['left',-1],['right',1]]){
  const p=pose[key].position;
  if(walking){
   p[0]+=sign*(walkWidth-(teacher?.29:.33));
   p[1]=walkHeight-eye+(p[1]+(teacher?.603:.81))*(teacher?.83:.22);
   p[2]=(teacher?-.09:-.035)+(p[2]+(teacher?.263:.151))*(teacher?.327:.28);
  }else{
   const mount=(teacher?idleMounts.teacher:idleMounts[character]||idleMounts.boy)[key];
   const authoredX=teacher?.2750647281234655:.2586505367912693;
   p[0]+=mount.position[0]-sign*authoredX;
   p[1]+=mount.position[1]+(teacher?.4682491411488502:.4890046217712004);
   p[2]+=mount.position[2]+.62;
   idleRotation.setFromEuler(idleEuler.fromArray(pose[key].rotation));
   idleRotation.premultiply(mountRotation.fromArray(mount.rotation).normalize());
   idleEuler.setFromQuaternion(idleRotation);
   pose[key].rotation=[idleEuler.x,idleEuler.y,idleEuler.z];
  }
 }
}
export function createHandAnimationRuntime({storage=defaultStorage(),eventTarget=defaultEvents(),fadeDuration=.14,fallbackDocument=null,bodyRelativeStanding=false}={}){
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
  sample(state={},time=0){if(disposed)return null;const now=Number.isFinite(time)?time:0,elapsed=lastTime===null?0:Math.max(0,now-lastTime),dt=Math.min(.1,elapsed);if(lastTime!==null&&now<lastTime)reset();lastTime=now;const requested=selectHandAnimationClip(state),clip=requested&&document?.clips[requested];
   if(blocked(state)&&!clip){reset();lastTime=now;return null;}
   if(clip){if(activeId!==requested||activeClip!==clip){transitionPose=lastPose;transitionAge=0;activeId=requested;activeClip=clip;clipTime=0;}else clipTime+=elapsed;weight=Math.min(1,weight+dt/Math.max(.001,fadeDuration));}
   else weight=Math.max(0,weight-dt/Math.max(.001,fadeDuration));
   if(!activeClip||weight<=0){if(!clip)reset();lastTime=now;return null;}
   const sampleTime=activeClip.loop?clipTime%activeClip.duration:Math.min(clipTime,activeClip.duration);
   let sampled=sampleHandAnimationClip(activeClip,sampleTime);
   if(bodyRelativeStanding)placeStandingWrists(sampled,activeId,state.character);
   if(transitionPose){const duration=Math.max(.001,fadeDuration);sampled=sampleHandAnimationClip({duration,easing:'smoothstep',keyframes:[{time:0,...transitionPose},{time:duration,...sampled}]},transitionAge);transitionAge+=dt;if(transitionAge>=duration)transitionPose=null;}
   lastPose=sampled;return{...sampled,weight,source:'runtime',clipId:activeId};
  },
  dispose(){disposed=true;eventTarget?.removeEventListener?.('storage',onStorage);eventTarget?.removeEventListener?.(HAND_ANIMATION_CHANGE_EVENT,reload);reset();}
 };
}
