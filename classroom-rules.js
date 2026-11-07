import {createSmokeProjectile,stepSmokeProjectile,smokeEnvelope} from './smoke-physics.js?v=map-30c';
import { ROOM, SEATS, PLAYER_SEAT, FRIEND_SEATS, COVERED_SEATS, AISLES, BOARD, DETENTION, moveInRoom, walkRoute, blocked, clearWallSegment, CAMPUS_MAPS } from './classroom-layout.js?v=map-30c';

/** Local prototype tuning, NOT verified original-game balance values. */
export const DEVELOPMENT_TUNING = Object.freeze({ target:100, fov:110, viewRange:9, evidenceRate:38, evidenceDecay:.45, chalkWindup:.7, smokeDuration:7, smokeRadius:1.9, walkSpeed:1.8, crouchSpeed:.85, teammateRestMin:3, teammateRestMax:7, drawerRefill:3 });
export const CLASSROOM_ACTIONS = Object.freeze({
  snack:Object.freeze({duration:3,points:2,risk:1,noise:.85,label:'偷吃零食'}),
  note:Object.freeze({duration:3,points:2.5,risk:.82,noise:.45,label:'传纸条'}),
  phone:Object.freeze({duration:3,points:3.5,risk:1.3,noise:.12,label:'玩手机'}),
  computer:Object.freeze({duration:3,points:2.5,risk:1.15,noise:.35,label:'偷偷玩电脑'}),
  smoke:Object.freeze({duration:1.2,releaseToUse:true,points:0,risk:1,noise:.2,label:'烟雾弹'}),
});
const STEP=1/60, EPS=1e-9, TAU=Math.PI*2, ACTION_KEYS=['snack','note','phone','smoke'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const clean=n=>Math.round(n*1e6)/1e6;
const angle=n=>Math.atan2(Math.sin(n),Math.cos(n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const heading=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
const valid=n=>typeof n==='number'&&Number.isFinite(n);
function seedNumber(value){if(valid(value))return value>>>0;let h=2166136261;for(const c of String(value??73))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function segmentDistance(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/l,0,1):0;return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);}
/** Geometry only: +Z is yaw 0. Smoke blocks the actual observer-to-target segment. */
export function canSee(observer,target,smokes=[]){
  if(distance(observer,target)>(observer.viewRange??DEVELOPMENT_TUNING.viewRange))return false;
  if(Math.abs(angle(heading(observer,target)-observer.yaw))>(observer.fov??DEVELOPMENT_TUNING.fov)*Math.PI/360)return false;
  return clearWallSegment(observer,target)&&!smokes.some(s=>s.remaining>0&&(s.density??1)>.3&&segmentDistance(s,observer,target)<s.radius);
}
/** Upright desk books reduce distant frontal prop visibility, not all visibility. */
export function propVisibility(observer,target,smokes=[]){
  if(!canSee(observer,target,smokes))return 0;
  const d=distance(observer,target);
  if(!target.seated)return target.crouched?.72:1;
  const front=Math.cos(heading(target,observer)); // Desks/books face +Z, independently of head look.
  const book=front>.52&&d>2.35?.22:front>.2&&d>2.35?.55:1;
  const cover=target.bookCover??(target.bookRaised===false?0:1);
  return (1-(1-book)*cover)*(target.crouched&&d>2.1?.45:1);
}

export class ClassroomRound{
  constructor({seed=73,duration=Infinity,target=DEVELOPMENT_TUNING.target,map='classroom'}={}){
    this.map=CAMPUS_MAPS.includes(map)?map:'classroom';
    this.seed=seedNumber(seed);this.duration=valid(duration)&&duration>0?Math.min(duration,3600):Infinity;
    this.target=valid(target)&&target>0?Math.min(target,100000):DEVELOPMENT_TUNING.target;this.reset();
  }
  reset(seed){
    if(seed!==undefined)this.seed=seedNumber(seed);this._rng=this.seed;this._drawerRng=(this.seed^0xA341316C)>>>0;
    this.status='ready';this.paused=false;this.elapsed=0;this.score=0;this.strikes=0;this.resultReason=null;
    this.selected='snack';this.holding=false;this.completed={snack:0,note:0,phone:0,smoke:0,computer:0};
    this.smokes=[];this.projectiles=[];this._events=[];this._accumulator=0;this._movement={x:0,z:0};this._lastObservation=-Infinity;this._smokeId=0;
    this._team=new Set([PLAYER_SEAT,...FRIEND_SEATS]);
    this.books=SEATS.map(s=>({id:s.id,raised:COVERED_SEATS.includes(s.id),amount:COVERED_SEATS.includes(s.id)?1:0}));
    const personalities=['cautious','bold','helpful','distractible'];
    const profiles=[{caution:.96,helpful:.65,distraction:.10},{caution:.28,helpful:.35,distraction:.18},{caution:.68,helpful:.98,distraction:.12},{caution:.48,helpful:.55,distraction:.75}];
    this.students=SEATS.map(seat=>{
      const friend=FRIEND_SEATS.indexOf(seat.id), profile=friend>=0?profiles[friend]:null;
      return {id:seat.id,seatId:seat.id,x:seat.x,z:seat.z,yaw:0,pitch:0,seated:true,crouched:false,caught:false,captivity:'free',postId:null,_chalkUntil:0,_struggleAt:-100,isPlayer:seat.id===PLAYER_SEAT,isTeammate:friend>=0,
        name:seat.id===PLAYER_SEAT?'你':friend>=0?['小满','阿杰','小雨','乐乐'][friend]:`${seat.row+1}排同学${seat.col+1}`,
        mood:'writing',action:null,holding:false,progress:0,personality:friend>=0?personalities[friend]:'ordinary',completed:{snack:0,note:0,phone:0,smoke:0,computer:0},_computerActive:false,_computerProgress:0,
        _profile:profile,_slots:this._team.has(seat.id)?Array.from({length:3},(_,id)=>({id,action:this._drawItem(),readyAt:0,progress:0})):[],_selectedSlot:0,_drawerOpen:false,_drawnSlot:null,_noise:0,_decisionAt:this._range(.15,1.8),_idleAt:this._range(1,7),_speed:this._range(.65,.9),_preference:this._random(),_exposure:0,_restUntil:0};
    });
    if(this.map==='computer')for(const b of this.books){b.raised=false;b.amount=0;}
    this.player=this.students[PLAYER_SEAT];this.selected=this.player._slots[0].action;this.player.action=this.selected;
    this.teacher={fov:this.map==='night'?49:DEVELOPMENT_TUNING.fov,viewRange:this.map==='night'?12:DEVELOPMENT_TUNING.viewRange,x:BOARD.x,z:BOARD.z,yaw:0,phase:'board',phaseTime:0,phaseDuration:1,intent:'write',targetId:null,looking:false,warning:false,attention:0,walkProgress:0,castProgress:0,carriedId:null};
    this._memory=new Map();this._plan={intent:'write',targetId:null,since:0,until:3,route:[],routeLength:0,arrivedAt:null,utility:0};
    this._turnLeft=0;this._thinkAt=0;this._lastScan=0;this._writingNeed=.8;this._cast=null;this._rescueId=null;this._rescueProgress=0;this._escortRoute=null;this._escortPost=null;
    return this.snapshot();
  }
  start(){if(this.status==='ready'){this.status='playing';this._observe('round-start',null,'课堂开始，捣乱值由实际行动积累。');}return this.snapshot();}
  _inputAllowed(){return this.status==='playing'&&!this.paused;}
  _restrained(actor=this.player){return actor.caught||['stunned','carried','bound'].includes(actor.captivity);}
  toggleDrawer(){
    if(!this._inputAllowed()||this._restrained()||!this.player.seated)return false;
    this.player._drawerOpen=!this.player._drawerOpen;return true;
  }
  toggleBook(){
    const p=this.player;if(!this._inputAllowed()||this._restrained(p)||!p.seated)return false;
    this.books[p.seatId].raised=!this.books[p.seatId].raised;return true;
  }
  selectSlot(index){
    const p=this.player,slot=p._slots[index];
    if(!Number.isInteger(index)||!slot?.action||this.paused||this._restrained(p)||!p.seated||!['ready','playing'].includes(this.status))return false;
    if(p._drawnSlot!==null&&index!==p._drawnSlot)return false;
    p._selectedSlot=index;this.selected=slot.action;p.action=slot.action;p.progress=slot.progress;return true;
  }
  selectAction(action){
    if(!Object.hasOwn(CLASSROOM_ACTIONS,action))return false;
    const p=this.player,current=p._slots[p._selectedSlot];
    return this.selectSlot(current?.action===action?p._selectedSlot:p._slots.findIndex(slot=>slot.action===action));
  }
  takeSlot(index){
    const p=this.player;
    if(!this._inputAllowed()||this._restrained(p)||!p.seated||!p._drawerOpen||p._drawnSlot!==null)return false;
    this.stopComputer();
    if(!this.selectSlot(index))return false;
    p._drawnSlot=index;this.hold(false);return true;
  }
  returnItem(){
    const p=this.player;
    if(!this._inputAllowed()||this._restrained(p)||!p.seated||p._drawnSlot===null)return false;
    this.hold(false);p._drawerOpen=true;p._drawnSlot=null;return true;
  }
  startComputer(){
    const p=this.player;if(!this._inputAllowed()||this.map!=='computer'||!p.seated||this._restrained(p)||p._drawnSlot!==null)return false;
    p._computerActive=true;p.action='computer';p._drawerOpen=false;this.selected='computer';return true;
  }
  stopComputer(){
    const p=this.player;if(!p._computerActive)return false;
    p._computerActive=false;p.holding=false;this.holding=false;this.selected=p._slots[p._selectedSlot]?.action||'snack';p.action=this.selected;return true;
  }
  hold(value){
    if(typeof value!=='boolean')return false;
    const p=this.player;
    if(value&&this._inputAllowed()&&this._restrained(p)){p._struggleAt=this.elapsed;return false;}
    if(!value){this.holding=false;p.holding=false;const slot=p._slots[p._selectedSlot];if(slot?.action==='smoke'){slot.progress=0;p.progress=0;}return false;}
    if(this._inputAllowed()&&!this._restrained(p)&&p.seated&&p._computerActive){this.selected=p.action='computer';this.holding=p.holding=true;return true;}
    const slot=p._slots[p._selectedSlot];
    if(!this._inputAllowed()||this._restrained(p)||!slot?.action||p._drawnSlot!==p._selectedSlot)return false;
    this.selected=slot.action;p.action=slot.action;this.holding=true;p.holding=true;return true;
  }
  // Only an intentional mouse/touch release throws. Pause, blur, Q and pointer
  // cancellation call hold(false), keeping the grenade and clearing its charge.
  releaseUse(){
    const p=this.player,slot=p._slots[p._selectedSlot];
    if(this._inputAllowed()&&!this._restrained(p)&&this.holding&&slot?.action==='smoke'&&p._drawnSlot===p._selectedSlot){
      this._completeAction(p,slot);return true;
    }
    this.hold(false);return false;
  }
  setMovement(x,z){if(!valid(x)||!valid(z)||!this._inputAllowed()||this._restrained())return false;const n=Math.max(1,Math.hypot(x,z));this._movement={x:clamp(x/n,-1,1),z:clamp(z/n,-1,1)};return true;}
  setLook(yaw,pitch){if(!valid(yaw)||!valid(pitch)||!this._inputAllowed())return false;this.player.yaw=angle(yaw);this.player.pitch=clamp(pitch,-1.3,1.3);return true;}
  setCrouch(value){if(typeof value!=='boolean'||!this._inputAllowed()||this._restrained())return false;this.player.crouched=value;return true;}
  interact(){
    if(!this._inputAllowed()||this._restrained())return false;
    const p=this.player;
    if(p.seated){this.stopComputer();p._drawerOpen=false;p.seated=false;p.seatId=null;this._observe('stand',p.id,'已离开座位；持物移动不会增加捣乱值。');return 'stood';}
    const occupied=new Set(this.students.filter(s=>s.seated&&!s.caught).map(s=>s.seatId));
    const seat=SEATS.filter(s=>!occupied.has(s.id)&&distance(p,s)<1.05).sort((a,b)=>distance(p,a)-distance(p,b))[0];
    if(!seat)return false;
    p.x=seat.x;p.z=seat.z;p.seated=true;p.seatId=seat.id;p.crouched=false;this._movement={x:0,z:0};this._observe('sit',p.id,'已坐下。');return 'seated';
  }
  pause(value=true){if(typeof value!=='boolean'||this.status!=='playing')return this.snapshot();if(value!==this.paused){this.hold(false);this._movement={x:0,z:0};this._accumulator=0;}this.paused=value;return this.snapshot();}
  /** Fixed-step simulation; a single caller delta is bounded to 30s for safety. */
  step(dt){
    if(!this._inputAllowed()||!valid(dt)||dt<=0)return this.snapshot();
    this._accumulator+=Math.min(dt,30,Math.max(0,this.duration-this.elapsed));
    while(this.status==='playing'){
      const tick=Math.min(STEP,this.duration-this.elapsed);if(this._accumulator+EPS<tick)break;
      this._accumulator=Math.max(0,this._accumulator-tick);this._advance(tick);
    }
    if(this.status!=='playing')this._accumulator=0;return this.snapshot();
  }
  snapshot(){
    const p=this.player,t=this.teacher,m=this._memory.get(p.id);
    const capture=s=>({captivity:s.captivity||'free',postId:s.postId??null,stunLeft:clean(Math.max(0,(s._chalkUntil||0)-this.elapsed)),struggleAge:this.elapsed-(s._struggleAt??-100)});
    return {role:'student',map:this.map,status:this.status,paused:this.paused,seed:this.seed,elapsed:clean(this.elapsed),timeLeft:Number.isFinite(this.duration)?clean(Math.max(0,this.duration-this.elapsed)):0,timed:Number.isFinite(this.duration),score:this.score,target:this.target,strikes:this.strikes,resultReason:this.resultReason,
      suspicion:clean(m?.evidence||0),holding:this.holding,selected:this.selected,actionProgress:clean(p._computerActive?p._computerProgress:p._slots[p._selectedSlot]?.progress||0),completed:{...this.completed},drawer:this._drawerSnapshot(p),caughtCount:this.students.filter(s=>this._team.has(s.id)&&s.caught).length,teamSize:5,
      posts:DETENTION.map(post=>({...post,studentId:this.students.find(s=>s.captivity==='bound'&&s.postId===post.id)?.id??null})),rescue:{id:this._rescueId,progress:this._rescueProgress},rescueAim:this.rescueTarget()?.id??null,
      books:this.books.map(b=>({...b,amount:clean(b.amount)})),
      player:{...capture(p),computerActive:Boolean(p._computerActive),bookRaised:p.seated?this.books[p.seatId].raised:false,id:p.id,x:clean(p.x),z:clean(p.z),yaw:clean(p.yaw),pitch:clean(p.pitch),seated:p.seated,crouched:p.crouched,caught:p.caught,seatId:p.seatId},
      teacher:{...t,x:clean(t.x),z:clean(t.z),yaw:clean(t.yaw),phaseTime:clean(t.phaseTime),phaseDuration:clean(t.phaseDuration),castProgress:clean(t.castProgress),attention:clean(t.attention),walkProgress:clean(t.walkProgress),observedIds:[...this._memory.keys()],memory:[...this._memory.values()].map(m=>({id:m.id,evidence:clean(m.evidence),suspicion:clean(m.evidence),noise:clean(m.noise),confirmed:m.confirmed,detained:m.detained,lastSeen:m.lastSeen,lastHeard:m.lastHeard,lastVisit:m.lastVisit,visits:m.visits,x:clean(m.x),z:clean(m.z)}))},
      students:this.students.map(s=>({...capture(s),computerActive:Boolean(s._computerActive),bookRaised:s.seated?this.books[s.seatId].raised:false,id:s.id,seatId:s.seatId,x:clean(s.x),z:clean(s.z),yaw:clean(s.yaw),seated:s.seated,crouched:s.crouched,isPlayer:s.isPlayer,isTeammate:s.isTeammate,caught:s.caught,mood:s.mood,action:s.action,holding:s.holding,progress:clean(s.progress),name:s.name,personality:s.personality,completed:{...s.completed},...(this._team.has(s.id)?{drawer:this._drawerSnapshot(s)}:{})})),
      projectiles:this.projectiles.map(p=>({...p})),smokes:this.smokes.map(s=>({...s,remaining:clean(s.remaining)}))};
  }
  drainEvents(){const events=this._events;this._events=[];return events;}
  _random(){let t=this._rng=(this._rng+0x6D2B79F5)>>>0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
  _range(a,b){return a+(b-a)*this._random();}
  _drawItem(){
    // A separate seeded stream keeps opening the drawer from changing AI choices.
    // Sampling with replacement permits two or three copies of the same object.
    let t=this._drawerRng=(this._drawerRng+0x6D2B79F5)>>>0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);
    return ACTION_KEYS[Math.floor((((t^t>>>14)>>>0)/4294967296)*ACTION_KEYS.length)];
  }
  _drawerSnapshot(actor){return{open:actor._drawerOpen,slots:actor._slots.map(slot=>({id:slot.id,action:slot.action,readyIn:slot.action?0:clean(Math.max(0,slot.readyAt-this.elapsed))})),selectedSlot:actor._selectedSlot,drawnSlot:actor._drawnSlot};}
  _refillDrawers(){
    for(const s of this.students)for(const slot of s._slots){
      if(slot.action||slot.readyAt>this.elapsed+EPS)continue;
      slot.action=this._drawItem();slot.readyAt=0;slot.progress=0;
      if(slot.id===s._selectedSlot){s.action=slot.action;s.progress=0;if(s.isPlayer)this.selected=slot.action;}
    }
  }
  _observe(fact,id,text){if(this.elapsed-this._lastObservation<2.4)return;this._lastObservation=this.elapsed;this._events.push({type:'observation',fact,studentId:id,text});}
  _remember(actor){let m=this._memory.get(actor.id);if(!m){m={id:actor.id,x:actor.x,z:actor.z,evidence:0,noise:0,confirmed:false,detained:false,lastSeen:null,lastHeard:null,lastVisit:null,visits:0};this._memory.set(actor.id,m);}return m;}
  _hear(actor,strength,source='object'){
    const d=distance(this.teacher,actor);if(d>11)return;
    const m=this._remember(actor);m.noise=Math.min(5,m.noise+strength*(1-d/15));m.lastHeard=clean(this.elapsed);m.x=actor.x;m.z=actor.z;
    this._observe('noise-heard',actor.id,`${actor.name}所在位置传来声响。`);
  }
  _throwSmoke(actor,charge){
    const projectile=createSmokeProjectile(actor,this._smokeId++,charge,this.map);this.projectiles.push(projectile);
    this._hear(actor,.35,'throw');this._events.push({type:'smoke-throw',studentId:actor.id,x:projectile.x,y:projectile.y,z:projectile.z});
  }
  _completeAction(actor,slot){
    const kind=slot.action,action=CLASSROOM_ACTIONS[kind],charge=slot.progress;
    slot.progress=0;slot.action=null;slot.readyAt=this.elapsed+DEVELOPMENT_TUNING.drawerRefill;
    actor.progress=0;actor.completed[kind]++;actor.holding=false;actor._drawnSlot=null;
    if(actor.isPlayer){this.completed[kind]++;this.holding=false;}
    if(kind==='smoke')this._throwSmoke(actor,charge);
    const points=Math.min(action.points,this.target-this.score);this.score+=points;
    this._events.push({type:'complete',actor:actor.isPlayer?'player':'ai',studentId:actor.id,speaker:actor.name,action:kind,slotId:slot.id,points,score:this.score});
    if(actor.isTeammate)actor._restUntil=this.elapsed+this._range(DEVELOPMENT_TUNING.teammateRestMin,DEVELOPMENT_TUNING.teammateRestMax)+actor._profile.caution*3+this._localRisk(actor)*2;
    if(this.score>=this.target)this._finish('won','mischief');
  }
  _advanceSmoke(dt){
    for(const smoke of this.smokes){smoke.remaining-=dt;smoke.age+=dt;Object.assign(smoke,smokeEnvelope(smoke.age,smoke.remaining));}
    this.smokes=this.smokes.filter(s=>s.remaining>EPS);
    for(const p of this.projectiles){
      for(const impact of stepSmokeProjectile(p,dt))this._events.push({type:'smoke-impact',...impact,studentId:p.ownerId});
      if(!p.emitting&&p.settled&&p.restTime+EPS>=.5){
        p.emitting=true;p.expiresAt=this.elapsed+DEVELOPMENT_TUNING.smokeDuration;
        this.smokes.push({id:p.id,ownerId:p.ownerId,x:p.x,y:p.y,z:p.z,age:0,...smokeEnvelope(0,DEVELOPMENT_TUNING.smokeDuration),remaining:DEVELOPMENT_TUNING.smokeDuration});
        this._events.push({type:'smoke-bloom',studentId:p.ownerId,x:p.x,y:p.y,z:p.z});
      }
    }
    this.projectiles=this.projectiles.filter(p=>!p.emitting||p.expiresAt>this.elapsed);
  }
  _localRisk(actor){
    if(!canSee(this.teacher,actor,this.smokes)){
      const delta=Math.abs(angle(heading(this.teacher,actor)-this.teacher.yaw));
      return this.teacher.warning&&distance(this.teacher,actor)<7&&delta<2?.35:0;
    }
    return clamp(propVisibility(this.teacher,actor,this.smokes)*(.6+2.6/Math.max(1,distance(this.teacher,actor))),0,1);
  }
  _advanceStudents(dt){
    for(const s of this.students){
      if(this._restrained(s)){s.holding=false;s.mood=s.captivity;continue;}
      if(s.isTeammate&&this._advanceRescuer(s,dt))continue;
      if(s.isPlayer){s.holding=this.holding;s.action=this.selected;s.mood=s.holding?s.action:s.seated?'writing':'walking';continue;}
      if(!s.isTeammate){
        if(this.elapsed>=s._idleAt){s.mood=['writing','reading','scratch','page'][Math.floor(this._random()*4)];s._idleAt=this.elapsed+this._range(2.3,7.5);if(s.mood==='page')this._hear(s,.12,'page');}
        continue;
      }
      // After a real action, each classmate watches the room and prepares again.
      // These personality/risk-dependent breaks pace play, without fake scoring.
      if(s._restUntil>this.elapsed){s.holding=false;s._drawnSlot=null;s._drawerOpen=false;s._computerActive=false;s.mood=this.elapsed<(s._chalkUntil||0)?'thinking':'reading';continue;}
      const risk=this._localRisk(s);s._exposure=Math.max(0,s._exposure+(s.holding&&risk>.4?dt:-dt*.6));
      if(this.elapsed<s._decisionAt)continue;
      s._decisionAt=this.elapsed+this._range(.16,.42);
      const profile=s._profile,near=distance(this.teacher,s),current=s._slots[s._selectedSlot],finishRisk=current?.action&&current.progress>.83;
      const threshold=.24+(1-profile.caution)*.55+(finishRisk&&!this.teacher.warning?.16:0);
      const smoke=s._slots.find(slot=>slot.action==='smoke');
      if(risk>.3&&smoke){s._computerActive=false;s._selectedSlot=smoke.id;s.action='smoke';s.progress=smoke.progress;s._drawnSlot=smoke.id;s._drawerOpen=true;s.holding=true;s.mood='smoke';continue;}
      if(risk>threshold||(this.teacher.warning&&profile.caution>.8)){s._computerActive=false;s.holding=false;s._drawnSlot=null;s._drawerOpen=false;s.mood='writing';continue;}
      if(this.map==='computer'&&s.seated){s._computerActive=true;s._drawnSlot=null;s._drawerOpen=false;s.action='computer';s.holding=true;s.mood='computer';continue;}
      if(profile.distraction>.5&&this._random()<.08){s.holding=false;s._drawnSlot=null;s._drawerOpen=false;s.mood='scratch';s._decisionAt+=1.2;continue;}
      if(!current?.action||current.progress<EPS){
        const choice=s._slots.filter(slot=>slot.action).map(slot=>({slot,utility:(slot.action==='smoke'?risk*.8-.35:1/CLASSROOM_ACTIONS[slot.action].duration)-CLASSROOM_ACTIONS[slot.action].noise*profile.caution/(near+1)*.7+(ACTION_KEYS.indexOf(slot.action)===Math.floor(s._preference*ACTION_KEYS.length)?.11:0)-s.completed[slot.action]*.025})).sort((a,b)=>b.utility-a.utility)[0];
        if(!choice){s.holding=false;s.mood='reading';continue;}
        s._selectedSlot=choice.slot.id;s.action=choice.slot.action;s.progress=choice.slot.progress;
      }
      s._drawnSlot=s._selectedSlot;s._drawerOpen=true;s.holding=true;s.mood=s.action;
    }
    for(const s of this.students){
      const slot=s._slots[s._selectedSlot];
      if(s.holding&&s._computerActive&&!s.caught&&s.seated){
        s.action='computer';s._computerProgress=Math.min(1,s._computerProgress+dt/3*(s.isPlayer?1:s._speed));s.progress=s._computerProgress;
        if(s._computerProgress+EPS>=1){
          s._computerProgress=0;s.completed.computer++;const points=Math.min(CLASSROOM_ACTIONS.computer.points,this.target-this.score);this.score+=points;
          if(s.isPlayer)this.completed.computer++;else{s._restUntil=this.elapsed+this._range(2,5);s.holding=false;s._computerActive=false;}
          this._events.push({type:'complete',actor:s.isPlayer?'player':'ai',studentId:s.id,action:'computer',points,score:this.score});if(this.score>=this.target){this._finish('won','mischief');return;}
        }
        continue;
      }
      if(this._restrained(s)||!s.holding||!s.action)continue;
      if(!slot?.action||slot.action!==s.action){s.holding=false;if(s.isPlayer)this.holding=false;continue;}
      const action=CLASSROOM_ACTIONS[s.action];
      s._noise+=dt*action.noise;if(s._noise>=1){s._noise-=1;this._hear(s,1);}
      // Carrying an object while walking is permitted, but earns no mischief.
      if(!s.seated&&s.action!=='smoke')continue;
      slot.progress=Math.min(1,slot.progress+dt/action.duration*(s.isPlayer?1:s._speed));s.progress=slot.progress;
      if(s.isPlayer&&action.releaseToUse)continue;
      if(s.progress+EPS>=1){
        this._completeAction(s,slot);if(this.status!=='playing')return;
      }
    }
  }
  _perceive(dt){
    const t=this.teacher;
    t.looking=!t.warning&&canSee(t,this.player,this.smokes);t.attention=t.looking?propVisibility(t,this.player,this.smokes):0;
    for(const s of this.students){
      if(this._restrained(s))continue;
      const seen=!t.warning&&canSee(t,s,this.smokes);
      let m=this._memory.get(s.id);
      if(seen){m=this._remember(s);m.lastSeen=clean(this.elapsed);m.x=s.x;m.z=s.z;}
      if(!m)continue;
      m.noise=Math.max(0,m.noise-dt*.10);
      if(m.confirmed||m.detained)continue;
      if(seen&&(s.holding||s._computerActive||(s.isPlayer&&s._drawnSlot!==null))&&s.action){
        const visibility=propVisibility(t,s,this.smokes),rate=DEVELOPMENT_TUNING.evidenceRate*CLASSROOM_ACTIONS[s.action].risk*visibility;
        const before=m.evidence;m.evidence=Math.min(100,m.evidence+rate*dt);
        if(before<20&&m.evidence>=20)this._observe('prop-seen',s.id,`老师看见了${s.name}的手部动作。`);
        if(m.evidence+EPS>=100){m.confirmed=true;m.evidence=100;this._observe('identified',s.id,`老师已认出${s.name}，正在靠近。`);this._thinkAt=0;}
      }else m.evidence=Math.max(0,m.evidence-dt*DEVELOPMENT_TUNING.evidenceDecay);
    }
  }
  _routeTo(point){
    const t=this.teacher;return walkRoute(t,point,.23).filter(p=>distance(t,p)>.06);
  }
  _setPlan(intent,targetId,point,utility){
    const route=point?this._routeTo(point):[],routeLength=route.reduce((sum,p,i)=>sum+distance(i?route[i-1]:this.teacher,p),0);
    this._plan={intent,targetId,since:this.elapsed,until:this.elapsed+(intent==='investigate'||intent==='revisit'||intent==='catch'?Math.min(18,routeLength/1.05+1.7):3),route,routeLength,arrivedAt:null,utility};
    this.teacher.intent=intent;this.teacher.targetId=targetId;this._turnLeft=.7;this.teacher.warning=true;
    if(intent==='scan')this._lastScan=this.elapsed;
    this._events.push({type:'warning',studentId:targetId,intent,duration:.7});
  }
  _think(){
    const t=this.teacher,plan=this._plan;
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
      const next=p.route[0],d=distance(t,next),step=Math.min(d,1.05*dt),pos=moveInRoom(t,(next.x-t.x)/Math.max(d,EPS)*step,(next.z-t.z)/Math.max(d,EPS)*step,.23);t.x=pos.x;t.z=pos.z;if(distance(t,next)<.055)p.route.shift();
    }
    if(!p.route.length&&p.arrivedAt===null){p.arrivedAt=this.elapsed;if(m){m.lastVisit=clean(this.elapsed);m.visits++;}}
    if(m&&p.arrivedAt!==null&&this.elapsed-p.arrivedAt>2&&p.intent!=='catch'){m.noise=Math.max(0,m.noise-dt*.9);p.until=Math.min(p.until,this.elapsed);}
    if(p.intent==='catch'&&m&&!m.detained&&!this._cast&&this._turnLeft<=EPS){
      const actor=this.students[m.id];if(distance(t,actor)<3.25&&canSee(t,actor,this.smokes)){this._cast={id:actor.id,time:0};actor.holding=false;if(actor.isPlayer)this.holding=false;}
    }
    if(this._cast){this._cast.time+=dt;t.castProgress=clamp(this._cast.time/DEVELOPMENT_TUNING.chalkWindup,0,1);if(this._cast.time+EPS>=DEVELOPMENT_TUNING.chalkWindup){const id=this._cast.id;this._events.push({type:'chalk',studentId:id,targetId:id});this._stun(this.students[id]);this._cast=null;t.castProgress=0;p.until=0;this._thinkAt=0;}}
    const phase=this._turnLeft>EPS?'turning':this._cast?'watching':p.route.length?'patrol':p.intent==='write'?'board':'watching';
    if(t.phase!==phase){t.phase=phase;t.phaseTime=0;}else t.phaseTime+=dt;
    t.warning=phase==='turning';t.phaseDuration=phase==='turning'?.7:this._cast?.7:Math.max(1,p.until-p.since);t.walkProgress=p.routeLength?clamp(1-p.route.reduce((sum,v,i)=>sum+distance(i?p.route[i-1]:t,v),0)/p.routeLength,0,1):0;
  }
  _stopActor(actor){
    actor._computerActive=false;actor.holding=false;actor._drawerOpen=false;actor._drawnSlot=null;actor.progress=0;
    if(actor.isPlayer){this.holding=false;this._movement={x:0,z:0};this.setRescue(null);}
  }
  _stun(actor){
    if(!actor||this._restrained(actor))return false;
    this._stopActor(actor);actor.captivity='stunned';actor._chalkUntil=this.elapsed+5;actor._restUntil=actor._chalkUntil;actor.mood='stunned';
    this._events.push({type:'stunned',studentId:actor.id});return true;
  }
  _grab(actor){
    if(!actor||this.teacher.carriedId!==null||actor.captivity!=='stunned'||this.elapsed>=actor._chalkUntil||distance(this.teacher,actor)>1.55||!clearWallSegment(this.teacher,actor))return false;
    this._stopActor(actor);actor.captivity='carried';actor.seated=false;actor.seatId=null;actor.crouched=false;actor._grabAt=this.elapsed;actor._grabStart={x:actor.x,z:actor.z};
    this.teacher.carriedId=actor.id;this._escortRoute=null;this._escortPost=null;
    this._events.push({type:'grabbed',studentId:actor.id});return true;
  }
  _bind(postId){
    const actor=this.students[this.teacher.carriedId],post=DETENTION.find(p=>p.id===postId);
    if(!actor||!post||distance(this.teacher,post)>1.55||!clearWallSegment(this.teacher,post)||this.students.some(s=>s.captivity==='bound'&&s.postId===post.id))return false;
    actor.captivity='bound';actor.caught=true;actor.postId=post.id;actor.x=post.x;actor.z=post.z-.30;actor.yaw=Math.PI;actor._boundAt=this.elapsed;actor._chalkUntil=0;actor.mood='bound';
    this.teacher.carriedId=null;this._escortRoute=null;this._escortPost=null;this._plan.until=0;this._thinkAt=0;
    const memory=this._memory.get(actor.id);if(memory){memory.detained=true;memory.x=actor.x;memory.z=actor.z;}
    this._events.push({type:'bound',studentId:actor.id});
    if([...this._team].every(id=>this.students[id].captivity==='bound'))this._finish('lost','all-caught');return true;
  }
  _release(actor,rescuer=null){
    if(!actor)return false;
    actor.captivity='free';actor.caught=false;actor.postId=null;actor._chalkUntil=0;actor._restUntil=this.elapsed+2;actor.mood='walking';
    if(this.teacher.carriedId===actor.id)this.teacher.carriedId=null;
    this._memory.delete(actor.id);this._plan.until=0;this._thinkAt=0;
    if(actor.isTeammate)actor._returnRoute=walkRoute(actor,SEATS[actor.id]);
    this._events.push({type:'rescued',studentId:actor.id,rescuerId:rescuer?.id??null});return true;
  }
  rescueTarget(actor=this.player){
    if(this._restrained(actor)||actor.seated)return null;
    return this.students.filter(s=>s.captivity==='bound'&&this._team.has(s.id)&&distance(actor,s)<1.65&&Math.abs(angle(heading(actor,s)-actor.yaw))<.62&&canSee({...actor,viewRange:1.65,fov:75},s,this.smokes)).sort((a,b)=>distance(actor,a)-distance(actor,b))[0]||null;
  }
  setRescue(id){
    if(id===null){this._rescueId=null;this._rescueProgress=0;return false;}
    if(!this._inputAllowed()||this.rescueTarget()?.id!==id)return false;
    this._stopActor(this.player);this._rescueId=id;this._rescueProgress=0;return true;
  }
  _advanceCaptivity(dt){
    for(const s of this.students)if(s.captivity==='stunned'&&this.elapsed>=s._chalkUntil){s.captivity='free';s.mood='reading';}
    const s=this.students[this.teacher.carriedId];
    if(s){const t=this.teacher,forward=.60,right=-.42,target={x:t.x+Math.sin(t.yaw)*forward+Math.cos(t.yaw)*right,z:t.z+Math.cos(t.yaw)*forward-Math.sin(t.yaw)*right};
      const blend=clamp((this.elapsed-s._grabAt)/.32,0,1),ease=blend*blend*(3-2*blend);s.x=s._grabStart.x+(target.x-s._grabStart.x)*ease;s.z=s._grabStart.z+(target.z-s._grabStart.z)*ease;s.yaw+=angle(t.yaw+Math.PI-s.yaw)*(1-Math.exp(-dt*14));
    }
    if(this._rescueId!==null){const target=this.rescueTarget();if(target?.id!==this._rescueId){this.setRescue(null);return;}this._rescueProgress=clamp(this._rescueProgress+dt/1.6,0,1);if(this._rescueProgress>=1-EPS){this._release(target,this.player);this.setRescue(null);}}
  }
  _follow(actor,route,speed,dt){
    if(!route?.length)return true;const p=route[0],d=distance(actor,p),step=Math.min(d,speed*dt),pos=moveInRoom(actor,(p.x-actor.x)/Math.max(d,EPS)*step,(p.z-actor.z)/Math.max(d,EPS)*step,.20);
    actor.yaw=heading(actor,p);actor.x=pos.x;actor.z=pos.z;if(distance(actor,p)<.07)route.shift();return !route.length;
  }
  _advanceStunChase(dt){
    const s=this.students.find(s=>s.captivity==='stunned'&&this._memory.get(s.id)?.confirmed);if(!s)return false;
    const t=this.teacher;t.phase='patrol';t.warning=false;t.intent='grab';t.targetId=s.id;t.castProgress=0;
    if(distance(t,s)<1.5&&canSee({...t,fov:360},s,this.smokes)){t.yaw=heading(t,s);this._grab(s);return true;}
    if(!s._approachRoute?.length)s._approachRoute=walkRoute(t,s);
    this._follow(t,s._approachRoute,1.6,dt);return true;
  }
  _advanceEscort(dt){
    const t=this.teacher;t.phase='patrol';t.intent='escort';t.warning=false;t.castProgress=0;
    if(!this._escortRoute){this._escortPost=DETENTION.find(p=>!this.students.some(s=>s.captivity==='bound'&&s.postId===p.id));if(!this._escortPost)return;this._escortRoute=walkRoute(t,{x:this._escortPost.x,z:this._escortPost.z-1.1});}
    if(this._follow(t,this._escortRoute,1.15,dt)){t.yaw=0;this._bind(this._escortPost.id);}
  }
  _advanceRescuer(s,dt){
    if(s._returnRoute){s.holding=false;s.mood='walking';if(this._follow(s,s._returnRoute,1.35,dt)){s._returnRoute=null;const seat=SEATS[s.id];s.x=seat.x;s.z=seat.z;s.yaw=0;s.seatId=s.id;s.seated=true;s._decisionAt=this.elapsed+3;}return true;}
    let target=this.students[s._rescueTarget];
    if(!target||target.captivity!=='bound'){s._rescueTarget=null;s._rescueRoute=null;s._helpProgress=0;target=null;}
    if(!target&&s._decisionAt!==Infinity){
      target=this.students.find(a=>a.captivity==='bound'&&this._team.has(a.id)&&this.elapsed-a._boundAt>3&&distance(this.teacher,a)>2.8&&!this.students.some(b=>b!==s&&b._rescueTarget===a.id));
      if(target){s._rescueTarget=target.id;s._rescueRoute=walkRoute(s,{x:target.x,z:target.z-.7});this._stopActor(s);s.seated=false;s.seatId=null;}
    }
    if(!target)return false;
    s.mood='walking';s.holding=false;
    if(distance(s,target)>.95||!clearWallSegment(s,target)){s._helpProgress=0;this._follow(s,s._rescueRoute,1.45,dt);return true;}
    s.yaw=heading(s,target);s.mood='rescuing';s._helpProgress=(s._helpProgress||0)+dt;
    if(s._helpProgress>=1.6){this._release(target,s);s._rescueTarget=null;s._rescueRoute=null;s._helpProgress=0;s._returnRoute=walkRoute(s,SEATS[s.id]);}return true;
  }
  _advance(dt){
    this.elapsed+=dt;this._refillDrawers();
    for(const b of this.books)b.amount=clamp(b.amount+(b.raised?1:-1)*dt*4,0,1);
    for(const s of this.students)s.bookCover=s.seated?this.books[s.seatId].amount:0;
    this._advanceSmoke(dt);
    if(!this.player.seated&&!this._restrained()){const speed=this.teacher.carriedId!==null&&this.player.id===-1?1.15:this.player.crouched?DEVELOPMENT_TUNING.crouchSpeed:DEVELOPMENT_TUNING.walkSpeed,pos=moveInRoom(this.player,this._movement.x*speed*dt,this._movement.z*speed*dt);this.player.x=pos.x;this.player.z=pos.z;}
    this._advanceTeacher(dt);this._advanceCaptivity(dt);if(this.status!=='playing')return;
    this._perceive(dt);this._advanceStudents(dt);
    if(this.status==='playing'&&this.elapsed+EPS>=this.duration)this._finish('lost','timeout');
  }
  _finish(status,reason){if(this.status!=='playing')return;this.status=status;this.resultReason=reason;this.paused=false;this.holding=false;this.player.holding=false;this._movement={x:0,z:0};for(const s of this.students)s.holding=false;this._events.push({type:'finish',status,reason,score:this.score});}
}
