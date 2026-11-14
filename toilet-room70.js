import * as T from './vendor/three.module.js';
import {placeFurniture67} from './furniture-assets67.js?v=campus-83';
import {TOILET_STALLS,TOILET_SEATS,TOILET_SOLIDS,TOILET_DOOR,TOILET_CABINET,toiletDoorSolids,toiletCabinetDoorSolids} from './toilet-layout70.js?v=campus-83';
export * from './toilet-layout70.js?v=campus-83';

function ellipseRing(outerX,outerZ,innerX,innerZ,height){
 const shape=new T.Shape();shape.absellipse(0,0,outerX,outerZ,0,Math.PI*2,false);const hole=new T.Path();hole.absellipse(0,0,innerX,innerZ,0,Math.PI*2,true);shape.holes.push(hole);
 const g=new T.ExtrudeGeometry(shape,{depth:height,steps:1,curveSegments:24,bevelEnabled:true,bevelThickness:.006,bevelSize:.008,bevelSegments:2});g.rotateX(-Math.PI/2);return g;
}
const getState=(source,id,fallback=false)=>{const entry=source instanceof Map?source.get(id):source?.[id];return entry==null?fallback:typeof entry==='number'?Math.max(0,Math.min(1,entry)):typeof entry==='object'?!!entry.open:!!entry;};
const damp=(from,to,dt)=>from+(to-from)*(1-Math.exp(-10*Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0))));

export function createToiletRoom({parent,box,rounded,mat,texture,bakeStatic}){
 const group=new T.Group();group.name='toilet-classroom-furniture';parent.add(group);
 const fixed=new T.Group();fixed.name='toilet-fixed-partitions';group.add(fixed);
 const geometries=new Set(),materials=new Set(),textures=new Set(),borrowedGeometry=new Set();
 const own=g=>(geometries.add(g),g),material=(c,o={})=>{const m=mat(c,o);materials.add(m);return m;};
 const render=(g,m,p,root=fixed,r=null)=>{const mesh=new T.Mesh(g,m);mesh.position.set(...p);if(r)mesh.rotation.set(...r);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;};
 const panel=material('#e2e5df',{roughness:.52}),edge=material('#303a3a',{roughness:.58}),feet=material('#bd352e',{roughness:.56}),porcelain=material('#e7e7db',{roughness:.24}),seatMat=material('#f4f2e5',{roughness:.31}),inside=material('#afb5a7',{roughness:.36}),water=material('#8fa79a',{roughness:.18,metalness:.06}),steel=material('#a3aaa5',{metalness:.56,roughness:.31});
 const woodMap=texture(256,512,(c,w,h)=>{c.fillStyle='#bdb088';c.fillRect(0,0,w,h);for(let i=0;i<85;i++){const x=(i*43.271)%w;c.strokeStyle=i%3?'rgba(101,77,45,.08)':'rgba(255,241,196,.13)';c.lineWidth=.5+(i%3)*.35;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+Math.sin(i)*3,h*.3,x+Math.cos(i)*3,h*.7,x,h);c.stroke();}});textures.add(woodMap);const wood=material('#fff',{map:woodMap,bumpMap:woodMap,bumpScale:.0014,roughness:.60}),shelf=material('#786443',{roughness:.76});
 const floorMap=texture(512,512,(c,w,h)=>{c.fillStyle='#b3c1c3';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=128)for(let x=0;x<w;x+=128){c.fillStyle=((x+y)/128)%2?'#adbdc1':'#b8c6c8';c.fillRect(x+1,y+1,126,126);c.strokeStyle='#9aaeb3';c.lineWidth=1.5;c.strokeRect(x+.5,y+.5,127,127);}});textures.add(floorMap);floorMap.wrapS=floorMap.wrapT=T.RepeatWrapping;floorMap.repeat.set(6.75,8);const floor=material('#fff',{map:floorMap,roughness:.65});
 const floorMesh=render(own(new T.PlaneGeometry(13.75,16.25)),floor,[.275,.007,-1.825],fixed,[-Math.PI/2,0,0]);floorMesh.name='toilet-tiled-floor';floorMesh.castShadow=false;
 const wallMap=texture(256,256,(c,w,h)=>{c.fillStyle='#e3e5de';c.fillRect(0,0,w,h);c.strokeStyle='#b8c1bb';c.lineWidth=1.2;for(let p=0;p<=256;p+=64){c.beginPath();c.moveTo(p,0);c.lineTo(p,h);c.moveTo(0,p);c.lineTo(w,p);c.stroke();}});textures.add(wallMap);wallMap.wrapS=wallMap.wrapT=T.RepeatWrapping;wallMap.repeat.set(3.6,.32);const wallTile=material('#fff',{map:wallMap,roughness:.58});
 // Low tile wainscot only; the host retains existing exterior walls/windows.
 box(wallTile,[-6.615,.56,-1.825],[.025,1.1,16.25],null,fixed);box(wallTile,[.275,.56,-9.965],[13.8,1.1,.025],null,fixed);
 const bowlGeo=own(new T.LatheGeometry([[.10,.09],[.20,.13],[.25,.20],[.31,.33],[.325,.41],[.32,.45],[.27,.455],[.253,.39],[.21,.30],[.135,.25],[0,.24]].map(([r,y])=>new T.Vector2(r,y)),32));bowlGeo.scale(1,1,1.28);
 const pedestalGeo=own(new T.LatheGeometry([[0,0],[.18,0],[.20,.035],[.14,.11],[.12,.22],[.18,.29],[0,.29]].map(([r,y])=>new T.Vector2(r,y)),24));pedestalGeo.scale(1,1,1.18);
 const ringGeo=own(ellipseRing(.334,.425,.245,.323,.024));const lidGeo=own(new T.ExtrudeGeometry(new T.Shape().absellipse(0,0,.325,.415,0,Math.PI*2,false),{depth:.018,steps:1,curveSegments:24,bevelEnabled:true,bevelThickness:.004,bevelSize:.005,bevelSegments:1}));lidGeo.translate(0,0,-.009);
 const waterGeo=own(new T.CircleGeometry(.145,32));waterGeo.scale(1,1.20,1);const knobGeo=own(new T.SphereGeometry(.055,12,8)),hingeGeo=own(new T.CylinderGeometry(.018,.018,.10,10));
 const signMaps=[false,true].map(occupied=>{const map=texture(256,80,(c,w,h)=>{c.fillStyle='#f1efe0';c.fillRect(0,0,w,h);c.strokeStyle='#adad9d';c.lineWidth=5;c.strokeRect(3,3,w-6,h-6);c.fillStyle=occupied?'#c84231':'#51a54c';c.fillRect(8,8,95,h-16);c.fillStyle='#fffce6';c.font='bold 27px sans-serif';c.textAlign='center';c.fillText(occupied?'有人':'无人',55,49);c.fillStyle='#343b35';c.font='23px sans-serif';c.fillText('洗手间',178,35);c.font='16px sans-serif';c.fillText('Toilet',178,58);});textures.add(map);return material('#fff',{map,roughness:.75,side:T.DoubleSide});});
 const signGeo=own(new T.PlaneGeometry(.43,.134));
 const posterMap=texture(256,384,(c,w,h)=>{c.fillStyle='#ececdf';c.fillRect(0,0,w,h);c.strokeStyle='#343b36';c.lineWidth=5;c.strokeRect(8,8,w-16,h-16);c.beginPath();c.ellipse(130,130,58,33,0,0,Math.PI*2);c.stroke();c.strokeRect(146,45,42,65);c.beginPath();c.moveTo(92,145);c.lineTo(100,207);c.lineTo(150,207);c.lineTo(163,148);c.stroke();c.strokeStyle='#b73325';c.lineWidth=12;c.beginPath();c.arc(128,125,88,0,Math.PI*2);c.moveTo(66,62);c.lineTo(189,188);c.stroke();c.fillStyle='#252e29';c.font='bold 27px sans-serif';c.textAlign='center';for(const[t,y]of[['请勿往马桶里',278],['丢垃圾',320]])c.fillText(t,w/2,y);});textures.add(posterMap);const posterMat=material('#fff',{map:posterMap,roughness:.85,side:T.DoubleSide}),posterGeo=own(new T.PlaneGeometry(.39,.585));
 const seats=new Map(),cabinets=new Map(),doors=new Map();
 for(const s of TOILET_STALLS){
  const stall=new T.Group();stall.name='toilet-stall-'+s.id;stall.position.set(s.x,0,s.z);fixed.add(stall);
  for(const x of[-1.05,1.05]){box(panel,[x,1.04,0],[.045,1.72,2.38],null,stall);for(const z of[-1.19,1.19]){box(edge,[x,1.04,z],[.06,1.76,.055],null,stall);box(feet,[x,.115,z],[.065,.18,.07],null,stall);}box(edge,[x,1.92,0],[.06,.045,2.43],null,stall);}
  box(panel,[0,1.04,-1.19],[2.10,1.72,.045],null,stall);box(edge,[0,1.92,-1.19],[2.15,.045,.055],null,stall);
  for(const x of[-.99,.99])box(panel,[x,1.035,1.19],[.12,1.71,.045],null,stall);
  const fixture=new T.Group();fixture.name='toilet-fixture-'+s.id;fixture.position.set(-.18,0,-.48);stall.add(fixture);
  const supplied=placeFurniture67(fixture,'toilet');
  if(!supplied){
  render(pedestalGeo,porcelain,[0,0,0],fixture);render(bowlGeo,porcelain,[0,0,0],fixture);render(ringGeo,seatMat,[0,.46,0],fixture);
  const surface=render(waterGeo,water,[0,.252,-.015],fixture,[-Math.PI/2,0,0]);surface.castShadow=false;
  rounded(porcelain,[0,.66,-.47],[.61,.42,.28],.045,null,fixture);rounded(seatMat,[0,.875,-.47],[.64,.035,.31],.012,null,fixture);
  render(lidGeo,seatMat,[0,.90,-.295],fixture);
  for(const x of[-.13,.13])box(steel,[x,.485,-.30],[.055,.025,.08],null,fixture);
  rounded(steel,[.23,.84,-.31],[.07,.026,.04],.006,null,fixture);fixture.scale.setScalar(.76);
  }
  // Non-rendered anchors survive baking; callers raycast/seat against these
  // specific fixture targets rather than an ordinary chair or desktop.
  const seatTarget=new T.Object3D();seatTarget.name='toilet-seat-target-'+s.id;seatTarget.position.set(s.x-.18,.36,s.z-.48);group.add(seatTarget);
  const exitTarget=new T.Object3D();exitTarget.position.set(s.x-.18,0,s.z+1.68);group.add(exitTarget);
  const pick=render(own(new T.CylinderGeometry(.235,.235,.08,12)),new T.MeshBasicMaterial({visible:false}),[s.x-.18,.36,s.z-.48],group);materials.add(pick.material);pick.name='toilet-seat-pick-'+s.id;pick.userData={animated:true,seatId:s.id,interaction:'sit',kind:'toilet'};
  seats.set(s.id,{group:stall,toilet:pick,target:pick,fixture,seatTarget,exitTarget,...TOILET_SEATS[s.id]});
  const hinge=new T.Group();hinge.name='toilet-door-hinge-'+s.id;hinge.position.set(s.x+TOILET_DOOR.hingeX,0,s.z+TOILET_DOOR.hingeZ);group.add(hinge);
  const door=box(panel,[TOILET_DOOR.width/2,TOILET_DOOR.bottom+TOILET_DOOR.height/2,0],[TOILET_DOOR.width,TOILET_DOOR.height,TOILET_DOOR.depth],null,hinge);door.name='toilet-door-'+s.id;door.userData={animated:true,seatId:s.id,doorId:s.id,interaction:'cubicle-door'};
  for(const y of[.49,1.55])render(hingeGeo,steel,[.004,y,0],hinge);
  for(const side of[-1,1]){render(knobGeo,edge,[1.70,.91,side*.048],hinge);const plaque=render(signGeo,signMaps[0],[1.04,1.59,side*.027],hinge,[0,side<0?Math.PI:0,0]);plaque.name='toilet-occupancy-'+s.id+'-'+side;}
  render(posterGeo,posterMat,[.77,.91,-.026],hinge,[0,Math.PI,0]);
  hinge.traverse(o=>{o.userData.animated=true;});
  doors.set(s.id,{group:hinge,hinge,panel:door,target:door,open:0,openness:0,occupied:false,solids:()=>toiletDoorSolids(s.id,doors.get(s.id).open)});
  const c=TOILET_CABINET,cabinet=new T.Group();cabinet.name='toilet-cabinet-'+s.id;cabinet.position.set(s.x+c.x,0,s.z+c.z);fixed.add(cabinet);
  box(wood,[0,.66,-.16],[.43,1.12,.028],null,cabinet);
  for(const x of[-.202,.202])box(wood,[x,.66,0],[.026,1.12,.35],null,cabinet);
  for(const y of[.113,.65,1.207])box(y===.65?shelf:wood,[0,y,0],[.405,.026,.35],null,cabinet);
  const cabinetHinge=new T.Group();cabinetHinge.name='toilet-cabinet-door-hinge-'+s.id;cabinetHinge.position.set(s.x+c.x-c.width/2,0,s.z+c.z+c.depth/2+.012);group.add(cabinetHinge);
  const cabinetDoor=box(wood,[c.width/2,.66,0],[c.width,1.12,.028],null,cabinetHinge);cabinetDoor.userData={seatId:s.id,interaction:'cabinet',animated:true};cabinetDoor.name='toilet-cabinet-door-'+s.id;
  rounded(edge,[.31,.68,.024],[.105,.025,.035],.007,null,cabinetHinge);cabinetHinge.traverse(o=>o.userData.animated=true);
  const foodAnchor=new T.Group();foodAnchor.name='toilet-food-anchor-'+s.id;foodAnchor.position.set(s.x+c.x,.14,s.z+c.z);group.add(foodAnchor);
  const foodAnchors=[0,.537].map((y,i)=>{const anchor=new T.Object3D();anchor.name='toilet-food-shelf-'+s.id+'-'+i;anchor.position.set(0,y,0);foodAnchor.add(anchor);return anchor;});
  cabinets.set(s.id,{group:cabinet,door:cabinetHinge,panel:cabinetDoor,target:cabinetDoor,foodAnchor,foodAnchors,open:0,openness:0,solids:()=>toiletCabinetDoorSolids(s.id,cabinets.get(s.id).open)});
 }
 // Remember helper-owned meshes before batching, so disposal never frees a
 // geometry still shared with the main classroom or another map.
 fixed.traverse(o=>{if(o.isMesh&&!geometries.has(o.geometry))borrowedGeometry.add(o.geometry);});
 if(bakeStatic){bakeStatic(fixed);fixed.traverse(o=>{if(o.isMesh&&!borrowedGeometry.has(o.geometry))geometries.add(o.geometry);});}
 let disposed=false;
 return{group,seats,cabinets,doors,solids:TOILET_SOLIDS,
  update(state={},dt=0){
   if(disposed)return;const people=[...(state.students||[]),...(state.player?[state.player]:[])];const occupied=new Set(people.filter(p=>p.seated&&!p.caught&&!p.officeChair).map(p=>p.seatId));
   for(const[id,d]of doors){const doorState=getState(state.toiletDoors,id);d.open=typeof doorState==='number'?doorState:damp(d.open,doorState?1:0,dt);d.openness=d.open;d.hinge.rotation.y=TOILET_DOOR.angle*d.open;const isOccupied=occupied.has(id);if(isOccupied!==d.occupied){d.occupied=isOccupied;d.hinge.traverse(o=>{if(o.name.startsWith('toilet-occupancy-'))o.material=signMaps[Number(isOccupied)];});}}
   for(const[id,c]of cabinets){const local=state.player?.seated&&state.player.seatId===id&&state.drawer?.open,remote=people.some(p=>p.seated&&p.seatId===id&&(p.drawerOpen??p.drawer?.open));const cabinetState=getState(state.toiletCabinets,id,local||remote);c.open=typeof cabinetState==='number'?cabinetState:damp(c.open,cabinetState?1:0,dt);c.openness=c.open;c.door.rotation.y=TOILET_CABINET.doorAngle*c.open;}
  },
  dynamicSolids(){return[...doors].flatMap(([id,d])=>toiletDoorSolids(id,d.open)).concat([...cabinets].flatMap(([id,c])=>toiletCabinetDoorSolids(id,c.open)));},
  dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
 };
}
