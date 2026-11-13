// Reconstructed furnishings, not measured original dimensions. References:
// BV1LsWj6eEEU 23:00/23:10/24:10 and BV13L476gE1o 00:15/00:37.
// Twelve cubicles are this reconstruction's capacity. Occlusion in the source
// does not establish an exact original cubicle count. No desks or school chairs.
export const TOILET_BOUNDS=Object.freeze({minX:-6.65,maxX:7.2,minZ:-10,maxZ:8.8});
export const TOILET_STALL_SIZE=Object.freeze({width:2.10,depth:2.38,height:1.87,bottom:.18});
export const TOILET_DOOR=Object.freeze({width:1.86,depth:.045,height:1.57,bottom:.24,hingeX:-.93,hingeZ:1.19,angle:-Math.PI*.475});
export const TOILET_CABINET=Object.freeze({x:.68,z:-.52,width:.43,depth:.35,height:1.12,bottom:.10,doorAngle:-Math.PI*.48});
export const TOILET_STALLS=Object.freeze([-7.75,-3.45,.85].flatMap((z,row)=>[-5.05,-1.95,1.15,4.25].map((x,col)=>Object.freeze({id:row*4+col,row,col,x,z,yaw:0}))));
export const TOILET_SEATS=Object.freeze(TOILET_STALLS.map(s=>Object.freeze({
 id:s.id,row:s.row,col:s.col,x:s.x-.18,z:s.z-.48,y:.36,yaw:0,
 // Existing interaction callers use deskX/Z; these are CABINET anchors.
 deskX:s.x+TOILET_CABINET.x,deskZ:s.z+TOILET_CABINET.z+.21,
 cabinetX:s.x+TOILET_CABINET.x,cabinetZ:s.z+TOILET_CABINET.z,
 exitX:s.x-.18,exitZ:s.z+1.68,map:'toilet',pattern:'toilet-cubicle',surface:'toilet',hideBook:true,hidePen:true
})));
const volume=(id,minX,maxX,minZ,maxZ,minY,maxY)=>Object.freeze({id,minX,maxX,minZ,maxZ,minY,maxY});
const fixedFixtures=Object.freeze(TOILET_STALLS.flatMap(s=>[
 volume('toilet-left-'+s.id,s.x-1.08,s.x-1.02,s.z-1.22,s.z+1.22,.16,1.92),
 volume('toilet-right-'+s.id,s.x+1.02,s.x+1.08,s.z-1.22,s.z+1.22,.16,1.92),
 volume('toilet-rear-'+s.id,s.x-1.08,s.x+1.08,s.z-1.22,s.z-1.16,.16,1.92),
 volume('toilet-hinge-'+s.id,s.x-1.06,s.x-.93,s.z+1.15,s.z+1.23,.18,1.89),
 volume('toilet-latch-'+s.id,s.x+.93,s.x+1.06,s.z+1.15,s.z+1.23,.18,1.89),
 volume('toilet-bowl-'+s.id,s.x-.39,s.x+.03,s.z-.76,s.z-.23,0,.365),
 volume('toilet-tank-'+s.id,s.x-.39,s.x+.03,s.z-.965,s.z-.65,0,.75)
]));
// Food cupboards are hollow: projectile/flash tests see their back, sides
// and two shelf bays. Walking still uses the cupboard's full footprint.
export const TOILET_WALK_SOLIDS=Object.freeze([...fixedFixtures,...TOILET_STALLS.map(s=>volume('toilet-cabinet-footprint-'+s.id,s.x+.465,s.x+.895,s.z-.695,s.z-.345,.10,1.22))]);
export const TOILET_SOLIDS=Object.freeze([...fixedFixtures,...TOILET_STALLS.flatMap(s=>[
 volume('toilet-cabinet-back-'+s.id,s.x+.465,s.x+.895,s.z-.694,s.z-.666,.10,1.22),
 volume('toilet-cabinet-left-'+s.id,s.x+.465,s.x+.491,s.z-.695,s.z-.345,.10,1.22),
 volume('toilet-cabinet-right-'+s.id,s.x+.869,s.x+.895,s.z-.695,s.z-.345,.10,1.22),
 ...[.113,.65,1.207].map((y,i)=>volume(`toilet-cabinet-shelf-${s.id}-${i}`,s.x+.4775,s.x+.8825,s.z-.695,s.z-.345,y-.013,y+.013))
])]);
const clamp=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
const stallFor=value=>typeof value==='object'&&value?value:TOILET_STALLS.find(s=>s.id===Number(value));
// Hinged leaves are segmented rather than one huge diagonal AABB. The same
// angle and pivot are used by rendered geometry and movement/projectile tests.
function leafVolumes(id,x,z,width,depth,angle,minY,maxY){
 const count=12,length=width/count,cos=Math.cos(angle),sin=Math.sin(angle),rx=Math.abs(cos)*length/2+Math.abs(sin)*depth/2,rz=Math.abs(sin)*length/2+Math.abs(cos)*depth/2;
 return Array.from({length:count},(_,i)=>{const t=(i+.5)*length,cx=x+cos*t,cz=z-sin*t;return volume(id+'-'+i,cx-rx,cx+rx,cz-rz,cz+rz,minY,maxY);});
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
 return{x:s.x+c.x-c.width/2,z:s.z+c.z+c.depth/2+.012,angle:c.doorAngle*clamp(openness),openness:clamp(openness)};
}
export function toiletCabinetDoorSolids(id,openness=0){
 const p=toiletCabinetDoorPose(id,openness);if(!p)return[];const c=TOILET_CABINET;
 return leafVolumes('toilet-cabinet-door-'+stallFor(id).id,p.x,p.z,c.width,.028,p.angle,c.bottom,c.bottom+c.height);
}
export function toiletDynamicSolids(doorStates={},cabinetStates={}){
 const value=(states,id)=>{const v=states instanceof Map?states.get(id):states?.[id];return typeof v==='object'&&v?Number(v.openness??v.open):Number(v??0);};
 return TOILET_STALLS.flatMap(s=>[...toiletDoorSolids(s.id,value(doorStates,s.id)),...toiletCabinetDoorSolids(s.id,value(cabinetStates,s.id))]);
}
