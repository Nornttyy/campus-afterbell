// Route distances are metres in the station's world frame. Occupants and their
// interactions use cabin coordinates, on both the authority and its clients.
export const COACH_DOOR_SECONDS=.65;
export const ROAD_SECTION_LENGTH=48;
export const ROAD_RADIUS=3;
const CRUISE_SPEED=8.4;
const ACCELERATION_TIME=3.2;

export const COACH_BRAKE_SECONDS=3;
export function coachDistanceAt(time,departedAt,brakeAt=null){
 if(!Number.isFinite(departedAt)||!Number.isFinite(time))return 0;
 const braking=Number.isFinite(brakeAt)&&time>=brakeAt;
 const driving=Math.max(0,(braking?brakeAt:time)-departedAt-COACH_DOOR_SECONDS);
 const t=braking?Math.min(time-brakeAt,COACH_BRAKE_SECONDS):0;
 const brakeTravel=CRUISE_SPEED*(-Math.expm1(-driving/ACCELERATION_TIME))*t*(1-t/(2*COACH_BRAKE_SECONDS));
 return brakeTravel+CRUISE_SPEED*(driving+ACCELERATION_TIME*Math.expm1(-driving/ACCELERATION_TIME));
}

export function roadSectionAt(distance){return Math.floor(distance/ROAD_SECTION_LENGTH);}

export function sectionRandom(seed,section){
 let state=(seed>>>0)^Math.imul(section,0x9e3779b1)^0x7852fb9d;
 return ()=>{
  state=(state+0x6d2b79f5)|0;
  let x=Math.imul(state^(state>>>15),state|1);
  x^=x+Math.imul(x^(x>>>7),x|61);
  return ((x^(x>>>14))>>>0)/4294967296;
 };
}
