import * as T from '../dist/vendor/three.module.js';
import {createFingerRig,handFrame} from '../dist/hand-motion.js';
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
export function propSurface(prop){
 prop.updateMatrixWorld(true);const inverse=prop.matrixWorld.clone().invert(),triangles=[];
 prop.traverse(mesh=>{if(!mesh.isMesh)return;const transform=inverse.clone().multiply(mesh.matrixWorld),p=mesh.geometry.attributes.position,ix=mesh.geometry.index;
  for(let i=0;i<(ix?.count||p.count);i+=3){const vertices=[0,1,2].map(k=>V().fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(transform)),triangle=new T.Triangle(...vertices),box=new T.Box3().setFromPoints(vertices);triangles.push({triangle,box,center:box.getCenter(V()),normal:triangle.getNormal(V())});}
 });
 function build(rows){const box=new T.Box3();for(const t of rows)box.union(t.box);if(rows.length<12)return{box,rows};const s=box.getSize(V()),axis=s.x>s.y&&s.x>s.z?'x':s.y>s.z?'y':'z';rows.sort((a,b)=>a.center[axis]-b.center[axis]);const half=Math.floor(rows.length/2);return{box,left:build(rows.slice(0,half)),right:build(rows.slice(half))};}
 const tree=build(triangles),closest=V(),boxPoint=V(),result={distance:Infinity,signed:Infinity,point:V(),normal:V()};
 function boxDistance(box,p){return box.clampPoint(p,boxPoint).distanceToSquared(p);}
 function visit(node,p){if(boxDistance(node.box,p)>result.distance)return;if(node.rows){for(const row of node.rows){row.triangle.closestPointToPoint(p,closest);const d=closest.distanceToSquared(p);if(d<result.distance){result.distance=d;result.signed=p.clone().sub(closest).dot(row.normal);result.point.copy(closest);result.normal.copy(row.normal);}}}else{const dl=boxDistance(node.left.box,p),dr=boxDistance(node.right.box,p);if(dl<dr){visit(node.left,p);visit(node.right,p);}else{visit(node.right,p);visit(node.left,p);}}}
 const ray=new T.Ray(),hit=V(),rayDirection=new T.Vector3(.719,.403,.566).normalize();
 function inside(p,direction=rayDirection){ray.set(p,direction);const hits=[];function cast(node){if(!ray.intersectsBox(node.box))return;if(node.rows){for(const row of node.rows){const t=row.triangle;if(ray.intersectTriangle(t.a,t.b,t.c,false,hit)){const d=hit.distanceToSquared(p);if(d>1e-14)hits.push(Math.sqrt(d));}}}else{cast(node.left);cast(node.right);}}cast(tree);hits.sort((a,b)=>a-b);let count=0,previous=-Infinity;for(const h of hits)if(h-previous>1e-6){count++;previous=h;}return count%2===1;}
 return {bounds:tree.box,inside,query(p){result.distance=Infinity;result.signed=Infinity;visit(tree,p);result.distance=Math.sqrt(result.distance);const enclosed=tree.box.containsPoint(p)&&[rayDirection,new T.Vector3(-.431,.811,.395).normalize(),new T.Vector3(.301,-.527,.795).normalize()].filter(d=>inside(p,d)).length>=2;result.signed=enclosed?-result.distance:result.distance;return result;}};
}

export function handSamplingRig(hand,{side='Left',samples=70}={}){
 hand.setCurl(0);const group=hand.group,bones={};group.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});group.updateMatrixWorld(true);
 const rig=createFingerRig(group,bones,side),frame=handFrame(bones,side),groups={Index:[],Middle:[],Pinky:[],Thumb:[],Palm:[],Ring:[]},meshes=[],inverse=group.matrixWorld.clone().invert();
 group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;meshes.push(mesh);const ix=mesh.geometry.attributes.skinIndex,wt=mesh.geometry.attributes.skinWeight;mesh.skeleton.update();
  for(let i=0;i<ix.count;i++){let strongest=0,key='';for(let k=0;k<4;k++)if(wt.getComponent(i,k)>strongest){strongest=wt.getComponent(i,k);key=mesh.skeleton.bones[ix.getComponent(i,k)].name.replace(/^mixamorig[:_]?/,'');}if(strongest<=0)continue;const finger=['Index','Middle','Pinky','Thumb'].find(f=>key.startsWith(side+'Hand'+f));
   if(finger)groups[finger].push({mesh,i,pad:key.endsWith('3'),segment:Number(key.slice(-1))});else if(key===side+'Hand')groups.Palm.push({mesh,i,pad:true});else if(key.startsWith(side+'HandRing'))groups.Ring.push({mesh,i,pad:key.endsWith('3'),segment:Number(key.slice(-1))});
  }
 });
 const allGroups={...groups};function resample(count){for(const key of Object.keys(groups)){const all=allGroups[key];groups[key]=Array.from({length:Math.min(count,all.length)},(_,i)=>all[Math.floor(i*all.length/Math.min(count,all.length))]);}}resample(samples);
 const chains={};for(const finger of ['Index','Middle','Pinky','Thumb','Ring']){const digits=rig.digits.filter(d=>d.finger===finger),base=digits[0],inv=base.bone.getWorldQuaternion(Q()).invert();chains[finger]={digits,spread:frame.normal.clone().applyQuaternion(inv),opposition:frame.along.clone().applyQuaternion(inv)};}
 return {bones,groups,chains,resample,
  pose(finger,values){const chain=chains[finger];chain.digits.forEach((d,i)=>{d.bone.quaternion.copy(d.rest).multiply(Q().setFromAxisAngle(d.axis,values[i]));if(i===0){d.bone.quaternion.multiply(Q().setFromAxisAngle(chain.spread,values[3]||0));if(finger==='Thumb')d.bone.quaternion.multiply(Q().setFromAxisAngle(chain.opposition,values[4]||0));}});},
  points(finger){group.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();inverse.copy(group.matrixWorld).invert();return groups[finger].map(({mesh,i,pad,segment})=>{const point=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);point.pad=pad;point.segment=segment;return point;});},
 };
}

// Check the edges of both meshes so a broad palm triangle crossing the bag
// is detected even when its three vertices are outside the packaging.
export function countGripIntersections(hand,prop){
 const inverse=prop.matrixWorld.clone().invert();
 function triangles(root){
  const result=[];
  root.traverseVisible(mesh=>{
   if(!mesh.isMesh)return;
   const matrix=inverse.clone().multiply(mesh.matrixWorld);
   const geometry=mesh.geometry,index=geometry.index;
   const vertices=Array.from({length:geometry.attributes.position.count},(_,i)=>
    mesh.getVertexPosition(i,V()).applyMatrix4(matrix));
   for(let i=0;i<(index?.count??vertices.length);i+=3){
    const points=[0,1,2].map(j=>vertices[index?index.getX(i+j):i+j]);
    result.push({points,box:new T.Box3().setFromPoints(points)});
   }
  });
  return result;
 }
 const skin=triangles(hand),food=triangles(prop),bounds=new T.Box3();
 for(const triangle of food)bounds.union(triangle.box);
 const ray=new T.Ray(),direction=V(),hit=V();
 function crosses(edges,face){
  for(let i=0;i<3;i++){
   const start=edges[i],end=edges[(i+1)%3],length=direction.subVectors(end,start).length();
   if(length<1e-8)continue;
   ray.set(start,direction.multiplyScalar(1/length));
   if(ray.intersectTriangle(...face,false,hit)&&hit.distanceTo(start)<length-1e-7&&hit.distanceToSquared(start)>1e-14)return true;
  }
  return false;
 }
 let count=0;
 for(const a of skin){
  if(!a.box.intersectsBox(bounds))continue;
  for(const b of food){
   if(a.box.intersectsBox(b.box)&&(crosses(a.points,b.points)||crosses(b.points,a.points)))count++;
  }
 }
 return count;
}

// Sample the inner skin over the metacarpals. A bag dangling from a single
// fingertip can pass a fingertip distance check while missing this patch.
export function palmSeat(rig,hand,prop,surface=propSurface(prop)){
 const inverse=prop.matrixWorld.clone().invert();
 const at=s=>rig.bones['LeftHand'+s].getWorldPosition(V()).applyMatrix4(inverse);
 const wrist=at(''),middle=at('Middle1'),across=at('Index1').sub(at('Pinky1')).normalize();
 const knuckles=at('Index1').lerp(at('Pinky1'),.48).lerp(middle,.2);
 const along=knuckles.clone().sub(wrist).normalize();
 const normal=along.clone().cross(across).normalize();
 if(at('Middle3').sub(middle).dot(normal)<0)normal.negate();
 const center=wrist.clone().lerp(knuckles,.66),triangles=[];
 hand.traverseVisible(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const matrix=inverse.clone().multiply(mesh.matrixWorld),g=mesh.geometry;
  const ids=g.attributes.skinIndex,weights=g.attributes.skinWeight;
  const points=[],onPalm=[];
  for(let i=0;i<ids.count;i++){
   let j=0;for(let k=1;k<4;k++)if(weights.getComponent(i,k)>weights.getComponent(i,j))j=k;
   onPalm.push(mesh.skeleton.bones[ids.getComponent(i,j)].name.endsWith('LeftHand'));
   points.push(mesh.getVertexPosition(i,V()).applyMatrix4(matrix));
  }
  for(let i=0;i<(g.index?.count??points.length);i+=3){
   const indices=[0,1,2].map(k=>g.index?g.index.getX(i+k):i+k);
   if(indices.some(k=>onPalm[k]))triangles.push(indices.map(k=>points[k]));
  }
 });
 const gaps=[],ray=new T.Ray(),hit=V();
 for(const x of [-.012,0,.012])for(const y of [-.012,0,.012]){
  ray.origin.copy(center).addScaledVector(across,x).addScaledVector(along,y).addScaledVector(normal,.08);
  ray.direction.copy(normal).negate();
  let distance=Infinity;
  for(const face of triangles)if(ray.intersectTriangle(...face,false,hit))distance=Math.min(distance,ray.origin.distanceTo(hit));
  if(Number.isFinite(distance))gaps.push(surface.query(ray.at(distance,V())).distance);
 }
 const offset=surface.bounds.getCenter(V()).sub(center);
 return {gaps:gaps.sort((a,b)=>a-b),overhang:offset.addScaledVector(normal,-offset.dot(normal)).length()};
}
