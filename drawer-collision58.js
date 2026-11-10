import {mapKind,floorHeight,OFFICE_DESKS} from './classroom-layout.js?v=campus-59c';
// The visible trays extend beyond the desktop when pulled out. These bounds
// follow that extension; seat spacing and the imported models are unchanged.
function box(x,z,yaw,minX,maxX,minZ,maxZ,minY,maxY){
 const c=Math.cos(yaw),s=Math.sin(yaw),corners=[[minX,minZ],[minX,maxZ],[maxX,minZ],[maxX,maxZ]].map(([a,b])=>({x:x+c*a+s*b,z:z-s*a+c*b}));
 return {minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minZ:Math.min(...corners.map(p=>p.z)),maxZ:Math.max(...corners.map(p=>p.z)),minY,maxY};
}
export function syncDrawerCollisions(layout,map,actors){
 const opened=new Set(),offices=new Set();for(const a of actors){if(!a?.seated||!a._drawerOpen||a.caught)continue;if(a._officeChair)offices.add(a._officeDeskId);else if(a.seatId!=null)opened.add(a.seatId);}
 const signature=map+'|'+[...opened].sort((a,b)=>a-b).join(',')+'|'+[...offices].sort().join(',');
 if(layout.drawerCollisionSignature===signature)return false;
 const prior=new Set(layout.dynamicSolids||[]),solids=[];
 for(const id of opened){const seat=layout.seats.find(s=>s.id===id);if(!seat)continue;const h=floorHeight(seat.deskX,seat.deskZ,map),computer=mapKind(map)==='computer';
  solids.push(box(seat.deskX,seat.deskZ,seat.yaw||0,computer?-.28:-.50,computer?.28:.50,computer?-.705:-.733,computer?.005:.077,h+(computer?.608:.647),h+(computer?.770:.811)));
 }
 for(const d of OFFICE_DESKS)if(offices.has(d.id))solids.push(box(d.x,d.z,d.yaw||0,-.76,.76,-1.048,-.20,.53,.82));
 layout.dynamicSolids=solids;layout.walkSolids=layout.walkSolids.filter(s=>!prior.has(s)).concat(solids);layout.drawerCollisionSignature=signature;layout.routeGrids.clear();layout.projectileColliderCache?.clear();return true;
}
