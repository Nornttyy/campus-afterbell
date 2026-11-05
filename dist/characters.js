import * as THREE from './vendor/three.module.js';

// A little cast of sculpted, entirely original schoolchildren. All proportions
// are in metres; their front is +Z and a seated pupil's seat is at y=.65.
const M = {};
function material(name, color, roughness=.72) {
  return M[name] ||= new THREE.MeshStandardMaterial({color, roughness});
}
const skin = material('skin', '#f0ae91', .96);
const skinShade = material('skinShade', '#d79885', .9);
const blue = material('blue', '#1478d4', .96);
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
const eyeWhite = material('eyeWhite', '#fdfcf7', .82);
const iris = material('iris', '#50382e', .32);
const pupil = material('pupil', '#15191b', .84);
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
function closeRingNormals(g,segments,rows){
  const n=g.attributes.normal,p=g.attributes.position;
  for(let row=0;row<rows;row++){
    const first=row*(segments+1),last=first+segments;
    const normal=new THREE.Vector3(n.getX(first)+n.getX(last),n.getY(first)+n.getY(last),n.getZ(first)+n.getZ(last)).normalize();
    n.setXYZ(first,normal.x,normal.y,normal.z);n.setXYZ(last,normal.x,normal.y,normal.z);
    if(Math.abs(p.getX(first+Math.floor(segments/4)))-p.getX(first)<1e-8&&Math.abs(p.getZ(first)-p.getZ(first+Math.floor(segments/2)))<1e-8){
      normal.set(0,0,0);for(let i=0;i<=segments;i++)normal.add(new THREE.Vector3().fromBufferAttribute(n,first+i));normal.normalize();
      for(let i=0;i<=segments;i++)n.setXYZ(first+i,normal.x,normal.y,normal.z);
    }
  }
  return g;
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
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return closeRingNormals(g,segments,rings.length);
}
const jacketRings=[[-.025,.155,.092],[0,.178,.101],[.055,.187,.109],[.19,.196,.117],[.25,.220,.119],[.295,.242,.117],[.325,.250,.111],[.35,.241,.104],[.374,.204,.092],[.39,.164,.083],[.413,.084,.065]];
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
// Continuous sewn panels sit above one blue shell. No triangle-by-triangle
// material partitioning: those cuts became speckled after scene batching.
function jacketSurface(y,a,offset=0){
  let j=0;while(j<jacketRings.length-2&&jacketRings[j+1][0]<y)j++;
  const lo=jacketRings[j],hi=jacketRings[j+1],t=THREE.MathUtils.clamp((y-lo[0])/(hi[0]-lo[0]),0,1);
  const rx=THREE.MathUtils.lerp(lo[1],hi[1],t)+offset,rz=THREE.MathUtils.lerp(lo[2],hi[2],t)+offset;
  const sx=Math.sin(a),cz=Math.cos(a);return [Math.sign(sx)*Math.abs(sx)**.65*rx,y,Math.sign(cz)*Math.abs(cz)**.65*rz];
}
function shoulderPanelGeometry(){
  const vertices=[],indices=[],cols=64,rows=8;
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
    const a=col/cols*Math.PI*2,c=Math.cos(a),side=Math.abs(Math.sin(a));
    const low=c>=0?.222+.069*side**.7:.281+.009*side,high=.377-.017*side;
    vertices.push(...jacketSurface(THREE.MathUtils.lerp(low,high,row/rows),a,.0045));
  }
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const a=row*(cols+1)+col,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function shirtPanelGeometry(){
  const vertices=[],indices=[],cols=12,rows=12;
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
    const u=col/cols*2-1,y=THREE.MathUtils.lerp(.017,.332+.035*Math.abs(u),row/rows),x=u*(.108+.006*Math.sin(row/rows*Math.PI));
    let j=0;while(j<jacketRings.length-2&&jacketRings[j+1][0]<y)j++;
    const lo=jacketRings[j],hi=jacketRings[j+1],t=(y-lo[0])/(hi[0]-lo[0]),rx=THREE.MathUtils.lerp(lo[1],hi[1],t),rz=THREE.MathUtils.lerp(lo[2],hi[2],t);
    const sin=Math.pow(Math.min(.99,Math.abs(x)/rx),1/.65),z=rz*Math.pow(Math.sqrt(1-sin*sin),.65)+.007;
    vertices.push(x,y,z);
  }
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const a=row*(cols+1)+col,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
const shoulderPanel=shoulderPanelGeometry(),shirtPanel=shirtPanelGeometry();
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
// Hair is built as a fitted cranial shell. The fringe and ponytail are
// separate continuous volumes, so the side and back views remain readable.
function haircutGeometry(style='swept',inner=false){
  const positions=[],indices=[],cols=64,bob=style==='bob',pony=style==='pony',bowl=style==='bowl';
  const rings=[{r:0,y:.298},{r:.40,y:.299},{r:.70,y:.283},{r:.87,y:.251},
    {r:.97,y:.207},{r:1,t:.24},{r:1,t:.55},{r:1,t:.81},{r:.985,t:.97},{r:.964,t:1}];
  for(const ring of rings)for(let col=0;col<=cols;col++){
    const a=col/cols*Math.PI*2,c=Math.cos(a),sx=Math.sin(a);
    const x=Math.sign(sx)*Math.pow(Math.abs(sx),.71)*(bob?.266:.255)*ring.r;
    let edge;
    if(bob){
      const front=THREE.MathUtils.smoothstep(c,.42,.73);
      const notch=inner?0:[-.155,-.047,.066,.166].reduce((n,k)=>n+Math.max(0,1-Math.abs(x-k)/.015)*.069,0);
      edge=-.273+.417*front+notch*front;
    }else{
      const front=THREE.MathUtils.smoothstep(c,.17,.60);
      edge=-.119+.275*front;
      if(!bowl&&!pony)edge+=.012*sx*front;
      if(c<-.4)edge+=.009*Math.cos(a*3.0);
    }
    const edgeScale=bob&&ring.t?1+.019*Math.sin(ring.t*Math.PI):1;
    const z=Math.sign(c)*Math.pow(Math.abs(c),.73)*(bob?.252:.247)*ring.r*edgeScale-.018;
    const y=ring.y!==undefined?ring.y+(bob?.023*(1-ring.r*ring.r):0):THREE.MathUtils.lerp(.207,edge,ring.t);
    const wall=inner?(ring.t===undefined?.968:.965-.10*ring.t):edgeScale;
    positions.push(x*wall,y+(inner?-.003:0),z*(inner?wall:1));
  }
  for(let row=0;row<rings.length-1;row++)for(let col=0;col<cols;col++){
    const a=row*(cols+1)+col,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return closeRingNormals(g,cols,rings.length);
}
function sweptForelock(){
  // Broad swept wedge with a fine turned edge, attached to the short cap.
  const sections=[[-.283,.231,.264,.292,.153],[-.236,.181,.305,.298,.110],[-.135,.157,.322,.277,.074],[-.015,.158,.312,.255,.070],[.113,.180,.281,.228,.085],[.209,.197,.230,.196,.122]];
  const vertices=[],indices=[];
  for(const [x,lo,hi,front,back]of sections){
    vertices.push(x,lo,front-.012,x,lo+.008,front,x,hi-.012,front-.025,x,hi,back,x,lo+.012,back);
  }
  for(let j=0;j<sections.length-1;j++)for(let k=0;k<5;k++){const a=j*5+k,b=j*5+(k+1)%5,c=a+5,d=b+5;indices.push(a,c,b,b,c,d);}
  indices.push(0,1,2,0,2,3,0,3,4);const e=(sections.length-1)*5;indices.push(e,e+2,e+1,e,e+3,e+2,e,e+4,e+3);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function ponytailGeometry(){
  const path=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.23,-.18),new THREE.Vector3(0,.335,-.21),new THREE.Vector3(0,.365,-.29),new THREE.Vector3(0,.31,-.34),new THREE.Vector3(0,.29,-.36)]);
  const g=new THREE.TubeGeometry(path,20,.062,12,false),p=g.attributes.position;
  for(let j=0;j<=20;j++){const t=j/20,c=path.getPointAt(t),scale=t<.25?.56+t*1.6:1-Math.pow((t-.25)/.75,1.45)*.90;for(let k=0;k<=12;k++){const i=j*13+k;p.setXYZ(i,c.x+(p.getX(i)-c.x)*scale,c.y+(p.getY(i)-c.y)*scale,c.z+(p.getZ(i)-c.z)*scale);}}
  g.computeVertexNormals();return g;
}
const scalps={swept:haircutGeometry('swept'),bowl:haircutGeometry('bowl'),bob:haircutGeometry('bob'),pony:haircutGeometry('pony')};
const bobUnder=haircutGeometry('bob',true),forelock=sweptForelock(),ponytail=ponytailGeometry();
function hairEdgeWall(outer,inner){
  const vertices=[],indices=[],op=outer.attributes.position,ip=inner.attributes.position,start=op.count-65;
  for(let i=0;i<65;i++){for(const p of [op,ip])vertices.push(p.getX(start+i),p.getY(start+i),p.getZ(start+i));}
  for(let i=0;i<64;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
const bobEdge=hairEdgeWall(scalps.bob,bobUnder);
// A full rounded jaw and almost vertical cheeks replace the spherical baby
// face. The front stays broad while the side retains real cranial depth.
const faceGeometry=profileGeometry([
  [-.310,0,0],[-.305,.056,.065],[-.291,.120,.127],[-.266,.175,.173],
  [-.229,.212,.205],[-.175,.235,.224],[-.095,.246,.233],[-.015,.247,.235],
  [.08,.245,.231],[.165,.241,.221],[.235,.218,.199],[.274,.158,.146],[.284,0,0]
],48,.86);
// Keep the cheek and chin round, but give the eye belt enough supporting
// volume: the outer eye root otherwise stood six centimetres off the face.
{
  const p=faceGeometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(z<=0)continue;
    const weight=Math.exp(-Math.pow((y+.018)/.135,4)),rx=.247,rz=.235;
    const flat=rz*Math.pow(Math.max(0,1-Math.pow(Math.min(1,Math.abs(x)/rx),2/.55)),.55/2);
    p.setZ(i,z+(flat-z)*weight*.92);
  }
  faceGeometry.computeVertexNormals();closeRingNormals(faceGeometry,48,13);
}
const faceSkin=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.98,vertexColors:true});
{
  const colors=[],p=faceGeometry.attributes.position;
  const base=new THREE.Color('#f0ae91'),cheek=new THREE.Color('#eaa084'),chin=new THREE.Color('#e0a081');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),front=THREE.MathUtils.smoothstep(z,.08,.20);
    const warmth=Math.exp(-Math.pow((Math.abs(x)-.18)/.075,2)-Math.pow((y+.105)/.085,2))*front*.28;
    const c=base.clone().lerp(cheek,warmth).lerp(chin,THREE.MathUtils.smoothstep(-y,.21,.31)*.13);colors.push(c.r,c.g,c.b);
  }
  faceGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
}
const girlHair=material('girlHair','#34204b',.94),brownHair=material('brownHair','#291d18',.97);
const girlHairLight=material('girlHairLight','#291a3a',.97),glassesMat=material('glasses','#161b1b',.90);
const lensMat=material('glassesLens','#edf3da',.94),lipMat=material('lipLine','#bc6848',.98);
function buildHead(girl,seed){
  const head=new THREE.Group(),fixed=new THREE.Group();head.add(fixed);
  const style=girl?(seed%6===3?'pony':'bob'):(seed%3===1?'bowl':'swept'),hairMat=style==='bob'?girlHair:style==='pony'?brownHair:hair;
  mesh(fixed,faceGeometry,faceSkin);
  for(const side of [-1,1]){
    oval(fixed,skin,[side*.246,-.078,-.020],[.041,.059,.029]);
    oval(fixed,skinShade,[side*.268,-.077,.004],[.014,.031,.008]);
  }
  if(style==='bob'){mesh(fixed,bobUnder,hair);mesh(fixed,bobEdge,girlHair);}
  mesh(fixed,scalps[style],hairMat);
  if(style==='swept')mesh(fixed,forelock,hairMat);
  if(style==='pony'){
    mesh(fixed,ponytail,hairMat);
    oval(fixed,blue,[0,.262,-.187],[.048,.026,.038]);
  }
  if(style==='bob'||style==='pony'||style==='bowl'){
    // Recessed part lines follow the crown; the bob's actual V cuts are mesh.
    for(const x of [-.153,-.046,.067,.166]){
      const z=.220*Math.pow(Math.max(0,1-Math.pow(Math.abs(x)/.266,2/.71)),.73/2)-.015;
      line(fixed,style==='bob'?girlHairLight:hair,[ [x*.64,.278,z-.072],[x*.88,.232,z-.017],[x,.162,z+.001] ],.0017);
    }
  }
  if(style==='bob'){
    const side=seed%2===0?1:-1;
    cube(fixed,white,[side*.141,.243,.214],[.085,.014,.013],[0,0,side*-.14]);
    oval(fixed,white,[side*.109,.251,.224],[.020,.017,.006]);
    oval(fixed,white,[side*.100,.273,.221],[.006,.014,.005],[0,0,.4]);
    oval(fixed,white,[side*.115,.274,.221],[.006,.014,.005],[0,0,-.3]);
  }
  // The nose and eyelid roots share the facial surface instead of floating.
  oval(fixed,skin,[0,-.080,.235],[.014,.025,.014]);
  oval(fixed,skin,[0,-.099,.242],[.018,.014,.016]);
  const wearsGlasses=!girl&&seed%3===1;
  if(wearsGlasses){
    for(const side of [-1,1]){
      oval(fixed,lensMat,[side*.103,.006,.255],[.086,.091,.009]);
      const rim=[];for(let i=0;i<=28;i++){const a=i/28*Math.PI*2;rim.push([side*.103+Math.cos(a)*.087,.006+Math.sin(a)*.092,.263]);}
      line(fixed,glassesMat,rim,.0033);
      line(fixed,glassesMat,[[side*.188,.023,.252],[side*.242,.015,.133],[side*.263,-.052,-.004]],.004);
    }
    line(fixed,glassesMat,[[-.018,.013,.260],[0,.018,.267],[.018,.013,.260]],.004);
  }
  bakeStatic(fixed);
  const eyes=[],brows=[],browBases=[];
  for(const side of [-1,1]){
    const eye=new THREE.Group();eye.position.set(side*.104,-.018,.234);eye.rotation.y=side*.10;head.add(eye);
    oval(eye,eyeWhite,[0,0,0],[.089,.095,.027]);
    const irisGroup=new THREE.Group();irisGroup.position.set(side*-.002,-.003,.027);eye.add(irisGroup);
    oval(irisGroup,pupil,[0,0,0],[.0115,.013,.0025]);eye.visible=!wearsGlasses;
    eyes.push({group:eye,iris:irisGroup});
    const brow=new THREE.Group(),browY=.090+(side<0?.004:0);brow.position.set(side*.101,browY,.231);head.add(brow);browBases.push(browY);
    line(brow,hair,[[-.030,-.002,0],[-.003,.003,.001],[.030,-.001,0]],.0035);brow.rotation.z=side*.035;brows.push(brow);
  }
  const mouth=new THREE.Group();mouth.position.set(0,-.202,.226);head.add(mouth);
  if(girl||wearsGlasses)line(mouth,lipMat,[[-.033,0,0],[0,-.003,.003],[.033,.002,0]],.0028);
  else{
    oval(mouth,mouthMat,[0,0,0],[.036,.016,.005]);oval(mouth,white,[0,.007,.005],[.026,.0035,.0015]);
    line(mouth,lipMat,[[-.032,-.006,0],[0,-.018,.002],[.030,-.006,0]],.0022);
  }
  return {group:head,eyes,brows,browBases,mouth};
}

function limb(parent,mat,radius) {
  const o=mesh(parent,sleeveGeometry,mat,[0,0,0],[radius,.1,radius]);
  return {object:o, set(a,b) {
    o.position.copy(a).add(b).multiplyScalar(.5);
    scratch.copy(b).sub(a);o.scale.set(radius,scratch.length()*.5+radius*.2,radius);
    o.quaternion.setFromUnitVectors(axisY,scratch.normalize());
  }};
}
// One curved garment surface replaces the two capsules and exposed joint
// sphere. Ring normals are supplied explicitly, including the closing seam.
function clothLimb(parent,r0,r1,{yoke=false,radial=16,rows=16}={}){
  const geometry=new THREE.BufferGeometry(),count=(rows+1)*(radial+1),positions=new Float32Array(count*3),normals=new Float32Array(count*3),blueIndices=[],whiteIndices=[];
  for(let row=0;row<rows;row++)for(let col=0;col<radial;col++){
    const a=row*(radial+1)+col,b=a+radial+1,list=yoke&&row<5&&col>0&&col<radial/2?whiteIndices:blueIndices;list.push(a,b,a+1,a+1,b,b+1);
  }
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  geometry.setIndex([...blueIndices,...whiteIndices]);geometry.addGroup(0,blueIndices.length,0);if(whiteIndices.length)geometry.addGroup(blueIndices.length,whiteIndices.length,1);
  const object=mesh(parent,geometry,yoke?[blue,white]:blue),path=new THREE.CatmullRomCurve3([new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]);
  const tangent=new THREE.Vector3(),across=new THREE.Vector3(),front=new THREE.Vector3(),radialNormal=new THREE.Vector3(),fallback=new THREE.Vector3(0,0,1);
  return {object,set(a,b,c){
    path.points[0].copy(a);path.points[1].copy(b);path.points[2].copy(c);
    const length=a.distanceTo(b)+b.distanceTo(c),slope=(r1-r0)/Math.max(.01,length);
    for(let row=0;row<=rows;row++){
      const t=row/rows,center=path.getPoint(t);tangent.copy(path.getTangent(t)).normalize();across.crossVectors(tangent,fallback);
      if(across.lengthSq()<.01)across.crossVectors(tangent,axisY);across.normalize();front.crossVectors(across,tangent).normalize();
      const radius=THREE.MathUtils.lerp(r0,r1,t)+.003*Math.sin(t*Math.PI);
      for(let col=0;col<=radial;col++){
        const theta=col/radial*Math.PI*2,index=(row*(radial+1)+col)*3;radialNormal.copy(across).multiplyScalar(Math.cos(theta)).addScaledVector(front,Math.sin(theta));
        positions[index]=center.x+radialNormal.x*radius;positions[index+1]=center.y+radialNormal.y*radius;positions[index+2]=center.z+radialNormal.z*radius;
        radialNormal.addScaledVector(tangent,-slope).normalize();normals[index]=radialNormal.x;normals[index+1]=radialNormal.y;normals[index+2]=radialNormal.z;
      }
    }
    geometry.attributes.position.needsUpdate=true;geometry.attributes.normal.needsUpdate=true;geometry.computeBoundingSphere();
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
  const hips=seated?.65:.70, shoulders=seated?1.075:1.140, headY=shoulders+.315;
  const uniform=new THREE.Group();body.add(uniform);
  const jacketScale=(shoulders-hips)/.40;
  mesh(uniform,jacketGeometry,blue,[0,hips,0],[1,jacketScale,1]);
  mesh(uniform,shoulderPanel,white,[0,hips,0],[1,jacketScale,1]);
  if(!girl)mesh(uniform,shirtPanel,white,[0,hips,0],[1,jacketScale,1]);
  oval(uniform,skin,[0,shoulders+.031,0],[.064,.075,.060]);
  mesh(uniform,profileGeometry([[-.018,.171,.098],[.015,.178,.103],[.032,.175,.101]],24,.65),blueDark,[0,hips,0]);
  for(const side of [-1,1]){
    const collar=new THREE.Shape();collar.moveTo(side*.010,.030);collar.lineTo(side*.048,.065);collar.lineTo(side*.116,.008);collar.lineTo(side*.067,-.041);collar.closePath();
    const g=new THREE.ExtrudeGeometry(collar,{depth:.018,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2});
    mesh(uniform,g,blue,[0,shoulders-.009,.070]);
    if(!girl)line(uniform,blueDark,[[side*.113,hips+.025,.112],[side*.115,hips+.20,.124],[side*.114,shoulders-.075,.113]],.006);
  }
  if(girl)line(uniform,white,[[0,hips+.025,.108],[0,hips+.19,.122],[0,shoulders-.011,.096]],.0019);
  cube(uniform,sole,[girl?0:.115,shoulders-.108,.129],[.008,.021,.004]);
  oval(uniform,yellow,[.102,shoulders-.134,.124],[.011,.012,.002]);
  bakeStatic(uniform);
  const headData=buildHead(girl,seed), head=headData.group;
  head.position.y=headY;body.add(head);
  const legs=new THREE.Group();group.add(legs);
  for(const side of [-1,1]) {
    const hip=point(side*.095,hips,0), knee=point(side*.105,seated?.4:.39,seated?.31:.012), ankle=point(side*.115,.095,seated?.3:.035);
    const trouser=clothLimb(legs,.093,.073,{radial:18,rows:18});trouser.set(hip,knee,ankle);
    const seamA=hip.clone().add(point(side*.087,0,.035)),seamB=knee.clone().add(point(side*.081,0,.03)),seamC=ankle.clone().add(point(side*.069,0,.024));
    line(legs,white,[seamA.toArray(),seamB.toArray(),seamC.toArray()],.009);
    oval(legs,white,[ankle.x,.103,ankle.z],[.055,.032,.054]);
    mesh(legs,trainerSole,sole,[ankle.x,0,ankle.z],[1.12,1.28,1.08]);
    mesh(legs,trainerUpper,blueDark,[ankle.x,0,ankle.z],[1.10,1.15,1.08]);
    mesh(legs,trainerToe,shoe,[ankle.x,0,ankle.z],[1.10,1.15,1.08]);
    for(let i=0;i<3;i++){
      const z=ankle.z+.011+i*.026,y=.135-i*.006;
      line(legs,white,[[ankle.x-.027,y-.004,z-.005],[ankle.x,y,z+.003],[ankle.x+.027,y-.004,z-.005]],.003);
    }
    for(const edge of [-1,1])line(legs,white,[[ankle.x+edge*.065,.056,ankle.z-.022],[ankle.x+edge*.075,.05,ankle.z+.038],[ankle.x+edge*.072,.043,ankle.z+.085]],.004);

  }
  bakeStatic(legs);
  const arms=[];
  for(const side of [-1,1]) {
    const arm=new THREE.Group();body.add(arm);
    const sleeve=clothLimb(arm,.075,.056,{yoke:true});
    const cuff=mesh(arm,cuffGeometry,blueDark,[0,0,0],[1.07,1.05,1.07]);
    const hand=new THREE.Group();arm.add(hand);
    const handOpen=makeHand(side,false),handGrip=makeHand(side,true);hand.add(handOpen,handGrip);
    arms.push({side,sleeve,cuff,hand,handOpen,handGrip});

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
  const phase=seed*1.719, shoulderPoints=[point(-.250,shoulders-.055,0),point(.250,shoulders-.055,0)];
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
    } else if(mood==='hero'){
      elbows[0].set(-.32,.91,.09);wrists[0].set(-.16,1.01,.24);
      elbows[1].set(.37,1.16,.06);wrists[1].set(.24+Math.sin(time*1.8)*.008,1.43+Math.sin(time*1.4)*.012,.10);
      head.rotation.z=-.055+Math.sin(time*.5)*.018;
    } else {
      elbows[0].set(-.285,.89,.025);wrists[0].set(-.270,.68,.075);
      elbows[1].set(.285,.89,.025);wrists[1].set(.270,.68,.075);
      head.rotation.z=Math.sin(time*.5)*.007;
    }
    arms.forEach((a,i)=>{
      const s=shoulderPoints[i],e=elbows[i],w=wrists[i];
      a.sleeve.set(s,e,w);
      a.cuff.position.copy(e).lerp(w,.88);a.cuff.quaternion.setFromUnitVectors(axisY,w.clone().sub(e).normalize());
      a.hand.position.copy(w);
      const resting=seated&&(i===0||mood==='resting'||mood==='thinking'||mood==='chat');
      const openHand=resting||mood==='chat'||(!seated&&(mood!=='hero'||i===1));
      a.handOpen.visible=openHand;a.handGrip.visible=!openHand;
      a.hand.rotation.set(resting?Math.PI*.5:(mood==='writing'?.54:0),0,!seated&&mood!=='hero'?Math.PI+a.side*.07:a.side*-.12);

    });
    snack.visible=seated&&mood==='snack';notebook.visible=seated?mood==='writing':mood==='hero';pencil.visible=seated&&mood==='writing';
    snack.position.copy(wrists[1]).add(point(-.02,.044,.014));snack.rotation.z=-.12;
    if(seated){notebook.position.set(-.015,.852,.40);notebook.rotation.set(-Math.PI/2,0,-.05);}
    else {notebook.position.copy(wrists[0]).add(point(.02,-.015,.024));notebook.rotation.set(-.18,.06,.12);}
    pencil.position.copy(wrists[1]).add(point(.014,.014,.025));pencil.rotation.set(.65,0,-.22);
    if(previousMood!==mood)previousMood=mood;
  }
  update(0);
  return {group,update,setMood(value){mood=value;},head,variant,seated};
}
