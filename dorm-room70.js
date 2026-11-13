import * as T from './vendor/three.module.js';
import {DORM_BUNKS,DORM_BEDS,DORM_SEATS,DORM_SOLIDS,DORM_WALK_SOLIDS,DORM_CABINET,dormCabinetDoorPose,dormCabinetDoorSolids} from './dorm-layout70.js?v=campus-75';
export * from './dorm-layout70.js?v=campus-75';

const stateValue=(source,id,fallback)=>{const entry=source instanceof Map?source.get(id):source?.[id];return entry==null?fallback:typeof entry==='number'?Math.max(0,Math.min(1,entry)):typeof entry==='object'?!!entry.open:!!entry;};
const damp=(a,b,dt)=>a+(b-a)*(1-Math.exp(-10*Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0))));
function quiltGeometry(){
 const g=new T.PlaneGeometry(1.74,1.25,20,14);g.rotateX(-Math.PI/2);const p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),edge=Math.pow(Math.abs(z)/.625,8);p.setY(i,.010*Math.sin(x*9+.7)*Math.cos(z*3)+.006*Math.sin(z*15+x*3)-.044*edge);}
 g.computeVertexNormals();return g;
}

export function createDormRoom({parent,box,rounded,mat,texture,bakeStatic}){
 const group=new T.Group();group.name='dorm-classroom-furniture';parent.add(group);
 const fixed=new T.Group();fixed.name='dorm-fixed-furniture';group.add(fixed);
 const geometries=new Set(),materials=new Set(),textures=new Set(),borrowed=new Set();
 const own=g=>(geometries.add(g),g),material=(c,o={})=>{const m=mat(c,o);materials.add(m);return m;};
 const render=(g,m,p,root=fixed,r=null)=>{const o=new T.Mesh(g,m);o.position.set(...p);if(r)o.rotation.set(...r);o.castShadow=o.receiveShadow=true;root.add(o);return o;};
 const woodMap=texture(256,512,(c,w,h)=>{c.fillStyle='#a57843';c.fillRect(0,0,w,h);for(let i=0;i<96;i++){const x=(i*37.71)%w;c.strokeStyle=i%4?'rgba(74,44,21,.10)':'rgba(246,211,150,.15)';c.lineWidth=.7+(i%3)*.4;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+Math.sin(i)*4,h*.3,x+Math.cos(i)*5,h*.7,x,h);c.stroke();}});textures.add(woodMap);
 const plaidMap=texture(512,512,(c,w,h)=>{c.fillStyle='#839699';c.fillRect(0,0,w,h);for(let i=0;i<4;i++){const n=i*128;c.fillStyle='rgba(204,204,180,.42)';c.fillRect(n+8,0,49,h);c.fillRect(0,n+8,w,49);c.fillStyle='rgba(25,46,53,.68)';c.fillRect(n+72,0,24,h);c.fillRect(0,n+72,w,24);c.fillStyle='rgba(9,27,36,.80)';c.fillRect(n+101,0,5,h);c.fillRect(0,n+101,w,5);c.fillStyle='rgba(220,221,198,.72)';c.fillRect(n+111,0,3,h);c.fillRect(0,n+111,w,3);}for(let y=0;y<h;y+=4){c.fillStyle=y%8?'rgba(230,230,213,.045)':'rgba(15,34,38,.055)';c.fillRect(0,y,w,1);}});textures.add(plaidMap);
 const wood=material('#fff',{map:woodMap,roughness:.68}),endWood=material('#80613d',{roughness:.71}),recess=material('#594a36',{roughness:.82}),bracket=material('#55594f',{metalness:.38,roughness:.55}),cloth=material('#fff',{map:plaidMap,roughness:.96,side:T.DoubleSide}),mattressMat=material('#9baca9',{map:plaidMap,roughness:.94}),pillowMat=material('#a4b3b1',{roughness:.98}),pipingMat=material('#516268',{roughness:.91});
 const floorMap=texture(512,512,(c,w,h)=>{c.fillStyle='#6b4329';c.fillRect(0,0,w,h);for(let r=0;r<8;r++){const y=r*64;c.fillStyle=r%3===0?'#895733':r%3===1?'#754829':'#9a6136';c.fillRect(0,y+1,w,62);for(let i=0;i<20;i++){c.strokeStyle=i%4?'rgba(52,29,17,.10)':'rgba(220,162,95,.13)';c.lineWidth=.7;c.beginPath();c.moveTo(0,y+5+i*2.7);c.bezierCurveTo(150,y+5+i*2.7+2,340,y+5+i*2.7-2,w,y+5+i*2.7);c.stroke();}c.fillStyle='#513827';c.fillRect((r%3)*137+38,y,1,64);}});textures.add(floorMap);floorMap.wrapS=floorMap.wrapT=T.RepeatWrapping;floorMap.repeat.set(4.5,5.2);
 const floor=render(own(new T.PlaneGeometry(13.78,16.38)),material('#fff',{map:floorMap,roughness:.70}),[.275,.009,-1.79],fixed,[-Math.PI/2,0,0]);floor.name='dorm-wood-floor';floor.castShadow=false;
 const ceiling=render(own(new T.PlaneGeometry(13.78,16.38)),material('#172525',{roughness:.94,side:T.DoubleSide}),[.275,4.487,-1.79],fixed,[Math.PI/2,0,0]);ceiling.name='dorm-dark-ceiling';ceiling.castShadow=false;
 const quilt=own(quiltGeometry()),screwGeo=own(new T.CylinderGeometry(.018,.018,.008,8)),pickGeo=own(new T.BoxGeometry(2.27,.10,1.18)),pickMaterial=new T.MeshBasicMaterial({visible:false});materials.add(pickMaterial);
 const beds=new Map(),cabinets=new Map();
 for(const b of DORM_BUNKS){
  const frame=new T.Group();frame.name='dorm-bunk-'+b.id;frame.position.set(b.x,0,b.z);fixed.add(frame);
  // Stack the two personal cupboards on a continuous wooden pedestal, as
  // seen beside the bunks; the upper cupboard must not float in the gap.
  box(wood,[DORM_CABINET.x,.11,DORM_CABINET.z],[DORM_CABINET.width,.22,DORM_CABINET.depth],null,frame);
  box(wood,[DORM_CABINET.x,1.48,DORM_CABINET.z],[DORM_CABINET.width,.36,DORM_CABINET.depth],null,frame);
  for(const x of[-1.22,1.22])for(const z of[-.65,.65]){box(wood,[x,1.3275,z],[.12,2.605,.10],null,frame);box(endWood,[x,.05,z],[.125,.10,.105],null,frame);}
  for(const level of[0,1]){
   const base=level*1.44,bed=DORM_BEDS[b.id*2+level];
   for(const z of[-.65,.65])box(wood,[0,.445+base,z],[2.46,.15,.075],null,frame);
   for(const x of[-1.22,1.22]){box(wood,[x,.445+base,0],[.10,.15,1.30],null,frame);box(wood,[x,.955+base,0],[.10,.11,1.30],null,frame);box(endWood,[x,.76+base,0],[.065,.07,1.25],null,frame);}
   box(endWood,[0,.402+base,0],[2.34,.04,1.23],null,frame);
   rounded(mattressMat,[0,.53+base,0],[2.34,.14,1.23],.025,null,frame);
   const cover=render(quilt,cloth,[.25,.632+base,0],frame);cover.name='dorm-plaid-blanket-'+bed.id;
   rounded(pillowMat,[-.83,.668+base,0],[.49,.135,.94],.06,null,frame);
   rounded(pipingMat,[-.83,.621+base,0],[.50,.022,.945],.01,null,frame);
   // A folded edge at the shoulder rather than a flat plaid texture alone.
   rounded(cloth,[-.585,.648+base,0],[.13,.038,1.23],.014,null,frame);
   const target=render(pickGeo,pickMaterial,[b.x,bed.supportHeight-.05,b.z],group);target.name='dorm-bed-target-'+bed.id;target.userData={animated:true,bedId:bed.id,seatId:bed.id,interaction:'bed',kind:'dorm'};
   const seatTarget=new T.Object3D();seatTarget.name='dorm-seat-anchor-'+bed.id;seatTarget.position.set(bed.x,bed.supportHeight,bed.z);group.add(seatTarget);
   const lieTarget=new T.Object3D();lieTarget.position.set(bed.lieX,bed.supportHeight,bed.lieZ);lieTarget.rotation.y=bed.lieYaw;group.add(lieTarget);
   const exitTarget=new T.Object3D();exitTarget.position.set(bed.exitX,0,bed.exitZ);group.add(exitTarget);
   beds.set(bed.id,{...bed,group:frame,target,bed:target,seatTarget,lieTarget,exitTarget});
  }
  box(wood,[0,2.405,-.65],[2.44,.11,.07],null,frame);box(wood,[-.34,2.405,.65],[1.76,.11,.07],null,frame);
  for(const x of[-1.22,-.54,.54,1.22])box(wood,[x,2.245,-.65],[.055,.30,.06],null,frame);
  for(const x of[-1.22,-.54,.50])box(wood,[x,2.245,.65],[.055,.30,.06],null,frame);
  for(const x of[.63,1.14])box(wood,[x,1.25,.80],[.07,2.45,.09],[-.038,0,0],frame);
  for(let n=0;n<7;n++)box(endWood,[.885,.25+n*.31,.80],[.50,.07,.12],null,frame);
  for(const z of[-.705,.705])for(const x of[-1.22,1.22])for(const y of[.445,1.885,2.405])render(screwGeo,bracket,[x,y,z],frame,[Math.PI/2,0,0]);
 }
 for(const bed of DORM_BEDS){
  const c=DORM_CABINET,y=bed.cabinetY,cabinet=new T.Group();cabinet.name='dorm-cabinet-'+bed.id;cabinet.position.set(bed.cabinetX,y,bed.cabinetZ);fixed.add(cabinet);
  box(wood,[0,c.height/2,-c.depth/2+.017],[c.width,c.height,.034],null,cabinet);
  for(const x of[-c.width/2+.017,c.width/2-.017])box(wood,[x,c.height/2,0],[.034,c.height,c.depth],null,cabinet);
  for(const shelfY of[.017,c.height-.017])box(wood,[0,shelfY,0],[c.width,.034,c.depth],null,cabinet);
  // The open interior stays genuinely hollow; the source shows food on this shelf.
  box(recess,[0,.039,0],[c.width-.07,.008,c.depth-.06],null,cabinet);
  const pose=dormCabinetDoorPose(bed.id),door=new T.Group();door.name='dorm-cabinet-hinge-'+bed.id;door.position.set(pose.x,pose.y,pose.z);group.add(door);
  const panel=box(wood,[c.width/2,c.height/2,0],[c.width,c.height,.035],null,door);panel.name='dorm-cabinet-door-'+bed.id;panel.userData={animated:true,bedId:bed.id,seatId:bed.id,cabinetId:bed.id,interaction:'cabinet'};
  for(const x of[.04,c.width-.04])box(endWood,[x,c.height/2,.020],[.025,c.height-.05,.009],null,door);
  rounded(bracket,[c.width-.14,c.height*.53,.041],[.13,.025,.035],.008,null,door);
  door.traverse(o=>{o.userData.animated=true;});
  const foodAnchor=new T.Group();foodAnchor.name='dorm-food-anchor-'+bed.id;foodAnchor.position.set(bed.cabinetX,bed.foodY,bed.cabinetZ);group.add(foodAnchor);
  cabinets.set(bed.id,{group:cabinet,door,panel,target:panel,foodAnchor,foodAnchors:[foodAnchor],open:0,openness:0,bedId:bed.id,solids:()=>dormCabinetDoorSolids(bed.id,cabinets.get(bed.id).open)});
 }
 fixed.traverse(o=>{if(o.isMesh&&!geometries.has(o.geometry))borrowed.add(o.geometry);});
 if(bakeStatic){bakeStatic(fixed);fixed.traverse(o=>{if(o.isMesh&&!borrowed.has(o.geometry))geometries.add(o.geometry);});}
 let disposed=false;
 return{group,beds,seats:beds,cabinets,solids:DORM_SOLIDS,walkSolids:DORM_WALK_SOLIDS,
  update(state={},dt=0){
   if(disposed)return;const people=[...(state.students||[]),...(state.player?[state.player]:[])];
   for(const[id,c]of cabinets){const local=(state.player?.bedId??state.player?.seatId)===id&&state.player?.seated&&state.drawer?.open,remote=people.some(p=>(p.bedId??p.seatId)===id&&p.seated&&(p.drawerOpen??p.drawer?.open));const cabinetState=stateValue(state.dormCabinets,id,!!(local||remote));c.open=typeof cabinetState==='number'?cabinetState:damp(c.open,cabinetState?1:0,dt);c.openness=c.open;c.door.rotation.y=DORM_CABINET.doorAngle*c.open;}
  },
  dynamicSolids(){return[...cabinets].flatMap(([id,c])=>dormCabinetDoorSolids(id,c.open));},
  dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
 };
}
