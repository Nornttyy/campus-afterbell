// The end rooms are authored in a common prefab frame. A half-turn places the
// lift north and the office south of the corridor without reflecting the props.
export const HALL=Object.freeze({minX:7.40,maxX:12.44,minZ:-17.52,maxZ:8.80});
export const END_ORIGIN=Object.freeze({x:HALL.minX+HALL.maxX,z:HALL.minZ+HALL.maxZ});
export const officePlan=Object.freeze({minX:-.40,maxX:HALL.maxX,minZ:9.02,maxZ:19.34,height:3.92,doorX:9.20,doorMinX:8.30,doorMaxX:10.10});
export const liftPlan=Object.freeze({minX:8.10,maxX:10.60,minZ:HALL.minZ-3,maxZ:HALL.minZ-.20,x:9.35,z:HALL.minZ-1.70});
export function endPoint(x,z){return {x:END_ORIGIN.x-x,z:END_ORIGIN.z-z};}
export function endBounds(b){return {...b,minX:END_ORIGIN.x-b.maxX,maxX:END_ORIGIN.x-b.minX,minZ:END_ORIGIN.z-b.maxZ,maxZ:END_ORIGIN.z-b.minZ};}

const desk=(id,x,z)=>Object.freeze({id,x,z,width:1.844,depth:.892,yaw:0,drawerX:x,drawerZ:z-.52});
// The front aisle stays open. Two work surfaces run along the far wall and
// the other work surfaces sit to the sides of the room.
export const officeDeskPlans=Object.freeze([
 desk('office-lunch',10.56,16.15),desk('office-work-0',1.62,12.40),
 desk('office-work-1',1.64,15.82),desk('office-work-2',3.75,18.25),desk('office-work-3',6.32,18.25)
]);
export const officeChairPlans=Object.freeze(officeDeskPlans.map((d,i)=>Object.freeze({
 id:i===0?'office-chair':d.id+'-chair',deskId:d.id,x:d.x,z:d.z-1.14,yaw:0
})));
export const officeBoardPlan=Object.freeze({x:8.92,z:18.66});

export const officeBinPlan=Object.freeze({x:officePlan.doorMinX-.60,z:officePlan.minZ+.39});
