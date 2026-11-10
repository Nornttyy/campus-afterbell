import {reachesSchoolDoor} from '../dist/door-interaction54.js';
import {validComputerPlayback} from '../dist/computer-rules55.js';
import {DEFAULT_ROUND_SETTINGS,validRoundSettings} from '../dist/round-settings55.js';
import {movementScale} from '../dist/movement55.js';
import {randomUUID,randomBytes} from 'node:crypto';
import {ClassroomRound,DEVELOPMENT_TUNING,CLASSROOM_ACTIONS,AI_WALK_SPEEDS,RESCUE_DURATION} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import * as Layout from '../dist/classroom-layout.js';
import {createElevator,elevatorSnapshot,departureError,departElevator,advanceElevator,moveElevatorPassenger} from '../dist/elevator-session.js';

const finite=n=>typeof n==='number'&&Number.isFinite(n);
const variants=new Set(['boy','girl','glasses','ponytail']);
const cleanName=value=>String(value||'同学').replace(/[\u0000-\u001f<>]/g,'').slice(0,16)||'同学';
const CONTEXT=['player','selected','holding','_movement','_rescueId','_rescueProgress','completed'];
const studentCommands=new Set(['setMovement','setLook','setCrouch','hold','releaseUse','toggleDrawer','toggleBook','setDrawerOpen','setBookRaised','setOfficeDrawerOpen','takeSlot','returnItem','interact','startComputer','stopComputer','computerApp','computerSelect','computerConfirm','computerBack','setComputerPlayback','snakeDirection','takePen','togglePenMode','openOfficeDrawer','sitOfficeChair','burp','setRescue','selectSlot','selectAction','interactDoor','setInteraction']);
const teacherCommands=new Set(['setMovement','setLook','setCrouch','hold','releaseUse','deploySurveillance','viewSurveillance','closeSurveillance','throwChalk','grabStudent','bindStudent','dropStudent','releaseBoundStudent','setWriting','interact','setOfficeDrawerOpen','openOfficeDrawer','sitOfficeChair','interactDoor','setInteraction']);
const scoringEvents=new Set(['complete','gum-score','bubble-score','snake-food','valorant-watch']);
const teacherFeedbackEvents=new Set(['wrong-grab','correct-capture','stamina-low']);
function context(actor){return{player:actor,selected:actor.id===-1?'chalk':actor.action||actor._slots?.[0]?.action||'snack',holding:false,_movement:{x:0,z:0},_rescueId:null,_rescueProgress:0,completed:actor.completed||Object.fromEntries(Object.keys(CLASSROOM_ACTIONS).map(k=>[k,0]))};}

class SharedRound extends TeacherRound{
 canStartBell(){return this._inputAllowed()&&this.stage==='gathering';}
 _advanceStudents(dt){
  // Human state is controlled by authenticated room input, never AI decisions.
  for(const member of this.room?.members.values()||[]){if(member.role==='teacher')continue;const actor=member.context.player;actor.networkHuman=true;actor.holding=member.context.holding;actor.action=member.context.selected;actor._decisionAt=Infinity;actor._speed=1;actor._returnRoute=null;}
  super._advanceStudents(dt);
  for(const member of this.room?.members.values()||[]){if(member.role==='teacher')continue;member.context.holding=member.context.player.holding;member.context.selected=member.context.player.action||member.context.selected;}
 }
 _moveGuests(dt){
  for(const member of this.room?.members.values()||[]){
   if(member.role==='teacher'||!member.connected)continue;
   this.room.withMember(member,()=>{
    const p=this.player;if(p.seated||this._restrained(p))return;
    if(Date.now()-member.lastInput>500)this._movement={x:0,z:0};
    const speed=(p.crouched?DEVELOPMENT_TUNING.crouchSpeed:DEVELOPMENT_TUNING.walkSpeed)*movementScale(p,this._movement);
    const next=Layout.moveInRoom(p,this._movement.x*speed*dt,this._movement.z*speed*dt,.18,this.layout);
    p.x=next.x;p.z=next.z;
   });
  }
 }
 _advancePreparation(dt){
  this._moveGuests(dt);super._advancePreparation(dt);
  // The selected teacher waits inside the office for the full countdown.
  if(this.stage==='seating'){Object.assign(this.teacher,{x:this.player.x,z:this.player.z,yaw:this.player.yaw,officeLocked:true});}
  else this.teacher.officeLocked=false;
 }
 _advance(dt){this.teacher.officeLocked=false;this._moveGuests(dt);super._advance(dt);}
 _advanceCaptivity(dt){
  super._advanceCaptivity(dt);
  // Global transport/stun runs once. Rescue progress belongs to each human.
  for(const member of this.room?.members.values()||[]){if(member.role==='teacher'||!member.connected)continue;this.room.withMember(member,()=>{
   if(this._rescueId===null)return;
   const target=this.rescueTarget();if(target?.id!==this._rescueId){ClassroomRound.prototype.setRescue.call(this,null);return;}
   this._rescueProgress=Math.min(1,this._rescueProgress+dt/RESCUE_DURATION);
   if(this._rescueProgress>=1-1e-9){this._release(target,this.player);ClassroomRound.prototype.setRescue.call(this,null);}
  });}
 }
 _seatForClass(actor){if(actor.networkHuman)return;return super._seatForClass(actor);}
 _advanceRescuer(actor,dt){
  if(!actor._returnRoute)return super._advanceRescuer(actor,dt);
  // Reassign only the returning AI's destination when a human took its chair.
  // The existing path follower still controls speed, collision and arrival.
  const occupied=new Set(this.students.filter(s=>s!==actor&&s.seated).map(s=>s.seatId));
  const reserved=new Set(this.students.filter(s=>s!==actor&&!s.networkHuman&&(s._returnRoute||this._seatingRoutes.has(s.id))).map(s=>s._targetSeatId??s.id));
  for(const member of this.room?.members.values()||[])if(member.role==='student'&&!member.context.player.seated)reserved.add(member.studentId);
  const available=seat=>!occupied.has(seat.id)&&!reserved.has(seat.id),prior=this.seats[actor._targetSeatId??actor.id];
  let seat=prior&&available(prior)?prior:null;
  if(!seat){let best=Infinity;for(const candidate of this.seats){if(!available(candidate))continue;const route=this._walkRoute(actor,candidate,.2),distance=Math.hypot(actor.x-candidate.x,actor.z-candidate.z);if(!route.length&&distance>1e-8)continue;const length=route.reduce((sum,p,i)=>sum+Math.hypot(p.x-(i?route[i-1].x:actor.x),p.z-(i?route[i-1].z:actor.z)),0);if(length<best){best=length;seat=candidate;}}}
  actor.holding=false;actor.mood='walking';if(!seat){actor._returnRoute=[];return true;}
  if(actor._returnSeatId!==seat.id||!actor._returnRoute.length&&Math.hypot(actor.x-seat.x,actor.z-seat.z)>1e-8){actor._targetSeatId=seat.id;actor._returnSeatId=seat.id;actor._returnRoute=this._walkRoute(actor,seat,.2);if(!actor._returnRoute.length&&Math.hypot(actor.x-seat.x,actor.z-seat.z)>1e-8)return true;}
  if(this._follow(actor,actor._returnRoute,AI_WALK_SPEEDS.student,dt)){actor._returnRoute=null;delete actor._returnSeatId;this._seatForClass(actor);actor._decisionAt=this.elapsed+3;}return true;
 }
}

export const MAX_ROOM_PLAYERS=8;
export class CampusRoom{
 constructor({code,seed=Date.now()>>>0,map='classroom',floor=1,maxPlayers=MAX_ROOM_PLAYERS,settings=DEFAULT_ROUND_SETTINGS}={}){
  if(!validRoundSettings(settings))throw new RoomError(400,'时长须为5–20分钟，捣蛋目标须为30–120');this.settings={...settings};
  this.code=code;this.seed=seed;this.map=Layout.CAMPUS_MAPS.includes(map)?map:'classroom';this.floor=Math.max(1,Math.min(8,Number(floor)||1));this.maxPlayers=Math.max(2,Math.min(MAX_ROOM_PLAYERS,Number.isInteger(maxPlayers)?maxPlayers:MAX_ROOM_PLAYERS));this.members=new Map();this.hostId=null;this.sequence=0;this.events=[];this.createdAt=Date.now();this.updatedAt=this.createdAt;
  this.elevator=createElevator();
  this.sim=new SharedRound({seed,map:this.map,...this.settings});this.sim.room=this;this.teacherActor=this.sim.player;this.teacherContext=context(this.teacherActor);this.sim.start({gathering:true});
  // Only connected humans are the hidden mischievous students. Remaining
  // classmates are visible decoys, not falsely advertised network players.
  this._initializeStudents();
 }
 _initializeStudents(){this.sim.classSlotsBySeat.clear();this.sim._team=new Set();for(const actor of this.sim.students){actor.isPlayer=false;actor.isTeammate=false;actor.networkHuman=false;actor._profile=null;actor._slots=[];}this._decoyTemplates=this.sim.students.map(actor=>structuredClone(actor));}
 _restoreDecoy(actor){const template=this._decoyTemplates[actor.id];for(const key of Object.keys(actor))delete actor[key];Object.assign(actor,structuredClone(template));}
 withMember(member,fn){
  const sim=this.sim,prior=Object.fromEntries(CONTEXT.map(k=>[k,sim[k]]));
  const ctx=member.context;for(const key of CONTEXT)sim[key]=ctx[key];
  try{return fn(sim);}finally{for(const key of CONTEXT)ctx[key]=sim[key];for(const key of CONTEXT)sim[key]=prior[key];}
 }
 join({name,character='boy',rolePreference='student'}={}){
  if(this.elevator.phase==='travel')throw new RoomError(409,'电梯正在运行，请稍后加入');
  if(this.sim.stage!=='gathering'||this.sim.status!=='playing')throw new RoomError(409,'本局已开始，请等下一局');
  if(this.members.size>=this.maxPlayers)throw new RoomError(409,`房间已满，最多${this.maxPlayers}人`);
  const used=new Set([...this.members.values()].map(m=>m.studentId)),actor=this.sim.students.find(s=>!used.has(s.id));
  if(!actor)throw new RoomError(409,'没有空位');
  const id=randomUUID(),member={id,token:randomBytes(24).toString('base64url'),name:cleanName(name),character:variants.has(character)?character:'boy',rolePreference:rolePreference==='teacher'?'teacher':'student',role:'student',studentId:actor.id,connected:true,lastInput:Date.now(),lastSeen:Date.now(),lastSequence:0};
  this._prepareHuman(member,actor);member.context=context(actor);this.members.set(id,member);if(!this.hostId)this.hostId=id;this.sim._team.add(actor.id);this.updatedAt=Date.now();this.sequence++;return member;
 }
 _prepareHuman(member,actor,i=this.members.size){this._restoreDecoy(actor);Object.assign(actor,{visible:true,networkHuman:true,isPlayer:false,isTeammate:false,name:member.name,character:member.character,variant:member.character,_profile:null,_decisionAt:Infinity,_speed:1,seated:false,seatId:null,x:Layout.CORRIDOR.minX+.60+(i%3)*.65,z:Layout.CORRIDOR.minZ+1.2+Math.floor(i/3)*.85,yaw:0,pitch:0,caught:false,captivity:'free',holding:false,_drawnSlot:null,_drawerOpen:false});
  actor._slots=Array.from({length:Layout.mapKind(this.map)==='computer'?1:3},(_,id)=>({id,action:this.sim._drawItem(),readyAt:0,progress:0}));actor._selectedSlot=0;actor.action=actor._slots[0].action;
 }
 findToken(token){return [...this.members.values()].find(m=>m.token===token)||null;}
 preference(member,{rolePreference,character}={}){if(this.sim.stage!=='gathering'||this.sim.status!=='playing'||this.elevator.phase==='travel')throw new RoomError(409,'开始后不能换身份');if(rolePreference!==undefined)member.rolePreference=rolePreference==='teacher'?'teacher':'student';if(variants.has(character)){member.character=character;member.context.player.character=character;member.context.player.variant=character;}this.sequence++;}
 begin(member,settings){
  if(this.elevator.phase==='travel')throw new RoomError(409,'请等电梯到达');
  if(member.id!==this.hostId)throw new RoomError(403,'只有房主可以开始');
  if(this.sim.stage!=='gathering')return false;
  const people=[...this.members.values()].filter(m=>m.connected);if(people.length<2)throw new RoomError(409,'至少需要两位玩家');
  // Start carries the host's final form values. Validation and applying them
  // happen in this command before role assignment/countdown, without an ACK race.
  if(settings!==undefined&&!this.configureRound(member,settings))return false;
  const candidates=people.filter(m=>m.rolePreference==='teacher'),pool=candidates.length?candidates:people,chosen=pool[Math.floor(this.sim._random()*pool.length)];
  this.sim._team.clear();
  for(const p of this.members.values()){
   p.role=p===chosen?'teacher':'student';
   if(p===chosen){this._restoreDecoy(this.sim.students[p.studentId]);p.context=this.teacherContext;Object.assign(this.teacherActor,Layout.TEACHER_SPAWN,{seated:false,crouched:false});}
   else this.sim._team.add(p.studentId);
  }
  this.teacherMember=chosen;
  for(const key of CONTEXT)this.sim[key]=chosen.context[key];
  const started=ClassroomRound.prototype.startBell.call(this.sim);
  // Human students choose their own chairs and never follow AI arrival routes.
  for(const p of this.members.values())if(p.role==='student'){this.sim._seatingRoutes.delete(p.studentId);this.sim._seatingStarts.delete(p.studentId);}
  this.events.push({type:'roles-assigned',teacherId:chosen.id,networkSequence:++this.sequence});this.sequence++;return started;
 }
 _rebuild(map,seed=this.seed){
  this.map=map;this.seed=seed>>>0;this.floor=Layout.CAMPUS_MAPS.indexOf(map)+1;
  this.sim=new SharedRound({seed:this.seed,map,...this.settings});this.sim.room=this;this.teacherActor=this.sim.player;this.teacherContext=context(this.teacherActor);this.teacherMember=null;this.sim.start({gathering:true});this.sim._team=new Set();this.events=[];
  this._initializeStudents();
  let i=0;for(const m of this.members.values()){m.role='student';m.doorUse=false;m.doorProgress=0;m.lastInput=Date.now();const actor=this.sim.students[m.studentId];this._prepareHuman(m,actor,i++);m.context=context(actor);this.sim._team.add(actor.id);}
  this.sequence++;return true;
 }
 travelFloor(member,map){
  const people=[...this.members.values()].map(m=>({player:m.context.player,connected:m.connected}));
  const error=departureError(this.elevator,people,{map,currentMap:this.map,stage:this.sim.stage,status:this.sim.status,host:member.id===this.hostId});
  if(error)throw new RoomError(member.id!==this.hostId?403:Layout.CAMPUS_MAPS.includes(map)?409:400,error);
  for(const m of this.members.values()){m.context._movement={x:0,z:0};m.context.holding=false;m.context.player.holding=false;m.context.player.crouched=false;m.context._rescueId=null;m.context._rescueProgress=0;m.doorUse=false;m.doorProgress=0;}
  departElevator(this.elevator,map,this.map);Layout.updateLayoutDoors(this.sim.layout,{elevatorClosed:true});this.events.push({type:'elevator-start',map,networkSequence:++this.sequence});return true;
 }
 rematch(member){
  if(member.id!==this.hostId)throw new RoomError(403,'等待房主开始下一局');
  if(this.sim.status==='playing')throw new RoomError(409,'本局尚未结束');
  this.elevator=createElevator();
  return this._rebuild(this.map,(this.seed+1)>>>0);
 }
 configureRound(member,settings){
  if(member.id!==this.hostId)throw new RoomError(403,'只有房主可以修改设置');
  if(!validRoundSettings(settings))throw new RoomError(400,'时长须为5–20分钟，捣蛋目标须为30–120');
  if(this.sim.stage!=='gathering')throw new RoomError(409,'开局后不能修改设置');
  if(!this.sim.configureRound(settings))return false;this.settings={...settings};this.sequence++;return true;
 }
 command(member,command,args=[],inputSeq=0){
  member.lastInput=Date.now();member.lastSeen=Date.now();
  // Focus/pause cleanup is intentionally role-agnostic in the controller.
  if(command==='setComputerPlayback'&&member.role==='teacher')return false;
  if(command==='setWriting'&&args[0]===false&&member.role!=='teacher')return false;
  if(command==='setRescue'&&args[0]===null&&member.role==='teacher')return false;
  // Walking/look remain live in the cabin; seating and outside interactions
  // wait for arrival. Repeated floor commands still pass through validation.
  if(this.elevator.phase==='travel'&&!['setMovement','setLook','travelFloor'].includes(command))return false;
  if(command==='startBell')return this.begin(member,args[0]);
  if(command==='rematch')return this.rematch(member);
  if(command==='configureRound')return this.configureRound(member,args[0]);
  if(command==='setDoorUse'){
   const id=args[2]??'rear',key=id==='office'?'officeDoorClosed':id+'DoorClosed';
   if(typeof args[0]!=='boolean'||args[1]!==undefined&&typeof args[1]!=='boolean'||!['rear','front','office'].includes(id))throw new RoomError(400,'无效交互');
   const desired=args[1]??!this.sim.layout[key];
   if(!args[0]){member.doorUse=false;member.doorProgress=0;return true;}
   if(id==='office'&&this.sim.layout.officeLocked||this.sim.layout[key]===desired||!reachesSchoolDoor(member.context.player,this.sim.layout,id))return false;
   if(!member.doorUse||member.doorTarget!==desired||member.doorId!==id)member.doorProgress=0;
   member.doorUse=true;member.doorId=id;member.doorTarget=desired;return true;
  }
  if(command==='travelFloor')return this.travelFloor(member,args[0]);
  if(command==='setPreference'){this.preference(member,args[0]);return true;}
  const allowed=member.role==='teacher'?teacherCommands:studentCommands;if(!allowed.has(command))throw new RoomError(400,'不支持的操作');
  if(!Array.isArray(args)||args.length>3)throw new RoomError(400,'操作参数错误');
  if(command==='setComputerPlayback'&&!validComputerPlayback(args[0]))throw new RoomError(400,'无效播放状态');
  if(['setMovement','setLook'].includes(command)&&!args.slice(0,2).every(finite))throw new RoomError(400,'无效坐标');
  if(command==='setMovement'&&args.some(n=>Math.abs(n)>1.001))throw new RoomError(400,'无效移动');
  if(['hold','setCrouch','setWriting','setDrawerOpen','setBookRaised','setOfficeDrawerOpen'].includes(command)&&typeof args[0]!=='boolean')throw new RoomError(400,'无效状态');
  if(['takeSlot','selectSlot'].includes(command)&&(!Number.isInteger(args[0])||args[0]<0||args[0]>3||!member.context.player._slots[args[0]]))throw new RoomError(400,'无效物品位置');
  // The teacher is not in the student array while a pupil's context is active.
  // Check the selected physical chair across every role before any implicit sit.
  let officeChairId=null;
  if(command==='sitOfficeChair'||command==='interact'&&Layout.OFFICE_CHAIRS.some(c=>c.id===args[0]))officeChairId=args[0]||Layout.OFFICE_CHAIR.id;
  if(command==='openOfficeDrawer'||command==='setOfficeDrawerOpen'&&args[0]){
   const deskId=(command==='openOfficeDrawer'?args[0]:args[1])||member.context.player._officeDeskId||Layout.OFFICE_DESK.id;
   officeChairId=Layout.OFFICE_CHAIRS.find(c=>c.deskId===deskId)?.id;
  }
  if(officeChairId&&[this.teacherActor,...this.sim.students].some(p=>p!==member.context.player&&p.seated&&p._officeChair&&p._officeChairId===officeChairId))return false;
  return this.withMember(member,sim=>{
   const prototype=member.role==='teacher'?TeacherRound.prototype:ClassroomRound.prototype,method=prototype[command];
   if(typeof method!=='function')return false;
   const result=method.apply(sim,args);if(result&&Number.isSafeInteger(inputSeq)&&inputSeq>0){if(command==='setLook')member.lookSequence=Math.max(member.lookSequence||0,inputSeq);if(command==='setMovement')member.moveSequence=Math.max(member.moveSequence||0,inputSeq);}return result;
  });
 }
 tick(dt){
  if(this.elevator.phase==='travel'){
   if(!Number.isFinite(dt)||dt<=0)return;
   const step=Math.min(dt,this.elevator.remaining,30);
   for(const m of this.members.values()){if(!m.connected)continue;if(Date.now()-m.lastInput>500)m.context._movement={x:0,z:0};moveElevatorPassenger(m.context.player,m.context._movement,step,this.sim.layout);}
   this.sim._sessionElapsed+=step;
   const map=advanceElevator(this.elevator,step);
   if(map){
    const trip=this.elevator,poses=new Map([...this.members.values()].map(m=>{const p=m.context.player;return[m.id,{x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch}];}));
    this._rebuild(map);this.elevator=trip;
    for(const m of this.members.values())Object.assign(m.context.player,poses.get(m.id));
    Layout.updateLayoutDoors(this.sim.layout,{elevatorClosed:false});this.events.push({type:'elevator-arrived',map,networkSequence:++this.sequence});
   }
   this.sequence++;return;
  }
  // The teacher is always the main simulation context. Student controls and
  // shared item progression are advanced alongside it, exactly once per tick.
  const ctx=this.teacherMember?.context||this.teacherContext;for(const key of CONTEXT)this.sim[key]=ctx[key];
  if(this.teacherMember&&Date.now()-this.teacherMember.lastInput>500)this.sim._movement={x:0,z:0};
  this.sim.step(dt);for(const key of CONTEXT)ctx[key]=this.sim[key];
  for(const member of this.members.values()){
   if(!member.doorUse)continue;const p=member.context.player,id=member.doorId||'rear',key=id==='office'?'officeDoorClosed':id+'DoorClosed';
   if(!member.connected||this.sim.layout[key]===member.doorTarget||id==='office'&&this.sim.layout.officeLocked||!reachesSchoolDoor(p,this.sim.layout,id)||this.sim._restrained(p)||p.seated){member.doorUse=false;member.doorProgress=0;continue;}
   member.doorProgress=(member.doorProgress||0)+dt/3;if(member.doorProgress>=1){ClassroomRound.prototype.setSchoolDoor.call(this.sim,id,member.doorTarget);member.doorUse=false;member.doorProgress=0;}
  }
  const incoming=this.sim.drainEvents();for(const event of incoming)this.events.push({...event,networkSequence:++this.sequence});
  if(this.events.length>100)this.events.splice(0,this.events.length-100);this.sequence++;
 }
 publicRoom(self){return {settings:{...this.settings},code:this.code,hostId:this.hostId,selfId:self.id,stage:this.sim.stage,seed:this.seed,floor:this.floor,map:this.map,maxPlayers:this.maxPlayers,members:[...this.members.values()].map(m=>({id:m.id,name:m.name,character:m.character,rolePreference:m.rolePreference,role:m.role,connected:m.connected,...(self.role==='teacher'&&m.id!==self.id?{}:{studentId:m.role==='teacher'?-1:m.studentId})}))};}
 snapshot(member){
  const state=this.withMember(member,sim=>TeacherRound.prototype.snapshot.call(sim));
  state.doorUse={holding:Boolean(member.doorUse),id:member.doorId||'rear',progress:member.doorProgress||0};state.interaction={kind:member.doorUse?'rear-door':null,doorId:member.doorId||'rear',progress:member.doorProgress||0};
  state.teamSize=this.sim._team.size;state.network=true;state.floor=this.floor;state.layoutSeed=this.seed;state.room=this.publicRoom(member);
  state.elevator=elevatorSnapshot(this.elevator,[...this.members.values()].map(m=>({player:m.context.player,connected:m.connected})),{stage:state.stage,status:state.status,host:member.id===this.hostId});
  state.lobbyRole=state.stage==='gathering'?member.rolePreference:null;
  state.inputAck={look:member.lookSequence||0,move:member.moveSequence||0,movement:{...member.context._movement}};state.player.name=member.name;state.player.character=member.character;
  const selfId=member.role==='teacher'?-1:member.studentId;
  state.students=state.students.map(p=>{const actor=this.sim.students[p.id],carrying=actor._drawnSlot!=null&&!this.sim._restrained(actor),heldAction=carrying?actor._slots[actor._drawnSlot]?.action||actor.action:null;return{...p,previewRole:state.stage==='gathering'?[...this.members.values()].find(m=>m.studentId===p.id)?.rolePreference:null,carrying,heldAction,drawerOpen:Boolean(actor._drawerOpen&&!actor._usingOfficeStock),penTaken:Boolean(actor._penTaken),isPlayer:p.id===selfId,isTeammate:this.sim._team.has(p.id)&&p.id!==selfId,networkHuman:Boolean(actor.networkHuman),character:actor.character||actor.variant};});
  state.teacher.networkHuman=Boolean(this.teacherMember);state.teacher.name=this.teacherMember?.name||'老师';
  state.teacher.seated=Boolean(this.teacherActor.seated);state.teacher.officeChair=Boolean(this.teacherActor._officeChair);state.teacher.officeDeskId=this.teacherActor._officeDeskId||null;
  for(const drawer of state.officeDrawers||[])if(this.teacherActor._officeDeskId===drawer.id&&this.teacherActor.seated&&this.teacherActor._drawerOpen)drawer.open=true;
  state.officeDeskOpen=state.officeDeskOpen||Boolean(this.teacherActor._usingOfficeStock&&this.teacherActor._drawerOpen);
  state.startBellAvailable=this.elevator.phase!=='travel'&&member.id===this.hostId&&state.stage==='gathering'&&state.room.members.filter(m=>m.connected).length>=2;
  // Do not leak hidden mischievous identities, private drawers or AI evidence
  // to the teacher. Visible props/behaviour remain available for observation.
  for(const p of state.students)if(p.id!==selfId){delete p.drawer;if(!p.carrying&&!p.holding){p.action=null;p.progress=0;}}
  if(member.role==='teacher'){state.leaderboard=state.leaderboard.map(({name,points,caught},i)=>({id:'rank-'+i,name,points,caught,isSelf:false}));for(const p of state.students){p.isTeammate=false;p.name='同学';delete p.networkHuman;delete p.completed;delete p.personality;}state.teacher.memory=[];state.teacher.observedIds=[];}
  state.events=this.events.filter(e=>(e.recipientId==null||e.recipientId===selfId)&&(e.networkSequence||0)>member.lastSequence&&(member.role!=='teacher'||!scoringEvents.has(e.type))&&(member.role==='teacher'||!teacherFeedbackEvents.has(e.type))).map(e=>({...e,...(e.actor!==undefined?{actor:e.studentId===selfId?'player':e.actor==='player'?'peer':e.actor}:{})}));
  member.lastSequence=this.sequence;state.sequence=this.sequence;return state;
 }
 disconnect(member){this.withMember(member,sim=>{ClassroomRound.prototype.hold.call(sim,false);ClassroomRound.prototype.setComputerPlayback.call(sim,{playing:false,visible:false,mediaTime:0});ClassroomRound.prototype.setRescue.call(sim,null);});member.connected=false;member.context._movement={x:0,z:0};member.context.holding=false;member.context.player.holding=false;member.lastSeen=Date.now();}
 reconnect(member){member.connected=true;member.lastSeen=Date.now();}
 leave(member){
  if(!this.members.has(member.id))return;this.disconnect(member);this.members.delete(member.id);
  if(member.role==='student'){
   this.sim._team.delete(member.studentId);const actor=this.sim.students[member.studentId];
   if(this.sim.stage==='gathering')this._restoreDecoy(actor);
   else{this.sim._stopActor(actor);actor.networkHuman=true;actor._networkDeparted=true;actor.isTeammate=false;actor._slots=[];actor._returnRoute=null;
    // Preserve body/captivity through the class, but not an unreachable win
    // target after the member's reconnect lease or an explicit departure.
    this.sim._pendingAllCaught=[...this.sim._team].every(id=>this.sim.students[id].captivity==='bound');
    if(!this.sim._team.size&&this.sim.stage==='seating')this.sim._finish('lost','all-caught');
   }
  }
  if(this.hostId===member.id)this.hostId=this.members.keys().next().value||null;
  if(member===this.teacherMember&&this.sim.stage!=='gathering')this.sim._finish('won','teacher-left');this.sequence++;
 }
}
export class RoomError extends Error{constructor(status,message){super(message);this.status=status;}}

// Base helpers call other public helpers through this; dispatch those too so
// a student's hold/take flow does not hit TeacherRound's intentional no-ops.
for(const name of ['hold','releaseUse','toggleDrawer','toggleBook','setDrawerOpen','setBookRaised','setOfficeDrawerOpen','takeSlot','returnItem','interact','startComputer','stopComputer']){
 SharedRound.prototype[name]=function(...args){const proto=this.player?.id===-1?TeacherRound.prototype:ClassroomRound.prototype;return proto[name]?.apply(this,args);};
}
