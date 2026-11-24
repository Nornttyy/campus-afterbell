// Small skinned garment fittings, authored in the original Tripo bind-pose metres.
// Colours sample the character's own atlas. Each classmate clone shares one mesh.
import * as T from './vendor/three.module.js';

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

export function fitUniform(model,variant){
 const fit=fits[variant];if(!fit)return;
 model.updateMatrixWorld(true);
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||mesh.geometry.userData.uniformFitted)return;
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
  geometry.setIndex([...geometry.index.array,...indices]);geometry.userData.uniformFitted=true;
 });
}
