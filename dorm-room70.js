import * as T from './vendor/three.module.js';
import {DORM_BUNKS,DORM_BEDS,DORM_SEATS,DORM_SOLIDS,DORM_WALK_SOLIDS,DORM_CABINET,DORM_BOUNDS,DORM_SHELL_SOLIDS,DORM_CEILING,DORM_TABLE,dormPoint,dormCabinetDoorPose,dormCabinetDoorSolids} from './dorm-layout70.js?v=campus-77';
export * from './dorm-layout70.js?v=campus-77';

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
 const woodMap=texture(256,512,(c,w,h)=>{c.fillStyle='#b2a17b';c.fillRect(0,0,w,h);for(let i=0;i<96;i++){const x=(i*37.71)%w;c.strokeStyle=i%4?'rgba(74,44,21,.10)':'rgba(246,211,150,.15)';c.lineWidth=.7+(i%3)*.4;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+Math.sin(i)*4,h*.3,x+Math.cos(i)*5,h*.7,x,h);c.stroke();}});textures.add(woodMap);
 const plaidMap=texture(512,512,(c,w,h)=>{c.fillStyle='#839699';c.fillRect(0,0,w,h);for(let i=0;i<4;i++){const n=i*128;c.fillStyle='rgba(204,204,180,.42)';c.fillRect(n+8,0,49,h);c.fillRect(0,n+8,w,49);c.fillStyle='rgba(25,46,53,.68)';c.fillRect(n+72,0,24,h);c.fillRect(0,n+72,w,24);c.fillStyle='rgba(9,27,36,.80)';c.fillRect(n+101,0,5,h);c.fillRect(0,n+101,w,5);c.fillStyle='rgba(220,221,198,.72)';c.fillRect(n+111,0,3,h);c.fillRect(0,n+111,w,3);}for(let y=0;y<h;y+=4){c.fillStyle=y%8?'rgba(230,230,213,.045)':'rgba(15,34,38,.055)';c.fillRect(0,y,w,1);}});textures.add(plaidMap);
 const wood=material('#fff',{map:woodMap,bumpMap:woodMap,bumpScale:.0015,roughness:.68}),endWood=material('#95886b',{roughness:.71}),recess=material('#594a36',{roughness:.82}),bracket=material('#55594f',{metalness:.38,roughness:.55}),cloth=material('#fff',{map:plaidMap,roughness:.96,side:T.DoubleSide}),mattressMat=material('#9baca9',{map:plaidMap,roughness:.94}),pillowMat=material('#a4b3b1',{roughness:.98}),pipingMat=material('#516268',{roughness:.91});
 // A separate enclosed dormitory, not the classroom shell with beds pasted in.
 const floorMap=texture(512,512,(c,w,h)=>{c.fillStyle='#929d9e';c.fillRect(0,0,w,h);let seed=801;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);for(let i=0;i<2400;i++){const x=rand()*w,y=rand()*h,size=1+rand()*3;c.fillStyle=['#b7bdb8','#748282','#c4c6bc','#818d8b'][i%4];c.beginPath();c.moveTo(x,y);c.lineTo(x+size,y+.4);c.lineTo(x+size*.4,y+size);c.closePath();c.fill();}c.strokeStyle='#7e8988';c.lineWidth=1;c.strokeRect(.5,.5,w-1,h-1);});textures.add(floorMap);floorMap.wrapS=floorMap.wrapT=T.RepeatWrapping;floorMap.repeat.set(4,9);
 const plasterMap=texture(256,256,(c,w,h)=>{c.fillStyle='#dfdaca';c.fillRect(0,0,w,h);for(let i=0;i<1800;i++){c.fillStyle=i%2?'rgba(95,95,81,.035)':'rgba(255,255,245,.05)';c.fillRect((i*83.7)%w,(i*37.41)%h,1+i%3,1);}});textures.add(plasterMap);
 const plaster=material('#fff',{map:plasterMap,roughness:.92}),trim=material('#5b7f79',{roughness:.72}),paint=material('#a8bdb9',{roughness:.62}),steel=material('#a2b0a6',{metalness:.28,roughness:.55}),blue=material('#497d83',{roughness:.68}),curtainMat=material('#43878b',{roughness:.96,side:T.DoubleSide});
 const bounds=DORM_BOUNDS,w=bounds.maxX-bounds.minX,d=bounds.maxZ-bounds.minZ,cx=(bounds.minX+bounds.maxX)/2,cz=(bounds.minZ+bounds.maxZ)/2;
 const floor=render(own(new T.PlaneGeometry(w,d)),material('#fff',{map:floorMap,roughness:.88}),[cx,.009,cz],fixed,[-Math.PI/2,0,0]);floor.name='dorm-terrazzo-floor';floor.castShadow=false;
 for(const wall of DORM_SHELL_SOLIDS){const m=box(plaster,[(wall.minX+wall.maxX)/2,(wall.minY+wall.maxY)/2,(wall.minZ+wall.maxZ)/2],[wall.maxX-wall.minX,wall.maxY-wall.minY,wall.maxZ-wall.minZ],null,fixed);m.name=wall.id;}
 for(const z of[-8.84,-7.16])box(blue,[7.29,1.53,z],[.23,3.06,.065],null,fixed);box(blue,[7.29,3.065,-8],[.23,.07,1.74],null,fixed);
 const c=DORM_CEILING;box(material('#677371',{roughness:.96}),[(c.minX+c.maxX)/2,(c.minY+c.maxY)/2,(c.minZ+c.maxZ)/2],[c.maxX-c.minX,c.maxY-c.minY,c.maxZ-c.minZ],null,fixed).name='dorm-ceiling';
 for(const x of[1.015,7.185])box(trim,[x,.09,cz],[.03,.18,d],null,fixed);
 box(trim,[cx,.09,4.585],[w,.18,.03],null,fixed);box(trim,[cx,.09,-9.985],[w,.18,.03],null,fixed);
 // End window visible down the narrow passage; frosted moon-blue panes, folded curtains.
 const windowGroup=new T.Group();windowGroup.name='dorm-end-window';windowGroup.position.set(cx,1.99,4.47);fixed.add(windowGroup);
 box(blue,[0,0,0],[3.38,2.12,.12],null,windowGroup);
 const pane=material('#659098',{roughness:.54,emissive:'#344c68',emissiveIntensity:.08});
 for(const x of[-.81,.81])for(const y of[-.45,.46])box(pane,[x,y,-.073],[1.53,.84,.025],null,windowGroup);
 box(paint,[0,0,-.103],[.045,2.02,.04],null,windowGroup);box(paint,[0,0,-.106],[3.28,.045,.045],null,windowGroup);box(paint,[0,-1.08,-.03],[3.53,.07,.28],null,windowGroup);
 for(const x of[-1.82,1.82]){const g=own(new T.PlaneGeometry(.58,2.48,18,1)),a=g.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,.042*Math.cos(a.getX(i)*57));g.computeVertexNormals();render(g,curtainMat,[x,-.08,-.18],windowGroup);}
 box(steel,[0,1.24,-.16],[4.26,.035,.035],null,windowGroup);
 // A small table and thermos are visible in the inspection doorway shot.
 const table=new T.Group();table.name='dorm-centre-table';table.position.set(DORM_TABLE.x,0,DORM_TABLE.z);fixed.add(table);
 rounded(wood,[0,.7575,0],[DORM_TABLE.width,.045,DORM_TABLE.depth],.009,null,table);
 for(const x of[-.445,.445])for(const z of[-.65,.65])box(paint,[x,.3675,z],[.044,.735,.044],null,table);
 for(const x of[-.445,.445])box(paint,[x,.19,0],[.04,.035,1.30],null,table);
 const bottleGeo=own(new T.CylinderGeometry(.083,.095,.34,16)),capGeo=own(new T.CylinderGeometry(.071,.071,.065,16)),cupGeo=own(new T.CylinderGeometry(.046,.038,.073,12,1,true)),aqua=material('#28969c',{roughness:.42,metalness:.12});
 render(bottleGeo,aqua,[-.24,.95,-.28],table);render(capGeo,steel,[-.24,1.1525,-.28],table);
 const handle=own(new T.TorusGeometry(.07,.012,5,12,Math.PI*1.6));render(handle,aqua,[-.34,.98,-.28],table,[0,0,.6]);
 for(const x of[.12,.30]){render(cupGeo,pillowMat,[x,.817,-.17],table);render(own(new T.CylinderGeometry(.037,.037,.006,12)),pillowMat,[x,.784,-.17],table);}
 // Wall-mounted AC and dark tube fixtures, all inside the new ceiling height.
 rounded(paint,[1.14,2.97,-7.33],[.25,.39,1.16],.03,null,fixed).name='dorm-air-conditioner';
 for(let k=0;k<5;k++)box(trim,[1.273,2.84+k*.019,-7.33],[.012,.009,.94],null,fixed);
 for(const z of[-4.25,.65]){box(paint,[cx,3.405,z],[.23,.07,1.29],null,fixed);box(material('#b0b6ab',{roughness:.65}),[cx,3.362,z],[.115,.016,1.12],null,fixed);}
 const quilt=own(quiltGeometry()),screwGeo=own(new T.CylinderGeometry(.018,.018,.008,8)),pickGeo=own(new T.BoxGeometry(2.27,.10,1.18)),pickMaterial=new T.MeshBasicMaterial({visible:false});materials.add(pickMaterial);
 const beds=new Map(),cabinets=new Map();
 for(const b of DORM_BUNKS){
  const frame=new T.Group();frame.name='dorm-bunk-'+b.id;frame.position.set(b.x,0,b.z);frame.rotation.y=b.yaw;fixed.add(frame);
  // Stack the two personal cupboards on a continuous wooden pedestal, as
  // seen beside the bunks; the upper cupboard must not float in the gap.
  box(wood,[DORM_CABINET.x,DORM_CABINET.bottom/2,DORM_CABINET.z],[DORM_CABINET.depth,DORM_CABINET.bottom,DORM_CABINET.width],null,frame);
  box(wood,[DORM_CABINET.x,2.21,DORM_CABINET.z],[DORM_CABINET.depth,.54,DORM_CABINET.width],null,frame);
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
   const target=new T.Group();target.name='dorm-bed-target-'+bed.id;target.userData={animated:true,bedId:bed.id,seatId:bed.id,interaction:'bed',kind:'dorm'};group.add(target);
   const mattressTarget=render(pickGeo,pickMaterial,[b.x,bed.supportHeight-.05,b.z],target);mattressTarget.rotation.y=b.yaw;
   // The visible ladder provides aisle access to the upper bunk; the solid
   // platform otherwise correctly occludes a target inside the mattress.
   if(level){const ladder=dormPoint(b,.885,.86),access=render(own(new T.BoxGeometry(.52,1.38,.13)),pickMaterial,[ladder.x,1.42,ladder.z],target);access.rotation.y=b.yaw;access.name='dorm-upper-ladder-target-'+bed.id;access.userData={...target.userData};}
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
  if(b.row!==1){const towelGeo=own(new T.PlaneGeometry(.35,.53,8,10)),p=towelGeo.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,.014*Math.cos(p.getX(i)*38)+.01*Math.sin(p.getY(i)*10));towelGeo.computeVertexNormals();render(towelGeo,curtainMat,[-.74,2.13,.70],frame);}
  for(const z of[-.705,.705])for(const x of[-1.22,1.22])for(const y of[.445,1.885,2.405])render(screwGeo,bracket,[x,y,z],frame,[Math.PI/2,0,0]);
 }
 for(const bed of DORM_BEDS){
  const c=DORM_CABINET,y=bed.cabinetY,cabinet=new T.Group();cabinet.name='dorm-cabinet-'+bed.id;cabinet.position.set(bed.cabinetX,y,bed.cabinetZ);cabinet.rotation.y=bed.cabinetYaw;fixed.add(cabinet);
  box(wood,[0,c.height/2,-c.depth/2+.017],[c.width,c.height,.034],null,cabinet);
  for(const x of[-c.width/2+.017,c.width/2-.017])box(wood,[x,c.height/2,0],[.034,c.height,c.depth],null,cabinet);
  for(const shelfY of[.017,c.height-.017])box(wood,[0,shelfY,0],[c.width,.034,c.depth],null,cabinet);
  // The open interior stays genuinely hollow; the source shows food on this shelf.
  box(recess,[0,.039,0],[c.width-.07,.008,c.depth-.06],null,cabinet);
  const pose=dormCabinetDoorPose(bed.id),door=new T.Group();door.name='dorm-cabinet-hinge-'+bed.id;door.position.set(pose.x,pose.y,pose.z);door.rotation.y=pose.angle;group.add(door);
  const panel=box(wood,[c.width/2,c.height/2,0],[c.width,c.height,.035],null,door);panel.name='dorm-cabinet-door-'+bed.id;panel.userData={animated:true,bedId:bed.id,seatId:bed.id,cabinetId:bed.id,interaction:'cabinet'};
  for(const x of[.04,c.width-.04])box(endWood,[x,c.height/2,.020],[.025,c.height-.05,.009],null,door);
  rounded(bracket,[c.width-.14,c.height*.53,.041],[.13,.025,.035],.008,null,door);
  door.traverse(o=>{o.userData.animated=true;});
  const foodAnchor=new T.Group();foodAnchor.name='dorm-food-anchor-'+bed.id;foodAnchor.position.set(bed.cabinetX,bed.foodY,bed.cabinetZ);foodAnchor.rotation.y=bed.cabinetYaw;group.add(foodAnchor);
  cabinets.set(bed.id,{group:cabinet,door,panel,target:panel,foodAnchor,foodAnchors:[foodAnchor],open:0,openness:0,bedId:bed.id,solids:()=>dormCabinetDoorSolids(bed.id,cabinets.get(bed.id).open)});
 }
 fixed.traverse(o=>{if(o.isMesh&&!geometries.has(o.geometry))borrowed.add(o.geometry);});
 if(bakeStatic){bakeStatic(fixed);fixed.traverse(o=>{if(o.isMesh&&!borrowed.has(o.geometry))geometries.add(o.geometry);});}
 let disposed=false;
 return{group,beds,seats:beds,cabinets,solids:DORM_SOLIDS,walkSolids:DORM_WALK_SOLIDS,
  update(state={},dt=0){
   if(disposed)return;const people=[...(state.students||[]),...(state.player?[state.player]:[])];
   for(const[id,c]of cabinets){const local=(state.player?.bedId??state.player?.seatId)===id&&state.player?.seated&&state.drawer?.open,remote=people.some(p=>(p.bedId??p.seatId)===id&&p.seated&&(p.drawerOpen??p.drawer?.open));const cabinetState=stateValue(state.dormCabinets,id,!!(local||remote));c.open=typeof cabinetState==='number'?cabinetState:damp(c.open,cabinetState?1:0,dt);c.openness=c.open;c.door.rotation.y=dormCabinetDoorPose(id,c.open).angle;}
  },
  dynamicSolids(){return[...cabinets].flatMap(([id,c])=>dormCabinetDoorSolids(id,c.open));},
  dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
 };
}
