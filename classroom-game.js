import {ClassroomRound} from './classroom-rules.js?v=04';

// One local round. Bots share the room; this is not a network match.
export function createClassroomGame({scene,audio,settings,onExit}){
  const $=s=>document.querySelector(s), ui=$('#play-ui'), canvas=$('#classroom');
  const pauseDialog=$('#pause-dialog'), resultDialog=$('#result-dialog');
  const round=new ClassroomRound();
  const buttons=[...document.querySelectorAll('[data-action]')];
  const labels={snack:'偷吃零食',note:'传纸条',phone:'玩手机'};
  const phases={board:'老师在写板书',turning:'老师要转身了',watching:'老师正在看你',patrol:'老师在巡视',distracted:'同学正在掩护'};
  let active=false,raf=0,last=0,captionTimer=0,feedbackTimer=0,lastEffect=0,lastFootstep=0;
  const inputs=new Set();

  function release(){inputs.clear();round.hold(false);}
  function speech(text,speaker='同学'){
    clearTimeout(captionTimer);$('#speech-name').textContent=speaker;$('#speech-text').textContent=text;$('#speech').hidden=false;
    captionTimer=setTimeout(()=>$('#speech').hidden=true,3000);
    if(settings.muted||settings.sfx===0||!('speechSynthesis' in window))return;
    // Use an installed voice when available; subtitles remain the fallback.
    const voices=speechSynthesis.getVoices(), voice=voices.find(v=>v.localService&&/^zh/i.test(v.lang));
    if(!voice)return;
    speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;
    utterance.volume=Math.min(.65,settings.sfx/100*.7);utterance.rate=speaker==='老师'?.94:1.12;utterance.pitch=speaker==='老师'?.8:1.15;speechSynthesis.speak(utterance);
  }
  function fx(kind){audio.effect?.(kind);scene.playFeedback?.(kind);}
  function feedback(text,kind='good'){
    clearTimeout(feedbackTimer);const box=$('#round-feedback');box.textContent=text;box.dataset.kind=kind;box.classList.remove('pop');void box.offsetWidth;box.classList.add('pop');feedbackTimer=setTimeout(()=>box.classList.remove('pop'),1700);
  }
  function finish(s){
    release();audio.gameplay=false;audio.apply();fx(s.status==='won'?'bell':'caught');
    $('#result-title').textContent=s.status==='won'?'下课啦！':'被老师叫住了';
    $('#result-score').textContent=s.score;$('#result-goal').textContent='目标 '+s.target;
    $('#result-detail').textContent=s.status==='won'?'这节课，配合得不错。':s.strikes>=3?'被发现三次，下节课再来。':'铃声响了，还差一点。';
    $('#result-actions').textContent=`零食 ${s.completed.snack}  ·  纸条 ${s.completed.note}  ·  手机 ${s.completed.phone}`;
    if(!resultDialog.open)resultDialog.showModal();
  }
  function processEvents(){for(const e of round.drainEvents()){
    if(e.type==='speech')speech(e.text,e.speaker);
    if(e.type==='warning'){fx('warning');}
    if(e.type==='complete'&&e.actor==='player'){fx('complete');feedback('做到了！');$('#control-hint').classList.add('dismissed');}
    if(e.type==='caught'){release();fx('caught');feedback('被发现了','bad');speech(e.text,'老师');}
    if(e.type==='help'){fx('help');}
  }}
  function render(s){
    ui.dataset.status=s.status;ui.dataset.phase=s.teacher.phase;ui.dataset.holding=String(s.holding);ui.dataset.score=String(s.score);ui.dataset.strikes=String(s.strikes);
    const seconds=Math.ceil(s.timeLeft);$('#round-clock').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    $('#round-score').textContent=s.score;$('#round-target').textContent='/ '+s.target;$('#score-fill').style.width=Math.min(100,s.score/s.target*100)+'%';
    $('#teacher-state').textContent=phases[s.teacher.phase];$('#teacher-state').dataset.alert=String(s.teacher.looking||s.teacher.warning);
    $('#notice-fill').style.width=s.suspicion+'%';$('#notice-meter').setAttribute('aria-valuenow',String(Math.round(s.suspicion)));
    $('#strike-count').textContent=s.strikes+' / 3';$('#strikes').setAttribute('aria-label',`被发现 ${s.strikes} 次，三次结束`);
    buttons.forEach(b=>{const selected=b.dataset.action===s.selected;b.setAttribute('aria-pressed',String(selected));b.classList.toggle('acting',selected&&s.holding);b.style.setProperty('--action-progress',selected?(s.actionProgress*100)+'%':'0%');});
    $('#hold-action').textContent=s.holding?'松手收起':'按住行动';$('#active-action').textContent=labels[s.selected];
    $('#ask-help').disabled=s.helpCooldown>0;$('#help-cooldown').textContent=s.helpCooldown>0?Math.ceil(s.helpCooldown)+'秒':'Q';
    const friends=$('#classmates');friends.replaceChildren(...s.students.map(friend=>{const dot=document.createElement('span');dot.textContent=friend.name;dot.className='mate '+(friend.caught?'caught':friend.mood==='writing'?'':'busy');dot.title=friend.caught?'被老师提醒':friend.mood==='writing'?'写作业':'正在帮忙';return dot;}));
    scene.setGameplay?.(s);
  }
  let lastHud=0,finished=false;
  function frame(now){if(!active)return;raf=requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000||0);last=now;
    round.step(dt);const s=round.snapshot();processEvents();
    if(s.status==='playing'&&!s.paused&&s.holding&&now-lastEffect>670){audio.effect?.(s.selected);lastEffect=now;}
    if(s.status==='playing'&&!s.paused&&s.teacher.phase==='patrol'&&now-lastFootstep>480){audio.effect?.('step');lastFootstep=now;}
    if(now-lastHud>65){lastHud=now;render(s);}else scene.setGameplay?.(s);
    if(s.status!=='playing'&&!finished){finished=true;render(s);finish(s);}
  }
  function start(){
    cancelAnimationFrame(raf);if(pauseDialog.open)pauseDialog.close();if(resultDialog.open)resultDialog.close();
    release();round.reset(Date.now()>>>0);round.start();active=true;finished=false;
    document.body.classList.add('playing');ui.hidden=false;$('#menu').inert=true;$('#menu').setAttribute('aria-hidden','true');
    $('#speech').hidden=true;$('#round-feedback').classList.remove('pop');$('#control-hint').classList.remove('dismissed');
    audio.gameplay=true;audio.apply();audio.start();fx('bell');render(round.snapshot());last=performance.now();raf=requestAnimationFrame(frame);
    $('#pause-game').focus({preventScroll:true});
  }
  function exit(){active=false;release();cancelAnimationFrame(raf);clearTimeout(captionTimer);clearTimeout(feedbackTimer);if(pauseDialog.open)pauseDialog.close();if(resultDialog.open)resultDialog.close();window.speechSynthesis?.cancel();audio.gameplay=false;audio.apply();scene.setGameplay?.(null);ui.hidden=true;document.body.classList.remove('playing');$('#menu').inert=false;$('#menu').removeAttribute('aria-hidden');onExit?.();}
  function pause(value=true){if(!active||finished)return;release();round.pause(value);window.speechSynthesis?.cancel();if(value&&!pauseDialog.open)pauseDialog.showModal();else if(!value&&pauseDialog.open)pauseDialog.close();render(round.snapshot());}
  function choose(action){if(!active||finished||round.snapshot().paused)return;release();round.selectAction(action);audio.click();render(round.snapshot());}
  function hold(id,value){if(!active||finished||round.snapshot().paused)return;if(value){inputs.add(id);round.hold(true);}else{inputs.delete(id);round.hold(inputs.size>0);}render(round.snapshot());}
  buttons.forEach(b=>b.addEventListener('click',()=>choose(b.dataset.action)));
  for(const target of [canvas,$('#hold-action')]){
    target.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();target.setPointerCapture?.(e.pointerId);hold('pointer',true);});
    target.addEventListener('pointerup',()=>hold('pointer',false));target.addEventListener('pointercancel',release);target.addEventListener('lostpointercapture',()=>hold('pointer',false));
  }
  const help=()=>{if(active&&!finished&&!round.snapshot().paused){round.requestHelp();processEvents();render(round.snapshot());}};
  $('#ask-help').addEventListener('click',help);$('#pause-game').addEventListener('click',()=>pause());$('#resume-game').addEventListener('click',()=>pause(false));
  $('#restart-game').addEventListener('click',start);$('#retry-game').addEventListener('click',start);$('#leave-game').addEventListener('click',exit);$('#result-menu').addEventListener('click',exit);
  pauseDialog.addEventListener('cancel',e=>{e.preventDefault();pause(false);});resultDialog.addEventListener('cancel',e=>{e.preventDefault();exit();});
  document.addEventListener('keydown',e=>{if(!active)return;if(pauseDialog.open||resultDialog.open)return;if(e.code==='Escape'){if(!pauseDialog.open&&!resultDialog.open){e.preventDefault();pause();}return;}if(['Space','Digit1','Digit2','Digit3','KeyQ'].includes(e.code)){e.preventDefault();if(e.repeat)return;if(e.code==='Space')hold('keyboard',true);else if(e.code==='KeyQ')help();else choose(['snack','note','phone'][+e.code.slice(-1)-1]);}});
  document.addEventListener('keyup',e=>{if(e.code==='Space'&&active&&!pauseDialog.open&&!resultDialog.open){e.preventDefault();hold('keyboard',false);}});
  window.addEventListener('blur',()=>{if(active&&!finished)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&active&&!finished)pause();});
  return{start,exit,get active(){return active;},dispose:exit};
}
