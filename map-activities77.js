import {PLAYGROUND_LAYOUT} from './playground-layout70.js?v=campus-82';
import {INTERACTION_SECONDS} from './item-rules50.js?v=campus-82';
import {TOILET_STALLS} from './toilet-layout70.js?v=campus-82';
// Plunging shares the requested interaction duration with food and rescue.
export const PLUNGE_SECONDS=INTERACTION_SECONDS;
export const barById=id=>PLAYGROUND_LAYOUT.bars.find(b=>b.id===id);
export const toiletBowl=id=>{const s=TOILET_STALLS.find(s=>s.id===id);return s?{x:s.x-.18,z:s.z-.48,y:.43}:null;};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function activitySnapshot(a){return a.mapActivity?{...a.mapActivity}:null;}
export function releaseMapActivity(round,a=round.player){
 if(!a.mapActivity)return false;
 a.mapActivity=null;a.mood='standing';a.holding=false;
 if(a===round.player){round.holding=false;round._movement={x:0,z:0};}return true;
}
export function startMapActivity(round,kind,id){
 const p=round.player;
 if(!round._inputAllowed()||round._restrained(p)||p.id===-1||p.seated||p.crouched||p._drawnSlot!=null||p.mapActivity||!['gathering','class'].includes(round.stage))return false;
 if(!['hang','plunge'].includes(kind))return false;
 const other=round.students.some(a=>a!==p&&a.mapActivity?.kind===kind&&a.mapActivity.id===id);if(other)return false;
 let target,stand;
 if(kind==='hang'){
  if(round.map!=='playground')return false;const b=barById(id);if(!b)return false;
  target=b;stand={x:b.x-.45,z:b.z};
  if(distance(p,b)>1.55||!round._clearWallSegment(p,stand))return false;
 }else{
  if(round.map!=='toilet'||!Number.isInteger(id)||!round.toiletClogs[id])return false;
  target=toiletBowl(id);if(!target||round.students.some(a=>a!==p&&a.seated&&a.seatId===id)||round.toiletDoors[id]<.85)return false;
  stand={x:target.x,z:target.z+.65};
  if(distance(p,target)>1.45||!round._clearWallSegment(p,stand))return false;
 }
 if(round._blocked(stand.x,stand.z,.18)||round.students.some(a=>a!==p&&a.visible!==false&&!a.seated&&distance(a,stand)<.36))return false;
 p.x=stand.x;p.z=stand.z;p.yaw=kind==='hang'?Math.PI/2:Math.PI;p.pitch=kind==='hang'?-.35:.55;
 p.mapActivity={kind,id,age:0,progress:0,bodyYaw:p.yaw};p.mood=kind==='hang'?'hanging':'plunging';p.holding=false;round.holding=false;round._movement={x:0,z:0};return true;
}
export function advanceMapActivities(round,dt){
 for(const p of round.students){const a=p.mapActivity;if(!a)continue;
  if(round._restrained(p)||p.visible===false||p._networkDeparted){releaseMapActivity(round,p);continue;}
  a.age+=dt;p.mood=a.kind==='hang'?'hanging':'plunging';
  if(a.kind==='plunge'){
   if(!round.toiletClogs[a.id]){releaseMapActivity(round,p);continue;}
   a.progress=Math.min(1,a.age/PLUNGE_SECONDS);
   if(a.progress>=1-1e-8){round.toiletClogs[a.id]=false;round._events.push({type:'toilet-cleared',studentId:p.id,toiletId:a.id,x:p.x,z:p.z});releaseMapActivity(round,p);}
  }
 }
}
