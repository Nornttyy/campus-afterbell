import * as T from './vendor/three.module.js';
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),rad=Math.PI/180;
const rotation=angles=>Q().setFromEuler(new T.Euler(...angles.map(a=>a*rad)));
const degrees=q=>new T.Euler().setFromQuaternion(q,'XYZ').toArray().slice(0,3).map(a=>a/rad);
export function endOfJoint(layer,finger,n){
  const bone=layer.bone(finger+n),next=layer.bone(finger+(n+1));
  if(next)return next.getWorldPosition(V());
  // Continue the middle segment in the distal joint's own rotated frame.
  const end=bone.position.clone().multiplyScalar(.75);
  return bone.localToWorld(end);
}
export function fingerDrag(layer,finger,n,pose){
  const chain=[];
  for(let i=n;i>=1;i--){
    const key=finger+i,bone=layer.bone(key),start=bone.quaternion.clone();
    chain.push({key,bone,start,base:start.clone().multiply(rotation(pose.joints[key]||[0,0,0]).invert())});
  }
  return target=>{
    for(const {bone,start} of chain)bone.quaternion.copy(start);
    for(let pass=0;pass<9;pass++){
      for(const {bone} of chain){
        const pivot=bone.getWorldPosition(V()),from=endOfJoint(layer,finger,n).sub(pivot),to=target.clone().sub(pivot);
        if(from.lengthSq()<1e-12||to.lengthSq()<1e-12)continue;
        const parent=bone.parent.getWorldQuaternion(Q()),delta=Q().setFromUnitVectors(from.normalize(),to.normalize());
        bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent)).normalize();
      }
    }
    const changes={};
    for(const {key,bone,start,base} of chain){changes[key]=degrees(base.clone().invert().multiply(bone.quaternion));bone.quaternion.copy(start);}
    return changes;
  };
}
// Pick the visible skin as well as the handles. Interpolate the three
// vertices' skin weights to identify the joint under the pointer.
function skinJoint(ray,context){
  const hands=Object.values(context.hands);
  for(const palm of hands)palm.traverse(o=>{if(o.isSkinnedMesh)o.computeBoundingSphere();});
  const hit=ray.intersectObjects([...hands,context.prop],true).find(({object})=>{
    for(let p=object;p;p=p.parent)if(!p.visible)return false;
    return object.material?.visible!==false;
  });
  if(!hit?.object.isSkinnedMesh||!hit.face)return null;
  const mesh=hit.object,ids=[hit.face.a,hit.face.b,hit.face.c];
  const vertices=ids.map(i=>mesh.getVertexPosition(i,V()));
  const bary=T.Triangle.getBarycoord(mesh.worldToLocal(hit.point.clone()),...vertices,V());
  if(!bary)return null;
  const {skinIndex,skinWeight}=mesh.geometry.attributes,weights=new Map();
  for(const [i,index] of ids.entries())for(let j=0;j<4;j++){
    const bone=mesh.skeleton.bones[skinIndex.getComponent(index,j)],w=skinWeight.getComponent(index,j)*bary.getComponent(i);
    if(w>0)weights.set(bone,(weights.get(bone)||0)+w);
  }
  const strongest=[...weights].sort((a,b)=>b[1]-a[1])[0]?.[0];
  const match=strongest?.name.match(/(Left|Right)Hand(Thumb|Index|Middle|Ring|Pinky)([123])$/);
  if(!match)return null;
  const [,name,finger,n]=match,side=name.toLowerCase();
  return {userData:{side,finger,n:Number(n)},position:endOfJoint(context.layers[side],finger,Number(n))};
}
export function installGripDrag(canvas,camera,orbit,context,edit){
  let drag=null;
  const ray=new T.Raycaster(),plane=new T.Plane();
  function aim(e){
    const r=canvas.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,1-2*(e.clientY-r.top)/r.height),camera);
    return r;
  }
  function planePoint(){return ray.ray.intersectPlane(plane,V());}
  function end(e){
    if(!drag||e.pointerId!==drag.pointer)return;
    drag=null;orbit.enabled=true;
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    edit.finish();e.stopImmediatePropagation();
  }
  canvas.addEventListener('pointerdown',e=>{
    if(drag||e.button!==0||!e.isPrimary)return;
    const c=context();if(!c)return;
    const rect=aim(e);let best=e.pointerType==='touch'?17:10,node=null;
    if(c.dots.visible)for(const marker of c.dots.children){
      const p=marker.position.clone().project(camera),distance=Math.hypot(rect.left+(1+p.x)*rect.width/2-e.clientX,rect.top+(1-p.y)*rect.height/2-e.clientY);
      if(distance<best){best=distance;node=marker;}
    }
    if(!node&&c.fingerMode)node=skinJoint(ray,c);
    let grab,solve;
    const op=node?'finger':c.tool;
    if(node){
      const {side,finger,n}=node.userData;edit.pick(node.userData);grab=node.position.clone();
      solve=fingerDrag(c.layers[side],finger,n,c.record?.[side]||{joints:{}});
    }else{
      const hit=ray.intersectObject(c.prop,true).find(hit=>{
        for(let o=hit.object;o;o=o.parent){if(!o.visible||o.material?.visible===false)return false;if(o===c.prop)return true;}return false;
      });
      if(!hit)return;grab=hit.point.clone();
    }
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(V()),grab);
    const pose=c.record?.prop||{position:[0,0,0],rotation:[0,0,0],scale:1};
    const base=c.prop.getWorldQuaternion(Q()).multiply(rotation(pose.rotation).invert());
    drag={pointer:e.pointerId,op,start:planePoint(),grab,solve,pose,base,x:e.clientX,y:e.clientY,started:false};
    orbit.enabled=false;canvas.setPointerCapture(e.pointerId);e.preventDefault();e.stopImmediatePropagation();
  },true);
  canvas.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pointer)return;const d=drag;
    const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!d.started&&Math.hypot(dx,dy)<2)return;
    if(!d.started){edit.begin();d.started=true;}
    aim(e);const at=planePoint();if(!at)return;
    const delta=at.sub(d.start);
    if(d.op==='finger')edit.joints(d.solve(d.grab.clone().add(delta)));
    else{
      const pose={...d.pose};
      if(d.op==='translate')pose.position=V().fromArray(pose.position).add(delta.applyQuaternion(d.base.clone().invert()).multiplyScalar(1000)).clampScalar(-500,500).toArray();
      if(d.op==='rotate'){
        const axis=V().set(dy,dx,0).normalize().applyQuaternion(camera.quaternion);
        const turn=Q().setFromAxisAngle(axis,Math.hypot(dx,dy)*.012);
        pose.rotation=degrees(d.base.clone().invert().multiply(turn).multiply(d.base).multiply(rotation(pose.rotation)));
      }
      if(d.op==='scale')pose.scale=T.MathUtils.clamp(pose.scale*Math.exp(-dy*.01),.1,5);
      edit.prop(pose);
    }
    e.preventDefault();e.stopImmediatePropagation();
  },true);
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,end,true);
}
