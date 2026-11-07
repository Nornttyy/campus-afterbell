export const TEACHER_EYE_HEIGHT=1.95;
// World footprint: classroom, side corridor, office and the opposite lift lobby.
export const ROOM=Object.freeze({minX:-5.80,maxX:8.25,minZ:-9.35,maxZ:12.75});
export const CEILING_HEIGHT=4.51;
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
export function blocked(x,z,radius=.18){
  return !walkableFootprint(x,z,radius)||
    [...DESKS,...WALLS,LECTERN,...OFFICE_SOLIDS].some(d=>x>d.minX-radius&&x<d.maxX+radius&&z>d.minZ-radius&&z<d.maxZ+radius);
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

// Static walk grid shared by escort and rescue AI. Paths stay outside desks.
export function walkRoute(start,end,radius=.2){
  const cell=.24,x0=ROOM.minX+radius,z0=ROOM.minZ+radius;
  const w=Math.floor((ROOM.maxX-radius-x0)/cell)+1,h=Math.floor((ROOM.maxZ-radius-z0)/cell)+1;
  const point=i=>({x:x0+(i%w)*cell,z:z0+Math.floor(i/w)*cell});
  const nearest=p=>{let best=-1,dist=Infinity;for(let i=0;i<w*h;i++){const q=point(i),d=(p.x-q.x)**2+(p.z-q.z)**2;if(d<dist&&!blocked(q.x,q.z,radius)&&walkSegmentClear(p,q,radius)){best=i;dist=d;}}return best;};
  const a=nearest(start),b=nearest(end);if(a<0||b<0)return [];
  const cost=new Map([[a,0]]),came=new Map(),open=new Set([a]),closed=new Set();
  const heuristic=i=>Math.abs(i%w-b%w)+Math.abs(Math.floor(i/w)-Math.floor(b/w));
  while(open.size){
    let cur=-1,best=Infinity;for(const i of open){const f=cost.get(i)+heuristic(i);if(f<best){best=f;cur=i;}}
    if(cur===b){const path=[];for(let i=b;i!==a;i=came.get(i))path.push(point(i));path.push(point(a));path.reverse();if(!blocked(end.x,end.z,radius))path.push({...end});return path;}
    open.delete(cur);closed.add(cur);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=cur%w+dx,z=Math.floor(cur/w)+dz;if(x<0||x>=w||z<0||z>=h)continue;const n=z*w+x,q=point(n);if(closed.has(n)||blocked(q.x,q.z,radius))continue;const g=cost.get(cur)+1;if(g<(cost.get(n)??Infinity)){cost.set(n,g);came.set(n,cur);open.add(n);}}
  }
  return [];
}
