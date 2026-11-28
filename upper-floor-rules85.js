import {INTERACTION_SECONDS} from './item-rules50.js?v=campus-117';
import {mealPortion,mealInReach,examCardNumber,QUESTION_COUNT} from './upper-floors85.js?v=campus-92&rev=128';
export function takeMeal(round,id){
 const p=round.player,portion=mealPortion(id,round._sessionElapsed);
 if(round.map!=='cafeteria'||!round._classInputAllowed()||p.id<0||round._restrained(p)||p._drawnSlot!==null||!mealInReach(p,portion)||!round._clearWallSegment(p,portion)||round.mealsTaken[id]===portion.lap)return false;
 round.mealsTaken[id]=portion.lap;
 p._slots=[{id:0,action:portion.action,readyAt:Infinity,progress:0,temporary:true,heldBy:p.id}];
 p._selectedSlot=p._drawnSlot=0;p._heldSource={meal:id,lap:portion.lap,dish:portion.dish};p._drawerOpen=false;p.action=round.selected=portion.action;
 p.holding=round.holding=false;p.progress=0;return true;
}
export function canReturnMeal(round,p){
 const s=p._heldSource,portion=mealPortion(s.meal,round._sessionElapsed);
 return !!portion&&p._slots[p._drawnSlot]?.action===portion.action&&s.lap===portion.lap&&round.mealsTaken[s.meal]===s.lap&&mealInReach(p,portion)&&round._clearWallSegment(p,portion);
}
function atExam(round,p){return round.map==='exam'&&round.stage==='class'&&round.status==='playing'&&!round.paused&&p.id>=0&&p.seated&&!p._officeChair&&p._drawnSlot==null&&!round._restrained(p);}
const allQuestions=(1<<QUESTION_COUNT)-1;
function hints(p,now){
 return (p._examHints||[]).filter(h=>h.until>now&&!((p._examAnswers||0)&(1<<h.question)));
}
function resetUse(p){p._examUse=null;p._examCopy=null;p._examElapsed=0;}
function copyQuestion(round,p,id){
 const other=round.students[id];
 if(!atExam(round,p)||p._examMode==='card'||(p._examCopies||0)>=2||!other||other===p||!other.seated||other._officeChair||other.visible===false)return null;
 const dx=other.x-p.x,dz=other.z-p.z,d=Math.hypot(dx,dz);
 if(d<.1||d>4.5||(dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw))/d < Math.cos(Math.atan2(.38,d))||Math.abs(p.pitch)>.65||!round._clearWallSegment(p,other))return null;
 const available=(other._examAnswers||0)&~(p._examAnswers||0);
 return available?Math.log2(available&-available):null;
}
export function copyExam(round,id){
 const p=round.player;
 if(id===null){resetUse(p);return true;}
 if(!Number.isInteger(id)||p._examUse!=null)return false;
 const q=copyQuestion(round,p,id);if(q==null)return false;
 p._examCopy=id;p._examUse=q;p._examElapsed=0;return true;
}
export function examMode(round,mode,slot=0){
 const p=round.player;
 if(mode==='close'){
  if(!p._examMode)return false;
  p._examMode=null;resetUse(p);return true;
 }
 if(!atExam(round,p)||p._examMode||!['paper','card'].includes(mode))return false;
 if(mode==='card'&&(!p._drawerOpen||![0,1].includes(slot)))return false;
 if(mode==='card'&&p._examAnswers===allQuestions)return false;
 if(mode==='paper'){p._drawerOpen=false;p.yaw=p.seatYaw||0;p.pitch=.80;}
 else p._examCard=examCardNumber(p,slot);
 p._examMode=mode;resetUse(p);return true;
}
export function examUse(round,question){
 const p=round.player;if(question===null){resetUse(p);return true;}
 if(!p._examMode||!atExam(round,p))return false;
 if(p._examUse!=null)return false;
 if(p._examMode==='card'){if(question!==-1||hints(p,round.elapsed).some(h=>h.question===p._examCard)||hints(p,round.elapsed).length>=4)return false;}
 else if(!Number.isInteger(question)||question<0||question>=QUESTION_COUNT||!hints(p,round.elapsed).some(h=>h.question===question)||((p._examAnswers||0)&(1<<question)))return false;
 p._examUse=question;p._examElapsed=0;return true;
}
export function examSnapshot(p,now){
 const active=hints(p,now),first=active[0];
 return {hints:active.map(h=>({question:h.question,seconds:Math.max(0,h.until-now)})),copies:p._examCopies||0,copyTarget:p._examCopy??null,complete:p._examAnswers===allQuestions,mode:p._examMode||null,sheet:p._examSheet||0,card:p._examCard??null,cards:[examCardNumber(p,0),examCardNumber(p,1)],answered:p._examAnswers||0,hint:first?.question??null,seconds:first?Math.ceil(first.until-now):0,using:p._examUse!=null,progress:Math.min(1,(p._examElapsed||0)/INTERACTION_SECONDS)};
}
export function advanceExams(round,dt){
 if(round.map!=='exam')return;
 for(const a of round.students){
  if(!atExam(round,a)){a._examMode=null;resetUse(a);continue;}
  if(!a.isPlayer&&!a.networkHuman&&!round._team.has(a.id)&&round.elapsed>=(a._nextAnswerAt??(4+a.id%7))){
   a._examAnswers=(a._examAnswers||0)|(1<<examCardNumber(a,0));a._nextAnswerAt=round.elapsed+9+a.id%4;
  }
  if(!a.isPlayer&&!a.networkHuman&&round._team.has(a.id)&&a._examUse==null&&round.elapsed>=(a._examDecisionAt??(7+a.id))){
   if(a._examAnswers===allQuestions)continue;
   if(a._examMode==='card'&&hints(a,round.elapsed).length){a._examMode='paper';a._examUse=hints(a,round.elapsed)[0].question;}
   else{a._examMode='card';a._examCard=examCardNumber(a,0);a._examUse=-1;}
   a._examElapsed=0;
  }
  if(a._examUse==null)continue;
  if(a._examCopy!=null?copyQuestion(round,a,a._examCopy)!==a._examUse:a._examMode==='paper'&&!hints(a,round.elapsed).some(h=>h.question===a._examUse)){resetUse(a);continue;}
  a._examElapsed+=dt;if(a._examElapsed+1e-8<INTERACTION_SECONDS)continue;
  if(a._examMode==='card'){
   a._examHints=[...hints(a,round.elapsed),{question:a._examCard,until:round.elapsed+10}].slice(-4);a._examReads=(a._examReads||0)+1;
  }else if(a._examMode==='paper'||a._examCopy!=null){
   if(a._examCopy!=null)a._examCopies=(a._examCopies||0)+1;
   a._examAnswers=(a._examAnswers||0)|(1<<a._examUse);
   const finished=a._examAnswers===allQuestions;
   const points=round._creditScore(a,(a._examUse===QUESTION_COUNT-1?4:2)+(finished?5:0));
   if(finished){
    
    const stock=round.classSlotsBySeat.get(a.seatId)||[];
    if(!stock.length)for(let id=0;id<3;id++)stock.push(round._deskSlot(id));
    round.classSlotsBySeat.set(a.seatId,stock);a._slots=stock;
   }
   round._events.push({type:'exam-answer',studentId:a.id,actor:a.isPlayer||a.networkHuman?'player':'ai',question:a._examUse,points});
  }
  if(round.score>=round.target){resetUse(a);round._finish('won','mischief');return;}
  a._examDecisionAt=round.elapsed+(a._examMode==='paper'?12+a.id%7:1);resetUse(a);
 }
}
