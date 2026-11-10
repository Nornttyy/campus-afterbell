import {DOORS} from './classroom-layout.js?v=campus-65';
import {OFFICE} from './classroom-layout.js?v=campus-65';
import {schoolDoorSegments,schoolDoorMotionBlocked,SCHOOL_DOOR_IDS} from './school-door-motion65.js?v=campus-65';
// Aim at the actual animated leaf, not an invisible doorway centre.
export function reachesSchoolDoor(player,layout,id='rear'){
 if(!SCHOOL_DOOR_IDS.includes(id))return false;
 const amount=layout.doorMotion?.[id]?.amount??(id==='office'?layout.officeLocked?0:1:layout[id+'DoorClosed']?0:1);
 const leaves=schoolDoorSegments(id,amount,{doors:DOORS,office:OFFICE});
 return leaves.some(leaf=>{
  let lo=0,hi=1;
  for(const [axis,direction]of [['X',Math.sin(player.yaw)*1.9],['Z',Math.cos(player.yaw)*1.9]]){
   const origin=player[axis.toLowerCase()],min=leaf['min'+axis]-.10,max=leaf['max'+axis]+.10;
   if(Math.abs(direction)<1e-8){if(origin<min||origin>max)return false;continue;}
   let a=(min-origin)/direction,b=(max-origin)/direction;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return false;
  }
  return hi>=0&&lo<=1;
 });
}
export const reachesRearDoor=(player,layout)=>reachesSchoolDoor(player,layout,'rear');
export function schoolDoorSweepBlocked(id,actors){
 if(id==='rear')return rearDoorSweepBlocked(actors);
 if(!SCHOOL_DOOR_IDS.includes(id))return true;
 for(let i=0;i<24;i++)if(schoolDoorMotionBlocked(id,i/24,(i+1)/24,actors,{doors:DOORS,office:OFFICE}))return true;
 return false;
}
// The rear leaf pivots from +X (open) to -Z (closed). Check the entire
// quarter-disc swept by the leaf, not only its final thin collision box.
export function rearDoorSweepBlocked(actors){
 const door=DOORS.find(d=>d.id==='rear'),length=door.maxZ-door.minZ;
 return actors.some(actor=>{
  if(!actor||actor.visible===false||!Number.isFinite(actor.x)||!Number.isFinite(actor.z))return false;
  const x=actor.x-7.30,z=door.maxZ-actor.z;
  let nx=Math.max(0,x),nz=Math.max(0,z);const distance=Math.hypot(nx,nz);
  if(distance>length){nx*=length/distance;nz*=length/distance;}
  // Body radius plus the leaf's half thickness, with a small clearance.
  return Math.hypot(x-nx,z-nz)<.35;
 });
}
