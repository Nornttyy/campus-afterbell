import {INTERACTION_SECONDS} from './item-rules50.js?v=campus-108';
import {mealPortion,mealInReach,examCardNumber,QUESTION_COUNT} from './upper-floors85.js?v=campus-92';
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
export function examMode(round,mode,slot=0){
 const p=round.player;
 if(mode==='close'){
  if(!p._examMode)return false;
  p._examMode=null;p._examUse=null;p._examElapsed=0;return true;
 }
 if(!atExam(round,p)||p._examMode||!['paper','card'].includes(mode))return false;
 if(mode==='card'&&(!p._drawerOpen||![0,1].includes(slot)))return false;
 if(mode==='card'&&p._examAnswers===allQuestions)return false;
 if(mode==='paper'){p._drawerOpen=false;p.yaw=p.seatYaw||0;p.pitch=.80;}
 else p._examCard=examCardNumber(p,slot);
 p._examMode=mode;p._examUse=null;p._examElapsed=0;return true;
}
export function examUse(round,question){
 const p=round.player;if(!p._examMode||!atExam(round,p))return false;
 if(question===null){p._examUse=null;p._examElapsed=0;return true;}
 if(p._examUse!=null)return false;
 if(p._examMode==='card'){if(question!==-1||p._examReadCard===p._examCard&&p._examUntil>round.elapsed)return false;}
 else if(!Number.isInteger(question)||question<0||question>=QUESTION_COUNT||p._examHint!==question||!(p._examUntil>round.elapsed)||((p._examAnswers||0)&(1<<question)))return false;
 p._examUse=question;p._examElapsed=0;return true;
}
export function examSnapshot(p,now){
 return {complete:p._examAnswers===allQuestions,mode:p._examMode||null,sheet:p._examSheet||0,card:p._examCard??null,cards:[examCardNumber(p,0),examCardNumber(p,1)],answered:p._examAnswers||0,hint:p._examUntil>now?p._examHint:null,seconds:Math.max(0,Math.ceil((p._examUntil||0)-now)),using:p._examUse!=null,progress:Math.min(1,(p._examElapsed||0)/INTERACTION_SECONDS)};
}
export function advanceExams(round,dt){
 if(round.map!=='exam')return;
 for(const a of round.students){
  if(!atExam(round,a)){a._examMode=null;a._examUse=null;a._examElapsed=0;continue;}
  if(!a.isPlayer&&!a.networkHuman&&round._team.has(a.id)&&a._examUse==null&&round.elapsed>=(a._examDecisionAt??(7+a.id))){
   if(a._examAnswers===allQuestions)continue;
   if(a._examMode==='card'&&a._examUntil>round.elapsed){a._examMode='paper';a._examUse=a._examHint;}
   else{a._examMode='card';a._examCard=examCardNumber(a,0);a._examUse=-1;}
   a._examElapsed=0;
  }
  if(a._examUse==null)continue;
  if(a._examMode==='paper'&&a._examUntil<=round.elapsed){a._examUse=null;a._examElapsed=0;continue;}
  a._examElapsed+=dt;if(a._examElapsed+1e-8<INTERACTION_SECONDS)continue;
  if(a._examMode==='card'){
   a._examHint=a._examReadCard=a._examCard;a._examUntil=round.elapsed+10;a._examReads=(a._examReads||0)+1;
  }else if(a._examMode==='paper'){
   a._examAnswers=(a._examAnswers||0)|(1<<a._examUse);a._examUntil=0;
   const finished=a._examAnswers===allQuestions;
   const points=round._creditScore(a,(a._examUse===QUESTION_COUNT-1?4:2)+(finished?5:0));
   if(finished){
    a._examUntil=0;
    const stock=round.classSlotsBySeat.get(a.seatId)||[];
    if(!stock.length)for(let id=0;id<3;id++)stock.push(round._deskSlot(id));
    round.classSlotsBySeat.set(a.seatId,stock);a._slots=stock;
   }
   round._events.push({type:'exam-answer',studentId:a.id,actor:a.isPlayer||a.networkHuman?'player':'ai',question:a._examUse,points});
  }
  if(round.score>=round.target){a._examUse=null;a._examElapsed=0;round._finish('won','mischief');return;}
  a._examDecisionAt=round.elapsed+(a._examMode==='paper'?12+a.id%7:1);a._examUse=null;a._examElapsed=0;
 }
}
