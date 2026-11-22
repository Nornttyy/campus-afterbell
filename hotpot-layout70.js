// Both dining arrangements are shared by rendering, drawer placement and physics.
export const HOTPOT_TABLE_SIZE=3.18,HOTPOT_TABLE_HEIGHT=.875;
const volume=(id,minX,maxX,minZ,maxZ,minY,maxY)=>Object.freeze({id,minX,maxX,minZ,maxZ,minY,maxY});
function diningLayout(rows,pattern,screenZ){
 const tables=[],seats=[],solids=[],walk=[];
 for(const [row,[z,places]] of rows.entries())for(const [col,[x,perSide]] of places.entries()){
  const id=tables.length,size=perSide===2?HOTPOT_TABLE_SIZE:2.48,half=size/2;
  tables.push(Object.freeze({id,x,z,row,col,size,perSide}));
  function part(name,cx,cz,w,d,low,high){solids.push(volume('hotpot-'+name+'-'+id,cx-w/2,cx+w/2,cz-d/2,cz+d/2,low,high));}
  part('table',x,z,size,size,.819,.875);part('pot',x,z,1.55,1.55,.875,1.16);
  part('foot',x,z,1.416,1.416,.003,.119);part('pedestal',x,z,1.28,1.28,.10,.64);part('cap',x,z,.996,.996,.622,.778);part('support',x,z,.84,.84,.775,.827);
  walk.push(volume('hotpot-table-footprint-'+id,x-half,x+half,z-half,z+half,0,.875));
  const corners=[-1,1].map(sign=>sign*(half-.135));
  for(const side of [-1,1])for(const c of corners){
   part('apron-x-'+side+'-'+c,x+c,z+side*(half-.065),.24,.06,.712,.822);
   part('apron-z-'+side+'-'+c,x+side*(half-.065),z+c,.06,.24,.712,.822);
  }
  for(const [side,yaw] of [0,-Math.PI/2,Math.PI,Math.PI/2].entries()){
   const sin=Math.sin(yaw),cos=Math.cos(yaw);
   for(const off of perSide===2?[-.59,.59]:[0]){
    const deskX=x-sin*(half-.385)+cos*off,deskZ=z-cos*(half-.385)-sin*off;
    seats.push(Object.freeze({id:seats.length,tableId:id,side,row,col,deskX,deskZ,x:deskX-sin*.78,z:deskZ-cos*.78,yaw,map:'hotpot',pattern}));
   }
  }
 }
 const screens=[];
 for(const x of [-3.1,3.20])for(const [i,off] of [-1.5,-.5,.5,1.5].entries()){
  const p=Object.freeze({id:screens.length,x:x+off*.84*Math.cos(.52),z:screenZ,yaw:(i%2?1:-1)*.52,width:.84,height:2.36,depth:.065});
  screens.push(p);const dx=(Math.abs(Math.cos(p.yaw))*p.width+Math.abs(Math.sin(p.yaw))*p.depth)/2,dz=(Math.abs(Math.sin(p.yaw))*p.width+Math.abs(Math.cos(p.yaw))*p.depth)/2;
  const bound=volume('hotpot-screen-'+p.id,p.x-dx,p.x+dx,p.z-dz,p.z+dz,0,p.height);walk.push(bound);solids.push(bound);
 }
 return Object.freeze({pattern,tables:Object.freeze(tables),seats:Object.freeze(seats),screens:Object.freeze(screens),solids:Object.freeze(solids),walk:Object.freeze(walk)});
}
const pairs=[[-3.10,2],[3.20,2]],small=[[-3.10,1],[3.20,1]];
const four=diningLayout([[-6.4,pairs],[1.5,pairs]],'hotpot-four',-2.5);
const seven=diningLayout([[-6.90,pairs],[-1.97,[[-4.32,1],[.22,1],[4.77,1]]],[3.20,small]],'hotpot-seven',.64);
export function hotpotLayout(seed=73){return (Number(seed)>>>0)%2===0?seven:four;}
export function diningPlanForSeats(seats){return seats?.[0]?.pattern===seven.pattern?seven:four;}
export const {tables:HOTPOT_TABLES,seats:HOTPOT_SEATS,screens:HOTPOT_SCREENS,solids:HOTPOT_SOLIDS,walk:HOTPOT_WALK_SOLIDS}=four;
