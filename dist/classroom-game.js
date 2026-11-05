import {ClassroomRound} from './classroom-rules.js?v=09';

// Input/UI only. Perception, movement and team results live in rules.
export function createClassroomGame({scene,audio,onExit}){
  const $=s=>document.querySelector(s),ui=$('#play-ui'),canvas=$('#classroom');
  const pauseDialog=$('#pause-dialog'),resultDialog=$('#result-dialog');
  const round=new ClassroomRound(),buttons=[...document.querySelectorAll('[data-action]')];
  const labels={snack:'零食',note:'纸条',phone:'手机'},keys=new Set(),inputs=new Set();
  let active=false,finished=false,raf=0,last=0,lastHud=0,lastEffect=0,lastFootstep=0;
  let yaw=0,pitch=0,dragLook=false,dragX=0,dragY=0,captionTimer=0,feedbackTimer=0,hintTimer=0,lastFriends='',lastTeacher=null;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function release(){inputs.clear();round.hold(false);}
  function stopMovement(){keys.clear();round.setMovement(0,0);round.setCrouch(false);dragLook=false;}
  function unlock(){if(document.pointerLockElement===canvas)document.exitPointerLock();}
  function lock(){if(!canvas.requestPointerLock)return;try{canvas.requestPointerLock()?.catch?.(()=>{});}catch{}}
  function caption(text,who=''){
    if(!text)return;clearTimeout(captionTimer);$('#speech-name').textContent=who;$('#speech-text').textContent=text;$('#speech').hidden=false;
    captionTimer=setTimeout(()=>$('#speech').hidden=true,2600);
  }
  function fx(kind){audio.effect?.(kind);scene.playFeedback?.(kind);}
  function feedback(text,kind='good'){
    clearTimeout(feedbackTimer);const box=$('#round-feedback');box.textContent=text;box.dataset.kind=kind;box.classList.remove('pop');void box.offsetWidth;box.classList.add('pop');
    feedbackTimer=setTimeout(()=>box.classList.remove('pop'),1500);
  }
  function finish(s){
    release();stopMovement();unlock();audio.gameplay=false;audio.apply();fx(s.status==='won'?'bell':'caught');
    $('#result-title').textContent=s.status==='won'?'学生获胜':'老师获胜';$('#result-score').textContent=Math.round(s.score);$('#result-goal').textContent='捣乱值';
    $('#result-detail').textContent=s.status==='won'?'这节课，藏住了。':'捣蛋同学都被找出来了。';
    $('#result-actions').textContent=`你完成了：零食 ${s.completed.snack} · 纸条 ${s.completed.note} · 手机 ${s.completed.phone}`;
    if(!resultDialog.open)resultDialog.showModal();
  }
  function processEvents(){for(const e of round.drainEvents()){
    if(e.type==='complete'&&e.actor==='player'){fx('complete');feedback('+'+(e.points??''));}
    if(e.type==='chalk')fx('warning');
    if(e.type==='caught'){
      const s=round.snapshot();fx('caught');
      if(e.studentId===s.player?.id||e.actor==='player'){release();stopMovement();feedback('罚站','bad');caption('同学们还在继续。');}
      else if(e.text)caption(e.text);
    }
    // Factual world events, not canned spoken conversations.
    if(e.type==='observation'&&e.public===true)caption(e.text,e.speaker||'');
    if(e.type==='help'&&e.accepted!==false)audio.effect?.('note');
  }}
  function render(s){
    const p=s.player,teammates=s.students.filter(x=>x.isTeammate),alive=5-s.students.filter(x=>(x.isPlayer||x.isTeammate)&&x.caught).length;
    ui.dataset.status=s.status;ui.dataset.phase=s.teacher.phase;ui.dataset.holding=String(s.holding);ui.dataset.score=String(s.score);
    ui.dataset.seated=String(p.seated);ui.dataset.caught=String(p.caught);ui.dataset.position=`${p.x.toFixed(2)},${p.z.toFixed(2)}`;
    $('#round-clock').textContent=alive+' / 5';$('#round-score').textContent=Math.floor(s.score);$('#round-target').textContent='/ '+s.target;
    $('#score-fill').style.width=clamp(s.score/s.target*100,0,100)+'%';
    const notice=clamp(s.suspicion,0,100);$('#notice-fill').style.width=notice+'%';$('#notice-meter').setAttribute('aria-valuenow',String(Math.round(notice)));
    $('.teacher-watch').classList.toggle('visible',notice>8||p.caught);$('#teacher-state').textContent=p.caught?'被点名，讲台旁罚站':notice>68?'老师盯上你了':'动作被注意到了';
    $('#teacher-state').dataset.alert=String(notice>68);$('#strikes').hidden=true;
    buttons.forEach(b=>{const selected=b.dataset.action===s.selected;b.disabled=p.caught;b.setAttribute('aria-pressed',String(selected));b.classList.toggle('acting',selected&&s.holding);b.style.setProperty('--action-progress',selected?(s.actionProgress*100)+'%':'0%');});
    $('#hold-action').disabled=p.caught;$('#hold-action').textContent=s.holding?'松手收起':p.seated?'按住使用':'按住携带';$('#active-action').textContent=p.caught?'罚站中':p.seated?labels[s.selected]:p.crouched?'蹲下移动':'离开座位';
    $('#interact-seat').disabled=p.caught;$('#seat-label').textContent=p.seated?'起身':'坐下';const smoke=s.inventory?.smoke??0;
    $('#ask-help').disabled=p.caught||smoke<=0;$('#help-cooldown').textContent='Q · '+smoke;
    const signature=teammates.map(f=>[f.id,f.caught,f.holding].join(':')).join('|');
    if(signature!==lastFriends){lastFriends=signature;$('#classmates').replaceChildren(...teammates.map(friend=>{
      const dot=document.createElement('span');dot.textContent=friend.name;dot.className='mate '+(friend.caught?'caught':friend.holding?'busy':'');dot.title=friend.caught?'罚站中':'同学';return dot;
    }));}
    $('#crosshair').hidden=p.caught||p.seated;scene.setGameplay(s);
  }
  function movement(){
    let side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);const len=Math.hypot(side,forward)||1;side/=len;forward/=len;
    round.setMovement(Math.sin(yaw)*forward-Math.cos(yaw)*side,Math.cos(yaw)*forward+Math.sin(yaw)*side);round.setCrouch(keys.has('KeyC')||keys.has('ControlLeft'));
  }
  function frame(now){
    if(!active)return;raf=requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000||0);last=now;movement();round.step(dt);const s=round.snapshot();processEvents();
    if(s.status==='playing'&&!s.paused&&s.holding&&now-lastEffect>780){audio.effect?.(s.selected);lastEffect=now;}
    const t=s.teacher;if(s.status==='playing'&&!s.paused&&lastTeacher&&Math.hypot(t.x-lastTeacher.x,t.z-lastTeacher.z)>.001&&now-lastFootstep>520){audio.effect?.('step');lastFootstep=now;}lastTeacher={x:t.x,z:t.z};
    if(now-lastHud>80){lastHud=now;render(s);}else scene.setGameplay(s);
    if(s.status!=='playing'&&!finished){finished=true;render(s);finish(s);}
  }
  function start(){
    cancelAnimationFrame(raf);if(pauseDialog.open)pauseDialog.close();if(resultDialog.open)resultDialog.close();release();keys.clear();round.reset(Date.now()>>>0);round.start();yaw=0;pitch=0;round.setLook(yaw,pitch);
    active=true;finished=false;lastFriends='';lastTeacher=null;document.body.classList.add('playing');ui.hidden=false;$('#menu').inert=true;$('#menu').setAttribute('aria-hidden','true');
    $('#speech').hidden=true;$('#round-feedback').classList.remove('pop');$('#control-hint').classList.remove('dismissed');clearTimeout(hintTimer);hintTimer=setTimeout(()=>$('#control-hint').classList.add('dismissed'),9000);
    audio.gameplay=true;audio.apply();audio.start();fx('bell');render(round.snapshot());last=performance.now();raf=requestAnimationFrame(frame);canvas.focus({preventScroll:true});lock();
  }
  function exit(){
    active=false;release();stopMovement();unlock();cancelAnimationFrame(raf);clearTimeout(captionTimer);clearTimeout(feedbackTimer);clearTimeout(hintTimer);if(pauseDialog.open)pauseDialog.close();if(resultDialog.open)resultDialog.close();
    audio.gameplay=false;audio.apply();scene.setGameplay(null);ui.hidden=true;document.body.classList.remove('playing');$('#menu').inert=false;$('#menu').removeAttribute('aria-hidden');onExit?.();
  }
  function pause(value=true){if(!active||finished)return;release();stopMovement();round.pause(value);if(value){unlock();if(!pauseDialog.open)pauseDialog.showModal();}else{if(pauseDialog.open)pauseDialog.close();lock();}render(round.snapshot());}
  const canInput=()=>active&&!finished&&!round.snapshot().paused;
  function choose(action){if(!canInput())return;release();round.selectAction(action);audio.click();render(round.snapshot());}
  function hold(id,value){if(!canInput())return;if(value){inputs.add(id);round.hold(true);}else{inputs.delete(id);round.hold(inputs.size>0);}render(round.snapshot());}
  function interact(){if(!canInput())return;release();round.interact();render(round.snapshot());}
  function smoke(){if(!canInput())return;release();round.useItem();processEvents();render(round.snapshot());}
  buttons.forEach(b=>b.addEventListener('click',()=>choose(b.dataset.action)));
  for(const target of [canvas,$('#hold-action')]){
    target.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();target.setPointerCapture?.(e.pointerId);if(target===canvas&&!document.pointerLockElement)lock();hold('pointer',true);});
    target.addEventListener('pointerup',e=>{if(e.button===0)hold('pointer',false);});target.addEventListener('pointercancel',release);target.addEventListener('lostpointercapture',()=>hold('pointer',false));
  }
  canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{if(e.button===2&&canInput()){release();dragLook=true;dragX=e.clientX;dragY=e.clientY;}});window.addEventListener('pointerup',e=>{if(e.button===2)dragLook=false;});
  document.addEventListener('mousemove',e=>{if(!canInput()||(!dragLook&&document.pointerLockElement!==canvas))return;const locked=document.pointerLockElement===canvas,dx=locked?e.movementX:e.clientX-dragX,dy=locked?e.movementY:e.clientY-dragY;dragX=e.clientX;dragY=e.clientY;yaw-=dx*.0024;pitch=clamp(pitch+dy*.0021,-1.15,.88);round.setLook(yaw,pitch);});
  document.addEventListener('pointerlockchange',()=>{document.body.classList.toggle('mouse-locked',document.pointerLockElement===canvas);if(!document.pointerLockElement)release();});
  $('#ask-help').addEventListener('click',smoke);$('#interact-seat').addEventListener('click',interact);$('#pause-game').addEventListener('click',()=>pause());$('#resume-game').addEventListener('click',()=>pause(false));
  $('#restart-game').addEventListener('click',start);$('#retry-game').addEventListener('click',start);$('#leave-game').addEventListener('click',exit);$('#result-menu').addEventListener('click',exit);
  pauseDialog.addEventListener('cancel',e=>{e.preventDefault();pause(false);});resultDialog.addEventListener('cancel',e=>{e.preventDefault();exit();});
  document.addEventListener('keydown',e=>{
    if(!active||pauseDialog.open||resultDialog.open)return;if(e.code==='Escape'){e.preventDefault();pause();return;}
    if(['Space','Digit1','Digit2','Digit3','KeyQ','KeyE','KeyW','KeyA','KeyS','KeyD','KeyC','ControlLeft'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.repeat)return;if(e.code==='Space')hold('keyboard',true);else if(e.code==='KeyQ')smoke();else if(e.code==='KeyE')interact();else if(e.code.startsWith('Digit'))choose(['snack','note','phone'][+e.code.slice(-1)-1]);}
  });
  document.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space'&&active){e.preventDefault();hold('keyboard',false);}});
  window.addEventListener('blur',()=>{if(active&&!finished)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&active&&!finished)pause();});
  return{start,exit,get active(){return active;},dispose:exit};
}
