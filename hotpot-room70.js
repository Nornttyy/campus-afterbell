import {hotpotFood,setDish} from './hotpot-food94.js?v=campus-94';
import * as T from './vendor/three.module.js';

import {CORRIDOR,PARTITIONS,ALCOVE_ENTRY} from './classroom-layout.js?v=campus-117&rev=126';
import {diningPlanForSeats} from './hotpot-layout70.js?v=campus-94';
export {HOTPOT_TABLE_SIZE,HOTPOT_TABLE_HEIGHT,HOTPOT_TABLES,HOTPOT_SEATS,HOTPOT_SCREENS,HOTPOT_SOLIDS} from './hotpot-layout70.js?v=campus-94';

function chamferedSlab(width,depth,height,cut){
 const x=width/2,z=depth/2,s=new T.Shape();s.moveTo(-x+cut,-z);s.lineTo(x-cut,-z);s.lineTo(x,-z+cut);s.lineTo(x,z-cut);s.lineTo(x-cut,z);s.lineTo(-x+cut,z);s.lineTo(-x,z-cut);s.lineTo(-x,-z+cut);s.closePath();
 const g=new T.ExtrudeGeometry(s,{depth:height,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:1,steps:1,curveSegments:1});g.translate(0,0,-height/2);g.rotateX(-Math.PI/2);return g;
}
// Each burner drives its own two rising wisps, all from one shader and one quad per pot.
const steamVertex=`uniform float uTime; varying vec2 vUv; varying float phase;
 void main(){
  vUv=uv; phase=dot(modelMatrix[3].xz,vec2(2.73,1.19));
  vec4 center=modelViewMatrix*vec4(0.,0.,0.,1.);
  vec2 sheet=position.xy;
  sheet.x+=uv.y*uv.y*.083*sin(uTime*.87+phase+uv.y*3.);
  center.xy+=sheet; gl_Position=projectionMatrix*center;
 }`;
const steamFragment=`uniform float uTime; varying vec2 vUv; varying float phase;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
 void main(){
  float h=vUv.y,t=uTime+phase;
  float curl=.075*sin(h*9.-t*1.1)+.05*sin(h*14.-t*.8);
  float width=.065+.17*h;
  vec2 offsets=(vec2(vUv.x-.36,vUv.x-.62)+vec2(curl,-curl*.78)*h)/width;
  vec2 ribbons=exp(-offsets*offsets);
  float cloud=noise(vec2(vUv.x*7.+phase,h*6.-t*.9));
  float fade=smoothstep(0.,.09,h)*(1.-smoothstep(.44,1.,h));
  gl_FragColor=vec4(.94,.94,.89,dot(ribbons,vec2(.16,.12))*fade*(.18+cloud));
 }`;

export function createHotpotRoom({parent,box,rounded,mat,texture,bakeStatic,finishes={},menus=null,seats=null}){
 const plan=diningPlanForSeats(seats);
 const group=new T.Group();group.name='hotpot-classroom-furniture';parent.add(group);
 const fixed=new T.Group();fixed.name='hotpot-fixed-furniture';group.add(fixed);
 const ownedGeometries=new Set(),ownedMaterials=new Set(),ownedTextures=new Set();
 const ownGeometry=g=>(ownedGeometries.add(g),g),material=(color,extra={})=>{const m=mat(color,extra);ownedMaterials.add(m);return m;};
 const render=(geo,m,p,root=fixed,rotation=null)=>{const mesh=new T.Mesh(geo,m);mesh.position.set(...p);if(rotation)mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
 const grain=texture(512,256,(c,w,h)=>{c.fillStyle='#dda63e';c.fillRect(0,0,w,h);for(let i=0;i<112;i++){const y=(i*37.71)%h;c.strokeStyle=i%3?'rgba(126,64,19,.085)':'rgba(255,226,142,.16)';c.lineWidth=.5+(i%4)*.36;c.beginPath();c.moveTo(0,y);c.bezierCurveTo(w*.25,y+Math.sin(i)*4,w*.7,y+Math.cos(i)*5,w,y+Math.sin(i*.7)*3);c.stroke();}});ownedTextures.add(grain);grain.wrapS=grain.wrapT=T.RepeatWrapping;
 const wood=material(finishes.veneer?'#d3b49a':'#ffffff',{map:finishes.veneer||grain,roughness:.46}),edge=material('#a35d21',{roughness:.56}),pedestal=material('#8d391f',{roughness:.61}),screenWood=material('#985723',{roughness:.58}),screenLight=material('#bb7830',{roughness:.57}),steel=material('#b4afa0',{metalness:.62,roughness:.34}),silver=material('#d3cfc0',{metalness:.68,roughness:.29}),broth=material(finishes.broth?'#ffffff':'#a61713',{map:finishes.broth||null,roughness:.31,metalness:.03}),oil=material('#c77c35',{roughness:.24}),cabbage=material('#e8d9a0',{roughness:.67}),greens=material('#6e8d38',{roughness:.68});
 const soupTime={value:0};broth.onBeforeCompile=shader=>{shader.uniforms.hotpotTime=soupTime;shader.vertexShader='uniform float hotpotTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.z += .0016 * sin(uv.x*19. + hotpotTime*1.5) * cos(uv.y*17. - hotpotTime);');};broth.customProgramCacheKey=()=> 'hotpot-broth70';
 const tops=new Map(plan.tables.map(t=>t.size).filter((s,i,a)=>a.indexOf(s)===i).map(size=>[size,ownGeometry(chamferedSlab(size-.016,size-.016,.040,.13))]));
 const footGeo=ownGeometry(chamferedSlab(1.40,1.40,.10,.24)),capGeo=ownGeometry(chamferedSlab(.98,.98,.14,.17)),neckGeo=ownGeometry(new T.CylinderGeometry(.49,.64,.54,8)),bowlGeo=ownGeometry(new T.LatheGeometry([[0,0],[.58,0],[.65,.027],[.72,.13],[.765,.245],[.761,.265],[.735,.265],[.705,.135],[.63,.055],[.56,.028],[0,.028]].map(([x,y])=>new T.Vector2(x,y)),48)),rimGeo=ownGeometry(new T.TorusGeometry(.748,.015,6,48)),soupGeo=ownGeometry(new T.CircleGeometry(.719,48)),oilGeo=ownGeometry(new T.CircleGeometry(.028,8));
 const chilli=material('#9a2e1b',{roughness:.47}),leek=material('#799344',{roughness:.70});
 const pepper=ownGeometry(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-.044,0,-.009),new T.Vector3(0,.006,.008),new T.Vector3(.047,.001,.002)]),5,.009,5,false));
 const scallion=ownGeometry(new T.TorusGeometry(.014,.0045,4,8));
 const noodleGeo=ownGeometry(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-.11,0,0),new T.Vector3(-.04,.008,.03),new T.Vector3(.035,.012,-.02),new T.Vector3(.12,0,.018)]),8,.014,4,false));
 const steamGeo=ownGeometry(new T.PlaneGeometry(.65,1.18,1,1));const steamMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,uniforms:{uTime:{value:0}},vertexShader:steamVertex,fragmentShader:steamFragment});ownedMaterials.add(steamMaterial);
 const steam=[],targets=[],pieces=new Map();
 const pickGeometry=ownGeometry(new T.CircleGeometry(.73,32)),pickMaterial=new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false,side:T.DoubleSide});ownedMaterials.add(pickMaterial);
 for(const t of plan.tables){
  const table=new T.Group();table.name='hotpot-table-'+t.id;table.position.set(t.x,0,t.z);fixed.add(table);
  render(tops.get(t.size),wood,[0,.847,0],table);
  // Keep four real drawer openings under the shared top, not a solid apron
  // passing through the imported sliding drawers (whose top is .8104m).
  for(const side of[-1,1])for(const corner of[-t.size/2+.135,t.size/2-.135]){box(edge,[corner,.767,side*(t.size/2-.065)],[.24,.11,.06],null,table);box(edge,[side*(t.size/2-.065),.767,corner],[.06,.11,.24],null,table);}render(footGeo,pedestal,[0,.061,0],table);render(neckGeo,pedestal,[0,.370,0],table);render(capGeo,edge,[0,.700,0],table);box(edge,[0,.801,0],[.84,.052,.84],null,table);
  const pot=new T.Group();pot.name='hotpot-pot-'+t.id;pot.position.y=.875;table.add(pot);render(bowlGeo,steel,[0,0,0],pot);render(rimGeo,silver,[0,.257,0],pot,[Math.PI/2,0,0]);const soup=render(soupGeo,broth,[0,.214,0],pot,[-Math.PI/2,0,0]);soup.userData.animated=true;
  for(let i=0;i<14;i++){const angle=i*2.399+t.id*.5,r=.19+((i*37)%43)/100;render(oilGeo,oil,[Math.cos(angle)*r,.216,Math.sin(angle)*r],pot,[-Math.PI/2,0,angle]);}
  for(let i=0;i<4;i++){const angle=i*2.1+t.id*.8,r=.13+(i%2)*.085;const strand=render(noodleGeo,cabbage,[Math.cos(angle)*r,.221,Math.sin(angle)*r],pot);strand.rotation.y=angle;}
  for(let i=0;i<3;i++)rounded(greens,[Math.sin(i*3+t.id)*.21,.226,Math.cos(i*3+t.id)*.19],[.08,.014,.055],.004,[0,i*.7,0],pot);
  for(let i=0;i<18;i++){
   const a=i*2.39996+t.id*.67,r=.13+.52*Math.sqrt(((i*11+3)%19)/19);
   const garnish=render(i%3?pepper:scallion,i%3?chilli:leek,[r*Math.cos(a),.221,r*Math.sin(a)],pot);
   garnish.rotation.set(i%3?0:Math.PI/2,a+.37*i,0,'YXZ');
  }
  const target=render(pickGeometry,pickMaterial,[t.x,1.099,t.z],group,[-Math.PI/2,0,0]);target.castShadow=target.receiveShadow=false;targets.push(target);
  const plume=render(steamGeo,steamMaterial,[t.x,1.70,t.z],group);plume.name='hotpot-steam-'+t.id;plume.castShadow=false;plume.receiveShadow=false;plume.userData.animated=true;plume.renderOrder=2;steam.push(plume);
 }
 for(const p of plan.screens){
  const screen=new T.Group();screen.name='hotpot-screen-'+p.id;screen.position.set(p.x,0,p.z);screen.rotation.y=p.yaw;fixed.add(screen);
  for(const x of[-p.width/2+.025,p.width/2-.025])rounded(screenWood,[x,1.18,0],[.05,p.height,.065],.006,null,screen);
  for(const y of[.055,.53,2.315])box(screenWood,[0,y,0],[p.width,.065,.065],null,screen);
  for(let i=0;i<6;i++)box(i%2?screenWood:screenLight,[-.30+i*.12,1.43,0],[.028,1.72,.036],null,screen);
  // The low timber panel and the upper open vertical grille are distinct.
  for(let i=0;i<5;i++)box(screenWood,[-.30+i*.15,.294,0],[.14,.405,.025],null,screen);
 }
 // Timber wainscot visible below the hotpot room windows. Right-hand door
 // openings are deliberately left clear, with no geometry in the corridor.
 for(const side of[-1,1]){const x=side<0?-6.625:7.175,spans=side<0?[[-9.94,8.72]]:[[-9.94,-8.86],[-7.14,6.14],[7.86,8.72]];for(const[a,b]of spans){box(pedestal,[x,.46,(a+b)/2],[.04,.90,b-a],null,fixed);box(screenWood,[x-side*.018,.925,(a+b)/2],[.07,.065,b-a],null,fixed);for(let z=a+.32;z<b-.05;z+=.64)box(screenWood,[x-side*.023,.46,z],[.028,.83,.025],null,fixed);}}
 const timber=material(finishes.veneer?'#9b654a':'#825035',{map:finishes.veneer||grain,roughness:.53});
 const rebate=material('#683f2e',{roughness:.64});
 const hall=new T.Group();hall.name='hotpot-corridor-wainscot';fixed.add(hall);
 function lineWall(x,side,lo,hi){
  const len=hi-lo,z=(lo+hi)/2;
  if(len<.05)return;
  box(timber,[x,.47,z],[.04,.87,len],null,hall);
  box(rebate,[x+side*.021,.12,z],[.041,.13,len],null,hall);
  box(screenWood,[x+side*.027,.95,z],[.073,.074,len],null,hall);
  for(let i=0;i<Math.floor(len/.67);i++)box(rebate,[x+side*.023,.51,lo+.36+i*.67],[.012,.71,.014],null,hall);
 }
 lineWall(CORRIDOR.maxX-.065,-1,CORRIDOR.minZ+.05,CORRIDOR.maxZ-.05);
 for(const part of PARTITIONS)lineWall(CORRIDOR.minX+.066,1,part.minZ,part.maxZ);
 for(const [a,b] of [[CORRIDOR.minZ+.05,ALCOVE_ENTRY.minZ],[ALCOVE_ENTRY.maxZ,-10]])lineWall(CORRIDOR.minX+.066,1,a,b);
 if(menus){
  const print=material('#fff',{map:menus,roughness:.86});
  for(const [i,z] of [-5.3,.02].entries()){
   const frame=new T.Group();frame.name='hotpot-corridor-menu-'+i;frame.position.set(CORRIDOR.maxX-.056,2.15,z);frame.rotation.y=-Math.PI/2;hall.add(frame);
   box(rebate,[0,0,0],[1.04,1.57,.046],null,frame);
   box(silver,[0,0,.025],[.979,1.51,.012],null,frame);
   const g=ownGeometry(new T.PlaneGeometry(.945,1.477)),uv=g.attributes.uv;
   for(let k=0;k<uv.count;k++)uv.setX(k,(i+.006+.988*uv.getX(k))/2);
   render(g,print,[0,0,.034],frame);
  }
 }
 if(bakeStatic){bakeStatic(fixed);fixed.traverse(o=>{if(o.isMesh)ownedGeometries.add(o.geometry);});}
 let disposed=false;
 function showPieces(pots,time){
  const seen=new Set();
  for(const pot of pots){
   const table=plan.tables[pot.id];if(!table)continue;
   for(const p of pot.pieces){
    const key=pot.id+':'+p.id;seen.add(key);let mesh=pieces.get(key);
    const style=p.readyAt<=time+1e-6?'cooked':'raw';
    if(!mesh){mesh=hotpotFood(style,p.dish);mesh.name='hotpot-food-'+key;group.add(mesh);pieces.set(key,mesh);}
    else setDish(mesh,p.dish,style);
    const angle=p.id*2.39996+pot.id*.62,r=.12+.46*Math.sqrt(((p.id*13+7)%47)/47);
    mesh.position.set(table.x+r*Math.cos(angle),1.096+.004*Math.sin(time*2+p.id),table.z+r*Math.sin(angle));mesh.rotation.y=angle;mesh.scale.setScalar(2.5);
   }
  }
  for(const [key,mesh] of pieces)if(!seen.has(key)){mesh.removeFromParent();pieces.delete(key);}
 }
 return{group,targets,update(time,pots=[]){if(disposed)return;const t=Number.isFinite(time)?time:0;soupTime.value=t;steamMaterial.uniforms.uTime.value=t;showPieces(pots,t);},dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of ownedGeometries)g.dispose();for(const m of ownedMaterials)m.dispose();for(const t of ownedTextures)t.dispose();},tables:plan.tables,seats:plan.seats,solids:plan.solids,pattern:plan.pattern};
}
