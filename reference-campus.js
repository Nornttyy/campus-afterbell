import * as T from './vendor/three.module.js';
import {createCampusWallProps} from './campus-wall-props54.js?v=campus-61';
import {buildDesktop55} from './computer-hardware55.js?v=campus-61';
import {surfaceHeight,drawBoardSurface,setWallSurfaceUV} from './surface-materials.js?v=campus-61';
import {PARTITIONS,DOORS,LECTERN,OFFICE,LIFT,CORRIDOR,CAMPUS_MAPS,CLASSROOM,CEILING_HEIGHT,TIERED_CEILING_HEIGHT,OFFICE_DESK,OFFICE_CHAIR,OFFICE_DESKS,OFFICE_CHAIRS,OFFICE_BOARD,ROLE_LOCKER,mapKind,floorTiles,floorHeight} from './classroom-layout.js?v=campus-61';
// Editable architecture based on the observed classroom/corridor, not a flat photo.
export function buildReferenceCampus({room,scene,M,mat,box,rounded,cylinder,mesh,texture,assets,materials,floorMat,surfaces=null,artwork={},bakeStatic=()=>{}}){
 const enclosure=new T.Group();enclosure.name='classroom-cutaway-walls';scene.add(enclosure);
 const plaster=surfaces?.wall||texture(512,512,(c,w,h)=>{c.fillStyle='#e9e7dc';c.fillRect(0,0,w,h);let seed=71;for(let i=0;i<9000;i++){seed=(seed*16807)%2147483647;const x=seed%w;seed=(seed*16807)%2147483647;const y=seed%h;c.fillStyle=i%3?'rgba(119,119,100,.025)':'rgba(255,255,245,.13)';c.fillRect(x,y,1+i%2,1);}});
 const blue=mat('#91b0b8',{metalness:.12,roughness:.48}),edge=mat('#bdcdd0',{metalness:.18,roughness:.49}),cream=mat(surfaces?'#f6e8cd':'#f6eddb',{map:plaster,bumpMap:surfaces?surfaceHeight(plaster,assets):null,bumpScale:.0014,roughness:.9}),glass=mat('#a9d9ea',{transparent:true,opacity:.065,depthWrite:false,roughness:.10});
 const frostedGlass=mat('#a4d9eb',{transparent:true,opacity:.68,depthWrite:false,roughness:.94,metalness:0}),upperGlass=mat('#b2dce6',{transparent:true,opacity:.58,depthWrite:false,roughness:.38});
 const frameGroove=mat('#4b6971',{metalness:.10,roughness:.55}),frameLip=mat('#a6bfc4',{metalness:.18,roughness:.43}),windowCloth=mat('#3f706d',{side:T.DoubleSide,roughness:.95});
 const seal=mat('#455c5a',{roughness:.8}),recess=mat('#879b95',{roughness:.82}),doorPaint=mat('#c6d3d1',{roughness:.62}),skirting=mat('#547b70',{roughness:.72});
 const wallGreen=mat('#8aa993',{roughness:.88});
 const ceilingMaterial=new T.MeshStandardMaterial({color:'#deded5',roughness:.93});materials.add(ceilingMaterial);
 const curtains=[],sky=new T.MeshBasicMaterial({color:'#c9e8f5'});materials.add(sky);
 const facades=[new T.Group(),new T.Group()];facades[0].name='high-classroom-windows';facades[1].name='tiered-low-classroom-windows';scene.add(...facades);facades[1].visible=false;
 // Kept detached until the caller has baked the common enclosure. They are
 // baked separately, then attached back to it so its menu cutaway still works.
 const ceilingRig=new T.Group(),upperWalls=new T.Group();ceilingRig.name='classroom-ceiling-rig';upperWalls.name='tiered-upper-walls';upperWalls.visible=false;
 const B=(m,p,s,parent=room)=>{const object=box(m,p,s,null,parent);return surfaces&&m===cream?setWallSurfaceUV(object,assets):object;};
 // Only continuous upper walls: overlapping pier infills made coplanar flicker.
 const upperColumn=(x,z,w,d)=>{return B(cream,[x,(CEILING_HEIGHT+TIERED_CEILING_HEIGHT)/2,z],[w,TIERED_CEILING_HEIGHT-CEILING_HEIGHT,d],upperWalls);};
 // A recessed aluminium section, not a line painted on the glass. One shared
 // extrusion serves mullions and rails, with a real channel between the lips.
 const section=new T.Shape();for(const [i,p]of [[-.075,-.055],[.072,-.055],[.100,-.045],[.100,-.029],[.080,-.021],[.080,.021],[.100,.029],[.100,.045],[.072,.055],[-.075,.055]].entries()){if(i===0)section.moveTo(...p);else section.lineTo(...p);}section.closePath();
 const frameSection=new T.ExtrudeGeometry(section,{depth:1,steps:1,bevelEnabled:false});frameSection.translate(0,0,-.5);assets.add(frameSection);
 function profile(x,y,z,length,vertical,inward,parent){
  // Rotate the same section on the opposite wall; a negative scale would
  // invert its triangle winding when the scene is baked into static geometry.
  const frame=mesh(frameSection,blue,[x,y,z],[.75,.70,length],null,parent);frame.rotation.y=inward<0?Math.PI:0;if(vertical)frame.rotateX(Math.PI/2);
  const dims=vertical?[.005,length,.020]:[.005,.020,length];B(frameGroove,[x+inward*.061,y,z],dims,parent);
  const lip=vertical?[.006,length,.007]:[.006,.007,length],p=vertical?[x+inward*.076,y,z-.028]:[x+inward*.076,y-.028,z];B(frameLip,p,lip,parent);
 }
 function strip(x,z,w,d,parent,base=true,topParent=parent){
  // Reveal the inner trim face in front of the wall instead of coplanar with it.
  const tx=Math.abs(Math.abs(x)-7.30)<.001?x-Math.sign(x)*.028:x;
  B(skirting,[tx,4.35,z],[w,.20,d],topParent);B(edge,[tx,4.47,z],[w,.035,d+.012],topParent);B(blue,[tx,4.235,z],[w,.035,d+.015],topParent);
  if(base){B(skirting,[tx,.065,z],[w,.13,d],parent);B(edge,[tx,.137,z],[w,.012,d+.006],parent);}
 }
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
  B(frostedGlass,[0,(low+top)/2,center],[.010,top-low-.022,width-.24],parent);
  for(const y of [.40,1.46,2.49])B(edge,[0,y,.025],[.085,.095,.045],parent);
  for(const x of [-.058,.058]){rounded(seal,[x,1.08,width-.13],[.027,.20,.052],.007,null,parent);rounded(edge,[x+Math.sign(x)*.016,1.08,width-.13],[.035,.12,.027],.009,null,parent);}
 }
 function buildWindow(side,z,width,parent,top=3.83){
  const x=side===-1?-7.30:side===1?7.30:CORRIDOR.maxX+.10;
  const bottom=1.10,height=top-bottom,mid=(bottom+top)/2,inward=side===-1?1:-1,transom=top-.50;
  B(wallGreen,[x,.54,z],[.16,1.08,width],parent);B(cream,[x,(top+CEILING_HEIGHT)/2,z],[.16,CEILING_HEIGHT-top,width],parent);
  for(const zz of [z-width/2,z,z+width/2])profile(x,mid,zz,height+.08,true,inward,parent);
  for(const y of [bottom,transom,top])profile(x,y,z,width+.11,false,inward,parent);
  // Two independently recessed lower sashes and two upper lights. Offset the
  // sliding tracks in depth so their overlap and seals are readable obliquely.
  for(const [bay,zz]of [z-width*.25,z+width*.25].entries())for(const [low,high,isTop]of [[bottom+.085,transom-.080,false],[transom+.085,top-.080,true]]){
   const paneWidth=width*.5-.16,paneHeight=high-low,cy=(low+high)/2,px=x+inward*(bay===0?.030:.004);
   // The old 43mm sash rails stopped 20mm short of the structural mullions.
   // Join the physical profiles; do not conceal the opening with extra glass.
   for(const edgeZ of [zz-paneWidth/2,zz+paneWidth/2]){B(blue,[px,cy,edgeZ],[.052,paneHeight+.10,.10],parent);B(frameLip,[px+inward*.030,cy,edgeZ-.037],[.007,paneHeight,.007],parent);}
   for(const y of [low,high])B(blue,[px,y,zz],[.052,.10,paneWidth+.10],parent);
   const pane=B(side===1?(isTop?upperGlass:frostedGlass):glass,[px-inward*.010,cy,zz],[.012,paneHeight-.096,paneWidth-.096],parent);pane.castShadow=false;pane.name=side===1?'pale-blue-interior-pane':'clear-exterior-pane';
   if(!isTop){rounded(frameGroove,[px+inward*.052,cy-.07,zz+(bay===0?1:-1)*(paneWidth/2-.07)],[.030,.13,.022],.005,null,parent);for(const track of [-.025,.025])B(frameGroove,[x+inward*(.035+track),bottom+.034,zz],[.008,.008,paneWidth],parent);}
  }
  B(blue,[x+inward*.090,bottom-.070,z],[.30,.060,width+.16],parent);B(frameLip,[x+inward*.218,bottom-.055,z],[.035,.020,width+.16],parent);B(frameGroove,[x+inward*.095,bottom-.105,z],[.27,.012,width+.10],parent);
  if(top<3.2){
   B(blue,[x+inward*.020,top+.075,z],[.19,.115,width+.15],parent);
   B(frameGroove,[x+inward*.103,top+.070,z],[.012,.029,width+.12],parent);
   B(blue,[x+inward*.035,top+.160,z],[.225,.055,width+.19],parent);
   B(frameLip,[x+inward*.140,top+.191,z],[.018,.012,width+.19],parent);
   B(blue,[x+inward*.020,top+.216,z],[.19,.035,width+.15],parent);
  }
  if(side===-1)for(const s of [-1,1]){
   const g=new T.PlaneGeometry(.37,height-.04,10,10);assets.add(g);const a=g.attributes.position;
   for(let i=0;i<a.count;i++)a.setZ(i,Math.cos(a.getX(i)*55)*.045);g.computeVertexNormals();
   const cloth=new T.Mesh(g,windowCloth);cloth.rotation.y=Math.PI/2;cloth.position.set(x+.19,mid,z+s*(width/2-.21));cloth.userData.animated=true;parent.add(cloth);curtains.push(cloth);
  }
 }
 function window(side,z,width=2.72,parent=room){if(side===2){buildWindow(side,z,width,parent);return;}buildWindow(side,z,width,facades[0]);buildWindow(side,z,width,facades[1],2.95);}
 // A shared physical floor is built at the larger dimensions. No existing prop
 // is stretched to enlarge the school; desks retain their original metre size.
 function floor(minX,maxX,minZ,maxZ,material=floorMat,parent=room){
  const x=(minX+maxX)/2,z=(minZ+maxZ)/2,g=new T.BoxGeometry(maxX-minX,.20,maxZ-minZ),p=g.attributes.position,u=g.attributes.uv;
  for(let i=0;i<p.count;i++)u.setXY(i,(p.getX(i)+x)/1.6,(p.getZ(i)+z)/1.6);assets.add(g);const surface=mesh(g,material,[x,-.10,z],[1,1,1],null,parent);surface.name='campus-continuous-floor';return surface;
 }
 floor(CLASSROOM.minX,CORRIDOR.maxX,CLASSROOM.minZ,CLASSROOM.maxZ);
 const wallHeight=4.51,wallY=wallHeight/2;
 // Exterior windows retain genuinely clear glazing and a visible courtyard.
 const bays=6,bayDepth=(CLASSROOM.maxZ-CLASSROOM.minZ)/bays;
 for(let i=0;i<bays;i++)window(-1,CLASSROOM.minZ+(i+.5)*bayDepth,bayDepth-.22);
 for(let i=0;i<=bays;i++){
  const center=CLASSROOM.minZ+i*bayDepth,lo=i===0?CLASSROOM.minZ-.20:center-.11,hi=i===bays?CLASSROOM.maxZ+.22:center+.11;
  B(cream,[-7.30,wallY,(lo+hi)/2],[.20,wallHeight,hi-lo]).name=i===0||i===bays?'classroom-exterior-end-pier':'classroom-exterior-window-pier';
 }
 strip(-7.30,-.59,.20,19.22,room,true,ceilingRig);
 // Pale blue internal panes read as glass without opening an unreal sightline
 // through every lower panel. Masonry sections include the interaction bell.
 for(const p of PARTITIONS){
  let spans=[[p.minZ,p.maxZ]];
  if(p.minZ<3.15&&p.maxZ>3.15){spans=[[p.minZ,2.70],[3.60,p.maxZ]];B(cream,[7.30,wallY,3.15],[.20,wallHeight,.90],enclosure);}
  for(const [a,b]of spans){const count=Math.max(1,Math.ceil((b-a)/3.2)),width=(b-a)/count;
   if(width<1.4){B(cream,[7.30,wallY,(a+b)/2],[.20,wallHeight,b-a],enclosure);continue;}
   for(let i=0;i<count;i++)window(1,a+(i+.5)*width,width-.16);
   // Each window leaves 8cm at either end: intermediate piers must fill
   // both halves of the joint, while the outer piers stop at the span edge.
   for(let i=0;i<=count;i++){
    const joint=a+i*width,lo=Math.max(a,joint-.08),hi=Math.min(b,joint+.08);
    B(cream,[7.30,wallY,(lo+hi)/2],[.20,wallHeight,hi-lo],enclosure).name='interior-window-join-pier';
   }
  }
  // A real surface lip, not a second face exactly on the plaster plane.
  B(skirting,[7.30,.065,(p.minZ+p.maxZ)/2],[.224,.13,p.maxZ-p.minZ],enclosure).name='partition-base-trim';
 }
 strip(7.30,-.59,.20,19.22,enclosure,false,ceilingRig);
 const markDynamic=g=>g.traverse(o=>{if(o.isMesh)o.userData.animated=true;});
 const doors=new Map(),targets={doors:[],officeDesks:[],officeChairs:[],lockers:[]};
 for(const d of DOORS){
  for(const z of [d.minZ,d.maxZ])B(blue,[7.30,1.54,z],[.24,3.08,.055],enclosure);
  B(blue,[7.30,3.08,d.center],[.24,.09,1.65],enclosure);
  for(const z of[d.minZ+.025,d.maxZ-.025])B(blue,[7.30,3.655,z],[.16,1.15,.06],enclosure);
  B(blue,[7.30,4.205,d.center],[.16,.07,1.65],enclosure);
  B(frostedGlass,[7.30,3.645,d.center],[.03,1.09,1.52],enclosure);B(cream,[7.30,4.37,d.center],[.20,.28,1.60],enclosure);
  const leaf=new T.Group();leaf.name=`classroom-${d.id}-door`;leaf.position.set(7.30,0,d.maxZ);leaf.rotation.y=-Math.PI/2;
  const panel=new T.Group();panel.rotation.y=Math.PI;leaf.add(panel);doorLeaf(panel,1.60,3.02);enclosure.add(leaf);markDynamic(leaf);
  leaf.traverse(o=>{if(o.isMesh)o.userData.campusTarget={type:'door',id:d.id};});
  doors.set(d.id,leaf);targets.doors.push({id:d.id,object:leaf,point:new T.Vector3(7.30,1.30,d.center),duration:3});
  B(edge,[7.30,.012,d.center],[.27,.024,1.60],enclosure);
 }
 // End walls, blackboards, teaching platform, wall trim and ceiling form a
 // continuous shell at exactly the same boundaries as walking/throw collisions.
 B(cream,[0,wallY,-10.10],[14.40,wallHeight,.20]).name='classroom-rear-end-wall';
 // The partition owns x=7.20..7.40 at this corner. Split the perpendicular
 // wall at that exact join instead of duplicating its visible end face.
 B(cream,[0,wallY,8.91],[14.40,wallHeight,.22],enclosure).name='classroom-front-end-wall';
 B(cream,[7.85,wallY,8.91],[.90,wallHeight,.22],enclosure).name='office-entry-left-pier';
 B(wallGreen,[0,.57,-9.983],[14.38,1.14,.025]);B(edge,[0,1.145,-9.966],[14.38,.025,.030]);B(wallGreen,[.50,.57,8.785],[15.40,1.14,.025],enclosure);B(edge,[.50,1.145,8.768],[15.40,.025,.030],enclosure);
 strip(0,-9.98,14.40,.04,room,true,ceilingRig);strip(0,8.78,14.40,.04,enclosure,true,ceilingRig);
 const lesson=texture(1400,680,(c,w,h)=>{drawBoardSurface(c,w,h,surfaces?.board);c.fillStyle='#e4ead8';c.font='42px "Kaiti SC",serif';c.fillText('数学',75,80);c.font='italic 62px Georgia';c.fillText('y = ax² + bx + c',85,230);c.fillText('a² + b² = c²',85,372);c.font='38px serif';c.fillText('练习 3    P.48',85,550);c.strokeStyle='#e4ead8';c.lineWidth=5;c.beginPath();c.moveTo(900,480);c.lineTo(1220,480);c.lineTo(1220,180);c.closePath();c.stroke();});
 B(edge,[0,2.65,8.76],[7.50,2.55,.11],enclosure);B(mat('#fff',{map:lesson,roughness:.92}),[0,2.65,8.69],[7.36,2.40,.025],enclosure);B(edge,[0,1.34,8.61],[7.55,.05,.20],enclosure);
 const poster=texture(1024,512,(c,w,h)=>{drawBoardSurface(c,w,h,surfaces?.board);c.fillStyle='#eee6ba';c.textAlign='center';c.font='bold 66px "Kaiti SC",serif';c.fillText('迎接新世纪',w/2,105);c.strokeStyle='#c9d4b8';c.lineWidth=3;for(const x of [45,355,665]){c.strokeRect(x,160,280,300);c.font='30px "Kaiti SC",serif';c.fillText(['团结友爱','认真学习','文明班级'][(x-45)/310],x+140,220);for(let j=0;j<7;j++){c.fillStyle='#b5c7b3';c.fillRect(x+25,255+j*22,230-j%3*32,3);}}});
 B(edge,[0,2.5,-9.98],[5.5,2.4,.09]);B(mat('#fff',{map:poster,roughness:.94}),[0,2.5,-9.92],[5.38,2.28,.016]);
 const noticeBoard=texture(960,640,(c,w,h)=>{
  c.fillStyle='#62a58b';c.fillRect(0,0,w,h);
  for(const [x,y,ww,hh,color] of [[38,35,240,180,'#e7b29d'],[312,38,214,149,'#f0d797'],[583,55,208,255,'#ecead6'],[80,253,190,151,'#f1e7bc'],[308,235,234,220,'#dbe5cf'],[585,362,175,230,'#dde5d5'],[784,343,134,230,'#d2e1d7'],[88,448,210,142,'#c5dcdd'],[326,484,210,108,'#e8dcbb']]){
   c.fillStyle=color;c.fillRect(x,y,ww,hh);c.fillStyle='#798d7d';c.fillRect(x+14,y+16,ww-28,5);for(let k=0;k<Math.floor((hh-45)/18);k++)c.fillRect(x+15,y+41+k*18,ww-30-k%3*17,2);c.fillStyle='#e7e3cf';c.beginPath();c.arc(x+ww/2,y+8,4,0,Math.PI*2);c.fill();
  }
 });
 B(blue,[-4.75,2.52,-9.97],[3.3,2.28,.08]);B(mat('#fff',{map:noticeBoard,roughness:.9}),[-4.75,2.52,-9.91],[3.18,2.16,.014]);
 const framedArt=(name,image,w,h,p,yaw=0,parent=room)=>{
  const group=new T.Group();group.name=name;group.position.set(...p);group.rotation.y=yaw;parent.add(group);
  B(blue,[0,0,0],[w+.07,h+.07,.035],group);
  B(M.white,[0,0,.019],[w,h,.002],group);
  const face=new T.PlaneGeometry(w,h);assets.add(face);const material=mat('#ffffff',{map:image,transparent:true,depthWrite:false,roughness:.85});
  mesh(face,material,[0,0,.022],[1,1,1],null,group);return group;
 };
 if(artwork.classroomNotice){
  framedArt('classroom-pillar-notice',artwork.classroomNotice,.64,.80,[7.185,2.40,3.15],-Math.PI/2,enclosure);
 }
 const award=texture(768,512,(c,w,h)=>{
  c.fillStyle='#ead4a1';c.fillRect(0,0,w,h);c.strokeStyle='#bd473b';c.lineWidth=16;c.strokeRect(14,14,w-28,h-28);c.lineWidth=3;c.strokeRect(37,37,w-74,h-74);c.fillStyle='#b43f33';c.textAlign='center';c.font='bold 90px "Kaiti SC",serif';c.fillText('奖 状',w/2,147);c.fillStyle='#66513c';c.font='41px "Kaiti SC",serif';c.fillText('文明班级',w/2,268);c.font='27px "Kaiti SC",serif';c.fillText('团结 · 友爱 · 进步',w/2,345);c.strokeStyle='#b43f33';c.lineWidth=4;c.beginPath();c.arc(621,415,45,0,Math.PI*2);c.stroke();c.font='20px sans-serif';c.fillText('学校',621,422);
 });
 for(let row=0;row<3;row++)for(let col=0;col<3;col++)framedArt('classroom-red-award',award,.89,.593,[3.65+col*.94,3.20-row*.63,-9.94]);
 createCampusWallProps({parent:enclosure,mat,box,rounded,mesh,assets});
 const doodle=texture(512,256,(c,w,h)=>{
  c.clearRect(0,0,w,h);c.strokeStyle='rgba(92,104,94,.62)';c.lineWidth=3;c.lineCap='round';c.beginPath();c.ellipse(105,142,45,35,-.14,0,Math.PI*2);c.moveTo(65,120);c.lineTo(64,78);c.lineTo(92,108);c.moveTo(118,110);c.lineTo(145,77);c.lineTo(147,132);c.moveTo(88,145);c.lineTo(91,146);c.moveTo(118,142);c.lineTo(121,143);c.moveTo(101,157);c.lineTo(110,163);c.lineTo(117,156);c.stroke();c.font='28px "Kaiti SC",serif';c.fillStyle='rgba(94,104,94,.55)';c.save();c.translate(198,114);c.rotate(-.08);c.fillText('下课去操场',0,0);c.restore();
 });
 const doodleGeo=new T.PlaneGeometry(.9,.45);assets.add(doodleGeo);const doodleMat=mat('#fff',{map:doodle,transparent:true,depthWrite:false,roughness:1});mesh(doodleGeo,doodleMat,[-7.185,1.47,4.8],[1,1,1],[0,Math.PI/2,0],room);mesh(doodleGeo,doodleMat,[10.986,1.72,-8.20],[1,1,1],[0,-Math.PI/2,0],enclosure);
 const woodGrain=texture(1024,256,(c,w,h)=>{c.fillStyle='#e1cfac';c.fillRect(0,0,w,h);for(let i=0;i<150;i++){const y=i*59%h;c.strokeStyle=i%3?'rgba(80,40,18,.07)':'rgba(255,249,220,.18)';c.lineWidth=.5+i%3*.3;c.beginPath();for(let x=0;x<=w;x+=16){const yy=y+Math.sin(x*.009+i*.5)*(1+i%6)+Math.sin(x*.022+i)*1.5;x?c.lineTo(x,yy):c.moveTo(x,yy);}c.stroke();}});
 woodGrain.wrapS=woodGrain.wrapT=T.RepeatWrapping;
 const officePlanks=texture(1024,1024,(c,w,h)=>{c.fillStyle='#c1a47c';c.fillRect(0,0,w,h);for(let row=0;row<8;row++){const y=row*128;c.fillStyle=['#c8ac84','#cbb18b','#bfa27c','#d0b58f'][row%4];c.fillRect(0,y,w,127);for(let line=0;line<27;line++){c.strokeStyle=line%3?'rgba(83,53,24,.045)':'rgba(255,240,198,.12)';c.lineWidth=1;c.beginPath();for(let x=0;x<=w;x+=16){const yy=y+3+line*4.55+Math.sin(x*.013+line+row)*1.4;x?c.lineTo(x,yy):c.moveTo(x,yy);}c.stroke();}c.fillStyle='rgba(65,48,28,.25)';c.fillRect(0,y,w,1.2);for(let cut=0;cut<2;cut++){const x=(row%2?256:0)+cut*512;c.fillRect(x,y,1.4,128);}}});officePlanks.wrapS=officePlanks.wrapT=T.RepeatWrapping;
 const officeWood=mat('#a56847',{map:woodGrain,roughness:.62}),darkWood=mat('#73503b',{map:woodGrain,roughness:.72}),cabinetPaint=mat('#b6cbc4',{roughness:.58}),cabinetBack=mat('#687b75',{roughness:.82}),boards=mat('#d5a66a',{map:woodGrain,roughness:.66}),officeFloor=mat('#ffffff',{map:officePlanks,roughness:.75});
 B(boards,[0,.08,7.65],[6.30,.16,2.30],enclosure);
 const lx=(LECTERN.minX+LECTERN.maxX)/2,lz=(LECTERN.minZ+LECTERN.maxZ)/2;rounded(M.wood,[lx,1.11,lz],[1.35,.075,.82],.022,null,enclosure);rounded(cream,[lx,.65,lz+.07],[1.22,.87,.60],.016,null,enclosure);B(edge,[lx,.23,lz+.05],[1.24,.055,.63],enclosure);
 // Only the section beside the lift is glazed. The remaining wall is solid,
 // as in the supplied walkthrough; its physical outer boundary never opens.
 const corridorWallX=CORRIDOR.maxX+.10;
 for(const [lo,hi]of [[-10.20,-7.45],[-4.27,9.02]]){
  const length=hi-lo,z=(lo+hi)/2;
  B(cream,[corridorWallX,wallY,z],[.20,wallHeight,length],enclosure).name='corridor-solid-outer-wall';
  B(wallGreen,[10.986,.57,z],[.025,1.14,length],enclosure);
  B(edge,[10.968,1.145,z],[.030,.025,length],enclosure);
 }
 window(2,-5.86,2.95,enclosure);
 for(const z of[-7.3925,-4.3275])B(cream,[corridorWallX,wallY,z],[.20,wallHeight,.115],enclosure);
 strip(CORRIDOR.maxX-.025,-.60,.05,18.80,enclosure);
 B(cream,[(10.10+11.00)/2,wallY,8.91],[.90,wallHeight,.22],enclosure).name='office-entry-right-pier';
 B(cream,[(7.40+8.10)/2,wallY,-10.10],[.70,wallHeight,.20],enclosure).name='lift-entry-left-pier';
 B(cream,[(10.60+11.00)/2,wallY,-10.10],[.40,wallHeight,.20],enclosure).name='lift-entry-right-pier';
 if(artwork.studentTutorial){
  const tutorial=new T.Group();tutorial.name='corridor-student-tutorial';tutorial.position.set(10.996,2.05,.90);tutorial.rotation.y=-Math.PI/2;enclosure.add(tutorial);
  const geo=new T.PlaneGeometry(3.0,1.5);assets.add(geo);
  mesh(geo,mat('#ffffff',{map:artwork.studentTutorial,transparent:true,depthWrite:false,roughness:.96}),[0,0,0],[1,1,1],null,tutorial);
 }
 const clutter=new T.Group();clutter.name='rear-door-dark-storage';clutter.position.set(10.63,0,-9.32);enclosure.add(clutter);
 const cardboard=mat('#947f5c',{roughness:.98});for(const [x,y,z,w,h,d]of [[0,.35,0,.64,.70,.64],[-.03,.95,.05,.58,.50,.58],[.03,1.36,.08,.50,.32,.50]]){B(cardboard,[x,y,z],[w,h,d],clutter);B(darkWood,[x,y+h/2+.003,z],[w,.006,.04],clutter);}
 for(let i=0;i<3;i++){cylinder(boards,[-.21+i*.13,1.01,-.26],[.017,1.95,.017],[0,0,-.05+i*.045],clutter);B(cabinetBack,[-.21+i*.13,.12,-.26],[.13,.15,.08],clutter);}
 // Office shares the north wall with the classroom and can actually be entered.
 const office=new T.Group();office.name='walkable-teacher-office';enclosure.add(office);
 floor(OFFICE.minX,OFFICE.maxX,OFFICE.minZ-.22,OFFICE.maxZ,officeFloor,office);
 const officeWidth=OFFICE.maxX-OFFICE.minX,officeMidX=(OFFICE.minX+OFFICE.maxX)/2,officeStart=CLASSROOM.maxZ,officeEnd=OFFICE.maxZ+.20,officeDepth=officeEnd-officeStart,officeMidZ=(officeStart+officeEnd)/2;
 for(const x of[OFFICE.minX-.10,OFFICE.maxX+.10])B(cream,[x,wallY,officeMidZ],[.20,wallHeight,officeDepth],office);
 const officeBack=OFFICE.maxZ+.10;
 B(cream,[officeMidX,.58,officeBack],[officeWidth,1.16,.20],office);B(cream,[officeMidX,4.10,officeBack],[officeWidth,.82,.20],office);for(const x of[OFFICE.minX+.20,OFFICE.maxX-.20])B(cream,[x,2.44,officeBack],[.40,2.56,.20],office);
 for(const y of[1.18,3.69])B(blue,[officeMidX,y,OFFICE.maxZ-.01],[officeWidth-.62,.07,.12],office);for(let i=0;i<=8;i++)B(blue,[OFFICE.minX+.32+i*(officeWidth-.64)/8,2.44,OFFICE.maxZ-.01],[.06,2.55,.12],office);B(glass,[officeMidX,2.44,OFFICE.maxZ],[officeWidth-.74,2.50,.016],office);B(edge,[officeMidX,1.14,OFFICE.maxZ-.15],[officeWidth-.50,.06,.30],office);
 for(const x of [OFFICE.doorMinX,OFFICE.doorMaxX])B(blue,[x,1.54,8.91],[.06,3.08,.25],office);B(blue,[OFFICE.doorX,3.07,8.91],[1.86,.06,.25],office);B(cream,[OFFICE.doorX,3.82,8.91],[1.80,1.38,.22],office);
 const officeDoors=[];for(const [i,x]of [OFFICE.doorMinX,OFFICE.doorMaxX].entries()){
  const hinge=new T.Group();hinge.name='office-countdown-door';hinge.position.set(x,0,8.91);const panel=new T.Group();panel.rotation.y=i===0?Math.PI/2:-Math.PI/2;hinge.add(panel);doorLeaf(panel,.90,3.02);office.add(hinge);markDynamic(hinge);officeDoors.push(hinge);
 }
 const books=['#8d4940','#37596b','#d6b158','#53795d','#d1cfb5','#75627e'].map(c=>mat(c,{roughness:.83}));
 for(const z of [11.32,13.85,16.38,18.91]){
  B(darkWood,[OFFICE.minX+.08,1.4,z],[.06,2.78,2.32],office);for(const zz of [z-1.13,z+1.13])B(officeWood,[OFFICE.minX+.35,1.4,zz],[.60,2.78,.06],office);
  for(let r=0;r<6;r++){const y=.08+r*.53;B(officeWood,[OFFICE.minX+.35,y,z],[.60,.045,2.32],office);if(r===5)continue;for(let n=0;n<19;n++){const h=.30+(n*7+r)%5*.025,zz=z-1.03+n*.114;B(books[(n+r)%6],[OFFICE.minX+.43,y+h/2+.025,zz],[.30,h,.075],office);B(M.paper,[OFFICE.minX+.586,y+h*.70,zz],[.009,.014,.054],office);}}
 }
 B(cabinetPaint,[10.68,.53,13],[.60,.99,3.80],office);B(officeWood,[10.65,1.045,13],[.66,.04,3.85],office);
 for(const z of [11.55,12.5,13.45,14.4]){B(cabinetBack,[10.37,.53,z],[.018,.89,.89],office);B(cabinetPaint,[10.35,.53,z],[.025,.84,.84],office);rounded(edge,[10.325,.59,z+.29],[.024,.10,.025],.006,null,office);}
 // The lunch drawer slides out as a whole tray; target meshes survive static
 // geometry baking so interaction follows the visible drawer, not a hidden box.
 const desk=new T.Group();desk.name='office-openable-lunch-desk';desk.position.set(OFFICE_DESK.x,0,OFFICE_DESK.z);office.add(desk);
 rounded(officeWood,[0,.94,0],[2.20,.09,1.02],.018,null,desk);for(const x of [-.89,.89]){B(darkWood,[x,.46,.06],[.30,.86,.87],desk);B(seal,[x,.04,.06],[.29,.08,.84],desk);}B(darkWood,[0,.58,.44],[1.55,.60,.04],desk);
 const officeDrawer=new T.Group();officeDrawer.name='teacher-lunch-drawer';officeDrawer.position.set(0,.67,-.08);desk.add(officeDrawer);
 B(darkWood,[0,-.12,0],[1.44,.04,.76],officeDrawer);for(const x of [-.72,.72])B(officeWood,[x,.01,0],[.035,.25,.76],officeDrawer);B(officeWood,[0,.01,.37],[1.45,.25,.035],officeDrawer);rounded(officeWood,[0,.01,-.39],[1.52,.28,.055],.006,null,officeDrawer);rounded(edge,[0,.04,-.43],[.24,.025,.035],.006,null,officeDrawer);
 markDynamic(desk);desk.traverse(o=>{if(o.isMesh)o.userData.campusTarget={type:'officeDesk',id:OFFICE_DESK.id};});
 targets.officeDesks.push({id:OFFICE_DESK.id,object:desk,drawer:officeDrawer,itemParent:officeDrawer,point:new T.Vector3(OFFICE_DESK.x,.98,OFFICE_DESK.z-.45)});
 const officeDrawers=new Map([[OFFICE_DESK.id,officeDrawer]]);
 const mobileBoard=new T.Group();mobileBoard.name='office-mobile-board';mobileBoard.position.set(OFFICE_BOARD.x,0,OFFICE_BOARD.z);office.add(mobileBoard);B(edge,[0,1.78,0],[2.70,1.40,.06],mobileBoard);B(M.white,[0,1.78,-.038],[2.61,1.31,.016],mobileBoard);if(artwork.teacherTutorial){const tutorialGeo=new T.PlaneGeometry(2.54,1.27);assets.add(tutorialGeo);const tutorial=mesh(tutorialGeo,mat('#fff',{map:artwork.teacherTutorial,transparent:true,depthWrite:false,roughness:.82}),[0,1.78,-.050],[1,1,1],[0,Math.PI,0],mobileBoard);tutorial.name='teacher-tutorial-whiteboard';}for(const x of[-1.20,1.20]){B(edge,[x,1.14,0],[.04,2.20,.04],mobileBoard);rounded(edge,[x,.10,0],[.06,.045,.70],.008,null,mobileBoard);for(const z of[-.28,.28])cylinder(seal,[x,.045,z],[.045,.027,.045],[0,0,Math.PI/2],mobileBoard);}B(edge,[0,1.06,-.10],[2.60,.025,.16],mobileBoard);
 // Keep one exercise book and a single pen on the office desk, just as the
 // classroom surface does. The lunch is created by the item system inside.
 rounded(M.paper,[.55,1.005,.08],[.37,.035,.29],.005,[0,.12,0],desk);cylinder(blue,[.22,1.004,-.06],[.006,.18,.006],[0,0,Math.PI/2],desk);
 const officeScreens=new Map();
 for(const d of OFFICE_DESKS){
  let table=desk;
  if(d!==OFFICE_DESK){table=new T.Group();table.name=d.id;table.position.set(d.x,0,d.z);office.add(table);rounded(officeWood,[0,.94,0],[2.20,.09,1.02],.018,null,table);for(const x of[-.89,.89]){B(darkWood,[x,.46,.06],[.30,.86,.87],table);B(seal,[x,.04,.06],[.29,.08,.84],table);}B(darkWood,[0,.58,.44],[1.55,.60,.04],table);rounded(M.paper,[.55,1.005,.08],[.37,.035,.29],.005,[0,.12,0],table);cylinder(blue,[.22,1.004,-.06],[.006,.18,.006],[0,0,Math.PI/2],table);
   const drawer=officeDrawer.clone(true);drawer.name=d.id+'-drawer';table.add(drawer);officeDrawers.set(d.id,drawer);markDynamic(table);table.traverse(o=>{if(o.isMesh)o.userData.campusTarget={type:'officeDesk',id:d.id};});targets.officeDesks.push({id:d.id,object:table,drawer,itemParent:drawer,point:new T.Vector3(d.x,.98,d.z-.45)});
  }
  const computer=buildDesktop55({parent:table,box,rounded,mat,x:-.42,y:.985,z:0,id:d.id+'-computer',bakeStatic});assets.add(computer.screen.geometry);materials.add(computer.screen.material);officeScreens.set(d.id,computer.screen);
 }
 function tube(points,radius,material,parent){const g=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'centripetal'),points.length*5,radius,8,false);assets.add(g);return mesh(g,material,[0,0,0],[1,1,1],null,parent);}
 const upholstery=mat('#363e3e',{roughness:.87}),chairMetal=mat('#8d9898',{metalness:.65,roughness:.34});
 for(const c of OFFICE_CHAIRS){const chair=new T.Group();chair.name=c===OFFICE_CHAIR?'office-sittable-chair':c.id;chair.position.set(c.x,0,c.z);office.add(chair);
 rounded(upholstery,[0,.485,0],[.70,.075,.55],.025,null,chair);rounded(upholstery,[0,.89,-.29],[.65,.45,.08],.022,[-.08,0,0],chair);
 for(const x of [-.29,.29]){tube([[x,.04,.34],[x,.04,-.30],[x,.10,-.34],[x,.48,-.28],[x,1.08,-.32]],.018,chairMetal,chair);tube([[x,.46,-.25],[x,.46,.24],[x,.39,.27],[x,.04,.34]],.018,chairMetal,chair);for(const z of [-.30,.34])rounded(seal,[x,.02,z],[.065,.04,.066],.010,null,chair);}
 markDynamic(chair);chair.traverse(o=>{if(o.isMesh)o.userData.campusTarget={type:'officeChair',id:c.id};});targets.officeChairs.push({id:c.id,object:chair,point:new T.Vector3(c.x,.6,c.z)});}
 // Physical pre-match changing lockers; each door is an independent target.
 const locker=new T.Group();locker.name='role-changing-locker';locker.position.set(ROLE_LOCKER.x,0,ROLE_LOCKER.z);enclosure.add(locker);
 for(const [i,z]of [-.43,.43].entries()){
  B(cabinetBack,[0,1.13,z],[.68,2.26,.82],locker);rounded(cabinetPaint,[-.355,1.13,z],[.035,2.20,.76],.008,null,locker);
  for(const y of [.34,1.91])for(let n=0;n<5;n++)B(seal,[-.375,y+n*.035,z],[.009,.014,.36],locker);
  rounded(edge,[-.389,1.02,z+.27],[.032,.16,.03],.007,null,locker);const sign=texture(128,128,(c,w,h)=>{c.fillStyle='#e8eee2';c.fillRect(0,0,w,h);c.fillStyle='#3b625f';c.textAlign='center';c.font='bold 45px sans-serif';c.fillText(i===0?'老师':'学生',64,80);});
  B(mat('#fff',{map:sign}),[-.38,1.55,z],[.012,.21,.27],locker);
 }
 // The two doors need their real central stile; a gap through the cabinet
 // made a perfectly centred interaction ray miss both doors.
 const lockerStile=rounded(cabinetPaint,[-.355,1.13,0],[.055,2.26,.05],.006,null,locker);lockerStile.name='locker-central-stile';
 markDynamic(locker);locker.traverse(o=>{if(o.isMesh)o.userData.campusTarget={type:'locker',id:'role'};});targets.lockers.push({id:'role',object:locker,point:new T.Vector3(10.2,1.2,ROLE_LOCKER.z)});
 // Lift cabin has eight distinct floor buttons. The server chooses the floor;
 // changing floors never randomly changes the building's room arrangement.
 const lift=new T.Group();lift.name='walkable-eight-floor-lift';enclosure.add(lift);const liftBlue=mat('#657e93',{metalness:.16,roughness:.63}),liftInset=mat('#526b7d',{metalness:.12,roughness:.65});
 floor(LIFT.minX,LIFT.maxX,LIFT.minZ,CLASSROOM.minZ,liftBlue,lift);
 // Butt the cabin panels against the masonry reveal at z=-10.20. The old
 // panels extended through the full wall and duplicated both its end face
 // and the lintel's underside, producing a flickering metal/plaster seam.
 for(const x of [8,10.7])B(liftBlue,[x,1.56,-11.60],[.20,3.12,2.80],lift).name='lift-cabin-side-wall';
 B(liftBlue,[9.35,1.56,-13.1],[2.9,3.12,.20],lift).name='lift-cabin-back-wall';
 B(liftBlue,[9.35,3.20,-11.70],[2.9,.16,3.00],lift).name='lift-cabin-ceiling';
 // Preserve the same 2.50m clear aperture used by authoritative collision.
 // The jamb sections sit in the existing wall thickness, not in the opening.
 for(const x of [LIFT.minX-.045,LIFT.maxX+.045]){
  B(seal,[x,1.56,-10.1],[.07,3.12,.20],lift).name='lift-jamb-seal';
  B(edge,[x,1.56,-9.98],[.09,3.12,.025],lift).name='lift-jamb-face';
 }
 B(edge,[9.35,3.165,-9.98],[2.68,.09,.025],lift).name='lift-lintel-face';
 B(cream,[9.35,(3.12+CEILING_HEIGHT)/2,-10.1],[2.5,CEILING_HEIGHT-3.12,.2],lift).name='lift-entry-lintel';
 const liftDoors=[-1,1].map(side=>{const g=new T.Group();g.name=side<0?'lift-door-left':'lift-door-right';g.position.set(9.35+side*.625,0,-10.10);lift.add(g);B(liftBlue,[0,1.56,0],[1.25,3.08,.08],g);B(liftInset,[0,1.56,-.046],[1.15,2.95,.012],g);B(edge,[-side*.605,1.56,-.055],[.025,3.03,.012],g);markDynamic(g);return g;});
 for(const x of [8.73,9.97]){B(liftInset,[x,1.57,-12.99],[1.18,2.94,.018],lift);B(edge,[x+.575,1.57,-12.975],[.018,2.92,.01],lift);}for(const x of [8.125,10.575])B(edge,[x,1.02,-11.6],[.03,.04,2.1],lift);
 const liftPanel=new T.Group();liftPanel.name='eight-floor-selection';liftPanel.position.set(8.13,1.50,-10.85);lift.add(liftPanel);B(edge,[0,0,0],[.06,1.15,.54],liftPanel);
 for(let row=0;row<4;row++)for(let col=0;col<2;col++){const n=row*2+col+1,t=texture(96,96,(c,w,h)=>{c.fillStyle='#455f71';c.fillRect(0,0,w,h);c.strokeStyle='#9eb4c2';c.lineWidth=4;c.strokeRect(4,4,88,88);c.fillStyle='#f5f6ed';c.textAlign='center';c.font='bold 64px sans-serif';c.fillText(String(n),48,72);});const button=B(mat('#fff',{map:t}),[.034,.40-row*.27,.135-col*.27],[.015,.22,.22],liftPanel);button.userData.floorMap=CAMPUS_MAPS[n-1];button.userData.floor=n;}
 markDynamic(liftPanel);
 // Stair profile is shared by floorHeight, navigation support and the render.
 const tiered=new T.Group();tiered.name='tiered-classroom-floor';scene.add(tiered);tiered.visible=false;
 const riser=mat('#c9cfc1',{roughness:.86}),nosing=mat('#adb7a9',{roughness:.68});
 for(const t of floorTiles()){const x=(t.minX+t.maxX)/2,z=(t.minZ+t.maxZ)/2,g=new T.BoxGeometry(t.maxX-t.minX,t.height+.012,t.maxZ-t.minZ),p=g.attributes.position,u=g.attributes.uv;for(let i=0;i<p.count;i++)u.setXY(i,(p.getX(i)+x)/1.6,(p.getZ(i)+z)/1.6);assets.add(g);mesh(g,[riser,riser,floorMat,riser,riser,riser],[x,t.height/2-.006,z],[1,1,1],null,tiered);for(const [zz,sign]of [[t.minZ,-1],[t.maxZ,1]])if(floorHeight(x,zz+sign*.002,'tiered')<t.height-.01&&zz>-9.99)B(nosing,[x,t.height+.002,zz-sign*.014],[t.maxX-t.minX,.004,.028],tiered);}
 for(const x of [-7.30,7.30])upperColumn(x,-.59,.20,19.22);
 upperColumn(0,-10.10,14.40,.20);upperColumn(0,8.91,14.40,.22);
 // The three slabs meet at shared boundaries. The former office slab began
 // at 8.80 while both school slabs ended at 9.01, causing coplanar flicker.
 B(ceilingMaterial,[0,4.59,-.59],[14.80,.16,19.22],ceilingRig).name='campus-ceiling-classroom';B(ceilingMaterial,[9.3,4.59,-.59],[3.8,.16,19.22],enclosure).name='campus-ceiling-corridor';B(ceilingMaterial,[officeMidX,4.59,(9.02+officeEnd)/2],[officeWidth+.4,.16,officeEnd-9.02],office).name='campus-ceiling-office';
 const lamp=mat('#f3f1db',{emissive:'#fff6d6',emissiveIntensity:.48,roughness:.3}),ceilingJoint=mat('#b4beb5',{roughness:.9});
 function grid(x0,x1,z0,z1,parent){for(let x=x0+.6;x<x1;x+=.6)B(ceilingJoint,[x,4.504,(z0+z1)/2],[.009,.012,z1-z0],parent).castShadow=false;for(let z=z0+1.2;z<z1;z+=1.2)B(ceilingJoint,[(x0+x1)/2,4.503,z],[x1-x0,.012,.009],parent).castShadow=false;}
 function fluorescent(x,z,parent){for(const xx of [x-.45,x+.45])B(edge,[xx,4.35,z],[.012,.30,.012],parent);rounded(edge,[x,4.19,z],[1.36,.055,.27],.008,null,parent);B(seal,[x,4.158,z],[1.22,.012,.20],parent);for(const zz of [z-.065,z+.065])cylinder(lamp,[x,4.142,zz],[.018,1.17,.018],[0,0,Math.PI/2],parent);}
 grid(-7.2,7.2,-10,8.8,ceilingRig);for(const x of [-4.1,0,4.1])for(const z of [-7,-1.2,4.6])fluorescent(x,z,ceilingRig);grid(7.4,11,-10,8.8,enclosure);for(const z of [-7,-2,3,7])fluorescent(9.2,z,enclosure);grid(OFFICE.minX,OFFICE.maxX,OFFICE.minZ,OFFICE.maxZ,office);for(const x of[2.1,7.5])for(const z of[11.2,15,18.8])fluorescent(x,z,office);
 const officeLight=new T.PointLight('#fff5dc',6.5,17,1.6);officeLight.position.set(officeMidX,3.7,15);office.add(officeLight);
 // Keep the courtyard visible through genuinely transparent exterior panes.
 const yard=mat('#bebcad',{roughness:.93}),grass=mat('#96a47d',{roughness:.97}),curb=mat('#b7c0b0',{roughness:.88});B(yard,[1.25,-.21,6],[58,.20,58]);
 for(const x of [-10.4,14.1]){B(grass,[x,-.15,1],[3.6,.12,34]);for(const xx of [x-1.82,x+1.82])B(curb,[xx,-.085,1],[.08,.13,34]);}
 // A courtyard with real building depth: the front face is piers and spandrels,
 // so each window has an open reveal instead of a pane pasted onto a slab.
 const school=new T.Group();school.name='courtyard-school-wings';room.add(school);
 const block=mat('#eadfc6',{roughness:.89}),pier=mat('#ccab77',{roughness:.79}),ledge=mat('#f1e8d3',{roughness:.76}),reveal=mat('#697c7c',{roughness:.86}),windowMetal=mat('#9bbec6',{metalness:.38,roughness:.35});
 const reflection=texture(256,256,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#609eb8');g.addColorStop(.57,'#add6df');g.addColorStop(1,'#799fa7');c.fillStyle=g;c.fillRect(0,0,w,h);c.fillStyle='rgba(236,249,242,.35)';c.beginPath();c.moveTo(12,25);c.lineTo(181,25);c.lineTo(245,87);c.lineTo(76,87);c.closePath();c.fill();c.fillStyle='rgba(48,93,111,.16)';c.fillRect(0,190,w,7);});
 const pane=mat('#ffffff',{map:reflection,metalness:.20,roughness:.28});
 function schoolWing(x,z,rotation,bays=8){
  const wing=new T.Group();wing.name='school-wing';wing.position.set(x,0,z);wing.rotation.y=rotation;school.add(wing);
  const bay=2.75,length=bays*bay,depth=4.1,floors=3,storey=2.75;
  B(reveal,[depth-.10,4.06,0],[.20,8.28,length],wing);
  for(const end of [-length/2,length/2])B(block,[depth/2,4.06,end],[depth,8.28,.24],wing);
  B(pier,[depth/2,-.04,0],[depth+.25,.16,length+.25],wing);
  for(let row=0;row<=floors;row++){
   const y=row*storey;B(ledge,[depth/2-.16,y,0],[depth+.44,.15,length+.34],wing);
   if(row===floors){B(pier,[-.05,y+.18,0],[.30,.30,length+.14],wing);B(ledge,[-.17,y+.36,0],[.56,.08,length+.45],wing);}
  }
  for(let row=0;row<floors;row++){
   const base=row*storey;
   B(block,[.02,base+.42,0],[.24,.70,length],wing);B(block,[.02,base+2.55,0],[.24,.25,length],wing);
   for(let col=0;col<=bays;col++)B(pier,[.0,base+1.62,-length/2+col*bay],[.33,1.74,.25],wing);
   for(let col=0;col<bays;col++){
    const zz=-length/2+(col+.5)*bay,ww=bay-.30,yy=base+1.59,hh=1.71;
    for(const edgeZ of [zz-ww/2,zz+ww/2])B(reveal,[.26,yy,edgeZ],[.52,hh,.06],wing);
    B(reveal,[.26,base+.75,zz],[.52,.055,ww],wing);B(reveal,[.26,base+2.45,zz],[.52,.055,ww],wing);
    B(pane,[.49,yy,zz],[.025,hh-.09,ww-.09],wing);
    for(const edgeZ of [zz-ww/2+.055,zz,zz+ww/2-.055])B(windowMetal,[.455,yy,edgeZ],[.07,hh-.045,.045],wing);
    for(const y of [base+.79,base+1.96,base+2.41])B(windowMetal,[.455,y,zz],[.07,.045,ww-.055],wing);
    B(ledge,[-.08,base+.73,zz],[.53,.09,ww+.14],wing);
   }
  }
  // The lower covered walkway projects into the courtyard, with a readable
  // soffit, supporting columns and continuous ground-level contact.
  B(ledge,[-.66,2.71,0],[1.66,.16,length+.28],wing);B(pier,[-1.46,2.64,0],[.13,.19,length+.30],wing);
  B(block,[-.68,-.015,0],[1.70,.11,length+.30],wing);
  for(let col=0;col<=bays;col+=2)B(block,[-1.32,1.30,-length/2+col*bay],[.24,2.60,.27],wing);
 }
 schoolWing(-20.4,-1.4,Math.PI);schoolWing(23.4,1.1,0);schoolWing(2.5,28.3,-Math.PI/2,6);
 // Low-detail opaque crowns establish the volume; shared cutout leaf sprays
 // soften the outline. This stays under 5k triangles for all eight trees.
 const branchMat=mat('#8a7857',{roughness:.96}),crownMat=mat('#ffffff',{vertexColors:true,roughness:1});
 const leafImage=texture(256,256,(c,w,h)=>{c.clearRect(0,0,w,h);for(let n=0;n<140;n++){const a=n*2.39996,r=Math.sqrt(n/140)*109,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r*.83;c.fillStyle=['#6f9c43','#8cba50','#bdd56b','#8bad4d'][n%4];c.beginPath();c.ellipse(x,y,7+n%5,4+n%3,a,0,Math.PI*2);c.fill();}}),leafMat=mat('#ffffff',{map:leafImage,alphaTest:.45,side:T.DoubleSide,roughness:1}),leafGeo=new T.PlaneGeometry(1.18,1.04);assets.add(leafGeo);
 function canopy(seed){
  const g=new T.SphereGeometry(1,16,8),p=g.attributes.position,colors=[],dark=new T.Color('#5f893b'),light=new T.Color('#b9cf64');
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),band=Math.sqrt(Math.max(0,1-y*y));
   const lobe=1+band*(.14*Math.sin(a*3+seed+y*2.1)+.09*Math.cos(a*5-seed-y*3.6));
   p.setXYZ(i,x*lobe*1.38+.15*y,y*1.03+.10*band*Math.sin(a*4+seed),z*lobe*1.23);
   const shade=T.MathUtils.clamp(.30+.42*(y+1)*.5+.16*Math.sin(a*3+seed+y*4),.10,1),col=dark.clone().lerp(light,shade);colors.push(col.r,col.g,col.b);
  }
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();assets.add(g);return g;
 }
 const crowns=[canopy(.4),canopy(2.3),canopy(4.8)];
 // The office now occupies the old rear garden. Keep the complete crowns
 // beyond its rear wall, rather than only relocating their trunk origins.
 const rearTreeZ=OFFICE.maxZ+3.2;
 const trees=[[-10.7,-8.5,3.00],[-11.0,-1.6,3.40],[-10.2,5.5,2.92],[14.0,-6.1,3.28],[14.5,.3,2.93],[13.9,6.6,3.37],[-1.5,rearTreeZ,3.10],[7.0,rearTreeZ,3.50]];
 for(const [n,[x,z,top]]of trees.entries()){
  const tree=new T.Group();tree.name='courtyard-branched-tree';tree.position.set(x,0,z);tree.rotation.y=n*.61;room.add(tree);
  cylinder(branchMat,[0,top*.40-.055,0],[.080,top*.80+.11,.11],null,tree);
  for(let b=0;b<5;b++){const a=b*2.39996+n*.33,reach=.74+(b%2)*.18,ex=Math.sin(a)*reach,ez=Math.cos(a)*reach,ey=top-.36+(b%3)*.14;const curve=new T.CatmullRomCurve3([new T.Vector3(0,top*.53,0),new T.Vector3(ex*.40,top*.78,ez*.40),new T.Vector3(ex,ey,ez)]),g=new T.TubeGeometry(curve,4,.027,5,false);assets.add(g);mesh(g,branchMat,[0,0,0],[1,1,1],null,tree);}
  mesh(crowns[n%3],crownMat,[0,top,0],[1,1,1],null,tree);
  for(let k=0;k<16;k++){
   const a=k*2.39996+n*.37,y=-.50+(k%5)*.26,ring=Math.sqrt(Math.max(.08,1-y*y)),xx=Math.sin(a)*1.30*ring,zz=Math.cos(a)*1.16*ring;
   mesh(leafGeo,leafMat,[xx,top+y,zz],[1,1,1],[Math.sin(a)*.20,a,.25*Math.sin(k*1.7)],tree);
  }
 }

 let officeLocked=false,rearDoorClosed=false,drawerOpen=false,liftAmount=1,liftTarget=1;const drawerAmounts=new Map();
 // Retract the leading door edge inside its pocket. Stopping precisely at
 // the clear opening left its blue end face coplanar with the plaster reveal.
 const placeLiftDoors=()=>liftDoors.forEach((g,i)=>{g.position.x=9.35+(i===0?-1:1)*(.625+liftAmount*1.27);g.userData.openAmount=liftAmount;});placeLiftDoors();
 const setDoors=state=>{officeLocked=!!state?.officeLocked;rearDoorClosed=!!state?.rearDoorClosed;liftTarget=state?.elevator?.doorClosed?0:1;doors.get('rear').rotation.y=rearDoorClosed?0:-Math.PI/2;officeDoors.forEach((g,i)=>g.rotation.y=officeLocked?0:(i===0?-Math.PI/2:Math.PI/2));};
 setDoors({officeLocked:false,rearDoorClosed:false});
 enclosure.visible=false;
 return{enclosure,ceilingMaterial,ceilingRig,upperWalls,curtains,tiered,liftPanel,liftDoors,facades,doors,officeDoors,officeDrawer,officeDrawers,officeScreens,
  attachUpperArchitecture(){enclosure.add(ceilingRig,upperWalls);},
  getTargets(){return targets;},setDoors,
  setOfficeDrawer(open){drawerOpen=!!open;},
  setMap(map){const raised=mapKind(map)==='tiered';tiered.visible=raised;facades[0].visible=!raised;facades[1].visible=raised;ceilingRig.position.y=raised?TIERED_CEILING_HEIGHT-CEILING_HEIGHT:0;upperWalls.visible=raised;},
  update(state,dt=1/60){setDoors(state);const step=Math.max(0,Math.min(.1,dt));liftAmount+=Math.sign(liftTarget-liftAmount)*Math.min(Math.abs(liftTarget-liftAmount),step*2.5);placeLiftDoors();drawerOpen=!!(state?.officeDeskOpen??state?.office?.open??drawerOpen);const openById=new Map((state?.officeDrawers||[]).map(d=>[d.id,d.open]));for(const[id,drawer]of officeDrawers){const open=openById.has(id)?openById.get(id):id===OFFICE_DESK.id?drawerOpen:false,old=drawerAmounts.get(id)||0,amount=old+((open?1:0)-old)*(1-Math.exp(-step*14));drawerAmounts.set(id,amount);drawer.position.z=-.08-amount*.52;}},
  setNight(night){sky.color.set(night?'#0d172e':'#c9e8f5');officeLight.intensity=night?.12:6.5;lamp.emissiveIntensity=night?.01:.48;}
 };
}
