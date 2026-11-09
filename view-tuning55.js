export function gameplayFov(role,aspect=1.6){
 const student=aspect<.9?69:62;
 return role==='teacher'?student-6:student;
}
export function fatigueTarget(stamina){
 if(!Number.isFinite(stamina)||stamina>=15)return 0;
 const t=Math.max(0,Math.min(1,(15-stamina)/15));return t*t*(3-2*t);
}
export function smoothFatigue(current,stamina,dt){
 const target=fatigueTarget(stamina),time=Math.max(0,Math.min(.25,Number.isFinite(dt)?dt:0));
 return current+(target-current)*(1-Math.exp(-time*(target>current?3.6:2.7)));
}
