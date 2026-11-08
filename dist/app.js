import {playNovelEffect} from './sound-effects50.js';
import {connectCampusRoom,defaultCampusEndpoint} from './network-client.js';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const KEY = 'campus-afterbell-settings-v1';
const characterNames={boy:'男同学',girl:'女同学',glasses:'眼镜同学',ponytail:'马尾同学'};
const defaults = { music:25, sfx:55, muted:false, quality:'high', motion:!matchMedia('(prefers-reduced-motion: reduce)').matches, character:'boy' };
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch {}
const volume = (value, fallback) => Number.isFinite(+value) ? Math.min(100,Math.max(0,+value)) : fallback;
const settings = { ...defaults, music:volume(saved.music,25), sfx:volume(saved.sfx,55), muted:typeof saved.muted==='boolean'?saved.muted:false, quality:saved.quality==='low'?'low':'high', motion:typeof saved.motion==='boolean'?saved.motion:defaults.motion, character:Object.hasOwn(characterNames,saved.character)?saved.character:'boy' };
let scene, game, sceneReady=false, worldPromise=null, disposed=false, openingButton=null, draftCharacter=settings.character,entryMode='online',entryRequest=0;
let roundOptions={role:saved.role==='teacher'?'teacher':'student',map:['classroom','night','tiered','computer'].includes(saved.map)?saved.map:'classroom'};
const mapNames={classroom:'白天教室',night:'晚自习',tiered:'普通教室',computer:'机房'};
function syncRoundOptions(){
  $$('[data-role]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.role===roundOptions.role)));
  $$('[data-map]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.map===roundOptions.map)));
  $('#choose-mode strong').textContent=mapNames[roundOptions.map]+' · '+(roundOptions.role==='teacher'?'老师':'学生');
  $('#room-map').textContent=mapNames[roundOptions.map];
  $('#room-role').textContent=roundOptions.role==='teacher'?'老师':'学生';
}
let toastTimer=0;
function toast(message){ clearTimeout(toastTimer); $('#toast').textContent=message; $('#toast').classList.add('show'); toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600); }
function persist(){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{toast('当前浏览器无法保存设置');}}

class MenuAudio {
  constructor(){this.context=null;this.timer=null;this.next=0;this.step=0;this.started=false;}
  async start(){
    try{
      if(!this.context){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;this.context=new AC();this.music=this.context.createGain();this.fx=this.context.createGain();this.music.connect(this.context.destination);this.fx.connect(this.context.destination);this.apply();}
      if(this.context.state==='suspended')await this.context.resume();
      this.started=true;if(!this.timer){this.next=this.context.currentTime+.15;this.timer=setInterval(()=>this.schedule(),180);}
    }catch{}
  }
  apply(){if(!this.context)return;const t=this.context.currentTime;this.music.gain.setTargetAtTime(settings.muted?0:settings.music/100*(this.gameplay?.045:.17),t,.12);this.fx.gain.setTargetAtTime(settings.muted?0:settings.sfx/100*.2,t,.03);}
  tone(freq,t,duration,gain,bus,type='sine'){
    if(!this.context)return;const osc=this.context.createOscillator(),env=this.context.createGain();osc.type=type;osc.frequency.value=freq;env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(gain,t+.008);env.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(env);env.connect(bus);osc.start(t);osc.stop(t+duration+.03);osc.onended=()=>{osc.disconnect();env.disconnect();};
  }
  schedule(){
    if(!this.context||this.context.state!=='running'||document.hidden)return;
    if(this.next<this.context.currentTime-.3)this.next=this.context.currentTime+.1;
    const melody=[72,76,79,0,76,74,72,0,69,72,76,0,74,0,71,0,67,71,74,0,77,76,74,0,72,0,76,79,74,0,72,0];
    while(this.next<this.context.currentTime+.4){const s=this.step%32,n=melody[s];if(n)this.tone(440*2**((n-69)/12),this.next,.85,.16,this.music);if(s%4===0){let bass=[48,45,43,48][Math.floor(s/8)];this.tone(440*2**((bass-69)/12),this.next,1.25,.2,this.music,'triangle');}this.next+=.32;this.step++;}
  }
  click(kind='tap'){if(!this.context||settings.muted)return;let t=this.context.currentTime;if(kind==='open'){this.tone(660,t,.11,.22,this.fx);this.tone(880,t+.055,.18,.13,this.fx);}else{this.tone(kind==='back'?330:570,t,.055,.18,this.fx,'triangle');}}
  effect(kind,volume=1){
    if(!this.context||settings.muted)return;if(playNovelEffect(this,kind,volume))return;const c=this.context,t=c.currentTime;
    if(kind.startsWith('smoke-')){
      const hiss=kind==='smoke-bloom',impact=kind==='smoke-impact',duration=hiss?1.65:impact?.15:.18;
      const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++){const x=i/data.length;data[i]=(Math.random()*2-1)*(hiss?Math.sin(Math.PI*x)**.7:Math.exp(-x*7));}
      const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type=hiss?'lowpass':'bandpass';filter.frequency.setValueAtTime(hiss?2200:impact?750:1600,t);filter.frequency.exponentialRampToValueAtTime(hiss?600:impact?280:600,t+duration);filter.Q.value=.7;gain.gain.value=(hiss?.16:impact?.23:.11)*volume;source.connect(filter);filter.connect(gain);gain.connect(this.fx);source.start(t);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
      if(impact)this.tone(290,t,.085,.08*volume,this.fx,'triangle');return;
    }
    if(kind==='flash-burst'||kind==='ink-splash'){
      const flash=kind==='flash-burst',duration=flash?.34:.26,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++){const x=i/data.length;data[i]=(Math.random()*2-1)*Math.exp(-x*(flash?10:5))*(flash?1:.5+.5*Math.sin(x*28)**2);}
      const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(flash?3200:1200,t);filter.frequency.exponentialRampToValueAtTime(flash?650:180,t+duration);gain.gain.value=(flash?.26:.20)*volume;source.connect(filter);filter.connect(gain);gain.connect(this.fx);source.start(t);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
      this.tone(flash?1450:640,t+.02,flash?.8:.08,flash?.045:.08,this.fx);return;
    }
    if(kind==='bell'){for(let i=0;i<3;i++)for(const f of [784,1046,1568])this.tone(f,t+i*.19,.6,.15,this.fx);return;}
    if(kind==='complete'){this.tone(780,t,.14,.17,this.fx);this.tone(1050,t+.07,.22,.12,this.fx);return;}
    if(kind==='step'){this.tone(96,t,.075,.16,this.fx,'triangle');return;}
    if(kind==='warning'){this.tone(430,t,.12,.12,this.fx,'triangle');return;}
    if(kind==='bubble'){this.tone(280,t,.09,.06*volume,this.fx);return;}
    if(kind==='blow'){
      const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*.52),c.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.sin(Math.PI*i/data.length);
      const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=750;gain.gain.value=.055*volume;source.connect(filter);filter.connect(gain);gain.connect(this.fx);source.start(t);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};return;
    }
    if(kind==='drink'){
      const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*.24),c.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++){const x=i/data.length;data[i]=(Math.random()*2-1)*Math.sin(Math.PI*x)*(.3+.7*Math.sin(x*22)**2);}
      const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(850,t);filter.frequency.exponentialRampToValueAtTime(300,t+.24);gain.gain.value=.13*volume;source.connect(filter);filter.connect(gain);gain.connect(this.fx);source.start(t);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};return;
    }
    const duration=kind==='caught'?.25:kind==='note'?.21:.10,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){const x=i/data.length;data[i]=(Math.random()*2-1)*Math.exp(-x*(kind==='caught'?7:4))*(['snack','burger'].includes(kind)?(.4+.6*Math.sin(x*37)**2):1);}
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=kind==='caught'?130:kind==='phone'?820:kind==='note'?1900:kind==='burger'?1400:2600;filter.Q.value=.65;gain.gain.value=(kind==='caught'?.8:kind==='burger'?.18:.28)*volume;source.connect(filter);filter.connect(gain);gain.connect(this.fx);source.start(t);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    if(kind==='caught')this.tone(80,t,.18,.3,this.fx,'triangle');
  }
  async pause(){if(this.context?.state==='running')try{await this.context.suspend();}catch{}}
  dispose(){clearInterval(this.timer);this.context?.close();}
}
const audio = new MenuAudio();
function syncSound(){const button=$('#sound-toggle');button.querySelector('use').setAttribute('href',settings.muted?'#i-muted':'#i-audio');button.setAttribute('aria-label',settings.muted?'开启声音':'关闭声音');button.setAttribute('aria-pressed',String(!settings.muted));audio.apply();}
function applySettings(){
  $('#music-volume').value=settings.music;$('#sfx-volume').value=settings.sfx;$('#music-output').textContent=settings.music+'%';$('#sfx-output').textContent=settings.sfx+'%';$('#motion-toggle').checked=settings.motion;
  $$('[data-quality]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.quality===settings.quality)));
  document.body.classList.toggle('reduce-motion',!settings.motion);scene?.setQuality(settings.quality);scene?.setMotion(settings.motion);syncSound();
}
let characterPreview=null,characterPreviewPromise=null;
function renderCharacter(){
  $$('[data-character]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.character===draftCharacter)));
  characterPreview?.select(draftCharacter);
}
function ensureCharacterPreview(){
  if(characterPreview){characterPreview.select(draftCharacter);characterPreview.start();return Promise.resolve(characterPreview);}
  if(characterPreviewPromise)return characterPreviewPromise;
  const canvas=$('#character-preview'),status=$('#character-preview-status');
  status.hidden=false;status.textContent='正在加载同学…';
  characterPreviewPromise=(async()=>{
    let renderer=null,observer=null;
    try{
      const [T,{loadStudentAssets}]=await Promise.all([import('./vendor/three.module.js'),import('./student-assets.js?v=solo-51')]);
      const assets=await loadStudentAssets();if(disposed)return null;
      renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
      renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1.08;
      const world=new T.Scene();world.background=new T.Color('#e8eff0');
      world.add(new T.HemisphereLight('#edf5ff','#dce3e3',2.5));
      const sun=new T.DirectionalLight('#fff8ed',4);sun.position.set(-4,6,4);world.add(sun);
      const fill=new T.DirectionalLight('#e5eef4',.85);fill.position.set(4,3,3);world.add(fill);
      const camera=new T.PerspectiveCamera(31,1,.01,30);camera.position.set(0,1.04,4.3);camera.lookAt(0,.96,0);
      const actors=new Map();let selected=null,frame=null,last=0,time=0,drag=null,yaw=0;
      function select(variant){
        if(!Object.hasOwn(characterNames,variant))variant='boy';
        if(!actors.has(variant)){const actor=assets.createStudent({variant,seated:false,seed:0});actor.setMood('resting');actor.setMotion({seated:false,speed:0});actor.update(0);actors.set(variant,actor);world.add(actor.group);}
        for(const [key,actor]of actors)actor.group.visible=key===variant;
        selected=actors.get(variant);selected.group.rotation.y=yaw;
        canvas.dataset.character=variant;canvas.dataset.asset=selected.group.userData.asset||variant;canvas.setAttribute('aria-label',characterNames[variant]+'模型预览');
      }
      function resize(){const {width,height}=canvas.getBoundingClientRect();if(width>0&&height>0){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}}
      function tick(now){frame=null;if(disposed||!$('#character-dialog').open)return;const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(settings.motion)time+=dt;selected?.update(time);renderer.render(world,camera);frame=requestAnimationFrame(tick);}
      function start(){resize();last=0;if(frame===null&&$('#character-dialog').open)frame=requestAnimationFrame(tick);}
      function stop(){if(frame!==null)cancelAnimationFrame(frame);frame=null;last=0;drag=null;}
      const down=e=>{drag={id:e.pointerId,x:e.clientX,yaw};canvas.setPointerCapture?.(e.pointerId);};
      const move=e=>{if(!drag||drag.id!==e.pointerId)return;yaw=drag.yaw+(e.clientX-drag.x)*.012;if(selected)selected.group.rotation.y=yaw;};
      const up=()=>{drag=null;};canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
      observer=new ResizeObserver(resize);observer.observe(canvas);
      characterPreview={select,start,stop,dispose(){stop();observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);for(const actor of actors.values())actor.dispose?.();renderer.dispose();}};
      select(draftCharacter);status.hidden=true;start();return characterPreview;
    }catch(error){observer?.disconnect();renderer?.dispose();characterPreviewPromise=null;if(!disposed){status.hidden=false;status.textContent='模型加载失败，重新打开重试';console.error('Character preview unavailable:',error);}return null;}
  })();return characterPreviewPromise;
}
function openSheet(id,button){
  if(game?.active)return;for(const open of $$('dialog[open]'))open.close();openingButton=button;const dialog=$(id);
  if(id==='#character-dialog'){draftCharacter=settings.character;renderCharacter();}
  dialog.showModal();if(id==='#character-dialog')ensureCharacterPreview();audio.click('open');
}
for(const [button,id] of [['#choose-mode','#mode-dialog'],['#choose-character','#character-dialog'],['#open-settings','#settings-dialog']])$(button).addEventListener('click',()=>openSheet(id,$(button)));
for(const dialog of $$('#mode-dialog, #character-dialog, #settings-dialog, #room-dialog')){
  dialog.querySelectorAll('.close').forEach(button=>button.addEventListener('click',()=>{audio.click('back');dialog.close();}));
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{if(dialog.id==='character-dialog')characterPreview?.stop();if(!game?.active)openingButton?.focus({preventScroll:true});});
}
$('#select-classroom').addEventListener('click',()=>{$('#mode-dialog').close();Object.assign(settings,roundOptions);persist();syncRoundOptions();});
$$('[data-role]').forEach(b=>b.addEventListener('click',()=>{roundOptions.role=b.dataset.role;syncRoundOptions();}));
$$('[data-map]').forEach(b=>b.addEventListener('click',()=>{roundOptions.map=b.dataset.map;syncRoundOptions();}));
syncRoundOptions();
$$('[data-character]').forEach(button=>button.addEventListener('click',()=>{draftCharacter=button.dataset.character;renderCharacter();}));
$('#confirm-character').addEventListener('click',()=>{settings.character=draftCharacter;persist();$('#character-dialog').close();});
$$('[data-quality]').forEach(button=>button.addEventListener('click',()=>{settings.quality=button.dataset.quality;applySettings();persist();}));
for(const type of ['music','sfx'])$('#'+type+'-volume').addEventListener('input',e=>{settings[type]=Number(e.target.value);$('#'+type+'-output').textContent=settings[type]+'%';audio.apply();persist();});
$('#motion-toggle').addEventListener('change',e=>{settings.motion=e.target.checked;applySettings();persist();});
$('#sound-toggle').addEventListener('click',()=>{settings.muted=!settings.muted;syncSound();persist();});
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('当前浏览器暂不支持全屏');}catch{toast('当前窗口无法全屏，请在浏览器中打开');}});
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').setAttribute('aria-label',document.fullscreenElement?'退出全屏':'全屏');});
function prepareEntry(mode,button){
  if(disposed||game?.active)return;
  entryMode=mode;entryRequest++;
  syncRoundOptions();$('#room-character').textContent=characterNames[settings.character];
  $('.room-connect').hidden=mode==='solo';$('#room-title').textContent=mode==='solo'?'单人游戏':'多人教室';
  $('#room-enter').textContent=sceneReady?(mode==='solo'?'进入教室':'创建 / 加入房间'):'准备中…';
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
  scene.setMap(roundOptions.map);scene.setCharacter(settings.character);scene.setActive(true);game.start({...roundOptions,solo:true});
}
$('#enter-classroom').addEventListener('click',startGame);
$('#enter-solo').addEventListener('click',startSolo);
$('#room-server').value=defaultCampusEndpoint();
$('#room-enter').addEventListener('click',async()=>{
  if(entryMode==='solo'){startSolo();return;}
  if(!sceneReady||!game){ensureWorld();return;}
  const button=$('#room-enter'),error=$('#room-error');button.disabled=true;button.textContent='连接中…';error.hidden=true;
  try{
    const online=await connectCampusRoom({endpoint:$('#room-server').value||defaultCampusEndpoint(),code:$('#room-code').value.trim(),name:$('#room-name').value.trim()||'同学',character:settings.character,rolePreference:roundOptions.role,map:roundOptions.map,onError:e=>toast(typeof e==='string'?e:e.message)});
    if(disposed){online.leave();return;}game.setRound(online);$('#room-dialog').close();$('#classroom').hidden=false;
    scene.setMap(online.snapshot().map);scene.setCharacter(settings.character);scene.setActive(true);game.start({...roundOptions});
  }catch(e){error.hidden=false;error.textContent=e.message==='Failed to fetch'?'连接不到服务器，请确认服务器已启动。':e.message;}
  finally{button.disabled=false;button.textContent='创建 / 加入房间';}
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
      const [module,controller]=await Promise.all([import('./classroom.js?v=solo-51'),import('./classroom-game.js?v=solo-51')]);
      if(disposed)return null;
      loadStep(38,'正在加载场景与同学');prepared=await module.createClassroom($('#classroom'),{active:false,snapEntry:true});
      if(disposed){prepared.dispose();return null;}
      scene=prepared;scene.setActive(false);
      game=controller.createClassroomGame({scene,audio,settings,onExit:showMenu});
      applySettings();sceneReady=true;document.body.classList.add('scene-ready');
      loadStep(100,'准备好了');$('#room-load').dataset.state='ready';$('#room-enter').disabled=false;$('#room-enter').textContent=entryMode==='solo'?'进入教室':'创建 / 加入房间';
      return scene;
    }catch(error){
      prepared?.dispose();scene=null;game=null;sceneReady=false;worldPromise=null;
      if(disposed)return null;
      console.error('Classroom unavailable:',error);$('#classroom').hidden=true;
      $('#room-load').dataset.state='error';loadStep(0,'教室加载失败，请重试');$('#room-enter').disabled=false;$('#room-enter').textContent='重新准备';return null;
    }
  })();
  return worldPromise;
}
document.body.classList.add('menu-ready');
window.addEventListener('pagehide',e=>{if(!e.persisted){disposed=true;characterPreview?.dispose();game?.dispose();scene?.dispose();audio.dispose();}});
