export const TEACHER_EYE_HEIGHT=1.95;
// World footprint: classroom, side corridor, office and the opposite lift lobby.
export const ROOM=Object.freeze({minX:-5.80,maxX:8.25,minZ:-9.35,maxZ:12.75});
export const CEILING_HEIGHT=4.51;
export const TIERED_CEILING_HEIGHT=5.30;
export const OFFICE=Object.freeze({minX:1.40,maxX:8.25,minZ:6.62,maxZ:12.75,doorX:7.15,doorMinX:6.25,doorMaxX:8.05});
// Start inside the clear central aisle, looking through the open office exit.
export const TEACHER_SPAWN=Object.freeze({x:6.70,z:9.60,yaw:Math.atan2(.65,-3.60),pitch:.025});
export const LIFT=Object.freeze({minX:6.12,maxX:8.25,minZ:-9.35,maxZ:-6.62,x:7.18,z:-8.15});
export const CAMPUS_MAPS=Object.freeze(['classroom','night','tiered','computer']);
export const SEATS=Object.freeze([-4.3,-2.48,-.66,1.16,2.98].flatMap((z,row)=>
 [-4.65,-3.33,-1.10,.22,2.62,3.94].map((x,col)=>Object.freeze({id:row*6+col,x,z:z-.72,deskX:x,deskZ:z,row,col}))));
export const PLAYER_SEAT=9;
export const FRIEND_SEATS=Object.freeze([2,6,16,27]);
export const COVERED_SEATS=Object.freeze([PLAYER_SEAT,...FRIEND_SEATS,0,5,10,15,20,25]);
export const AISLES=Object.freeze([-5.53,-2.215,1.42,5.38]);
export const BOARD=Object.freeze({x:1.25,z:5.55});
// Six posts are grouped at the two ends of the blackboard, never in the corridor.
export const DETENTION=Object.freeze([-5.12,-4.28,-3.44,3.44,4.28,5.12].map((x,id)=>Object.freeze({id,x,z:5.88})));
export const DOORS=Object.freeze([-5.14,4.96].map(center=>Object.freeze({center,minZ:center-.64,maxZ:center+.64})));
export const PARTITIONS=Object.freeze([{minX:5.80,maxX:6.00,minZ:-6.72,maxZ:DOORS[0].minZ},{minX:5.80,maxX:6.00,minZ:DOORS[0].maxZ,maxZ:DOORS[1].minZ},{minX:5.80,maxX:6.00,minZ:DOORS[1].maxZ,maxZ:6.62}]);
export const LECTERN=Object.freeze({minX:-1.52,maxX:-.17,minZ:5.32,maxZ:6.10});
export const DOOR_LEAVES=Object.freeze(DOORS.map(d=>Object.freeze({minX:5.93,maxX:7.03,minZ:d.maxZ-.138,maxZ:d.maxZ+.033,minY:.04,maxY:2.88})));
const V=(minX,maxX,minZ,maxZ,minY=0,maxY=CEILING_HEIGHT)=>Object.freeze({minX,maxX,minZ,maxZ,minY,maxY});
const boundaries=[V(-6,-5.8,-6.72,6.62),V(-5.8,5.8,-6.72,-6.50),V(-5.8,6.25,6.40,6.62),V(8.25,8.45,-9.55,12.95),V(1.20,1.40,6.62,12.95),V(1.4,8.45,12.75,12.95),V(6.0,6.25,6.4,6.7),V(8.05,8.45,6.4,6.7),V(6.0,6.12,-9.55,-6.50),V(6.12,8.45,-9.55,-9.35),V(-5.8,6.12,-9.55,-6.5)];
// End doorway headers do not obstruct a character or a thrown item below them.
const officeLeaves=[V(6.215,6.285,6.66,7.50,.01,2.95),V(8.015,8.085,6.66,7.50,.01,2.95)];
const headers=[...DOORS.map(d=>V(5.785,6.015,d.minZ,d.maxZ,2.89)),V(6.25,8.05,6.4,6.7,3.02),V(6.12,8.25,-6.72,-6.50,3.12),V(6.12,8.25,-9.35,-6.72,3.12)];
export const WALL_VOLUMES=Object.freeze([...PARTITIONS.map(d=>Object.freeze({...d,minY:0,maxY:CEILING_HEIGHT})),...DOOR_LEAVES,...officeLeaves,...boundaries,...headers]);
// Shared with thrown-item physics. Only the tiered classroom roof rises; the
// corridor and office keep their lower ceilings. These do not affect walking.
const fixedCeilings=Object.freeze([V(6.0,8.45,-6.85,6.75,CEILING_HEIGHT,CEILING_HEIGHT+.16),V(1.305,8.355,6.53,12.85,CEILING_HEIGHT,CEILING_HEIGHT+.16)]);
const flatCeilings=Object.freeze([V(-6.04,6.04,-6.84,6.74,CEILING_HEIGHT,CEILING_HEIGHT+.16),...fixedCeilings]);
const raisedCeilings=Object.freeze([V(-6.04,6.04,-6.84,6.74,TIERED_CEILING_HEIGHT,TIERED_CEILING_HEIGHT+.16),...fixedCeilings]);
const raisedUpperWalls=Object.freeze([V(-6.0,-5.8,-6.81,6.71,4.46,TIERED_CEILING_HEIGHT),V(5.8,6.0,-6.81,6.71,4.46,TIERED_CEILING_HEIGHT),V(-5.91,5.91,-6.81,-6.63,4.46,TIERED_CEILING_HEIGHT),V(-5.91,5.91,6.53,6.71,4.46,TIERED_CEILING_HEIGHT)]);
const flatEnclosure=Object.freeze([...WALL_VOLUMES,...flatCeilings]),raisedEnclosure=Object.freeze([...WALL_VOLUMES,...raisedUpperWalls,...raisedCeilings]);
export function ceilingVolumes(map='classroom'){return map==='tiered'?raisedCeilings:flatCeilings;}
export function enclosureVolumes(map='classroom'){return map==='tiered'?raisedEnclosure:flatEnclosure;}
export const WALLS=Object.freeze([...PARTITIONS,...DOOR_LEAVES,...officeLeaves,...boundaries]);
export const OFFICE_SOLIDS=Object.freeze([V(1.44,2.12,7.25,10.48,0,2.78),V(2.20,4.45,11.20,12.10,0,.95),V(7.62,8.24,8.35,11.75,0,1.03),V(7.60,8.24,2.10,3.72,0,2.28),V(2.95,3.65,10.38,11.13,0,1.12),V(5.17,7.03,11.665,12.335,0,2.25)]);
export function floorHeight(x,z,map='classroom'){
 if(Math.abs(x)<=3.15&&z>=4.525&&z<=6.40)return .16;
 if(map!=='tiered'||x>=5.8||x< -5.8||z< -6.5||z>=1.89)return 0;
 let h=0;for(const edge of [1.71,-.11,-1.93,-3.75])h+=z<edge?.24:z<edge+.18?.12:0;
 // Narrow return steps beside the rightmost desks reach the flat rear doorway.
 const side=Math.max(0,Math.floor((5.78-x+1e-8)/.15))*.12;
 return Math.min(h,side);
}
// A lifted pupil follows the carrier's feet, not the stair beneath the dangling body.
export function actorFloorHeight(actor,map='classroom',carrier=null){
 const support=actor.captivity==='carried'&&carrier?carrier:actor;
 return floorHeight(support.x,support.z,map);
}
export function floorTiles(map='tiered'){
 if(map!=='tiered')return [];
 const xs=[-5.8,...Array.from({length:9},(_,i)=>4.58+i*.15),5.8];
 const zs=[-6.5,-3.75,-3.57,-1.93,-1.75,-.11,.07,1.71,1.89];
 const out=[];for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){const h=floorHeight((xs[i]+xs[i+1])/2,(zs[j]+zs[j+1])/2,map);if(h>0)out.push({minX:xs[i],maxX:xs[i+1],minZ:zs[j],maxZ:zs[j+1],height:h});}return out;
}
export function walkableFootprint(x,z,r=.18){return (x>=-5.8+r&&x<=8.25-r&&z>=-6.5+r&&z<=6.4-r)||(x>=OFFICE.minX+r&&x<=OFFICE.maxX-r&&z>=6.4-r&&z<=OFFICE.maxZ-r)||(x>=LIFT.minX+r&&x<=LIFT.maxX-r&&z>=LIFT.minZ+r&&z<=-6.20);}
export function clearWallSegment(a,b){
 for(const w of WALLS){let lo=0,hi=1;for(const axis of ['X','Z']){const k=axis.toLowerCase(),d=b[k]-a[k];if(Math.abs(d)<1e-8){if(a[k]<w['min'+axis]||a[k]>w['max'+axis]){lo=2;break;}}else{let u=(w['min'+axis]-a[k])/d,v=(w['max'+axis]-a[k])/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);}}if(lo<=hi&&hi>=0&&lo<=1)return false;}
 return true;
}
export const DESKS = Object.freeze(SEATS.map(s=>Object.freeze({minX:s.x-.61,maxX:s.x+.61,minZ:s.deskZ-.4,maxZ:s.deskZ+.4})));
const WALK_SOLIDS=Object.freeze([...DESKS,...WALLS,LECTERN,...OFFICE_SOLIDS]);
export function blocked(x,z,radius=.18){
  return !walkableFootprint(x,z,radius)||
    WALK_SOLIDS.some(d=>x>d.minX-radius&&x<d.maxX+radius&&z>d.minZ-radius&&z<d.maxZ+radius);
}
export function moveInRoom(pos,dx,dz,radius=.18){
  // Swept substeps prevent crossing a thin desk when a frame arrives late.
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.08));
  let x=pos.x,z=pos.z;
  for(let i=0;i<steps;i++){if(!blocked(x+dx/steps,z,radius))x+=dx/steps;if(!blocked(x,z+dz/steps,radius))z+=dz/steps;}
  return{x,z};
}

function walkSegmentClear(a,b,radius){
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.06));
  for(let i=0;i<=steps;i++)if(blocked(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps,radius))return false;
  return true;
}

function walkGridEdgeClear(a,b,radius){
  // Grid edges are axis aligned. One interval test per solid replaces several
  // sampled collision scans and still catches leaves thinner than a grid cell.
  const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minZ=Math.min(a.z,b.z),maxZ=Math.max(a.z,b.z);
  for(const d of WALK_SOLIDS)if(maxX>d.minX-radius&&minX<d.maxX+radius&&maxZ>d.minZ-radius&&minZ<d.maxZ+radius)return false;
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.06));
  for(let i=1;i<steps;i++)if(!walkableFootprint(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps,radius))return false;
  return true;
}

// Geometry is immutable for all four classroom variants. Keep separate grids for
// each exact actor radius: teachers must not reuse a pupil's narrower clearance.
const routeGrids=new Map(),ROUTE_CELL=.24,ROUTE_DIRECTIONS=[[1,0],[-1,0],[0,1],[0,-1]];
function routeGrid(radius){
  let grid=routeGrids.get(radius);if(grid)return grid;
  const x0=ROOM.minX+radius,z0=ROOM.minZ+radius,cell=ROUTE_CELL;
  const w=Math.floor((ROOM.maxX-radius-x0)/cell)+1,h=Math.floor((ROOM.maxZ-radius-z0)/cell)+1;
  if(w<1||h<1)return null;
  const points=Array.from({length:w*h},(_,i)=>({x:x0+i%w*cell,z:z0+Math.floor(i/w)*cell}));
  const free=new Uint8Array(w*h),edges=new Uint8Array(w*h);
  for(let i=0;i<points.length;i++)free[i]=Number(!blocked(points[i].x,points[i].z,radius));
  // Shared cardinal edge masks also protect thin door leaves for small radii.
  for(let i=0;i<points.length;i++)if(free[i]){
    const x=i%w,z=Math.floor(i/w);
    for(const [direction,dx,dz,reverse] of [[0,1,0,1],[2,0,1,3]]){
      if(x+dx>=w||z+dz>=h)continue;const next=i+dx+dz*w;
      if(free[next]&&walkGridEdgeClear(points[i],points[next],radius)){edges[i]|=1<<direction;edges[next]|=1<<reverse;}
    }
  }
  grid={radius,x0,z0,cell,w,h,points,free,edges};
  // Typical callers use only .18/.20/.23; avoid unbounded custom-radius caches.
  if(routeGrids.size>=8)routeGrids.delete(routeGrids.keys().next().value);
  routeGrids.set(radius,grid);return grid;
}
function nearestRouteCell(p,g){
  const {x0,z0,cell,w,h,points,free,radius}=g;
  const cx=Math.max(0,Math.min(w-1,Math.round((p.x-x0)/cell))),cz=Math.max(0,Math.min(h-1,Math.round((p.z-z0)/cell)));
  let best=-1,bestDistance=Infinity;
  const visit=(x,z)=>{
    if(x<0||x>=w||z<0||z>=h)return;const id=z*w+x;if(!free[id])return;
    const q=points[id],d=(p.x-q.x)**2+(p.z-q.z)**2;
    if((d<bestDistance||(d===bestDistance&&id<best))&&walkSegmentClear(p,q,radius)){best=id;bestDistance=d;}
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
export function walkRoute(start,end,radius=.2){
  if(!Number.isFinite(radius)||radius<0||![start?.x,start?.z,end?.x,end?.z].every(Number.isFinite)||blocked(start.x,start.z,radius)||blocked(end.x,end.z,radius))return [];
  const grid=routeGrid(radius);if(!grid)return [];
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
