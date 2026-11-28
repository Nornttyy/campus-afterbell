import {PLAYGROUND_LAYOUT} from './playground-layout70.js?v=campus-117&rev=157';
import {DORM_ROOMS,DORM_BUNK_ROWS,dormRoomPoint} from './dorm-layout70.js?v=campus-95&rev=127';
import {diningPlanForSeats} from './hotpot-layout70.js?v=campus-94&rev=154';
import {TOILET_STALLS} from './toilet-layout70.js?v=campus-94';
import {normalWalkSpeed} from './movement55.js?v=campus-117&rev=157';
import {releaseMapActivity} from './map-activities77.js?v=campus-117&rev=157';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const vendingApproach=v=>({x:v.x+Math.sin(v.yaw)*.94+Math.cos(v.yaw)*.51,z:v.z+Math.cos(v.yaw)*.94-Math.sin(v.yaw)*.51});
// Locations come from the existing reference-based furnishings. Delays and
// decision weights are local AI tuning, not measured original-game constants.
export function inspectionPoints(map,seats){
 if(map==='bus')return [{x:5.62,z:-13.31,busDeck:0,checkpointId:'coach-aisle'},{x:-4.38,z:-14.26,busDeck:0,checkpointId:'coach-washroom'},{x:6.03,z:-12.91,busDeck:1,checkpointId:'coach-study-deck'}];
 if(map==='dorm')return DORM_ROOMS.flatMap(r=>DORM_BUNK_ROWS.map((z,i)=>({...dormRoomPoint(r.id,0,z),roomId:r.id,row:i,checkpointId:`bed-${r.id}-${i}`})));
 if(map==='toilet')return TOILET_STALLS.map(s=>({x:s.x,z:s.z+2.90,stallId:s.id,checkpointId:`stall-${s.id}`}));
 if(map==='hotpot')return diningPlanForSeats(seats).tables.map(t=>({x:t.x+t.size/2+.51,z:t.z+t.size/2+.51,tableId:t.id,checkpointId:`table-${t.id}`}));
 if(map==='playground')return PLAYGROUND_LAYOUT.vending.map(v=>({...vendingApproach(v),checkpointId:v.id}));
 return [];
}
function roam(round,a){
 const t=PLAYGROUND_LAYOUT.track;
 // Follow the stadium oval in short chords. The random entry and lane keep
 // pupils independent without sending them across the infield between turns.
 const r=a._laneRadius??=round._range(t.innerRadius+.36,t.outerRadius-.36);
 const straight=t.straightHalf*2,arc=Math.PI*r,lap=2*(straight+arc);
 const d=a._trackDistance??round._range(0,lap);
 const direction=a._trackDirection??=(round._range(0,1)<.5?-1:1);
 let x,z;
 if(d<straight){x=r;z=-t.straightHalf+d;}
 else if(d<straight+arc){const angle=(d-straight)/r;x=r*Math.cos(angle);z=t.straightHalf+r*Math.sin(angle);}
 else if(d<2*straight+arc){x=-r;z=t.straightHalf-(d-straight-arc);}
 else{const angle=(d-2*straight-arc)/r;x=-r*Math.cos(angle);z=-t.straightHalf-r*Math.sin(angle);}
 a._trackDistance=(d+direction*3.4+lap)%lap;
 const point={x:t.cx+x,z:t.cz+z};
 // Grid routing to a point three metres ahead can briefly turn the runner
 // back toward the nearest grid cell. Use the actual lane chord when clear.
 const length=distance(a,point),steps=Math.ceil(length/.15);
 if(length<4.5){
  let clear=true;
  for(let i=1;i<=steps;i++)if(round._blocked(a.x+(point.x-a.x)*i/steps,a.z+(point.z-a.z)*i/steps,.2)){clear=false;break;}
  if(clear){a._outdoorGoal={track:true,point,route:[point]};return true;}
 }
 return goal(round,a,point,{track:true});
}
export function startFieldWalkers(round){
 const occupied=round.students.filter(a=>a.isPlayer||a.networkHuman);
 for(const a of round.students){
  if(a.isPlayer||a.networkHuman)continue;
  const t=PLAYGROUND_LAYOUT.track;
  for(let tries=0;tries<80;tries++){
   const x=t.cx+round._range(-13,13),z=t.cz+round._range(-22,22);
   if(round._blocked(x,z,.24)||occupied.some(o=>Math.hypot(o.x-x,o.z-z)<.9))continue;
   Object.assign(a,{x,z});break;
  }
  Object.assign(a,{seated:false,seatId:null,visible:true,mood:'walking'});occupied.push(a);roam(round,a);
 }
}
export function walkFieldBeforeClass(round,a,dt){
 if(a.isPlayer||a.networkHuman||round._restrained(a))return;
 if(!a._outdoorGoal)roam(round,a);
 if(a._outdoorGoal&&round._follow(a,a._outdoorGoal.route,normalWalkSpeed(a,round.map),dt,.2))a._outdoorGoal=null;
 a.mood='walking';
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
  if(round._follow(a,g.route,normalWalkSpeed(a,round.map),dt,.2)){
   a._outdoorGoal=null;
   if(g.track&&!a.isTeammate)roam(round,a);
   if(g.vendingId){
    
    if(round._collectVendingFood(a,g.vendingId)){
     const v=PLAYGROUND_LAYOUT.vending.find(v=>v.id===g.vendingId),side=a.id%2?1:-1;
     for(const offset of[side*4,-side*4,side*7]){
      const point={x:v.x+Math.sin(v.yaw)*(3+a.id%3),z:v.z+offset};
      if(goal(round,a,point,{leaveVending:true}))break;
     }
    }else if(round._pressVendingButton(a,g.vendingId)){
     a._outdoorGoal=g;a.mood='standing';return true;
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
  if(round.elapsed>=(a._outdoorAt||0))a._outdoorAt=roam(round,a)?0:round.elapsed+1;
 }
 a.mood='standing';return true;
}
