// Shared door poses: 0 = shut, 1 = open. School doors are independent of the lift.
export const SCHOOL_DOOR_IDS=Object.freeze(['rear','front','office']);
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
export function createSchoolDoorMotion(closed={}){return Object.fromEntries(SCHOOL_DOOR_IDS.map(id=>[id,{amount:closed[id]?0:1,target:closed[id]?0:1}]));}
export function schoolDoorSnapshot(motion){return Object.fromEntries(SCHOOL_DOOR_IDS.map(id=>[id,{amount:motion[id].amount,target:motion[id].target,blocked:!!motion[id].blocked}]));}
export function setSchoolDoorTargets(motion,closed){for(const id of SCHOOL_DOOR_IDS)if(typeof closed[id]==='boolean')motion[id].target=closed[id]?0:1;return motion;}
export function copySchoolDoorMotion(motion,snapshot){for(const id of SCHOOL_DOOR_IDS){if(!snapshot?.[id])continue;motion[id].amount=clamp(snapshot[id].amount);motion[id].target=clamp(snapshot[id].target);motion[id].blocked=!!snapshot[id].blocked;}return motion;}
export function schoolDoorSegments(id,amount,geometry){
 const angle=clamp(amount)*Math.PI/2,s=Math.sin(angle),c=Math.cos(angle),leaves=[];
 if(id==='office')for(const [i,x]of [geometry.office.doorMinX,geometry.office.doorMaxX].entries())leaves.push({x,z:8.91,dx:(i===0?1:-1)*.90*c,dz:.90*s,thickness:.09});
 else{const d=geometry.doors.find(d=>d.id===id);if(!d)return[];leaves.push({x:7.30,z:d.maxZ,dx:(d.maxZ-d.minZ)*s,dz:-(d.maxZ-d.minZ)*c,thickness:.085});}
 // Short conservative boxes follow the rotating panel; a single whole-leaf
 // bounding box would block the empty triangle beside a half-open door.
 return leaves.flatMap(leaf=>Array.from({length:8},(_,i)=>{const a=i/8,b=(i+1)/8,x0=leaf.x+leaf.dx*a,x1=leaf.x+leaf.dx*b,z0=leaf.z+leaf.dz*a,z1=leaf.z+leaf.dz*b,tx=Math.abs(c)*leaf.thickness,tz=Math.abs(s)*leaf.thickness;const xPad=id==='office'?tz:tx,zPad=id==='office'?tx:tz;return{minX:Math.min(x0,x1)-xPad,maxX:Math.max(x0,x1)+xPad,minZ:Math.min(z0,z1)-zPad,maxZ:Math.max(z0,z1)+zPad,minY:0,maxY:3.02,doorId:id};}));
}
function intersectsActor(box,actor){if(!actor||actor.visible===false||!Number.isFinite(actor.x)||!Number.isFinite(actor.z))return false;const x=Math.max(box.minX,Math.min(box.maxX,actor.x)),z=Math.max(box.minZ,Math.min(box.maxZ,actor.z));return Math.hypot(actor.x-x,actor.z-z)<(actor.radius??.20)+.015;}
export function schoolDoorMotionBlocked(id,from,to,actors,geometry){
 const old=schoolDoorSegments(id,from,geometry),next=schoolDoorSegments(id,to,geometry);
 return next.some((b,i)=>{const a=old[i],swept={minX:Math.min(a.minX,b.minX),maxX:Math.max(a.maxX,b.maxX),minZ:Math.min(a.minZ,b.minZ),maxZ:Math.max(a.maxZ,b.maxZ)};return actors.some(actor=>intersectsActor(swept,actor));});
}
export function advanceSchoolDoors(motion,dt,actors=[],geometry){
 if(!Number.isFinite(dt)||dt<=0)return false;let changed=false;
 for(const id of SCHOOL_DOOR_IDS){const door=motion[id];if(door.amount===door.target||!geometry&&door.blocked)continue;const next=door.target+(door.amount-door.target)*Math.exp(-8*dt),amount=Math.abs(next-door.target)<.0001?door.target:next;
  if(geometry&&schoolDoorMotionBlocked(id,door.amount,amount,actors,geometry)){door.blocked=true;continue;}
  door.blocked=false;door.amount=amount;changed=true;
 }
 return changed;
}
