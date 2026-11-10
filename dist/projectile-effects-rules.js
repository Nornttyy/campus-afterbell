import {createSmokeProjectile,stepSmokeProjectile} from './smoke-physics.js?v=campus-65';
import {CRAWL_TUNING} from './crawl-profile.js?v=campus-65';
import {enclosureVolumes,OFFICE_SOLIDS,floorTiles,floorHeight,TEACHER_EYE_HEIGHT} from './classroom-layout.js?v=campus-65';

// Local reconstruction parameters, not measured single-projectile durations.
export const PROJECTILE_EFFECT_TUNING=Object.freeze({flashFuse:1.2,flashRange:8,flashWhite:4.5,flashFade:2.5,inkRange:2.2,inkDuration:7});
const clamp=n=>Math.max(0,Math.min(1,n)),occluders=new Map();
function boxesFor(map,layout=null){if(layout)return [...enclosureVolumes(map,layout),...OFFICE_SOLIDS,...floorTiles(map).map(t=>({...t,minY:0,maxY:t.height}))];if(!occluders.has(map))occluders.set(map,[...enclosureVolumes(map),...OFFICE_SOLIDS,...floorTiles(map).map(t=>({...t,minY:0,maxY:t.height}))]);return occluders.get(map);}
function segmentTime(a,b,box){
 let lo=0,hi=1;
 for(const axis of ['x','y','z']){
  const d=b[axis]-a[axis],min=box['min'+axis.toUpperCase()],max=box['max'+axis.toUpperCase()];
  if(Math.abs(d)<1e-9){if(a[axis]<min||a[axis]>max)return null;continue;}
  const u=(min-a[axis])/d,v=(max-a[axis])/d;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));if(lo>hi)return null;
 }
 return lo;
}
export function effectEye(actor,map='classroom'){
 const teacher=(actor.id??-1)===-1,height=teacher?TEACHER_EYE_HEIGHT:actor.seated?1.43:1.65;
 return{x:actor.x,y:floorHeight(actor.x,actor.z,map)+(actor.crouched&&!actor.seated?CRAWL_TUNING.eyeHeight:height),z:actor.z};
}
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
 return{...createSmokeProjectile(actor,id,charge,map,layout),kind,retired:false};
}
function actorImpact(a,b,actors,ownerId,map){
 let nearest=null;
 for(const actor of actors){
  const id=actor.id??-1;if(id===ownerId)continue;
  const floor=floorHeight(actor.x,actor.z,map),height=actor.crouched&&!actor.seated?CRAWL_TUNING.bodyMaxY:id===-1?2.14:actor.seated?1.64:1.88;
  const t=segmentTime(a,b,{minX:actor.x-.32,maxX:actor.x+.32,minY:floor+.08,maxY:floor+height,minZ:actor.z-.29,maxZ:actor.z+.29});
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
