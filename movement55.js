export const BACKWARD_SPEED_RATIO=.6;
// One normal pace per role, shared by humans and AI. Arrival deadlines never
// change these values. Carrying a pupil preserves the teacher's normal pace.
export const NORMAL_WALK_SPEEDS=Object.freeze({student:1.8,teacher:2.2,teacherCarrying:2.2});
export function normalWalkSpeed(actor){return actor?.id===-1?NORMAL_WALK_SPEEDS.teacher:NORMAL_WALK_SPEEDS.student;}
// Keep the approved, unhurried source gait while movement uses role-specific
// game speeds. A higher world speed must not turn the arms into a rapid cycle.
// Source keyframes and swing amplitudes remain unchanged; slow/fast travel
// only varies cadence within a small range around the normal role pace.
export function normalWalkCycleRate(role,speed,sourceSpeed){
 const normal=NORMAL_WALK_SPEEDS[role]||NORMAL_WALK_SPEEDS.student;
 const authoredSpeed=Math.max(.001,sourceSpeed),travelSpeed=Math.max(0,Number(speed)||0),relative=travelSpeed/normal;
 const pace=relative>.02?Math.max(.9,Math.min(1.08,Math.sqrt(relative))):.1;
 // At an authored (or slower) walking speed, preserve the clip's actual
 // distance/time contract. Applying the game's cadence cap here made a
 // planted foot lag behind body travel, even at the source's own pace.
 if(travelSpeed<=authoredSpeed)return travelSpeed/authoredSpeed;
 // Above the short-legged source's travel range, transition continuously to
 // the approved slower game cadence. This is stylized travel, not world-space
 // foot locking at arbitrary speeds; do not stretch limbs to fake that claim.
 const slowGamePace=role==='teacher'?Math.min(normal*BACKWARD_SPEED_RATIO,NORMAL_WALK_SPEEDS.teacherCarrying):normal*BACKWARD_SPEED_RATIO;
 const transitionEnd=Math.max(authoredSpeed+.1,slowGamePace);
 const phase=Math.max(0,Math.min(1,(travelSpeed-authoredSpeed)/(transitionEnd-authoredSpeed)));
 const blend=phase*phase*(3-2*phase),gameRate=.645*pace/authoredSpeed;
 return 1+(gameRate-1)*blend;
}
export function isBackward(actor,dx,dz){
 const length=Math.hypot(dx,dz);return length>1e-8&&(Math.sin(actor?.yaw||0)*dx+Math.cos(actor?.yaw||0)*dz)/length<-.05;
}
export function movementScale(actor,movement){return isBackward(actor,movement?.x||0,movement?.z||0)?BACKWARD_SPEED_RATIO:1;}
export function spendTeacherMovement(teacher,before,dt){
 if(!teacher||!before||!(dt>0))return 0;
 const dx=teacher.x-before.x,dz=teacher.z-before.z,distance=Math.hypot(dx,dz);
 // No drain while blocked, seated or teleported. Fractional work is retained
 // across stops/direction changes, making 30/60/120Hz yield identical costs.
 if(distance<1e-7||distance>dt*8+.01)return 0;
 const secondsPerPoint=isBackward(teacher,dx,dz)?.6:.2;
 teacher._movementFatigue=(teacher._movementFatigue||0)+dt/secondsPerPoint;
 const points=Math.floor(teacher._movementFatigue+1e-9);
 teacher._movementFatigue=Math.max(0,teacher._movementFatigue-points);
 teacher.stamina=Math.max(0,Math.min(100,(teacher.stamina??100)-points));return points;
}
