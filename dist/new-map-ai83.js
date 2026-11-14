import {PLAYGROUND_LAYOUT} from './playground-layout70.js?v=campus-83';
import {DORM_ROOMS,dormRoomPoint} from './dorm-layout70.js?v=campus-83';
import {HOTPOT_TABLES} from './hotpot-layout70.js?v=campus-83';
import {TOILET_STALLS} from './toilet-layout70.js?v=campus-83';
import {NORMAL_WALK_SPEEDS} from './movement55.js?v=campus-83';
import {startMapActivity,releaseMapActivity} from './map-activities77.js?v=campus-83';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const vendingApproach=v=>({x:v.x+Math.sin(v.yaw)*.95,z:v.z+Math.cos(v.yaw)*.95});
// Locations come from the existing reference-based furnishings. Delays and
// decision weights are local AI tuning, not measured original-game constants.
export function inspectionPoints(map){
 if(map==='dorm')return DORM_ROOMS.flatMap(r=>[3.9,7.4].map((z,i)=>({...dormRoomPoint(r.id,0,z),roomId:r.id,row:i,checkpointId:`bed-${r.id}-${i}`})));
 if(map==='toilet')return TOILET_STALLS.map(s=>({x:s.x+.65,z:s.z+2.70,stallId:s.id,checkpointId:`stall-${s.id}`}));
 if(map==='hotpot')return HOTPOT_TABLES.map(t=>({x:t.x+2.05,z:t.z+2.05,tableId:t.id,checkpointId:`table-${t.id}`}));
 if(map==='playground')return [...PLAYGROUND_LAYOUT.vending.map(v=>({...vendingApproach(v),checkpointId:v.id})),...PLAYGROUND_LAYOUT.bars.filter((_,i)=>i%2===0).map(b=>({x:b.x-1.8,z:b.z,checkpointId:b.id}))];
 return [];
}
function freeBar(round,a){return PLAYGROUND_LAYOUT.bars.find(b=>!round.students.some(other=>other!==a&&(other.mapActivity?.id===b.id||other._outdoorGoal?.barId===b.id)));}
function trackPoint(index){
 const t=PLAYGROUND_LAYOUT.track,angle=(index%12)/12*Math.PI*2,r=t.innerRadius+t.laneWidth*1.4;
 return {x:t.cx+Math.sin(angle)*r,z:t.cz+Math.cos(angle)*r+(Math.cos(angle)>=0?t.straightHalf:-t.straightHalf)};
}
function roam(round,a){
 a._trackIndex=(a._trackIndex??a.id)+1;
 return goal(round,a,trackPoint(a._trackIndex),{track:true});
}
function stop(a){a.holding=false;a._drawerOpen=false;a._computerActive=false;a.studyBookHeld=false;}
function goal(round,a,point,extra){
 const route=round._walkRoute(a,point,.2);
 if(!route.length&&distance(a,point)>.12)return false;
 a._outdoorGoal={...extra,point,route};return true;
}
export function advancePlaygroundPupil(round,a,dt){
 if(round.map!=='playground'||a.isPlayer||a.networkHuman)return false;
 // Keep a held action alive between the shared AI decision ticks.
 if(a.isTeammate&&!a._outdoorGoal&&!a.mapActivity&&round.elapsed>=(a._restUntil||0)&&a._slots.some(s=>s.action))return false;
 stop(a);
 if(a._outdoorGoal){
  const g=a._outdoorGoal;
  if(round._follow(a,g.route,NORMAL_WALK_SPEEDS.student,dt,.2)){
   a._outdoorGoal=null;
   if(g.barId)startMapActivity(round,'hang',g.barId,a);
   if(g.vendingId){
    const foods=['snack','drink','burger'],food=foods[(a.id+Math.floor(round.elapsed/20))%foods.length];
    if(round._takePlaygroundFood(a,food)){
     const v=PLAYGROUND_LAYOUT.vending.find(v=>v.id===g.vendingId),side=a.id%2?1:-1;
     for(const offset of[side*4,-side*4,side*7]){
      const point={x:v.x+Math.sin(v.yaw)*(3+a.id%3),z:v.z+offset};
      if(goal(round,a,point,{leaveVending:true}))break;
     }
    }a._decisionAt=round.elapsed;
   }
  }
  a.mood=a.mapActivity?'hanging':'walking';return true;
 }
 if(a.mapActivity){
  if(!a.isTeammate||round.elapsed<(a._restUntil||0)||round.elapsed<(a._outdoorAt??(a.id%5+2)))return true;
  releaseMapActivity(round,a);
 }
 if(a.isTeammate&&round.elapsed>=(a._restUntil||0)){
  if(a._slots.some(s=>s.action))return false; // Shared consumption/evidence/scoring, never free points.
  if(round.elapsed<(a._outdoorAt||0))return true;
  a._outdoorAt=round.elapsed+2;
  const cost=v=>distance(a,v)+round.students.filter(o=>o!==a&&(o._outdoorGoal?.vendingId===v.id||distance(o,v)<2)).length*12;
  const machines=[...PLAYGROUND_LAYOUT.vending].sort((x,y)=>cost(x)-cost(y));
  for(const v of machines)if(goal(round,a,vendingApproach(v),{vendingId:v.id}))return true;
 }else{
  const bar=freeBar(round,a);
  if(bar&&goal(round,a,{x:bar.x-.45,z:bar.z},{barId:bar.id}))return true;
  if(round.elapsed>=(a._outdoorAt||0)){a._outdoorAt=round.elapsed+2;roam(round,a);}
 }
 a.mood='standing';return true;
}
