import * as T from './vendor/three.module.js';

// Repeated rigid props keep their original transforms and pickable geometry.
// Only submission to the GPU is shared; animation and selection stay per prop.
function geometryKey(g){
 let h=2166136261;const mix=n=>{h=Math.imul(h^n,16777619);};
 for(const name of ['position','normal','uv','color']){
  const a=g.getAttribute(name);if(!a){mix(0);continue;}mix(a.count);mix(a.itemSize);
  const bytes=new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength);
  for(const b of bytes)mix(b);
 }
 if(g.index)for(const n of g.index.array)mix(n);
 return h>>>0;
}
export function instanceRigidProps(groups,parent){
 const buckets=new Map(),sources=[],hidden=new T.Matrix4().makeScale(0,0,0);
 for(const group of groups)group.traverse(source=>{
  if(!source.isMesh||source.isSkinnedMesh||!source.visible||Array.isArray(source.material))return;
  const key=[source.material.uuid,geometryKey(source.geometry),source.castShadow,source.receiveShadow].join(':');
  let bucket=buckets.get(key);if(!bucket){bucket={geometry:source.geometry,material:source.material,cast:source.castShadow,receive:source.receiveShadow,sources:[]};buckets.set(key,bucket);}
  bucket.sources.push(source);sources.push(source);source.userData.rigidInstanceSource=true;source.visible=false;
 });
 for(const b of buckets.values()){
  b.object=new T.InstancedMesh(b.geometry,b.material,b.sources.length);b.object.name='instanced-classroom-props';b.object.castShadow=b.cast;b.object.receiveShadow=b.receive;b.object.frustumCulled=true;b.object.instanceMatrix.setUsage(T.DynamicDrawUsage);parent.add(b.object);
 }
 const previous=new T.Matrix4(),local=new T.Matrix4(),inverseParent=new T.Matrix4();
 function sync(){
  parent.updateWorldMatrix(true,false);inverseParent.copy(parent.matrixWorld).invert();
  for(const group of groups)group.updateWorldMatrix(true,true);
  for(const b of buckets.values()){
   let dirty=!b.object.boundingSphere,visibleCount=0;
   b.sources.forEach((source,index)=>{
    let visible=true;for(let p=source.parent;p;p=p.parent)if(!p.visible){visible=false;break;}
    if(visible)visibleCount++;
    const matrix=visible?local.multiplyMatrices(inverseParent,source.matrixWorld):hidden;b.object.getMatrixAt(index,previous);
    if(!previous.equals(matrix)){b.object.setMatrixAt(index,matrix);dirty=true;}
   });
   b.object.visible=visibleCount>0;
   if(dirty){b.object.instanceMatrix.needsUpdate=true;b.object.computeBoundingSphere();}
  }
 }
 sync();
 return{sync,sourceCount:sources.length,batchCount:buckets.size,dispose(){for(const b of buckets.values()){b.object.removeFromParent();b.object.dispose();}for(const source of sources){source.visible=true;delete source.userData.rigidInstanceSource;}}};
}
