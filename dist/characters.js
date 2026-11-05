import * as THREE from './vendor/three.module.js';

// A little cast of sculpted, entirely original schoolchildren. All proportions
// are in metres; their front is +Z and a seated pupil's seat is at y=.65.
const M = {};
function material(name, color, roughness=.72) {
  return M[name] ||= new THREE.MeshStandardMaterial({color, roughness});
}
const skin = material('skin', '#f2b39c', .86);
const skinShade = material('skinShade', '#d79885', .9);
const blue = material('blue', '#246fce', .88);
const blueDark = material('blueDark', '#205aab', .9);
const white = material('white', '#f7f9fc', .92);
const whiteFold = material('whiteFold', '#dce5ee', .94);
const blueFold = material('blueFold', '#2865b5', .92);
const sole = material('sole', '#c5d3dd');
const shoe = material('shoe', '#faf8e9');
const ink = material('ink', '#263044');
const mouthMat = material('mouth', '#6d3c37');
const hair = material('hair', '#17191f', .8);
const hairLight = material('hairLight', '#24262e', .84);
const eyeWhite = material('eyeWhite', '#fffdf8', .42);
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
const jacketRings=[[-.025,.139,.086],[0,.164,.097],[.055,.172,.106],[.19,.18,.113],[.25,.203,.116],[.295,.222,.116],[.325,.227,.113],[.35,.220,.105],[.374,.184,.092],[.39,.151,.083],[.413,.084,.065]];
const jacketGeometry=profileGeometry(jacketRings,32,.65);
// Broad compression folds at the seated waist: a few millimetres of cloth,
// rather than surface noise or hard strips laid across the uniform.
for(let i=0;i<jacketGeometry.attributes.position.count;i++){
  const p=jacketGeometry.attributes.position,x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  const front=THREE.MathUtils.smoothstep(z,.035,.10),side=THREE.MathUtils.smoothstep(Math.abs(x),.035,.14);
  const fold=Math.exp(-Math.pow((y-.065-Math.abs(x)*.18)/.024,2))*.0035
    -Math.exp(-Math.pow((y-.107-Math.abs(x)*.12)/.021,2))*.0015;
  p.setZ(i,z+front*side*fold);
}
jacketGeometry.computeVertexNormals();
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
  new THREE.Vector2(0,-1),new THREE.Vector2(.91,-1),new THREE.Vector2(.99,-.88),
  new THREE.Vector2(1,-.70),new THREE.Vector2(.98,-.30),new THREE.Vector2(.94,.26),
  new THREE.Vector2(.92,.58),new THREE.Vector2(.87,.76),new THREE.Vector2(.88,.87),
  new THREE.Vector2(.82,.96),new THREE.Vector2(0,1)
],20);
const cuffGeometry=profileGeometry([[-.019,.045,.045],[-.015,.049,.049],[.014,.047,.047],[.019,.043,.043]],24,1);
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
    for(const attr of (mat.vertexColors?['position','normal','color']:['position','normal'])) {
      const data=new Float32Array(count*3);let offset=0;
      for(const g of parts) {data.set(g.attributes[attr].array,offset);offset+=g.attributes[attr].array.length;}
      geom.setAttribute(attr,new THREE.BufferAttribute(data,3));
    }
    geom.computeBoundingSphere();mesh(group,geom,mat);
    parts.forEach(g=>g.dispose());
  }
}
// Low crown, rounded temples and a turned-under hem keep the haircut compact.
// The closely spaced shoulder rings soften the crown without making a dome.
function haircutGeometry(girl=false){
  const positions=[],indices=[],cols=64;
  const rings=[{r:0,y:.280},{r:.42,y:.281},{r:.70,y:.276},{r:.85,y:.263},
    {r:.95,y:.242},{r:.992,y:.218},{r:1,t:.28},{r:1,t:.60},
    {r:.993,t:.85},{r:.980,t:.97},{r:.962,t:1}];
  for(const ring of rings)for(let col=0;col<=cols;col++){
    const a=col/cols*Math.PI*2,c=Math.cos(a),sx=Math.sin(a),front=Math.max(0,c);
    let edge;
    if(girl){
      const f=THREE.MathUtils.smoothstep(c,.43,.77);
      edge=-.272+.406*f+.004*Math.cos(a*11)*Math.pow(front,8);
    }else{
      edge=-.103+.247*Math.pow(front,3.4)+.012*Math.sin(a*2.7)*Math.pow(front,6);
    }
    const radiusX=girl?.283:.284,radiusZ=girl?.233:.230;
    const taper=girl&&ring.t?1-.025*ring.t*(1-front):1;
    const x=Math.sign(sx)*Math.pow(Math.abs(sx),.83)*radiusX*ring.r*taper;
    const z=Math.sign(c)*Math.pow(Math.abs(c),.82)*radiusZ*ring.r-.005;
    const crown=(ring.y??THREE.MathUtils.lerp(.218,edge,ring.t))-x*(girl?.008:.035);
    positions.push(x,crown,z);
  }
  for(let row=0;row<rings.length-1;row++)for(let col=0;col<cols;col++){
    const a=row*(cols+1)+col,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
const boyScalp=haircutGeometry(false),girlScalp=haircutGeometry(true);
const faceGeometry=profileGeometry([
  [-.270,0,0],[-.264,.087,.082],[-.252,.151,.137],[-.232,.204,.176],
  [-.202,.237,.198],[-.16,.257,.213],[-.10,.270,.223],[-.035,.273,.225],
  [.04,.271,.222],[.12,.267,.215],[.20,.254,.201],
  [.242,.222,.177],[.258,.12,.095],[.260,0,0]
],64,.89);
const faceSkin=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.86,vertexColors:true});
{
  const colors=[],p=faceGeometry.attributes.position;
  const base=new THREE.Color('#f2b39c'),cheek=new THREE.Color('#eea18e'),chin=new THREE.Color('#e9a78f');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const front=THREE.MathUtils.smoothstep(z,.06,.19);
    const warmth=Math.exp(-Math.pow((Math.abs(x)-.19)/.075,2)-Math.pow((y+.085)/.073,2))*front*.48;
    const c=base.clone().lerp(cheek,warmth).lerp(chin,THREE.MathUtils.smoothstep(-y,.18,.27)*.10);
    colors.push(c.r,c.g,c.b);
  }
  faceGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
}
const girlHair=material('girlHair','#2d1b40',.84);
const girlHairLight=material('girlHairLight','#38264b',.87);
const glassesMat=material('glasses','#29384b',.5);
function buildHead(girl,seed){
  const head=new THREE.Group(),fixed=new THREE.Group();head.add(fixed);
  mesh(fixed,faceGeometry,faceSkin);
  for(const side of [-1,1]){
    oval(fixed,skin,[side*.271,-.045,-.012],[.035,.053,.024]);
    oval(fixed,skinShade,[side*.288,-.045,.010],[.012,.028,.006]);
  }
  mesh(fixed,girl?girlScalp:boyScalp,girl?girlHair:hair);
  // Sparse sculpted lock boundaries follow the hair's surface. Their subtle
  // relief reads as combed hair, while the outline stays one connected mass.
  if(girl){
    for(const x of [-.16,-.075,.035,.13]){
      const z=.228*Math.pow(Math.max(0,1-Math.pow(Math.abs(x)/.283,2/.83)),.82/2)-.004;
      line(fixed,girlHairLight,[[x-.011,.227,z-.008],[x-.004,.193,z+.001],[x,.152,z-.001]],.0016);
    }
  }else{
    line(fixed,hairLight,[[-.183,.224,.156],[-.106,.251,.17],[-.018,.261,.155],[.091,.250,.131]],.002);
    line(fixed,hairLight,[[-.165,.194,.183],[-.086,.222,.202],[.014,.226,.199]],.0015);
  }
  if(girl&&seed%3!==0){
    const side=seed%2===0?1:-1;
    cube(fixed,white,[side*.157,.224,.232],[.049,.011,.009],[0,0,side*-.15]);
    cube(fixed,white,[side*.140,.229,.234],[.011,.027,.009],[0,0,side*-.15]);
  }
  // A single small nose cue and an open comic mouth replace the human features.
  oval(fixed,skin,[.003,-.063,.225],[.018,.018,.023]);
  const openRound=seed%3===0;
  oval(fixed,mouthMat,[seed%3===2?.008:-.006,-.157,.213],[openRound?.027:.037,openRound?.021:.014,.007]);
  if(!openRound)oval(fixed,white,[seed%3===2?.007:-.007,-.150,.221],[.022,.0035,.002]);
  if(!girl&&seed===4){
    for(const side of [-1,1]){
      const rim=[];for(let i=0;i<=32;i++){const a=i/32*Math.PI*2;rim.push([side*.111+Math.cos(a)*.086,-.005+Math.sin(a)*.089,.238]);}
      line(fixed,glassesMat,rim,.0035);
      line(fixed,glassesMat,[[side*.195,.018,.235],[side*.26,.015,.13],[side*.277,-.026,0]],.003);
    }
    line(fixed,glassesMat,[[-.025,.008,.239],[0,.015,.245],[.025,.008,.239]],.0035);
  }
  bakeStatic(fixed);
  const eyes=[],brows=[],browBases=[];
  for(const side of [-1,1]){
    const eye=new THREE.Group();eye.position.set(side*.111,-.005,.211);eye.rotation.y=side*.18;head.add(eye);
    oval(eye,eyeWhite,[0,0,0],[.077,.082,.030]);
    const irisGroup=new THREE.Group();irisGroup.position.set(side*-.003,-.004,.030);eye.add(irisGroup);
    oval(irisGroup,pupil,[0,0,0],[.012,.014,.0035]);
    eyes.push({group:eye,iris:irisGroup});
    const brow=new THREE.Group();const browY=.099+(side<0?.006:0)+(seed%3===0?.006:0);
    brow.position.set(side*.112,browY,.221);head.add(brow);browBases.push(browY);
    line(brow,hair,[[-.035,-.002,0],[-.007,.004,.002],[.034,-.001,0]],.005);
    brow.rotation.z=side*.04;brows.push(brow);
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
  let mood=options.mood??(seated?'resting':'hero');
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
    line(uniform,whiteFold,[[side*.047,hips+.086,.111],[side*.079,hips+.080,.116],[side*.113,hips+.089,.111]],.0014);
    line(uniform,whiteFold,[[side*.069,shoulders-.097,.116],[side*.105,shoulders-.119,.119]],.0012);
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
    const cuff=mesh(arm,cuffGeometry,white);
    line(lower.object,blueFold,[[-.61,-.57,.77],[-.16,-.48,.97],[.39,-.40,.88]],.015);
    line(lower.object,blueFold,[[-.42,-.15,.89],[-.07,-.08,.97],[.23,-.02,.94]],.010);
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
  const phase=seed*1.719, shoulderPoints=[point(-.234,shoulders-.055,0),point(.234,shoulders-.055,0)];
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
      else if(mood==='thinking')wrists[1].set(.17,.875,.33);
      else if(mood==='chat') {elbows[1].set(.30,.86,.14);wrists[1].set(.17,.875+lift*.004,.33);}
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
      const resting=seated&&(i===0||mood==='resting'||mood==='thinking'||mood==='chat');
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
