import {Euler,Quaternion} from './vendor/three.module.js';
export const HAND_ANIMATION_FORMAT='campus-first-person-hands';
export const HAND_ANIMATION_VERSION=1;
export const HAND_CLIP_IDS=Object.freeze(['student-idle','student-walk','student-crawl-idle','student-crawl','teacher-idle','teacher-walk']);
export const HAND_FINGERS=Object.freeze(['Thumb','Index','Middle','Pinky']);
export const HAND_EASINGS=Object.freeze(['linear','smoothstep','step']);
export const HAND_ANIMATION_MAX_BYTES=262144;
const finite=n=>typeof n==='number'&&Number.isFinite(n),plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o),own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const tuple=(a,limit)=>Array.isArray(a)&&a.length===3&&a.every(n=>finite(n)&&Math.abs(n)<=limit);
function readHand(input,path,errors){
 if(!plain(input)){errors.push(`${path}：缺少手部姿势`);return null;}
 if(!tuple(input.position,3))errors.push(`${path}：位置须为 -3 至 3 米的三个数字`);
 if(!tuple(input.rotation,Math.PI*8))errors.push(`${path}：旋转须为三个有效弧度值`);
 if(!finite(input.curl)||input.curl<0||input.curl>1)errors.push(`${path}：握拳须在 0 至 1 之间`);
 const out={position:input.position?.slice?.(0,3),rotation:input.rotation?.slice?.(0,3),curl:input.curl};
 if(input.fingers!==undefined){if(!plain(input.fingers))errors.push(`${path}：手指数据无效`);else{out.fingers={};for(const name of HAND_FINGERS)if(own(input.fingers,name)){const v=input.fingers[name];if(!finite(v)||v<0||v>1)errors.push(`${path}.${name}：须在 0 至 1 之间`);else out.fingers[name]=v;}if(Object.keys(input.fingers).some(k=>!HAND_FINGERS.includes(k)))errors.push(`${path}：存在不支持的手指`);}}
 return out;
}
export function validateHandAnimationDocument(input){
 const errors=[];if(!plain(input)||input.format!==HAND_ANIMATION_FORMAT||input.version!==1||!plain(input.clips))return{ok:false,errors:['动画文件格式或版本不正确']};
 const value={format:HAND_ANIMATION_FORMAT,version:1,clips:{}};
 if(Object.keys(input.clips).some(id=>!HAND_CLIP_IDS.includes(id)))errors.push('存在不支持的动作');
 for(const id of HAND_CLIP_IDS){if(!own(input.clips,id))continue;const c=input.clips[id],path=id;if(!plain(c)){errors.push(`${path}：动作格式不正确`);continue;}
  if(!finite(c.duration)||c.duration<.2||c.duration>20)errors.push(`${path}：时长须在 0.2 至 20 秒之间`);
  if(typeof c.loop!=='boolean')errors.push(`${path}：循环设置无效`);
  if(!HAND_EASINGS.includes(c.easing))errors.push(`${path}：插值方式无效`);
  if(!Array.isArray(c.keyframes)||c.keyframes.length<1||c.keyframes.length>128){errors.push(`${path}：关键帧须为 1 至 128 帧`);continue;}
  let previous=-Infinity;const keyframes=[];
  for(const [i,k]of c.keyframes.entries()){if(!plain(k)){errors.push(`${path} 第${i+1}帧无效`);continue;}if(!finite(k.time)||k.time<0||k.time>c.duration||k.time<=previous)errors.push(`${path}：关键帧时间须递增且不超出时长`);previous=k.time;keyframes.push({time:k.time,left:readHand(k.left,path+'.left',errors),right:readHand(k.right,path+'.right',errors)});}
  if(c.keyframes[0]?.time!==0)errors.push(`${path}：第一帧须从 0 秒开始`);
  value.clips[id]={duration:c.duration,loop:c.loop,easing:c.easing,keyframes};
 }
 return errors.length?{ok:false,errors}:{ok:true,value,errors:[]};
}
export function isHandAnimationPose(pose){return plain(pose)&&['left','right'].every(side=>{const h=pose[side];return plain(h)&&tuple(h.position,3)&&tuple(h.rotation,Math.PI*8)&&finite(h.curl)&&h.curl>=0&&h.curl<=1&&(!h.fingers||plain(h.fingers)&&Object.entries(h.fingers).every(([k,v])=>HAND_FINGERS.includes(k)&&finite(v)&&v>=0&&v<=1));});}
function interpolateHand(a,b,t){
 const q=new Quaternion().setFromEuler(new Euler(...a.rotation,'XYZ')).slerp(new Quaternion().setFromEuler(new Euler(...b.rotation,'XYZ')),t),e=new Euler().setFromQuaternion(q,'XYZ'),out={position:a.position.map((v,i)=>v+(b.position[i]-v)*t),rotation:[e.x,e.y,e.z],quaternion:q.toArray(),curl:a.curl+(b.curl-a.curl)*t};
 if(a.fingers||b.fingers){out.fingers={};for(const f of HAND_FINGERS){const av=a.fingers?.[f]??a.curl,bv=b.fingers?.[f]??b.curl;out.fingers[f]=av+(bv-av)*t;}}
 return out;
}
// Editor scrubbing clamps at the last key. Runtime owns looping so seeking to
// duration never jumps to the first frame while the user edits the endpoint.
export function sampleHandAnimationClip(clip,seconds){
 if(!clip?.keyframes?.length)return null;const t=Math.max(0,Math.min(clip.duration,finite(seconds)?seconds:0)),frames=clip.keyframes;let a=frames[0],b=a;
 for(let i=1;i<frames.length;i++){b=frames[i];if(t<=b.time)break;a=b;}
 let mix=b.time>a.time?Math.max(0,Math.min(1,(t-a.time)/(b.time-a.time))):0;if(clip.easing==='smoothstep')mix=mix*mix*(3-2*mix);else if(clip.easing==='step')mix=t>=b.time?1:0;
 return{left:interpolateHand(a.left,b.left,mix),right:interpolateHand(a.right,b.right,mix)};
}
// A new clip contains one static pose, never a sampled legacy animation.
// Every frame after this is authored by the user in the editor.
export function createHandAnimationDocument(){
 const clips={};for(const id of HAND_CLIP_IDS){const crawl=id.startsWith('student-crawl');
  const hand=side=>({position:[side*(crawl?.26:.24),crawl?-.38:-.34,crawl?-.60:-.62],rotation:[crawl?-1.35:-.65,0,side*(crawl?.06:.11)],curl:.18});
  clips[id]={duration:id.endsWith('idle')?2:crawl?1.6:1.2,loop:true,easing:'smoothstep',keyframes:[{time:0,left:hand(-1),right:hand(1)}]};
 }return{format:HAND_ANIMATION_FORMAT,version:1,clips};
}
