// Shared geometry and seat positions: perception must use the room that is drawn.
export const ROOM = Object.freeze({minX:-5.55,maxX:5.55,minZ:-6.35,maxZ:5.85});
export const SEATS = Object.freeze([-4.5,-2.55,-.6,1.35,3.3].flatMap((z,row)=>
  [-4.7,-3.42,-1.4,-.12,2.1,3.38].map((x,col)=>Object.freeze({
    id:row*6+col,x,z:z-.72,deskX:x,deskZ:z,row,col,
  }))));
export const PLAYER_SEAT = 9;
export const FRIEND_SEATS = Object.freeze([2,6,16,27]);
export const AISLES = Object.freeze([-2.4,.99,4.65]);
export const BOARD = Object.freeze({x:.99,z:5.55});
export const DETENTION = Object.freeze(Array.from({length:5},(_,i)=>Object.freeze({x:-4.25+i*.58,z:5.1})));
export const DESKS = Object.freeze(SEATS.map(s=>Object.freeze({minX:s.x-.61,maxX:s.x+.61,minZ:s.deskZ-.4,maxZ:s.deskZ+.4})));
export function blocked(x,z,radius=.18){
  return x<ROOM.minX+radius||x>ROOM.maxX-radius||z<ROOM.minZ+radius||z>ROOM.maxZ-radius||
    DESKS.some(d=>x>d.minX-radius&&x<d.maxX+radius&&z>d.minZ-radius&&z<d.maxZ+radius);
}
export function moveInRoom(pos,dx,dz,radius=.18){
  // Swept substeps prevent crossing a thin desk when a frame arrives late.
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.08));
  let x=pos.x,z=pos.z;
  for(let i=0;i<steps;i++){if(!blocked(x+dx/steps,z,radius))x+=dx/steps;if(!blocked(x,z+dz/steps,radius))z+=dz/steps;}
  return{x,z};
}
