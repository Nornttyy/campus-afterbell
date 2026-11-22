import {RADIO_SONGS,radioSong,radioPlayerUrl,reachesRadio} from './campus-radio93.js?v=campus-93';

export function createRadioUI(host,commands){
 const dialog=document.createElement('dialog'),player=document.createElement('aside');
 dialog.className='sheet campus-radio';dialog.id='radio-dialog';
 dialog.innerHTML='<div class="sheet-top"><h2>校园广播</h2><button type="button" data-back>返回</button></div><div class="radio-choices"></div>';
 player.id='school-radio-player';player.hidden=true;player.innerHTML='<div class="radio-playing"><a target="_blank" rel="noopener noreferrer"></a><button type="button" aria-label="静音校园广播">静音</button></div><div class="radio-media"></div>';
 host.append(dialog,player);
 const choices=dialog.querySelector('.radio-choices'),media=player.lastElementChild,link=player.querySelector('a'),mute=player.querySelector('button');
 let current=null,playerKey='',quiet=false,last=null;
 function close(resume=true){if(!dialog.open)return;dialog.close();if(resume)commands.closeRadio?.();}
 function choose(id){if(commands.radio?.(id)!==false)close();}
 for(const song of RADIO_SONGS){
  const button=document.createElement('button');button.className='paper-button';button.dataset.song=song.id;
  const title=document.createElement('b'),artist=document.createElement('small');title.textContent=song.title;artist.textContent=song.artist;
  button.append(title,artist);button.onclick=()=>choose(song.id);choices.append(button);
 }
 const stop=document.createElement('button');stop.className='paper-button';stop.dataset.song='';stop.textContent='停止广播';stop.onclick=()=>choose(null);choices.append(stop);
 dialog.querySelector('[data-back]').onclick=()=>close();dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('keydown',e=>{if(commands.radioReturn?.(e.code)){e.preventDefault();e.stopPropagation();close();}});
 function clearPlayer(){playerKey='';media.replaceChildren();}
 function reset(){close(false);clearPlayer();player.hidden=true;current=null;last=null;quiet=false;}
 function update(s){
  last=s;
  if(dialog.open&&(!s||s.stage!=='class'||s.status!=='playing'||!reachesRadio(s.map,s.player)))close(false);
  const live=s?.status==='playing'&&s.stage==='class'?s.radio:null;
  const song=live&&radioSong(live.track);
  if(!song){if(current){clearPlayer();player.hidden=true;current=null;}return;}
  current=song;player.hidden=false;link.textContent=song.title;link.href=song.source;
  const silent=quiet||Boolean(commands.silent?.());mute.textContent=quiet?'收听':'静音';mute.setAttribute('aria-pressed',String(quiet));
  mute.setAttribute('aria-label',quiet?'收听校园广播':'静音校园广播');
  if(s.paused||silent){if(playerKey)clearPlayer();return;}
  const age=Math.max(0,s.sceneElapsed-live.startedAt),pass=Math.floor(age/song.duration),key=song.id+'/'+live.startedAt+'/'+pass;
  if(playerKey===key)return;
  const frame=document.createElement('iframe');frame.title=song.title+' · '+song.artist;frame.allow='autoplay; encrypted-media; fullscreen';frame.referrerPolicy='strict-origin-when-cross-origin';
  frame.src=radioPlayerUrl(song,age%song.duration);media.replaceChildren(frame);playerKey=key;
 }
 mute.onclick=()=>{quiet=!quiet;if(last)update(last);};
 function open(s){
  if(!s||s.stage!=='class'||s.status!=='playing'||s.paused||!reachesRadio(s.map,s.player))return false;
  for(const b of choices.children){const id=b.dataset.song;b.hidden=!!id&&s.role==='teacher';b.disabled=id?id===s.radio?.track:!s.radio;b.setAttribute('aria-pressed',String(!!id&&id===s.radio?.track));}
  commands.radioFocus?.();dialog.showModal();commands.unlock?.();return true;
 }
 return {open,update,reset,get modal(){return dialog.open;},dispose(){reset();dialog.remove();player.remove();}};
}
