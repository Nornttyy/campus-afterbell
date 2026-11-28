import * as T from './vendor/three.module.js';
import {toiletFixtures} from './toilet-room70.js?v=campus-99&rev=180';
import {POOL_HALL,POOL_WALLS,POOL_LOCKERS,POOL_STALLS,POOL_BOARD,BASIN} from './pool-layout.js?v=campus-117&rev=180';

export function createPoolRoom({parent,box,rounded,mat,texture,bakeStatic,boardInk}){
 const group=new T.Group(),fixed=new T.Group(),seatTargets=new Map(),maps=[];
 group.name='natatorium';group.add(fixed);parent.add(group);
 const tile=(base,grout)=>{
  const map=texture(128,128,(c,w,h)=>{
   c.fillStyle=grout;c.fillRect(0,0,w,h);
   for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    c.fillStyle=base;c.fillRect(x*32+1,y*32+1,31,31);
    c.fillStyle='rgba(255,255,255,'+((x*7+y*3)%5*.016)+')';c.fillRect(x*32+1,y*32+1,31,31);
   }
  });map.wrapS=map.wrapT=T.RepeatWrapping;maps.push(map);return mat('#ffffff',{map,roughness:.62,side:T.DoubleSide});
 };
 const porcelain=tile('#8ebfc2','#638688'),deck=tile('#c9c4af','#95a19b');
 const plaster=mat('#e8e4d6'),teal=mat('#377c80'),blue=mat('#436e95'),coral=mat('#ae796d'),steel=mat('#8eaaa8',{metalness:.32,roughness:.37}),white=mat('#ebece3'),dark=mat('#283e4a');
 const pane=mat('#9ecfd6',{roughness:.22,emissive:'#70a9bc',emissiveIntensity:.32}),lamp=mat('#fff3d6',{emissive:'#fff2ce',emissiveIntensity:.85});
 const B=(m,x,y,z,w,h,d)=>box(m,[x,y,z],[w,h,d],null,fixed);
 function patch(material,vertices){
  const g=new T.BufferGeometry(),p=vertices.flat(),uv=vertices.flatMap(([x,y,z])=>[x,z]);
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex([0,2,1,0,3,2]);g.computeVertexNormals();
  const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;fixed.add(mesh);
 }
 const rect=(x1,x2,z1,z2,y)=>[[x1,y,z1],[x2,y,z1],[x2,y,z2],[x1,y,z2]];
 const {minX:l,maxX:r,minZ:a,maxZ:b,depth,slope}=BASIN,h=POOL_HALL;
 for(const [x1,x2,z1,z2] of [[h.minX,l,h.minZ,h.maxZ],[r,h.maxX,h.minZ,h.maxZ],[l,r,h.minZ,a],[l,r,b,h.maxZ]])patch(deck,rect(x1,x2,z1,z2,0));
 const inset=depth/slope,outer=rect(l,r,a,b,0),inner=rect(l+inset,r-inset,a+inset,b-inset,-depth);
 patch(porcelain,inner);
 for(let i=0;i<4;i++){const j=(i+1)%4;patch(porcelain,[outer[i],outer[j],inner[j],inner[i]]);}
 for(const wall of POOL_WALLS){
  const {minX,maxX,minZ,maxZ,maxY,id}=wall,x=(minX+maxX)/2,z=(minZ+maxZ)/2,w=maxX-minX,d=maxZ-minZ;
  B(id.startsWith('stall')?teal:plaster,x,maxY/2,z,w,maxY,d);
  if(!id.startsWith('stall'))B(teal,x,.32,z,w+.012,.14,d+.012);
 }
 // The classroom shell is replaced on this floor. Rebuild the east wall around
 // the two working school doors and leave their thresholds clear.
 for(const [z,d] of [[-9.4,1.2],[-.5,13.4],[8.3,1]])B(plaster,7.27,1.63,z,.14,3.26,d);
 for(const z of [-8,7])B(plaster,7.27,3.16,z,.14,.16,1.6);
 B(white,4.1,3.35,-.6,6.2,.12,18.8);
 B(plaster,-12.5,5.28,-.6,27,.16,18.8);
 B(plaster,1,4.31,-.6,.16,1.98,18.8);
 for(let x=-24;x<=0;x+=4){
  B(teal,x,5.06,-.6,.14,.23,18.78);
  B(lamp,x,4.91,-.6,.18,.06,2.8);
  for(const z of [-9.95,8.75]){
   B(pane,x,3.41,z,3.55,2,.04);B(steel,x,3.41,z+(z<0?.031:-.031),.05,2.02,.045);
   B(steel,x,2.38,z,3.7,.08,.14);
  }
 }
 function sign(text,x,y,z,yaw,w=.98,height=.29,bg='#25646b'){
  const map=texture(512,128,(c,cw,ch)=>{c.fillStyle=bg;c.fillRect(0,0,cw,ch);c.fillStyle='#fff9e7';c.font='bold 58px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,cw/2,ch/2,cw*.94);});maps.push(map);
  const face=new T.Mesh(new T.PlaneGeometry(w,height),mat('#ffffff',{map}));face.position.set(x,y,z);face.rotation.y=yaw;fixed.add(face);
 }
 for(const [z,label,color] of [[-8,'男更衣室','#476f93'],[7,'女更衣室','#996a70']]){
  sign(label,7.37,2.12,z+(z<0?1.45:-1.45),Math.PI/2,1.16,.32,color);
  sign('泳池入口',1.09,2.23,z+(z<0?1.55:-1.55),Math.PI/2);
  sign(label,.90,2.23,z+(z<0?1.55:-1.55),-Math.PI/2,1.16,.32,color);
 }
 for(const l of POOL_LOCKERS){
  const front=l.z+l.side*.331,paint=l.side<0?blue:coral;
  B(paint,l.x,.95,l.z-l.side*.285,1.1,1.90,.095);
  for(const dx of [-.525,.525])B(paint,l.x+dx,.95,l.z,.05,1.90,.65);
  for(const y of [.08,.84,1.87])B(white,l.x,y,l.z,1.08,.07,.65);
  B(paint,l.x,.445,front,1,.69,.038);B(steel,l.x+.34,.56,front+l.side*.035,.04,.12,.04);
  for(let i=0;i<3;i++)B(dark,l.x,.28+i*.043,front+l.side*.023,.43,.012,.008);
  sign(String(l.col+1).padStart(2,'0'),l.x,1.55,l.z-l.side*.223,l.side>0?0:Math.PI,.30,.14);
 }
 const fixtureGeometries=new Set();
 const placeFixture=toiletFixtures({own:g=>(fixtureGeometries.add(g),g),rounded,box,porcelain:white,seatMat:white,steel,water:pane,
  render(g,m,p,parent,rotation){const mesh=new T.Mesh(g,m);mesh.position.fromArray(p);if(rotation)mesh.rotation.set(...rotation);parent.add(mesh);return mesh;}
 });
 for(const [i,s] of POOL_STALLS.entries()){
  const fixture=new T.Group();fixture.position.set(s.x,0,s.z);group.add(fixture);
  placeFixture(fixture);seatTargets.set(20+i,fixture);
  sign('洗手间',s.x+.79,1.55,s.z+.64,0,.48,.19);
 }
 sign('校园游泳馆',-14,3.65,8.78,Math.PI,4.2,.95);
 sign('浅水区　慢行',-25.97,2.12,-.5,Math.PI/2,2.2,.53);
 B(teal,POOL_BOARD.x,1.54,8.75,3.57,1.56,.06);
 const board=new T.Mesh(new T.PlaneGeometry(3.5,1.5),boardInk||teal);
 board.position.set(POOL_BOARD.x,1.54,8.71);board.rotation.y=Math.PI;fixed.add(board);
 for(const z of [-3.1,-.5,2.1]){
  B(blue,(l+r)/2,-depth+.004,z,r-l-2*inset,.008,.12);
  for(const x of [l+inset+.43,r-inset-.43])B(blue,x,-depth+.008,z,.09,.01,.77);
 }
 // Lane ropes have gaps at the ends so the entry slope stays visually legible.
 const red=mat('#bd5946');
 for(const z of [a-.13,b+.13])B(teal,(l+r)/2,.008,z,r-l,.016,.085);
 for(const x of [l-.13,r+.13])B(teal,x,.008,(a+b)/2,.085,.016,b-a);
 for(const z of [-5.65,-3.1,-.5,2.1,4.55]){
  const number=String([-5.65,-3.1,-.5,2.1,4.55].indexOf(z)+1);
  sign(number,-25.97,1.64,z,Math.PI/2,.52,.45);
 }
 for(const x of [-19,-7]){
  const ring=new T.Mesh(new T.TorusGeometry(.34,.085,8,32),red);
  ring.position.set(x,1.62,-9.92);fixed.add(ring);
  for(let k=0;k<4;k++){
   const band=new T.Mesh(new T.TorusGeometry(.34,.088,8,5,.38),white);
   band.rotation.z=k*Math.PI/2;band.position.copy(ring.position);fixed.add(band);
  }
  B(steel,x,2.02,-9.94,.10,.24,.09);
 }

 for(const z of [-4.4,-1.8,.8,3.4])for(let i=0;i<36;i++)B(i<4||i>31?red:i%2?white:teal,l+1.45+i*.49,-.08,z,.46,.066,.066);
 const waveMap=texture(256,256,(c,w,h)=>{
  c.fillStyle='#a0dbdb';c.fillRect(0,0,w,h);c.lineWidth=1.5;c.strokeStyle='rgba(248,255,240,.48)';
  for(let row=-1;row<=16;row++){c.beginPath();for(let x=0;x<=w;x+=2){const y=row*16+3.5*Math.sin(x*Math.PI/64+row*.8)+2*Math.sin(x*Math.PI/32);if(x===0)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}
 });maps.push(waveMap);waveMap.wrapS=waveMap.wrapT=T.RepeatWrapping;waveMap.repeat.set(4,3);
 const water=new T.Mesh(new T.PlaneGeometry(r-l-.19,b-a-.19),mat('#51bdcc',{map:waveMap,transparent:true,opacity:.36,depthWrite:false,roughness:.62,side:T.DoubleSide}));
 water.rotation.x=-Math.PI/2;water.position.set((l+r)/2,-.08,(a+b)/2);water.name='pool-water';group.add(water);
 bakeStatic(fixed);
 return {group,seatTargets,update(state){const t=state.sceneElapsed||0;waveMap.offset.set((t*.019)%1,(t*.010)%1);},dispose(){group.removeFromParent();fixed.traverse(o=>{if(o.isMesh)o.geometry.dispose();});water.geometry.dispose();for(const g of fixtureGeometries)g.dispose();maps.forEach(t=>t.dispose());}};
}
