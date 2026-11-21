const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

// A deterministic, staggered classroom routine. It never owns an inventory,
// presses an item button, or awards score; network peers receive the same mood.
export function ordinaryStudyState(actor,teacher,elapsed,seed=0,map=false){
 const computer=map===true||map==='computer';
 if(['toilet','dorm','playground'].includes(map))return {mood:map==='dorm'?'resting':map==='toilet'?'sitting':'standing',holding:false,action:null,_computerActive:false,_computerApp:'desktop',yaw:actor.seatYaw||0,pitch:0,studyBookHeld:false};
 const offset=((Math.imul((actor.id+1)>>>0,2654435761)^seed)>>>0)%3700/100;
 const phase=((Math.max(0,elapsed)+offset)%37+37)%37;
 const seatYaw=actor.seatYaw||0;
 if(map==='bus'&&actor.busDeck!==1){
  const ease=x=>{const u=clamp(x,0,1);return u*u*(3-2*u);};
  const watch=ease((phase-11)/2)*(1-ease((phase-20)/2)),down=ease((phase-26)/1.8)*(1-ease((phase-33)/2.4));
  const toward=teacher&&teacher.busDeck!==1?clamp(wrap(Math.atan2(teacher.x-actor.x,teacher.z-actor.z)-seatYaw),-.72,.72):0;
  const window=(actor.z< -13?1:-1)*.68;
  return {mood:'riding',holding:false,action:null,_computerActive:false,_computerApp:'desktop',
   yaw:seatYaw+watch*window+(1-watch)*(1-down)*toward*.60,pitch:.028+.34*down,studyBookHeld:false};
 }
 const mood=computer?(phase<23?'computer':'computer-idle'):phase<9?'listening':phase<20?'reading':'writing';
 const toward=teacher?Math.atan2(teacher.x-actor.x,teacher.z-actor.z):seatYaw;
 const watch=mood==='listening'||mood==='computer-idle';
 return {mood,holding:false,action:computer?'computer':null,
  _computerActive:mood==='computer',_computerApp:computer?'photoshop':'desktop',
  yaw:watch?seatYaw+clamp(wrap(toward-seatYaw),-.72,.72):seatYaw,
  pitch:watch?-.035:mood==='reading'?.16:mood==='writing'?.24:-.02,
  studyBookHeld:mood==='reading'};
}
