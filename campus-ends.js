// Campus end rooms use the same world coordinates for rendering and movement.
export const HALL=Object.freeze({minX:7.40,maxX:12.44,minZ:-12.20,maxZ:14.12});
// The end-room prefabs face each other. Turn them together to retain their
// interior handedness, including the lift controls and the office furniture.
export const END_ORIGIN=Object.freeze({x:HALL.minX+HALL.maxX,z:HALL.minZ+8.80});
export function endPoint(x,z){return {x:END_ORIGIN.x-x,z:END_ORIGIN.z-z};}
export function endBounds(b){return {...b,minX:END_ORIGIN.x-b.maxX,maxX:END_ORIGIN.x-b.minX,minZ:END_ORIGIN.z-b.maxZ,maxZ:END_ORIGIN.z-b.minZ};}
const liftDoorZ=END_ORIGIN.z-HALL.maxZ;
export const officePlan=Object.freeze({minX:3.05,maxX:HALL.maxX,minZ:9.02,maxZ:16.94,height:3.92,doorX:9.20,doorMinX:8.30,doorMaxX:10.10});
export const liftPlan=Object.freeze({minX:8.10,maxX:10.60,minZ:liftDoorZ-3,maxZ:liftDoorZ-.20,x:9.35,z:liftDoorZ-1.70});

// Desks, chairs, monitor collisions and drawer targets share the same local axes.
export function officeOffset(origin,side,forward){
 const s=Math.sin(origin.yaw),c=Math.cos(origin.yaw);
 return {x:origin.x+side*c+forward*s,z:origin.z-side*s+forward*c};
}
function desk(id,x,z,yaw){
 const station={id,x,z,width:1.844,depth:.892,yaw},pull=officeOffset(station,0,-.52);
 return Object.freeze({...station,drawerX:pull.x,drawerZ:pull.z});
}
// Seen through the double doors, the back of a monitor is on the left;
// the occupied side of a second desk faces the door beside the bookcases.
// The three desk drawers have separate lunch boxes; the rear window stays clear.
export const officeDeskPlans=Object.freeze([
 desk('office-lunch',10.50,13.52,Math.PI),desk('office-work-0',5.60,11.80,Math.PI/2),
 desk('office-work-1',5.94,15.02,0)
]);
export const officeChairPlans=Object.freeze(officeDeskPlans.map((d,i)=>Object.freeze({
 id:i===0?'office-chair':d.id+'-chair',deskId:d.id,...officeOffset(d,0,-1.14),yaw:d.yaw
})));
export const officeBoardPlan=Object.freeze({x:8.92,z:16.24});

export const officeShelfCenters=Object.freeze([10.52,12.86,15.20]);
export const officeBinPlan=Object.freeze({x:officePlan.doorMinX-.60,z:officePlan.minZ+.39});
