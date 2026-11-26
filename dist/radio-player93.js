import {radioSong,EXERCISE_SONG} from './campus-radio93.js?v=campus-116';
export function createRadioUI(doc,muted){
 const audio=doc.createElement('audio');audio.preload='none';audio.loop=true;audio.volume=.54;
 let key='',song=null,age=0,active=false,pending=false,blocked=false,epoch=0;
 function play(){
  if(!song||muted()||!active){if(!audio.paused)audio.pause();return;}
  const duration=audio.duration;
  if(Number.isFinite(duration)&&duration>0&&Math.abs(age%duration-audio.currentTime)>.75)audio.currentTime=age%duration;
  if(!audio.paused||blocked||pending)return;
  pending=true;const run=epoch;
  Promise.resolve(audio.play()).catch(()=>{if(epoch===run)blocked=true;}).finally(()=>{if(epoch===run)pending=false;});
 }
 function retry(){blocked=false;play();}
 function reset(){epoch++;song=null;key='';active=pending=blocked=false;audio.pause();audio.removeAttribute('src');audio.load();}
 doc.addEventListener('pointerdown',retry);doc.addEventListener('keydown',retry);doc.addEventListener('campus-audio-settings',retry);audio.addEventListener('loadedmetadata',play);
 return {update(s){
  const live=s?.status==='playing'&&s.stage==='class',r=live?s.radio:null;
  const next=live&&(r?radioSong(r.track):s.map==='playground'?EXERCISE_SONG:null);
  if(!next){if(song)reset();return;}
  const id=next.id+'-'+(r?.activation||0);
  if(key!==id){epoch++;key=id;song=next;pending=blocked=false;audio.src=new URL('./assets/audio/'+song.id+'.m4a',import.meta.url).href;}
  age=Math.max(0,s.sceneElapsed-(r?.startedAt??s.sceneElapsed-s.elapsed));active=!s.paused||!!s.network;play();
 },reset,dispose(){doc.removeEventListener('pointerdown',retry);doc.removeEventListener('keydown',retry);doc.removeEventListener('campus-audio-settings',retry);audio.removeEventListener('loadedmetadata',play);reset();}};
}
