// Third-person study timing only; first-person authored clips are untouched.
const smooth=t=>t*t*(3-2*t);
export function writingStroke(time){
 const phase=((time/2.7)%1+1)%1,writing=phase<.82,u=writing?phase/.82:(phase-.82)/.18;
 const x=writing?-.023+.046*smooth(u):.023-.046*smooth(u);
 // Several short strokes across one line, then a smooth return. The nib
 // remains constrained to the actual tilted page by the caller.
 const z=writing?.007*Math.sin(u*Math.PI*10)*Math.sin(u*Math.PI):-.003*Math.sin(u*Math.PI)**2;
 return {x,z};
}
export function thirdPersonPenTime(time){
 const cycle=Math.max(0,time)/1.9,index=Math.floor(cycle),phase=cycle-index;
 // Finger push, horizontal turn, catch. A brief catch replaces the former
 // perfectly uniform wheel rotation while the point of contact stays fixed.
 return (index+smooth(Math.min(1,phase/.73)))*1.6;
}
