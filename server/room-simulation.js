import {randomUUID,randomBytes} from 'node:crypto';
import {ClassroomRound,DEVELOPMENT_TUNING,CLASSROOM_ACTIONS} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import * as Layout from '../dist/classroom-layout.js';
import {createElevator,elevatorSnapshot,departureError,departElevator,advanceElevator} from '../dist/elevator-session.js';

const finite=n=>typeof n==='number'&&Number.isFinite(n);
const variants=new Set(['boy','girl','glasses','ponytail']);
const cleanName=value=>String(value||'同学').replace(/[\u0000-\u001f<>]/g,'').slice(0,16)||'同学';
const CONTEXT=['player','selected','holding','_movement','_rescueId','_rescueProgress','completed'];
const studentCommands=new Set(['setMovement','setLook','setCrouch','hold','releaseUse','toggleDrawer','toggleBook','takeSlot','returnItem','interact','startComputer','stopComputer','computerApp','snakeDirection','takePen','openOfficeDrawer','sitOfficeChair','burp','setRescue','selectSlot','selectAction','interactDoor','setInteraction']);
const teacherCommands=new Set(['setMovement','setLook','setCrouch','hold','releaseUse','throwChalk','grabStudent','bindStudent','dropStudent','releaseBoundStudent','setWriting','interact','openOfficeDrawer','sitOfficeChair','interactDoor','setInteraction']);
const scoringEvents=new Set(['complete','gum-score','bubble-score','snake-food']);
const teacherFeedbackEvents=new Set(['wrong-grab','correct-capture','stamina-low']);
function context(actor){return{player:actor,selected:actor.id===-1?'chalk':actor.action||actor._slots?.[0]?.action||'snack',holding:false,_movement:{x:0,z:0},_rescueId:null,_rescueProgress:0,completed:actor.completed||Object.fromEntries(Object.keys(CLASSROOM_ACTIONS).map(k=>[k,0]))};}

// Match the visible leaf, including its swung-out position. Looking at the
// empty doorway centre is not equivalent to aiming at the open door handle.
function reachesRearDoor(player,layout){
 const index=Layout.DOORS.findIndex(d=>d.id==='rear'),door=Layout.DOORS[index],leaf=layout.rearDoorClosed?{minX:7.20,maxX:7.40,minZ:door.minZ,maxZ:door.maxZ}:Layout.DOOR_LEAVES[index];
 let lo=0,hi=1;for(const [axis,direction]of [['X',Math.sin(player.yaw)*1.9],['Z',Math.cos(player.yaw)*1.9]]){const origin=player[axis.toLowerCase()],min=leaf['min'+axis]-.10,max=leaf['max'+axis]+.10;if(Math.abs(direction)<1e-8){if(origin<min||origin>max)return false;continue;}let a=(min-origin)/direction,b=(max-origin)/direction;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return false;}return hi>=0&&lo<=1;
}

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
    const speed=p.crouched?DEVELOPMENT_TUNING.crouchSpeed:DEVELOPMENT_TUNING.walkSpeed;
    const next=Layout.moveInRoom(p,this._movement.x*speed*dt,this._movement.z*speed*dt,.18,this.layout);
    p.x=next.x;p.z=next.z;
   });
  }
 }
 _advancePreparation(dt){
  this._moveGuests(dt);super._advancePreparation(dt);
  // The selected teacher waits inside the office for the full countdown.
  if(this.stage==='seating'){Object.assign(this.player,Layout.TEACHER_SPAWN,{seated:false});Object.assign(this.teacher,{x:this.player.x,z:this.player.z,yaw:this.player.yaw,officeLocked:true});}
  else this.teacher.officeLocked=false;
 }
 _advance(dt){this.teacher.officeLocked=false;this._moveGuests(dt);super._advance(dt);}
 _advanceCaptivity(dt){
  super._advanceCaptivity(dt);
  // Global transport/stun runs once. Rescue progress belongs to each human.
  for(const member of this.room?.members.values()||[]){if(member.role==='teacher')continue;this.room.withMember(member,()=>{
   if(this._rescueId===null)return;
   const target=this.rescueTarget();if(target?.id!==this._rescueId){ClassroomRound.prototype.setRescue.call(this,null);return;}
   this._rescueProgress=Math.min(1,this._rescueProgress+dt/3);
   if(this._rescueProgress>=1){this._release(target,this.player);ClassroomRound.prototype.setRescue.call(this,null);}
  });}
 }
 _seatForClass(actor){if(actor.networkHuman)return;return super._seatForClass(actor);}
}

export class CampusRoom{
 constructor({code,seed=Date.now()>>>0,map='classroom',floor=1,maxPlayers=16}={}){
  this.code=code;this.seed=seed;this.map=Layout.CAMPUS_MAPS.includes(map)?map:'classroom';this.floor=Math.max(1,Math.min(8,Number(floor)||1));this.maxPlayers=maxPlayers;this.members=new Map();this.hostId=null;this.sequence=0;this.events=[];this.createdAt=Date.now();this.updatedAt=this.createdAt;
  this.elevator=createElevator();
  this.sim=new SharedRound({seed,map:this.map});this.sim.room=this;this.teacherActor=this.sim.player;this.teacherContext=context(this.teacherActor);this.sim.start({gathering:true});
  // Only connected humans are the hidden mischievous students. Remaining
  // classmates are visible decoys, not falsely advertised network players.
  this.sim._team=new Set();for(const actor of this.sim.students){actor.isPlayer=false;actor.isTeammate=false;actor._profile=null;actor._slots=[];}
 }
 withMember(member,fn){
  const sim=this.sim,prior=Object.fromEntries(CONTEXT.map(k=>[k,sim[k]]));
  const ctx=member.context;for(const key of CONTEXT)sim[key]=ctx[key];
  try{return fn(sim);}finally{for(const key of CONTEXT)ctx[key]=sim[key];for(const key of CONTEXT)sim[key]=prior[key];}
 }
 join({name,character='boy',rolePreference='student'}={}){
  if(this.elevator.phase==='travel')throw new RoomError(409,'电梯正在运行，请稍后加入');
  if(this.sim.stage!=='gathering'||this.sim.status!=='playing')throw new RoomError(409,'本局已开始，请等下一局');
  if(this.members.size>=this.maxPlayers)throw new RoomError(409,'房间已满');
  const used=new Set([...this.members.values()].map(m=>m.studentId)),actor=this.sim.students.find(s=>!used.has(s.id));
  if(!actor)throw new RoomError(409,'没有空位');
  const id=randomUUID(),member={id,token:randomBytes(24).toString('base64url'),name:cleanName(name),character:variants.has(character)?character:'boy',rolePreference:rolePreference==='teacher'?'teacher':'student',role:'student',studentId:actor.id,connected:true,lastInput:Date.now(),lastSeen:Date.now(),lastSequence:0};
  this._prepareHuman(member,actor);member.context=context(actor);this.members.set(id,member);if(!this.hostId)this.hostId=id;this.sim._team.add(actor.id);this.updatedAt=Date.now();this.sequence++;return member;
 }
 _prepareHuman(member,actor,i=this.members.size){Object.assign(actor,{visible:true,networkHuman:true,isPlayer:false,isTeammate:false,name:member.name,character:member.character,variant:member.character,_profile:null,_decisionAt:Infinity,_speed:1,seated:false,seatId:null,x:Layout.CORRIDOR.minX+.60+(i%3)*.65,z:Layout.CORRIDOR.minZ+1.2+Math.floor(i/3)*.85,yaw:0,pitch:0,caught:false,captivity:'free',holding:false,_drawnSlot:null,_drawerOpen:false});
  actor._slots=Array.from({length:Layout.mapKind(this.map)==='computer'?1:3},(_,id)=>({id,action:this.sim._drawItem(),readyAt:0,progress:0}));actor._selectedSlot=0;actor.action=actor._slots[0].action;
 }
 findToken(token){return [...this.members.values()].find(m=>m.token===token)||null;}
 preference(member,{rolePreference,character}={}){if(this.sim.stage!=='gathering')throw new RoomError(409,'开始后不能换身份');if(rolePreference!==undefined)member.rolePreference=rolePreference==='teacher'?'teacher':'student';if(variants.has(character)){member.character=character;member.context.player.character=character;member.context.player.variant=character;}this.sequence++;}
 begin(member){
  if(this.elevator.phase==='travel')throw new RoomError(409,'请等电梯到达');
  if(member.id!==this.hostId)throw new RoomError(403,'只有房主可以开始');
  if(this.sim.stage!=='gathering')return false;
  const people=[...this.members.values()].filter(m=>m.connected);if(people.length<2)throw new RoomError(409,'至少需要两位玩家');
  const candidates=people.filter(m=>m.rolePreference==='teacher'),pool=candidates.length?candidates:people,chosen=pool[Math.floor(this.sim._random()*pool.length)];
  this.sim._team.clear();
  for(const p of people){
   p.role=p===chosen?'teacher':'student';
   if(p===chosen){const decoy=this.sim.students[p.studentId];decoy.networkHuman=false;decoy.isPlayer=false;decoy.isTeammate=false;decoy._slots=[];decoy.holding=false;decoy._decisionAt=Infinity;Object.assign(decoy,{x:Layout.LIFT.x,z:Layout.LIFT.z,visible:false,seated:false,seatId:null});p.context=this.teacherContext;Object.assign(this.teacherActor,Layout.TEACHER_SPAWN,{seated:false,crouched:false});}
   else this.sim._team.add(p.studentId);
  }
  this.teacherMember=chosen;
  for(const key of CONTEXT)this.sim[key]=chosen.context[key];
  const started=ClassroomRound.prototype.startBell.call(this.sim);
  // Human students choose their own chairs and never follow AI arrival routes.
  for(const p of people)if(p.role==='student'){this.sim._seatingRoutes.delete(p.studentId);this.sim._seatingStarts.delete(p.studentId);}
  this.events.push({type:'roles-assigned',teacherId:chosen.id,networkSequence:++this.sequence});this.sequence++;return started;
 }
 _rebuild(map,seed=this.seed){
  this.map=map;this.seed=seed>>>0;this.floor=Layout.CAMPUS_MAPS.indexOf(map)+1;
  this.sim=new SharedRound({seed:this.seed,map});this.sim.room=this;this.teacherActor=this.sim.player;this.teacherContext=context(this.teacherActor);this.teacherMember=null;this.sim.start({gathering:true});this.sim._team=new Set();this.events=[];
  for(const actor of this.sim.students){actor.isPlayer=false;actor.isTeammate=false;actor._profile=null;actor._slots=[];}
  let i=0;for(const m of this.members.values()){m.role='student';m.doorUse=false;m.doorProgress=0;m.lastInput=Date.now();const actor=this.sim.students[m.studentId];this._prepareHuman(m,actor,i++);m.context=context(actor);this.sim._team.add(actor.id);}
  this.sequence++;return true;
 }
 travelFloor(member,map){
  const people=[...this.members.values()].map(m=>({player:m.context.player,connected:m.connected}));
  const error=departureError(this.elevator,people,{map,currentMap:this.map,stage:this.sim.stage,status:this.sim.status,host:member.id===this.hostId});
  if(error)throw new RoomError(member.id!==this.hostId?403:Layout.CAMPUS_MAPS.includes(map)?409:400,error);
  for(const m of this.members.values()){m.context._movement={x:0,z:0};m.context.holding=false;m.context.player.holding=false;m.context.player.crouched=false;m.context._rescueId=null;m.context._rescueProgress=0;m.doorUse=false;m.doorProgress=0;}
  departElevator(this.elevator,map);Layout.updateLayoutDoors(this.sim.layout,{elevatorClosed:true});this.events.push({type:'elevator-start',map,networkSequence:++this.sequence});return true;
 }
 rematch(member){
  if(member.id!==this.hostId)throw new RoomError(403,'等待房主开始下一局');
  if(this.sim.status==='playing')throw new RoomError(409,'本局尚未结束');
  this.elevator=createElevator();
  return this._rebuild(this.map,(this.seed+1)>>>0);
 }
 command(member,command,args=[],inputSeq=0){
  member.lastInput=Date.now();member.lastSeen=Date.now();
  // Focus/pause cleanup is intentionally role-agnostic in the controller.
  if(command==='setWriting'&&args[0]===false&&member.role!=='teacher')return false;
  if(command==='setRescue'&&args[0]===null&&member.role==='teacher')return false;
  // All transports, seating and interactions remain frozen while the cabin
  // travels. Look is harmless; a repeated old floor command is still checked.
  if(this.elevator.phase==='travel'&&!['setLook','travelFloor'].includes(command))return false;
  if(command==='startBell')return this.begin(member);
  if(command==='rematch')return this.rematch(member);
  if(command==='setDoorUse'){if(typeof args[0]!=='boolean')throw new RoomError(400,'无效交互');member.doorUse=args[0];if(!member.doorUse)member.doorProgress=0;return true;}
  if(command==='travelFloor')return this.travelFloor(member,args[0]);
  if(command==='setPreference'){this.preference(member,args[0]);return true;}
  const allowed=member.role==='teacher'?teacherCommands:studentCommands;if(!allowed.has(command))throw new RoomError(400,'不支持的操作');
  if(!Array.isArray(args)||args.length>3)throw new RoomError(400,'操作参数错误');
  if(['setMovement','setLook'].includes(command)&&!args.slice(0,2).every(finite))throw new RoomError(400,'无效坐标');
  if(command==='setMovement'&&args.some(n=>Math.abs(n)>1.001))throw new RoomError(400,'无效移动');
  if(['hold','setCrouch','setWriting'].includes(command)&&typeof args[0]!=='boolean')throw new RoomError(400,'无效状态');
  if(['takeSlot','selectSlot'].includes(command)&&(!Number.isInteger(args[0])||args[0]<0||args[0]>3||!member.context.player._slots[args[0]]))throw new RoomError(400,'无效物品位置');
  if(member.role==='teacher'&&this.sim.stage==='seating'&&['setMovement','hold','throwChalk'].includes(command))return false;
  const officeRequest=command==='sitOfficeChair'||command==='openOfficeDrawer'||command==='interact'&&args[0]==='office-chair'&&!member.context.player.seated;
  if(officeRequest&&[...this.members.values()].some(m=>m!==member&&m.context.player.seated&&m.context.player._officeChair))return false;
  return this.withMember(member,sim=>{
   const prototype=member.role==='teacher'?TeacherRound.prototype:ClassroomRound.prototype,method=prototype[command];
   if(typeof method!=='function')return false;
   const result=method.apply(sim,args);if(command==='setLook'&&result&&Number.isSafeInteger(inputSeq)&&inputSeq>0)member.lookSequence=Math.max(member.lookSequence||0,inputSeq);return result;
  });
 }
 tick(dt){
  if(this.elevator.phase==='travel'){
   const map=advanceElevator(this.elevator,dt);
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
   if(!member.doorUse)continue;const p=member.context.player;
   if(!member.connected||!reachesRearDoor(p,this.sim.layout)||this.sim._restrained(p)||p.seated){member.doorUse=false;member.doorProgress=0;continue;}
   member.doorProgress=(member.doorProgress||0)+dt/3;if(member.doorProgress>=1){ClassroomRound.prototype.setRearDoor.call(this.sim,!this.sim.layout.rearDoorClosed);member.doorUse=false;member.doorProgress=0;}
  }
  const incoming=this.sim.drainEvents();for(const event of incoming)this.events.push({...event,networkSequence:++this.sequence});
  if(this.events.length>100)this.events.splice(0,this.events.length-100);this.sequence++;
 }
 publicRoom(self){return {code:this.code,hostId:this.hostId,selfId:self.id,stage:this.sim.stage,seed:this.seed,floor:this.floor,map:this.map,maxPlayers:this.maxPlayers,members:[...this.members.values()].map(m=>({id:m.id,name:m.name,character:m.character,rolePreference:m.rolePreference,role:m.role,connected:m.connected,...(self.role==='teacher'&&m.id!==self.id?{}:{studentId:m.role==='teacher'?-1:m.studentId})}))};}
 snapshot(member){
  const state=this.withMember(member,sim=>TeacherRound.prototype.snapshot.call(sim));
  state.doorUse={holding:Boolean(member.doorUse),progress:member.doorProgress||0};state.interaction={kind:member.doorUse?'rear-door':null,progress:member.doorProgress||0};
  state.teamSize=Math.max(1,this.sim._team.size);state.network=true;state.floor=this.floor;state.layoutSeed=this.seed;state.room=this.publicRoom(member);
  state.elevator=elevatorSnapshot(this.elevator,[...this.members.values()].map(m=>({player:m.context.player,connected:m.connected})),{stage:state.stage,status:state.status,host:member.id===this.hostId});
  state.inputAck={look:member.lookSequence||0};state.player.name=member.name;state.player.character=member.character;
  const selfId=member.role==='teacher'?-1:member.studentId;
  state.students=state.students.map(p=>{const actor=this.sim.students[p.id],carrying=actor._drawnSlot!=null&&!this.sim._restrained(actor),heldAction=carrying?actor._slots[actor._drawnSlot]?.action||actor.action:null;return{...p,carrying,heldAction,drawerOpen:Boolean(actor._drawerOpen&&!actor._usingOfficeStock),penTaken:Boolean(actor._penTaken),isPlayer:p.id===selfId,isTeammate:this.sim._team.has(p.id)&&p.id!==selfId,networkHuman:[...this.members.values()].some(m=>m.role!=='teacher'&&m.studentId===p.id),character:actor.character||actor.variant};});
  state.teacher.networkHuman=Boolean(this.teacherMember);state.teacher.name=this.teacherMember?.name||'老师';
  state.teacher.seated=Boolean(this.teacherActor.seated);state.teacher.officeChair=Boolean(this.teacherActor._officeChair);
  state.officeDeskOpen=state.officeDeskOpen||Boolean(this.teacherActor._usingOfficeStock&&this.teacherActor._drawerOpen);
  state.startBellAvailable=this.elevator.phase!=='travel'&&member.id===this.hostId&&state.stage==='gathering'&&this.members.size>=2;
  // Do not leak hidden mischievous identities, private drawers or AI evidence
  // to the teacher. Visible props/behaviour remain available for observation.
  for(const p of state.students)if(p.id!==selfId){delete p.drawer;if(!p.carrying&&!p.holding){p.action=null;p.progress=0;}}
  if(member.role==='teacher'){for(const p of state.students){p.isTeammate=false;p.name='同学';delete p.networkHuman;delete p.completed;delete p.personality;}state.teacher.memory=[];state.teacher.observedIds=[];}
  state.events=this.events.filter(e=>(e.networkSequence||0)>member.lastSequence&&(member.role!=='teacher'||!scoringEvents.has(e.type))&&(member.role==='teacher'||!teacherFeedbackEvents.has(e.type))).map(e=>({...e,...(e.actor!==undefined?{actor:e.studentId===selfId?'player':e.actor==='player'?'peer':e.actor}:{})}));
  member.lastSequence=this.sequence;state.sequence=this.sequence;return state;
 }
 disconnect(member){member.connected=false;member.context._movement={x:0,z:0};member.context.holding=false;member.context.player.holding=false;member.lastSeen=Date.now();}
 reconnect(member){member.connected=true;member.lastSeen=Date.now();}
 leave(member){this.disconnect(member);this.members.delete(member.id);this.sim._team.delete(member.studentId);const actor=this.sim.students[member.studentId];if(actor){actor.networkHuman=false;actor.isTeammate=false;actor._slots=[];actor.holding=false;actor.mood='resting';}if(this.hostId===member.id)this.hostId=this.members.keys().next().value||null;if(member===this.teacherMember&&this.sim.stage!=='gathering')this.sim._finish('won','teacher-left');this.sequence++;}
}
export class RoomError extends Error{constructor(status,message){super(message);this.status=status;}}

// Base helpers call other public helpers through this; dispatch those too so
// a student's hold/take flow does not hit TeacherRound's intentional no-ops.
for(const name of ['hold','releaseUse','toggleDrawer','toggleBook','takeSlot','returnItem','interact','startComputer','stopComputer']){
 SharedRound.prototype[name]=function(...args){const proto=this.player?.id===-1?TeacherRound.prototype:ClassroomRound.prototype;return proto[name]?.apply(this,args);};
}
