import * as THREE from './vendor/three.module.js';
import {createStudent} from './characters.js?v=04';
import {createTeacher,createDeskHands} from './game-actors.js?v=04';

// This room, its textures and props are built locally as editable 3D geometry.
export async function createClassroom(canvas, {onReady}={}) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#d2e7e9');
  scene.fog=new THREE.Fog('#dce8e7',17,36);
  const camera=new THREE.PerspectiveCamera(40,1,.08,70);
  const room=new THREE.Group();scene.add(room);
  const dynamic=new THREE.Group();scene.add(dynamic);
  const assets=new Set(), materials=new Set();
  const mat=(color,more={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.82,...more});materials.add(m);return m;};
  const M={wall:mat('#f0efe7'),trim:mat('#6caaa6'),blue:mat('#7daac5'),wood:mat('#de9c24'),edge:mat('#ac6c25'),steel:mat('#859497',{metalness:.32,roughness:.43}),dark:mat('#444f54'),paper:mat('#fff8e5'),red:mat('#ca6a55'),green:mat('#7b9f75'),bookBlue:mat('#7b9ebc'),yellow:mat('#e9c861'),leaf:mat('#69ad3e',{emissive:'#86b934',emissiveIntensity:.12}),soil:mat('#544334'),pot:mat('#c77757'),curtain:mat('#b9dce0',{side:THREE.DoubleSide}),white:mat('#f5f2e7'),black:mat('#303d3b')};
  const boxGeo=new THREE.BoxGeometry(1,1,1), sphereGeo=new THREE.SphereGeometry(1,14,10), cylGeo=new THREE.CylinderGeometry(1,1,1,12);assets.add(boxGeo);assets.add(sphereGeo);assets.add(cylGeo);
  function mesh(g,m,p,s=[1,1,1],r=null,parent=room){const o=new THREE.Mesh(g,m);o.position.set(...p);o.scale.set(...s);if(r)o.rotation.set(...r);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  const box=(m,p,s,r=null,parent=room)=>mesh(boxGeo,m,p,s,r,parent);
  const ball=(m,p,s,parent=room)=>mesh(sphereGeo,m,p,s,null,parent);
  const cylinder=(m,p,s,r=null,parent=room)=>mesh(cylGeo,m,p,s,r,parent);
  function texture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;assets.add(t);return t;}
  function boardTexture(){return texture(1600,800,(c,w,h)=>{
    c.fillStyle='#275b50';c.fillRect(0,0,w,h);let seed=20;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    for(let i=0;i<9000;i++){c.fillStyle=`rgba(216,234,211,${rand()*.05})`;c.fillRect(rand()*w,rand()*h,rand()*22,rand()*3);}
    c.fillStyle='#e7ebd8';c.font='38px "PingFang SC","Microsoft YaHei",sans-serif';c.fillText('数学',100,90);
    c.font='italic 58px Georgia,serif';c.fillText('y = ax² + bx + c',110,225);
    c.font='italic 45px Georgia,serif';c.fillText('a² + b² = c²',110,330);c.fillText('(a + b)² = a² + 2ab + b²',110,440);
    c.font='32px "PingFang SC","Microsoft YaHei",sans-serif';c.fillText('练习 3 · P.48',110,630);
    c.strokeStyle='#dbe3d0';c.lineWidth=4;c.beginPath();c.moveTo(970,480);c.lineTo(1340,480);c.lineTo(1340,205);c.closePath();c.stroke();c.beginPath();c.moveTo(1312,480);c.lineTo(1312,452);c.lineTo(1340,452);c.stroke();
    c.font='italic 35px Georgia,serif';c.fillText('a',1140,525);c.fillText('b',1370,360);c.fillText('c',1110,315);
    c.strokeStyle='#e6dba7';c.lineWidth=3;c.beginPath();c.moveTo(930,700);c.lineTo(1440,700);c.moveTo(1180,750);c.lineTo(1180,565);c.stroke();c.beginPath();c.moveTo(990,585);c.quadraticCurveTo(1180,810,1370,585);c.stroke();

  });}
  // Rounded edges catch narrow highlights, as on everyday laminated school furniture.
  const roundedCache=new Map();
  function roundedGeometry(w,h,d,r=.015){const key=[w,h,d,r].join(',');if(roundedCache.has(key))return roundedCache.get(key);r=Math.min(r,h*.24,w*.24,d*.24);const a=w-2*r,b=h-2*r,q=Math.min(r,b*.35),x=-a/2,y=-b/2,shape=new THREE.Shape();shape.moveTo(x+q,y);shape.lineTo(x+a-q,y);shape.quadraticCurveTo(x+a,y,x+a,y+q);shape.lineTo(x+a,y+b-q);shape.quadraticCurveTo(x+a,y+b,x+a-q,y+b);shape.lineTo(x+q,y+b);shape.quadraticCurveTo(x,y+b,x,y+b-q);shape.lineTo(x,y+q);shape.quadraticCurveTo(x,y,x+q,y);const g=new THREE.ExtrudeGeometry(shape,{depth:d-2*r,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:3,steps:1,curveSegments:4});g.translate(0,0,-(d-2*r)/2);assets.add(g);roundedCache.set(key,g);return g;}
  function rounded(m,p,s,r=.015,rotation=null,parent=room){return mesh(roundedGeometry(...s,r),m,p,[1,1,1],rotation,parent);}
  function pipe(m,points,radius=.022,parent=room){const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal'),Math.max(12,points.length*6),radius,8,false);assets.add(g);return mesh(g,m,[0,0,0],[1,1,1],null,parent);}
  const grain=texture(1024,512,(c,w,h)=>{c.fillStyle='#e8a23e';c.fillRect(0,0,w,h);let seed=71;const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647;};for(let i=0;i<650;i++){const yy=rand()*h;c.strokeStyle=`rgba(${rand()>.45?'129,74,22':'255,217,132'},${.035+rand()*.10})`;c.lineWidth=.3+rand()*1.5;c.beginPath();c.moveTo(0,yy);c.bezierCurveTo(w*.3,yy+Math.sin(i)*7,w*.7,yy-Math.sin(i)*6,w,yy+Math.cos(i)*4);c.stroke();}for(let i=0;i<3;i++){const x=rand()*w,y=rand()*h;for(let j=0;j<5;j++){c.strokeStyle='rgba(145,83,25,.06)';c.lineWidth=1;c.beginPath();c.ellipse(x,y,20+j*11,2+j*2,0,0,Math.PI*2);c.stroke();}}});
  grain.wrapS=grain.wrapT=THREE.RepeatWrapping;M.wood.color.set('#ffffff');M.wood.map=grain;M.wood.roughness=.55;M.wood.needsUpdate=true;M.edge.color.set('#bd792f');
  const pageTexture=texture(256,128,(c,w,h)=>{c.fillStyle='#eee9d8';c.fillRect(0,0,w,h);for(let y=2;y<h;y+=4){c.strokeStyle=y%8?'#d4d0c1':'#c7c4b8';c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}});
  const pageMat=mat('#ffffff',{map:pageTexture,roughness:.93});
  const printTexture=texture(512,640,(c,w,h)=>{c.fillStyle='#f5f1e6';c.fillRect(0,0,w,h);c.fillStyle='#4f5856';c.font='24px "PingFang SC",sans-serif';c.fillText('数学  ·  练习',35,48);for(let j=0;j<19;j++){c.fillStyle=j%5===0?'#6e7572':'#a0a29a';c.fillRect(35,80+j*24,300+(j%3)*35,2);}c.fillStyle='#8a9390';c.fillRect(300,155,125,100);c.fillStyle='#d8dfd6';c.beginPath();c.moveTo(315,235);c.lineTo(410,235);c.lineTo(410,170);c.closePath();c.fill();});
  const printMat=mat('#ffffff',{map:printTexture,roughness:.94});
  const floorTexture=texture(1024,1024,(c,w,h)=>{c.fillStyle='#bcbdb5';c.fillRect(0,0,w,h);let s=123;const rand=()=>{s=s*16807%2147483647;return s/2147483647;};for(let i=0;i<10500;i++){const v=rand();c.fillStyle=v<.3?'#929b96':v<.6?'#ced0c8':v<.85?'#a4ada7':'#e1dfd4';c.beginPath();c.ellipse(rand()*w,rand()*h,1+rand()*4.5,1+rand()*3,rand()*6.28,0,6.28);c.fill();}});
  floorTexture.wrapS=floorTexture.wrapT=THREE.RepeatWrapping;floorTexture.repeat.set(4,5);
  const floorMat=mat('#ffffff',{map:floorTexture,roughness:.86});
  box(floorMat,[0,-.11,-.5],[12,.2,14]);
  const grout=mat('#888f88');for(let x=-6;x<=6;x+=1.2)box(grout,[x,-.006,-.5],[.008,.003,14]);for(let z=-7.5;z<=6.5;z+=1.2)box(grout,[0,-.005,z],[12,.003,.008]);
  const contactTexture=texture(128,128,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,5,w/2,h/2,w/2);g.addColorStop(0,'rgba(49,54,48,.48)');g.addColorStop(.45,'rgba(49,54,48,.24)');g.addColorStop(1,'rgba(49,54,48,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
  const contactMat=new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,opacity:.62});materials.add(contactMat);
  function contact(x,z,w=1.7,d=1.2){const g=new THREE.PlaneGeometry(w,d);assets.add(g);const o=mesh(g,contactMat,[x,-.001,z],[1,1,1],[-Math.PI/2,0,0]);o.castShadow=false;}

  // Whitewashed school walls, blue-green skirting and a cutaway rear for the camera.
  box(M.wall,[0,2.3,-6.8],[12,.0+4.6,.18]);box(M.trim,[0,.54,-6.67],[12,1.08,.1]);box(M.dark,[0,.08,-6.56],[12,.11,.09]);
  box(M.wall,[5.9,2.3,-3.7],[.18,4.6,6.2]);box(M.trim,[5.79,.54,-3.7],[.1,1.08,6.2]);box(M.dark,[5.70,.08,-3.7],[.08,.11,6.2]);
  // Sunlit windows run down the left wall, with actual openings.
  box(M.wall,[-5.9,.57,-.8],[.18,1.14,12]);box(M.trim,[-5.78,.49,-.8],[.10,.98,12]);
  box(M.wall,[-5.9,4.3,-.8],[.18,.60,12]);
  for(const z of [-6.7,-2.8,1.1,5.0])box(M.wall,[-5.9,2.7,z],[.20,3.2,.34]);
  const skyMat=new THREE.MeshBasicMaterial({color:'#cee8ef'});materials.add(skyMat);
  const glassMat=mat('#d8f0e7',{transparent:true,opacity:.07,roughness:.14,depthWrite:false});
  const curtains=[];
  for(const z of [-4.75,-.85,3.05]){
    box(skyMat,[-15.0,2.65,z],[.02,9.4,5.8]).castShadow=false;
    box(glassMat,[-5.93,2.6,z],[.025,2.72,3.45]).castShadow=false;
    for(const zz of [z-1.77,z,z+1.77])box(M.blue,[-5.78,2.65,zz],[.13,3.0,.065]);
    for(const y of [1.2,2.65,4.1])box(M.blue,[-5.77,y,z],[.14,.075,3.6]);
    box(M.white,[-5.63,1.17,z],[.5,.13,3.7]);
    cylinder(M.steel,[-5.45,4.12,z],[.025,3.83,.025],[Math.PI/2,0,0]);
    for(const side of [-1,1]){
      const g=new THREE.PlaneGeometry(.84,2.8,14,16);assets.add(g);const pos=g.attributes.position;for(let i=0;i<pos.count;i++)pos.setZ(i,Math.sin(pos.getX(i)*31)*.085);g.computeVertexNormals();
      const curtain=new THREE.Mesh(g,M.curtain);curtain.rotation.y=Math.PI/2;curtain.position.set(-5.52,2.64,z+side*1.45);curtain.receiveShadow=true;dynamic.add(curtain);curtains.push(curtain);
    }
    // Soft shapes of trees beyond the windows.
    cylinder(M.edge,[-6.4,1.3,z+.6],[.08,2.6,.08]);
    for(let j=0;j<11;j++){const a=j*2.4;ball(j%3===0?M.green:M.leaf,[-6.85+Math.cos(a)*.48,1.85+(j%4)*.38,z+.3+Math.sin(a)*.67],[.40,.46,.42]);}
  }
  // The opposite school block and tree canopy are visible through clear blue windows.
  const exteriorWall=mat('#e4e7dc'),exteriorGlass=mat('#85aeb9',{roughness:.3});
  box(exteriorWall,[-10.5,2.5,-1.5],[.45,6,16]);for(let row=0;row<3;row++)for(let col=0;col<9;col++){const z=-8.2+col*1.7,y=.8+row*1.75;box(M.white,[-10.2,y,z],[.1,1.4,1.15]);box(exteriorGlass,[-10.12,y,z],[.06,1.24,.99]);box(M.white,[-10.07,y,z],[.025,1.24,.035]);}for(let row=0;row<3;row++)box(M.trim,[-10.08,row*1.75+.1,-1.5],[.08,.10,16]);
  const boardMat=mat('#ffffff',{map:boardTexture(),roughness:.95});
  box(M.edge,[-.6,2.6,-6.52],[7.35,2.95,.17]);box(boardMat,[-.6,2.6,-6.40],[7.12,2.72,.045]);
  box(M.steel,[-.6,1.2,-6.28],[7.4,.055,.22]);
  for(let i=0;i<5;i++)cylinder(i===2?M.yellow:M.paper,[-2.8+i*.20,1.26,-6.24],[.018,.14,.018],[0,0,Math.PI/2]);
  box(M.dark,[2.0,1.28,-6.22],[.25,.07,.13]);
  const labelTex=texture(1024,100,(c,w,h)=>{c.fillStyle='#f0efe7';c.fillRect(0,0,w,h);c.fillStyle='#a13d34';c.font='bold 54px "PingFang SC","Microsoft YaHei",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('好 好 学 习    天 天 向 上',w/2,h/2);});
  box(mat('#ffffff',{map:labelTex}),[-.6,4.25,-6.52],[7.2,.50,.035]);
  // Classroom clock and the crowded, very ordinary bulletin board.
  const clockTex=texture(256,256,(c,w,h)=>{c.fillStyle='#f2efe3';c.fillRect(0,0,w,h);c.strokeStyle='#3e4a4d';c.fillStyle='#3e4a4d';c.lineWidth=4;for(let i=0;i<12;i++){const a=i/12*Math.PI*2;c.beginPath();c.moveTo(128+Math.sin(a)*91,128-Math.cos(a)*91);c.lineTo(128+Math.sin(a)*105,128-Math.cos(a)*105);c.stroke();}c.lineCap='round';c.lineWidth=8;c.beginPath();c.moveTo(128,128);c.lineTo(181,135);c.moveTo(128,128);c.lineTo(49,151);c.stroke();c.beginPath();c.arc(128,128,7,0,7);c.fill();});
  cylinder(M.dark,[4.5,3.7,-6.43],[.43,.08,.43],[Math.PI/2,0,0]);
  const cg=new THREE.CircleGeometry(.39,40);assets.add(cg);mesh(cg,mat('#ffffff',{map:clockTex}),[4.5,3.7,-6.37]);
  box(M.edge,[5.72,2.52,-3.55],[.10,1.80,3.65]);box(M.trim,[5.65,2.52,-3.55],[.02,1.65,3.48]);
  for(let i=0;i<7;i++){const z=-4.82+(i%4)*.82,y=2.91-Math.floor(i/4)*.81;box(i%3===0?M.yellow:M.paper,[5.62,y,z],[.025,.63,.54],[((i%3)-1)*.04,0,0]);for(let j=0;j<4;j++)box(M.bookBlue,[5.60,y+.12-j*.075,z],[.009,.012,.35]);}
  // Glazed classroom door and its metal lever, set into the side wall.
  rounded(M.blue,[5.73,1.30,-.96],[.13,2.60,1.12],.018);rounded(M.trim,[5.64,1.30,-.96],[.055,2.43,.96],.012);
  box(M.dark,[5.603,1.88,-.96],[.022,.87,.67]);box(exteriorGlass,[5.585,1.88,-.96],[.018,.79,.59]);
  box(M.blue,[5.567,1.88,-.96],[.025,.79,.031]);box(M.blue,[5.567,1.88,-.96],[.025,.032,.59]);
  cylinder(M.steel,[5.56,1.06,-.62],[.032,.05,.032],[0,0,Math.PI/2]);pipe(M.steel,[[5.53,1.06,-.62],[5.49,1.06,-.62],[5.49,1.06,-.77]],.016);
  // Small storage cabinet and cleaning corner.
  box(M.trim,[4.88,.68,-5.65],[1.37,1.36,.72]);for(const x of [4.55,5.22]){box(M.wall,[x,.75,-5.26],[.62,1.02,.035]);cylinder(M.dark,[x+.16,.76,-5.22],[.025,.12,.025]);}
  box(M.edge,[4.88,1.38,-5.65],[1.5,.07,.83]);
  cylinder(M.pot,[5.1,1.54,-5.6],[.17,.3,.17]);for(let i=0;i<7;i++){const a=i*2.4;ball(M.leaf,[5.1+Math.sin(a)*.2,1.87+(i%3)*.10,-5.6+Math.cos(a)*.18],[.12,.23,.10]);}
  // Honey-yellow laminate desks on grey tubular steel legs.
  function book(parent,x,y,z,color,angle=0){const b=new THREE.Group();b.position.set(x,y,z);b.rotation.y=angle;parent.add(b);rounded(color,[0,.008,0],[.35,.014,.26],.004,null,b);box(pageMat,[.008,.032,.002],[.323,.037,.242],null,b);rounded(color,[0,.057,0],[.35,.014,.26],.004,null,b);rounded(color,[-.169,.032,0],[.018,.058,.26],.004,null,b);box(M.paper,[.025,.066,0],[.21,.001,.025],null,b);return b;}
  function openBook(parent,x,y,z,angle=0,standing=false){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=angle;parent.add(g);for(const side of [-1,1]){const pg=new THREE.Group();pg.position.x=side*.014;pg.rotation.z=side*(standing?.25:.06);g.add(pg);rounded(M.bookBlue,[side*.155,.007,0],[.31,.017,.42],.004,null,pg);box(pageMat,[side*.155,.023,0],[.30,.025,.40],null,pg);const face=new THREE.PlaneGeometry(.29,.39);assets.add(face);mesh(face,printMat,[side*.155,.038,0],[1,1,1],[-Math.PI/2,0,0],pg);}if(standing)g.rotation.x=1.05;return g;}
  function pen(parent,x,y,z,color,rotation=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotation;parent.add(g);cylinder(color,[0,0,0],[.012,.26,.012],[Math.PI/2,0,0],g);cylinder(M.steel,[0,0,.145],[.006,.027,.006],[Math.PI/2,0,0],g);cylinder(M.white,[0,0,-.10],[.013,.043,.013],[Math.PI/2,0,0],g);}
  const backpack=mat('#354f72'),zipper=mat('#c8c5a9');
  function desk(x,z,seed=0,rot=0,hero=false){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;room.add(g);contact(x,z,1.55,1.4);
    rounded(M.edge,[0,.811,0],[1.19,.074,.78],.018,null,g);rounded(M.wood,[0,.854,0],[1.20,.034,.79],.012,null,g);
    // Tubular side frames bend around the lower stretchers and upper desk rail.
    for(const a of [-.49,.49]){pipe(M.steel,[[a,.035,-.29],[a,.12,-.29],[a,.70,-.27],[a,.775,-.23],[a,.775,.23],[a,.70,.27],[a,.12,.29],[a,.035,.29]],.025,g);pipe(M.steel,[[a,.24,-.28],[a,.22,-.19],[a,.22,.19],[a,.24,.28]],.019,g);for(const b of [-.29,.29])rounded(M.dark,[a,.035,b],[.067,.055,.073],.008,null,g);}
    pipe(M.steel,[[-.49,.27,-.27],[-.42,.24,-.27],[.42,.24,-.27],[.49,.27,-.27]],.018,g);
    // Open book tray, mounting brackets and tiny fasteners under the laminate.
    for(const zz of [-.24,-.10,.04,.18])box(M.steel,[0,.66,zz],[.97,.018,.018],null,g);for(const xx of [-.47,-.23,0,.23,.47])box(M.steel,[xx,.66,-.03],[.018,.018,.45],null,g);
    for(const a of [-.47,.47])for(const b of [-.23,.23]){box(M.steel,[a,.785,b],[.09,.026,.10],null,g);cylinder(M.dark,[a,.802,b],[.009,.012,.009],null,g);}
    if(seed%3===0)book(g,-.26,.69,-.06,M.red,.06);
    book(g,-.31,.878,-.20,[M.bookBlue,M.green,M.red][seed%3],-.04);if(seed%3===1)book(g,-.29,.944,-.18,M.paper,.045);
    openBook(g,.15,.883,.06,-.04);pen(g,-.40,.90,.17,M.red,.35);pen(g,.47,.9,.10,M.bookBlue,-.22);
    if(seed%2===0){rounded(M.bookBlue,[-.32,.93,-.03],[.29,.085,.12],.025,[0,.07,0],g);box(zipper,[-.32,.976,-.03],[.24,.004,.009],[0,.07,0],g);}
    if(seed%3===1){cylinder(M.bookBlue,[.48,1.04,-.22],[.055,.28,.055],null,g);rounded(M.dark,[.48,1.19,-.22],[.083,.04,.083],.01,null,g);}
    if(seed%4===0){pipe(M.steel,[[.54,.74,0],[.63,.70,0],[.63,.64,0]],.014,g);rounded(backpack,[.68,.42,.03],[.23,.38,.30],.045,[0,0,.07],g);rounded(M.bookBlue,[.80,.40,.03],[.028,.23,.22],.01,null,g);pipe(backpack,[[.69,.59,-.05],[.69,.68,-.03],[.69,.68,.04],[.69,.59,.06]],.016,g);}
    if(hero){rounded(M.yellow,[.38,.99,-.11],[.17,.19,.07],.008,[0,.15,-.18],g);box(M.red,[.38,1.0,-.067],[.15,.055,.007],[0,.15,-.18],g);cylinder(M.white,[-.48,1.02,.19],[.06,.23,.06],null,g);openBook(g,-.24,.94,-.10,.04,true);}
    return g;
  }
  const chairPanel=new THREE.BufferGeometry(),cp=[],ci=[];for(let side=0;side<2;side++)for(let row=0;row<2;row++)for(let i=0;i<=16;i++){const x=-.28+i*.035;cp.push(x,.94+row*.28,-.22+.052*(1-(x/.28)**2)+(side?-.018:.018));}const addQuad=(a,b,c,d)=>ci.push(a,b,d,b,c,d);for(let i=0;i<16;i++){addQuad(i,i+1,18+i,17+i);addQuad(34+i,51+i,52+i,35+i);addQuad(i,34+i,35+i,i+1);addQuad(17+i,18+i,52+i,51+i);}addQuad(0,17,51,34);addQuad(16,50,67,33);chairPanel.setAttribute('position',new THREE.Float32BufferAttribute(cp,3));chairPanel.setIndex(ci);chairPanel.computeVertexNormals();assets.add(chairPanel);
  function chair(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;room.add(g);contact(x,z,.80,.9);rounded(M.wood,[0,.62,0],[.56,.055,.51],.020,null,g);for(const a of [-.23,.23]){pipe(M.steel,[[a,.03,.19],[a,.12,.19],[a,.59,.17],[a,.67,.12],[a,.67,-.13],[a,.59,-.19],[a,.03,-.22]],.023,g);pipe(M.steel,[[a,.60,-.17],[a,.70,-.21],[a,1.18,-.23]],.021,g);for(const b of [-.22,.19])rounded(M.dark,[a,.022,b],[.058,.043,.063],.008,null,g);}mesh(chairPanel,M.wood,[0,0,0],[1,1,1],null,g);for(const x of [-.22,.22])cylinder(M.steel,[x,1.09,-.164],[.014,.008,.014],[Math.PI/2,0,0],g);pipe(M.steel,[[-.23,.23,-.21],[0,.23,-.21],[.23,.23,-.21]],.017,g);}
  // Paired occupied desks dominate the foreground; the spare desks remain at the back.
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){if(row===2&&col===3)continue;const x=-3.9+col*2.10,z=-4.15+row*2.05;desk(x,z,row*4+col);chair(x,z-.76,0);}
  desk(2.12,2.82,7,.025,true);chair(2.12,2.06,.025);
  desk(-.05,2.18,8,-.025);chair(-.05,1.42,-.025);
  // Teacher's desk, book stack and exercise-paper trays.
  box(M.trim,[-.9,.53,-5.8],[1.7,1.06,.68]);box(M.wood,[-.9,1.10,-5.76],[1.95,.09,.88]);book(room,-1.45,1.16,-5.6,M.red);book(room,-1.45,1.22,-5.6,M.bookBlue,.03);
  // Two ceiling fans: real blade rotations, deliberately sparse ceiling geometry.
  const fans=[];for(const z of [-3.5,1.2]){cylinder(M.white,[.1,4.27,z],[.045,.48,.045]);cylinder(M.steel,[.1,4.0,z],[.12,.10,.12]);const fan=new THREE.Group();fan.position.set(.1,3.95,z);fan.scale.setScalar(.68);dynamic.add(fan);for(let i=0;i<3;i++){const blade=new THREE.Group();blade.rotation.y=i*Math.PI*2/3;fan.add(blade);box(M.white,[.48,0,0],[.90,.025,.15],[0,0,.02],blade);}fans.push(fan);}
  const lampMat=mat('#fffcee',{emissive:'#fffbd9',emissiveIntensity:.30});for(const z of [-4.9,-.3])for(const x of [-3,3]){box(M.steel,[x,4.24,z],[1.5,.075,.22]);box(lampMat,[x,4.19,z],[1.4,.025,.15]);}
  // Students are independent articulated models, not image planes.
  const pupils=[],menuMoods=[];function pupil(variant,x,z,seated,mood,rotation=0,scale=1){const p=createStudent({variant,seated,mood,seed:pupils.length+3,scale});p.group.position.set(x,0,z);p.group.rotation.y=rotation;dynamic.add(p.group);pupils.push(p);menuMoods.push(mood);return p;}
  pupil('girl',-1.80,-4.91,true,'writing',.12);
  pupil('boy',.30,-2.86,true,'thinking',.25);
  pupil('girl',-3.9,-.81,true,'chat',.30);
  pupil('boy',2.40,-4.91,true,'writing',-.08);
  pupil('girl',-.05,1.42,true,'chat',.17);
  let hero=pupil('boy',2.18,2.06,true,'snack',.15,1.10);
  const heroCache=new Map([['boy',hero]]);
  // Contact shadows and warm late-afternoon window light keep the floor grounded.
  scene.add(new THREE.HemisphereLight('#e4ecf0','#71786a',1.30));
  const sun=new THREE.DirectionalLight('#fff2d5',3.0);sun.position.set(-8,9,3);sun.target.position.set(1,0,-2);scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:1,far:32});sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;sun.shadow.radius=2;
  const fill=new THREE.DirectionalLight('#fff1e6',1.35);fill.position.set(5,4,6);scene.add(fill);
  // Window-shaped pools of sunlight are subtle geometry, never an image backdrop.
  const lightMat=new THREE.MeshBasicMaterial({color:'#fff3c2',transparent:true,opacity:.14,depthWrite:false});materials.add(lightMat);
  for(let i=0;i<3;i++){const patch=box(lightMat,[-2.8,.004,-4.2+i*3.6],[3.4,.001,2.65],[0,-.26,0]);patch.castShadow=false;patch.receiveShadow=false;}
  // Batch fixed props by material. Animated pupils, curtain cloth and fans stay separate.
  function bakeStatic(group){group.updateMatrixWorld(true);const buckets=new Map(), originals=[];group.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material)){const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);const key=o.material.uuid+'_'+o.castShadow;let bucket=buckets.get(key);if(!bucket){bucket={material:o.material,cast:o.castShadow,parts:[]};buckets.set(key,bucket);}bucket.parts.push(g);originals.push(o);}});for(const o of originals)o.removeFromParent();for(const b of buckets.values()){const n=b.parts.reduce((n,g)=>n+g.attributes.position.count,0),g=new THREE.BufferGeometry();for(const key of ['position','normal','uv']){const size=key==='uv'?2:3,a=new Float32Array(n*size);let offset=0;for(const part of b.parts){if(part.attributes[key])a.set(part.attributes[key].array,offset);offset+=part.attributes.position.count*size;}g.setAttribute(key,new THREE.BufferAttribute(a,size));}assets.add(g);const m=new THREE.Mesh(g,b.material);m.castShadow=b.cast;m.receiveShadow=true;group.add(m);for(const p of b.parts)p.dispose();}}
  bakeStatic(room);
  // The menu is a cutaway. Only a seated round closes the teaching end of the room.
  const teachingEnd=new THREE.Group();teachingEnd.name='gameplay-teaching-end';scene.add(teachingEnd);
  box(M.wall,[0,2.3,6.62],[12,4.6,.18],null,teachingEnd);
  box(M.trim,[0,.54,6.49],[12,1.08,.10],null,teachingEnd);
  box(M.dark,[0,.08,6.40],[12,.11,.09],null,teachingEnd);
  // Finish the cutaway walls only for the seated view; the menu stays open.
  box(M.wall,[5.9,2.3,2.98],[.18,4.6,7.36],null,teachingEnd);
  box(M.trim,[5.79,.54,2.98],[.10,1.08,7.36],null,teachingEnd);
  box(M.dark,[5.70,.08,2.98],[.08,.11,7.36],null,teachingEnd);
  box(M.wall,[-5.9,2.3,5.91],[.20,4.6,1.50],null,teachingEnd);
  box(M.trim,[-5.78,.54,5.91],[.10,1.08,1.50],null,teachingEnd);
  box(M.dark,[-5.70,.08,5.91],[.08,.11,1.50],null,teachingEnd);
  const ceilingMaterial=new THREE.MeshBasicMaterial({color:'#dde1da'});materials.add(ceilingMaterial);
  const ceiling=box(ceilingMaterial,[0,4.65,-.08],[12.04,.16,13.56],null,teachingEnd);
  ceiling.castShadow=false;
  // A small classroom noticeboard gives the newly enclosed side wall detail.
  box(M.edge,[5.76,2.55,2.85],[.10,1.62,2.65],null,teachingEnd);
  box(M.green,[5.69,2.55,2.85],[.025,1.46,2.48],null,teachingEnd);
  for(let i=0;i<6;i++){
    const z=2.06+(i%3)*.79,y=2.91-Math.floor(i/3)*.73;
    box(i===1?M.yellow:M.paper,[5.67,y,z],[.018,.56,.54],null,teachingEnd);
    for(let j=0;j<4;j++)box(M.bookBlue,[5.657,y+.13-j*.08,z],[.006,.012,.35],null,teachingEnd);
  }
  box(M.edge,[-.6,2.62,6.40],[7.35,2.95,.17],null,teachingEnd);
  box(boardMat,[-.6,2.62,6.28],[7.12,2.72,.045],null,teachingEnd);
  box(M.steel,[-.6,1.22,6.16],[7.4,.055,.22],null,teachingEnd);
  box(mat('#ffffff',{map:labelTex}),[-.6,4.25,6.38],[7.2,.50,.035],null,teachingEnd);
  for(let i=0;i<4;i++)cylinder(i===2?M.yellow:M.paper,[-2.8+i*.20,1.28,6.12],[.018,.14,.018],[0,0,Math.PI/2],teachingEnd);
  box(M.dark,[2.0,1.30,6.10],[.25,.07,.13],null,teachingEnd);
  // A compact side lectern leaves the central board and the pupil's sightline open.
  rounded(M.trim,[-4.4,.55,5.54],[1.15,1.1,.62],.025,null,teachingEnd);
  rounded(M.wood,[-4.4,1.14,5.54],[1.35,.08,.76],.015,null,teachingEnd);
  book(teachingEnd,-4.7,1.19,5.5,M.red,.05);book(teachingEnd,-4.7,1.25,5.5,M.bookBlue,-.03);
  bakeStatic(teachingEnd);teachingEnd.visible=false;
  // Light from the seated side illuminates faces and chalk without washing the floor.
  const teachingFill=new THREE.DirectionalLight('#fff5e4',1.10);
  teachingFill.position.set(0,3.0,-3.0);teachingFill.target.position.set(0,2.25,5.3);
  teachingEnd.add(teachingFill,teachingFill.target);
  const teacher=createTeacher();teacher.group.position.set(1.35,0,5.2);teacher.group.visible=false;dynamic.add(teacher.group);
  const hands=createDeskHands();hands.group.visible=false;camera.add(hands.group);scene.add(camera);
  // Props belong to their classmates, so every AI action is visible in the room.
  const friendProps=pupils.map((p,index)=>{
    if(index===1)return null;
    const group=new THREE.Group();group.visible=false;p.group.add(group);
    const phone=new THREE.Group();group.add(phone);
    rounded(M.dark,[0,0,0],[.105,.18,.018],.009,null,phone);
    const phoneScreen=mat('#8dc5be',{emissive:'#8dc5be',emissiveIntensity:.3});
    box(phoneScreen,[0,0,-.011],[.088,.153,.003],null,phone);
    const note=new THREE.Group();group.add(note);
    rounded(M.paper,[0,0,0],[.14,.085,.006],.003,null,note);
    box(M.bookBlue,[0,.005,-.004],[.11,.002,.001],null,note);
    return{group,phone,note};
  });
  const flashMat=new THREE.MeshBasicMaterial({color:'#ffd4a1',transparent:true,opacity:0,depthWrite:false,depthTest:false,toneMapped:false});materials.add(flashMat);
  const flashGeometry=new THREE.PlaneGeometry(2,2);assets.add(flashGeometry);
  const flash=new THREE.Mesh(flashGeometry,flashMat);flash.position.z=-.1;flash.renderOrder=1000;flash.frustumCulled=false;flash.visible=false;camera.add(flash);
  let alive=true,motion=true,quality='high',mode='classroom',tourEnabled=false,dragging=false,lastX=0,dragYaw=0,dragPitch=0;
  let gameplay=null,gameTime=0,entryTime=0,feedbackTime=0,feedbackKind='',lastTeacherPhase='board';
  const pointer=new THREE.Vector2(),smoothPointer=new THREE.Vector2(),gamePointer=new THREE.Vector2(),neutralPointer=new THREE.Vector2();
  const basePosition=new THREE.Vector3(3.65,2.15,5.70),look=new THREE.Vector3(.60,1.25,-.10);
  const playerPosition=new THREE.Vector3(.30,1.43,-2.86),teacherTarget=new THREE.Vector3(1.35,0,5.2);
  const entryPosition=new THREE.Vector3(),entryQuaternion=new THREE.Quaternion(),targetQuaternion=new THREE.Quaternion(),menuOffset=new THREE.Vector3(),targetLook=new THREE.Vector3(),upAxis=new THREE.Vector3(0,1,0);
  const cameraTarget=new THREE.Object3D(),cameraForwardFlip=new THREE.Quaternion().setFromAxisAngle(upAxis,Math.PI);let entryFov=40;
  camera.position.copy(basePosition);camera.lookAt(look);
  const menuFov=()=>camera.aspect<.9?48:40;
  const gameFov=()=>camera.aspect<.9?69:62;
  function resize(){const rect=canvas.getBoundingClientRect();const w=Math.max(1,rect.width),h=Math.max(1,rect.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=gameplay?THREE.MathUtils.lerp(entryFov,gameFov(),THREE.MathUtils.smoothstep(entryTime/.7,0,1)):menuFov();camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  function move(e){const r=canvas.getBoundingClientRect();pointer.set(THREE.MathUtils.clamp((e.clientX-r.left)/r.width-.5,-.5,.5),THREE.MathUtils.clamp((e.clientY-r.top)/r.height-.5,-.5,.5));if(dragging&&!gameplay){dragYaw+=(e.clientX-lastX)*.004;lastX=e.clientX;dragYaw=THREE.MathUtils.clamp(dragYaw,-.55,.55);}}
  function down(e){if(!tourEnabled||gameplay)return;dragging=true;lastX=e.clientX;canvas.setPointerCapture?.(e.pointerId);}
  function up(){dragging=false;}
  window.addEventListener('pointermove',move,{passive:true});canvas.addEventListener('pointerdown',down);window.addEventListener('pointerup',up);
  function heroMood(){return mode==='chase'?'hero':mode==='search'?'thinking':'snack';}
  function restorePupils(){pupils.forEach((p,i)=>{p.group.visible=true;p.setMood?.(p===hero?heroMood():menuMoods[i]);if(friendProps[i])friendProps[i].group.visible=false;});}
  function setGameplay(state){
    if(!state){
      if(!gameplay)return;
      gameplay=null;teachingEnd.visible=false;teacher.group.visible=false;hands.group.visible=false;flash.visible=false;flashMat.opacity=0;feedbackTime=0;
      restorePupils();camera.fov=menuFov();camera.updateProjectionMatrix();canvas.style.cursor=tourEnabled?'grab':'';canvas.dataset.gameplay='false';return;
    }
    if(!gameplay){
      entryPosition.copy(camera.position);entryQuaternion.copy(camera.quaternion);entryFov=camera.fov;entryTime=0;gameTime=0;feedbackTime=0;
      pointer.set(0,0);gamePointer.set(0,0);dragging=false;
      teacher.group.position.set(1.35,0,5.2);teacher.group.rotation.y=0;lastTeacherPhase='board';
      teachingEnd.visible=true;teacher.group.visible=true;hands.group.visible=true;pupils[1].group.visible=false;canvas.style.cursor='';canvas.dataset.gameplay='true';
    }
    gameplay=state;
  }
  const friendOrder=[4,2,5,0];
  const moodMap={writing:'writing',thinking:'thinking',snack:'snack',note:'chat',phone:'thinking',cough:'chat'};
  function updateClassmates(state,dt){
    pupils.forEach((p,i)=>{if(i===1)return;p.setMood?.('writing');if(friendProps[i])friendProps[i].group.visible=false;});
    for(const student of state.students||[]){
      const index=friendOrder[student.id%friendOrder.length],p=pupils[index],prop=friendProps[index];if(!p)continue;
      p.setMood?.(moodMap[student.mood]||'writing');p.update(gameTime,dt);
      if(student.mood==='cough'){p.head.rotation.x=.13+Math.sin(gameTime*8)*.045;p.head.rotation.y=-.24;}
      if(prop){
        const isPhone=student.mood==='phone',isNote=student.mood==='note';prop.group.visible=isPhone||isNote;
        prop.phone.visible=isPhone;prop.note.visible=isNote;
        prop.group.position.set(isPhone?.17:.33,isPhone?1.13:1.04+(Math.sin(gameTime*.85)+1)*.035,isPhone?.22:.28);
        prop.group.rotation.set(isPhone?-.15:0,isPhone?.08:.4,isPhone?-.1:-.2);
      }
    }
    for(const [index,p]of pupils.entries())if(index!==1&&!friendOrder.includes(index))p.update(gameTime,dt);
  }
  const wrappedAngle=(a)=>Math.atan2(Math.sin(a),Math.cos(a));
  function updateTeacher(state,dt){
    const t=state.teacher||{},phase=t.phase||'board',walk=phase==='patrol',progress=THREE.MathUtils.clamp(t.walkProgress||0,0,1);
    teacherTarget.set(1.35,0,5.2);
    if(phase==='watching')teacherTarget.z=3.55;
    if(walk)teacherTarget.z=4.4-5.1*Math.sin(progress*Math.PI);
    teacher.group.position.lerp(teacherTarget,1-Math.exp(-dt*(walk?12:2.8)));
    let yaw=0;
    if(phase==='turning')yaw=-Math.PI*THREE.MathUtils.smoothstep((t.phaseTime||0)/Math.max(.01,t.phaseDuration||.8),0,1);
    else if(phase==='watching')yaw=Math.atan2(playerPosition.x-teacher.group.position.x,playerPosition.z-teacher.group.position.z);
    else if(walk)yaw=t.looking?Math.atan2(playerPosition.x-teacher.group.position.x,playerPosition.z-teacher.group.position.z):progress<.5?-Math.PI:0;
    else if(phase==='distracted'){
      const helper=(state.students||[]).find(s=>s.mood==='cough'),p=pupils[friendOrder[(helper?.id||0)%friendOrder.length]];
      yaw=Math.atan2(p.group.position.x-teacher.group.position.x,p.group.position.z-teacher.group.position.z);
    }
    // Shortest-path easing preserves the turn instead of flipping the teacher model.
    const angleDelta=wrappedAngle(yaw-teacher.group.rotation.y);
    teacher.group.rotation.y+=angleDelta*(1-Math.exp(-dt*(phase==='turning'?12:6)));
    let headLook=0;
    if(walk&&t.looking){const bearing=Math.atan2(playerPosition.x-teacher.group.position.x,playerPosition.z-teacher.group.position.z);headLook=THREE.MathUtils.clamp(wrappedAngle(bearing-teacher.group.rotation.y),-.8,.8);}
    teacher.update(gameTime,{walking:walk?1:teacher.group.position.distanceTo(teacherTarget)>.1?.5:0,look:headLook,phase,alert:Math.max((state.suspicion||0)/100,feedbackKind==='caught'?feedbackTime/.55:0)});
    lastTeacherPhase=phase;
  }
  let last=performance.now(),time=0,frame=0,lastLow=0,lastDebugTime=0,frameAverage=16.7,renderAverage=0;
  function render(now){if(!alive)return;frame=requestAnimationFrame(render);if(document.hidden){last=now;return;}if(quality==='low'&&now-lastLow<32)return;const dt=Math.min((now-last)/1000,.08);last=now;lastLow=now;
    const frozen=Boolean(gameplay&&(gameplay.paused||gameplay.status!=='playing'));
    if(!gameplay){
      if(motion)time+=dt;
      smoothPointer.lerp(motion?pointer:neutralPointer,.035);
      const angle=tourEnabled?dragYaw:(motion?Math.sin(time*.09)*.013:0);
      menuOffset.copy(basePosition).sub(look).applyAxisAngle(upAxis,angle);
      camera.position.copy(look).add(menuOffset);camera.position.x+=smoothPointer.x*.20;camera.position.y+=smoothPointer.y*.10;camera.lookAt(look);
      for(const p of pupils)p.update(time,motion?dt:0);
    }else{
      const activeDt=frozen?0:dt;
      if(!frozen){gameTime+=dt;entryTime=Math.min(.7,entryTime+dt);gamePointer.lerp(pointer,1-Math.exp(-dt*5));}
      const yaw=-gamePointer.x*.7,pitch=-.08-gamePointer.y*.30;
      const blend=THREE.MathUtils.smoothstep(entryTime/.7,0,1);
      targetLook.set(playerPosition.x+Math.sin(yaw)*8,playerPosition.y+Math.tan(pitch)*8,playerPosition.z+Math.cos(yaw)*8);
      cameraTarget.position.copy(playerPosition);cameraTarget.lookAt(targetLook);targetQuaternion.copy(cameraTarget.quaternion);
      // Object3D looks along +Z; a camera looks along -Z.
      targetQuaternion.multiply(cameraForwardFlip);
      camera.position.lerpVectors(entryPosition,playerPosition,blend);camera.quaternion.slerpQuaternions(entryQuaternion,targetQuaternion,blend);
      const nextFov=THREE.MathUtils.lerp(entryFov,gameFov(),blend);if(Math.abs(camera.fov-nextFov)>.001){camera.fov=nextFov;camera.updateProjectionMatrix();}
      if(!gameplay.paused)feedbackTime=Math.max(0,feedbackTime-dt);
      if(feedbackKind==='caught'&&feedbackTime>0&&motion)camera.position.y+=Math.sin((.55-feedbackTime)/.55*Math.PI*2)*.022*(feedbackTime/.55)*blend;
      flash.visible=feedbackTime>0;flashMat.opacity=feedbackKind==='caught'?.045*Math.sin(Math.min(1,feedbackTime/.55)*Math.PI):.018*Math.sin(Math.min(1,feedbackTime/.4)*Math.PI);
      updateTeacher(gameplay,activeDt);updateClassmates(gameplay,activeDt);
      hands.update(gameTime,{action:gameplay.selected,holding:gameplay.holding,progress:gameplay.actionProgress,alert:feedbackKind==='caught'?feedbackTime/.55:(gameplay.suspicion||0)/150});
    }
    if(motion&&!frozen){const ambientTime=gameplay?gameTime:time;fans.forEach((f,i)=>f.rotation.y=ambientTime*(1.7+i*.08));curtains.forEach((c,i)=>{c.rotation.z=Math.sin(ambientTime*.65+i)*.012;c.position.x=-5.52+Math.sin(ambientTime*.8+i)*.025;});}
    const renderStart=performance.now();renderer.render(scene,camera);
    frameAverage+=(dt*1000-frameAverage)*.08;renderAverage+=(performance.now()-renderStart-renderAverage)*.08;
    if(now-lastDebugTime>1000){lastDebugTime=now;const stats={frameMs:Number(frameAverage.toFixed(2)),renderMs:Number(renderAverage.toFixed(2)),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,quality,gameplay:Boolean(gameplay),teacherPhase:gameplay?lastTeacherPhase:null};canvas.dataset.sceneDebug=JSON.stringify(stats);canvas.dataset.frameMs=String(stats.frameMs);canvas.dataset.drawCalls=String(stats.drawCalls);}
  }
  frame=requestAnimationFrame(render);renderer.render(scene,camera);onReady?.();
  return {
    setGameplay,
    playFeedback(kind){if(!gameplay)return;feedbackKind=kind;feedbackTime=kind==='caught'?.55:['complete','bell','help'].includes(kind)?.4:0;},
    setQuality(value){quality=value==='low'?'low':'high';renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1:1.6));renderer.shadowMap.enabled=quality!=='low';resize();},
    setMotion(value){motion=Boolean(value);},
    setMode(value){mode=value;if(!gameplay)hero.setMood?.(heroMood());},
    setCharacter(value){const variant=value==='girl'?'girl':'boy';const previous=hero;const index=pupils.indexOf(previous);let next=heroCache.get(variant);if(!next){next=createStudent({variant,seated:true,mood:'snack',seed:8,scale:1.1});heroCache.set(variant,next);}if(next===previous)return;next.setMood?.(heroMood());next.group.position.copy(previous.group.position);next.group.rotation.copy(previous.group.rotation);if(friendProps[index])next.group.add(friendProps[index].group);dynamic.remove(previous.group);dynamic.add(next.group);pupils[index]=next;hero=next;},
    tour(value){tourEnabled=Boolean(value);if(!tourEnabled){dragYaw=0;dragPitch=0;}canvas.style.cursor=tourEnabled&&!gameplay?'grab':'';},
    dispose(){alive=false;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('pointermove',move);canvas.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);for(const cached of heroCache.values())if(!cached.group.parent)dynamic.add(cached.group);const geometries=new Set(),mats=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));});geometries.forEach(g=>g.dispose());assets.forEach(a=>a.dispose?.());materials.forEach(m=>m.dispose());mats.forEach(m=>m.dispose());renderer.dispose();}
  };
}
