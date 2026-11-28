import {BUS,onBus} from './bus-layout86.js?v=campus-94&rev=154';
import {PLAYGROUND_LAYOUT} from './playground-layout70.js?v=campus-117&rev=154';

export const RADIO_SONGS=Object.freeze([
 {id:'track-window',title:'雨停的车窗',bpm:96,bars:32},
 {id:'track-weekend',title:'周五放学后',bpm:116,bars:32}
].map(Object.freeze));
export const EXERCISE_SONG=Object.freeze({id:'field-march',title:'操场进行曲',bpm:120,bars:32});
export const radioSong=id=>[EXERCISE_SONG,...RADIO_SONGS].find(s=>s.id===id);
export function radioPowerFor(role,radio){
 if(role==='student'&&!radio)return true;
 if(role==='teacher'&&radio)return false;
 return null;
}
export function broadcastBeat(state){
 const radio=state?.radio;if(!radio)return 0;
 const song=radioSong(radio.track);if(!song)return 0;
 const age=Math.max(0,state.sceneElapsed-radio.startedAt),beat=age*song.bpm/60,phase=beat%1;
 return Math.sin(2*Math.PI*phase)*Math.min(1,age*8);
}
export function broadcastLift(state){return .015*broadcastBeat(state);}
export function broadcastScale(beat){
 const height=1-.055*beat;
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
