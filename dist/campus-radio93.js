import {radioBeats} from './radio-beats156.js?v=campus-117&rev=156';
import {BUS,onBus} from './bus-layout86.js?v=campus-94&rev=154';
import {PLAYGROUND_LAYOUT} from './playground-layout70.js?v=campus-117&rev=156';

export const RADIO_SONGS=Object.freeze([
 {id:'track-window',title:'雨爱（司凤版）',bpm:162,bars:32},
 {id:'track-weekend',title:'朋友的酒（DJ 版）',bpm:130,bars:32}
].map(Object.freeze));
export const EXERCISE_SONG=Object.freeze({id:'field-march',title:'校园跑操曲',bpm:120,bars:32});
export const radioSong=id=>[EXERCISE_SONG,...RADIO_SONGS].find(s=>s.id===id);
export function radioPowerFor(role,radio){
 if(role==='student'&&!radio)return true;
 if(role==='teacher'&&radio)return false;
 return null;
}
let activeAudio;
export function setRadioClock(audio,track,start){activeAudio=audio?{audio,track,start}:null;}
export function broadcastBeat(state){
 const r=state?.radio,grid=radioBeats[r?.track];if(!grid)return 0;
 const local=activeAudio?.track===r.track&&activeAudio.start===r.startedAt?activeAudio.audio:null;
 const age=local&&!local.paused&&local.readyState>=2?local.currentTime:Math.max(0,state.sceneElapsed-r.startedAt);
 const ms=(age%grid.duration)*1000,beats=grid.beats;
 let lo=0,hi=beats.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(beats[mid]<=ms)lo=mid+1;else hi=mid;}
 if(!lo)return 0;
 const start=beats[lo-1],end=beats[lo]??(grid.duration*1000+beats[0]),phase=(ms-start)/(end-start);
 // Compress on impact, rebound briskly, then settle before the next impact.
 return phase<.34?Math.cos(Math.PI*phase/.34):phase<.72?-.5*(1+Math.cos(Math.PI*(phase-.34)/.38)):.5*(1-Math.cos(Math.PI*(phase-.72)/.28));
}
export function broadcastLift(state){return .015*broadcastBeat(state);}
export function broadcastScale(beat){
 const height=1-.102*beat;
 return {height,width:1/Math.sqrt(height)};
}
export function radioAnchor(map){
 if(map==='bus')return {x:11.023,y:BUS.low+1.36,z:-14.49,yaw:-Math.PI/2};
 if(map==='playground')return PLAYGROUND_LAYOUT.speaker;
 return null;
}
export function reachesRadio(map,p){
 const a=radioAnchor(map);
 if(!a||!p||p.seated||p.caught||p.mapActivity||p.captivity&&p.captivity!=='free')return false;
 if(map==='bus'&&(p.busDeck||!onBus(p.x,p.z)))return false;
 const dx=p.x-a.x,dz=p.z-a.z;
 return Math.hypot(dx,dz)<=2.18&&dx*Math.sin(a.yaw)+dz*Math.cos(a.yaw)>-.04;
}
