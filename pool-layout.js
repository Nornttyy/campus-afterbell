// Both corridor doors keep their school-floor coordinates. Each leads to a
// separate changing room with its own exit onto the shared east pool deck.
export const POOL_HALL={minX:-26,maxX:7.2,minZ:-10,maxZ:8.8,height:5.2};
export const BASIN={minX:-23,maxX:-3,minZ:-6.8,maxZ:5.8,depth:2.15,slope:.85};
export function poolFloor(x,z){
 const b=BASIN;
 return -Math.max(0,Math.min(b.depth,b.slope*Math.min(x-b.minX,b.maxX-x,z-b.minZ,b.maxZ-z)));
}
export const POOL_RADIO={x:-1.15,y:1.18,z:-9.85,yaw:0};
export const POOL_BOARD={x:-16,z:7.7,yaw:0};
export const POOL_POSTS=Array.from({length:8},(_,id)=>({id,x:-22+id*.8,z:-9.24}));
export const POOL_LOCKERS=[-1,1].flatMap(side=>[2.35,3.52,4.69,5.86].map((x,col)=>({
 x,z:-.6+side*.48,side,col,foodZ:-.6+side*.69
})));
export const POOL_STALLS=[{x:5,z:-4.42},{x:5,z:2.53}];
export const POOL_SEATS=[...Array.from({length:20},(_,id)=>({
 x:-17+(id%10)*1.44,z:id<10?6.85:-7.85,standing:true
})),...POOL_STALLS.map(s=>({...s,surface:'toilet',exitX:s.x,exitZ:s.z+1.16}))].map((s,id)=>({
 ...s,id,deskX:s.x,deskZ:s.z,row:Math.floor(id/10),col:id%10,yaw:0,map:'pool',pattern:'pool-deck',hideBook:true,hidePen:true
}));
function solid(id,x,z,w,d,h){
 return {id,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,minY:0,maxY:h};
}
export const POOL_WALLS=[
 solid('pool-west',-26.08,-.6,.16,19.12,5.2),
 ...[-10.08,8.88].map((z,i)=>solid('pool-end-'+i,-9.4,z,33.2,.16,5.2)),
 solid('changing-divider',4.1,-.6,6.2,.14,3.3),
 ...[[-9.29,1.42],[-.5,12.8],[8.46,.68]].map(([z,d],i)=>solid('changing-exit-'+i,1,z,.14,d,3.3)),
 ...POOL_STALLS.flatMap(({x,z},i)=>[
  solid('stall-back-'+i,x,z-.61,1.6,.065,1.93),
  ...[-.78,.78].map((dx,j)=>solid('stall-side-'+i+'-'+j,x+dx,z+.04,.065,1.35,1.93))
 ])
];
export const POOL_FIXTURES=[
 ...POOL_LOCKERS.map((s,i)=>solid('swim-locker-'+i,s.x,s.z,1.1,.65,1.9)),
 ...POOL_STALLS.map((s,i)=>solid('pool-bowl-'+i,s.x,s.z,.54,.66,.4))
];
