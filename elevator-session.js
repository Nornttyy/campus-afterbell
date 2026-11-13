import {LIFT,CAMPUS_MAPS,isCampusMap,campusFloor,ELEVATOR_ENABLED,moveInRoom} from './classroom-layout.js?v=campus-76';

import {normalWalkSpeed,movementScale} from './movement55.js?v=campus-76';

// Two seconds for closing/settling, plus one second per floor crossed.
export const ELEVATOR_SECONDS=3;
export function elevatorDuration(fromMap,toMap){
 const from=campusFloor(fromMap),to=campusFloor(toMap);
 return from===0||to===0?ELEVATOR_SECONDS:2+Math.abs(to-from);
}
// Cabin motion stays live during transit, but no passenger can walk through
// the doors (including the brief visual closing/opening transition).
export function moveElevatorPassenger(player,movement,dt,layout){
 if(!player||!Number.isFinite(dt)||dt<=0||player.seated||player.caught||player.captivity&&player.captivity!=='free')return;
 const x=Number.isFinite(movement?.x)?movement.x:0,z=Number.isFinite(movement?.z)?movement.z:0,n=Math.max(1,Math.hypot(x,z));
 const speed=normalWalkSpeed(player)*movementScale(player,{x,z}),r=.18;
 let left=Math.min(dt,30);
 while(left>1e-9){const step=Math.min(left,1/60),next=moveInRoom(player,x/n*speed*step,z/n*speed*step,r,layout);player.x=Math.max(LIFT.minX+r,Math.min(LIFT.maxX-r,next.x));player.z=Math.max(LIFT.minZ+r,Math.min(LIFT.maxZ-r,next.z));left-=step;}
}
export const createElevator=()=>({phase:'idle',used:false,remaining:0,targetMap:null});
export function inElevator(player){
 const r=.18;
 return !!player&&Number.isFinite(player.x)&&Number.isFinite(player.z)&&!player.seated&&!player.caught&&(!player.captivity||player.captivity==='free')&&!(player.stunLeft>0)&&player.x>=LIFT.minX+r&&player.x<=LIFT.maxX-r&&player.z>=LIFT.minZ+r&&player.z<=LIFT.maxZ-r;
}
// Disconnected humans keep their seat for the existing reconnect grace period.
// They must reconnect or leave before departure; AI never enters this list.
export function elevatorSnapshot(trip,people,{stage='gathering',status='playing',host=true}={}){
 const state=trip||createElevator(),inside=people.filter(p=>p.connected!==false&&inElevator(p.player)).length,total=people.length;
 const canTravel=ELEVATOR_ENABLED&&host&&stage==='gathering'&&status==='playing'&&state.phase==='idle'&&!state.used&&total>0&&inside===total;
 const closed=!ELEVATOR_ENABLED||state.phase==='travel';
 return {...state,inside,total,canTravel,disabled:!ELEVATOR_ENABLED,doorClosed:closed,doorAmount:closed?0:1};
}
export function departureError(trip,people,{map,currentMap,stage,status,host=true}){
 if(!ELEVATOR_ENABLED)return '电梯已封闭';
 if(!host)return '只有房主可以选楼层';
 if(!isCampusMap(map))return '楼层不存在';
 if(trip.phase==='travel')return '电梯正在运行';
 if(trip.used)return '本局电梯已使用';
 if(stage!=='gathering'||status!=='playing')return '请在课前集合时选楼层';
 if(map===currentMap)return '已经在这一层';
 if(people.some(p=>p.connected===false))return '等待断线同学重连或离开';
 if(!elevatorSnapshot(trip,people,{stage,status,host}).canTravel)return '所有玩家进入电梯后才能出发';
 return null;
}
export function departElevator(trip,map,currentMap='classroom'){if(!ELEVATOR_ENABLED)return false;const duration=elevatorDuration(currentMap,map);Object.assign(trip,{phase:'travel',used:true,remaining:duration,duration,targetMap:map});}
export function advanceElevator(trip,dt){
 if(!ELEVATOR_ENABLED||trip.phase!=='travel'||!Number.isFinite(dt)||dt<=0)return null;
 trip.remaining=Math.max(0,trip.remaining-dt);
 if(trip.remaining>1e-8)return null;
 const map=trip.targetMap;Object.assign(trip,{phase:'idle',remaining:0,targetMap:null});return map;
}
