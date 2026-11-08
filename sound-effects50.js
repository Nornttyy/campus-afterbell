// Original, short procedural effects. No samples from another game are used.
// Returns false for unknown effects so MenuAudio can keep its existing sounds.
const supported=new Set(['flash-burst','ink-splash','gum-pop','gum-score','bubble-release','bubble-hit','banana-slip','stunned','burp','bananaPeel-throw','rear-door']);
const state=new WeakMap(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function playNovelEffect(audio,kind,intensity=1){
 if(!supported.has(kind))return false;
 const c=audio?.context,out=audio?.fx;if(!c||!out||c.state==='closed')return true;
 const t=c.currentTime,volume=clamp(Number(intensity)||0,0,1);if(!volume)return true;
 let record=state.get(c);if(!record){record={active:0,last:new Map()};state.set(c,record);}
 const last=record.last.get(kind)??-100;if(t-last<.06||record.active>=14)return true;record.last.set(kind,t);record.active++;
 const bus=c.createGain();bus.gain.value=volume;bus.connect(out);let longest=.05;
 const envelope=(gain,start,duration,peak,attack=.006)=>{gain.setValueAtTime(.0001,start);gain.exponentialRampToValueAtTime(Math.max(.0002,peak),start+Math.min(attack,duration*.2));gain.exponentialRampToValueAtTime(.0001,start+duration);};
 function tone(f0,f1,duration,level=.1,delay=0,type='sine'){
  const o=c.createOscillator(),g=c.createGain(),at=t+delay;o.type=type;o.frequency.setValueAtTime(f0,at);o.frequency.exponentialRampToValueAtTime(Math.max(15,f1),at+duration);envelope(g.gain,at,duration,level);o.connect(g);g.connect(bus);o.start(at);o.stop(at+duration+.01);o.onended=()=>{o.disconnect();g.disconnect();};longest=Math.max(longest,delay+duration+.02);
 }
 function noise(duration,level,f0,f1,delay=0,type='lowpass',q=.7){
  const n=Math.max(2,Math.ceil(c.sampleRate*duration)),buffer=c.createBuffer(1,n,c.sampleRate),d=buffer.getChannelData(0);let brown=0;
  for(let i=0;i<n;i++){brown=(brown+(Math.random()*2-1)*.09)/1.035;d[i]=brown*.65+(Math.random()*2-1)*.24;}
  const source=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain(),at=t+delay;source.buffer=buffer;filter.type=type;filter.Q.value=q;filter.frequency.setValueAtTime(f0,at);filter.frequency.exponentialRampToValueAtTime(Math.max(30,f1),at+duration);envelope(g.gain,at,duration,level,.004);source.connect(filter);filter.connect(g);g.connect(bus);source.start(at);source.onended=()=>{source.disconnect();filter.disconnect();g.disconnect();};longest=Math.max(longest,delay+duration+.02);
 }
 switch(kind){
  case 'flash-burst':noise(.13,.78,5600,820);tone(100,42,.15,.20);tone(1740,1680,.55,.045,.025);noise(.32,.13,1700,400,.065);break;
  case 'ink-splash':noise(.13,.48,2400,360);tone(270,65,.12,.13);for(let i=0;i<3;i++)tone(430+i*75,150+i*35,.075,.055,.036+i*.035);break;
  case 'gum-pop':noise(.045,.32,2400,700);tone(420,115,.105,.25);tone(760,300,.045,.07,.005);break;
  case 'gum-score':tone(260,420,.12,.10);tone(530,600,.07,.025,.025);break;
  case 'bubble-release':tone(180,520,.19,.12);noise(.12,.08,900,1300,.02,'bandpass');break;
  case 'bubble-hit':tone(430,82,.16,.22);noise(.085,.20,1100,280);break;
  case 'banana-slip':tone(580,1100,.12,.09,0,'triangle');tone(1100,200,.20,.075,.1,'sine');noise(.18,.14,1200,250,.17);tone(86,40,.15,.20,.24);break;
  case 'stunned':noise(.08,.21,1100,300);tone(110,48,.14,.20);[940,1175,1400].forEach((f,i)=>tone(f,f*.99,.22,.04,.14+i*.11));break;
  case 'burp':{
   // A low voiced pulse and changing mouth resonances, never a long loud buzz.
   tone(94,54,.47,.13,0,'triangle');tone(188,112,.38,.035,.015,'sine');noise(.46,.24,640,280,0,'bandpass',2.1);noise(.20,.09,1100,500,.1,'bandpass',1.6);break;
  }
  case 'bananaPeel-throw':noise(.12,.12,2100,650,0,'bandpass');break;
  case 'rear-door':noise(.14,.15,1250,280);tone(114,72,.10,.12,.05);break;
 }
 // Cleanup follows the audio clock even if the page's timers are throttled.
 const end=c.createOscillator(),silence=c.createGain();silence.gain.value=0;end.connect(silence);silence.connect(bus);end.start(t);end.stop(t+longest+.02);end.onended=()=>{end.disconnect();silence.disconnect();bus.disconnect();record.active=Math.max(0,record.active-1);};
 return true;
}
