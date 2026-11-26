import * as T from './vendor/three.module.js';
import {createServingDish} from './game-actors.js?v=campus-114';
import {PARTITIONS,CLASSROOM,CORRIDOR} from './classroom-layout.js?v=campus-108';
import {restDeskItem} from './prop-assets.js?v=campus-83';
import {SERVING_BELTS,SERVING_MENU,MEAL_COUNT,mealPortion,EXAM_QUESTIONS} from './upper-floors85.js?v=campus-92';

const paperWidth=.89,paperDepth=.60;
const paperFont='"PingFang SC","Microsoft YaHei",sans-serif';
const rowTop=.193,rowHeight=.120,columnLeft=.044,columnWidth=.465;
export function paperQuestion(u,v){
 const x=u-columnLeft,y=1-v-rowTop;
 if(x<0||x>=2*columnWidth||y<0||y>=6*rowHeight)return null;
 return Math.floor(x/columnWidth)*6+Math.floor(y/rowHeight);
}
export function createUpperFloorView({scene,box,mat,texture,bakeStatic,drawerRecords,finishes={}}){
 const root=new T.Group();root.name='upper-floor-furnishings';root.visible=false;scene.add(root);
 const wings={},portions=[],paperSeats=new Map(),cards=[],cardPrint=new Map(),paperPrint=new Map();
 const geometry=new Set(),own=g=>(geometry.add(g),g);
 let mode=null,seats=[],held=null,activeCard=-1,lastPaper=null,liveSheet=null;
 function wing(name){const g=new T.Group();g.name=name;root.add(g);return g;}
 function surface(g,geo,material,x,y,z,flat=false){
  const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.receiveShadow=true;
  if(flat)m.rotation.set(-Math.PI/2,0,Math.PI);g.add(m);return m;
 }
 function face(g,m,x,y,z,w,h,angle){
  const p=surface(g,own(new T.PlaneGeometry(w,h)),m,x,y,z);p.rotation.y=angle;return p;
 }
 function cafeteria(){
  const group=wing('cafeteria-serving-hall'),fixed=new T.Group();group.add(fixed);
  const orange=mat('#e4a137'),steel=mat('#a6aca8',{metalness:.48,roughness:.38}),cream=mat('#c5b196',{roughness:.73}),lip=mat('#d79a65',{map:finishes.veneer||null,roughness:.52});
  const runner=texture(256,512,(c,w,h)=>{
   c.fillStyle='#c59871';c.fillRect(0,0,w,h);
   for(let y=0;y<h;y+=8){c.fillStyle=y%24?'#c79e7b':'#b98e68';c.fillRect(0,y,w,1);}
   c.fillStyle='#fff2de';c.beginPath();c.moveTo(w*.5,h*.16);c.lineTo(w*.87,h*.76);c.quadraticCurveTo(w*.88,h*.79,w*.84,h*.79);c.lineTo(w*.16,h*.79);c.quadraticCurveTo(w*.12,h*.79,w*.13,h*.76);c.closePath();c.fill();
  });runner.wrapT=T.RepeatWrapping;runner.repeat.y=9;
  const beltMat=mat('#ffffff',{map:runner,roughness:.88});
  for(const b of SERVING_BELTS){
   const center=(b.maxZ+b.minZ)/2,len=b.maxZ-b.minZ;
   box(cream,[b.x,b.top/2,center],[b.width-.08,b.top-.07,len-.03],null,fixed);
   box(steel,[b.x,.09,center],[b.width-.04,.10,len],null,fixed);
   box(lip,[b.x,b.top-.045,center],[b.width,.09,len],null,fixed);
   const top=surface(fixed,own(new T.PlaneGeometry(b.width-.055,len-.035)),beltMat,b.x,b.top+.001,center,true);
   if(b.id)top.rotation.z=0;
   for(const side of [-1,1]){
    const x=b.x+side*(b.width/2-.034);
    for(let z=b.minZ+.57;z<b.maxZ-.45;z+=1.65){
     box(lip,[x,b.top-.19,z],[.024,.039,1.53],null,fixed);
     box(steel,[x+side*.013,b.top-.30,z],[.014,.023,.20],null,fixed);
    }
    box(steel,[x+side*.026,.18,center],[.018,.023,len-.08],null,fixed);
   }
   for(const side of [-1,1])box(orange,[b.x+side*(b.width/2-.012),b.top-.013,center],[.024,.035,len],null,fixed);
   for(let z=b.minZ+.56;z<b.maxZ;z+=1.65)for(const side of [-1,1])box(steel,[b.x+side*(b.width/2-.034),b.top*.46,z],[.012,b.top*.73,.012],null,fixed);
  }
  for(const [x,z,w,d] of [[.25,-9.92,13.68,.032],[.25,8.72,13.68,.032],[-6.58,-.60,.032,18.52],...PARTITIONS.map(p=>{const lo=Math.max(CLASSROOM.minZ,p.minZ),hi=Math.min(CLASSROOM.maxZ,p.maxZ);return [7.157,(hi+lo)/2,.032,hi-lo];})]){
   box(orange,[x,.55,z],[w,1.08,d],null,fixed);
  }
  // The yellow dado continues around the approach, with both classroom doors left clear.
  for(const p of PARTITIONS)box(orange,[7.444,.56,(p.minZ+p.maxZ)/2],[.019,1.07,p.maxZ-p.minZ],null,fixed);
  box(orange,[7.444,.56,(CORRIDOR.minZ+CLASSROOM.minZ)/2],[.018,1.07,CLASSROOM.minZ-CORRIDOR.minZ],null,fixed);
  box(orange,[CORRIDOR.maxX-.050,.56,(CORRIDOR.minZ+CORRIDOR.maxZ)/2],[.018,1.07,CORRIDOR.maxZ-CORRIDOR.minZ],null,fixed);
  const label=texture(960,448,(c,w,h)=>{
   c.fillStyle='#ae692e';c.fillRect(0,0,w,h);c.fillStyle='#f9ebd0';c.fillRect(10,10,w-20,h-20);
   c.textAlign='center';c.fillStyle='#593322';c.font='bold 109px '+paperFont;c.fillText('自 助',w*.72,h*.44);c.fillText('食 堂',w*.72,h*.77);
   for(const [x,y,v,color] of [[147,168,66,'#e78c37'],[290,246,62,'#cb723d'],[216,260,43,'#88a65a']]){
    c.fillStyle='#e6d6ba';c.beginPath();c.ellipse(x+4,y+22,v+17,v*.55,0,0,Math.PI*2);c.fill();
    c.fillStyle='#fff9e9';c.beginPath();c.ellipse(x,y+16,v+14,v*.54,0,0,Math.PI*2);c.fill();
    c.fillStyle=color;c.beginPath();c.ellipse(x,y,v,v*.55,-.16,0,Math.PI*2);c.fill();
    c.fillStyle='#fff1bc';for(let i=0;i<8;i++){c.beginPath();c.ellipse(x+Math.sin(i*7)*v*.63,y+Math.cos(i*4)*v*.27,4,2,-.3,0,Math.PI*2);c.fill();}
   }
  });
  face(fixed,mat('#fff',{map:label}),CORRIDOR.maxX-.075,2.12,CORRIDOR.minZ+6.8,4.98,2.34,-Math.PI/2);
  bakeStatic?.(fixed);
  const plate=own(new T.CylinderGeometry(.19,.15,.023,20)),ivory=mat('#f4e7cd');
  for(let id=0;id<MEAL_COUNT;id++){
   const carrier=new T.Group();carrier.name='serving-portion-'+id;group.add(carrier);
   surface(carrier,plate,ivory,0,.012,0);
   const models=new Map();
   for(const action of SERVING_MENU){
    const object=createServingDish(action);if(action==='snack'||action==='drink')object.rotation.x=-Math.PI*.45;
    restDeskItem(object,.025);object.visible=false;carrier.add(object);models.set(action,object);
   }
   portions.push({carrier,models,action:null});
  }
  return group;
 }
 function drawSheet(c,w,h,answered=0,hint=null){
  c.fillStyle='#fbf9f0';c.fillRect(0,0,w,h);
  const spine=c.createLinearGradient(w*.47,0,w*.53,0);spine.addColorStop(0,'rgba(142,119,91,0)');spine.addColorStop(.48,'rgba(121,116,100,.11)');spine.addColorStop(.54,'rgba(255,255,249,.62)');spine.addColorStop(1,'rgba(255,255,250,0)');c.fillStyle=spine;c.fillRect(w*.47,0,w*.06,h);
  c.strokeStyle='#b8b5a7';c.lineWidth=1.4;c.strokeRect(w*.026,h*.035,w*.948,h*.921);
  c.fillStyle='#68716b';c.font='16px '+paperFont;c.textAlign='left';c.fillText('校内试卷',w*.044,h*.081);
  c.textAlign='right';c.fillText('第 1 页',w*.95,h*.926);
  c.fillStyle='#29363a';c.textAlign='center';c.font='bold 40px '+paperFont;c.fillText('随 堂 测 验',w/2,h*.095);
  c.font='20px '+paperFont;c.fillText('班级 __________     姓名 __________     座号 ______',w/2,h*.151);
  c.strokeStyle='#b2b3aa';c.lineWidth=1.5;c.beginPath();c.moveTo(w*.5,h*.19);c.lineTo(w*.5,h*.935);c.stroke();
  c.textAlign='left';
  for(const [i,[q,a]]of EXAM_QUESTIONS.entries()){
   const x=(columnLeft+Math.floor(i/6)*columnWidth)*w,y=(rowTop+i%6*rowHeight)*h,done=Boolean(answered&(1<<i));
   if(i===hint){c.fillStyle='#d6ebbd';c.fillRect(x-7,y,w*.439,h*rowHeight-3);}
   c.fillStyle='#28343b';c.font='21px '+paperFont;c.fillText((i+1)+'．'+q,x,y+25,w*.431);
   c.strokeStyle='#b6b6a9';c.beginPath();c.moveTo(x+25,y+54);c.lineTo(x+w*.405,y+54);c.stroke();
   if(done){c.font='24px '+paperFont;c.fillStyle='#bd3336';c.fillText(a+'  ✓',x+48,y+49);}
  }
 }
 function cardMaterial(n){
  if(!cardPrint.has(n)){
   const tex=texture(256,336,(c,w,h)=>{c.fillStyle='#fffbef';c.fillRect(0,0,w,h);c.strokeStyle='#d44939';c.lineWidth=6;c.beginPath();c.ellipse(128,75,42,51,.06,0,Math.PI*2);c.stroke();c.fillStyle='#232c32';c.font='bold 71px '+paperFont;c.textAlign='center';c.fillText(String(n+1),128,99);c.font='bold 30px '+paperFont;c.fillText('答  案',128,180);c.font='bold 36px '+paperFont;c.fillText(EXAM_QUESTIONS[n][1],128,255,226);c.strokeStyle='#577c93';c.lineWidth=3;c.beginPath();c.moveTo(36,274);c.lineTo(214,269);c.stroke();});
   cardPrint.set(n,mat('#fff',{map:tex,side:T.DoubleSide}));
  }return cardPrint.get(n);
 }
 function deskPaper(){
  const group=wing('examination-room'),plane=own(new T.PlaneGeometry(paperWidth,paperDepth,12,6)),card=own(new T.PlaneGeometry(.203,.211)),clean=mat('#fff',{map:texture(1200,760,drawSheet)});
  const leaf=plane.attributes.position;
  for(let i=0;i<leaf.count;i++){
   const x=leaf.getX(i)/(paperWidth*.5),y=leaf.getY(i)/(paperDepth*.5);
   leaf.setZ(i,.001+.004*Math.abs(x)**6+.008*Math.max(0,x*y)**7);
  }
  plane.computeVertexNormals();
  const banner=texture(960,112,(c,w,h)=>{c.fillStyle='#9e191d';c.fillRect(0,0,w,h);c.fillStyle='#fff4dc';c.textAlign='center';c.font='bold 71px '+paperFont;c.fillText('诚 信 考 试　认 真 答 题',w/2,h*.75);});
  face(group,mat('#fff',{map:banner}),0,3.73,8.729,5.92,.57,Math.PI);
  const print=texture(1200,760,drawSheet);liveSheet=mat('#fff',{map:print});paperPrint.set('blank',clean);
  const cardBack=mat('#faf2da',{side:T.DoubleSide});
  for(let id=0;id<32;id++){
   const desk=new T.Group();group.add(desk);desk.name='exam-writing-place-'+id;
   const sheet=surface(desk,plane,clean,0,.887,-.035,true);sheet.name='exam-paper-'+id;
   const back=surface(desk,card,cardBack,.14,.977,-.52);back.rotation.set(-.41,Math.PI,0,'YXZ');back.visible=false;
   paperSeats.set(id,{desk,sheet,back});
  }
  for(const id of [0,1]){const cardMesh=surface(group,card,cardMaterial(id),0,0,0,true);cardMesh.name='drawer-answer-card-'+id;cards.push(cardMesh);}
  held=surface(group,own(new T.PlaneGeometry(.26,.35)),cardMaterial(0),0,0,0);held.name='answer-card-in-hand';
  return group;
 }
 function setSeats(next){
  seats=next;
  if(mode!=='exam')return;
  for(const {desk} of paperSeats.values())desk.visible=false;
  for(const s of seats){const place=paperSeats.get(s.id);if(!place)continue;place.desk.visible=true;place.desk.position.set(s.deskX,0,s.deskZ);place.desk.rotation.y=s.yaw||0;}
 }
 function setMap(map){
  mode=map==='cafeteria'||map==='exam'?map:null;root.visible=!!mode;
  if(mode&&!wings[mode])wings[mode]=mode==='exam'?deskPaper():cafeteria();
  for(const [key,wing]of Object.entries(wings))wing.visible=key===mode;
  if(mode==='exam')setSeats(seats);
 }
 function update(state,dt=0){
  if(!mode||!state)return;
  if(mode==='cafeteria'){
   for(const [id,r]of portions.entries()){
    const p=mealPortion(id,state.sceneElapsed??state.elapsed??0);r.carrier.visible=state.mealsTaken?.[id]!==p.lap;
    r.carrier.position.set(p.x,p.y,p.z);
    if(r.action!==p.dish){if(r.action)r.models.get(r.action).visible=false;r.models.get(p.dish).visible=true;r.action=p.dish;}
   }return;
  }
  const p=state.player,exam=state.exam,seat=p?.seated&&!p.officeChair?seats.find(s=>s.id===p.seatId):null;
  const place=seat&&paperSeats.get(seat.id);
  for(const spot of paperSeats.values())spot.back.visible=false;
  for(const actor of state.students||[]){
   const spot=paperSeats.get(actor.seatId);if(spot)spot.back.visible=!!(actor.readingAnswer&&!actor.isPlayer&&actor.seated&&!actor.caught&&!actor.officeChair);
  }
  if(lastPaper!==place){if(lastPaper)lastPaper.sheet.material=paperPrint.get('blank');lastPaper=place;activeCard=-1;}
  if(place&&exam){
   const key=exam.answered+'-'+exam.hint;
   if(liveSheet.userData.key!==key){const map=liveSheet.map,c=map.image?.getContext?.('2d');if(c){drawSheet(c,map.image.width,map.image.height,exam.answered,exam.hint);map.needsUpdate=true;}liveSheet.userData.key=key;}place.sheet.material=liveSheet;
  }
  const extension=place?(drawerRecords?.get(seat.id)?.open??1):0;
  for(const [id,c]of cards.entries()){
   c.visible=!!(place&&exam&&!exam.complete&&state.drawer?.open&&!exam.mode&&extension>.12);
   if(c.visible){if(c.parent!==place.desk)place.desk.add(c);c.position.set(id?.17:-.17,.668,-.169-.24*extension);c.material=cardMaterial(exam.cards[id]);}
  }
  held.visible=!!(place&&exam?.mode==='card');
  if(held.visible){if(held.parent!==place.desk)place.desk.add(held);held.position.set(.085,.952,-.52);held.rotation.set(-.41,Math.PI,0,'YXZ');if(activeCard!==exam.card){held.material=cardMaterial(exam.card);activeCard=exam.card;}}
 }
 function penContact(s){
  if(mode!=='exam'||s?.exam?.mode!=='paper'||!s.player?.seated)return null;
  const p=s.player,seat=seats.find(v=>v.id===p.seatId);if(!seat)return null;
  const q=s.exam.hint;
  const u=q==null?.80:columnLeft+Math.floor(q/6)*columnWidth+.18;
  const v=q==null?.20:1-(rowTop+(q%6+.53)*rowHeight);
  const x=-(u-.5)*paperWidth,z=(v-.5)*paperDepth-.035,a=seat.yaw||0;
  const dx=seat.deskX+Math.cos(a)*x+Math.sin(a)*z-p.x;
  const dz=seat.deskZ-Math.sin(a)*x+Math.cos(a)*z-p.z;
  return {x:-Math.cos(p.yaw)*dx+Math.sin(p.yaw)*dz,z:-Math.sin(p.yaw)*dx-Math.cos(p.yaw)*dz};
 }
 function targets(s){
  const p=s.player;if(!mode||!p||s.role==='teacher'||s.stage!=='class'||p.caught)return [];
  if(mode==='cafeteria')return s.drawer?.drawnSlot==null?portions.flatMap(({carrier},id)=>carrier.visible&&Math.hypot(carrier.position.x-p.x,carrier.position.z-p.z)<1.78?[{object:carrier,kind:'meal',id}]:[]):[];
  if(!p.seated||p.officeChair||!s.exam||s.exam.mode==='card')return [];
  const sheet=paperSeats.get(p.seatId)?.sheet;
  if(s.exam.mode==='paper')return sheet?[{kind:'exam-question',object:sheet,id:p.seatId}]:[];
  const answers=s.exam.complete?[]:cards.flatMap((object,id)=>object.visible?[{object,kind:'exam-card',id}]:[]);
  return sheet&&!s.drawer?.open?[{object:sheet,kind:'exam-paper',id:p.seatId},...answers]:answers;
 }
 function target(kind,id,s){
  if(kind==='meal')return portions[id]?.carrier;
  if(kind==='exam-card')return cards[id];
  if(kind==='exam-paper')return paperSeats.get(id)?.sheet;
  if(kind==='exam-question')return paperSeats.get(s?.player?.seatId)?.sheet;
  return null;
 }
 return {root,setMap,setSeats,update,targets,target,penContact,dispose(){for(const g of geometry)g.dispose();scene.remove(root);}};
}
