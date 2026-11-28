import {DESK_DRAWER_TRAVEL} from './drawer-hand-target58.js?v=campus-117&rev=157';
import * as T from './vendor/three.module.js';
import {createServingDish} from './game-actors.js?v=campus-117&rev=172';
import {PARTITIONS,CLASSROOM,CORRIDOR,ALCOVE_ENTRY} from './classroom-layout.js?v=campus-117&rev=157';
import {restDeskItem} from './prop-assets.js?v=campus-83';
import {SERVING_BELTS,MEAL_COUNT,mealPortion,EXAM_QUESTIONS} from './upper-floors85.js?v=campus-92&rev=128';

const paperWidth=.89,paperDepth=.60;
const paperFont='"PingFang SC","Microsoft YaHei",sans-serif';
const rowTop=.193,rowHeight=.120,columnLeft=.044,columnWidth=.465;
export function paperQuestion(u,v){
 const x=u-columnLeft,y=1-v-rowTop;
 if(x<0||x>=2*columnWidth||y<0||y>=6*rowHeight)return null;
 return Math.floor(x/columnWidth)*6+Math.floor(y/rowHeight);
}
export function createUpperFloorView({scene,box,mat,texture,bakeStatic,drawerRecords}){
 const root=new T.Group();root.name='upper-floor-furnishings';root.visible=false;scene.add(root);
 const wings={},portions=[],paperSeats=new Map(),cards=[],cardPrint=new Map(),paperPrint=new Map();
 const geometry=new Set(),own=g=>(geometry.add(g),g);
 const dishPool=new Map();
 let beltTexture=null;
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
  const orange=mat('#e4a137'),steel=mat('#a6aca8',{metalness:.48,roughness:.38}),cream=mat('#e6d7be',{roughness:.73}),lip=mat('#e69857',{roughness:.68});
  const runner=texture(256,512,(c,w,h)=>{
   c.fillStyle='#cfa483';c.fillRect(0,0,w,h);
   c.fillStyle='#fff2de';c.beginPath();c.moveTo(w*.5,h*.16);c.lineTo(w*.87,h*.76);c.quadraticCurveTo(w*.88,h*.79,w*.84,h*.79);c.lineTo(w*.16,h*.79);c.quadraticCurveTo(w*.12,h*.79,w*.13,h*.76);c.closePath();c.fill();
  });runner.wrapT=T.RepeatWrapping;runner.repeat.y=8;beltTexture=runner;
  const beltMat=mat('#ffffff',{map:runner,roughness:.88});
  for(const b of SERVING_BELTS){
   const center=(b.maxZ+b.minZ)/2,len=b.maxZ-b.minZ;
   box(cream,[b.x,b.top/2,center],[b.width-.08,b.top-.07,len-.03],null,fixed);
   box(steel,[b.x,.09,center],[b.width-.04,.10,len],null,fixed);
   box(lip,[b.x,b.top-.065,center],[b.width,.13,len],null,fixed);
   const top=surface(fixed,own(new T.PlaneGeometry(b.width-.12,len-.035)),beltMat,b.x,b.top+.001,center,true);
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
  for(const [a,b] of [[CORRIDOR.minZ,CLASSROOM.minZ-.20],[CLASSROOM.maxZ+.22,ALCOVE_ENTRY.minZ],[ALCOVE_ENTRY.maxZ,CORRIDOR.maxZ]])box(orange,[7.444,.56,(a+b)/2],[.018,1.07,b-a],null,fixed);
  box(orange,[CORRIDOR.maxX-.050,.56,(CORRIDOR.minZ+CORRIDOR.maxZ)/2],[.018,1.07,CORRIDOR.maxZ-CORRIDOR.minZ],null,fixed);
  const label=texture(960,448,(c,w,h)=>{
   c.fillStyle='#ccb186';c.fillRect(0,0,w,h);c.fillStyle='#fffdf1';c.fillRect(10,10,w-20,h-20);
   c.textAlign='center';c.fillStyle='#24211e';c.font='bold 109px '+paperFont;c.fillText('自 助',w*.72,h*.44);c.fillText('食 堂',w*.72,h*.77);
   for(const [x,y,v,color] of [[147,168,66,'#e78c37'],[290,246,62,'#cb723d'],[216,260,43,'#88a65a']]){
    c.fillStyle='#e6d6ba';c.beginPath();c.ellipse(x+4,y+22,v+17,v*.55,0,0,Math.PI*2);c.fill();
    c.fillStyle='#fff9e9';c.beginPath();c.ellipse(x,y+16,v+14,v*.54,0,0,Math.PI*2);c.fill();
    c.fillStyle=color;c.beginPath();c.ellipse(x,y,v,v*.55,-.16,0,Math.PI*2);c.fill();
    c.fillStyle='#fff1bc';for(let i=0;i<8;i++){c.beginPath();c.ellipse(x+Math.sin(i*7)*v*.63,y+Math.cos(i*4)*v*.27,4,2,-.3,0,Math.PI*2);c.fill();}
   }
  });
  face(fixed,mat('#fff',{map:label}),CORRIDOR.maxX-.075,2.12,CORRIDOR.minZ+7.8,4.98,2.34,-Math.PI/2);
  const cutlery=texture(640,240,(c,w,h)=>{
   c.fillStyle='#fff7de';c.strokeStyle=c.fillStyle;c.lineWidth=9;c.lineCap='round';
   c.beginPath();c.arc(w*.50,h*.51,h*.44,0,2*Math.PI);c.fill();
   c.strokeStyle='#efbc67';c.lineWidth=3;c.beginPath();c.arc(w*.50,h*.51,h*.35,0,2*Math.PI);c.stroke();
   c.strokeStyle=c.fillStyle;c.lineWidth=8;
   c.beginPath();for(const x of [148,160,172]){c.moveTo(x,23);c.lineTo(x,81);}
   c.moveTo(148,72);c.quadraticCurveTo(160,117,172,72);c.moveTo(160,94);c.lineTo(160,214);c.stroke();
   c.beginPath();c.moveTo(474,22);c.quadraticCurveTo(444,56,454,128);c.lineTo(466,128);c.lineTo(466,212);c.quadraticCurveTo(469,221,475,212);c.closePath();c.fill();
  });
  face(fixed,mat('#fff',{map:cutlery,transparent:true,alphaTest:.25}),CORRIDOR.maxX-.078,.56,CORRIDOR.minZ+7.8,2.64,1.00,-Math.PI/2);
  bakeStatic?.(fixed);
  for(let id=0;id<MEAL_COUNT;id++){
   const carrier=new T.Group();carrier.name='serving-portion-'+id;group.add(carrier);
   portions.push({carrier,dish:null,model:null});
  }
  return group;
 }
 function drawSheet(c,w,h,answered=0,hint=null){
  c.fillStyle='#faf9f4';c.fillRect(0,0,w,h);
  const printFont='"Songti SC","SimSun",serif';
  c.fillStyle='#252421';c.textAlign='center';c.font='bold 29px '+printFont;c.fillText('期末考试',w/2,h*.10);
  c.strokeStyle='#d4d1c9';c.lineWidth=1;c.setLineDash([3,5]);c.beginPath();c.moveTo(w*.5,h*.15);c.lineTo(w*.5,h*.92);c.stroke();c.setLineDash([]);
  c.textAlign='left';
  for(const [i,[question,answer]]of EXAM_QUESTIONS.entries()){
   const x=(columnLeft+Math.floor(i/6)*columnWidth)*w,y=(rowTop+i%6*rowHeight)*h;
   if(i===hint){c.fillStyle='#d6ebbd';c.fillRect(x-7,y,w*.439,h*rowHeight-3);}
   c.fillStyle='#312f2b';c.font='20px '+printFont;c.fillText((i+1)+'．'+question,x,y+24,w*.43);
   c.fillText('答：',x+12,y+52);
   if(answered&(1<<i)){c.font='24px '+paperFont;c.fillStyle='#b92d31';c.fillText(answer,x+58,y+53);}
  }
 }
 function cardMaterial(n){
  if(!cardPrint.has(n)){
   const tex=texture(320,512,(c,w,h)=>{
    const brush='"Kaiti SC","STKaiti","KaiTi",serif';
    c.fillStyle='#fffdf5';c.fillRect(0,0,w,h);
    c.strokeStyle='#d91e27';c.lineWidth=11;c.beginPath();c.ellipse(w*.50,h*.24,65,94,.10,0,2*Math.PI);c.stroke();
    c.textAlign='center';c.fillStyle='#1d1b18';c.font='bold 144px '+brush;c.fillText(String(n+1),w*.50,h*.34,115);
    c.save();c.translate(w*.49,h*.62);c.rotate(-.044);c.font='bold 47px '+brush;c.fillText('答：',0,0);
    c.font='bold 58px '+brush;c.fillText(EXAM_QUESTIONS[n][1]+'。',0,79,w*.86);
    c.strokeStyle='#2582b4';c.lineWidth=8;c.lineCap='round';c.beginPath();c.moveTo(-57,98);c.quadraticCurveTo(4,86,60,93);c.stroke();c.restore();
   });
   cardPrint.set(n,mat('#fff',{map:tex,side:T.DoubleSide}));
  }return cardPrint.get(n);
 }
 function deskPaper(){
  const group=wing('examination-room'),plane=own(new T.PlaneGeometry(paperWidth,paperDepth,12,6)),card=own(new T.PlaneGeometry(.20,.32)),clean=mat('#fff',{map:texture(1200,760,drawSheet)});
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
  held=surface(group,own(new T.PlaneGeometry(.25,.40)),cardMaterial(0),0,0,0);held.name='answer-card-in-hand';
  return group;
 }
 function setSeats(next){
  seats=next;
  if(mode!=='exam')return;
  for(const {desk} of paperSeats.values())desk.visible=false;
  for(const s of seats){const place=paperSeats.get(s.id);if(!place)continue;place.desk.visible=true;place.desk.position.set(s.deskX,0,s.deskZ);place.desk.rotation.y=s.yaw||0;}
 }
 function setMap(map){
  if(held)held.visible=false;
  for(const {back} of paperSeats.values())back.visible=false;
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
    if(id===0){
     const belt=SERVING_BELTS[0],length=belt.maxZ-belt.minZ;
     const travel=p.lap*(length-.42)+p.z-belt.minZ-.21;
     beltTexture.offset.y=-(travel*beltTexture.repeat.y/(length-.035))%1;
    }
    if(r.dish!==p.dish){
     if(r.model){r.carrier.remove(r.model);dishPool.get(r.dish).push(r.model);}
     if(!dishPool.has(p.dish))dishPool.set(p.dish,[]);
     let model=dishPool.get(p.dish).pop();
     if(!model){
      model=createServingDish(p.dish);
      if(p.dish==='drink')model.rotation.x=-Math.PI/2;
      if(p.dish==='snack')model.rotation.x=-Math.PI*.45;
      restDeskItem(model,-.012);
     }
     r.carrier.add(model);r.dish=p.dish;r.model=model;
    }
   }return;
  }
  const p=state.player,exam=state.exam,seat=p?.seated&&!p.officeChair?seats.find(s=>s.id===p.seatId):null;
  const place=seat&&paperSeats.get(seat.id);
  for(const spot of paperSeats.values())spot.back.visible=false;
  for(const actor of state.students||[]){
   const spot=paperSeats.get(actor.seatId);
   if(spot?.readerHand&&actor.readingAnswer&&!actor.isPlayer&&actor.seated&&!actor.caught&&!actor.officeChair){
    const hand=spot.readerHand;
    if(spot.back.parent!==hand)hand.add(spot.back);
    spot.back.position.set(.066,.125,-.03);spot.back.rotation.set(-.50,Math.PI,.08,'YXZ');spot.back.visible=true;
   }
  }
  for(const spot of paperSeats.values())spot.readerHand=null;
  if(lastPaper!==place){if(lastPaper)lastPaper.sheet.material=paperPrint.get('blank');lastPaper=place;activeCard=-1;for(const card of cards)delete card.userData.question;}
  if(place&&exam){
   const key=exam.answered+'-'+exam.hint;
   if(liveSheet.userData.key!==key){const map=liveSheet.map,c=map.image?.getContext?.('2d');if(c){drawSheet(c,map.image.width,map.image.height,exam.answered,exam.hint);map.needsUpdate=true;}liveSheet.userData.key=key;}place.sheet.material=liveSheet;
  }
  // Keep the second slip on the tray while the first is in the student's hand.
  const extension=place?(drawerRecords?.get(seat.id)?.open??1):0;
  for(const [id,c]of cards.entries()){
   if(!place||!exam||exam.complete||!state.drawer?.open||extension<=.12){c.visible=false;continue;}
   if(!exam.mode||c.userData.question==null)c.userData.question=exam.cards[id];
   c.visible=!exam.mode||(exam.mode==='card'&&c.userData.question!==exam.card);
   if(!c.visible)continue;
   if(c.parent!==place.desk)place.desk.add(c);
   c.position.set(id?.17:-.17,.668,-.169-DESK_DRAWER_TRAVEL*extension);
   c.material=cardMaterial(c.userData.question);
  }
  held.visible=!!(place&&exam?.mode==='card');
  if(held.visible&&activeCard!==exam.card){held.material=cardMaterial(exam.card);activeCard=exam.card;}
 }
 function setReaderHand(id,hand){const place=paperSeats.get(id);if(place)place.readerHand=hand;}
 // Pose the wrist relative to its desk. Mount the printed slip in the hand's
 // render pass so the thumb can cover the front and the index sit behind it.
 const slipPose=new T.Object3D(),slipIndex=new T.Vector3(),slipThumb=new T.Vector3();
 slipPose.position.set(-.072,.932,-.625);slipPose.rotation.set(-1.10,Math.PI,.035,'YXZ');slipPose.updateMatrix();
 function gripAnswerSlip(hand){
  if(mode!=='exam'||!held?.visible||!hand||!lastPaper)return;
  hand.setCurl(.52);
  const palm=hand.group;
  lastPaper.desk.updateWorldMatrix(true,false);
  slipPose.matrixWorld.multiplyMatrices(lastPaper.desk.matrixWorld,slipPose.matrix);
  slipIndex.set(-.113,-.103,-.005).applyMatrix4(slipPose.matrixWorld);
  palm.parent.worldToLocal(slipIndex);
  palm.position.copy(slipIndex).sub(hand.indexTip().multiply(palm.scale).applyQuaternion(palm.quaternion));
  palm.updateWorldMatrix(true,false);
  if(held.parent!==palm)palm.add(held);
  held.matrix.multiplyMatrices(held.matrix.copy(palm.matrixWorld).invert(),slipPose.matrixWorld);
  held.matrix.decompose(held.position,held.quaternion,held.scale);
  slipThumb.set(-.096,-.098,.005).applyMatrix4(slipPose.matrixWorld);
  hand.aimThumb(palm.worldToLocal(slipThumb));
  return held;
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
  return {x:-Math.cos(a)*dx+Math.sin(a)*dz,z:-Math.sin(a)*dx-Math.cos(a)*dz};
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
 return {root,setMap,setSeats,update,targets,target,setReaderHand,gripAnswerSlip,penContact,dispose(){held?.removeFromParent();for(const {back} of paperSeats.values())back.removeFromParent();for(const g of geometry)g.dispose();scene.remove(root);}};
}
