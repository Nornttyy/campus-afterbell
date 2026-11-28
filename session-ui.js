import {createRadioUI} from './radio-player93.js?v=campus-117&radio=2&rev=157';
import {RULE_FIELDS,tuningForm,readTuning} from './round-tuning93.js?v=campus-117';
import {SOCIAL_ACTIONS,canEmote} from './social-actions93.js?v=campus-93';
import {readControls,applyTouchStyle,actionForCode,usesTouchControls} from './control-settings64.js?v=campus-93';
// Browser input and presentation only; score, inventory and Snake live on the server.
export function createSessionUI({root,commands}){
  const host=document.createElement('div');host.id='session-ui';host.innerHTML=`<aside class="room-badge"><b id="session-code"></b><span id="session-count"></span><button id="session-mic" aria-label="打开麦克风">麦克风关</button></aside><section id="session-lobby" hidden><b id="session-status"></b><button id="session-bell">开始上课</button></section><dialog id="locker-dialog" class="sheet"><div class="sheet-top"><h2>更衣柜</h2><button id="locker-back">返回</button></div><div class="locker-choices"><button id="locker-student" data-choice="student"><img id="locker-student-image" alt="学生模型" hidden><span>学生</span></button><button id="locker-teacher" data-choice="teacher"><img id="locker-teacher-image" alt="老师模型" hidden><span>男老师</span></button></div></dialog><dialog id="session-settings" class="sheet"><h2>房间设置</h2><div class="round-values"><label>时长 <input id="session-duration" type="number" min="5" max="20" step="1" value="10"> 分钟</label><label>捣蛋目标 <input id="session-target" type="number" min="20" max="160" step="1" value="120"></label><label class="chalk-setting"><input id="session-chalk-stamina" type="checkbox"> 粉笔消耗体力</label><label id="session-capacity-label">人数上限 <input id="session-capacity" type="number" min="2" max="8" value="8"></label></div>${tuningForm('live-rule')}<button id="session-settings-close" class="primary-button">返回</button></dialog><section id="touch-controls" hidden><div id="touch-stick" aria-label="移动"><i></i></div><div id="touch-look" aria-label="拖动转向"></div><button id="touch-emote" aria-label="做动作">动作</button><div class="touch-actions"><button id="touch-e">拿取</button><button id="touch-q">返回</button><button id="touch-use">使用</button><button id="touch-crawl">爬行</button><button id="touch-skill" hidden>技能</button><button id="touch-jump">跳跃</button></div></section><dialog id="actions-dialog" class="sheet campus-actions"><h3>动作</h3><div class="action-choices">${Object.entries(SOCIAL_ACTIONS).map(([id,label],i)=>`<button class="paper-button" data-social="${id}"><small>${i+1}</small>${label}</button>`).join('')}<button class="paper-button" data-social="">收起动作</button></div></dialog>`;root.append(host);
  const elements=new Map();
  const $=selector=>{
    if(!elements.has(selector))elements.set(selector,host.querySelector(selector));
    return elements.get(selector);
  };
  const listen=(el,event,fn)=>{el.addEventListener(event,fn);cleanups.push(()=>el.removeEventListener(event,fn));},cleanups=[];
  let radio;
  const ensureRadio=()=>radio??=createRadioUI(document,()=>Boolean(commands.silent?.()));
  let microphoneError='',computer=false,touchSide=0,touchForward=0,crawl=false,stickId=null,lookId=null,lookPoint=null;
  let settingsOwner=null,settingsStage=null,settingsEditable=true,lockerAllowed=false;const settingsDraft=new Map();
  let actionAllowed=false;
  const actionDialog=$('#actions-dialog');
  function closeActions(){if(actionDialog.open)actionDialog.close();commands.resumeLook?.();}
  function openActions(){if(!actionAllowed||computer)return false;clearTouchInput();commands.unlock?.();actionDialog.showModal();return true;}
  function tap(selector,action){
    const button=$(selector);
    listen(button,'pointerdown',e=>{
      if(e.button>0||button.disabled)return;
      e.preventDefault();action();
    });
    listen(button,'click',e=>{if(!e.detail&&!e.pointerType)action();});
  }
  tap('#touch-emote',openActions);
  for(const b of actionDialog.querySelectorAll('[data-social]'))listen(b,'click',()=>{commands.emote?.(b.dataset.social||null);closeActions();});
  listen(actionDialog,'keydown',e=>{
   const index=Number(e.key)-1,id=Object.keys(SOCIAL_ACTIONS)[index];
   if(id){e.preventDefault();e.stopPropagation();commands.emote?.(id);closeActions();}
   else if(actionForCode(e.code,readControls())==='emote'){e.preventDefault();e.stopPropagation();closeActions();}
  });
  listen(actionDialog,'cancel',e=>{e.preventDefault();closeActions();});
  let roomCapacity=null,hasTuning=false;
  const settingInputs=['#session-duration','#session-target','#session-chalk-stamina','#session-capacity',...RULE_FIELDS.map(f=>'#live-rule-'+f.key)];
  function readSettings(){
    const duration=Number($('#session-duration').value),target=Number($('#session-target').value);
    if(!Number.isInteger(duration)||duration<5||duration>20){$('#session-duration').reportValidity?.();return null;}
    if(!Number.isInteger(target)||target<20||target>160){$('#session-target').reportValidity?.();return null;}
    const tuning=readTuning($,'live-rule');if(!tuning)return null;
    const capacity=Number($('#session-capacity').value);
    if(roomCapacity!==null&&(!Number.isInteger(capacity)||capacity<Number($('#session-capacity').min)||capacity>8)){$('#session-capacity').reportValidity?.();return null;}
    return{duration:duration*60,target,chalkStamina:Boolean($('#session-chalk-stamina').checked),...(hasTuning||Object.keys(tuning).length?{tuning}:{}),...(roomCapacity!==null&&capacity!==roomCapacity?{capacity}:{})};
  }
  function startBell(){if(!settingsEditable)return false;const settings=readSettings();return settings?commands.bell(settings):false;}
  listen($('#session-bell'),'click',startBell);listen($('#session-mic'),'click',()=>commands.mic());
  function closeLocker(){if($('#locker-dialog').open)$('#locker-dialog').close();commands.resumeLook?.();}
  for(const b of host.querySelectorAll('[data-choice]'))listen(b,'click',()=>{if(!lockerAllowed)return;if(commands.preference(b.dataset.choice)!==false)closeLocker();});
  listen($('#locker-dialog'),'cancel',e=>{e.preventDefault();closeLocker();});
  listen($('#locker-back'),'click',closeLocker);
  listen($('#locker-dialog'),'keydown',e=>{if(actionForCode(e.code,readControls())==='return'&&!e.repeat){e.preventDefault();e.stopPropagation();closeLocker();}});
  const settingsButton=document.createElement('button');settingsButton.id='session-settings-open';settingsButton.className='paper-button';settingsButton.textContent='房间设置';settingsButton.hidden=true;
  document.querySelector?.('#pause-dialog')?.append?.(settingsButton);
  function openSettings(){if(!settingsEditable)return false;clearTouchInput();commands.unlock?.();$('#session-settings').showModal();return true;}
  listen(settingsButton,'click',openSettings);
  function closeSettings(){if(settingsEditable){const settings=readSettings();if(!settings)return;commands.configure?.(settings);}$('#session-settings').close();}
  listen($('#session-settings-close'),'click',closeSettings);
  listen($('#session-settings'),'keydown',e=>{if(actionForCode(e.code,readControls())==='return'&&!e.repeat){e.preventDefault();e.stopPropagation();closeSettings();}});
  // A delayed room snapshot must not erase a value between Tab and Start.
  // Keep locally edited fields until this lobby ends; Start sends the final
  // validated pair atomically rather than depending on a prior change ACK.
  for(const id of settingInputs){
    listen($(id),'input',()=>{if(settingsEditable)settingsDraft.set(id,$(id).value);});
    listen($(id),'change',()=>{if(!settingsEditable)return;settingsDraft.set(id,$(id).value);const settings=readSettings();if(settings)commands.configure?.(settings);});
  }
  const coarse=matchMedia('(pointer: coarse)'),fine=matchMedia('(pointer: fine)'),hover=matchMedia('(hover: hover)');
  let touch=null,paused=false;
  const stick=$('#touch-stick'),look=$('#touch-look'),actionPointers=new Map();
  let controlPrefs=readControls();
  function updateMode(){
    const enabled=usesTouchControls(controlPrefs.inputMode,{coarse:coarse.matches,fine:fine.matches,hover:hover.matches,touchPoints:navigator.maxTouchPoints});
    if(touch!==null&&enabled!==touch){clearTouchInput();if(enabled)commands.unlock?.();}
    touch=enabled;
    root.setAttribute('data-input-mode',touch?'mobile':'desktop');
    $('#touch-controls').hidden=!touch||paused;
  }
  function updateControls(event){
    controlPrefs=event?.detail||readControls();applyTouchStyle($('#touch-controls'),controlPrefs);updateMode();
  }
  updateControls();
  if(globalThis.window?.addEventListener)listen(window,'campus-controls-change',updateControls);
  for(const query of [coarse,fine,hover])if(query.addEventListener)listen(query,'change',updateMode);
  function releaseCapture(element,id){if(id!==null&&element.hasPointerCapture?.(id))element.releasePointerCapture(id);}
  // Clear ownership before releasing capture: browsers emit lostpointercapture
  // after a normal pointerup too. That notification must not cancel another hand.
  function clearTouchInput(){
    const oldStick=stickId,oldLook=lookId,actions=[...actionPointers];
    stickId=lookId=null;lookPoint=null;actionPointers.clear();touchSide=touchForward=0;
    crawl=false;$('#touch-crawl').setAttribute('aria-pressed','false');
    stick.firstElementChild.style.transform='';
    releaseCapture(stick,oldStick);releaseCapture(look,oldLook);
    for(const[element,id]of actions)releaseCapture(element,id);
    if(actions.length)commands.cancel?.();
  }
  let activeApp='desktop';
  function updateStick(e){const r=stick.getBoundingClientRect(),dx=e.clientX-r.x-r.width/2,dy=e.clientY-r.y-r.height/2,radius=Math.min(r.width,r.height)*.42,d=Math.max(radius,Math.hypot(dx,dy));touchSide=dx/d;touchForward=-dy/d;stick.firstElementChild.style.transform=`translate(${touchSide*radius*.78}px,${-touchForward*radius*.78}px)`;if(computer)commands.computerStick?.(touchSide,touchForward);}
  listen(stick,'pointerdown',e=>{e.preventDefault();if(stickId!==null)return;stickId=e.pointerId;stick.setPointerCapture(e.pointerId);updateStick(e);});
  listen(stick,'pointermove',e=>{if(e.pointerId===stickId)updateStick(e);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(stick,type,e=>{if(e.pointerId!==stickId)return;stickId=null;touchSide=touchForward=0;if(computer)commands.computerStick?.(0,0);stick.firstElementChild.style.transform='';});
  listen(look,'pointerdown',e=>{e.preventDefault();if(lookId!==null)return;lookId=e.pointerId;lookPoint=[e.clientX,e.clientY];look.setPointerCapture(e.pointerId);});
  listen(look,'pointermove',e=>{if(e.pointerId!==lookId)return;commands.look((e.clientX-lookPoint[0])*1.5*controlPrefs.touch.sensitivity,(e.clientY-lookPoint[1])*1.5*controlPrefs.touch.sensitivity);lookPoint=[e.clientX,e.clientY];});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(look,type,e=>{if(e.pointerId!==lookId)return;lookId=null;lookPoint=null;});
  for(const [id,down,up]of [['#touch-e',()=>commands.interact(),()=>commands.interactEnd()],['#touch-q',()=>commands.return(),()=>commands.returnEnd()],['#touch-use',()=>commands.hold(true),()=>commands.hold(false)]]){
    const b=$(id);
    listen(b,'pointerdown',e=>{e.preventDefault();if(actionPointers.has(b))return;actionPointers.set(b,e.pointerId);b.setPointerCapture(e.pointerId);down();});
    listen(b,'pointerup',e=>{if(actionPointers.get(b)!==e.pointerId)return;actionPointers.delete(b);up();});
    for(const type of ['pointercancel','lostpointercapture'])listen(b,type,e=>{if(actionPointers.get(b)!==e.pointerId)return;clearTouchInput();});
  }
  if(globalThis.window?.addEventListener)listen(window,'blur',clearTouchInput);
  if(document.addEventListener)listen(document,'visibilitychange',()=>{if(document.hidden)clearTouchInput();});
  tap('#touch-skill',()=>{if(touch&&!computer)commands.skill?.();});
  tap('#touch-jump',()=>{if(touch&&!computer)commands.jump?.();});
  tap('#touch-crawl',()=>{crawl=!crawl;$('#touch-crawl').setAttribute('aria-pressed',String(crawl));});
  return{openActions,get touch(){return touch;},startBell,openSettings,setActionLabels(open,close){$('#touch-e').textContent=open?.label||'交互';$('#touch-q').textContent=close?.label||'返回';},get modal(){return actionDialog.open||$('#locker-dialog').open||$('#session-settings').open;},setMicrophoneError(message){microphoneError=String(message||'');$('#session-mic').title=microphoneError;},axes:()=>({side:touchSide,forward:touchForward,crawl}),get computer(){return computer;},openLocker(){if(!lockerAllowed)return false;clearTouchInput();commands.suspend?.();commands.unlock();const previews=commands.previews?.();for(const role of ['student','teacher'])if(previews?.[role]){const image=$('#locker-'+role+'-image');image.src=previews[role];image.hidden=false;}$('#locker-dialog').showModal();return true;},update(s,round){if(s.radio||s.map==='playground'&&['seating','class'].includes(s.stage))ensureRadio().update(s);else radio?.update(s);actionAllowed=s.status==='playing'&&['gathering','class'].includes(s.stage)&&canEmote(s.player)&&!s.paused;
  $('#touch-emote').hidden=!actionAllowed;if(!actionAllowed&&actionDialog.open)actionDialog.close();if(s.paused)clearTouchInput();const r=round.room;$('.room-badge').hidden=!r;$('#session-code').textContent=r?'房间 '+r.code:'';$('#session-count').textContent=r?`${r.members.length} / ${r.maxPlayers||8}`:'';$('#session-mic').textContent=microphoneError?'麦克风不可用':round.voice?.enabled?'麦克风开':'麦克风关';$('#session-mic').setAttribute('aria-label',round.voice?.enabled?'关闭麦克风':'打开麦克风');const lobby=s.stage==='gathering';$('#session-lobby').hidden=!lobby||!r;$('#session-status').textContent=lobby&&r?(r.members.length<2?'等待同学加入':'在更衣柜选择身份'):'';const settings=r?.settings||s.settings||{duration:600,target:120},editable=lobby&&s.status==='playing'&&s.elevator?.phase!=='travel'&&(!r||r.hostId===r.selfId);lockerAllowed=lobby&&s.status==='playing'&&s.elevator?.phase!=='travel';settingsButton.hidden=!editable;for(const role of ['student','teacher'])$('#locker-'+role).setAttribute('aria-pressed',String((s.lobbyRole||s.role)===role));if(!editable&&$('#session-settings').open)$('#session-settings').close();if(!lockerAllowed&&$('#locker-dialog').open)closeLocker();if(settingsOwner!==round||!editable||settingsStage!=='gathering'&&lobby)settingsDraft.clear();settingsOwner=round;settingsStage=s.stage;settingsEditable=editable;roomCapacity=r?.maxPlayers??null;hasTuning=Boolean(settings.tuning);
    $('#session-capacity-label').hidden=roomCapacity===null;$('#session-capacity').min=String(Math.max(2,r?.members?.length||2));
    for(const[id,value]of[...RULE_FIELDS.map(f=>['#live-rule-'+f.key,settings.tuning?.[f.key]??f.initial]),['#session-capacity',roomCapacity??8],['#session-duration',settings.duration/60],['#session-target',settings.target],['#session-chalk-stamina',settings.chalkStamina===true]]){const input=$(id);input.readOnly=!editable;if(id==='#session-chalk-stamina'){input.disabled=!editable;if(!settingsDraft.has(id))input.checked=value;}else if(!settingsDraft.has(id)&&document.activeElement!==input&&String(input.value)!==String(value))input.value=value;}$('#session-bell').hidden=!r||r.hostId!==r.selfId;$('#session-bell').disabled=!!r&&r.members.length<2;computer=!!s.player.computerActive;activeApp=s.player.computer?.app||'desktop';$('#touch-e').hidden=computer;$('#touch-q').hidden=computer;$('#touch-use').textContent=computer?({desktop:'打开',miner:'下钩',tetris:'落底',snake:'重玩'}[activeApp]||'使用'):'使用';const skillButton=$('#touch-skill');skillButton.hidden=computer||s.role!=='teacher'||s.stage!=='class';skillButton.disabled=(s.teacher?.skillCooldown||0)>0;skillButton.textContent=skillButton.disabled?Math.ceil(s.teacher?.skillCooldown)+'秒':s.teacher?.variant==='doubao'?'竖劈':'黑板擦';$('#touch-jump').hidden=computer;$('#touch-crawl').hidden=computer;$('#touch-crawl').textContent=s.role==='teacher'?'奔跑':'爬行';paused=!!s.paused;$('#touch-controls').hidden=!touch||paused;},reset(){radio?.reset();clearTouchInput();settingsDraft.clear();settingsOwner=null;settingsStage=null;settingsEditable=true;lockerAllowed=false;settingsButton.hidden=true;microphoneError='';$('#session-mic').title='';touchSide=touchForward=0;crawl=false;stickId=lookId=null;lookPoint=null;stick.firstElementChild.style.transform='';$('#touch-crawl').setAttribute('aria-pressed','false');computer=false;host.querySelectorAll('dialog[open]').forEach(d=>d.close());},dispose(){radio?.dispose();clearTouchInput();cleanups.forEach(f=>f());settingsButton.remove();host.remove();}};
}
