// Elevator operation is enabled; boarding and per-round limits are authoritative.
export const ELEVATOR_ENABLED=true;
export const TEACHER_EYE_HEIGHT=1.95;
// Metres, shared by rendering and authoritative collision. The user's plan is
// rotated in world space: office at +Z, lift at -Z, corridor along the right.
export const CLASSROOM=Object.freeze({minX:-6.65,maxX:7.20,minZ:-10.00,maxZ:8.80});
export const CORRIDOR=Object.freeze({minX:7.40,maxX:12.44,minZ:-17.52,maxZ:8.80});
export const OFFICE=Object.freeze({minX:-1.20,maxX:CORRIDOR.maxX,minZ:9.02,maxZ:20.80,doorX:9.20,doorMinX:8.30,doorMaxX:10.10});
export const LIFT=Object.freeze({minX:8.10,maxX:10.60,minZ:CORRIDOR.minZ-3,maxZ:CORRIDOR.minZ-.20,x:9.35,z:CORRIDOR.minZ-1.70});
export const STUDENT_ENTRY=Object.freeze({x:LIFT.x,z:ELEVATOR_ENABLED?LIFT.z:CORRIDOR.minZ+.65});
export const ROOM=Object.freeze({minX:CLASSROOM.minX,maxX:CORRIDOR.maxX,minZ:LIFT.minZ,maxZ:OFFICE.maxZ});
export const CEILING_HEIGHT=4.51,TIERED_CEILING_HEIGHT=5.55;
export const TEACHER_SPAWN=Object.freeze({x:9.20,z:12.00,yaw:Math.PI,pitch:.025});
export const OFFICE_DESK=Object.freeze({id:'office-lunch',x:4.80,z:13.10,width:2.20,depth:1.02,yaw:0,drawerX:4.80,drawerZ:12.58});
export const OFFICE_CHAIR=Object.freeze({id:'office-chair',deskId:OFFICE_DESK.id,x:4.80,z:11.96,yaw:0});
export const OFFICE_DESKS=Object.freeze([OFFICE_DESK,...[[2.1,16.1],[6.1,16.1],[2.1,18.9],[6.1,18.9]].map(([x,z],i)=>Object.freeze({id:'office-work-'+i,x,z,width:2.20,depth:1.02,yaw:0,drawerX:x,drawerZ:z-.52}))]);
export const OFFICE_CHAIRS=Object.freeze([OFFICE_CHAIR,...OFFICE_DESKS.slice(1).map(d=>Object.freeze({id:d.id+'-chair',deskId:d.id,x:d.x,z:d.z-1.14,yaw:0}))]);
export const OFFICE_BOARD=Object.freeze({x:8,z:20.35});
export const ROLE_LOCKER=Object.freeze({x:CORRIDOR.maxX-.36,z:6.65,yaw:-Math.PI/2});
export const START_BELL_POSITION=Object.freeze({x:7.43,z:3.15});
export const CAMPUS_MAPS=Object.freeze(['classroom','night','tiered','computer','classroom5','night6','computer7','tiered8']);
export function mapKind(map='classroom'){const kind=String(map).replace(/[0-9]+$/,'');return kind;}
export const LAYOUT_PATTERNS=Object.freeze(['single','pairs','quads','mixed','rows-wide','rows-long']);
function layoutRandom(seed){let n=Number(seed)>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
// Pure per-room data. Never replace the exported default array: a server can
// run rooms with different layouts in the same JavaScript process safely.
export function createSeatLayout(seed=73,arrangement=null,map='classroom'){
 const random=layoutRandom(seed),pattern=LAYOUT_PATTERNS.includes(arrangement)?arrangement:LAYOUT_PATTERNS[(Number(seed)>>>0)%LAYOUT_PATTERNS.length],raw=[];
 // Translate each left-hand desk cluster intact, preserving paired tops, the
 // fixed right-hand stair lane and all authored model sizes.
 const add=(x,z,yaw=0)=>raw.push({deskX:mapKind(map)==='tiered'?(x< -3?x+.15:x):x< -3?x+.45:x,deskZ:z,yaw});
 if(pattern==='rows-wide'||pattern==='rows-long'){
  const wide=pattern==='rows-wide',xs=wide?[-5,-2.5,0,2.5,5]:[-4.8,-1.6,1.6,4.8];
  // Four rows of five or five rows of four. On terraces the front two rows
  // share the deeper zero-height platform; no desktop straddles a riser.
  const zs=mapKind(map)==='tiered'?(wide?[-7.67,-4.07,-.47,3.13]:[-7.67,-4.07,-.47,2.75,4.65]):wide?[-7.2,-3.45,.3,4.05]:[-7.3,-4.45,-1.6,1.25,4.1];
  for(const z of zs)for(const x of xs)add(x,z);
 }else if(mapKind(map)==='tiered'){
  // Four full-depth terraces leave enough space for the real desk AND its
  // chair in both directions. A four-desk island must never straddle a riser.
  for(const [row,z]of [-7.67,-4.07,-.47,3.13].entries()){
   const count=row===3?6:8;
   if(pattern==='single')for(const x of (count===8?[-5.65,-4.10,-2.55,-1,.55,2.10,3.65,5.20]:[-5.3,-3.2,-1.1,1.0,3.1,5.2]))add(x,z);
   else if(pattern==='pairs'||pattern==='mixed'&&random()<.5){for(const x of (count===8?[-5.65,-4.37,-2.43,-1.15,.79,2.07,4.01,5.29]:[-5.3,-4.02,-.64,.64,4.02,5.3]))add(x,z);}
   else {for(const x of [-3.75,1.1])for(const dz of [-.44,.44])for(const dx of [-.625,.625]){if(count===6&&x===1.1&&dz>.0)continue;add(x+dx,z+dz,dz>0?Math.PI:0);}}
  }
 }else if(pattern==='single'||pattern==='pairs'){
  const xs=pattern==='single'?[-5.90,-3.55,-1.20,1.20,3.55,5.90]:[-5.95,-4.67,-2.03,-.75,3.03,4.31];
  for(const z of [-7.30,-4.45,-1.60,1.25,4.10])for(const x of xs)add(x,z);
 }else{
  const blocks=[-6.40,-1.65,3.10].flatMap(z=>[-4.75,0,4.75].map(x=>({x,z})));
  // 7 four-seat islands + one pair, or 6 islands + three pairs = 30 places.
  const counts=pattern==='quads'?[4,4,4,4,4,4,4,2,0]:[4,2,4,2,4,4,4,2,4];
  if(pattern==='mixed')for(let i=counts.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[counts[i],counts[j]]=[counts[j],counts[i]];}
  // The imported top is .8486m deep; .83m centre spacing interpenetrated it.
  // Give facing desks a real seam without resizing their authored geometry.
  blocks.forEach(({x,z},i)=>{const n=counts[i];if(n===4){for(const dz of [-.44,.44])for(const dx of [-.625,.625])add(x+dx,z+dz,dz>0?Math.PI:0);}else if(n===2){const loose=pattern==='mixed'&&random()>.5;for(const dx of loose?[-1.05,1.05]:[-.64,.64])add(x+dx,z,0);}});
 }
 const seats=raw.map((s,id)=>Object.freeze({...s,id,row:Math.floor(id/6),col:id%6,x:s.deskX-Math.sin(s.yaw)*.78,z:s.deskZ-Math.cos(s.yaw)*.78,pattern,map:mapKind(map)}));
 return Object.freeze(seats);
}
export const SEATS=createSeatLayout(73);
export const PLAYER_SEAT=9;
export const FRIEND_SEATS=Object.freeze([2,6,16,27]);
export const COVERED_SEATS=Object.freeze([PLAYER_SEAT,...FRIEND_SEATS,0,5,10,15,20,25]);
export const AISLES=Object.freeze([CLASSROOM.minX+.27,-3.35,1.14,6.84]);
export const BOARD=Object.freeze({x:1.25,z:7.45});
export const DETENTION=Object.freeze([-5.85,-5.00,-4.15,4.60,5.45,6.30].map((x,id)=>Object.freeze({id,x,z:8.08})));
export const DOORS=Object.freeze([-8.00,7.00].map((center,i)=>Object.freeze({id:i===0?'rear':'front',center,minZ:center-.80,maxZ:center+.80})));
export const PARTITIONS=Object.freeze([{minX:7.20,maxX:7.40,minZ:-10.20,maxZ:DOORS[0].minZ},{minX:7.20,maxX:7.40,minZ:DOORS[0].maxZ,maxZ:DOORS[1].minZ},{minX:7.20,maxX:7.40,minZ:DOORS[1].maxZ,maxZ:9.02}]);
export const LECTERN=Object.freeze({minX:-1.52,maxX:-.17,minZ:7.20,maxZ:8.02});
const V=(minX,maxX,minZ,maxZ,minY=0,maxY=CEILING_HEIGHT)=>Object.freeze({minX,maxX,minZ,maxZ,minY,maxY});
export const DOOR_LEAVES=Object.freeze(DOORS.map(d=>V(7.30,8.88,d.maxZ-.07,d.maxZ+.07,.04,3.02)));
// Continuous shell: classroom proportions are independent of the longer corridor.
// The lift portal/cabin use the corridor's end, never the classroom's rear wall.
const portalZ=CORRIDOR.minZ,west=CLASSROOM.minX;
const boundaries=[
 V(west-.20,west,CLASSROOM.minZ-.20,OFFICE.minZ),
 V(west,CORRIDOR.minX,CLASSROOM.minZ-.20,CLASSROOM.minZ),
 V(CLASSROOM.maxX,CORRIDOR.minX,portalZ-.20,CLASSROOM.minZ-.20),
 V(CORRIDOR.minX,LIFT.minX,portalZ-.20,portalZ),V(LIFT.maxX,CORRIDOR.maxX+.20,portalZ-.20,portalZ),
 V(west,OFFICE.doorMinX,CLASSROOM.maxZ,OFFICE.minZ),V(OFFICE.doorMaxX,CORRIDOR.maxX+.20,CLASSROOM.maxZ,OFFICE.minZ),
 V(OFFICE.maxX,OFFICE.maxX+.20,portalZ-.20,OFFICE.maxZ+.20),
 V(OFFICE.minX-.20,OFFICE.minX,CLASSROOM.maxZ,OFFICE.maxZ+.20),V(OFFICE.minX,OFFICE.maxX+.20,OFFICE.maxZ,OFFICE.maxZ+.20),
 V(LIFT.minX-.20,LIFT.minX,LIFT.minZ-.20,portalZ),V(LIFT.maxX,LIFT.maxX+.20,LIFT.minZ-.20,portalZ),V(LIFT.minX,LIFT.maxX,LIFT.minZ-.20,LIFT.minZ)
];
const headers=[...DOORS.map(d=>V(7.20,7.40,d.minZ,d.maxZ,3.08)),V(8.30,10.10,8.80,9.02,3.08),V(LIFT.minX,LIFT.maxX,portalZ-.20,portalZ,3.12)];
const baseWalls=Object.freeze([...PARTITIONS,...boundaries]);
const sealedLift=ELEVATOR_ENABLED?[]:[V(LIFT.minX,LIFT.maxX,portalZ-.22,portalZ+.02,.02,3.12)];
export const WALLS=Object.freeze([...baseWalls,...DOOR_LEAVES,...sealedLift]);
export const WALL_VOLUMES=Object.freeze([...baseWalls.map(d=>V(d.minX,d.maxX,d.minZ,d.maxZ,d.minY??0,d.maxY??CEILING_HEIGHT)),...DOOR_LEAVES,...sealedLift,...headers]);
const fixedCeilings=Object.freeze([V(CORRIDOR.minX,CORRIDOR.maxX+.20,portalZ-.20,9.02,CEILING_HEIGHT,CEILING_HEIGHT+.16),V(OFFICE.minX-.20,OFFICE.maxX+.20,9.02,OFFICE.maxZ+.20,CEILING_HEIGHT,CEILING_HEIGHT+.16),V(LIFT.minX-.20,LIFT.maxX+.20,LIFT.minZ-.20,portalZ,3.12,3.28)]);
const flatCeilings=Object.freeze([V(west-.20,7.40,-10.20,9.02,CEILING_HEIGHT,CEILING_HEIGHT+.16),...fixedCeilings]);
const raisedCeilings=Object.freeze([V(west-.20,7.40,-10.20,9.02,TIERED_CEILING_HEIGHT,TIERED_CEILING_HEIGHT+.16),...fixedCeilings]);
const raisedUpperWalls=Object.freeze([V(west-.20,west,-10.20,9.02,CEILING_HEIGHT,TIERED_CEILING_HEIGHT),V(7.20,7.40,-10.20,9.02,CEILING_HEIGHT,TIERED_CEILING_HEIGHT),V(west,7.20,-10.20,-10.00,CEILING_HEIGHT,TIERED_CEILING_HEIGHT),V(west,7.20,8.80,9.02,CEILING_HEIGHT,TIERED_CEILING_HEIGHT)]);
export function ceilingVolumes(map='classroom'){return mapKind(map)==='tiered'?raisedCeilings:flatCeilings;}
// The teacher laptop is only present on computer floors. Separate base and
// lid bounds avoid treating the air above its keyboard as a solid monitor.
const laptopVolumes=Object.freeze([V(-1.175,-.515,7.395,7.825,1.1475,1.1975),V(-1.175,-.515,7.354,7.429,1.1835,1.570)]);
export function enclosureVolumes(map='classroom',context=null){return [...(context?.wallVolumes||WALL_VOLUMES),...(mapKind(map)==='tiered'?raisedUpperWalls:[]),...ceilingVolumes(map),...(mapKind(map)==='computer'?laptopVolumes:[]),...(context?.dynamicSolids||[])];}
export const OFFICE_SOLIDS=Object.freeze([
 V(OFFICE.minX+.04,OFFICE.minX+.68,10.10,20.08,0,2.78),
 ...OFFICE_DESKS.map(d=>V(d.x-d.width/2,d.x+d.width/2,d.z-d.depth/2,d.z+d.depth/2,0,.985)),
 // Monitor shells and books sit above each physical desk, so thrown items
 // cannot pass straight through their visible screens.
 ...OFFICE_DESKS.map(d=>V(d.x-.79,d.x-.05,d.z+.12,d.z+.24,.985,1.58)),
 V(OFFICE.maxX-.68,OFFICE.maxX-.02,11.075,14.925,0,1.065),V(ROLE_LOCKER.x-.37,ROLE_LOCKER.x+.35,5.75,7.55,0,2.28),V(OFFICE_BOARD.x-1.35,OFFICE_BOARD.x+1.35,OFFICE_BOARD.z-.37,OFFICE_BOARD.z+.37,0,2.48),V(CORRIDOR.maxX-.75,CORRIDOR.maxX-.02,CORRIDOR.minZ+.25,CORRIDOR.minZ+1.08,0,1.72)
]);
export function floorHeight(x,z,map='classroom'){
 if(Math.abs(x)<=3.15&&z>=6.50&&z<=8.80)return .16;
 if(mapKind(map)!=='tiered'||x>=7.20||x<CLASSROOM.minX||z< -10.00||z>=1.50)return 0;
 let h=0;for(const edge of [1.30,-2.30,-5.90])h+=z<edge?.24:z<edge+.20?.12:0;
 return Math.min(h,Math.max(0,Math.floor((7.20-x+1e-8)/.20))*.12);
}
export function actorFloorHeight(actor,map='classroom',carrier=null){const support=actor.captivity==='carried'&&carrier?carrier:actor;return floorHeight(support.x,support.z,map);}
export function floorTiles(map='tiered'){
 if(mapKind(map)!=='tiered')return [];
 const xs=[CLASSROOM.minX,6.00,6.20,6.40,6.60,6.80,7.00,7.20],zs=[-10.00,-5.90,-5.70,-2.30,-2.10,1.30,1.50],out=[];
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){const h=floorHeight((xs[i]+xs[i+1])/2,(zs[j]+zs[j+1])/2,map);if(h>0)out.push({minX:xs[i],maxX:xs[i+1],minZ:zs[j],maxZ:zs[j+1],height:h});}return out;
}
export function walkableFootprint(x,z,r=.18){return (x>=CLASSROOM.minX+r&&x<=CORRIDOR.maxX-r&&z>=CLASSROOM.minZ+r&&z<=CLASSROOM.maxZ-r)||(x>=CORRIDOR.minX+r&&x<=CORRIDOR.maxX-r&&z>=CORRIDOR.minZ+r&&z<=CORRIDOR.maxZ-r)||(x>=OFFICE.minX+r&&x<=OFFICE.maxX-r&&z>=CLASSROOM.maxZ-r&&z<=OFFICE.maxZ-r)||(x>=LIFT.minX+r&&x<=LIFT.maxX-r&&z>=LIFT.minZ+r&&z<=CORRIDOR.minZ+.40);}
export function clearWallSegment(a,b,context=null){
 for(const w of context?.walls||WALLS){let lo=0,hi=1;for(const axis of ['X','Z']){const k=axis.toLowerCase(),d=b[k]-a[k];if(Math.abs(d)<1e-8){if(a[k]<w['min'+axis]||a[k]>w['max'+axis]){lo=2;break;}}else{let u=(w['min'+axis]-a[k])/d,v=(w['max'+axis]-a[k])/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);}}if(lo<=hi&&hi>=0&&lo<=1)return false;}return true;
}
// The shipped Tripo top is 1.200 × .849m, with its top at .875m.
export function deskSolids(seats=SEATS){return seats.map(s=>{const halfWidth=mapKind(s.map)==='computer'?.61:.60;return V(s.deskX-halfWidth,s.deskX+halfWidth,s.deskZ-.425,s.deskZ+.425,0,.875);});}
export function chairBackSolids(seats=SEATS){return [...seats.map(s=>{const z=s.z-Math.cos(s.yaw||0)*.325;return V(s.x-.281,s.x+.281,z-.057,z+.057,.42,.99);}),...OFFICE_CHAIRS.map(c=>V(c.x-.35,c.x+.35,c.z-.36,c.z-.24,.45,1.13))];}
export const DESKS=Object.freeze(deskSolids());
export function createLayoutContext(seats=SEATS,doorState={}){
 const context={map:seats[0]?.map||'classroom',seats,desks:deskSolids(seats),chairBacks:chairBackSolids(seats),routeGrids:new Map(),officeLocked:undefined,rearDoorClosed:undefined,elevatorClosed:undefined};return updateLayoutDoors(context,doorState);
}
export function updateLayoutDoors(context,{officeLocked=context.officeLocked??false,rearDoorClosed=context.rearDoorClosed??false,elevatorClosed=context.elevatorClosed??false}={}){
 elevatorClosed=!ELEVATOR_ENABLED||elevatorClosed;
 if(context.officeLocked===!!officeLocked&&context.rearDoorClosed===!!rearDoorClosed&&context.elevatorClosed===!!elevatorClosed)return context;
 context.officeLocked=!!officeLocked;context.rearDoorClosed=!!rearDoorClosed;context.elevatorClosed=!!elevatorClosed;
 const rear=DOORS[0],leaves=[rearDoorClosed?V(7.23,7.37,rear.minZ,rear.maxZ,.04,3.02):DOOR_LEAVES[0],DOOR_LEAVES[1]];
 if(officeLocked)leaves.push(V(OFFICE.doorMinX,OFFICE.doorMaxX,8.85,8.97,.02,3.02));
 else for(const x of [OFFICE.doorMinX,OFFICE.doorMaxX])leaves.push(V(x-.092,x+.092,8.91,9.81,0,3.02));
 if(elevatorClosed)leaves.push(V(LIFT.minX,LIFT.maxX,portalZ-.22,portalZ+.02,.02,3.12));
 context.walls=[...baseWalls,...leaves];context.wallVolumes=[...baseWalls.map(d=>V(d.minX,d.maxX,d.minZ,d.maxZ,d.minY??0,d.maxY??CEILING_HEIGHT)),...leaves,...headers];
 context.walkSolids=[...context.desks,...context.chairBacks,...context.walls,LECTERN,...OFFICE_SOLIDS,...(context.dynamicSolids||[])];context.routeGrids.clear();context.projectileColliderCache?.clear();return context;
}
const defaultLayout=createLayoutContext();
export function blocked(x,z,radius=.18,context=defaultLayout){return !walkableFootprint(x,z,radius)||(context?.walkSolids||defaultLayout.walkSolids).some(d=>x>d.minX-radius&&x<d.maxX+radius&&z>d.minZ-radius&&z<d.maxZ+radius);}
export function chairExit(seat,radius=.18,context=defaultLayout){
  // Stand beside the chair, not inside the seat/backrest. Facing islands use
  // their own chair axes; never move a player across a wall to find a free spot.
  const yaw=seat.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
  for(const [side,forward] of [[.57,0],[-.57,0],[.78,-.12],[-.78,-.12]]){
    const p={x:seat.x+c*side+s*forward,z:seat.z-s*side+c*forward};
    if(!blocked(p.x,p.z,radius,context)&&clearWallSegment(seat,p,context))return p;
  }
  return null;
}
function movementStepClear(x,z,nextX,nextZ,radius,context){
  const dynamic=context.dynamicSolids||[],inside=(d,px,pz)=>px>d.minX-radius&&px<d.maxX+radius&&pz>d.minZ-radius&&pz<d.maxZ+radius;
  if(!dynamic.some(d=>inside(d,x,z)))return !blocked(nextX,nextZ,radius,context);
  // A drawer may open while someone is beside it. Only that newly overlapping
  // dynamic geometry permits an outward step; static walls/desks remain solid.
  // Merge touching intervals so adjacent drawers cannot demand opposite exits.
  const at={x,z},spans={};
  for(const axis of ['x','z']){
    const other=axis==='x'?'z':'x',key=axis.toUpperCase(),cross=other.toUpperCase();let min=at[axis],max=min,changed=true;
    const ranges=dynamic.filter(d=>at[other]>d['min'+cross]-radius&&at[other]<d['max'+cross]+radius);
    while(changed){changed=false;for(const d of ranges){const lo=d['min'+key]-radius,hi=d['max'+key]+radius;if(lo<=max+1e-9&&hi>=min-1e-9&&(lo<min||hi>max)){min=Math.min(min,lo);max=Math.max(max,hi);changed=true;}}}
    spans[axis]={min,max};
  }
  const statics=context.walkSolids.filter(d=>!dynamic.includes(d)),exits=[];
  for(const axis of ['x','z'])for(const sign of [-1,1]){
    const other=axis==='x'?'z':'x',key=axis.toUpperCase(),cross=other.toUpperCase(),edge=spans[axis][sign<0?'min':'max']+sign*1e-8;
    const target={...at,[axis]:edge},lo=Math.min(at[axis],edge),hi=Math.max(at[axis],edge);
    if(!walkableFootprint(target.x,target.z,radius)||statics.some(d=>at[other]>d['min'+cross]-radius&&at[other]<d['max'+cross]+radius&&hi>d['min'+key]-radius&&lo<d['max'+key]+radius))continue;
    exits.push({axis,sign,distance:Math.abs(edge-at[axis])});
  }
  const nearest=Math.min(...exits.map(e=>e.distance)),axis=nextX!==x?'x':'z',sign=Math.sign(axis==='x'?nextX-x:nextZ-z);
  if(!exits.some(e=>e.axis===axis&&e.sign===sign&&e.distance<=nearest+1e-9))return false;
  if(!walkableFootprint(nextX,nextZ,radius))return false;
  const coordinate=axis==='x'?nextX:nextZ,span=spans[axis];
  return !context.walkSolids.some(d=>inside(d,nextX,nextZ)&&(!dynamic.includes(d)||coordinate<span.min||coordinate>span.max));
}
export function moveInRoom(pos,dx,dz,radius=.18,context=defaultLayout){
  // Swept substeps prevent crossing a thin desk when a frame arrives late.
  context??=defaultLayout;
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.08));
  let x=pos.x,z=pos.z;
  for(let i=0;i<steps;i++){if(dx&&movementStepClear(x,z,x+dx/steps,z,radius,context))x+=dx/steps;if(dz&&movementStepClear(x,z,x,z+dz/steps,radius,context))z+=dz/steps;}
  return{x,z};
}

function walkSegmentClear(a,b,radius,context){
  // Exact swept point against expanded solids. Sampling alone missed short
  // diagonal corner crossings between an actor and its nearest grid cell.
  for(const d of context.walkSolids){
    let enter=0,leave=1;
    for(const axis of ['X','Z']){const key=axis.toLowerCase(),delta=b[key]-a[key],min=d['min'+axis]-radius+1e-9,max=d['max'+axis]+radius-1e-9;
      if(Math.abs(delta)<1e-12){if(a[key]<=min||a[key]>=max){enter=2;break;}}
      else{const u=(min-a[key])/delta,v=(max-a[key])/delta;enter=Math.max(enter,Math.min(u,v));leave=Math.min(leave,Math.max(u,v));}
    }
    if(enter<=leave&&leave>=0&&enter<=1)return false;
  }
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.06));
  for(let i=0;i<=steps;i++)if(blocked(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps,radius,context))return false;
  return true;
}

function walkGridEdgeClear(a,b,radius,context){
  // Grid edges are axis aligned. One interval test per solid replaces several
  // sampled collision scans and still catches leaves thinner than a grid cell.
  const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minZ=Math.min(a.z,b.z),maxZ=Math.max(a.z,b.z);
  for(const d of context.walkSolids)if(maxX>d.minX-radius&&minX<d.maxX+radius&&maxZ>d.minZ-radius&&minZ<d.maxZ+radius)return false;
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.06));
  for(let i=1;i<steps;i++)if(!walkableFootprint(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps,radius,context))return false;
  return true;
}

// Each room owns its navigation cache; door state invalidates only that room.
// Teachers and pupils retain separate grids for their collision radii.
const ROUTE_CELL=.24,ROUTE_DIRECTIONS=[[1,0],[-1,0],[0,1],[0,-1]];
function routeGrid(radius,context){
  const routeGrids=context.routeGrids;
  let grid=routeGrids.get(radius);if(grid)return grid;
  // Keep the navigation lattice anchored in world space. Expanding a corridor
  // must not shift every row and erase the narrow valid gap between a chair
  // and its desktop. Bounds may add cells; they do not move existing cells.
  const cell=ROUTE_CELL,anchorX=-7.20+radius,anchorZ=-13.00+radius;
  const x0=anchorX+Math.floor((ROOM.minX+radius-anchorX)/cell)*cell,z0=anchorZ+Math.floor((ROOM.minZ+radius-anchorZ)/cell)*cell;
  const w=Math.floor((ROOM.maxX-radius-x0)/cell)+1,h=Math.floor((ROOM.maxZ-radius-z0)/cell)+1;
  if(w<1||h<1)return null;
  const points=Array.from({length:w*h},(_,i)=>({x:x0+i%w*cell,z:z0+Math.floor(i/w)*cell}));
  const free=new Uint8Array(w*h),edges=new Uint8Array(w*h);
  for(let i=0;i<points.length;i++)free[i]=Number(!blocked(points[i].x,points[i].z,radius,context));
  // Shared cardinal edge masks also protect thin door leaves for small radii.
  for(let i=0;i<points.length;i++)if(free[i]){
    const x=i%w,z=Math.floor(i/w);
    for(const [direction,dx,dz,reverse] of [[0,1,0,1],[2,0,1,3]]){
      if(x+dx>=w||z+dz>=h)continue;const next=i+dx+dz*w;
      if(free[next]&&walkGridEdgeClear(points[i],points[next],radius,context)){edges[i]|=1<<direction;edges[next]|=1<<reverse;}
    }
  }
  grid={radius,context,x0,z0,cell,w,h,points,free,edges};
  // Typical callers use only .18/.20/.23; avoid unbounded custom-radius caches.
  if(routeGrids.size>=8)routeGrids.delete(routeGrids.keys().next().value);
  routeGrids.set(radius,grid);return grid;
}
function nearestRouteCell(p,g){
  const {x0,z0,cell,w,h,points,free,radius,context}=g;
  const cx=Math.max(0,Math.min(w-1,Math.round((p.x-x0)/cell))),cz=Math.max(0,Math.min(h-1,Math.round((p.z-z0)/cell)));
  let best=-1,bestDistance=Infinity;
  const visit=(x,z)=>{
    if(x<0||x>=w||z<0||z>=h)return;const id=z*w+x;if(!free[id])return;
    const q=points[id],d=(p.x-q.x)**2+(p.z-q.z)**2;
    if((d<bestDistance||(d===bestDistance&&id<best))&&walkSegmentClear(p,q,radius,context)){best=id;bestDistance=d;}
  };
  // Start near the actual actor. The former full-grid scan repeatedly traced
  // long segments from the actor to the far corner before reaching nearby cells.
  for(let r=0;r<Math.max(w,h);r++){
    if(!r)visit(cx,cz);else{
      for(let x=cx-r;x<=cx+r;x++){visit(x,cz-r);visit(x,cz+r);}
      for(let z=cz-r+1;z<cz+r;z++){visit(cx-r,z);visit(cx+r,z);}
    }
    if(best<0)continue;
    let outside=Infinity;
    if(cx-r>0)outside=Math.min(outside,Math.abs(p.x-(x0+(cx-r-1)*cell)));
    if(cx+r+1<w)outside=Math.min(outside,Math.abs(p.x-(x0+(cx+r+1)*cell)));
    if(cz-r>0)outside=Math.min(outside,Math.abs(p.z-(z0+(cz-r-1)*cell)));
    if(cz+r+1<h)outside=Math.min(outside,Math.abs(p.z-(z0+(cz+r+1)*cell)));
    if(bestDistance<outside*outside)return best;
  }
  return best;
}
// Stable f-score/insertion-order heap: deterministic choices without scanning
// every open A* node on each expansion. Stale cost entries are discarded on pop.
class RouteHeap{
  constructor(){this.items=[];}
  before(a,b){return a.f<b.f||(a.f===b.f&&a.order<b.order);}
  push(value){const a=this.items;a.push(value);let i=a.length-1;while(i){const parent=(i-1)>>1;if(!this.before(value,a[parent]))break;a[i]=a[parent];i=parent;}a[i]=value;}
  pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let child=i*2+1;if(child+1<a.length&&this.before(a[child+1],a[child]))child++;if(!this.before(a[child],last))break;a[i]=a[child];i=child;}a[i]=last;}return first;}
  get size(){return this.items.length;}
}
export function walkRoute(start,end,radius=.2,context=defaultLayout){
  if(!Number.isFinite(radius)||radius<0||![start?.x,start?.z,end?.x,end?.z].every(Number.isFinite)||blocked(start.x,start.z,radius,context)||blocked(end.x,end.z,radius,context))return [];
  const grid=routeGrid(radius,context);if(!grid)return [];
  const {w,points,edges}=grid,a=nearestRouteCell(start,grid),b=nearestRouteCell(end,grid);if(a<0||b<0)return [];
  const size=points.length,cost=new Float64Array(size),came=new Int32Array(size),closed=new Uint8Array(size),orders=new Uint32Array(size),open=new RouteHeap();cost.fill(Infinity);came.fill(-1);
  const bx=b%w,bz=Math.floor(b/w),heuristic=i=>Math.abs(i%w-bx)+Math.abs(Math.floor(i/w)-bz);
  let sequence=1;cost[a]=0;orders[a]=sequence++;open.push({id:a,g:0,f:heuristic(a),order:orders[a]});
  while(open.size){
    const current=open.pop(),cur=current.id;if(closed[cur]||current.g!==cost[cur])continue;
    if(cur===b){const path=[];for(let i=b;i!==a;i=came[i])path.push({...points[i]});path.push({...points[a]});path.reverse();path.push({...end});return path;}
    closed[cur]=1;
    for(let direction=0;direction<4;direction++){
      if(!(edges[cur]&(1<<direction)))continue;
      const [dx,dz]=ROUTE_DIRECTIONS[direction],next=cur+dx+dz*w;if(closed[next])continue;
      const g=cost[cur]+1;if(g>=cost[next])continue;
      cost[next]=g;came[next]=cur;if(!orders[next])orders[next]=sequence++;
      open.push({id:next,g,f:g+heuristic(next),order:orders[next]});
    }
  }
  return [];
}
