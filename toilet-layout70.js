// The reference has 28 adjoining cubicles. Bay spacing and aisle widths are
// reconstructed from the seated view and the teacher's walk past the row.
export const TOILET_BOUNDS=Object.freeze({minX:-6.65,maxX:7.2,minZ:-10,maxZ:8.8});
export const TOILET_STALL_SIZE=Object.freeze({width:1.68,depth:2.38,height:1.83,bottom:.18});
export const TOILET_DOOR=Object.freeze({width:1.44,depth:.045,height:1.65,bottom:.24,hingeX:-.72,hingeZ:1.19,handleX:1.31,angle:-Math.PI*.475});
export const TOILET_CABINET=Object.freeze({x:.6425,z:-.49,width:.43,depth:.35,height:1.12,bottom:.40,yaw:-Math.PI/2,doorAngle:-Math.PI*.48});
export const TOILET_STALLS=Object.freeze([-8.50,-4.06,.38,4.82].flatMap((z,row)=>
 Array.from({length:7},(_,col)=>Object.freeze({id:row*7+col,row,col,x:-5.72+col*TOILET_STALL_SIZE.width,z,yaw:0}))));
export const TOILET_SEATS=Object.freeze(TOILET_STALLS.map(s=>Object.freeze({
 id:s.id,row:s.row,col:s.col,x:s.x-.18,z:s.z-.48,y:.36,yaw:0,
 // Existing interaction callers use deskX/Z; these are CABINET anchors.
 deskX:s.x+TOILET_CABINET.x,deskZ:s.z+TOILET_CABINET.z,
 cabinetYaw:TOILET_CABINET.yaw,cabinetX:s.x+TOILET_CABINET.x,cabinetZ:s.z+TOILET_CABINET.z,
 exitX:s.x-.18,exitZ:s.z+1.68,map:'toilet',pattern:'toilet-cubicle',surface:'toilet',hideBook:true,hidePen:true
})));
const volume=(id,minX,maxX,minZ,maxZ,minY,maxY)=>Object.freeze({id,minX,maxX,minZ,maxZ,minY,maxY});
const fixedFixtures=Object.freeze(TOILET_STALLS.flatMap(s=>[
 ...(s.col===0?[volume('toilet-left-'+s.id,s.x-.87,s.x-.81,s.z-1.22,s.z+1.22,.18,2.01)]:[]),
 volume('toilet-right-'+s.id,s.x+.81,s.x+.87,s.z-1.22,s.z+1.22,.18,2.01),
 volume('toilet-rear-'+s.id,s.x-.81,s.x+.81,s.z-1.22,s.z-1.16,.18,2.01),
 volume('toilet-hinge-'+s.id,s.x-.84,s.x-.72,s.z+1.15,s.z+1.23,.18,1.89),
 volume('toilet-latch-'+s.id,s.x+.72,s.x+.84,s.z+1.15,s.z+1.23,.18,1.89),
 volume('toilet-bowl-'+s.id,s.x-.437,s.x+.077,s.z-.822,s.z-.174,0,.365),
 volume('toilet-tank-'+s.id,s.x-.437,s.x+.077,s.z-1.073,s.z-.687,0,.75)
]));
// Food cupboards are hollow: projectile/flash tests see their back, sides
// and two shelf bays. Walking still uses the cupboard's full footprint.
// Cabinet local +Z faces inward, so it maps to world -X.
function cabinetBox(s,part,x1,x2,z1,z2,y1,y2){
 const c=TOILET_CABINET;
 return volume('toilet-cabinet-'+part+'-'+s.id,s.x+c.x-z2,s.x+c.x-z1,s.z+c.z+x1,s.z+c.z+x2,c.bottom+y1,c.bottom+y2);
}
export const TOILET_WALK_SOLIDS=Object.freeze([...fixedFixtures,...TOILET_STALLS.map(s=>cabinetBox(s,'footprint',-.215,.215,-.175,.175,0,1.12))]);
export const TOILET_SOLIDS=Object.freeze([...fixedFixtures,...TOILET_STALLS.flatMap(s=>[
 cabinetBox(s,'back',-.215,.215,-.174,-.146,0,1.12),
 cabinetBox(s,'left',-.215,-.189,-.175,.175,0,1.12),
 cabinetBox(s,'right',.189,.215,-.175,.175,0,1.12),
 ...[0,.537,1.094].map((y,i)=>cabinetBox(s,'shelf-'+i,-.2025,.2025,-.175,.175,y,y+.026))
])]);
const clamp=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
const stallFor=value=>typeof value==='object'&&value?value:TOILET_STALLS.find(s=>s.id===Number(value));
// Hinged leaves are segmented rather than one huge diagonal AABB. The same
// angle and pivot are used by rendered geometry and movement/projectile tests.
function leafVolumes(id,x,z,width,depth,angle,minY,maxY){
 const count=12,length=width/count,cos=Math.cos(angle),sin=Math.sin(angle),rx=Math.abs(cos)*length/2+Math.abs(sin)*depth/2,rz=Math.abs(sin)*length/2+Math.abs(cos)*depth/2;
 return Array.from({length:count},(_,i)=>{const t=(i+.5)*length,cx=x+cos*t,cz=z-sin*t;return volume(id+'-'+i,cx-rx,cx+rx,cz-rz,cz+rz,minY,maxY);});
}
export function toiletDoorReach(actor,id){
 return actor.seated&&actor.seatId===id ? 3.65 : 2.45;
}
export function toiletDoorPose(id,openness=0){
 const s=stallFor(id);if(!s)return null;
 return{x:s.x+TOILET_DOOR.hingeX,z:s.z+TOILET_DOOR.hingeZ,angle:TOILET_DOOR.angle*clamp(openness),openness:clamp(openness)};
}
export function toiletDoorSolids(id,openness=0){
 const p=toiletDoorPose(id,openness);if(!p)return[];
 return leafVolumes('toilet-door-'+stallFor(id).id,p.x,p.z,TOILET_DOOR.width,TOILET_DOOR.depth,p.angle,TOILET_DOOR.bottom,TOILET_DOOR.bottom+TOILET_DOOR.height);
}
export function toiletCabinetDoorPose(id,openness=0){
 const s=stallFor(id);if(!s)return null;const c=TOILET_CABINET;
 return{x:s.x+c.x-c.depth/2-.012,z:s.z+c.z-c.width/2,angle:c.yaw+c.doorAngle*clamp(openness),openness:clamp(openness)};
}
export function toiletCabinetDoorSolids(id,openness=0){
 const p=toiletCabinetDoorPose(id,openness);if(!p)return[];const c=TOILET_CABINET;
 return leafVolumes('toilet-cabinet-door-'+stallFor(id).id,p.x,p.z,c.width,.028,p.angle,c.bottom,c.bottom+c.height);
}
export function toiletDynamicSolids(doorStates={},cabinetStates={}){
 const value=(states,id)=>{const v=states instanceof Map?states.get(id):states?.[id];return typeof v==='object'&&v?Number(v.openness??v.open):Number(v??0);};
 return TOILET_STALLS.flatMap(s=>[...toiletDoorSolids(s.id,value(doorStates,s.id)),...toiletCabinetDoorSolids(s.id,value(cabinetStates,s.id))]);
}
