import {setupControlSettings} from './control-settings64.js?v=campus-83';
import {prefersMobileRendering,initialQuality} from './render-budget67.js?v=campus-83';
import {playCampusFoley,warmCampusFoley} from './foley-audio54.js?v=campus-83';
import {connectPeerRoom as connectCampusRoom} from './peer-room79.js?v=campus-83';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const KEY = 'campus-afterbell-settings-v1';
const characterNames={boy:'男同学',girl:'女同学',glasses:'眼镜同学',ponytail:'马尾同学'};
const mobileRendering=prefersMobileRendering({coarse:matchMedia('(pointer: coarse)').matches,hover:matchMedia('(hover: hover)').matches,touchPoints:navigator.maxTouchPoints});
const defaults = { sfx:55, muted:false, quality:initialQuality(null,mobileRendering), motion:!matchMedia('(prefers-reduced-motion: reduce)').matches, soundCues:true };
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch {}
const volume = (value, fallback) => Number.isFinite(+value) ? Math.min(100,Math.max(0,+value)) : fallback;
const settings = { ...defaults,soundCues:saved.soundCues!==false, sfx:volume(saved.sfx,55), muted:typeof saved.muted==='boolean'?saved.muted:false, quality:initialQuality(saved.quality,mobileRendering), motion:typeof saved.motion==='boolean'?saved.motion:defaults.motion };
let scene, game, sceneReady=false, worldPromise=null, disposed=false, openingButton=null, entryCharacter='boy',entryMode='online',entryRequest=0,roomConnecting=null;
let roundOptions={duration:Number.isInteger(saved.duration)&&saved.duration>=300&&saved.duration<=1200?saved.duration:600,target:Number.isInteger(saved.target)&&saved.target>=20&&saved.target<=160?saved.target:120,role:'student',map:'classroom',chalkStamina:saved.chalkStamina===true,maxPlayers:Number.isInteger(saved.maxPlayers)&&saved.maxPlayers>=2&&saved.maxPlayers<=8?saved.maxPlayers:8};
Object.assign(settings,{duration:roundOptions.duration,target:roundOptions.target,chalkStamina:roundOptions.chalkStamina,maxPlayers:roundOptions.maxPlayers});
function syncRoundOptions(){
  $('#round-players').value=String(roundOptions.maxPlayers);$('#round-minutes').value=roundOptions.duration/60;$('#round-goal').value=roundOptions.target;$('#round-chalk-stamina').checked=roundOptions.chalkStamina;
}
let toastTimer=0;
function toast(message){ clearTimeout(toastTimer); $('#toast').textContent=message; $('#toast').classList.add('show'); toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600); }
function persist(){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{toast('当前浏览器无法保存设置');}}

class MenuAudio {
  constructor(){this.context=null;this.started=false;}
  async start(){
    try{
      if(!this.context){
        const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
        this.context=new AC();this.fx=this.context.createGain();
        this.cut=this.context.createBiquadFilter();this.cut.type='highpass';this.cut.frequency.value=34;
        this.limiter=this.context.createDynamicsCompressor();this.limiter.threshold.value=-16;this.limiter.knee.value=12;this.limiter.ratio.value=4;this.limiter.attack.value=.004;this.limiter.release.value=.12;
        this.fx.connect(this.cut);this.cut.connect(this.limiter);this.limiter.connect(this.context.destination);this.apply();
      }
      if(this.context.state==='suspended')await this.context.resume();
      this.started=true;if(typeof warmCampusFoley==='function')warmCampusFoley(this);
    }catch{}
  }
  apply(){if(!this.context)return;this.fx.gain.setTargetAtTime(settings.muted?0:settings.sfx/100*.55,this.context.currentTime,.025);}
  click(kind='tap'){if(this.context&&!settings.muted)playCampusFoley(this,['open','back'].includes(kind)?kind:'tap');}
  effect(kind,volume=1){if(this.context&&!settings.muted)playCampusFoley(this,kind,volume);}
  async pause(){if(this.context?.state==='running')try{await this.context.suspend();}catch{}}
  dispose(){this.context?.close();}
}
const audio = new MenuAudio();
function syncSound(){const button=$('#sound-toggle');button.querySelector('use').setAttribute('href',settings.muted?'#i-muted':'#i-audio');button.setAttribute('aria-label',settings.muted?'开启声音':'关闭声音');button.setAttribute('aria-pressed',String(!settings.muted));audio.apply();}
function applySettings(){
  $('#sfx-volume').value=settings.sfx;$('#sfx-output').textContent=settings.sfx+'%';$('#motion-toggle').checked=settings.motion;
  $$('[data-quality]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.quality===settings.quality)));
  document.body.classList.toggle('reduce-motion',!settings.motion);scene?.setQuality(settings.quality);scene?.setMotion(settings.motion);scene?.setSoundCues?.(settings.soundCues);$('#sound-cues-toggle').checked=settings.soundCues;syncSound();
}
function randomStudent(){const names=Object.keys(characterNames);return names[Math.floor(Math.random()*names.length)];}
const controlSettings=setupControlSettings();
function openSheet(id,button){
  if(game?.active)return;for(const open of $$('dialog[open]'))open.close();openingButton=button;const dialog=$(id);
  dialog.showModal();audio.click('open');
}
for(const [button,id] of [['#open-settings','#settings-dialog']])$(button).addEventListener('click',()=>openSheet(id,$(button)));
for(const dialog of $$('#settings-dialog, #room-dialog')){
  dialog.querySelectorAll('.close').forEach(button=>button.addEventListener('click',()=>{audio.click('back');dialog.close();}));
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{if(!game?.active)openingButton?.focus({preventScroll:true});});
}
syncRoundOptions();
$$('[data-quality]').forEach(button=>button.addEventListener('click',()=>{settings.quality=button.dataset.quality;applySettings();persist();}));
for(const type of ['sfx'])$('#'+type+'-volume').addEventListener('input',e=>{settings[type]=Number(e.target.value);$('#'+type+'-output').textContent=settings[type]+'%';audio.apply();persist();});
$('#sound-cues-toggle').addEventListener('change',e=>{settings.soundCues=e.target.checked;applySettings();persist();});
function commitRoomSettings(){
  roundOptions.maxPlayers=Math.round(Math.max(2,Math.min(8,Number($('#round-players').value)||8)));settings.maxPlayers=roundOptions.maxPlayers;
  roundOptions.duration=Math.round(Math.max(5,Math.min(20,Number($('#round-minutes').value)||10)))*60;
  roundOptions.target=Math.round(Math.max(20,Math.min(160,Number($('#round-goal').value)||120)));
  roundOptions.chalkStamina=$('#round-chalk-stamina').checked;settings.chalkStamina=roundOptions.chalkStamina;settings.duration=roundOptions.duration;settings.target=roundOptions.target;syncRoundOptions();persist();
}
for(const id of ['#round-minutes','#round-goal','#round-chalk-stamina','#round-players'])$(id).addEventListener('change',commitRoomSettings);
$('#motion-toggle').addEventListener('change',e=>{settings.motion=e.target.checked;applySettings();persist();});
$('#sound-toggle').addEventListener('click',()=>{settings.muted=!settings.muted;syncSound();persist();});
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('当前浏览器暂不支持全屏');}catch{toast('当前窗口无法全屏，请在浏览器中打开');}});
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').setAttribute('aria-label',document.fullscreenElement?'退出全屏':'全屏');});
function prepareEntry(mode,button){
  if(disposed||game?.active)return;
  entryMode=mode;entryRequest++;
  syncRoundOptions();syncRoomCreation();$('#room-character').textContent='入场随机';
  $('.room-connect').hidden=mode==='solo';$('#room-title').textContent=mode==='solo'?'单人游戏':'多人教室';
  $('#room-error').hidden=true;$('#room-solo').hidden=mode==='solo';syncServerNotice();
  $('#room-enter').textContent=sceneReady?(mode==='solo'?'进入教室':'创建 / 加入房间'):'准备中…';
  $('#room-enter').disabled=!sceneReady;syncServerNotice();
  openSheet('#room-dialog',button);
}
function startGame(){
  if(disposed||game?.active)return;
  prepareEntry('online',$('#enter-classroom'));ensureWorld();
}
async function startSolo(){
  if(disposed||game?.active)return;
  prepareEntry('solo',$('#enter-solo'));const request=entryRequest;
  await ensureWorld();
  if(disposed||request!==entryRequest||entryMode!=='solo'||!$('#room-dialog').open||!sceneReady||!game)return;
  game.setRound(null);$('#room-dialog').close();$('#classroom').hidden=false;
  entryCharacter=randomStudent();scene.setMap(roundOptions.map);scene.setCharacter(entryCharacter);scene.setActive(true);game.start({...roundOptions,character:entryCharacter,solo:true});
}
$('#enter-classroom').addEventListener('click',startGame);
$('#enter-solo').addEventListener('click',startSolo);
let roomEntryKind='create';
function syncRoomCreation(){
  const joining=entryMode==='online'&&(roomEntryKind==='join'||!!$('#room-code').value.trim());
  $('#room-settings').hidden=entryMode!=='online'||joining;
  $('#room-code-label').hidden=roomEntryKind!=='join';
  $('#room-create-tab').setAttribute('aria-pressed',String(roomEntryKind==='create'));
  $('#room-join-tab').setAttribute('aria-pressed',String(roomEntryKind==='join'));
  for(const id of ['#round-minutes','#round-goal','#round-chalk-stamina','#round-players'])$(id).disabled=joining;
}
function syncServerNotice(){
  syncRoomCreation();
  if(entryMode==='online'){
    const button=$('#room-enter');
    if(roomConnecting===entryRequest){button.disabled=true;button.textContent='连接中…';}
    else if(sceneReady){button.disabled=false;button.textContent=roomEntryKind==='join'?'加入房间':'创建房间';}
    else if($('#room-load').dataset.state==='error'){button.disabled=false;button.textContent='重新准备';}
    else{button.disabled=true;button.textContent='准备中…';}
  }
}
$('#room-code').addEventListener('input',syncRoomCreation);
for(const [id,kind]of [['#room-create-tab','create'],['#room-join-tab','join']])$(id).addEventListener('click',()=>{
 if(roomConnecting===entryRequest)return;roomEntryKind=kind;if(kind==='create')$('#room-code').value='';$('#room-error').hidden=true;syncServerNotice();
});
$('#room-solo').addEventListener('click',startSolo);
$('#room-enter').addEventListener('click',async()=>{
  if(entryMode==='solo'){startSolo();return;}
  if(roomConnecting===entryRequest)return;
  if(roomEntryKind==='join'&&!/^\d{6}$/.test($('#room-code').value.trim())){$('#room-error').hidden=false;$('#room-error').textContent='请输入六位房间号';return;}
  if(!sceneReady||!game){ensureWorld();return;}
  // Read the final visible values at submission, including an input that has
  // not blurred yet. Joining an existing room never changes its host settings.
  if(!$('#room-code').value.trim())commitRoomSettings();
  const button=$('#room-enter'),error=$('#room-error'),request=entryRequest;roomConnecting=request;button.disabled=true;button.textContent='连接中…';error.hidden=true;
  try{
    entryCharacter=randomStudent();
    const online=await connectCampusRoom({code:$('#room-code').value.trim(),name:$('#room-name').value.trim()||'同学',character:entryCharacter,rolePreference:roundOptions.role,map:roundOptions.map,maxPlayers:roundOptions.maxPlayers,settings:{duration:roundOptions.duration,target:roundOptions.target,chalkStamina:roundOptions.chalkStamina},onError:e=>toast(typeof e==='string'?e:e.message)});
    if(disposed||request!==entryRequest||entryMode!=='online'||!$('#room-dialog').open){online.leave();return;}game.setRound(online);$('#room-dialog').close();$('#classroom').hidden=false;
    scene.setMap(online.snapshot().map);scene.setCharacter(online.player?.character||entryCharacter);scene.setActive(true);game.start({...roundOptions});
  }catch(e){if(request===entryRequest&&entryMode==='online'&&$('#room-dialog').open){error.hidden=false;error.textContent=e.message==='Failed to fetch'?'连接失败，请检查网络后重试。':e.message;}}
  finally{if(roomConnecting===request)roomConnecting=null;if(request===entryRequest&&entryMode==='online')syncServerNotice();}
});
document.addEventListener('keydown',e=>{if(e.repeat)return;if(e.key==='Enter'&&!$('dialog[open]')&&!game?.active&&!["BUTTON","INPUT","SELECT"].includes(document.activeElement?.tagName)){e.preventDefault();startSolo();}});
document.addEventListener('pointerdown',()=>audio.start(),{passive:true});
document.addEventListener('keydown',()=>audio.start());
document.addEventListener('click',e=>{if(e.target.closest('button'))audio.click();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.pause();else if(audio.started)audio.start();});
applySettings();

const loadStep=(width,label)=>{$('#room-load-fill').style.width=width+'%';$('#room-load-status').textContent=label;};
function showMenu(){
  scene?.setActive(false);$('#classroom').hidden=true;
  $(entryMode==='solo'?'#enter-solo':'#enter-classroom').focus({preventScroll:true});
}
function ensureWorld(){
  if(disposed)return Promise.resolve(null);
  if(sceneReady)return Promise.resolve(scene);
  if(worldPromise)return worldPromise;
  $('#room-enter').disabled=true;$('#room-enter').textContent='准备中…';$('#room-load').dataset.state='loading';loadStep(12,'正在准备教室');
  worldPromise=(async()=>{
    let prepared=null;
    try{
      const [module,controller]=await Promise.all([import('./classroom.js?v=campus-83'),import('./classroom-game.js?v=campus-83')]);
      if(disposed)return null;
      loadStep(38,'正在加载场景与同学');prepared=await module.createClassroom($('#classroom'),{active:false,snapEntry:true});
      if(disposed){prepared.dispose();return null;}
      scene=prepared;scene.setActive(false);
      game=controller.createClassroomGame({scene,audio,settings,onExit:showMenu});
      applySettings();sceneReady=true;document.body.classList.add('scene-ready');
      loadStep(100,'准备好了');$('#room-load').dataset.state='ready';$('#room-enter').disabled=false;$('#room-enter').textContent=entryMode==='solo'?'进入教室':'创建 / 加入房间';syncServerNotice();
      return scene;
    }catch(error){
      prepared?.dispose();scene=null;game=null;sceneReady=false;worldPromise=null;
      if(disposed)return null;
      console.error('Classroom unavailable:',error);$('#classroom').hidden=true;
      $('#room-load').dataset.state='error';loadStep(0,'教室加载失败，请重试');$('#room-enter').disabled=false;$('#room-enter').textContent='重新准备';syncServerNotice();return null;
    }
  })();
  return worldPromise;
}
document.body.classList.add('menu-ready');
window.addEventListener('pagehide',e=>{if(!e.persisted){disposed=true;controlSettings?.dispose();game?.dispose();scene?.dispose();audio.dispose();}});
