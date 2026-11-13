// BV1LsWj6eEEU 28:40 shows numbered doors 2 and 3 on opposite sides
// of a corridor; BV1otWu6EEu9 00:15 shows room 1. Three connected rooms
// are confirmed. Dimensions and eight sleeping places per room are reconstruction.
export const DORM_ROOM_BOUNDS=Object.freeze({minX:-3.1,maxX:3.1,minZ:0,maxZ:10.2,height:3.45});
export const DORM_ROOMS=Object.freeze([
 {id:1,x:7.2,z:-8,yaw:-Math.PI/2},
 {id:2,x:7.2,z:2.8,yaw:-Math.PI/2},
 {id:3,x:12.64,z:-8,yaw:Math.PI/2}
].map(Object.freeze));
export function dormPoint(b,x,z){const c=Math.cos(b.yaw),s=Math.sin(b.yaw);return{x:b.x+c*x+s*z,z:b.z-s*x+c*z};}
export function dormRoomPoint(id,x,z){const room=DORM_ROOMS.find(r=>r.id===Number(id));return room?dormPoint(room,x,z):null;}
export const DORM_BOUNDS=Object.freeze({minX:-3,maxX:22.84,minZ:-11.1,maxZ:5.9,height:3.45});
export const DORM_BED_SIZE=Object.freeze({length:2.46,width:1.32,lower:.64,upper:2.08,frameTop:2.63});
export const DORM_CABINET=Object.freeze({x:-1.65,z:.10,width:.66,depth:.58,height:.90,bottom:1.04,levelStep:1.44,yaw:Math.PI/2,doorAngle:-Math.PI*.48});
export const DORM_TABLES=Object.freeze(DORM_ROOMS.map(r=>Object.freeze({id:r.id,...dormPoint(r,0,1.9),yaw:r.yaw,width:1.02,depth:1.44,height:.78})));
export const DORM_TABLE=DORM_TABLES[0];
export const DORM_WATCH=Object.freeze({x:10.3,z:5.8});
export const DORM_POSTS=Object.freeze(Array.from({length:6},(_,id)=>Object.freeze({id,x:12.02,z:-3.4+id*1.45})));
export const DORM_BUNKS=Object.freeze(DORM_ROOMS.flatMap((room,ri)=>[3.9,7.4].flatMap((z,row)=>[-2.3,2.3].map((x,col)=>Object.freeze({id:ri*4+row*2+col,roomId:room.id,row,col,...dormPoint(room,x,z),yaw:room.yaw+(col?-Math.PI/2:Math.PI/2)})))));
export const DORM_BEDS=Object.freeze(DORM_BUNKS.flatMap(b=>[0,1].map(level=>{
 const id=b.id*2+level,supportHeight=level?DORM_BED_SIZE.upper:DORM_BED_SIZE.lower;
 const sit=dormPoint(b,.15,.22),head=dormPoint(b,-.84,0),desk=dormPoint(b,DORM_CABINET.x+DORM_CABINET.depth/2+.1,DORM_CABINET.z),cab=dormPoint(b,DORM_CABINET.x,DORM_CABINET.z),exit=dormPoint(b,.20,1.12),ladder=dormPoint(b,.92,.79);
 return Object.freeze({id,bedId:id,seatId:id,bunkId:b.id,roomId:b.roomId,row:b.row,col:b.col,level,...sit,y:supportHeight,supportHeight,yaw:b.yaw+Math.PI,bunkYaw:b.yaw,
 lieX:b.x,lieZ:b.z,lieYaw:b.yaw,headX:head.x,headZ:head.z,
 deskX:desk.x,deskZ:desk.z,cabinetYaw:b.yaw+DORM_CABINET.yaw,cabinetId:id,cabinetX:cab.x,cabinetZ:cab.z,cabinetY:DORM_CABINET.bottom+level*DORM_CABINET.levelStep,
 foodY:DORM_CABINET.bottom+level*DORM_CABINET.levelStep+.045,
 exitX:exit.x,exitZ:exit.z,ladderX:ladder.x,ladderZ:ladder.z,
 map:'dorm',pattern:'wall-side-bunks',surface:'bed',hideBook:true,hidePen:true});
})));
export const DORM_SEATS=DORM_BEDS;
const volume=(id,minX,maxX,minZ,maxZ,minY,maxY)=>Object.freeze({id,minX,maxX,minZ,maxZ,minY,maxY});
function rotateVolume(v,b){const points=[[v.minX,v.minZ],[v.maxX,v.minZ],[v.minX,v.maxZ],[v.maxX,v.maxZ]].map(([x,z])=>dormPoint(b,x,z));return volume(v.id,Math.min(...points.map(p=>p.x)),Math.max(...points.map(p=>p.x)),Math.min(...points.map(p=>p.z)),Math.max(...points.map(p=>p.z)),v.minY,v.maxY);}
const b=DORM_ROOM_BOUNDS;
export const DORM_ROOM_RECTS=Object.freeze(DORM_ROOMS.map(r=>rotateVolume(volume('dorm-floor-'+r.id,b.minX,b.maxX,-.8,b.maxZ,0,b.height),r)));
// Room walls leave a 1.6 m portal at local Z=0. Corridor infill is disjoint.
export const DORM_SHELL_SOLIDS=Object.freeze(DORM_ROOMS.flatMap(r=>[
 volume('west',b.minX-.2,b.minX,-.2,b.maxZ+.2,0,b.height),
 volume('east',b.maxX,b.maxX+.2,-.2,b.maxZ+.2,0,b.height),
 volume('end',b.minX,b.maxX,b.maxZ,b.maxZ+.2,0,b.height),
 volume('entry-left',b.minX,-.8,-.2,0,0,b.height),volume('entry-right',.8,b.maxX,-.2,0,0,b.height),
 volume('entry-header',-.8,.8,-.2,0,3.08,b.height)
].map(v=>rotateVolume({...v,id:'dorm-room-'+r.id+'-'+v.id},r))));
export const DORM_CEILINGS=Object.freeze(DORM_ROOMS.map(r=>rotateVolume(volume('dorm-ceiling-'+r.id,b.minX-.2,b.maxX+.2,-.2,b.maxZ+.2,b.height,b.height+.16),r)));
export const DORM_CEILING=DORM_CEILINGS[0];
export const DORM_CORRIDOR_SOLIDS=Object.freeze([
 ...[[-17.72,-11.3],[-4.7,-.5],[6.1,8.8]].map(([lo,hi],i)=>volume('dorm-hall-left-'+i,7.2,7.4,lo,hi,0,4.51)),
 ...[[-17.72,-11.3],[-4.7,8.8]].map(([lo,hi],i)=>volume('dorm-hall-right-'+i,12.44,12.64,lo,hi,0,4.51)),
 volume('dorm-hall-left-cap',7.2,7.4,-11.3,6.1,3.45,4.51),volume('dorm-hall-right-cap',12.44,12.64,-11.3,-4.7,3.45,4.51)
]);
const tableSolids=DORM_TABLES.flatMap(t=>[
 volume('dorm-table-top-'+t.id,-.51,.51,-.72,.72,.735,.78),
 ...[-1,1].flatMap(x=>[-1,1].map(z=>volume('dorm-table-leg-'+t.id+'-'+x+'-'+z,x*.445-.022,x*.445+.022,z*.65-.022,z*.65+.022,0,.735)))
].map(v=>rotateVolume(v,t)));
export const DORM_WALK_SOLIDS=Object.freeze([...DORM_BUNKS.flatMap(b=>[
 rotateVolume(volume('dorm-bunk-footprint-'+b.id,-1.28,1.28,-.70,.90,0,2.63),b),
 rotateVolume(volume('dorm-cabinet-footprint-'+b.id,-1.94,-1.36,-.23,.43,0,3.38),b)
]),...DORM_TABLES.map(t=>rotateVolume(volume('dorm-table-footprint-'+t.id,-.51,.51,-.72,.72,0,.78),t))]);
export const DORM_SOLIDS=Object.freeze([...DORM_BUNKS.flatMap(world=>{
 const b={id:world.id,x:0,z:0};
 const volumes=[];
 for(const sx of[-1,1])for(const sz of[-1,1])volumes.push(volume(`dorm-post-${b.id}-${sx}-${sz}`,b.x+sx*1.22-.06,b.x+sx*1.22+.06,b.z+sz*.65-.05,b.z+sz*.65+.05,.025,2.63));
 for(const level of[0,1]){
  const y=level*1.44;
  volumes.push(volume(`dorm-platform-${b.id}-${level}`,b.x-1.23,b.x+1.23,b.z-.66,b.z+.66,.37+y,.64+y));
  for(const sx of[-1,1]){volumes.push(volume(`dorm-endrail-${b.id}-${level}-${sx}`,b.x+sx*1.22-.05,b.x+sx*1.22+.05,b.z-.65,b.z+.65,.90+y,1.01+y));volumes.push(volume(`dorm-midrail-${b.id}-${level}-${sx}`,b.x+sx*1.22-.0325,b.x+sx*1.22+.0325,b.z-.625,b.z+.625,.725+y,.795+y));}
  volumes.push(volume(`dorm-pillow-${b.id}-${level}`,b.x-1.075,b.x-.585,b.z-.47,b.z+.47,.6005+y,.7355+y));
 }
 volumes.push(volume('dorm-upper-backrail-'+b.id,b.x-1.22,b.x+1.22,b.z-.685,b.z-.615,2.35,2.46));
 volumes.push(volume('dorm-upper-frontrail-'+b.id,b.x-1.22,b.x+.54,b.z+.615,b.z+.685,2.35,2.46));
 for(const x of[.63,1.14])volumes.push(volume(`dorm-ladder-${b.id}-${x}`,b.x+x-.035,b.x+x+.035,b.z+.70,b.z+.90,.025,2.48));
 for(let n=0;n<7;n++)volumes.push(volume(`dorm-rung-${b.id}-${n}`,b.x+.635,b.x+1.135,b.z+.74,b.z+.86,.215+n*.31,.285+n*.31));
 for(const x of[-1.22,-.54,.54,1.22])volumes.push(volume(`dorm-back-spindle-${b.id}-${x}`,b.x+x-.0275,b.x+x+.0275,b.z-.68,b.z-.62,2.095,2.395));
 for(const x of[-1.22,-.54,.50])volumes.push(volume(`dorm-front-spindle-${b.id}-${x}`,b.x+x-.0275,b.x+x+.0275,b.z+.62,b.z+.68,2.095,2.395));
 const c=DORM_CABINET,localCabinet={x:c.x,z:c.z,yaw:c.yaw};
 const cv=(id,x0,x1,z0,z1,y0,y1)=>volumes.push(rotateVolume(volume(id,x0,x1,z0,z1,y0,y1),localCabinet));
 cv('dorm-cabinet-base-'+b.id,-.33,.33,-.29,.29,0,c.bottom);cv('dorm-cabinet-divider-'+b.id,-.33,.33,-.29,.29,c.bottom+c.height,c.bottom+c.levelStep);
 for(const level of[0,1]){const id=b.id*2+level,y=c.bottom+level*c.levelStep;
  cv('dorm-cabinet-back-'+id,-.33,.33,-.29,-.256,y,y+c.height);cv('dorm-cabinet-left-'+id,-.33,-.296,-.29,.29,y,y+c.height);cv('dorm-cabinet-right-'+id,.296,.33,-.29,.29,y,y+c.height);
  for(const shelf of[0,1])cv(`dorm-cabinet-shelf-${id}-${shelf}`,-.33,.33,-.29,.29,y+shelf*(c.height-.034),y+shelf*(c.height-.034)+.034);
 }

 return volumes.map(v=>rotateVolume(v,world));
}),...tableSolids]);
const clamp=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
export function dormCabinetDoorPose(id,openness=0){
 const s=DORM_BEDS.find(b=>b.id===Number(id));if(!s)return null;
 const p=dormPoint({x:s.cabinetX,z:s.cabinetZ,yaw:s.cabinetYaw},-DORM_CABINET.width/2,DORM_CABINET.depth/2+.017);return{...p,y:s.cabinetY,angle:s.cabinetYaw+DORM_CABINET.doorAngle*clamp(openness),openness:clamp(openness)};
}
export function dormCabinetDoorSolids(id,openness=0){
 const p=dormCabinetDoorPose(id,openness);if(!p)return[];
 const count=8,width=DORM_CABINET.width,depth=.035,step=width/count,c=Math.cos(p.angle),s=Math.sin(p.angle),rx=Math.abs(c)*step/2+Math.abs(s)*depth/2,rz=Math.abs(s)*step/2+Math.abs(c)*depth/2;
 return Array.from({length:count},(_,i)=>{const along=(i+.5)*step,x=p.x+c*along,z=p.z-s*along;return volume(`dorm-cabinet-door-${id}-${i}`,x-rx,x+rx,z-rz,z+rz,p.y,p.y+DORM_CABINET.height);});
}

// Align feet-to-head along the bed length, even when opposite wall bunks turn.
export function dormBodyOffset(yaw,lying,variant='boy'){const height={boy:.23,glasses:.23,girl:.25,ponytail:.23}[variant]??.23;return lying?{x:Math.cos(yaw)*.65,y:height,z:-Math.sin(yaw)*.65,pitch:0,roll:Math.PI/2}:{x:0,y:-.49,z:0,roll:0};}

// Inward opening leaves use the same pose for rendering, collision and picking.
export function dormDoorPose(id,openness=1){
 const room=DORM_ROOMS.find(r=>r.id===Number(id));if(!room)return null;
 const p=dormPoint(room,-.8,-.1),angle=room.yaw-Math.PI/2*clamp(openness);
 return {...p,y:.02,angle,openness:clamp(openness),handle:{x:p.x+Math.cos(angle)*1.42,z:p.z-Math.sin(angle)*1.42,y:1.14}};
}
export function dormDoorSolids(id,openness=1){
 const p=dormDoorPose(id,openness);if(!p)return[];
 const step=1.6/12,c=Math.cos(p.angle),s=Math.sin(p.angle),rx=Math.abs(c)*step/2+Math.abs(s)*.025,rz=Math.abs(s)*step/2+Math.abs(c)*.025;
 return Array.from({length:12},(_,i)=>{const q=(i+.5)*step,x=p.x+c*q,z=p.z-s*q;return volume('dorm-room-door-'+id+'-'+i,x-rx,x+rx,z-rz,z+rz,.02,3.06);});
}
