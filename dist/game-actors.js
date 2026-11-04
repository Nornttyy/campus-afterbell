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
  setCurl(.15);return{group,setCurl};
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
  const group=new THREE.Group();const orange=mat('packet','#f0a54d'),cream=mat('packetCream','#fff0b6'),red=mat('packetRed','#d65236');
  const s=new THREE.Shape();s.moveTo(-.044,-.067);s.lineTo(.043,-.067);s.lineTo(.049,.067);s.lineTo(-.05,.067);s.closePath();
  mesh(group,new THREE.ExtrudeGeometry(s,{depth:.027,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:2}),orange,[0,0,-.014]);
  cube(group,cream,[0,.013,.021],[.079,.043,.003]);cube(group,red,[0,.013,.024],[.044,.015,.002]);
  for(const y of [-.065,.068])cube(group,cream,[0,y,.003],[.094,.012,.034]);
  for(let i=0;i<5;i++)curve(group,orange,[[-.035+i*.017,.064,.023],[-.033+i*.017,.076,.023]],.0014);
  mesh(group,new THREE.CylinderGeometry(.006,.006,.11,8),mat('snackStick','#d8b162'),[.008,.109,0],[1,1,1],[0,0,-.13]);batch(group);return group;
}
function phoneProp(){
  const group=new THREE.Group();mesh(group,rounded(.163,.285,.020,.021),mat('phoneCase','#243447',.38),[0,0,0]);
  mesh(group,rounded(.146,.258,.002,.015),new THREE.MeshBasicMaterial({color:'#102b3c'}),[0,0,.014]);
  cube(group,mat('phoneSpeaker','#131a22'),[0,.118,.018],[.033,.004,.002]);oval(group,black,[.040,.118,.017],[.003,.003,.002]);
  const green=new THREE.MeshBasicMaterial({color:'#6cbca8'}),pale=new THREE.MeshBasicMaterial({color:'#d5e8da'});
  for(let i=0;i<4;i++){const right=i%2===0;mesh(group,rounded(right?.087:.095,.027,.001,.006),right?green:pale,[right?.017:-.012,.065-i*.045,.017]);}
  cube(group,pale,[0,-.112,.018],[.054,.003,.001]);batch(group);return group;
}
function paperProp(){const group=new THREE.Group(),paper=mat('notePaper','#fff9df');mesh(group,rounded(.142,.097,.003,.002),paper);const s=new THREE.Shape();s.moveTo(-.071,.048);s.lineTo(.071,.048);s.lineTo(0,-.012);s.closePath();mesh(group,new THREE.ExtrudeGeometry(s,{depth:.002,bevelEnabled:false}),mat('paperFold','#e4e7d7'),[0,0,.004]);curve(group,mat('paperRule','#b4c2c4'),[[-.060,-.035,.005],[.059,-.035,.005]],.0008);batch(group);return group;}
function coverBook(){const group=new THREE.Group();mesh(group,rounded(.235,.174,.013,.004),mat('bookCover','#6e9788'));mesh(group,rounded(.219,.159,.006,.002),cuffMat,[.003,0,.011]);for(let i=0;i<5;i++)cube(group,mat('bookLines','#adbcb2'),[.009,.047-i*.022,.018],[.156,.0014,.001]);batch(group);return group;}

export function createDeskHands(){
  const group=new THREE.Group();group.name='first-person-school-hands';
  const arms=[makeArm(group,{material:clothBlue,radius:.060,school:true,side:-1,handScale:.83,palmSign:-1}),makeArm(group,{material:clothBlue,radius:.060,school:true,side:1,handScale:.83,palmSign:-1})];
  const props={snack:snackProp(),phone:phoneProp(),note:paperProp(),book:coverBook()};Object.values(props).forEach(p=>group.add(p));
  const weights={snack:0,note:0,phone:0};let lastTime=null,alertValue=0,phoneGripX=.26;
  const rest=[v(-.26,-.48,-.55),v(.26,-.48,-.55)];
  function update(time,{action='snack',holding=false,progress=0,alert=0}={}){
    if(lastTime!==null&&time<lastTime){lastTime=null;alertValue=0;phoneGripX=.26;weights.snack=weights.note=weights.phone=0;}
    const dt=lastTime===null?1/60:clamp(time-lastTime,0,.08);lastTime=time;const active=['snack','note','phone'].includes(action)?action:'snack';
    alertValue=smooth(alertValue,clamp(Number(alert)||0,0,1),dt,12);
    for(const key of Object.keys(weights))weights[key]=smooth(weights[key],holding&&active===key?1:0,dt,holding?9:13);
    const total=weights.snack+weights.note+weights.phone,p=clamp(Number(progress)||0,0,1),fidget=Math.sin(time*2.4)*.003;
    const targets={
      snack:[v(-.22,-.39,-.62),v(.16,-.20+Math.sin(time*4.2)*.005,-.38)],
      note:[rest[0].clone(),v(.10+p*.26,-.29-fidget,-.52-p*.06)],
      phone:[v(-.105,-.31,-.49),v(.105,-.31,-.49)]
    };
    const wrists=rest.map((r,i)=>{const w=r.clone();for(const key of Object.keys(weights))w.addScaledVector(targets[key][i].clone().sub(r),weights[key]);w.y-=alertValue*.035;return w;});
    // A released phone and its gripping hands descend as one connected pose.
    // Only spread the wrists back to rest after the phone has disappeared.
    const phoneVisible=weights.phone>.04;
    phoneGripX=phoneVisible?.085:smooth(phoneGripX,.26,dt,12);
    if(phoneVisible){
      const y=(wrists[0].y+wrists[1].y)*.5,z=(wrists[0].z+wrists[1].z)*.5;
      wrists[0].set(-phoneGripX,y,z);wrists[1].set(phoneGripX,y,z);
    }else if(phoneGripX<.259&&weights.snack+weights.note<.05){
      wrists[0].x=-phoneGripX;wrists[1].x=phoneGripX;
    }
    arms.forEach((arm,i)=>{const side=i?1:-1,shoulder=v(side*.41,-.73,-.12),elbow=v(side*(.35-total*.035),-.54+total*.08,-.34),w=wrists[i];
      const grip=(i?weights.snack+weights.note*.96:0)+weights.phone*.8;
      const noteGrip=i===1?weights.note:0;
      arm.pose(shoulder,elbow,w,phoneVisible?{curl:.90,rx:-.08,ry:-side*.14,rz:-side*.14}:{curl:clamp(grip,.12,1),rx:-.28+weights.phone*.20+(i===0?weights.snack*.75:0)+noteGrip*.08,ry:-side*weights.phone*.22+noteGrip*.78,rz:-side*(.13+weights.phone*.08)-noteGrip*.05});
    });
    props.snack.visible=weights.snack>.015;props.snack.position.copy(wrists[1]).add(v(.004,.060,-.025));props.snack.rotation.set(-.12,.12,-.12+fidget*5);
    props.book.visible=weights.snack>.015;props.book.position.copy(wrists[0]).add(v(.015,-.015,-.035));props.book.rotation.set(-.48,.1,.05);
    props.note.visible=weights.note>.015;
    // The paper's right edge is captured between the turned thumb and fingers.
    const noteHand=arms[1].hand.group;noteHand.updateMatrix();
    props.note.position.set(-.066,.074,-.027).applyMatrix4(noteHand.matrix);
    props.note.quaternion.copy(noteHand.quaternion);props.note.rotateZ(-.08-p*.10);
    props.phone.visible=phoneVisible;props.phone.position.copy(wrists[0]).add(wrists[1]).multiplyScalar(.5).add(v(0,.074,-.032));props.phone.rotation.set(-.03+fidget,.025*Math.sin(time*.7),fidget);
    // When released, both forearms and the held object lower smoothly together.
    group.position.y=.18;
  }
  update(0);return{group,update};
}
