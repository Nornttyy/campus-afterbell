// Original procedural Foley: short contact, scrape and air layers. These are
// not recordings from the reference game. No music scheduler or musical UI notes.
const DURATIONS=Object.freeze({tap:.075,open:.20,back:.12,step:.22,'drawer-open':.49,'drawer-close':.35,'rear-door':.50,'book-open':.34,'book-close':.24,'pen-pickup':.14,'pen-putdown':.16,'pen-write':.34,'pen-twirl':.30,pen:.30,chair:.39,phone:.10,snack:.42,burger:.38,banana:.35,garlic:.37,lunch:.39,drink:.46,blow:.54,bubble:.13,'gum-pop':.16,'gum-score':.13,'bubble-release':.24,'bubble-hit':.20,'bananaPeel-throw':.18,'banana-slip':.47,stunned:.34,burp:.53,'smoke-throw':.19,'smoke-impact':.20,'smoke-bloom':1.70,'flash-burst':.70,'ink-splash':.34,'chalk-hit':.16,caught:.25,warning:.19,complete:.23,bell:1.05});
const ACTION_DURATIONS=Object.freeze({'use-crunch':.34,'use-gulp':.48,'food-complete':.24,'drink-complete':.24,'gum-inflate':.62});
export const FOLEY_KINDS=Object.freeze([...Object.keys(DURATIONS),...Object.keys(ACTION_DURATIONS)]);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

export function createFoleySamples(kind,{sampleRate=24000,variant=0}={}){
 const duration=DURATIONS[kind]||ACTION_DURATIONS[kind];if(!duration)return null;
 const rate=clamp(Math.round(sampleRate)||24000,8000,96000),data=new Float32Array(Math.ceil(rate*duration));
 let seed=2166136261;for(const c of kind)seed=Math.imul(seed^c.charCodeAt(0),16777619);seed=(seed+Math.imul(variant+1,374761393))>>>0;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const variation=.94+rand()*.12;
 const add=(i,value)=>{if(i>=0&&i<data.length)data[i]+=value;};
 function noise(at,dur,level,{lo=70,hi=5000,decay=3,attack=.003,pulse=0}={}){
  const start=Math.round(at*rate),length=Math.ceil(dur*rate),al=1-Math.exp(-2*Math.PI*lo/rate),ah=1-Math.exp(-2*Math.PI*hi/rate);let low=0,high=0;
  for(let n=0;n<length;n++){const t=n/rate,x=t/dur,w=rand()*2-1;low+=al*(w-low);high+=ah*(w-high);const grains=pulse?.30+.70*Math.sin(t*pulse*Math.PI)**2:1,env=Math.min(1,t/attack)*Math.exp(-decay*x)*Math.min(1,(1-x)*16);add(start+n,(high-low)*env*level*grains);}
 }
 function impact(at,dur,level,modes=[90,157,243]){
  const start=Math.round(at*rate),length=Math.ceil(dur*rate),phases=modes.map(()=>rand()*.55);
  for(let n=0;n<length;n++){const t=n/rate,x=t/dur;let v=0;for(let k=0;k<modes.length;k++)v+=Math.sin(t*2*Math.PI*modes[k]*variation+phases[k])*Math.exp(-x*(6+k*1.7))/(k+1);add(start+n,v*level*Math.min(1,t/.0015)*Math.min(1,(1-x)*15));}
 }
 function paper(at=0,level=.34){noise(at,.21,level,{lo:850,hi:7100,decay:2.8,pulse:43});noise(at+.065,.12,level*.50,{lo:1800,hi:9300,decay:4,pulse:71});}
 function crunch(level=.35){for(let k=0;k<5;k++){const at=k*.051+rand()*.014;noise(at,.035+rand()*.035,level*(.7+rand()*.3),{lo:750+rand()*350,hi:5100+rand()*1600,decay:4});impact(at,.055,level*.075,[121,206,387]);}noise(.07,.22,level*.22,{lo:130,hi:900,decay:2,pulse:24});}
 function latch(at=0,level=.3){noise(at,.022,level,{lo:650,hi:7800,decay:6});impact(at,.065,level*.25,[183,529,1337]);}
 function scuff(at=0,level=.2){noise(at,.18,level,{lo:170,hi:2100,decay:3,pulse:31});}
 switch(kind){
  case 'tap':latch(0,.20);noise(.008,.055,.12,{lo:90,hi:1100,decay:7});break;
  case 'open':paper(0,.18);latch(.025,.13);break;
  case 'back':noise(0,.09,.25,{lo:650,hi:4100,decay:5});impact(.005,.06,.045,[165,379]);break;
  case 'step':impact(.004,.11,.21,[72,113,201]);noise(0,.035,.52,{lo:80,hi:2800,decay:6});scuff(.035,.33);noise(.097,.045,.16,{lo:800,hi:4100,decay:5});break;
  case 'drawer-open':latch(0,.20);noise(.028,.36,.34,{lo:170,hi:2300,decay:1.1,pulse:37});impact(.356,.11,.19,[83,147,252]);latch(.368,.13);break;
  case 'drawer-close':noise(0,.23,.30,{lo:160,hi:2200,decay:.7,pulse:41});impact(.22,.12,.26,[79,123,233]);latch(.229,.31);break;
  case 'rear-door':latch(0,.23);noise(.024,.29,.24,{lo:170,hi:1800,decay:1.2,pulse:19});impact(.31,.18,.26,[68,139,317,617]);latch(.322,.25);break;
  case 'book-open':paper(.01,.34);impact(0,.12,.09,[91,181,299]);noise(.15,.16,.15,{lo:140,hi:1400,decay:3});break;
  case 'book-close':paper(0,.22);impact(.10,.12,.21,[103,197,332]);noise(.10,.05,.42,{lo:250,hi:4200,decay:5});break;
  case 'pen-pickup':latch(.01,.17);noise(0,.11,.16,{lo:800,hi:3400,decay:4});break;
  case 'pen-putdown':latch(.006,.23);latch(.041,.13);impact(.005,.09,.057,[410,1183,2207]);break;
  case 'pen-write':for(let k=0;k<4;k++)noise(k*.072,.054,.24,{lo:1700,hi:6700,decay:1.6,pulse:92});break;
  case 'pen-twirl':case 'pen':for(const at of [.01,.093,.22]){noise(at,.034,.19,{lo:1600,hi:6400,decay:4});impact(at,.042,.025,[829,1673]);}break;
  case 'chair':noise(.005,.24,.33,{lo:100,hi:2700,decay:1.5,pulse:31});impact(.27,.11,.22,[71,163,326]);break;
  case 'phone':latch(0,.12);noise(.01,.065,.12,{lo:150,hi:1100,decay:5});break;
  case 'snack':paper(0,.33);crunch(.31);break;
  case 'burger':case 'banana':case 'garlic':case 'lunch':crunch(kind==='burger'?.36:kind==='garlic'?.31:.23);break;
  case 'use-crunch':crunch(.14);break;
  case 'food-complete':case 'drink-complete':
   // The completed bite is one clear snap, distinct from quiet chewing.
   noise(.002,.055,.66,{lo:620,hi:7500,decay:6});noise(.034,.12,.26,{lo:350,hi:3500,decay:4,pulse:37});impact(.005,.14,.13,[99,223,419]);break;
  case 'use-gulp':
   for(const [k,at]of [.012,.225].entries()){noise(at,.18,.15,{lo:110,hi:1050,decay:2,pulse:18});impact(at+.035,.10,.095,[114-k*13,251-k*17,480-k*21]);}break;
  case 'drink':for(const [k,at]of [.015,.13,.26].entries()){noise(at,.12,.24,{lo:190,hi:1400,decay:2,pulse:22});impact(at,.10,.075,[171-k*19,367-k*21]);}noise(.05,.34,.1,{lo:90,hi:650,decay:2});break;
  case 'blow':noise(0,.50,.20,{lo:110,hi:1350,decay:.9,attack:.06,pulse:4});break;
  case 'gum-inflate':noise(.01,.57,.19,{lo:120,hi:1800,decay:.55,attack:.09,pulse:3});noise(.22,.30,.065,{lo:650,hi:2600,decay:1,attack:.04});break;
  case 'bubble':case 'gum-score':impact(0,.09,.16,[193,353]);noise(0,.026,.23,{lo:400,hi:2200,decay:6});break;
  case 'gum-pop':noise(0,.04,.55,{lo:200,hi:6200,decay:6});impact(.002,.12,.24,[123,261,463]);break;
  case 'bubble-release':noise(0,.17,.24,{lo:150,hi:1300,decay:1.5,pulse:27});impact(.005,.11,.10,[137,283]);break;
  case 'bubble-hit':impact(0,.16,.26,[88,179,353]);noise(0,.08,.32,{lo:350,hi:2200,decay:4,pulse:53});break;
  case 'bananaPeel-throw':case 'smoke-throw':noise(0,.16,.25,{lo:300,hi:2600,decay:2,attack:.02});break;
  case 'banana-slip':scuff(0,.46);scuff(.12,.28);impact(.26,.20,.34,[63,102,173]);noise(.26,.06,.40,{lo:200,hi:3100,decay:5});break;
  case 'stunned':impact(0,.16,.27,[64,137,216]);scuff(.12,.20);break;
  case 'burp':{
   const length=Math.min(data.length,Math.round(rate*.49));let low=0;for(let i=0;i<length;i++){const t=i/rate,x=t/.49;low+=.15*((rand()*2-1)-low);const cycle=t*(88-30*x),glottal=Math.max(0,Math.sin(2*Math.PI*cycle))**5;add(i,low*glottal*.9*Math.sin(Math.PI*x)**.7);}noise(.018,.42,.18,{lo:260,hi:690,decay:1.6,pulse:34});break;
  }
  case 'smoke-impact':impact(0,.16,.24,[172,463,1123]);noise(0,.045,.35,{lo:300,hi:5100,decay:7});break;
  case 'smoke-bloom':noise(0,1.66,.30,{lo:85,hi:2100,decay:.7,attack:.16,pulse:7});break;
  case 'flash-burst':noise(0,.13,.84,{lo:55,hi:8900,decay:7});impact(0,.21,.39,[43,79,137]);noise(.035,.59,.08,{lo:2800,hi:3600,decay:3,attack:.02});break;
  case 'ink-splash':noise(0,.12,.57,{lo:120,hi:3100,decay:3,pulse:42});for(let k=0;k<5;k++){const at=.055+k*.042;impact(at,.065,.066,[245+k*17,537+k*23]);noise(at,.03,.12,{lo:700,hi:3400,decay:4});}break;
  case 'chalk-hit':noise(0,.045,.43,{lo:450,hi:6200,decay:6});impact(.004,.11,.15,[127,387,921]);break;
  case 'caught':impact(0,.17,.35,[56,91,157]);scuff(.03,.31);break;
  case 'warning':impact(0,.13,.19,[89,163,297]);noise(.012,.11,.18,{lo:180,hi:1100,decay:3});break;
  case 'complete':paper(.01,.15);latch(.01,.13);impact(.045,.12,.08,[114,283]);break;
  case 'bell':for(const at of [0,.135,.27])impact(at,.76,.21,[711,1438,2013,2891,4351]);break;
 }
 // A short final fade also protects paper/cloth layers that outlast the event.
 const fade=Math.min(data.length,Math.ceil(rate*.007));for(let i=0;i<fade;i++)data[data.length-1-i]*=i/fade;
 // Keep samples below full scale; normalise only if a layered impact exceeded it.
 let peak=0;for(const value of data)peak=Math.max(peak,Math.abs(value));if(peak>.90)for(let i=0;i<data.length;i++)data[i]*=.90/peak;
 return data;
}

const contexts=new WeakMap();
export function playCampusFoley(audio,kind,intensity=1){
 if(!DURATIONS[kind]&&!ACTION_DURATIONS[kind])return false;
 const c=audio?.context,out=audio?.fx;if(!c||!out||c.state==='closed')return true;
 const volume=clamp(Number(intensity)||0,0,1);if(!volume)return true;
 let state=contexts.get(c);if(!state){state={buffers:new Map(),counts:new Map(),last:new Map(),active:0};contexts.set(c,state);}
 const t=c.currentTime,minGap=kind==='step'?.09:kind.startsWith('pen-')?.05:.035;
 if(state.active>=20||t-(state.last.get(kind)??-100)<minGap)return true;
 state.last.set(kind,t);const count=state.counts.get(kind)||0,variant=count%6;state.counts.set(kind,count+1);
 const key=kind+':'+variant;let buffer=state.buffers.get(key);
 if(!buffer){const samples=createFoleySamples(kind,{sampleRate:c.sampleRate,variant});buffer=c.createBuffer(1,samples.length,c.sampleRate);buffer.getChannelData(0).set(samples);state.buffers.set(key,buffer);}
 const source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;gain.gain.value=volume;source.connect(gain);gain.connect(out);state.active++;source.start(t);
 // Every sound owns its source, so a new footstep or interaction does not cut
 // off a currently playing door, page or food sound.
 source.onended=()=>{source.disconnect();gain.disconnect();state.active=Math.max(0,state.active-1);};return true;
}
