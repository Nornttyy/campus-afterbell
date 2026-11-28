import {radioSong,EXERCISE_SONG} from './campus-radio93.js?v=campus-117&rev=154';
import {readRadioRecording} from './radio-library118.js';
export function createRadioUI(doc,muted){
 const audio=doc.createElement('audio');audio.preload='none';audio.loop=true;audio.volume=.54;
 const local=['localhost','127.0.0.1','[::1]'].includes(new URL(import.meta.url).hostname);
 const privateTracks={'track-window':'rain-sifeng','track-weekend':'friends-dj'};
 const url=(name)=>new URL('./assets/audio/'+name+'.m4a',import.meta.url).href;
 let objectURL=null,ready=false;
 function releaseURL(){if(objectURL)URL.revokeObjectURL(objectURL);objectURL=null;}
 function setSource(src){epoch++;audio.src=src;ready=true;pending=blocked=false;play();}
 function fallback(){
  if(!song||!ready)return;
  if(objectURL){releaseURL();setSource(defaultSource(song.id));}
  else if(local&&audio.src.includes('/local/'))setSource(url(song.id));
 }
 function defaultSource(id){return url(local&&privateTracks[id]?'local/'+privateTracks[id]:id);}
 function select(id){
  audio.pause();releaseURL();ready=false;
  if(!privateTracks[id]||!globalThis.indexedDB){setSource(defaultSource(id));return;}
  const run=epoch;
  readRadioRecording(id).catch(()=>null).then(file=>{
   if(epoch!==run)return;
   if(file)objectURL=URL.createObjectURL(file);
   setSource(objectURL||defaultSource(id));
  });
 }
 audio.addEventListener('error',fallback);
 let key='',song=null,age=0,active=false,pending=false,blocked=false,epoch=0;
 function play(){
  if(!song||!ready||muted()||!active){if(!audio.paused)audio.pause();return;}
  const duration=audio.duration;
  if(Number.isFinite(duration)&&duration>0&&Math.abs(age%duration-audio.currentTime)>.75)audio.currentTime=age%duration;
  if(!audio.paused||blocked||pending)return;
  pending=true;const run=epoch;
  Promise.resolve(audio.play()).catch(()=>{if(epoch===run)blocked=true;}).finally(()=>{if(epoch===run)pending=false;});
 }
 function retry(){blocked=false;play();}
 function reset(){epoch++;song=null;key='';ready=active=pending=blocked=false;audio.pause();audio.removeAttribute('src');audio.load();releaseURL();}
 doc.addEventListener('campus-radio-library-change',reset);
 doc.addEventListener('pointerdown',retry);doc.addEventListener('keydown',retry);doc.addEventListener('campus-audio-settings',retry);audio.addEventListener('loadedmetadata',play);
 return {update(s){
  const live=s?.status==='playing'&&s.stage==='class',r=live?s.radio:null;
  const next=live&&(r?radioSong(r.track):s.map==='playground'?EXERCISE_SONG:null);
  if(!next){if(song)reset();return;}
  const id=next.id+'-'+(r?.activation||0);
  age=Math.max(0,s.sceneElapsed-(r?.startedAt??s.sceneElapsed-s.elapsed));active=!s.paused||!!s.network;
  if(key!==id){epoch++;key=id;song=next;select(song.id);}else play();
 },reset,dispose(){audio.removeEventListener('error',fallback);doc.removeEventListener('campus-radio-library-change',reset);doc.removeEventListener('pointerdown',retry);doc.removeEventListener('keydown',retry);doc.removeEventListener('campus-audio-settings',retry);audio.removeEventListener('loadedmetadata',play);reset();}};
}
