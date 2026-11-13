import {requireModelBudget} from './model-budget64.js';
import {isHandAnimationPose} from './hand-animation-data59.js?v=campus-75';
import {createSchoolPen,SCHOOL_PEN,penTwirlQuaternion} from './pen-motion.js?v=campus-75';
import {createHandSupport} from './hand-support55.js?v=campus-75';
import * as THREE from './vendor/three.module.js';
import {CRAWL_TUNING} from './crawl-profile.js?v=campus-75';
import {clonePropAsset,propContact} from './prop-assets.js?v=campus-75';
import {createFirstPersonHandMotion,sampleFoodGesture,fitFirstPersonSurface,firstPersonBookContacts} from './first-person-hand-motion.js?v=campus-75';
import {createWholePalmGrip} from './whole-palm-grip.js?v=campus-75';
export {loadPropAssets} from './prop-assets.js?v=campus-75';

// Independent gameplay actors. Teacher coordinates: ground y=0, front +Z.
// First-person hands use camera coordinates: the scene is in front at -Z.
const materials=new Map();
const mat=(name,color,roughness=.72,metalness=0)=>{
  if(!materials.has(name))materials.set(name,new THREE.MeshStandardMaterial({color,roughness,metalness}));
  return materials.get(name);
};
const skin=mat('skin','#edb08c'),skinShade=mat('skinShade','#cd8a6e'),shirt=mat('shirt','#e0d7b7',.88);
const adultSkin=mat('teacherSkin','#f2bd62',.78),adultShade=mat('teacherSkinShade','#d69a56',.85),collar=mat('poloCollar','#292d29',.9);
const clothBlue=mat('schoolBlue','#286ac6'),cuffMat=mat('cuff','#f6f5e9'),pants=mat('pants','#43352f',.94);
const hair=mat('teacherHair','#191b1c',.82),black=mat('black','#20201f',.84),pupil=mat('pupil','#161a21',.3);
const sole=mat('sole','#3c3c42'),eyeWhite=mat('eyes','#fff8e9',.4),lip=mat('lip','#70493e');
const button=mat('button','#c8d6cd',.65),belt=mat('belt','#403b37');
const sphere=new THREE.SphereGeometry(1,32,24),box=new THREE.BoxGeometry(1,1,1),axisY=new THREE.Vector3(0,1,0);
const tmpA=new THREE.Vector3(),tmpB=new THREE.Vector3();
function mesh(parent,geo,material,p=[0,0,0],s=[1,1,1],r=null){const m=new THREE.Mesh(geo,material);m.position.set(...p);m.scale.set(...s);if(r)m.rotation.set(...r);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const oval=(parent,material,p,s,r=null)=>mesh(parent,sphere,material,p,s,r);
// Millimetre-sized rice, sesame and phone controls keep their authored positions
// and dimensions without carrying the same tessellation as a character cheek.
const propDetailSphere=new THREE.SphereGeometry(1,12,8);
const detailOval=(parent,material,p,s,r=null)=>mesh(parent,propDetailSphere,material,p,s,r);
const cube=(parent,material,p,s,r=null)=>mesh(parent,box,material,p,s,r);
function curve(parent,material,points,r=.004){return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(8,points.length*4),r,6,false),material);}
function shapeRect(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
function rounded(w,h,d,r=.02){const g=new THREE.ExtrudeGeometry(shapeRect(w,h,r),{depth:d,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,bevelSegments:2,curveSegments:8});g.translate(0,0,-d/2);return g;}
function smoothRingSeam(g,segments){const n=g.attributes.normal;for(let a=0;a<n.count;a+=segments+1){const b=a+segments,x=n.getX(a)+n.getX(b),y=n.getY(a)+n.getY(b),z=n.getZ(a)+n.getZ(b),length=Math.hypot(x,y,z)||1;n.setXYZ(a,x/length,y/length,z/length);n.setXYZ(b,x/length,y/length,z/length);}n.needsUpdate=true;}
function loft(rings,segments=24,exponent=.8){const vertices=[],indices=[];for(const r of rings)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,s=Math.sin(a),c=Math.cos(a);vertices.push(Math.sign(s)*Math.abs(s)**exponent*r[1],r[0],Math.sign(c)*Math.abs(c)**exponent*r[2]+(r[3]||0));}for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();smoothRingSeam(g,segments);return g;}
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
  function set(a,b,c,d=null){
    points[0].copy(a);points[1].copy(b);points[2].copy(c);if(d){if(!points[3])points[3]=d.clone();else points[3].copy(d);}else points.length=3;
    for(let j=0;j<=rows;j++){
      const t=clamp((j-1)/(rows-2),0,1),part=t*(radii.length-1),half=Math.min(radii.length-2,Math.floor(part)),u=THREE.MathUtils.smoothstep(part-half,0,1);
      const radius=THREE.MathUtils.lerp(radii[half],radii[half+1],u)*(j===0||j===rows?0:1);
      path.getPoint(t,center);path.getTangent(t,tangent);guide.set(0,0,1);if(Math.abs(tangent.z)>.96)guide.set(1,0,0);
      normal.crossVectors(tangent,guide).normalize();binormal.crossVectors(tangent,normal).normalize();
      for(let i=0;i<=cols;i++){
        const theta=i/cols*Math.PI*2,n=Math.cos(theta)*radius,bn=Math.sin(theta)*radius*.93,o=(j*(cols+1)+i)*3;
        positions[o]=center.x+normal.x*n+binormal.x*bn;positions[o+1]=center.y+normal.y*n+binormal.y*bn;positions[o+2]=center.z+normal.z*n+binormal.z*bn;
      }
    }
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();smoothRingSeam(geometry,cols);geometry.computeBoundingSphere();
  }
  return{mesh:surface,set};
}

// Interpolated profiles remove the straight ring-to-ring facets at the heel.
function softLoft(profile,segments=32,exponent=.9){
  const path=new THREE.CatmullRomCurve3(profile.map(r=>v(r[1],r[0],r[2])),false,'centripetal');
  const rings=[];for(let i=0;i<=72;i++){const p=path.getPoint(i/72);rings.push([p.y,Math.max(0,p.x),Math.max(0,p.z)]);}
  return loft(rings,segments,exponent);
}
// Broad palm and continuously bent digits: no separate spherical knuckles.
function articulatedHand(side,scale=1,palmSign=1,handMaterial=skin){
  const group=new THREE.Group(),palm=new THREE.Group();group.add(palm);group.scale.setScalar(scale);
  // The proximal cap sits inside the wrist bridge; no exposed cut-open ring.
  const palmGeometry=softLoft([[-.038,0,0],[-.031,.016,.015],[-.022,.026,.022],[-.009,.033,.025],[.008,.040,.026],[.029,.044,.025],[.043,.043,.021],[.054,.035,.013],[.059,0,0]],32,.91);
  const palmPositions=palmGeometry.attributes.position;
  for(let i=0;i<palmPositions.count;i++){const x=palmPositions.getX(i),y=palmPositions.getY(i),weight=Math.max(0,Math.sin(clamp((y+.015)/.070,0,1)*Math.PI))*clamp(-side*x/.040,0,1);palmPositions.setX(i,x-side*.005*weight);palmPositions.setZ(i,palmPositions.getZ(i)*(1+.15*weight));}
  palmGeometry.computeVertexNormals();smoothRingSeam(palmGeometry,32);mesh(palm,palmGeometry,handMaterial);
  function digit(x,y,z,length,radius,thumb=false){
    const rows=20,cols=14,g=new THREE.BufferGeometry(),positions=new Float32Array((rows+1)*(cols+1)*3),indices=[];
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);}
    g.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));g.setIndex(indices);
    const m=mesh(group,g,handMaterial,[x,y,z]);m.name=thumb?'thumb':'finger';if(thumb)m.rotation.z=side*.72;
    let previous=-1;
    function bend(c){
      if(Math.abs(previous-c)<.0001)return;previous=c;
      let cy=0,cz=0;
      for(let j=0;j<=rows;j++){
        const t=j/rows,angle=palmSign*(thumb?(.08+c*.22+c*1.65*Math.pow(t,.85)):(.10+c*.50+c*2.5*Math.pow(t,.78)));
        if(j){cy+=Math.cos(angle)*length/rows;cz+=Math.sin(angle)*length/rows;}
        const tip=t>.76?Math.sqrt(Math.max(0,1-((t-.76)/.24)**2)):1;
        const r=radius*(1-.18*t)*tip;
        for(let i=0;i<=cols;i++){const a=i/cols*Math.PI*2,o=(j*(cols+1)+i)*3;positions[o]=Math.sin(a)*r;positions[o+1]=cy-Math.cos(a)*Math.sin(angle)*r;positions[o+2]=cz+Math.cos(a)*Math.cos(angle)*r;}
      }
      g.attributes.position.needsUpdate=true;g.computeVertexNormals();smoothRingSeam(g,cols);g.computeBoundingSphere();
    }
    function localTip(c){const end=v(0,0,0);for(let j=1;j<=rows;j++){const t=j/rows,angle=palmSign*(thumb?(.08+c*.22+c*1.65*Math.pow(t,.85)):(.10+c*.50+c*2.5*Math.pow(t,.78)));end.y+=Math.cos(angle)*length/rows;end.z+=Math.sin(angle)*length/rows;}return end;}
    function tip(){m.updateMatrix();return localTip(previous).applyMatrix4(m.matrix);}
    return{bend,mesh:m,tip,localTip};
  }
  const fingers=[];for(let i=0;i<3;i++){const n=side===1?i:2-i;fingers.push(digit((i-1)*.027,.045,0,[.049,.056,.043][n],[.014,.015,.0135][n]));}
  const thumb=digit(-side*.030,.003,.006*palmSign,.049,.0145,true);let curl=.15;
  function setCurl(amount){curl=clamp(amount,0,1);fingers.forEach((f,i)=>f.bend(curl*(.96+i*.025)));thumb.bend(curl*.86);}
  function pointIndex(amount=1){fingers[side===1?0:2].bend(curl*(1-clamp(amount,0,1)));}
  function aimThumb(target,amount=1){
    const a=clamp(amount,0,1),delta=target.clone().sub(thumb.mesh.position),distance=delta.length();
    // Solve bend, then orient the thumb. The finger keeps its length and girth;
    // a close target bends the joints instead of shrinking the whole digit.
    let low=0,high=1.2;for(let i=0;i<12;i++){const mid=(low+high)/2;if(thumb.localTip(mid).length()>distance)low=mid;else high=mid;}
    const bent=THREE.MathUtils.lerp(curl*.86,(low+high)/2,a);thumb.bend(bent);
    const rest=new THREE.Quaternion().setFromAxisAngle(v(0,0,1),side*.55),end=thumb.localTip(bent).applyQuaternion(rest);
    const q=new THREE.Quaternion().setFromUnitVectors(end.normalize(),delta.normalize()).multiply(rest);
    thumb.mesh.quaternion.copy(rest).slerp(q,a);thumb.mesh.scale.setScalar(1);
  }
  function indexTip(){return fingers[side===1?0:2].tip();}
  function opposeThumb(amount=1,kind='snack'){const target=kind==='phone'&&side>0?v(0,.045,-.010):indexTip().add(v(side*.012,-.010,.018));aimThumb(target,amount);}
  setCurl(.15);return{group,setCurl,pointIndex,opposeThumb,aimThumb,indexTip,thumbTip:()=>thumb.tip()};
}
function makeArm(parent,{material=shirt,radius=.065,school=false,shortSleeve=false,side=1,handScale=.92,palmSign=1,handMaterial=skin}={}){
  const group=new THREE.Group();parent.add(group);
  const limbMaterial=shortSleeve?handMaterial:material;
  const upper=segment(group,limbMaterial,radius*(shortSleeve?.76:1)),lower=segment(group,limbMaterial,radius*(shortSleeve?.67:.85));
  const elbow=oval(group,limbMaterial,[0,0,0],[radius*(shortSleeve?.72:.91),radius*(shortSleeve?.72:.91),radius*(shortSleeve?.72:.91)]);
  const cuff=mesh(group,loft([[-.012,.041,.041],[.012,.041,.041]],16),shortSleeve?handMaterial:material);
  const sleeveSurface=school?mat('firstPersonSleeve','#ffffff',.88):limbMaterial;if(school)sleeveSurface.vertexColors=true;
  const continuous=(shortSleeve||school)?sweptLimb(group,sleeveSurface,shortSleeve?[radius*.76,radius*.72,radius*.60,.023*handScale]:[radius,radius*.90,radius*.68]):null;
  if(continuous){upper.mesh.visible=false;lower.mesh.visible=false;elbow.visible=false;cuff.visible=false;}
  if(school){const colors=[],blue=new THREE.Color('#2473d1'),band=new THREE.Color('#1c60b5');for(let j=0;j<=24;j++)for(let i=0;i<=18;i++){const c=j>=22?band:blue;colors.push(c.r,c.g,c.b);}continuous.mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));}
  const hand=articulatedHand(side,handScale,palmSign,handMaterial);group.add(hand.group);
  const wristBridge=sweptLimb(group,handMaterial,[shortSleeve?radius*.64:.032,.029*handScale,.023*handScale]);
  wristBridge.mesh.visible=!shortSleeve;
  const sleeve=shortSleeve?sweptLimb(group,material,[.077,.076,.063]):null;
  const upperPanel=null;
  function pose(a,b,c,{curl=.15,rx=0,ry=0,rz=0}={}){
    upper.set(a,b);lower.set(b,c);elbow.position.copy(b);cuff.position.copy(b).lerp(c,.93);cuff.quaternion.setFromUnitVectors(axisY,tmpB.copy(c).sub(b).normalize());hand.group.position.copy(c);hand.group.rotation.set(rx,ry,rz);hand.setCurl(curl);
    const forearm=c.clone().sub(b).normalize(),handAxis=axisY.clone().applyQuaternion(hand.group.quaternion);
    const cuffEnd=c.clone().addScaledVector(forearm,-.033),palmRoot=c.clone().addScaledVector(handAxis,-.012*handScale);
    if(continuous){if(shortSleeve)continuous.set(a,b,cuffEnd,palmRoot);else continuous.set(a,b,cuffEnd);}
    cuff.position.copy(c).addScaledVector(forearm,-.027);cuff.scale.setScalar(.93);
    wristBridge.set(cuffEnd.clone().addScaledVector(forearm,-.008),c.clone().addScaledVector(forearm,-.012).addScaledVector(handAxis,-.012),palmRoot);
    if(sleeve){const root=a.clone().add(v(-side*.060,-.025,0)),end=a.clone().lerp(b,.48);sleeve.set(root,a,end);}
    if(upperPanel)upperPanel.set(a.clone().lerp(b,.04),a.clone().lerp(b,.56));
  }
  return{group,pose,hand};
}

// One continuous cheek/jaw surface; features follow its curvature in profile.
const teacherProfile=[[-.263,0,0],[-.253,.085,.074],[-.226,.155,.117],[-.185,.198,.149],[-.090,.226,.168],[.045,.225,.169],[.160,.212,.156],[.225,.167,.122],[.255,.075,.055],[.260,0,0]];
const teacherCurve=new THREE.CatmullRomCurve3(teacherProfile.map(r=>v(r[1],r[0],r[2])),false,'centripetal');
const teacherRings=Array.from({length:97},(_,i)=>{const p=teacherCurve.getPoint(i/96);return[p.y,Math.max(0,p.x),Math.max(0,p.z)];});
const teacherFace=loft(teacherRings,64,.72);
function teacherFront(x,y,offset=0){
  let r=teacherRings[1];for(let i=1;i<teacherRings.length;i++)if(y<=teacherRings[i][0]){const a=teacherRings[i-1],b=teacherRings[i],t=clamp((y-a[0])/(b[0]-a[0]),0,1);r=[y,THREE.MathUtils.lerp(a[1],b[1],t),THREE.MathUtils.lerp(a[2],b[2],t)];break;}
  return r[2]*Math.max(0,1-(Math.abs(x)/Math.max(.001,r[1]))**(2/.72))**(.72/2)+offset;
}
function teacherHairGeometry(){
  const p=[],idx=[],rows=36,cols=112;
  const profile=[[.04,.232,.177],[.16,.223,.170],[.225,.191,.147],[.260,.181,.138],[.279,.163,.125],[.290,.110,.084],[.293,0,0]];
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const a=i/cols*Math.PI*2,front=Math.max(0,Math.cos(a)),t=j/rows;
    const zig=1-Math.abs((a*14/Math.PI)%2-1),edge=.060+.119*THREE.MathUtils.smoothstep(front,.20,.60)+.020*zig*THREE.MathUtils.smoothstep(front,.30,.65),y=THREE.MathUtils.lerp(edge,.293,t);
    let rx=0,rz=0;for(let k=1;k<profile.length;k++)if(y<=profile[k][0]){const l=profile[k-1],r=profile[k],u=clamp((y-l[0])/(r[0]-l[0]),0,1);rx=THREE.MathUtils.lerp(l[1],r[1],u);rz=THREE.MathUtils.lerp(l[2],r[2],u);break;}
    p.push(Math.sign(Math.sin(a))*Math.abs(Math.sin(a))**.72*rx,y,Math.sign(Math.cos(a))*Math.abs(Math.cos(a))**.72*rz-.001);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;idx.push(a,a+1,b,a+1,b+1,b);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();smoothRingSeam(g,cols);return g;
}
const teacherCap=teacherHairGeometry();
// The reference has a belly that is wider than the chest, a narrow neck, and
// long thin limbs. Detail is added to that silhouette, not a straight tunic.
const shirtGeometry=softLoft([[-.024,0,0],[-.023,.238,.154],[-.008,.266,.172],[.045,.278,.180],[.150,.264,.171],[.310,.232,.145],[.440,.225,.128],[.505,.239,.119],[.545,.180,.096],[.576,.076,.060]],40,.80);
function facePatch(parent,material,outline,offset=.006){
  const shape=new THREE.Shape();outline(shape);
  // Densify the triangulation so the smile wraps the cheeks instead of a
  // flat cardboard patch intersecting the head when viewed from the side.
  let geometry=new THREE.ShapeGeometry(shape,32).toNonIndexed();
  for(let pass=0;pass<3;pass++){
    const p=geometry.attributes.position,out=[];
    for(let i=0;i<p.count;i+=3){const a=v(p.getX(i),p.getY(i),0),b=v(p.getX(i+1),p.getY(i+1),0),c=v(p.getX(i+2),p.getY(i+2),0),ab=a.clone().lerp(b,.5),bc=b.clone().lerp(c,.5),ca=c.clone().lerp(a,.5);for(const point of [a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca])out.push(point.x,point.y,0);}
    geometry.dispose();geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(out,3));
  }
  const positions=geometry.attributes.position;for(let i=0;i<positions.count;i++)positions.setZ(i,teacherFront(positions.getX(i),positions.getY(i),offset));const normals=[];for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),h=.0001,dx=(teacherFront(x+h,y)-teacherFront(x-h,y))/(2*h),dy=(teacherFront(x,y+h)-teacherFront(x,y-h))/(2*h),n=v(-dx,-dy,1).normalize();normals.push(n.x,n.y,n.z);}geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));const m=mesh(parent,geometry,material);m.castShadow=false;return m;
}
function faceLine(parent,material,points,radius=.002,offset=.009){return curve(parent,material,points.map(([x,y])=>[x,y,teacherFront(x,y,offset)]),radius);}
function createAdultHead(){
  const group=new THREE.Group(),fixed=new THREE.Group();group.add(fixed);mesh(fixed,teacherFace,adultSkin);mesh(fixed,teacherCap,hair);
  for(const side of [-1,1]){
    oval(fixed,adultSkin,[side*.223,-.020,-.004],[.036,.056,.028]);
    curve(fixed,adultShade,[[side*.238,-.049,.018],[side*.249,-.010,.023],[side*.234,.017,.021]],.003);
  }
  const mouth=mat('teacherMouth','#4e241b',.88),tooth=mat('teacherTeeth','#fff5d7',.62),seam=mat('teacherToothSeam','#c5b494',.84);
  facePatch(fixed,mouth,s=>{s.moveTo(-.183,-.092);s.quadraticCurveTo(0,-.119,.183,-.092);s.quadraticCurveTo(.167,-.202,0,-.218);s.quadraticCurveTo(-.167,-.202,-.183,-.092);},.006);
  facePatch(fixed,tooth,s=>{s.moveTo(-.171,-.105);s.quadraticCurveTo(0,-.131,.171,-.105);s.quadraticCurveTo(.146,-.194,0,-.203);s.quadraticCurveTo(-.146,-.194,-.171,-.105);},.009);
  faceLine(fixed,seam,[[-.161,-.145],[-.117,-.160],[0,-.170],[.117,-.160],[.161,-.145]],.0018,.012);
  for(let i=-4;i<=4;i++){const x=i*.033,top=-.118+.013*(x/.17)**2,bottom=-.199+.031*(x/.17)**2;faceLine(fixed,seam,[[x,top],[x*.97,(top+bottom)/2],[x*.91,bottom]],.0015,.013);}
  // Narrow jagged moustache above the grin, including the corners.
  for(const side of [-1,1]){const points=[];for(let i=0;i<17;i++){const x=side*(.020+i*.009),y=-.078+(i%2?-.009:.005)+.010*(i/16);points.push([x,y,teacherFront(x,y,.012)]);}curve(fixed,hair,points,.0024);}
  oval(fixed,adultSkin,[0,-.017,.176],[.021,.028,.023]);
  const eyes=[];
  for(const side of [-1,1]){
    const eye=new THREE.Group();eye.position.set(side*.095,.041,.158);group.add(eye);
    oval(eye,eyeWhite,[0,0,0],[.069,.094,.039]);oval(eye,pupil,[0,.002,.036],[.032,.080,.010]);eyes.push(eye);
    faceLine(fixed,hair,[[side*.053,.161],[side*.078,.167],[side*.102,.161]],.0075,.010);
  }
  batch(fixed);fixed.traverse(o=>{if(o.isMesh&&[tooth,mouth,seam].includes(o.material)){o.castShadow=false;o.receiveShadow=false;}});return{group,eyes};
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
  mesh(fixed,loft([[-.016,.182,.111],[.016,.182,.111]],24,.68),pants,[0,.975,0]);
  mesh(fixed,loft([[-.055,.054,.053],[.047,.061,.058]],24,.85),adultSkin,[0,1.605,0]);
  mesh(fixed,loft([[-.014,.076,.069],[.014,.073,.068]],24,.8),collar,[0,1.568,0]);
  for(const side of [-1,1]){
    const s=new THREE.Shape();s.moveTo(side*.012,.034);s.lineTo(side*.049,.052);s.lineTo(side*.111,-.012);s.lineTo(side*.060,-.051);s.closePath();
    mesh(fixed,new THREE.ExtrudeGeometry(s,{depth:.012,bevelEnabled:true,bevelSize:.003,bevelThickness:.002,bevelSegments:2}),collar,[0,1.535,.071]);
    curve(fixed,collar,[[side*.013,1.569,.092],[side*.06,1.588,.080],[side*.108,1.526,.088]],.0045);
  }
  mesh(fixed,rounded(.034,.148,.006,.005),collar,[0,1.479,.139]);
  for(let i=0;i<2;i++)oval(fixed,button,[0,1.452+i*.036,.146],[.004,.004,.002]);
  mesh(fixed,rounded(.074,.077,.006,.007),shirt,[.121,1.362,.128],[1,1,1],[0,-.08,0]);
  curve(fixed,mat('poloPocketSeam','#c7bea2',.94),[[.084,1.401,.139],[.158,1.401,.132]],.0013);
  mesh(fixed,rounded(.009,.045,.006,.002),collar,[.105,1.415,.139]);
  batch(fixed);
  const adultHead=createAdultHead();adultHead.group.position.y=1.835;body.add(adultHead.group);
  const arms=[makeArm(body,{side:-1,shortSleeve:true,handMaterial:adultSkin,handScale:1.18}),makeArm(body,{side:1,shortSleeve:true,handMaterial:adultSkin,handScale:1.18})];
  const legs=[];
  for(const side of [-1,1]){
    const upper=segment(group,pants,.078),lower=segment(group,pants,.060),knee=oval(group,pants,[0,.52,0],[.061,.065,.060]),ankleSkin=segment(group,adultSkin,.047),foot=shoeMesh(group,side*.115);
    const fabric=sweptLimb(group,pants,[.078,.061,.054]);upper.mesh.visible=false;lower.mesh.visible=false;knee.visible=false;
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
    // Keep the long oval stare: scaling the eyeballs to blink changes their silhouette.
    legs.forEach((l,i)=>{const t=cycle+i*Math.PI,swing=Math.sin(t)*walk,footLift=Math.max(0,Math.cos(t))*.085*walk;
      const hip=v(l.side*.112,.98,0),knee=v(l.side*.118,.52+bob*.25,.04+swing*.10),ankle=v(l.side*.122,.112+footLift,swing*.20);
      l.upper.set(hip,knee);const trouserEnd=ankle.clone().add(v(0,.059,0));l.lower.set(knee,trouserEnd);l.fabric.set(hip,knee,trouserEnd);l.ankleSkin.set(ankle.clone().add(v(0,-.015,0)),trouserEnd);l.knee.position.copy(knee);l.foot.position.set(ankle.x,footLift,ankle.z);l.foot.rotation.x=-Math.max(0,Math.cos(t))*.13*walk;
    });
    arms.forEach((arm,i)=>{const side=i?1:-1,t=cycle+i*Math.PI,swing=-Math.sin(t)*walk;
      const shoulder=v(side*.238,1.485,0),elbow=v(side*.28,1.22,.02+swing*.13),wrist=v(side*.27,.995,swing*.21);
      if(i===1){elbow.lerp(v(.31,1.48,.20),write);wrist.lerp(v(.21+Math.sin(time*5.2)*.025,1.75+Math.sin(time*7.4)*.018,.39),write);}
      arm.pose(shoulder,elbow,wrist,{curl:i===1?write*.82:.16,rx:i===1?write*-.10:0,rz:(1-write*(i===1?1:0))*Math.PI});
    });
    chalk.visible=write>.15;
  }
  function gripNeck(worldPoint){
    const wrist=body.worldToLocal(worldPoint.clone()),side=wrist.x<0?-1:1,shoulder=v(side*.238,1.485,0),elbow=shoulder.clone().lerp(wrist,.48).add(v(side*.12,-.10,-.035));
    arms[side<0?0:1].pose(shoulder,elbow,wrist,{curl:.69,rx:-1.12,ry:-side*.42,rz:side*.20});chalk.visible=false;
  }
  function castChalk(progress){
    if(progress<=0)return;
    const p=clamp(progress,0,1),lift=THREE.MathUtils.smoothstep(p,0,.32),send=THREE.MathUtils.smoothstep(p,.32,.68),recover=THREE.MathUtils.smoothstep(p,.72,1);
    const shoulder=v(.238,1.485,0),restElbow=v(.28,1.22,.02),restWrist=v(.27,.995,0);
    const elbow=restElbow.clone().lerp(v(.33,1.48,.14),lift).lerp(v(.28,1.48,.33),send).lerp(restElbow,recover);
    const wrist=restWrist.clone().lerp(v(.18,1.76,.20),lift).lerp(v(.25,1.63,.58),send).lerp(restWrist,recover);
    arms[1].pose(shoulder,elbow,wrist,{curl:THREE.MathUtils.lerp(.78,.16,send*(1-recover)),rx:(-.3-send*.9)*(1-recover),ry:send*.22*(1-recover),rz:recover*Math.PI});chalk.visible=p<.68;

  }
  update(0);return{group,update,getHand:side=>arms[side==='right'?1:0].hand.group,gripNeck,castChalk};
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
function phoneProp(){
  const group=new THREE.Group();group.name='handheld-phone';
  mesh(group,rounded(.115,.208,.013,.014),mat('phoneCase','#eef0eb',.54));
  mesh(group,rounded(.097,.159,.001,.006),new THREE.MeshBasicMaterial({color:'#294a61'}),[0,.003,.011]);
  cube(group,mat('phoneSpeaker','#3b4247'),[0,.093,.010],[.022,.003,.002]);detailOval(group,black,[.026,.092,.010],[.002,.002,.001]);
  const icons=['#70a985','#df8c51','#609bc0','#d3b95d','#ad86b8','#d2e3df'].map(color=>new THREE.MeshBasicMaterial({color}));
  for(let row=0;row<4;row++)for(let col=0;col<3;col++){
    const x=(col-1)*.028,y=.057-row*.033;
    mesh(group,rounded(.019,.020,.001,.004),icons[(row*3+col)%icons.length],[x,y,.013]);
    cube(group,icons[5],[x,y-.013,.013],[.013,.001,.001]);
  }
  detailOval(group,mat('phoneHome','#b7c2c6',.4),[0,-.091,.009],[.008,.008,.001]);detailOval(group,cuffMat,[0,-.091,.010],[.006,.006,.001]);
  batch(group);return group;
}

function smokeProp(){
  const group=new THREE.Group();group.name='smoke-canister';
  const shell=mat('smokeShell','#aebbb0',.48,.25),band=mat('smokeBand','#f0d97b',.72),lid=mat('smokeLid','#4e6157',.5,.35);
  mesh(group,new THREE.CylinderGeometry(.043,.043,.155,24,1),shell);
  mesh(group,new THREE.CylinderGeometry(.044,.044,.040,24,1),band,[0,-.018,0]);
  mesh(group,new THREE.CylinderGeometry(.035,.041,.020,20,1),lid,[0,.086,0]);
  mesh(group,rounded(.020,.080,.012,.005),lid,[.026,.080,0],[1,1,1],[0,0,-.24]);
  mesh(group,new THREE.TorusGeometry(.017,.0025,8,20),lid,[-.024,.100,0]);
  batch(group);return group;
}

function flashProp(){
  const group=new THREE.Group();group.name='flash-perforated-canister';
  const metal=mat('flashBrushedSteel','#b8c2c6',.34,.82),rim=mat('flashEndCaps','#d8dedd',.27,.86),inside=mat('flashInnerBaffle','#303b40',.65,.32),lever=mat('flashLever','#59666c',.38,.75);
  // Cut real apertures in an unwrapped sleeve, then wrap it around the baffle.
  // Dark dots painted over the smoke body would not give the same silhouette.
  const radius=.043,width=2*Math.PI*radius,height=.138,sleeve=new THREE.Shape();
  sleeve.moveTo(0,-height/2);sleeve.lineTo(width,-height/2);sleeve.lineTo(width,height/2);sleeve.lineTo(0,height/2);sleeve.closePath();
  for(let row=0;row<3;row++)for(let col=0;col<8;col++){
    const hole=new THREE.Path();hole.absarc((col+.5)*width/8,(row-1)*.039,.0062,0,Math.PI*2,true);sleeve.holes.push(hole);
  }
  const shell=new THREE.ExtrudeGeometry(sleeve,{depth:.0022,bevelEnabled:false,curveSegments:8}),p=shell.attributes.position;
  for(let i=0;i<p.count;i++){const angle=p.getX(i)/radius,r=radius+p.getZ(i);p.setXYZ(i,Math.sin(angle)*r,p.getY(i),Math.cos(angle)*r);}
  shell.computeVertexNormals();mesh(group,shell,metal);
  mesh(group,new THREE.CylinderGeometry(.034,.034,.140,24),inside);
  for(const y of [-.077,.077]){
    mesh(group,new THREE.CylinderGeometry(.047,.047,.016,32),rim,[0,y,0]);
    mesh(group,new THREE.TorusGeometry(.043,.0022,6,32),lever,[0,y,0],[1,1,1],[Math.PI/2,0,0]);
  }
  mesh(group,new THREE.CylinderGeometry(.020,.026,.023,20),lever,[0,.096,0]);
  mesh(group,rounded(.019,.095,.009,.003),lever,[.035,.052,0],[1,1,1],[0,0,-.13]);
  mesh(group,new THREE.CylinderGeometry(.003,.003,.060,10),rim,[0,.107,0],[1,1,1],[0,0,Math.PI/2]);
  mesh(group,new THREE.TorusGeometry(.017,.0024,8,24),rim,[-.032,.107,0]);
  batch(group);group.userData.throwableKind='flash';return group;
}

function inkProp(){
  const group=new THREE.Group();group.name='ink-glass-bottle';
  const glass=new THREE.MeshPhysicalMaterial({color:'#365c78',roughness:.16,metalness:0,transparent:true,opacity:.47,depthWrite:false,clearcoat:.75,clearcoatRoughness:.14});
  const liquid=mat('inkLiquid','#071b30',.2),cap=mat('inkCap','#202b34',.54),paper=mat('inkPaperLabel','#ddd9c5',.84),print=mat('inkLabelPrint','#324757',.75);
  const profile=[[0,-.069],[.032,-.069],[.045,-.061],[.047,-.043],[.047,.023],[.042,.037],[.021,.055],[.020,.073],[0,.073]].map(p=>new THREE.Vector2(...p));
  mesh(group,new THREE.LatheGeometry(profile,32),glass);
  mesh(group,new THREE.LatheGeometry([[0,-.064],[.030,-.064],[.041,-.057],[.042,-.042],[.042,.019],[0,.019]].map(p=>new THREE.Vector2(...p)),32),liquid);
  mesh(group,new THREE.CylinderGeometry(.023,.023,.025,24),cap,[0,.076,0]);
  for(let i=0;i<20;i++){const a=i/20*Math.PI*2;mesh(group,new THREE.CylinderGeometry(.0012,.0012,.020,5),cap,[Math.sin(a)*.023,.077,Math.cos(a)*.023]);}
  mesh(group,rounded(.046,.041,.001,.004),paper,[0,-.009,.047]);
  // A small ink-drop mark and two print lines; no emissive or oversize label.
  oval(group,print,[0,-.007,.049],[.006,.008,.001]);
  for(const y of [-.021,.006])cube(group,print,[0,y,.049],[.027,.0012,.001]);
  batch(group);group.userData.throwableKind='ink';return group;
}

function drinkProp(){
  const group=new THREE.Group();group.name='red-drink-can';
  const red=mat('drinkRed','#db3425',.34,.38),silver=mat('drinkAluminium','#c7d2d5',.27,.82),print=mat('drinkPrint','#fff6de',.5),dark=mat('drinkOpening','#222c30',.6);
  const profile=[new THREE.Vector2(0,-.087),new THREE.Vector2(.034,-.087),new THREE.Vector2(.040,-.081),new THREE.Vector2(.044,-.067),new THREE.Vector2(.044,.060),new THREE.Vector2(.039,.077),new THREE.Vector2(.039,.082),new THREE.Vector2(0,.082)];
  mesh(group,new THREE.LatheGeometry(profile,32),red);
  for(const y of [-.084,.081])mesh(group,new THREE.TorusGeometry(.0375,.0025,6,32),silver,[0,y,0],[1,1,1],[Math.PI/2,0,0]);
  mesh(group,new THREE.CylinderGeometry(.036,.036,.002,32),silver,[0,.082,0]);
  oval(group,dark,[0,.083,.015],[.010,.001,.014]);
  mesh(group,new THREE.TorusGeometry(.009,.0026,6,20),silver,[0,.086,-.005],[.74,1,1.15],[Math.PI/2,0,0]);
  // A printed curved swoosh sits on the cylinder; no flat card sticks out of it.
  const position=[],normal=[];
  for(let i=0;i<28;i++){
    const a=-.95+i/28*1.9,b=-.95+(i+1)/28*1.9;
    const point=(angle,edge)=>[Math.sin(angle)*.0445,.018*Math.sin(angle*2)-.012+edge*.008,Math.cos(angle)*.0445];
    for(const [angle,edge]of [[a,-1],[b,-1],[a,1],[a,1],[b,-1],[b,1]]){position.push(...point(angle,edge));normal.push(Math.sin(angle),0,Math.cos(angle));}
  }
  const ribbon=new THREE.BufferGeometry();ribbon.setAttribute('position',new THREE.Float32BufferAttribute(position,3));ribbon.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));mesh(group,ribbon,print);
  for(const y of [.037,.047])curve(group,print,[[-.014,y,.043],[0,y+.002,.045],[.014,y,.043]],.0014);
  batch(group);return group;
}

function burgerProp(){
  const group=new THREE.Group();group.name='layered-burger';
  const bun=mat('burgerBun','#dd8c2f',.8),base=mat('burgerBase','#efba62',.88),sesame=mat('burgerSesame','#ffe0a1',.88),patty=mat('burgerPatty','#633323',.96),lettuce=mat('burgerLettuce','#70a43a',.84),cheese=mat('burgerCheese','#f7b92e',.77),tomato=mat('burgerTomato','#c54126',.71);
  mesh(group,new THREE.LatheGeometry([[0,.078],[.032,.076],[.063,.065],[.086,.048],[.101,.028],[.102,.017],[.096,.011],[0,.011]].reverse().map(p=>new THREE.Vector2(...p)),40),bun);
  mesh(group,new THREE.LatheGeometry([[0,-.061],[.072,-.061],[.091,-.054],[.098,-.044],[.098,-.036],[.088,-.031],[0,-.031]].map(p=>new THREE.Vector2(...p)),32),base);
  mesh(group,new THREE.CylinderGeometry(.096,.094,.025,28),patty,[0,-.023,0]);
  mesh(group,new THREE.CylinderGeometry(.083,.083,.012,28),tomato,[0,.002,0]);
  const leaves=[],normals=[],indices=[];
  for(let ring=0;ring<=4;ring++)for(let i=0;i<=48;i++){
    const angle=i/48*Math.PI*2,rad=ring/4*(.102+.007*Math.sin(angle*7)+.004*Math.cos(angle*11));
    leaves.push(Math.cos(angle)*rad,-.002+Math.sin(angle*9)*.007*(ring/4)**3,Math.sin(angle)*rad);
    normals.push(0,1,0);if(ring<4&&i<48){const a=ring*49+i,b=a+49;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  const leaf=new THREE.BufferGeometry();leaf.setAttribute('position',new THREE.Float32BufferAttribute(leaves,3));leaf.setIndex(indices);leaf.computeVertexNormals();const leafMat=lettuce.clone();leafMat.side=THREE.DoubleSide;mesh(group,leaf,leafMat);
  // Cheese corners droop over the patty; the bun and filling are separate volumes.
  const cheeseShape=new THREE.Shape();cheeseShape.moveTo(-.078,-.078);cheeseShape.lineTo(.078,-.078);cheeseShape.lineTo(.078,.078);cheeseShape.lineTo(-.078,.078);cheeseShape.closePath();
  const slice=new THREE.ExtrudeGeometry(cheeseShape,{depth:.004,bevelEnabled:false});slice.rotateX(-Math.PI/2);const cp=slice.attributes.position;for(let i=0;i<cp.count;i++){const x=cp.getX(i),z=cp.getZ(i);cp.setY(i,-.008-Math.max(0,Math.hypot(x,z)-.078)*.54+cp.getY(i));}slice.computeVertexNormals();mesh(group,slice,cheese,[0,0,0],[1,1,1],[0,.27,0]);
  const crust=[[0,.078],[.032,.076],[.063,.065],[.086,.048],[.101,.028]];
  for(let i=0;i<18;i++){
    const angle=i*2.39996323,r=.075*Math.sqrt((i+.5)/18),x=Math.cos(angle)*r,z=Math.sin(angle)*r;
    const j=crust.findIndex((point,index)=>index>0&&point[0]>=r),a=crust[j-1],b=crust[j],slope=(b[1]-a[1])/(b[0]-a[0]);
    const surfaceY=THREE.MathUtils.lerp(a[1],b[1],(r-a[0])/(b[0]-a[0]));
    const normal=v(-Math.cos(angle)*slope,1,-Math.sin(angle)*slope).normalize();
    const seed=detailOval(group,sesame,[x+normal.x*.0011,surfaceY+normal.y*.0011,z+normal.z*.0011],[.0021,.0016,.0045]);
    seed.quaternion.setFromUnitVectors(axisY,normal).multiply(new THREE.Quaternion().setFromAxisAngle(axisY,angle));
  }
  batch(group);return group;
}

// Hand-sized meshes retain authored proportions; the same instance geometry
// is used on desks, in palms and for thrown objects.
function bananaProp(peel=false){
 const g=new THREE.Group();g.name=peel?'banana-peel':'curved-banana';
 const skin=mat('bananaSkin','#f9ce32',.65),light=mat('bananaInner','#ffedab',.87),tip=mat('bananaTip','#77573b',.9);
 if(!peel){
  const path=new THREE.CatmullRomCurve3([v(-.075,-.11,0),v(-.030,-.085,0),v(.010,-.025,0),v(.016,.048,0),v(-.010,.108,0)]),geo=new THREE.TubeGeometry(path,28,.027,10,false),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const t=Math.floor(i/11)/28,c=path.getPointAt(Math.min(1,t)),f=.22+.78*Math.pow(Math.sin(Math.PI*t),.55);p.setXYZ(i,c.x+(p.getX(i)-c.x)*f,c.y+(p.getY(i)-c.y)*f,c.z+(p.getZ(i)-c.z)*f);}geo.computeVertexNormals();mesh(g,geo,skin);
  curve(g,tip,[[-.010,.104,0],[-.018,.126,.002]],.008);oval(g,tip,[-.075,-.11,0],[.006,.006,.006]);
  curve(g,light,[[-.060,-.101,.012],[-.018,-.067,.024],[.012,-.010,.026],[.014,.055,.023]],.0016);
 }else{
  for(let i=0;i<3;i++){const arm=new THREE.Group();g.add(arm);arm.rotation.y=i*Math.PI*2/3;
   const shape=new THREE.Shape();shape.moveTo(-.012,.072);shape.quadraticCurveTo(-.045,.014,-.033,-.086);shape.quadraticCurveTo(0,-.13,.031,-.09);shape.quadraticCurveTo(.040,.012,.012,.072);shape.closePath();
   const geo=new THREE.ExtrudeGeometry(shape,{depth:.006,bevelEnabled:true,bevelSize:.002,bevelThickness:.001,bevelSegments:2,curveSegments:12}),pos=geo.attributes.position;
   for(let j=0;j<pos.count;j++){const y=pos.getY(j),t=Math.max(0,(.072-y)/.2);pos.setZ(j,pos.getZ(j)+t*t*.09);pos.setY(j,y*.5);}geo.computeVertexNormals();mesh(arm,geo,skin);const inner=geo.clone();inner.translate(0,0,.0015);mesh(arm,inner,light);}
  curve(g,tip,[[0,.033,0],[0,.060,0]],.009);g.userData.throwableKind='bananaPeel';
 }
 batch(g);return g;
}
function garlicProp(){
 const g=new THREE.Group();g.name='garlic-clove';const ivory=mat('garlicIvory','#f0e4cf',.82),ridge=mat('garlicRidge','#d9bfab',.91);
 const points=[[0,-.054],[.017,-.054],[.032,-.043],[.038,-.019],[.031,.012],[.019,.039],[.006,.061],[0,.066]].map(p=>new THREE.Vector2(...p));
 const geo=new THREE.LatheGeometry(points,24),p=geo.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i);p.setX(i,p.getX(i)+(y+.054)**2*1.8);p.setZ(i,p.getZ(i)*.76);}geo.computeVertexNormals();mesh(g,geo,ivory);
 curve(g,ridge,[[0,-.053,.002],[.005,-.025,.028],[.008,.015,.021],[.022,.056,.004]],.001);oval(g,ridge,[0,-.054,0],[.017,.003,.012]);batch(g);return g;
}
function gumProp(){
 const g=new THREE.Group();g.name='bubblegum-wrapper';const paper=mat('gumWrapper','#f484b9',.61),ends=mat('gumCream','#fff5e1',.74),pink=mat('gumPink','#cd4c87',.66);
 mesh(g,rounded(.085,.055,.022,.006),paper);for(const side of [-1,1]){const strip=mesh(g,rounded(.021,.045,.008,.002),ends,[side*.05,0,0]);strip.rotation.y=side*.3;for(let i=-2;i<=2;i++)cube(g,pink,[side*.05,i*.007,.005],[.018,.001,.001]);}
 oval(g,ends,[0,0,.014],[.025,.018,.002]);oval(g,pink,[0,0,.016],[.012,.012,.002]);batch(g);return g;
}
function lunchProp(){
 const g=new THREE.Group();g.name='teacher-lunchbox';const steel=mat('lunchSteel','#b8c7c8',.38,.45),rice=mat('lunchRice','#fff5dc',.9),veg=mat('lunchGreens','#6a9a3a',.82),meat=mat('lunchMeat','#b87339',.83);
 mesh(g,rounded(.215,.050,.14,.017),steel);mesh(g,rounded(.194,.022,.130,.011),mat('lunchInner','#657b7e',.47,.25),[0,.027,0]);
 mesh(g,rounded(.110,.026,.113,.012),rice,[-.034,.039,0]);cube(g,steel,[.026,.045,0],[.004,.026,.127]);
 for(let i=0;i<5;i++){const a=i*2.1;detailOval(g,veg,[.065+.014*Math.cos(a),.045,-.036+.013*Math.sin(a)],[.014,.010,.012]);}for(let i=0;i<3;i++)mesh(g,rounded(.040,.014,.022,.005),meat,[.065,.043,.006+i*.023],[1,1,1],[0,.12,0]);
 for(let i=0;i<20;i++){const x=-.077+(i%5)*.019,z=-.042+Math.floor(i/5)*.027;detailOval(g,rice,[x,.054,z],[.0035,.0015,.008]);}batch(g);return g;
}
function penProp(){return createSchoolPen();}

export const THROWABLE_ITEM_KINDS=Object.freeze(['smoke','flash','ink','bananaPeel']);
export const FOOD_ITEM_KINDS=Object.freeze(['snack','drink','burger','banana','garlic','gum','lunch']);
export const DESK_ITEM_KINDS=Object.freeze([...FOOD_ITEM_KINDS,'pen','phone',...THROWABLE_ITEM_KINDS]);

const deskItemFactories=Object.freeze({
 snack:snackProp,phone:phoneProp,smoke:smokeProp,flash:flashProp,ink:inkProp,
 drink:drinkProp,burger:burgerProp,banana:bananaProp,bananaPeel:()=>bananaProp(true),
 garlic:garlicProp,gum:gumProp,lunch:lunchProp,pen:penProp
});
export function createDeskItem(action){
  if(!Object.hasOwn(deskItemFactories,action))throw new RangeError(`Unknown desk item: ${action}`);
  const factory=deskItemFactories[action];
  // The same gate applies to normal GLBs and every offline/error fallback.
  return requireModelBudget(action==='pen'?factory():clonePropAsset(action)||factory(),`道具 ${action}`);
}

export function createDeskHands({createHand}={}){
  const group=new THREE.Group();group.name='first-person-school-hands';
  // Use the imported hand and short forearm as one continuous source mesh.
  const arms=[-1,1].map(side=>{
    const hand=createHand?createHand(side,1.38):articulatedHand(side,1.38,-1,skin);
    // New source palms are metric and larger than the old isolated view mesh.
    // Frame only the first-person copy; never resize the full-body character.
    hand.group.scale.multiplyScalar(hand.group.userData.firstPersonScale??1);
    const arm=new THREE.Group();group.add(arm);arm.add(hand.group);
    return {group:arm,hand,pose(position,{curl=.15,rx=0,ry=0,rz=0}={}){hand.group.position.copy(position);hand.group.rotation.set(rx,ry,rz);hand.setCurl(curl);}};
  });
  arms.forEach((arm,i)=>{arm.group.name=i?'right-desk-arm':'left-desk-arm';arm.hand.group.name=i?'right-desk-hand':'left-desk-hand';});
  const articulation=arms.map((arm,i)=>createFirstPersonHandMotion(arm.hand,i?1:-1));
  const supports=arms.map(arm=>createHandSupport(arm.hand));
  const wholeGrips=arms.map((arm,i)=>createWholePalmGrip(arm.hand,i?1:-1));
  const props=Object.fromEntries(DESK_ITEM_KINDS.map(kind=>[kind,createDeskItem(kind)]));Object.values(props).forEach(p=>group.add(p));
  // Fixed object-to-palm transforms preserve contact during wrist rotation.
  const grips={
    snack:{position:v(.0637,.07626,-.03728),rotation:new THREE.Quaternion(-.0259436,.434251,-.0045194,.900407).normalize()},
    phone:{position:v(.051,.078,-.042),rotation:new THREE.Quaternion(-.0587662,.517409,.0101531,.853658).normalize()}
  };
  for(const kind of THROWABLE_ITEM_KINDS)grips[kind]={position:grips.snack.position.clone(),rotation:grips.snack.rotation.clone()};
  grips.drink={position:v(0,0,0),rotation:new THREE.Quaternion().setFromEuler(new THREE.Euler(.42,.90,.08))};
  grips.burger={position:v(0,0,0),rotation:new THREE.Quaternion().setFromEuler(new THREE.Euler(.42,.90,.08))};
  for(const kind of ['banana','garlic','gum','lunch','pen'])grips[kind]={position:v(0,0,0),rotation:grips.snack.rotation.clone()};
  const gripBack={banana:v(-.013,-.030,-.022),bananaPeel:v(-.012,.016,-.012),garlic:v(-.023,-.016,-.020),gum:v(-.030,0,-.010),lunch:v(-.085,-.016,-.045),pen:v(-.003,.018,-.004),flash:v(-.029,-.018,-.026),ink:v(-.032,-.020,-.028),smoke:v(-.028,-.018,-.025),snack:v(-.028,-.018,-.025),drink:v(-.028,-.025,-.032),burger:v(-.096,-.032,-.035),phone:v(-.018,-.015,-.014)};
  for(const action of DESK_ITEM_KINDS){const hand=arms[0].hand;hand.setCurl([...FOOD_ITEM_KINDS,'pen',...THROWABLE_ITEM_KINDS].includes(action)?.80:action==='phone'?.78:.72);let contact=propContact(props[action],gripBack[action]);if(action==='banana'&&props[action].userData.propAsset)contact=fitFirstPersonSurface(props[action],contact);grips[action].position.copy(hand.indexTip()).sub(contact.multiplyScalar(1/hand.group.scale.x).applyQuaternion(grips[action].rotation));}
  function attachToGrip(prop,hand,anchor){hand.updateMatrix();prop.position.copy(anchor.position).applyMatrix4(hand.matrix);prop.quaternion.copy(hand.quaternion).multiply(anchor.rotation);}
  for(const kind of DESK_ITEM_KINDS){const fit=wholeGrips[0].fit(kind);if(fit){grips[kind].position.fromArray(fit.position);grips[kind].rotation.setFromEuler(new THREE.Euler(...fit.rotation));}}
  let lastTime=null,focus=0,extension=0,alertValue=0,standing=0,active='snack',useTime=0,computerBlend=0,using=0,throwCharge=0,releaseCharge=0,wasReleasing=false,foodAge=0,foodAmount=0,foodWasUsing=false,foodPhase=0;
  const foodPose={turn:0,reach:0,bob:0,chewing:0};
  let penWriteBlend=0,penAge=0,bookBlend=0,drawerBlend=0,lowCarry=0,previousHandPositions=null,previousFood=null;
  const rest=[v(-.18,-.525,-.28),v(.18,-.525,-.28)],drawer=[v(-.23,-.68,-.30),v(.18,-.68,-.30)];
  const ease=(x,a=0,b=1)=>THREE.MathUtils.smoothstep(x,a,b);
  function update(time,{action='snack',holding=false,eating:effectiveEating=null,carrying=holding,progress=0,alert=0,seated=true,crouched=false,caught=false,freeLook=false,viewPitch=.08,throwAge=Infinity,computer=false,typing=false,office=false,movement=0,walkPhase=0,crawlBlend=0,penWriting=false,bookAmount=0,drawer:drawerContact=null,drawerOpen=false,drawerAmount=drawerOpen?1:0,eyeHeight=1.43,animationPose=null}={}){
    const authored=isHandAnimationPose(animationPose)&&!seated&&!carrying&&!holding&&!caught&&!computer&&!typing&&!bookAmount;
    function applyAuthored(weight){
      group.updateMatrix();const inv=group.matrix.clone().invert(),invQ=group.quaternion.clone().invert();
      for(let i=0;i<2;i++){
        const pose=animationPose[i?'right':'left'],hand=arms[i].hand,target=v(...pose.position).applyMatrix4(inv),rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose.rotation,'XYZ'));
        hand.group.position.lerp(target,weight);hand.group.quaternion.slerp(invQ.clone().multiply(rotation),weight);articulation[i].applyAuthoredFingers(pose,weight);
      }
      group.updateMatrixWorld(true);
    }
    if(authored&&animationPose.source!=='runtime'){
      // The editor takes the exact production path but does not run gameplay
      // clocks or damping. Seeking 0→end→middle is identical to a fresh seek.
      group.position.set(0,0,0);group.quaternion.identity();for(const prop of Object.values(props))prop.visible=false;
      applyAuthored(1);previousHandPositions=null;previousFood=null;lastTime=Number.isFinite(time)?time:null;
      group.userData.authoredAnimation=true;return;
    }
    group.userData.authoredAnimation=false;
    articulation.forEach(rig=>rig.restore());
    if(lastTime!==null&&time<lastTime){lastTime=null;focus=extension=alertValue=standing=useTime=using=throwCharge=releaseCharge=foodAge=foodAmount=foodPhase=penWriteBlend=penAge=bookBlend=drawerBlend=lowCarry=0,previousHandPositions=null,previousFood=null;wasReleasing=foodWasUsing=false;for(const key of Object.keys(foodPose))foodPose[key]=0;}
    const dt=lastTime===null?1/60:clamp(time-lastTime,0,.08);lastTime=time;
    const requested=DESK_ITEM_KINDS.includes(action)?action:'snack';
    if(extension<.001){if(active!==requested){active=requested;useTime=0;}}
    const engaged=carrying&&!caught&&active===requested;
    focus=smooth(focus,engaged&&seated?1:0,dt,7);
    standing=smooth(standing,seated?0:1,dt,9);
    alertValue=smooth(alertValue,clamp(Number(alert)||0,0,1),dt,12);
    extension=clamp(extension+dt*(engaged?1/.70:-(caught?1/.20:1/.46)),0,1);
    bookBlend=smooth(bookBlend,seated&&!caught&&!computer&&!carrying?clamp(Number(bookAmount)||0,0,1):0,dt,11);
    const drawerAmountNow=clamp(Number(drawerContact?.amount??drawerAmount)||0,0,1);
    drawerBlend=smooth(drawerBlend,seated&&!caught&&!computer&&!bookAmount&&action!=='pen'?drawerAmountNow:0,dt,10);
    const idleWeight=1-ease(extension,0,.32);
    const clear=ease(extension,0,.16),lower=ease(extension,.16,.32),reach=ease(extension,.30,.48),pull=ease(extension,.48,.72),grip=ease(extension,.42,.70),use=ease(extension,.70,1),p=clamp(Number(progress)||0,0,1);
    lowCarry=smooth(lowCarry,holding?0:1,dt,3);
    const writing=active==='pen'&&engaged&&seated&&penWriting;
    penWriteBlend=smooth(penWriteBlend,writing?1:0,dt,9);
    // Finish the grip change before restarting the roll. Spinning the target
    // through a half-turn during slerp switches its shortest arc and snaps.
    if(active==='pen'&&engaged&&seated&&!penWriting&&penWriteBlend<.01)penAge+=dt;
    if(engaged&&(holding||writing)&&use>.94)useTime+=dt;else if(extension<.05)useTime=0;
    using=smooth(using,engaged&&(holding||writing)?1:0,dt,14);
    const eating=FOOD_ITEM_KINDS.includes(active)&&engaged&&holding&&(effectiveEating===null||effectiveEating);
    if(eating){if(!foodWasUsing&&(!holding||p===0))foodAge=0;foodAge+=dt;foodPhase=effectiveEating===null?(p>0?p*3:foodAge%3):p*3;}else if(!holding){foodAge=0;foodPhase=0;}
    foodWasUsing=eating;foodAmount=smooth(foodAmount,eating?1:0,dt,14);
    const desiredFood=sampleFoodGesture(foodPhase),foodWeight=FOOD_ITEM_KINDS.includes(active)?foodAmount*use*(1-computerBlend):0;
    for(const key of Object.keys(foodPose)){const speed=key==='bob'?.5:key==='chewing'?8:key==='reach'?1.8:2.2;foodPose[key]+=clamp(desiredFood[key]*foodWeight-foodPose[key],-dt*speed,dt*speed);}
    // The final skin-space articulation below handles the complete eating
    // gesture. Carrying an unused item leaves it settled in its grip.
    const foodBob=0;
    const tapCycle=(useTime%1.72)/1.72,tapPress=ease(tapCycle,.28,.43)*(1-ease(tapCycle,.48,.65))*using;
    const tapIndex=Math.floor(useTime/1.72),tapTravel=ease(tapCycle,0,.23),tapX=THREE.MathUtils.lerp(.012+.022*Math.sin((tapIndex-1)*2.4),.012+.022*Math.sin(tapIndex*2.4),tapTravel),tapY=THREE.MathUtils.lerp(-.018+.025*Math.cos((tapIndex-1)*1.7),-.018+.025*Math.cos(tapIndex*1.7),tapTravel);
    const tapContact=v(tapX,tapY,.017+.018*(1-tapPress));
    const throwable=THROWABLE_ITEM_KINDS.includes(active),motionAction=throwable?'smoke':active==='lunch'?'burger':['banana','garlic','gum','pen'].includes(active)?'snack':active;
    const releasing=throwable&&throwAge>=0&&throwAge<.34;
    if(releasing&&!wasReleasing)releaseCharge=throwCharge;
    if(!releasing)throwCharge=smooth(throwCharge,throwable&&engaged?ease(p):0,dt,14);
    wasReleasing=releasing;
    const throwStroke=releasing?Math.sin(Math.PI*ease(throwAge,0,.34)):0;
    const windup=releasing?releaseCharge*(1-ease(throwAge,0,.16)):throwCharge;
    if(releasing)throwCharge=windup;
    const targets={
      smoke:[v(-.18-windup*.025,-.595+windup*.08,-.24+windup*.06),rest[1].clone()],
      snack:[v(-.20,-.595+foodBob,-.22),rest[1].clone()],
      drink:[v(-.20,-.595+foodBob,-.22),rest[1].clone()],
      burger:[v(-.21,-.605+foodBob,-.24),rest[1].clone()],
      phone:[v(-.16,-.59,-.245),v(.029,-.565,-.209+Math.sin(useTime*6.2)*.003)],
    };
    // Clear the front edge before lowering, then reach horizontally through
    // the opening. A packet is pulled clear before it is turned upright.
    const wrists=rest.map((r,i)=>{
      const w=r.clone();w.z=THREE.MathUtils.lerp(r.z,-.17,clear);w.y=THREE.MathUtils.lerp(r.y,drawer[i].y,lower);
      w.x=THREE.MathUtils.lerp(r.x,drawer[i].x,reach);w.z=THREE.MathUtils.lerp(w.z,drawer[i].z,reach);
      w.z=THREE.MathUtils.lerp(w.z,-.13,pull);return w.lerp(targets[motionAction][i],use);
    });
    // Standing changes the height of the carry, not the grip. The phone remains
    // a two-hand action and food keeps its small vertical movement.
    const standingTargets={
      smoke:[v(-.23-windup*.02,-.30+windup*.06,-.52+windup*.075),v(.24,-.29,-.50)],
      snack:[v(-.23,-.30+foodBob,-.52),v(.24,-.29,-.50)],
      drink:[v(-.23,-.30+foodBob,-.52),v(.24,-.29,-.50)],
      burger:[v(-.23,-.31+foodBob,-.54),v(.24,-.29,-.50)],
      phone:[v(-.20,-.28,-.53),v(.09,-.27,-.50)],
    };
    // Rest at the lower edge of the view; the same palm mesh moves forward
    // to take an object instead of changing size or covering the aim point.
    wrists.forEach((w,i)=>{w.lerp(standingTargets[motionAction][i],standing);if(crouched){w.y-=.055;w.z+=.12*(1-reach)*(1-use);}w.y-=alertValue*.006;w.lerp(v((i?1:-1)*.24,-.34,-.62),idleWeight);});
    if(releasing)wrists[0].lerp(v(-.125,-.57,-.44).lerp(v(-.15,-.25,-.70),standing),throwStroke);
    const poses={
      smoke:[{curl:.80,rx:-.94,ry:-.83,rz:-.22},{curl:.10,rx:-Math.PI/2,ry:0,rz:0}],
      snack:[{curl:.80,rx:-.75,ry:-1.02,rz:-.08},{curl:.10,rx:-Math.PI/2,ry:0,rz:0}],
      drink:[{curl:.80,rx:-.75,ry:-1.02,rz:-.08},{curl:.10,rx:-Math.PI/2,ry:0,rz:0}],
      burger:[{curl:.80,rx:-.75,ry:-1.02,rz:-.08},{curl:.10,rx:-Math.PI/2,ry:0,rz:0}],
      phone:[{curl:.78,rx:-.75,ry:-1.08,rz:-.08},{curl:.94,rx:-.80,ry:-.36,rz:.65}],
    };
    const standingPoses={
      smoke:[{rx:-.44,ry:-.82,rz:-.30},{rx:-.65,ry:0,rz:.11}],
      snack:[{rx:-.24,ry:-1.02,rz:-.08},{rx:-.65,ry:0,rz:.11}],
      drink:[{rx:-.24,ry:-1.02,rz:-.08},{rx:-.65,ry:0,rz:.11}],
      burger:[{rx:-.24,ry:-1.02,rz:-.08},{rx:-.65,ry:0,rz:.11}],
      phone:[{rx:-.10,ry:-1.16,rz:.10},{rx:-.24,ry:-.36,rz:.65}],
    };
    // A press extends the index; between presses its real phalanges flex back.
    // Apply it before the contact solve and do not reset it while moving the wrist.
    const tapCurl=.25-.19*tapPress;
    function posePhoneIndex(hand,curl){
      if(hand.setFingerCurl)hand.setFingerCurl('Index',THREE.MathUtils.lerp(curl,tapCurl,use));
      else hand.pointIndex(use*(1-tapCurl/Math.max(.001,curl)));
    }
    arms.forEach((arm,i)=>{
      const side=i?1:-1,w=wrists[i];
      const target=poses[motionAction][i],standingTarget=standingPoses[motionAction][i],blend=ease(extension,.38,.86),restRX=-Math.PI/2+reach*.16;
      const heldRX=THREE.MathUtils.lerp(target.rx,standingTarget.rx,standing),heldRY=THREE.MathUtils.lerp(target.ry,standingTarget.ry,standing),heldRZ=THREE.MathUtils.lerp(target.rz,standingTarget.rz,standing);
      const pose={curl:.10+(target.curl-.10)*grip,rx:restRX+(heldRX-restRX)*blend,ry:heldRY*blend,rz:heldRZ*blend};
      pose.rx=THREE.MathUtils.lerp(pose.rx,-.65,idleWeight);pose.ry*=1-idleWeight;pose.rz=THREE.MathUtils.lerp(pose.rz,side*.11,idleWeight);
      if(throwable&&i===0){pose.rx+=windup*.50-throwStroke*.66;pose.ry-=windup*.18;pose.rz-=windup*.16;if(releasing)pose.curl=THREE.MathUtils.lerp(pose.curl,.10,ease(throwAge,.035,.12));}
      // Empty hands settle. Visible motion comes from taking, holding, using,
      // and releasing an object rather than a constant idle wrist oscillation.
      pose.curl=THREE.MathUtils.lerp(pose.curl,.18,idleWeight);
      if(active==='pen'&&i===0){pose.rz+=using*.055*Math.sin(useTime*7);pose.rx+=using*.03*Math.cos(useTime*5);pose.curl=.82*grip+.10*(1-grip);}
      if(i===0&&active==='phone'&&wholeGrips[0].fit(active))pose.ry=Math.PI*blend;
      arm.pose(w,pose);
      const wholeFit=i===0?wholeGrips[0].fit(active):null;
      if(wholeFit?.palmRoll)arm.hand.group.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(v(0,0,1),wholeFit.palmRoll*grip));
      if(arm.hand.setFingerCurl){
        const squeeze=i===0&&FOOD_ITEM_KINDS.includes(active)?.025*foodPose.chewing*Math.sin(foodPhase*Math.PI*2/.72):0;
        arm.hand.setFingerCurl('Middle',pose.curl+squeeze);arm.hand.setFingerCurl('Pinky',pose.curl+grip*.025+squeeze);
      }
      if(active==='phone'&&i===1)posePhoneIndex(arm.hand,pose.curl);
      arm.hand.opposeThumb(grip*(releasing&&i===0?1-ease(throwAge,.035,.12):1)*([...FOOD_ITEM_KINDS,'pen',...THROWABLE_ITEM_KINDS].includes(active)&&i===1?0:1),active);
    });
    const visible=extension>.62&&!caught;
    for(const kind of THROWABLE_ITEM_KINDS){props[kind].visible=visible&&active===kind&&carrying;attachToGrip(props[kind],arms[0].hand.group,grips[kind]);}
    props.snack.visible=visible&&active==='snack';
    attachToGrip(props.snack,arms[0].hand.group,grips.snack);
    for(const kind of ['drink','burger','banana','garlic','gum','lunch','pen']){props[kind].visible=visible&&active===kind;attachToGrip(props[kind],arms[0].hand.group,grips[kind]);}
    props.phone.visible=visible&&active==='phone';attachToGrip(props.phone,arms[0].hand.group,grips.phone);
    function contactPoint(prop,p){prop.updateMatrix();return p.clone().applyMatrix4(prop.matrix);}
    function fitSecondaryHand(i,prop,p,amount){
      const arm=arms[i],hand=arm.hand.group,target=contactPoint(prop,p),tip=arm.hand.indexTip().multiplyScalar(hand.scale.x).applyQuaternion(hand.quaternion);
      hand.position.copy(wrists[i]).lerp(target.sub(tip),amount);hand.updateMatrix();
    }
    if(active==='phone')fitSecondaryHand(1,props.phone,tapContact,use);
    function thumbAt(i,prop,p,amount){if(i===0&&wholeGrips[0].fit(active))return;const hand=arms[i].hand.group;hand.updateMatrix();const target=contactPoint(prop,propContact(prop,p)).applyMatrix4(hand.matrix.clone().invert());arms[i].hand.aimThumb(target,amount);}
    if(throwable)thumbAt(0,props[active],v(-.032,-.020,.025),grip*(releasing?1-ease(throwAge,.035,.12):1));
    if(active==='snack')thumbAt(0,props.snack,v(-.052,-.020,.025),grip);
    if(active==='drink')thumbAt(0,props.drink,v(-.030,-.025,.032),grip);
    if(active==='burger')thumbAt(0,props.burger,v(-.096,-.025,.035),grip);
    if(['banana','garlic','gum','lunch','pen'].includes(active))thumbAt(0,props[active],gripBack[active].clone().setZ(-gripBack[active].z),grip);
    if(active==='phone'){thumbAt(0,props.phone,v(-.030,-.010,.017),grip);arms[1].hand.opposeThumb(grip,'phone');}
    wholeGrips[0].apply(active,grip*(releasing?1-ease(throwAge,.035,.12):1));
    // Pose the held palms inside the viewmodel anchor. The outer view layer
    // decides whether that anchor follows the view or the seated body.
    const pitch=freeLook?.78:clamp((Number.isFinite(viewPitch)?viewPitch:.08)+.85*focus,-1.40,1.40),drop=.12*focus+(!freeLook&&seated&&crouched?.24:0);
    const deskAnchor=(1-idleWeight)*(1-standing);group.rotation.x=pitch*deskAnchor;group.position.set(0,drop*Math.cos(pitch)*deskAnchor,drop*Math.sin(pitch)*deskAnchor);
    // A one-handed pickup must not make the empty hand rummage through the
    // drawer too. Keep that palm relaxed in the anchor while the working
    // hand and its desk-space parent turn towards the item.
    if([...FOOD_ITEM_KINDS,'pen',...THROWABLE_ITEM_KINDS].includes(active)){
      const hand=arms[1].hand;group.updateMatrix();
      hand.group.position.set(.24,-.34,-.62).applyMatrix4(group.matrix.clone().invert());
      hand.group.quaternion.copy(group.quaternion).invert().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.65,0,.11)));
      hand.setCurl(.18);
    }
    computerBlend=smooth(computerBlend,computer&&!caught?1:0,dt,10);
    if(computerBlend>.001){
      group.rotation.x*=1-computerBlend;group.position.multiplyScalar(1-computerBlend);
      for(let i=0;i<2;i++){const hand=arms[i].hand,beat=typing?Math.sin(time*10+i*2.4):0;hand.group.position.lerp(v(i?.17:-.17,-.285+Math.max(0,beat)*.008,-.59),computerBlend);hand.group.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.14,0,i?.08:-.08)),computerBlend);hand.setCurl(.16+Math.max(0,-beat)*.18);hand.pointIndex(.2);}
      for(const prop of Object.values(props))prop.visible=false;
    }
    if(!seated&&!caught&&!computer){
      const crawl=clamp(crawlBlend,0,1),stride=clamp(movement,0,1),phase=Number.isFinite(walkPhase)?walkPhase:0;
      // Alternating support follows distance travelled. No ticking in place,
      // no camera shake, and a held object keeps its exact palm-relative fit.
      const follow=[],twoHanded=extension>.01&&active==='phone',primary=0,secondaryBefore=twoHanded?(arms[1-primary].hand.group.updateMatrix(),arms[1-primary].hand.group.matrix.clone()):null;
      arms.forEach((arm,i)=>{
        const hand=arm.hand.group,before=hand.matrix.clone();hand.updateMatrix();before.copy(hand.matrix);
        const beat=Math.sin(phase+(i?Math.PI:0)),empty=extension<.01||(i===1&&active!=='phone');
        if(crawl>.001&&empty){
          hand.position.lerp(v(i?.22:-.22,.04-CRAWL_TUNING.eyeHeight+Math.max(0,beat)*.023*stride,-.93+beat*.045*stride),crawl);
          hand.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2+beat*.065*stride,0,i?.09:-.09)),crawl);
          arm.hand.setCurl(THREE.MathUtils.lerp(.18,.12+Math.max(0,beat)*.10*stride,crawl));
        }
        const amplitude=stride*(1-crawl)*(empty?1:.20),side=i?1:-1;
        if(empty&&crawl<1)hand.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.12,side*1.18,side*.14)),stride*(1-crawl));
        // The arm travels in an oval, then the wrist rolls with a small lag.
        // One complete swing is a left/right step pair, never a rapid shake.
        const lag=Math.sin(phase+(i?Math.PI:0)-.42);
        hand.position.x+=side*(.018*Math.cos(phase))*amplitude;
        hand.position.y+=(beat*(empty?.095:.062)+Math.cos(phase*2)*(empty?.018:.014))*amplitude;
        hand.position.z+=beat*(empty?.22:.135)*amplitude;
        // Share the turn with the imported elbow/wrist joints below, instead
        // of stacking an extra roll on the former rigid hand-group swing.
        const armTurn=empty?.48:1;
        hand.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(lag*.42*amplitude*armTurn,side*lag*.58*amplitude*armTurn,side*beat*.24*amplitude*armTurn)));
        if(empty&&crawl<.01)arm.hand.setCurl(.18+(.045+.035*Math.sin(phase+(i?Math.PI:0)-.7))*amplitude);
        hand.updateMatrix();follow[i]=hand.matrix.clone().multiply(before.invert());
      });
      if(twoHanded){const delta=follow[primary],secondary=arms[1-primary].hand.group;delta.clone().multiply(secondaryBefore).decompose(secondary.position,secondary.quaternion,secondary.scale);follow[1-primary]=delta;}
      for(const kind of DESK_ITEM_KINDS){const prop=props[kind],delta=follow[0];prop.updateMatrix();delta.clone().multiply(prop.matrix).decompose(prop.position,prop.quaternion,prop.scale);}
    }
    // Reserve the centre for aiming. The wrists sit below the lower edge;
    // the short source forearms enter from the bottom instead of floating.
    // Leave the thumb tips above the frame while the forearm still exits at
    // the bottom. A larger seated drop clipped almost the entire thumb.
    group.position.y-=THREE.MathUtils.lerp(.12,.085,standing)*(1-clamp(crawlBlend,0,1));
    if(standing<.999&&extension>.001&&active!=='pen'&&!computer&&!caught){
      // An unused object stays below the desktop near the lap. Preserve every
      // skin/prop contact while the use gesture alone lifts it toward the mouth.
      const weight=(1-standing)*use*(FOOD_ITEM_KINDS.includes(active)?1:lowCarry*(1-ease(p,0,.10)));
      if(weight>.001){const primary=arms[0].hand.group,prop=props[active];group.updateMatrixWorld(true);const world=prop.getWorldPosition(v()).applyMatrix4((group.parent?.matrixWorld||new THREE.Matrix4()).clone().invert());
        const target=v(world.x,Math.min(world.y,(Number(drawerContact?.floor??.659)-eyeHeight)+.10),Math.max(world.z,-.29)),delta=target.sub(world).multiplyScalar(weight).applyQuaternion(group.quaternion.clone().invert());
        primary.position.add(delta);prop.position.add(delta);if(active==='phone')arms[1].hand.group.position.add(delta);
      }
    }
    const foodGesture=FOOD_ITEM_KINDS.includes(active)&&foodAmount>.0001?foodPose:null;
    articulation.forEach((rig,i)=>rig.apply({parent:group,prop:i===0&&foodGesture?props[active]:null,food:i===0?foodGesture:null,amount:1,movement:!seated&&!caught?clamp(movement,0,1)*(1-clamp(crawlBlend,0,1)):0,phase:walkPhase,palmRoll:i===0?wholeGrips[0].fit(active)?.palmRoll||0:0,empty:extension<.001||i===1&&FOOD_ITEM_KINDS.includes(active)}));
    if(active==='pen'&&seated&&extension>.001){
      // A pen stays between the right index and thumb through a compact
      // finger roll, then settles onto the unchanged page-writing contact.
      const weight=ease(extension,.20,1),hand=arms[1].hand,pen=props.pen;
      group.updateMatrix();const inv=group.matrix.clone().invert(),invQ=group.quaternion.clone().invert();
      const line=Math.sin(useTime*1.9),x=.135+.055*Math.sin(useTime*7.1),z=-.725+.035*line+.012*Math.sin(useTime*14.2);
      const tip=v(x,.88+Math.abs(x)*Math.tan(.14)+.005-1.43,z);
      const spin=penAge*Math.PI*2/1.6,twirl=1-penWriteBlend;
      const writeQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(.24+.025*Math.sin(useTime*7.1),-.10,-.32));
      const penQ=penTwirlQuaternion(penAge).slerp(writeQ,penWriteBlend);
      const palmQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(1.65,-.60,.50)).slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-1,.55,.18)),penWriteBlend);
      const centre=tip.clone().sub(v(0,-.0875,0).applyQuaternion(writeQ));
      const contact=v(0,SCHOOL_PEN.gripY,-SCHOOL_PEN.gripRadius),writeIndex=centre.clone().add(contact.clone().applyQuaternion(writeQ));
      const index=v(.175,-.34+.008*Math.sin(spin),-.59).lerp(writeIndex,penWriteBlend);
      hand.setCurl(.98);hand.setFingerCurl?.('Index',1-.12*twirl+.06*Math.sin(spin)*twirl);hand.setFingerCurl?.('Middle',.96-.10*Math.sin(spin-.6)*twirl);hand.setFingerCurl?.('Pinky',.84);
      articulation[1].apply({parent:group,empty:true,movement:twirl*.25,phase:spin});
      const wrist=index.sub(hand.indexTip().multiplyScalar(hand.group.scale.x).applyQuaternion(palmQ));
      hand.group.position.lerp(wrist.applyMatrix4(inv),weight);
      hand.group.quaternion.slerp(invQ.clone().multiply(palmQ),weight);
      hand.group.updateMatrix();
      pen.quaternion.copy(invQ).multiply(penQ);
      pen.position.copy(hand.indexTip().applyMatrix4(hand.group.matrix)).sub(contact.clone().applyQuaternion(pen.quaternion));
      const thumbTarget=contactPoint(pen,v(.006,SCHOOL_PEN.gripY,.008)).applyMatrix4(hand.group.matrix.clone().invert());articulation[1].pinchThumb(thumbTarget,weight);
      if(!group.userData.fitPenOffline)articulation[1].fitPen(penAge,penWriteBlend,weight);
      // The other hand rests beside the page instead of gripping invisible food.
      const left=arms[0].hand;left.group.position.lerp(v(-.24,-.46,-.66).applyMatrix4(inv),weight);left.group.quaternion.slerp(invQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.15,0,-.10))),weight);left.setCurl(.14);
      pen.visible=extension>.62&&!caught;
    }
    if(bookBlend>.001&&seated&&!caught){
      group.updateMatrix();const inv=group.matrix.clone().invert(),invQ=group.quaternion.clone().invert();
      for(let i=0;i<2;i++){
        const side=i?1:-1,hand=arms[i].hand,contact=firstPersonBookContacts(side,bookAmount),weight=bookBlend;
        hand.setCurl(.52);hand.setFingerCurl?.('Index',.46);hand.setFingerCurl?.('Middle',.57);hand.setFingerCurl?.('Pinky',.62);
        const wrist=contact.index.clone().sub(hand.indexTip().multiplyScalar(hand.group.scale.x).applyQuaternion(contact.quaternion));
        hand.group.position.lerp(wrist.applyMatrix4(inv),weight);hand.group.quaternion.slerp(invQ.clone().multiply(contact.quaternion),weight);
        group.updateMatrixWorld(true);const target=contact.thumb.clone().applyMatrix4(group.parent?.matrixWorld||new THREE.Matrix4());
        articulation[i].pinchThumb(hand.group.worldToLocal(target),weight);
      }
    }
    // Desk/keyboard contacts are solved after all viewmodel offsets. Each
    // fingertip bends at its own phalanges; the cached skin support cannot
    // enter the keys or desktop when the hand changes pose.
    if(standing<.999&&!caught){
      const deskFree=extension<.001,keyboard=computerBlend>.001;
      for(let i=0;i<2;i++){
        const idleSupport=1-ease(extension,0,.62),unoccupied=i===1&&active!=='phone'&&active!=='pen'||i===0&&active==='pen';
        const supportWeight=(unoccupied?1:idleSupport)*(1-bookBlend)*(1-drawerBlend);
        if(!keyboard&&supportWeight<.001)continue;
        const weight=(keyboard?computerBlend:supportWeight)*(1-standing),hand=arms[i].hand,beat=typing?time*10+i*2.4:0;
        if(keyboard){hand.setCurl(.28);for(const [j,finger]of ['Index','Middle','Pinky'].entries())hand.setFingerCurl?.(finger,.28+(finger==='Middle'?.12:finger==='Pinky'?.08:0)+(typing?.16*(.5+.5*Math.sin(beat-j*1.9)):0));}
        else hand.setCurl(.18);
        hand.aimThumb(v(i?-.14:.14,.07,-.015),1);
        group.updateMatrix();const inv=group.matrix.clone().invert(),invQ=group.quaternion.clone().invert(),palmQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,i?.08:-.08));
        const x=keyboard?(i?.18:-.065)+(office?.335:0):(i?.34:-.34),z=keyboard?(office?-.92:-.59):(office?-.78:-.60),level=(keyboard?(office?1.036:.903):(office?.988:.878))-eyeHeight;
        const target=v(x,level,z),tip=hand.indexTip().multiplyScalar(hand.group.scale.x).applyQuaternion(palmQ);
        hand.group.position.lerp(target.sub(tip).applyMatrix4(inv),weight);hand.group.quaternion.slerp(invQ.multiply(palmQ),weight);
        group.updateMatrixWorld(true);const min=supports[i].minimum(group.parent),plane=level+.0016;
        if(Number.isFinite(min)){const shift=v(0,(plane-min)*weight,0).applyQuaternion(group.quaternion.clone().invert());hand.group.position.add(shift);}
        if(keyboard&&weight>.995){supports[i].pressPads(group.parent,level,time+i*.24,typing);const padMin=supports[i].minimum(group.parent);if(padMin<level-.0014)hand.group.position.add(v(0,level-.0014-padMin,0).applyQuaternion(group.quaternion.clone().invert()));}
      }
    }
    if(seated&&!caught&&drawerBlend>.001){
      const floor=Number(drawerContact?.floor??.659)-eyeHeight,lip=Number(drawerContact?.lip??.811)-eyeHeight,cx=Number(drawerContact?.centerX||0),cz=Number(drawerContact?.centerZ??-.452),width=Math.max(.35,Number(drawerContact?.width??.66)),depth=Math.max(.28,Number(drawerContact?.depth??.81));
      group.updateMatrix();const inv=group.matrix.clone().invert(),invQ=group.quaternion.clone().invert(),lower=ease(drawerBlend,0,.50),reach=ease(drawerBlend,.50,1);
      for(let i=0;i<2;i++){
        if(carrying&&(i===0||active==='phone'))continue;
        const hand=arms[i].hand,side=i?1:-1,q=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,side*.04));
        hand.setCurl(.20);hand.opposeThumb(.10);
        const target=v(cx+side*Math.min(.145,width*.21),floor+.015,cz+depth*.10),tip=hand.indexTip().multiplyScalar(hand.group.scale.x).applyQuaternion(q),wrist=target.sub(tip);
        // Drop in front of the drawer lip, then slide inside below the desktop.
        const start=hand.group.position.clone().applyMatrix4(group.matrix),front=cz+depth/2+.18;
        const path=v(THREE.MathUtils.lerp(start.x,wrist.x,lower),THREE.MathUtils.lerp(start.y,wrist.y,lower),THREE.MathUtils.lerp(front,wrist.z,reach));
        hand.group.position.copy(start.lerp(path,drawerBlend).applyMatrix4(inv));hand.group.quaternion.slerp(invQ.clone().multiply(q),drawerBlend);
        group.updateMatrixWorld(true);const minimum=supports[i].minimum(group.parent),plane=floor+.008;
        if(Number.isFinite(minimum))hand.group.position.add(v(0,Math.max(0,plane-minimum)*drawerBlend,0).applyQuaternion(invQ));
      }
    }
    if(standing<.999&&extension>.001&&active!=='pen'&&!computer&&!caught){
      // An unused object stays below the desktop near the lap. Preserve every
      // skin/prop contact while the use gesture alone lifts it toward the mouth.
      const weight=use*(1-foodAmount)*(1-using)*(1-ease(p,0,.10));
      if(weight>.001){const primary=arms[0].hand.group,prop=props[active];group.updateMatrixWorld(true);const before=primary.matrix.clone(),world=prop.getWorldPosition(v()).applyMatrix4((group.parent?.matrixWorld||new THREE.Matrix4()).clone().invert());
        const target=v(world.x,Math.min(world.y,(Number(drawerContact?.floor??.659)-eyeHeight)+.10),Math.max(world.z,-.29)),delta=target.sub(world).multiplyScalar(weight).applyQuaternion(group.quaternion.clone().invert());
        primary.position.add(delta);prop.position.add(delta);if(active==='phone')arms[1].hand.group.position.add(delta);
      }
    }
    // A lower carry has a longer route back to rest. Limit the actual wrist
    // travel, moving its object by the same delta; interruption never teleports
    // a full palm or breaks the established skin-space grip.
    if(previousHandPositions&&active!=='pen'&&bookBlend<.001){
      const maxTravel=4.2*dt;
      for(let i=0;i<2;i++){
        const hand=arms[i].hand.group,delta=hand.position.clone().sub(previousHandPositions[i]);
        if(delta.length()>maxTravel&&(extension>.001||releasing)){
          const correction=delta.clone().setLength(maxTravel).sub(delta);hand.position.add(correction);
          if(i===0){props[active].position.add(correction);if(active==='phone')arms[1].hand.group.position.add(correction);}
        }
      }
    }
    if(FOOD_ITEM_KINDS.includes(active)&&props[active].visible){
      group.updateMatrixWorld(true);const prop=props[active],position=prop.getWorldPosition(v());
      if(previousFood?.kind===active){const delta=position.clone().sub(previousFood.position),maximum=1.35*dt;
        if(delta.length()>maximum){const correction=delta.setLength(maximum).add(previousFood.position).sub(position),local=group.worldToLocal(correction.clone()).sub(group.worldToLocal(v()));arms[0].hand.group.position.add(local);prop.position.add(local);group.updateMatrixWorld(true);}
      }
      previousFood={kind:active,position:prop.getWorldPosition(v())};
    }else previousFood=null;
    previousHandPositions=arms.map(arm=>arm.hand.group.position.clone());
    if(authored&&extension<.001){applyAuthored(clamp(Number(animationPose.weight)||0,0,1));group.userData.authoredAnimation=true;}
  }
  update(0);return{group,update,getHand:side=>arms[side==='left'?0:1].hand,getFocus(){return focus;},getDebug(){
    const camera=group.userData.viewCamera||(group.parent?.isCamera?group.parent:null),prop=props[active];
    const position=prop.getWorldPosition(v(0,0,0));if(camera)position.project(camera);
    return{palmsOnly:!arms[0].hand.group.userData.shortForearm,idleHandsVisible:extension<.001,focus:Number(focus.toFixed(3)),extension:Number(extension.toFixed(3)),active,visible:prop.visible,propNDC:position.toArray().map(n=>Number(n.toFixed(3))),groupPitch:Number(group.rotation.x.toFixed(3)),foodPhase:Number(foodPhase.toFixed(3)),foodAmount:Number(foodAmount.toFixed(3)),penWriteBlend,penAge,bookBlend,drawerBlend,authoredAnimation:Boolean(group.userData.authoredAnimation),articulation:articulation.map(rig=>rig.diagnostics())};
  }};
}
