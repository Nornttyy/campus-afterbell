import {LIFT,CAMPUS_MAPS} from './classroom-layout.js?v=campus-52';

export const ELEVATOR_SECONDS=3;
export const createElevator=()=>({phase:'idle',used:false,remaining:0,targetMap:null});
export function inElevator(player){
 const r=.18;
 return !!player&&Number.isFinite(player.x)&&Number.isFinite(player.z)&&!player.seated&&!player.caught&&(!player.captivity||player.captivity==='free')&&!(player.stunLeft>0)&&player.x>=LIFT.minX+r&&player.x<=LIFT.maxX-r&&player.z>=LIFT.minZ+r&&player.z<=LIFT.maxZ-r;
}
// Disconnected humans keep their seat for the existing reconnect grace period.
// They must reconnect or leave before departure; AI never enters this list.
export function elevatorSnapshot(trip,people,{stage='gathering',status='playing',host=true}={}){
 const state=trip||createElevator(),inside=people.filter(p=>p.connected!==false&&inElevator(p.player)).length,total=people.length;
 const canTravel=host&&stage==='gathering'&&status==='playing'&&state.phase==='idle'&&!state.used&&total>0&&inside===total;
 return {...state,inside,total,canTravel,doorClosed:state.phase==='travel',doorAmount:state.phase==='travel'?0:1};
}
export function departureError(trip,people,{map,currentMap,stage,status,host=true}){
 if(!host)return '只有房主可以选楼层';
 if(!CAMPUS_MAPS.includes(map))return '楼层不存在';
 if(trip.phase==='travel')return '电梯正在运行';
 if(trip.used)return '本局电梯已使用';
 if(stage!=='gathering'||status!=='playing')return '请在课前集合时选楼层';
 if(map===currentMap)return '已经在这一层';
 if(people.some(p=>p.connected===false))return '等待断线同学重连或离开';
 if(!elevatorSnapshot(trip,people,{stage,status,host}).canTravel)return '所有玩家进入电梯后才能出发';
 return null;
}
export function departElevator(trip,map){Object.assign(trip,{phase:'travel',used:true,remaining:ELEVATOR_SECONDS,targetMap:map});}
export function advanceElevator(trip,dt){
 if(trip.phase!=='travel'||!Number.isFinite(dt)||dt<=0)return null;
 trip.remaining=Math.max(0,trip.remaining-dt);
 if(trip.remaining>1e-8)return null;
 const map=trip.targetMap;Object.assign(trip,{phase:'idle',remaining:0,targetMap:null});return map;
}
