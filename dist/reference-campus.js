import {DORM_CORRIDOR_SOLIDS} from './dorm-layout70.js?v=campus-95';
import {createBoardInk} from './board-ink93.js?v=campus-93';
import {makeOfficeFloor,fitOfficeInterior,staffroomFinish} from './staff-office92.js?v=campus-101&rev=126';
import {cloneFurniture67,placeFurniture67} from './furniture-assets67.js?v=campus-99';
import {INTERACTION_SECONDS} from './item-rules50.js?v=campus-117';
import {createSchoolDoorMotion,copySchoolDoorMotion,setSchoolDoorTargets,advanceSchoolDoors,schoolDoorSnapshot} from './school-door-motion65.js?v=campus-92';
import * as T from './vendor/three.module.js';
import {createCampusWallProps} from './campus-wall-props54.js?v=campus-117&rev=126';
import {buildDesktop55} from './computer-hardware55.js?v=campus-117&rev=126';
import {surfaceHeight,drawBoardSurface,setWallSurfaceUV,addWallContact} from './surface-materials.js?v=campus-108';
import {createClassroomDaylight} from './classroom-daylight88.js?v=campus-117&rev=126';
import {CLASS_TURN,turnedClass,LIFT_ALCOVE,ALCOVE_ENTRY,ALCOVE_STORAGE,REAR_CLASS_CABINET,PARTITIONS,DOORS,LECTERN,ELEVATOR_ENABLED,CORRIDOR,campusFloor,CLASSROOM,CEILING_HEIGHT,TIERED_CEILING_HEIGHT,teachingRoomHeight,PODIUM,START_BELL_POSITION,ROLE_LOCKER,mapKind,floorTiles,floorHeight} from './classroom-layout.js?v=campus-117&rev=126';
import {OPEN_CAMPUS_MAPS} from './campus-destinations.js?v=campus-117&rev=126';
import {officeOffset,officePlan as OFFICE,liftPlan as LIFT,officeDeskPlans as OFFICE_DESKS,officeChairPlans as OFFICE_CHAIRS,officeBoardPlan as OFFICE_BOARD,officeShelfCenters,officeBinPlan} from './campus-ends.js?v=campus-101&rev=126';
const [OFFICE_DESK]=OFFICE_DESKS,[OFFICE_CHAIR]=OFFICE_CHAIRS;
// Editable architecture based on the observed classroom/corridor, not a flat photo.
export function buildReferenceCampus({room,scene,M,mat,box,rounded,cylinder,mesh,texture,assets,materials,floorMat,surfaces=null,artwork={},bakeStatic=()=>{}}){
 const classWidth=CLASSROOM.maxX-CLASSROOM.minX,classMidX=(CLASSROOM.minX+CLASSROOM.maxX)/2,westWallX=CLASSROOM.minX-.10,corridorWidth=CORRIDOR.maxX-CORRIDOR.minX,corridorLength=CORRIDOR.maxZ-CORRIDOR.minZ,corridorMidX=(CORRIDOR.minX+CORRIDOR.maxX)/2,corridorMidZ=(CORRIDOR.minZ+CORRIDOR.maxZ)/2,liftOffset=CORRIDOR.minZ-CLASSROOM.minZ;
 const enclosure=new T.Group();enclosure.name='classroom-cutaway-walls';scene.add(enclosure);
 const ends=new T.Group();ends.name='campus-end-rooms';enclosure.add(ends);
 const bellZ=START_BELL_POSITION.z;
 const plaster=surfaces?.wall||texture(512,512,(c,w,h)=>{c.fillStyle='#e9e7dc';c.fillRect(0,0,w,h);let seed=71;for(let i=0;i<9000;i++){seed=(seed*16807)%2147483647;const x=seed%w;seed=(seed*16807)%2147483647;const y=seed%h;c.fillStyle=i%3?'rgba(119,119,100,.025)':'rgba(255,255,245,.13)';c.fillRect(x,y,1+i%2,1);}});
 const blue=mat('#748e8f',{metalness:.12,roughness:.48}),edge=mat('#aabdbb',{metalness:.18,roughness:.49}),cream=mat(surfaces?'#f2eee2':'#f6eddb',{map:plaster,bumpMap:surfaces?surfaceHeight(plaster,assets):null,bumpScale:.0007,roughness:.86}),glass=mat('#a9d9ea',{transparent:true,opacity:.065,depthWrite:false,roughness:.10});
 const frostedGlass=mat('#a4d9eb',{transparent:true,opacity:.48,depthWrite:false,roughness:.55,metalness:0}),upperGlass=mat('#b2dce6',{transparent:true,opacity:.38,depthWrite:false,roughness:.38});
 const frameGroove=mat('#637a7b',{metalness:.10,roughness:.55}),frameLip=mat('#a6bfc4',{metalness:.18,roughness:.43}),windowCloth=mat('#3f706d',{side:T.DoubleSide,roughness:.95});
 const seal=mat('#455c5a',{roughness:.8}),recess=mat('#879b95',{roughness:.82}),doorPaint=mat('#c6d3d1',{roughness:.62}),skirting=mat('#667d6c',{roughness:.72});
 const wallGreen=mat('#e3e2d3',{roughness:.78});addWallContact(cream);addWallContact(wallGreen);
 const ceilingMaterial=new T.MeshStandardMaterial({color:'#dfd2c7',roughness:.93});materials.add(ceilingMaterial);
 const curtains=[],openings=[],hallLampCenters=[],sky=new T.MeshBasicMaterial({color:'#c9e8f5'});materials.add(sky);
 const facades=[new T.Group(),new T.Group(),new T.Group(),new T.Group()];facades[0].name='high-classroom-windows';facades[1].name='tiered-low-classroom-windows';scene.add(...facades);facades[2].name='toilet-clerestory-windows';facades[3].name='hotpot-window-piers';for(const facade of facades.slice(1))facade.visible=false;
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
  if(!vertical)x-=inward*.0163; // Horizontal rails sit in a separate glazing channel.
  const frame=mesh(frameSection,blue,[x,y,z],[.75,.70,length],null,parent);frame.rotation.y=inward<0?Math.PI:0;if(vertical)frame.rotateX(Math.PI/2);
  const dims=vertical?[.005,length,.020]:[.005,.020,length];B(frameGroove,[x+inward*.061,y,z],dims,parent);
  const lip=vertical?[.006,length,.007]:[.006,.007,length],p=vertical?[x+inward*.076,y,z-.028]:[x+inward*.076,y-.028,z];B(frameLip,p,lip,parent);
 }
 function strip(x,z,w,d,parent,base=true,topParent=parent){
  // Reveal the inner trim face in front of the wall instead of coplanar with it.
  const tx=Math.abs(x-westWallX)<.001?x+.028:Math.abs(x-7.30)<.001?x-.028:x;
  B(skirting,[tx,4.35,z],[w,.20,d],topParent);B(edge,[tx,4.47,z],[w,.035,d+.012],topParent);B(blue,[tx,4.235,z],[w,.035,d+.015],topParent);
  if(topParent===ceilingRig){
   // A pitched green face catches the daylight differently from its narrow
   // underside. It projects into the room below the pale ceiling lip.
   const side=d>w,length=side?d:w,toward=side?(x<0?1:-1):(z<0?1:-1);
   const section=new T.Shape();section.moveTo(0,0);section.lineTo(.09,0);
   section.lineTo(.13,.065);section.lineTo(.16,.16);section.lineTo(0,.16);section.closePath();
   const geo=new T.ExtrudeGeometry(section,{depth:length,bevelEnabled:false});geo.translate(0,0,-length/2);assets.add(geo);
   const cove=new T.Mesh(geo,skirting);cove.name='classroom-green-cornice';
   cove.rotation.y=side?(toward>0?0:Math.PI):-toward*Math.PI/2;
   cove.position.set(side?tx+toward*w*.47:tx,4.177,side?z:z+toward*d*.47);
   cove.receiveShadow=true;topParent.add(cove);
  }
  if(base){B(skirting,[tx,.065,z],[w,.13,d],parent);B(edge,[tx,.137,z],[w,.012,d+.006],parent);}
 }
 // Frames, recessed lower panels and a real upper aperture share the open leaf volume.
 function doorLeaf(parent,width,height,side=1,glazing=frostedGlass){
  const center=width/2,low=1.38,top=height-.12;
  B(doorPaint,[0,low/2,center],[.060,low,width],parent);
  for(const z of [.055,width-.055])B(doorPaint,[0,(low+top)/2,z],[.060,top-low,.11],parent);
  B(doorPaint,[0,height-.06,center],[.060,.12,width],parent);
  for(const x of [-.034,.034]){
   for(const z of [.018,width-.018])B(edge,[x,height/2,z],[.012,height,.036],parent);
   B(edge,[x,height-.02,center],[.012,.04,width],parent);B(edge,[x,.025,center],[.012,.05,width],parent);
   B(recess,[x,.55,center],[.014,.78,width-.22],parent);
   rounded(doorPaint,[x+Math.sign(x)*.009,.55,center],[.012,.69,width-.31],.006,null,parent);
   for(const z of [.112,width-.112])B(seal,[x,(low+top)/2,z],[.009,top-low,.016],parent);
   for(const y of [low,top])B(seal,[x,y,center],[.009,.018,width-.21],parent);
  }
  B(glazing,[0,(low+top)/2,center],[.010,top-low-.022,width-.24],parent);
  for(const y of [.40,1.46,2.49])B(edge,[0,y,.025],[.085,.095,.045],parent);
  for(const x of [-.058,.058]){rounded(seal,[x,1.08,width-.13],[.027,.20,.052],.007,null,parent);rounded(edge,[x+Math.sign(x)*.016,1.08,width-.13],[.035,.12,.027],.009,null,parent);}
 }
 function buildWindow(side,z,width,parent,top=3.83,bottom=1.10){
  const x=side===-1?westWallX:side===1?7.30:CORRIDOR.maxX+.10;
  const regular=side!==2&&(parent===facades[0]||parent===posterBay||parent===standardBay);
  if(regular)top=3.53;
  if(side!==2&&width>1.72){
   let start=z-width/2,end=z+width/2;
   for(const [sign,at] of [[-1,start],[1,end]]){
    // Pairs of sliding sashes share a thin central pier; the plaster columns
    // between pairs rise unbroken to the ceiling and take the wall notices.
    const bayJoint=Math.round((at-CLASSROOM.minZ)/bayDepth);
    const jamb=regular?Math.min(width*.16,side===1?.33:bayJoint%2===0?.38:.085):Math.min(side===1?.21:.155,width*.075);
    B(cream,[x,CEILING_HEIGHT/2,at-sign*jamb/2],[.165,CEILING_HEIGHT,jamb],parent);
    if(sign<0)start+=jamb;else end-=jamb;
   }
   z=(start+end)/2;width=end-start;
  }
  if(parent===facades[0]||parent===posterBay||side===2)openings.push({side,x,minZ:z-width/2,maxZ:z+width/2,bottom,top});
  const height=top-bottom,mid=(bottom+top)/2,inward=side===-1?1:-1,transom=top-.50;
  if(bottom>1.2){B(cream,[x,bottom/2,z],[.16,bottom,width],parent);}else B(wallGreen,[x,.54,z],[.16,1.08,width],parent);
  B(cream,[x,(top+CEILING_HEIGHT)/2,z],[.16,CEILING_HEIGHT-top,width],parent);
  for(const zz of [z-width/2,z,z+width/2])profile(x,mid,zz,height+.08,true,inward,parent);
  for(const y of [bottom,transom,top])profile(x,y,z,width+.11,false,inward,parent);
  // Two independently recessed lower sashes and two upper lights. Offset the
  // sliding tracks in depth so their overlap and seals are readable obliquely.
  for(const [bay,zz]of [z-width*.25,z+width*.25].entries())for(const [low,high,isTop]of [[bottom+.085,transom-.080,false],[transom+.085,top-.080,true]]){
   const paneWidth=width*.5-.16,paneHeight=high-low,cy=(low+high)/2,px=x+inward*(bay===0?.030:.004);
   // The old 43mm sash rails stopped 20mm short of the structural mullions.
   // Join the physical profiles; do not conceal the opening with extra glass.
   for(const edgeZ of [zz-paneWidth/2,zz+paneWidth/2]){B(blue,[px,cy,edgeZ],[.052,paneHeight+.10,.10],parent);B(frameLip,[px+inward*.030,cy,edgeZ-.037],[.007,paneHeight,.007],parent);}
   for(const y of [low,high])B(blue,[px-inward*.0025,y,zz],[.052,.10,paneWidth-.10],parent);
   const pane=B(side===1?(isTop?upperGlass:frostedGlass):glass,[px-inward*.010,cy,zz],[.012,paneHeight-.096,paneWidth-.096],parent);pane.castShadow=false;pane.name=side===1?'pale-blue-interior-pane':'clear-exterior-pane';
   if(!isTop){rounded(frameGroove,[px+inward*.052,cy-.07,zz+(bay===0?1:-1)*(paneWidth/2-.07)],[.030,.13,.022],.005,null,parent);for(const track of [-.025,.025])B(frameGroove,[x+inward*(.035+track),bottom+.034,zz],[.008,.008,paneWidth],parent);}
  }
  B(blue,[x+inward*.090,bottom-.070,z],[.30,.060,width+.16],parent);B(frameLip,[x+inward*.218,bottom-.055,z],[.035,.020,width+.16],parent);B(frameGroove,[x+inward*.095,bottom-.105,z],[.27,.012,width+.10],parent);
  // Sill end caps and sash fasteners have actual thickness, visible at the
  // player's low viewing angle. They never project beyond the current sill.
  for(const zz of[z-width/2-.06,z+width/2+.06]){
   rounded(edge,[x+inward*.09,bottom-.075,zz],[.28,.052,.025],.004,null,parent);
  }
  for(const zz of[z-width/2+.025,z+width/2-.025])for(const y of[bottom+.12,top-.12]){
   cylinder(edge,[x+inward*.081,y,zz],[.008,.005,.008],[0,0,Math.PI/2],parent);
  }
  if(top<3.2){
   B(blue,[x+inward*.020,top+.075,z],[.19,.115,width+.15],parent);
   B(frameGroove,[x+inward*.103,top+.070,z],[.012,.029,width+.12],parent);
   B(blue,[x+inward*.035,top+.160,z],[.225,.055,width+.19],parent);
   B(frameLip,[x+inward*.140,top+.191,z],[.018,.012,width+.19],parent);
   B(blue,[x+inward*.020,top+.216,z],[.19,.035,width+.15],parent);
  }
  if(side===-1&&bottom<1.5)for(const s of [-1,1]){
   const g=new T.PlaneGeometry(.37,height-.04,10,10);assets.add(g);const a=g.attributes.position;
   for(let i=0;i<a.count;i++)a.setZ(i,Math.cos(a.getX(i)*55)*.045);g.computeVertexNormals();
   const cloth=new T.Mesh(g,windowCloth);cloth.rotation.y=Math.PI/2;cloth.position.set(x+.19,mid,z+s*(width/2-.21));cloth.userData.animated=true;parent.add(cloth);curtains.push(cloth);
  }
 }
 function window(side,z,width=2.72,parent=room){
  if(side===2){buildWindow(side,z,width,parent);return;}
  // The two clear openings end against a common plaster pier bearing the print.
  if(side===-1&&Math.abs(Math.abs(z-noticeZ)-bayDepth/2)<.01){
   const direction=Math.sign(z-noticeZ),inset=.40;
   buildWindow(side,z+direction*inset/2,width-inset,posterBay);
   B(cream,[westWallX,wallY,z-direction*(width-inset)/2],[.20,wallHeight,inset],posterBay);
   buildWindow(side,z,width,standardBay);
  }else buildWindow(side,z,width,facades[0]);
  buildWindow(side,z,width,facades[1],2.95);
  if(side===-1){
   const inset=.52;buildWindow(side,z,width-2*inset,facades[3]);
   for(const sign of [-1,1])B(cream,[westWallX,CEILING_HEIGHT/2,z+sign*(width-inset)/2],[.17,CEILING_HEIGHT,inset],facades[3]);
  }else buildWindow(side,z,width,facades[3]);
  if(side===1){buildWindow(side,z,width,facades[2]);return;}
  const aperture=Math.min(1.42,width-.12),pier=(width-aperture)/2;
  for(const sign of [-1,1])B(cream,[westWallX,CEILING_HEIGHT/2,z+sign*(aperture+pier)/2],[.16,CEILING_HEIGHT,pier],facades[2]);
  buildWindow(side,z,aperture,facades[2],3.94,2.87);
 }
 // A shared physical floor is built at the larger dimensions. No existing prop
 // is stretched to enlarge the school; desks retain their original metre size.
 function floor(minX,maxX,minZ,maxZ,material=floorMat,parent=room){
  const x=(minX+maxX)/2,z=(minZ+maxZ)/2,g=new T.BoxGeometry(maxX-minX,.20,maxZ-minZ),p=g.attributes.position,u=g.attributes.uv;
  for(let i=0;i<p.count;i++)u.setXY(i,(p.getX(i)+x)/1.6,(p.getZ(i)+z)/1.6);assets.add(g);const surface=mesh(g,material,[x,-.10,z],[1,1,1],null,parent);surface.name='campus-continuous-floor';return surface;
 }
 floor(CLASSROOM.minX,CLASSROOM.maxX,CLASSROOM.minZ,CLASSROOM.maxZ);
 floor(CLASSROOM.maxX,CORRIDOR.maxX,CLASSROOM.minZ,CLASSROOM.maxZ,floorMat,enclosure);
 floor(CORRIDOR.minX,CORRIDOR.maxX,CORRIDOR.minZ,CLASSROOM.minZ,floorMat,enclosure);
 const wallHeight=4.51,wallY=wallHeight/2;
 // Exterior windows retain genuinely clear glazing and a visible courtyard.
 const bays=6,bayDepth=(CLASSROOM.maxZ-CLASSROOM.minZ)/bays,noticeZ=CLASSROOM.minZ+2*bayDepth;
 const posterBay=new T.Group(),standardBay=new T.Group();standardBay.visible=false;
 for(let i=0;i<bays;i++)window(-1,CLASSROOM.minZ+(i+.5)*bayDepth,bayDepth-.22);
 for(let i=0;i<=bays;i++){
  const center=CLASSROOM.minZ+i*bayDepth,lo=i===0?CLASSROOM.minZ-.20:center-.11,hi=i===bays?CLASSROOM.maxZ+.22:center+.11;
  B(cream,[westWallX,wallY,(lo+hi)/2],[.20,wallHeight,hi-lo]).name=i===0||i===bays?'classroom-exterior-end-pier':'classroom-exterior-window-pier';
 }
 strip(westWallX,-.59,.20,19.22,room,true,ceilingRig);
 // Pale blue internal panes read as glass without opening an unreal sightline
 // through every lower panel. Masonry sections include the interaction bell.
 for(const p of PARTITIONS){
  let spans=[[p.minZ,p.maxZ]];
  if(p.minZ<bellZ-.45&&p.maxZ>bellZ+.45){spans=[[p.minZ,bellZ-.45],[bellZ+.45,p.maxZ]];B(cream,[7.30,wallY,bellZ],[.20,wallHeight,.90],enclosure);}
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
  doors.set(d.id,leaf);targets.doors.push({id:d.id,object:leaf,point:new T.Vector3(7.30,1.30,d.center),duration:INTERACTION_SECONDS});
  B(edge,[7.30,.012,d.center],[.27,.024,1.60],enclosure);
 }
 // The numbered inspection-room door is part of the leaf, so it follows its
 // complete opening animation. It is only shown on the dormitory floor.
 const lockerBounds=REAR_CLASS_CABINET,cx=(lockerBounds.minX+lockerBounds.maxX)/2,cz=(lockerBounds.minZ+lockerBounds.maxZ)/2;
 const cabinetWidth=lockerBounds.maxX-lockerBounds.minX,cabinetDepth=lockerBounds.maxZ-lockerBounds.minZ;
 const teachingFixtures=new T.Group(),rearFixtures=new T.Group();
 const classroomCabinet=new T.Group();classroomCabinet.name='rear-class-cabinet';classroomCabinet.position.set(cx,0,cz);rearFixtures.add(classroomCabinet);
 const cabinetEnamel=mat('#deded9',{roughness:.51,metalness:.09});
 B(frameGroove,[0,.065,0],[cabinetWidth-.06,.13,cabinetDepth-.04],classroomCabinet);
 rounded(cabinetEnamel,[0,.78,0],[cabinetWidth-.014,1.31,cabinetDepth-.025],.008,null,classroomCabinet);
 for(const sign of [-1,1]){
  B(cabinetEnamel,[sign*cabinetWidth*.248,.78,cabinetDepth/2-.009],[cabinetWidth*.49,1.275,.018],classroomCabinet);
  rounded(edge,[sign*.048,.82,cabinetDepth/2+.004],[.018,.12,.02],.004,null,classroomCabinet);
 }
 B(M.wood,[0,1.452,0],[cabinetWidth,.036,cabinetDepth],classroomCabinet);
 const dormDoorNumber=new T.Group();dormDoorNumber.name='dorm-door-number';doors.get('rear').add(dormDoorNumber);dormDoorNumber.visible=false;
 const dormNumberMap=texture(256,256,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='#e8ede2';c.beginPath();c.arc(w/2,h/2,115,0,Math.PI*2);c.fill();c.strokeStyle='#7c918e';c.lineWidth=10;c.stroke();c.fillStyle='#49636a';c.font='bold 165px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('1',w/2,h/2+6);});
 const dormNumberMat=mat('#fff',{map:dormNumberMap,transparent:true,roughness:.84,depthWrite:false}),dormNumberGeo=new T.PlaneGeometry(.56,.56);assets.add(dormNumberGeo);
 for(const side of[-1,1])mesh(dormNumberGeo,dormNumberMat,[side*.041,2.12,-.8],[1,1,1],[0,side*Math.PI/2,0],dormDoorNumber);
 markDynamic(dormDoorNumber);
 // End walls, blackboards, teaching platform, wall trim and ceiling form a
 // continuous shell at exactly the same boundaries as walking/throw collisions.
 B(cream,[classMidX,wallY,-10.10],[classWidth,wallHeight,.20]).name='classroom-rear-end-wall';
 // The partition owns x=7.20..7.40 at this corner. Split the perpendicular
 // wall at that exact join instead of duplicating its visible end face.
 B(cream,[classMidX,wallY,8.91],[classWidth,wallHeight,.22],enclosure).name='classroom-front-end-wall';
 B(cream,[(OFFICE.minX+OFFICE.doorMinX)/2,wallY,8.914],[OFFICE.doorMinX-OFFICE.minX,wallHeight,.216],ends).name='office-entry-left-pier';
 B(wallGreen,[classMidX,.57,-9.983],[classWidth-.02,1.14,.025]);B(edge,[classMidX,1.145,-9.966],[classWidth-.02,.025,.030]);B(wallGreen,[classMidX,.57,8.785],[classWidth,1.14,.025],enclosure);B(edge,[classMidX,1.145,8.768],[classWidth,.025,.030],enclosure);
 strip(classMidX,-9.98,classWidth,.04,room,true,ceilingRig);strip(classMidX,8.78,classWidth,.04,enclosure,true,ceilingRig);
 const lesson=texture(1024,512,(c,w,h)=>drawBoardSurface(c,w,h,surfaces?.board));
 B(edge,[0,2.40,8.76],[7.50,2.18,.11],teachingFixtures).name='teaching-board-frame';
 B(mat('#fff',{map:lesson,roughness:.92}),[0,2.40,8.69],[7.36,2.05,.025],teachingFixtures);B(edge,[0,1.30,8.61],[7.55,.05,.20],teachingFixtures);
 const boardInk=createBoardInk({mat,texture}),chalkPlane=new T.PlaneGeometry(7.33,2.035);assets.add(chalkPlane);
 const frontInk=mesh(chalkPlane,boardInk.material,[0,2.40,8.675],[1,1,1],[0,Math.PI,0],teachingFixtures);frontInk.name='teaching-board-writing';frontInk.castShadow=false;
 const motto=texture(1536,164,(c,w,h)=>{
  c.fillStyle='#ae211a';c.font='bold 130px "PingFang SC","Microsoft YaHei",sans-serif';c.textAlign='center';c.textBaseline='middle';
  for(const [i,ch] of Array.from('立德树人追求卓越').entries())c.fillText(ch,(i+.56+(i>=4?.95:0))*w/9.05,h*.52);
 });
 const lettering=mat('#fff',{map:motto,transparent:true,alphaTest:.35,roughness:.88});
 const mottoGeometry=new T.PlaneGeometry(5.55,.54);assets.add(mottoGeometry);
 mesh(mottoGeometry,lettering,[0,3.73,8.748],[1,1,1],[0,Math.PI,0],teachingFixtures).name='front-wall-school-motto';
 const rearDisplays=new T.Group();rearDisplays.name='classroom-rear-display-group';
 rearDisplays.scale.set(.96,.94,1);rearDisplays.position.set(.16,.02,0);rearFixtures.add(rearDisplays);
 const poster=artwork.chalkNewspaper||texture(1024,512,(c,w,h)=>{drawBoardSurface(c,w,h,surfaces?.board);c.fillStyle='#eee6ba';c.textAlign='center';c.font='bold 66px "Kaiti SC",serif';c.fillText('迎接新世纪',w/2,105);c.strokeStyle='#c9d4b8';c.lineWidth=3;for(const x of [45,355,665]){c.strokeRect(x,160,280,300);c.font='30px "Kaiti SC",serif';c.fillText(['团结友爱','认真学习','文明班级'][(x-45)/310],x+140,220);for(let j=0;j<7;j++){c.fillStyle='#b5c7b3';c.fillRect(x+25,255+j*22,230-j%3*32,3);}}});
 // Recessed chalk surface, real corner joints and a hollow lower tray. Keep
 // the original wall position/extent; the detail does not alter navigation.
 B(frameGroove,[0,2.5,-9.958],[5.50,2.4,.046],rearDisplays);
 const newspaperMaterial=mat('#fff',{map:poster,roughness:.96});
 B(newspaperMaterial,[0,2.5,-9.925],[5.38,2.28,.012],rearDisplays);
 for(const x of[-2.735,2.735])rounded(edge,[x,2.5,-9.898],[.055,2.40,.07],.009,null,rearDisplays);
 for(const y of[1.32,3.68])rounded(edge,[0,y,-9.898],[5.43,.04,.07],.007,null,rearDisplays);
 B(frameGroove,[0,1.286,-9.82],[5.51,.018,.18],rearDisplays);
 rounded(edge,[0,1.276,-9.82],[5.56,.022,.20],.005,null,rearDisplays);
 rounded(edge,[0,1.302,-9.723],[5.56,.034,.014],.004,null,rearDisplays);
 for(const x of[-2.77,2.77])rounded(edge,[x,1.302,-9.82],[.026,.034,.20],.004,null,rearDisplays);
 // Pinned notices are individual slightly curled sheets, not painted
 // rectangles. A shared atlas keeps this at one paper draw after batching.
 const notices=[
  [38,35,240,180,'#e5b6a4','值日安排','一组  二组  三组'],
  [312,38,214,149,'#efdda7','课程表','星期一  星期二'],
  [583,55,208,255,'#e8e6da','班级公约','上课认真听讲'],
  [80,253,190,151,'#efe2b8','通知','周五班会'],
  [308,235,234,220,'#dde6d5','作息时间','早读  上午'],
  [585,362,175,230,'#e4e6dc','图书借阅','爱惜每一本书'],
  [784,343,134,230,'#d7e4dc','值周','保持整洁'],
  [88,448,210,142,'#cadfe0','本周活动','认真参与'],
  [326,484,210,108,'#eaddc4','失物招领','请到讲台领取']
 ];
 const noticeBoard=texture(960,640,(c,w,h)=>{
  c.clearRect(0,0,w,h);
  for(const [x,y,ww,hh,color,title,copy]of notices){
   c.fillStyle=color;c.fillRect(x,y,ww,hh);c.textAlign='center';c.fillStyle='#52665d';
   c.font=`bold ${Math.min(24,ww/6)}px "Kaiti SC",serif`;c.fillText(title,x+ww/2,y+29);
   c.font=`${Math.min(15,ww/9)}px "Songti SC",serif`;c.fillText(copy,x+ww/2,y+56);
   c.strokeStyle='#88958b';c.lineWidth=.8;
   for(let k=0;k<Math.floor((hh-76)/20);k++){c.beginPath();c.moveTo(x+15,y+77+k*20);c.lineTo(x+ww-15,y+77+k*20);c.stroke();}
  }
 });
 B(frameGroove,[-4.46,2.64,-9.965],[3.3,2.28,.07],rearDisplays);
 B(mat('#458e78',{roughness:1}),[-4.46,2.64,-9.92],[3.18,2.16,.022],rearDisplays);
 for(const x of[-6.09,-2.83])rounded(edge,[x,2.64,-9.898],[.045,2.28,.06],.006,null,rearDisplays);
 for(const y of[1.52,3.76])rounded(edge,[-4.46,y,-9.898],[3.22,.04,.06],.006,null,rearDisplays);
 const paperMaterial=mat('#ffffff',{map:noticeBoard,roughness:.96,side:T.DoubleSide});
 const pinMaterial=mat('#d0bb87',{metalness:.24,roughness:.38});
 for(const [i,[x,y,w,h]]of notices.entries()){
  const width=w/960*3.18,height=h/640*2.16,geo=new T.PlaneGeometry(width,height,4,6),p=geo.attributes.position,uv=geo.attributes.uv;
  for(let k=0;k<p.count;k++){
   const u=uv.getX(k),v=uv.getY(k),curl=(1-v)**3*(.004+.014*u*u)+(i%3-1)*.002*Math.sin(u*Math.PI)*(1-v);
   p.setZ(k,curl);uv.setXY(k,(x+u*w)/960,1-(y+(1-v)*h)/640);
  }
  geo.computeVertexNormals();assets.add(geo);
  const px=-4.46-1.59+(x+w/2)/960*3.18,py=2.64+1.08-(y+h/2)/640*2.16;
  const sheet=mesh(geo,paperMaterial,[px,py,-9.898],[1,1,1],null,rearDisplays);sheet.name='notice-paper-'+i;
  cylinder(pinMaterial,[px,py+height/2-.021,-9.882],[.012,.014,.012],[Math.PI/2,0,0],rearDisplays).name='notice-pin-'+i;
 }
 const framedArt=(name,image,w,h,p,yaw=0,parent=room,backing=M.white)=>{
  const group=new T.Group();group.name=name;group.position.set(...p);group.rotation.y=yaw;parent.add(group);
  B(blue,[0,0,0],[w+.07,h+.07,.035],group);
  B(backing,[0,0,.019],[w,h,.002],group);
  const face=new T.PlaneGeometry(w,h);assets.add(face);const material=mat('#ffffff',{map:image,transparent:true,depthWrite:false,roughness:.85});
  mesh(face,material,[0,0,.022],[1,1,1],null,group);return group;
 };
 // The hotpot print sits on a full pier between the outside windows.
 if(artwork.hotpotVegetables)framedArt('hotpot-vegetables-print',artwork.hotpotVegetables,.92,1.38,[CLASSROOM.minX+.023,2.22,CLASSROOM.minZ+2*bayDepth],Math.PI/2,facades[3]);
 // To a pupil facing +Z, the bulletin is on the right of the teaching board.
 framedArt('front-class-notices',noticeBoard,2.18,1.72,[-5.02,2.64,8.744],Math.PI,teachingFixtures,mat('#458775',{roughness:.91}));
 if(artwork.classroomNotice){
  const paper=mat('#ffffff',{map:artwork.classroomNotice,roughness:.98});
  function wallPrint(name,tile,w,h,position,yaw,parent){
   const g=new T.PlaneGeometry(w,h),uv=g.attributes.uv;assets.add(g);
   for(let i=0;i<uv.count;i++)uv.setXY(i,(tile+.01+uv.getX(i)*.98)/3,.008+uv.getY(i)*.984);
   mesh(g,paper,position,[1,1,1],[0,yaw,0],parent).name=name;
  }
  wallPrint('classroom-pillar-notice',0,.71,1.16,[7.185,2.44,bellZ],-Math.PI/2,posterBay);
  wallPrint('classroom-window-notice',1,.71,1.16,[westWallX+.107,2.44,noticeZ],Math.PI/2,posterBay);
  wallPrint('corridor-conduct-poster',2,.70,.99,[7.407,2.30,DOORS.find(d=>d.id==='front').maxZ+.60],Math.PI/2,enclosure);
 }
 const award=artwork.classroomAward||texture(768,512,(c,w,h)=>{
  c.fillStyle='#ead4a1';c.fillRect(0,0,w,h);c.strokeStyle='#bd473b';c.lineWidth=16;c.strokeRect(14,14,w-28,h-28);c.lineWidth=3;c.strokeRect(37,37,w-74,h-74);c.fillStyle='#b43f33';c.textAlign='center';c.font='bold 90px "Kaiti SC",serif';c.fillText('奖 状',w/2,147);c.fillStyle='#66513c';c.font='41px "Kaiti SC",serif';c.fillText('文明班级',w/2,268);c.font='27px "Kaiti SC",serif';c.fillText('团结 · 友爱 · 进步',w/2,345);c.strokeStyle='#b43f33';c.lineWidth=4;c.beginPath();c.arc(621,415,45,0,Math.PI*2);c.stroke();c.font='20px sans-serif';c.fillText('学校',621,422);
 });
 const awardMaterial=mat('#ffffff',{map:award,roughness:.92}),awardGeometry=new T.PlaneGeometry(.89,.593);assets.add(awardGeometry);
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){
  const sheet=mesh(awardGeometry,awardMaterial,[3.20+col*.94,3.00-row*.63,-9.94],[1,1,1],null,rearDisplays);sheet.name='classroom-red-award';
 }
 const campusWallProps=createCampusWallProps({parent:enclosure,mat,box,rounded,mesh,assets});
 // Two independent generated chalk decals, following the visible margin-doodle
 // treatment in steam-09 and the user's exact wording. Keep them below sills.
 for(const [key,name,z,width,ratio] of [
  ['graffitiSnack','classroom-graffiti-snack',4.8,.72,1],
  ['graffitiHomework','classroom-graffiti-homework',1.6,.78,1295/1214]
 ])if(artwork[key]){
  const geo=new T.PlaneGeometry(width,width/ratio);assets.add(geo);
  const material=mat('#ffffff',{map:artwork[key],transparent:true,opacity:.62,depthWrite:false,roughness:1});
  const decal=mesh(geo,material,[CLASSROOM.minX+.015,.60,z],[1,1,1],[0,Math.PI/2,0],room);decal.name=name;
 }
 const woodGrain=texture(1024,256,(c,w,h)=>{c.fillStyle='#e1cfac';c.fillRect(0,0,w,h);for(let i=0;i<150;i++){const y=i*59%h;c.strokeStyle=i%3?'rgba(80,40,18,.07)':'rgba(255,249,220,.18)';c.lineWidth=.5+i%3*.3;c.beginPath();for(let x=0;x<=w;x+=16){const yy=y+Math.sin(x*.009+i*.5)*(1+i%6)+Math.sin(x*.022+i)*1.5;x?c.lineTo(x,yy):c.moveTo(x,yy);}c.stroke();}});
 woodGrain.wrapS=woodGrain.wrapT=T.RepeatWrapping;
 const officePlanks=texture(1024,1024,(c,w,h)=>{c.fillStyle='#c1a47c';c.fillRect(0,0,w,h);for(let row=0;row<8;row++){const y=row*128;c.fillStyle=['#c8ac84','#cbb18b','#bfa27c','#d0b58f'][row%4];c.fillRect(0,y,w,127);for(let line=0;line<27;line++){c.strokeStyle=line%3?'rgba(83,53,24,.045)':'rgba(255,240,198,.12)';c.lineWidth=1;c.beginPath();for(let x=0;x<=w;x+=16){const yy=y+3+line*4.55+Math.sin(x*.013+line+row)*1.4;x?c.lineTo(x,yy):c.moveTo(x,yy);}c.stroke();}c.fillStyle='rgba(65,48,28,.25)';c.fillRect(0,y,w,1.2);for(let cut=0;cut<2;cut++){const x=(row%2?256:0)+cut*512;c.fillRect(x,y,1.4,128);}}});officePlanks.wrapS=officePlanks.wrapT=T.RepeatWrapping;
 const officeWood=mat('#a56847',{map:woodGrain,roughness:.62}),darkWood=mat('#73503b',{map:woodGrain,roughness:.72}),cabinetPaint=mat('#b6cbc4',{roughness:.58}),cabinetBack=mat('#687b75',{roughness:.82}),boards=mat(surfaces?.veneer?'#eddbc5':'#d5a66a',{map:surfaces?.veneer||woodGrain,roughness:.53}),officeFloor=mat('#ead8bc',{map:surfaces?.officeOak||officePlanks,vertexColors:true,roughness:.68});
 const podiumDepth=PODIUM.back-PODIUM.front,podiumZ=(PODIUM.front+PODIUM.back)/2;
 B(boards,[0,PODIUM.height/2,podiumZ],[2*PODIUM.halfWidth,PODIUM.height,podiumDepth],teachingFixtures);
 B(boards,[0,PODIUM.height/4,PODIUM.front-PODIUM.tread/2],[2*(PODIUM.halfWidth+PODIUM.tread),PODIUM.height/2,PODIUM.tread],teachingFixtures);
 for(const side of [-1,1])B(boards,[side*(PODIUM.halfWidth+PODIUM.tread/2),PODIUM.height/4,podiumZ],[PODIUM.tread,PODIUM.height/2,podiumDepth],teachingFixtures);
 // Rounded stair lip and flush staggered boards share the physical platform.
 const stageGrain=mat('#dbc29d',{map:officePlanks,roughness:.55});
 const stageGeo=new T.PlaneGeometry(PODIUM.halfWidth*2-.025,podiumDepth-.018);
 const suv=stageGeo.attributes.uv;
 for(let i=0;i<suv.count;i++)suv.setXY(i,suv.getX(i)*2.55,suv.getY(i)*1.17);
 assets.add(stageGeo);mesh(stageGeo,stageGrain,[0,PODIUM.height+.0015,podiumZ],[1,1,1],[-Math.PI/2,0,0],teachingFixtures);
 rounded(boards,[0,PODIUM.height-.015,PODIUM.front+.008],[2*PODIUM.halfWidth,.036,.038],.006,null,teachingFixtures);
 const lx=(LECTERN.minX+LECTERN.maxX)/2,lz=(LECTERN.minZ+LECTERN.maxZ)/2;if(!placeFurniture67(teachingFixtures,'cabinet',lx,0,lz)){rounded(M.wood,[lx,1.11,lz],[1.35,.075,.82],.022,null,teachingFixtures);rounded(cream,[lx,.65,lz+.07],[1.22,.87,.60],.016,null,teachingFixtures);B(edge,[lx,.23,lz+.05],[1.24,.055,.63],teachingFixtures);}
 // Only the section beside the lift is glazed. The remaining wall is solid,
 // as in the supplied walkthrough; its physical outer boundary never opens.
 const corridorSkin=new T.Group();corridorSkin.name='ordinary-corridor-skin';
 const corridorLowerPanels=new T.Group();corridorLowerPanels.name='corridor-lower-wall-panels';
 const entry=ALCOVE_ENTRY;
 const corridorWallX=CORRIDOR.maxX+.10,outerWindowZ=CORRIDOR.minZ+3.7;
 for(const [lo,hi]of [[CORRIDOR.minZ-.20,outerWindowZ-1.59],[outerWindowZ+1.59,CORRIDOR.maxZ+.20]]){
  const length=hi-lo,z=(lo+hi)/2;
  B(cream,[corridorWallX,wallY,z],[.20,wallHeight,length],corridorSkin).name='corridor-solid-outer-wall';
  B(wallGreen,[CORRIDOR.maxX-.014,.57,z],[.025,1.14,length],corridorLowerPanels);
  B(edge,[CORRIDOR.maxX-.032,1.145,z],[.030,.025,length],corridorLowerPanels);
 }
 window(2,outerWindowZ,2.95,corridorSkin);
 for(const z of[outerWindowZ-1.5325,outerWindowZ+1.5325])B(cream,[corridorWallX,wallY,z],[.20,wallHeight,.115],corridorSkin);
 strip(CORRIDOR.maxX-.025,corridorMidZ,.05,corridorLength,corridorSkin);
 for(const [lo,hi] of [[CORRIDOR.minZ-.20,entry.minZ],[entry.maxZ,CLASSROOM.minZ-.20]]){
  const z=(lo+hi)/2,length=hi-lo;
  B(cream,[7.30,wallY,z],[.20,wallHeight,length],corridorSkin).name='corridor-extension-inner-wall';
  B(wallGreen,[7.415,.57,z],[.025,1.14,length],corridorLowerPanels);
  B(edge,[7.432,1.145,z],[.030,.025,length],corridorLowerPanels);
  strip(7.425,z,.05,length,corridorSkin);
 }
 B(cream,[entry.wallX-.10,(entry.height+wallHeight)/2,(entry.minZ+entry.maxZ)/2],
  [.20,wallHeight-entry.height,entry.maxZ-entry.minZ],corridorSkin);
 B(cream,[(OFFICE.doorMaxX+CORRIDOR.maxX)/2,wallY,8.91],[CORRIDOR.maxX-OFFICE.doorMaxX,wallHeight,.22],ends).name='office-entry-right-pier';
 B(cream,[(CORRIDOR.minX+LIFT.minX)/2,wallY,CORRIDOR.minZ-.10],[LIFT.minX-CORRIDOR.minX,wallHeight,.20],ends).name='lift-entry-left-pier';
 // The bay opens off the inner wall past the end of the classroom.
 const bay=LIFT_ALCOVE,bayMidX=(bay.minX+bay.maxX)/2,bayMidZ=(bay.minZ+bay.maxZ)/2;
 const alcoveDepth=bay.maxZ-bay.minZ,bayWidth=bay.maxX-bay.minX;
 const bayPlaster=mat('#d3cdb9',{map:plaster,roughness:.97,vertexColors:true}),baySkirt=mat('#69796a',{roughness:.91,vertexColors:true});
 const bayFloor=mat('#cbc7b8',{map:floorMat.map,roughness:.93,vertexColors:true});
 floor(bay.minX,bay.maxX,bay.minZ,bay.maxZ,bayFloor,corridorSkin);
 B(bayPlaster,[bay.minX-.10,entry.height/2,bayMidZ],[.20,entry.height,alcoveDepth],corridorSkin);
 for(const sign of [-1,1]){
  const sideZ=sign<0?bay.minZ:bay.maxZ;
  B(bayPlaster,[bayMidX-.10,entry.height/2,sideZ+sign*.10],[bayWidth-.20,entry.height,.20],corridorSkin);
  B(baySkirt,[bayMidX,.08,sideZ-sign*.012],[bayWidth,.16,.024],corridorSkin);
 }
 B(bayPlaster,[bayMidX-.10,entry.height+.08,bayMidZ],[bayWidth-.20,.16,alcoveDepth],corridorSkin);
 for(const part of corridorSkin.children.filter(o=>o.isMesh&&[bayPlaster,bayFloor,baySkirt].includes(o.material))){
  // Local bounce from the opening falls off toward the blind end. Shared
  // unit boxes must keep their original colours for the rest of the building.
  const geo=part.geometry.clone();assets.add(geo);part.geometry=geo;part.updateMatrix();
  const verts=geo.attributes.position,colors=[],v=new T.Vector3();
  for(let i=0;i<verts.count;i++){
   v.fromBufferAttribute(verts,i).applyMatrix4(part.matrix);
   const distance=Math.hypot(v.x-entry.wallX,v.z-bayMidZ);
   const light=.16+.80*Math.exp(-.46*distance);
   colors.push(light,light*.975,light*.925);
  }
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 }
 // A short feathered throat and an unlit black back keep the recess dark
 // even when direct sun enters the hall. The fade is fixed to the opening.
 const darknessGeo=new T.BufferGeometry(),points=[],uvs=[],indices=[];
 for(const [depth,inset] of [[0,0],[1.10,.145]]){
  const z0=entry.minZ+inset,z1=entry.maxZ-inset,y0=.012+inset,y1=entry.height-.012-inset;
  for(const [z,y] of [[z0,y0],[z1,y0],[z1,y1],[z0,y1]]){
   points.push(entry.wallX-depth,y,z);uvs.push(0,depth/1.10);
  }
 }
 for(let i=0;i<4;i++){const j=(i+1)%4;indices.push(i,j,j+4,i,j+4,i+4);}
 indices.push(4,5,6,4,6,7);
 darknessGeo.setAttribute('position',new T.Float32BufferAttribute(points,3));
 darknessGeo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));darknessGeo.setIndex(indices);assets.add(darknessGeo);
 const darknessMat=new T.ShaderMaterial({
  transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,toneMapped:false,
  vertexShader:'varying float depth; void main(){depth=uv.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'varying float depth; void main(){gl_FragColor=vec4(0.0,0.0,0.0,smoothstep(0.0,0.78,depth));}'
 });
 materials.add(darknessMat);
 const darkness=new T.Mesh(darknessGeo,darknessMat);darkness.name='lift-alcove-darkness';
 darkness.renderOrder=4;
 B(cream,[(LIFT.maxX+CORRIDOR.maxX)/2,wallY,CORRIDOR.minZ-.10],[CORRIDOR.maxX-LIFT.maxX,wallHeight,.20],ends).name='lift-entry-right-pier';

 // The dorm has room doors on both sides. Mount the chalk drawing on the
 // full-height wall between the lift and room 1, above the corridor stripe.
 const dormTutorialWall=DORM_CORRIDOR_SOLIDS.find(wall=>wall.id==='dorm-hall-left-1');
 let studentTutorial=null;
 if(artwork.studentTutorial){
  const tutorial=new T.Group();tutorial.name='corridor-student-tutorial';tutorial.position.set(CORRIDOR.maxX-.004,2.05,CORRIDOR.maxZ-6.8);tutorial.rotation.y=-Math.PI/2;scene.add(tutorial);studentTutorial=tutorial;
  const geo=new T.PlaneGeometry(5.2,2.6);assets.add(geo);
  mesh(geo,mat('#ffffff',{map:artwork.studentTutorial,transparent:true,depthWrite:false,roughness:.96}),[0,0,0],[1,1,1],null,tutorial);
 }
 const phone=new T.Group();phone.name='corridor-green-wall-phone';phone.position.set(CORRIDOR.maxX-.02,1.43,ROLE_LOCKER.z-1.42);phone.rotation.y=-Math.PI/2;enclosure.add(phone);
 const phoneGreen=mat('#457659',{roughness:.65}),receiver=mat('#304b39',{roughness:.63});
 rounded(phoneGreen,[0,0,.055],[.34,.46,.105],.025,null,phone);
 rounded(receiver,[-.094,0,.132],[.047,.27,.045],.020,null,phone);
 for(const y of [-.147,.147])rounded(receiver,[-.094,y,.135],[.098,.073,.074],.024,null,phone);
 B(cabinetBack,[.047,.119,.113],[.124,.058,.01],phone);
 for(let row=0;row<4;row++)for(let col=0;col<3;col++)B(edge,[.012+col*.035,.053-row*.035,.116],[.023,.019,.009],phone);
 tube([[-.096,-.168,.14],[-.115,-.29,.13],[-.065,-.32,.10],[-.025,-.21,.08]],.009,receiver,phone);
 const clutter=new T.Group();clutter.name='recessed-hall-storage';clutter.position.set(ALCOVE_STORAGE.x,0,ALCOVE_STORAGE.z);corridorSkin.add(clutter);
 const cardboard=mat('#716246',{roughness:.98});for(const [x,y,z,w,h,d]of [[0,.35,0,.64,.70,.64],[-.03,.95,.05,.58,.50,.58],[.03,1.36,.08,.50,.32,.50]]){B(cardboard,[x,y,z],[w,h,d],clutter);B(darkWood,[x,y+h/2+.003,z],[w,.006,.04],clutter);}
 for(let i=0;i<3;i++){cylinder(boards,[-.21+i*.13,1.01,-.26],[.017,1.95,.017],[0,0,-.05+i*.045],clutter);B(cabinetBack,[-.21+i*.13,.12,-.26],[.13,.15,.08],clutter);}
 // Office shares the north wall with the classroom and can actually be entered.
 const office=new T.Group();office.name='walkable-teacher-office';ends.add(office);
 makeOfficeFloor(officeFloor,assets,mesh,office);
 const officeWidth=OFFICE.maxX-OFFICE.minX,officeMidX=(OFFICE.minX+OFFICE.maxX)/2,officeStart=CLASSROOM.maxZ,officeEnd=OFFICE.maxZ+.20,officeDepth=officeEnd-officeStart,officeMidZ=(officeStart+officeEnd)/2;
 const officeDay={value:true};
 const officePaint=staffroomFinish(mat('#c3bda7',{map:plaster,roughness:.91}),'wall',officeDay);
 const officeCeiling=staffroomFinish(mat('#c6c5b7',{roughness:.95}),'ceiling',officeDay);
 for(const x of[OFFICE.minX-.10,OFFICE.maxX+.10])B(officePaint,[x,wallY,officeMidZ],[.20,wallHeight,officeDepth],office);
 const officeGlazing=fitOfficeInterior({parent:office,B,rounded,mat,mesh,texture,assets,clock:campusWallProps.clock,cream:officePaint,edge,blue,skirting:mat('#385647',{roughness:.87}),cabinetPaint,cabinetBack,seal,wood:officeWood,paper:M.paper,blackboard:mat('#29453a',{map:surfaces?.board,roughness:.96}),glass});
 for(const x of [OFFICE.doorMinX,OFFICE.doorMaxX])B(blue,[x,1.54,8.91],[.06,3.08,.25],office);B(blue,[OFFICE.doorX,3.07,8.91],[1.86,.06,.25],office);B(cream,[OFFICE.doorX,3.82,8.91],[1.80,1.38,.22],office);
 const officeDoors=[];for(const [i,x]of [OFFICE.doorMinX,OFFICE.doorMaxX].entries()){
  const hinge=new T.Group();hinge.name='office-countdown-door';hinge.position.set(x,0,8.91);const panel=new T.Group();panel.rotation.y=i===0?Math.PI/2:-Math.PI/2;hinge.add(panel);doorLeaf(panel,.90,3.02,1,officeGlazing);office.add(hinge);markDynamic(hinge);officeDoors.push(hinge);hinge.traverse(o=>{if(o.isMesh)o.userData.campusTarget={type:'door',id:'office'};});targets.doors.push({id:'office',object:hinge,point:new T.Vector3(x,1.30,8.91),duration:INTERACTION_SECONDS});
 }
 const books=['#754438','#344758','#a28b53','#526951','#adac93','#615569'].map(c=>mat(c,{roughness:.83}));
 for(const z of officeShelfCenters){
  B(darkWood,[OFFICE.minX+.08,1.4,z],[.06,2.78,2.32],office);for(const zz of [z-1.13,z+1.13])B(officeWood,[OFFICE.minX+.35,1.4,zz],[.60,2.78,.06],office);
  for(let r=0;r<=4;r++){const y=.79+r*.49;B(officeWood,[OFFICE.minX+.35,y,z],[.60,.045,2.32],office);if(r===4)continue;
   for(let n=0;n<15;n++){if((r*13+n*7+Math.round(z))%19===0)continue;const h=.26+(n*7+r)%6*.029,zz=z-1+n*.14;
    const book=B(books[(n*5+r+Math.round(z))%6],[OFFICE.minX+.415,y+h/2+.026,zz],[.31,h,.095+(n%3)*.012],office);book.rotation.x=((n+2*r)%9===0?.07:0);
    if(n%3!==0)B(M.paper,[OFFICE.minX+.574,y+h*.66,zz],[.008,.035,.069],office);
   }
  }
  for(const side of [-1,1]){const zz=z+side*.55;B(officeWood,[OFFICE.minX+.63,.41,zz],[.062,.73,1.07],office);B(darkWood,[OFFICE.minX+.668,.41,zz],[.018,.57,.86],office);B(edge,[OFFICE.minX+.695,.57,zz-side*.34],[.033,.085,.019],office);}

 }
 // The lunch drawer slides out as a whole tray; target meshes survive static
 // geometry baking so interaction follows the visible drawer, not a hidden box.
 const desk=new T.Group();desk.name='office-openable-lunch-desk';desk.position.set(OFFICE_DESK.x,0,OFFICE_DESK.z);desk.rotation.y=OFFICE_DESK.yaw;office.add(desk);
 function addOfficeBody(table){
  const imported=cloneFurniture67('office-desk');
  if(imported){table.add(imported);const front=imported.getObjectByName('office-desk-drawer-front');front?.removeFromParent();return front;}
  rounded(officeWood,[0,.94,0],[2.20,.09,1.02],.018,null,table);for(const x of[-.89,.89]){B(darkWood,[x,.46,.06],[.30,.86,.87],table);B(seal,[x,.04,.06],[.29,.08,.84],table);}B(darkWood,[0,.58,.44],[1.55,.60,.04],table);return null;
 }
 const importedFront=addOfficeBody(desk);
 const officeDrawer=new T.Group();officeDrawer.name='teacher-lunch-drawer';officeDrawer.position.set(0,.67,-.08);desk.add(officeDrawer);
 if(importedFront){
  officeDrawer.add(importedFront);importedFront.position.sub(officeDrawer.position);
  B(darkWood,[-.255,.055,0],[1.065,.022,.70],officeDrawer);
  for(const x of[-.79,.28])B(officeWood,[x,.135,0],[.018,.14,.70],officeDrawer);
  B(officeWood,[-.255,.135,.34],[1.065,.14,.018],officeDrawer);
  officeDrawer.userData.itemFloor=.737;officeDrawer.userData.itemX=-.255;
  officeDrawer.userData.handTarget={floor:.744,lip:.905,width:1.04,depth:.68,x:-.255};
 }else{
  B(darkWood,[0,-.12,0],[1.44,.04,.76],officeDrawer);for(const x of[-.72,.72])B(officeWood,[x,.01,0],[.035,.25,.76],officeDrawer);B(officeWood,[0,.01,.37],[1.45,.25,.035],officeDrawer);rounded(officeWood,[0,.01,-.39],[1.52,.28,.055],.006,null,officeDrawer);rounded(edge,[0,.04,-.43],[.24,.025,.035],.006,null,officeDrawer);
 }
 markDynamic(desk);desk.traverse(o=>{if(o.isMesh)o.userData.campusTarget={type:'officeDesk',id:OFFICE_DESK.id};});
 function drawerPoint(plan){const p=officeOffset(plan,0,-.45);return new T.Vector3(p.x,.98,p.z);}
 targets.officeDesks.push({id:OFFICE_DESK.id,object:desk,drawer:officeDrawer,itemParent:officeDrawer,point:drawerPoint(OFFICE_DESK)});
 const officeDrawers=new Map([[OFFICE_DESK.id,officeDrawer]]);
 const mobileBoard=new T.Group();mobileBoard.name='office-mobile-board';mobileBoard.position.set(OFFICE_BOARD.x,0,OFFICE_BOARD.z);office.add(mobileBoard);B(edge,[0,1.78,0],[2.70,1.40,.06],mobileBoard);B(M.white,[0,1.78,-.038],[2.61,1.31,.016],mobileBoard);if(artwork.teacherTutorial){const tutorialGeo=new T.PlaneGeometry(2.54,1.27);assets.add(tutorialGeo);const tutorial=mesh(tutorialGeo,mat('#fff',{map:artwork.teacherTutorial,transparent:true,depthWrite:false,roughness:.82}),[0,1.78,-.050],[1,1,1],[0,Math.PI,0],mobileBoard);tutorial.name='teacher-tutorial-whiteboard';}for(const x of[-1.20,1.20]){B(edge,[x,1.14,0],[.04,2.20,.04],mobileBoard);rounded(edge,[x,.10,0],[.06,.045,.70],.008,null,mobileBoard);for(const z of[-.28,.28])cylinder(seal,[x,.045,z],[.045,.027,.045],[0,0,Math.PI/2],mobileBoard);}B(edge,[0,1.06,-.10],[2.60,.025,.16],mobileBoard);
 // Keep one exercise book and a single pen on the office desk, just as the
 // classroom surface does. The lunch is created by the item system inside.
 rounded(M.paper,[.55,1.005,.08],[.37,.035,.29],.005,[0,.12,0],desk);cylinder(blue,[.22,1.004,-.06],[.006,.18,.006],[0,0,Math.PI/2],desk);
 const officeScreens=new Map();
 for(const d of OFFICE_DESKS){
  let table=desk;
  if(d!==OFFICE_DESK){table=new T.Group();table.name=d.id;table.position.set(d.x,0,d.z);table.rotation.y=d.yaw;office.add(table);addOfficeBody(table);rounded(M.paper,[.55,1.005,.08],[.37,.035,.29],.005,[0,.12,0],table);cylinder(blue,[.22,1.004,-.06],[.006,.18,.006],[0,0,Math.PI/2],table);
   const drawer=officeDrawer.clone(true);drawer.name=d.id+'-drawer';table.add(drawer);officeDrawers.set(d.id,drawer);markDynamic(table);table.traverse(o=>{if(o.isMesh)o.userData.campusTarget={type:'officeDesk',id:d.id};});targets.officeDesks.push({id:d.id,object:table,drawer,itemParent:drawer,point:drawerPoint(d)});
  }
  const computer=buildDesktop55({parent:table,box,rounded,mat,x:-.42,y:.985,z:0,id:d.id+'-computer',bakeStatic});assets.add(computer.screen.geometry);materials.add(computer.screen.material);officeScreens.set(d.id,computer.screen);
 }
 function tube(points,radius,material,parent){const g=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'centripetal'),points.length*5,radius,8,false);assets.add(g);return mesh(g,material,[0,0,0],[1,1,1],null,parent);}
 const upholstery=mat('#363e3e',{roughness:.87}),chairMetal=mat('#8d9898',{metalness:.65,roughness:.34});
 for(const c of OFFICE_CHAIRS){const chair=new T.Group();chair.name=c===OFFICE_CHAIR?'office-sittable-chair':c.id;chair.position.set(c.x,0,c.z);chair.rotation.y=c.yaw;office.add(chair);
 if(!placeFurniture67(chair,'office-chair')){
 rounded(upholstery,[0,.485,0],[.70,.075,.55],.025,null,chair);rounded(upholstery,[0,.89,-.29],[.65,.45,.08],.022,[-.08,0,0],chair);
 for(const x of [-.29,.29]){tube([[x,.04,.34],[x,.04,-.30],[x,.10,-.34],[x,.48,-.28],[x,1.08,-.32]],.018,chairMetal,chair);tube([[x,.46,-.25],[x,.46,.24],[x,.39,.27],[x,.04,.34]],.018,chairMetal,chair);for(const z of [-.30,.34])rounded(seal,[x,.02,z],[.065,.04,.066],.010,null,chair);}
 }
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
 markDynamic(locker);locker.traverse(o=>{if(o.isMesh)o.userData.campusTarget={type:'locker',id:'role'};});targets.lockers.push({id:'role',object:locker,point:new T.Vector3(ROLE_LOCKER.x-.44,1.2,ROLE_LOCKER.z)});
 // The lift exposes the open floors. The server chooses the destination;
 // changing floors never randomly changes the building's room arrangement.
 const lift=new T.Group();lift.name='campus-lift';lift.position.z=liftOffset;ends.add(lift);
 const steelFinish=texture(256,192,(c,w,h)=>{
  const wash=c.createLinearGradient(0,0,w,h*.28);
  for(const [stop,color] of [[0,'#d1d8db'],[.28,'#edf1ef'],[.56,'#dce5e6'],[1,'#c3d0d5']])wash.addColorStop(stop,color);
  c.fillStyle=wash;c.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=2){c.fillStyle=y%7<3?'rgba(255,255,255,.04)':'rgba(33,51,68,.025)';c.fillRect(0,y,w,1);}
 });
 const liftBlue=mat('#647e95',{map:steelFinish,metalness:.16,roughness:.60});
 const liftInset=mat('#536c80',{map:steelFinish,metalness:.12,roughness:.63});
 floor(LIFT.minX,LIFT.maxX,LIFT.minZ-liftOffset,CLASSROOM.minZ,liftBlue,lift);
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
 const leafSections=[];
 const liftDoors=[-1,1].map(side=>{const g=new T.Group();g.name=side<0?'lift-door-left':'lift-door-right';g.position.set(9.35+side*.625,0,-10.10);lift.add(g);for(let rank=0;rank<2;rank++){
   const z=rank*.052,base=side*(rank-.5)*.625;
   const meshes=[B(liftBlue,[base,1.56,z],[.625,3.08,.045],g),B(liftInset,[base,1.57,z-.028],[.566,2.95,.010],g),B(edge,[base-side*.301,1.56,z-.035],[.019,3.03,.010],g)];
   for(const part of meshes)leafSections.push({part,x:part.position.x,travel:side*(rank===0?1.27:.645)});
  }
  markDynamic(g);return g;});
 for(const x of [8.73,9.97]){B(liftInset,[x,1.57,-12.99],[1.18,2.94,.018],lift);B(edge,[x+.575,1.57,-12.975],[.018,2.92,.01],lift);}for(const x of [8.125,10.575])B(edge,[x,1.02,-11.6],[.03,.04,2.1],lift);
 const liftPanel=new T.Group();liftPanel.name='floor-selection';liftPanel.position.set(8.13,1.50,-10.85);lift.add(liftPanel);
 // Numbered floors occupy pairs, from 1/2 at the bottom to 9/10 at the top.
 const rowCount=Math.ceil(Math.max(...OPEN_CAMPUS_MAPS.map(campusFloor))/2);
 const stepY=.255,middle=(rowCount-1)*stepY/2,buttons=new Map();
 const keyFace=new T.PlaneGeometry(.202,.207);assets.add(keyFace);
 B(liftInset,[.008,0,.11],[.043,rowCount*stepY+.095,.66],liftPanel);
 for(const map of OPEN_CAMPUS_MAPS){
  const floor=campusFloor(map),row=Math.floor((floor-1)/2),col=(floor-1)%2;
  const y=row*stepY-middle,z=.11+(.5-col)*.28;
  const label=texture(96,96,c=>{
   const enamel=c.createLinearGradient(0,0,0,96);enamel.addColorStop(0,'#7792a8');enamel.addColorStop(1,'#49657d');
   c.fillStyle=enamel;c.fillRect(0,0,96,96);c.strokeStyle='#c4d2d9';c.lineWidth=4;c.strokeRect(5,5,86,86);
   c.fillStyle='#ffffff';c.textAlign='center';c.textBaseline='middle';c.font='600 63px sans-serif';c.fillText(String(floor),48,49);
  });
  const rim=mat('#b7c6d0',{metalness:.31,roughness:.5});
  const button=B(rim,[.055,y,z],[.082,.228,.222],liftPanel);
  const face=mat('#fff',{map:label,roughness:.57});
  mesh(keyFace,face,[.098,y,z],[1,1,1],[0,Math.PI/2,0],liftPanel);
  button.userData.floorMap=map;button.userData.floor=floor;
  buttons.set(map,{rim,face});
 }
 const arrows=texture(128,96,c=>{
  c.fillStyle='#7590a1';c.fillRect(0,0,128,96);c.fillStyle='#f43329';
  for(const x of [13,115]){c.beginPath();c.moveTo(x,20);c.lineTo(64,48);c.lineTo(x,76);c.fill();}
 });
 const doorIndicator=mat('#ffffff',{map:arrows,roughness:.64});
 B(doorIndicator,[.036,-.12,-.43],[.024,.255,.37],liftPanel);
 const lightCover=mat('#e8eee7',{emissive:'#becfc9',emissiveIntensity:.36,roughness:.87});
 B(liftInset,[9.35,3.106,-11.67],[1.08,.029,1.58],lift);
 B(lightCover,[9.35,3.081,-11.67],[.94,.027,1.44],lift);
 for(const dz of [-.082,-.025,.032,.088])B(liftInset,[9.35,.003,-10.1+dz],[2.46,.006,.013],lift);
 markDynamic(liftPanel);liftPanel.visible=ELEVATOR_ENABLED;
 // Two actual paper strips lie just in front of the closed leaves. Separate
 // depths prevent flicker where the strips cross; the door geometry stays intact.
 if(!ELEVATOR_ENABLED){
  const sealInk=texture(1024,128,(c,w,h)=>{
   c.fillStyle='#f5e8ca';c.fillRect(0,0,w,h);
   c.strokeStyle='#ae302a';c.lineWidth=3;c.strokeRect(12,10,w-24,h-20);
   c.fillStyle='#9f2924';c.textAlign='center';c.textBaseline='middle';c.font='bold 88px "Kaiti SC","STKaiti","KaiTi",serif';
   for(const x of [w*.19,w*.5,w*.81])c.fillText('封',x,h*.53);
  });
  const paper=mat('#fff',{map:sealInk,roughness:.97,metalness:0});
  for(const [i,angle]of [-.42,.42].entries()){
   const strip=B(paper,[LIFT.x,1.62,-10.012+i*.009],[2.56,.255,.004],lift);
   strip.rotation.z=angle;strip.name='lift-paper-seal-'+i;
  }
 }
 // Stair profile is shared by floorHeight, navigation support and the render.
 const tiered=new T.Group();tiered.name='tiered-classroom-floor';scene.add(tiered);tiered.visible=false;
 const riser=mat('#a8a59b',{map:surfaces?.floor||null,roughness:.87});
 const nosing=mat('#999d92',{metalness:.17,roughness:.56}),stepGroove=mat('#757a71',{roughness:.83});
 for(const t of floorTiles()){
  const width=t.maxX-t.minX,x=(t.minX+t.maxX)/2,z=(t.minZ+t.maxZ)/2,g=new T.BoxGeometry(width,t.height+.012,t.maxZ-t.minZ);
  const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;
  for(let i=0;i<p.count;i++){
   const xx=p.getX(i)+x,zz=p.getZ(i)+z,yy=p.getY(i)+t.height/2;
   u.setXY(i,(Math.abs(n.getX(i))>.5?zz:xx)/1.6,(Math.abs(n.getY(i))>.5?zz:yy)/1.6);
  }
  assets.add(g);mesh(g,[riser,riser,floorMat,riser,riser,riser],[x,t.height/2-.006,z],[1,1,1],null,tiered);
  for(const [zz,sign]of [[t.minZ,-1],[t.maxZ,1]]){
   if(zz<=-9.99||floorHeight(x,zz+sign*.002,'tiered')>=t.height-.01)continue;
   B(nosing,[x,t.height-.008,zz-sign*.008],[width,.027,.037],tiered);
   for(const setback of [.043,.074])B(stepGroove,[x,t.height+.001,zz-sign*setback],[width,.003,.009],tiered);
  }
 }
 for(const x of [westWallX,7.30])upperColumn(x,-.59,.20,19.22);
 upperColumn(classMidX,-10.10,classWidth,.20);upperColumn(classMidX,8.91,classWidth,.22);
 // The three slabs meet at shared boundaries. The former office slab began
 // at 8.80 while both school slabs ended at 9.01, causing coplanar flicker.
 B(ceilingMaterial,[classMidX,4.59,-.59],[classWidth+.40,.16,19.22],ceilingRig).name='campus-ceiling-classroom';B(ceilingMaterial,[corridorMidX+.1,4.59,corridorMidZ+.01],[corridorWidth+.20,.16,corridorLength+.42],enclosure).name='campus-ceiling-corridor';B(officeCeiling,[officeMidX,OFFICE.height+.08,(9.02+officeEnd)/2],[officeWidth+.4,.16,officeEnd-9.02],office).name='campus-ceiling-office';
 const lamp=mat('#f3f1db',{emissive:'#fff6d6',emissiveIntensity:.48,roughness:.3});
 function fluorescent(x,z,parent){for(const xx of [x-.45,x+.45])B(edge,[xx,4.35,z],[.012,.30,.012],parent);rounded(edge,[x,4.19,z],[1.36,.055,.27],.008,null,parent);B(seal,[x,4.158,z],[1.22,.012,.20],parent);for(const zz of [z-.065,z+.065])cylinder(lamp,[x,4.142,zz],[.018,1.17,.018],[0,0,Math.PI/2],parent);}
 // The observed classroom has a plain plaster ceiling. The old dense tile
 // grid added visual noise and was not supported by the reference.
 const sharedHallLamp=new T.Group();sharedHallLamp.name='school-fluorescent';fluorescent(0,0,sharedHallLamp);
 const extraClassFixtures=new T.Group(),singleHallFixtures=new T.Group(),dayHallFixtures=new T.Group();
 dayHallFixtures.name='daytime-paired-hall-lights';singleHallFixtures.name='single-row-hall-lights';
 for(const z of [-6.05,.23,5.38]){
  const fitting=new T.Group();fitting.position.z=z;fitting.rotation.y=Math.PI/2;
  extraClassFixtures.add(fitting);fluorescent(0,0,fitting);
 }
 for(let z=CORRIDOR.minZ+3;z<CORRIDOR.maxZ-1;z+=4.5){
  fluorescent(corridorMidX,z,singleHallFixtures);
  for(const x of [corridorMidX-1.16,corridorMidX+1.16]){
   const fitting=new T.Group();fitting.position.set(x,0,z);fitting.rotation.y=Math.PI/2;
   dayHallFixtures.add(fitting);fluorescent(0,0,fitting);hallLampCenters.push({x,z});
  }
 }
 // A short return at the upper edge of each long wall catches the light
 // above the tubes. It stops at the hall wall, clear of every door opening.
 for(const wallX of [CORRIDOR.minX,CORRIDOR.maxX]){
  const inward=wallX===CORRIDOR.minX?1:-1;
  B(skirting,[wallX+inward*.033,4.395,corridorMidZ],[.066,.17,corridorLength],dayHallFixtures);
  B(recess,[wallX+inward*.056,4.475,corridorMidZ],[.111,.025,corridorLength],dayHallFixtures);
 }
 const officeFixtures=new T.Group();officeFixtures.position.y=OFFICE.height-CEILING_HEIGHT;office.add(officeFixtures);
 for(const x of [officeMidX-officeWidth*.255,officeMidX+officeWidth*.255])for(const z of [OFFICE.minZ+2.09,OFFICE.maxZ-1.96]){
  const fixture=new T.Group();fixture.position.set(x,0,z);fixture.rotation.y=Math.PI/2;
  officeFixtures.add(fixture);fluorescent(0,0,fixture);
 }
 const grilleBody=mat('#c3c5ba',{roughness:.82}),grilleWell=mat('#626b67',{roughness:.91});
 for(const z of [OFFICE.minZ+2.09,OFFICE.maxZ-1.96]){
  const x=officeMidX,y=OFFICE.height;
  rounded(grilleBody,[x,y-.033,z],[.99,.067,1.17],.015,null,office);
  B(grilleWell,[x,y-.071,z],[.78,.014,.88],office);
  for(let i=0;i<11;i++)B(grilleBody,[x,y-.083,z-.41+i*.082],[.746,.024,.026],office);
 }
 const bin=new T.Group();bin.position.set(officeBinPlan.x,0,officeBinPlan.z);office.add(bin);
 const shell=mat('#9daaa3',{roughness:.66}),rim=mat('#c2cbc2',{roughness:.62});
 cylinder(shell,[0,.245,0],[.165,.47,.134],null,bin);
 cylinder(rim,[0,.486,0],[.175,.034,.175],null,bin);cylinder(seal,[0,.505,0],[.139,.008,.139],null,bin);
 const switchX=OFFICE.doorMinX-.40;
 rounded(grilleBody,[switchX,1.31,OFFICE.minZ+.018],[.175,.160,.04],.008,null,office);
 for(const dx of [-.041,.041])B(rim,[switchX+dx,1.31,OFFICE.minZ+.047],[.059,.098,.022],office);
 const daylight=createClassroomDaylight(openings,hallLampCenters);
 assets.add(daylight.seatShade);assets.add(daylight.windowMask);assets.add(daylight.map);assets.add(daylight.sky);
 for(const m of [cream,wallGreen,doorPaint])daylight.bind(m,'wall');
 for(const m of [blue,frameLip,frameGroove,skirting])daylight.bind(m,'frame');
 for(const m of [frostedGlass,upperGlass])daylight.bind(m,'glass');
 daylight.bind(floorMat,'floor');daylight.bind(ceilingMaterial,'ceiling');
 dayHallFixtures.visible=false;
 const officeLight=new T.PointLight('#fff5dc',6.5,17,1.6);officeLight.position.set(officeMidX,OFFICE.height-.72,officeMidZ);office.add(officeLight);
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
 const trees=[[-10.7,-8.5,3.00],[-11.0,-1.6,3.40],[-10.2,5.5,2.92],[CORRIDOR.maxX+3.0,-6.1,3.28],[CORRIDOR.maxX+3.5,.3,2.93],[CORRIDOR.maxX+2.9,6.6,3.37],[13.0,rearTreeZ,3.10],[18.0,rearTreeZ,3.50]];
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

 const schoolDoorMotion=createSchoolDoorMotion();let schoolDoorSignature='';
 let officeLocked=false,rearDoorClosed=false,drawerOpen=false,liftAmount=ELEVATOR_ENABLED?1:0,liftTarget=ELEVATOR_ENABLED?1:0;const drawerAmounts=new Map();
 // Retract the leading door edge inside its pocket. Stopping precisely at
 // the clear opening left its blue end face coplanar with the plaster reveal.
 const placeLiftDoors=()=>{
  const ease=liftAmount*liftAmount*(3-2*liftAmount);
  for(const {part,x,travel} of leafSections)part.position.x=x+travel*ease;
  for(const g of liftDoors)g.userData.openAmount=liftAmount;
 };placeLiftDoors();
 const placeSchoolDoors=()=>{for(const[id,leaf]of doors)leaf.rotation.y=schoolDoorMotion[id].amount?-Math.PI/2*schoolDoorMotion[id].amount:0;officeDoors.forEach((g,i)=>g.rotation.y=(i===0?-1:1)*Math.PI/2*schoolDoorMotion.office.amount);};
 let litFloor=null;
 const setDoors=state=>{
  const selection=state?.elevator?.targetMap||state?.map||'classroom';
  if(selection!==litFloor){
   const previous=buttons.get(litFloor),next=buttons.get(selection);
   if(previous){previous.rim.emissive.setHex(0);previous.face.emissive.setHex(0);}
   if(next){next.rim.emissive.setHex(0xd79b21);next.face.emissive.setHex(0x886310);}
   litFloor=selection;
  }
  officeLocked=!!state?.officeLocked;rearDoorClosed=!!state?.rearDoorClosed;liftTarget=!ELEVATOR_ENABLED||state?.elevator?.doorClosed?0:1;
  setSchoolDoorTargets(schoolDoorMotion,{rear:rearDoorClosed,front:!!state?.frontDoorClosed,office:!!(state?.officeDoorClosed??officeLocked)});
  if(state?.doorMotion){const signature=JSON.stringify(state.doorMotion);if(signature!==schoolDoorSignature){copySchoolDoorMotion(schoolDoorMotion,state.doorMotion);schoolDoorSignature=signature;}}
  placeSchoolDoors();
 };
 setDoors({officeLocked:false,rearDoorClosed:false});
 enclosure.visible=false;
 const indoorEnclosure=new T.Group();indoorEnclosure.name='indoor-classroom-enclosure';
 enclosure.updateMatrixWorld(true);
 const indoorObjects=[];
 function collectIndoor(o){
  if(o===ends||o.userData.animated)return;
  let animated=false;o.traverse(child=>{animated ||= !!child.userData.animated;});
  const b=new T.Box3().setFromObject(o);
  if(!animated&&!b.isEmpty()&&b.max.x<7.41&&b.max.z<9.03&&b.min.z>=CLASSROOM.minZ-.25){indoorObjects.push(o);return;}
  for(const child of o.children)collectIndoor(child);
 }
 for(const child of enclosure.children)collectIndoor(child);
 for(const object of indoorObjects)indoorEnclosure.attach(object);
 return{boardInk,hallLamp:sharedHallLamp,roleLocker:locker,enclosure,indoorEnclosure,corridorSkin,ceilingMaterial,ceilingRig,upperWalls,curtains,tiered,liftPanel,liftDoors,facades,doors,officeDoors,officeDrawer,officeDrawers,officeScreens,
  attachUpperArchitecture(){
   corridorSkin.add(darkness);
   bakeStatic(classroomCabinet);classroomCabinet.removeFromParent();bakeStatic(rearFixtures);rearFixtures.add(classroomCabinet);bakeStatic(teachingFixtures);room.add(rearFixtures);indoorEnclosure.add(teachingFixtures);
   for(const group of [posterBay,standardBay]){bakeStatic(group);facades[0].add(group);}
   for(const group of [extraClassFixtures,singleHallFixtures,dayHallFixtures,corridorLowerPanels])bakeStatic(group);
   corridorSkin.add(corridorLowerPanels);
   ceilingRig.add(extraClassFixtures);enclosure.add(singleHallFixtures,dayHallFixtures,ceilingRig,upperWalls,indoorEnclosure,corridorSkin);
  },
  daylight,setDaylight(active){
   daylight.setActive(active);dayHallFixtures.visible=active;extraClassFixtures.visible=singleHallFixtures.visible=corridorLowerPanels.visible=!active;
  },
  getTargets(){return targets;},setDoors,getDoorMotion:()=>schoolDoorSnapshot(schoolDoorMotion),
  setOfficeDrawer(open){drawerOpen=!!open;},
  setMap(map){
   const turn=turnedClass(map);
   for(const group of [teachingFixtures,rearFixtures]){
    group.rotation.y=turn?Math.PI:0;
    group.position.set(turn?CLASS_TURN.x:0,0,turn?CLASS_TURN.z:0);
   }
   classroomCabinet.visible=mapKind(map)==='classroom';
   if(studentTutorial){
    const kind=mapKind(map),dorm=kind==='dorm';
    studentTutorial.visible=!['bus','cafeteria'].includes(kind);
    studentTutorial.rotation.y=dorm?Math.PI/2:-Math.PI/2;
    if(dorm)studentTutorial.position.set(dormTutorialWall.maxX+.012,2.68,(dormTutorialWall.minZ+dormTutorialWall.maxZ)/2);
    else studentTutorial.position.set(CORRIDOR.maxX-.004,2.05,CORRIDOR.maxZ-6.8);
   }
   const raised=mapKind(map)==='tiered',outdoor=mapKind(map)==='playground',dorm=mapKind(map)==='dorm';room.visible=!outdoor&&!dorm;indoorEnclosure.visible=!outdoor&&!dorm;ceilingRig.visible=!outdoor&&!dorm;doors.get('front').visible=!dorm;doors.get('rear').visible=!dorm;dormDoorNumber.visible=false;corridorSkin.visible=!dorm;tiered.visible=raised;const variant=mapKind(map);posterBay.visible=variant==='classroom';standardBay.visible=!posterBay.visible;facades[0].visible=!raised&&!outdoor&&!dorm&&variant!=='toilet'&&variant!=='hotpot';facades[1].visible=raised;facades[2].visible=variant==='toilet';facades[3].visible=variant==='hotpot';ceilingRig.position.y=teachingRoomHeight(variant)-CEILING_HEIGHT;upperWalls.visible=raised;},
  update(state,dt=1/60){boardInk.update(state?.teacher);setDoors(state);advanceSchoolDoors(schoolDoorMotion,dt);placeSchoolDoors();const step=Math.max(0,Math.min(.1,dt));liftAmount+=Math.sign(liftTarget-liftAmount)*Math.min(Math.abs(liftTarget-liftAmount),step*2.5);placeLiftDoors();drawerOpen=!!(state?.officeDeskOpen??state?.office?.open??drawerOpen);const openById=new Map((state?.officeDrawers||[]).map(d=>[d.id,d.open]));for(const[id,drawer]of officeDrawers){const open=openById.has(id)?openById.get(id):id===OFFICE_DESK.id?drawerOpen:false,old=drawerAmounts.get(id)||0,amount=old+((open?1:0)-old)*(1-Math.exp(-step*14));drawerAmounts.set(id,amount);drawer.position.z=-.08-amount*.52;}},
  setNight(night){officeDay.value=!night;sky.color.set(night?'#0d172e':'#c9e8f5');officeLight.intensity=night?.12:6.5;lamp.emissiveIntensity=night?.01:.48;}
 };
}
