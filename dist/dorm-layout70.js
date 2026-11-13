// Night inspection reference: BV1otWu6EEu9 00:15–00:19.
// Verified: narrow room, wall-side bunks, central passage/table and end window.
// Six bunks/twelve places are playable reconstruction capacity, not a verified
// count. The older wooden-floor classroom variant is not mixed into this shell.
export const DORM_BOUNDS=Object.freeze({minX:1,maxX:7.2,minZ:-10,maxZ:4.6,height:3.45});
export const DORM_BED_SIZE=Object.freeze({length:2.46,width:1.32,lower:.64,upper:2.08,frameTop:2.63});
export const DORM_CABINET=Object.freeze({x:-1.65,z:.10,width:.66,depth:.58,height:.90,bottom:1.04,levelStep:1.44,yaw:Math.PI/2,doorAngle:-Math.PI*.48});
export const DORM_TABLE=Object.freeze({x:4.1,z:-6.5,width:1.02,depth:1.44,height:.78});
export const DORM_WATCH=Object.freeze({x:4.1,z:-8.4});
export const DORM_POSTS=Object.freeze(Array.from({length:6},(_,id)=>Object.freeze({id,x:1.65+id*.96,z:-9.60})));
export const DORM_BUNKS=Object.freeze([-5.1,-1.5,2.1].flatMap((z,row)=>[1.8,6.4].map((x,col)=>Object.freeze({id:row*2+col,row,col,x,z,yaw:col?-Math.PI/2:Math.PI/2}))));
export function dormPoint(b,x,z){const c=Math.cos(b.yaw),s=Math.sin(b.yaw);return{x:b.x+c*x+s*z,z:b.z-s*x+c*z};}
export const DORM_BEDS=Object.freeze(DORM_BUNKS.flatMap(b=>[0,1].map(level=>{
 const id=b.id*2+level,supportHeight=level?DORM_BED_SIZE.upper:DORM_BED_SIZE.lower;
 const sit=dormPoint(b,.15,.22),head=dormPoint(b,-.84,0),desk=dormPoint(b,DORM_CABINET.x+DORM_CABINET.depth/2+.1,DORM_CABINET.z),cab=dormPoint(b,DORM_CABINET.x,DORM_CABINET.z),exit=dormPoint(b,.20,1.12),ladder=dormPoint(b,.92,.79);
 return Object.freeze({id,bedId:id,seatId:id,bunkId:b.id,row:b.row,col:b.col,level,...sit,y:supportHeight,supportHeight,yaw:b.yaw+Math.PI,bunkYaw:b.yaw,
 lieX:b.x,lieZ:b.z,lieYaw:b.yaw,headX:head.x,headZ:head.z,
 deskX:desk.x,deskZ:desk.z,cabinetYaw:b.yaw+DORM_CABINET.yaw,cabinetId:id,cabinetX:cab.x,cabinetZ:cab.z,cabinetY:DORM_CABINET.bottom+level*DORM_CABINET.levelStep,
 foodY:DORM_CABINET.bottom+level*DORM_CABINET.levelStep+.045,
 exitX:exit.x,exitZ:exit.z,ladderX:ladder.x,ladderZ:ladder.z,
 map:'dorm',pattern:'wall-side-bunks',surface:'bed',hideBook:true,hidePen:true});
})));
export const DORM_SEATS=DORM_BEDS;
const volume=(id,minX,maxX,minZ,maxZ,minY,maxY)=>Object.freeze({id,minX,maxX,minZ,maxZ,minY,maxY});
function rotateVolume(v,b){const points=[[v.minX,v.minZ],[v.maxX,v.minZ],[v.minX,v.maxZ],[v.maxX,v.maxZ]].map(([x,z])=>dormPoint(b,x,z));return volume(v.id,Math.min(...points.map(p=>p.x)),Math.max(...points.map(p=>p.x)),Math.min(...points.map(p=>p.z)),Math.max(...points.map(p=>p.z)),v.minY,v.maxY);}
export const DORM_SHELL_SOLIDS=Object.freeze([
 volume('dorm-west-wall',.8,1,-10.2,4.8,0,3.45),volume('dorm-end-wall',1,7.4,4.6,4.8,0,3.45),
 volume('dorm-entrance-wall',.8,7.4,-10.2,-10,0,3.45),
 volume('dorm-east-rear-wall',7.2,7.4,-10,-8.8,0,4.51),volume('dorm-east-long-wall',7.2,7.4,-7.2,8.8,0,4.51),
 volume('dorm-portal-header',7.2,7.4,-8.8,-7.2,3.08,4.51)
]);
export const DORM_CEILING=volume('dorm-ceiling',.8,7.4,-10.2,4.8,3.45,3.61);
const tableSolids=[volume('dorm-table-top',3.59,4.61,-7.22,-5.78,.735,.78),...[-1,1].flatMap(x=>[-1,1].map(z=>volume('dorm-table-leg-'+x+'-'+z,4.1+x*.445-.022,4.1+x*.445+.022,-6.5+z*.65-.022,-6.5+z*.65+.022,0,.735)))];
export const DORM_WALK_SOLIDS=Object.freeze([...DORM_BUNKS.flatMap(b=>[
 rotateVolume(volume('dorm-bunk-footprint-'+b.id,-1.28,1.28,-.70,.90,0,2.63),b),
 rotateVolume(volume('dorm-cabinet-footprint-'+b.id,-1.94,-1.36,-.23,.43,0,3.38),b)
]),volume('dorm-table-footprint',3.59,4.61,-7.22,-5.78,0,.78)]);
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
export function dormBodyOffset(yaw,lying){return lying?{x:Math.cos(yaw)*.65,y:.23,z:-Math.sin(yaw)*.65,roll:Math.PI/2}:{x:0,y:-.49,z:0,roll:0};}
