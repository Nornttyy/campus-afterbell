import * as T from './vendor/three.module.js';

// Tripo's automatically assigned thigh weights reach above the waistband on
// all five rigs. Correct the imported template before making actor instances.
export function repairJacketWeights(model){
 model.updateWorldMatrix(true,true);
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||mesh.geometry.userData.jacketFitted)return;
  const g=mesh.geometry,{position,skinIndex,skinWeight}=g.attributes;
  const bones=mesh.skeleton.bones,names=bones.map(b=>b.name.replace(/^mixamorig[:_]?/,''));
  const hips=names.indexOf('Hips'),spine=names.indexOf('Spine1');
  if(hips<0||spine<0)return;
  const legs=new Set(names.map((name,i)=>/^(Left|Right)(UpLeg|Leg)$/.test(name)?i:-1).filter(i=>i>=0));
  const point=new T.Vector3(),hipY=bones[hips].getWorldPosition(point).y;
  const waistY=bones[spine].getWorldPosition(point).y;
  for(let v=0;v<position.count;v++){
   const y=point.fromBufferAttribute(position,v).applyMatrix4(mesh.matrixWorld).y;
   const blend=T.MathUtils.smoothstep(y,hipY-.035,hipY+.052);
   if(blend===0)continue;
   let transfer=0;
   const weights=new Map();
   for(let j=0;j<4;j++){
    const id=skinIndex.getComponent(v,j),weight=skinWeight.getComponent(v,j);
    if(weight===0)continue;
    const take=legs.has(id)?weight*blend:0;
    transfer+=take;weights.set(id,(weights.get(id)||0)+weight-take);
   }
   if(transfer<.0001)continue;
   const chest=T.MathUtils.smoothstep(y,hipY+.025,waistY+.005);
   weights.set(hips,(weights.get(hips)||0)+transfer*(1-chest));
   weights.set(spine,(weights.get(spine)||0)+transfer*chest);
   const kept=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4);
   const total=kept.reduce((s,entry)=>s+entry[1],0);
   for(let j=0;j<4;j++){
    skinIndex.setComponent(v,j,kept[j]?.[0]??hips);
    skinWeight.setComponent(v,j,(kept[j]?.[1]??0)/total);
   }
  }
  skinIndex.needsUpdate=true;skinWeight.needsUpdate=true;g.userData.jacketFitted=true;
 });
}
