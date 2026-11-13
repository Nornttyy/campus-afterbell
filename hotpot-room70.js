import * as T from './vendor/three.module.js';

import {HOTPOT_TABLES,HOTPOT_SEATS,HOTPOT_SCREENS,HOTPOT_SOLIDS} from './hotpot-layout70.js?v=campus-75';
export {HOTPOT_TABLE_SIZE,HOTPOT_TABLE_HEIGHT,HOTPOT_TABLES,HOTPOT_SEATS,HOTPOT_SCREENS,HOTPOT_SOLIDS} from './hotpot-layout70.js?v=campus-75';

function chamferedSlab(width,depth,height,cut){
 const x=width/2,z=depth/2,s=new T.Shape();s.moveTo(-x+cut,-z);s.lineTo(x-cut,-z);s.lineTo(x,-z+cut);s.lineTo(x,z-cut);s.lineTo(x-cut,z);s.lineTo(-x+cut,z);s.lineTo(-x,z-cut);s.lineTo(-x,-z+cut);s.closePath();
 const g=new T.ExtrudeGeometry(s,{depth:height,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:1,steps:1,curveSegments:1});g.translate(0,0,-height/2);g.rotateX(-Math.PI/2);return g;
}
const steamVertex=`uniform float uTime; varying vec2 vUv; void main(){vUv=uv; vec4 c=modelViewMatrix*vec4(0.,0.,0.,1.);vec3 p=position;p.x+=.075*sin(uTime*1.4+uv.y*5.)*uv.y;p.y+=.035*sin(uTime*.9+uv.x*4.);c.xy+=p.xy;gl_Position=projectionMatrix*c;}`;
const steamFragment=`uniform float uTime; varying vec2 vUv;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
 void main(){vec2 q=vUv;float n=noise(vec2(q.x*5.,q.y*7.-uTime*.65));float n2=noise(vec2(q.x*11.+uTime*.13,q.y*13.-uTime));float width=.24+.20*q.y;float side=exp(-pow((q.x-.5+.07*sin(q.y*9.-uTime))/width,2.)*4.);float fade=smoothstep(0.,.13,q.y)*(1.-smoothstep(.48,1.,q.y));float a=side*fade*(.055+.12*n+.08*n2);gl_FragColor=vec4(.93,.94,.91,a);}`;

export function createHotpotRoom({parent,box,rounded,mat,texture,bakeStatic}){
 const group=new T.Group();group.name='hotpot-classroom-furniture';parent.add(group);
 const fixed=new T.Group();fixed.name='hotpot-fixed-furniture';group.add(fixed);
 const ownedGeometries=new Set(),ownedMaterials=new Set(),ownedTextures=new Set();
 const ownGeometry=g=>(ownedGeometries.add(g),g),material=(color,extra={})=>{const m=mat(color,extra);ownedMaterials.add(m);return m;};
 const render=(geo,m,p,root=fixed,rotation=null)=>{const mesh=new T.Mesh(geo,m);mesh.position.set(...p);if(rotation)mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
 const grain=texture(512,256,(c,w,h)=>{c.fillStyle='#dda63e';c.fillRect(0,0,w,h);for(let i=0;i<112;i++){const y=(i*37.71)%h;c.strokeStyle=i%3?'rgba(126,64,19,.085)':'rgba(255,226,142,.16)';c.lineWidth=.5+(i%4)*.36;c.beginPath();c.moveTo(0,y);c.bezierCurveTo(w*.25,y+Math.sin(i)*4,w*.7,y+Math.cos(i)*5,w,y+Math.sin(i*.7)*3);c.stroke();}});ownedTextures.add(grain);grain.wrapS=grain.wrapT=T.RepeatWrapping;
 const wood=material('#ffffff',{map:grain,roughness:.48}),edge=material('#a35d21',{roughness:.56}),pedestal=material('#8d391f',{roughness:.61}),screenWood=material('#985723',{roughness:.58}),screenLight=material('#bb7830',{roughness:.57}),steel=material('#b4afa0',{metalness:.62,roughness:.34}),silver=material('#d3cfc0',{metalness:.68,roughness:.29}),broth=material('#a61713',{roughness:.24,metalness:.05}),oil=material('#ce7424',{roughness:.24}),cabbage=material('#e8d9a0',{roughness:.67}),greens=material('#6e8d38',{roughness:.68});
 const soupTime={value:0};broth.onBeforeCompile=shader=>{shader.uniforms.hotpotTime=soupTime;shader.vertexShader='uniform float hotpotTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.z += .0016 * sin(uv.x*19. + hotpotTime*1.5) * cos(uv.y*17. - hotpotTime);');};broth.customProgramCacheKey=()=> 'hotpot-broth70';
 const topGeo=ownGeometry(chamferedSlab(2.634,2.634,.040,.13)),footGeo=ownGeometry(chamferedSlab(1.40,1.40,.10,.24)),capGeo=ownGeometry(chamferedSlab(1.10,1.10,.14,.17)),neckGeo=ownGeometry(new T.CylinderGeometry(.49,.64,.54,8)),bowlGeo=ownGeometry(new T.LatheGeometry([[0,0],[.58,0],[.65,.027],[.72,.13],[.765,.245],[.761,.265],[.735,.265],[.705,.135],[.63,.055],[.56,.028],[0,.028]].map(([x,y])=>new T.Vector2(x,y)),48)),rimGeo=ownGeometry(new T.TorusGeometry(.748,.015,6,48)),soupGeo=ownGeometry(new T.CircleGeometry(.719,48)),oilGeo=ownGeometry(new T.CircleGeometry(.028,8));
 const noodleGeo=ownGeometry(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-.11,0,0),new T.Vector3(-.04,.008,.03),new T.Vector3(.035,.012,-.02),new T.Vector3(.12,0,.018)]),8,.014,4,false));
 const steamGeo=ownGeometry(new T.PlaneGeometry(.65,1.18,1,1));const steamMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,uniforms:{uTime:{value:0}},vertexShader:steamVertex,fragmentShader:steamFragment});ownedMaterials.add(steamMaterial);
 const steam=[];
 for(const t of HOTPOT_TABLES){
  const table=new T.Group();table.name='hotpot-table-'+t.id;table.position.set(t.x,0,t.z);fixed.add(table);
  render(topGeo,wood,[0,.847,0],table);
  // Keep four real drawer openings under the shared top, not a solid apron
  // passing through the imported sliding drawers (whose top is .8104m).
  for(const side of[-1,1])for(const corner of[-.87,.87]){box(edge,[corner,.767,side*1.26],[.62,.11,.06],null,table);box(edge,[side*1.26,.767,corner],[.06,.11,.62],null,table);}render(footGeo,pedestal,[0,.061,0],table);render(neckGeo,pedestal,[0,.370,0],table);render(capGeo,edge,[0,.700,0],table);box(edge,[0,.801,0],[.84,.052,.84],null,table);
  const pot=new T.Group();pot.name='hotpot-pot-'+t.id;pot.position.y=.875;table.add(pot);render(bowlGeo,steel,[0,0,0],pot);render(rimGeo,silver,[0,.257,0],pot,[Math.PI/2,0,0]);const soup=render(soupGeo,broth,[0,.214,0],pot,[-Math.PI/2,0,0]);soup.userData.animated=true;
  for(let i=0;i<14;i++){const angle=i*2.399+t.id*.5,r=.19+((i*37)%43)/100;render(oilGeo,oil,[Math.cos(angle)*r,.216,Math.sin(angle)*r],pot,[-Math.PI/2,0,angle]);}
  for(let i=0;i<4;i++){const angle=i*2.1+t.id*.8,r=.13+(i%2)*.085;const strand=render(noodleGeo,cabbage,[Math.cos(angle)*r,.221,Math.sin(angle)*r],pot);strand.rotation.y=angle;}
  for(let i=0;i<3;i++)rounded(greens,[Math.sin(i*3+t.id)*.21,.226,Math.cos(i*3+t.id)*.19],[.08,.014,.055],.004,[0,i*.7,0],pot);
  const plume=render(steamGeo,steamMaterial,[t.x,1.70,t.z],group);plume.name='hotpot-steam-'+t.id;plume.castShadow=false;plume.receiveShadow=false;plume.userData.animated=true;plume.renderOrder=2;steam.push(plume);
 }
 for(const p of HOTPOT_SCREENS){
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
 if(bakeStatic){bakeStatic(fixed);fixed.traverse(o=>{if(o.isMesh)ownedGeometries.add(o.geometry);});}
 let disposed=false;
 return{group,update(time){if(disposed)return;const t=Number.isFinite(time)?time:0;soupTime.value=t;steamMaterial.uniforms.uTime.value=t;},dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of ownedGeometries)g.dispose();for(const m of ownedMaterials)m.dispose();for(const t of ownedTextures)t.dispose();},tables:HOTPOT_TABLES,seats:HOTPOT_SEATS,solids:HOTPOT_SOLIDS};
}
