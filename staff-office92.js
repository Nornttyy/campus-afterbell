import * as T from './vendor/three.module.js';
import {END_ORIGIN,officePlan as office,officeDeskPlans} from './campus-ends.js?v=campus-101&rev=127';

// Window bounce is localized to the staffroom. The adjacent hallway shares
// neither its ceiling finish nor its window, including on the touch renderer.
export function staffroomFinish(material,kind,day){
 const before=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  before.call(this,shader,renderer);
  shader.uniforms.staffroomDay=day;
  shader.vertexShader='varying vec3 staffPosition;\n'+shader.vertexShader.replace('#include <worldpos_vertex>',
   '#include <worldpos_vertex>\n staffPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='varying vec3 staffPosition; uniform bool staffroomDay;\n'+shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
   if(staffroomDay){
    vec2 p=vec2(${END_ORIGIN.x.toFixed(3)},${END_ORIGIN.z.toFixed(3)})-staffPosition.xz;
    float nearGlass=smoothstep(${office.minZ.toFixed(3)},${office.maxZ.toFixed(3)},p.y)*(1.0-smoothstep(2.5,6.5,abs(p.x-${((office.minX+office.maxX)/2).toFixed(3)})));
    float edge=max(0.0,min(min(p.x-${office.minX.toFixed(3)},${office.maxX.toFixed(3)}-p.x),min(p.y-${office.minZ.toFixed(3)},${office.maxZ.toFixed(3)}-p.y)));
    ${kind==='ceiling'?`float cove=smoothstep(.04,.95,edge);
     vec3 ceilingBounce=mix(vec3(.39,.43,.42),vec3(.66,.69,.67),cove)+vec3(.08,.11,.13)*nearGlass;
     reflectedLight.indirectDiffuse*=ceilingBounce;
     reflectedLight.directDiffuse*=mix(vec3(.77,.81,.79),vec3(.94,.96,.94),cove);`
    :`float footing=smoothstep(.1,.86,staffPosition.y)*smoothstep(.0,.48,3.95-staffPosition.y);
     float corner=smoothstep(.0,1.32,min(min(abs(p.x-${office.minX.toFixed(3)}),abs(${office.maxX.toFixed(3)}-p.x))+min(abs(p.y-${office.minZ.toFixed(3)}),abs(${office.maxZ.toFixed(3)}-p.y)),2.0));
     reflectedLight.indirectDiffuse*=mix(vec3(.57,.60,.55),vec3(.81,.80,.75),footing*corner)+vec3(.09,.14,.18)*nearGlass;`}
   }`);
 };
 material.customProgramCacheKey=()=>key+'-office-'+kind+'-101';
 return material;
}

// Office floor UVs follow the long boards. Soft contact under fixed furniture
// is per vertex, so the room needs no extra lamps, textures or shadow passes.
export function makeOfficeFloor(material,assets,mesh,parent){
 const {minX,maxX,minZ,maxZ}=office,w=maxX-minX,d=maxZ-minZ+.22,x0=(minX+maxX)/2,z0=maxZ-d/2;
 const geo=new T.BoxGeometry(w,.20,d,60,1,54),pos=geo.attributes.position,uv=geo.attributes.uv,colors=[];
 for(let i=0;i<pos.count;i++){
  const x=x0+pos.getX(i),z=z0+pos.getZ(i);
  uv.setXY(i,x/4.68,z/2.40);
  const edge=Math.max(0,Math.min(x-minX,maxX-x,z-minZ,maxZ-z));
  const windowRay=Math.max(0,1-Math.abs(x-x0)/(w*.41))*Math.max(0,(z-minZ)/(maxZ-minZ));
  let shade=.86+.18*windowRay-.24*Math.exp(-edge*1.7);
  for(const desk of officeDeskPlans){
   const c=Math.cos(desk.yaw),s=Math.sin(desk.yaw),lx=(x-desk.x)*c-(z-desk.z)*s,lz=(x-desk.x)*s+(z-desk.z)*c;
   const dx=Math.max(0,Math.abs(lx)-.55),dz=Math.max(0,Math.abs(lz)-.24);
   shade-=.35*Math.exp(-dx*dx*4.5-dz*dz*8);
   shade-=.13*Math.exp(-lx*lx*5-(lz+1.14)**2*5);
  }
  colors.push(shade,shade,shade);
 }
 geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));assets.add(geo);
 const floor=mesh(geo,material,[x0,-.10,z0],[1,1,1],null,parent);floor.name='campus-continuous-floor';floor.userData.surface='staffroom-honey-oak';
}

export function fitOfficeInterior({parent,B,rounded,mat,mesh,texture,assets,clock,cream,edge,blue,skirting,cabinetPaint,cabinetBack,seal,wood,paper,blackboard}){
 const {minX,maxX,minZ,maxZ}=office,middle=(minX+maxX)/2,zBack=maxZ+.10;
 const put=(m,x,y,z,w,h,d)=>B(m,[x,y,z],[w,h,d],parent);
 const windowWidth=(maxX-minX)*.62,sill=1.02,top=3.41,left=middle-windowWidth/2,right=middle+windowWidth/2;
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
 const windowVeil=texture(256,256,(c,w,h)=>{
  const fade=c.createLinearGradient(0,0,w*.21,h);fade.addColorStop(0,'#bcd4d4');fade.addColorStop(.47,'#90adb0');fade.addColorStop(1,'#b4c8c4');c.fillStyle=fade;c.fillRect(0,0,w,h);

 });
 const windowGlass=mat('#abc2c2',{map:windowVeil,transparent:true,opacity:.36,depthWrite:false,roughness:.38});
 const facet=(m,x,y,z,w,h)=>put(m,x,y,z,w,h,.078);
 put(edge,middle,sill-.05,maxZ-.10,windowWidth+.19,.064,.27);
 const sashWidth=windowWidth/5;
 for(let i=0;i<=5;i++){
  const x=left+i*sashWidth;facet(blue,x,(sill+top)/2,maxZ-.04,.085,top-sill+.089);
  if(i===5)break;
  const center=x+sashWidth/2,pane=put(windowGlass,center,(sill+top)/2,maxZ,sashWidth-.086,top-sill-.08,.016);pane.castShadow=false;
  for(const y of [sill,2.96,top])facet(blue,center,y,maxZ-.04,sashWidth-.085,.089);
  const railDepth=maxZ-(i%2?.095:.12);
  facet(edge,center,sill+.063,railDepth,sashWidth-.10,.028);
  facet(edge,x+.075,(sill+2.96)/2,railDepth,.036,2.96-sill-.08);
  put(seal,x+.105,2.01,railDepth-.015,.025,.14,.033);
 }
 const cloth=mat('#486942',{roughness:.96,side:T.DoubleSide});
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
 const dial=clock.clone(true);dial.name='staffroom-wall-clock';dial.rotation.y=Math.PI/2;dial.position.set(minX+.06,3.63,maxZ-.64);parent.add(dial);
 const frost=texture(192,256,(c,w,h)=>{
  const g=c.createLinearGradient(0,h,w,0);g.addColorStop(0,'#8ebbbc');g.addColorStop(.46,'#b5d5d6');g.addColorStop(1,'#d1e7e2');c.fillStyle=g;c.fillRect(0,0,w,h);
  let seed=345;for(let i=0;i<5300;i++){seed=seed*16807%2147483647;const x=seed%w;seed=seed*16807%2147483647;const y=seed%h;c.fillStyle=i%2?'rgba(65,104,106,.055)':'rgba(255,255,255,.10)';c.fillRect(x,y,1,1);}
 });
 const doorGlass=mat('#dfedeb',{map:frost,roughness:.65});
 doorGlass.name='staffroom-opaque-door-glass';
 return doorGlass;
}
