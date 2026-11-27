import {createSmokeProjectile,stepSmokeProjectile} from './smoke-physics.js?v=campus-117&rev=128';
import {actorEyePosition} from './classroom-layout.js?v=campus-117&rev=128';
import {PLAYGROUND_LAYOUT,vendingPoint} from './playground-layout70.js?v=campus-117';

const foods=['snack','drink','burger','noodles','chips','gum'];
const machine=PLAYGROUND_LAYOUT.vending[0];
export const COOLER=Object.freeze({x:machine.x+.29,z:machine.z-2.8,yaw:machine.yaw});
export function coolerPoint(i){
 return {x:COOLER.x+.10,y:.96,z:COOLER.z+(i-1)*.39};
}
export function nextSnack(round){
 const r=round._random();
 if(r<.06)return 'flash';
 if(r<.12)return 'smoke';
 if(r<.23)return 'banana';
 return foods[Math.min(foods.length-1,Math.floor((r-.23)/.77*foods.length))];
}
// Resting extents of the game meshes, measured in their ground orientation (mm).
const footprints={
 snack:[119,25,209],chips:[126,44,174],noodles:[124,41,169],drink:[88,88,132],
 burger:[155,141,155],banana:[130,55,121],garlic:[61,60,68],gum:[130,17,55],
 lunch:[220,54,160],hotpotPlate:[220,25,220],hotpotBite:[65,13,44],wrapper:[128,30,145],
 pen:[20,24,175],phone:[112,19,208],smoke:[91,88,201],flash:[105,94,211],
 ink:[86,98,125],bananaPeel:[153,145,116]
};
function extent(item){return footprints[item.action]||footprints.snack;}
function overlap(a,b){
 const [aw,,ad]=extent(a),[bw,,bd]=extent(b),ay=a.yaw||0,by=b.yaw||0;
 const dx=b.x-a.x,dz=b.z-a.z,cs=Math.abs(Math.cos(ay-by)),sn=Math.abs(Math.sin(ay-by));
 // Separating axes of both rotated rectangular footprints.
 for(const [yaw,w,d,ow,od] of [[ay,aw,ad,bw,bd],[by,bw,bd,aw,ad]]){
  const c=Math.cos(yaw),s=Math.sin(yaw);
  if(Math.abs(c*dx-s*dz)*2000>=w+ow*cs+od*sn ||
     Math.abs(s*dx+c*dz)*2000>=d+ow*sn+od*cs)return false;
 }
 return true;
}
export function canPick(round,p,point){
 if(!point||round.status!=='playing'||round.paused||p.id<0||p._drawnSlot!=null||round._restrained(p)||p.mapActivity)return false;
 const eye=actorEyePosition(p,round.map);
 return Math.hypot(eye.x-point.x,eye.y-point.y,eye.z-point.z)<2.50&&round._clearWallSegment(p,point);
}
function equip(round,p,action,dish){
 p._slots=[{id:0,action,dish,readyAt:Infinity,progress:0,temporary:true,heldBy:p.id}];
 p._selectedSlot=p._drawnSlot=0;p._heldSource={loose:true};p._drawerOpen=false;
 p.action=action;p.progress=0;p.holding=false;p._usingOfficeStock=false;
 if(p===round.player){round.selected=action;round.holding=false;}
}
export function takeLoose(round,id,p=round.player){
 const body=round.groundItems.get(id);
 if(!body||!canPick(round,p,body))return false;
 round.groundItems.delete(id);
 for(const other of round.groundItems.values())if(other.settled&&other.y>body.y&&overlap(other,body))other.settled=false;
 equip(round,p,body.action,body.dish);
 if(body.action==='pen'){
  p._penTaken=true;p._penMode='twirling';p._penSeatId=body.penSeatId;
  if(Number.isInteger(body.penSeatId)){
   round.penOwners.set(body.penSeatId,p.id);p._heldSource={office:false,seatId:body.penSeatId,deskId:null};
  }
 }
 return true;
}
export function takeCooler(round,id){
 if(round.map!=='playground'||!Number.isInteger(id)||id<0||id>2||!canPick(round,round.player,coolerPoint(id)))return false;
 const slot=round.coolerSlots[id];if(!slot.action)return false;
 equip(round,round.player,slot.action,null);slot.action=null;slot.readyAt=round._sessionElapsed+3;return true;
}
export function spawnLoose(round,p,action,dish,dispenser=null){
 const id=round.nextGroundId++,body=createSmokeProjectile(p,id,0,round.map,round.layout);
 if(dispenser){
  const mouth=vendingPoint(dispenser,'pickup'),yaw=dispenser.yaw+(round._random()-.5)*1.1;
  Object.assign(body,{x:mouth.x,y:.39,z:mouth.z,vx:Math.sin(yaw)*(1.1+round._random()),vy:1.3,vz:Math.cos(yaw)*1.7});
 }else{body.vx=Math.sin(p.yaw||0)*1.1;body.vz=Math.cos(p.yaw||0)*1.1;body.vy=.1;}
 Object.assign(body,{action,dish,yaw:p.yaw||0,origin:dispenser?.id});round.groundItems.set(id,body);return body;
}
export function dropLoose(round){
 const p=round.player,slot=p._slots[p._drawnSlot];if(!slot?.action||round._restrained(p)||!round._inputAllowed())return false;
 const body=spawnLoose(round,p,slot.action,slot.dish);
 if(slot.action==='pen'){
  body.penSeatId=p._penSeatId;p._slots.splice(p._drawnSlot,1);
  if(Number.isInteger(body.penSeatId))round.penOwners.set(body.penSeatId,null);
  p._penTaken=false;p._penSeatId=null;p._penMode=null;p._selectedSlot=0;
 }
 delete slot.heldBy;slot.action=null;slot.progress=0;slot.readyAt=round.elapsed+(round.map==='computer'&&!p._usingOfficeStock?round.tuning.labRefill:round.tuning.deskRefill);
 p._drawnSlot=null;p.holding=false;p._eating=false;p.progress=0;round.holding=false;round._finishHeldItem(p);
 if(!p.seated){p._slots=[];p._selectedSlot=0;}p.action=null;round.selected=p._slots[p._selectedSlot]?.action||'snack';return true;
}
export function advanceLoose(round,dt){
 if(round.map==='playground')for(const slot of round.coolerSlots)if(!slot.action&&round._sessionElapsed>=slot.readyAt){
  const occupied=round.coolerSlots.map(s=>s.action),result=nextSnack(round);
  const choices=foods.filter(k=>!occupied.includes(k));
  slot.action=occupied.includes(result)?choices[Math.floor(round._random()*choices.length)]:result;
 }
 if(!round.groundItems.size)return;
 const moving=[];for(const item of round.groundItems.values())if(!item.settled)moving.push(item);
 if(!moving.length)return;
 // The sleeping bodies form a spatial index for the few items still falling.
 const bins=new Map(),key=(x,z)=>x+','+z;
 function index(item){const k=key(Math.floor(item.x/.35),Math.floor(item.z/.35));if(!bins.has(k))bins.set(k,[]);bins.get(k).push(item);}
 for(const item of round.groundItems.values())if(item.settled)index(item);
 for(const item of moving){
  const from=item.y;stepSmokeProjectile(item,dt,round.layout);
  if(from>=item.y){
   const x=Math.floor(item.x/.35),z=Math.floor(item.z/.35);let support=-Infinity;
   for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const b of bins.get(key(x+dx,z+dz))||[]){
    if(!overlap(item,b))continue;
    const top=b.y+extent(b)[1]/1000;
    if(from>=top-.008&&item.y<=top)support=Math.max(support,top);
   }
   if(Number.isFinite(support)){item.y=support;item.vx=item.vy=item.vz=0;item.settled=true;}
  }
  if(item.settled)index(item);
 }
}
