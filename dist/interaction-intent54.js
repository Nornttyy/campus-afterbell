// A key resolves to ONE explicit action. In particular, returning a pen must
// never fall through to opening the drawer underneath the crosshair.
const intent=(method,args,label,hold=false)=>({method,args,label,hold});
export function interactionIntent(s,target,key){
 const p=s.player,d=s.drawer||{},carrying=d.drawnSlot!=null,teacher=s.role==='teacher',doorId=target?.doorId||'rear',doorClosed=s[doorId==='office'?'officeDoorClosed':doorId+'DoorClosed'];
 if(s.paused||s.status!=='playing'||s.elevator?.phase==='travel')return null;
 if(key==='Q'){
  if(p.mapActivity)return intent('releaseMapActivity',[],p.mapActivity.kind==='hang'?'松手':'放回搋子');
  if(s.surveillance?.viewing!=null)return intent('closeSurveillance',[],'关闭监控');
  if(p.computerActive)return intent('computerBack',[],p.computer?.app==='desktop'?'离开电脑':'返回桌面');
  if(p.caught||['stunned','carried','bound'].includes(p.captivity))return null;
  if(teacher&&s.teacher.carriedId!=null)return intent('dropStudent',[],'放下同学');
  if(carrying)return d.canReturn===false?null:intent('returnItem',[],s.selected==='pen'?'放回笔':'放回物品');
  if(teacher&&s.teacher.writing)return intent('setWriting',[false],'停止写字');
  if(target?.kind==='toilet-door')return target.open?intent('toggleToiletDoor',[target.id],'关门'):null;
  if(target?.kind==='rear-door')return !doorClosed&&!(doorId==='office'&&s.officeLocked)?intent('setDoorUse',target?.doorId?[true,true,doorId]:[true,true],'关门',true):null;
  if(target?.kind==='book')return p.bookRaised?intent('setBookRaised',[false],'放下书本'):null;
  if(['desk','office-desk'].includes(target?.kind))return d.open?intent(p.officeChair?'setOfficeDrawerOpen':'setDrawerOpen',[false],'关闭抽屉'):null;
  if(p.bookRaised)return intent('setBookRaised',[false],'放下书本');
  if(d.open)return intent(p.officeChair?'setOfficeDrawerOpen':'setDrawerOpen',[false],'关闭抽屉');
  if(p.seated)return intent('interact',[],'起身');
  return null;
 }
 if(key!=='E'||p.computerActive||p.caught||['stunned','carried','bound'].includes(p.captivity))return null;
 if(p.mapActivity)return null;
 if(target?.kind==='sports-bar'&&!teacher&&!carrying)return intent('startMapActivity',['hang',target.id],'抓住单杠');
 if(target?.kind==='plunger'&&!teacher&&!carrying)return intent('startMapActivity',['plunge',target.id],'疏通',true);
 if(target?.kind==='toilet-door')return !target.open?intent('toggleToiletDoor',[target.id],'开门'):null;
 if(target?.kind==='bed'&&!teacher)return p.onBed?intent('toggleBedLie',[],p.lying?'坐起':'躺下'):!p.seated?intent('interact',[target.id],'上床'):null;
 if(target?.kind==='vending'&&!teacher&&!carrying)return intent('takePlaygroundFood',['snack'],'拿取');
 if(target?.kind==='surveillance'&&teacher)return target.installed?intent('viewSurveillance',[target.id],'查看监控'):target.ready?intent('deploySurveillance',[target.id],'安装监控'):null;
 if(carrying&&p.seated&&target?.kind==='chair'&&target.id===p.seatId)return intent('interact',[],'拿着起身');
 if(carrying&&s.selected==='pen'&&p.seated)return p.officeChair?intent('interact',[],'拿着起身'):intent('togglePenMode',[],p.penWriting?'转笔':'写字');
 if(target?.kind==='rear-door')return doorClosed&&!(doorId==='office'&&s.officeLocked)?intent('setDoorUse',target?.doorId?[true,false,doorId]:[true,false],'开门',true):null;
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
 if(target?.kind==='desk')return !d.open?intent('setDrawerOpen',[true],['dorm','toilet'].includes(s.map)?'打开柜门':'打开抽屉'):null;
 if(target?.kind==='book')return !p.bookRaised?intent('setBookRaised',[true],'竖起书本'):null;
 if(target?.kind==='pen')return intent('takePen',[],'拿起笔');
 if(target?.kind==='computer')return intent('startComputer',[],'打开电脑');
 if(target?.kind==='item')return intent('takeSlot',[target.slot],'拿取');
 return null;
}
