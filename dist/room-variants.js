import * as T from './vendor/three.module.js';
import {SEATS,TEACHER_EYE_HEIGHT,BOARD,mapKind,floorHeight} from './classroom-layout.js?v=campus-52';

export function createRoomVariants({scene,box,rounded,mat,texture,bakeStatic}){
 const group=new T.Group(),screens=new Map(),stations=new Map();group.name='computer-lab-workstations';scene.add(group);group.visible=false;
 const shell=mat('#424b59',{roughness:.48}),keys=mat('#d5d9df',{roughness:.72}),base=mat('#909ba9',{metalness:.35,roughness:.48}),top=mat('#d1d5cb',{roughness:.68}),trim=mat('#607d7b',{roughness:.62}),shadow=mat('#27353d',{roughness:.85});
 const desktop=texture(512,288,(c,w,h)=>{
  const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#5e98b7');sky.addColorStop(1,'#c1e0e3');c.fillStyle=sky;c.fillRect(0,0,w,h);c.fillStyle='#6d9f83';c.beginPath();c.moveTo(0,230);c.bezierCurveTo(170,120,300,250,512,162);c.lineTo(512,288);c.lineTo(0,288);c.fill();
  c.fillStyle='#e7eee9';c.fillRect(0,267,w,21);c.fillStyle='#3e6768';c.font='13px sans-serif';c.fillText('开始',13,282);c.fillText('14:30',464,282);
  for(const [x,label,color]of[[38,'学习','#fff0b6'],[132,'贪吃蛇','#82d38f']]){c.fillStyle='#f7f8eb';c.fillRect(x,29,46,46);c.fillStyle=color;c.fillRect(x+4,33,38,38);c.strokeStyle='#45675f';c.lineWidth=3;if(label==='学习'){c.strokeRect(x+11,39,23,25);c.beginPath();c.moveTo(x+17,45);c.lineTo(x+29,45);c.moveTo(x+17,52);c.lineTo(x+29,52);c.stroke();}else{c.beginPath();c.moveTo(x+12,61);c.lineTo(x+12,45);c.lineTo(x+30,45);c.lineTo(x+30,57);c.stroke();c.fillStyle='#26463e';c.fillRect(x+28,42,4,4);}c.fillStyle='#fff';c.textAlign='center';c.font='bold 17px sans-serif';c.fillText(label,x+23,97);c.textAlign='left';}
 });
 const study=texture(512,288,(c,w,h)=>{c.fillStyle='#e8eee6';c.fillRect(0,0,w,h);c.fillStyle='#497d83';c.fillRect(0,0,w,28);c.fillStyle='#fff';c.font='bold 16px sans-serif';c.fillText('学习',14,20);c.fillStyle='#fffef2';c.fillRect(35,43,442,221);c.fillStyle='#3c5554';c.font='bold 21px serif';c.fillText('课堂练习',58,76);c.font='18px serif';c.fillText('1.  36 ÷ 4 =',60,117);c.fillText('2.  7 × 8 =',60,157);c.fillText('3.  12 + 29 =',60,197);c.fillStyle='#c3d9cf';for(const y of[101,141,181])c.fillRect(232,y,144,26);c.fillStyle='#57968b';c.fillRect(359,226,95,25);c.fillStyle='#fff';c.font='16px sans-serif';c.fillText('提交',389,244);});
 const screenMaterial=t=>mat('#ffffff',{map:t,emissive:'#ffffff',emissiveMap:t,emissiveIntensity:.30,roughness:.65});
 const desktopMat=screenMaterial(desktop),studyMat=screenMaterial(study),screenGeo=new T.PlaneGeometry(.586,.326),snakeSurfaces=new Map();
 function snakeSurface(id){let entry=snakeSurfaces.get(id);if(entry)return entry;const image=texture(512,288,()=>{}),material=screenMaterial(image);entry={image,material,key:''};snakeSurfaces.set(id,entry);return entry;}
 function drawSnake(canvas,snake,score,id,elapsed){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.fillStyle='#c9dbb9';c.fillRect(0,0,w,h);c.fillStyle='#526c4b';c.fillRect(0,0,w,28);c.fillStyle='#f2f2d8';c.font='bold 16px sans-serif';c.fillText('贪吃蛇',12,20);c.textAlign='right';c.fillText(String(score??0),w-14,20);c.textAlign='left';
  const cols=snake?.width||snake?.cols||18,rows=snake?.height||snake?.rows||10,cell=Math.min(22,Math.floor(244/rows)),ox=(w-cols*cell)/2,oy=35;
  c.fillStyle='#dfe9cc';c.fillRect(ox,oy,cols*cell,rows*cell);c.strokeStyle='rgba(81,112,68,.12)';c.lineWidth=1;
  for(let x=0;x<=cols;x++){c.beginPath();c.moveTo(ox+x*cell,oy);c.lineTo(ox+x*cell,oy+rows*cell);c.stroke();}for(let y=0;y<=rows;y++){c.beginPath();c.moveTo(ox,oy+y*cell);c.lineTo(ox+cols*cell,oy+y*cell);c.stroke();}
  // Authoritative snake state is displayed when available. The initial board
  // stays still until the player opens the app; no fake score advancement.
  const body=snake?.body||snake?.segments||[{x:7,y:5},{x:6,y:5},{x:5,y:5}],food=snake?.food||{x:12,y:5};
  body.forEach((p,n)=>{const x=p.x??p[0],y=p.y??p.z??p[1];c.fillStyle=n?'#5c914a':'#2f6b40';c.fillRect(ox+x*cell+1,oy+y*cell+1,cell-2,cell-2);});
  c.fillStyle='#c46345';c.fillRect(ox+(food.x??food[0])*cell+3,oy+(food.y??food.z??food[1])*cell+3,cell-6,cell-6);
 }
 for(const s of SEATS){
  const station=new T.Group();station.name=`computer-station-${s.id}`;group.add(station);stations.set(s.id,station);const hardware=new T.Group();station.add(hardware);
  // Lab furniture replaces the ordinary yellow desktop, not a monitor pasted
  // over books. School desks keep their designed physical dimensions.
  rounded(top,[0,.83,0],[1.22,.065,.80],.018,null,hardware);box(trim,[0,.789,0],[1.18,.025,.77],null,hardware);
  for(const x of[-.53,.53]){rounded(base,[x,.41,.15],[.045,.78,.46],.008,null,hardware);rounded(shadow,[x,.024,.15],[.08,.045,.47],.008,null,hardware);}box(base,[0,.22,.33],[1.05,.04,.045],null,hardware);
  rounded(shell,[.40,.43,.15],[.22,.50,.43],.013,null,hardware);box(shadow,[.40,.43,-.071],[.17,.43,.009],null,hardware);for(let k=0;k<5;k++)box(base,[.40,.32+k*.035,-.077],[.13,.009,.006],null,hardware);box(keys,[.40,.59,-.078],[.025,.025,.008],null,hardware);
  rounded(shell,[0,1.22,.17],[.66,.40,.092],.018,null,hardware);box(base,[0,.966,.17],[.075,.19,.075],null,hardware);rounded(base,[0,.873,.17],[.32,.022,.20],.008,null,hardware);
  rounded(shell,[-.08,.88,-.19],[.58,.028,.16],.008,null,hardware);for(let r=0;r<3;r++)for(let k=0;k<11;k++)box(keys,[-.32+k*.046,.897,-.245+r*.045],[.035,.008,.029],null,hardware);rounded(shell,[.39,.886,-.18],[.08,.035,.12],.016,null,hardware);
  // The screen sits in front of the bezel; it remains individually raycastable.
  const screen=new T.Mesh(screenGeo,desktopMat);screen.position.set(0,1.22,.122);screen.rotation.y=Math.PI;screen.userData.seatId=s.id;screen.userData.animated=true;station.add(screen);screens.set(s.id,screen);
  bakeStatic(hardware);
 }
 let currentMap='classroom',seats=SEATS;
 function setSeats(next){if(!Array.isArray(next)||next.length!==30)return;seats=next;for(const s of seats){const station=stations.get(s.id);if(!station)continue;station.position.set(s.deskX,floorHeight(s.deskX,s.deskZ,currentMap),s.deskZ);station.rotation.y=s.yaw||0;}}
 setSeats(seats);
 const light=new T.SpotLight('#fff4d5',75,17,.43,.65,1.4);light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.bias=-.001;scene.add(light,light.target);light.visible=false;
 return{group,screens,stations,light,setSeats,
  setMap(map){currentMap=map;group.visible=mapKind(map)==='computer';light.visible=mapKind(map)==='night';setSeats(seats);},
  update(state){
   if(group.visible){const bySeat=new Map((state?.students||[]).filter(s=>s.seated).map(s=>[s.seatId,s]));for(const [id,screen]of screens){const student=bySeat.get(id),app=student?.computer?.app||student?.computerApp||(student?.computerActive?'snake':'desktop');if(app==='snake'){const surface=snakeSurface(id),snake=student?.computer?.snake||student?.snake||student?.computerSnake,key=JSON.stringify([snake,snake?.score??student?.snakeScore,Math.floor((state?.elapsed||0)*4)]);if(key!==surface.key){drawSnake(surface.image.image,snake,snake?.score??student?.snakeScore,id,state?.elapsed||0);surface.image.needsUpdate=true;surface.key=key;}screen.material=surface.material;}else screen.material=app==='learning'||app==='study'?studyMat:desktopMat;}}
   if(light.visible){const t=state?.teacher||{x:BOARD.x,z:BOARD.z,yaw:Math.PI},pitch=state?.role==='teacher'?state.player.pitch:.08,height=TEACHER_EYE_HEIGHT+floorHeight(t.x,t.z,state?.map);light.position.set(t.x,height,t.z);light.target.position.set(t.x+Math.sin(t.yaw)*6,height-Math.tan(pitch)*6,t.z+Math.cos(t.yaw)*6);}
  },dispose(){screenGeo.dispose();light.shadow.map?.dispose();}
 };
}
