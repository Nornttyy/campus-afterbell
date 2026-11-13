export const GLOBAL_SOUND_EVENTS=new Set(['gum-pop','phone-notification']);
const privateSounds=new Set(['use-crunch','use-gulp','gum-inflate','snake-food','snake-failed','valorant-watch']);
const publicSounds=new Set(['food-complete','drink-complete','gum-pop','phone-notification','burp','chalk','chalk-throw','chalk-hit']);
export function soundForEvent(event, player) {
  if(!player||event.recipientId!=null&&event.recipientId!==player.id)return null;
  if(!privateSounds.has(event.type)&&!publicSounds.has(event.type))return null;
  if(privateSounds.has(event.type)&&event.studentId!==player.id)return null;
  const kind=event.type==='chalk'?'chalk-throw':event.type==='valorant-watch'?'game-kill-'+Math.max(1,Math.min(5,event.killIndex||1)):event.type;
  if(GLOBAL_SOUND_EVENTS.has(event.type))return {kind,gain:.8};
  if(privateSounds.has(event.type))return {kind,gain:event.type.startsWith('use-')?.38:.58};
  const distance=Number.isFinite(event.x)&&Number.isFinite(event.z)?Math.hypot(event.x-player.x,event.z-player.z):0;
  return distance<14?{kind,gain:Math.max(.06,(1-distance/14)**1.3)*.8}:null;
}

// Only the teacher creates contacts. Keeping the track in world metres also
// prevents footsteps during standing, teleports, snapshots or seat changes.
export function createTeacherFootsteps(){
 let previous=null,map=null;
 return {reset(){previous=null;map=null;},sample(state){
  const actor=state.role==='teacher'?state.player:state.teacher;
  if(!actor||state.status!=='playing'||state.paused||state.map!==map){previous=null;map=state.map;if(!actor||state.status!=='playing'||state.paused)return 0;}
  const walking=actor.visible!==false&&!actor.seated&&!actor.crouched&&!actor.caught&&!(actor.stunLeft>0)&&actor.phase!=='stunned'&&(!actor.captivity||actor.captivity==='free');
  const old=previous;previous={x:actor.x,z:actor.z,walking,distance:0};
  if(!walking||!old?.walking)return 0;
  const travel=Math.hypot(actor.x-old.x,actor.z-old.z);if(!Number.isFinite(travel)||travel>.65)return 0;
  previous.distance=old.distance+travel;if(previous.distance<1.28)return 0;previous.distance%=1.28;
  const distance=Math.hypot(actor.x-state.player.x,actor.z-state.player.z);
  return state.role==='teacher'?.54:distance<12?.72*(1-distance/12)**2:0;
 }};
}
