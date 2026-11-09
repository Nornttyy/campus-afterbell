export const COMPUTER_APPS=Object.freeze(['photoshop','unity','snake','valorant']);
export const COMPUTER_GAMES=Object.freeze(['snake','valorant']);
export function nextComputerApp(index,direction){const i=Number.isInteger(index)?Math.max(0,Math.min(3,index)):0;return direction==='left'?i%2?i-1:i:direction==='right'?i%2?i:i+1:direction==='up'?i>=2?i-2:i:direction==='down'?i<2?i+2:i:i;}
export function canonicalComputerApp(app){return app==='learning'||app==='study'?'photoshop':app;}

export const VIDEO_WATCH_SECONDS=3;
const PLAYBACK_LEASE=.65;
export function validComputerPlayback(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&typeof value.playing==='boolean'&&typeof value.visible==='boolean'&&Number.isFinite(value.mediaTime)&&value.mediaTime>=0&&value.mediaTime<=864000;}
export function resetComputerPlayback(actor,{progress=true}={}){actor._videoPlayback=null;if(progress)actor._computerProgress=0;}
// Reports prove local playback is advancing; they never supply points or dt.
// A compromised client can imitate them, but cannot score faster than the
// server clock. A stopped stream has no unlimited true/playing latch.
export function reportComputerPlayback(actor,value,now,allowed){
 if(!validComputerPlayback(value))return false;
 if(!allowed||!value.playing||!value.visible){resetComputerPlayback(actor,{progress:false});return !value.playing||!value.visible;}
 const previous=actor._videoPlayback;
 const next={mediaTime:value.mediaTime,at:now,credit:0};
 if(previous){const wall=Math.max(0,now-previous.at),media=value.mediaTime-previous.mediaTime;
  // Repeated frames, seeking and loop wraps establish a fresh baseline. A
  // normal progressing frame earns at most the elapsed authoritative time.
  if(media>0&&media<=wall*2+.1&&wall<=PLAYBACK_LEASE)next.credit=Math.min(PLAYBACK_LEASE,(previous.credit||0)+Math.min(media,wall));
 }
 actor._videoPlayback=next;return true;
}
export function advanceComputerPlayback(actor,now){
 const playback=actor._videoPlayback;if(!playback||now-playback.at>PLAYBACK_LEASE||!(playback.credit>0))return 0;
 // Credit describes time already observed between two server-timed reports,
 // so consume it once instead of charging another playback interval for it.
 const watched=playback.credit;playback.credit=0;
 actor._computerProgress=(actor._computerProgress||0)+watched;
 const earned=Math.floor((actor._computerProgress+1e-8)/VIDEO_WATCH_SECONDS);
 if(earned)actor._computerProgress=Math.max(0,actor._computerProgress-earned*VIDEO_WATCH_SECONDS);
 return earned;
}
