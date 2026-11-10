import {syncDrawerCollisions} from './drawer-collision58.js?v=campus-59c';
import {ordinaryStudyState} from './npc-study58.js?v=campus-59c';
import {movementScale,spendTeacherMovement,NORMAL_WALK_SPEEDS,normalWalkSpeed} from './movement55.js?v=campus-59c';
import {reachesRearDoor,rearDoorSweepBlocked} from './door-interaction54.js?v=campus-59c';
import {ITEM50_TUNING,COMPUTER_DRAWER_FOODS,createSnake,turnSnake,stepSnake,snakeSnapshot} from './item-rules50.js?v=campus-59c';
import {validRoundSettings} from './round-settings55.js?v=campus-59c';
import {COMPUTER_APPS,COMPUTER_GAMES,nextComputerApp,canonicalComputerApp,reportComputerPlayback,resetComputerPlayback,advanceComputerPlayback} from './computer-rules55.js?v=campus-59c';
import {smokeEnvelope} from './smoke-physics.js?v=campus-59c';
import {CRAWL_TUNING} from './crawl-profile.js?v=campus-59c';
import {createThrowableProjectile,stepThrowableProjectile,flashExposure,inkExposure,PROJECTILE_EFFECT_TUNING} from './projectile-effects-rules.js?v=campus-59c';
import { ROOM, CORRIDOR, SEATS, createSeatLayout, createLayoutContext, updateLayoutDoors, mapKind, OFFICE_DESK, OFFICE_CHAIR, OFFICE_DESKS, OFFICE_CHAIRS, LIFT, START_BELL_POSITION, PLAYER_SEAT, FRIEND_SEATS, COVERED_SEATS, AISLES, BOARD, DETENTION, TEACHER_SPAWN, moveInRoom, walkRoute, blocked, chairExit, clearWallSegment, CAMPUS_MAPS, TEACHER_EYE_HEIGHT, enclosureVolumes, LECTERN, OFFICE_SOLIDS, floorTiles, floorHeight } from './classroom-layout.js?v=campus-59c';

/** 120 is the goal visible in the supplied video; remaining values are local prototype tuning. */
export const DEVELOPMENT_TUNING = Object.freeze({ target:120, fov:110, viewRange:9, evidenceRate:38, evidenceDecay:.45, chalkWindup:.7, smokeDuration:7, smokeRadius:1.9, walkSpeed:NORMAL_WALK_SPEEDS.student, teacherWalkSpeed:NORMAL_WALK_SPEEDS.teacher, crouchSpeed:CRAWL_TUNING.speed, teammateRestMin:3, teammateRestMax:7, drawerRefill:3 });
// Metres per second. Urgent rescue/chase and human movement have separate rules.
export const AI_WALK_SPEEDS=Object.freeze({student:NORMAL_WALK_SPEEDS.student,teacherPatrol:NORMAL_WALK_SPEEDS.teacher,teacherPursuit:NORMAL_WALK_SPEEDS.teacher,teacherEntry:NORMAL_WALK_SPEEDS.teacher,teacherEscort:NORMAL_WALK_SPEEDS.teacherCarrying});
export const RESCUE_DURATION=1.6;
// Bound pupils visibly hold to blow, then wait through a 10-second cooldown.
// The approximate fill/lifetime are local tuning. The video's score changes
// belong to another pupil, so this action awards no points without more evidence.
export const BUBBLE_TUNING=Object.freeze({duration:6,cycle:1.5,cooldown:10,pointsPerSecond:0,maxPoints:10,lifetime:6});
export const FOOD_ACTIONS=Object.freeze(['snack','drink','burger','banana','garlic','lunch']);
export const EATING_PITCH=Object.freeze({enter:.38,leave:.32});
export const START_BELL=START_BELL_POSITION;
export const CLASS_START_TIMING=Object.freeze({seating:30,classDuration:600,firstArrival:.15,arrivalSpacing:.36});
export const CLASSROOM_ACTIONS = Object.freeze({
  snack:Object.freeze({duration:3,points:1,risk:1,noise:.85,label:'偷吃零食'}),
  phone:Object.freeze({duration:3,points:3.5,risk:1.3,noise:.12,label:'玩手机'}),
  // Three-second use/refill follows the user's pacing; scoring/risk are local tuning.
  drink:Object.freeze({duration:3,points:1,risk:1,noise:.55,label:'喝饮料'}),
  burger:Object.freeze({duration:3,points:1,risk:1.1,noise:.75,label:'吃汉堡'}),
  computer:Object.freeze({duration:3,points:1,risk:1.15,noise:.35,label:'玩贪吃蛇'}),
  gum:Object.freeze({duration:6,points:0,risk:1.2,noise:.45,label:'吹泡泡糖'}),
  banana:Object.freeze({duration:3,points:1,risk:1,noise:.4,label:'吃香蕉'}),
  bananaPeel:Object.freeze({duration:1.2,releaseToUse:true,points:0,risk:1,noise:.2,label:'香蕉皮'}),
  garlic:Object.freeze({duration:3,points:1,risk:1,noise:.6,label:'吃大蒜'}),
  lunch:Object.freeze({duration:3,points:3,risk:1.3,noise:.7,label:'吃便当'}),
  pen:Object.freeze({duration:3,points:0,risk:0,noise:0,label:'写字'}),
  smoke:Object.freeze({duration:1.2,releaseToUse:true,points:0,risk:1,noise:.2,label:'烟雾弹'}),
  // Throw controls and timings reconstruct the observed effects; they are not measured source values.
  flash:Object.freeze({duration:1.2,releaseToUse:true,points:0,risk:1,noise:.2,label:'闪光弹'}),
  ink:Object.freeze({duration:1.2,releaseToUse:true,points:0,risk:1,noise:.2,label:'墨水瓶'}),
});
const STEP=1/60, EPS=1e-9, TAU=Math.PI*2, ACTION_KEYS=['snack','phone','smoke','drink','burger','flash','ink','gum','banana','garlic'];
const emptyActionCounts=()=>Object.fromEntries(Object.keys(CLASSROOM_ACTIONS).map(key=>[key,0]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const clean=n=>Math.round(n*1e6)/1e6;
const angle=n=>Math.atan2(Math.sin(n),Math.cos(n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const heading=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
const valid=n=>typeof n==='number'&&Number.isFinite(n);
function seedNumber(value){if(valid(value))return value>>>0;let h=2166136261;for(const c of String(value??73))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function segmentDistance(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/l,0,1):0;return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);}
/** Geometry only: +Z is yaw 0. Smoke blocks the actual observer-to-target segment. */
export function canSee(observer,target,smokes=[],layout=null){
  if(distance(observer,target)>(observer.viewRange??DEVELOPMENT_TUNING.viewRange))return false;
  if(Math.abs(angle(heading(observer,target)-observer.yaw))>(observer.fov??DEVELOPMENT_TUNING.fov)*Math.PI/360)return false;
  return clearWallSegment(observer,target,layout)&&!smokes.some(s=>s.remaining>0&&(s.density??1)>.3&&segmentDistance(s,observer,target)<s.radius);
}
/** Upright desk books reduce distant frontal prop visibility, not all visibility. */
export function propVisibility(observer,target,smokes=[],layout=null){
  if(!canSee(observer,target,smokes,layout))return 0;
  const d=distance(observer,target);
  if(!target.seated)return target.crouched?.72:1;
  const front=Math.cos(heading(target,observer)-(target.seatYaw||0)); // Desks/books face +Z, independently of head look.
  const book=front>.52&&d>2.35?.22:front>.2&&d>2.35?.55:1;
  const cover=target.bookCover??(target.bookRaised===false?0:1);
  return (1-(1-book)*cover)*(target.crouched&&d>2.1?.45:1);
}

// Segment tests share real desk/book/monitor positions with the renderer.
// Chalk speed, cooldown and stagger are local tuning, not measured original values.
export function segmentBox(a,b,box){
  let lo=0,hi=1;
  for(const axis of ['x','y','z']){
    const d=b[axis]-a[axis],min=box['min'+axis.toUpperCase()],max=box['max'+axis.toUpperCase()];
    if(Math.abs(d)<1e-9){if(a[axis]<min||a[axis]>max)return null;continue;}
    const u=(min-a[axis])/d,v=(max-a[axis])/d;
    lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));if(lo>hi)return null;
  }
  return lo;
}
export function chalkHit(a,b,students,books,map,layout=null){
  let nearest=null;
  const test=(box,kind,id)=>{const t=segmentBox(a,b,box);if(t!==null&&(!nearest||t<nearest.t))nearest={t,kind,id};};
  for(const [id,wall] of enclosureVolumes(map,layout).entries())test(wall,'wall',id);
  for(const solid of OFFICE_SOLIDS)test(solid,'wall',-1);
  for(const tile of floorTiles(map))test({...tile,minY:0,maxY:tile.height},'wall',-1);
  test({...LECTERN,minY:.16,maxY:1.15},'desk',-1);
  for(const s of layout?.seats||SEATS){
    const base=floorHeight(s.x,s.z,map),halfWidth=mapKind(map)==='computer'?.61:.60;
    test({minX:s.deskX-halfWidth,maxX:s.deskX+halfWidth,minY:base+.58,maxY:base+.875,minZ:s.deskZ-.425,maxZ:s.deskZ+.425},'desk',s.id);
    if(mapKind(map)==='computer'){const z=s.deskZ+Math.cos(s.yaw||0)*.17;test({minX:s.deskX-.33,maxX:s.deskX+.33,minY:base+1.02,maxY:base+1.42,minZ:z-.048,maxZ:z+.048},'desk',s.id);}
    else if((books[s.id]?.amount??0)>.5)test({minX:s.deskX-.34,maxX:s.deskX+.34,minY:base+.88,maxY:base+1.35,minZ:s.deskZ-Math.cos(s.yaw||0)*.28-.02,maxZ:s.deskZ-Math.cos(s.yaw||0)*.28+.02},'desk',s.id);
  }
  for(const s of students){
    if(s.visible===false||s.caught||s.captivity==='carried')continue;
    const base=floorHeight(s.x,s.z,map);
    const crawling=s.crouched&&!s.seated;
    test({minX:s.x-.24,maxX:s.x+.24,minY:base+(crawling?CRAWL_TUNING.bodyMinY:s.seated?.82:.65),maxY:base+(crawling?CRAWL_TUNING.bodyMaxY:s.seated?1.64:1.88),minZ:s.z-.23,maxZ:s.z+.23},'student',s.id);
  }
  return nearest;
}

export class ClassroomRound{
  constructor({seed=73,duration=600,target=DEVELOPMENT_TUNING.target,map='classroom'}={}){
    this.map=CAMPUS_MAPS.includes(map)?map:'classroom';
    this.seed=seedNumber(seed);this._defaultDuration=valid(duration)&&duration>0?Math.min(duration,3600):Infinity;this.duration=this._defaultDuration;
    this.target=valid(target)&&target>0?Math.min(target,100000):DEVELOPMENT_TUNING.target;this.reset();
  }
  reset(seed){
    if(seed!==undefined)this.seed=seedNumber(seed);this._rng=this.seed;this._drawerRng=(this.seed^0xA341316C)>>>0;this.seats=createSeatLayout(this.seed,null,this.map);this.layout=createLayoutContext(this.seats);this.officeSlotsByDesk=new Map(OFFICE_DESKS.map(d=>[d.id,[{id:0,action:'lunch',readyAt:0,progress:0}]]));this.officeSlots=this.officeSlotsByDesk.get(OFFICE_DESK.id);
    this.status='ready';this.paused=false;this.elapsed=0;this.duration=this._defaultDuration;this.stage='class';this._stageElapsed=0;this._sessionElapsed=0;this._preparationLeft=0;this._seatingRoutes=new Map();this._seatingStarts=new Map();this._teacherEntryRoute=null;this._teacherEntryLength=0;this.score=0;this.strikes=0;this.wrongGrabs=0;this.resultReason=null;
    this.selected='snack';this.holding=false;this.completed=emptyActionCounts();this._doorUse=false;this._doorProgress=0;this._doorTarget=false;
    this.smokes=[];this.projectiles=[];this.chalks=[];this.bubbles=[];this.peels=[];this.burps=[];this._novelId=0;this._bubbleId=0;this._pendingAllCaught=false;this._chalkId=0;this._nextCastAt=0;this._events=[];this._accumulator=0;this._movement={x:0,z:0};this._lastObservation=-Infinity;this._smokeId=0;
    this._team=new Set([PLAYER_SEAT,...FRIEND_SEATS].filter(id=>id<this.seats.length));
    this.books=this.seats.map(s=>({id:s.id,raised:COVERED_SEATS.includes(s.id),amount:COVERED_SEATS.includes(s.id)?1:0}));
    const personalities=['cautious','bold','helpful','distractible'];
    const profiles=[{caution:.96,helpful:.65,distraction:.10},{caution:.28,helpful:.35,distraction:.18},{caution:.68,helpful:.98,distraction:.12},{caution:.48,helpful:.55,distraction:.75}];
    this.students=this.seats.map(seat=>{
      const friend=FRIEND_SEATS.indexOf(seat.id), profile=friend>=0?profiles[friend]:null;
      return {id:seat.id,seatId:seat.id,x:seat.x,z:seat.z,yaw:seat.yaw,seatYaw:seat.yaw,pitch:0,seated:true,crouched:false,caught:false,captivity:'free',postId:null,_chalkUntil:0,_struggleAt:-100,isPlayer:seat.id===PLAYER_SEAT,isTeammate:friend>=0,
        name:seat.id===PLAYER_SEAT?'你':friend>=0?['小满','阿杰','小雨','乐乐'][friend]:`${seat.row+1}排同学${seat.col+1}`,
        mood:mapKind(this.map)==='computer'?'computer-idle':'listening',action:null,holding:false,progress:0,_earnedPoints:0,personality:friend>=0?personalities[friend]:'ordinary',completed:emptyActionCounts(),_computerActive:false,_computerApp:'desktop',_snake:null,_computerProgress:0,_burpUntil:0,_bubbleElapsed:0,_bubbleAwarded:0,_bubbleHolding:false,_bubbleCooldownUntil:0,_bubbleNextAt:Infinity,
        _profile:profile,_slots:this._team.has(seat.id)?Array.from({length:mapKind(this.map)==='computer'?1:3},(_,id)=>({id,action:this._drawItem(),readyAt:0,progress:0})):[],_selectedSlot:0,_drawerOpen:false,_drawnSlot:null,_noise:0,_decisionAt:this._range(.15,1.8),_idleAt:this._range(1,7),_speed:this._range(.65,.9),_preference:this._random(),_exposure:0,_restUntil:0};
    });
    this.classSlotsBySeat=new Map(this.students.filter(a=>a._slots.length).map(a=>[a.seatId,a._slots]));this.penOwners=new Map();
    for(const a of this.students)a._stockSeatId=a.seatId;
    if(mapKind(this.map)==='computer')for(const b of this.books){b.raised=false;b.amount=0;}
    this.player=this.students[PLAYER_SEAT];this.selected=this.player._slots[0].action;this.player.action=this.selected;
    this.teacher={id:-1,stamina:100,captivity:'free',_chalkUntil:0,fov:mapKind(this.map)==='night'?49:DEVELOPMENT_TUNING.fov,viewRange:mapKind(this.map)==='night'?12:DEVELOPMENT_TUNING.viewRange,x:BOARD.x,z:BOARD.z,yaw:0,phase:'board',phaseTime:0,phaseDuration:1,intent:'write',targetId:null,looking:false,warning:false,attention:0,walkProgress:0,castProgress:0,carriedId:null};
    this._memory=new Map();this._plan={intent:'write',targetId:null,since:0,until:3,route:[],routeLength:0,arrivedAt:null,utility:0};
    this._turnLeft=0;this._thinkAt=0;this._lastScan=0;this._writingNeed=.8;this._cast=null;this._rescueId=null;this._rescueProgress=0;this._escortRoute=null;this._escortPost=null;
    return this.snapshot();
  }
  _canSee(observer,target,smokes=[]){return canSee(observer,target,smokes,this.layout);}
  _propVisibility(observer,target,smokes=[]){return propVisibility(observer,target,smokes,this.layout);}
  _blocked(x,z,r=.18){return blocked(x,z,r,this.layout);}
  _moveInRoom(pos,dx,dz,r=.18){return moveInRoom(pos,dx,dz,r,this.layout);}
  _walkRoute(a,b,r=.2){syncDrawerCollisions(this.layout,this.map,[...this.students,this.player]);return walkRoute(a,b,r,this.layout);}
  _clearWallSegment(a,b){return clearWallSegment(a,b,this.layout);}
  setRearDoor(closed){
    if(!this._inputAllowed()||this.layout.rearDoorClosed===Boolean(closed))return false;
    if(rearDoorSweepBlocked([...this.students,this.player,this.teacher])){this._events.push({type:'rear-door-blocked'});return false;}
    updateLayoutDoors(this.layout,{rearDoorClosed:Boolean(closed)});this._events.push({type:'rear-door',closed:Boolean(closed)});return true;
  }
  setDoorUse(value,closed=!this.layout.rearDoorClosed){
    if(typeof value!=='boolean'||typeof closed!=='boolean')return false;
    if(!value){this._doorUse=false;this._doorProgress=0;return true;}
    if(!this._inputAllowed()||this._restrained()||this.player.seated||this.layout.rearDoorClosed===closed||!reachesRearDoor(this.player,this.layout))return false;
    if(!this._doorUse||this._doorTarget!==closed)this._doorProgress=0;
    this._doorUse=true;this._doorTarget=closed;return true;
  }
  _advanceDoorUse(dt){
    if(!this._doorUse)return;
    if(this._restrained()||this.player.seated||!reachesRearDoor(this.player,this.layout)||this.layout.rearDoorClosed===this._doorTarget){this.setDoorUse(false);return;}
    this._doorProgress=Math.min(1,this._doorProgress+dt/3);
    if(this._doorProgress+EPS>=1){this.setRearDoor(this._doorTarget);this.setDoorUse(false);}
  }
  start(options={}){if(this.status==='ready'){this.status='playing';if(options?.gathering)this._enterGathering();else this._observe('round-start',null,'课堂开始，捣乱值由实际行动积累。');}return this.snapshot();}
  configureRound(settings){if(!validRoundSettings(settings)||this.stage!=='gathering'||this.status!=='playing'||this.elevator?.phase==='travel')return false;this._defaultDuration=this.duration=settings.duration;this.target=settings.target;return true;}
  returnToGathering(){if(this.status==='playing')return this.snapshot();this.reset();return this.start({gathering:true});}
  _inputAllowed(){return this.status==='playing'&&!this.paused;}
  _classInputAllowed(){return this._inputAllowed()&&this.stage==='class';}
  _enterGathering(){
    this.stage='gathering';this.duration=this._defaultDuration;this._stageElapsed=0;
    const p=this.player;Object.assign(p,{x:8.60,z:3.50,yaw:Math.atan2(START_BELL.x-8.60,START_BELL.z-3.50),pitch:0,seated:false,seatId:null,crouched:false,holding:false,_drawerOpen:false,_drawnSlot:null,visible:true});
    // Hidden queue positions avoid putting twenty-nine meshes inside one another.
    // On the bell, the longest journeys depart first at normal walking pace.
    for(const actor of this.students)if(!actor.isPlayer&&!actor.networkHuman)Object.assign(actor,{x:LIFT.x,z:LIFT.z,yaw:0,seated:false,seatId:null,holding:false,mood:'standing',_drawerOpen:false,_drawnSlot:null,visible:false});
    Object.assign(this.teacher,TEACHER_SPAWN,{phase:'watching',intent:'wait'});
    updateLayoutDoors(this.layout,{officeLocked:false,rearDoorClosed:false});
    this._events.push({type:'stage-changed',stage:this.stage});
  }
  canStartBell(){
    const p=this.player;
    return this._inputAllowed()&&this.stage==='gathering'&&distance(p,START_BELL)<1.65&&this._clearWallSegment(p,START_BELL)&&Math.abs(angle(heading(p,START_BELL)-p.yaw))<.75;
  }
  startBell(){
    if(!this.canStartBell())return false;
    this.stage='seating';this._stageElapsed=0;this._preparationLeft=CLASS_START_TIMING.seating;
    Object.assign(this.teacher,TEACHER_SPAWN,{phase:'watching',intent:'wait',looking:false});
    if(this.player.id===-1)Object.assign(this.player,TEACHER_SPAWN);
    updateLayoutDoors(this.layout,{officeLocked:true});this._movement={x:0,z:0};
    const arrivals=this.students.filter(actor=>!actor.isPlayer&&!actor.networkHuman&&!actor.seated);
    const scheduled=arrivals.map(actor=>{
      actor._targetSeatId=actor.id;
      const route=this._walkRoute(actor,this.seats[actor.id],.2);
      return {actor,route,length:route.reduce((n,p,i)=>n+distance(i?route[i-1]:actor,p),0)};
    }).sort((a,b)=>b.length-a.length||a.actor.id-b.actor.id);
    for(const [order,{actor,route}] of scheduled.entries()){
      this._seatingRoutes.set(actor.id,route);
      this._seatingStarts.set(actor.id,this._sessionElapsed+CLASS_START_TIMING.firstArrival+order*CLASS_START_TIMING.arrivalSpacing);
    }
    this._events.push({type:'teacher-office',locked:true});
    this._events.push({type:'school-bell',...START_BELL},{type:'stage-changed',stage:this.stage,duration:CLASS_START_TIMING.seating});return true;
  }
  _seatForClass(actor){const seat=this.seats[actor._targetSeatId??actor.id];Object.assign(actor,{x:seat.x,z:seat.z,yaw:seat.yaw,seatYaw:seat.yaw,pitch:0,seated:true,seatId:seat.id,crouched:false,holding:false,mood:mapKind(this.map)==='computer'?'computer-idle':'listening',visible:true});if(actor._slots.length)this._switchDeskStock(actor,false,seat.id);}
  _beginClass(){
    const autoSeatedPlayer=false;
    updateLayoutDoors(this.layout,{officeLocked:false});this._events.push({type:'teacher-office',locked:false});
    this.stage='class';this._stageElapsed=0;this._preparationLeft=0;this.elapsed=0;this._movement={x:0,z:0};this.chalks=[];this._nextThrow=0;this.teacher._movementFatigue=0;
    if(this.player.id!==-1){
      this._teacherEntryRoute=this._walkRoute(this.teacher,BOARD,.23);
      this._teacherEntryLength=this._teacherEntryRoute.reduce((n,p,i)=>n+distance(i?this._teacherEntryRoute[i-1]:this.teacher,p),0);
      Object.assign(this.teacher,{phase:'patrol',intent:'enter',phaseTime:0,phaseDuration:this._teacherEntryLength/AI_WALK_SPEEDS.teacherEntry,targetId:null,looking:false,warning:false,attention:0,walkProgress:0});
      this._cast=null;this._thinkAt=Infinity;
    }
    this._events.push({type:'stage-changed',stage:this.stage},{type:'class-started',duration:this.duration,autoSeatedPlayer});
  }
  _advancePreparation(dt){
    this._sessionElapsed+=dt;this._stageElapsed+=dt;this._advanceDoorUse(dt);
    if(!this.player.seated){const speed=this.player.crouched?DEVELOPMENT_TUNING.crouchSpeed:normalWalkSpeed(this.player),pos=this._moveInRoom(this.player,this._movement.x*speed*dt*movementScale(this.player,this._movement),this._movement.z*speed*dt*movementScale(this.player,this._movement));this.player.x=pos.x;this.player.z=pos.z;}
    if(this.player.id===-1)Object.assign(this.teacher,{x:this.player.x,z:this.player.z,yaw:this.player.yaw});
    // Preparation is free movement. Chalk can be practised in the office,
    // but no stamina debt or pupil stun may spill into the lesson.
    this._advanceChalk(dt);
    if(this.stage!=='seating')return;
    this._advanceArrivals(dt);
    this._preparationLeft=Math.max(0,this._preparationLeft-dt);if(this._preparationLeft<=EPS)this._beginClass();
  }
  _advanceArrivals(dt){
    for(const [id,route] of this._seatingRoutes){
      const actor=this.students[id];
      if(actor._returnRoute){this._seatingRoutes.delete(id);this._seatingStarts.delete(id);continue;}
      if(actor.networkHuman||actor.seated){this._seatingRoutes.delete(id);this._seatingStarts.delete(id);continue;}
      if(this._restrained(actor))continue;
      actor.holding=false;
      if(this._sessionElapsed+EPS<(this._seatingStarts.get(id)||0)){actor.mood='standing';continue;}
      if(actor.visible===false&&this.students.some(other=>other!==actor&&other.visible!==false&&!other.seated&&distance(actor,other)<.48))continue;
      actor.visible=true;actor.mood='walking';
      const target=actor._targetSeatId??id;
      if(this.students.some(other=>other!==actor&&other.seated&&other.seatId===target)){
        const reserved=new Set([...this._seatingRoutes.keys()].filter(k=>k!==id).map(k=>this.students[k]._targetSeatId??k));
        let best=null;
        for(const seat of this.seats){
          if(reserved.has(seat.id)||this.students.some(other=>other!==actor&&other.seated&&other.seatId===seat.id))continue;
          const replacement=this._walkRoute(actor,seat,.2);if(!replacement.length&&distance(actor,seat)>1e-8)continue;
          const length=replacement.reduce((n,p,i)=>n+distance(i?replacement[i-1]:actor,p),0);
          if(!best||length<best.length)best={seat,route:replacement,length};
        }
        if(!best)continue;actor._targetSeatId=best.seat.id;route.splice(0,route.length,...best.route);
      }
      if(!route.length&&distance(actor,this.seats[actor._targetSeatId??id])>1e-8){const replacement=this._walkRoute(actor,this.seats[actor._targetSeatId??id],.2);route.push(...replacement);if(!route.length)continue;}
      if(this._follow(actor,route,AI_WALK_SPEEDS.student,dt)){
        // Class-time movement can occupy a late pupil's reserved chair. Wait
        // rather than placing two people on the same seat.
        if(this.students.some(other=>other!==actor&&other.seated&&other.seatId===(actor._targetSeatId??id)))continue;
        this._seatForClass(actor);this._seatingRoutes.delete(id);this._seatingStarts.delete(id);
        this._events.push({type:'student-seated',studentId:id});
      }
    }
  }
  _restrained(actor=this.player){return actor.caught||['stunned','carried','bound'].includes(actor.captivity);}
  _penActive(actor=this.player){return this.status==='playing'&&this.stage==='class'&&!this.paused&&!actor._computerActive&&!this._restrained(actor)&&actor._drawnSlot!==null&&actor._slots[actor._drawnSlot]?.action==='pen';}
  _penWriting(actor=this.player){return this._penActive(actor)&&actor.seated&&!actor._officeChair&&actor._penMode==='writing';}
  _penTwirling(actor=this.player){return this._penActive(actor)&&!this._penWriting(actor);}
  togglePenMode(){
    const p=this.player;if(!p.seated||p._officeChair||!this._penActive(p))return false;
    p._penMode=p._penMode==='writing'?'twirling':'writing';p.mood=p._penMode==='writing'?'writing':'pen-twirling';this.holding=p.holding=false;return true;
  }
  setDrawerOpen(open){
    if(typeof open!=='boolean'||!this._classInputAllowed()||this._restrained()||!this.player.seated||this.player._drawerOpen===open)return false;
    // Opening/closing storage never takes or returns the held object.
    if(this.player._drawnSlot!==null)return false;
    this.player._drawerOpen=open;return true;
  }
  setBookRaised(raised){
    const p=this.player;if(typeof raised!=='boolean'||!this._classInputAllowed()||this._restrained(p)||!p.seated||p._drawnSlot!==null)return false;
    const book=this.books[p.seatId];if(!book||book.raised===raised)return false;book.raised=raised;return true;
  }
  toggleDrawer(){
    if(!this._classInputAllowed()||this._restrained()||!this.player.seated)return false;
    const p=this.player,source=p._heldSource;if(!p._drawerOpen&&source&&(source.office?!p._officeChair||p._officeDeskId!==source.deskId:p._officeChair||p.seatId!==source.seatId))return false;
    p._drawerOpen=!p._drawerOpen;return true;
  }
  toggleBook(){
    const p=this.player;if(!this._classInputAllowed()||this._restrained(p)||!p.seated)return false;
    if(!this.books[p.seatId])return false;this.books[p.seatId].raised=!this.books[p.seatId].raised;return true;
  }
  selectSlot(index){
    this._sanitizeActorItems(this.player);
    const p=this.player,slot=p._slots[index];
    if(!Number.isInteger(index)||!slot?.action||this.stage!=='class'||this.paused||this._restrained(p)||!p.seated||!['ready','playing'].includes(this.status))return false;
    if(p._drawnSlot!==null&&index!==p._drawnSlot||slot.heldBy!==undefined&&slot.heldBy!==p.id)return false;
    p._selectedSlot=index;this.selected=slot.action;p.action=slot.action;p.progress=slot.progress;return true;
  }
  selectAction(action){
    if(!Object.hasOwn(CLASSROOM_ACTIONS,action))return false;
    const p=this.player,current=p._slots[p._selectedSlot];
    return this.selectSlot(current?.action===action?p._selectedSlot:p._slots.findIndex(slot=>slot.action===action));
  }
  takeSlot(index){
    const p=this.player;
    if(!this._classInputAllowed()||this._restrained(p)||!p.seated||!p._drawerOpen||p._drawnSlot!==null)return false;
    this.stopComputer();
    const slot=p._slots[index];if(slot?.heldBy!==undefined&&slot.heldBy!==p.id)return false;
    if(!this.selectSlot(index))return false;
    slot.heldBy=p.id;this._claimItemSource(p);
    p._drawnSlot=index;this.hold(false);return true;
  }
  _claimItemSource(actor){
    actor._heldSource={office:Boolean(actor._usingOfficeStock),seatId:actor._usingOfficeStock?null:actor.seatId,deskId:actor._usingOfficeStock?actor._officeDeskId:null};
    if(!actor._usingOfficeStock&&Number.isInteger(actor.seatId)&&actor.seatId>=0){actor._stockSeatId=actor.seatId;this.classSlotsBySeat.set(actor.seatId,actor._slots);}
  }
  _canReturnItem(actor=this.player){
    if(actor._drawnSlot===null)return false;
    const source=actor._heldSource;
    if(!source)return actor.seated; // Compatibility for an already-held legacy state.
    const place=source.office?OFFICE_CHAIRS.find(c=>c.deskId===source.deskId||(source.deskId===OFFICE_DESK.id&&c.id===OFFICE_CHAIR.id)):this.seats[source.seatId];
    return Boolean(place&&distance(actor,place)<1.35&&this._clearWallSegment(actor,place));
  }
  _finishHeldItem(actor){
    if(!actor._heldSource)return;
    actor._heldSource=null;
    if(actor.seated)this._switchDeskStock(actor,Boolean(actor._officeChair),actor._officeChair?actor._officeDeskId:actor.seatId);
  }
  returnItem(){
    const p=this.player;
    if(!this._classInputAllowed()||this._restrained(p)||!this._canReturnItem(p))return false;
    this.hold(false);const slot=p._slots[p._drawnSlot];if(slot?.heldBy===p.id)delete slot.heldBy;
    if(slot?.action==='pen'){p._slots.splice(p._drawnSlot,1);this.penOwners.delete(p._penSeatId);p._penSeatId=null;p._penTaken=false;p._penMode=null;p._selectedSlot=0;this.selected=p.action=p._slots[0]?.action||'snack';}
    p._drawnSlot=null;this._finishHeldItem(p);p._drawerOpen=Boolean(p.seated&&slot?.action!=='pen');return true;
  }
  startComputer(){
    const p=this.player;if(!this._classInputAllowed()||mapKind(this.map)!=='computer'||p._officeChair||!p.seated||this._restrained(p)||p._drawnSlot!==null)return false;
    resetComputerPlayback(p);p._computerActive=true;p._computerApp='desktop';p._computerSelection=0;p.action='computer';p._drawerOpen=false;this.selected='computer';this.holding=p.holding=false;return true;
  }
  computerApp(app){app=canonicalComputerApp(app);const p=this.player;if(!this._classInputAllowed()||!p._computerActive||!['desktop',...COMPUTER_APPS].includes(app))return false;p._computerApp=app;resetComputerPlayback(p);if(app==='snake'&&(!p._snake||!p._snake.alive))p._snake=createSnake((this.seed+p.id)>>>0);return true;}
  setComputerPlayback(value){const p=this.player;return reportComputerPlayback(p,value,this.elapsed,this._classInputAllowed()&&mapKind(this.map)==='computer'&&p._computerActive&&p._computerApp==='valorant'&&p.seated&&!this._restrained(p)&&this._team.has(p.id));}
  computerSelect(direction){const p=this.player;if(!this._classInputAllowed()||!p._computerActive||p._computerApp!=='desktop'||!['up','down','left','right'].includes(direction))return false;p._computerSelection=nextComputerApp(p._computerSelection,direction);return true;}
  computerConfirm(){return this.player._computerApp==='desktop'?this.computerApp(COMPUTER_APPS[this.player._computerSelection||0]):false;}
  computerBack(){return this.player._computerActive&&this.player._computerApp!=='desktop'?this.computerApp('desktop'):this.stopComputer();}
  _computerSnapshot(actor){return{active:!!actor._computerActive,app:canonicalComputerApp(actor._computerApp||'desktop'),selectedApp:actor._computerSelection||0,snake:snakeSnapshot(actor._snake),valorant:{elapsed:actor._computerProgress||0}};}
  snakeDirection(direction){return this._classInputAllowed()&&this.player._computerActive&&this.player._computerApp==='snake'&&turnSnake(this.player._snake,direction);}
  stopComputer(){
    const p=this.player;if(!p._computerActive)return false;
    resetComputerPlayback(p);p._computerActive=false;p.holding=false;this.holding=false;this.selected=p._slots[p._selectedSlot]?.action||'snack';p.action=this.selected;return true;
  }
  hold(value){
    if(typeof value!=='boolean')return false;
    this._sanitizeActorItems(this.player);
    if(value&&this.stage!=='class')return false;
    const p=this.player;
    if(value&&this._classInputAllowed()&&!this._restrained(p)&&p._burpUntil>this.elapsed)return this.burp();
    if(!value)p._bubbleHolding=false;
    if(value&&this._inputAllowed()&&p.captivity==='bound'&&this._team.has(p.id)){
      if(this.elapsed+EPS<(p._bubbleCooldownUntil||0))return false;
      p._bubbleHolding=true;this.holding=true;return true;
    }
    if(value&&this._inputAllowed()&&this._restrained(p)){p._struggleAt=this.elapsed;return false;}
    if(!value){this.holding=false;p.holding=false;p._eating=false;const slot=p._slots[p._selectedSlot];if(CLASSROOM_ACTIONS[slot?.action]?.releaseToUse||FOOD_ACTIONS.includes(slot?.action)){slot.progress=0;p.progress=0;p._useElapsed=0;p._nextUseSound=0;}return false;}
    if(this._inputAllowed()&&!this._restrained(p)&&p.seated&&p._computerActive){this.selected=p.action='computer';this.holding=p.holding=true;return true;}
    const slot=p._slots[p._selectedSlot];
    if(!this._inputAllowed()||this._restrained(p)||!slot?.action||p._drawnSlot!==p._selectedSlot)return false;
    // The desktop pen is a continuous disguise, never a timed use/score action.
    if(slot.action==='pen'){this.holding=p.holding=false;return false;}
    this.selected=slot.action;p.action=slot.action;this.holding=true;p.holding=true;return true;
  }
  // Only an intentional mouse/touch release throws. Pause, blur, Q and pointer
  // cancellation call hold(false), keeping the grenade and clearing its charge.
  releaseUse(){
    const p=this.player,slot=p._slots[p._selectedSlot];
    if(this._classInputAllowed()&&p.captivity==='bound'&&this._team.has(p.id)&&p._bubbleHolding)return this._releaseBubble(p);
    if(this._classInputAllowed()&&!this._restrained(p)&&this.holding&&slot?.action==='gum'&&p._drawnSlot===p._selectedSlot){if(p._bubbleElapsed>0){this._events.push({type:'gum-pop',studentId:p.id,x:p.x,y:this._bubbleHeadHeight(p),z:p.z});this._cancelBubble(p,true);this._completeAction(p,slot);return true;}}
    if(this._classInputAllowed()&&!this._restrained(p)&&this.holding&&CLASSROOM_ACTIONS[slot?.action]?.releaseToUse&&p._drawnSlot===p._selectedSlot){
      this._completeAction(p,slot);return true;
    }
    this.hold(false);return false;
  }
  setMovement(x,z){if(!valid(x)||!valid(z)||!this._inputAllowed()||this._restrained())return false;const n=Math.max(1,Math.hypot(x,z));this._movement={x:clamp(x/n,-1,1),z:clamp(z/n,-1,1)};return true;}
  setLook(yaw,pitch){if(!valid(yaw)||!valid(pitch)||!this._inputAllowed())return false;this.player.yaw=angle(yaw);this.player.pitch=clamp(pitch,-1.3,1.3);return true;}
  setCrouch(value){
    if(typeof value!=='boolean')return false;
    // Releasing a held posture must work even after focus loss or restraint.
    if(!value){this.player.crouched=false;return true;}
    if(this.player.id===-1){this.player.crouched=false;return false;}
    if(!this._inputAllowed()||this._restrained()||this.player.seated)return false;
    this.player.crouched=true;return true;
  }
  interact(seatId=null){
    if(!this._inputAllowed()||this._restrained())return false;
    const p=this.player;
    if(OFFICE_CHAIRS.some(c=>c.id===seatId)&&!p.seated)return this.sitOfficeChair(seatId);
    if(p.seated){const exit=chairExit(p._officeChair?(OFFICE_CHAIRS.find(c=>c.id===p._officeChairId)||OFFICE_CHAIR):this.seats[p.seatId]||{...p,yaw:p.seatYaw},.18,this.layout);if(!exit)return false;if(p._penTaken)p._penMode='twirling';this.hold(false);this.stopComputer();p.x=exit.x;p.z=exit.z;p._drawerOpen=false;p.seated=false;p.seatId=null;p._officeChair=false;this._observe('stand',p.id,'已离开座位；持物移动不会增加捣乱值。');return 'stood';}
    const occupied=new Set(this.students.filter(s=>s.seated&&!s.caught).map(s=>s.seatId));
    const seat=this.seats.filter(s=>(seatId===null||seatId===s.id)&&!occupied.has(s.id)&&distance(p,s)<1.05).sort((a,b)=>distance(p,a)-distance(p,b))[0];
    if(!seat)return false;
    if(!this._switchDeskStock(p,false,seat.id))return false;p.x=seat.x;p.z=seat.z;p.yaw=seat.yaw;p.seatYaw=seat.yaw;p.seated=true;p.seatId=seat.id;p._officeChair=false;p._officeDeskId=null;p.crouched=false;this._movement={x:0,z:0};this._observe('sit',p.id,'已坐下。');return 'seated';
  }
  pause(value=true){if(typeof value!=='boolean'||this.status!=='playing')return this.snapshot();if(value!==this.paused){resetComputerPlayback(this.player,{progress:false});this.hold(false);this.setDoorUse(false);this.player.crouched=false;this._movement={x:0,z:0};this._accumulator=0;}this.paused=value;return this.snapshot();}
  /** Fixed-step simulation; a single caller delta is bounded to 30s for safety. */
  step(dt){
    if(!this._inputAllowed()||!valid(dt)||dt<=0)return this.snapshot();
    this._accumulator+=Math.min(dt,30,Math.max(0,this.duration-this.elapsed));
    while(this.status==='playing'){
      const tick=Math.min(STEP,this.stage==='class'?this.duration-this.elapsed:Infinity);if(this._accumulator+EPS<tick)break;
      this._accumulator=Math.max(0,this._accumulator-tick);syncDrawerCollisions(this.layout,this.map,[...this.students,this.player]);if(this.stage==='class')this._advance(tick);else this._advancePreparation(tick);
    }
    if(this.status!=='playing')this._accumulator=0;return this.snapshot();
  }
  snapshot(){
    for(const actor of new Set([...this.students,this.player]))this._sanitizeActorItems(actor);
    for(const key of Object.keys(this.completed))if(!Object.hasOwn(CLASSROOM_ACTIONS,key))delete this.completed[key];
    const p=this.player,t=this.teacher,m=this._memory.get(p.id);
    const capture=s=>({...this._visionSnapshot(s.id===-1?t:s),penTaken:Boolean(s._penTaken),penSeatId:s._penSeatId??null,penWriting:this._penWriting(s),penTwirling:this._penTwirling(s),eating:Boolean(s._eating&&s.holding),itemThrowAge:valid(s._lastItemThrowAt)?clean(Math.max(0,this.elapsed-s._lastItemThrowAt)):999,captivity:s.captivity||'free',postId:s.postId??null,stunLeft:clean(Math.max(0,(s._chalkUntil||0)-this.elapsed)),struggleAge:this.elapsed-(s._struggleAt??-100),bubble:this._bubbleSnapshot(s)});
    return {role:'student',seats:this.seats.map(s=>({...s})),layoutPattern:this.seats[0]?.pattern,officeDrawers:OFFICE_DESKS.map(d=>({id:d.id,open:[...this.students,this.player].some(a=>a._officeDeskId===d.id&&a._drawerOpen&&a.seated)})),officeDeskOpen:this.students.some(s=>s._usingOfficeStock&&s._drawerOpen)||Boolean(this.player._usingOfficeStock&&this.player._drawerOpen),officeLocked:this.layout.officeLocked,rearDoorClosed:this.layout.rearDoorClosed,map:this.map,status:this.status,paused:this.paused,seed:this.seed,stage:this.stage,stageElapsed:clean(this._stageElapsed),sceneElapsed:clean(this._sessionElapsed),stageTimeLeft:clean(this._preparationLeft),startBell:{...START_BELL},startBellAvailable:this.canStartBell(),elapsed:clean(this.elapsed),timeLeft:Number.isFinite(this.duration)?clean(Math.max(0,this.duration-this.elapsed)):0,timed:Number.isFinite(this.duration),score:this.score,target:this.target,strikes:this.strikes,resultReason:this.resultReason,
      interaction:{kind:this._doorUse?'rear-door':null,progress:this._doorProgress||0},leaderboard:this.students.filter(s=>this._team.has(s.id)).map(s=>({id:s.id,name:s.name,points:s._earnedPoints||0,caught:Boolean(s.caught),isSelf:s===p})).sort((a,b)=>b.points-a.points||a.id-b.id),suspicion:clean(m?.evidence||0),holding:this.holding,selected:this.selected,actionProgress:clean(p._computerActive?p._computerProgress:p._slots[p._selectedSlot]?.progress||0),completed:{...this.completed},drawer:this._drawerSnapshot(p),caughtCount:this.students.filter(s=>this._team.has(s.id)&&s.caught).length,teamSize:this._team.size,settings:{duration:this._defaultDuration,target:this.target},computerGamingCount:this.students.filter(s=>s.seated&&s._computerActive&&COMPUTER_GAMES.includes(s._computerApp)&&!this._restrained(s)).length,
      posts:DETENTION.map(post=>({...post,studentId:this.students.find(s=>s.captivity==='bound'&&s.postId===post.id)?.id??null})),rescue:{id:this._rescueId,progress:this._rescueProgress},rescueAim:this.rescueTarget()?.id??null,
      books:this.books.map(b=>({...b,amount:clean(b.amount)})),
      player:{...capture(p),officeChair:Boolean(p._officeChair),officeDeskId:p._officeDeskId||null,penTaken:Boolean(p._penTaken),computerActive:Boolean(p._computerActive),computer:this._computerSnapshot(p),burpReadyLeft:clean(Math.max(0,(p._burpUntil||0)-this.elapsed)),bookRaised:p.seated?Boolean(this.books[p.seatId]?.raised):false,id:p.id,x:clean(p.x),z:clean(p.z),yaw:clean(p.yaw),pitch:clean(p.pitch),seated:p.seated,crouched:p.crouched,caught:p.caught,seatId:p.seatId,seatYaw:p.seatYaw||0},
      teacher:{...t,stunLeft:clean(Math.max(0,(t._chalkUntil||0)-this.elapsed)),...this._visionSnapshot(t),x:clean(t.x),z:clean(t.z),yaw:clean(t.yaw),phaseTime:clean(t.phaseTime),phaseDuration:clean(t.phaseDuration),castProgress:clean(t.castProgress),attention:clean(t.attention),walkProgress:clean(t.walkProgress),observedIds:[...this._memory.keys()],memory:[...this._memory.values()].map(m=>({id:m.id,evidence:clean(m.evidence),suspicion:clean(m.evidence),noise:clean(m.noise),confirmed:m.confirmed,detained:m.detained,lastSeen:m.lastSeen,lastHeard:m.lastHeard,lastVisit:m.lastVisit,visits:m.visits,x:clean(m.x),z:clean(m.z)}))},
      students:this.students.map(s=>({...capture(s),computerActive:Boolean(s._computerActive),computer:this._computerSnapshot(s),bookRaised:s.seated?Boolean(this.books[s.seatId]?.raised):false,id:s.id,officeChair:Boolean(s._officeChair),officeDeskId:s._officeDeskId||null,visible:s.visible!==false,seatYaw:s.seatYaw||0,seatId:s.seatId,x:clean(s.x),z:clean(s.z),yaw:clean(s.yaw),pitch:clean(s.pitch),seated:s.seated,crouched:s.crouched,isPlayer:s.isPlayer,isTeammate:s.isTeammate,caught:s.caught,mood:s.mood,action:s.action,holding:s.holding,studyBookHeld:Boolean(s.studyBookHeld&&s.seated&&!this._restrained(s)),progress:clean(s.progress),name:s.name,personality:s.personality,completed:{...s.completed},...(this._team.has(s.id)?{drawer:this._drawerSnapshot(s)}:{})})),
      peels:this.peels.map(p=>({...p})),burps:this.burps.map(p=>({...p})),chalks:this.chalks.map(c=>({...c})),projectiles:this.projectiles.map(p=>({...p})),bubbles:this.bubbles.map(b=>({...b})),smokes:this.smokes.map(s=>({...s,remaining:clean(s.remaining)}))};
  }
  _visionSnapshot(actor){
    const flashLeft=Math.max(0,(actor._flashUntil||0)-this.elapsed),inkLeft=Math.max(0,(actor._inkUntil||0)-this.elapsed);
    return{bubbleKind:actor._bubbleKind||'pink',bubbleLeft:clean(Math.max(0,(actor._bubbleUntil||0)-this.elapsed)),bubbleSize:actor._bubbleSize||0,flashLeft:clean(flashLeft),flashDuration:flashLeft?clean(actor._flashDuration||0):0,flashStrength:flashLeft?clean(actor._flashStrength||0):0,inkLeft:clean(inkLeft),inkDuration:inkLeft?PROJECTILE_EFFECT_TUNING.inkDuration:0};
  }
  _teacherVisionObscured(){return (this.teacher._flashUntil||0)>this.elapsed||(this.teacher._inkUntil||0)>this.elapsed||(this.teacher._bubbleUntil||0)>this.elapsed||(this.teacher._chalkUntil||0)>this.elapsed;}
  _applyProjectileEffect(p,effect){
    const affected=[];
    for(const actor of [...this.students,this.teacher]){
      const id=actor.id??-1;
      if(effect.kind==='flash'){
        const strength=flashExposure(effect,actor,this.map,this.layout);if(strength<=0)continue;
        const duration=(PROJECTILE_EFFECT_TUNING.flashWhite+PROJECTILE_EFFECT_TUNING.flashFade)*strength,until=this.elapsed+duration;
        // The strongest outstanding exposure wins; weaker repeats do not shorten it.
        if(until>(actor._flashUntil||0)){actor._flashUntil=until;actor._flashDuration=duration;actor._flashStrength=strength;}
      }else{
        if(effect.hitActorId!==id&&!inkExposure(effect,actor,this.map,this.layout))continue;
        actor._inkUntil=this.elapsed+PROJECTILE_EFFECT_TUNING.inkDuration;
      }
      affected.push(id);
    }
    this._events.push({type:effect.kind==='flash'?'flash-burst':'ink-splash',id:p.id,ownerId:p.ownerId,x:effect.x,y:effect.y,z:effect.z,affected,hitActorId:effect.hitActorId??null});
  }
  _bubbleSnapshot(actor){
    const eligible=(actor.captivity==='bound'&&this._team.has(actor.id))||actor._drawnSlot!==null&&actor.action==='gum',cooldown=Math.max(0,(actor._bubbleCooldownUntil||0)-this.elapsed);
    return{kind:actor.captivity==='bound'?'orange':'pink',cycles:eligible?clean((actor._bubbleElapsed||0)/BUBBLE_TUNING.cycle):0,radius:eligible?this._mouthBubbleGeometry(actor).radius:0,available:eligible&&this._classInputAllowed()&&cooldown<=EPS,progress:eligible?clean((actor._bubbleElapsed||0)/BUBBLE_TUNING.duration):0,cooldown:clean(cooldown),blowing:eligible&&Boolean(actor._bubbleHolding||actor.holding&&actor.action==='gum')&&this._classInputAllowed()};
  }
  _cancelBubble(actor,clear=false){
    actor._bubbleHolding=false;if(actor.isPlayer)this.holding=false;
    if(clear){actor._bubbleElapsed=0;actor._bubbleAwarded=0;}
  }
  _bubbleHeadHeight(actor){return floorHeight(actor.x,actor.z,this.map)+((actor._chalkUntil||0)>this.elapsed?1.08:actor.id===-1?1.95:actor.seated?1.42:1.65);}
  _bubbleVolumes(){
    const volumes=[...enclosureVolumes(this.map,this.layout),...OFFICE_SOLIDS,...this.layout.desks];
    for(const seat of this.seats){
      const base=floorHeight(seat.x,seat.z,this.map),computer=mapKind(this.map)==='computer';
      if(!computer&&(this.books[seat.id]?.amount||0)<=.5)continue;
      const half=computer?.33:.34,z=seat.deskZ+Math.cos(seat.yaw||0)*(computer?.17:-.28),depth=computer?.048:.02;
      volumes.push({minX:seat.deskX-half,maxX:seat.deskX+half,minZ:z-depth,maxZ:z+depth,minY:base+(computer?1.02:.88),maxY:base+(computer?1.42:1.35)});
    }
    return volumes;
  }
  _mouthBubbleGeometry(actor){
    const charge=clamp((actor._bubbleElapsed||0)/BUBBLE_TUNING.duration,0,1),desired=charge>0?.035+.88*charge*charge*(3-2*charge):0;
    const mouth={x:actor.x,y:this._bubbleHeadHeight(actor),z:actor.z};
    const center=radius=>({x:mouth.x+Math.sin(actor.yaw)*(.28+radius*1.08),y:mouth.y,z:mouth.z+Math.cos(actor.yaw)*(.28+radius*1.08)});
    if(!desired)return{charge,radius:0,center:center(0)};
    const volumes=this._bubbleVolumes();
    const clear=radius=>{const c=center(radius);return!volumes.some(box=>{
      if(segmentBox(mouth,c,box)!==null)return true;
      const dx=c.x-clamp(c.x,box.minX,box.maxX),dy=c.y-clamp(c.y,box.minY??0,box.maxY??4.51),dz=c.z-clamp(c.z,box.minZ,box.maxZ);
      return dx*dx+dy*dy+dz*dz<(radius+.008)**2;
    });};
    let radius=desired;
    // Inflation is constrained by the actual book, monitor, desks and walls.
    // Charge still advances normally; only available physical space changes.
    if(!clear(desired)){let low=0,high=desired;for(let i=0;i<14;i++){const mid=(low+high)/2;if(clear(mid))low=mid;else high=mid;}radius=low;}
    return{charge,radius,center:center(radius)};
  }
  _touchMouthBubble(actor){
    const {charge,radius,center}=this._mouthBubbleGeometry(actor);if(charge<=0||radius<.01)return false;
    if(!this._clearWallSegment(actor,center))return false;
    const target=[...this.students,this.teacher].filter(a=>(a.id??-1)!==actor.id&&a.visible!==false&&this._clearWallSegment(center,a)&&!chalkHit(center,{x:a.x,y:this._bubbleHeadHeight(a),z:a.z},[],this.books,this.map,this.layout)).map(a=>({actor:a,d:Math.hypot(a.x-center.x,this._bubbleHeadHeight(a)-center.y,a.z-center.z)})).filter(a=>a.d<=radius+.22).sort((a,b)=>a.d-b.d)[0]?.actor;
    if(!target)return false;
    return this._attachBubble(actor.id,target,charge,actor.captivity==='bound'?'orange':'pink');
  }
  _attachBubble(studentId,target,charge,kind){
    const targetId=target.id??-1,duration=Math.max(2+8*charge,(target._bubbleUntil||0)-this.elapsed);
    this.bubbles=this.bubbles.filter(b=>b.attachedId!==targetId);
    const bubble={id:this._bubbleId++,kind,studentId,attachedId:targetId,charge:1,sourceCharge:clean(charge),age:0,lifetime:duration,x:target.x,y:this._bubbleHeadHeight(target),z:target.z,yaw:target.yaw};
    this.bubbles.push(bubble);target._bubbleUntil=this.elapsed+duration;target._bubbleSize=1;target._bubbleKind=kind;
    this._events.push({type:'bubble-attached',id:bubble.id,kind,studentId,targetId,size:1,duration:clean(duration)});return true;
  }
  _endMouthBubble(actor){
    this._cancelBubble(actor,true);actor._bubbleCooldownUntil=this.elapsed+BUBBLE_TUNING.cooldown;
    actor._bubbleNextAt=actor._bubbleCooldownUntil+(actor.isPlayer?0:this._range(.6,2));
  }
  _releaseBubble(actor){
    const {charge,radius,center}=this._mouthBubbleGeometry(actor);if(charge<=0)return false;
    if(actor.captivity!=='bound'){this._events.push({type:'gum-pop',studentId:actor.id,x:actor.x,y:center.y,z:actor.z});this._endMouthBubble(actor);return true;}
    const attached=this._touchMouthBubble(actor);
    if(!attached&&radius>.01)this.bubbles.push({id:this._bubbleId++,kind:'orange',studentId:actor.id,attachedId:null,charge,sourceCharge:charge,radius,...center,vx:Math.sin(actor.yaw)*2.4,vz:Math.cos(actor.yaw)*2.4,age:0,lifetime:6});
    this._endMouthBubble(actor);this._events.push({type:'bubble-release',studentId:actor.id,charge,attached,x:actor.x,y:center.y,z:actor.z});return true;
  }
  _advanceBoundBubble(actor,dt){
    if(!this._team.has(actor.id))return;
    if(!actor.isPlayer&&!actor.networkHuman&&!actor._bubbleHolding&&actor._decisionAt!==Infinity&&this.elapsed+EPS>=actor._bubbleNextAt&&this.elapsed+EPS>=actor._bubbleCooldownUntil)actor._bubbleHolding=true;
    if(!actor._bubbleHolding)return;
    const previous=Math.floor((actor._bubbleElapsed+EPS)/BUBBLE_TUNING.cycle);actor.mood='bubblegum';actor._bubbleElapsed=Math.min(BUBBLE_TUNING.duration,actor._bubbleElapsed+dt);
    const current=Math.floor((actor._bubbleElapsed+EPS)/BUBBLE_TUNING.cycle);if(current>previous)this._events.push({type:'gum-inflate',studentId:actor.id,recipientId:actor.id,cycle:current});
    const earned=Math.min(BUBBLE_TUNING.maxPoints,Math.floor((actor._bubbleElapsed+EPS)*BUBBLE_TUNING.pointsPerSecond)),delta=earned-actor._bubbleAwarded;
    if(delta>0){
      actor._bubbleAwarded=earned;const points=Math.min(delta,Math.max(0,this.target-this.score));this._creditScore(actor,points);
      this._events.push({type:'bubble-score',studentId:actor.id,actor:actor.isPlayer||actor.networkHuman?'player':'ai',points,score:this.score});
    }
    if(this._touchMouthBubble(actor))this._endMouthBubble(actor);
    else if(!actor.isPlayer&&!actor.networkHuman&&actor._bubbleElapsed+EPS>=BUBBLE_TUNING.duration)this._releaseBubble(actor);
    if(this.score>=this.target)this._finish('won','mischief');
  }
  _advanceBubbles(dt){
    for(const b of [...this.bubbles]){
      b.age+=dt;
      if(b.attachedId!=null){const target=b.attachedId===-1?this.teacher:this.students.find(s=>s.id===b.attachedId);if(target){b.x=target.x;b.z=target.z;b.y=this._bubbleHeadHeight(target);}else b.age=b.lifetime;continue;}
      if(b.kind!=='orange'){b.age=b.lifetime;continue;}
      const next={x:b.x+b.vx*dt,y:b.y,z:b.z+b.vz*dt},r=b.radius||.1;
      const blocked=this._bubbleVolumes().some(box=>segmentBox(b,next,{minX:box.minX-r,maxX:box.maxX+r,minY:(box.minY||0)-r,maxY:box.maxY+r,minZ:box.minZ-r,maxZ:box.maxZ+r})!==null);
      if(blocked){b.age=b.lifetime;continue;}
      const target=[...this.students,this.teacher].find(a=>(a.id??-1)!==b.studentId&&a.visible!==false&&this._clearWallSegment(b,a)&&Math.hypot(a.x-next.x,this._bubbleHeadHeight(a)-next.y,a.z-next.z)<=r+.22);
      if(target){this._attachBubble(b.studentId,target,b.sourceCharge,'orange');b.age=b.lifetime;}else Object.assign(b,next);
    }
    this.bubbles=this.bubbles.filter(b=>b.age<b.lifetime);
  }
  _throwPeel(actor,charge=0){
    const p=createThrowableProjectile(actor,this._novelId++,'bananaPeel',charge,this.map,this.layout);this.peels.push({...p,age:0,lifetime:ITEM50_TUNING.peelLifetime,armed:false});actor._lastItemThrowAt=this.elapsed;this._events.push({type:'peel-thrown',studentId:actor.id,id:p.id});
  }
  burp(){
    const p=this.player;if(!this._classInputAllowed()||this._restrained(p)||!(p._burpUntil>this.elapsed))return false;
    p._burpUntil=0;this.holding=p.holding=false;this.burps.push({id:this._novelId++,ownerId:p.id,x:p.x+Math.sin(p.yaw)*.45,y:floorHeight(p.x,p.z,this.map)+(p.seated?1.43:1.65),z:p.z+Math.cos(p.yaw)*.45,yaw:p.yaw,age:0,lifetime:ITEM50_TUNING.burpLifetime});this._events.push({type:'burp',studentId:p.id,x:p.x,y:this._bubbleHeadHeight(p),z:p.z});return true;
  }
  _stunAny(actor,seconds=4,source='item'){
    if((actor.id??-1)===-1){this.teacher._chalkUntil=Math.max(this.teacher._chalkUntil||0,this.elapsed+seconds);this.teacher.captivity='stunned';this.teacher.phase='stunned';this._cast=null;if(this.teacher.carriedId!==null)this._release(this.students[this.teacher.carriedId]);if(this.player.id===-1){this.player.captivity='stunned';this.player._chalkUntil=this.teacher._chalkUntil;this._movement={x:0,z:0};}this._events.push({type:'stunned',studentId:-1,source});return true;}
    if(!this._stun(actor))return false;actor._chalkUntil=this.elapsed+seconds;actor._restUntil=actor._chalkUntil;this._events.push({type:'item-stun',studentId:actor.id,source});return true;
  }
  _advanceNovelItems(dt){
    const actors=[...this.students,this.teacher];
    for(const peel of this.peels){
      if(!peel.armed){stepThrowableProjectile(peel,dt,[],this.layout);if(peel.settled){peel.armed=true;peel.age=0;}}
      else{peel.age+=dt;const hit=actors.find(a=>Math.hypot(a.x-peel.x,a.z-peel.z)<.42&&!this._restrained(a));if(hit){this._stunAny(hit,ITEM50_TUNING.peelStun,'bananaPeel');peel.dead=true;this._events.push({type:'peel-slip',id:peel.id,actorId:hit.id??-1});}}
    }
    this.peels=this.peels.filter(p=>!p.dead&&p.age<p.lifetime);
    for(const cloud of this.burps){const before={x:cloud.x,z:cloud.z};cloud.age+=dt;cloud.x+=Math.sin(cloud.yaw)*ITEM50_TUNING.burpSpeed*dt;cloud.z+=Math.cos(cloud.yaw)*ITEM50_TUNING.burpSpeed*dt;if(!this._clearWallSegment(before,cloud)){cloud.dead=true;continue;}const hit=actors.find(a=>(a.id??-1)!==cloud.ownerId&&Math.hypot(a.x-cloud.x,a.z-cloud.z)<.55&&!this._restrained(a));if(hit){this._stunAny(hit,ITEM50_TUNING.burpStun,'garlic');cloud.dead=true;}}
    this.burps=this.burps.filter(p=>!p.dead&&p.age<p.lifetime);
  }
  _switchDeskStock(actor,office,deskId=office?OFFICE_DESK.id:actor.seatId){
    // A held object keeps its original slot until return/use. Sitting elsewhere
    // changes posture immediately, but never teleports or duplicates that stock.
    if(actor._drawnSlot!==null)return true;
    let slots;
    if(office){slots=this.officeSlotsByDesk.get(deskId);if(!slots)return false;}
    else{
      if(!Number.isInteger(deskId)||deskId<0)return false;
      slots=this.classSlotsBySeat.get(deskId);
      if(!slots){slots=Array.from({length:mapKind(this.map)==='computer'?1:3},(_,id)=>({id,action:this._drawItem(),readyAt:0,progress:0}));this.classSlotsBySeat.set(deskId,slots);}
    }
    if(actor._slots===slots){actor._usingOfficeStock=office;return true;}
    actor._slots=slots;actor._classSlots=null;actor._stockSeatId=office?null:deskId;actor._usingOfficeStock=office;actor._selectedSlot=0;actor.action=slots[0]?.action||'snack';actor.progress=0;
    if(actor===this.player)this.selected=actor.action;return true;
  }
  sitOfficeChair(id=OFFICE_CHAIR.id){
    const chair=OFFICE_CHAIRS.find(c=>c.id===id),p=this.player;if(!chair||!this._inputAllowed()||this._restrained(p)||distance(p,chair)>1.25||!this._clearWallSegment(p,chair))return false;
    if([...this.students,...(this.player.id===-1?[this.player]:[])].some(s=>s!==p&&s.seated&&s._officeChair&&s._officeChairId===id))return false;
    const deskId=chair.deskId||(id===OFFICE_CHAIR.id?OFFICE_DESK.id:id.replace(/-chair$/,''));if(!this._switchDeskStock(p,true,deskId))return false;
    Object.assign(p,{x:chair.x,z:chair.z,yaw:chair.yaw||0,seatYaw:chair.yaw||0,seated:true,seatId:-1,_officeChair:true,_officeChairId:id,_officeDeskId:deskId,crouched:false,_drawerOpen:false});this._movement={x:0,z:0};return 'seated';
  }
  openOfficeDrawer(id=this.player._officeDeskId||OFFICE_DESK.id){
    const desk=OFFICE_DESKS.find(d=>d.id===id),chair=OFFICE_CHAIRS.find(c=>c.deskId===id||(id===OFFICE_DESK.id&&c.id===OFFICE_CHAIR.id)||c.id===id+'-chair'),p=this.player;
    if(!desk||!chair||!this._classInputAllowed()||this._restrained(p)||p._drawnSlot!==null||distance(p,chair)>1.65||!this._clearWallSegment(p,{x:desk.drawerX??desk.x,z:(desk.drawerZ??desk.z-.52)-.15}))return false;
    if((!p._officeChair||p._officeDeskId!==id)&&!this.sitOfficeChair(chair.id))return false;
    p._drawerOpen=!p._drawerOpen;return true;
  }
  setOfficeDrawerOpen(open,id=this.player._officeDeskId||OFFICE_DESK.id){
    const p=this.player;if(typeof open!=='boolean'||!this._classInputAllowed()||this._restrained(p)||p._drawnSlot!==null)return false;
    if(!open){if(!p._officeChair||!p._drawerOpen)return false;p._drawerOpen=false;return true;}
    if(p._officeChair&&p._officeDeskId===id&&p._drawerOpen)return false;
    return this.openOfficeDrawer(id);
  }
  takePen(){
    const p=this.player;if(!this._classInputAllowed()||!p.seated||this._restrained(p)||p._drawnSlot!==null||p._officeChair||mapKind(this.map)==='computer')return false;
    if(p._penTaken||this.penOwners.has(p.seatId))return false;this.stopComputer();this._claimItemSource(p);p._penSeatId=p.seatId;this.penOwners.set(p.seatId,p.id);const slot={id:p._slots.length,action:'pen',readyAt:Infinity,progress:0,temporary:true,heldBy:p.id};p._slots.push(slot);p._selectedSlot=slot.id;p._drawnSlot=slot.id;p._penTaken=true;p._penMode='twirling';this.selected=p.action='pen';this.holding=p.holding=false;p.mood='pen-twirling';if(this.books[p.seatId])this.books[p.seatId].raised=false;return true;
  }
  drainEvents(){const events=this._events;this._events=[];return events;}
  _random(){let t=this._rng=(this._rng+0x6D2B79F5)>>>0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
  _range(a,b){return a+(b-a)*this._random();}
  _drawItem(){
    // A separate seeded stream keeps opening the drawer from changing AI choices.
    // Sampling with replacement permits two or three copies of the same object.
    let t=this._drawerRng=(this._drawerRng+0x6D2B79F5)>>>0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);
    const items=mapKind(this.map)==='computer'?COMPUTER_DRAWER_FOODS:ACTION_KEYS;
    return items[Math.floor((((t^t>>>14)>>>0)/4294967296)*items.length)];
  }
  _sanitizeActorItems(actor){
    if(!actor?._slots)return;
    const invalid=action=>action!=null&&!Object.hasOwn(CLASSROOM_ACTIONS,action),oldAction=actor.action;
    const drawn=actor._drawnSlot!=null?actor._slots[actor._drawnSlot]:null,discardHeld=drawn&&invalid(drawn.action);
    // Removed/unknown items in old local or server state become safe stock.
    // A previously held item is put away, never silently used as its replacement.
    for(const slot of new Set([...actor._slots,...(actor._classSlots||[])]))if(invalid(slot.action)){
      slot.action=[...this.officeSlotsByDesk.values()].some(slots=>slots.includes(slot))?'lunch':'snack';slot.progress=0;slot.readyAt=0;delete slot.heldBy;
    }
    for(const key of Object.keys(actor.completed||{}))if(invalid(key))delete actor.completed[key];
    if(discardHeld){actor._drawnSlot=null;actor.holding=false;actor.progress=0;if(actor===this.player)this.holding=false;}
    if(invalid(oldAction)&&oldAction!=='chalk'){
      actor.action=actor._slots[actor._selectedSlot]?.action||'snack';actor.progress=0;actor.holding=false;
      if(actor.mood===oldAction)actor.mood=actor.seated?(mapKind(this.map)==='computer'?'computer-idle':'writing'):'idle';
    }
    if(actor===this.player&&invalid(this.selected)&&this.selected!=='chalk'){this.selected=actor.action||'snack';this.holding=false;}
  }
  _drawerSnapshot(actor){this._sanitizeActorItems(actor);return{open:actor._drawerOpen,office:Boolean(actor._usingOfficeStock),source:actor._heldSource?{...actor._heldSource}:null,canReturn:this._canReturnItem(actor),slots:actor._slots.map(slot=>({id:slot.id,action:slot.heldBy!==undefined&&slot.heldBy!==actor.id?null:slot.action,...(slot.temporary?{temporary:true}:{}),readyIn:slot.action?0:clean(Math.max(0,slot.readyAt-this.elapsed))})),selectedSlot:actor._selectedSlot,drawnSlot:actor._drawnSlot};}
  _refillDrawers(){
    const refill=(slots,office)=>{for(const slot of slots){if(slot.temporary||slot.action||slot.readyAt>this.elapsed+EPS)continue;slot.action=office?'lunch':this._drawItem();slot.readyAt=0;slot.progress=0;}};
    for(const slots of this.officeSlotsByDesk.values())refill(slots,true);
    for(const slots of this.classSlotsBySeat.values())refill(slots,false);
    for(const s of this.students){
      this._sanitizeActorItems(s);
      if(!s._usingOfficeStock)refill(s._slots,false);else if(s._classSlots)refill(s._classSlots,false);
      const slot=s._slots[s._selectedSlot];if(slot?.action&&s._drawnSlot===null&&!s._computerActive){s.action=slot.action;s.progress=slot.progress;if(s.isPlayer)this.selected=slot.action;}
    }
  }
  _observe(fact,id,text){if(this.elapsed-this._lastObservation<2.4)return;this._lastObservation=this.elapsed;this._events.push({type:'observation',fact,studentId:id,text});}
  _remember(actor){let m=this._memory.get(actor.id);if(!m){m={id:actor.id,x:actor.x,z:actor.z,evidence:0,noise:0,confirmed:false,detained:false,lastSeen:null,lastHeard:null,lastVisit:null,visits:0};this._memory.set(actor.id,m);}return m;}
  _hear(actor,strength,source='object'){
    if(this._teacherEntryRoute)return;
    const d=distance(this.teacher,actor);if(d>11)return;
    const m=this._remember(actor);m.noise=Math.min(5,m.noise+strength*(1-d/15));m.lastHeard=clean(this.elapsed);m.x=actor.x;m.z=actor.z;
    this._observe('noise-heard',actor.id,`${actor.name}所在位置传来声响。`);
  }
  _throwProjectile(actor,kind,charge){
    const projectile=createThrowableProjectile(actor,this._smokeId++,kind,charge,this.map,this.layout);this.projectiles.push(projectile);actor._lastItemThrowAt=this.elapsed;
    this._hear(actor,.35,'throw');this._events.push({type:kind+'-throw',kind,studentId:actor.id,x:projectile.x,y:projectile.y,z:projectile.z});
  }
  _throwSmoke(actor,charge){this._throwProjectile(actor,'smoke',charge);}
  _creditScore(actor,points){
    const awarded=Math.max(0,Math.min(Number(points)||0,this.target-this.score));
    this.score+=awarded;actor._earnedPoints=(actor._earnedPoints||0)+awarded;return awarded;
  }
  _completeAction(actor,slot){
    const kind=slot.action,action=CLASSROOM_ACTIONS[kind],charge=slot.progress;if(!action){this._sanitizeActorItems(actor);return;}
    if(kind==='pen'){slot.progress=actor.progress=0;actor.holding=false;if(actor.isPlayer)this.holding=false;return;}
    delete slot.heldBy;slot.progress=0;slot.action=null;slot.readyAt=this.elapsed+(!actor._usingOfficeStock&&mapKind(this.map)==='computer'?ITEM50_TUNING.computerRefill:DEVELOPMENT_TUNING.drawerRefill);
    actor.progress=0;actor.completed[kind]++;actor.holding=false;actor._drawnSlot=null;
    if(actor.isPlayer){this.completed[kind]++;this.holding=false;}
    if(kind==='bananaPeel')this._throwPeel(actor,charge);else if(action.releaseToUse)this._throwProjectile(actor,kind,charge);
    if(kind==='garlic')actor._burpUntil=this.elapsed+ITEM50_TUNING.burpWindow;
    if(kind==='banana'){slot.action='bananaPeel';slot.readyAt=0;slot.heldBy=actor.id;actor._drawnSlot=slot.id;actor.action='bananaPeel';if(actor.isPlayer)this.selected='bananaPeel';}
    if(kind!=='banana')this._finishHeldItem(actor);
    const points=Math.min(action.points,this.target-this.score);this._creditScore(actor,points);
    this._events.push({type:'complete',actor:actor.isPlayer||actor.networkHuman?'player':'ai',studentId:actor.id,speaker:actor.name,action:kind,slotId:slot.id,points,score:this.score});
    if(FOOD_ACTIONS.includes(kind))this._events.push({type:kind==='drink'?'drink-complete':'food-complete',studentId:actor.id,x:actor.x,y:this._bubbleHeadHeight(actor),z:actor.z});
    actor._eating=false;actor._useElapsed=0;actor._nextUseSound=0;
    if(actor.isTeammate&&!actor.networkHuman)actor._restUntil=this.elapsed+this._range(DEVELOPMENT_TUNING.teammateRestMin,DEVELOPMENT_TUNING.teammateRestMax)+actor._profile.caution*3+this._localRisk(actor)*2;
    if(this.score>=this.target)this._finish('won','mischief');
  }
  _advanceSmoke(dt){
    for(const smoke of this.smokes){smoke.remaining-=dt;smoke.age+=dt;Object.assign(smoke,smokeEnvelope(smoke.age,smoke.remaining));}
    this.smokes=this.smokes.filter(s=>s.remaining>EPS);
    if(this.player.id===-1){const p=this.player;Object.assign(this.teacher,{x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch,crouched:p.crouched});}
    const actors=[...this.students,this.teacher];
    for(const p of this.projectiles){
      const {impacts,effect}=stepThrowableProjectile(p,dt,actors,this.layout);
      if(effect)this._applyProjectileEffect(p,effect);
      if((p.kind||'smoke')!=='smoke')continue;
      for(const impact of impacts)this._events.push({type:'smoke-impact',...impact,studentId:p.ownerId});
      if(!p.emitting&&p.settled&&p.restTime+EPS>=.5){
        p.emitting=true;p.expiresAt=this.elapsed+DEVELOPMENT_TUNING.smokeDuration;
        this.smokes.push({id:p.id,ownerId:p.ownerId,x:p.x,y:p.y,z:p.z,age:0,...smokeEnvelope(0,DEVELOPMENT_TUNING.smokeDuration),remaining:DEVELOPMENT_TUNING.smokeDuration});
        this._events.push({type:'smoke-bloom',studentId:p.ownerId,x:p.x,y:p.y,z:p.z});
      }
    }
    this.projectiles=this.projectiles.filter(p=>!p.retired&&(!p.emitting||p.expiresAt>this.elapsed));
  }
  _localRisk(actor){
    if(this._teacherVisionObscured())return 0;
    if(!this._canSee(this.teacher,actor,this.smokes)){
      const delta=Math.abs(angle(heading(this.teacher,actor)-this.teacher.yaw));
      return this.teacher.warning&&distance(this.teacher,actor)<7&&delta<2?.35:0;
    }
    return clamp(this._propVisibility(this.teacher,actor,this.smokes)*(.6+2.6/Math.max(1,distance(this.teacher,actor))),0,1);
  }
  _advanceStudents(dt){
    for(const s of this.students){
      if(this._restrained(s)){s.holding=false;s.mood=s.captivity;if(s.captivity==='bound')this._advanceBoundBubble(s,dt);if(this.status!=='playing')return;continue;}
      if(this._seatingRoutes.has(s.id)){s.holding=false;continue;}
      if(!s.networkHuman&&(s.isTeammate||s._returnRoute)&&this._advanceRescuer(s,dt))continue;
      if(this._penActive(s)){s.holding=false;s.mood=this._penWriting(s)?'writing':'pen-twirling';if(s.isPlayer)this.holding=false;continue;}
      if(s.isPlayer){s.holding=this.holding;s.action=this.selected;s.mood=s._computerActive&&s.seated?'computer':s.holding?s.action:s.seated?(mapKind(this.map)==='computer'?'computer-idle':'writing'):'walking';continue;}
      if(s.networkHuman){s.mood=s._computerActive&&s.seated?'computer':s.holding?s.action:s.seated?(mapKind(this.map)==='computer'?'computer-idle':'writing'):'walking';continue;}
      if(!s.isTeammate){
        if(s.seated){Object.assign(s,ordinaryStudyState(s,this.teacher,this.elapsed,this.seed,mapKind(this.map)==='computer'));s._drawnSlot=null;s._drawerOpen=false;const book=this.books[s.seatId];if(book)book.raised=false;}
        else {s.holding=false;s.studyBookHeld=false;s._computerActive=false;s.mood='standing';}
        continue;
      }
      // After a real action, each classmate watches the room and prepares again.
      // These personality/risk-dependent breaks pace play, without fake scoring.
      if(s._restUntil>this.elapsed){s.holding=false;s._drawnSlot=null;s._drawerOpen=false;s._computerActive=false;s.mood=mapKind(this.map)==='computer'?'computer-idle':this.elapsed<(s._chalkUntil||0)?'thinking':'reading';continue;}
      const risk=this._localRisk(s);s._exposure=Math.max(0,s._exposure+(s.holding&&risk>.4?dt:-dt*.6));
      if(this.elapsed<s._decisionAt)continue;
      s._decisionAt=this.elapsed+this._range(.16,.42);
      const profile=s._profile,near=distance(this.teacher,s),current=s._slots[s._selectedSlot],finishRisk=current?.action&&current.progress>.83;
      const threshold=.24+(1-profile.caution)*.55+(finishRisk&&!this.teacher.warning?.16:0);
      const smoke=s._slots.find(slot=>(slot.heldBy===undefined||slot.heldBy===s.id)&&CLASSROOM_ACTIONS[slot.action]?.releaseToUse);
      if(risk>.3&&smoke){s._computerActive=false;s._selectedSlot=smoke.id;s.action=smoke.action;s.progress=smoke.progress;s._drawnSlot=smoke.id;s._drawerOpen=true;s.holding=true;s.mood=s.action;continue;}
      if(risk>threshold||(this.teacher.warning&&profile.caution>.8)){s._computerActive=false;s.holding=false;s._drawnSlot=null;s._drawerOpen=false;s.mood=mapKind(this.map)==='computer'?'computer-idle':'writing';continue;}
      if(mapKind(this.map)==='computer'&&s.seated){if(!s._snake||!s._snake.alive)s._snake=createSnake((this.seed+s.id)>>>0);s._computerApp='snake';const h=s._snake.body[0];if(h.x>=14)turnSnake(s._snake,'down');if(h.y>=10)turnSnake(s._snake,'left');if(h.x<=1)turnSnake(s._snake,'up');if(h.y<=1)turnSnake(s._snake,'right');s._computerActive=true;s._drawnSlot=null;s._drawerOpen=false;s.action='computer';s.holding=true;s.mood='computer';continue;}
      if(profile.distraction>.5&&this._random()<.08){s.holding=false;s._drawnSlot=null;s._drawerOpen=false;s.mood='scratch';s._decisionAt+=1.2;continue;}
      if(!current?.action||current.progress<EPS||current.heldBy!==undefined&&current.heldBy!==s.id){
        const choice=s._slots.filter(slot=>slot.action&&(slot.heldBy===undefined||slot.heldBy===s.id)).map(slot=>({slot,utility:(CLASSROOM_ACTIONS[slot.action].releaseToUse?risk*.8-.35:1/CLASSROOM_ACTIONS[slot.action].duration)-CLASSROOM_ACTIONS[slot.action].noise*profile.caution/(near+1)*.7+(ACTION_KEYS.indexOf(slot.action)===Math.floor(s._preference*ACTION_KEYS.length)?.11:0)-s.completed[slot.action]*.025})).sort((a,b)=>b.utility-a.utility)[0];
        if(!choice){s.holding=false;s.mood='reading';continue;}
        s._selectedSlot=choice.slot.id;s.action=choice.slot.action;s.progress=choice.slot.progress;
      }
      s._drawnSlot=s._selectedSlot;s._drawerOpen=true;s.holding=true;s.mood=s.action;
    }
    for(const s of this.students){
      const slot=s._slots[s._selectedSlot];
      if(s._computerActive&&!s.caught&&s.seated){
        if(s._computerApp==='valorant'&&!this._restrained(s)&&this._team.has(s.id)){
          const earned=advanceComputerPlayback(s,this.elapsed);if(earned){const points=Math.min(earned,this.target-this.score);this._creditScore(s,points);s.completed.computer+=points;if(s.isPlayer||s.networkHuman)this.completed.computer+=points;this._events.push({type:'valorant-watch',studentId:s.id,actor:s.isPlayer||s.networkHuman?'player':'ai',points,score:this.score});if(this.score>=this.target){this._finish('won','mischief');return;}}
        }
        if(s._computerApp==='snake'&&!this._restrained(s)){
          const earned=stepSnake(s._snake,dt);if(earned){const points=Math.min(earned,this.target-this.score);this._creditScore(s,points);s.completed.computer+=earned;if(s.isPlayer||s.networkHuman)this.completed.computer+=earned;this._events.push({type:'snake-food',studentId:s.id,actor:s.isPlayer||s.networkHuman?'player':'ai',points,score:this.score});if(this.score>=this.target){this._finish('won','mischief');return;}}
        }
        continue;
      }
      if(this._restrained(s)||!s.holding||!s.action){s._eating=false;continue;}
      if(!slot?.action||slot.action!==s.action||slot.heldBy!==undefined&&slot.heldBy!==s.id){s.holding=false;if(s.isPlayer)this.holding=false;continue;}
      const action=CLASSROOM_ACTIONS[s.action];
      if(!action){s.holding=false;s._eating=false;continue;}
      if(s.action==='pen'){s.progress=slot.progress=0;s.holding=false;if(s.isPlayer)this.holding=false;continue;}
      if(FOOD_ACTIONS.includes(s.action)){
        if(!s.isPlayer&&!s.networkHuman)s.pitch=.55;
        s._eating=(s.pitch||0)>=(s._eating?EATING_PITCH.leave:EATING_PITCH.enter);
        if(!s._eating)continue;
        s._useElapsed=(s._useElapsed||0)+dt;
        if(s._useElapsed>=(s._nextUseSound||0)){this._events.push({type:s.action==='drink'?'use-gulp':'use-crunch',studentId:s.id,recipientId:s.id,x:s.x,z:s.z});s._nextUseSound=s._useElapsed+.8;}
      }else s._eating=false;
      s._noise+=dt*action.noise;if(s._noise>=1){s._noise-=1;this._hear(s,1);}
      // Walking with an item stays quiet; actively eating still requires head down.
      if(!s.seated&&!action.releaseToUse&&!FOOD_ACTIONS.includes(s.action))continue;
      if(s.action==='gum'){
        const prior=Math.floor(((s._bubbleElapsed||0)+EPS)/BUBBLE_TUNING.cycle);s._bubbleElapsed=Math.min(BUBBLE_TUNING.duration,(s._bubbleElapsed||0)+dt);slot.progress=s._bubbleElapsed/BUBBLE_TUNING.duration;s.progress=slot.progress;
        const next=Math.floor((s._bubbleElapsed+EPS)/BUBBLE_TUNING.cycle);for(let n=prior;n<next;n++){const points=Math.min(ITEM50_TUNING.gumPoints[n]||0,this.target-this.score);this._creditScore(s,points);this._events.push({type:'gum-score',studentId:s.id,actor:s.isPlayer||s.networkHuman?'player':'ai',points,cycle:n+1,score:this.score},{type:'gum-inflate',studentId:s.id,recipientId:s.id,cycle:n+1});}
        if(this._touchMouthBubble(s)){this._endMouthBubble(s);this._completeAction(s,slot);continue;}
        if(s._bubbleElapsed+EPS>=BUBBLE_TUNING.duration){this._events.push({type:'gum-pop',studentId:s.id,x:s.x,y:this._bubbleHeadHeight(s),z:s.z});this._cancelBubble(s,true);this._completeAction(s,slot);}if(this.score>=this.target)this._finish('won','mischief');continue;
      }
      slot.progress=Math.min(1,slot.progress+dt/action.duration*(s.isPlayer||s.networkHuman?1:s._speed));s.progress=slot.progress;
      if((s.isPlayer||s.networkHuman)&&action.releaseToUse)continue;
      if(s.progress+EPS>=1){
        this._completeAction(s,slot);if(this.status!=='playing')return;
      }
    }
  }
  _perceive(dt){
    const t=this.teacher;
    if(this._teacherEntryRoute||this._teacherVisionObscured()){t.looking=false;t.attention=0;return;}
    t.looking=!t.warning&&this._canSee(t,this.player,this.smokes);t.attention=t.looking?this._propVisibility(t,this.player,this.smokes):0;
    for(const s of this.students){
      if(s.visible===false||this._restrained(s))continue;
      const seen=!t.warning&&this._canSee(t,s,this.smokes);
      let m=this._memory.get(s.id);
      if(seen){m=this._remember(s);m.lastSeen=clean(this.elapsed);m.x=s.x;m.z=s.z;}
      if(!m)continue;
      m.noise=Math.max(0,m.noise-dt*.10);
      if(m.confirmed||m.detained)continue;
      if(seen&&(s.holding||s._computerActive&&COMPUTER_GAMES.includes(s._computerApp)||((s.isPlayer||s.networkHuman)&&s._drawnSlot!==null))&&s.action&&s.action!=='pen'){
        const visibility=this._propVisibility(t,s,this.smokes),rate=DEVELOPMENT_TUNING.evidenceRate*CLASSROOM_ACTIONS[s.action].risk*visibility;
        const before=m.evidence;m.evidence=Math.min(100,m.evidence+rate*dt);
        if(before<20&&m.evidence>=20)this._observe('prop-seen',s.id,`老师看见了${s.name}的手部动作。`);
        if(m.evidence+EPS>=100){m.confirmed=true;m.evidence=100;this._observe('identified',s.id,`老师已认出${s.name}，正在靠近。`);this._thinkAt=0;}
      }else m.evidence=Math.max(0,m.evidence-dt*DEVELOPMENT_TUNING.evidenceDecay);
    }
  }
  _routeTo(point){
    const t=this.teacher;return this._walkRoute(t,point,.23).filter(p=>distance(t,p)>.06);
  }
  _setPlan(intent,targetId,point,utility){
    const route=point?this._routeTo(point):[],routeLength=route.reduce((sum,p,i)=>sum+distance(i?route[i-1]:this.teacher,p),0);
    this._plan={intent,targetId,since:this.elapsed,until:this.elapsed+(intent==='investigate'||intent==='revisit'||intent==='catch'?Math.min(18,routeLength/(intent==='catch'?AI_WALK_SPEEDS.teacherPursuit:AI_WALK_SPEEDS.teacherPatrol)+1.7):3),route,routeLength,arrivedAt:null,utility};
    this.teacher.intent=intent;this.teacher.targetId=targetId;this._turnLeft=.7;this.teacher.warning=true;
    if(intent==='scan')this._lastScan=this.elapsed;
    this._events.push({type:'warning',studentId:targetId,intent,duration:.7});
  }
  _think(){
    const t=this.teacher,plan=this._plan;
    // A known suspect must not keep an exhausted AI permanently on watch.
    // It uses the same board recovery as a human teacher, then resumes memory.
    if(t.stamina<15)t._recoveringStamina=true;
    if(t._recoveringStamina){
      if(t.stamina<100){if(plan.intent!=='write')this._setPlan('write',null,BOARD,1200);return;}
      t._recoveringStamina=false;plan.until=0;
    }
    // Only observed memories enter target selection. No role/team checks here.
    const confirmed=[...this._memory.values()].filter(m=>m.confirmed&&!m.detained).sort((a,b)=>distance(t,a)-distance(t,b));
    if(confirmed.length){const m=confirmed[0];if(plan.intent!=='catch'||plan.targetId!==m.id)this._setPlan('catch',m.id,m,1000);return;}
    if(this.elapsed<plan.until)return;
    const options=[{intent:'write',id:null,point:BOARD,utility:17+this._writingNeed*52},{intent:'scan',id:null,point:null,utility:12+Math.min(22,this.elapsed-this._lastScan)*2}];
    for(const m of this._memory.values()){
      if(m.detained)continue;
      const recent=m.lastHeard===null?0:Math.exp(-(this.elapsed-m.lastHeard)/12),visited=m.lastVisit===null?100:this.elapsed-m.lastVisit;
      const noiseUtility=m.noise*43*recent+m.evidence*.7-distance(t,m)*.8-(visited<3?20:0);
      if(m.noise>.15)options.push({intent:'investigate',id:m.id,point:m,utility:noiseUtility});
      if(m.evidence>15&&visited>5)options.push({intent:'revisit',id:m.id,point:m,utility:15+m.evidence*.95+Math.min(10,visited)*.5});
    }
    const best=options.sort((a,b)=>b.utility-a.utility)[0];
    if(best.intent!==plan.intent||best.id!==plan.targetId)this._setPlan(best.intent,best.id,best.point,best.utility);
    else if(plan.intent==='scan'&&this.elapsed-plan.since>4){this._lastScan=this.elapsed;plan.until=0;}
  }
  _advanceTeacher(dt){
    const t=this.teacher;
    if((t._chalkUntil||0)>this.elapsed+EPS){t.phase='stunned';t.castProgress=0;this._cast=null;return;}if(t.captivity==='stunned')t.captivity='free';
    t.stamina=Math.min(100,(t.stamina??100)+dt*(t.phase==='board'?10:0));
    if(this._teacherEntryRoute){
      t.phase='patrol';t.intent='enter';t.phaseTime+=dt;t.looking=false;t.warning=false;t.attention=0;t.castProgress=0;
      const arrived=this._follow(t,this._teacherEntryRoute,AI_WALK_SPEEDS.teacherEntry,dt,.23);
      const remaining=this._teacherEntryRoute.reduce((n,p,i)=>n+distance(i?this._teacherEntryRoute[i-1]:t,p),0);
      t.walkProgress=this._teacherEntryLength?clamp(1-remaining/this._teacherEntryLength,0,1):1;
      if(arrived){
        this._teacherEntryRoute=null;t.phase='board';t.intent='write';t.yaw=0;t.phaseTime=0;t.phaseDuration=3;
        this._plan={intent:'write',targetId:null,since:this.elapsed,until:this.elapsed+3,route:[],routeLength:0,arrivedAt:this.elapsed,utility:0};this._thinkAt=this.elapsed+.3;
        this._events.push({type:'teacher-entered'});
      }
      return;
    }
    const obscured=this._teacherVisionObscured();
    if(obscured){this._cast=null;t.castProgress=0;}
    if(t.stamina<=0){this._cast=null;t.castProgress=0;}
    if(t.carriedId!==null){this._advanceEscort(dt);return;}
    if(this._advanceStunChase(dt))return;
    this._writingNeed=clamp(this._writingNeed+(t.phase==='board'?-.085:.026)*dt,0,1);
    if(this.elapsed>=this._thinkAt&&!this._cast){this._thinkAt=this.elapsed+.3;this._think();}
    const p=this._plan,m=p.targetId===null?null:this._memory.get(p.targetId),target=m?{x:m.x,z:m.z}:null;
    if(p.intent==='catch'&&m&&!this._cast&&distance(t,m)>3.1&&!p.route.length){p.route=this._routeTo(m);p.routeLength=p.route.reduce((sum,v,i)=>sum+distance(i?p.route[i-1]:t,v),0);}
    let desired=0;
    if(target)desired=heading(t,target);
    else if(p.route.length)desired=heading(t,p.route[0]);
    else if(p.intent==='scan')desired=Math.PI+Math.sin((this.elapsed-p.since)*.7)*.72;
    t.yaw=angle(t.yaw+clamp(angle(desired-t.yaw),-2.2*dt,2.2*dt));
    this._turnLeft=Math.max(0,this._turnLeft-dt);
    if(!this._cast&&this._turnLeft<=EPS&&p.route.length){
      const next=p.route[0],d=distance(t,next),step=Math.min(d,(p.intent==='catch'?AI_WALK_SPEEDS.teacherPursuit:AI_WALK_SPEEDS.teacherPatrol)*dt),pos=this._moveInRoom(t,(next.x-t.x)/Math.max(d,EPS)*step,(next.z-t.z)/Math.max(d,EPS)*step,.23);t.x=pos.x;t.z=pos.z;if(distance(t,next)<.055)p.route.shift();
    }
    if(!p.route.length&&p.arrivedAt===null){p.arrivedAt=this.elapsed;if(m){m.lastVisit=clean(this.elapsed);m.visits++;}}
    if(m&&p.arrivedAt!==null&&this.elapsed-p.arrivedAt>2&&p.intent!=='catch'){m.noise=Math.max(0,m.noise-dt*.9);p.until=Math.min(p.until,this.elapsed);}
    if(!obscured&&p.intent==='catch'&&m&&!m.detained&&!this._cast&&this._turnLeft<=EPS&&this.elapsed>=this._nextCastAt&&t.stamina>0){
      const actor=this.students[m.id];if(distance(t,actor)<3.25&&this._canSee(t,actor,this.smokes)){this._cast={id:actor.id,time:0,aim:{x:actor.x,y:floorHeight(actor.x,actor.z,this.map)+(actor.crouched&&!actor.seated?CRAWL_TUNING.aimHeight:actor.seated?1.45:1.55),z:actor.z}};}
    }
    if(this._cast){this._cast.time+=dt;t.castProgress=clamp(this._cast.time/DEVELOPMENT_TUNING.chalkWindup,0,1);if(this._cast.time+EPS>=DEVELOPMENT_TUNING.chalkWindup){const id=this._cast.id,origin={x:t.x,y:floorHeight(t.x,t.z,this.map)+TEACHER_EYE_HEIGHT,z:t.z},aim=this._cast.aim,dx=aim.x-origin.x,dy=aim.y-origin.y,dz=aim.z-origin.z,length=Math.hypot(dx,dy,dz)||1;this.chalks.push({id:this._chalkId++,...origin,vx:dx/length*16,vy:dy/length*16,vz:dz/length*16,age:0});this._events.push({type:'chalk',studentId:id,targetId:id});this._cast=null;this._nextCastAt=this.elapsed+.9;t.castProgress=0;p.until=0;this._thinkAt=0;}}
    const phase=this._turnLeft>EPS?'turning':this._cast?'watching':p.route.length?'patrol':p.intent==='write'?'board':'watching';
    if(t.phase!==phase){t.phase=phase;t.phaseTime=0;}else t.phaseTime+=dt;
    t.warning=phase==='turning';t.phaseDuration=phase==='turning'?.7:this._cast?.7:Math.max(1,p.until-p.since);t.walkProgress=p.routeLength?clamp(1-p.route.reduce((sum,v,i)=>sum+distance(i?p.route[i-1]:t,v),0)/p.routeLength,0,1):0;
  }
  _advanceChalk(dt){
    for(const c of this.chalks){
      const next={x:c.x+c.vx*dt,y:c.y+c.vy*dt,z:c.z+c.vz*dt};c.age+=dt;c.vy-=1.6*dt;
      const hit=chalkHit(c,next,this.students,this.books,this.map,this.layout);
      if(hit){
        c.x+=(next.x-c.x)*hit.t;c.y+=(next.y-c.y)*hit.t;c.z+=(next.z-c.z)*hit.t;c.dead=true;
        if(hit.kind==='student'&&this.stage==='class'){
          const s=this.students[hit.id];this._stun(s);
        }
        this._events.push({type:'chalk-hit',kind:hit.kind,x:c.x,y:c.y,z:c.z});
      }else Object.assign(c,next);
      if(c.age>1.3||c.y<floorHeight(c.x,c.z,this.map)+.02||Math.abs(c.x)>50||Math.abs(c.z)>50)c.dead=true;
    }
    this.chalks=this.chalks.filter(c=>!c.dead);
  }
  _stopActor(actor){
    this._cancelBubble(actor);
    const held=actor._slots[actor._drawnSlot];if(held&&(held.heldBy===undefined||held.heldBy===actor.id)){if(held.heldBy===actor.id)delete held.heldBy;if(FOOD_ACTIONS.includes(held.action)||CLASSROOM_ACTIONS[held.action]?.releaseToUse)held.progress=0;}actor._eating=false;
    // The pen belongs to the desktop. A forced release returns it there;
    // leaving its temporary inventory entry stranded made it unrecoverable.
    const pen=actor._slots.findIndex(slot=>slot.temporary&&slot.action==='pen');
    if(pen>=0&&actor._penTaken){actor._slots.splice(pen,1);this.penOwners.delete(actor._penSeatId);actor._penSeatId=null;actor._penTaken=false;actor._penMode=null;actor._selectedSlot=0;actor.action=actor._slots[0]?.action||'snack';if(actor.isPlayer)this.selected=actor.action;}
    resetComputerPlayback(actor);actor._computerActive=false;actor.holding=false;actor._drawerOpen=false;actor._drawnSlot=null;actor.progress=0;this._finishHeldItem(actor);
    if(actor.isPlayer){this.holding=false;this._movement={x:0,z:0};this.setRescue(null);}
  }
  _stun(actor){
    if(!actor||this._restrained(actor))return false;
    this._stopActor(actor);actor.seated=false;actor.seatId=null;actor.captivity='stunned';actor.crouched=false;actor._chalkUntil=this.elapsed+5;actor._restUntil=actor._chalkUntil;actor.mood='stunned';
    this._events.push({type:'stunned',studentId:actor.id});return true;
  }
  _grab(actor){
    if(!actor||this.teacher.carriedId!==null||actor.captivity!=='stunned'||this.elapsed>=actor._chalkUntil||distance(this.teacher,actor)>1.55||!this._clearWallSegment(this.teacher,actor))return false;
    this._stopActor(actor);actor.captivity='carried';actor.seated=false;actor.seatId=null;actor.crouched=false;actor._grabAt=this.elapsed;actor._grabStart={x:actor.x,z:actor.z};
    this.teacher.carriedId=actor.id;this._escortRoute=null;this._escortPost=null;
    this._events.push({type:'grabbed',studentId:actor.id});return true;
  }
  _bind(postId){
    const actor=this.students[this.teacher.carriedId],post=DETENTION.find(p=>p.id===postId);
    if(!actor||!post||distance(this.teacher,post)>1.55||!this._clearWallSegment(this.teacher,post)||this.students.some(s=>s.captivity==='bound'&&s.postId===post.id))return false;
    actor.captivity='bound';actor.caught=true;actor.postId=post.id;actor.x=post.x;actor.z=post.z-.39;actor.yaw=Math.PI;actor._boundAt=this.elapsed;actor._chalkUntil=0;actor.mood='bound';
    this._cancelBubble(actor,true);actor._bubbleNextAt=this.elapsed+(actor.isPlayer||actor.networkHuman||!this._team.has(actor.id)?Infinity:this._range(.8,2.4));
    this.teacher.carriedId=null;this._escortRoute=null;this._escortPost=null;this._plan.until=0;this._thinkAt=0;
    const memory=this._memory.get(actor.id);if(memory){memory.detained=true;memory.x=actor.x;memory.z=actor.z;}
    this._events.push({type:'bound',studentId:actor.id});
    if(this._team.has(actor.id)){
      this.teacher.stamina=Math.min(100,(this.teacher.stamina??100)+20);
      this._events.push({type:'correct-capture',studentId:actor.id,recovery:20});
    }else{
      this.teacher.stamina=Math.max(0,(this.teacher.stamina??100)-40);this.wrongGrabs=(this.wrongGrabs||0)+1;
      this._events.push({type:'wrong-grab',studentId:actor.id,penalty:40});
    }
    // Resolve at the fixed tick boundary, after that tick's scoring. This is
    // not a grace period: five captures still lose unless the goal is reached.
    this._pendingAllCaught=[...this._team].every(id=>this.students[id].captivity==='bound');return true;
  }
  _release(actor,rescuer=null){
    if(!actor)return false;
    this._cancelBubble(actor,true);this._pendingAllCaught=false;
    actor.captivity='free';actor.caught=false;actor.postId=null;actor._chalkUntil=0;actor._restUntil=this.elapsed+2;actor.mood='walking';
    if(this.teacher.carriedId===actor.id)this.teacher.carriedId=null;
    this._memory.delete(actor.id);this._plan.until=0;this._thinkAt=0;
    // Releasing a carried pupil also invalidates the old pursuit. A stunned
    // teacher cannot run its planner immediately to clear these stale targets.
    if(this.teacher.targetId===actor.id)this.teacher.targetId=null;
    if(this._plan.targetId===actor.id){this._plan.targetId=null;this._plan.route=[];}
    if(this._cast?.id===actor.id)this._cast=null;
    this._escortRoute=null;this._escortPost=null;
    if(!actor.isPlayer&&!actor.networkHuman)actor._returnRoute=this._walkRoute(actor,this.seats[actor.id]);
    this._events.push({type:'rescued',studentId:actor.id,rescuerId:rescuer?.id??null});return true;
  }
  rescueTarget(actor=this.player){
    if(this._restrained(actor)||actor.seated)return null;
    return this.students.filter(s=>s.captivity==='bound'&&this._team.has(s.id)&&distance(actor,s)<1.65&&Math.abs(angle(heading(actor,s)-actor.yaw))<.62&&this._canSee({...actor,viewRange:1.65,fov:75},s,this.smokes)).sort((a,b)=>distance(actor,a)-distance(actor,b))[0]||null;
  }
  setRescue(id){
    if(id===null){this._rescueId=null;this._rescueProgress=0;return false;}
    if(!this._classInputAllowed()||this.rescueTarget()?.id!==id)return false;
    this._stopActor(this.player);this._rescueId=id;this._rescueProgress=0;return true;
  }
  _advanceCaptivity(dt){
    for(const s of this.students)if(s.captivity==='stunned'&&this.elapsed+EPS>=s._chalkUntil){s.captivity='free';s.mood='reading';}
    const s=this.students[this.teacher.carriedId];
    if(s){const t=this.teacher,forward=.60,right=-.42,target={x:t.x+Math.sin(t.yaw)*forward+Math.cos(t.yaw)*right,z:t.z+Math.cos(t.yaw)*forward-Math.sin(t.yaw)*right};
      const blend=clamp((this.elapsed-s._grabAt)/.32,0,1),ease=blend*blend*(3-2*blend);s.x=s._grabStart.x+(target.x-s._grabStart.x)*ease;s.z=s._grabStart.z+(target.z-s._grabStart.z)*ease;s.yaw+=angle(t.yaw+Math.PI-s.yaw)*(1-Math.exp(-dt*14));
    }
    if(this._rescueId!==null){const target=this.rescueTarget();if(target?.id!==this._rescueId){this.setRescue(null);return;}this._rescueProgress=clamp(this._rescueProgress+dt/RESCUE_DURATION,0,1);if(this._rescueProgress>=1-EPS){this._release(target,this.player);this.setRescue(null);}}
  }
  _follow(actor,route,speed,dt,radius=.20){
    if(!route?.length)return true;
    let budget=Math.max(0,speed*dt);
    while(route.length&&budget>EPS){
      const p=route[0],d=distance(actor,p);if(d<EPS){route.shift();continue;}
      const step=Math.min(d,budget),pos=this._moveInRoom(actor,(p.x-actor.x)/d*step,(p.z-actor.z)/d*step,radius);
      actor.yaw=heading(actor,p);actor.x=pos.x;actor.z=pos.z;budget-=step;
      // Consume waypoints only on arrival. The previous 7 cm shortcut also
      // snapped the last step into the chair, exceeding the advertised speed.
      if(distance(actor,p)<1e-8)route.shift();else break;
    }
    return !route.length;
  }
  _advanceStunChase(dt){
    if(this._teacherVisionObscured())return false;
    const s=this.students.find(s=>s.captivity==='stunned'&&this._memory.get(s.id)?.confirmed);if(!s)return false;
    const t=this.teacher;t.phase='patrol';t.warning=false;t.intent='grab';t.targetId=s.id;t.castProgress=0;
    if(distance(t,s)<1.5&&this._canSee({...t,fov:360},s,this.smokes)){t.yaw=heading(t,s);this._grab(s);return true;}
    if(!s._approachRoute?.length)s._approachRoute=this._walkRoute(t,s);
    this._follow(t,s._approachRoute,AI_WALK_SPEEDS.teacherPursuit,dt);return true;
  }
  _advanceEscort(dt){
    const t=this.teacher;t.phase='patrol';t.intent='escort';t.warning=false;t.castProgress=0;
    if(!this._escortRoute){this._escortPost=DETENTION.find(p=>!this.students.some(s=>s.captivity==='bound'&&s.postId===p.id));if(!this._escortPost)return;this._escortRoute=this._walkRoute(t,{x:this._escortPost.x,z:this._escortPost.z-1.1});}
    if(this._follow(t,this._escortRoute,AI_WALK_SPEEDS.teacherEscort,dt)){t.yaw=0;this._bind(this._escortPost.id);}
  }
  _advanceRescuer(s,dt){
    if(s._returnRoute){s.holding=false;s.mood='walking';const seat=this.seats[s.id];if(!s._returnRoute.length&&distance(s,seat)>1e-8){s._returnRoute=this._walkRoute(s,seat);if(!s._returnRoute.length)return true;}if(this._follow(s,s._returnRoute,AI_WALK_SPEEDS.student,dt)){s._returnRoute=null;s.x=seat.x;s.z=seat.z;s.yaw=seat.yaw;s.seatYaw=seat.yaw;s.seatId=s.id;s.seated=true;s._decisionAt=this.elapsed+3;}return true;}
    let target=this.students[s._rescueTarget];
    if(!target||target.captivity!=='bound'){s._rescueTarget=null;s._rescueRoute=null;s._helpProgress=0;target=null;}
    if(!target&&s.isTeammate&&s._decisionAt!==Infinity){
      target=this.students.find(a=>a.captivity==='bound'&&this._team.has(a.id)&&this.elapsed-a._boundAt>3&&distance(this.teacher,a)>2.8&&!this.students.some(b=>b!==s&&b._rescueTarget===a.id));
      if(target){s._rescueTarget=target.id;this._stopActor(s);s.seated=false;s.seatId=null;s._rescueRoute=this._walkRoute(s,{x:target.x,z:target.z-.7});}
    }
    if(!target)return false;
    s.mood='walking';s.holding=false;
    if(distance(s,target)>.95||!this._clearWallSegment(s,target)){s._helpProgress=0;this._follow(s,s._rescueRoute,AI_WALK_SPEEDS.student,dt);return true;}
    s.yaw=heading(s,target);s.mood='rescuing';s._helpProgress=(s._helpProgress||0)+dt;
    if(s._helpProgress>=1.6){this._release(target,s);s._rescueTarget=null;s._rescueRoute=null;s._helpProgress=0;s._returnRoute=this._walkRoute(s,this.seats[s.id]);}return true;
  }
  _advance(dt){
    const teacherBefore={x:this.teacher.x,z:this.teacher.z};
    this.elapsed+=dt;this._stageElapsed+=dt;this._sessionElapsed+=dt;this._advanceDoorUse(dt);this._advanceArrivals(dt);this._refillDrawers();
    for(const b of this.books)b.amount=clamp(b.amount+(b.raised?1:-1)*dt*4,0,1);
    for(const s of this.students)s.bookCover=s.seated?(this.books[s.seatId]?.amount||0):0;
    this._advanceSmoke(dt);
    this._advanceBubbles(dt);this._advanceNovelItems(dt);
    if(!this.player.seated&&!this._restrained()){const speed=this.teacher.carriedId!==null&&this.player.id===-1?NORMAL_WALK_SPEEDS.teacherCarrying:this.player.crouched?DEVELOPMENT_TUNING.crouchSpeed:normalWalkSpeed(this.player),pos=this._moveInRoom(this.player,this._movement.x*speed*dt*movementScale(this.player,this._movement),this._movement.z*speed*dt*movementScale(this.player,this._movement));this.player.x=pos.x;this.player.z=pos.z;}
    this._advanceTeacher(dt);spendTeacherMovement(this.teacher,teacherBefore,dt);this._advanceChalk(dt);this._advanceCaptivity(dt);if(this.status!=='playing')return;
    this._perceive(dt);this._advanceStudents(dt);
    if(this.status==='playing'&&this._pendingAllCaught){this._pendingAllCaught=false;if(this.score>=this.target)this._finish('won','mischief');else if([...this._team].every(id=>this.students[id].captivity==='bound'))this._finish('lost','all-caught');}
    if(this.status==='playing'&&this.elapsed+EPS>=this.duration)this._finish('lost','timeout');
  }
  _finish(status,reason){if(this.status!=='playing')return;this.status=status;this.resultReason=reason;this.paused=false;this.holding=false;this.player.holding=false;this._movement={x:0,z:0};this._pendingAllCaught=false;for(const s of this.students){s.holding=false;this._cancelBubble(s,true);}this._events.push({type:'finish',status,reason,score:this.score});}
}
