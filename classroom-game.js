import {createSessionUI} from './session-ui.js';
import {bindHeldUseInput} from './held-use-input.js?v=campus-52';
import {createVisionEffects} from './vision-effects.js?v=campus-52';
import {ClassroomRound} from './classroom-rules.js?v=campus-52';

import {TeacherRound} from './teacher-rules.js?v=campus-52';
import {createSoloRound} from './solo-round.js';

// Input/UI only. Perception, movement and team results live in rules.
export function createClassroomGame({scene,audio,onExit,round:providedRound=null,sessionFactory=createSessionUI}){
  let round=providedRound||createSoloRound(),externalRound=providedRound,options={role:'student',map:'classroom'};
  const $=s=>document.querySelector(s),ui=$('#play-ui'),canvas=$('#classroom');
  const pauseDialog=$('#pause-dialog'),resultDialog=$('#result-dialog');
  const labels={snack:'零食',drink:'饮料',burger:'汉堡',note:'纸条',phone:'手机',smoke:'烟雾弹',flash:'闪光弹',ink:'墨水瓶',computer:'电脑',gum:'泡泡糖',banana:'香蕉',bananaPeel:'香蕉皮',garlic:'大蒜',lunch:'便当',pen:'笔'},keys=new Set(),inputs=new Set();
  const throwables=new Set(['smoke','flash','ink','bananaPeel']),vision=canvas.parentElement&&document.createElement?createVisionEffects(canvas.parentElement):null;
  let active=false,finished=false,raf=0,last=0,lastHud=0,lastEffect=0,lastFootstep=0;
  let yaw=0,pitch=0,dragLook=false,dragX=0,dragY=0,captionTimer=0,feedbackTimer=0,hintTimer=0,lastFriends='',lastTeacher=null;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function release(){inputs.clear();round.hold(false);round.setRescue(null);round.setWriting?.(false);round.setDoorUse?.(false);}
  function stopMovement(){keys.clear();round.setMovement(0,0);round.setCrouch(false);dragLook=false;}
  function unlock(){if(document.pointerLockElement===canvas)document.exitPointerLock();}
  function lock(){if(session?.touch||session?.computer)return;if(document.pointerLockElement===canvas||!canvas.requestPointerLock)return;try{canvas.requestPointerLock()?.catch?.(()=>{});}catch{}}
  const session=sessionFactory({root:ui,commands:{bell:()=>round.startBell?.(),mic:async()=>{try{const enabled=await round.toggleMicrophone?.();feedback(enabled?'麦克风已打开':'麦克风已关闭');}catch(e){feedback(e.message,'bad');}},preference:role=>round.setPreference?.(role),resumeLook:()=>lock(),unlock,stopComputer:()=>round.stopComputer?.(),app:name=>round.computerApp?.(name),direction:dir=>round.snakeDirection?.(dir),look:(dx,dy)=>look(dx,dy),interact:()=>take(),interactEnd:()=>{round.setRescue(null);round.setDoorUse?.(false);round.setWriting?.(false);},hold:value=>hold('touch',value),cancel:()=>release()}});
  function look(dx,dy){if(!canInput()||session.computer)return;yaw=(round.player.yaw||0)-dx*.0024;pitch=clamp((round.player.pitch||0)+dy*.0021,-1.15,1.3);round.setLook(yaw,pitch);}
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
    $('#result-actions').textContent=s.role==='teacher'?`找到 ${s.caughtCount} / ${s.teamSize} 位捣蛋同学`:Object.entries(s.completed).filter(([kind,count])=>count>0&&labels[kind]).map(([kind,count])=>`${labels[kind]} ${count}`).join(' · ');
    const retry=$('#retry-game');retry.textContent=round.network&&round.room.selfId!==round.room.hostId?'等待房主再开一局':'再来一局';retry.disabled=Boolean(round.network&&round.room.selfId!==round.room.hostId);if(!resultDialog.open)resultDialog.showModal();
  }
  function processEvents(){for(const e of round.drainEvents()){
    if(e.type==='elevator-denied')feedback(e.message,'bad');
    if(e.type==='elevator-start'){release();stopMovement();audio.click();}
    if(e.type==='elevator-arrived'){options.map=e.map;audio.effect?.('bell',.35);}
    if(e.type==='school-bell')fx('bell');
    if(e.type==='flash-burst'||e.type==='ink-splash')audio.effect?.(e.type,.6);
    if(e.type==='complete'&&e.actor==='player'&&e.points>0&&!throwables.has(e.action)){fx('complete');feedback('+'+(e.points??''));}
    if(['flash-throw','ink-throw'].includes(e.type))audio.effect?.('smoke-throw',.4);
    if(['smoke-throw','smoke-impact','smoke-bloom'].includes(e.type)){const p=round.player,dist=Math.hypot(e.x-p.x,e.z-p.z);if(dist<9)audio.effect?.(e.type,Math.max(.12,1-dist/10));}
    if(e.type==='chalk'||e.type==='chalk-throw')fx('warning');
    if(e.type==='chalk-hit')audio.effect?.('note');
    if(e.type==='wrong-grab'){audio.effect?.('warning');feedback('抓错了 · 体力 −'+(e.penalty??40),'bad');}
    if(e.type==='correct-capture')feedback('抓到了 · 体力 +'+(e.recovery??20));
    if(['gum-score','snake-food'].includes(e.type)&&e.studentId===round.player.id&&e.points>0){feedback('+'+e.points);audio.effect?.('gum-score',.5);}
    if(['gum-pop','bubble-release','bubble-hit','bubble-attached','burp','rear-door'].includes(e.type))audio.effect?.(e.type==='bubble-attached'?'bubble-hit':e.type,.6);
    if(e.type==='peel-slip')audio.effect?.('banana-slip',.65);if(e.type==='peel-thrown')audio.effect?.('bananaPeel-throw',.4);
    if(e.type==='stamina-low')feedback('体力不足','bad');
    if(e.type==='stunned'&&e.studentId===round.player.id){release();stopMovement();feedback('晕倒了','bad');}
    if(e.type==='grabbed'){audio.effect?.('caught');if(e.studentId===round.player.id){release();stopMovement();feedback('被抓住了','bad');}}
    if(e.type==='bound'){fx('caught');if(e.studentId===round.player.id){release();stopMovement();feedback('等待队友解救','bad');}}
    if(e.type==='rescued'){audio.effect?.('complete');if(e.studentId===round.player.id)feedback('获救了');else if(e.rescuerId===round.player.id)feedback('已解救');}
    // Factual world events, not canned spoken conversations.
    if(e.type==='observation'&&e.public===true)caption(e.text,e.speaker||'');

  }}
  function render(s){
    const p=s.player,teacher=s.role==='teacher',alive=s.teamSize-s.caughtCount;
    const beforeClass=s.stage&&s.stage!=='class',formatTime=n=>`${Math.floor(Math.ceil(n)/60).toString().padStart(2,'0')}:${(Math.ceil(n)%60).toString().padStart(2,'0')}`;
    ui.dataset.stage=s.stage||'class';
    ui.dataset.elevatorPhase=s.elevator?.phase||'idle';ui.dataset.elevatorUsed=String(!!s.elevator?.used);ui.dataset.elevatorRemaining=String(s.elevator?.remaining||0);
    ui.dataset.status=s.status;ui.dataset.phase=s.teacher.phase;ui.dataset.holding=String(s.holding);ui.dataset.score=String(s.score);
    ui.dataset.seated=String(p.seated);ui.dataset.crawling=String(Boolean(p.crouched&&!p.seated));ui.dataset.caught=String(p.caught);ui.dataset.position=`${p.x.toFixed(2)},${p.z.toFixed(2)}`;
    $('#round-clock').textContent=beforeClass?(s.stage==='seating'?'入座 '+formatTime(s.stageTimeLeft):'课前集合'):(teacher?'已抓捕 '+s.caughtCount:alive)+' / '+s.teamSize;
    if(s.elevator?.phase==='travel')$('#round-clock').textContent='电梯运行 · '+Math.ceil(s.elevator.remaining)+'秒';
    const lessonTime=$('#lesson-time');if(lessonTime){lessonTime.hidden=beforeClass;lessonTime.textContent='距离下课 '+formatTime(s.timeLeft||0);}
    const stamina=$('#teacher-stamina');if(stamina){stamina.hidden=!teacher||beforeClass;stamina.dataset.low=String(s.teacher.stamina<25);$('#stamina-number').textContent=Math.ceil(s.teacher.stamina??100)+'%';$('#stamina-fill').style.width=(s.teacher.stamina??100)+'%';stamina.dataset.writing=String(Boolean(s.teacher.writing));}
    ui.dataset.stamina=String(s.teacher.stamina??'');ui.dataset.writing=String(Boolean(s.teacher.writing));$('#round-score').textContent=Math.floor(s.score);$('#round-target').textContent='/ '+s.target;
    $('#score-fill').style.width=clamp(s.score/s.target*100,0,100)+'%';
    ui.dataset.role=s.role;ui.dataset.map=s.map;
    const drawer=s.drawer,carrying=drawer.drawnSlot!==null,target=scene.getInteraction?.(),hover=target?.kind==='item'?target.slot:null;
    ui.dataset.drawerOpen=String(drawer.open);ui.dataset.selectedSlot=String(drawer.selectedSlot);ui.dataset.carrying=String(carrying);
    const deskPrompt=target?.kind==='book'?`E ${p.bookRaised?'放下':'竖起'}书本`:target?.kind==='desk'?`E ${drawer.open?'收起':'打开'}课桌`:'';
    const needsSeat=carrying&&!p.seated&&!throwables.has(s.selected);
    let actionText='';
    if(target?.kind==='bell')actionText='E 开始上课';
    else if(target?.kind==='lift')actionText=s.elevator?.used?'本局电梯已使用':target.current?'当前楼层':s.elevator&&s.elevator.inside<s.elevator.total?`等待同学 ${s.elevator.inside}/${s.elevator.total}`:round.network&&round.room.selfId!==round.room.hostId?'等待房主选楼层':`E 前往 ${target.floor||''} 层`;
    else if(target?.kind==='locker')actionText='E 更衣柜';
    else if(target?.kind==='rear-door')actionText='按住 E '+(s.rearDoorClosed?'开门':'关门');
    else if(target?.kind==='office-desk')actionText='E '+(carrying?'放回便当':drawer.open?'收起抽屉':'打开抽屉');
    else if(target?.kind==='chair'||target?.kind==='office-chair')actionText='E '+(p.seated?'起身':'坐下');
    else if(p.captivity==='bound')actionText=p.bubble?.blowing?'松手吹出泡泡':'按住左键吹泡泡';
    else if(p.captivity==='stunned'||p.stunLeft>0)actionText='';
    else if(teacher&&!beforeClass)actionText=s.teacher.carriedId!==null?(s.bindPost!==null?'E 绑到木桩':'E 放下同学'):target?.kind==='release'?'E 释放同学':target?.kind==='blackboard'?'按住 E 写板书':target?.grabReady?'E 抓住同学':'左键投粉笔 · 10 体力';
    else if(target?.kind==='rescue')actionText='按住 E 解救同学';
    else if(p.computerActive)actionText='';
    else if(target?.kind==='computer')actionText='E 打开电脑';
    else if(target?.kind==='pen')actionText='E 拿起笔';
    else if(hover!==null)actionText=`E 拿取 ${labels[drawer.slots[hover]?.action]||''}`;
    else if(carrying&&target?.kind==='desk')actionText='E 放回物品';
    else if(p.burpReadyLeft>0)actionText='左键 打嗝 · '+Math.ceil(p.burpReadyLeft);
    else if(carrying)actionText=s.selected==='pen'?(p.seated?'写字中 · E 放回':'E 放回笔'):throwables.has(s.selected)?'点击抛出 · 长按蓄力':s.selected==='gum'?'按住左键吹泡泡':'按住左键使用';
    else if(deskPrompt)actionText=deskPrompt;
    else if(p.seated)actionText='E 起身';
    if(session.touch)actionText=actionText.replace(/按住 E/g,'按住互动').replace(/\bE /g,'互动 · ').replace(/Q 放回/g,'互动放回').replace(/左键/g,'使用').replace(/点击抛出/g,'轻点使用抛出');
    $('#interaction-prompt').textContent=actionText;$('#interaction-prompt').hidden=!actionText;
    $('#drawer-hint').textContent='';
    renderUseProgress(s);
    canvas.dataset.carriedItem=carrying?drawer.slots[drawer.drawnSlot]?.action||'':'';
    $('#crosshair').hidden=p.caught||s.paused||session.computer;session.update(s,round);scene.setGameplay(s);
  }
  function renderUseProgress(s){
    const ring=$('#use-progress'),rescuing=s.rescue?.id!=null,bubble=s.player.bubble,blowing=Boolean(bubble?.blowing),door=s.interaction?.kind==='rear-door',cycles=Number(bubble?.cycles)||0;
    const progress=blowing?(cycles>=4?1:cycles-Math.floor(cycles)):door?s.interaction.progress:rescuing?s.rescue.progress:s.actionProgress;
    const visible=!s.paused&&(blowing||door||rescuing||s.selected!=='pen'&&s.drawer.drawnSlot!==null&&!s.player.caught&&(s.holding||s.actionProgress>0));
    ring.hidden=!visible;ring.dataset.active=String(s.holding);ring.dataset.cycles=String(Math.floor(cycles));ring.setAttribute('aria-valuenow',String(Math.round(clamp(progress,0,1)*100)));
    ring.setAttribute('aria-label',blowing?'吹泡泡':door?'开关门':rescuing?'解救进度':throwables.has(s.selected)?'投掷蓄力':'物品使用进度');ring.dataset.charged=String(!blowing&&throwables.has(s.selected)&&s.actionProgress>=1);
    const size=blowing?54+Math.min(4,Math.floor(cycles))*13:54;ring.style.width=size+'px';ring.style.height=size+'px';$('#use-progress-fill').style.strokeDashoffset=String(100-clamp(progress,0,1)*100);
    ui.dataset.useProgress=String(progress);ui.dataset.holding=String(s.holding);ui.dataset.bubbleProgress=String(bubble?.progress||0);ui.dataset.bubbleCooldown=String(bubble?.cooldown||0);
  }

  function movement(){
    // Capture/binding can turn the authoritative player without mouse input.
    // Derive movement from that same heading, including the first rescued frame.
    yaw=round.player.yaw||0;pitch=round.player.pitch||0;
    const touch=session.axes();let side=touch.side+(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),forward=touch.forward+(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);if(session.computer||round.paused)side=forward=0;const len=Math.hypot(side,forward)||1;side/=len;forward/=len;
    round.setMovement(Math.sin(yaw)*forward-Math.cos(yaw)*side,Math.cos(yaw)*forward+Math.sin(yaw)*side);round.setCrouch(touch.crawl||keys.has('ShiftLeft')||keys.has('ShiftRight'));
  }
  function frame(now){
    // The rules already substep at 60 Hz. Preserve ordinary slow-frame time;
    // only a long foreground stall is bounded to avoid an unbounded catch-up.
    if(!active)return;if(round.network&&finished&&round.status==='playing'&&round.snapshot().stage==='gathering'){start(options);return;}raf=requestAnimationFrame(frame);const dt=Math.min(.25,Math.max(0,(now-last)/1000||0));last=now;movement();const s=round.step(dt);processEvents();renderUseProgress(s);vision?.update(s);
    if(s.status==='playing'&&!s.paused&&s.holding&&now-lastEffect>780){audio.effect?.(s.player.bubble?.blowing?'blow':s.selected);lastEffect=now;}
    const t=s.teacher;if(s.status==='playing'&&!s.paused&&lastTeacher&&Math.hypot(t.x-lastTeacher.x,t.z-lastTeacher.z)>.001&&now-lastFootstep>520){audio.effect?.('step');lastFootstep=now;}lastTeacher={x:t.x,z:t.z};
    if(now-lastHud>80){lastHud=now;render(s);}else scene.setGameplay(s);
    if(s.status!=='playing'&&!finished){finished=true;render(s);finish(s);}
  }
  function start(nextOptions){
    if(nextOptions?.role)options={role:nextOptions.role==='teacher'?'teacher':'student',map:nextOptions.map||'classroom'};
    if(!externalRound)round=createSoloRound(options);
    cancelAnimationFrame(raf);if(pauseDialog.open)pauseDialog.close();if(resultDialog.open)resultDialog.close();release();keys.clear();round.reset(Date.now()>>>0);round.start({gathering:!externalRound||nextOptions?.gathering===true});yaw=round.player.yaw||0;pitch=round.player.pitch||0;round.setLook(yaw,pitch);
    active=true;finished=false;lastFriends='';lastTeacher=null;document.body.classList.add('playing');ui.hidden=false;$('#menu').inert=true;$('#menu').setAttribute('aria-hidden','true');
    $('#speech').hidden=true;$('#round-feedback').classList.remove('pop');
    $('#student-controls').hidden=round.snapshot().role==='teacher';$('#teacher-controls').hidden=round.snapshot().role!=='teacher';
    audio.gameplay=true;audio.apply();audio.start();render(round.snapshot());last=performance.now();raf=requestAnimationFrame(frame);canvas.focus({preventScroll:true});lock();
  }
  function exit(){
    active=false;release();stopMovement();unlock();session.reset();if(round.network){round.leave();externalRound=null;}cancelAnimationFrame(raf);clearTimeout(captionTimer);clearTimeout(feedbackTimer);clearTimeout(hintTimer);if(pauseDialog.open)pauseDialog.close();if(resultDialog.open)resultDialog.close();
    audio.gameplay=false;audio.apply();vision?.update(null);scene.setGameplay(null);ui.hidden=true;document.body.classList.remove('playing');$('#menu').inert=false;$('#menu').removeAttribute('aria-hidden');onExit?.();
  }
  function pause(value=true){if(!active||finished)return;release();stopMovement();round.pause(value);if(value){unlock();if(!pauseDialog.open)pauseDialog.showModal();}else{if(pauseDialog.open)pauseDialog.close();lock();}render(round.snapshot());}
  const canInput=()=>active&&!finished&&!session.computer&&!round.paused&&round.status==='playing';
  function hold(id,value){if(!canInput())return;if(value&&round.player.burpReadyLeft>0){round.burp?.();return;}if(value){if(round.hold(true))inputs.add(id);}else{const wasHeld=inputs.delete(id);if(wasHeld&&!inputs.size)round.releaseUse();}render(round.snapshot());}
  function take(){
    if(session.computer){round.stopComputer();return;}if(!canInput())return;lock();const s=round.snapshot(),target=scene.getInteraction?.();
    if(target?.kind==='bell'){round.startBell?.();return;}
    if(target?.kind==='lift'){if(s.stage!=='gathering'||target.current)return;round.travelFloor?.(target.map);processEvents();render(round.snapshot());return;}
    if(target?.kind==='locker'){if(s.stage==='gathering')session.openLocker();return;}
    if(target?.kind==='rear-door'){round.setDoorUse?.(true);return;}
    if(target?.kind==='office-desk'){if(s.drawer.drawnSlot!==null)round.returnItem();else round.openOfficeDrawer?.();return;}
    if(target?.kind==='office-chair'){round.interact('office-chair');return;}
    if(target?.kind==='chair'){round.interact(target.id);return;}
    if(s.role==='teacher'&&s.stage==='class'){if(s.teacher.carriedId!==null){if(s.bindPost!==null)round.bindStudent();else round.dropStudent();}else if(target?.kind==='release')round.releaseBoundStudent();else if(target?.kind==='blackboard')round.setWriting(true);else round.grabStudent();processEvents();return;}
    if(target?.kind==='rescue'){round.setRescue(target.id);return;}
    if(s.selected==='pen'&&s.drawer.drawnSlot!==null&&s.player.seated){round.returnItem();return;}
    if(target?.kind==='pen'){round.takePen?.();return;}
    if(target?.kind==='computer'){round.startComputer();return;}
    if(target?.kind==='book'){round.toggleBook();return;}
    if(target?.kind==='desk'){if(s.drawer.drawnSlot!==null)round.returnItem();else toggleDrawer();return;}
    if(target?.kind==='item'){round.takeSlot(target.slot);return;}
    if(s.drawer.drawnSlot!==null)round.returnItem();else round.interact();
    render(round.snapshot());
  }

  function putBack(){if(!canInput())return;release();if(round.snapshot().role==='teacher'){round.dropStudent();processEvents();render(round.snapshot());return;}if(round.stopComputer()||round.returnItem()){lock();audio.click();render(round.snapshot());}}
  function interact(){if(!canInput())return;round.interact();if(!round.snapshot().player.seated)lock();render(round.snapshot());}
  function toggleDrawer(){if(!canInput()||!round.toggleDrawer())return;release();lock();audio.click();render(round.snapshot());}
  const heldInput=bindHeldUseInput({canvas,document,window,canInput,onHold:value=>hold('pointer',value),onRelease:release,onLock:lock});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{if(e.button===2&&canInput()){release();dragLook=true;dragX=e.clientX;dragY=e.clientY;}});window.addEventListener('pointerup',e=>{if(e.button===2)dragLook=false;});
  document.addEventListener('mousemove',e=>{if(session.computer||!canInput()||(!dragLook&&document.pointerLockElement!==canvas))return;const locked=document.pointerLockElement===canvas,dx=locked?e.movementX:e.clientX-dragX,dy=locked?e.movementY:e.clientY-dragY;dragX=e.clientX;dragY=e.clientY;yaw=(round.player.yaw||0)-dx*.0024;pitch=clamp((round.player.pitch||0)+dy*.0021,-1.15,1.3);round.setLook(yaw,pitch);});
  document.addEventListener('pointerlockchange',()=>{document.body.classList.toggle('mouse-locked',document.pointerLockElement===canvas);});
  $('#pause-game').addEventListener('click',()=>pause());$('#resume-game').addEventListener('click',()=>pause(false));
  $('#restart-game').addEventListener('click',start);$('#retry-game').addEventListener('click',async()=>{if(!round.network){start();return;}if(round.room.selfId!==round.room.hostId)return;try{await round.rematch();start(options);}catch(e){feedback(e.message,'bad');}});$('#leave-game').addEventListener('click',exit);$('#result-menu').addEventListener('click',exit);
  pauseDialog.addEventListener('cancel',e=>{e.preventDefault();pause(false);});resultDialog.addEventListener('cancel',e=>{e.preventDefault();exit();});
  document.addEventListener('keydown',e=>{
    if(!active||pauseDialog.open||resultDialog.open||document.querySelector('#locker-dialog[open]'))return;
    if(e.code==='Escape'){e.preventDefault();if(session.computer){round.stopComputer();return;}pause();return;}
    if(e.code==='KeyM'&&!e.repeat){e.preventDefault();round.toggleMicrophone?.().then(v=>feedback(v?'麦克风已打开':'麦克风已关闭')).catch(err=>feedback(err.message,'bad'));return;}
    if(session.computer){const dirs={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};if(dirs[e.code]){e.preventDefault();round.snakeDirection?.(dirs[e.code]);return;}if(e.code==='KeyE'){e.preventDefault();round.stopComputer();}return;}
    if(['KeyE','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.repeat)return;if(e.code==='KeyE')take();}
  });
  document.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='ShiftLeft'||e.code==='ShiftRight')round.setCrouch(keys.has('ShiftLeft')||keys.has('ShiftRight'));if(e.code==='KeyE'){round.setRescue(null);round.setWriting?.(false);round.setDoorUse?.(false);}});
  window.addEventListener('blur',()=>{if(active&&!finished)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&active&&!finished)pause();});
  return{start,exit,setRound(value){externalRound=value;round=value;},get active(){return active;},dispose(){exit();heldInput.dispose();vision?.dispose();session.dispose();}};
}
