import {floorHeight,jumpHeadroom} from './classroom-layout.js?v=campus-117&rev=126';

// Local tuning. The original's launch speed and gravity have not been measured.
export const JUMP_SPEED=4.6, JUMP_GRAVITY=17;
export function freeToJump(actor){
 return !!actor&&!actor.seated&&!actor.crouched&&!actor.caught&&!actor.mapActivity&&
   (!actor.captivity||actor.captivity==='free')&&!(actor.stunLeft>0);
}

// Feet travel in world space so stepping off a riser during flight does not
// raise or lower the whole arc. A low ceiling stops ascent at the contact time.
export function stepJump(flight,dt,ground,limit=Infinity){
 const start=Math.min(flight.y,limit),up=flight.speed;
 let y=start+up*dt-.5*JUMP_GRAVITY*dt*dt,speed=up-JUMP_GRAVITY*dt;
 if(up>0&&Number.isFinite(limit)){
  const disc=up*up-2*JUMP_GRAVITY*(limit-start);
  if(disc>=0){
   const hit=(up-Math.sqrt(disc))/JUMP_GRAVITY;
   if(hit<=dt){const fall=dt-hit;y=limit-.5*JUMP_GRAVITY*fall*fall;speed=-JUMP_GRAVITY*fall;}
  }
 }
 flight.y=Math.max(ground,y);flight.speed=speed;
 return y>ground||speed>0;
}
export function jumpBounds(actor,map){
 const ground=floorHeight(actor.x,actor.z,map,actor.busDeck);
 return {ground,limit:ground+jumpHeadroom(actor,map,ground)};
}
