import * as T from './vendor/three.module.js';
import {PARTITIONS,DOORS,LECTERN,OFFICE,LIFT,CAMPUS_MAPS,floorTiles,floorHeight} from './classroom-layout.js?v=map-30c';
// Editable architecture based on the observed classroom/corridor, not a flat photo.
export function buildReferenceCampus({room,scene,M,mat,box,rounded,cylinder,mesh,texture,assets,materials,floorMat}){
 const enclosure=new T.Group();enclosure.name='classroom-cutaway-walls';scene.add(enclosure);
 const plaster=texture(512,512,(c,w,h)=>{c.fillStyle='#e9e7dc';c.fillRect(0,0,w,h);let seed=71;for(let i=0;i<9000;i++){seed=(seed*16807)%2147483647;const x=seed%w;seed=(seed*16807)%2147483647;const y=seed%h;c.fillStyle=i%3?'rgba(119,119,100,.025)':'rgba(255,255,245,.13)';c.fillRect(x,y,1+i%2,1);}});
 const blue=mat('#2e687c',{metalness:.18,roughness:.48}),edge=mat('#a7bbc0',{metalness:.3,roughness:.43}),cream=mat('#f4f0e1',{map:plaster,roughness:.94}),glass=mat('#a4d2d5',{transparent:true,opacity:.075,depthWrite:false,roughness:.17});
 const seal=mat('#455c5a',{roughness:.8}),recess=mat('#879b95',{roughness:.82}),doorPaint=mat('#d8e1d9',{roughness:.62}),skirting=mat('#3c7382',{roughness:.72});
 const ceilingMaterial=new T.MeshStandardMaterial({color:'#deded5',roughness:.93});materials.add(ceilingMaterial);
 const curtains=[],sky=new T.MeshBasicMaterial({color:'#c9e8f5'});materials.add(sky);
 const facades=[new T.Group(),new T.Group()];facades[0].name='high-classroom-windows';facades[1].name='tiered-low-classroom-windows';scene.add(...facades);facades[1].visible=false;
 const B=(m,p,s,parent=room)=>box(m,p,s,null,parent);
 function strip(x,z,w,d,parent,base=true){B(skirting,[x,4.35,z],[w,.20,d],parent);B(edge,[x,4.47,z],[w,.035,d+.012],parent);B(blue,[x,4.235,z],[w,.035,d+.015],parent);if(base){B(skirting,[x,.065,z],[w,.13,d],parent);B(edge,[x,.137,z],[w,.012,d+.006],parent);}}
 // Frames, recessed lower panels and a real upper aperture share the open leaf volume.
 function doorLeaf(parent,width,height,side=1){
  const center=width/2,low=1.38,top=height-.12;
  B(doorPaint,[0,low/2,center],[.060,low,width],parent);
  for(const z of [.055,width-.055])B(doorPaint,[0,(low+top)/2,z],[.060,top-low,.11],parent);
  B(doorPaint,[0,height-.06,center],[.060,.12,width],parent);
  for(const x of [-.034,.034]){
   for(const z of [.018,width-.018])B(edge,[x,height/2,z],[.012,height,.036],parent);
   B(edge,[x,height-.02,center],[.012,.04,width],parent);B(edge,[x,.025,center],[.012,.05,width],parent);
   B(recess,[x,.55,center],[.014,.78,width-.22],parent);
   B(blue,[x+Math.sign(x)*.006,.55,center],[.008,.69,width-.31],parent);
   for(const z of [.112,width-.112])B(seal,[x,(low+top)/2,z],[.009,top-low,.016],parent);
   for(const y of [low,top])B(seal,[x,y,center],[.009,.018,width-.21],parent);
  }
  B(glass,[0,(low+top)/2,center],[.010,top-low-.022,width-.24],parent);
  for(const y of [.40,1.46,2.49])B(edge,[0,y,.025],[.085,.095,.045],parent);
  for(const x of [-.058,.058]){rounded(seal,[x,1.08,width-.13],[.027,.20,.052],.007,null,parent);rounded(edge,[x+Math.sign(x)*.016,1.08,width-.13],[.035,.12,.027],.009,null,parent);}
 }
 function buildWindow(side,z,width,parent,top=3.83){
  const x=side===-1?-5.90:side===1?5.90:8.42;
  const bottom=1.10,height=top-bottom,mid=(bottom+top)/2;
  B(cream,[x,.54,z],[.16,1.08,width],parent);B(cream,[x,(top+4.46)/2,z],[.16,4.46-top,width],parent);
  B(glass,[x,mid,z],[.018,height-.04,width-.12],parent);
  for(const zz of [z-width/2,z,z+width/2]){B(blue,[x,mid,zz],[.075,height+.045,.046],parent);B(edge,[x+(side===-1?.044:-.044),mid,zz],[.014,height-.04,.012],parent);}
  for(const y of [bottom,top-.50,top]){B(blue,[x,y,z],[.075,.047,width],parent);B(seal,[x, y+.029,z],[.028,.010,width-.05],parent);}
  B(edge,[x-(side===-1?-.085:.085),1.065,z],[.27,.065,width+.07],parent);
  for(const zz of [z-width*.25,z+width*.25])B(seal,[x-(side===-1?-.055:.055),mid-.16,zz],[.028,.11,.018],parent);
  if(side===-1)for(const s of [-1,1]){
   const g=new T.PlaneGeometry(.37,height-.04,10,10);assets.add(g);const a=g.attributes.position;
   for(let i=0;i<a.count;i++)a.setZ(i,Math.cos(a.getX(i)*55)*.045);g.computeVertexNormals();
   const cloth=new T.Mesh(g,mat('#83a59a',{side:T.DoubleSide,roughness:.96}));cloth.rotation.y=Math.PI/2;cloth.position.set(x+.19,mid,z+s*(width/2-.21));cloth.userData.animated=true;parent.add(cloth);curtains.push(cloth);
  }
 }
 function window(side,z,width=2.72,parent=room){if(side===2){buildWindow(side,z,width,parent);return;}buildWindow(side,z,width,facades[0]);buildWindow(side,z,width,facades[1],2.95);}
 // Courtyard windows on the left; glazed partition plus two open doors to the right.
 for(const z of [-4.88,-1.57,1.74,4.95])window(-1,z,z>4?2.86:2.93);
 for(const z of [-6.52,-3.22,.10,3.39,6.46]){B(cream,[-5.90,2.23,z],[.20,4.46,.37]);strip(-5.79,z,.10,.37,room);}
 strip(-5.90,-.02,.20,13.24,room);
 for(const p of PARTITIONS){
  const center=(p.minZ+p.maxZ)/2,length=p.maxZ-p.minZ;
  if(length>2.6){const n=Math.ceil(length/3.4),span=length/n;for(let i=0;i<n;i++){window(1,p.minZ+(i+.5)*span,span-.26,enclosure);B(cream,[5.9,2.23,p.minZ+i*span+.065],[.20,4.46,.13],enclosure);}B(cream,[5.9,2.23,p.maxZ-.065],[.20,4.46,.13],enclosure);}
  else B(cream,[5.9,2.23,center],[.20,4.46,length],enclosure);
 }
 strip(5.90,-.02,.20,13.24,enclosure,false);
 for(const p of PARTITIONS)B(skirting,[5.90,.065,(p.minZ+p.maxZ)/2],[.20,.13,p.maxZ-p.minZ],enclosure);
 for(const d of DOORS){
  // Visible jambs, transom and an open leaf; the aperture shares collision coordinates.
  for(const z of [d.minZ,d.maxZ]){B(blue,[5.9,1.48,z],[.23,2.96,.047],enclosure);B(edge,[6.022,1.48,z],[.015,2.94,.012],enclosure);}
  B(blue,[5.9,2.93,d.center],[.23,.047,d.maxZ-d.minZ],enclosure);
  B(glass,[5.9,3.40,d.center],[.03,.79,d.maxZ-d.minZ],enclosure);
  B(blue,[5.9,3.83,d.center],[.10,.045,d.maxZ-d.minZ],enclosure);
  B(cream,[5.9,4.05,d.center],[.20,.44,d.maxZ-d.minZ],enclosure);
  const leaf=new T.Group();leaf.name='open-classroom-door';leaf.position.set(5.91,0,d.maxZ);leaf.rotation.y=-Math.PI/2;enclosure.add(leaf);
  const panel=new T.Group();panel.position.set(-.048,0,-1.12);leaf.add(panel);doorLeaf(panel,1.10,2.88);
  B(edge,[5.9,.012,d.center],[.25,.024,d.maxZ-d.minZ-.04],enclosure);
 }
 // End walls with the original visual hierarchy: bulletin, blackboard, awards.
 B(cream,[0,2.23,-6.72],[11.82,4.46,.18]);strip(0,-6.60,11.80,.12,room);
 B(cream,[0,2.23,6.62],[11.82,4.46,.18],enclosure);strip(0,6.50,11.80,.12,enclosure);
 const chalk=texture(1536,768,(c,w,h)=>{
  c.fillStyle='#293c38';c.fillRect(0,0,w,h);c.fillStyle='#f0e9c6';c.textAlign='center';c.font='bold 90px "Kaiti SC","STKaiti",serif';c.fillText('迎接新世纪',w/2,125);
  c.strokeStyle='#d8dfbb';c.lineWidth=5;c.strokeRect(46,184,645,170);c.strokeRect(46,389,428,302);c.strokeRect(515,389,445,302);c.strokeRect(1002,184,481,507);
  c.font='39px "Kaiti SC","STKaiti",serif';c.fillStyle='#cbdcd1';c.fillText('素质文化',370,256);c.fillText('努力学习  团结友爱',259,468);c.fillText('文明礼貌',735,468);c.fillText('从我做起',735,544);c.fillStyle='#a9c9df';c.fillText('成长足迹',1240,262);c.fillStyle='#e6caa0';c.fillText('认真学习',1240,347);c.fillText('快乐成长',1240,423);
  c.strokeStyle='#c8dcd8';c.lineWidth=3;for(let i=0;i<9;i++){c.beginPath();c.arc(90+i*65,307,9,0,Math.PI*2);c.stroke();}c.fillStyle='#d9bfa8';c.font='100px serif';c.fillText('☆',1240,610);c.fillText('☆',142,626);c.fillText('☆',376,626);
 });
 const board=mat('#ffffff',{map:chalk,roughness:.94});
 function endBoards(z,front,parent){
  const facing=front?-1:1,depth=z+facing*.14;
  B(edge,[0,2.57,z],[5.08,2.22,.09],parent);B(board,[0,2.57,depth],[4.98,2.12,.025],parent);
  B(edge,[0,1.43,z+facing*.18],[5.16,.045,.18],parent);
  const notice=texture(768,640,(c,w,h)=>{c.fillStyle='#138875';c.fillRect(0,0,w,h);let n=0;for(const [x,y,ww,hh,col]of [[26,30,184,220,'#ef9b94'],[238,38,210,170,'#f3dc83'],[475,75,180,245,'#e7e5d5'],[33,281,180,250,'#e9eadf'],[245,260,186,143,'#b3d996'],[465,365,230,198,'#e1eee1'],[245,438,180,140,'#eabf80']]){c.fillStyle=col;c.fillRect(x,y,ww,hh);c.fillStyle='#556966';c.font='bold 19px sans-serif';c.fillText(['值日安排','班级公约','课程表','安全须知'][n++%4],x+10,y+28);for(let i=0;i<8;i++){c.fillStyle='#71817a';c.fillRect(x+12,y+49+i*16,ww-24,3);}}});
  B(edge,[-4.02,2.57,z],[2.47,1.95,.09],parent);B(mat('#ffffff',{map:notice}),[-4.02,2.57,depth],[2.36,1.84,.025],parent);
  const awards=texture(512,640,(c,w,h)=>{const g=c.createRadialGradient(256,335,45,256,335,340);g.addColorStop(0,'#ffe9a8');g.addColorStop(.7,'#f6b63e');g.addColorStop(1,'#cd4930');c.fillStyle=g;c.fillRect(0,0,w,h);c.strokeStyle='#e9bc57';c.lineWidth=12;c.strokeRect(14,14,w-28,h-28);c.textAlign='center';c.fillStyle='#b93224';c.font='bold 82px "Kaiti SC",serif';c.fillText('奖 状',256,131);c.font='bold 36px serif';c.fillText('文明班集体',256,280);for(let i=0;i<4;i++)c.fillRect(110,340+i*35,292,3);c.beginPath();c.arc(386,548,40,0,Math.PI*2);c.lineWidth=4;c.strokeStyle='#c64d37';c.stroke();});
  const awardMat=mat('#ffffff',{map:awards,roughness:.85});
  for(let row=0;row<3;row++)for(let col=0;col<3;col++)B(awardMat,[3.25+col*.66,3.22-row*.69,depth],[.62,.65,.02],parent);
 }
 // The tiered reference has a blank rear wall; displays belong to the ordinary room only.
 endBoards(-6.54,false,facades[0]);
 const lesson=texture(1400,680,(c,w,h)=>{c.fillStyle='#274338';c.fillRect(0,0,w,h);c.fillStyle='#e4ead8';c.font='42px "Kaiti SC",serif';c.fillText('数学',75,80);c.font='italic 62px Georgia';c.fillText('y = ax² + bx + c',85,230);c.fillText('a² + b² = c²',85,372);c.font='38px serif';c.fillText('练习 3    P.48',85,550);c.strokeStyle='#e4ead8';c.lineWidth=5;c.beginPath();c.moveTo(900,480);c.lineTo(1220,480);c.lineTo(1220,180);c.closePath();c.stroke();});
 B(edge,[0,2.65,6.40],[7.5,2.55,.11],enclosure);B(mat('#ffffff',{map:lesson}),[0,2.65,6.32],[7.36,2.40,.025],enclosure);
 B(edge,[0,1.34,6.24],[7.55,.05,.20],enclosure);
 // Low wooden teaching platform; continuous height is shared with navigation/cameras.
 const woodFloor=texture(768,256,(c,w,h)=>{c.fillStyle='#d39a50';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=64){c.fillStyle='#bc7f38';c.fillRect(0,y,w,2);for(let x=(y/64%2)*130;x<w;x+=256)c.fillRect(x,y,2,64);for(let i=0;i<35;i++){c.fillStyle=i%2?'#dca656':'#cf9247';c.fillRect((i*117+y*9)%w,y+4+i%52,60,1);}}});
 const platform=mat('#ffffff',{map:woodFloor,roughness:.65});B(platform,[0,.08,5.55],[6.30,.16,2.05],enclosure);
 const lx=(LECTERN.minX+LECTERN.maxX)/2,lz=(LECTERN.minZ+LECTERN.maxZ)/2;
 rounded(M.wood,[lx,1.11,lz],[1.35,.075,.78],.022,null,enclosure);rounded(cream,[lx,.65,lz+.07],[1.22,.87,.60],.016,null,enclosure);
 B(edge,[lx,.23,lz+.05],[1.24,.055,.63],enclosure);B(M.red,[lx-.22,1.16,lz],[.34,.025,.26],enclosure);
 // Walkable bright corridor, with end doors and repeated courtyard windows.
 for(const z of [-4.65,-1.32,2.01,5.0])window(2,z,z>4?2.75:3.05,enclosure);
 for(const z of [-6.38,-2.98,.35,3.68,6.45])B(cream,[8.42,2.23,z],[.18,4.46,.26],enclosure);
 strip(8.34,-.03,.08,13.3,enclosure);
 // The office is a room beyond the corridor end, not a painted closed door.
 const office=new T.Group();office.name='walkable-teacher-office';enclosure.add(office);
 const woodGrain=texture(1024,256,(c,w,h)=>{c.fillStyle='#ddd5c6';c.fillRect(0,0,w,h);for(let i=0;i<160;i++){const y=(i*59)%h;c.strokeStyle=i%3?'rgba(64,33,18,.055)':'rgba(255,245,218,.12)';c.lineWidth=.5+i%3*.3;c.beginPath();for(let x=0;x<=w;x+=16){const yy=y+Math.sin(x*.009+i*.5)*(1+i%6)+Math.sin(x*.022+i)*1.5;if(x===0)c.moveTo(x,yy);else c.lineTo(x,yy);}c.stroke();}});
 const doorMetal=mat('#b9c8c2',{metalness:.15,roughness:.5}),officeWood=mat('#a2533e',{map:woodGrain,roughness:.57}),darkWood=mat('#803d31',{map:woodGrain,roughness:.61}),cabinetTop=mat('#bb8550',{map:woodGrain,roughness:.62}),cabinetPaint=mat('#b9d0ca',{roughness:.57}),cabinetBack=mat('#667f76',{roughness:.8}),books=['#8e4242','#344f67','#d4af46','#527950','#c5c7b2','#6e5480'].map(c=>mat(c,{roughness:.82}));
 const boards=['#e4bd73','#e8c57d','#dfb56a','#e5c07e'].map(c=>mat(c,{map:woodGrain,roughness:.61}));
 B(darkWood,[4.825,-.05,9.635],[6.85,.08,6.23],office);
 for(let row=0;row<24;row++){const za=6.52+row*6.23/24,zb=6.52+(row+1)*6.23/24,breaks=[1.4,...Array.from({length:4},(_,i)=>1.4+(i+.55+(row%3)*.33)*1.7).filter(x=>x<8.25),8.25];for(let col=0;col<breaks.length-1;col++)B(boards[(row+col*3)%4],[(breaks[col]+breaks[col+1])/2,-.005,(za+zb)/2],[breaks[col+1]-breaks[col]-.006,.010,zb-za-.004],office).castShadow=false;}
 B(cream,[1.30,2.23,9.69],[.20,4.46,6.32],office);B(cream,[8.35,2.23,9.69],[.20,4.46,6.32],office);B(cream,[4.83,.63,12.85],[7.05,1.26,.20],office);B(cream,[4.83,4.10,12.85],[7.05,.72,.20],office);for(const x of [1.60,8.05])B(cream,[x,2.50,12.85],[.40,2.50,.20],office);
 // The classroom's teaching wall is also the office wall; do not overlap its face.
 B(cream,[6.075,2.23,6.62],[.35,4.46,.20],office);B(cream,[8.25,2.23,6.52],[.40,4.46,.20],office);
 B(cream,[7.15,3.77,6.52],[1.8,1.50,.20],office);
 // Both open leaves sit along the jambs; the whole 1.8m opening stays clear.
 for(const x of [6.25,8.05]){B(blue,[x,1.51,6.55],[.048,3.02,.24],office);B(edge,[x,1.51,6.68],[.014,3.02,.017],office);const leaf=new T.Group();leaf.name='office-open-door';leaf.position.set(x,.01,6.66);office.add(leaf);doorLeaf(leaf,.84,2.94);}
 B(blue,[7.15,3.01,6.55],[1.85,.045,.24],office);B(edge,[7.15,.010,6.54],[1.75,.020,.27],office);
 // Thin skirting follows corners and stops at the opening, rather than crossing it.
 for(const [x,z,w,d]of [[1.425,9.70,.04,6.10],[8.225,9.70,.04,6.10],[4.825,12.72,6.85,.04],[3.825,6.75,4.8,.03],[8.15,6.75,.15,.03]]){B(skirting,[x,.065,z],[w,.13,d],office);B(edge,[x,.136,z],[w,.012,d+.006],office);}
 for(const [x,z,w,d]of [[1.44,9.70,.07,6.10],[8.21,9.70,.07,6.10],[4.825,12.69,6.78,.07],[4.825,6.75,6.78,.07]]){B(skirting,[x,4.35,z],[w,.20,d],office);B(edge,[x,4.47,z],[w,.025,d+.01],office);}
 // Rear daylight window and low cabinet, distinct warm boards and school furniture.
 for(const y of [1.39,3.71])B(blue,[4.83,y,12.72],[5.95,.047,.08],office);for(const x of [1.86,7.80])B(blue,[x,2.55,12.72],[.047,2.32,.08],office);B(glass,[4.83,2.55,12.70],[5.8,2.16,.018],office);
 for(const x of [2.02,3.42,4.82,6.22,7.62]){B(blue,[x,2.55,12.68],[.04,2.25,.05],office);B(edge,[x+.025,2.55,12.65],[.012,2.20,.016],office);}
 B(blue,[4.83,2.91,12.67],[5.85,.047,.05],office);B(edge,[4.83,1.35,12.60],[6.05,.065,.24],office);
 cylinder(edge,[4.83,3.77,12.53],[.014,6.15,.014],[0,0,Math.PI/2],office);
 const greenCloth=mat('#79a14e',{side:T.DoubleSide,roughness:.96});
 for(const [x,sign]of [[1.98,-1],[7.68,1]]){
  const g=new T.PlaneGeometry(.44,2.35,16,20),p=g.attributes.position;assets.add(g);
  for(let i=0;i<p.count;i++){const u=p.getX(i),v=p.getY(i);p.setZ(i,Math.cos((u+.22)*Math.PI*24)*.026+Math.sin(v*1.3+sign)*.014);p.setX(i,u+sign*.027*(1-(v+1.175)/2.35));}g.computeVertexNormals();
  const cloth=new T.Mesh(g,greenCloth);cloth.name='office-green-curtain';cloth.position.set(x,2.55,12.53);cloth.userData.animated=true;cloth.castShadow=true;cloth.receiveShadow=true;office.add(cloth);curtains.push(cloth);
  for(let n=0;n<5;n++){const ring=new T.TorusGeometry(.020,.004,5,12);assets.add(ring);mesh(ring,edge,[x-.18+n*.09,3.755,12.53],[1,1,1],[0,Math.PI/2,0],office);}
 }
 // Open shelf volumes, book spines and cupboard frames replace painted solid blocks.
 for(const [i,z]of [8.08,9.68].entries()){
  const paint=i===0?officeWood:cabinetPaint,back=i===0?darkWood:cabinetBack;
  B(back,[1.48,1.40,z],[.045,2.72,1.50],office);for(const zz of [z-.745,z+.745])B(paint,[1.735,1.40,zz],[.55,2.72,.045],office);
  for(const y of [.06,.77,2.755])B(paint,[1.735,y,z],[.55,.055,1.53],office);
  B(seal,[1.73,.035,z],[.49,.07,1.40],office);
  for(let row=0;row<4;row++){const y=.80+row*.47;B(paint,[1.735,y,z],[.53,.038,1.45],office);for(let n=0;n<13;n++){const h=.27+((n*7+row)%5)*.025,zz=z-.65+n*.106;B(books[(n+row*2)%books.length],[1.855,y+h/2+.025,zz],[.25,h,.065+(n%3)*.008],office);B(M.paper,[1.985,y+h*.70,zz],[.008,.012,.048],office);if(n%3===0)B(edge,[1.989,y+.07,zz],[.006,.009,.05],office);}}
  for(const zz of [z-.37,z+.37]){B(recess,[2.005,.405,zz],[.025,.69,.70],office);B(paint,[2.028,.405,zz],[.03,.635,.65],office);rounded(edge,[2.051,.425,zz+(zz<z?.23:-.23)],[.022,.11,.023],.007,null,office);}
  if(i===1){for(const zz of [z-.70,z,z+.70])B(cabinetPaint,[2.048,1.77,zz],[.033,1.91,.036],office);for(const y of [.83,2.72])B(cabinetPaint,[2.048,y,z],[.033,.044,1.42],office);B(glass,[2.055,1.77,z],[.012,1.85,1.36],office);}
 }
 rounded(darkWood,[3.33,.895,11.65],[2.25,.09,.90],.012,null,office);for(const x of [2.43,4.20]){B(officeWood,[x,.45,11.68],[.40,.81,.77],office);B(seal,[x,.045,11.68],[.36,.09,.71],office);}
 B(darkWood,[3.33,.58,12.045],[1.45,.52,.045],office);
 for(const x of [2.43,4.20])for(const y of [.23,.49,.75]){B(recess,[x,y,11.283],[.35,.23,.015],office);B(officeWood,[x,y,11.265],[.32,.20,.025],office);rounded(edge,[x,y+.005,11.245],[.105,.018,.022],.005,null,office);}
 rounded(M.dark,[3.3,1.25,11.86],[.73,.48,.055],.008,null,office);B(edge,[3.3,1.015,11.86],[.065,.20,.065],office);rounded(M.dark,[3.3,.956,11.83],[.34,.018,.21],.006,null,office);rounded(recess,[3.3,.956,11.43],[.63,.024,.20],.006,null,office);
 for(let row=0;row<4;row++)for(let k=0;k<13;k++)B(cabinetPaint,[3.015+k*.046,.973,11.36+row*.044],[.036,.008,.031],office);
 rounded(M.dark,[3.82,.972,11.42],[.067,.035,.108],.016,null,office);
 const cable=new T.CatmullRomCurve3([new T.Vector3(3.82,.955,11.47),new T.Vector3(3.88,.955,11.68),new T.Vector3(3.55,.955,11.72)]),cableGeo=new T.TubeGeometry(cable,14,.003,5,false);assets.add(cableGeo);mesh(cableGeo,seal,[0,0,0],[1,1,1],null,office);
 const screen=texture(512,288,(c,w,h)=>{const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#5da4d0');sky.addColorStop(.7,'#b9d9df');c.fillStyle=sky;c.fillRect(0,0,w,h);c.fillStyle='#edf0e0';for(const [x,y]of [[92,42],[355,67],[430,39]]){c.beginPath();c.ellipse(x,y,40,12,0,0,Math.PI*2);c.ellipse(x+24,y-7,26,15,0,0,Math.PI*2);c.fill();}c.fillStyle='#82a34e';c.beginPath();c.moveTo(0,211);c.bezierCurveTo(150,110,310,195,512,155);c.lineTo(512,288);c.lineTo(0,288);c.fill();c.fillStyle='#689646';c.beginPath();c.moveTo(0,235);c.bezierCurveTo(180,152,310,244,512,199);c.lineTo(512,288);c.lineTo(0,288);c.fill();c.fillStyle='#bb3d35';c.font='126px sans-serif';c.textAlign='center';c.fillText('0',w/2,190);});
 B(mat('#ffffff',{map:screen,emissive:'#ffffff',emissiveMap:screen,emissiveIntensity:.14}),[3.3,1.25,11.830],[.675,.413,.006],office);
 // Padded steel visitor chair: real bent frames and feet contact the floor.
 const chair=new T.Group();chair.name='office-padded-chair';chair.position.set(3.30,0,10.75);office.add(chair);
 const upholstery=mat('#333b3c',{roughness:.87}),chairMetal=mat('#8d9898',{metalness:.65,roughness:.34});
 rounded(upholstery,[0,.485,0],[.70,.075,.55],.025,null,chair);rounded(upholstery,[0,.89,-.29],[.65,.45,.08],.022,[-.08,0,0],chair);
 function tube(points,radius,material,parent){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'centripetal'),g=new T.TubeGeometry(curve,points.length*5,radius,8,false);assets.add(g);return mesh(g,material,[0,0,0],[1,1,1],null,parent);}
 for(const x of [-.29,.29]){
  tube([[x,.04,.34],[x,.04,-.30],[x,.10,-.34],[x,.48,-.28],[x,1.08,-.32]],.018,chairMetal,chair);
  tube([[x,.46,-.25],[x,.46,.24],[x,.39,.27],[x,.04,.34]],.018,chairMetal,chair);
  for(const z of [-.30,.34])rounded(seal,[x,.02,z],[.065,.04,.066],.010,null,chair);
 }
 for(const z of [-.22,.22])cylinder(chairMetal,[0,.438,z],[.014,.58,.014],[0,0,Math.PI/2],chair);
 // Mobile whiteboard beside the rear window, with casters, uprights and a tray.
 const mobileBoard=new T.Group();mobileBoard.name='office-mobile-whiteboard';mobileBoard.position.set(6.10,0,12.00);office.add(mobileBoard);
 const whiteboardFace=mat('#e5e9df',{roughness:.34}),boardFrame=mat('#a5b7b7',{metalness:.48,roughness:.37});
 rounded(boardFrame,[0,1.70,0],[1.86,1.10,.06],.008,null,mobileBoard);B(whiteboardFace,[0,1.70,-.034],[1.79,1.03,.012],mobileBoard);B(whiteboardFace,[0,1.70,.034],[1.79,1.03,.012],mobileBoard);
 const diagram=texture(768,448,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='rgba(84,117,126,.16)';c.lineWidth=3;c.beginPath();c.moveTo(85,355);c.lineTo(650,355);c.moveTo(136,385);c.lineTo(136,65);c.stroke();c.strokeStyle='rgba(76,116,135,.68)';c.lineWidth=4;c.beginPath();c.moveTo(165,318);c.bezierCurveTo(256,305,273,169,324,149);c.bezierCurveTo(375,129,418,266,566,96);c.stroke();c.font='35px serif';c.fillStyle='rgba(69,103,123,.72)';c.fillText('y = ax² + bx + c',242,73);c.strokeStyle='rgba(142,76,65,.55)';c.lineWidth=3;c.beginPath();c.ellipse(329,157,54,39,-.2,0,Math.PI*2);c.stroke();});
 const diagramGeo=new T.PlaneGeometry(1.72,.96);assets.add(diagramGeo);mesh(diagramGeo,mat('#ffffff',{map:diagram,transparent:true,depthWrite:false,roughness:.8}),[0,1.70,-.042],[1,1,1],[0,Math.PI,0],mobileBoard).castShadow=false;
 for(const x of [-.87,.87]){B(boardFrame,[x,1.145,.025],[.035,2.11,.035],mobileBoard);cylinder(edge,[x,1.70,0],[.035,.065,.035],[0,0,Math.PI/2],mobileBoard);rounded(boardFrame,[x,.105,0],[.055,.045,.67],.006,null,mobileBoard);for(const z of [-.28,.28]){cylinder(seal,[x,.045,z],[.045,.027,.045],[0,0,Math.PI/2],mobileBoard);B(boardFrame,[x,.082,z],[.035,.055,.027],mobileBoard);}}
 B(boardFrame,[0,.39,.025],[1.74,.03,.03],mobileBoard);rounded(edge,[0,1.137,-.09],[1.68,.025,.14],.006,null,mobileBoard);
 for(const [x,m]of [[.35,blue],[.52,M.red]])cylinder(m,[x,1.160,-.09],[.008,.10,.008],[0,0,Math.PI/2],mobileBoard);rounded(seal,[-.50,1.166,-.09],[.12,.035,.06],.007,null,mobileBoard);
 // Continuous toe-kick and top tie the small lockers to the wall and floor.
 B(seal,[7.95,.045,9.95],[.54,.09,3.20],office);B(cabinetPaint,[7.96,.54,9.95],[.56,.91,3.22],office);B(cabinetTop,[7.93,1.012,9.95],[.62,.036,3.24],office);
 for(const z of [8.75,9.55,10.35,11.15])for(const y of [.24,.55,.86]){B(cabinetBack,[7.665,y,z],[.020,.285,.765],office);rounded(cabinetPaint,[7.645,y,z],[.026,.263,.737],.004,null,office);for(const yy of [y-.095,y+.095])B(edge,[7.627,yy,z-.31],[.012,.035,.027],office);rounded(edge,[7.625,y+.018,z+.22],[.012,.022,.075],.003,null,office);}
 const boardDust=texture(1024,512,(c,w,h)=>{c.fillStyle='#23483d';c.fillRect(0,0,w,h);for(let i=0;i<100;i++){c.fillStyle='rgba(200,212,183,.012)';c.fillRect((i*113)%w,(i*43)%h,80+i%90,9);}c.fillStyle='rgba(215,219,197,.07)';c.fillRect(24,h-35,w-48,3);});
 B(darkWood,[8.23,2.28,9.98],[.045,1.68,3.68],office);B(mat('#ffffff',{map:boardDust,roughness:.96}),[8.200,2.28,9.98],[.012,1.60,3.60],office);B(edge,[8.15,1.43,9.98],[.15,.035,3.68],office);
 const clock=texture(256,256,(c,w,h)=>{c.fillStyle='#f8f7e9';c.beginPath();c.arc(128,128,121,0,Math.PI*2);c.fill();c.strokeStyle='#3f4643';c.lineWidth=10;c.stroke();for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(128+Math.sin(a)*99,128-Math.cos(a)*99);c.lineTo(128+Math.sin(a)*113,128-Math.cos(a)*113);c.stroke();}c.lineWidth=9;c.beginPath();c.moveTo(128,128);c.lineTo(128,54);c.moveTo(128,128);c.lineTo(179,151);c.stroke();});
 const clockPlane=new T.Mesh(new T.PlaneGeometry(.48,.48),mat('#ffffff',{map:clock,transparent:true}));assets.add(clockPlane.geometry);clockPlane.position.set(1.435,3.54,11.55);clockPlane.rotation.y=Math.PI/2;office.add(clockPlane);
 const schedule=texture(768,640,(c,w,h)=>{c.fillStyle='#e6e6d5';c.fillRect(0,0,w,h);c.strokeStyle='#84928e';c.lineWidth=2;for(let row=0;row<12;row++){const y=67+row*46;c.beginPath();c.moveTo(20,y);c.lineTo(w-20,y);c.stroke();}for(let col=0;col<6;col++){const x=20+col*(w-40)/5;c.beginPath();c.moveTo(x,67);c.lineTo(x,573);c.stroke();}c.fillStyle='#53655f';c.textAlign='center';c.font='30px serif';c.fillText('课程表',w/2,45);c.font='19px serif';for(let col=0;col<5;col++)c.fillText(['星期一','星期二','星期三','星期四','星期五'][col],93+col*145.6,98);for(let row=1;row<11;row++)for(let col=0;col<5;col++)c.fillText(['语文','数学','英语','体育','自习'][(row+col*2)%5],93+col*145.6,98+row*46);});
 B(blue,[1.425,2.51,11.55],[.035,1.48,1.70],office);B(mat('#ffffff',{map:schedule,roughness:.88}),[1.45,2.51,11.55],[.012,1.39,1.61],office);
 for(const x of [6.03,6.12])B(doorPaint,[x,1.32,6.738],[.075,.105,.018],office);
 B(ceilingMaterial,[4.83,4.59,9.69],[7.05,.16,6.32],office);
 const officeLamp=mat('#f3f1db',{emissive:'#fff6d6',emissiveIntensity:.55,roughness:.28}),ceilingJoint=mat('#b4beb5',{roughness:.9});
 function ceilingGrid(x0,x1,z0,z1,parent){for(let x=x0+.6;x<x1;x+=.60)B(ceilingJoint,[x,4.504,(z0+z1)/2],[.009,.012,z1-z0],parent).castShadow=false;for(let z=z0+1.2;z<z1;z+=1.20)B(ceilingJoint,[(x0+x1)/2,4.503,z],[x1-x0,.012,.009],parent).castShadow=false;}
 function fluorescent(x,z,parent){for(const xx of [x-.45,x+.45])B(edge,[xx,4.35,z],[.012,.30,.012],parent);rounded(edge,[x,4.19,z],[1.36,.055,.27],.008,null,parent);B(seal,[x,4.158,z],[1.22,.012,.20],parent);for(const zz of [z-.065,z+.065])cylinder(officeLamp,[x,4.142,zz],[.018,1.17,.018],[0,0,Math.PI/2],parent);for(const xx of [x-.61,x+.61])B(doorPaint,[xx,4.15,z],[.046,.075,.24],parent);}
 ceilingGrid(1.4,8.25,6.62,12.75,office);for(const z of [8.2,11.2])fluorescent(4.8,z,office);
 const officeLight=new T.PointLight('#fff5dc',4.2,9,1.6);officeLight.position.set(4.8,3.7,9.7);office.add(officeLight);
 // Two narrow ventilated cubicles are observed beside the office end, not invented rooms.
 for(const [z,label]of [[2.5,'男'],[3.32,'女']]){
  B(seal,[7.94,.035,z],[.55,.07,.69],enclosure);rounded(doorMetal,[7.94,1.165,z],[.60,2.23,.75],.009,null,enclosure);B(cabinetBack,[7.631,1.16,z],[.018,2.16,.70],enclosure);rounded(doorPaint,[7.613,1.16,z],[.022,2.105,.654],.006,null,enclosure);
  for(const y of [.30,1.94])for(let n=0;n<5;n++){B(seal,[7.599,y+n*.035,z],[.009,.012,.37],enclosure);B(edge,[7.596,y+n*.035+.009,z],[.008,.006,.37],enclosure);}
  for(const y of [.30,1.12,1.99])B(edge,[7.597,y,z-.30],[.013,.062,.022],enclosure);
  rounded(seal,[7.591,1.02,z+.24],[.016,.15,.025],.006,null,enclosure);
  const sign=texture(96,96,(c,w,h)=>{c.fillStyle='#51696b';c.beginPath();c.arc(48,48,43,0,Math.PI*2);c.fill();c.fillStyle='#e4e5d4';c.font='48px sans-serif';c.textAlign='center';c.fillText(label,48,65);});B(mat('#ffffff',{map:sign}),[7.597,1.44,z],[.008,.17,.17],enclosure);
 }
 const phonePaint=mat('#92a34d',{roughness:.57});rounded(phonePaint,[8.22,1.80,3.68],[.15,.58,.35],.015,null,enclosure);B(seal,[8.137,1.88,3.68],[.012,.13,.18],enclosure);for(let row=0;row<4;row++)for(let col=0;col<3;col++)B(edge,[8.134,1.74-row*.038,3.63+col*.045],[.012,.025,.027],enclosure);rounded(seal,[8.113,1.82,3.80],[.055,.39,.055],.018,null,enclosure);
 // The opposite end is a blue lift cabin with real depth and a floor selector.
 const lift=new T.Group();lift.name='walkable-blue-lift';enclosure.add(lift);const liftBlue=mat('#657e93',{metalness:.16,roughness:.63}),liftInset=mat('#597285',{metalness:.1,roughness:.67});
 B(liftBlue,[7.18,-.045,-7.98],[2.13,.09,2.73],lift);B(liftBlue,[6.06,1.56,-7.98],[.12,3.12,2.73],lift);B(liftBlue,[8.35,1.56,-7.98],[.20,3.12,2.73],lift);B(liftBlue,[7.18,1.56,-9.45],[2.45,3.12,.20],lift);B(liftBlue,[7.18,3.17,-7.98],[2.45,.10,2.95],lift);
 for(const x of [6.10,8.28]){B(seal,[x,1.56,-6.60],[.08,3.12,.20],lift);B(edge,[x+(x<7?.035:-.035),1.56,-6.475],[.025,3.12,.035],lift);}B(seal,[7.18,3.20,-6.60],[2.25,.18,.20],lift);
 for(const x of [6.67,7.68]){B(liftInset,[x,1.60,-9.338],[.965,2.94,.018],lift);B(edge,[x-.474,1.60,-9.322],[.015,2.93,.014],lift);B(edge,[x+.474,1.60,-9.322],[.015,2.93,.014],lift);}
 for(const z of [-9.30,-8.53,-7.71,-6.79])for(const x of [6.129,8.236])B(seal,[x,1.58,z],[.012,2.96,.009],lift);
 for(const x of [6.145,8.223])B(edge,[x,1.02,-8.10],[.035,.037,1.74],lift);
 for(const z of [-6.60,-6.67])B(edge,[7.18,.010,z],[2.08,.020,.035],lift);
 for(const x of [6.65,7.65])for(const z of [-7.25,-8.40]){B(seal,[x,3.115,z],[.71,.025,.73],lift);B(officeLamp,[x,3.095,z],[.65,.016,.67],lift);}
 const liftNotice=texture(256,320,(c,w,h)=>{c.fillStyle='#dde0d7';c.fillRect(0,0,w,h);c.fillStyle='#53636a';c.font='24px sans-serif';c.textAlign='center';c.fillText('文明乘梯',128,42);for(let n=0;n<9;n++){c.fillStyle=n%3?'#8a9695':'#687c7e';c.fillRect(29,76+n*23,198-(n%3)*28,3);}});B(edge,[7.18,1.92,-9.302],[.39,.50,.013],lift);B(mat('#ffffff',{map:liftNotice}),[7.18,1.92,-9.291],[.36,.47,.006],lift);
 const liftPanel=new T.Group();liftPanel.position.set(6.14,1.35,-7.22);liftPanel.name='lift-floor-panel';lift.add(liftPanel);
 B(edge,[0,0,0],[.055,.68,.35],liftPanel);for(let row=0;row<2;row++)for(let col=0;col<2;col++){const n=row*2+col+1,t=texture(96,96,(c,w,h)=>{c.fillStyle=n===3?'#dfb64b':'#526b7c';c.fillRect(0,0,w,h);c.fillStyle='#f5f6ed';c.textAlign='center';c.font='bold 64px sans-serif';c.fillText(String(n),48,72);});const button=B(mat('#ffffff',{map:t}),[.031,.17-row*.27,.09-col*.18],[.012,.23,.14],liftPanel);button.userData.floorMap=CAMPUS_MAPS[n-1];}
 // Raised platforms are actual meshes using the same height function as collision/cameras.
 const tiered=new T.Group();tiered.name='tiered-classroom-floor';scene.add(tiered);tiered.visible=false;
 const riser=mat('#c9cfc1',{roughness:.86}),nosing=mat('#adb7a9',{roughness:.68});
 for(const t of floorTiles()){
  const x=(t.minX+t.maxX)/2,z=(t.minZ+t.maxZ)/2,g=new T.BoxGeometry(t.maxX-t.minX,t.height+.012,t.maxZ-t.minZ),pos=g.attributes.position,normal=g.attributes.normal,uv=g.attributes.uv;
  for(let i=0;i<pos.count;i++){const wx=pos.getX(i)+x,wz=pos.getZ(i)+z,wy=pos.getY(i)+t.height/2-.006;if(Math.abs(normal.getY(i))>.5)uv.setXY(i,wx/1.6,wz/1.6);else uv.setXY(i,(Math.abs(normal.getX(i))>.5?wz+7.5:wx+6)/14.5,wy/14);}
  assets.add(g);mesh(g,[riser,riser,floorMat,riser,riser,riser],[x,t.height/2-.006,z],[1,1,1],null,tiered);
  for(const [zz,sign]of [[t.minZ,-1],[t.maxZ,1]])if(floorHeight(x,zz+sign*.002,'tiered')<t.height-.01&&zz>-6.49)B(nosing,[x,t.height+.002,zz-sign*.014],[t.maxX-t.minX,.004,.028],tiered);
  for(const [xx,sign]of [[t.minX,-1],[t.maxX,1]])if(floorHeight(xx+sign*.002,z,'tiered')<t.height-.01&&xx>-5.79)B(nosing,[xx-sign*.014,t.height+.002,z],[.028,.004,t.maxZ-t.minZ],tiered);
 }
 const ceil=B(ceilingMaterial,[1.24,4.59,-.05],[14.35,.16,13.6],enclosure);ceil.castShadow=true;
 ceilingGrid(6.12,8.25,-6.5,6.4,enclosure);
 for(const z of [-4.6,-.2,4.2])fluorescent(7.15,z,enclosure);
 // School block beyond both sides, with sky and planted courtyard between.
 const block=mat('#e6e6d9'),pane=mat('#83bccb',{roughness:.38});
 for(const side of [-1,1]){
  const x=side<0?-12.8:14.8;B(sky,[x+side*.8,4,-.2],[.05,10,20]);B(block,[x,2.6,-.2],[.40,5.9,19]);
  for(let row=0;row<3;row++)for(let col=0;col<10;col++){const zz=-8.6+col*1.85,yy=.65+row*1.8;B(edge,[x-side*.24,yy,zz],[.035,1.4,1.25]);B(pane,[x-side*.27,yy,zz],[.025,1.26,1.10]);B(cream,[x-side*.30,yy,zz],[.02,1.26,.045]);}
  // Irregular branches and leaf silhouettes replace identical faceted balls in a row.
  const leafImage=texture(256,256,(c,w,h)=>{c.clearRect(0,0,w,h);for(let n=0;n<92;n++){const a=n*2.39996,r=Math.sqrt(n/92)*105,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r*.78;c.fillStyle=['#69874b','#82a356','#9bb763','#748f50'][n%4];c.beginPath();c.ellipse(x,y,6+n%5,3+n%3,a,0,Math.PI*2);c.fill();}}),leafMat=mat('#ffffff',{map:leafImage,transparent:true,alphaTest:.45,depthWrite:true,side:T.DoubleSide,roughness:1}),branchMat=mat('#80765b',{roughness:.96}),leafGeo=new T.PlaneGeometry(1.28,1.10);assets.add(leafGeo);
  for(const [n,z]of [-4.8,.7,5.5].entries()){
   const tx=side<0?-9.2+(n%2)*.6:11.75-(n%2)*.5,top=2.1+(n%2)*.6;
   cylinder(branchMat,[tx,top*.42,z],[.055,top*.84,.075],null,room);
   for(let b=0;b<4;b++){const angle=b*1.78+n,ex=tx+Math.sin(angle)*.67,ez=z+Math.cos(angle)*.78,ey=top-.1+(b%2)*.35,curve=new T.CatmullRomCurve3([new T.Vector3(tx,top*.55,z),new T.Vector3((tx+ex)/2,top*.85,(z+ez)/2),new T.Vector3(ex,ey,ez)]),geo=new T.TubeGeometry(curve,5,.018,5,false);assets.add(geo);mesh(geo,branchMat,[0,0,0],[1,1,1],null,room);for(let leaf=0;leaf<3;leaf++)mesh(leafGeo,leafMat,[ex+Math.sin(leaf*2.1+b)*.22,ey+(leaf-1)*.22,ez+Math.cos(leaf*2.1+b)*.2],[1,1,1],[0,leaf*Math.PI/3+angle,Math.sin(b)*.2],room);}
  }
 }
 enclosure.visible=false;return{enclosure,ceilingMaterial,curtains,tiered,liftPanel,facades,setMap(map){tiered.visible=map==='tiered';facades[0].visible=map!=='tiered';facades[1].visible=map==='tiered';},setNight(night){sky.color.set(night?'#182944':'#c9e8f5');}};
}
