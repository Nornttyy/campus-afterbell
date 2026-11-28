// Food moves along the two long serving counters. The snapshot only carries
// the last portion removed from each lane slot; position uses the room clock.
export const SERVING_BELTS=Object.freeze([-2.84,2.84].map((x,id)=>Object.freeze({id,x,minZ:-8.30,maxZ:5.35,width:.96,top:1.055})));
export const SERVING_SOLIDS=Object.freeze(SERVING_BELTS.map(b=>Object.freeze({id:'serving-counter-'+b.id,minX:b.x-b.width/2,maxX:b.x+b.width/2,minZ:b.minZ,maxZ:b.maxZ,minY:0,maxY:b.top})));
export const CAFETERIA_SEATS=Object.freeze([-6.95,-4.28,-1.61,1.06,3.73].flatMap((deskZ,row)=>[-4.08,-1.60,1.60,4.08].map((deskX,col)=>Object.freeze({id:row*4+col,row,col,deskX,deskZ,x:deskX,z:deskZ-.78,yaw:0,map:'cafeteria',pattern:'counter-rows'}))));
export const SERVING_MENU=Object.freeze(['burger','drink','snack','banana']);
export const MEAL_COUNT=10;
export function mealPortion(id,time=0){
 if(!Number.isInteger(id)||id<0||id>=MEAL_COUNT)return null;
 const count=MEAL_COUNT/2,belt=SERVING_BELTS[Math.floor(id/count)],slot=id%count,span=belt.maxZ-belt.minZ-.42;
 const travel=slot*span/count+Math.max(0,time)*.53,lap=Math.floor(travel/span),offset=travel-lap*span;
 const dish=SERVING_MENU[(id+lap)%SERVING_MENU.length];
 return {id,lap,action:dish,dish,x:belt.x,y:belt.top+.012,z:belt.id?belt.maxZ-.21-offset:belt.minZ+.21+offset,edge:Math.min(offset,span-offset)};
}
export function mealInReach(p,portion){return !!portion&&Math.hypot(p.x-portion.x,p.z-portion.z)<1.72;}
export const EXAM_QUESTIONS=Object.freeze([
 ['上课铃迟到了，谁来罚它站门口？','下课铃'],
 ['粉笔写完自己的遗书，还剩下什么？','一地遗言'],
 ['作业本说它被狗吃了。这句话谁写的？','狗'],
 ['黑板擦擦掉了值日表，今天谁值日？','黑板擦'],
 ['蜗牛从第一排爬去交卷，要带什么？','毕业证'],
 ['课桌吞了我的便当，哪个抽屉会打嗝？','装汽水的那个'],
 ['体育老师请假了，跳绳代课先点谁？','两个摇绳的'],
 ['饭卡余额是负数，去食堂能打到什么？','一勺欠饭'],
 ['同桌的影子举手了，该叫谁答题？','关灯的人'],
 ['橡皮想把昨天擦掉，先擦哪里？','日历的背面'],
 ['电风扇转了一节课，为什么还在原地？','它没交走读证'],
 ['监考老师也是一道题，交卷时要交谁？','把老师交上去']
]);
export const QUESTION_COUNT=EXAM_QUESTIONS.length;
export function examCardNumber(actor,slot){
 const answered=actor._examAnswers||0,start=((actor.seatId||0)*2+(actor._examReads||0)+slot)%QUESTION_COUNT;
 for(let i=0;i<QUESTION_COUNT;i++){const n=(start+i)%QUESTION_COUNT;if(!(answered&(1<<n)))return n;}
 return start;
}
