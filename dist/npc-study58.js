const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

// A deterministic, staggered classroom routine. It never owns an inventory,
// presses an item button, or awards score; network peers receive the same mood.
export function ordinaryStudyState(actor,teacher,elapsed,seed=0,computer=false){
 const offset=((Math.imul((actor.id+1)>>>0,2654435761)^seed)>>>0)%3700/100;
 const phase=((Math.max(0,elapsed)+offset)%37+37)%37;
 const mood=computer?(phase<23?'computer':'computer-idle'):phase<9?'listening':phase<20?'reading':'writing';
 const seatYaw=actor.seatYaw||0;
 const toward=teacher?Math.atan2(teacher.x-actor.x,teacher.z-actor.z):seatYaw;
 const watch=mood==='listening'||mood==='computer-idle';
 return {mood,holding:false,action:computer?'computer':null,
  _computerActive:mood==='computer',_computerApp:computer?'photoshop':'desktop',
  yaw:watch?seatYaw+clamp(wrap(toward-seatYaw),-.72,.72):seatYaw,
  pitch:watch?-.035:mood==='reading'?.16:mood==='writing'?.24:-.02,
  studyBookHeld:mood==='reading'};
}
