// Ground-floor excursion stop. The driver's partition, stair opening and each
// seat originate from the same measurements used by both room authorities.
import * as T from './vendor/three.module.js';
import {instanceRigidProps} from './rigid-instances.js?v=campus-83';
import {coachDistanceAt,COACH_BRAKE_SECONDS} from './excursion-journey91.js?v=campus-92';
import {createExcursionRoad} from './excursion-road91.js?v=campus-92';
import {BUS,BUS_SEATS,BUS_DECK_SLABS,COACH_CUSHION} from './bus-layout86.js?v=campus-92';

export function createBusRoom({scene,box,rounded,mat,texture,bakeStatic,liftPanel,stationFloor,finishes={}}){
 const group=new T.Group();group.name='excursion-ground-floor';scene.add(group);group.visible=false;
 const shells=[],chairs=new Map(),cabinets=new Map(),lockers=[],owned=[],ownedTextures=[],leaves=[],wheels=[];
 const world=new T.Group(),vehicle=new T.Group();world.name='excursion-route-world';vehicle.name='excursion-moving-coach';group.add(world);world.add(vehicle);
 let road=null;
 let stop=null,batches=null,built=false,bell=null,driverGate=null,liftCopy=null,sky=null,doorAmount=1,liftAmount=1,driverAmount=1,disposed=false;
 function build(){
  if(built)return;built=true;
  const coach=new T.Group();stop=new T.Group();stop.name='excursion-origin-station';world.add(stop);vehicle.add(coach);shells.push(stop,coach);let fixed=stop;
  const C=(color,rough=.75,extra={})=>mat(color,{roughness:rough,...extra});
  const paint=C('#f4ab12',.52),edge=C('#e8bb37'),night=C('#293442',.55),tire=C('#28272c',.93),iron=C('#727d7f',.46),cream=C('#eee4cc'),plaster=C('#eee7d4'),lip=C('#637879'),amber=C('#be5b26'),red=C('#b43d32',.43),white=C('#f0eedd'),oak=C('#bb814c'),cab=C('#ded4bf'),rubber=C('#525e68'),glass=C('#72a6d5',.24,{transparent:true,opacity:.22,depthWrite:false}),lit=C('#fff7d6',.38,{emissive:'#ffefb2',emissiveIntensity:.5});
  const B=(m,x,y,z,w,h,d,parent=fixed,rot=null)=>box(m,[x,y,z],[w,h,d],rot,parent);
  const R=(m,x,y,z,w,h,d,bevel=.04,parent=fixed,rot=null)=>rounded(m,[x,y,z],[w,h,d],bevel,rot,parent);
  function shape(geo,m,x,y,z,parent=fixed){owned.push(geo);const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=!m.transparent;o.receiveShadow=true;parent.add(o);return o;}
  function rod(m,a,b,r,parent=fixed,n=8){const start=new T.Vector3(...a),end=new T.Vector3(...b),v=end.clone().sub(start),o=shape(new T.CylinderGeometry(r,r,v.length(),n),m,...start.clone().lerp(end,.5).toArray(),parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
  function label(words,bg,ink,size=80){return C('#ffffff',.85,{map:texture(640,256,(c,w,h)=>{if(bg){c.fillStyle=bg;c.fillRect(0,0,w,h);}c.fillStyle=ink;c.textAlign='center';c.textBaseline='middle';c.font='bold '+size+'px "PingFang SC","Microsoft YaHei",sans-serif';c.fillText(words,w/2,h/2,w*.94);}),transparent:!bg,depthWrite:!!bg});}
  function sign(m,x,y,z,w,h,angle=0,parent=fixed){const face=shape(new T.PlaneGeometry(w,h),m,x,y,z,parent);face.rotation.y=angle;face.castShadow=false;return face;}
  function patterned(base,dot,scale){const tex=texture(256,256,(c,w,h)=>{c.fillStyle=base;c.fillRect(0,0,w,h);let n=86;for(let i=0;i<1250;i++){n=(Math.imul(n,1664525)+1013904223)>>>0;const x=n%256,y=n>>>11&255;c.fillStyle=i%4?dot:'#ffffff24';c.fillRect(x,y,1+(i%4),1+(i%2));}});tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(...scale);return C('#ffffff',.94,{map:tex});}
  const felt=finishes.upholstery?C('#ffffff',.85,{map:finishes.upholstery}):patterned('#ab6036','#af673331',[2,2]),asphalt=patterned('#494d50','#737773a0',[12,6]),floor=C('#ffffff',.83);
  const tread=texture(192,192,(c,w,h)=>{
   c.fillStyle='#656e73';c.fillRect(0,0,w,h);
   for(let y=-12;y<h+12;y+=24)for(let x=-12;x<w+12;x+=24){
    const dx=x+(y%48===12?12:0);c.fillStyle='#566067';c.beginPath();c.ellipse(dx,y,5.4,2.7,-.61,0,Math.PI*2);c.fill();
    c.strokeStyle='#829094';c.lineWidth=1;c.beginPath();c.ellipse(dx,y-.35,5.1,2.6,-.61,Math.PI,Math.PI*1.87);c.stroke();
   }
  });tread.wrapS=tread.wrapT=T.RepeatWrapping;tread.repeat.set(30,8);floor.map=tread;
  const body=BUS.body,S=BUS.stairs,L=BUS.low,U=BUS.high;
  // Station, painted skirting, glazed bays and triangular paper garlands.
  B(stationFloor||plaster,9.82,-.08,1.02,5.24,.16,15.85);B(plaster,9.82,3.63,1.02,5.34,.13,15.97);
  const meadow=texture(768,160,(c,w,h)=>{c.fillStyle='#f3ca42';c.fillRect(0,0,w,h);c.fillStyle='#80aa3c';c.beginPath();c.moveTo(0,h);for(let i=0;i<=w;i+=4)c.lineTo(i,124+11*Math.sin(i*Math.PI/128)+5*Math.sin(i*Math.PI/48));c.lineTo(w,h);c.fill();for(let i=0;i<22;i++){const x=(i*101)%w,y=141+Math.sin(i*2)*8;c.fillStyle='#fffcda';for(let j=0;j<5;j++){c.beginPath();c.arc(x+3*Math.cos(j*1.26),y+3*Math.sin(j*1.26),2,0,7);c.fill();}c.fillStyle='#eeb337';c.fillRect(x-1,y-1,2,2);}});
  const flower=C('#ffffff',.81,{map:meadow});
  const glazing=C('#acccca',.36,{metalness:.1}),poster=label('欢乐秋游','#ffedbe','#437848',92),floorG=label('Ⓖ',null,'#375a79',211);
  for(const [side,x]of [[1,7.18],[-1,12.45]]){
   B(plaster,x,1.78,.95,.12,3.61,15.82);B(lip,x+side*.069,.072,.95,.035,.14,15.82);
   for(let i=0;i<5;i++){const z=-5.24+i*3.11;sign(flower,x+side*.071,.48,z,3.13,.75,side*Math.PI/2);B(edge,x+side*.08,.88,z,.085,.065,3.15);
    if(i===0||i===3){sign(i===3?floorG:poster,x+side*.08,2.10,z,i===3?1.05:.93,i===3?.96:1.28,side*Math.PI/2);continue;}
    B(lip,x+side*.066,2.12,z,.09,1.59,2.75);B(glazing,x+side*.12,2.12,z,.03,1.46,2.61);
    B(lip,x+side*.15,2.12,z,.045,1.46,.06);B(lip,x+side*.15,2.58,z,.047,.07,2.64);
   }
  }
  const mural=new T.TextureLoader().load(new URL('./assets/posters/bus-excursion86.webp',import.meta.url).href,t=>{if(disposed)t.dispose();});mural.colorSpace=T.SRGBColorSpace;ownedTextures.push(mural);
  for(const [xa,xb]of [[7.16,BUS.gate[0]],[BUS.gate[1],12.5]])B(plaster,(xa+xb)/2,1.79,-6.91,xb-xa,3.58,.12);
  sign(C('#fff',.9,{map:mural}),10.94,1.75,-6.835,2.88,2.23);sign(label('秋游出发站',null,'#33402e',98),10.94,2.49,-6.817,2.66,.76);
  for(const x of BUS.gate)B(lip,x,1.24,-6.85,.085,2.48,.16);B(lip,8.61,2.50,-6.85,1.79,.11,.16);B(plaster,8.61,3.07,-6.91,1.75,1.03,.12);
  const flags=[paint,C('#8fa43b'),cream];for(const z of [-5.5,-1.6,2.5,6.4]){rod(lip,[7.24,3.42,z],[12.38,3.42,z],.012);for(let i=0;i<11;i++){const x=7.28+i*.46;const geo=new T.BufferGeometry();geo.setAttribute('uv',new T.Float32BufferAttribute([0,1,1,1,.5,0],2));geo.setAttribute('position',new T.Float32BufferAttribute([x,3.43,z,x+.44,3.43,z,x+.22,3.10-.04*Math.sin(i*.4),z],3));geo.computeVertexNormals();const m=flags[i%3];m.side=T.DoubleSide;shape(geo,m,0,0,0);}}
  const tileSeam=C('#aaa897');
  for(let z=-6.72;z<8.8;z+=1.20)B(tileSeam,9.81,3.559,z,5.22,.005,.012);
  for(let x=7.29;x<12.40;x+=1.19)B(tileSeam,x,3.558,.96,.012,.005,15.67);
  for(const z of [-3.65,2.0,7.3]){B(lip,9.83,3.46,z,.38,.10,1.39);B(lit,9.83,3.393,z,.31,.045,1.31);}
  const liftWall=C('#92a8b4',.57);
  for(const [a,b]of [[7.18,9.5],[11.48,12.48]])B(plaster,(a+b)/2,1.79,8.8,b-a,3.58,.12);
  B(liftWall,10.49,1.55,11.88,2.61,3.20,.12);B(liftWall,10.49,-.08,10.35,2.67,.16,3.2);B(plaster,10.49,3.20,10.35,2.68,.10,3.18);
  for(const x of [9.18,11.80]){B(liftWall,x,1.58,10.35,.12,3.20,3.2);B(iron,x+(x<10?.08:-.08),.99,10.45,.07,.06,2.25);}
  for(const side of [-1,1]){const o=B(liftWall,10.49+side*1.48,1.46,8.82,.98,2.89,.10,stop);o.userData.animated=true;leaves.push({o,side,lift:true});}
  liftCopy=liftPanel.clone(true);liftPanel.updateWorldMatrix(true,false);liftPanel.matrixWorld.decompose(liftCopy.position,liftCopy.quaternion,liftCopy.scale);stop.add(liftCopy);liftCopy.visible=true;liftCopy.traverse(o=>{if(o.isMesh)o.userData.animated=true;});
  bell=R(red,7.32,1.52,-4,.13,.37,.37,.067,stop);bell.userData.animated=true;B(cream,7.25,1.52,-4,.12,.48,.48);sign(label('上课铃',null,'#334453'),7.25,1.88,-4,.52,.25,Math.PI/2);
  for(const [i,id] of ['student','teacher'].entries()){const z=BUS.lockerZ+i*.88,g=new T.Group();stop.add(g);g.position.set(12.12,0,z);R(C(i?'#65787f':'#93a7aa'),0,1,0,.52,2,.82,.045,g);B(iron,-.28,1.1,.18,.06,.19,.045,g);sign(label(i?'老师':'学生','#dfe9e5','#364b56'),-.27,1.57,0,.57,.28,-Math.PI/2,g);for(let j=0;j<3;j++)B(night,-.27,.35+j*.07,0,.018,.018,.43,g);g.traverse(o=>{if(o.isMesh)o.userData.animated=true;});lockers.push({id,object:g});}
  // The yard and a continuous road beyond the coach windows.
  B(asphalt,3.4,-.10,-13.15,38,.19,12.60);
  B(asphalt,-.65,-.103,-2.06,15.88,.19,10.43);
  for(const x of [-7.9,-3.65,.6,4.85]){B(edge,x,.002,-3.21,.054,.012,4.21);B(edge,x+1.90,.003,-1.14,3.87,.013,.056);}
  for(const x of [-7.99,-3.75,.51,4.75])R(iron,x+.2,.17,3.22,2.03,.35,.44,.052);
  sign(label('候车区','#f9e79c','#385a46',103),-7.77,1.88,-6.20,.99,.38);
  rod(iron,[-7.77,0,-6.23],[-7.77,1.99,-6.23],.043);
  B(plaster,7.092,1.78,.95,.07,3.60,15.82);
  for(let x=-10;x<17;x+=2.2)B(cream,x,.006,-10.03,1.16,.011,.10);
  road=createExcursionRoad(world,{asphalt,facade:finishes.facade});
  road.update(0,0);
  fixed=coach;
  // Wheel arches, laminated glass, sloping cab windscreen and double belt line.
  const min=body.minX,max=body.maxX,near=body.maxZ,far=body.minZ,midZ=(near+far)/2;
  B(night,3.35,.43,midZ,19.58,.32,4.69);B(floor,3.35,L-.085,midZ,20.09,.17,5.04);
  for(const z of [far+.04,near-.04]){const dir=z<-13?-1:1,segments=dir>0?[[min,9.15],[10.95,max]]:[[min,max]];
   for(const [a,b]of segments){B(paint,(a+b)/2,1.18,z,b-a,1.14,.13);B(night,(a+b)/2,1.17,z+dir*.073,b-a,.083,.022);B(night,(a+b)/2,1.01,z+dir*.073,b-a,.038,.022);B(cream,(a+b)/2,1.24,z-dir*.086,b-a,1.01,.042);}
   for(const [a,b]of (dir>0?[[min,9.15],[10.95,12.58]]:[[min,12.58]])){const n=Math.ceil((b-a)/2.65);B(night,(a+b)/2,1.75,z,b-a,.12,.15);B(night,(a+b)/2,3.055,z,b-a,.12,.15);
    for(let i=0;i<n;i++){const x0=a+(b-a)*i/n,x1=a+(b-a)*(i+1)/n;B(night,x0+.039,2.4,z,.084,1.35,.15);B(glass,(x0+x1)/2,2.41,z,x1-x0-.08,1.23,.035);}B(night,b-.037,2.4,z,.075,1.34,.15);}
   B(paint,3.18,3.22,z,19.70,.31,.18);
   for(const wheelX of [-4.83,11.72]){
    const hub=new T.Group();hub.position.set(wheelX,.55,z);vehicle.add(hub);wheels.push(hub);
    rod(tire,[0,0,-dir*.18],[0,0,dir*.16],.60,hub,24);rod(red,[0,0,dir*.17],[0,0,dir*.19],.38,hub,20);
    rod(iron,[0,0,dir*.19],[0,0,dir*.205],.165,hub,16);
    for(let k=0;k<6;k++){const a=k*Math.PI/3,dx=.257*Math.sin(a),dy=.257*Math.cos(a);rod(night,[dx,dy,dir*.19],[dx,dy,dir*.207],.035,hub);}
    bakeStatic(hub);
   }
  }
  B(paint,min+.03,1.25,midZ,.12,1.40,5.03);B(glass,min+.04,2.36,midZ,.08,1.28,4.72);B(cream,min+.13,2.42,midZ,.10,1.42,1.05);
  B(paint,max-.04,1.19,midZ,.13,1.0,4.98);B(night,max+.031,.76,midZ,.04,.16,4.72);
  B(glass,max-.37,2.39,midZ,.085,1.61,4.81,fixed,[0,0,.43]);
  for(const z of [far+.12,near-.12]){rod(paint,[max-.02,1.65,z],[max-.72,3.16,z],.105);
   const pane=new T.BufferGeometry();pane.setAttribute('position',new T.Float32BufferAttribute([max-.83,1.73,z,max-.08,1.73,z,max-.76,3.04,z],3));pane.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,.12,1],2));pane.computeVertexNormals();glass.side=T.DoubleSide;shape(pane,glass,0,0,0);
   rod(night,[max-.82,1.68,z],[max-.82,3.12,z],.065);}
  for(const z of [far+.24,near-.24]){B(red,min-.055,1.27,z,.055,.29,.21);B(lit,min-.057,.98,z,.055,.12,.21);}
  for(const z of [far+.42,near-.42])B(lit,max+.032,1.21,z,.07,.20,.49);
  B(paint,max-.17,1.72,midZ,.53,.15,4.93);B(night,max+.04,1.18,midZ,.07,.28,1.49);B(edge,max+.09,.92,midZ,.025,.17,.51);
  for(const z of [far-.19,near+.19]){rod(night,[max-.91,2.89,z],[max-.54,2.92,z+(z<midZ?-.18:.18)],.035);R(night,max-.53,2.80,z+(z<midZ?-.19:.19),.25,.29,.12,.035);}
  for(const v of BUS_DECK_SLABS){B(cream,(v.minX+v.maxX)/2,(v.minY+v.maxY)/2,(v.minZ+v.maxZ)/2,v.maxX-v.minX,v.maxY-v.minY,v.maxZ-v.minZ);B(floor,(v.minX+v.maxX)/2,U+.005,(v.minZ+v.maxZ)/2,v.maxX-v.minX,.012,v.maxZ-v.minZ);}
  const linerPrint=texture(512,256,(c,w,h)=>{
   const arch=c.createLinearGradient(0,0,0,h);
   for(const [stop,color] of [[0,'#8e8c83'],[.055,'#c6beaf'],[.16,'#e5ddcd'],[.38,'#f2ebdc'],[.62,'#f2ebdc'],[.84,'#e5ddcd'],[.945,'#c6beaf'],[1,'#8e8c83']])arch.addColorStop(stop,color);
   c.fillStyle=arch;c.fillRect(0,0,w,h);
   for(const y of [h*.145,h*.855]){
    c.fillStyle='#8e887a';c.fillRect(0,y-1,w,1.5);c.fillStyle='#f5efe2';c.fillRect(0,y+1,w,2.5);
   }
   c.fillStyle='#b4ac9f';c.fillRect(0,0,2,h);c.fillStyle='#f8f1e6';c.fillRect(2,0,2,h);
  });
  linerPrint.wrapS=T.RepeatWrapping;
  const liner=C('#fffaf2',.71,{map:linerPrint,emissive:'#c5bdad',emissiveMap:linerPrint,emissiveIntensity:.42});
  const seam=C('#b8b1a1',.7),hatch=C('#e4ddce',.71,{emissive:'#c6beaf',emissiveIntensity:.28});
  for(const slab of BUS_DECK_SLABS){
   const x=(slab.minX+slab.maxX)*.5,z=(slab.minZ+slab.maxZ)*.5,w=slab.maxX-slab.minX,d=slab.maxZ-slab.minZ,ceiling=slab.minY-.008;
   const skin=new T.PlaneGeometry(w,d).rotateX(Math.PI*.5),pos=skin.attributes.position,uv=skin.attributes.uv;
   for(let i=0;i<pos.count;i++)uv.setXY(i,(x+pos.getX(i)-min)/2.2,(z+pos.getZ(i)-far)/(near-far));
   shape(skin,liner,x,ceiling,z).castShadow=false;
   for(const bayX of [-3.55,.85,5.25,9.65]){
    if(bayX-.32<slab.minX||bayX+.32>slab.maxX||midZ-.20<slab.minZ||midZ+.20>slab.maxZ)continue;
    B(seam,bayX,ceiling-.014,midZ,.61,.021,.37);B(hatch,bayX,ceiling-.026,midZ,.585,.010,.343);
    B(seam,bayX+.18,ceiling-.032,midZ,.058,.004,.013);
   }
   for(const sideZ of [far+.76,near-.76])if(sideZ>slab.minZ+.09&&sideZ<slab.maxZ-.09){
    B(iron,x,ceiling-.028,sideZ,w-.02,.046,.145);B(lit,x,ceiling-.051,sideZ,w-.038,.013,.093);
   }
  }
  for(const z of [far+.13,near-.13]){for(let i=0;i<10;i++){const x=min+.28+i*1.96;rod(red,[x,U,z],[x,U+.80,z],.049);rod(red,[x,U+.80,z],[x+1.87,U+.80,z],.049);rod(red,[x+1.87,U+.80,z],[x+1.87,U,z],.049);}B(edge,3.33,U+.12,z,19.8,.25,.12);}
  for(const x of [min+.15,max-.16])for(const h of [.34,.79])rod(red,[x,U+h,far+.13],[x,U+h,near-.13],.05);
  // Every visible tread rests on the ramp used for foot and camera support.
  const totalSteps=15;for(let i=0;i<totalSteps;i++){const a=i/totalSteps,b=(i+1)/totalSteps,x=S.maxX-(a+b)*.5*(S.maxX-S.minX),h=L+(U-L)*(a+b)*.5;
   B(rubber,x,h-.08,(S.minZ+S.maxZ)/2,(S.maxX-S.minX)/totalSteps+.003,.16,S.maxZ-S.minZ);B(edge,x+(S.maxX-S.minX)/totalSteps*.46,h+.006,(S.minZ+S.maxZ)/2,.044,.013,S.maxZ-S.minZ);}
  for(const z of [S.minZ-.03,S.maxZ+.03]){rod(iron,[S.maxX,L+.75,z],[S.minX,U+.75,z],.05);for(let i=0;i<5;i++){const q=i/4,x=S.maxX+(S.minX-S.maxX)*q,h=L+(U-L)*q;rod(iron,[x,h,z],[x,h+.74,z],.039);}}
  for(let i=0;i<4;i++){const z=-9.82-i*.24;B(rubber,10.05,.081+i*.087,z,1.74,.16+i*.175,.25);B(edge,10.05,.163+i*.174,z+.10,1.70,.014,.037);}
  for(const side of [-1,1]){const g=new T.Group();g.position.set(10.05+side*1.28,L,near);vehicle.add(g);B(paint,0,.38,0,.86,.74,.09,g);for(const sideX of [-.393,.393])B(night,sideX,1.49,0,.066,1.55,.10,g);for(const h of [.75,2.24])B(night,0,h,0,.86,.066,.10,g);B(glass,0,1.51,0,.74,1.41,.035,g);leaves.push({o:g,side});}
  // Driver and bathroom are real separate spaces on the lower deck.
  B(cream,11.12,L+1.24,-14.66,.11,2.43,2.27);driverGate=B(cream,11.13,L+1.16,-12.12,.11,2.30,2.70,vehicle);
  sign(label('驾驶室','#f3eedb','#3c4546',100),11.046,L+1.80,-14.57,1.12,.45,-Math.PI/2);
  R(night,12.62,L+.47,-14.89,.55,.22,.63);R(night,12.43,L+.84,-14.89,.15,.69,.64);
  B(night,13.02,L+.83,-14.60,.47,.26,1.66);const steering=shape(new T.TorusGeometry(.235,.032,8,22),night,12.80,L+1.02,-14.80);steering.rotation.y=Math.PI/2-.38;
  B(cream,-5.16,L+1.15,-13.62,2.76,2.31,.09);B(cream,-3.85,L+1.15,-15.31,.10,2.31,.94);
  sign(label('洗手间','#e7eadf','#335b66',93),-3.79,L+1.67,-15.31,.65,.30,Math.PI/2);
  R(white,-6.15,L+.55,-14.87,.25,.97,.56,.06);R(white,-5.93,L+.25,-14.87,.60,.44,.49,.10);const rim=shape(new T.TorusGeometry(.245,.065,9,20),white,-5.81,L+.47,-14.87);rim.rotation.x=Math.PI/2;rim.scale.y=1.13;B(night,-5.81,L+.435,-14.87,.33,.035,.30);
  rod(oak,[-4.15,L+.11,-15.51],[-4.15,L+.82,-15.51],.024);shape(new T.ConeGeometry(.13,.13,14),red,-4.15,L+.10,-15.51);B(iron,-4.72,L+1.02,-15.70,.28,.13,.18);rod(white,[-4.81,L+.97,-15.58],[-4.62,L+.97,-15.58],.10);
  const boardFace=label('秋 游 班 会','#285647','#e8ead8',66);B(iron,9.15,L+1.36,far+.14,2.12,1.09,.07);sign(boardFace,9.15,L+1.36,far+.19,2.04,1.01);
  const speaker=C('#deaa39');for(const x of [-5.85,8.85]){R(night,x,L+2.18,far+.13,.37,.47,.16);rod(speaker,[x,L+2.18,far+.20],[x,L+2.18,far+.25],.127);rod(night,[x,L+2.18,far+.25],[x,L+2.18,far+.26],.061);}
  for(const s of BUS_SEATS){const h=s.busDeck?U:L,dir=Math.sign(Math.sin(s.yaw)),g=new T.Group();g.position.set(s.x,h,s.z);g.rotation.y=s.yaw;vehicle.add(g);chairs.set(s.id,g);
   const wood=s.busDeck?oak:felt,cushion=COACH_CUSHION[s.surface],pad=s.busDeck?.075:.12;
   R(wood,0,cushion.top-pad/2,cushion.centerZ,cushion.width,pad,cushion.depth,.038,g);
   const backTop=s.busDeck?1.03:1.20;R(wood,0,(backTop+cushion.top)/2,-.26,cushion.width,backTop-cushion.top,.16,.058,g,[-.09,0,0]);
   if(!s.busDeck){
    R(cream,0,1.26,-.295,cushion.width-.14,.27,.16,.042,g);
    R(felt,0,1.265,-.293,cushion.width-.18,.263,.178,.044,g);
    for(const sx of [-.20,.20])B(amber,sx,.877,-.167,.012,.38,.008,g);
    for(const side of [-1,1]){B(cream,side*(cushion.width/2-.013),.82,-.259,.030,.78,.16,g);B(amber,side*(cushion.width/2-.015),.54,-.04,.062,.075,.42,g);}
    B(iron,0,(cushion.top-pad)/2,.005,.22,cushion.top-pad,.26,g);
   }
   else for(const side of [-1,1])for(const z of [-.21,.14])B(iron,side*.265,cushion.top/2,z,.033,cushion.top,.035,g);
   for(const side of [-1,1])B(iron,side*.24,(.62+cushion.top)/2,-.26,.03,.64-cushion.top,.035,g);
   bakeStatic(g);
   const boxX=s.busDeck?s.deskX-dir*.37:s.deskX;const cabinet=new T.Group();cabinet.position.set(boxX,h,s.z);cabinet.rotation.y=s.yaw;vehicle.add(cabinet);
   const height=s.busDeck?.42:.83,bottom=s.busDeck?.33:.05,top=bottom+height;
   for(const side of [-1,1])B(cab,side*.267,(bottom+top)/2,0,.042,height,.39,cabinet);
   B(cab,0,top,0,.57,.045,.39,cabinet);B(cab,0,bottom,0,.57,.04,.39,cabinet);B(cab,0,(top+bottom)/2,.185,.57,height,.035,cabinet);
   const shelf=bottom+height*.36;
   B(cab,0,shelf,0,.52,.035,.38,cabinet);B(cab,0,(shelf+bottom)/2,-.197,.53,shelf-bottom-.025,.043,cabinet);
   B(night,0,bottom+height*.24,-.231,.16,.032,.021,cabinet);B(amber,0,shelf+.018,.02,.49,.009,.29,cabinet);bakeStatic(cabinet);
   const drawer=new T.Group();drawer.position.set(0,shelf,-.205);cabinet.add(drawer);
   const doorHeight=top-shelf-.025;B(cab,0,doorHeight/2,0,.53,doorHeight,.036,drawer);B(iron,0,doorHeight-.057,-.025,.124,.020,.021,drawer);bakeStatic(drawer);
   const anchor=new T.Group();anchor.position.set(0,shelf+.03,-.058);cabinet.add(anchor);cabinets.set(s.id,{target:cabinet,drawer,foodAnchor:anchor,open:0});
  }
  for(const x of [-.05,3.95,7.95]){
   R(oak,x,U+.868,-14.205,1.11,.098,2.03,.035);for(const a of [-.41,.41])for(const b of [-.84,.84])B(iron,x+a,U+.42,-14.205+b,.043,.83,.043);
  }
  fixed=stop;
  for(const [x,z] of [[-7.45,-10.38],[-7.45,-9.63],[13.93,-10.03]]){B(tire,x,.031,z,.33,.06,.33);shape(new T.ConeGeometry(.121,.60,12),red,x,.36,z);rod(white,[x,.33,z],[x,.39,z],.067);}
  // A blue zenith, bright horizon and sparse summer clouds stay outside all
  // shadow casters. Distant buildings drift only after the door actually closes.
  const skyTex=texture(1024,512,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h*.60);g.addColorStop(0,'#3095cc');g.addColorStop(.62,'#58c1ee');g.addColorStop(1,'#c3e8f1');c.fillStyle=g;c.fillRect(0,0,w,h);for(let i=0;i<45;i++){const x=(i*227)%w,y=124+i*113%107;c.fillStyle='rgba(255,255,250,.75)';for(let j=0;j<5;j++){c.beginPath();c.ellipse(x+j*5,y-Math.sin(j)*3,9,3.7+j%2,0,0,7);c.fill();}}});
  const skyM=new T.MeshBasicMaterial({map:skyTex,side:T.BackSide,fog:false,depthWrite:false});sky=shape(new T.SphereGeometry(103,40,20),skyM,2,0,-10,group);sky.castShadow=false;sky.receiveShadow=false;sky.renderOrder=-100;
  bakeStatic(stop);bakeStatic(coach);
  const furniture=[...chairs.values(),...[...cabinets.values()].map(c=>c.target)];
  shells.push(...furniture);batches=instanceRigidProps(furniture,vehicle);
 }
 function setActive(active){if(active)build();group.visible=active;if(active)batches?.sync();}
 function update(state,dt){
  if(!group.visible)return;
  const approach=(x,target,speed)=>T.MathUtils.damp(x,target,speed,Math.min(dt,.15));
  doorAmount=approach(doorAmount,state.busDeparted?0:(state.doorMotion?.front?.amount??(state.frontDoorClosed?0:1)),8);liftAmount=approach(liftAmount,state.elevator?.doorClosed?0:1,9);driverAmount=approach(driverAmount,state.officeLocked?0:1,8);
  for(const {o,side,lift}of leaves)o.position.x=lift?10.49+side*(.49+liftAmount*.95):10.05+side*(.445+doorAmount*.89);
  driverGate.position.z=-12.12-driverAmount*2.71;
  // The station and road have fixed route coordinates; the coach and all its
  // furniture travel on +X. The render origin follows the coach so interaction
  // rays, remote players and cameras keep metre precision on long journeys.
  const distance=coachDistanceAt(state.sceneElapsed,state.busDepartureAt,state.busBrakeAt);
  vehicle.position.x=distance;
  world.position.x=-distance;
  for(const wheel of wheels)wheel.rotation.z=-(distance/.60)%(2*Math.PI);
  stop.position.x=Number.isFinite(state.busBrakeAt)?coachDistanceAt(state.busBrakeAt+COACH_BRAKE_SECONDS,state.busDepartureAt,state.busBrakeAt):0;
  stop.visible=Math.abs(stop.position.x-distance)<150;
  road.update(distance,state.busRouteSeed??state.layoutSeed??0);
  const openIds=new Set((state.students||[]).filter(p=>p.drawerOpen&&p.seated).map(p=>p.seatId));if(state.drawer?.open&&state.player?.seated)openIds.add(state.player.seatId);
  let movingDrawer=false;
  for(const [id,rec]of cabinets){const target=openIds.has(id)?1:0;if(rec.open===target)continue;const next=approach(rec.open,target,13);rec.open=Math.abs(target-next)<.001?target:next;rec.drawer.rotation.x=-rec.open*Math.PI*.49;rec.foodAnchor.position.z=-.058-rec.open*.15;movingDrawer=true;}
  if(movingDrawer)batches.sync();
 }
 function dispose(){disposed=true;road?.dispose();batches?.dispose();for(const geo of owned)geo.dispose();for(const t of ownedTextures)t.dispose();sky?.material.dispose();group.removeFromParent();}
 return {group,setActive,update,dispose,chairs,cabinets,lockers,shells,get bell(){return bell;},get liftPanel(){return liftCopy;}};
}
