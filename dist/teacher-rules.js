import {chalkStaminaCost,canThrowWithStamina} from './round-settings55.js?v=campus-79';
import {createSurveillance,surveillanceSnapshot,deploySurveillance,viewSurveillance,closeSurveillance} from './surveillance54.js?v=campus-79';
import {ClassroomRound,chalkHit} from './classroom-rules.js?v=campus-79';
import {teacherViewHeight} from './camera-height58.js?v=campus-79';
import {DETENTION,TEACHER_SPAWN,BOARD,mapKind,OFFICE_CHAIR,clearWallSegment,floorHeight} from './classroom-layout.js?v=campus-79';

// Shared with the AI teacher: a visible projectile must hit before it can stun.
export {chalkHit,segmentBox} from './classroom-rules.js?v=campus-79';

export class TeacherRound extends ClassroomRound{
  reset(seed){
    this.surveillance=createSurveillance();
    super.reset(seed);
    const pool=this.students.slice();
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(this._random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    this._team=new Set(pool.slice(0,5).map(s=>s.id));
    for(const s of this.students){
      s.isPlayer=false;s.isTeammate=this._team.has(s.id);s.name='同学';
      s._profile=s.isTeammate?{caution:this._range(.3,.85),helpful:.5,distraction:this._range(0,.7)}:null;
      s._slots=s.isTeammate&&mapKind(this.map)!=='playground'?Array.from({length:mapKind(this.map)==='computer'?1:3},(_,id)=>({id,action:this._drawItem(),readyAt:0,progress:0})):[];
      s._decisionAt=this._range(1,6);s._chalkUntil=0;
    }
    this.classSlotsBySeat=new Map(this.students.filter(a=>a._slots.length).map(a=>[a.seatId,a._slots]));
    this.player={id:-1,...TEACHER_SPAWN,seated:false,crouched:false,caught:false,captivity:'free',seatId:null,holding:false,
      _slots:[],_selectedSlot:0,_drawnSlot:null,_drawerOpen:false};
    this.selected='chalk';this.chalks=[];this._chalkId=0;this._nextThrow=0;this._lastThrow=-100;this.wrongGrabs=0;this._writing=false;this._writeTime=0;
    Object.assign(this.teacher,{x:this.player.x,z:this.player.z,yaw:this.player.yaw,phase:'watching',intent:'player',warning:false,stamina:100,writing:false,writeProgress:0});
    return this.snapshot();
  }
  snapshot(){
    const s=super.snapshot();s.surveillance=surveillanceSnapshot(this);
    if(this.player.id!==-1)return s; // Base reset calls snapshot before teacher initialization.
    s.role='teacher';const aim=this.aimedStudent();s.teacherAim=aim?{id:aim.id,grabReady:!this.player.seated&&Math.hypot(aim.x-this.player.x,aim.z-this.player.z)<1.55&&aim.captivity==='stunned'}:null;s.bindPost=this.bindTarget()?.id??null;s.chalks=this.chalks.map(c=>({...c}));s.throwAge=this._sessionElapsed-this._lastThrow;
    s.wrongGrabs=this.wrongGrabs;s.writeBoardAvailable=this.canWriteBoard();s.releaseStudent=this.releaseTarget()?.id??null;
    s.students=s.students.map(p=>({...p,chalked:this.elapsed<(this.students[p.id]._chalkUntil||0)}));
    return s;
  }
  deploySurveillance(id){return deploySurveillance(this,id);}
  viewSurveillance(id){return viewSurveillance(this,id);}
  closeSurveillance(){return closeSurveillance(this);}
  hold(value){if(!value){this.holding=false;return false;}return this.throwChalk();}
  releaseUse(){this.holding=false;return false;}
  setDrawerOpen(){return false;} setBookRaised(){return false;}
  toggleDrawer(){return false;} toggleBook(){return false;} takeSlot(){return false;}
  returnItem(){return false;} interact(seatId=null){if(this.player.seated)return super.interact();return typeof seatId==='string'&&seatId.endsWith('chair')?this.sitOfficeChair(seatId):false;} startComputer(){return false;}
  _perceive(){} // The human observes. No evidence meter, memory-based aim or auto-capture.
  _hear(){} // Sound cues stay spatial; they must not reveal hidden identity to the UI.
  throwChalk(){
    if(!this._inputAllowed()||!['gathering','seating','class'].includes(this.stage)||this._writing||this._sessionElapsed<this._nextThrow||this.teacher.carriedId!==null)return false;
    if(this._restrained(this.player))return false;
    if(!canThrowWithStamina(this)){this._events.push({type:'stamina-low'});return false;}
    const p=this.player,cp=Math.cos(p.pitch),d={x:Math.sin(p.yaw)*cp,y:-Math.sin(p.pitch),z:Math.cos(p.yaw)*cp};
    this.chalks.push({id:this._chalkId++,x:p.x,y:floorHeight(p.x,p.z,this.map)+teacherViewHeight(p),z:p.z,vx:d.x*16,vy:d.y*16,vz:d.z*16,age:0});
    this.teacher.stamina=Math.max(0,this.teacher.stamina-chalkStaminaCost(this));this._lastThrow=this._sessionElapsed;this._nextThrow=this._sessionElapsed+.72;this._events.push({type:'chalk-throw',x:this.player.x,z:this.player.z});return true;
  }
  aimedStudent(range=9){
    if(this.stage!=='class')return null;
    const p=this.player,a={x:p.x,y:floorHeight(p.x,p.z,this.map)+teacherViewHeight(p),z:p.z},cp=Math.cos(p.pitch);
    const rayRange=Math.hypot(range,teacherViewHeight(p));
    const b={x:a.x+Math.sin(p.yaw)*cp*rayRange,y:a.y-Math.sin(p.pitch)*rayRange,z:a.z+Math.cos(p.yaw)*cp*rayRange};
    const hit=chalkHit(a,b,this.students,this.books,this.map,this.layout);
    if(hit?.kind!=='student'||Math.hypot(this.students[hit.id].x-p.x,this.students[hit.id].z-p.z)>range+.24)return null;
    if(!clearWallSegment(a,this.students[hit.id],this.layout))return null;
    // Opaque smoke masks the intervening part of the ray, not the whole room.
    const end={x:a.x+(b.x-a.x)*hit.t,y:a.y+(b.y-a.y)*hit.t,z:a.z+(b.z-a.z)*hit.t};
    for(const s of this.smokes){if(s.density<.3)continue;const dx=end.x-a.x,dz=end.z-a.z,len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((s.x-a.x)*dx+(s.z-a.z)*dz)/len)):0;if(Math.hypot(a.x+dx*t-s.x,a.z+dz*t-s.z)<s.radius)return null;}
    return this.students[hit.id];
  }
  bindTarget(){
    if(this.teacher.carriedId===null)return null;
    const p=this.player;return this.posts.find(post=>Math.hypot(p.x-post.x,p.z-post.z)<1.55&&clearWallSegment(p,post,this.layout)&&Math.abs(Math.atan2(Math.sin(Math.atan2(post.x-p.x,post.z-p.z)-p.yaw),Math.cos(Math.atan2(post.x-p.x,post.z-p.z)-p.yaw)))<.85&&!this.students.some(s=>s.captivity==='bound'&&s.postId===post.id))||null;
  }
  grabStudent(){
    if(!this._classInputAllowed()||this.player.seated||this._restrained(this.player)||this._writing||this.teacher.carriedId!==null)return false;
    const s=this.aimedStudent(1.55);if(!s||s.captivity!=='stunned')return false;
    Object.assign(this.teacher,{x:this.player.x,z:this.player.z,yaw:this.player.yaw});const grabbed=this._grab(s);if(grabbed)this.player.crouched=false;return grabbed;
  }
  bindStudent(){const post=this.bindTarget();if(!this._classInputAllowed()||!post)return false;return this._bind(post.id);}
  dropStudent(){if(!this._classInputAllowed())return false;const s=this.students[this.teacher.carriedId];if(!s)return false;this._release(s);return true;}
  // Binding feedback and stamina use the shared AI/human implementation.
  releaseTarget(){
    if(this.teacher.carriedId!==null)return null;
    const p=this.player;
    return this.students.filter(s=>s.captivity==='bound'&&Math.hypot(s.x-p.x,s.z-p.z)<1.65&&clearWallSegment(p,s,this.layout)&&Math.abs(Math.atan2(Math.sin(Math.atan2(s.x-p.x,s.z-p.z)-p.yaw),Math.cos(Math.atan2(s.x-p.x,s.z-p.z)-p.yaw)))<.62).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]||null;
  }
  releaseBoundStudent(){const s=this.releaseTarget();if(!this._classInputAllowed()||!s)return false;return this._release(s);}
  canWriteBoard(){
    const p=this.player,yaw=Math.atan2(Math.sin(p.yaw),Math.cos(p.yaw));
    return this.stage==='class'&&!p.crouched&&this.teacher.carriedId===null&&Math.abs(p.x-this.board.x)<3.5&&p.z>this.board.z-1&&p.z<this.board.z+.65&&Math.abs(yaw)<.85&&p.pitch<.45&&p.pitch>-.85;
  }
  setWriting(value){
    if(!value){this._writing=false;this.teacher.writing=false;this.teacher.writeProgress=0;return false;}
    if(!this._inputAllowed()||!this.canWriteBoard())return false;
    this._writing=true;this._writeTime=0;this.teacher.writing=true;this.holding=false;return true;
  }
  pause(value=true){if(value)this.setWriting(false);return super.pause(value);}
  _advanceTeacher(dt){
    const p=this.player,t=this.teacher;
    if((t._chalkUntil||0)>this.elapsed+1e-9){this.closeSurveillance();t.phase='stunned';t.writing=false;this._writing=false;p.captivity='stunned';return;}if(p.captivity==='stunned'){p.captivity='free';t.captivity='free';}
    if(this._writing&&(!this.canWriteBoard()||Math.hypot(this._movement.x,this._movement.z)>.01))this.setWriting(false);
    // Resting is free. Walking fatigue is charged from actual displacement
    // once in the shared step, including network-controlled teachers.
    if(this._writing)t.stamina=Math.min(100,t.stamina+dt*10);
    if(this._writing)this._writeTime+=dt;
    Object.assign(t,{x:p.x,z:p.z,yaw:p.yaw,phase:this._writing?'board':'watching',intent:this._writing?'write':'player',warning:false,looking:!this._writing,castProgress:0,writing:this._writing,writeProgress:this._writing?this._writeTime%1:0});
  }
}
