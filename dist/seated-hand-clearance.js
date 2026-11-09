import * as T from './vendor/three.module.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Q=()=>new T.Quaternion();
// DeskBody's actual metre-space top is .87496; its rear edge is -.42436
// from a desk centre .78 ahead of the seated actor. Work in actor space so
// reversed seats and raised classroom floors receive the identical correction.
const top=.8775,edge=.35564;
export function createSeatedHandClearance(group,bones){
 const saved=new Map(),samples={Left:[],Right:[]},meshes=[],directions=[];
 for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++)for(let z=-2;z<=2;z++)if(x||y||z)directions.push(V(x,y,z).normalize());
 group.updateMatrixWorld(true);
 group.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;meshes.push(mesh);mesh.skeleton.update();const {skinIndex,skinWeight}=mesh.geometry.attributes,byBone=new Map();
  for(let i=0;i<skinIndex.count;i++){
   let weight=0,joint=0;for(let k=0;k<4;k++)if(skinWeight.getComponent(i,k)>weight){weight=skinWeight.getComponent(i,k);joint=skinIndex.getComponent(i,k);}
   const bone=mesh.skeleton.bones[joint],name=bone.name.replace(/^mixamorig[:_]?/,'');if(!/^(Left|Right)(Hand|ForeArm)/.test(name))continue;
   let row=byBone.get(bone);if(!row){row={side:name.startsWith('Left')?'Left':'Right',scores:directions.map(()=>-Infinity),indices:[]};byBone.set(bone,row);}
   const p=bone.worldToLocal(mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld));
   directions.forEach((d,k)=>{const score=p.dot(d);if(score>row.scores[k]){row.scores[k]=score;row.indices[k]=i;}});
  }
  for(const row of byBone.values())for(const index of new Set(row.indices))samples[row.side].push({mesh,index});
 });
 const point=V(),inverse=new T.Matrix4();
 function measure(side,padding){
  let lift=0;
  for(const sample of samples[side]){
   sample.mesh.getVertexPosition(sample.index,point).applyMatrix4(sample.mesh.matrixWorld).applyMatrix4(inverse);
   if(Math.abs(point.x)>.604||point.z>1.21)continue;
   // During clip interpolation a 12mm allowance covers blended skin between
   // cached support vertices; settled authored writing contact stays exact.
   // A short clearance ramp behind the solid edge anticipates finger rotation
   // instead of waiting for the first vertex to enter the slab and snapping up.
   const height=top+padding-2.5*Math.max(0,edge-point.z);lift=Math.max(lift,height-point.y);
  }
  return lift;
 }
 function save(b){if(!saved.has(b))saved.set(b,b.quaternion.clone());}
 function aim(b,child,target){const origin=b.getWorldPosition(V()),delta=Q().setFromUnitVectors(child.getWorldPosition(V()).sub(origin).normalize(),target.clone().sub(origin).normalize()),parent=b.parent.getWorldQuaternion(Q());save(b);b.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));group.updateMatrixWorld(true);}
 function raise(side,lift){
  const arm=bones[side+'Arm'],fore=bones[side+'ForeArm'],hand=bones[side+'Hand'],root=arm.getWorldPosition(V()),middle=fore.getWorldPosition(V()),end=hand.getWorldPosition(V()),rotation=hand.getWorldQuaternion(Q());
  const target=end.clone().add(V(0,lift,0).applyQuaternion(group.getWorldQuaternion(Q()))),upper=root.distanceTo(middle),lower=middle.distanceTo(end),direction=target.clone().sub(root),distance=T.MathUtils.clamp(direction.length(),Math.abs(upper-lower)+.001,upper+lower-.001);direction.normalize();
  const pole=middle.clone().sub(root).addScaledVector(direction,-middle.clone().sub(root).dot(direction)).normalize(),along=(upper*upper+distance*distance-lower*lower)/(2*distance),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  save(hand);aim(arm,fore,root.clone().addScaledVector(direction,along).addScaledVector(pole,height));aim(fore,hand,root.clone().addScaledVector(direction,distance));hand.quaternion.copy(hand.parent.getWorldQuaternion(Q()).invert().multiply(rotation));group.updateMatrixWorld(true);
 }
 return{
  restore(){for(const[b,q]of saved)b.quaternion.copy(q);saved.clear();},
  apply({seated,crawling,restraint,transition=0,settledSupport=false}){
   if(!seated||crawling||restraint!=='free'||settledSupport)return;
   // Calibrated Sit/Write endpoints already have exact page/table contact.
   // Most classroom actors stay there, so they incur no per-frame skin scan.
   group.updateMatrixWorld(true);inverse.copy(group.matrixWorld).invert();
   for(let pass=0;pass<3;pass++){
    for(const mesh of meshes)mesh.skeleton.update();
    const padding=Math.min(.012,transition*.16),left=measure('Left',padding),right=measure('Right',padding);
    if(Math.max(left,right)<.00005)break;
    if(left>.00005)raise('Left',left+.0001);
    if(right>.00005)raise('Right',right+.0001);
   }
  },
  diagnostics(){return {samples:samples.Left.length+samples.Right.length};}
 };
}
