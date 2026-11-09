import * as T from './vendor/three.module.js';
const V=()=>new T.Vector3();
// Cache the skin's extremal samples per weighted hand bone once. The live
// support solve deforms only these samples; it never walks the full mesh.
export function createHandSupport(hand){
 const group=hand.group,rows=[],meshes=[],pads=new Map(),bases=new Map();group.updateMatrixWorld(true);
 const directions=[];for(const x of[-1,0,1])for(const y of[-1,0,1])for(const z of[-1,0,1])if(x||y||z)directions.push(new T.Vector3(x,y,z).normalize());
 group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;meshes.push(mesh);mesh.skeleton.update();const {skinIndex,skinWeight}=mesh.geometry.attributes,cache=new Map();
  for(let i=0;i<skinIndex.count;i++){let weight=0,bone;for(let j=0;j<4;j++)if(skinWeight.getComponent(i,j)>weight){weight=skinWeight.getComponent(i,j);bone=mesh.skeleton.bones[skinIndex.getComponent(i,j)];}if(!bone||!bone.name.includes('Hand'))continue;
   const key=bone.id+':'+Math.floor(weight*8);let data=cache.get(key);if(!data){data={bone,scores:directions.map(()=>-Infinity),indices:[]};cache.set(key,data);}const p=bone.worldToLocal(mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld));directions.forEach((d,k)=>{const score=p.dot(d);if(score>data.scores[k]){data.scores[k]=score;data.indices[k]=i;}});
  }for(const row of cache.values()){const bone=row.bone,finger=['Index','Middle','Pinky'].find(f=>bone.name.endsWith('Hand'+f+'3'));for(const index of new Set(row.indices)){const sample={mesh,index};rows.push(sample);if(finger){if(!pads.has(finger))pads.set(finger,[]);pads.get(finger).push(sample);}}}
  for(const bone of mesh.skeleton.bones)for(const finger of ['Index','Middle','Pinky'])if(bone.name.endsWith('Hand'+finger+'1'))bases.set(finger,bone);
 });
 const point=V(),inverse=new T.Matrix4();
 function refresh(anchor){group.parent?.updateWorldMatrix(true,false);group.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();if(anchor)inverse.copy(anchor.matrixWorld).invert();else inverse.identity();}
 function pressPads(anchor,level,time,typing){
  for(const [i,finger]of ['Index','Middle','Pinky'].entries()){const bone=bases.get(finger),samples=pads.get(finger);if(!bone||!samples)continue;
   // A small MCP correction keeps the actual fingertip skin on a key while
   // the separate phalanges type. Only cached extrema are evaluated.
   const target=level+.001+(typing?.002*(.5+.5*Math.sin(time*10-i*1.9)):0);
   for(let pass=0;pass<2;pass++){refresh(anchor);let lowest=null;for(const row of samples){const p=row.mesh.getVertexPosition(row.index,V()).applyMatrix4(row.mesh.matrixWorld).applyMatrix4(inverse);if(!lowest||p.y<lowest.y)lowest=p;}
    const pivot=bone.getWorldPosition(V()).applyMatrix4(inverse),toward=lowest.clone().sub(pivot),lever=Math.hypot(toward.x,toward.z);if(lever<.025)break;
    const angle=T.MathUtils.clamp((target-lowest.y)/lever,-.18,.18),axis=V().crossVectors(toward,new T.Vector3(0,1,0)).normalize();if(anchor)axis.applyQuaternion(anchor.getWorldQuaternion(new T.Quaternion()));axis.applyQuaternion(bone.parent.getWorldQuaternion(new T.Quaternion()).invert());bone.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(axis,angle));
   }
  }
 }

 return {pressPads,minimum(anchor){group.parent?.updateWorldMatrix(true,false);group.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();if(anchor)inverse.copy(anchor.matrixWorld).invert();else inverse.identity();let y=Infinity;for(const row of rows){row.mesh.getVertexPosition(row.index,point).applyMatrix4(row.mesh.matrixWorld).applyMatrix4(inverse);y=Math.min(y,point.y);}return y;},samples:rows.length};
}
