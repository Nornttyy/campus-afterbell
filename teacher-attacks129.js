import {actorFloorHeight,clearWallSegment} from './classroom-layout.js?v=campus-117&rev=154';

export const attacks=Object.freeze({
  horizontal:{cooldown:2.2,duration:2.2,windup:.78,fade:.75,speed:7,range:2.6,width:1.05,height:.55},
  vertical:{cooldown:20,duration:2.3,windup:.77,fade:.85,speed:8,range:6.2,width:1.18,height:1.35},
  eraser:{cooldown:15,duration:.5,windup:.16,speed:13,range:15}
});

export function castTeacherAttack(round,source,kind){
  const spec=attacks[kind],now=round._sessionElapsed;
  if(round.paused||round.status!=='playing'||source.captivity==='stunned')return false;
  const primary=kind==='horizontal';
  if(now+1e-8<(primary?round._nextThrow:round.skillReadyAt)||now+1e-8<(round.attackLockedUntil||0))return false;
  const yaw=source.yaw||0,pitch=source.pitch||0,eraser=kind==='eraser';
  if(round._writing)round.setWriting(false);
  const y=actorFloorHeight(source,round.map)+(eraser?1.68:1.08);
  round.chalks.push({id:round._chalkId++,kind,x:source.x,y,z:source.z,
    vx:Math.sin(yaw)*spec.speed*(eraser?Math.cos(pitch):1),vy:eraser?1.3-Math.sin(pitch)*spec.speed:0,
    vz:Math.cos(yaw)*spec.speed*(eraser?Math.cos(pitch):1),yaw,age:0,windup:spec.windup,
    travelled:0,hitIds:[],throwerId:source.id,originX:source.x,originZ:source.z,busDeck:source.busDeck||0});
  round.teacher.attackKind=kind;round.teacher.attackAt=now;
  round.attackLockedUntil=now+spec.duration;
  if(primary)round._nextThrow=now+spec.cooldown;else round.skillReadyAt=now+spec.cooldown;
  source._emote=null;
  return true;
}

export function advanceWave(round,c,dt){
  const spec=attacks[c.kind];
  if(c.fadeAge!=null){
    c.fadeAge+=dt;c.dead=c.fadeAge>=spec.fade;
    return;
  }
  let distance=Math.min(spec.range-c.travelled,spec.speed*dt);
  const dx=Math.sin(c.yaw),dz=Math.cos(c.yaw);
  const next={x:c.x+dx*distance,z:c.z+dz*distance,busDeck:c.busDeck};
  const blocked=!clearWallSegment(c,next,round.layout);
  if(blocked){
    // Keep the fading wave on the near face, including when a long tick crosses a thin wall.
    let near=0,far=distance;
    for(let i=0;i<12;i++){
      const mid=(near+far)*.5;next.x=c.x+dx*mid;next.z=c.z+dz*mid;
      if(clearWallSegment(c,next,round.layout))near=mid;else far=mid;
    }
    distance=near;next.x=c.x+dx*near;next.z=c.z+dz*near;
  }
  for(const s of round.students){
    if(s.id===c.throwerId||s.visible===false||s.caught||s.captivity!=='free'||c.hitIds.includes(s.id))continue;
    if(round.map==='bus'&&(s.busDeck||0)!==c.busDeck)continue;
    const x=s.x-c.x,z=s.z-c.z,forward=x*dx+z*dz;
    if(forward<-.23||forward>distance+.23||Math.abs(x*dz-z*dx)>spec.width+.22)continue;
    const floor=actorFloorHeight(s,round.map),top=floor+(s.crouched?.72:s.seated?1.58:1.85);
    if(c.y-spec.height>top||c.y+spec.height<floor+.15)continue;
    if(!clearWallSegment({x:c.originX,z:c.originZ,busDeck:c.busDeck},s,round.layout))continue;
    if(round._stun(s))c.hitIds.push(s.id);
  }
  Object.assign(c,next);c.travelled+=distance;
  if(blocked||c.travelled>=spec.range-.00001){
    c.fadeAge=Math.max(0,dt-distance/spec.speed);
    c.dead=c.fadeAge>=spec.fade;
  }
}
