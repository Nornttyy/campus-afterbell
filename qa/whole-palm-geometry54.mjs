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
 const rig=createFingerRig(group,bones,side),frame=handFrame(bones,side),groups={Index:[],Middle:[],Pinky:[],Thumb:[],Palm:[]},meshes=[],inverse=group.matrixWorld.clone().invert();
 group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;meshes.push(mesh);const ix=mesh.geometry.attributes.skinIndex,wt=mesh.geometry.attributes.skinWeight;mesh.skeleton.update();
  for(let i=0;i<ix.count;i++){let strongest=0,key='';for(let k=0;k<4;k++)if(wt.getComponent(i,k)>strongest){strongest=wt.getComponent(i,k);key=mesh.skeleton.bones[ix.getComponent(i,k)].name.replace(/^mixamorig[:_]?/,'');}if(strongest<=0)continue;const finger=['Index','Middle','Pinky','Thumb'].find(f=>key.startsWith(side+'Hand'+f));
   if(finger)groups[finger].push({mesh,i,pad:key.endsWith('3'),segment:Number(key.slice(-1))});else if(key===side+'Hand'||key.startsWith(side+'HandRing'))groups.Palm.push({mesh,i,pad:true});
  }
 });
 const allGroups={...groups};function resample(count){for(const key of Object.keys(groups)){const all=allGroups[key];groups[key]=Array.from({length:Math.min(count,all.length)},(_,i)=>all[Math.floor(i*all.length/Math.min(count,all.length))]);}}resample(samples);
 const chains={};for(const finger of ['Index','Middle','Pinky','Thumb','Ring']){const digits=rig.digits.filter(d=>d.finger===finger),base=digits[0],inv=base.bone.getWorldQuaternion(Q()).invert();chains[finger]={digits,spread:frame.normal.clone().applyQuaternion(inv),opposition:frame.along.clone().applyQuaternion(inv)};}
 return {bones,groups,chains,resample,
  pose(finger,values){const chain=chains[finger];chain.digits.forEach((d,i)=>{d.bone.quaternion.copy(d.rest).multiply(Q().setFromAxisAngle(d.axis,values[i]));if(i===0){d.bone.quaternion.multiply(Q().setFromAxisAngle(chain.spread,values[3]||0));if(finger==='Thumb')d.bone.quaternion.multiply(Q().setFromAxisAngle(chain.opposition,values[4]||0));}});},
  points(finger){group.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();inverse.copy(group.matrixWorld).invert();return groups[finger].map(({mesh,i,pad,segment})=>{const point=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);point.pad=pad;point.segment=segment;return point;});},
 };
}
