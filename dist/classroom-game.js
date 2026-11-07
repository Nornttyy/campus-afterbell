import {bindHeldUseInput} from './held-use-input.js?v=map-30d';
import {ClassroomRound} from './classroom-rules.js?v=map-30d';

import {TeacherRound} from './teacher-rules.js?v=map-30d';

// Input/UI only. Perception, movement and team results live in rules.
export function createClassroomGame({scene,audio,onExit,round:providedRound=null}){
  let round=providedRound||new ClassroomRound(),options={role:'student',map:'classroom'};
  const $=s=>document.querySelector(s),ui=$('#play-ui'),canvas=$('#classroom');
  const pauseDialog=$('#pause-dialog'),resultDialog=$('#result-dialog');
  const labels={snack:'零食',note:'纸条',phone:'手机',smoke:'烟雾弹'},keys=new Set(),inputs=new Set();
  let active=false,finished=false,raf=0,last=0,lastHud=0,lastEffect=0,lastFootstep=0;
  let yaw=0,pitch=0,dragLook=false,dragX=0,dragY=0,captionTimer=0,feedbackTimer=0,hintTimer=0,lastFriends='',lastTeacher=null;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function release(){inputs.clear();round.hold(false);round.setRescue(null);}
  function stopMovement(){keys.clear();round.setMovement(0,0);round.setCrouch(false);dragLook=false;}
  function unlock(){if(document.pointerLockElement===canvas)document.exitPointerLock();}
  function lock(){if(document.pointerLockElement===canvas||!canvas.requestPointerLock)return;try{canvas.requestPointerLock()?.catch?.(()=>{});}catch{}}
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
    release();stopMovement();unlock();audio.gameplay=false;audio.apply();fx((s.role==='teacher'?s.status==='lost':s.status==='won')?'bell':'caught');
    $('#result-title').textContent=s.status==='won'?'学生获胜':'老师获胜';$('#result-score').textContent=Math.round(s.score);$('#result-goal').textContent='捣乱值';
    $('#result-detail').textContent=s.status==='won'?'这节课，藏住了。':'捣蛋同学都被找出来了。';
    $('#result-actions').textContent=s.role==='teacher'?`找到 ${s.caughtCount} / ${s.teamSize} 位捣蛋同学`:`零食 ${s.completed.snack} · 纸条 ${s.completed.note} · 手机 ${s.completed.phone}`+(s.map==='computer'?` · 电脑 ${s.completed.computer}`:'');
    if(!resultDialog.open)resultDialog.showModal();
  }
  function processEvents(){for(const e of round.drainEvents()){
    if(e.type==='complete'&&e.actor==='player'&&e.action!=='smoke'){fx('complete');feedback('+'+(e.points??''));}
    if(['smoke-throw','smoke-impact','smoke-bloom'].includes(e.type)){const p=round.player,dist=Math.hypot(e.x-p.x,e.z-p.z);if(dist<9)audio.effect?.(e.type,Math.max(.12,1-dist/10));}
    if(e.type==='chalk'||e.type==='chalk-throw')fx('warning');
    if(e.type==='chalk-hit')audio.effect?.('note');
    if(e.type==='wrong-grab'){audio.effect?.('warning');feedback('这位同学没有捣乱','bad');}
    if(e.type==='stunned'&&e.studentId===round.player.id){release();stopMovement();feedback('被粉笔击中','bad');}
    if(e.type==='grabbed'){audio.effect?.('caught');if(e.studentId===round.player.id){release();stopMovement();feedback('被抓住了','bad');}}
    if(e.type==='bound'){fx('caught');if(e.studentId===round.player.id){release();stopMovement();feedback('等待队友解救','bad');}}
    if(e.type==='rescued'){audio.effect?.('complete');if(e.studentId===round.player.id)feedback('获救了');else if(e.rescuerId===round.player.id)feedback('已解救');}
    // Factual world events, not canned spoken conversations.
    if(e.type==='observation'&&e.public===true)caption(e.text,e.speaker||'');

  }}
  function render(s){
    const p=s.player,teacher=s.role==='teacher',alive=s.teamSize-s.caughtCount;
    ui.dataset.status=s.status;ui.dataset.phase=s.teacher.phase;ui.dataset.holding=String(s.holding);ui.dataset.score=String(s.score);
    ui.dataset.seated=String(p.seated);ui.dataset.caught=String(p.caught);ui.dataset.position=`${p.x.toFixed(2)},${p.z.toFixed(2)}`;
    $('#round-clock').textContent=alive+' / 5';$('#round-score').textContent=Math.floor(s.score);$('#round-target').textContent='/ '+s.target;
    $('#score-fill').style.width=clamp(s.score/s.target*100,0,100)+'%';
    ui.dataset.role=s.role;ui.dataset.map=s.map;
    const drawer=s.drawer,carrying=drawer.drawnSlot!==null,target=scene.getInteraction?.(),hover=target?.kind==='item'?target.slot:null;
    ui.dataset.drawerOpen=String(drawer.open);ui.dataset.selectedSlot=String(drawer.selectedSlot);ui.dataset.carrying=String(carrying);
    const deskPrompt=target?.kind==='book'?`E ${p.bookRaised?'放下':'竖起'}书本`:target?.kind==='desk'?`E ${drawer.open?'收起':'打开'}课桌`:'';
    const needsSeat=carrying&&!p.seated&&s.selected!=='smoke';
    const actionText=target?.kind==='lift'?(target.current?'当前楼层':`E 前往 ${{classroom:'1F',night:'2F',tiered:'3F',computer:'4F'}[target.map]}（新一局）`):teacher?(s.teacher.carriedId!==null?(s.bindPost!==null?'E 绑到木桩 · Q 放下':'带到木桩 · Q 放下'):target?.grabReady?'E 抓住同学':'左键投粉笔'):
      p.captivity==='bound'?'等待队友解救':p.captivity==='carried'?'被抓住了':p.captivity==='stunned'?'眩晕中':
      target?.kind==='rescue'?'按住 E 解救同学':p.computerActive?'按住左键玩电脑 · Q 切回课件':target?.kind==='computer'?'E 打开电脑游戏':hover!==null?`E 拿取 ${labels[drawer.slots[hover]?.action]||''}`:(carrying?(needsSeat?'坐下后使用 · 空格坐下':s.selected==='smoke'?(s.holding?'松手抛出':'点击抛出 · 长按蓄力'):'按住左键使用')+(p.seated?'  ·  Q 放回':''):deskPrompt);
    $('#interaction-prompt').textContent=actionText;$('#interaction-prompt').hidden=!actionText;
    $('#drawer-hint').textContent='';
    renderUseProgress(s);
    canvas.dataset.carriedItem=carrying?drawer.slots[drawer.drawnSlot]?.action||'':'';
    $('#crosshair').hidden=p.caught||s.paused;scene.setGameplay(s);
  }
  function renderUseProgress(s){
    const ring=$('#use-progress'),rescuing=s.rescue?.id!=null,progress=rescuing?s.rescue.progress:s.actionProgress,visible=rescuing||(s.drawer.drawnSlot!==null||s.player.computerActive)&&!s.player.caught&&!s.paused&&(s.holding||s.actionProgress>0);
    ring.hidden=!visible;ring.dataset.active=String(s.holding);ring.setAttribute('aria-valuenow',String(Math.round(progress*100)));
    ring.setAttribute('aria-label',rescuing?'解救进度':s.selected==='smoke'?'投掷蓄力':'物品使用进度');ring.dataset.charged=String(s.selected==='smoke'&&s.actionProgress>=1);
    $('#use-progress-fill').style.strokeDashoffset=String(100-progress*100);
    ui.dataset.useProgress=String(s.actionProgress);ui.dataset.holding=String(s.holding);
  }
  function movement(){
    let side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);const len=Math.hypot(side,forward)||1;side/=len;forward/=len;
    round.setMovement(Math.sin(yaw)*forward-Math.cos(yaw)*side,Math.cos(yaw)*forward+Math.sin(yaw)*side);round.setCrouch(keys.has('KeyC')||keys.has('ControlLeft'));
  }
  function frame(now){
    if(!active)return;raf=requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000||0);last=now;movement();round.step(dt);const s=round.snapshot();processEvents();renderUseProgress(s);
    if(s.status==='playing'&&!s.paused&&s.holding&&now-lastEffect>780){audio.effect?.(s.selected);lastEffect=now;}
    const t=s.teacher;if(s.status==='playing'&&!s.paused&&lastTeacher&&Math.hypot(t.x-lastTeacher.x,t.z-lastTeacher.z)>.001&&now-lastFootstep>520){audio.effect?.('step');lastFootstep=now;}lastTeacher={x:t.x,z:t.z};
    if(now-lastHud>80){lastHud=now;render(s);}else scene.setGameplay(s);
    if(s.status!=='playing'&&!finished){finished=true;render(s);finish(s);}
  }
  function start(nextOptions){
    if(nextOptions?.role)options={role:nextOptions.role==='teacher'?'teacher':'student',map:nextOptions.map||'classroom'};
    if(!providedRound)round=options.role==='teacher'?new TeacherRound({map:options.map}):new ClassroomRound({map:options.map});
    cancelAnimationFrame(raf);if(pauseDialog.open)pauseDialog.close();if(resultDialog.open)resultDialog.close();release();keys.clear();round.reset(Date.now()>>>0);round.start();yaw=round.player.yaw||0;pitch=round.player.pitch||0;round.setLook(yaw,pitch);
    active=true;finished=false;lastFriends='';lastTeacher=null;document.body.classList.add('playing');ui.hidden=false;$('#menu').inert=true;$('#menu').setAttribute('aria-hidden','true');
    $('#speech').hidden=true;$('#round-feedback').classList.remove('pop');
    $('#student-controls').hidden=round.snapshot().role==='teacher';$('#teacher-controls').hidden=round.snapshot().role!=='teacher';
    audio.gameplay=true;audio.apply();audio.start();fx('bell');render(round.snapshot());last=performance.now();raf=requestAnimationFrame(frame);canvas.focus({preventScroll:true});lock();
  }
  function exit(){
    active=false;release();stopMovement();unlock();cancelAnimationFrame(raf);clearTimeout(captionTimer);clearTimeout(feedbackTimer);clearTimeout(hintTimer);if(pauseDialog.open)pauseDialog.close();if(resultDialog.open)resultDialog.close();
    audio.gameplay=false;audio.apply();scene.setGameplay(null);ui.hidden=true;document.body.classList.remove('playing');$('#menu').inert=false;$('#menu').removeAttribute('aria-hidden');onExit?.();
  }
  function pause(value=true){if(!active||finished)return;release();stopMovement();round.pause(value);if(value){unlock();if(!pauseDialog.open)pauseDialog.showModal();}else{if(pauseDialog.open)pauseDialog.close();lock();}render(round.snapshot());}
  const canInput=()=>active&&!finished&&!round.snapshot().paused;
  function hold(id,value){if(!canInput())return;if(value){if(round.hold(true))inputs.add(id);}else{const wasHeld=inputs.delete(id);if(wasHeld&&!inputs.size)round.releaseUse();}render(round.snapshot());}
  function take(){if(!canInput())return;lock();const liftTarget=scene.getInteraction?.();if(liftTarget?.kind==='lift'){if(liftTarget.current)return;const next=liftTarget.map;start({role:round.snapshot().role,map:next});Object.assign(round.player,{x:7.15,z:-8.05,yaw:0,pitch:0,seated:false,seatId:null});yaw=0;pitch=0;round.setLook(yaw,pitch);round.setMovement(0,0);render(round.snapshot());return;}if(round.snapshot().role==='teacher'){if(round.snapshot().teacher.carriedId!==null)round.bindStudent();else round.grabStudent();processEvents();render(round.snapshot());return;}const target=scene.getInteraction?.();if(target?.kind==='rescue'){round.setRescue(target.id);render(round.snapshot());return;}if(target?.kind==='computer'){if(round.startComputer()){audio.click();render(round.snapshot());}return;}if(target?.kind==='book'){if(round.toggleBook()){audio.click();render(round.snapshot());}return;}if(target?.kind==='desk'){toggleDrawer();return;}if(target?.kind==='item'&&round.takeSlot(target.slot)){audio.click();render(round.snapshot());}}
  function putBack(){if(!canInput())return;release();if(round.snapshot().role==='teacher'){round.dropStudent();processEvents();render(round.snapshot());return;}if(round.stopComputer()||round.returnItem()){lock();audio.click();render(round.snapshot());}}
  function interact(){if(!canInput())return;round.interact();if(!round.snapshot().player.seated)lock();render(round.snapshot());}
  function toggleDrawer(){if(!canInput()||!round.toggleDrawer())return;release();lock();audio.click();render(round.snapshot());}
  const heldInput=bindHeldUseInput({canvas,document,window,canInput,onHold:value=>hold('pointer',value),onRelease:release,onLock:lock});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{if(e.button===2&&canInput()){release();dragLook=true;dragX=e.clientX;dragY=e.clientY;}});window.addEventListener('pointerup',e=>{if(e.button===2)dragLook=false;});
  document.addEventListener('mousemove',e=>{if(!canInput()||(!dragLook&&document.pointerLockElement!==canvas))return;const locked=document.pointerLockElement===canvas,dx=locked?e.movementX:e.clientX-dragX,dy=locked?e.movementY:e.clientY-dragY;dragX=e.clientX;dragY=e.clientY;yaw-=dx*.0024;pitch=clamp(pitch+dy*.0021,-1.15,1.3);round.setLook(yaw,pitch);});
  document.addEventListener('pointerlockchange',()=>{document.body.classList.toggle('mouse-locked',document.pointerLockElement===canvas);});
  $('#pause-game').addEventListener('click',()=>pause());$('#resume-game').addEventListener('click',()=>pause(false));
  $('#restart-game').addEventListener('click',start);$('#retry-game').addEventListener('click',start);$('#leave-game').addEventListener('click',exit);$('#result-menu').addEventListener('click',exit);
  pauseDialog.addEventListener('cancel',e=>{e.preventDefault();pause(false);});resultDialog.addEventListener('cancel',e=>{e.preventDefault();exit();});
  document.addEventListener('keydown',e=>{
    if(!active||pauseDialog.open||resultDialog.open)return;if(e.code==='Escape'){e.preventDefault();pause();return;}
    if(['Space','KeyQ','KeyE','KeyW','KeyA','KeyS','KeyD','KeyC','ControlLeft'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.repeat)return;if(e.code==='KeyE')take();else if(e.code==='KeyQ')putBack();else if(e.code==='Space')interact();}
  });
  document.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyE')round.setRescue(null);});
  window.addEventListener('blur',()=>{if(active&&!finished)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&active&&!finished)pause();});
  return{start,exit,get active(){return active;},dispose:exit};
}
