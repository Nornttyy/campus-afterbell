import {VisibleGroup} from './visible-group158.js?v=campus-117&rev=158';
import {mountCooler} from './field-fixtures116.js?v=campus-117&rev=178';
import {mountSchoolRadio} from './radio-model93.js?v=campus-117&rev=165';
import {createUpperFloorView} from './upper-floor-view85.js?v=campus-117&rev=178';
import {createToiletRoom} from './toilet-room70.js?v=campus-99&rev=173';
import {createDormRoom} from './dorm-room70.js?v=campus-95&rev=127';
import {createPlaygroundRoom} from './playground-room70.js?v=campus-117&rev=178';
import {createHotpotRoom} from './hotpot-room70.js?v=campus-117&rev=174';
import {placeFurniture67,hasComputer67,MONITOR67} from './furniture-assets67.js?v=campus-99';
import * as T from './vendor/three.module.js';
import {advanceDeskDrawer} from './drawer-hand-target58.js?v=campus-117&rev=174';
import {buildLaptop55,buildComputerDrawer55} from './computer-hardware55.js?v=campus-117&rev=174';
import {SEATS,MAX_CAMPUS_SEATS,TEACHER_EYE_HEIGHT,BOARD,LECTERN,LAB_DIVIDER,mapKind,floorHeight} from './classroom-layout.js?v=campus-117&rev=174';

export function createRoomVariants({scene,box,rounded,mat,texture,bakeStatic,batchHardware,boardInk,finishes={},menus=null,drawerRecords=null,screenContent=null,officeScreens=new Map()}){
 const upper=createUpperFloorView({scene,box,mat,texture,bakeStatic,drawerRecords,finishes});
 const builders={
  hotpot:parent=>createHotpotRoom({parent,box,rounded,mat,texture,bakeStatic,finishes,menus,seats}),
  toilet:parent=>createToiletRoom({parent,box,rounded,mat,texture,bakeStatic,batchHardware,finishes}),
  dorm:parent=>createDormRoom({parent,box,rounded,mat,texture,bakeStatic,finishes}),
  playground:parent=>createPlaygroundRoom({parent,finishes,boardInk})
 };
 // Keep stable roots for raycasting and materials. A floor's furnishings are
 // built once when its elevator is called, or immediately on direct entry.
 const rooms={};
 for(const name of Object.keys(builders)){
  const root=new VisibleGroup();root.name='floor-'+name;root.visible=false;scene.add(root);
  rooms[name]={root,view:null};
 }
 function prepareFloor(name){
  const slot=rooms[name];if(!slot)return null;
  if(!slot.view){slot.view=builders[name](slot.root);slot.view.group.visible=slot.root.visible;}
  return slot.view;
 }
 let cooler=null;
 const radioTools={box,rounded,mat,texture,bakeStatic},radios={};
 const group=new VisibleGroup(),screens=new Map(),stations=new Map(),drawers=new Map(),hardwareRoots=[];group.name='computer-lab-workstations';scene.add(group);group.visible=false;
 let laptop,teacherScreen,screenGeo,cableGeometry,hardwareBatch;
 function buildLab(){
  if(laptop)return;
  const labTop=texture(512,336,(c,w,h)=>{
   c.fillStyle='#b7c2bd';c.fillRect(0,0,w,h);
   let seed=94;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
   for(let i=0;i<21000;i++){c.fillStyle=i%2?'rgba(70,85,80,.10)':'rgba(245,246,224,.19)';c.fillRect(rand()*w,rand()*h,1.1,1);}
   const shade=(x,y,r,dx,dy)=>{c.save();c.translate(x,y);c.scale(dx,dy);const g=c.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,'rgba(41,53,52,.26)');g.addColorStop(.66,'rgba(42,55,54,.12)');g.addColorStop(1,'rgba(50,59,51,0)');c.fillStyle=g;c.fillRect(-r,-r,2*r,2*r);c.restore();};
   shade(w*.51,h*.70,51,1.5,.63);shade(w*.44,h*.24,58,1.85,.52);
  });
  const wire=mat('#343c39',{roughness:.82});
  cableGeometry=new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(.13,.866,.19),new T.Vector3(.23,.87,.22),new T.Vector3(.256,.869,.277),new T.Vector3(.303,.869,.328),new T.Vector3(.314,.868,.346)]),10,.004,5,false);
  const shell=mat('#424b59',{roughness:.48}),keys=mat('#d5d9df',{roughness:.72}),base=mat('#909ba9',{metalness:.35,roughness:.48}),top=mat('#fff',{map:labTop,roughness:.55}),trim=mat('#607d7b',{roughness:.62}),shadow=mat('#27353d',{roughness:.85});
  const rail=mat('#317693',{roughness:.54}),frame=mat('#454d52',{metalness:.25,roughness:.55});
  const frost=mat('#d5d9da',{transparent:true,opacity:.92,roughness:.82,depthWrite:false});
  const stripe=mat('#a9b3b8',{transparent:true,opacity:.88,roughness:.76,depthWrite:false});
  const imported=hasComputer67();
  const desktopMat=mat('#a2bec7',{emissive:'#85a0a7',emissiveIntensity:.25});screenGeo=new T.PlaneGeometry(imported?MONITOR67.width:.586,imported?MONITOR67.height:.326);
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
  laptop=buildLaptop55({parent:group,box,rounded,mat,x:(LECTERN.minX+LECTERN.maxX)/2,y:1.1475,z:(LECTERN.minZ+LECTERN.maxZ)/2,bakeStatic});laptop.root.rotation.y=Math.PI;teacherScreen=laptop.screen;
  hardwareBatch=batchHardware?.([...hardwareRoots,...Array.from(drawers.values(),d=>d.group)],scene);
 }
 let currentMap='classroom',seats=SEATS;
 function setSeats(next){if(!Array.isArray(next)||!next.length||next.length>MAX_CAMPUS_SEATS)return;seats=next;
  if(next[0].map==='hotpot'&&rooms.hotpot.view&&rooms.hotpot.view.pattern!==next[0].pattern){rooms.hotpot.view.dispose();rooms.hotpot.view=null;if(currentMap==='hotpot')prepareFloor('hotpot');}
  upper.setSeats(next);const active=new Set(next.map(s=>s.id));for(const[id,station]of stations)station.visible=active.has(id);for(const s of seats){const station=stations.get(s.id);if(!station)continue;station.position.set(s.deskX,floorHeight(s.deskX,s.deskZ,currentMap),s.deskZ);station.rotation.y=s.yaw||0;}}
 setSeats(seats);
 const light=new T.SpotLight('#fff4d5',75,17,.43,.65,1.4);light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.bias=-.001;scene.add(light,light.target);light.visible=false;
 function updateDrawers(state,dt=0){
  const player=state?.player,localSeat=player?.seated&&!player.caught&&!player.officeChair?player.seatId:null;
  const openSeats=new Set((state?.students||[]).filter(s=>s.id!==player?.id&&s.seated&&!s.caught&&!s.officeChair&&(s.drawerOpen??s.drawer?.open)).map(s=>s.seatId));
  if(localSeat!=null&&state?.drawer?.open)openSeats.add(localSeat);
  for(const[id,drawer]of drawers){
   const target=group.visible&&stations.get(id)?.visible&&openSeats.has(id)?1:0;
   advanceDeskDrawer(drawer,target,Math.max(0,dt));
   drawer.group.position.z=-drawer.travel*drawer.open;
  }
 }
 return{group,upper,get hotpot(){return prepareFloor('hotpot');},get toilet(){return prepareFloor('toilet');},get dorm(){return prepareFloor('dorm');},get playground(){return prepareFloor('playground');},
  get vendingTargets(){return prepareFloor('playground').vendingTargets;},
  coolerLid:()=>cooler?.lid,coolerTarget:i=>cooler?.slots[i],radioTarget:map=>radios[map],specialRoots:[upper.root,...Object.values(rooms).map(s=>s.root)],
  cabinetFor(id){return mapKind(currentMap)==='toilet'?rooms.toilet.view.cabinets.get(id):mapKind(currentMap)==='dorm'?rooms.dorm.view.cabinets.get(id):null;},
  seatTarget(id){return mapKind(currentMap)==='toilet'?rooms.toilet.view.seats.get(id)?.target:mapKind(currentMap)==='dorm'?rooms.dorm.view.beds.get(id)?.target:null;},screens,stations,drawers,hardwareRoots,get teacherScreen(){return teacherScreen;},light,setSeats,updateDrawers,
  setMap(map){
   currentMap=map;const kind=mapKind(map);if(kind==='computer')buildLab();
   const active=prepareFloor(kind);
   for(const [name,slot] of Object.entries(rooms)){
    slot.root.visible=name===kind;
    if(slot.view)slot.view.group.visible=slot.root.visible;
   }
   if(kind==='playground'&&!cooler)cooler=mountCooler(active.group,radioTools);
   if(kind==='playground'&&!radios[map])radios[map]=mountSchoolRadio(map,active.group,radioTools);
   upper.setMap(map);group.visible=kind==='computer';light.visible=kind==='night'||kind==='dorm';setSeats(seats);hardwareBatch?.sync();
  },
  update(state,dt=0){
   if(state?.elevator?.phase==='travel'){if(state.elevator.targetMap==='computer')buildLab();else prepareFloor(state.elevator.targetMap);}
   if(group.visible)hardwareBatch?.sync();
   if(upper.root.visible)upper.update(state,dt);
   const active=rooms[currentMap]?.view;
   if(active){
    if(currentMap==='playground'){active.update(state?.sceneElapsed??state?.elapsed??0,state?.vendingStock,state?.posts);cooler?.update(state?.coolerSlots,state?.coolerOpen,dt);}
    else if(currentMap==='hotpot')active.update(state?.elapsed||0,state?.hotpots||[]);
    else active.update(state||{},dt);
   }
   screenContent?.update(state,group.visible?new Map([...screens].filter(([id])=>stations.get(id)?.visible)):new Map(),group.visible?teacherScreen:null,officeScreens);
   if(light.visible){const t=state?.teacher||{x:BOARD.x,z:BOARD.z,yaw:Math.PI},pitch=state?.role==='teacher'?state.player.pitch:(t.pitch??.08),height=TEACHER_EYE_HEIGHT+floorHeight(t.x,t.z,state?.map);light.position.set(t.x,height,t.z);light.target.position.set(t.x+Math.sin(t.yaw)*6,height-Math.tan(pitch)*6,t.z+Math.cos(t.yaw)*6);}
  },dispose(){upper.dispose();for(const slot of Object.values(rooms)){slot.view?.dispose();slot.root.removeFromParent();}screenContent?.dispose();hardwareBatch?.dispose();screenGeo?.dispose();cableGeometry?.dispose();laptop?.screen.geometry.dispose();light.shadow.map?.dispose();}
 };
}
