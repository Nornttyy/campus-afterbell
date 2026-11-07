import {ClassroomRound} from './classroom-rules.js?v=map-30c';
import {ROOM,SEATS,BOARD,DETENTION,TEACHER_EYE_HEIGHT,TEACHER_SPAWN,WALL_VOLUMES,LECTERN,OFFICE_SOLIDS,floorTiles,clearWallSegment,floorHeight} from './classroom-layout.js?v=map-30c';

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
export function chalkHit(a,b,students,books,map){
  let nearest=null;
  const test=(box,kind,id)=>{const t=segmentBox(a,b,box);if(t!==null&&(!nearest||t<nearest.t))nearest={t,kind,id};};
  for(const [id,wall] of WALL_VOLUMES.entries())test(wall,'wall',id);
  for(const solid of OFFICE_SOLIDS)test(solid,'wall',-1);
  for(const tile of floorTiles(map))test({...tile,minY:0,maxY:tile.height},'wall',-1);
  test({...LECTERN,minY:.16,maxY:1.15},'desk',-1);
  for(const s of SEATS){
    const base=floorHeight(s.x,s.z,map);
    test({minX:s.x-.61,maxX:s.x+.61,minY:base+.58,maxY:base+.865,minZ:s.deskZ-.4,maxZ:s.deskZ+.4},'desk',s.id);
    if(map==='computer')test({minX:s.x-.33,maxX:s.x+.33,minY:base+1.03,maxY:base+1.43,minZ:s.deskZ-.06,maxZ:s.deskZ+.05},'desk',s.id);
    else if((books[s.id]?.amount??0)>.5)test({minX:s.x-.34,maxX:s.x+.34,minY:base+.88,maxY:base+1.35,minZ:s.deskZ-.30,maxZ:s.deskZ-.26},'desk',s.id);
  }
  for(const s of students){
    if(s.caught||s.captivity==='carried')continue;
    const base=floorHeight(s.x,s.z,map);
    test({minX:s.x-.24,maxX:s.x+.24,minY:base+(s.seated?.82:.65),maxY:base+(s.seated?1.64:1.88),minZ:s.z-.23,maxZ:s.z+.23},'student',s.id);
  }
  return nearest;
}

export class TeacherRound extends ClassroomRound{
  reset(seed){
    super.reset(seed);
    const pool=this.students.slice();
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(this._random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    this._team=new Set(pool.slice(0,5).map(s=>s.id));
    for(const s of this.students){
      s.isPlayer=false;s.isTeammate=this._team.has(s.id);s.name='同学';
      s._profile=s.isTeammate?{caution:this._range(.3,.85),helpful:.5,distraction:this._range(0,.7)}:null;
      s._slots=s.isTeammate?Array.from({length:3},(_,id)=>({id,action:this._drawItem(),readyAt:0,progress:0})):[];
      s._decisionAt=this._range(1,6);s._chalkUntil=0;
    }
    this.player={id:-1,...TEACHER_SPAWN,seated:false,crouched:false,caught:false,captivity:'free',seatId:null,holding:false,
      _slots:[],_selectedSlot:0,_drawnSlot:null,_drawerOpen:false};
    this.selected='chalk';this.chalks=[];this._chalkId=0;this._nextThrow=0;this._lastThrow=-100;this.wrongGrabs=0;
    Object.assign(this.teacher,{x:this.player.x,z:this.player.z,yaw:this.player.yaw,phase:'watching',intent:'player',warning:false});
    return this.snapshot();
  }
  snapshot(){
    const s=super.snapshot();
    if(!this.chalks)return s; // Base reset calls snapshot before teacher initialization.
    s.role='teacher';const aim=this.aimedStudent();s.teacherAim=aim?{id:aim.id,grabReady:Math.hypot(aim.x-this.player.x,aim.z-this.player.z)<1.55&&aim.captivity==='stunned'}:null;s.bindPost=this.bindTarget()?.id??null;s.chalks=this.chalks.map(c=>({...c}));s.throwAge=this.elapsed-this._lastThrow;
    s.wrongGrabs=this.wrongGrabs;
    s.students=s.students.map(p=>({...p,chalked:this.elapsed<(this.students[p.id]._chalkUntil||0)}));
    return s;
  }
  hold(value){if(!value){this.holding=false;return false;}return this.throwChalk();}
  releaseUse(){this.holding=false;return false;}
  toggleDrawer(){return false;} toggleBook(){return false;} takeSlot(){return false;}
  returnItem(){return false;} interact(){return false;} startComputer(){return false;}
  _perceive(){} // The human observes. No evidence meter, memory-based aim or auto-capture.
  _hear(){} // Sound cues stay spatial; they must not reveal hidden identity to the UI.
  throwChalk(){
    if(!this._inputAllowed()||this.elapsed<this._nextThrow||this.teacher.carriedId!==null)return false;
    const p=this.player,cp=Math.cos(p.pitch),d={x:Math.sin(p.yaw)*cp,y:-Math.sin(p.pitch),z:Math.cos(p.yaw)*cp};
    this.chalks.push({id:this._chalkId++,x:p.x,y:floorHeight(p.x,p.z,this.map)+(p.crouched?1.02:TEACHER_EYE_HEIGHT),z:p.z,vx:d.x*16,vy:d.y*16,vz:d.z*16,age:0});
    this._lastThrow=this.elapsed;this._nextThrow=this.elapsed+.72;this._events.push({type:'chalk-throw'});return true;
  }
  aimedStudent(range=9){
    const p=this.player,a={x:p.x,y:floorHeight(p.x,p.z,this.map)+(p.crouched?1.02:TEACHER_EYE_HEIGHT),z:p.z},cp=Math.cos(p.pitch);
    const b={x:a.x+Math.sin(p.yaw)*cp*range,y:a.y-Math.sin(p.pitch)*range,z:a.z+Math.cos(p.yaw)*cp*range};
    const hit=chalkHit(a,b,this.students,this.books,this.map);
    if(hit?.kind!=='student')return null;
    if(!clearWallSegment(a,this.students[hit.id]))return null;
    // Opaque smoke masks the intervening part of the ray, not the whole room.
    const end={x:a.x+(b.x-a.x)*hit.t,y:a.y+(b.y-a.y)*hit.t,z:a.z+(b.z-a.z)*hit.t};
    for(const s of this.smokes){if(s.density<.3)continue;const dx=end.x-a.x,dz=end.z-a.z,len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((s.x-a.x)*dx+(s.z-a.z)*dz)/len)):0;if(Math.hypot(a.x+dx*t-s.x,a.z+dz*t-s.z)<s.radius)return null;}
    return this.students[hit.id];
  }
  bindTarget(){
    if(this.teacher.carriedId===null)return null;
    const p=this.player;return DETENTION.find(post=>Math.hypot(p.x-post.x,p.z-post.z)<1.55&&clearWallSegment(p,post)&&Math.abs(Math.atan2(Math.sin(Math.atan2(post.x-p.x,post.z-p.z)-p.yaw),Math.cos(Math.atan2(post.x-p.x,post.z-p.z)-p.yaw)))<.85&&!this.students.some(s=>s.captivity==='bound'&&s.postId===post.id))||null;
  }
  grabStudent(){
    if(!this._inputAllowed()||this.teacher.carriedId!==null)return false;
    const s=this.aimedStudent(1.55);if(!s||s.captivity!=='stunned')return false;
    if(!this._team.has(s.id)){s.captivity='free';s._chalkUntil=0;this.wrongGrabs++;this._events.push({type:'wrong-grab',studentId:s.id});return false;}
    Object.assign(this.teacher,{x:this.player.x,z:this.player.z,yaw:this.player.yaw});return this._grab(s);
  }
  bindStudent(){const post=this.bindTarget();if(!this._inputAllowed()||!post)return false;return this._bind(post.id);}
  dropStudent(){if(!this._inputAllowed())return false;const s=this.students[this.teacher.carriedId];if(!s)return false;this._release(s);return true;}
  _advanceTeacher(dt){
    const p=this.player;Object.assign(this.teacher,{x:p.x,z:p.z,yaw:p.yaw,phase:'watching',intent:'player',warning:false,looking:true,castProgress:0});
    for(const c of this.chalks){
      const next={x:c.x+c.vx*dt,y:c.y+c.vy*dt,z:c.z+c.vz*dt};c.age+=dt;c.vy-=1.6*dt;
      const hit=chalkHit(c,next,this.students,this.books,this.map);
      if(hit){
        c.x+=(next.x-c.x)*hit.t;c.y+=(next.y-c.y)*hit.t;c.z+=(next.z-c.z)*hit.t;c.dead=true;
        if(hit.kind==='student'){
          const s=this.students[hit.id];this._stun(s);
        }
        this._events.push({type:'chalk-hit',kind:hit.kind,x:c.x,y:c.y,z:c.z});
      }else Object.assign(c,next);
      if(c.age>1.3||c.y<floorHeight(c.x,c.z,this.map)+.02||c.x<ROOM.minX||c.x>ROOM.maxX||c.z<ROOM.minZ||c.z>ROOM.maxZ)c.dead=true;
    }
    this.chalks=this.chalks.filter(c=>!c.dead);
  }
}
