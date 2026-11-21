// Ground-floor excursion stop. The driver's partition, stair opening and each
// seat originate from the same measurements used by both room authorities.
import * as T from './vendor/three.module.js';
import {instanceRigidProps} from './rigid-instances.js?v=campus-83';
import {BUS,BUS_SEATS,BUS_DECK_SLABS} from './bus-layout86.js?v=campus-86';

export function createBusRoom({scene,box,rounded,mat,texture,bakeStatic,liftPanel,stationFloor}){
 const group=new T.Group();group.name='excursion-ground-floor';scene.add(group);group.visible=false;
 const shells=[],chairs=new Map(),cabinets=new Map(),lockers=[],owned=[],ownedTextures=[],leaves=[],cityMoving=new T.Group();
 let stop=null,batches=null,built=false,bell=null,driverGate=null,liftCopy=null,sky=null,doorAmount=1,liftAmount=1,driverAmount=1,disposed=false;
 function build(){
  if(built)return;built=true;
  const coach=new T.Group(),city=new T.Group();stop=new T.Group();group.add(stop,coach,city,cityMoving);shells.push(stop,coach);let fixed=stop;
  const C=(color,rough=.75,extra={})=>mat(color,{roughness:rough,...extra});
  const paint=C('#f4ab12',.52),edge=C('#e8bb37'),night=C('#293442',.55),tire=C('#28272c',.93),iron=C('#727d7f',.46),cream=C('#eee4cc'),plaster=C('#eee7d4'),lip=C('#637879'),amber=C('#be5b26'),red=C('#b43d32',.43),white=C('#f0eedd'),oak=C('#bb814c'),cab=C('#ded4bf'),rubber=C('#525e68'),glass=C('#72a6d5',.24,{transparent:true,opacity:.22,depthWrite:false}),lit=C('#fff7d6',.38,{emissive:'#ffefb2',emissiveIntensity:.5});
  const B=(m,x,y,z,w,h,d,parent=fixed,rot=null)=>box(m,[x,y,z],[w,h,d],rot,parent);
  const R=(m,x,y,z,w,h,d,bevel=.04,parent=fixed,rot=null)=>rounded(m,[x,y,z],[w,h,d],bevel,rot,parent);
  function shape(geo,m,x,y,z,parent=fixed){owned.push(geo);const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=!m.transparent;o.receiveShadow=true;parent.add(o);return o;}
  function rod(m,a,b,r,parent=fixed,n=8){const start=new T.Vector3(...a),end=new T.Vector3(...b),v=end.clone().sub(start),o=shape(new T.CylinderGeometry(r,r,v.length(),n),m,...start.clone().lerp(end,.5).toArray(),parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
  function label(words,bg,ink,size=80){return C('#ffffff',.85,{map:texture(640,256,(c,w,h)=>{if(bg){c.fillStyle=bg;c.fillRect(0,0,w,h);}c.fillStyle=ink;c.textAlign='center';c.textBaseline='middle';c.font='bold '+size+'px "PingFang SC","Microsoft YaHei",sans-serif';c.fillText(words,w/2,h/2,w*.94);}),transparent:!bg,depthWrite:!!bg});}
  function sign(m,x,y,z,w,h,angle=0,parent=fixed){const face=shape(new T.PlaneGeometry(w,h),m,x,y,z,parent);face.rotation.y=angle;face.castShadow=false;return face;}
  function patterned(base,dot,scale){const tex=texture(256,256,(c,w,h)=>{c.fillStyle=base;c.fillRect(0,0,w,h);let n=86;for(let i=0;i<1250;i++){n=(Math.imul(n,1664525)+1013904223)>>>0;const x=n%256,y=n>>>11&255;c.fillStyle=i%4?dot:'#ffffff24';c.fillRect(x,y,1+(i%4),1+(i%2));}});tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(...scale);return C('#ffffff',.94,{map:tex});}
  const felt=patterned('#c97a36','#af673331',[2,2]),asphalt=patterned('#494d50','#737773a0',[12,6]),floor=patterned('#74838e','#53606e72',[9,3]);
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
  B(plaster,7.092,1.78,.95,.07,3.60,15.82);B(asphalt,1,-.13,-22.9,178,.17,8.8,city);B(asphalt,0,-.20,-12.15,178,.16,12.85,city);
  for(let x=-10;x<17;x+=2.2)B(cream,x,.006,-10.03,1.16,.011,.10);
  const lawn=C('#81a854');
  // Both flanks and the horizon need ground from the exposed top deck.
  B(C('#91ab70'),0,-.47,-2,195,.35,178,city);
  B(asphalt,0,-.16,12,172,.16,8.45,city);
  B(C('#d4ccb7'),0,-.10,17.15,172,.15,2.2,city);B(lawn,2,-.22,-33,135,.24,18,city);const concrete=C('#cbc6b4');B(concrete,1,-.06,-27.54,135,.15,1.55,city);
  const building=[C('#ccd2c9'),C('#c3d4da'),C('#d8c8b6')],cityGlass=C('#768f96'),leaf=C('#59864d'),leafLight=C('#75974f');
  for(let i=0;i<29;i++){const x=-108+i*8.1,z=-43-(i%3)*3.1,h=6+((i%6)*11%10),wall=building[i%3];B(wall,x,h/2,z,6.3,h,5,cityMoving);B(cream,x,h+.08,z,6.5,.17,5.2,cityMoving);for(let row=1;row<h/1.65;row++)for(let k=-2;k<=2;k++)B(cityGlass,x+k*1.10,row*1.55,z+2.52,.71,.83,.045,cityMoving);
   if(i%2===0){rod(oak,[x,0,-30],[x,2.45,-30],.14,cityMoving);for(let j=0;j<3;j++)shape(new T.IcosahedronGeometry(1.37-j*.12,1),j===1?leafLight:leaf,x+j*.53-.5,2.8+j*.15,-30+(j%2)*.44,cityMoving);}
   rod(iron,[x,0,-26.9],[x,4.4,-26.9],.055,cityMoving);rod(iron,[x,4.4,-26.9],[x+.61,4.67,-26.9],.046,cityMoving);B(night,x+.68,4.67,-26.9,.46,.10,.15,cityMoving);
  }
  const facadeTex=texture(256,384,(c,w,h)=>{c.fillStyle='#c3cabc';c.fillRect(0,0,w,h);for(let row=0;row<6;row++){const y=row*64;c.fillStyle='#d9dacd';c.fillRect(0,y,w,6);for(let j=0;j<4;j++){const x=9+j*64;c.fillStyle='#5d7782';c.fillRect(x,y+13,46,36);const shade=c.createLinearGradient(0,y+13,0,y+49);shade.addColorStop(0,'#a1bbc5');shade.addColorStop(1,'#71949e');c.fillStyle=shade;c.fillRect(x+2,y+15,42,32);c.fillStyle='#c6cbbb';c.fillRect(x+21,y+14,2,35);c.fillRect(x+1,y+24,44,2);c.fillRect(x-2,y+49,50,3);}}});
  const glazedFacade=C('#ffffff',.69,{map:facadeTex}),shadowWall=C('#a4aaa2'),tealTrim=C('#758d89'),roof=C('#899a9b'),pavement=C('#b9b4a5'),trunk=C('#786452');
  for(let i=0;i<27;i++){const k=i%6,x=-95+i*8.1,z=25+(k%3)*3,h=4.8+(k%4)*1.9;
   B(building[k%3],x,h/2,z,6.76,h,5.4,cityMoving);
   sign(glazedFacade,x,h*.52,z-2.714,6.57,h*.90,Math.PI,cityMoving);
   B(roof,x,h+.10,z,6.91,.23,5.61,cityMoving);B(tealTrim,x,h*.13,z-2.79,6.78,.14,.18,cityMoving);
   if(k%2===0){B(shadowWall,x+.8,h+.52,z+.3,1.85,.88,1.35,cityMoving);B(roof,x+.8,h+.99,z+.3,2,.11,1.49,cityMoving);}
   if(k!==2){B(pavement,x,.04,17.6,1.43,.11,1.27,cityMoving);rod(trunk,[x,.10,17.6],[x,2.48,17.6],.13,cityMoving);for(const [dx,dy,dz,rad]of [[-.45,2.9,0,1.14],[.45,3.02,.16,1.01],[0,3.72,.1,1.08]])shape(new T.IcosahedronGeometry(rad,1),k%2?leaf:leafLight,x+dx,dy,17.6+dz,cityMoving);}
   for(const zRail of [8.0,-18.7]){B(iron,x,1.03,zRail,8.1,.07,.065,cityMoving);B(iron,x,.57,zRail,8.1,.045,.045,cityMoving);for(const dx of [-3.8,0])B(iron,x+dx,.54,zRail,.068,1.08,.068,cityMoving);}
  }
  // Rounded hills close the long sightline at either end of the street.
  for(let i=0;i<26;i++){const a=i*Math.PI*2/26,x=76*Math.sin(a),z=64*Math.cos(a)-5;const hill=shape(new T.IcosahedronGeometry(1,2),i%2?lawn:leafLight,x,-1.1,z,city);hill.scale.set(14+i%4*2,4+i%5,12);}
  for(let i=0;i<44;i++)B(white,-76+i*4.05,.002,-23,1.76,.012,.11,cityMoving);
  fixed=coach;
  // Wheel arches, laminated glass, sloping cab windscreen and double belt line.
  const min=body.minX,max=body.maxX,near=body.maxZ,far=body.minZ,midZ=(near+far)/2;
  B(night,3.35,.43,midZ,19.58,.32,4.69);B(floor,3.35,L-.085,midZ,20.09,.17,5.04);
  for(const z of [far+.04,near-.04]){const dir=z<-13?-1:1,segments=dir>0?[[min,9.15],[10.95,max]]:[[min,max]];
   for(const [a,b]of segments){B(paint,(a+b)/2,1.18,z,b-a,1.14,.13);B(night,(a+b)/2,1.17,z+dir*.073,b-a,.083,.022);B(night,(a+b)/2,1.01,z+dir*.073,b-a,.038,.022);B(cream,(a+b)/2,1.24,z-dir*.086,b-a,1.01,.042);}
   for(const [a,b]of (dir>0?[[min,9.15],[10.95,12.58]]:[[min,12.58]])){const n=Math.ceil((b-a)/2.65);B(night,(a+b)/2,1.75,z,b-a,.12,.15);B(night,(a+b)/2,3.055,z,b-a,.12,.15);
    for(let i=0;i<n;i++){const x0=a+(b-a)*i/n,x1=a+(b-a)*(i+1)/n;B(night,x0+.039,2.4,z,.084,1.35,.15);B(glass,(x0+x1)/2,2.41,z,x1-x0-.08,1.23,.035);}B(night,b-.037,2.4,z,.075,1.34,.15);}
   B(paint,3.18,3.22,z,19.70,.31,.18);
   for(const wheelX of [-4.83,11.72]){const ay=.55;rod(tire,[wheelX,ay,z-dir*.18],[wheelX,ay,z+dir*.16],.60,fixed,24);rod(red,[wheelX,ay,z+dir*.17],[wheelX,ay,z+dir*.19],.38,fixed,20);rod(iron,[wheelX,ay,z+dir*.19],[wheelX,ay,z+dir*.205],.165,fixed,16);for(let k=0;k<6;k++){const a=k*Math.PI/3;rod(night,[wheelX+.257*Math.sin(a),ay+.257*Math.cos(a),z+dir*.19],[wheelX+.257*Math.sin(a),ay+.257*Math.cos(a),z+dir*.207],.035);}}
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
  for(const z of [far+.13,near-.13]){for(let i=0;i<10;i++){const x=min+.28+i*1.96;rod(red,[x,U,z],[x,U+.80,z],.049);rod(red,[x,U+.80,z],[x+1.87,U+.80,z],.049);rod(red,[x+1.87,U+.80,z],[x+1.87,U,z],.049);}B(edge,3.33,U+.12,z,19.8,.25,.12);}
  for(const x of [min+.15,max-.16])for(const h of [.34,.79])rod(red,[x,U+h,far+.13],[x,U+h,near-.13],.05);
  // Every visible tread rests on the ramp used for foot and camera support.
  const totalSteps=15;for(let i=0;i<totalSteps;i++){const a=i/totalSteps,b=(i+1)/totalSteps,x=S.maxX-(a+b)*.5*(S.maxX-S.minX),h=L+(U-L)*(a+b)*.5;
   B(rubber,x,h-.08,(S.minZ+S.maxZ)/2,(S.maxX-S.minX)/totalSteps+.003,.16,S.maxZ-S.minZ);B(edge,x+(S.maxX-S.minX)/totalSteps*.46,h+.006,(S.minZ+S.maxZ)/2,.044,.013,S.maxZ-S.minZ);}
  for(const z of [S.minZ-.03,S.maxZ+.03]){rod(iron,[S.maxX,L+.75,z],[S.minX,U+.75,z],.05);for(let i=0;i<5;i++){const q=i/4,x=S.maxX+(S.minX-S.maxX)*q,h=L+(U-L)*q;rod(iron,[x,h,z],[x,h+.74,z],.039);}}
  for(let i=0;i<4;i++){const z=-9.82-i*.24;B(rubber,10.05,.081+i*.087,z,1.74,.16+i*.175,.25);B(edge,10.05,.163+i*.174,z+.10,1.70,.014,.037);}
  for(const side of [-1,1]){const g=new T.Group();g.position.set(10.05+side*1.28,L,near);group.add(g);B(paint,0,.38,0,.86,.74,.09,g);for(const sideX of [-.393,.393])B(night,sideX,1.49,0,.066,1.55,.10,g);for(const h of [.75,2.24])B(night,0,h,0,.86,.066,.10,g);B(glass,0,1.51,0,.74,1.41,.035,g);leaves.push({o:g,side});}
  // Driver and bathroom are real separate spaces on the lower deck.
  B(cream,11.12,L+1.24,-14.66,.11,2.43,2.27);driverGate=B(cream,11.13,L+1.16,-12.12,.11,2.30,2.70,group);
  sign(label('驾驶室','#f3eedb','#3c4546',100),11.046,L+1.80,-14.57,1.12,.45,-Math.PI/2);
  R(night,12.62,L+.47,-14.89,.55,.22,.63);R(night,12.43,L+.84,-14.89,.15,.69,.64);
  B(night,13.02,L+.83,-14.60,.47,.26,1.66);const steering=shape(new T.TorusGeometry(.235,.032,8,22),night,12.80,L+1.02,-14.80);steering.rotation.y=Math.PI/2-.38;
  B(cream,-5.16,L+1.15,-13.62,2.76,2.31,.09);B(cream,-3.85,L+1.15,-15.31,.10,2.31,.94);
  sign(label('洗手间','#e7eadf','#335b66',93),-3.79,L+1.67,-15.31,.65,.30,Math.PI/2);
  R(white,-6.15,L+.55,-14.87,.25,.97,.56,.06);R(white,-5.93,L+.25,-14.87,.60,.44,.49,.10);const rim=shape(new T.TorusGeometry(.245,.065,9,20),white,-5.81,L+.47,-14.87);rim.rotation.x=Math.PI/2;rim.scale.y=1.13;B(night,-5.81,L+.435,-14.87,.33,.035,.30);
  rod(oak,[-4.15,L+.11,-15.51],[-4.15,L+.82,-15.51],.024);shape(new T.ConeGeometry(.13,.13,14),red,-4.15,L+.10,-15.51);B(iron,-4.72,L+1.02,-15.70,.28,.13,.18);rod(white,[-4.81,L+.97,-15.58],[-4.62,L+.97,-15.58],.10);
  const boardFace=label('秋 游 班 会','#285647','#e8ead8',66);B(iron,9.15,L+1.36,far+.14,2.12,1.09,.07);sign(boardFace,9.15,L+1.36,far+.19,2.04,1.01);
  const speaker=C('#deaa39');for(const x of [-5.85,8.85]){R(night,x,L+2.18,far+.13,.37,.47,.16);rod(speaker,[x,L+2.18,far+.20],[x,L+2.18,far+.25],.127);rod(night,[x,L+2.18,far+.25],[x,L+2.18,far+.26],.061);}
  for(const s of BUS_SEATS){const h=s.busDeck?U:L,dir=Math.sign(Math.sin(s.yaw)),g=new T.Group();g.position.set(s.x,h,s.z);g.rotation.y=s.yaw;group.add(g);chairs.set(s.id,g);
   const wood=s.busDeck?oak:felt;R(wood,0,.50,0,.71,.155,.66,.062,g);
   R(wood,0,.87,-.26,.71,.68,.16,.058,g,[-.09,0,0]);
   if(!s.busDeck){R(felt,0,1.22,-.295,.62,.21,.195,.055,g);R(cream,0,1.265,-.293,.376,.13,.207,.024,g);for(const sx of [-.20,.20])B(amber,sx,.877,-.167,.012,.38,.008,g);for(const side of [-1,1]){B(cream,side*.342,.88,-.259,.030,.64,.16,g);B(amber,side*.34,.60,-.04,.062,.09,.42,g);}B(iron,0,.225,.005,.22,.40,.26,g);}
   else for(const side of [-1,1])for(const z of [-.2,.19])B(iron,side*.265,.25,z,.033,.45,.035,g);
   bakeStatic(g);
   const boxX=s.busDeck?s.deskX-dir*.37:s.deskX;const cabinet=new T.Group();cabinet.position.set(boxX,h,s.z);cabinet.rotation.y=s.yaw;group.add(cabinet);
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
  for(const [x,z] of [[-7.45,-10.38],[-7.45,-9.63],[13.93,-10.03]]){B(tire,x,.031,z,.33,.06,.33);shape(new T.ConeGeometry(.121,.60,12),red,x,.36,z);rod(white,[x,.33,z],[x,.39,z],.067);}
  // A blue zenith, bright horizon and sparse summer clouds stay outside all
  // shadow casters. Distant buildings drift only after the door actually closes.
  const skyTex=texture(1024,512,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h*.60);g.addColorStop(0,'#3095cc');g.addColorStop(.62,'#58c1ee');g.addColorStop(1,'#c3e8f1');c.fillStyle=g;c.fillRect(0,0,w,h);for(let i=0;i<45;i++){const x=(i*227)%w,y=124+i*113%107;c.fillStyle='rgba(255,255,250,.75)';for(let j=0;j<5;j++){c.beginPath();c.ellipse(x+j*5,y-Math.sin(j)*3,9,3.7+j%2,0,0,7);c.fill();}}});
  const skyM=new T.MeshBasicMaterial({map:skyTex,side:T.BackSide,fog:false,depthWrite:false});sky=shape(new T.SphereGeometry(103,40,20),skyM,2,0,-10);sky.castShadow=false;sky.receiveShadow=false;sky.renderOrder=-100;group.attach(sky);
  bakeStatic(stop);bakeStatic(coach);bakeStatic(city);bakeStatic(cityMoving);
  const furniture=[...chairs.values(),...[...cabinets.values()].map(c=>c.target)];
  shells.push(...furniture);batches=instanceRigidProps(furniture,group);
 }
 function setActive(active){if(active)build();group.visible=active;if(active)batches?.sync();}
 function update(state,dt){
  if(!group.visible)return;
  const approach=(x,target,speed)=>T.MathUtils.damp(x,target,speed,Math.min(dt,.15));
  doorAmount=approach(doorAmount,state.busDeparted?0:1,8);liftAmount=approach(liftAmount,state.elevator?.doorClosed?0:1,9);driverAmount=approach(driverAmount,state.officeLocked?0:1,8);
  for(const {o,side,lift}of leaves)o.position.x=lift?10.49+side*(.49+liftAmount*.95):10.05+side*(.445+doorAmount*.89);
  driverGate.position.z=-12.12-driverAmount*2.71;
  if(state.busDeparted){const t=Math.max(0,(state.sceneElapsed??0)-(state.busDepartureAt??0)-.45),distance=2.85*(t-(1-Math.exp(-t)));
   cityMoving.position.x=-(distance%48.6);stop.position.x=-Math.min(130,distance);stop.visible=distance<95;
  }else{cityMoving.position.x=0;stop.position.x=0;stop.visible=true;}
  const openIds=new Set((state.students||[]).filter(p=>p.drawerOpen&&p.seated).map(p=>p.seatId));if(state.drawer?.open&&state.player?.seated)openIds.add(state.player.seatId);
  let movingDrawer=false;
  for(const [id,rec]of cabinets){const target=openIds.has(id)?1:0;if(rec.open===target)continue;const next=approach(rec.open,target,13);rec.open=Math.abs(target-next)<.001?target:next;rec.drawer.rotation.x=-rec.open*Math.PI*.49;rec.foodAnchor.position.z=-.058-rec.open*.15;movingDrawer=true;}
  if(movingDrawer)batches.sync();
 }
 function dispose(){disposed=true;batches?.dispose();for(const geo of owned)geo.dispose();for(const t of ownedTextures)t.dispose();sky?.material.dispose();group.removeFromParent();}
 return {group,setActive,update,dispose,chairs,cabinets,lockers,shells,get bell(){return bell;},get liftPanel(){return liftCopy;}};
}
