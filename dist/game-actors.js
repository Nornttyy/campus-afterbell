import * as THREE from './vendor/three.module.js';

// Independent gameplay actors. Teacher coordinates: ground y=0, front +Z.
// First-person hands use camera coordinates: the scene is in front at -Z.
const materials=new Map();
const mat=(name,color,roughness=.72,metalness=0)=>{
  if(!materials.has(name))materials.set(name,new THREE.MeshStandardMaterial({color,roughness,metalness}));
  return materials.get(name);
};
const skin=mat('skin','#edb08c'),skinShade=mat('skinShade','#cd8a6e'),shirt=mat('shirt','#f6f4e9');
const clothBlue=mat('schoolBlue','#286ac6'),cuffMat=mat('cuff','#f6f5e9'),pants=mat('pants','#725345');
const hair=mat('teacherHair','#24262c',.58),black=mat('black','#20252e'),pupil=mat('pupil','#161a21',.3);
const sole=mat('sole','#3c3c42'),eyeWhite=mat('eyes','#fff8e9',.4),lip=mat('lip','#70493e');
const button=mat('button','#bbc1c3',.35,.1),belt=mat('belt','#403b37'),glasses=mat('glasses','#343d48',.4,.2);
const sphere=new THREE.SphereGeometry(1,18,12),box=new THREE.BoxGeometry(1,1,1),axisY=new THREE.Vector3(0,1,0);
const tmpA=new THREE.Vector3(),tmpB=new THREE.Vector3();
function mesh(parent,geo,material,p=[0,0,0],s=[1,1,1],r=null){const m=new THREE.Mesh(geo,material);m.position.set(...p);m.scale.set(...s);if(r)m.rotation.set(...r);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const oval=(parent,material,p,s,r=null)=>mesh(parent,sphere,material,p,s,r);
const cube=(parent,material,p,s,r=null)=>mesh(parent,box,material,p,s,r);
function curve(parent,material,points,r=.004){return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(8,points.length*4),r,6,false),material);}
function shapeRect(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
function rounded(w,h,d,r=.02){const g=new THREE.ExtrudeGeometry(shapeRect(w,h,r),{depth:d,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,bevelSegments:2,curveSegments:8});g.translate(0,0,-d/2);return g;}
function loft(rings,segments=24,exponent=.8){const vertices=[],indices=[];for(const r of rings)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,s=Math.sin(a),c=Math.cos(a);vertices.push(Math.sign(s)*Math.abs(s)**exponent*r[1],r[0],Math.sign(c)*Math.abs(c)**exponent*r[2]+(r[3]||0));}for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;}
function batch(group){group.updateMatrixWorld(true);const inv=group.matrixWorld.clone().invert(),map=new Map(),old=[];group.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material)){const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));if(!map.has(o.material))map.set(o.material,[]);map.get(o.material).push(g);old.push(o);}});old.forEach(o=>o.removeFromParent());for(const [material,parts]of map){const count=parts.reduce((n,g)=>n+g.attributes.position.count,0),g=new THREE.BufferGeometry();for(const name of ['position','normal']){const a=new Float32Array(count*3);let offset=0;for(const p of parts){a.set(p.attributes[name].array,offset);offset+=p.attributes[name].array.length;}g.setAttribute(name,new THREE.BufferAttribute(a,3));}g.computeBoundingSphere();mesh(group,g,material);parts.forEach(g=>g.dispose());}}
const tapered=loft([[-1,0,0],[-1,.90,.90],[-.83,1,1],[.55,.91,.91],[.94,.79,.79],[1,0,0]],14,.95);
function segment(parent,material,radius){const m=mesh(parent,tapered,material,[0,0,0],[radius,.1,radius]);return{mesh:m,set(a,b){m.position.copy(a).add(b).multiplyScalar(.5);tmpA.copy(b).sub(a);m.scale.set(radius,tmpA.length()*.5,radius);m.quaternion.setFromUnitVectors(axisY,tmpA.normalize());}};}
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function smooth(current,target,dt,speed=10){return current+(target-current)*(1-Math.exp(-Math.max(0,dt)*speed));}

// Fingers have real joints, so a single pair of hands can open, pinch and grip.
function articulatedHand(side,scale=1,palmSign=1){
  const group=new THREE.Group(),palm=new THREE.Group();group.add(palm);group.scale.setScalar(scale);
  oval(palm,skin,[0,.027,0],[.039,.044,.021]);oval(palm,skin,[0,-.012,0],[.028,.022,.022]);
  curve(palm,skinShade,[[-.023,.02,.019*palmSign],[.003,.015,.022*palmSign],[.024,.022,.019*palmSign]],.0011);batch(palm);
  const fingers=[];
  for(let i=0;i<4;i++){
    const root=new THREE.Group();root.position.set((i-1.5)*.020,.055,0);group.add(root);
    const len=[.024,.032,.030,.023][i],r=[.009,.010,.0097,.0085][i];
    const first=segment(root,skin,r);first.set(v(0,0,0),v(0,len,0));
    oval(root,skin,[0,0,0],[r*1.04,r*1.04,r*1.04]);oval(root,skin,[0,len,0],[r*1.06,r*1.06,r*1.06]);
    const joint=new THREE.Group();joint.position.y=len;root.add(joint);
    const end=segment(joint,skin,r*.88);end.set(v(0,0,0),v(0,len*.8,0));oval(joint,skin,[0,len*.8,0],[r*.88,r*.88,r*.88]);
    fingers.push({root,joint});
  }
  const thumb=new THREE.Group();thumb.position.set(-side*.032,.007,.006*palmSign);thumb.rotation.z=side*.64;group.add(thumb);
  const thumbA=segment(thumb,skin,.013);thumbA.set(v(0,0,0),v(0,.034,.008*palmSign));
  const thumbTip=new THREE.Group();thumbTip.position.set(0,.033,.008*palmSign);thumb.add(thumbTip);
  const thumbB=segment(thumbTip,skin,.011);thumbB.set(v(0,0,0),v(0,.024,0));oval(thumbTip,skin,[0,.024,0],[.011,.011,.011]);
  function setCurl(amount){const c=clamp(amount,0,1);fingers.forEach((f,i)=>{f.root.rotation.x=palmSign*(.16+c*(.55+i*.025));f.joint.rotation.x=palmSign*c*1.16;});thumb.rotation.x=palmSign*(.10+c*.6);thumbTip.rotation.x=palmSign*c*.8;}
  function pointIndex(amount=1){const f=fingers[side===1?0:3],a=clamp(amount,0,1);f.root.rotation.x*=1-a;f.joint.rotation.x*=1-a;}
  setCurl(.15);return{group,setCurl,pointIndex};
}
function makeArm(parent,{material=shirt,radius=.065,school=false,side=1,handScale=.92,palmSign=1}={}){
  const group=new THREE.Group();parent.add(group);
  const upper=segment(group,material,radius),lower=segment(group,material,radius*.85);
  const elbow=oval(group,material,[0,0,0],[radius*.91,radius*.91,radius*.91]);
  const cuff=mesh(group,loft([[-.018,.048,.048],[.018,.047,.047]],16),school?cuffMat:shirt);
  const hand=articulatedHand(side,handScale,palmSign);group.add(hand.group);
  const stripes=school?[segment(group,cuffMat,.009),segment(group,cuffMat,.008)]:null;
  function pose(a,b,c,{curl=.15,rx=0,ry=0,rz=0}={}){upper.set(a,b);lower.set(b,c);elbow.position.copy(b);cuff.position.copy(b).lerp(c,.93);cuff.quaternion.setFromUnitVectors(axisY,tmpB.copy(c).sub(b).normalize());hand.group.position.copy(c);hand.group.rotation.set(rx,ry,rz);hand.setCurl(curl);if(stripes){const off=v(side*.011,0,radius*.85);stripes[0].set(a.clone().add(off),b.clone().add(off));stripes[1].set(b.clone().add(off),c.clone().add(off));}}
  return{group,pose,hand};
}

const teacherFace=loft([[-.206,0,0],[-.191,.071,.077],[-.16,.118,.115],[-.09,.146,.137],[.02,.153,.139],[.12,.149,.133],[.18,.119,.106],[.205,.055,.05],[.211,0,0]],32,.83);
function teacherHairGeometry(){const p=[],idx=[],rows=14,cols=36;for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const a=i/cols*Math.PI*2,front=Math.max(0,Math.cos(a)),edge=1.91-.77*front**4+.045*Math.sin(a*3)*front**5,t=j/rows*edge,x=Math.sin(t)*Math.sin(a),z=Math.sin(t)*Math.cos(a);p.push(Math.sign(x)*Math.abs(x)**.76*.168,Math.cos(t)*.229+.008,Math.sign(z)*Math.abs(z)**.76*.153-.005);}for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;idx.push(a,b,a+1,b,b+1,a+1);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;}
const teacherCap=teacherHairGeometry();
const shirtGeometry=loft([[-.018,.165,.105],[.025,.185,.112],[.15,.184,.117],[.34,.208,.125],[.48,.249,.124],[.535,.22,.108],[.57,.105,.074]],32,.68);
function createAdultHead(){
  const group=new THREE.Group(),fixed=new THREE.Group();group.add(fixed);mesh(fixed,teacherFace,skin);mesh(fixed,teacherCap,hair);
  for(const side of [-1,1]){oval(fixed,skin,[side*.15,-.022,-.006],[.032,.048,.022]);oval(fixed,skinShade,[side*.168,-.025,.013],[.011,.026,.006]);}
  oval(fixed,skin,[0,-.005,.138],[.018,.046,.022]);oval(fixed,skin,[0,-.036,.155],[.024,.023,.025]);
  curve(fixed,lip,[[-.042,-.105,.122],[-.01,-.117,.131],[.026,-.112,.129],[.047,-.096,.118]],.004);
  curve(fixed,skinShade,[[-.025,-.14,.115],[.012,-.142,.12]],.0018);
  const eyes=[];
  for(const side of [-1,1]){
    const eye=new THREE.Group();eye.position.set(side*.061,.025,.13);group.add(eye);
    oval(eye,eyeWhite,[0,0,0],[.043,.057,.015]);oval(eye,pupil,[0,0,.016],[.013,.019,.003]);eyes.push(eye);
    const rim=[];for(let i=0;i<=32;i++){const a=i/32*Math.PI*2;rim.push([side*.061+Math.cos(a)*.049,.026+Math.sin(a)*.064,.151]);}curve(fixed,glasses,rim,.0035);
    curve(fixed,glasses,[[side*.109,.05,.151],[side*.151,.041,.08],[side*.158,.005,0]],.0028);
    curve(fixed,hair,[[side*.021,.104,.122],[side*.06,.114,.129],[side*.101,.104,.112]],.006);
  }
  curve(fixed,glasses,[[-.012,.039,.152],[0,.044,.16],[.012,.039,.152]],.003);
  // A quiet side part and a continuous cap avoid any detached hair geometry.
  curve(fixed,mat('part','#383a41'),[[.045,.219,.048],[.069,.205,.092],[.099,.17,.113]],.002);
  batch(fixed);return{group,eyes};
}
function shoeMesh(parent,x){
  const g=new THREE.Group();g.position.x=x;parent.add(g);
  mesh(g,rounded(.15,.26,.045,.045),sole,[0,.027,.035],[1,1,1],[-Math.PI/2,0,0]);
  mesh(g,loft([[-.09,0,0],[-.075,.058,.025],[-.04,.072,.039],[.035,.073,.041],[.12,.061,.028],[.153,0,0]],20,.75),black,[0,.065,.0],[1,1,1],[Math.PI/2,0,0]);
  for(let i=0;i<3;i++)curve(g,black,[[-.033,.103,-.008+i*.024],[0,.109,.001+i*.024],[.033,.103,-.008+i*.024]],.0025);
  batch(g);return g;
}

export function createTeacher(){
  const group=new THREE.Group();group.name='classroom-teacher';
  const body=new THREE.Group();group.add(body);const fixed=new THREE.Group();body.add(fixed);
  mesh(fixed,shirtGeometry,shirt,[0,.99,0]);
  mesh(fixed,loft([[-.025,.184,.111],[.025,.184,.111]],24,.68),belt,[0,1.0,0]);
  cube(fixed,button,[0,1.0,.116],[.047,.035,.007]);cube(fixed,belt,[0,1.0,.122],[.028,.018,.004]);
  oval(fixed,skin,[0,1.595,0],[.061,.078,.059]);
  for(const side of [-1,1]){
    const s=new THREE.Shape();s.moveTo(side*.014,.04);s.lineTo(side*.055,.066);s.lineTo(side*.126,-.008);s.lineTo(side*.065,-.058);s.closePath();
    mesh(fixed,new THREE.ExtrudeGeometry(s,{depth:.013,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:2}),shirt,[0,1.535,.069]);
  }
  curve(fixed,mat('shirtSeam','#d3d5cf'),[[0,1.024,.118],[0,1.30,.13],[0,1.52,.105]],.0016);
  for(let i=0;i<5;i++)oval(fixed,button,[0,1.10+i*.088,.128],[.006,.006,.003]);
  curve(fixed,mat('pocket','#d1d4ce'),[[.077,1.43,.128],[.077,1.344,.128],[.148,1.344,.115],[.148,1.43,.115]],.002);
  cube(fixed,mat('teacherPen','#315983'),[.105,1.438,.132],[.009,.052,.008]);
  batch(fixed);
  const adultHead=createAdultHead();adultHead.group.position.y=1.81;body.add(adultHead.group);
  const arms=[makeArm(body,{side:-1}),makeArm(body,{side:1})];
  const legs=[];
  for(const side of [-1,1]){const upper=segment(group,pants,.093),lower=segment(group,pants,.078),knee=oval(group,pants,[0,.52,0],[.077,.078,.073]),foot=shoeMesh(group,side*.115);legs.push({side,upper,lower,knee,foot});}
  const chalk=new THREE.Group();arms[1].hand.group.add(chalk);mesh(chalk,new THREE.CylinderGeometry(.005,.005,.055,10),cuffMat,[.011,.07,.026],[1,1,1],[Math.PI/2,0,0]);
  let lastTime=null,walk=0,headLook=0,write=1,alertValue=0;
  function update(time,{walking=0,look=0,phase='board',alert=0}={}){
    if(lastTime!==null&&time<lastTime){lastTime=null;walk=0;headLook=0;write=phase==='board'?1:0;alertValue=0;}
    const dt=lastTime===null?1/60:clamp(time-lastTime,0,.08);lastTime=time;
    walk=smooth(walk,clamp(Number(walking)||0,0,1),dt,8);headLook=smooth(headLook,clamp(Number(look)||0,-1.2,1.2),dt,7);
    write=smooth(write,phase==='board'&&walk<.15?1:0,dt,5);alertValue=smooth(alertValue,clamp(Number(alert)||0,0,1),dt,7);
    const cycle=time*5.7,bob=Math.cos(cycle*2)*.012*walk;
    body.position.y=bob;body.rotation.z=Math.sin(cycle)*.012*walk;adultHead.group.rotation.set(-.025+alertValue*.045,headLook,Math.sin(time*.8)*.008);
    const blink=(time%4.8)<.13?Math.sin(time%4.8/.13*Math.PI):0;adultHead.eyes.forEach(e=>e.scale.y=Math.max(.10,1-blink));
    legs.forEach((l,i)=>{const t=cycle+i*Math.PI,swing=Math.sin(t)*walk,footLift=Math.max(0,Math.cos(t))*.085*walk;
      const hip=v(l.side*.112,.98,0),knee=v(l.side*.118,.52+bob*.25,.04+swing*.10),ankle=v(l.side*.122,.112+footLift,swing*.20);
      l.upper.set(hip,knee);l.lower.set(knee,ankle);l.knee.position.copy(knee);l.foot.position.set(ankle.x,footLift,ankle.z);l.foot.rotation.x=-Math.max(0,Math.cos(t))*.13*walk;
    });
    arms.forEach((arm,i)=>{const side=i?1:-1,t=cycle+i*Math.PI,swing=-Math.sin(t)*walk;
      const shoulder=v(side*.238,1.485,0),elbow=v(side*.28,1.22,.02+swing*.13),wrist=v(side*.27,.995,swing*.21);
      if(i===1){elbow.lerp(v(.29,1.64,.14),write);wrist.lerp(v(.27+Math.sin(time*2.7)*.024,1.79+Math.sin(time*3.4)*.023,.37),write);}
      arm.pose(shoulder,elbow,wrist,{curl:i===1?write*.82:.16,rx:i===1?write*.26:0,rz:(1-write*(i===1?1:0))*Math.PI});
    });
    chalk.visible=write>.15;
  }
  update(0);return{group,update};
}

function snackProp(){
  const group=new THREE.Group();group.name='snack-packet';
  const gold=mat('packet','#e9b545',.76),cream=mat('packetCream','#fff2c4',.84),red=mat('packetRed','#c94f34',.86),blue=mat('packetBlue','#315d9d',.85);
  const s=new THREE.Shape();s.moveTo(-.073,-.095);s.lineTo(.070,-.095);s.quadraticCurveTo(.065,-.032,.080,.020);s.lineTo(.073,.098);s.lineTo(-.075,.098);s.quadraticCurveTo(-.070,.045,-.080,-.025);s.closePath();
  mesh(group,new THREE.ExtrudeGeometry(s,{depth:.036,bevelEnabled:true,bevelSize:.006,bevelThickness:.005,bevelSegments:3,curveSegments:6}),gold,[0,0,-.018]);
  mesh(group,rounded(.119,.128,.002,.018),cream,[0,.003,.025]);
  mesh(group,rounded(.112,.027,.002,.008),blue,[0,.044,.029],[1,1,1],[0,0,-.07]);
  oval(group,red,[0,-.025,.030],[.038,.031,.003]);
  for(const y of [-.095,.098])cube(group,cream,[0,y,.003],[.152,.012,.038]);
  for(let i=0;i<5;i++)curve(group,gold,[[-.057+i*.028,.092,.027],[-.052+i*.028,.105,.027]],.0014);
  // An open folded mouth and a few large creases give the foil bag its shape.
  oval(group,mat('packetInside','#8f6e32'),[0,.103,-.001],[.060,.005,.013]);
  curve(group,cream,[[-.060,-.070,.027],[-.049,-.035,.031],[-.061,.004,.028]],.0013);
  curve(group,gold,[[.054,-.074,.028],[.046,-.044,.030],[.055,-.015,.027]],.0015);
  batch(group);return group;
}
function snackPiece(){
  const group=new THREE.Group();group.name='single-crisp';
  const toasted=mat('crispEdge','#bc7034',.92),gold=mat('crisp','#e3a04e',.92),ridge=mat('crispRidge','#e9b369',.94);
  oval(group,toasted,[0,0,0],[.027,.038,.005]);oval(group,gold,[0,.001,.003],[.025,.036,.0035]);
  for(let i=-2;i<=2;i++)curve(group,ridge,[[i*.007,-.025,.005],[i*.007+.002,0,.008],[i*.007,.026,.005]],.0012);
  batch(group);return group;
}
function phoneProp(){
  const group=new THREE.Group();group.name='handheld-phone';
  mesh(group,rounded(.115,.208,.013,.014),mat('phoneCase','#eef0eb',.54));
  mesh(group,rounded(.097,.159,.001,.006),new THREE.MeshBasicMaterial({color:'#294a61'}),[0,.003,.011]);
  cube(group,mat('phoneSpeaker','#3b4247'),[0,.093,.010],[.022,.003,.002]);oval(group,black,[.026,.092,.010],[.002,.002,.001]);
  const icons=['#70a985','#df8c51','#609bc0','#d3b95d','#ad86b8','#d2e3df'].map(color=>new THREE.MeshBasicMaterial({color}));
  for(let row=0;row<4;row++)for(let col=0;col<3;col++){
    const x=(col-1)*.028,y=.057-row*.033;
    mesh(group,rounded(.019,.020,.001,.004),icons[(row*3+col)%icons.length],[x,y,.013]);
    cube(group,icons[5],[x,y-.013,.013],[.013,.001,.001]);
  }
  oval(group,mat('phoneHome','#b7c2c6',.4),[0,-.091,.009],[.008,.008,.001]);oval(group,cuffMat,[0,-.091,.010],[.006,.006,.001]);
  batch(group);return group;
}
function paperProp(){
  const group=new THREE.Group(),paper=mat('notePaper','#f8f6e9',.94),fold=mat('paperFold','#e0e4dc',.96),rule=mat('paperRule','#9bafb5',.94);
  group.name='folded-note';const base=new THREE.Group();group.add(base);
  mesh(base,rounded(.142,.092,.002,.002),paper);for(let i=0;i<3;i++)curve(base,rule,[[-.052,-.012-i*.010,.002],[.041,-.012-i*.010,.002]],.0005);batch(base);
  const flap=new THREE.Group();flap.position.y=.046;group.add(flap);
  const s=new THREE.Shape();s.moveTo(-.071,0);s.lineTo(.071,0);s.lineTo(.059,.065);s.lineTo(-.059,.065);s.closePath();
  mesh(flap,new THREE.ExtrudeGeometry(s,{depth:.0015,bevelEnabled:false}),paper);
  curve(flap,fold,[[-.069,0,.003],[.069,0,.003]],.0008);batch(flap);
  group.userData.flap=flap;return group;
}

export function createDeskHands(){
  const group=new THREE.Group();group.name='first-person-school-hands';
  const deskBlue=mat('deskSchoolBlue','#2473d1',.88);
  const arms=[makeArm(group,{material:deskBlue,radius:.058,school:true,side:-1,handScale:.9,palmSign:-1}),makeArm(group,{material:deskBlue,radius:.058,school:true,side:1,handScale:.9,palmSign:-1})];
  arms.forEach((arm,i)=>arm.group.name=i?'right-desk-arm':'left-desk-arm');
  const props={snack:snackProp(),piece:snackPiece(),phone:phoneProp(),note:paperProp()};Object.values(props).forEach(p=>group.add(p));
  let lastTime=null,focus=0,extension=0,alertValue=0,standing=0,active='snack',useTime=0;
  const rest=[v(-.22,-.525,-.28),v(.22,-.525,-.28)],drawer=[v(-.23,-.68,-.30),v(.18,-.68,-.30)];
  const ease=(x,a=0,b=1)=>THREE.MathUtils.smoothstep(x,a,b);
  function update(time,{action='snack',holding=false,progress=0,alert=0,seated=true,crouched=false,caught=false,viewPitch=.08}={}){
    if(lastTime!==null&&time<lastTime){lastTime=null;focus=extension=alertValue=standing=useTime=0;}
    const dt=lastTime===null?1/60:clamp(time-lastTime,0,.08);lastTime=time;
    const requested=['snack','note','phone'].includes(action)?action:'snack';
    if(extension<.001&&active!==requested){active=requested;useTime=0;}
    const engaged=holding&&!caught&&active===requested;
    focus=smooth(focus,engaged&&seated?1:0,dt,7);
    standing=smooth(standing,seated?0:1,dt,9);
    alertValue=smooth(alertValue,clamp(Number(alert)||0,0,1),dt,12);
    extension=clamp(extension+dt*(engaged?1/.70:-(caught?1/.20:1/.46)),0,1);
    const clear=ease(extension,0,.16),lower=ease(extension,.16,.32),reach=ease(extension,.30,.48),pull=ease(extension,.48,.72),use=ease(extension,.70,1),p=clamp(Number(progress)||0,0,1);
    if(engaged&&use>.94)useTime+=dt;else if(extension<.05)useTime=0;
    const fidget=Math.sin(time*2.4)*.002,cycle=(useTime%2.65)/2.65;
    const bite=seated&&!crouched?ease(cycle,.20,.48)*(1-ease(cycle,.62,.95)):0;
    const pass=active==='note'?ease(p,.62,.96):0;
    const targets={
      snack:[v(-.25,-.615,-.22),v(-.055,-.56,-.23).lerp(v(.115,-.285,-.105),bite)],
      phone:[v(-.16,-.59,-.245),v(.069,-.575,-.249+Math.sin(useTime*6.2)*.003)],
      note:[v(-.12,-.59,-.245).lerp(rest[0],pass),v(.12+pass*.27,-.59+pass*.018,-.245+pass*.035)]
    };
    // Clear the front edge before lowering, then reach horizontally through
    // the opening. A packet is pulled clear before it is turned upright.
    const wrists=rest.map((r,i)=>{
      const w=r.clone();w.z=THREE.MathUtils.lerp(r.z,-.17,clear);w.y=THREE.MathUtils.lerp(r.y,drawer[i].y,lower);
      w.x=THREE.MathUtils.lerp(r.x,drawer[i].x,reach);w.z=THREE.MathUtils.lerp(w.z,drawer[i].z,reach);
      w.z=THREE.MathUtils.lerp(w.z,-.13,pull);return w.lerp(targets[active][i],use);
    });
    // Walking carries objects at the waist. Crouching tucks the forearms in.
    wrists.forEach((w,i)=>{const down=v((i?1:-1)*.24,-.79,-.13);w.lerp(down,standing);if(crouched){w.y-=.055;w.z+=.12*(1-reach)*(1-use);}w.y-=alertValue*.006;});
    const poses={
      snack:[{curl:.80,rx:-.18,ry:-1.02,rz:-.08},{curl:.88,rx:-.13,ry:.26,rz:.24}],
      phone:[{curl:.78,rx:-.20,ry:-1.08,rz:-.08},{curl:.80,rx:-.06,ry:.05,rz:1.04}],
      note:[{curl:.67,rx:-.34,ry:-.72,rz:-.18},{curl:.72,rx:-.34,ry:.72,rz:.16}]
    };
    arms.forEach((arm,i)=>{
      const side=i?1:-1,w=wrists[i],s=v(side*.265,-.37-standing*.045,.035);if(crouched)s.y-=.04;
      // A two-segment solve keeps both sleeves the same length while a wrist
      // travels between the drawer, phone and mouth.
      const direction=w.clone().sub(s),distance=direction.length();direction.normalize();
      const upperLength=.27,lowerLength=.245,along=(upperLength*upperLength-lowerLength*lowerLength+distance*distance)/(2*distance);
      const bend=v(side*.68,-1,.14);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
      const e=s.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,upperLength*upperLength-along*along)));
      const target=poses[active][i],blend=use*(1-standing),restRX=-Math.PI/2+reach*.16;
      const pose={curl:.10+(target.curl-.10)*blend,rx:restRX+(target.rx-restRX)*blend,ry:target.ry*blend,rz:target.rz*blend};
      if(active==='note'&&i===0){pose.rx=THREE.MathUtils.lerp(pose.rx,-Math.PI/2,pass);pose.ry*=1-pass;pose.rz*=1-pass;pose.curl*=1-pass*.85;}
      pose.rx=THREE.MathUtils.lerp(pose.rx,-.23,standing);pose.rz=THREE.MathUtils.lerp(pose.rz,-side*.06,standing);
      arm.pose(s,e,w,pose);
      if(active==='phone'&&i===1&&use>.25&&standing<.1)arm.hand.pointIndex(use);
    });
    const visible=extension>.46&&!caught;
    props.snack.visible=visible&&active==='snack';props.piece.visible=props.snack.visible&&use>.84&&cycle>.14&&cycle<.77&&seated&&!crouched;
    props.snack.position.copy(wrists[0]).add(v(.075,THREE.MathUtils.lerp(.018,.072,use),-.014));props.snack.rotation.set(THREE.MathUtils.lerp(-Math.PI/2,-.16,use),-.12*use,-.08+fidget);
    const rightHand=arms[1].hand.group;rightHand.updateMatrix();
    props.piece.position.set(-.024,.088,-.024).applyMatrix4(rightHand.matrix);props.piece.quaternion.copy(rightHand.quaternion);props.piece.rotateZ(-.25);
    props.phone.visible=visible&&active==='phone';props.phone.position.copy(wrists[0]).add(v(.065,THREE.MathUtils.lerp(.018,.071,use),-.020));props.phone.rotation.set(THREE.MathUtils.lerp(-Math.PI/2,-.24,use),.015,-.08);
    props.note.visible=visible&&active==='note';props.note.position.copy(wrists[1]).add(v(-.070,THREE.MathUtils.lerp(.018,.065,use),-.012));props.note.rotation.set(THREE.MathUtils.lerp(-Math.PI/2,-.72,use),.04,-.05-pass*.12);
    props.note.userData.flap.rotation.x=-Math.PI*ease(p,0,.58);
    // The scene reads this same focus to lower and pitch its camera. Applying
    // the inverse transform anchors the wrists to the physical desk opening.
    const pitch=clamp((Number.isFinite(viewPitch)?viewPitch:.08)+.85*focus,-1.40,1.40),drop=.12*focus+(seated&&crouched?.24:0);
    group.rotation.x=pitch;group.position.set(0,drop*Math.cos(pitch),drop*Math.sin(pitch));
  }
  update(0);return{group,update,getFocus(){return focus;},getDebug(){
    const camera=group.parent?.isCamera?group.parent:null,prop=props[active];
    const position=prop.getWorldPosition(v(0,0,0));if(camera)position.project(camera);
    return{focus:Number(focus.toFixed(3)),extension:Number(extension.toFixed(3)),active,visible:prop.visible,propNDC:position.toArray().map(n=>Number(n.toFixed(3))),groupPitch:Number(group.rotation.x.toFixed(3))};
  }};
}
