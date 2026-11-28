import {createSmokeProjectile,stepSmokeProjectile} from './smoke-physics.js?v=campus-117&rev=167';
import {enclosureVolumes,OFFICE_SOLIDS,floorTiles,floorHeight,actorEyePosition as effectEye,actorBodyVolume,mapKind} from './classroom-layout.js?v=campus-117&rev=157';

// Local reconstruction parameters, not measured single-projectile durations.
export const PROJECTILE_EFFECT_TUNING=Object.freeze({flashFuse:1.2,flashRange:8,flashWhite:4.5,flashFade:2.5,inkRange:2.2,inkDuration:7});
const clamp=n=>Math.max(0,Math.min(1,n)),occluders=new Map();
function boxesFor(map,layout=null){if(map==='bus')return enclosureVolumes(map,layout);if(layout)return [...enclosureVolumes(map,layout),...OFFICE_SOLIDS,...(mapKind(map)==='playground'?[]:floorTiles(map).map(t=>({...t,minY:0,maxY:t.height})))];if(!occluders.has(map))occluders.set(map,[...enclosureVolumes(map),...OFFICE_SOLIDS,...(mapKind(map)==='playground'?[]:floorTiles(map).map(t=>({...t,minY:0,maxY:t.height})))]);return occluders.get(map);}
function segmentTime(a,b,box){
 let lo=0,hi=1;
 for(const axis of ['x','y','z']){
  const d=b[axis]-a[axis],min=box['min'+axis.toUpperCase()],max=box['max'+axis.toUpperCase()];
  if(Math.abs(d)<1e-9){if(a[axis]<min||a[axis]>max)return null;continue;}
  const u=(min-a[axis])/d,v=(max-a[axis])/d;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));if(lo>hi)return null;
 }
 return lo;
}
export {effectEye};
export function clearEffectSight(a,b,map='classroom',layout=null){return !boxesFor(map,layout).some(box=>segmentTime(a,b,box)!==null);}
export function flashExposure(origin,actor,map='classroom',layout=null){
 const eye=effectEye(actor,map),dx=origin.x-eye.x,dy=origin.y-eye.y,dz=origin.z-eye.z,dist=Math.hypot(dx,dy,dz);
 if(dist>=PROJECTILE_EFFECT_TUNING.flashRange||!clearEffectSight(origin,eye,map,layout))return 0;
 const pitch=actor.pitch||0,yaw=actor.yaw||0,cp=Math.cos(pitch),dot=dist>1e-6?(Math.sin(yaw)*cp*dx-Math.sin(pitch)*dy+Math.cos(yaw)*cp*dz)/dist:1;
 return clamp((1-dist/PROJECTILE_EFFECT_TUNING.flashRange)*(.25+.75*Math.max(0,dot)));
}
export function inkExposure(origin,actor,map='classroom',layout=null){
 const eye=effectEye(actor,map);return Math.hypot(eye.x-origin.x,eye.y-origin.y,eye.z-origin.z)<=PROJECTILE_EFFECT_TUNING.inkRange&&clearEffectSight(origin,eye,map,layout);
}
export function createThrowableProjectile(actor,id,kind,charge=0,map='classroom',layout=null){
 const p={...createSmokeProjectile(actor,id,1,map,layout),kind,retired:false};
 // Aim along the camera with a small lift at level pitch. Rotation naturally
 // approaches vertical; only the actual environment interrupts the arc.
 const pitch=actor.pitch||0,yaw=actor.yaw||0;
 const height=Math.max(.01,effectEye(actor,map).y-.06-floorHeight(actor.x,actor.z,map,actor.busDeck)-.075);
 const oldY=8*Math.sin(.66),range=1.4*8*Math.cos(.66)*(oldY+Math.sqrt(oldY*oldY+19.6*height))/9.8;
 const speed=Math.sqrt(9.8*range*range*1.0625/(2*(height+.25*range)));
 const horizontal=Math.cos(pitch),up=-Math.sin(pitch)+.25*horizontal;
 const scale=speed/Math.hypot(horizontal,up);
 p.vx=Math.sin(yaw)*horizontal*scale;p.vz=Math.cos(yaw)*horizontal*scale;p.vy=up*scale;
 return p;
}
function actorImpact(a,b,actors,ownerId,map){
 let nearest=null;
 for(const actor of actors){
  const id=actor.id??-1;if(id===ownerId)continue;
  const t=segmentTime(a,b,actorBodyVolume(actor,map));
  if(t!==null&&(!nearest||t<nearest.t))nearest={t,id};
 }
 return nearest;
}
export function stepThrowableProjectile(p,dt,actors=[],layout=null){
 if(p.retired)return{impacts:[],effect:null};
 const kind=p.kind||'smoke';
 if(kind==='ink'){
  const impacts=[],count=Math.max(1,Math.ceil(dt/.008)),h=dt/count;
  for(let i=0;i<count;i++){
   const a={x:p.x,y:p.y,z:p.z},previousImpact=p.firstImpact,hits=stepSmokeProjectile(p,h,layout);impacts.push(...hits);
   const hit=actorImpact(a,p,actors,p.ownerId,p.map);
   if(hit){p.x=a.x+(p.x-a.x)*hit.t;p.y=a.y+(p.y-a.y)*hit.t;p.z=a.z+(p.z-a.z)*hit.t;p.retired=true;return{impacts,effect:{kind,x:p.x,y:p.y,z:p.z,hitActorId:hit.id}};}
   if(previousImpact===null&&p.firstImpact!==null){const at=hits[0]||p;p.retired=true;return{impacts,effect:{kind,x:at.x,y:at.y,z:at.z,hitActorId:null}};}
  }
  return{impacts,effect:null};
 }
 const h=kind==='flash'?Math.min(dt,Math.max(0,PROJECTILE_EFFECT_TUNING.flashFuse-p.age)):dt,impacts=h>0?stepSmokeProjectile(p,h,layout):[];
 if(kind==='flash'&&p.age+1e-9>=PROJECTILE_EFFECT_TUNING.flashFuse){p.retired=true;return{impacts,effect:{kind,x:p.x,y:p.y,z:p.z}};}
 return{impacts,effect:null};
}
