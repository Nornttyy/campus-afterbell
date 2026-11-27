import {BUS,BUS_SEATS,BUS_POSTS,BUS_WALLS,BUS_FURNITURE,BUS_DECK_SLABS,busSight,busBlocked,busFootprint,busFloorHeight,busRoute,moveOnBus} from './bus-layout86.js?v=campus-94';
import {SERVING_SOLIDS,CAFETERIA_SEATS} from './upper-floors85.js?v=campus-92';
import {STUDENT_PROPORTIONS} from './student-proportions73.js?v=campus-83';
import {hotpotLayout,diningPlanForSeats} from './hotpot-layout70.js?v=campus-94';
import {TOILET_SEATS,TOILET_SOLIDS,TOILET_WALK_SOLIDS,TOILET_STALLS,toiletDynamicSolids} from './toilet-layout70.js?v=campus-94';
import {DORM_SEATS,DORM_SOLIDS,DORM_WALK_SOLIDS,DORM_BOUNDS,DORM_ROOMS,DORM_ROOM_RECTS,DORM_SHELL_SOLIDS,DORM_CORRIDOR_SOLIDS,DORM_CEILINGS,dormDoorSolids,DORM_WATCH,DORM_POSTS,dormCabinetDoorSolids} from './dorm-layout70.js?v=campus-95';
import {PLAYGROUND_SEATS,PLAYGROUND_LAYOUT,PLAYGROUND_SOLIDS,PLAYGROUND_BOARD,PLAYGROUND_POSTS,playgroundFloorHeight,playgroundWalkable} from './playground-layout70.js?v=campus-117';
import {createSchoolDoorMotion,copySchoolDoorMotion,setSchoolDoorTargets,advanceSchoolDoors,schoolDoorSegments,schoolDoorSnapshot,SCHOOL_DOOR_IDS} from './school-door-motion65.js?v=campus-92';
import {CRAWL_TUNING} from './crawl-profile.js?v=campus-83';
// Elevator operation is enabled; boarding and per-round limits are authoritative.
export const ELEVATOR_ENABLED=true;
import {TEACHER_PROPORTIONS} from './teacher-proportions73.js?v=campus-83';
export const TEACHER_EYE_HEIGHT=TEACHER_PROPORTIONS.eyeHeight;
import {HALL,officePlan,liftPlan,officeDeskPlans,officeChairPlans,officeBoardPlan,officeBinPlan,officeShelfCenters,officeOffset} from './campus-ends.js?v=campus-101&rev=126';
 // In the walkthrough a player walking from the office toward the lift has the classroom on the left.
export const CLASSROOM=Object.freeze({minX:-6.65,maxX:7.20,minZ:-10.00,maxZ:8.80});
export const CORRIDOR=HALL;
export const OFFICE=Object.freeze({...officePlan,doorZ:HALL.maxZ+.11,opensZ:1});
export const LIFT=liftPlan;
// Local classroom plans have their board at +Z. Turn both desks and end-wall
// fittings about the room centre so a seated pupil has the hall on the right.
export const CLASS_TURN=Object.freeze({x:CLASSROOM.minX+CLASSROOM.maxX,z:CLASSROOM.minZ+CLASSROOM.maxZ});
export const turnedClass=map=>['classroom','night'].includes(mapKind(map));
// The unused inner bay starts after the classroom ends, on the way to the lift.
export const ALCOVE_ENTRY=Object.freeze({wallX:CORRIDOR.minX,stopX:CORRIDOR.minX-.75,
 minZ:CORRIDOR.minZ+1.05,maxZ:CLASSROOM.minZ-1.30,height:3.42});
export const LIFT_ALCOVE=Object.freeze({minX:ALCOVE_ENTRY.wallX-3.40,maxX:ALCOVE_ENTRY.wallX,
 minZ:ALCOVE_ENTRY.minZ,maxZ:ALCOVE_ENTRY.maxZ});
export const ALCOVE_STORAGE=Object.freeze({x:LIFT_ALCOVE.minX+.52,z:LIFT_ALCOVE.maxZ-.51});
function turnPoint(p){return {...p,x:CLASS_TURN.x-p.x,z:CLASS_TURN.z-p.z};}
function turnBox(b){return {...b,minX:CLASS_TURN.x-b.maxX,maxX:CLASS_TURN.x-b.minX,minZ:CLASS_TURN.z-b.maxZ,maxZ:CLASS_TURN.z-b.minZ};}
export const STUDENT_ENTRY=Object.freeze({x:LIFT.x,z:ELEVATOR_ENABLED?LIFT.z:CORRIDOR.minZ+.65});
export const ROOM=Object.freeze({minX:CLASSROOM.minX,maxX:CORRIDOR.maxX,minZ:LIFT.minZ,maxZ:OFFICE.maxZ});
export function mapBounds(map='classroom'){
 if(map==='bus')return {minX:BUS.apron.minX,maxX:BUS.apron.maxX,minZ:BUS.apron.minZ,maxZ:BUS.lift.maxZ};
 if(mapKind(map)==='dorm')return{...ROOM,maxX:DORM_BOUNDS.maxX,minX:Math.min(ROOM.minX,DORM_BOUNDS.minX)};
 if(mapKind(map)!=='playground')return ROOM;
 const b=PLAYGROUND_LAYOUT.bounds;
 return {minX:Math.min(ROOM.minX,b.minX),maxX:Math.max(ROOM.maxX,b.maxX),minZ:Math.min(ROOM.minZ,b.minZ),maxZ:Math.max(ROOM.maxZ,b.maxZ)};
}
export const CEILING_HEIGHT=4.51,TIERED_CEILING_HEIGHT=5.36;
export const TEACHER_SPAWN=Object.freeze({x:OFFICE.doorX,z:12.00,yaw:Math.PI,pitch:.025});
export const OFFICE_DESKS=officeDeskPlans;
export const OFFICE_CHAIRS=officeChairPlans;
export const OFFICE_DESK=OFFICE_DESKS[0],OFFICE_CHAIR=OFFICE_CHAIRS[0];
export const OFFICE_BOARD=officeBoardPlan;
export const ROLE_LOCKER=Object.freeze({x:CORRIDOR.maxX-.36,z:CORRIDOR.maxZ-2.28,yaw:-Math.PI/2});
export const START_BELL_POSITION=Object.freeze({x:7.43,z:-4.0});
export const CAMPUS_MAPS=Object.freeze(['playground','classroom','night','tiered','computer','toilet','hotpot','dorm','cafeteria','exam']);
export function mapKind(map='classroom'){const kind=String(map).replace(/[0-9]+$/,'');return kind;}
// Saved pre-expansion sessions used names such as computer7 and tiered8.
// Preserve those names and their floor number, while new lobbies use the
// canonical names above. Invalid suffixes cannot create extra floors.
export function isCampusMap(map){return typeof map==='string'&&(map==='bus'||CAMPUS_MAPS.includes(map)||/^(classroom|night|tiered|computer)[1-8]$/.test(map));}
export function campusFloor(map){if(!isCampusMap(map))return 0;const legacy=String(map).match(/([1-8])$/);return legacy?Number(legacy[1]):CAMPUS_MAPS.indexOf(map)+1;}
export const LAYOUT_PATTERNS=Object.freeze(['single','pairs','quads','mixed','rows-wide','rows-long']);
function layoutRandom(seed){let n=Number(seed)>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
// Pure per-room data. Never replace the exported default array: a server can
// run rooms with different layouts in the same JavaScript process safely.
export function createSeatLayout(seed=73,arrangement=null,map='classroom'){
 if(map==='bus')return BUS_SEATS;
 if(mapKind(map)==='cafeteria')return CAFETERIA_SEATS;
 if(mapKind(map)==='exam')return examSeats(seed);
 if(mapKind(map)==='hotpot')return hotpotLayout(seed).seats;
 if(mapKind(map)==='toilet')return TOILET_SEATS;
 if(mapKind(map)==='dorm')return DORM_SEATS;
 if(mapKind(map)==='playground')return PLAYGROUND_SEATS;
 const ordinary=['classroom','night'].includes(mapKind(map));
 const patterns=ordinary?[...LAYOUT_PATTERNS,'facing-aisle']:LAYOUT_PATTERNS;
 const index=Number(seed)>>>0;
 const pattern=patterns.includes(arrangement)?arrangement:ordinary&&index%7===6?'facing-aisle':LAYOUT_PATTERNS[index%LAYOUT_PATTERNS.length];
 const random=layoutRandom(seed),raw=[];
 // Translate each left-hand desk cluster intact, preserving paired tops, the
 // fixed right-hand stair lane and all authored model sizes.
 const kind=mapKind(map);
 const add=(x,z,yaw=0)=>raw.push({deskX:mapKind(map)==='tiered'?(x< -3?x+.15:x):x< -3?x+.45:x,deskZ:z,yaw});
 if(pattern==='facing-aisle'){
  // The desks meet in islands; the two inner chairs face away from the aisle.
  for(const z of [-5.90,-4.66,-1.82,-.58,2.94,4.18]){
   for(const [x,yaw] of [[-3.65,Math.PI/2],[-2.34,-Math.PI/2],[2.34,Math.PI/2],[3.20,-Math.PI/2]])add(x,z,yaw);
  }
  for(const [i,x] of [-4.65,-1.55,1.55,4.65].entries())add(x,-7.52,i%2?Math.PI:0);
 }else if(pattern==='rows-wide'||pattern==='rows-long'){
  const wide=pattern==='rows-wide',xs=wide?[-5,-2.5,0,2.5,5]:[-4.8,-1.6,1.6,4.8];
  // Four rows of five or five rows of four. On terraces the front two rows
  // share the deeper zero-height platform; no desktop straddles a riser.
  const zs=mapKind(map)==='tiered'?(wide?[-7.67,-4.07,-.47,3.13]:[-7.67,-4.07,-.47,2.75,4.65]):kind==='exam'?(wide?[-7.32,-3.60,.12,3.84]:[-7.42,-4.55,-1.68,1.19,4.06]):kind==='computer'?(wide?[-7.40,-3.64,.12,3.88]:[-7.44,-4.49,-1.54,1.41,4.36]):wide?[-7.05,-3.50,.05,3.60]:[-7.10,-4.42,-1.74,.94,3.62];
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
  const xs=pattern==='single'?[-5.90,-3.55,-1.20,1.20,3.55,5.90]:[-5.80,-4.52,-.64,.64,4.07,5.35];
  const rowDepths=kind==='computer'?[-7.44,-4.49,-1.54,1.41,4.36]:[-7.10,-4.42,-1.74,.94,3.62];
  for(const z of rowDepths)for(const x of xs)add(x,z);
 }else{
  const blockRows=kind==='computer'?[-6.50,-1.65,3.20]:[-6.22,-1.65,2.92];
  const blocks=blockRows.flatMap(z=>[-4.75,0,4.75].map(x=>({x,z})));
  // 7 four-seat islands + one pair, or 6 islands + three pairs = 30 places.
  const counts=pattern==='quads'?[4,4,4,4,4,4,4,2,0]:[4,2,4,2,4,4,4,2,4];
  if(pattern==='mixed')for(let i=counts.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[counts[i],counts[j]]=[counts[j],counts[i]];}
  // The imported top is .8486m deep; .83m centre spacing interpenetrated it.
  // Give facing desks a real seam without resizing their authored geometry.
  blocks.forEach(({x,z},i)=>{const n=counts[i];if(n===4){for(const dz of [-.44,.44])for(const dx of [-.625,.625])add(x+dx,z+dz,dz>0?Math.PI:0);}else if(n===2){const loose=pattern==='mixed'&&random()>.5;for(const dx of loose?[-1.05,1.05]:[-.64,.64])add(x+dx,z,0);}});
 }
 if(turnedClass(map))for(const desk of raw){desk.deskX=CLASS_TURN.x-desk.deskX;desk.deskZ=CLASS_TURN.z-desk.deskZ;desk.yaw=(desk.yaw+Math.PI)%(Math.PI*2);}
 const seats=raw.map((s,id)=>Object.freeze({...s,...(mapKind(map)==='exam'?{hideBook:true,hidePen:true}:{}),id,row:Math.floor(id/6),col:id%6,x:s.deskX-Math.sin(s.yaw)*.78,z:s.deskZ-Math.cos(s.yaw)*.78,pattern,map:mapKind(map)}));
 return Object.freeze(seats);
}
function examSeats(seed){
 const variant=(Number(seed)>>>0)%4,seats=[];
 const wide=variant!==1;
 const xs=wide?(variant===2?[-5.5,-4.24,-2.42,-1.16,1.05,2.31,4.24,5.5]:[-5.50,-3.98,-2.46,-.94,.94,2.46,3.98,5.5]):[-4.83,-1.65,1.65,4.83];
 const zs=wide?[-7.50,-3.72,.06,3.84]:[-7.70,-5.91,-4.12,-2.33,-.54,1.25,3.04,4.83];
 for(const [row,z] of zs.entries())for(const [col,baseX] of xs.entries()){
  const x=baseX+(variant===3?(row%2?.36:-.24):0);
  seats.push(Object.freeze({id:seats.length,deskX:x,deskZ:z,x,z:z-.78,yaw:0,row,col,pattern:['exam-rows','exam-columns','exam-pairs','exam-staggered'][variant],map:'exam',hideBook:true,hidePen:true}));
 }
 return Object.freeze(seats);
}
export const MAX_CAMPUS_SEATS=36;
export const SEATS=createSeatLayout(73);
export const PLAYER_SEAT=9;
export const FRIEND_SEATS=Object.freeze([2,6,16,19]);
export const COVERED_SEATS=Object.freeze([PLAYER_SEAT,...FRIEND_SEATS,0,5,10,15,20,25]);
export const AISLES=Object.freeze([CLASSROOM.minX+.27,-3.35,1.14,6.84]);
const prefabBoard=Object.freeze({x:1.25,z:7.45});
const prefabPosts=Object.freeze([-5.85,-5.00,-4.15,4.60,5.45,6.30].map((x,id)=>Object.freeze({id,x,z:8.08})));
export const BOARD=Object.freeze({...turnPoint(prefabBoard),yaw:Math.PI});
export const DETENTION=Object.freeze(prefabPosts.map(p=>Object.freeze(turnPoint(p))));
export const teacherSpawnFor=map=>map==='bus'?{...BUS.driver,busDeck:0}:TEACHER_SPAWN;
export function boardForMap(map='classroom'){if(map==='bus')return BUS.board;return mapKind(map)==='playground'?PLAYGROUND_BOARD.writePosition:mapKind(map)==='dorm'?DORM_WATCH:turnedClass(map)?BOARD:prefabBoard;}
export function detentionForMap(map='classroom'){if(map==='bus')return BUS_POSTS;return mapKind(map)==='playground'?PLAYGROUND_POSTS:mapKind(map)==='dorm'?DORM_POSTS:turnedClass(map)?DETENTION:prefabPosts;}
export const DOORS=Object.freeze([-8.00,7.00].map((center,i)=>Object.freeze({id:i===0?'rear':'front',center,minZ:center-.80,maxZ:center+.80})));
export const PARTITIONS=Object.freeze([{minX:7.20,maxX:7.40,minZ:-10.20,maxZ:DOORS[0].minZ},{minX:7.20,maxX:7.40,minZ:DOORS[0].maxZ,maxZ:DOORS[1].minZ},{minX:7.20,maxX:7.40,minZ:DOORS[1].maxZ,maxZ:9.02}]);
export const LECTERN=Object.freeze({minX:-1.240,maxX:-.450,minZ:7.3215,maxZ:7.8985});
const turnedLectern=Object.freeze(turnBox(LECTERN));
export const lecternForMap=map=>turnedClass(map)?turnedLectern:LECTERN;
const V=(minX,maxX,minZ,maxZ,minY=0,maxY=CEILING_HEIGHT)=>Object.freeze({minX,maxX,minZ,maxZ,minY,maxY});
export const DOOR_LEAVES=Object.freeze(DOORS.map(d=>V(7.30,8.88,d.maxZ-.07,d.maxZ+.07,.04,3.02)));
// Continuous shell: classroom proportions are independent of the longer corridor.
// The lift portal/cabin use the corridor's end, never the classroom's rear wall.
const portalZ=CORRIDOR.minZ,west=CLASSROOM.minX;
const endWalls=Object.freeze([
 V(CORRIDOR.minX,LIFT.minX,portalZ-.20,portalZ),V(LIFT.maxX,CORRIDOR.maxX+.20,portalZ-.20,portalZ),
 V(OFFICE.minX-.20,OFFICE.doorMinX,CORRIDOR.maxZ,OFFICE.minZ),V(OFFICE.doorMaxX,OFFICE.maxX+.20,CORRIDOR.maxZ,OFFICE.minZ),
 V(OFFICE.minX-.20,OFFICE.minX,OFFICE.minZ,OFFICE.maxZ+.20),V(OFFICE.maxX,OFFICE.maxX+.20,OFFICE.minZ,OFFICE.maxZ+.20),
 V(OFFICE.minX,OFFICE.maxX,OFFICE.maxZ,OFFICE.maxZ+.20),
 V(LIFT.minX-.20,LIFT.minX,LIFT.minZ-.20,portalZ),V(LIFT.maxX,LIFT.maxX+.20,LIFT.minZ-.20,portalZ),V(LIFT.minX,LIFT.maxX,LIFT.minZ-.20,LIFT.minZ)
]);
const corridorEdges=[
 V(CORRIDOR.maxX,CORRIDOR.maxX+.20,CORRIDOR.minZ,CORRIDOR.maxZ),
 V(CLASSROOM.maxX,CORRIDOR.minX,CORRIDOR.minZ,ALCOVE_ENTRY.minZ),
 V(CLASSROOM.maxX,CORRIDOR.minX,ALCOVE_ENTRY.maxZ,CLASSROOM.minZ-.20),
 V(LIFT_ALCOVE.minX-.20,LIFT_ALCOVE.maxX,LIFT_ALCOVE.minZ-.20,LIFT_ALCOVE.minZ),
 V(LIFT_ALCOVE.minX-.20,LIFT_ALCOVE.maxX,LIFT_ALCOVE.maxZ,LIFT_ALCOVE.maxZ+.20),
 V(LIFT_ALCOVE.minX-.20,LIFT_ALCOVE.minX,LIFT_ALCOVE.minZ,LIFT_ALCOVE.maxZ)
];
const classEdges=[
 V(west-.20,west,CLASSROOM.minZ-.20,CLASSROOM.maxZ+.22),
 V(west,CORRIDOR.minX,CLASSROOM.minZ-.20,CLASSROOM.minZ),
 V(west,CORRIDOR.minX,CLASSROOM.maxZ,CLASSROOM.maxZ+.22)
];
const dormCommonWalls=endWalls;
const headers=[...DOORS.map(d=>V(7.20,7.40,d.minZ,d.maxZ,3.08)),V(OFFICE.doorMinX,OFFICE.doorMaxX,CORRIDOR.maxZ,OFFICE.minZ,3.08),V(LIFT.minX,LIFT.maxX,portalZ-.20,portalZ,3.12),V(ALCOVE_ENTRY.wallX-.20,ALCOVE_ENTRY.wallX,ALCOVE_ENTRY.minZ,ALCOVE_ENTRY.maxZ,ALCOVE_ENTRY.height)];
const baseWalls=Object.freeze([...PARTITIONS,...classEdges,...corridorEdges,...endWalls]);
const liftThreshold=()=>V(LIFT.minX,LIFT.maxX,portalZ-.22,portalZ+.02,.02,3.12);
const sealedLift=ELEVATOR_ENABLED?[]:[liftThreshold()];
export const WALLS=Object.freeze([...baseWalls,...DOOR_LEAVES,...sealedLift]);
export const WALL_VOLUMES=Object.freeze([...baseWalls.map(d=>V(d.minX,d.maxX,d.minZ,d.maxZ,d.minY??0,d.maxY??CEILING_HEIGHT)),...DOOR_LEAVES,...sealedLift,...headers]);
const fixedCeilings=Object.freeze([V(LIFT_ALCOVE.minX-.20,LIFT_ALCOVE.maxX,LIFT_ALCOVE.minZ-.20,LIFT_ALCOVE.maxZ+.20,ALCOVE_ENTRY.height,ALCOVE_ENTRY.height+.16),V(CORRIDOR.minX-.20,CORRIDOR.maxX+.20,CORRIDOR.minZ-.20,CORRIDOR.maxZ+.20,CEILING_HEIGHT,CEILING_HEIGHT+.16),V(OFFICE.minX-.20,OFFICE.maxX+.20,OFFICE.minZ,OFFICE.maxZ+.20,OFFICE.height,OFFICE.height+.16),V(LIFT.minX-.20,LIFT.maxX+.20,LIFT.minZ-.20,portalZ-.20,3.12,3.28)]);
// Height to underside of each room ceiling. The hallway and office have their own slabs.
const teachingHeights=Object.freeze({classroom:4.10,night:4.10,computer:4.08,hotpot:4.18,toilet:4.04,cafeteria:4.25,exam:4.14,tiered:TIERED_CEILING_HEIGHT});
export function teachingRoomHeight(map){return teachingHeights[mapKind(map)]??CEILING_HEIGHT;}
const roomCeilings=Object.fromEntries(Object.entries(teachingHeights).map(([map,h])=>[map,Object.freeze([V(west-.20,7.40,-10.20,9.02,h,h+.16),...fixedCeilings])]));
const dormCeilings=Object.freeze([...DORM_CEILINGS,...fixedCeilings]);
const raisedUpperWalls=Object.freeze([V(west-.20,west,-10.20,9.02,CEILING_HEIGHT,TIERED_CEILING_HEIGHT),V(7.20,7.40,-10.20,9.02,CEILING_HEIGHT,TIERED_CEILING_HEIGHT),V(west,7.20,-10.20,-10.00,CEILING_HEIGHT,TIERED_CEILING_HEIGHT),V(west,7.20,8.80,9.02,CEILING_HEIGHT,TIERED_CEILING_HEIGHT)]);
export function ceilingVolumes(map='classroom'){const kind=mapKind(map);return kind==='dorm'?dormCeilings:roomCeilings[kind]||fixedCeilings;}
// The teacher laptop is only present on computer floors. Separate base and
// lid bounds avoid treating the air above its keyboard as a solid monitor.
const laptopVolumes=Object.freeze([V(-1.175,-.515,7.395,7.825,1.1475,1.1975),V(-1.175,-.515,7.354,7.429,1.1835,1.570)]);
export const REAR_CLASS_CABINET=Object.freeze({...V(-6.16,-4.98,-9.94,-9.46,0,1.47),id:'rear-class-cabinet'});
const ordinaryFurniture=Object.freeze([Object.freeze(turnBox(REAR_CLASS_CABINET))]);
export function specialFurnitureVolumes(map='classroom',seats){
 const kind=mapKind(map);return kind==='classroom'?ordinaryFurniture:kind==='cafeteria'?SERVING_SOLIDS:kind==='hotpot'?diningPlanForSeats(seats).solids:kind==='toilet'?TOILET_SOLIDS:kind==='dorm'?DORM_SOLIDS:kind==='playground'?PLAYGROUND_SOLIDS.filter(s=>!s.id.includes('-wall')):[];
}
function specialWalkSolids(map,seats){const kind=mapKind(map);return kind==='dorm'?DORM_WALK_SOLIDS:kind==='hotpot'?diningPlanForSeats(seats).walk:kind==='toilet'?TOILET_WALK_SOLIDS:specialFurnitureVolumes(map).filter(s=>!s.walkable);}
// Keep the office, lift and right corridor enclosed. The replaced classroom
// has only its actual outdoor perimeter and gate, never an invisible roof.
const outdoorFixedWalls=Object.freeze([...corridorEdges,...endWalls]);
const outdoorWalls=Object.freeze([...outdoorFixedWalls,...PLAYGROUND_SOLIDS.filter(s=>s.id.includes('-wall'))]);
const outdoorHeaders=Object.freeze([...headers.slice(DOORS.length),V(PLAYGROUND_LAYOUT.entrance.x-.02,PLAYGROUND_LAYOUT.entrance.x+.12,PLAYGROUND_LAYOUT.entrance.minZ-.07,PLAYGROUND_LAYOUT.entrance.maxZ+.07,2.35,2.43)]);
// The physical shaft is separate from the bind/rescue target at its centre.
function postVolumes(map){
 const kind=mapKind(map);
 if(kind==='playground'||kind==='bus')return [];
 return detentionForMap(map).map(p=>{
  const base=floorHeight(p.x,p.z,map);
  return {...V(p.x-.10,p.x+.10,p.z-.10,p.z+.10,base,base+2.06),id:'detention-post-'+p.id};
 });
}
export function enclosureVolumes(map='classroom',context=null){
 if(map==='bus')return [...BUS_WALLS,...BUS_FURNITURE,...BUS_DECK_SLABS];
 const kind=mapKind(map),shell=context?.wallVolumes||(kind==='playground'?[...outdoorWalls,...outdoorHeaders]:kind==='dorm'?[...dormCommonWalls,...DORM_SHELL_SOLIDS,...DORM_CORRIDOR_SOLIDS,...sealedLift,...headers.slice(2)]:WALL_VOLUMES);
 const furniture=context?.furnitureVolumes||[...specialFurnitureVolumes(map),...specialFurnitureDoors(map),...(kind==='computer'?labDividers(createSeatLayout(73,null,map)):[])];
 return [...shell,...furniture,...(context?.postVolumes||postVolumes(map)),...(kind==='tiered'?raisedUpperWalls:[]),...ceilingVolumes(map),...(kind==='computer'?laptopVolumes:[]),...(context?.dynamicSolids||[])];
}
export const OFFICE_SOLIDS=Object.freeze([
  V(officePlan.minX+.04,officePlan.minX+.71,officeShelfCenters[0]-1.16,officeShelfCenters.at(-1)+1.16,0,2.79),
  ...officeDeskPlans.map(d=>orientedVolume(d.x,d.z,d.yaw,d.width,d.depth,0,.985)),
  ...officeDeskPlans.map(d=>{const p=officeOffset(d,-.42,.19);return orientedVolume(p.x,p.z,d.yaw,.66,.08,1.105,1.482);}),
  V(officePlan.maxX-.68,officePlan.maxX-.02,11.075,14.925,0,1.291),
  V(officeBinPlan.x-.165,officeBinPlan.x+.165,officeBinPlan.z-.165,officeBinPlan.z+.165,0,.51),
  V(officeBoardPlan.x-1.35,officeBoardPlan.x+1.35,officeBoardPlan.z-.37,officeBoardPlan.z+.37,0,2.48),
 V(ROLE_LOCKER.x-.37,ROLE_LOCKER.x+.35,ROLE_LOCKER.z-.90,ROLE_LOCKER.z+.90,0,2.28),
 V(ALCOVE_STORAGE.x-.35,ALCOVE_STORAGE.x+.35,ALCOVE_STORAGE.z-.36,ALCOVE_STORAGE.z+.36,0,1.99)
]);
export const PODIUM=Object.freeze({halfWidth:3.15,front:6.50,back:CLASSROOM.maxZ,height:.16,tread:.17});
const TIER_Z=Object.freeze([CLASSROOM.minZ,...[-5.90,-2.30,1.30].flatMap(z=>[0,.07,.14,.21].map(d=>Number((z+d).toFixed(2))))]);
const TIER_X=Object.freeze([CLASSROOM.minX,...Array.from({length:13},(_,i)=>Number((CLASSROOM.maxX-(12-i)*.10).toFixed(2)))]);
export function floorHeight(x,z,map='classroom',deck=0){
 if(map==='bus')return busFloorHeight(x,z,deck);
 if(mapKind(map)==='playground')return playgroundFloorHeight(x,z);
 if(mapKind(map)==='toilet'||mapKind(map)==='dorm')return 0;
 if(turnedClass(map)){x=CLASS_TURN.x-x;z=CLASS_TURN.z-z;}
 if(z<=PODIUM.back&&z>=PODIUM.front-PODIUM.tread&&Math.abs(x)<=PODIUM.halfWidth+PODIUM.tread){
  return Math.abs(x)<=PODIUM.halfWidth&&z>=PODIUM.front?PODIUM.height:PODIUM.height/2;
 }
 if(mapKind(map)!=='tiered'||x>=CLASSROOM.maxX||x<CLASSROOM.minX||z<CLASSROOM.minZ||z>=TIER_Z.at(-1))return 0;
 // Four shallow risers reach each desk platform. The side aisle breaks the
 // same change in elevation into individual steps from the corridor door.
 const rowSteps=TIER_Z.slice(1).reduce((count,edge)=>count+Number(z<edge),0);
 const aisleSteps=Math.max(0,Math.floor((CLASSROOM.maxX-x+1e-8)/.10));
 return Math.min(rowSteps,aisleSteps)*.105;
}
export function jumpHeadroom(actor,map,ground){
 const head=actor.id===-1?TEACHER_PROPORTIONS.bodyHeight:STUDENT_PROPORTIONS.bodyHeight;
 const kind=mapKind(map),slabs=kind==='bus'?BUS_DECK_SLABS:ceilingVolumes(map);
 let limit=Infinity;
 function check(volumes){
  for(const v of volumes)if(v.minY>ground+.04&&actor.x>=v.minX-.15&&actor.x<=v.maxX+.15&&actor.z>=v.minZ-.15&&actor.z<=v.maxZ+.15)limit=Math.min(limit,v.minY);
 }
 check(slabs);
 if(kind==='playground')check(outdoorHeaders);
 else if(kind==='dorm'){check(headers.slice(DOORS.length));check(DORM_SHELL_SOLIDS);check(DORM_CORRIDOR_SOLIDS);}
 else if(kind!=='bus')check(headers);
 return Math.max(0,limit-ground-head);
}
export function actorFloorHeight(actor,map='classroom',carrier=null){if(actor.mapActivity?.kind==='hang'&&mapKind(map)==='playground'){const bar=PLAYGROUND_LAYOUT.bars.find(b=>b.id===actor.mapActivity.id);if(bar)return Math.max(0,bar.height-1.65);}const carried=actor.captivity==='carried'&&carrier,support=carried?carrier:actor;if(!carried&&mapKind(map)==='dorm'&&actor.seated&&!actor._officeChair&&!actor.officeChair){const bed=DORM_SEATS.find(s=>s.id===(actor.bedId??actor.seatId));if(bed)return bed.supportHeight;}return floorHeight(support.x,support.z,map,support.busDeck)+(support.jumpHeight||0);}
// Heights are relative to the actor's support surface. A bunk's mattress
// replaces the floor origin; using the school-chair height adds it twice.
export function actorEyeHeight(actor,map='classroom'){
 if(mapKind(map)==='dorm'&&actor.seated&&!actor._officeChair&&!actor.officeChair)return .23;
 if(actor.crouched&&!actor.seated)return CRAWL_TUNING.eyeHeight;
 return actor.id===-1?TEACHER_EYE_HEIGHT:actor.seated?1.43:STUDENT_PROPORTIONS.eyeHeight;
}
export function actorEyePosition(actor,map='classroom'){
 const bed=mapKind(map)==='dorm'&&actor.seated&&!actor.officeChair&&!actor._officeChair?DORM_SEATS[actor.bedId??actor.seatId]:null;
 return {x:bed?.headX??actor.x,y:actorFloorHeight(actor,map)+actorEyeHeight(actor,map),z:bed?.headZ??actor.z};
}
export function actorBodyVolume(actor,map='classroom'){
 const base=actorFloorHeight(actor,map),bed=mapKind(map)==='dorm'&&actor.seated&&!actor._officeChair&&!actor.officeChair;
 if(bed){
  const heading=DORM_SEATS[actor.bedId??actor.seatId]?.lieYaw??actor.seatYaw??actor.yaw??0;
  return orientedVolume(actor.x-Math.cos(heading)*.12,actor.z+Math.sin(heading)*.12,heading,1.90,.72,base+.01,base+.76);
 }
 const height=bed?1.13:actor.crouched&&!actor.seated?CRAWL_TUNING.bodyMaxY:actor.id===-1?TEACHER_PROPORTIONS.bodyHeight:actor.seated?1.64:STUDENT_PROPORTIONS.bodyHeight;
 return{minX:actor.x-.32,maxX:actor.x+.32,minZ:actor.z-.29,maxZ:actor.z+.29,minY:base+.08,maxY:base+height};
}
export function floorTiles(map='tiered'){
 if(mapKind(map)==='playground')return PLAYGROUND_LAYOUT.steps.map(s=>({minX:s.x-s.width/2,maxX:s.x+s.width/2,minZ:s.z-s.depth/2,maxZ:s.z+s.depth/2,height:s.top}));
 if(mapKind(map)!=='tiered')return [];
 const xs=TIER_X,zs=TIER_Z,out=[];
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){const h=floorHeight((xs[i]+xs[i+1])/2,(zs[j]+zs[j+1])/2,map);if(h>0)out.push({minX:xs[i],maxX:xs[i+1],minZ:zs[j],maxZ:zs[j+1],height:h});}return out;
}
export function walkableFootprint(x,z,r=.18,context=null){
 if(context?.map==='bus')return busFootprint(x,z,r);
 const kind=mapKind(context?.map);if(kind==='playground'&&playgroundWalkable(x,z,r))return true;
 const room=kind==='dorm'?DORM_ROOM_RECTS.some(b=>x>=b.minX+r&&x<=b.maxX-r&&z>=b.minZ+r&&z<=b.maxZ-r):(x>=CLASSROOM.minX+r&&x<=CORRIDOR.maxX-r&&z>=CLASSROOM.minZ+r&&z<=CLASSROOM.maxZ-r);
 const mouth=ALCOVE_ENTRY;
 const entry=kind!=='dorm'&&x<=mouth.wallX+r&&x>=mouth.stopX+r&&z>=mouth.minZ+r&&z<=mouth.maxZ-r;
 return entry||room||(x>=CORRIDOR.minX+r&&x<=CORRIDOR.maxX-r&&z>=CORRIDOR.minZ+r&&z<=CORRIDOR.maxZ-r)||(x>=OFFICE.minX+r&&x<=OFFICE.maxX-r&&z>=CORRIDOR.maxZ-r&&z<=OFFICE.maxZ-r)||(x>=LIFT.minX+r&&x<=LIFT.maxX-r&&z>=LIFT.minZ+r&&z<=CORRIDOR.minZ+r);
}
export function clearWallSegment(a,b,context=null){
 if(context?.map==='bus')return busSight(a,b,context);
 for(const w of context?.walls||WALLS){let lo=0,hi=1;for(const axis of ['X','Z']){const k=axis.toLowerCase(),d=b[k]-a[k];if(Math.abs(d)<1e-8){if(a[k]<w['min'+axis]||a[k]>w['max'+axis]){lo=2;break;}}else{let u=(w['min'+axis]-a[k])/d,v=(w['max'+axis]-a[k])/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);}}if(lo<=hi&&hi>=0&&lo<=1)return false;}return true;
}
// The shipped Tripo top is 1.200 × .849m, with its top at .875m.
// All four seating directions share the same physical rectangle transform.
export function orientedVolume(x,z,yaw,width,depth,minY=0,maxY=.875){
 const c=Math.abs(Math.cos(yaw||0)),s=Math.abs(Math.sin(yaw||0)),hx=(width*c+depth*s)/2,hz=(width*s+depth*c)/2;
 return V(x-hx,x+hx,z-hz,z+hz,minY,maxY);
}
// Shared by the visible lab screens, thrown objects and camera sight lines.
export const LAB_DIVIDER=Object.freeze({side:.593,depth:.80,thickness:.026,bottom:.864,top:1.46});
function labDividers(seats){
 if(mapKind(seats[0]?.map)!=='computer')return [];
 const d=LAB_DIVIDER;
 return seats.flatMap(s=>[-1,1].map(side=>{
  const offset=side*d.side,yaw=s.yaw||0;
  return {...orientedVolume(s.deskX+Math.cos(yaw)*offset,s.deskZ-Math.sin(yaw)*offset,yaw,d.thickness,d.depth,d.bottom,d.top),id:'lab-divider-'+s.id+'-'+side};
 }));
}
export function deskSolids(seats=SEATS){
 if(seats[0]?.map==='bus')return [];
 if(['hotpot','toilet','dorm','playground'].includes(mapKind(seats[0]?.map)))return [];
 return seats.map(s=>orientedVolume(s.deskX,s.deskZ,s.yaw,mapKind(s.map)==='computer'?1.22:1.20,.85,0,.875));
}
export function chairBackSolids(seats=SEATS){if(seats[0]?.map==='bus')return [];const noChairs=['toilet','dorm','playground'].includes(mapKind(seats[0]?.map));return [...(noChairs?[]:seats.map(s=>orientedVolume(s.x-Math.sin(s.yaw||0)*.325,s.z-Math.cos(s.yaw||0)*.325,s.yaw,.562,.114,.42,.99))),...OFFICE_CHAIRS.map(c=>{const back=officeOffset(c,0,-.30);return orientedVolume(back.x,back.z,c.yaw,.70,.12,.45,1.13);})];}
export const DESKS=Object.freeze(deskSolids());
export function createLayoutContext(seats=SEATS,doorState={}){
 const map=doorState.map||seats[0]?.map||'classroom',context={map,seats,postVolumes:postVolumes(map),desks:deskSolids(seats),chairBacks:chairBackSolids(seats),furnitureVolumes:specialFurnitureVolumes(map,seats),furnitureWalkSolids:specialWalkSolids(map,seats),routeGrids:new Map(),officeLocked:undefined,rearDoorClosed:undefined,elevatorClosed:undefined};updateLayoutDoors(context,doorState);updateSpecialFurnitureCollisions(context,doorState);return context;
}
function furnitureAmount(source,id){
 const entry=source instanceof Map?source.get(id):source?.[id],raw=typeof entry==='object'&&entry?entry.openness??entry.amount??entry.open:entry;
 return Number.isFinite(Number(raw))?Math.max(0,Math.min(1,Number(raw))):0;
}
function specialFurnitureDoors(map,state={}){
 const kind=mapKind(map);
 if(kind==='toilet')return toiletDynamicSolids(Object.fromEntries(TOILET_STALLS.map(s=>[s.id,furnitureAmount(state.toiletDoors,s.id)])),Object.fromEntries(TOILET_STALLS.map(s=>[s.id,furnitureAmount(state.toiletCabinets,s.id)])));
 if(kind==='dorm')return [...DORM_SEATS.flatMap(s=>dormCabinetDoorSolids(s.id,furnitureAmount(state.dormCabinets,s.id))),...DORM_ROOMS.flatMap(r=>dormDoorSolids(r.id,state.dormDoors?.[r.id]??1))];
 return[];
}
function rebuildWalkCollisions(context){
 if(context.map==='bus'){context.walls=BUS_WALLS;context.walkSolids=[...BUS_WALLS,...BUS_FURNITURE];context.routeGrids.clear();context.projectileColliderCache?.clear();return context;}
 const kind=mapKind(context.map),sightFurniture=context.furnitureVolumes.filter(s=>/^dorm-room-door-|^hotpot-screen-|^toilet-(left|right|rear|hinge|latch|door)-/.test(s.id||''));
 context.walls=[...(context._buildingWalls||[]),...sightFurniture];
 context.walkSolids=[...context.desks,...context.chairBacks,...(context._buildingWalls||[]),...context.furnitureWalkSolids,...context.postVolumes,...(['toilet','dorm','playground'].includes(kind)?[]:[lecternForMap(context.map)]),...OFFICE_SOLIDS,...(context.dynamicSolids||[])];
 context.routeGrids.clear();context.projectileColliderCache?.clear();return context;
}
// The simulation and renderer share CURRENT numeric openness. This function
// never advances animation independently or snaps a moving leaf to its target.
export function updateSpecialFurnitureCollisions(context,state={}){
 const kind=mapKind(context.map),doorKeys=kind==='toilet'?['toiletDoors','toiletCabinets']:kind==='dorm'?['dormCabinets','dormDoors']:[];
 context._specialFurnitureState??={};for(const key of doorKeys)if(Object.hasOwn(state,key))context._specialFurnitureState[key]=state[key];
 const current=context._specialFurnitureState,ids=kind==='toilet'?TOILET_STALLS:DORM_SEATS;
 const signature=JSON.stringify([kind,...doorKeys.map(key=>(key==='dormDoors'?DORM_ROOMS:ids).map(s=>key==='dormDoors'?(current[key]?.[s.id]??1):furnitureAmount(current[key],s.id)))]);
 if(context._furnitureCollisionSignature===signature)return false;
 context._furnitureCollisionSignature=signature;context.furnitureDynamicSolids=specialFurnitureDoors(context.map,current);
 context.furnitureVolumes=[...specialFurnitureVolumes(context.map,context.seats),...labDividers(context.seats),...context.furnitureDynamicSolids];
 context.furnitureWalkSolids=[...specialWalkSolids(context.map,context.seats),...context.furnitureDynamicSolids];
 rebuildWalkCollisions(context);return true;
}
export function updateLayoutDoors(context,state={}){
 if(context.map==='bus'&&Object.hasOwn(state,'busDeparted'))context.busDeparted=!!state.busDeparted;
 const {officeLocked=context.officeLocked??false,rearDoorClosed=context.rearDoorClosed??false,frontDoorClosed=context.frontDoorClosed??false,officeDoorClosed=Object.hasOwn(state,'officeLocked')?officeLocked:context.officeDoorClosed??officeLocked,elevatorClosed=context.elevatorClosed??false}=state;
 context.officeLocked=!!officeLocked;context.rearDoorClosed=!!rearDoorClosed;context.frontDoorClosed=!!frontDoorClosed;context.officeDoorClosed=!!officeDoorClosed;context.elevatorClosed=!ELEVATOR_ENABLED||!!elevatorClosed;
 const closed={rear:context.rearDoorClosed,front:context.frontDoorClosed,office:context.officeDoorClosed};
 if(!context.doorMotion)context.doorMotion=createSchoolDoorMotion(closed);
 if(state.doorMotion)copySchoolDoorMotion(context.doorMotion,state.doorMotion);
 else for(const [id,key]of [['rear','rearDoorClosed'],['front','frontDoorClosed'],['office','officeDoorClosed']])if(Object.hasOwn(state,key)||id==='office'&&Object.hasOwn(state,'officeLocked'))context.doorMotion[id]={amount:closed[id]?0:1,target:closed[id]?0:1};
 return rebuildDoorCollisions(context);
}
export function queueLayoutDoors(context,state={}){
 if(Object.hasOwn(state,'officeLocked'))context.officeLocked=!!state.officeLocked;
 const changes={};for(const [id,key]of [['rear','rearDoorClosed'],['front','frontDoorClosed'],['office','officeDoorClosed']])if(Object.hasOwn(state,key)){context[key]=!!state[key];changes[id]=context[key];}
 if(!Object.hasOwn(state,'officeDoorClosed')&&Object.hasOwn(state,'officeLocked')){context.officeDoorClosed=!!state.officeLocked;changes.office=context.officeDoorClosed;}
 setSchoolDoorTargets(context.doorMotion,changes);return rebuildDoorCollisions(context);
}
export function advanceLayoutDoors(context,dt,actors=[]){if(advanceSchoolDoors(context.doorMotion,dt,actors,{doors:DOORS,office:OFFICE}))rebuildDoorCollisions(context);return context;}
export function layoutDoorSnapshot(context){return schoolDoorSnapshot(context.doorMotion);}
function rebuildDoorCollisions(context){
 const kind=mapKind(context.map),outdoor=kind==='playground';
 const signature=JSON.stringify([kind,context.elevatorClosed,...SCHOOL_DOOR_IDS.map(id=>context.doorMotion[id].amount)]);if(context._doorCollisionSignature===signature)return context;context._doorCollisionSignature=signature;
 const leaves=SCHOOL_DOOR_IDS.filter(id=>(kind!=='dorm'||id==='office')).flatMap(id=>schoolDoorSegments(id,context.doorMotion[id].amount,{doors:DOORS,office:OFFICE}));
 if(context.elevatorClosed)leaves.push(liftThreshold());
 const walls=outdoor?outdoorWalls:kind==='dorm'?[...dormCommonWalls,...DORM_CORRIDOR_SOLIDS.filter(s=>s.minY===0),...DORM_SHELL_SOLIDS.filter(s=>s.minY===0)]:baseWalls;
 context._buildingWalls=[...walls,...leaves];
 context.wallVolumes=[...walls.map(d=>V(d.minX,d.maxX,d.minZ,d.maxZ,d.minY??0,d.maxY??CEILING_HEIGHT)),...leaves,...(outdoor?outdoorHeaders:kind==='dorm'?headers.slice(2):headers),...(kind==='dorm'?[...DORM_SHELL_SOLIDS,...DORM_CORRIDOR_SOLIDS].filter(s=>s.minY>0):[])];
 return rebuildWalkCollisions(context);
}
const defaultLayout=createLayoutContext();
export function blocked(x,z,radius=.18,context=defaultLayout,deck=0){if(context?.map==='bus')return busBlocked(x,z,radius,deck,context);return !walkableFootprint(x,z,radius,context)||(context?.walkSolids||defaultLayout.walkSolids).some(d=>x>d.minX-radius+1e-9&&x<d.maxX+radius-1e-9&&z>d.minZ-radius+1e-9&&z<d.maxZ+radius-1e-9);}
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
  const dynamic=[...(context.dynamicSolids||[]),...(context.furnitureDynamicSolids||[])],inside=(d,px,pz)=>px>d.minX-radius+1e-9&&px<d.maxX+radius-1e-9&&pz>d.minZ-radius+1e-9&&pz<d.maxZ+radius-1e-9;
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
    if(!walkableFootprint(target.x,target.z,radius,context)||statics.some(d=>at[other]>d['min'+cross]-radius&&at[other]<d['max'+cross]+radius&&hi>d['min'+key]-radius&&lo<d['max'+key]+radius))continue;
    exits.push({axis,sign,distance:Math.abs(edge-at[axis])});
  }
  const nearest=Math.min(...exits.map(e=>e.distance)),axis=nextX!==x?'x':'z',sign=Math.sign(axis==='x'?nextX-x:nextZ-z);
  if(!exits.some(e=>e.axis===axis&&e.sign===sign&&e.distance<=nearest+1e-9))return false;
  if(!walkableFootprint(nextX,nextZ,radius,context))return false;
  const coordinate=axis==='x'?nextX:nextZ,span=spans[axis];
  return !context.walkSolids.some(d=>inside(d,nextX,nextZ)&&(!dynamic.includes(d)||coordinate<span.min||coordinate>span.max));
}
export function moveInRoom(pos,dx,dz,radius=.18,context=defaultLayout){
  // Swept substeps prevent crossing a thin desk when a frame arrives late.
  context??=defaultLayout;
  if(context.map==='bus')return moveOnBus(pos,dx,dz,radius,context);
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
  for(const d of context.walkSolids)if(maxX>d.minX-radius+1e-9&&minX<d.maxX+radius-1e-9&&maxZ>d.minZ-radius+1e-9&&minZ<d.maxZ+radius-1e-9)return false;
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
  const bounds=mapBounds(context.map);
  const x0=anchorX+Math.floor((bounds.minX+radius-anchorX)/cell)*cell,z0=anchorZ+Math.floor((bounds.minZ+radius-anchorZ)/cell)*cell;
  const w=Math.floor((bounds.maxX-radius-x0)/cell)+1,h=Math.floor((bounds.maxZ-radius-z0)/cell)+1;
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
  if(context?.map==='bus')return busRoute(start,end,radius,context);
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
