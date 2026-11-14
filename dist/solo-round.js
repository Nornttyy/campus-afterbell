import {ClassroomRound} from './classroom-rules.js?v=campus-81';
import {TeacherRound} from './teacher-rules.js?v=campus-81';
import {updateLayoutDoors,CAMPUS_MAPS,campusFloor} from './classroom-layout.js?v=campus-81';
import {createElevator,elevatorSnapshot,departureError,departElevator,advanceElevator,moveElevatorPassenger} from './elevator-session.js?v=campus-81';

const elevatorRound=Base=>class extends Base{
 reset(seed){this.elevator=createElevator();super.reset(seed);this._soloStudents();return this.snapshot();}
 _soloStudents(){
  // A solo pupil is the sole mischievous participant. Other pupils remain
  // ordinary decoys; the teacher practice mode still needs AI opponents.
  if(this.player.id===-1)return;
  this._team=new Set([this.player.id]);
  for(const actor of this.students)if(actor!==this.player){actor.isTeammate=false;actor._profile=null;actor._slots=[];actor.holding=false;actor._drawnSlot=null;}
 }
 _inputAllowed(){return this.elevator?.phase!=='travel'&&super._inputAllowed();}
 setMovement(x,z){
  if(this.elevator?.phase!=='travel')return super.setMovement(x,z);
  if(!super._inputAllowed()||!Number.isFinite(x)||!Number.isFinite(z))return false;
  const n=Math.max(1,Math.hypot(x,z));this._movement={x:x/n,z:z/n};return true;
 }
 setLook(yaw,pitch){
  if(this.elevator?.phase!=='travel')return super.setLook(yaw,pitch);
  if(!super._inputAllowed()||!Number.isFinite(yaw)||!Number.isFinite(pitch))return false;
  this.player.yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));this.player.pitch=Math.max(-1.3,Math.min(1.3,pitch));return true;
 }
 snapshot(){const s=super.snapshot();s.floor=campusFloor(this.map);s.elevator=elevatorSnapshot(this.elevator,[{player:this.player}],this);if(s.elevator.phase==='travel')s.startBellAvailable=false;return s;}
 travelFloor(map){
  const error=departureError(this.elevator,[{player:this.player}],{map,currentMap:this.map,stage:this.stage,status:this.status});
  if(error||this.paused){if(error)this._events.push({type:'elevator-denied',message:error});return false;}
  this.hold(false);this._movement={x:0,z:0};this._doorUse=false;this._doorProgress=0;this.player.crouched=false;
  departElevator(this.elevator,map,this.map);updateLayoutDoors(this.layout,{elevatorClosed:true});this._events.push({type:'elevator-start',map});return true;
 }
 step(dt){
  if(this.elevator?.phase!=='travel')return super.step(dt);
  if(this.paused||this.status!=='playing')return this.snapshot();
  if(!Number.isFinite(dt)||dt<=0)return this.snapshot();
  const step=Math.min(dt,this.elevator.remaining,30);
  moveElevatorPassenger(this.player,this._movement,step,this.layout);
  this._sessionElapsed+=step;
  if(this.player.id===-1)Object.assign(this.teacher,{x:this.player.x,z:this.player.z,yaw:this.player.yaw});
  const map=advanceElevator(this.elevator,step);
  if(map){
   const trip=this.elevator,p=this.player,pose={x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch,character:p.character,variant:p.variant},seed=this.seed;
   this.map=map;super.reset(seed);this._soloStudents();super.start({gathering:true});Object.assign(this.player,pose);this.elevator=trip;
   if(this.player.id===-1)Object.assign(this.teacher,{x:pose.x,z:pose.z,yaw:pose.yaw});
   updateLayoutDoors(this.layout,{elevatorClosed:false});this._events.push({type:'elevator-arrived',map});
  }
  return this.snapshot();
 }
};
export const SoloStudentRound=elevatorRound(ClassroomRound);
export const SoloTeacherRound=elevatorRound(TeacherRound);
export function createSoloRound(options={}){return new (options.role==='teacher'?SoloTeacherRound:SoloStudentRound)(options);}

// Rebuild only the local actor role while retaining this lobby's world and trip.
export function switchSoloRole(round,role){
 if(!['student','teacher'].includes(role)||round.network||round.status!=='playing'||round.stage!=='gathering'||round.elevator?.phase==='travel')return null;
 if(round.snapshot().role===role)return round;
 const next=createSoloRound({role,seed:round.seed,map:round.map,duration:round._defaultDuration,target:round.target,chalkStamina:round.chalkStamina});
 next.start({gathering:true});
 const p=round.player;Object.assign(next.player,{x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch,character:p.character,variant:p.variant});
 if(role==='teacher')Object.assign(next.teacher,{x:p.x,z:p.z,yaw:p.yaw});
 next.elevator=round.elevator;next.paused=round.paused;next._sessionElapsed=round._sessionElapsed;next._stageElapsed=round._stageElapsed;
 updateLayoutDoors(next.layout,{officeLocked:round.layout.officeLocked,officeDoorClosed:round.layout.officeDoorClosed,frontDoorClosed:round.layout.frontDoorClosed,rearDoorClosed:round.layout.rearDoorClosed,doorMotion:round.snapshot().doorMotion,elevatorClosed:false});
 next._events=[];return next;
}
