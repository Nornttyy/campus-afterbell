import * as THREE from './vendor/three.module.js';

// A little cast of sculpted, entirely original schoolchildren. All proportions
// are in metres; their front is +Z and a seated pupil's seat is at y=.65.
const M = {};
function material(name, color, roughness=.72) {
  return M[name] ||= new THREE.MeshStandardMaterial({color, roughness});
}
const skin = material('skin', '#f4bd91');
const blush = material('blush', '#e99780');
const skinShade = material('skinShade', '#d98c70');
const blue = material('blue', '#306dc5');
const blueDark = material('blueDark', '#23549c');
const white = material('white', '#fff7df');
const sole = material('sole', '#c5d3dd');
const shoe = material('shoe', '#faf8e9');
const ink = material('ink', '#263044');
const mouthMat = material('mouth', '#6d3c37');
const hair = material('hair', '#20232b', .48);
const hairLight = material('hairLight', '#383a43', .5);
const eyeWhite = material('eyeWhite', '#fff9eb', .3);
const iris = material('iris', '#50382e', .32);
const pupil = material('pupil', '#141a21', .25);
const catchlight = new THREE.MeshBasicMaterial({color:'#fffef3'});
const red = material('red', '#d7584f');
const yellow = material('yellow', '#f6bf4c');
const paper = material('paper', '#fff4cb');
const cover = material('cover', '#df8f68');
const sphere = new THREE.SphereGeometry(1, 20, 14);
const box = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
const scratch = new THREE.Vector3();
const axisY = new THREE.Vector3(0,1,0);
function mesh(parent, geo, mat, p=[0,0,0], s=[1,1,1], r=null) {
  const o = new THREE.Mesh(geo,mat);
  o.position.set(...p); o.scale.set(...s); if(r) o.rotation.set(...r);
  o.castShadow=true; o.receiveShadow=true; parent.add(o); return o;
}
function oval(parent, mat, p, s, r=null) { return mesh(parent,sphere,mat,p,s,r); }
function cube(parent, mat, p, s, r=null) { return mesh(parent,box,mat,p,s,r); }
function line(parent, mat, points, radius=.008) {
  const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  return mesh(parent,new THREE.TubeGeometry(path,Math.max(8,points.length*4),radius,6,false),mat);
}
function roundedShape(w,h,r) {
  const s=new THREE.Shape(), x=-w/2, y=-h/2;
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
}
function profileGeometry(rings,segments=24,exponent=.8) {
  const vertices=[],indices=[];
  for(const r of rings)for(let i=0;i<=segments;i++) {
    const a=i/segments*Math.PI*2, sx=Math.sin(a),cz=Math.cos(a);
    vertices.push(Math.sign(sx)*Math.pow(Math.abs(sx),exponent)*r[1],r[0],Math.sign(cz)*Math.pow(Math.abs(cz),exponent)*r[2]+(r[3]||0));
  }
  for(let r=0;r<rings.length-1;r++)for(let i=0;i<segments;i++) {
    const a=r*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
const jacketRings=[[-.025,.139,.086],[0,.164,.097],[.055,.172,.106],[.19,.18,.113],[.295,.206,.116],[.35,.204,.105],[.39,.151,.083],[.413,.084,.065]];
const jacketGeometry=profileGeometry(jacketRings,32,.65);
const jacketPanels=[[],[]];
{
  const idx=jacketGeometry.index.array;
  for(let i=0;i<idx.length;i+=3){
    const v=idx[i],y=jacketGeometry.attributes.position.getY(v),z=jacketGeometry.attributes.position.getZ(v),x=jacketGeometry.attributes.position.getX(v);
    const panel=y>.025&&((z>.075&&Math.abs(x)<.155)||y>.305);
    jacketPanels[panel?1:0].push(idx[i],idx[i+1],idx[i+2]);
  }
}
const jacketGeometries=jacketPanels.map(indices=>{const g=jacketGeometry.clone();g.setIndex(indices);return g;});
const sleeveGeometry=new THREE.LatheGeometry([
  new THREE.Vector2(0,-1),new THREE.Vector2(.91,-1),new THREE.Vector2(1,-.86),
  new THREE.Vector2(.98,-.30),new THREE.Vector2(.91,.58),new THREE.Vector2(.83,.94),new THREE.Vector2(0,1)
],16);
const notebookGeometry=new THREE.ExtrudeGeometry(roundedShape(.22,.28,.012),{depth:.026,bevelEnabled:false,curveSegments:4});

// Batch parts that don't move relative to one another by material. Facial
// animation stays separate, while clothes, hair and accessories share draws.
function bakeStatic(group) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert(), buckets=new Map(), originals=[];
  group.traverse(o=>{if(o.isMesh && !Array.isArray(o.material)) {
    const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone());
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
    const key=o.material; if(!buckets.has(key)) buckets.set(key,[]);
    buckets.get(key).push(g); originals.push(o);
  }});
  for(const o of originals) o.removeFromParent();
  for(const [mat,parts] of buckets) {
    const count=parts.reduce((n,g)=>n+g.attributes.position.count,0);
    const geom=new THREE.BufferGeometry();
    for(const attr of ['position','normal']) {
      const data=new Float32Array(count*3);let offset=0;
      for(const g of parts) {data.set(g.attributes[attr].array,offset);offset+=g.attributes[attr].array.length;}
      geom.setAttribute(attr,new THREE.BufferAttribute(data,3));
    }
    geom.computeBoundingSphere();mesh(group,geom,mat);
    parts.forEach(g=>g.dispose());
  }
}
function scalpGeometry(girl=false) {
  const positions=[],indices=[],rows=18,cols=48;
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++) {
    const a=col/cols*Math.PI*2,front=Math.max(0,Math.cos(a));
    const edge=1.91-(girl?.70:.79)*Math.pow(front,4)+.035*Math.sin(a*7+.3)*Math.pow(front,8);
    const theta=row/rows*edge,sx=Math.sin(theta)*Math.sin(a),sz=Math.sin(theta)*Math.cos(a),cy=Math.cos(theta);
    positions.push(Math.sign(sx)*Math.pow(Math.abs(sx),.72)*.271,
      Math.sign(cy)*Math.pow(Math.abs(cy),.8)*.342+.006,
      Math.sign(sz)*Math.pow(Math.abs(sz),.72)*.254-.002);
  }
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const a=row*(cols+1)+col,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
const boyScalp=scalpGeometry(false),girlScalp=scalpGeometry(true);
const faceGeometry=profileGeometry([
  [-.317,0,0,.015],[-.300,.085,.10,.013],[-.27,.151,.161,.008],[-.225,.196,.197,.003],
  [-.15,.225,.22,0],[-.07,.242,.235,0],[.035,.246,.239,0],[.13,.243,.23,0],
  [.21,.231,.216,0],[.274,.19,.177,0],[.314,.10,.095,0],[.329,0,0,0]
],48,.83);
{
  const p=faceGeometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    if(z>0){
      const cheek=Math.exp(-((Math.abs(x)-.15)**2/.0035+(y+.105)**2/.0045))*.010;
      const socket=Math.exp(-((Math.abs(x)-.109)**2/.0025+(y-.035)**2/.0045))*.009;
      p.setZ(i,z+(cheek-socket)*Math.min(1,z/.12));
    }
  }
  faceGeometry.computeVertexNormals();
}
const girlHair=material('girlHair','#282237',.62);
const glassesMat=material('glasses','#29384b',.42);
const ponyGeometry=profileGeometry([[-.22,0,0],[-.19,.034,.03],[-.11,.060,.047],[-.025,.059,.049],[.026,.036,.036],[.042,0,0]],20,.86);
function bobSideGeometry(side){
  const s=new THREE.Shape();s.moveTo(side*.211,.19);s.quadraticCurveTo(side*.287,.17,side*.278,.03);
  s.lineTo(side*.273,-.24);s.quadraticCurveTo(side*.248,-.28,side*.21,-.245);s.lineTo(side*.21,.19);
  const g=new THREE.ExtrudeGeometry(s,{depth:.285,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:3,curveSegments:12});g.translate(0,0,-.19);return g;
}
const bobSides=[bobSideGeometry(-1),bobSideGeometry(1)];
function buildHead(girl,seed){
  const head=new THREE.Group(),fixed=new THREE.Group();head.add(fixed);
  mesh(fixed,faceGeometry,skin);
  for(const side of [-1,1]){
    oval(fixed,skin,[side*.246,-.025,-.012],[.040,.069,.028]);
    oval(fixed,skinShade,[side*.267,-.027,.013],[.018,.039,.008]);
    oval(fixed,skin,[side*.263,-.042,.024],[.015,.025,.01]);
  }
  mesh(fixed,girl?girlScalp:boyScalp,girl?girlHair:hair);
  if(girl){
    const style=seed%3;
    if(style===1){
      for(const side of [-1,1]){
        mesh(fixed,ponyGeometry,girlHair,[side*.264,-.045,-.14],[1,1,1],[0,0,side*-.23]);
        oval(fixed,blue,[side*.259,-.016,-.137],[.038,.015,.039],[0,0,side*-.23]);
      }
    }else{
      for(const g of bobSides)mesh(fixed,g,girlHair,[0,style===0?.025:0,0],[1,style===0?.88:1,1]);
      if(style===2){
        cube(fixed,white,[.166,.246,.219],[.056,.013,.012],[0,0,-.31]);
        cube(fixed,white,[.144,.256,.22],[.013,.034,.012],[0,0,-.31]);
      }
    }

  }else{
    // Two broad locks are integrated into the cap silhouette rather than glued-on balls.
    line(fixed,hairLight,[[-.155,.291,.138],[-.068,.325,.128],[.026,.333,.10]],.0025);
  }
  // Nose bridge flows into the tip; nostrils and a raised lower lip read at close range.
  oval(fixed,skin,[0,-.013,.238],[.023,.052,.020]);
  oval(fixed,skin,[.003,-.055,.255],[.030,.028,.025]);
  oval(fixed,skinShade,[.018,-.068,.271],[.006,.0035,.004]);
  if(seed%3===0){
    oval(fixed,mouthMat,[-.008,-.175,.222],[.043,.025,.009]);
    oval(fixed,white,[-.008,-.160,.231],[.027,.005,.003]);
  }else if(seed%3===2){
    line(fixed,mouthMat,[[-.054,-.169,.221],[-.019,-.183,.226],[.024,-.173,.224],[.065,-.145,.211]],.0065);
    line(fixed,white,[[-.015,-.178,.233],[.016,-.174,.232],[.035,-.161,.226]],.004);
  }else{
    line(fixed,mouthMat,[[-.061,-.167,.218],[-.025,-.185,.225],[.015,-.184,.226],[.054,-.166,.218]],.007);
    line(fixed,white,[[-.023,-.178,.233],[.009,-.18,.233],[.033,-.172,.228]],.004);
  }
  line(fixed,skinShade,[[-.026,-.207,.211],[.008,-.209,.213],[.028,-.200,.208]],.0025);
  if(!girl&&seed===4){
    for(const side of [-1,1]){
      const rim=[];for(let i=0;i<=40;i++){const a=i/40*Math.PI*2;rim.push([side*.108+Math.cos(a)*.086,.031+Math.sin(a)*.113,.251]);}
      line(fixed,glassesMat,rim,.004);
      line(fixed,glassesMat,[[side*.191,.063,.248],[side*.243,.061,.18],[side*.252,.018,.008]],.0035);
    }
    line(fixed,glassesMat,[[-.022,.047,.252],[0,.054,.262],[.022,.047,.252]],.004);
  }
  bakeStatic(fixed);
  const eyes=[],brows=[],browBases=[];
  for(const side of [-1,1]){
    const eye=new THREE.Group();eye.position.set(side*.108,.031,.223);eye.rotation.y=side*.09;head.add(eye);
    // Vertical white ovals are set into shallow sockets, matching the reference face.
    oval(eye,skin,[0,0,-.009],[.082,.110,.014]);
    oval(eye,eyeWhite,[0,0,0],[.077,.103,.020]);
    line(eye,skin,[[side*-.073,.034,.008],[side*-.051,.086,.015],[0,.103,.008],[side*.052,.078,.008]],.004);
    const irisGroup=new THREE.Group();irisGroup.position.set(side*-.005,-.007,.019);eye.add(irisGroup);
    oval(irisGroup,pupil,[0,0,0],[.017,.021,.004]);
    oval(irisGroup,catchlight,[-.004,.006,.004],[.0025,.003,.001]);
    eyes.push({group:eye,iris:irisGroup});
    const brow=new THREE.Group();const browY=(side<0?.162:.153)+(seed%3===0?.009:seed%3===2?-.004:0);brow.position.set(side*.112,browY,.239);head.add(brow);browBases.push(browY);
    line(brow,hair,[[-.044,-.003,0],[-.013,.005,.003],[.027,.005,.003],[.044,-.002,0]],.007);
    brow.rotation.z=side*.06;brows.push(brow);
  }
  return {group:head,eyes,brows,browBases};
}

function limb(parent,mat,radius) {
  const o=mesh(parent,sleeveGeometry,mat,[0,0,0],[radius,.1,radius]);
  return {object:o, set(a,b) {
    o.position.copy(a).add(b).multiplyScalar(.5);
    scratch.copy(b).sub(a);o.scale.set(radius,scratch.length()*.5+radius*.2,radius);
    o.quaternion.setFromUnitVectors(axisY,scratch.normalize());
  }};
}
function point(x,y,z){return new THREE.Vector3(x,y,z);}

function shoeGeometry(rings){
  const positions=[],indices=[],n=20;
  for(const [z,rx,cy,ry]of rings)for(let i=0;i<=n;i++){
    const t=i/n*Math.PI*2;positions.push(Math.sin(t)*rx,cy+Math.cos(t)*ry,z);
  }
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){
    const a=j*(n+1)+i,b=a+n+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
const shoeProfile=[[-.075,0,.062,0],[-.066,.052,.065,.033],[-.032,.064,.074,.042],[.025,.074,.073,.043],[.092,.077,.055,.028],[.143,.057,.043,.021],[.171,0,.038,0]];
const trainerUpper=shoeGeometry(shoeProfile),trainerSole=shoeGeometry(shoeProfile.map(([z,x])=>[z,x*1.045,.019,x>0?.014:0]));
const trainerToe=shoeGeometry(shoeProfile.slice(4).map(([z,x,y,r])=>[z,x*1.009,y+.002,r*1.01]));
const nailMat=material('nail','#f5cfaf');
function makeHand(side,gripping=false){
  const h=new THREE.Group();
  oval(h,skin,[0,-.005,0],[.027,.025,.022]);
  oval(h,skin,[0,.03,0],[.037,.043,.022]);
  for(let i=0;i<4;i++){
    const x=(-1.5+i)*.0185,len=[.031,.042,.039,.030][i],r=[.009,.0105,.010,.009][i];
    const start=[x,.056,0],middle=[x,.056+len*.60,gripping?.012:.002],end=[x,.056+len*(gripping?.34:1),gripping?.033:.007];
    line(h,skin,[start,middle,end],r);oval(h,skin,end,[r,r,r]);
    if(!gripping)oval(h,nailMat,[end[0],end[1]-.004,end[2]-.008],[r*.60,.007,.002]);
    line(h,skinShade,[[x-r*.58,.064,.020],[x+r*.58,.064,.020]],.0009);
  }
  line(h,skin,[[-side*.027,.005,.002],[-side*.048,.025,.012],[-side*.038,.048,.028]],.013);
  oval(h,skin,[-side*.038,.048,.028],[.013,.013,.012]);
  bakeStatic(h);return h;
}

export function createStudent(options={}) {
  const variant=options.variant??options.kind??'boy';
  const seated=options.seated??(options.pose?options.pose==='seated':true);
  const seed=options.seed??1, girl=variant==='girl';
  let mood=options.mood??(seated?'snack':'hero');
  const group=new THREE.Group();group.name=`pupil-${variant}-${seed}`;
  group.scale.setScalar(options.scale??1);
  const body=new THREE.Group();group.add(body);
  const hips=seated?.65:.72, shoulders=seated?1.035:1.145, headY=shoulders+.29;
  const uniform=new THREE.Group();body.add(uniform);
  const jacketScale=(shoulders-hips)/.40;
  mesh(uniform,jacketGeometries[0],blue,[0,hips,0],[1,jacketScale,1]);
  mesh(uniform,jacketGeometries[1],white,[0,hips,0],[1,jacketScale,1]);
  oval(uniform,skin,[0,shoulders+.029,0],[.064,.073,.060]);
  mesh(uniform,profileGeometry([[-.018,.156,.093],[.015,.162,.098],[.032,.158,.095]],24,.65),blueDark,[0,hips,0]);
  for(const side of [-1,1]){
    const collar=new THREE.Shape();collar.moveTo(side*.012,.034);collar.lineTo(side*.047,.065);collar.lineTo(side*.106,.009);collar.lineTo(side*.059,-.038);collar.closePath();
    const g=new THREE.ExtrudeGeometry(collar,{depth:.018,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2});
    mesh(uniform,g,blue,[0,shoulders-.014,.062]);
    line(uniform,white,[[side*.02,shoulders+.024,.087],[side*.046,shoulders+.043,.086],[side*.092,shoulders-.005,.084]],.0035);
    line(uniform,blueDark,[[side*.126,hips+.17,.111],[side*.085,hips+.105,.117]],.003);
    line(uniform,white,[[side*.139,hips+.168,.111],[side*.098,hips+.104,.117]],.002);
  }
  line(uniform,blueDark,[[0,hips+.035,.107],[0,hips+.20,.117],[0,shoulders-.015,.085]],.003);
  cube(uniform,sole,[0,shoulders-.086,.124],[.009,.023,.006]);
  cube(uniform,blue,[.104,shoulders-.123,.12],[.032,.023,.003]);
  cube(uniform,white,[.104,shoulders-.123,.124],[.019,.004,.002]);
  bakeStatic(uniform);
  const headData=buildHead(girl,seed), head=headData.group;
  head.position.y=headY;body.add(head);
  const legs=new THREE.Group();group.add(legs);
  for(const side of [-1,1]) {
    const hip=point(side*.095,hips,0), knee=point(side*.105,seated?.4:.39,seated?.31:.012), ankle=point(side*.115,.095,seated?.3:.035);
    const upper=limb(legs,blue,.074),lower=limb(legs,blue,.062);upper.set(hip,knee);lower.set(knee,ankle);
    oval(legs,blue,knee.toArray(),[.08,.077,.075]);
    const seamA=hip.clone().add(point(side*.065,0,.035)),seamB=knee.clone().add(point(side*.064,0,.03)),seamC=ankle.clone().add(point(side*.052,0,.024));
    line(legs,white,[seamA.toArray(),seamB.toArray(),seamC.toArray()],.009);
    oval(legs,white,[ankle.x,.103,ankle.z],[.055,.032,.054]);
    mesh(legs,trainerSole,sole,[ankle.x,0,ankle.z]);
    mesh(legs,trainerUpper,blueDark,[ankle.x,0,ankle.z]);
    mesh(legs,trainerToe,shoe,[ankle.x,0,ankle.z]);
    for(let i=0;i<3;i++){
      const z=ankle.z+.011+i*.026,y=.117-i*.006;
      line(legs,white,[[ankle.x-.027,y-.004,z-.005],[ankle.x,y,z+.003],[ankle.x+.027,y-.004,z-.005]],.003);
    }
    for(const edge of [-1,1])line(legs,white,[[ankle.x+edge*.065,.056,ankle.z-.022],[ankle.x+edge*.075,.05,ankle.z+.038],[ankle.x+edge*.072,.043,ankle.z+.085]],.004);

  }
  bakeStatic(legs);
  const arms=[];
  for(const side of [-1,1]) {
    const arm=new THREE.Group();body.add(arm);
    const upper=limb(arm,blue,.064),lower=limb(arm,blue,.055);
    const stripeUpper=limb(arm,white,.012),stripeLower=limb(arm,white,.011);
    const elbow=oval(arm,blue,[0,0,0],[.061,.062,.059]);
    const cuff=oval(arm,white,[0,0,0],[.052,.022,.052]);
    const hand=new THREE.Group();arm.add(hand);
    const handOpen=makeHand(side,false),handGrip=makeHand(side,true);hand.add(handOpen,handGrip);
    arms.push({side,upper,lower,stripeUpper,stripeLower,elbow,cuff,hand,handOpen,handGrip});

  }
  const accessory=new THREE.Group();body.add(accessory);
  const snack=new THREE.Group();accessory.add(snack);
  const snackOrange=material('snackOrange','#ee9242');
  cube(snack,snackOrange,[0,0,0],[.085,.125,.024],[0,0,-.05]);
  cube(snack,paper,[0,.015,.014],[.068,.036,.005],[0,0,-.05]);
  cube(snack,red,[0,.016,.018],[.037,.012,.004],[0,0,-.05]);
  cube(snack,yellow,[0,.072,0],[.081,.018,.026],[0,0,-.05]);
  line(snack,yellow,[[.008,.079,0],[.015,.135,.003]],.008);
  bakeStatic(snack);
  const notebook=new THREE.Group();accessory.add(notebook);
  mesh(notebook,notebookGeometry,cover,[0,0,0]);
  cube(notebook,paper,[.006,0,.031],[.196,.252,.01]);
  cube(notebook,blueDark,[-.091,0,.041],[.008,.26,.009]);
  for(let n=0;n<4;n++)cube(notebook,blueDark,[.015,.055-n*.034,.038],[.134,.003,.003]);
  bakeStatic(notebook);
  const pencil=new THREE.Group();accessory.add(pencil);
  mesh(pencil,cylinder,yellow,[0,0,0],[.006,.17,.006]);
  mesh(pencil,new THREE.ConeGeometry(.006,.023,8),ink,[0,-.095,0],[1,1,1],[0,0,Math.PI]);
  mesh(pencil,cylinder,red,[0,.085,0],[.006,.014,.006]);
  bakeStatic(pencil);
  const phase=seed*1.719, shoulderPoints=[point(-.214,shoulders-.055,0),point(.214,shoulders-.055,0)];
  const elbows=[point(0,0,0),point(0,0,0)],wrists=[point(0,0,0),point(0,0,0)];
  let previousMood=mood;
  function update(t,dt=.016) {
    const time=t+phase,breath=Math.sin(time*1.7)*.004;
    body.position.y=breath;
    body.rotation.z=seated?Math.sin(time*.55)*.009:Math.sin(time*.65)*.016;
    head.rotation.y=Math.sin(time*.47)*.07;
    head.rotation.z=Math.sin(time*.6)*.023+(mood==='hero'?-.045:0);
    head.rotation.x=mood==='writing'?.15:Math.sin(time*.9)*.018;
    // A fast close, slower open, with occasional double blinks.
    const blinkClock=(time%(4.2+seed*.13)+4.2+seed*.13)%(4.2+seed*.13);
    const blink=blinkClock<.15?Math.sin(blinkClock/.15*Math.PI):0;
    const eyeScale=Math.max(.07,1-blink*.96);
    for(const eye of headData.eyes) {
      eye.group.scale.y=eyeScale;
      eye.iris.position.x=Math.sin(time*.41)*.009+(mood==='writing'?-.006:0);
      eye.iris.position.y=mood==='writing'?-.018:-.003+Math.sin(time*.3)*.005;
    }
    headData.brows[0].position.y=headData.browBases[0]+(mood==='hero'?.018:0)+Math.sin(time*.7)*.002;
    headData.brows[1].rotation.z=(mood==='hero'?-.12:.07)+Math.sin(time*.6)*.015;
    const lift=(Math.sin(time*.85)+1)*.5;
    if(seated) {
      elbows[0].set(-.3,.84,.15);wrists[0].set(-.17,.87,.34);
      elbows[1].set(.30,.86,.14);
      if(mood==='writing')wrists[1].set(.16+Math.sin(time*3.2)*.012,.875,.37+Math.sin(time*2.7)*.018);
      else if(mood==='resting')wrists[1].set(.17,.869+Math.sin(time*.7)*.002,.33);
      else if(mood==='thinking')wrists[1].set(.17,headY-.12,.21);
      else if(mood==='chat') {elbows[1].set(.32,.88,.12);wrists[1].set(.33,1.02+lift*.07,.27);}
      else wrists[1].set(.1+.025*Math.sin(time*.5),1.08+lift*.09,.30);
    } else {
      elbows[0].set(-.32,.91,.09);wrists[0].set(-.16,1.01,.24);
      elbows[1].set(.37,1.16,.06);wrists[1].set(.24+Math.sin(time*1.8)*.008,1.43+Math.sin(time*1.4)*.012,.10);
      head.rotation.z=-.055+Math.sin(time*.5)*.018;
    }
    arms.forEach((a,i)=>{
      const s=shoulderPoints[i],e=elbows[i],w=wrists[i];
      a.upper.set(s,e);a.lower.set(e,w);a.elbow.position.copy(e);
      const off=point(a.side*.006,.008,.06);
      a.stripeUpper.set(s.clone().add(off),e.clone().add(off));
      a.stripeLower.set(e.clone().add(off),w.clone().add(off));
      a.cuff.position.copy(e).lerp(w,.88);a.cuff.quaternion.setFromUnitVectors(axisY,w.clone().sub(e).normalize());
      a.hand.position.copy(w);
      const resting=seated&&(i===0||mood==='resting');
      const openHand=resting||mood==='chat'||(!seated&&i===1);
      a.handOpen.visible=openHand;a.handGrip.visible=!openHand;
      a.hand.rotation.set(resting?Math.PI*.5:(mood==='writing'?.54:0),0,a.side*-.12);

    });
    snack.visible=seated&&mood==='snack';notebook.visible=!seated||mood==='writing';pencil.visible=seated&&mood==='writing';
    snack.position.copy(wrists[1]).add(point(-.02,.044,.014));snack.rotation.z=-.12;
    if(seated){notebook.position.set(-.015,.852,.40);notebook.rotation.set(-Math.PI/2,0,-.05);}
    else {notebook.position.copy(wrists[0]).add(point(.02,-.015,.024));notebook.rotation.set(-.18,.06,.12);}
    pencil.position.copy(wrists[1]).add(point(.014,.014,.025));pencil.rotation.set(.65,0,-.22);
    if(previousMood!==mood)previousMood=mood;
  }
  update(0);
  return {group,update,setMood(value){mood=value;},head,variant,seated};
}
