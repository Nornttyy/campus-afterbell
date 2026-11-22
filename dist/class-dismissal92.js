// Dismissal uses the same seats, paths, collision and walking speeds as the lesson.
import {CORRIDOR,LIFT,DOORS,OFFICE,OFFICE_CHAIRS,blocked,chairExit,queueLayoutDoors} from './classroom-layout.js?v=campus-92';
import {schoolDoorMotionBlocked} from './school-door-motion65.js?v=campus-92';
import {BUS} from './bus-layout86.js?v=campus-92';

const inside=(a,r,margin=0)=>a.x>=r.minX+margin&&a.x<=r.maxX-margin&&a.z>=r.minZ+margin&&a.z<=r.maxZ-margin;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const geometry={doors:DOORS,office:OFFICE};
function passedThreshold(actor,map){
 if(!reachedHall(actor,map))return false;
 if(map==='bus'||actor.x>9.6)return true;
 return !DOORS.some(door=>Math.abs(actor.z-door.maxZ)<2.8&&schoolDoorMotionBlocked(door.id,1,0,[actor],geometry));
}
export function reachedHall(actor,map){
 const hall=map==='bus'?BUS.station:CORRIDOR;
 return inside(actor,hall,.18)||inside(actor,LIFT,.14)||
   (actor.x>LIFT.minX+.24&&actor.x<LIFT.maxX-.24&&actor.z>=hall.maxZ-.22&&actor.z<=LIFT.minZ+.22);
}
export function returnPose(p){return {x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch,...(p.character?{character:p.character,variant:p.variant}:{} )};}
function doors(round,closed){
 queueLayoutDoors(round.layout,{frontDoorClosed:closed,rearDoorClosed:closed,officeDoorClosed:closed,officeLocked:false});
 for(const targets of [round._dormDoorTargets,round._toiletDoorTargets])for(const id of Object.keys(targets))targets[id]=!closed;
}
function stand(round,actor){
 if(actor.seated){
  const seat=actor._officeChair?OFFICE_CHAIRS.find(c=>c.id===actor._officeChairId):round.seats[actor.seatId];
  if(seat){
   const exit=Number.isFinite(seat.exitX)?{x:seat.exitX,z:seat.exitZ}:chairExit(seat,.20,round.layout);
   if(!exit||blocked(exit.x,exit.z,.18,round.layout,seat.busDeck))return false;
   Object.assign(actor,exit);
  }
 }
 Object.assign(actor,{seated:false,seatId:null,bedId:null,lying:false,sleeping:false,_officeChair:false,crouched:false,_bedPostureHeld:false,mood:'standing'});
 return true;
}
export function beginDismissal(round){
 const humans=new Set(round._dismissalHumans());
 const queue=round.students.filter(a=>a.visible!==false&&!humans.has(a)&&!a.networkHuman&&!a.isPlayer);
 for(const a of new Set([...round.students,...humans,round.teacher])){
  Object.assign(a,{caught:false,captivity:'free',postId:null,_chalkUntil:0,_drawerOpen:false,_computerActive:false,_penTaken:false,_drawnSlot:null,_examMode:null,holding:false,_eating:false,_bubbleUntil:0,_inkUntil:0,_flashUntil:0});
 }
 round._writing=false;round.teacher.carriedId=null;round._doorUse=false;round._doorProgress=0;
 round.chalks=[];round._cast=null;round._teacherEntryRoute=null;
 doors(round,false);
 // Nearest seats empty first, so the procession forms in the aisle.
 queue.sort((a,b)=>distance(a,LIFT)-distance(b,LIFT)||a.id-b.id);
 if(!round.room&&!humans.has(round.teacher)&&round.player.id!==-1){
  Object.assign(round.teacher,{phase:'patrol',intent:'walk',warning:false,attention:0,visible:true});queue.push(round.teacher);
 }
 return {time:0,closing:false,complete:false,left:0,queue:queue.map((actor,i)=>({actor,at:.24+i*.82,route:[],retry:0,stood:false})),nextExit:0};
}
export function advanceDismissal(round,dt,speed){
 const d=round._dismissal;d.time+=dt;
 const acknowledged=round.room?[...round.room.members.values()].filter(m=>m.connected&&m.continued).map(m=>m.context.player):round._dismissalHumans();
 for(const p of acknowledged)if(p.seated)stand(round,p);
 if(round.map==='bus'&&round.layout.busDeparted)return;
 for(const entry of d.queue){
  const a=entry.actor;
  if(a.visible===false||d.time<entry.at)continue;
  if(!entry.stood){entry.stood=stand(round,a);if(!entry.stood)continue;}
  const inCabin=inside(a,LIFT,.25)&&distance(a,LIFT)<.48;
  if(inCabin){
   if(d.time>=d.nextExit){a.visible=false;a.mood='standing';d.left++;d.nextExit=d.time+.36;}
   continue;
  }
  if(!entry.route.length&&d.time>=entry.retry){entry.route=round._walkRoute(a,LIFT,.2);entry.retry=d.time+.72;}
  const x=a.x,z=a.z;
  round._follow(a,entry.route,speed,dt);a.mood='walking';
  if(entry.route.length&&Math.hypot(a.x-x,a.z-z)<.00001&&d.time>=entry.retry){entry.route=[];entry.retry=d.time+.15;}
 }
 const humans=round._dismissalHumans();
 const clear=humans.length>0&&humans.every(a=>reachedHall(a,round.map))&&d.queue.every(e=>e.actor.visible===false||passedThreshold(e.actor,round.map));
 if(clear!==d.closing){d.closing=clear;doors(round,clear);}
 if(d.closing&&round._dismissalConfirmed()&&d.left===d.queue.length&&Object.values(round.layout.doorMotion).every(door=>door.amount===0)&&[...Object.values(round.toiletDoors),...Object.values(round.dormDoors)].every(v=>v<.001))d.complete=true;
}
