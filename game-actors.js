import * as THREE from './vendor/three.module.js';

// Independent gameplay actors. Teacher coordinates: ground y=0, front +Z.
// First-person hands use camera coordinates: the scene is in front at -Z.
const materials=new Map();
const mat=(name,color,roughness=.72,metalness=0)=>{
  if(!materials.has(name))materials.set(name,new THREE.MeshStandardMaterial({color,roughness,metalness}));
  return materials.get(name);
};
const skin=mat('skin','#edb08c'),skinShade=mat('skinShade','#cd8a6e'),shirt=mat('shirt','#d4e4da',.88);
const adultSkin=mat('teacherSkin','#f2bc70',.78),adultShade=mat('teacherSkinShade','#d69a56',.85),collar=mat('poloCollar','#292d29',.9);
const clothBlue=mat('schoolBlue','#286ac6'),cuffMat=mat('cuff','#f6f5e9'),pants=mat('pants','#43352f',.94);
const hair=mat('teacherHair','#191b1c',.82),black=mat('black','#20201f',.84),pupil=mat('pupil','#161a21',.3);
const sole=mat('sole','#3c3c42'),eyeWhite=mat('eyes','#fff8e9',.4),lip=mat('lip','#70493e');
const button=mat('button','#c8d6cd',.65),belt=mat('belt','#403b37');
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

// One skin/fabric surface spans the joint instead of two capped tubes and a ball.
function sweptLimb(parent,material,radii){
  const rows=24,cols=18,positions=new Float32Array((rows+1)*(cols+1)*3),indices=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
  const surface=mesh(parent,geometry,material),points=[v(0,0,0),v(0,-.2,0),v(0,-.4,0)],path=new THREE.CatmullRomCurve3(points,false,'centripetal');
  const center=v(0,0,0),tangent=v(0,0,0),normal=v(0,0,0),binormal=v(0,0,0),guide=v(0,0,1);
  function set(a,b,c){
    points[0].copy(a);points[1].copy(b);points[2].copy(c);
    for(let j=0;j<=rows;j++){
      const t=clamp((j-1)/(rows-2),0,1),half=t<.5?0:1,u=THREE.MathUtils.smoothstep(t<.5?t*2:(t-.5)*2,0,1);
      const radius=THREE.MathUtils.lerp(radii[half],radii[half+1],u)*(j===0||j===rows?0:1);
      path.getPoint(t,center);path.getTangent(t,tangent);guide.set(0,0,1);if(Math.abs(tangent.z)>.96)guide.set(1,0,0);
      normal.crossVectors(tangent,guide).normalize();binormal.crossVectors(tangent,normal).normalize();
      for(let i=0;i<=cols;i++){
        const theta=i/cols*Math.PI*2,n=Math.cos(theta)*radius,bn=Math.sin(theta)*radius*.93,o=(j*(cols+1)+i)*3;
        positions[o]=center.x+normal.x*n+binormal.x*bn;positions[o+1]=center.y+normal.y*n+binormal.y*bn;positions[o+2]=center.z+normal.z*n+binormal.z*bn;
      }
    }
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
  }
  return{mesh:surface,set};
}

// Broad palm and continuously bent digits: no separate spherical knuckles.
function articulatedHand(side,scale=1,palmSign=1,handMaterial=skin){
  const group=new THREE.Group(),palm=new THREE.Group();group.add(palm);group.scale.setScalar(scale);
  mesh(palm,loft([[-.032,.023,.019],[-.018,.031,.023],[.008,.042,.025],[.034,.046,.025],[.052,.043,.021],[.062,.035,.014],[.068,0,0]],24,.66),handMaterial);
  function digit(x,y,z,length,radius,thumb=false){
    const rows=12,cols=12,g=new THREE.BufferGeometry(),positions=new Float32Array((rows+1)*(cols+1)*3),indices=[];
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);}
    g.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));g.setIndex(indices);
    const m=mesh(group,g,handMaterial,[x,y,z]);if(thumb)m.rotation.z=side*.72;
    let previous=-1;
    function bend(c){
      if(Math.abs(previous-c)<.0001)return;previous=c;
      let cy=0,cz=0;
      for(let j=0;j<=rows;j++){
        const t=j/rows,angle=palmSign*((thumb?.12:.09)+c*(thumb?1.55:1.95)*Math.pow(t,.84));
        if(j){cy+=Math.cos(angle)*length/rows;cz+=Math.sin(angle)*length/rows;}
        const tip=t>.76?Math.sqrt(Math.max(.001,1-((t-.76)/.24)**2)):1;
        const r=radius*(1-.18*t)*tip;
        for(let i=0;i<=cols;i++){const a=i/cols*Math.PI*2,o=(j*(cols+1)+i)*3;positions[o]=Math.sin(a)*r;positions[o+1]=cy-Math.cos(a)*Math.sin(angle)*r;positions[o+2]=cz+Math.cos(a)*Math.cos(angle)*r;}
      }
      g.attributes.position.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
    }
    return{bend};
  }
  const fingers=[];for(let i=0;i<4;i++){const n=side===1?i:3-i;fingers.push(digit((i-1.5)*.023,.051,0,[.049,.056,.052,.043][n],[.0126,.013,.0125,.0115][n]));}
  const thumb=digit(-side*.034,.005,.009*palmSign,.062,.016,true);let curl=.15;
  function setCurl(amount){curl=clamp(amount,0,1);fingers.forEach((f,i)=>f.bend(curl*(.96+i*.025)));thumb.bend(curl*.86);}
  function pointIndex(amount=1){fingers[side===1?0:3].bend(curl*(1-clamp(amount,0,1)));}
  setCurl(.15);return{group,setCurl,pointIndex};
}
function makeArm(parent,{material=shirt,radius=.065,school=false,shortSleeve=false,side=1,handScale=.92,palmSign=1,handMaterial=skin}={}){
  const group=new THREE.Group();parent.add(group);
  const limbMaterial=shortSleeve?handMaterial:material;
  const upper=segment(group,limbMaterial,radius*(shortSleeve?.76:1)),lower=segment(group,limbMaterial,radius*(shortSleeve?.67:.85));
  const elbow=oval(group,limbMaterial,[0,0,0],[radius*(shortSleeve?.72:.91),radius*(shortSleeve?.72:.91),radius*(shortSleeve?.72:.91)]);
  const cuff=mesh(group,loft([[-.012,.041,.041],[.012,.041,.041]],16),shortSleeve?handMaterial:material);
  const continuous=shortSleeve?sweptLimb(group,handMaterial,[radius*.76,radius*.72,radius*.60]):null;
  if(continuous){upper.mesh.visible=false;lower.mesh.visible=false;elbow.visible=false;cuff.visible=false;}
  const hand=articulatedHand(side,handScale,palmSign,handMaterial);group.add(hand.group);
  const sleeve=shortSleeve?mesh(group,loft([[-.5,.063,.063],[.18,.077,.077],[.5,.069,.069]],20),material):null;
  const upperPanel=school?segment(group,cuffMat,radius*1.015):null;
  function pose(a,b,c,{curl=.15,rx=0,ry=0,rz=0}={}){
    upper.set(a,b);lower.set(b,c);elbow.position.copy(b);cuff.position.copy(b).lerp(c,.93);cuff.quaternion.setFromUnitVectors(axisY,tmpB.copy(c).sub(b).normalize());hand.group.position.copy(c);hand.group.rotation.set(rx,ry,rz);hand.setCurl(curl);
    if(continuous)continuous.set(a,b,c);
    if(sleeve){const end=a.clone().lerp(b,.48);sleeve.position.copy(a).add(end).multiplyScalar(.5);sleeve.scale.y=a.distanceTo(end);sleeve.quaternion.setFromUnitVectors(axisY,tmpB.copy(a).sub(end).normalize());}
    if(upperPanel)upperPanel.set(a.clone().lerp(b,.04),a.clone().lerp(b,.56));
  }
  return{group,pose,hand};
}

// The jaw, cheeks and forehead are one softly squared surface.
const teacherFace=loft([[-.253,0,0],[-.242,.083,.079],[-.217,.143,.119],[-.164,.177,.143],[-.065,.192,.155],[.055,.188,.151],[.158,.178,.140],[.224,.141,.113],[.247,.058,.047],[.25,0,0]],40,.64);
function teacherHairGeometry(){
  // A continuous crew cut with a shallow jagged crown and a shaped hairline.
  const p=[],idx=[],rows=18,cols=60;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const a=i/cols*Math.PI*2,front=Math.max(0,Math.cos(a)),t=j/rows;
    const edge=-.105+.265*front**4,peak=.286+.024*Math.cos(a*11)+.013*Math.cos(a*19);
    const y=THREE.MathUtils.lerp(edge,peak,t),rx=.196*(1-.14*t),rz=.162*(1-.14*t);
    const hairline=.011*Math.cos(a*13)*front**5*(1-t)**5;
    p.push(Math.sign(Math.sin(a))*Math.abs(Math.sin(a))**.65*rx,y+hairline,Math.sign(Math.cos(a))*Math.abs(Math.cos(a))**.65*rz-.010);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;idx.push(a,a+1,b,a+1,b+1,b);}
  const top=p.length/3;p.push(0,.29,-.01);for(let i=0;i<cols;i++)idx.push(rows*(cols+1)+i,rows*(cols+1)+i+1,top);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
const teacherCap=teacherHairGeometry();
const shirtGeometry=loft([[-.018,.174,.112],[.025,.197,.119],[.15,.198,.123],[.34,.213,.126],[.48,.249,.124],[.535,.22,.108],[.57,.105,.074]],32,.68);
function facePatch(parent,material,outline,z){
  const shape=new THREE.Shape();outline(shape);return mesh(parent,new THREE.ShapeGeometry(shape,18),material,[0,0,z]);
}
function createAdultHead(){
  const group=new THREE.Group(),fixed=new THREE.Group();group.add(fixed);mesh(fixed,teacherFace,adultSkin);mesh(fixed,teacherCap,hair);
  for(const side of [-1,1]){
    oval(fixed,adultSkin,[side*.190,-.035,-.002],[.039,.057,.027]);
    curve(fixed,adultShade,[[side*.208,-.063,.019],[side*.219,-.022,.022],[side*.204,-.002,.021]],.003);
  }
  // Broad grin and protruding white eyes are the teacher's defining silhouette.
  facePatch(fixed,mat('teacherMouth','#452620',.9),s=>{s.moveTo(-.129,-.080);s.quadraticCurveTo(0,-.130,.129,-.080);s.quadraticCurveTo(.109,-.180,0,-.188);s.quadraticCurveTo(-.109,-.180,-.129,-.080);},.158);
  facePatch(fixed,eyeWhite,s=>{s.moveTo(-.119,-.092);s.quadraticCurveTo(0,-.137,.119,-.092);s.lineTo(.101,-.130);s.quadraticCurveTo(0,-.166,-.101,-.130);s.closePath();},.160);
  facePatch(fixed,mat('teacherTongue','#c46b60',.88),s=>{s.moveTo(-.049,-.175);s.quadraticCurveTo(0,-.155,.048,-.175);s.quadraticCurveTo(0,-.187,-.049,-.175);},.161);
  oval(fixed,adultSkin,[0,-.020,.165],[.026,.035,.028]);
  const eyes=[];
  for(const side of [-1,1]){
    const eye=new THREE.Group();eye.position.set(side*.080,.031,.144);group.add(eye);
    oval(eye,eyeWhite,[0,0,0],[.059,.074,.032]);oval(eye,pupil,[side*.002,-.004,.030],[.021,.034,.008]);
    oval(eye,eyeWhite,[-.006,.012,.038],[.006,.008,.002]);eyes.push(eye);
    curve(fixed,hair,[[side*.043,.128,.146],[side*.076,.139,.149],[side*.111,.131,.140]],.0065);
  }
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
  mesh(fixed,loft([[-.016,.182,.111],[.016,.182,.111]],24,.68),pants,[0,.989,0]);
  mesh(fixed,loft([[-.055,.054,.053],[.047,.061,.058]],24,.85),adultSkin,[0,1.605,0]);
  mesh(fixed,loft([[-.014,.076,.069],[.014,.073,.068]],24,.8),collar,[0,1.568,0]);
  for(const side of [-1,1]){
    const s=new THREE.Shape();s.moveTo(side*.012,.034);s.lineTo(side*.049,.052);s.lineTo(side*.111,-.012);s.lineTo(side*.060,-.051);s.closePath();
    mesh(fixed,new THREE.ExtrudeGeometry(s,{depth:.012,bevelEnabled:true,bevelSize:.003,bevelThickness:.002,bevelSegments:2}),shirt,[0,1.535,.071]);
    curve(fixed,collar,[[side*.013,1.569,.092],[side*.06,1.588,.080],[side*.108,1.526,.088]],.0045);
  }
  mesh(fixed,rounded(.029,.112,.006,.005),collar,[0,1.497,.124]);
  for(let i=0;i<2;i++)oval(fixed,button,[0,1.473+i*.036,.130],[.004,.004,.002]);
  mesh(fixed,rounded(.074,.077,.006,.007),shirt,[.112,1.388,.123],[1,1,1],[0,-.08,0]);
  curve(fixed,mat('poloPocketSeam','#a8beb3',.94),[[.075,1.428,.128],[.149,1.428,.121]],.0013);
  batch(fixed);
  const adultHead=createAdultHead();adultHead.group.position.y=1.81;body.add(adultHead.group);
  const arms=[makeArm(body,{side:-1,shortSleeve:true,handMaterial:adultSkin,handScale:1.18}),makeArm(body,{side:1,shortSleeve:true,handMaterial:adultSkin,handScale:1.18})];
  const legs=[];
  for(const side of [-1,1]){
    const upper=segment(group,pants,.098),lower=segment(group,pants,.080),knee=oval(group,pants,[0,.52,0],[.078,.079,.074]),ankleSkin=segment(group,adultSkin,.047),foot=shoeMesh(group,side*.115);
    const fabric=sweptLimb(group,pants,[.098,.080,.073]);upper.mesh.visible=false;lower.mesh.visible=false;knee.visible=false;
    legs.push({side,upper,lower,knee,ankleSkin,foot,fabric});
  }
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
      l.upper.set(hip,knee);const trouserEnd=ankle.clone().add(v(0,.059,0));l.lower.set(knee,trouserEnd);l.fabric.set(hip,knee,trouserEnd);l.ankleSkin.set(ankle.clone().add(v(0,-.015,0)),trouserEnd);l.knee.position.copy(knee);l.foot.position.set(ankle.x,footLift,ankle.z);l.foot.rotation.x=-Math.max(0,Math.cos(t))*.13*walk;
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
  const arms=[makeArm(group,{material:deskBlue,radius:.058,school:true,side:-1,handScale:1.02,palmSign:-1}),makeArm(group,{material:deskBlue,radius:.058,school:true,side:1,handScale:1.02,palmSign:-1})];
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
