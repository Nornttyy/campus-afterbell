import { ROOM, SEATS, PLAYER_SEAT, FRIEND_SEATS, AISLES, BOARD, DETENTION, moveInRoom } from './classroom-layout.js';

/** Local prototype tuning, NOT verified original-game balance values. */
export const DEVELOPMENT_TUNING = Object.freeze({ target:100, fov:110, viewRange:9, evidenceRate:38, evidenceDecay:.45, chalkWindup:.7, smokeDuration:7, smokeRadius:1.9, walkSpeed:1.8, crouchSpeed:.85, teammateRestMin:3, teammateRestMax:7 });
export const CLASSROOM_ACTIONS = Object.freeze({
  snack:Object.freeze({duration:4,points:2,risk:1,noise:.85,label:'偷吃零食'}),
  note:Object.freeze({duration:5,points:2.5,risk:.82,noise:.45,label:'传纸条'}),
  phone:Object.freeze({duration:6.5,points:3.5,risk:1.3,noise:.12,label:'玩手机'}),
});
const STEP=1/60, EPS=1e-9, TAU=Math.PI*2;
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
  if(distance(observer,target)>DEVELOPMENT_TUNING.viewRange)return false;
  if(Math.abs(angle(heading(observer,target)-observer.yaw))>DEVELOPMENT_TUNING.fov*Math.PI/360)return false;
  return !smokes.some(s=>s.remaining>0&&segmentDistance(s,observer,target)<s.radius);
}
/** Upright desk books reduce distant frontal prop visibility, not all visibility. */
export function propVisibility(observer,target,smokes=[]){
  if(!canSee(observer,target,smokes))return 0;
  const d=distance(observer,target);
  if(!target.seated)return target.crouched?.72:1;
  const front=Math.cos(heading(target,observer)); // Desks/books face +Z, independently of head look.
  const book=front>.52&&d>2.35?.22:front>.2&&d>2.35?.55:1;
  return book*(target.crouched&&d>2.1?.45:1);
}

export class ClassroomRound{
  constructor({seed=73,duration=Infinity,target=DEVELOPMENT_TUNING.target}={}){
    this.seed=seedNumber(seed);this.duration=valid(duration)&&duration>0?Math.min(duration,3600):Infinity;
    this.target=valid(target)&&target>0?Math.min(target,100000):DEVELOPMENT_TUNING.target;this.reset();
  }
  reset(seed){
    if(seed!==undefined)this.seed=seedNumber(seed);this._rng=this.seed;
    this.status='ready';this.paused=false;this.elapsed=0;this.score=0;this.strikes=0;this.resultReason=null;
    this.selected='snack';this.holding=false;this.completed={snack:0,note:0,phone:0};this.helpCooldown=0;
    this.smokes=[];this._events=[];this._accumulator=0;this._movement={x:0,z:0};this._lastObservation=-Infinity;this._smokeId=0;
    this._team=new Set([PLAYER_SEAT,...FRIEND_SEATS]);
    const personalities=['cautious','bold','helpful','distractible'];
    const profiles=[{caution:.96,helpful:.65,distraction:.10},{caution:.28,helpful:.35,distraction:.18},{caution:.68,helpful:.98,distraction:.12},{caution:.48,helpful:.55,distraction:.75}];
    this.students=SEATS.map(seat=>{
      const friend=FRIEND_SEATS.indexOf(seat.id), profile=friend>=0?profiles[friend]:null;
      return {id:seat.id,seatId:seat.id,x:seat.x,z:seat.z,yaw:0,pitch:0,seated:true,crouched:false,caught:false,isPlayer:seat.id===PLAYER_SEAT,isTeammate:friend>=0,
        name:seat.id===PLAYER_SEAT?'你':friend>=0?['小满','阿杰','小雨','乐乐'][friend]:`${seat.row+1}排同学${seat.col+1}`,
        mood:'writing',action:null,holding:false,progress:0,personality:friend>=0?personalities[friend]:'ordinary',completed:{snack:0,note:0,phone:0},
        _profile:profile,_progress:{snack:0,note:0,phone:0},_noise:0,_decisionAt:this._range(.15,1.8),_idleAt:this._range(1,7),_speed:this._range(.65,.9),_preference:this._random(),_smoke:friend>=0||seat.id===PLAYER_SEAT?1:0,_exposure:0,_helpUntil:0,_helpCount:0,_helpReady:0,_restUntil:0};
    });
    this.player=this.students[PLAYER_SEAT];this.player.action=this.selected;
    this.teacher={x:BOARD.x,z:BOARD.z,yaw:0,phase:'board',phaseTime:0,phaseDuration:1,intent:'write',targetId:null,looking:false,warning:false,attention:0,walkProgress:0,castProgress:0};
    this._memory=new Map();this._plan={intent:'write',targetId:null,since:0,until:3,route:[],routeLength:0,arrivedAt:null,utility:0};
    this._turnLeft=0;this._thinkAt=0;this._lastScan=0;this._writingNeed=.8;this._cast=null;
    return this.snapshot();
  }
  start(){if(this.status==='ready'){this.status='playing';this._observe('round-start',null,'课堂开始，捣乱值由实际行动积累。');}return this.snapshot();}
  _inputAllowed(){return this.status==='playing'&&!this.paused;}
  selectAction(action){
    if(!Object.hasOwn(CLASSROOM_ACTIONS,action)||this.paused||this.player.caught||!['ready','playing'].includes(this.status))return false;
    if(action!==this.selected)this.hold(false);this.selected=action;this.player.action=action;return true;
  }
  hold(value){if(typeof value!=='boolean')return false;if(!value){this.holding=false;this.player.holding=false;return false;}if(!this._inputAllowed()||this.player.caught)return false;this.holding=true;this.player.holding=true;return true;}
  setMovement(x,z){if(!valid(x)||!valid(z)||!this._inputAllowed()||this.player.caught)return false;const n=Math.max(1,Math.hypot(x,z));this._movement={x:clamp(x/n,-1,1),z:clamp(z/n,-1,1)};return true;}
  setLook(yaw,pitch){if(!valid(yaw)||!valid(pitch)||!this._inputAllowed())return false;this.player.yaw=angle(yaw);this.player.pitch=clamp(pitch,-1.3,1.3);return true;}
  setCrouch(value){if(typeof value!=='boolean'||!this._inputAllowed()||this.player.caught)return false;this.player.crouched=value;return true;}
  interact(){
    if(!this._inputAllowed()||this.player.caught)return false;
    const p=this.player;
    if(p.seated){p.seated=false;p.seatId=null;this._observe('stand',p.id,'已离开座位；持物移动不会增加捣乱值。');return 'stood';}
    const occupied=new Set(this.students.filter(s=>s.seated&&!s.caught).map(s=>s.seatId));
    const seat=SEATS.filter(s=>!occupied.has(s.id)&&distance(p,s)<1.05).sort((a,b)=>distance(p,a)-distance(p,b))[0];
    if(!seat)return false;
    p.x=seat.x;p.z=seat.z;p.seated=true;p.seatId=seat.id;p.crouched=false;this._movement={x:0,z:0};this._observe('sit',p.id,'已坐下。');return 'seated';
  }
  useItem(){if(!this._inputAllowed()||this.player.caught||this.player._smoke<1)return false;this._throwSmoke(this.player);return true;}
  requestHelp(){
    if(!this._inputAllowed()||this.player.caught||this.helpCooldown>EPS)return false;
    const candidates=this.students.filter(s=>s.isTeammate&&!s.caught&&s._helpReady<=this.elapsed).map(s=>({s,risk:this._localRisk(s)})).filter(v=>v.risk<.75).sort((a,b)=>(b.s._profile.helpful-b.risk*.7-distance(b.s,this.player)*.07)-(a.s._profile.helpful-a.risk*.7-distance(a.s,this.player)*.07));
    const helper=candidates[0]?.s;
    if(!helper||helper._profile.helpful<.5){this.helpCooldown=2;this._events.push({type:'help',accepted:false,reason:'unsafe',text:'附近同学暂时无法掩护。'});return false;}
    helper.holding=false;helper._helpCount++;helper._helpReady=this.elapsed+18+helper._helpCount*4;this.helpCooldown=18;
    if(helper._smoke&&distance(helper,this.player)<4.2&&this._localRisk(this.player)>.25)this._throwSmoke(helper,this.player);
    else{helper._helpUntil=this.elapsed+1;helper.mood='cough';this._hear(helper,1.8/(1+helper._helpCount*.5),'cough');this._events.push({type:'help',accepted:true,studentId:helper.id,speaker:helper.name,strategy:'cough',text:`${helper.name}制造了一处声响。`});}
    return true;
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
    return {status:this.status,paused:this.paused,seed:this.seed,elapsed:clean(this.elapsed),timeLeft:Number.isFinite(this.duration)?clean(Math.max(0,this.duration-this.elapsed)):0,timed:Number.isFinite(this.duration),score:this.score,target:this.target,strikes:this.strikes,resultReason:this.resultReason,
      suspicion:clean(m?.evidence||0),holding:this.holding,selected:this.selected,actionProgress:clean(p._progress[this.selected]),completed:{...this.completed},helpCooldown:clean(this.helpCooldown),inventory:{smoke:p._smoke},caughtCount:this.students.filter(s=>this._team.has(s.id)&&s.caught).length,teamSize:5,
      player:{id:p.id,x:clean(p.x),z:clean(p.z),yaw:clean(p.yaw),pitch:clean(p.pitch),seated:p.seated,crouched:p.crouched,caught:p.caught,seatId:p.seatId},
      teacher:{...t,x:clean(t.x),z:clean(t.z),yaw:clean(t.yaw),phaseTime:clean(t.phaseTime),phaseDuration:clean(t.phaseDuration),castProgress:clean(t.castProgress),attention:clean(t.attention),walkProgress:clean(t.walkProgress),observedIds:[...this._memory.keys()],memory:[...this._memory.values()].map(m=>({id:m.id,evidence:clean(m.evidence),suspicion:clean(m.evidence),noise:clean(m.noise),confirmed:m.confirmed,detained:m.detained,lastSeen:m.lastSeen,lastHeard:m.lastHeard,lastVisit:m.lastVisit,visits:m.visits,x:clean(m.x),z:clean(m.z)}))},
      students:this.students.map(s=>({id:s.id,seatId:s.seatId,x:clean(s.x),z:clean(s.z),yaw:clean(s.yaw),seated:s.seated,crouched:s.crouched,isPlayer:s.isPlayer,isTeammate:s.isTeammate,caught:s.caught,mood:s.mood,action:s.action,holding:s.holding,progress:clean(s.progress),name:s.name,personality:s.personality,completed:{...s.completed}})),
      smokes:this.smokes.map(s=>({...s,remaining:clean(s.remaining)}))};
  }
  drainEvents(){const events=this._events;this._events=[];return events;}
  _random(){let t=this._rng=(this._rng+0x6D2B79F5)>>>0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
  _range(a,b){return a+(b-a)*this._random();}
  _observe(fact,id,text){if(this.elapsed-this._lastObservation<2.4)return;this._lastObservation=this.elapsed;this._events.push({type:'observation',fact,studentId:id,text});}
  _remember(actor){let m=this._memory.get(actor.id);if(!m){m={id:actor.id,x:actor.x,z:actor.z,evidence:0,noise:0,confirmed:false,detained:false,lastSeen:null,lastHeard:null,lastVisit:null,visits:0};this._memory.set(actor.id,m);}return m;}
  _hear(actor,strength,source='object'){
    const d=distance(this.teacher,actor);if(d>11)return;
    const m=this._remember(actor);m.noise=Math.min(5,m.noise+strength*(1-d/15));m.lastHeard=clean(this.elapsed);m.x=actor.x;m.z=actor.z;
    this._observe('noise-heard',actor.id,`${actor.name}所在位置传来声响。`);
  }
  _throwSmoke(actor,toward=null){
    actor._smoke--;const yaw=toward?heading(actor,toward):actor.yaw;
    const s={id:this._smokeId++,ownerId:actor.id,x:clamp(actor.x+Math.sin(yaw)*1.1,ROOM.minX,ROOM.maxX),z:clamp(actor.z+Math.cos(yaw)*1.1,ROOM.minZ,ROOM.maxZ),radius:DEVELOPMENT_TUNING.smokeRadius,remaining:DEVELOPMENT_TUNING.smokeDuration};this.smokes.push(s);
    this._hear(actor,.8,'smoke');this._events.push({type:'help',accepted:true,strategy:'smoke',studentId:actor.id,speaker:actor.name,duration:s.remaining,text:`${actor.name}使用了烟雾。`});this._observe('smoke',actor.id,'烟雾遮住了穿过它的视线。');
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
      if(s.caught){s.holding=false;s.mood='caught';continue;}
      if(s.isPlayer){s.holding=this.holding;s.action=this.selected;s.mood=s.holding?s.action:s.seated?'writing':'walking';continue;}
      if(!s.isTeammate){
        if(this.elapsed>=s._idleAt){s.mood=['writing','reading','scratch','page'][Math.floor(this._random()*4)];s._idleAt=this.elapsed+this._range(2.3,7.5);if(s.mood==='page')this._hear(s,.12,'page');}
        continue;
      }
      if(s._helpUntil>this.elapsed){s.mood='cough';s.holding=false;continue;}
      // After a real action, each classmate watches the room and prepares again.
      // These personality/risk-dependent breaks pace play, without fake scoring.
      if(s._restUntil>this.elapsed){s.holding=false;s.mood='reading';continue;}
      const risk=this._localRisk(s);s._exposure=Math.max(0,s._exposure+(s.holding&&risk>.4?dt:-dt*.6));
      if(s._smoke&&s._exposure>1.5&&risk>.55){this._throwSmoke(s);s._exposure=0;}
      if(this.elapsed<s._decisionAt)continue;
      s._decisionAt=this.elapsed+this._range(.16,.42);
      const profile=s._profile,near=distance(this.teacher,s),finishRisk=s.action?s._progress[s.action]>.83: false;
      const threshold=.24+(1-profile.caution)*.55+(finishRisk&&!this.teacher.warning?.16:0);
      if(risk>threshold||(this.teacher.warning&&profile.caution>.8)){s.holding=false;s.mood='writing';continue;}
      if(profile.distraction>.5&&this._random()<.08){s.holding=false;s.mood='scratch';s._decisionAt+=1.2;continue;}
      if(!s.action||s._progress[s.action]<EPS){
        s.action=Object.keys(CLASSROOM_ACTIONS).map((key,index)=>({key,utility:1/CLASSROOM_ACTIONS[key].duration-CLASSROOM_ACTIONS[key].noise*profile.caution/(near+1)*.7+(index===Math.floor(s._preference*3)?.11:0)-s.completed[key]*.025})).sort((a,b)=>b.utility-a.utility)[0].key;
      }
      s.holding=true;s.mood=s.action;
    }
    for(const s of this.students){
      if(s.caught||!s.holding||!s.action)continue;
      const action=CLASSROOM_ACTIONS[s.action];
      s._noise+=dt*action.noise;if(s._noise>=1){s._noise-=1;this._hear(s,1);}
      // Carrying an object while walking is permitted, but earns no mischief.
      if(!s.seated)continue;
      s._progress[s.action]=Math.min(1,s._progress[s.action]+dt/action.duration*(s.isPlayer?1:s._speed));s.progress=s._progress[s.action];
      if(s.progress+EPS>=1){
        s._progress[s.action]=0;s.progress=0;s.completed[s.action]++;if(s.isPlayer)this.completed[s.action]++;
        const points=Math.min(action.points,this.target-this.score);this.score+=points;
        this._events.push({type:'complete',actor:s.isPlayer?'player':'ai',studentId:s.id,speaker:s.name,action:s.action,points,score:this.score});
        if(s.isTeammate){s.holding=false;s._restUntil=this.elapsed+this._range(DEVELOPMENT_TUNING.teammateRestMin,DEVELOPMENT_TUNING.teammateRestMax)+s._profile.caution*3+this._localRisk(s)*2;}
        if(this.score>=this.target){this._finish('won','mischief');return;}
      }
    }
  }
  _perceive(dt){
    const t=this.teacher;
    t.looking=!t.warning&&canSee(t,this.player,this.smokes);t.attention=t.looking?propVisibility(t,this.player,this.smokes):0;
    for(const s of this.students){
      const seen=!t.warning&&canSee(t,s,this.smokes);
      let m=this._memory.get(s.id);
      if(seen){m=this._remember(s);m.lastSeen=clean(this.elapsed);m.x=s.x;m.z=s.z;}
      if(!m)continue;
      m.noise=Math.max(0,m.noise-dt*.10);
      if(m.confirmed||m.detained)continue;
      if(seen&&s.holding&&s.action){
        const visibility=propVisibility(t,s,this.smokes),rate=DEVELOPMENT_TUNING.evidenceRate*CLASSROOM_ACTIONS[s.action].risk*visibility;
        const before=m.evidence;m.evidence=Math.min(100,m.evidence+rate*dt);
        if(before<20&&m.evidence>=20)this._observe('prop-seen',s.id,`老师看见了${s.name}的手部动作。`);
        if(m.evidence+EPS>=100){m.confirmed=true;m.evidence=100;this._observe('identified',s.id,`老师已认出${s.name}，正在靠近。`);this._thinkAt=0;}
      }else m.evidence=Math.max(0,m.evidence-dt*DEVELOPMENT_TUNING.evidenceDecay);
    }
  }
  _routeTo(point){
    const t=this.teacher,aisle=AISLES.reduce((a,x)=>Math.abs(x-point.x)<Math.abs(a-point.x)?x:a,AISLES[0]),route=[];
    if(Math.abs(t.x-aisle)>.15){if(Math.abs(t.z-BOARD.z)>.1)route.push({x:t.x,z:BOARD.z});route.push({x:aisle,z:BOARD.z});}
    route.push({x:aisle,z:clamp(point.z,ROOM.minZ+.3,BOARD.z)});return route.filter(p=>distance(t,p)>.05);
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
    if(this._cast){this._cast.time+=dt;t.castProgress=clamp(this._cast.time/DEVELOPMENT_TUNING.chalkWindup,0,1);if(this._cast.time+EPS>=DEVELOPMENT_TUNING.chalkWindup){const id=this._cast.id;this._events.push({type:'chalk',studentId:id,targetId:id});this._capture(this.students[id]);this._cast=null;t.castProgress=0;p.until=0;this._thinkAt=0;}}
    const phase=this._turnLeft>EPS?'turning':this._cast?'watching':p.route.length?'patrol':p.intent==='write'?'board':'watching';
    if(t.phase!==phase){t.phase=phase;t.phaseTime=0;}else t.phaseTime+=dt;
    t.warning=phase==='turning';t.phaseDuration=phase==='turning'?.7:this._cast?.7:Math.max(1,p.until-p.since);t.walkProgress=p.routeLength?clamp(1-p.route.reduce((sum,v,i)=>sum+distance(i?p.route[i-1]:t,v),0)/p.routeLength,0,1):0;
  }
  _capture(actor){
    if(actor.caught)return;const captured=this.students.filter(s=>s.caught).length,spot=DETENTION[Math.min(captured,DETENTION.length-1)];
    actor.caught=true;actor.holding=false;actor.seated=false;actor.crouched=false;actor.seatId=null;actor.x=spot.x;actor.z=spot.z;actor.yaw=Math.PI;actor.mood='caught';actor.progress=0;
    const memory=this._memory.get(actor.id);if(memory){memory.detained=true;memory.x=spot.x;memory.z=spot.z;}
    if(actor.isPlayer){this.holding=false;this.strikes=1;this._movement={x:0,z:0};}
    this._events.push({type:'caught',actor:actor.isPlayer?'player':'ai',studentId:actor.id,playerCaught:actor.isPlayer,text:`${actor.name}被红牌罚到讲台旁。`});
    if([...this._team].every(id=>this.students[id].caught))this._finish('lost','all-caught');
  }
  _advance(dt){
    this.elapsed+=dt;this.helpCooldown=Math.max(0,this.helpCooldown-dt);
    for(const smoke of this.smokes)smoke.remaining-=dt;this.smokes=this.smokes.filter(s=>s.remaining>EPS);
    if(!this.player.seated&&!this.player.caught){const speed=this.player.crouched?DEVELOPMENT_TUNING.crouchSpeed:DEVELOPMENT_TUNING.walkSpeed,pos=moveInRoom(this.player,this._movement.x*speed*dt,this._movement.z*speed*dt);this.player.x=pos.x;this.player.z=pos.z;}
    this._advanceTeacher(dt);if(this.status!=='playing')return;
    this._perceive(dt);this._advanceStudents(dt);
    if(this.status==='playing'&&this.elapsed+EPS>=this.duration)this._finish('lost','timeout');
  }
  _finish(status,reason){if(this.status!=='playing')return;this.status=status;this.resultReason=reason;this.paused=false;this.holding=false;this.player.holding=false;this._movement={x:0,z:0};for(const s of this.students)s.holding=false;this._events.push({type:'finish',status,reason,score:this.score});}
}
