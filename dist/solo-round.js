import {ClassroomRound} from './classroom-rules.js?v=campus-52';
import {TeacherRound} from './teacher-rules.js?v=campus-52';
import {updateLayoutDoors,CAMPUS_MAPS} from './classroom-layout.js?v=campus-52';
import {createElevator,elevatorSnapshot,departureError,departElevator,advanceElevator} from './elevator-session.js';

const elevatorRound=Base=>class extends Base{
 reset(seed){this.elevator=createElevator();return super.reset(seed);}
 _inputAllowed(){return this.elevator?.phase!=='travel'&&super._inputAllowed();}
 snapshot(){const s=super.snapshot();s.floor=CAMPUS_MAPS.indexOf(this.map)+1;s.elevator=elevatorSnapshot(this.elevator,[{player:this.player}],this);if(s.elevator.phase==='travel')s.startBellAvailable=false;return s;}
 travelFloor(map){
  const error=departureError(this.elevator,[{player:this.player}],{map,currentMap:this.map,stage:this.stage,status:this.status});
  if(error||this.paused){if(error)this._events.push({type:'elevator-denied',message:error});return false;}
  this.hold(false);this._movement={x:0,z:0};this._doorUse=false;this._doorProgress=0;this.player.crouched=false;
  departElevator(this.elevator,map);updateLayoutDoors(this.layout,{elevatorClosed:true});this._events.push({type:'elevator-start',map});return true;
 }
 step(dt){
  if(this.elevator?.phase!=='travel')return super.step(dt);
  if(this.paused||this.status!=='playing')return this.snapshot();
  const map=advanceElevator(this.elevator,dt);
  if(map){
   const trip=this.elevator,p=this.player,pose={x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch},seed=this.seed;
   this.map=map;super.reset(seed);super.start({gathering:true});Object.assign(this.player,pose);this.elevator=trip;
   if(this.player.id===-1)Object.assign(this.teacher,{x:pose.x,z:pose.z,yaw:pose.yaw});
   updateLayoutDoors(this.layout,{elevatorClosed:false});this._events.push({type:'elevator-arrived',map});
  }
  return this.snapshot();
 }
};
export const SoloStudentRound=elevatorRound(ClassroomRound);
export const SoloTeacherRound=elevatorRound(TeacherRound);
export function createSoloRound(options={}){return new (options.role==='teacher'?SoloTeacherRound:SoloStudentRound)(options);}
