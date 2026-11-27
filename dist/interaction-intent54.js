import {canOpenSchoolDoor} from './school-door-motion65.js?v=campus-92';
import {radioPowerFor,reachesRadio} from './campus-radio93.js?v=campus-117';
// A key resolves to ONE explicit action. In particular, returning a pen must
// never fall through to opening the drawer underneath the crosshair.
const intent=(method,args,label,hold=false)=>({method,args,label,hold});
export function interactionIntent(s,target,key){
 const p=s.player,d=s.drawer||{},carrying=d.drawnSlot!=null,teacher=s.role==='teacher',doorId=target?.doorId||target?.id||'rear';
 const storageDoor=['dorm','toilet'].includes(s.map)&&!p.officeChair;
 if(s.paused||s.status!=='playing'||s.elevator?.phase==='travel')return null;
 if(target?.kind==='radio'&&s.stage==='class'&&reachesRadio(s.map,p)){
  const power=radioPowerFor(s.role,s.radio);
  if(power===true&&key==='E')return intent('setFixtureUse',['radio'],'换歌',true);
  if(power===false&&(key==='E'||key==='Q'&&s.teacher?.carriedId==null))return intent('changeRadio',[false],'关闭播音器');
  if(key==='E')return null;
 }
 if(key==='Q'){
  if(s.exam?.mode)return intent('setExamMode',['close'],s.exam.mode==='card'?'放回答案卡':'放下红笔');
  if(p.mapActivity)return intent('releaseMapActivity',[],p.mapActivity.kind==='hang'?'松手':'放回搋子');
  if(s.surveillance?.viewing!=null)return intent('closeSurveillance',[],'关闭监控');
  if(p.computerActive||target?.kind==='computer')return null;
  if(p.caught||['stunned','carried','bound'].includes(p.captivity))return null;
  if(teacher&&s.teacher.carriedId!=null)return intent('dropStudent',[],'放下同学');
  if(carrying)return d.canReturn===false||!p.seated?intent('dropItem',[],'放下物品'):intent('returnItem',[],s.selected==='pen'?'放回笔':'放回物品');
  if(teacher&&s.teacher.writing)return intent('setWriting',[false],'停止写字');
  if(target?.kind==='dorm-door')return s.stage!=='gathering'&&s.stage!=='dismissal'&&target.open?intent('toggleDormDoor',[target.id],'关门'):null;
  if(target?.kind==='toilet-door')return s.stage!=='gathering'&&s.stage!=='dismissal'&&target.open?intent('toggleToiletDoor',[target.id],'关门'):null;
  if(target?.kind==='rear-door')return null;
  if(target?.kind==='book')return p.bookRaised?intent('setBookRaised',[false],'放下书本'):null;
  if(['desk','office-desk'].includes(target?.kind)){
   if(d.open)return intent(p.officeChair?'setOfficeDrawerOpen':'setDrawerOpen',[false],storageDoor?'关闭柜门':'关闭抽屉');
   if(!p.onBed)return null;
  }
  if(p.bookRaised)return intent('setBookRaised',[false],'放下书本');
  if(d.open)return intent(p.officeChair?'setOfficeDrawerOpen':'setDrawerOpen',[false],storageDoor?'关闭柜门':'关闭抽屉');
  if(p.seated)return intent('interact',[],p.onBed?'下床':'起身');
  return null;
 }
 if(key!=='E'||p.computerActive||p.caught||['stunned','carried','bound'].includes(p.captivity))return null;
 if(p.mapActivity||s.exam?.mode)return null;
 if(!teacher&&carrying&&s.stage==='class'&&target?.kind==='toilet-bowl')return target.blocked?null:intent('dropIntoToilet',[target.id],'丢进马桶');
 if(!teacher&&!carrying&&s.stage==='class'){
  if(target?.kind==='cooked-piece')return intent('takeCookedPiece',[target.id,target.piece],'夹起涮菜');
  if(target?.kind==='meal')return intent('takeMeal',[target.id],'取餐');
  if(target?.kind==='exam-paper')return intent('setExamMode',['paper'],'拿起红笔');
  if(target?.kind==='exam-card')return intent('setExamMode',['card',target.id],'拿起答案卡');
 }
 if(target?.kind==='sports-bar'&&!teacher&&!carrying)return intent('startMapActivity',['hang',target.id],'抓住单杠');
 if(target?.kind==='plunger'&&!teacher&&!carrying)return intent('startMapActivity',['plunge',target.id],'疏通',true);
 if(target?.kind==='dorm-door')return s.stage!=='gathering'&&s.stage!=='dismissal'&&!target.open?intent('toggleDormDoor',[target.id],'开门'):null;
 if(target?.kind==='toilet-door')return s.stage!=='gathering'&&s.stage!=='dismissal'&&!target.open?intent('toggleToiletDoor',[target.id],'开门'):null;
 if(target?.kind==='bed'&&!teacher)return !p.seated?intent('interact',[target.id],'上床'):null;
 if(target?.kind==='vending'&&!teacher&&!carrying&&target.ready){
  return intent('setFixtureUse',[target.id],'出货',true);
 }
 if(target?.kind==='ground-item'&&!teacher&&!carrying)return intent('takeGroundItem',[target.id],'拿取');
 if(target?.kind==='cooler-item'&&!teacher&&!carrying)return intent('takeCoolerItem',[target.id],'拿取');
 if(target?.kind==='vending-food'&&!teacher&&!carrying&&target.ready)return intent('collectVendingFood',[target.id],'拿取');
 if(target?.kind==='surveillance'&&teacher)return target.installed?intent('viewSurveillance',[target.id],'查看监控'):target.ready?intent('deploySurveillance',[target.id],'安装监控'):null;
 if(carrying&&p.seated&&target?.kind==='chair'&&target.id===p.seatId)return intent('interact',[],'拿着起身');
 if(carrying&&s.selected==='pen'&&p.seated)return p.officeChair?intent('interact',[],'拿着起身'):intent('togglePenMode',[],p.penWriting?'转笔':'写字');
 if(target?.kind==='rear-door')return canOpenSchoolDoor(s.stage,s,doorId)?intent('setDoorUse',target?.doorId?[true,false,doorId]:[true,false],'开门',true):null;
 if(target?.kind==='office-chair')return !p.seated&&(!teacher||s.teacher.carriedId==null)?intent('interact',[target.id||'office-chair'],'坐下'):null;
 if(target?.kind==='chair')return !p.seated?intent('interact',[target.id],'坐下'):null;
 if(teacher&&s.stage==='class'){
  if(s.teacher.carriedId!=null)return s.bindPost!=null?intent('bindStudent',[],'绑到木桩'):null;
  if(target?.kind==='release')return intent('releaseBoundStudent',[],'释放同学');
  if(target?.kind==='blackboard')return intent('setWriting',[true],'写板书',true);
  if(target?.grabReady&&!p.seated)return intent('grabStudent',[],'抓住同学');
 }
 if(target?.kind==='rescue')return intent('setRescue',[target.id],'解救同学',true);
 if(carrying)return p.seated?intent('interact',[],'拿着起身'):null;
 if(target?.kind==='office-desk')return !d.open?intent('setOfficeDrawerOpen',[true,target.id],'打开抽屉'):null;
 if(teacher)return null;
 if(target?.kind==='desk')return !d.open?intent('setDrawerOpen',[true],storageDoor?'打开柜门':'打开抽屉'):null;
 if(target?.kind==='book')return !p.bookRaised?intent('setBookRaised',[true],'竖起书本'):null;
 if(target?.kind==='pen')return intent('takePen',[],'拿起笔');
 if(target?.kind==='computer')return null;
 if(target?.kind==='item')return intent('takeSlot',[target.slot],'拿取');
 return null;
}
