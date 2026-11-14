import {teacherViewHeight} from './camera-height58.js?v=campus-79';
import {clearWallSegment,floorHeight,CLASSROOM} from './classroom-layout.js?v=campus-79';

export const SURVEILLANCE_RULES=Object.freeze({unlockElapsed:180,cooldown:180,limit:2});
export const SURVEILLANCE_MOUNTS=Object.freeze([
 Object.freeze({id:'front',x:CLASSROOM.minX+.35,y:3.18,z:CLASSROOM.maxZ-.22,target:Object.freeze({x:.5,y:1.3,z:-4.5})}),
 Object.freeze({id:'back',x:CLASSROOM.maxX-.35,y:3.18,z:CLASSROOM.minZ+.22,target:Object.freeze({x:-.5,y:1.3,z:3})})
]);
export function createSurveillance(){return{devices:[],nextDeployAt:0,viewing:null};}
export function surveillanceSnapshot(round,teacher=round.player?.id===-1){
 const store=round.surveillance||createSurveillance(),nextUnlockAt=(store.devices.length+1)*SURVEILLANCE_RULES.unlockElapsed;
 const unlockIn=store.devices.length<SURVEILLANCE_RULES.limit?Math.max(0,nextUnlockAt-round.elapsed):0,cooldown=store.devices.length?unlockIn:0;
 return{devices:store.devices.map(device=>({...device,target:{...device.target}})),viewing:teacher?store.viewing:null,remaining:Math.max(0,SURVEILLANCE_RULES.limit-store.devices.length),cooldown,unlockIn,available:teacher&&round.stage==='class'&&round.status==='playing'&&!round.paused&&unlockIn===0&&cooldown===0&&store.devices.length<SURVEILLANCE_RULES.limit};
}
// Deploy and view both require facing the real wall control, rather than
// accepting a client-provided point or allowing placement through a wall.
export function reachesSurveillance(round,id){
 const mount=SURVEILLANCE_MOUNTS.find(m=>m.id===id),p=round.player;
 if(!mount||p?.id!==-1||p.seated||round._restrained(p)||!round._classInputAllowed()||round.teacher.carriedId!=null)return false;
 const delta={x:mount.x-p.x,y:1.65+floorHeight(mount.x,mount.z,round.map)-(floorHeight(p.x,p.z,round.map)+teacherViewHeight(p)),z:mount.z-p.z};
 const distance=Math.hypot(delta.x,delta.y,delta.z),cp=Math.cos(p.pitch||0),dot=distance?(delta.x*Math.sin(p.yaw)*cp-delta.y*Math.sin(p.pitch||0)+delta.z*Math.cos(p.yaw)*cp)/distance:1;
 return distance<=2.5&&dot>.90&&clearWallSegment(p,mount,round.layout);
}
export function deploySurveillance(round,id){
 const state=surveillanceSnapshot(round);
 if(!state.available||!reachesSurveillance(round,id)||round.surveillance.devices.some(m=>m.id===id))return false;
 const mount=SURVEILLANCE_MOUNTS.find(m=>m.id===id);
 round.surveillance.devices.push({...mount,target:{...mount.target},installedAt:round.elapsed});
 round.surveillance.nextDeployAt=(round.surveillance.devices.length+1)*SURVEILLANCE_RULES.unlockElapsed;
 const next=surveillanceSnapshot(round);
 round._events.push({type:'surveillance-deployed',id,remaining:next.remaining,unlockIn:Math.ceil(next.unlockIn)});return true;
}
export function viewSurveillance(round,id){
 if(!reachesSurveillance(round,id)||!round.surveillance?.devices.some(m=>m.id===id))return false;
 round.surveillance.viewing=id;round._movement={x:0,z:0};return true;
}
export function closeSurveillance(round){if(!round.surveillance?.viewing)return false;round.surveillance.viewing=null;return true;}
