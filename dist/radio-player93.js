import {radioSong,radioPlayerUrl} from './campus-radio93.js?v=campus-97';

function sameBroadcast(a,b){
  return a&&b&&a.track===b.track&&a.activation===b.activation&&a.startedAt===b.startedAt;
}

export function createRadioUI(doc,muted){
  const panel=doc.createElement('aside');
  panel.id='school-radio-player';panel.hidden=true;
  panel.setAttribute('aria-label','校园广播');
  panel.innerHTML='<div class="radio-playing"><a target="_blank" rel="noopener noreferrer"></a><button type="button" data-end hidden>结束收听</button></div><div class="radio-media"></div>';
  const title=panel.querySelector('a'),end=panel.querySelector('[data-end]'),media=panel.lastElementChild;
  doc.body.append(panel);
  let broadcast=null,song=null,age=0,paused=false,afterClass=false,framePass=-1;

  function clearFrame(){
    if(framePass!==-1)media.replaceChildren();
    framePass=-1;
  }
  function stop(){
    clearFrame();broadcast=null;song=null;afterClass=false;panel.hidden=true;
  }
  function render(){
    if(!song)return;
    if(muted()){
      if(afterClass){stop();return;}
      clearFrame();panel.hidden=true;return;
    }
    panel.hidden=false;
    panel.dataset.mode=afterClass?'after-class':'room';
    end.hidden=!afterClass;
    if(afterClass)return;
    if(paused){clearFrame();return;}
    const pass=Math.floor(age/song.duration);
    if(pass===framePass)return;
    const frame=doc.createElement('iframe');
    frame.title=song.title+' · '+song.artist;frame.allow='autoplay; encrypted-media; fullscreen';
    frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
    frame.src=radioPlayerUrl(song,age%song.duration);
    media.replaceChildren(frame);framePass=pass;
  }
  end.onclick=()=>{if(afterClass)stop();};
  doc.addEventListener('campus-audio-settings',render);
  return {
    update(s){
      const live=s?.status==='playing'&&s.stage==='class'?s.radio:null;
      if(live){
        if(afterClass||!sameBroadcast(broadcast,live)){
          stop();song=radioSong(live.track);if(!song)return;
          broadcast=live;title.textContent=song.title;title.href=song.source;
        }
        age=Math.max(0,s.sceneElapsed-live.startedAt);paused=!!s.paused&&!s.network;
        render();return;
      }
      if(afterClass||!broadcast)return;
      // A teacher may switch off and end a class within the same network tick.
      // Continue only the station the authority actually heard at the final bell.
      if(framePass>=0&&['won','lost'].includes(s?.status)&&sameBroadcast(broadcast,s.radioAtFinish)){
        afterClass=true;render();
      }else stop();
    },
    reset(){if(!afterClass)stop();},
    dispose(){doc.removeEventListener('campus-audio-settings',render);stop();panel.remove();}
  };
}
