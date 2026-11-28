import {BASIN,POOL_LOCKERS,poolFloor} from './pool-layout.js?v=campus-117&rev=180';
const snacks=['drink','snack','chips','noodles','burger','gum'];
const tools=['flash','smoke','ink'];
const pick=(items,roll)=>items[Math.floor(roll()*items.length)];
function add(round,point,action,source){
 const id=round.nextGroundId++;
 round.groundItems.set(id,{id,...point,action,poolSource:source,settled:true,yaw:round._drawerRoll()*Math.PI*2,spinX:0,spinZ:0,vx:0,vy:0,vz:0});
}
function bottomPoint(round){
 const b=BASIN;
 const x=b.minX+3+round._drawerRoll()*(b.maxX-b.minX-6);
 const z=b.minZ+3+round._drawerRoll()*(b.maxZ-b.minZ-6);
 return {x,z,y:poolFloor(x,z)+.075};
}
function locker(round,index){
 const l=POOL_LOCKERS[index];add(round,{x:l.x,y:.875+.075,z:l.foodZ},pick(snacks,()=>round._drawerRoll()),'locker-'+index);
}
export function startPoolStock(round){
 const roll=()=>round._drawerRoll();
 for(let i=0;i<POOL_LOCKERS.length;i++)if(i%4===0||roll()<.4)locker(round,i);
 for(let i=0;i<3;i++)add(round,bottomPoint(round),pick(snacks,roll),'snack');
 round.poolTimers={snack:8,locker:12,tool:30};
}
export function advancePoolStock(round){
 const t=round.poolTimers,now=round.elapsed;
 if(!t||round.stage!=='class'||now<Math.min(t.snack,t.locker,t.tool))return;
 const stock=[...round.groundItems.values()],roll=()=>round._drawerRoll();
 if(now>=t.snack){
  t.snack=now+8;
  if(stock.filter(i=>i.poolSource==='snack').length<5)add(round,bottomPoint(round),pick(snacks,roll),'snack');
 }
 if(now>=t.locker){
  t.locker=now+12;
  const free=POOL_LOCKERS.map((_,i)=>i).filter(i=>!stock.some(s=>s.poolSource==='locker-'+i));
  if(free.length)locker(round,pick(free,roll));
 }
 if(now>=t.tool){
  t.tool=now+30;
  if(!stock.some(i=>i.poolSource==='tool')&&roll()<.25)add(round,bottomPoint(round),pick(tools,roll),'tool');
 }
}
