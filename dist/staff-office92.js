import * as T from './vendor/three.module.js';
import {officePlan as office,officeDeskPlans} from './campus-ends.js?v=campus-93';

// Office floor UVs follow the long boards. Soft contact under fixed furniture
// is per vertex, so the room needs no extra lamps, textures or shadow passes.
export function makeOfficeFloor(material,assets,mesh,parent){
 const {minX,maxX,minZ,maxZ}=office,w=maxX-minX,d=maxZ-minZ+.22,x0=(minX+maxX)/2,z0=maxZ-d/2;
 const geo=new T.BoxGeometry(w,.20,d,60,1,54),pos=geo.attributes.position,uv=geo.attributes.uv,colors=[];
 for(let i=0;i<pos.count;i++){
  const x=x0+pos.getX(i),z=z0+pos.getZ(i);
  uv.setXY(i,x/4.68,z/2.40);
  const edge=Math.max(0,Math.min(x-minX,maxX-x,z-minZ,maxZ-z));
  let shade=.96-.17*Math.exp(-edge*2.1);
  for(const desk of officeDeskPlans){
   const dx=Math.max(0,Math.abs(x-desk.x)-.42),dz=Math.max(0,Math.abs(z-desk.z)-.16);
   shade-=.32*Math.exp(-dx*dx*4.5-dz*dz*8);
  }
  colors.push(shade,shade,shade);
 }
 geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));assets.add(geo);
 const floor=mesh(geo,material,[x0,-.10,z0],[1,1,1],null,parent);floor.name='campus-continuous-floor';floor.userData.surface='staffroom-honey-oak';
}

export function fitOfficeInterior({parent,B,rounded,mat,mesh,texture,assets,clock,cream,edge,blue,skirting,cabinetPaint,cabinetBack,seal,wood,paper,blackboard}){
 const {minX,maxX,minZ,maxZ}=office,middle=(minX+maxX)/2,zBack=maxZ+.10;
 const put=(m,x,y,z,w,h,d)=>B(m,[x,y,z],[w,h,d],parent);
 const windowWidth=7.36,sill=1.02,top=3.41,left=middle-windowWidth/2,right=middle+windowWidth/2;
 put(cream,middle,sill/2,zBack,maxX-minX,sill,.20);
 put(cream,middle,(office.height+top)/2,zBack,maxX-minX,office.height-top,.20);
 for(const [a,b] of [[minX,left],[right,maxX]])put(cream,(a+b)/2,(sill+top)/2,zBack,b-a,top-sill,.20);
 for(const x of [minX+.026,maxX-.026]){
  put(skirting,x,.065,(minZ+maxZ)/2,.065,.13,maxZ-minZ);
  put(skirting,x,office.height-.145,(minZ+maxZ)/2,.13,.25,maxZ-minZ);
 }
 put(skirting,middle,.065,maxZ-.022,maxX-minX,.13,.064);
 put(skirting,middle,office.height-.145,maxZ-.028,maxX-minX,.25,.14);
 for(const [a,b] of [[minX,office.doorMinX],[office.doorMaxX,maxX]])put(skirting,(a+b)/2,.065,minZ+.02,b-a,.13,.07);
 const windowVeil=texture(128,160,(c,w,h)=>{
  const fade=c.createLinearGradient(0,0,w,h);fade.addColorStop(0,'#c3d8d5');fade.addColorStop(.56,'#8aaeb0');fade.addColorStop(1,'#b6cac5');c.fillStyle=fade;c.fillRect(0,0,w,h);
 });
 const windowGlass=mat('#b6cecd',{map:windowVeil,transparent:true,opacity:.72,depthWrite:false,roughness:.72});
 const facet=(m,x,y,z,w,h)=>put(m,x,y,z,w,h,.078);
 for(const y of [sill,2.96,top])facet(blue,middle,y,maxZ-.04,windowWidth+.08,.089);
 put(edge,middle,sill-.05,maxZ-.10,windowWidth+.19,.064,.27);
 for(let i=0;i<=3;i++){
  const x=left+i*windowWidth/3;facet(blue,x,(sill+top)/2,maxZ-.04,.085,top-sill);
  if(i===3)break;
  const pane=put(windowGlass,x+windowWidth/6,(sill+top)/2,maxZ,windowWidth/3-.086,top-sill-.08,.016);pane.castShadow=false;
  facet(edge,x+windowWidth/6,sill+.063,maxZ-.092,windowWidth/3-.10,.026);
  put(seal,x+.085,2.01,maxZ-.10,.025,.14,.033);
 }
 const cloth=mat('#5e834d',{roughness:.96,side:T.DoubleSide});
 for(const side of [-1,1]){
  const geo=new T.PlaneGeometry(.76,2.54,34,9),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
   const u=p.getX(i)/.76+.5,v=p.getY(i)/2.54+.5;
   p.setXYZ(i,p.getX(i)*(1.04-.20*v)+side*.06*(1-v)**2,p.getY(i)-.021*(1-v)*Math.cos(u*Math.PI*8),.085*Math.cos(u*Math.PI*9)+.019*Math.sin(v*5+u*8));
  }
  geo.computeVertexNormals();assets.add(geo);
  mesh(geo,cloth,[middle+side*(windowWidth/2-.16),2.22,maxZ-.195],[1,1,1],null,parent).name='office-pleated-green-curtain';
 }
 const xWall=maxX-.068,zCab=13,cabWidth=3.80,height=1.24;
 put(cabinetBack,maxX-.33,height/2,zCab,.62,height,cabWidth);
 put(wood,maxX-.35,height+.025,zCab,.69,.051,cabWidth+.06);
 for(let col=0;col<5;col++)for(let row=0;row<3;row++){
  const z=zCab-cabWidth/2+(col+.5)*cabWidth/5,y=.095+(row+.5)*.368;
  rounded(cabinetPaint,[maxX-.651,y,z],[.025,.358,.739],.008,null,parent);
  put(edge,maxX-.672,y+.086,z,.013,.065,.132);
  put(paper,maxX-.680,y+.087,z,.006,.045,.109);
  put(seal,maxX-.674,y+.015,z+.24,.018,.058,.018);
 }
 // Dark enamel board and three framed sheets above the filing cabinets.
 const darkFrame=mat('#443e33',{roughness:.60});
 put(wood,xWall,2.25,zCab,.118,1.62,3.68);
 put(blackboard,xWall-.074,2.25,zCab,.04,1.52,3.56);
 put(wood,xWall-.14,1.45,zCab,.26,.047,3.74);
 const certificate=texture(256,340,c=>{
  c.fillStyle='#f0e8ce';c.fillRect(0,0,256,340);c.strokeStyle='#b9aa86';c.lineWidth=2;c.strokeRect(13,14,230,312);c.font='bold 30px serif';c.fillStyle='#464139';c.textAlign='center';c.fillText('荣誉证书',128,84);
  for(let k=0;k<6;k++){c.fillStyle=k===5?'#918571':'#b5a992';c.fillRect(k===5?149:52,123+k*21,k===5?53:142-(k%3)*17,3);}
  c.strokeStyle='#ae7764';c.lineWidth=3;c.beginPath();c.arc(177,256,18,0,Math.PI*2);c.stroke();
 });
 const ink=mat('#fff',{map:certificate,roughness:.86}),paperGeo=new T.PlaneGeometry(.32,.425);assets.add(paperGeo);
 for(let i=0;i<3;i++){
  const z=zCab+(i-1)*.98;put(darkFrame,xWall,3.53,z,.055,.49,.385);
  mesh(paperGeo,ink,[xWall-.031,3.53,z],[1,1,1],[0,-Math.PI/2,0],parent);
 }
 const dial=clock.clone(true);dial.name='staffroom-wall-clock';dial.rotation.y=Math.PI/2;dial.position.set(minX+.06,3.63,18.7);parent.add(dial);
 const frost=texture(192,256,(c,w,h)=>{
  const g=c.createLinearGradient(0,h,w,0);g.addColorStop(0,'#8ebbbc');g.addColorStop(.46,'#b5d5d6');g.addColorStop(1,'#d1e7e2');c.fillStyle=g;c.fillRect(0,0,w,h);
  let seed=345;for(let i=0;i<5300;i++){seed=seed*16807%2147483647;const x=seed%w;seed=seed*16807%2147483647;const y=seed%h;c.fillStyle=i%2?'rgba(65,104,106,.055)':'rgba(255,255,255,.10)';c.fillRect(x,y,1,1);}
 });
 return mat('#dfedeb',{map:frost,transparent:true,opacity:.84,roughness:.86,depthWrite:false});
}
