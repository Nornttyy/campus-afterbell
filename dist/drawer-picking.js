import * as THREE from './vendor/three.module.js';

// Small food keeps its authored size. Only the interaction target receives a
// 15 mm margin, in object space, after an exact visible-surface hit is tried.
export const DRAWER_PICK_MARGIN=.015;
export function drawerObjectVisible(object){
  for(let p=object;p;p=p.parent)if(!p.visible&&!p.userData.rigidInstanceSource)return false;
  return true;
}
export function createDrawerPickTarget(object,slot){
  object.updateWorldMatrix(true,true);
  const inverse=object.matrixWorld.clone().invert(),bounds=new THREE.Box3(),matrix=new THREE.Matrix4();
  object.traverse(mesh=>{
    if(!mesh.isMesh)return;
    mesh.geometry.computeBoundingBox();matrix.multiplyMatrices(inverse,mesh.matrixWorld);
    bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(matrix));
  });
  return {object,slot,bounds};
}
const belongsTo=(object,parent)=>{for(let p=object;p;p=p.parent)if(p===parent)return true;return false;};
export function pickDrawerItem(raycaster,targets,blockers,{margin=DRAWER_PICK_MARGIN,maxDistance=2.2}={}){
  const visible=targets.filter(t=>drawerObjectVisible(t.object)&&!t.bounds.isEmpty());
  if(!visible.length)return null;
  const surfaces=[],owners=new Map();
  for(const target of visible)target.object.traverse(mesh=>{
    if(mesh.isMesh&&drawerObjectVisible(mesh)){surfaces.push(mesh);owners.set(mesh,target);}
  });
  const barriers=raycaster.intersectObjects(blockers.filter(Boolean),true).filter(hit=>drawerObjectVisible(hit.object));
  const unobstructed=(target,distance)=>!barriers.some(hit=>hit.distance<distance-.008&&!belongsTo(hit.object,target.object));
  const exact=raycaster.intersectObjects(surfaces,false).filter(hit=>hit.distance<=maxDistance);
  for(const hit of exact){const target=owners.get(hit.object);if(unobstructed(target,hit.distance))return target.slot;}
  // Never reach around an occluder that hides an actual surface hit.
  const exactTargets=new Set(exact.map(hit=>owners.get(hit.object)));
  const nearby=[],localRay=new THREE.Ray(),inverse=new THREE.Matrix4(),point=new THREE.Vector3(),box=new THREE.Box3();
  for(const target of visible){
    if(exactTargets.has(target))continue;
    inverse.copy(target.object.matrixWorld).invert();localRay.copy(raycaster.ray).applyMatrix4(inverse);
    box.copy(target.bounds).expandByScalar(margin);
    if(!localRay.intersectBox(box,point))continue;
    point.applyMatrix4(target.object.matrixWorld);const distance=point.distanceTo(raycaster.ray.origin);
    if(distance<raycaster.near||distance>Math.min(raycaster.far,maxDistance)||!unobstructed(target,distance))continue;
    nearby.push({slot:target.slot,distance});
  }
  nearby.sort((a,b)=>a.distance-b.distance);
  return nearby[0]?.slot??null;
}
