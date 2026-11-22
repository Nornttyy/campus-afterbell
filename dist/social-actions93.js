export const SOCIAL_ACTIONS=Object.freeze({wave:'招手',step:'左右踏步',swing:'摇摆舞'});
export function canEmote(actor){
 return !!actor&&!actor.seated&&!actor.crouched&&!actor.caught&&(!actor.captivity||actor.captivity==='free')&&
  !actor.jumpHeight&&!actor.jumpSpeed&&!actor.mapActivity&&!actor.holding&&!actor._computerActive&&!actor.computerActive&&
  actor._drawnSlot==null&&actor.drawer?.drawnSlot==null&&!actor._drawerOpen&&!actor._penTaken;
}
export function actorEmote(actor,stage){
 const move=actor?._emote;
 if(!move)return null;
 if(move.stage!==stage||!canEmote(actor)||Math.hypot(actor.x-move.x,actor.z-move.z)>.09){actor._emote=null;return null;}
 return {id:move.id,start:move.start};
}
