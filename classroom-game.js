import {soundForEvent,createTeacherFootsteps} from './audio-events69.js?v=campus-83';
import {readControls,actionForCode,keyLabel} from './control-settings64.js?v=campus-83';
import {createReferenceHUD} from './reference-hud54.js?v=campus-83';
import {interactionIntent} from './interaction-intent54.js?v=campus-83';
import {createSessionUI} from './session-ui.js?v=campus-83';
import {bindHeldUseInput} from './held-use-input.js?v=campus-83';
import {createVisionEffects} from './vision-effects.js?v=campus-83';

import {createSoloRound,switchSoloRole} from './solo-round.js?v=campus-83';
import {referenceNotice} from './reference-notices55.js?v=campus-83';

// Input/UI only. Perception, movement and team results live in rules.
export function createClassroomGame({scene,audio,onExit,round:providedRound=null,sessionFactory=createSessionUI}){
  let round=providedRound||createSoloRound(),externalRound=providedRound,options={role:'student',map:'classroom'};
  const $=s=>document.querySelector(s),ui=$('#play-ui'),canvas=$('#classroom');
  const pauseDialog=$('#pause-dialog'),resultDialog=$('#result-dialog');
  let controls=readControls();
  const refreshControls=()=>{release();stopMovement();controls=readControls();};
  window.addEventListener('campus-controls-change',refreshControls);
  const referenceHUD=createReferenceHUD({document,root:ui,bindings:()=>controls});
  const labels={snack:'零食',drink:'饮料',burger:'汉堡',phone:'手机',smoke:'烟雾弹',flash:'闪光弹',ink:'墨水瓶',computer:'电脑',gum:'泡泡糖',banana:'香蕉',bananaPeel:'香蕉皮',garlic:'大蒜',lunch:'便当',pen:'笔'},keys=new Set(),inputs=new Set(),physicalKeys=new Map();
  const throwables=new Set(['smoke','flash','ink','bananaPeel']),vision=canvas.parentElement&&document.createElement?createVisionEffects(canvas.parentElement):null;
  let active=false,finished=false,raf=0,last=0,lastHud=0,lastEffect=0;
  const teacherFootsteps=createTeacherFootsteps();
  let yaw=0,pitch=0,dragLook=false,dragX=0,dragY=0,feedbackTimer=0,lastFriends='',lastTeacher=null,lastInteractionState=null,lastComputerStick=0,computerStickDirection=null;
  let lastVideoReport=-Infinity,lastVideoPlaying=false;
  function stopVideoWatching(){round.setComputerPlayback?.({playing:false,visible:false,mediaTime:0});lastVideoPlaying=false;lastVideoReport=-Infinity;}
  function reportVideoWatching(state,now){
    const playback=scene.getComputerPlayback?.(),visible=!!(active&&!finished&&!state.paused&&!document.hidden&&state.role==='student'&&state.player.computerActive&&state.player.computer?.app==='valorant'&&playback?.visible);
    const mediaTime=Number(playback?.mediaTime),playing=visible&&!!playback?.playing&&Number.isFinite(mediaTime)&&mediaTime>=0;
    if(playing!==lastVideoPlaying||playing&&now-lastVideoReport>=250){round.setComputerPlayback?.({playing,visible,mediaTime:Number.isFinite(mediaTime)&&mediaTime>=0?mediaTime:0});lastVideoPlaying=playing;lastVideoReport=now;}
  }
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function release(){if(round.player.mapActivity?.kind==='plunge')round.releaseMapActivity();stopVideoWatching();inputs.clear();round.hold(false);round.setRescue(null);round.setWriting?.(false);round.setDoorUse?.(false);}
  function setPosture(value){return round.player.id===-1?round.setSprint?.(value):round.setCrouch(value);}
  function stopMovement(){keys.clear();physicalKeys.clear();round.setMovement(0,0);setPosture(false);dragLook=false;}
  function unlock(){if(document.pointerLockElement===canvas)document.exitPointerLock();}
  function lock(){if(session?.touch||session?.computer)return;if(document.pointerLockElement===canvas||!canvas.requestPointerLock)return;try{canvas.requestPointerLock()?.catch?.(()=>{});}catch{}}
  const session=sessionFactory({root:ui,commands:{bell:settings=>{if(!round.network&&settings&&round.configureRound?.(settings)===false)return false;return round.startBell?.(round.network?settings:undefined);},mic:toggleMic,configure:settings=>round.configureRound?.(settings),preference:chooseRole,previews:()=>scene.getRolePreviews?.(),suspend:()=>{release();stopMovement();round.pause(true);},resumeLook:()=>{round.pause(false);render(round.snapshot());lock();},unlock,stopComputer:()=>round.stopComputer?.(),app:name=>round.computerApp?.(name),direction:dir=>round.snakeDirection?.(dir),look:(dx,dy)=>look(dx,dy),interact:()=>take(),return:()=>putBack(),returnEnd:()=>round.setDoorUse?.(false),interactEnd:()=>{if(round.player.mapActivity?.kind==='plunge')round.releaseMapActivity();round.setRescue(null);round.setDoorUse?.(false);round.setWriting?.(false);},hold:value=>hold('touch',value),cancel:()=>release()}});
  function chooseRole(role){
    if(round.network)return round.setPreference?.(role);
    const next=switchSoloRole(round,role);if(!next)return false;
    round=next;if(externalRound)externalRound=next;options={...options,role,map:next.map,...next.snapshot().settings};
    yaw=next.player.yaw||0;pitch=next.player.pitch||0;lastInteractionState=null;lastTeacher=null;
    $('#student-controls').hidden=role==='teacher';$('#teacher-controls').hidden=role!=='teacher';render(next.snapshot());return true;
  }
  async function toggleMic(){try{await round.toggleMicrophone?.();session.setMicrophoneError?.('');}catch(e){session.setMicrophoneError?.(e.message);}}
  function look(dx,dy){if(!canInput()||session.computer)return;yaw=(round.player.yaw||0)-dx*.0024;pitch=clamp((round.player.pitch||0)+dy*.0021,-1.15,1.3);round.setLook(yaw,pitch);}
  function fx(kind){audio.effect?.(kind);scene.playFeedback?.(kind);}
  function feedback(text,kind='good',duration=1900){
    clearTimeout(feedbackTimer);const box=$('#round-feedback');box.textContent=text;box.dataset.kind=kind;box.classList.add('pop');
    feedbackTimer=setTimeout(()=>box.classList.remove('pop'),duration);
  }
  function finish(s){
    release();stopMovement();unlock();audio.gameplay=false;audio.apply();fx((s.role==='teacher'?s.status==='lost':s.status==='won')?'bell':'caught');
    $('#result-title').textContent=s.status==='won'?'学生获胜':'老师获胜';$('#result-score').textContent=Math.round(s.score);$('#result-goal').textContent='捣乱值';
    $('#result-detail').textContent=s.status==='won'?'这节课，藏住了。':'捣蛋同学都被找出来了。';
    $('#result-actions').textContent=s.role==='teacher'?`找到 ${s.caughtCount} / ${s.teamSize} 位捣蛋同学`:Object.entries(s.completed).filter(([kind,count])=>count>0&&labels[kind]).map(([kind,count])=>`${labels[kind]} ${count}`).join(' · ');
    const retry=$('#retry-game');retry.textContent=round.network&&round.room.selfId!==round.room.hostId?'等待房主再开一局':'再来一局';retry.disabled=Boolean(round.network&&round.room.selfId!==round.room.hostId);referenceHUD.finish(s);if(!resultDialog.open)resultDialog.showModal();
  }
  function processEvents(){const events=round.drainEvents();if(!events.length)return;const role=round.snapshot().role;for(const e of events){
    if(e.recipientId!=null&&e.recipientId!==round.player.id)continue;
    const notice=referenceNotice(e,role);if(notice)feedback(notice.text,notice.kind);
    if(['food-complete','drink-complete','gum-pop','phone-notification','burp','chalk-hit'].includes(e.type))scene.playWorldEffect?.(e);
    const sound=soundForEvent(e,round.player);if(sound)audio.effect?.(sound.kind,sound.gain);
    if(e.type==='elevator-start'){release();audio.click();}
    if(e.type==='elevator-arrived'){options.map=e.map;audio.effect?.('bell',.35);}
    if(e.type==='school-bell')fx('bell');
    if(e.type==='flash-burst'||e.type==='ink-splash')audio.effect?.(e.type,.6);
    if(e.type==='complete'&&e.studentId===round.player.id&&e.points>0)scene.playFeedback?.('complete');
    if(['flash-throw','ink-throw'].includes(e.type))audio.effect?.('smoke-throw',.4);
    if(['smoke-throw','smoke-impact','smoke-bloom'].includes(e.type)){const p=round.player,dist=Math.hypot(e.x-p.x,e.z-p.z);if(dist<9)audio.effect?.(e.type,Math.max(.12,1-dist/10));}
    if(e.type==='wrong-grab')audio.effect?.('warning');
    if(['gum-score'].includes(e.type)&&e.studentId===round.player.id&&e.points>0)audio.effect?.('gum-score',.5);
    if(['bubble-release','bubble-hit','bubble-attached','rear-door'].includes(e.type))audio.effect?.(e.type==='bubble-attached'?'bubble-hit':e.type,.6);
    if(e.type==='peel-slip')audio.effect?.('banana-slip',.65);if(e.type==='peel-thrown')audio.effect?.('bananaPeel-throw',.4);
    if(e.type==='stunned'&&e.studentId===round.player.id){release();stopMovement();}
    if(e.type==='grabbed'){audio.effect?.('caught');if(e.studentId===round.player.id){release();stopMovement();}}
    if(e.type==='bound'){fx('caught');if(e.studentId===round.player.id){release();stopMovement();}}
    if(e.type==='rescued')audio.effect?.('complete');

  }}
  function playInteractionChanges(s){
    const next={drawer:s.drawer.open,book:s.player.bookRaised,pen:s.player.penTaken,writing:s.player.penWriting,seated:s.player.seated};
    const previous=lastInteractionState;lastInteractionState=next;if(!previous)return;
    // Sound follows the accepted state, including remote server acknowledgments.
    const kind=previous.pen!==next.pen?(next.pen?'pen-pickup':'pen-putdown'):previous.seated!==next.seated?'chair':previous.drawer!==next.drawer?(next.drawer?'drawer-open':'drawer-close'):previous.book!==next.book?(next.book?'book-open':'book-close'):next.pen&&previous.writing!==next.writing?(next.writing?'pen-write':'pen-twirl'):null;
    if(kind)audio.effect?.(kind,.6);
  }
  function playFootsteps(s){const gain=teacherFootsteps.sample(s);if(gain>.002)audio.effect?.('step',gain);}
  function render(s){
    playInteractionChanges(s);
    const p=s.player,teacher=s.role==='teacher',alive=s.teamSize-s.caughtCount;
    const beforeClass=s.stage&&s.stage!=='class',formatTime=n=>`${Math.floor(Math.ceil(n)/60).toString().padStart(2,'0')}:${(Math.ceil(n)%60).toString().padStart(2,'0')}`;
    ui.dataset.stage=s.stage||'class';
    ui.dataset.elevatorPhase=s.elevator?.phase||'idle';ui.dataset.elevatorUsed=String(!!s.elevator?.used);ui.dataset.elevatorRemaining=String(s.elevator?.remaining||0);
    ui.dataset.status=s.status;ui.dataset.phase=s.teacher.phase;ui.dataset.holding=String(s.holding);ui.dataset.score=String(s.score);
    ui.dataset.seated=String(p.seated);ui.dataset.crawling=String(Boolean(p.crouched&&!p.seated));ui.dataset.caught=String(p.caught);ui.dataset.position=`${p.x.toFixed(2)},${p.z.toFixed(2)}`;
    $('#round-clock').textContent=beforeClass?(s.stage==='seating'?'入座 '+formatTime(s.stageTimeLeft):'课前集合'):'已抓捕 '+s.caughtCount+' / '+s.teamSize;
    if(s.elevator?.phase==='travel')$('#round-clock').textContent='';
    const lessonTime=$('#lesson-time');if(lessonTime){lessonTime.hidden=beforeClass;lessonTime.textContent='距离下课 '+formatTime(s.timeLeft||0);}
    const staminaTeacher=(s.stage==='gathering'?(s.lobbyRole||s.role):s.role)==='teacher';
    const stamina=$('#teacher-stamina');if(stamina){stamina.hidden=!staminaTeacher;stamina.dataset.low=String(s.teacher.stamina<25);$('#stamina-number').textContent=Math.ceil(s.teacher.stamina??100)+'%';$('#stamina-fill').style.height=(s.teacher.stamina??100)+'%';stamina.dataset.writing=String(Boolean(s.teacher.writing));}
    ui.dataset.stamina=String(s.teacher.stamina??'');ui.dataset.writing=String(Boolean(s.teacher.writing));$('#round-score').textContent=Math.floor(s.score);$('#round-target').textContent='/ '+s.target;
    $('#score-fill').style.width=clamp(s.score/s.target*100,0,100)+'%';
    ui.dataset.role=s.role;ui.dataset.map=s.map;
    const drawer=s.drawer,carrying=drawer.drawnSlot!==null,target=scene.getInteraction?.(),hover=target?.kind==='item'?target.slot:null;
    ui.dataset.drawerOpen=String(drawer.open);ui.dataset.selectedSlot=String(drawer.selectedSlot);ui.dataset.carrying=String(carrying);
    const openIntent=interactionIntent(s,target,'E'),closeIntent=interactionIntent(s,target,'Q');session.setActionLabels?.(openIntent,closeIntent);
    let actionText='';
    if(target?.kind==='bell')actionText='E 开始上课';
    else if(target?.kind==='lift')actionText=s.elevator?.used?'本局电梯已使用':target.current?'当前楼层':s.elevator&&s.elevator.inside<s.elevator.total?`等待同学 ${s.elevator.inside}/${s.elevator.total}`:round.network&&round.room.selfId!==round.room.hostId?'等待房主选楼层':`E 前往 ${target.floor||''} 层`;
    else if(target?.kind==='locker')actionText='E 更衣柜';
    else if(s.surveillance?.viewing!=null)actionText='Q 关闭监控';
    else if(target?.kind==='surveillance'&&!openIntent){const wait=Math.ceil(s.surveillance?.unlockIn||s.surveillance?.cooldown||0);actionText=wait>0?'监控 · '+formatTime(wait):'监控已用完';}
    else if(p.captivity==='bound')actionText=p.bubble?.blowing?'松手吹出泡泡':'按住左键吹泡泡';
    else if(p.captivity==='stunned'||p.stunLeft>0)actionText='';
    else if(openIntent)actionText=(openIntent.hold?'按住 ':'')+'E '+openIntent.label+(target?.kind==='item'?' '+(labels[drawer.slots[target.slot]?.action]||''):'');
    else if(closeIntent)actionText=(closeIntent.hold?'按住 ':'')+'Q '+closeIntent.label;
    else if(drawer.drawnSlot!=null&&drawer.canReturn===false)actionText='回到原抽屉附近 · Q 放回';
    else if(p.burpReadyLeft>0)actionText='左键 打嗝 · '+Math.ceil(p.burpReadyLeft);
    else if(teacher)actionText='左键 扔粉笔';
    if(session.touch)actionText=actionText.replace(/按住 E/g,'按住拿取').replace(/\bE /g,'拿取 · ').replace(/按住 Q/g,'按住返回').replace(/\bQ /g,'返回 · ').replace(/左键/g,'使用');
    if(!session.touch)actionText=actionText.replace(/左键/g,keyLabel(controls.keys.use));
    $('#interaction-prompt').textContent=actionText;$('#interaction-prompt').hidden=!actionText;
    $('#drawer-hint').textContent='';
    renderUseProgress(s);
    canvas.dataset.carriedItem=carrying?drawer.slots[drawer.drawnSlot]?.action||'':'';
    $('#crosshair').hidden=p.caught||s.paused||session.computer;session.update(s,round);referenceHUD.update(s);scene.setGameplay(s);
  }
  function renderUseProgress(s){
    const ring=$('#use-progress'),rescuing=s.rescue?.id!=null,bubble=s.player.bubble,blowing=Boolean(bubble?.blowing),plunging=s.player.mapActivity?.kind==='plunge',door=s.interaction?.kind==='rear-door',cycles=Number(bubble?.cycles)||0;
    const progress=plunging?s.player.mapActivity.progress:blowing?(cycles>=4?1:cycles-Math.floor(cycles)):door?s.interaction.progress:rescuing?s.rescue.progress:s.actionProgress;
    const visible=!s.paused&&(plunging||blowing||door||rescuing||s.selected!=='pen'&&s.drawer.drawnSlot!==null&&!s.player.caught&&(s.holding||s.actionProgress>0));
    ring.hidden=!visible;ring.dataset.active=String(s.holding);ring.dataset.cycles=String(Math.floor(cycles));ring.setAttribute('aria-valuenow',String(Math.round(clamp(progress,0,1)*100)));
    ring.setAttribute('aria-label',plunging?'疏通进度':blowing?'吹泡泡':door?'开关门':rescuing?'解救进度':throwables.has(s.selected)?'投掷蓄力':'物品使用进度');ring.dataset.charged=String(!blowing&&throwables.has(s.selected)&&s.actionProgress>=1);
    const size=blowing?54+Math.min(4,Math.floor(cycles))*13:54;ring.style.width=size+'px';ring.style.height=size+'px';$('#use-progress-fill').style.strokeDashoffset=String(100-clamp(progress,0,1)*100);
    ui.dataset.useProgress=String(progress);ui.dataset.holding=String(s.holding);ui.dataset.bubbleProgress=String(bubble?.progress||0);ui.dataset.bubbleCooldown=String(bubble?.cooldown||0);
  }

  function movement(){
    // Capture/binding can turn the authoritative player without mouse input.
    // Derive movement from that same heading, including the first rescued frame.
    yaw=round.player.yaw||0;pitch=round.player.pitch||0;
    const touch=session.axes();
    if(session.computer&&!round.paused){
      const direction=Math.max(Math.abs(touch.side),Math.abs(touch.forward))>.55?(Math.abs(touch.side)>Math.abs(touch.forward)?(touch.side>0?'right':'left'):(touch.forward>0?'up':'down')):null;
      const now=performance.now();if(direction&&(direction!==computerStickDirection||now-lastComputerStick>250)){
        const app=round.snapshot().player.computer?.app;if(app==='desktop')round.computerSelect?.(direction);else if(app==='snake')round.snakeDirection?.(direction);lastComputerStick=now;
      }computerStickDirection=direction;
    }else computerStickDirection=null;
    let side=touch.side+(keys.has('right')?1:0)-(keys.has('left')?1:0),forward=touch.forward+(keys.has('forward')?1:0)-(keys.has('back')?1:0);if(session.computer||session.modal||round.paused)side=forward=0;const len=Math.hypot(side,forward)||1;side/=len;forward/=len;
    round.setMovement(Math.sin(yaw)*forward-Math.cos(yaw)*side,Math.cos(yaw)*forward+Math.sin(yaw)*side);setPosture(touch.crawl||keys.has('crawl'));
  }
  function frame(now){
    // The rules already substep at 60 Hz. Preserve ordinary slow-frame time;
    // only a long foreground stall is bounded to avoid an unbounded catch-up.
    if(!active)return;if(round.network&&finished&&round.status==='playing'&&round.snapshot().stage==='gathering'){start(options);return;}raf=requestAnimationFrame(frame);const dt=Math.min(.25,Math.max(0,(now-last)/1000||0));last=now;movement();const s=round.step(dt);reportVideoWatching(s,now);processEvents();renderUseProgress(s);vision?.update(s);

    playFootsteps(s);
    if(now-lastHud>80){lastHud=now;render(s);}else scene.setGameplay(s);
    if(s.status!=='playing'&&!finished){finished=true;render(s);finish(s);}
  }
  function start(nextOptions){
    if(nextOptions?.role)options={role:nextOptions.role==='teacher'?'teacher':'student',map:nextOptions.map||'classroom',duration:nextOptions.duration||600,target:nextOptions.target||120,character:nextOptions.character||options.character};
    else if(active)options={...options,...round.snapshot().settings};
    if(!externalRound)round=createSoloRound(options);
    cancelAnimationFrame(raf);if(pauseDialog.open)pauseDialog.close();if(resultDialog.open)resultDialog.close();release();keys.clear();session.reset();teacherFootsteps.reset();round.reset(Date.now()>>>0);if(!round.network&&options.character){round.player.character=options.character;round.player.variant=options.character;}round.start({gathering:!externalRound||nextOptions?.gathering===true});yaw=round.player.yaw||0;pitch=round.player.pitch||0;round.setLook(yaw,pitch);
    active=true;finished=false;lastFriends='';lastTeacher=null;lastInteractionState=null;document.body.classList.add('playing');ui.hidden=false;$('#menu').inert=true;$('#menu').setAttribute('aria-hidden','true');
    $('#speech').hidden=true;$('#round-feedback').classList.remove('pop');
    $('#student-controls').hidden=round.snapshot().role==='teacher';$('#teacher-controls').hidden=round.snapshot().role!=='teacher';
    audio.gameplay=true;audio.apply();audio.start();render(round.snapshot());last=performance.now();raf=requestAnimationFrame(frame);canvas.focus({preventScroll:true});lock();
  }
  function exit(){
    active=false;release();stopMovement();unlock();session.reset();if(round.network){round.leave();externalRound=null;}cancelAnimationFrame(raf);clearTimeout(feedbackTimer);if(pauseDialog.open)pauseDialog.close();if(resultDialog.open)resultDialog.close();
    audio.gameplay=false;audio.apply();vision?.update(null);scene.setGameplay(null);ui.hidden=true;document.body.classList.remove('playing');$('#menu').inert=false;$('#menu').removeAttribute('aria-hidden');onExit?.();
  }
  function pause(value=true){if(!active||finished)return;release();stopMovement();round.pause(value);if(value){unlock();if(!pauseDialog.open)pauseDialog.showModal();}else{if(pauseDialog.open)pauseDialog.close();lock();}render(round.snapshot());}
  const canInput=()=>active&&!finished&&!session.modal&&!session.computer&&!round.paused&&round.status==='playing';
  function hold(id,value){if(!canInput())return;if(value&&round.player.burpReadyLeft>0){round.burp?.();return;}if(value){if(round.hold(true))inputs.add(id);}else{const wasHeld=inputs.delete(id);if(wasHeld&&!inputs.size)round.releaseUse();}render(round.snapshot());}
  function applyIntent(key){
    if(!active||finished||round.paused||round.status!=='playing')return false;
    const intent=interactionIntent(round.snapshot(),scene.getInteraction?.(),key);if(!intent)return false;
    // Cancel consumption without releasing a charged throwable. Then perform
    // precisely one semantic command; a false result never falls through.
    if(key==='Q')release();
    const result=round[intent.method]?.(...intent.args);processEvents();render(round.snapshot());
    if(result!==false){if(!round.snapshot().player.computerActive)lock();}
    return result;
  }
  function take(){
    if(session.computer){round.computerConfirm?.();return;}if(!canInput())return;lock();const s=round.snapshot(),target=scene.getInteraction?.();
    if(target?.kind==='bell'){if(session.startBell)session.startBell();else round.startBell?.();return;}
    if(target?.kind==='lift'){if(s.elevator?.disabled!==false||s.stage!=='gathering'||target.current)return;round.travelFloor?.(target.map);processEvents();render(round.snapshot());return;}
    if(target?.kind==='locker'){if(s.stage==='gathering')session.openLocker();return;}
    applyIntent('E');
  }
  function putBack(){return applyIntent('Q');}
  const heldInput=bindHeldUseInput({canvas,document,window,canInput:()=>canInput()&&controls.keys.use==='Mouse0',onHold:value=>hold('pointer',value),onRelease:release,onLock:lock});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{if(e.button===2&&canInput()){release();dragLook=true;dragX=e.clientX;dragY=e.clientY;}});window.addEventListener('pointerup',e=>{if(e.button===2)dragLook=false;});
  document.addEventListener('mousemove',e=>{if(session.computer||!canInput()||(!dragLook&&document.pointerLockElement!==canvas))return;const locked=document.pointerLockElement===canvas,dx=locked?e.movementX:e.clientX-dragX,dy=locked?e.movementY:e.clientY-dragY;dragX=e.clientX;dragY=e.clientY;yaw=(round.player.yaw||0)-dx*.0024;pitch=clamp((round.player.pitch||0)+dy*.0021,-1.15,1.3);round.setLook(yaw,pitch);});
  document.addEventListener('pointerlockchange',()=>{document.body.classList.toggle('mouse-locked',document.pointerLockElement===canvas);});
  $('#pause-game').addEventListener('click',()=>pause());$('#resume-game').addEventListener('click',()=>pause(false));
  $('#restart-game').addEventListener('click',start);$('#retry-game').addEventListener('click',async()=>{if(!round.network){start();return;}if(round.room.selfId!==round.room.hostId)return;try{await round.rematch();start(options);}catch(e){$('#result-detail').textContent=e.message;}});$('#leave-game').addEventListener('click',exit);$('#result-menu').addEventListener('click',exit);
  pauseDialog.addEventListener('cancel',e=>{e.preventDefault();pause(false);});resultDialog.addEventListener('cancel',e=>{e.preventDefault();exit();});
  document.addEventListener('keydown',e=>{
    if(!active||pauseDialog.open||resultDialog.open||session.modal||document.querySelector('#settings-dialog')?.open)return;
    const action=actionForCode(e.code,controls);
    if(action==='pause'){e.preventDefault();pause();return;}
    if(action==='mic'&&!e.repeat){e.preventDefault();toggleMic();return;}
    if(session.computer){const dirs={forward:'up',back:'down',left:'left',right:'right'},direction=dirs[action]||({ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'})[e.code];if(direction){e.preventDefault();if(round.snapshot().player.computer?.app==='desktop')round.computerSelect?.(direction);else if(round.snapshot().player.computer?.app==='snake')round.snakeDirection?.(direction);return;}if(action==='interact'&&!e.repeat){e.preventDefault();round.computerConfirm?.();}if(action==='return'&&!e.repeat){e.preventDefault();putBack();}return;}
    if(action){e.preventDefault();physicalKeys.set(e.code,action);keys.add(action);if(e.repeat)return;if(action==='interact')take();else if(action==='return')putBack();else if(action==='use'){lock();hold('keyboard',true);}}
  });
  document.addEventListener('keyup',e=>{const action=physicalKeys.get(e.code)||actionForCode(e.code,controls);physicalKeys.delete(e.code);if(![...physicalKeys.values()].includes(action))keys.delete(action);if(action==='crawl')setPosture(keys.has('crawl'));if(action==='use')hold('keyboard',false);if(action==='return')round.setDoorUse?.(false);if(action==='interact'){if(round.player.mapActivity?.kind==='plunge')round.releaseMapActivity();round.setRescue(null);round.setWriting?.(false);round.setDoorUse?.(false);}});
  window.addEventListener('blur',()=>{if(active&&!finished)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&active&&!finished)pause();});
  return{start,exit,setRound(value){externalRound=value;round=value;},get active(){return active;},dispose(){exit();window.removeEventListener('campus-controls-change',refreshControls);heldInput.dispose();vision?.dispose();session.dispose();referenceHUD.dispose();}};
}
