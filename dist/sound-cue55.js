import {GLOBAL_SOUND_EVENTS} from './audio-events69.js?v=campus-81';
const PUBLIC_NOISES=new Set(['food-complete','drink-complete','gum-pop','phone-notification','burp']);
export const PUBLIC_SOUND_RADIUS=14;
export function audibleCue(event,listener=null){return Boolean(PUBLIC_NOISES.has(event?.type)&&event?.audience!=='self'&&event?.recipientId==null&&Number.isFinite(event.x)&&Number.isFinite(event.z)&&(!listener||GLOBAL_SOUND_EVENTS.has(event.type)||(Number.isFinite(listener.x)&&Number.isFinite(listener.z)&&Math.hypot(event.x-listener.x,event.z-listener.z)<PUBLIC_SOUND_RADIUS)));}
export function relativeSoundBearing(event,player){return Math.atan2(Math.sin(Math.atan2(event.x-player.x,event.z-player.z)-(player.yaw||0)),Math.cos(Math.atan2(event.x-player.x,event.z-player.z)-(player.yaw||0)));}
export function createSoundCues(host){
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');canvas.className='teacher-sound-cues';canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:8';host.append(canvas);const c=canvas.getContext('2d');let enabled=true,clock=0,events=[];
 function clear(){events=[];c.clearRect(0,0,canvas.width,canvas.height);canvas.hidden=true;}
 return{
  emit(event,state){if(!enabled||state?.role!=='teacher'||!state.player||!audibleCue(event,state.player))return;events.push({...event,at:clock});if(events.length>3)events.shift();},
  setEnabled(value){enabled=Boolean(value);if(!enabled)clear();},
  update(state,dt){
   if(!enabled||state?.role!=='teacher'||state.status!=='playing'){clear();return;}if(!state.paused)clock+=Math.max(0,Math.min(.1,dt||0));
   events=events.filter(e=>clock-e.at<1.2);const w=host.clientWidth||1,h=host.clientHeight||1,ratio=Math.min(devicePixelRatio||1,1.5);if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,w,h);canvas.hidden=!events.length||state.paused;
   if(canvas.hidden)return;
   for(const e of events){const age=clock-e.at,fade=Math.min(1,age/.10)*Math.min(1,(1.2-age)/.55),bearing=relativeSoundBearing(e,state.player),r=Math.min(w,h)*(.32+age*.012),half=.34;
    c.save();c.translate(w*.5,h*.5);c.rotate(bearing);c.globalAlpha=Math.max(0,fade);c.lineWidth=1.7;c.strokeStyle='#313e42';c.fillStyle='#fffef0';
    // A tapered curved wedge, broad at the sound bearing and feathered to
    // each end. No source name, wall-revealing marker or subtitle is added.
    c.beginPath();c.moveTo(-Math.sin(half)*r,-Math.cos(half)*r);c.quadraticCurveTo(0,-r+17,Math.sin(half)*r,-Math.cos(half)*r);c.quadraticCurveTo(0,-r+34,-Math.sin(half)*r,-Math.cos(half)*r);c.closePath();c.fill();c.stroke();c.restore();
   }
  },
  dispose(){clear();canvas.remove();},diagnostics:()=>({enabled,active:events.length})
 };
}
