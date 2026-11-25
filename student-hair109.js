import * as T from './vendor/three.module.js';

// Hair vertices selected on student-girl-v4's authored UV atlas, little-endian
// bit order. Vertex IDs survive both the original and classroom index buffers.
// Mixed triangles (skin at the hairline) remain connected to the original face.
const bobSelection='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgNkAAAAAAEDz////fwEA+P//////TwQAAHgAABYAAAAAAAAAAAAAgP//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////9//////5//////7////////////3/sP//////////////y8AQAAAAAAAAAAAAAAAAAAAAAAAAAAA/////////////98PAID///////8Hj/T//////////3////////////////////////////8DAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOD/////fwH//+/p///////////v9//fAPt/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAID////////3+/7//////////////////////9//////+w8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

function bobSurface(){
 const points=[],tones=[],occlusion=[],indices=[];
 const uvHair=[.2280826,.0921907],uvEar=[.8317871,.17456055];
 const smooth=T.MathUtils.smoothstep;
 const add=(p,uv,ao)=>{points.push(...p);tones.push(...uv);occlusion.push(ao);return points.length/3-1;};
 const angles=new Set(Array.from({length:36},(_,i)=>10*i-180));
 const parts=[-31,-8,22];
 for(const cut of parts)for(const offset of [-3,0,3])angles.add(cut+offset);
 for(const edge of [-57,-50,-47,47,50,57])angles.add(edge);
 const ringAngles=[...angles].sort((a,b)=>a-b);
 const rings=[],ears=[];
 // A single continuous cap, with thickness around its straight hem. At the
 // temples the hem turns down from the bangs to the side panels.
 for(let row=0;row<12;row++){
  const ring=[];
  for(const deg of ringAngles){
   const a=deg*Math.PI/180,side=smooth(Math.abs(deg),47,57);
   const notch=parts.reduce((h,cut)=>Math.max(h,.055*(1-smooth(Math.abs(deg-cut),0,3))),0);
   const hem=T.MathUtils.lerp(1.523+notch,1.208+.013*Math.cos(a),side);
   const topRadius=.298-.008*Math.cos(a);
   const edgeRadius=.301-.021*side;
   const profile=[
    [hem+.022,edgeRadius-.071,.50],[hem+.002,edgeRadius-.017,.38],
    [hem+.003,edgeRadius,.17],[hem+Math.min(.026,(1.616-hem)*.26),edgeRadius+.004,.06],
    [T.MathUtils.lerp(hem,1.616,.20),T.MathUtils.lerp(edgeRadius,topRadius,.36)+.017*side,.065],
    [T.MathUtils.lerp(hem,1.616,.435),T.MathUtils.lerp(edgeRadius,topRadius,.59)+.021*side,.018],
    [T.MathUtils.lerp(hem,1.616,.70),T.MathUtils.lerp(edgeRadius,topRadius,.78)+.012*side,.005],
    [1.616,topRadius,0],[1.686,.267,0],[1.740,.212,0],[1.773,.143,0],[1.787,.068,0]
   ];
   const [y,r,ao]=profile[row];
   const x=Math.sin(a)*r*(1+.016*Math.cos(4*a));
   const z=-.046+Math.cos(a)*r*(1+.014*Math.cos(4*a))+.018*smooth(y,1.62,1.78);
   ring.push(add([x,y,z],uvHair,ao));
  }
  if(rings.length){
   const below=rings.at(-1);
   for(let i=0;i<ring.length;i++){
    const j=(i+1)%ring.length;
    if(row===5&&(ringAngles[i]===80||ringAngles[i]===-90)){
     ears.push({corners:[below[i],below[j],ring[j],ring[i]],sign:Math.sign(ringAngles[i])});
    }else indices.push(below[i],below[j],ring[i],below[j],ring[j],ring[i]);
   }
  }
  rings.push(ring);
 }
 const underneath=add([0,1.295,-.048],uvHair,.58),first=rings[0];
 for(let i=0;i<first.length;i++)indices.push(first[i],underneath,first[(i+1)%first.length]);
 const crown=add([0,1.793,-.027],uvHair,0),last=rings.at(-1);
 for(let i=0;i<last.length;i++)indices.push(last[i],last[(i+1)%last.length],crown);
 // Build the ear inside an opening in the side panel. All four edges of the
 // opening share their actual hair vertices; the skin rolls back under its lip.
 const outline=[[.17,.07],[.73,.05],[.93,.20],[.91,.72],[.77,.93],[.28,.95],[.07,.81],[.07,.26]];
 for(const {corners,sign} of ears){
  const patch=(u,v,depth,uv,ao)=>{
   const [bl,br,tr,tl]=corners;
   const p=[0,1,2].map(k=>T.MathUtils.lerp(T.MathUtils.lerp(points[3*bl+k],points[3*br+k],u),T.MathUtils.lerp(points[3*tl+k],points[3*tr+k],u),v));
   p[0]+=sign*depth;
   return add(p,uv,ao);
  };
  const join=(a,b)=>{
   for(let i=0;i<8;i++){
    const j=(i+1)%8;
    if(a[i]!==a[j])indices.push(a[i],a[j],b[i]);
    indices.push(a[j],b[j],b[i]);
   }
  };
  const boundary=[0,1,1,2,2,3,3,0].map(i=>corners[i]);
  const cut=outline.map(([u,v])=>patch(u,v,-.001,uvHair,.16));
  const inner=outline.map(([u,v])=>patch(.5+(u-.5)*.95,.5+(v-.5)*.94,-.010,uvHair,.45));
  join(boundary,cut);join(cut,inner);
  const flesh=outline.map(([u,v])=>patch(.5+(u-.5)*.95,.5+(v-.5)*.94,-.010,uvEar,.23+.14*v));
  const lobe=outline.map(([u,v])=>patch(.46+(u-.5)*.73,.44+(v-.5)*.72,-.003,uvEar,.065+.075*v));
  join(flesh,lobe);
  const centre=patch(.45,.42,.001,uvEar,.03);
  for(let i=0;i<8;i++)indices.push(lobe[i],lobe[(i+1)%8],centre);
 }
 const surface=new T.BufferGeometry();
 surface.setAttribute('position',new T.Float32BufferAttribute(points,3));
 surface.setIndex(indices);surface.computeVertexNormals();
 return {surface,tones,occlusion};
}

export function refitSchoolBob(mesh){
 const g=mesh.geometry;
 if(g.userData.schoolBob||g.attributes.position.count!==5977)return;
 const head=mesh.skeleton.bones.findIndex(b=>b.name.endsWith('Head'));
 if(head<0)return;
 const mask=Uint8Array.from(atob(bobSelection),c=>c.charCodeAt(0));
 const isHair=id=>Boolean(mask[id>>3]&(1<<(id&7)));
 const {surface,tones,occlusion}=bobSurface(),index=g.index.array,kept=[];
 for(let i=0;i<index.length;i+=3){
  if(!isHair(index[i])||!isHair(index[i+1])||!isHair(index[i+2]))kept.push(index[i],index[i+1],index[i+2]);
 }
 const original=g.attributes.position.count,inverse=mesh.matrixWorld.clone().invert();
 const p=new T.Vector3(),pos=g.attributes.position;
 // Tuck remnants of the old pointed side locks under the new hem. Their
 // mixed skin triangles seal the inside rim when seen from below.
 for(let i=0;i<original;i++)if(isHair(i)){
  p.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
  p.x*=.89;p.z=-.046+(p.z+.046)*.89;
  p.y=1.48+(p.y-1.48)*.85;p.applyMatrix4(inverse);
  pos.setXYZ(i,p.x,p.y,p.z);
 }
 surface.applyMatrix4(inverse);
 const count=surface.attributes.position.count;
 for(const [name,attr] of Object.entries(g.attributes)){
  const values=new T.BufferAttribute(new (attr.array??attr.data.array).constructor((original+count)*attr.itemSize),attr.itemSize,attr.normalized);
  for(let i=0;i<original;i++)for(let k=0;k<attr.itemSize;k++)values.setComponent(i,k,attr.getComponent(i,k));
  for(let i=0;i<count;i++)for(let k=0;k<attr.itemSize;k++){
   let value=0;
   if(surface.attributes[name])value=surface.attributes[name].getComponent(i,k);
   else if(name==='uv')value=tones[i*2+k];
   else if(name==='skinIndex'&&k===0)value=head;
   else if(name==='skinWeight'&&k===0)value=1;
   else if(name==='campusOcclusion')value=occlusion[i];
   values.setComponent(original+i,k,value);
  }
  g.setAttribute(name,values);
 }
 for(const id of surface.index.array)kept.push(original+id);
 g.setIndex(kept);g.computeBoundingBox();g.computeBoundingSphere();surface.dispose();g.userData.schoolBob=true;
}
