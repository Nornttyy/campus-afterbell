// Reconstructed from the actual hotpot-room views at 25:30, 26:10, 27:10
// and 28:10 in docs/reference-media/research70/first-detail. Those views show
// square pedestal tables, FOUR outward chairs, a broad red-broth metal pot,
// and folding timber screens toward the rear. Six tables/24 seats are the
// reconstruction capacity; occluded views do NOT establish the original total
// or exact metre measurements. This owns furnishings only.
export const HOTPOT_TABLE_SIZE=2.65;
export const HOTPOT_TABLE_HEIGHT=.875;
export const HOTPOT_TABLES=Object.freeze([-7.6,-2.5,2.6].flatMap((z,row)=>[-3.10,3.20].map((x,col)=>Object.freeze({id:row*2+col,x,z,row,col}))));
const slotRadius=.94;
export const HOTPOT_SEATS=Object.freeze(HOTPOT_TABLES.flatMap(table=>[0,-Math.PI/2,Math.PI,Math.PI/2].map((yaw,side)=>{
 const sin=Math.sin(yaw),cos=Math.cos(yaw),deskX=table.x-sin*slotRadius,deskZ=table.z-cos*slotRadius;
 return Object.freeze({id:table.id*4+side,tableId:table.id,side,row:table.row,col:table.col,deskX,deskZ,x:deskX-sin*.78,z:deskZ-cos*.78,yaw,map:'hotpot',pattern:'hotpot-four'});
})));
// Two folding-screen groups sit BETWEEN the rear and middle tables. The
// centre passage stays open; no screen is added around every table.
export const HOTPOT_SCREENS=Object.freeze([-3.1,3.2].flatMap((x,side)=>[-1.5,-.5,.5,1.5].map((offset,i)=>Object.freeze({id:side*4+i,x:x+offset*.81,z:-5.05,yaw:(i%2?1:-1)*.25,width:.84,height:2.36,depth:.065}))));
const volume=(id,minX,maxX,minZ,maxZ,minY=0,maxY=.875)=>Object.freeze({id,minX,maxX,minZ,maxZ,minY,maxY});
// Walkers cannot enter a tabletop footprint; airborne objects use the actual
// thin top and narrower pedestal instead of a full-height invisible box.
const screenSolids=HOTPOT_SCREENS.map(p=>{const x=Math.abs(Math.cos(p.yaw))*p.width/2+Math.abs(Math.sin(p.yaw))*p.depth/2,z=Math.abs(Math.sin(p.yaw))*p.width/2+Math.abs(Math.cos(p.yaw))*p.depth/2;return volume('hotpot-screen-'+p.id,p.x-x,p.x+x,p.z-z,p.z+z,0,p.height);});
export const HOTPOT_WALK_SOLIDS=Object.freeze([...HOTPOT_TABLES.map(t=>volume('hotpot-table-footprint-'+t.id,t.x-1.325,t.x+1.325,t.z-1.325,t.z+1.325)),...screenSolids]);
export const HOTPOT_SOLIDS=Object.freeze([
 ...HOTPOT_TABLES.flatMap(t=>{
  const solids=[volume('hotpot-table-'+t.id,t.x-1.325,t.x+1.325,t.z-1.325,t.z+1.325,.819,.875),volume('hotpot-pot-'+t.id,t.x-.775,t.x+.775,t.z-.775,t.z+.775,.875,1.16),
   volume('hotpot-foot-'+t.id,t.x-.708,t.x+.708,t.z-.708,t.z+.708,.003,.119),volume('hotpot-pedestal-'+t.id,t.x-.64,t.x+.64,t.z-.64,t.z+.64,.10,.64),volume('hotpot-cap-'+t.id,t.x-.558,t.x+.558,t.z-.558,t.z+.558,.622,.778),volume('hotpot-support-'+t.id,t.x-.42,t.x+.42,t.z-.42,t.z+.42,.775,.827)];
  for(const side of[-1,1])for(const corner of[-.87,.87]){
   solids.push(volume(`hotpot-apron-x-${t.id}-${side}-${corner}`,t.x+corner-.31,t.x+corner+.31,t.z+side*1.26-.03,t.z+side*1.26+.03,.712,.822));
   solids.push(volume(`hotpot-apron-z-${t.id}-${side}-${corner}`,t.x+side*1.26-.03,t.x+side*1.26+.03,t.z+corner-.31,t.z+corner+.31,.712,.822));
  }
  return solids;
 }),...screenSolids
]);
