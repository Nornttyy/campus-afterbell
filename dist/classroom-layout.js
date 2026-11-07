export const TEACHER_EYE_HEIGHT=1.95;
// Shared geometry and seat positions: perception must use the room that is drawn.
export const ROOM = Object.freeze({minX:-5.55,maxX:5.55,minZ:-6.35,maxZ:5.85});
export const SEATS = Object.freeze([-4.5,-2.55,-.6,1.35,3.3].flatMap((z,row)=>
  [-4.7,-3.42,-1.4,-.12,2.1,3.38].map((x,col)=>Object.freeze({
    id:row*6+col,x,z:z-.72,deskX:x,deskZ:z,row,col,
  }))));
export const PLAYER_SEAT = 9;
export const FRIEND_SEATS = Object.freeze([2,6,16,27]);
export const COVERED_SEATS = Object.freeze([PLAYER_SEAT,...FRIEND_SEATS,0,5,10,15,20,25]);
export const AISLES = Object.freeze([-2.4,.99,4.65]);
export const BOARD = Object.freeze({x:.99,z:5.55});
export const DETENTION = Object.freeze(Array.from({length:5},(_,i)=>Object.freeze({id:i,x:-4.45+i*.86,z:5.48})));
export const DESKS = Object.freeze(SEATS.map(s=>Object.freeze({minX:s.x-.61,maxX:s.x+.61,minZ:s.deskZ-.4,maxZ:s.deskZ+.4})));
export function blocked(x,z,radius=.18){
  return x<ROOM.minX+radius||x>ROOM.maxX-radius||z<ROOM.minZ+radius||z>ROOM.maxZ-radius||
    DESKS.some(d=>x>d.minX-radius&&x<d.maxX+radius&&z>d.minZ-radius&&z<d.maxZ+radius);
}
export function moveInRoom(pos,dx,dz,radius=.18){
  // Swept substeps prevent crossing a thin desk when a frame arrives late.
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.08));
  let x=pos.x,z=pos.z;
  for(let i=0;i<steps;i++){if(!blocked(x+dx/steps,z,radius))x+=dx/steps;if(!blocked(x,z+dz/steps,radius))z+=dz/steps;}
  return{x,z};
}

// Static walk grid shared by escort and rescue AI. Paths stay outside desks.
export function walkRoute(start,end,radius=.2){
  const cell=.24,x0=ROOM.minX+radius,z0=ROOM.minZ+radius;
  const w=Math.floor((ROOM.maxX-radius-x0)/cell)+1,h=Math.floor((ROOM.maxZ-radius-z0)/cell)+1;
  const point=i=>({x:x0+(i%w)*cell,z:z0+Math.floor(i/w)*cell});
  const nearest=p=>{let best=-1,dist=Infinity;for(let i=0;i<w*h;i++){const q=point(i),d=(p.x-q.x)**2+(p.z-q.z)**2;if(d<dist&&!blocked(q.x,q.z,radius)){best=i;dist=d;}}return best;};
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
