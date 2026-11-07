const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const KEY = 'campus-afterbell-settings-v1';
const defaults = { music:25, sfx:55, muted:false, quality:'high', motion:!matchMedia('(prefers-reduced-motion: reduce)').matches, character:'boy' };
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch {}
const volume = (value, fallback) => Number.isFinite(+value) ? Math.min(100,Math.max(0,+value)) : fallback;
const settings = { ...defaults, music:volume(saved.music,25), sfx:volume(saved.sfx,55), muted:typeof saved.muted==='boolean'?saved.muted:false, quality:saved.quality==='low'?'low':'high', motion:typeof saved.motion==='boolean'?saved.motion:defaults.motion, character:['boy','girl','glasses'].includes(saved.character)?saved.character:'boy' };
let scene, game, sceneReady=false, openingButton=null, draftCharacter=settings.character;
let roundOptions={role:saved.role==='teacher'?'teacher':'student',map:['classroom','night','tiered','computer'].includes(saved.map)?saved.map:'classroom'};
const mapNames={classroom:'白天教室',night:'晚自习',tiered:'阶梯教室',computer:'机房'};
function syncRoundOptions(){
  $$('[data-role]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.role===roundOptions.role)));
  $$('[data-map]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.map===roundOptions.map)));
  $('#choose-mode strong').textContent=mapNames[roundOptions.map]+' · '+(roundOptions.role==='teacher'?'老师':'学生');
  scene?.setMap(roundOptions.map);
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
    if(!this.context||settings.muted)return;const c=this.context,t=c.currentTime;
    if(kind.startsWith('smoke-')){
      const hiss=kind==='smoke-bloom',impact=kind==='smoke-impact',duration=hiss?1.65:impact?.15:.18;
      const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++){const x=i/data.length;data[i]=(Math.random()*2-1)*(hiss?Math.sin(Math.PI*x)**.7:Math.exp(-x*7));}
      const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type=hiss?'lowpass':'bandpass';filter.frequency.setValueAtTime(hiss?2200:impact?750:1600,t);filter.frequency.exponentialRampToValueAtTime(hiss?600:impact?280:600,t+duration);filter.Q.value=.7;gain.gain.value=(hiss?.16:impact?.23:.11)*volume;source.connect(filter);filter.connect(gain);gain.connect(this.fx);source.start(t);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
      if(impact)this.tone(290,t,.085,.08*volume,this.fx,'triangle');return;
    }
    if(kind==='bell'){for(let i=0;i<3;i++)for(const f of [784,1046,1568])this.tone(f,t+i*.19,.6,.15,this.fx);return;}
    if(kind==='complete'){this.tone(780,t,.14,.17,this.fx);this.tone(1050,t+.07,.22,.12,this.fx);return;}
    if(kind==='step'){this.tone(96,t,.075,.16,this.fx,'triangle');return;}
    if(kind==='warning'){this.tone(430,t,.12,.12,this.fx,'triangle');return;}
    const duration=kind==='caught'?.25:kind==='note'?.21:.10,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){const x=i/data.length;data[i]=(Math.random()*2-1)*Math.exp(-x*(kind==='caught'?7:4))*(kind==='snack'?(.4+.6*Math.sin(x*37)**2):1);}
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=kind==='caught'?130:kind==='phone'?820:kind==='note'?1900:2600;filter.Q.value=.65;gain.gain.value=kind==='caught'?.8:.28;source.connect(filter);filter.connect(gain);gain.connect(this.fx);source.start(t);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
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
function renderCharacter(){ $$('[data-character]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.character===draftCharacter)));scene?.setCharacter(draftCharacter); }
function openSheet(id,button){
  if(game?.active)return;for(const open of $$('dialog[open]'))open.close();openingButton=button;const dialog=$(id);
  if(id==='#character-dialog'){draftCharacter=settings.character;renderCharacter();}
  dialog.showModal();audio.click('open');
}
for(const [button,id] of [['#choose-mode','#mode-dialog'],['#choose-character','#character-dialog'],['#open-settings','#settings-dialog']])$(button).addEventListener('click',()=>openSheet(id,$(button)));
for(const dialog of $$('#mode-dialog, #character-dialog, #settings-dialog')){
  dialog.querySelectorAll('.close').forEach(button=>button.addEventListener('click',()=>{audio.click('back');dialog.close();}));
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{if(dialog.id==='character-dialog')scene?.setCharacter(settings.character);openingButton?.focus({preventScroll:true});});
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
function startGame(){if(!sceneReady||!game){toast('教室还在准备');return;}game.start(roundOptions);}
$('#enter-classroom').addEventListener('click',startGame);
document.addEventListener('keydown',e=>{if(e.repeat)return;if(e.key==='Enter'&&!$('dialog[open]')&&!game?.active&&!["BUTTON","INPUT","SELECT"].includes(document.activeElement?.tagName)){e.preventDefault();startGame();}});
document.addEventListener('pointerdown',()=>audio.start(),{passive:true});
document.addEventListener('keydown',()=>audio.start());
document.addEventListener('click',e=>{if(e.target.closest('button'))audio.click();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.pause();else if(audio.started)audio.start();});
applySettings();

const loadStep=(width,label)=>{$('#loading-fill').style.width=width+'%';$('#load-status').textContent=label;};
let loaderClosed=false;
function finishLoad(){if(loaderClosed)return;loaderClosed=true;$('#loading-fill').style.width='100%';$('#loader').classList.add('leaving');setTimeout(()=>$('#loader').hidden=true,650);}
$('#skip-load').addEventListener('click',finishLoad);
const slowTimer=setTimeout(()=>{$('#skip-load').hidden=false;$('#load-status').textContent='教室还在准备，可以先查看菜单';},7000);
async function init(){
  try{
    loadStep(20,'正在打开教室');const module=await import('./classroom.js?v=classroom-31');loadStep(58,'摆好课桌，打开窗户');
    scene=await module.createClassroom($('#classroom'));
    const {createClassroomGame}=await import('./classroom-game.js?v=classroom-31');game=createClassroomGame({scene,audio,settings,onExit:()=>$('#enter-classroom').focus({preventScroll:true})});
    applySettings();syncRoundOptions();scene.setCharacter(settings.character);sceneReady=true;document.body.classList.add('scene-ready');loadStep(100,'同学们已入座');
    setTimeout(finishLoad,350);
  }catch(error){console.error('Classroom unavailable:',error);$('#classroom').hidden=true;$('#enter-classroom').disabled=true;$('#enter-classroom').querySelector('strong').textContent='教室暂不可用';finishLoad();toast('三维场景未能打开，仍可查看菜单与设置');}
  finally{clearTimeout(slowTimer);}
}
init();
window.addEventListener('pagehide',e=>{if(!e.persisted){game?.dispose();scene?.dispose();audio.dispose();}});
