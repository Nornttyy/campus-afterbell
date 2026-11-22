import {createBusRoom} from './bus-room86.js?v=campus-92';
import {createUpperFloorView} from './upper-floor-view85.js?v=campus-92';
import {createToiletRoom} from './toilet-room70.js?v=campus-92';
import {createDormRoom} from './dorm-room70.js?v=campus-92';
import {createPlaygroundRoom} from './playground-room70.js?v=campus-92';
import {createHotpotRoom} from './hotpot-room70.js?v=campus-92';
import {placeFurniture67,hasComputer67,MONITOR67} from './furniture-assets67.js?v=campus-83';
import * as T from './vendor/three.module.js';
import {buildLaptop55,buildComputerDrawer55} from './computer-hardware55.js?v=campus-83';
import {SEATS,TEACHER_EYE_HEIGHT,BOARD,LECTERN,LAB_DIVIDER,mapKind,floorHeight} from './classroom-layout.js?v=campus-92';

export function createRoomVariants({scene,box,rounded,mat,texture,bakeStatic,liftPanel,stationFloor,finishes={},menus=null,drawerRecords=null,screenContent=null,officeScreens=new Map()}){
 const bus=createBusRoom({scene,box,rounded,mat,texture,bakeStatic,liftPanel,stationFloor,finishes});
 const upper=createUpperFloorView({scene,box,mat,texture,bakeStatic,drawerRecords,finishes});
 const hotpot=createHotpotRoom({parent:scene,box,rounded,mat,texture,bakeStatic,finishes,menus});hotpot.group.visible=false;
 const toilet=createToiletRoom({parent:scene,box,rounded,mat,texture,bakeStatic,finishes}),dorm=createDormRoom({parent:scene,box,rounded,mat,texture,bakeStatic,finishes}),playground=createPlaygroundRoom({parent:scene,finishes});
 for(const variant of [toilet,dorm,playground])variant.group.visible=false;
 const vendingTargets=playground.vendingTargets;
 const group=new T.Group(),screens=new Map(),stations=new Map(),drawers=new Map(),hardwareRoots=[];group.name='computer-lab-workstations';scene.add(group);group.visible=false;
 const labTop=texture(512,336,(c,w,h)=>{
  c.fillStyle='#b7c2bd';c.fillRect(0,0,w,h);
  let seed=94;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(let i=0;i<21000;i++){c.fillStyle=i%2?'rgba(70,85,80,.10)':'rgba(245,246,224,.19)';c.fillRect(rand()*w,rand()*h,1.1,1);}
  const shade=(x,y,r,dx,dy)=>{c.save();c.translate(x,y);c.scale(dx,dy);const g=c.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,'rgba(41,53,52,.26)');g.addColorStop(.66,'rgba(42,55,54,.12)');g.addColorStop(1,'rgba(50,59,51,0)');c.fillStyle=g;c.fillRect(-r,-r,2*r,2*r);c.restore();};
  shade(w*.51,h*.70,51,1.5,.63);shade(w*.44,h*.24,58,1.85,.52);
 });
 const wire=mat('#343c39',{roughness:.82});
 const cableGeometry=new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(.13,.866,.19),new T.Vector3(.23,.87,.22),new T.Vector3(.256,.869,.277),new T.Vector3(.303,.869,.328),new T.Vector3(.314,.868,.346)]),10,.004,5,false);
 const shell=mat('#424b59',{roughness:.48}),keys=mat('#d5d9df',{roughness:.72}),base=mat('#909ba9',{metalness:.35,roughness:.48}),top=mat('#fff',{map:labTop,roughness:.55}),trim=mat('#607d7b',{roughness:.62}),shadow=mat('#27353d',{roughness:.85});
 const rail=mat('#317693',{roughness:.54}),frame=mat('#454d52',{metalness:.25,roughness:.55});
 const frost=mat('#d5d9da',{transparent:true,opacity:.92,roughness:.82,depthWrite:false});
 const stripe=mat('#a9b3b8',{transparent:true,opacity:.88,roughness:.76,depthWrite:false});
 const imported=hasComputer67();
 const desktopMat=mat('#a2bec7',{emissive:'#85a0a7',emissiveIntensity:.25}),screenGeo=new T.PlaneGeometry(imported?MONITOR67.width:.586,imported?MONITOR67.height:.326);
 for(const s of SEATS){
  const station=new T.Group();station.name=`computer-station-${s.id}`;group.add(station);stations.set(s.id,station);const hardware=new T.Group();station.add(hardware);hardwareRoots.push(hardware);
  // Lab furniture replaces the ordinary yellow desktop, not a monitor pasted
  // over books. School desks keep their designed physical dimensions.
  rounded(top,[0,.83,0],[1.22,.065,.80],.018,null,hardware);box(trim,[0,.789,0],[1.18,.025,.77],null,hardware);
  for(const x of[-.53,.53]){rounded(base,[x,.41,.15],[.045,.78,.46],.008,null,hardware);rounded(shadow,[x,.024,.15],[.08,.045,.47],.008,null,hardware);}box(base,[0,.22,.33],[1.05,.04,.045],null,hardware);
  const d=LAB_DIVIDER,band=(d.top-d.bottom)/7;
  for(const side of [-1,1]){
   const x=side*d.side;
   for(let i=0;i<7;i++)box(i%2?stripe:frost,[x,d.bottom+(i+.5)*band,0],[d.thickness,band,d.depth],null,hardware);
   box(rail,[x,.844,0],[.04,.054,d.depth+.013],null,hardware);
   box(frame,[x,d.top+.007,0],[.032,.014,d.depth+.01],null,hardware);
   for(const z of [-d.depth/2,d.depth/2])box(frame,[x,(d.bottom+d.top)/2,z],[.033,d.top-d.bottom+.018,.014],null,hardware);
  }
  if(imported){placeFurniture67(hardware,'computer-tower',.35,.002,0);placeFurniture67(hardware,'monitor',0,.8625,.17);placeFurniture67(hardware,'keyboard',-.08,.8625,-.19);placeFurniture67(hardware,'mouse',-.46,.8625,-.18);}else{
  rounded(shell,[.40,.43,.15],[.22,.50,.43],.013,null,hardware);box(shadow,[.40,.43,-.071],[.17,.43,.009],null,hardware);for(let k=0;k<5;k++)box(base,[.40,.32+k*.035,-.077],[.13,.009,.006],null,hardware);box(keys,[.40,.59,-.078],[.025,.025,.008],null,hardware);
  rounded(shell,[0,1.22,.17],[.66,.40,.092],.018,null,hardware);box(base,[0,.966,.17],[.075,.19,.075],null,hardware);rounded(base,[0,.873,.17],[.32,.022,.20],.008,null,hardware);
  rounded(shell,[-.08,.88,-.19],[.58,.028,.16],.008,null,hardware);for(let r=0;r<3;r++)for(let k=0;k<11;k++)box(keys,[-.32+k*.046,.897,-.245+r*.045],[.035,.008,.029],null,hardware);rounded(shell,[.39,.886,-.18],[.08,.035,.12],.016,null,hardware);
  }
  hardware.add(new T.Mesh(cableGeometry,wire));
  rounded(wire,[.314,.864,.346],[.043,.007,.025],.003,null,hardware);
  // The screen sits in front of the bezel; it remains individually raycastable.
  const screen=new T.Mesh(screenGeo,desktopMat);screen.position.set(0,imported?.8625+MONITOR67.y:1.22,imported?.17+MONITOR67.z:.122);screen.rotation.y=Math.PI;screen.userData.seatId=s.id;screen.userData.animated=true;station.add(screen);screens.set(s.id,screen);
  drawers.set(s.id,buildComputerDrawer55({parent:station,box,rounded,mat,id:`computer-drawer-${s.id}`,bakeStatic}));
  bakeStatic(hardware);
 }
 const laptop=buildLaptop55({parent:group,box,rounded,mat,x:(LECTERN.minX+LECTERN.maxX)/2,y:1.1475,z:(LECTERN.minZ+LECTERN.maxZ)/2,bakeStatic});laptop.root.rotation.y=Math.PI;const teacherScreen=laptop.screen;
 let currentMap='classroom',seats=SEATS;
 function setSeats(next){if(!Array.isArray(next)||!next.length||next.length>SEATS.length)return;seats=next;upper.setSeats(next);const active=new Set(next.map(s=>s.id));for(const[id,station]of stations)station.visible=active.has(id);for(const s of seats){const station=stations.get(s.id);if(!station)continue;station.position.set(s.deskX,floorHeight(s.deskX,s.deskZ,currentMap),s.deskZ);station.rotation.y=s.yaw||0;}}
 setSeats(seats);
 const light=new T.SpotLight('#fff4d5',75,17,.43,.65,1.4);light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.bias=-.001;scene.add(light,light.target);light.visible=false;
 function updateDrawers(state,dt=0){
  const player=state?.player,localSeat=player?.seated&&!player.caught&&!player.officeChair?player.seatId:null;
  const openSeats=new Set((state?.students||[]).filter(s=>s.id!==player?.id&&s.seated&&!s.caught&&!s.officeChair&&(s.drawerOpen??s.drawer?.open)).map(s=>s.seatId));
  if(localSeat!=null&&state?.drawer?.open)openSeats.add(localSeat);
  for(const[id,drawer]of drawers){
   const target=group.visible&&stations.get(id)?.visible&&openSeats.has(id)?1:0;
   drawer.open=T.MathUtils.damp(drawer.open,target,target>drawer.open?12:18,Math.max(0,dt));
   drawer.group.position.z=-drawer.travel*drawer.open;
  }
 }
 return{group,bus,upper,hotpot,toilet,dorm,playground,vendingTargets,specialRoots:[bus.group,upper.root,hotpot.group,toilet.group,dorm.group,playground.group],
  cabinetFor(id){if(currentMap==='bus')return bus.cabinets.get(id);return mapKind(currentMap)==='toilet'?toilet.cabinets.get(id):mapKind(currentMap)==='dorm'?dorm.cabinets.get(id):null;},
  seatTarget(id){if(currentMap==='bus')return bus.chairs.get(id);return mapKind(currentMap)==='toilet'?toilet.seats.get(id)?.target:mapKind(currentMap)==='dorm'?dorm.beds.get(id)?.target:null;},screens,stations,drawers,hardwareRoots,teacherScreen,light,setSeats,updateDrawers,
  setMap(map){currentMap=map;bus.setActive(map==='bus');upper.setMap(map);hotpot.group.visible=mapKind(map)==='hotpot';toilet.group.visible=mapKind(map)==='toilet';dorm.group.visible=mapKind(map)==='dorm';playground.group.visible=mapKind(map)==='playground';group.visible=mapKind(map)==='computer';light.visible=['night','dorm'].includes(mapKind(map));setSeats(seats);},
  update(state,dt=0){
   if(bus.group.visible)bus.update(state||{},dt);
   if(upper.root.visible)upper.update(state,dt);
   if(toilet.group.visible)toilet.update(state||{},dt);if(dorm.group.visible)dorm.update(state||{},dt);if(playground.group.visible)playground.update(state?.sceneElapsed??state?.elapsed??0,state?.vendingStock);
   if(hotpot.group.visible)hotpot.update(state?.elapsed||0);
   screenContent?.update(state,group.visible?new Map([...screens].filter(([id])=>stations.get(id)?.visible)):new Map(),group.visible?teacherScreen:null,officeScreens);
   if(light.visible){const t=state?.teacher||{x:BOARD.x,z:BOARD.z,yaw:Math.PI},pitch=state?.role==='teacher'?state.player.pitch:(t.pitch??.08),height=TEACHER_EYE_HEIGHT+floorHeight(t.x,t.z,state?.map);light.position.set(t.x,height,t.z);light.target.position.set(t.x+Math.sin(t.yaw)*6,height-Math.tan(pitch)*6,t.z+Math.cos(t.yaw)*6);}
  },dispose(){bus.dispose();upper.dispose();hotpot.dispose();toilet.dispose();dorm.dispose();playground.dispose();screenContent?.dispose();screenGeo.dispose();cableGeometry.dispose();laptop.screen.geometry.dispose();light.shadow.map?.dispose();}
 };
}
