// Reconstructed from BV1LsWj6eEEU 28:50–31:20 and BV1otWu6EEu9 00:15–00:19.
// Bunk shape, individual cupboards and plaid bedding are visible. Exact room
// dimensions and total beds are occluded; 24 places are reconstruction capacity.
export const DORM_BOUNDS=Object.freeze({minX:-6.65,maxX:7.2,minZ:-10,maxZ:8.8});
export const DORM_BED_SIZE=Object.freeze({length:2.46,width:1.32,lower:.64,upper:2.08,frameTop:2.63});
export const DORM_CABINET=Object.freeze({x:-1.65,z:.10,width:.66,depth:.58,height:1.08,bottom:.22,levelStep:1.44,doorAngle:-Math.PI*.48});
export const DORM_BUNKS=Object.freeze([-7.35,-3.65,.05,3.75].flatMap((z,row)=>[-4.25,.05,4.35].map((x,col)=>Object.freeze({id:row*3+col,row,col,x,z,yaw:0}))));
export const DORM_BEDS=Object.freeze(DORM_BUNKS.flatMap(b=>[0,1].map(level=>{const id=b.id*2+level,supportHeight=level?DORM_BED_SIZE.upper:DORM_BED_SIZE.lower;return Object.freeze({
 id,bedId:id,seatId:id,bunkId:b.id,row:b.row,col:b.col,level,x:b.x+.15,z:b.z+.22,y:supportHeight,supportHeight,yaw:Math.PI,
 lieX:b.x,lieZ:b.z,lieYaw:-Math.PI/2,headX:b.x-.84,headZ:b.z,
 deskX:b.x+DORM_CABINET.x,deskZ:b.z+DORM_CABINET.z+DORM_CABINET.depth/2+.1,
 cabinetId:id,cabinetX:b.x+DORM_CABINET.x,cabinetZ:b.z+DORM_CABINET.z,cabinetY:DORM_CABINET.bottom+level*DORM_CABINET.levelStep,
 foodY:DORM_CABINET.bottom+level*DORM_CABINET.levelStep+.045,
 exitX:b.x+.20,exitZ:b.z+1.12,ladderX:b.x+.92,ladderZ:b.z+.79,
 map:'dorm',pattern:'bunk-beds',surface:'bed',hideBook:true,hidePen:true
 });})));
export const DORM_SEATS=DORM_BEDS;
const volume=(id,minX,maxX,minZ,maxZ,minY,maxY)=>Object.freeze({id,minX,maxX,minZ,maxZ,minY,maxY});
export const DORM_WALK_SOLIDS=Object.freeze(DORM_BUNKS.flatMap(b=>[
 volume('dorm-bunk-footprint-'+b.id,b.x-1.28,b.x+1.28,b.z-.70,b.z+.90,0,2.63),
 volume('dorm-cabinet-footprint-'+b.id,b.x-1.98,b.x-1.32,b.z-.19,b.z+.39,0,2.74)
]));
export const DORM_SOLIDS=Object.freeze(DORM_BUNKS.flatMap(b=>{
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
 volumes.push(volume('dorm-cabinet-base-'+b.id,b.x-1.98,b.x-1.32,b.z-.19,b.z+.39,0,.22),volume('dorm-cabinet-divider-'+b.id,b.x-1.98,b.x-1.32,b.z-.19,b.z+.39,1.30,1.66));
 for(const level of[0,1]){
  const id=b.id*2+level,y=DORM_CABINET.bottom+level*DORM_CABINET.levelStep;
  volumes.push(volume('dorm-cabinet-back-'+id,b.x-1.98,b.x-1.32,b.z-.19,b.z-.156,y,y+1.08),volume('dorm-cabinet-left-'+id,b.x-1.98,b.x-1.946,b.z-.19,b.z+.39,y,y+1.08),volume('dorm-cabinet-right-'+id,b.x-1.354,b.x-1.32,b.z-.19,b.z+.39,y,y+1.08));
  for(const shelf of[0,1])volumes.push(volume(`dorm-cabinet-shelf-${id}-${shelf}`,b.x-1.98,b.x-1.32,b.z-.19,b.z+.39,y+shelf*1.046,y+shelf*1.046+.034));
 }
 return volumes;
}));
const clamp=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
export function dormCabinetDoorPose(id,openness=0){
 const s=DORM_BEDS.find(b=>b.id===Number(id));if(!s)return null;
 return{x:s.cabinetX-DORM_CABINET.width/2,z:s.cabinetZ+DORM_CABINET.depth/2+.017,y:s.cabinetY,angle:DORM_CABINET.doorAngle*clamp(openness),openness:clamp(openness)};
}
export function dormCabinetDoorSolids(id,openness=0){
 const p=dormCabinetDoorPose(id,openness);if(!p)return[];
 const count=8,width=DORM_CABINET.width,depth=.035,step=width/count,c=Math.cos(p.angle),s=Math.sin(p.angle),rx=Math.abs(c)*step/2+Math.abs(s)*depth/2,rz=Math.abs(s)*step/2+Math.abs(c)*depth/2;
 return Array.from({length:count},(_,i)=>{const along=(i+.5)*step,x=p.x+c*along,z=p.z-s*along;return volume(`dorm-cabinet-door-${id}-${i}`,x-rx,x+rx,z-rz,z+rz,p.y,p.y+DORM_CABINET.height);});
}
