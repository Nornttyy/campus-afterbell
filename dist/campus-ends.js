// The end rooms are authored in a common prefab frame. A half-turn places the
// lift north and the office south of the corridor without reflecting the props.
export const HALL=Object.freeze({minX:7.40,maxX:12.44,minZ:-17.52,maxZ:8.80});
export const END_ORIGIN=Object.freeze({x:HALL.minX+HALL.maxX,z:HALL.minZ+HALL.maxZ});
export const officePlan=Object.freeze({minX:-1.20,maxX:HALL.maxX,minZ:9.02,maxZ:20.80,doorX:9.20,doorMinX:8.30,doorMaxX:10.10});
export const liftPlan=Object.freeze({minX:8.10,maxX:10.60,minZ:HALL.minZ-3,maxZ:HALL.minZ-.20,x:9.35,z:HALL.minZ-1.70});
export function endPoint(x,z){return {x:END_ORIGIN.x-x,z:END_ORIGIN.z-z};}
export function endBounds(b){return {...b,minX:END_ORIGIN.x-b.maxX,maxX:END_ORIGIN.x-b.minX,minZ:END_ORIGIN.z-b.maxZ,maxZ:END_ORIGIN.z-b.minZ};}

const desk=(id,x,z)=>Object.freeze({id,x,z,width:1.844,depth:.892,yaw:0,drawerX:x,drawerZ:z-.52});
// The front aisle stays open. Two work surfaces run along the far wall and
// the other work surfaces sit to the sides of the room.
export const officeDeskPlans=Object.freeze([
 desk('office-lunch',10.45,17.10),desk('office-work-0',1.12,12.45),
 desk('office-work-1',1.14,16.05),desk('office-work-2',3.45,19.40),desk('office-work-3',6.34,19.40)
]);
export const officeChairPlans=Object.freeze(officeDeskPlans.map((d,i)=>Object.freeze({
 id:i===0?'office-chair':d.id+'-chair',deskId:d.id,x:d.x,z:d.z-1.14,yaw:0
})));
export const officeBoardPlan=Object.freeze({x:8,z:20.35});
