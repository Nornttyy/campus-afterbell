// Small skinned garment fittings, authored in the original Tripo bind-pose metres.
// Colours sample the character's own atlas. Each classmate clone shares one mesh.
import * as T from './vendor/three.module.js';
import {refitSchoolBob} from './student-hair109.js?v=campus-109';
import {repairJacketWeights} from './character-jacket106.js';

const fits={
 boy:{badge:[.136,1.038,.024,.031],zip:[.101,.698],palette:[ [.25214,.97129],[.25253,.96964],[.92092,.33274],[.67239,.91383],[.64916,.89361],[.63708,.95106] ]},
 girl:{badge:[.099,1.063,.022,.030],zip:[.001,1.146],palette:[ [.27259,.04877],[.28288,.05533],[.88883,.34727],[.54623,.11198],[.10418,.90447],[.19398,.66186] ]},
 glasses:{badge:[.143,1.018,.024,.031],zip:[.094,.699],palette:[ [.98608,.39412],[.92519,.12972],[.55234,.53658],[.70492,.05849],[.29870,.93510],[.30510,.93136] ]},
 ponytail:{badge:[.089,1.030,.026,.031],zip:[-.003,1.118],palette:[ [.29949,.13215],[.30248,.13566],[.28928,.75288],[.08936,.66417],[.38032,.63392],[.94675,.05240] ]},
 teacher:{palette:[null,null,null,[.05743,.20655],[.27143,.98442],[.05263,.19180]]}
};

function frontSampler(mesh){
 const g=mesh.geometry,p=g.attributes.position,points=[],faces=[];
 for(let i=0;i<p.count;i++)points.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld));
 for(let i=0;i<g.index.count;i+=3){
  const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)],v=ids.map(id=>points[id]);
  if(v.every(q=>q.y<.65)||v.every(q=>q.y>1.37)||v.every(q=>q.x<-.04)||v.every(q=>q.x>.20)||v.every(q=>q.z<0))continue;
  faces.push({ids,v});
 }
 return (x,y)=>{
  let best=null;
  for(const {ids,v:[a,b,c]} of faces){
   const det=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
   if(Math.abs(det)<1e-10)continue;
   const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/det;
   const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/det,w=1-u-v;
   if(Math.min(u,v,w)<-.00001)continue;
   const z=u*a.z+v*b.z+w*c.z;
   if(!best||z>best.z)best={z,ids,weights:[u,v,w]};
  }
  return best;
 };
}

function fittings(fit,point,triangle){
 const quad=(a,b,c,d,color)=>{triangle(a,b,c,color);triangle(a,c,d,color);};
 const loop=(x,y,rx,ry,depth,outline)=>outline.map(([u,v])=>point(x+rx*u,y+ry*v,depth));
 function join(a,b,color){
  for(let i=0;i<a.length;i++){const j=(i+1)%a.length;quad(a[i],a[j],b[j],b[i],color);}
 }
 if(fit.badge){
  const [x,y,rx,ry]=fit.badge;
  const shield=[[0,1],[-.72,.94],[-1,.51],[-.88,-.32],[-.48,-.76],[0,-1],[.48,-.76],[.88,-.32],[1,.51],[.72,.94]];
  const edge=loop(x,y,rx,ry,.0018,shield),face=loop(x,y,rx*.88,ry*.90,.0038,shield);
  join(edge,face,0);
  const center=point(x,y,.0055);
  for(let i=0;i<face.length;i++)triangle(center,face[i],face[(i+1)%face.length],1);
  // Two pages of an open book, stitched on the gold patch.
  for(const side of [-1,1]){
   const corners=[[.06,-.33],[.59,-.10],[.57,.43],[.06,.21]];
   const leaf=corners.map(([u,v])=>point(x+side*u*rx,y+v*ry,.0061));
   if(side<0)leaf.reverse();
   quad(...leaf,2);
  }
  const [zx,zy]=fit.zip;
  const tab=[[-1,-1],[1,-1],[1,1],[-1,1]];
  const pivot=loop(zx,zy,.008,.008,.004,tab);
  quad(...pivot,3);
  const outer=loop(zx+.002,zy-.013,.0075,.016,.009,tab);
  const inner=loop(zx+.002,zy-.015,.003,.008,.0094,tab);
  join(outer,inner,4); // The hole exposes the jacket beneath the pull.
 }else{
  // A capped pen peeks over the teacher's pocket. The end inside the pocket
  // disappears into the cloth while the return at the tip of the clip sits proud.
  const x=.102,levels=[[1.257,.0045,.002],[1.301,.0062,.008],[1.316,.0068,.011],[1.327,.0058,.011]];
  const rings=levels.map(([y,r,d])=>Array.from({length:8},(_,i)=>{
   const a=-2*Math.PI*i/8;return point(x+Math.cos(a)*r,y,d+Math.sin(a)*r);
  }));
  for(let k=1;k<rings.length;k++)join(rings[k-1],rings[k],k===2?3:5);
  const cap=point(x,1.328,.011);
  for(let i=0;i<8;i++)triangle(cap,rings[3][i],rings[3][(i+1)%8],5);
  quad(point(x-.001,1.290,.013),point(x+.003,1.291,.014),point(x+.005,1.320,.020),point(x,1.320,.021),4);
 }
}

// Work on the imported bind-pose surface before cloning classmates. UV seams
// have duplicate indices; moving those indices together keeps the cuff closed.
function softenSilhouettes(mesh,variant){
 const {position,normal,skinIndex,skinWeight}=mesh.geometry.attributes;
 const bones=mesh.skeleton.bones,teacher=variant==='teacher';
 const joint=teacher?'ForeArm':'Hand';
 const anchors=bones.filter(b=>b.name.endsWith('Left'+joint)||b.name.endsWith('Right'+joint)).map(b=>b.getWorldPosition(new T.Vector3()));
 const sleeveJoint=bones.map(b=>teacher?/Arm$/.test(b.name):/ForeArm$/.test(b.name));
 const inverse=mesh.matrixWorld.clone().invert(),toLocal=new T.Matrix3().getNormalMatrix(inverse);
 const points=[],byPosition=new Map(),nodes=[],up=new T.Vector3(),surface=new T.Vector3(),side=new T.Vector3();
 for(let i=0;i<position.count;i++){
  const p=new T.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
  points.push(p);
  const crown=teacher?0:T.MathUtils.smoothstep(p.y,variant==='ponytail'?1.53:1.59,variant==='ponytail'?1.63:1.69);
  let cloth=0;
  if(anchors.some(a=>a.distanceToSquared(p)<.15*.15)){
   for(let k=0;k<4;k++)if(sleeveJoint[skinIndex.getComponent(i,k)])cloth+=skinWeight.getComponent(i,k);
  }
  const weight=Math.max(crown,T.MathUtils.smoothstep(cloth,.35,.84));
  if(!weight)continue;
  const key=[p.x,p.y,p.z].map(v=>Math.round(v*1e5)).join('/');
  let node=byPosition.get(key);
  if(!node){node={p,weight,neighbors:new Map(),normal:new T.Vector3(),indices:[]};byPosition.set(key,node);}
  node.indices.push(i);nodes[i]=node;
 }
 const idx=mesh.geometry.index.array;
 for(let i=0;i<idx.length;i+=3){
  const a=idx[i],b=idx[i+1],c=idx[i+2];
  if(!nodes[a]&&!nodes[b]&&!nodes[c])continue;
  surface.subVectors(points[b],points[a]).cross(side.subVectors(points[c],points[a]));
  for(const [j,k,l] of [[a,b,c],[b,c,a],[c,a,b]]){
   const node=nodes[j];if(!node)continue;
   node.normal.add(surface);node.neighbors.set(nodes[k]||k,points[k]);node.neighbors.set(nodes[l]||l,points[l]);
  }
 }
 const authored=new T.Vector3();
 for(const node of byPosition.values()){
  if(!node.neighbors.size||node.normal.lengthSq()<1e-18)continue;
  up.set(0,0,0);for(const v of node.neighbors.values())up.add(v);
  up.divideScalar(node.neighbors.size).sub(node.p);
  node.normal.normalize();
  // Round only the normal component so the cut line at the wrist stays put.
  const distance=T.MathUtils.clamp(up.dot(node.normal)*.58,-.008,.008)*node.weight;
  up.copy(node.p).addScaledVector(node.normal,distance).applyMatrix4(inverse);
  node.normal.applyMatrix3(toLocal).normalize();
  for(const i of node.indices){
   position.setXYZ(i,up.x,up.y,up.z);
   authored.fromBufferAttribute(normal,i);
   if(authored.dot(node.normal)>.42){
    authored.lerp(node.normal,.55*node.weight).normalize();normal.setXYZ(i,authored.x,authored.y,authored.z);
   }
  }
 }
 position.needsUpdate=true;normal.needsUpdate=true;mesh.geometry.computeBoundingSphere();
}

// The scan carries raised, irregular moustache ridges. Relax this narrow
// strip onto the upper lip measured at six cross sections. The grin, nose
// and surrounding jaw keep their existing silhouette.
function smoothTeacherLip(mesh){
 const samples=[[0,.282],[.045,.273],[.090,.246],[.135,.213],[.16,.187],[.19,.148]];
 const {position,normal}=mesh.geometry.attributes,rest=mesh.matrixWorld;
 const local=rest.clone().invert(),toLocal=new T.Matrix3().getNormalMatrix(local);
 const point=new T.Vector3(),targetNormal=new T.Vector3(),authored=new T.Vector3();
 for(let i=0;i<position.count;i++){
  point.fromBufferAttribute(position,i).applyMatrix4(rest);
  const x=Math.abs(point.x),axis=1.680+.73*x*x,dy=point.y-axis;
  if(x>=.187||Math.abs(dy)>.031||point.z<.144)continue;
  const j=samples.findIndex(pair=>pair[0]>x),[a,b]=[samples[j-1],samples[j]];
  const slope=(b[1]-a[1])/(b[0]-a[0]);
  const z=a[1]+slope*(x-a[0])+.26*dy;
  if(Math.abs(z-point.z)>.036)continue;
  const w=(1-T.MathUtils.smoothstep(Math.abs(dy),.013,.031))*(1-T.MathUtils.smoothstep(x,.16,.187));
  point.z+=.79*w*(z-point.z);point.applyMatrix4(local);
  position.setXYZ(i,point.x,point.y,point.z);
  targetNormal.set(-slope*Math.sign(point.x),-.26,1).applyMatrix3(toLocal).normalize();
  authored.fromBufferAttribute(normal,i).lerp(targetNormal,.91*w).normalize();
  normal.setXYZ(i,authored.x,authored.y,authored.z);
 }
 position.needsUpdate=normal.needsUpdate=true;
}
// Fit the school jacket around the forearm axis. Both UV copies of a seam
// move by the same distance; the hand, its knuckles and their grip are intact.
function fitStudentDetails(mesh,variant){
 if(variant==='teacher'){smoothTeacherLip(mesh);return;}
 const {position}=mesh.geometry.attributes,inverse=mesh.matrixWorld.clone().invert();
 const joints=mesh.skeleton.bones,point=new T.Vector3(),delta=new T.Vector3();
 const cuffs=['Left','Right'].map(side=>{
  const joint=suffix=>joints.find(b=>b.name.endsWith(side+suffix)).getWorldPosition(new T.Vector3());
  const wrist=joint('Hand');
  return {wrist,axis:wrist.clone().sub(joint('ForeArm')).normalize()};
 });
 const edge={boy:-.484,girl:-.500,glasses:-.504,ponytail:-.481}[variant];
 const smooth=T.MathUtils.smoothstep;
 for(let i=0;i<position.count;i++){
  point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
  const x=Math.abs(point.x),y=point.y,z=point.z;
  if(variant!=='girl'&&x>.210&&y>1.20&&y<1.50&&Math.abs(z+.030)<.16){
   const above=variant==='ponytail'?1.29:1.35;
   const lobe=smooth(x,.214,.288)*(1-smooth(Math.abs(z+.025),.060,.15))*(1-smooth(Math.abs(y-above),.071,.115));
   point.x-=Math.sign(point.x)*.027*lobe;point.y+=(above-y)*.22*lobe;
  }
  if(x>.27&&y<1.0&&y>.64){
   const t=.48*x-.877*y-edge;
   const taper=smooth(t,-.095,-.037)*(1-smooth(t,-.011,.001));
   const cuff=cuffs[point.x>0?0:1];delta.copy(point).sub(cuff.wrist);
   delta.addScaledVector(cuff.axis,-delta.dot(cuff.axis));
   point.addScaledVector(delta,-.16*taper);
  }
  if(variant==='glasses'&&y>1.53&&y<1.77&&z>.125){
   const t=T.MathUtils.clamp((y-1.53)/.23,0,1);
   const gap=Math.min(Math.abs(point.x+.111-.031*t),Math.abs(point.x-.035+.025*t));
   const groove=(1-smooth(gap,.001,.018))*(1-t)*smooth(z,.12,.19);
   point.z-=.015*groove;point.y+=.007*groove;
  }
  point.applyMatrix4(inverse);position.setXYZ(i,point.x,point.y,point.z);
 }
 position.needsUpdate=true;mesh.geometry.computeBoundingSphere();
}

export function fitUniform(model,variant){
 const fit=fits[variant];if(!fit)return;
 repairJacketWeights(model);
 model.updateMatrixWorld(true);
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||mesh.geometry.userData.uniformFitted)return;
  fitStudentDetails(mesh,variant);
  if(variant==='girl')refitSchoolBob(mesh);
  softenSilhouettes(mesh,variant);
  const geometry=mesh.geometry,attributes=geometry.attributes,sample=frontSampler(mesh);
  const inverse=mesh.matrixWorld.clone().invert(),normalToLocal=new T.Matrix3().getNormalMatrix(inverse);
  const extra=Object.fromEntries(Object.keys(attributes).map(k=>[k,[]])),cache=new Map(),indices=[];
  const point=(x,y,lift)=>{
   const key=x+':'+y;let s=cache.get(key);
   if(!s){s=sample(x,y);if(!s)throw Error('Uniform fitting outside '+variant+' jacket');cache.set(key,s);}
   return {p:new T.Vector3(x,y,s.z+lift),s};
  };
  function vertex(v,normal,color){
   const local=v.p.clone().applyMatrix4(inverse),weights=new Map();
   for(let i=0;i<3;i++)for(let j=0;j<4;j++){
    const id=v.s.ids[i],joint=attributes.skinIndex.getComponent(id,j);
    const weight=attributes.skinWeight.getComponent(id,j)*v.s.weights[i];
    if(weight>0)weights.set(joint,(weights.get(joint)||0)+weight);
   }
   const joints=[...weights.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);
   const sum=joints.reduce((s,j)=>s+j[1],0);
   while(joints.length<4)joints.push([0,0]);
   if(extra.campusOcclusion)extra.campusOcclusion.push(v.s.ids.reduce((sum,id,i)=>sum+attributes.campusOcclusion.getX(id)*v.s.weights[i],0));
   extra.position.push(...local.toArray());extra.normal.push(...normal.toArray());
   extra.uv.push(...fit.palette[color]);extra.skinIndex.push(...joints.map(j=>j[0]));extra.skinWeight.push(...joints.map(j=>j[1]/sum));
  }
  function triangle(a,b,c,color){
   const n=T.Triangle.getNormal(a.p,b.p,c.p,new T.Vector3()).applyMatrix3(normalToLocal).normalize();
   const start=attributes.position.count+extra.position.length/3;indices.push(start,start+1,start+2);
   for(const v of [a,b,c])vertex(v,n,color);
  }
  fittings(fit,point,triangle);
  for(const [name,attr] of Object.entries(attributes)){
   // These five attributes are common to all five released rigs.
   const values=extra[name];if(!values.length)throw Error('Unsupported uniform attribute '+name);
   const array=attr.isInterleavedBufferAttribute?attr.data.array:attr.array;
   const result=new T.BufferAttribute(new array.constructor(attr.count*attr.itemSize+values.length),attr.itemSize,attr.normalized);
   for(let i=0;i<attr.count;i++)for(let j=0;j<attr.itemSize;j++)result.setComponent(i,j,attr.getComponent(i,j));
   for(let k=0;k<values.length;k++)result.setComponent(attr.count+Math.floor(k/attr.itemSize),k%attr.itemSize,values[k]);
   geometry.setAttribute(name,result);
  }
  if(variant!=='teacher'){
   // Apply the same jacket fit to the stitched zipper, badge and original shirt.
   const positions=geometry.attributes.position,point=new T.Vector3();
   for(let i=0;i<positions.count;i++){
    point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
    const torso=T.MathUtils.smoothstep(point.y,.57,.77)*(1-T.MathUtils.smoothstep(point.y,1.08,1.23))*(1-T.MathUtils.smoothstep(Math.abs(point.x),.19,.29));
    point.x*=1+.09*torso;point.z*=1+.075*torso;point.applyMatrix4(inverse);positions.setXYZ(i,point.x,point.y,point.z);
   }
   positions.needsUpdate=true;geometry.computeBoundingSphere();
  }
  geometry.setIndex([...geometry.index.array,...indices]);geometry.userData.uniformFitted=true;
 });
}
