// Food moves along the two long serving counters. The snapshot only carries
// the last portion removed from each lane slot; position uses the room clock.
export const SERVING_BELTS=Object.freeze([-2.84,2.84].map((x,id)=>Object.freeze({id,x,minZ:-8.30,maxZ:5.35,width:.82,top:1.04})));
export const SERVING_SOLIDS=Object.freeze(SERVING_BELTS.map(b=>Object.freeze({id:'serving-counter-'+b.id,minX:b.x-b.width/2,maxX:b.x+b.width/2,minZ:b.minZ,maxZ:b.maxZ,minY:0,maxY:b.top})));
export const CAFETERIA_SEATS=Object.freeze([-6.95,-4.28,-1.61,1.06,3.73].flatMap((deskZ,row)=>[-4.08,-1.60,1.60,4.08].map((deskX,col)=>Object.freeze({id:row*4+col,row,col,deskX,deskZ,x:deskX,z:deskZ-.78,yaw:0,map:'cafeteria',pattern:'counter-rows'}))));
export const SERVING_MENU=Object.freeze(['burger','drink','snack','banana','chickenBucket','layerCake']);
export const MEAL_COUNT=10;
export function mealPortion(id,time=0){
 if(!Number.isInteger(id)||id<0||id>=MEAL_COUNT)return null;
 const count=MEAL_COUNT/2,belt=SERVING_BELTS[Math.floor(id/count)],slot=id%count,span=belt.maxZ-belt.minZ-.42;
 const travel=slot*span/count+Math.max(0,time)*.53,lap=Math.floor(travel/span),offset=travel-lap*span;
 const dish=SERVING_MENU[(id+lap)%SERVING_MENU.length],action=dish==='chickenBucket'||dish==='layerCake'?'burger':dish;
 return {id,lap,action,dish,x:belt.x,y:belt.top+.012,z:belt.id?belt.maxZ-.21-offset:belt.minZ+.21+offset,edge:Math.min(offset,span-offset)};
}
export function mealInReach(p,portion){return !!portion&&Math.hypot(p.x-portion.x,p.z-portion.z)<1.72;}
export const EXAM_QUESTIONS=Object.freeze([
 ['两排树各有九棵，一共有多少棵？','十八棵'],['一支铅笔两元，三支多少钱？','六元'],['一个小时有几分钟？','六十分钟'],
 ['一张正方形纸对折两次，有几层？','四层'],['蓝色加黄色，颜料会变成什么颜色？','绿色'],['十个十相加是多少？','一百'],
 ['把二十四支笔平分给六人，每人几支？','四支'],['一天之中，时针走几圈？','两圈'],['水在标准气压下多少摄氏度结冰？','零度'],
 ['长六格、宽四格的长方形周长是多少？','二十格'],['两本书各有十五页，共多少页？','三十页'],['太阳从哪个方向升起？','东方']
]);
export const QUESTION_COUNT=EXAM_QUESTIONS.length;
export function examCardNumber(actor,slot){
 const answered=actor._examAnswers||0,start=((actor.seatId||0)*2+(actor._examReads||0)+slot)%QUESTION_COUNT;
 for(let i=0;i<QUESTION_COUNT;i++){const n=(start+i)%QUESTION_COUNT;if(!(answered&(1<<n)))return n;}
 return start;
}
