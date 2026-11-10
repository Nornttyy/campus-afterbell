import * as T from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/addons/loaders/GLTFLoader.js';
import {OrbitControls} from '../vendor/addons/controls/OrbitControls.js';
import {TransformControls} from '../vendor/addons/controls/TransformControls.js';

export const EDITOR_MODELS=Object.freeze({
  boy:'student-boy-v4',girl:'student-girl-v4',ponytail:'student-ponytail-v1',
  glasses:'student-glasses-v2',teacher:'teacher-v2',
});
const shortName=name=>name.replace(/^mixamorig[:_]?/,'');
export const isPelvis=name=>shortName(name)==='Hips';

export function rigBones(root){
  const result=[];root.traverse(node=>{if(node.isBone)result.push(node);});return result;
}

export function describeBones(root){
  const labels={Hips:'骨盆',Spine:'腰部',Spine1:'胸部',Spine2:'上胸',Neck:'脖子',Head:'头部',HeadTop_End:'头顶',
    Shoulder:'肩膀',Arm:'上臂',ForeArm:'前臂',Hand:'手腕',UpLeg:'大腿',Leg:'小腿',Foot:'脚踝',ToeBase:'脚掌',Toe_End:'脚尖'};
  const digits={Thumb:'拇指',Index:'食指',Middle:'中指',Ring:'无名指',Pinky:'小指'};
  return rigBones(root).map(bone=>{
    const raw=shortName(bone.name),side=raw.startsWith('Left')?'左':raw.startsWith('Right')?'右':'',part=side?raw.replace(/^(Left|Right)/,''):raw;
    const finger=part.match(/^Hand(Thumb|Index|Middle|Ring|Pinky)(\d+)$/);
    let group='其他',label=side+(labels[part]||part);
    if(finger){group=side+'手指';label=side+digits[finger[1]]+' · '+finger[2];}
    else if(/^(Shoulder|Arm|ForeArm|Hand)$/.test(part))group=side+'臂';
    else if(/^(UpLeg|Leg|Foot|Toe)/.test(part))group=side+'腿';
    else if(/^(Head|Neck)/.test(part))group='头部';
    else if(/^(Hips|Spine)/.test(part))group='躯干';
    return {name:bone.name,label,group,parent:bone.parent?.isBone?bone.parent.name:null};
  });
}

/** Preserve the original rig's bone names and local units, including its normalization parent. */
export function capturePose(root,{parentBasis=false}={}){
  root.updateMatrixWorld(true);
  const pose={};
  for(const bone of rigBones(root)){
    pose[bone.name]={position:bone.position.toArray(),quaternion:bone.quaternion.toArray(),scale:bone.scale.toArray()};
    if(parentBasis)pose[bone.name].parentBasis=(bone.parent?bone.parent.getWorldQuaternion(new T.Quaternion()):new T.Quaternion()).normalize().toArray();
  }
  return pose;
}

export function applyPose(root,pose){
  const valid=(value,length)=>Array.isArray(value)&&value.length===length&&value.every(Number.isFinite);
  for(const bone of rigBones(root)){
    const value=pose?.[bone.name];if(!value)continue;
    if(valid(value.position,3))bone.position.fromArray(value.position);
    if(valid(value.quaternion,4)&&value.quaternion.some(v=>v!==0))bone.quaternion.fromArray(value.quaternion).normalize();
    if(valid(value.scale,3)&&value.scale.every(v=>v>0))bone.scale.fromArray(value.scale);
  }
  root.updateMatrixWorld(true);
  root.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.update();});
}

/** Geometry/textures are cached, but every editor and sampler owns independent bones and skeletons. */
export function cloneRig(source){
  const copy=source.clone(true),map=new Map();
  const pair=(a,b)=>{map.set(a,b);a.children.forEach((child,i)=>pair(child,b.children[i]));};pair(source,copy);
  source.traverse(node=>{
    if(!node.isSkinnedMesh)return;
    const mesh=map.get(node);mesh.skeleton=node.skeleton.clone();
    mesh.skeleton.bones=node.skeleton.bones.map(bone=>map.get(bone));
    mesh.bindMatrix.copy(node.bindMatrix);mesh.bind(mesh.skeleton,mesh.bindMatrix);mesh.frustumCulled=false;
  });
  copy.updateMatrixWorld(true);return copy;
}

/** The editing skeleton never has an AnimationMixer attached to it. */
export function createClipSampler(template,clips){
  const root=cloneRig(template),bind=capturePose(root),mixer=new T.AnimationMixer(root);
  let disposed=false;
  return {
    sample(name,time){
      if(disposed)throw new Error('动画采样器已关闭');
      const clip=clips.find(value=>value.name===name);if(!clip)throw new Error('找不到动画：'+name);
      mixer.stopAllAction();applyPose(root,bind);
      const action=mixer.clipAction(clip);action.reset();action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
      mixer.setTime(T.MathUtils.clamp(Number.isFinite(time)?time:0,0,clip.duration));
      const result=capturePose(root);
      mixer.stopAllAction();applyPose(root,bind);return result;
    },
    dispose(){if(disposed)return;disposed=true;mixer.stopAllAction();mixer.uncacheRoot(root);root.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.dispose();});},
  };
}

function releaseSkeleton(root){root?.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.dispose();});}
function releaseResources(root){
  const geometries=new Set(),materials=new Set(),textures=new Set(),images=new Set();
  root.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of [node.material].flat().filter(Boolean))materials.add(material);});
  for(const material of materials)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());
  textures.forEach(value=>{if(value.image)images.add(value.image);value.dispose();});images.forEach(value=>value.close?.());releaseSkeleton(root);
}

export async function createRigView(canvas,{onSelect,onPoseChange,onDragEnd,onLoad,onError}={}){
  if(!canvas?.getContext)throw new Error('需要一个可用的画布');
  let disposed=false,generation=0,current=null,selected=null,skeletonVisible=true,playing=false,desiredMode='rotate',dragging=false,dragStart=null,pointerStart=null;
  const cache=new Map(),listeners=[],loader=new GLTFLoader(),scene=new T.Scene();
  scene.background=new T.Color('#eef1f5');
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,2));renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const camera=new T.PerspectiveCamera(33,1,.025,80),target=new T.Vector3(0,1,0);
  scene.add(new T.HemisphereLight('#f3f7ff','#e3e6e9',2.5));
  const key=new T.DirectionalLight('#fff7ec',4);key.position.set(-4,6,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=3;key.shadow.camera.bottom=-1;key.shadow.bias=-.0002;key.shadow.normalBias=.018;scene.add(key);
  const fill=new T.DirectionalLight('#e8f2ff',1.4);fill.position.set(5,3,4);scene.add(fill);
  const rim=new T.DirectionalLight('#ffffff',1.1);rim.position.set(1,4,-4);scene.add(rim);
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#e3e7ec',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.009;floor.receiveShadow=true;scene.add(floor);
  const grid=new T.GridHelper(10,20,'#bcc7d2','#d4dce4');grid.position.y=-.007;grid.material.transparent=true;grid.material.opacity=.45;scene.add(grid);
  const orbit=new OrbitControls(camera,canvas);orbit.enableDamping=true;orbit.dampingFactor=.1;orbit.minDistance=.45;orbit.maxDistance=12;orbit.maxPolarAngle=Math.PI*.94;orbit.target.copy(target);
  const transform=new TransformControls(camera,canvas);transform.setSpace('local');transform.setMode('rotate');transform.setSize(.85);scene.add(transform.getHelper());
  const markers=new T.Group();markers.name='EditorJointMarkers';scene.add(markers);
  const markerGeometry=new T.SphereGeometry(1,10,8),markerMaterial=new T.MeshBasicMaterial({color:'#328bad',depthTest:false,transparent:true,opacity:.65}),fingerMaterial=new T.MeshBasicMaterial({color:'#dd9c58',depthTest:false,transparent:true,opacity:.75}),selectedMaterial=new T.MeshBasicMaterial({color:'#ff793f',depthTest:false});
  const raycaster=new T.Raycaster(),pointer=new T.Vector2();
  const oldTouchAction=canvas.style.touchAction;canvas.style.touchAction='none';
  const listen=(target,event,callback,options)=>{target.addEventListener(event,callback,options);listeners.push(()=>target.removeEventListener(event,callback,options));};
  const report=error=>{onError?.(error);return error;};
  const abort=()=>new DOMException('已切换到另一个模型','AbortError');

  function sync(){
    if(!current)return;current.root.updateMatrixWorld(true);
    current.root.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.update();});
    for(const marker of markers.children){
      const bone=current.byName.get(marker.userData.boneName);bone.getWorldPosition(marker.position);
      const distance=camera.position.distanceTo(marker.position),pixelSize=marker.userData.finger?4:5.5;
      marker.scale.setScalar(distance*2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*pixelSize/Math.max(canvas.clientHeight,200));
      marker.material=bone===selected?selectedMaterial:marker.userData.finger?fingerMaterial:markerMaterial;
    }
    current.helper?.updateMatrixWorld(true);
  }
  function updateGizmo(){
    if(selected&&!playing){transform.attach(selected);transform.setMode(desiredMode==='translate'&&isPelvis(selected.name)?'translate':'rotate');transform.enabled=true;}
    else {transform.detach();transform.enabled=false;}
    sync();
  }
  function cancelDrag(){
    if(!dragging)return;
    if(dragStart&&current)applyPose(current.root,dragStart);
    transform.dragging=false;transform.axis=null;dragging=false;dragStart=null;orbit.enabled=true;
    sync();onDragEnd?.(api.getPose());
  }
  listen(transform,'mouseDown',()=>{dragging=true;dragStart=api.getPose();orbit.enabled=false;});
  listen(transform,'objectChange',()=>{if(!dragging||!current)return;sync();onPoseChange?.(api.getPose());});
  listen(transform,'mouseUp',()=>{if(!dragging)return;dragging=false;dragStart=null;orbit.enabled=true;sync();onDragEnd?.(api.getPose());});
  listen(canvas,'pointerdown',event=>{if(event.button===0)pointerStart={id:event.pointerId,x:event.clientX,y:event.clientY,gizmo:dragging||!!transform.axis};});
  listen(canvas,'pointerup',event=>{
    const down=pointerStart;pointerStart=null;
    if(!down||down.id!==event.pointerId||down.gizmo||playing||!skeletonVisible||!current||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)return;
    const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    sync();raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(markers.children,false)[0];if(hit)api.selectBone(hit.object.userData.boneName);
  });
  listen(canvas,'pointercancel',()=>{pointerStart=null;cancelDrag();});
  listen(canvas,'keydown',event=>{if(event.key==='Escape'&&dragging){event.preventDefault();event.stopPropagation();cancelDrag();}});
  listen(globalThis,'blur',()=>{pointerStart=null;cancelDrag();});
  listen(canvas,'contextmenu',event=>event.preventDefault());
  listen(canvas,'webglcontextlost',event=>{event.preventDefault();report(new Error('显卡画面已暂停，请刷新编辑器后重新打开工程'));});
  function resize(){const width=Math.max(1,canvas.clientWidth||canvas.parentElement?.clientWidth||640),height=Math.max(1,canvas.clientHeight||canvas.parentElement?.clientHeight||480);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(canvas);listen(globalThis,'resize',resize);resize();

  function clearCurrent(){
    transform.detach();selected=null;markers.clear();
    if(!current)return;scene.remove(current.root,current.helper);current.helper.geometry.dispose();current.helper.material.dispose();current.sampler.dispose();releaseSkeleton(current.root);current=null;
  }
  function asset(modelId){
    if(!EDITOR_MODELS[modelId])return Promise.reject(new Error('未知人物：'+modelId));
    if(!cache.has(modelId)){
      const url=new URL('../assets/models/'+EDITOR_MODELS[modelId]+'.glb?v=mesh-64',import.meta.url);
      const task=(async()=>{
        const response=await fetch(url);if(!response.ok)throw new Error('模型加载失败（'+response.status+'）');
        const bytes=await response.arrayBuffer(),gltf=await loader.parseAsync(bytes,url.href.slice(0,url.href.lastIndexOf('/')+1));
        if(disposed){releaseResources(gltf.scene);throw abort();}
        return {bytes,gltf};
      })().catch(error=>{cache.delete(modelId);throw error;});cache.set(modelId,task);
    }
    return cache.get(modelId);
  }
  const api={
    async loadModel(modelId){
      const ticket=++generation;
      try{
        if(disposed)throw abort();const source=await asset(modelId);if(disposed||ticket!==generation)throw abort();
        cancelDrag();clearCurrent();
        const root=cloneRig(source.gltf.scene),byName=new Map(rigBones(root).map(bone=>[bone.name,bone]));
        if(!byName.size){releaseSkeleton(root);throw new Error('此模型没有可编辑骨骼');}
        root.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=false;}});scene.add(root);
        const bindPose=capturePose(root,{parentBasis:true}),sampler=createClipSampler(source.gltf.scene,source.gltf.animations),idle=source.gltf.animations.find(clip=>clip.name==='Idle');
        const initialPose=idle?sampler.sample(idle.name,0):capturePose(root);applyPose(root,initialPose);
        const helper=new T.SkeletonHelper(root);helper.material.depthTest=false;helper.material.transparent=true;helper.material.opacity=.38;helper.visible=skeletonVisible;helper.renderOrder=19;scene.add(helper);
        // Use the visible idle silhouette rather than the original A-pose height.
        // A fixed distance makes the teacher too large and short students too small.
        const bounds=new T.Box3().setFromObject(root,true);
        current={root,byName,source,helper,sampler,bounds};
        for(const bone of byName.values()){const marker=new T.Mesh(markerGeometry,markerMaterial);marker.userData={boneName:bone.name,finger:/Hand(Thumb|Index|Middle|Ring|Pinky)/.test(bone.name)};marker.renderOrder=20;markers.add(marker);}
        markers.visible=skeletonVisible;playing=false;
        bounds.getCenter(target);orbit.target.copy(target);api.setView('perspective');
        const result={bones:describeBones(root),clips:source.gltf.animations.map(({name,duration})=>({name,duration})),bindPose,initialPose};
        sync();onLoad?.(result);return result;
      }catch(error){if(error.name!=='AbortError'&&ticket===generation&&!disposed)report(error);throw error;}
    },
    setPose(pose){if(!current||disposed)return;applyPose(current.root,pose);sync();},
    getPose(){return current?capturePose(current.root):{};},
    selectBone(name){if(!current||disposed)return;const bone=current.byName.get(name);if(!bone)return;selected=bone;updateGizmo();onSelect?.(name);},
    setMode(mode){if(mode!=='rotate'&&mode!=='translate')throw new Error('只支持旋转或骨盆位移');desiredMode=mode;updateGizmo();},
    setView(view){
      const directions={front:[0,0,1],back:[0,0,-1],left:[1,0,0],right:[-1,0,0],perspective:[2.1,.8,2.9]};
      if(!directions[view])return;
      const size=current?current.bounds.getSize(new T.Vector3()):new T.Vector3(1,1.8,1),tan=Math.tan(T.MathUtils.degToRad(camera.fov/2));
      const width=view==='left'||view==='right'?size.z:view==='perspective'?Math.hypot(size.x,size.z):size.x;
      const distance=Math.max(size.y/(2*tan*.78),width/(2*tan*camera.aspect*.85),1.7);
      orbit.target.copy(target);camera.position.copy(target).addScaledVector(new T.Vector3(...directions[view]).normalize(),distance);camera.up.set(0,1,0);camera.lookAt(target);orbit.update();sync();
    },
    focusSelectedBone(){
      if(!selected||!current||disposed)return false;
      let focusRoot=selected;const name=shortName(selected.name),hand=name.match(/^(Left|Right)Hand/);
      if(hand)focusRoot=[...current.byName.values()].find(bone=>shortName(bone.name)===hand[1]+'Hand')||selected;
      current.root.updateMatrixWorld(true);
      const points=[];
      if(hand)focusRoot.traverse(node=>{if(node.isBone)points.push(node.getWorldPosition(new T.Vector3()));});
      else {points.push(selected.getWorldPosition(new T.Vector3()));for(const node of selected.children)if(node.isBone)points.push(node.getWorldPosition(new T.Vector3()));}
      const bounds=new T.Box3().setFromPoints(points),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
      const direction=camera.position.clone().sub(orbit.target).normalize(),distance=hand?Math.max(.55,Math.max(size.x,size.y,size.z)*3.5):T.MathUtils.clamp(Math.max(size.x,size.y,size.z)*2.8,.8,1.6);
      orbit.target.copy(center);camera.position.copy(center).addScaledVector(direction,distance);camera.lookAt(center);orbit.update();sync();return true;
    },
    setSkeletonVisible(value){skeletonVisible=!!value;markers.visible=skeletonVisible;if(current)current.helper.visible=skeletonVisible;},
    setPlaying(value){playing=!!value;updateGizmo();},
    sampleClip(name,time){if(!current)throw new Error('请先载入人物');return current.sampler.sample(name,time);},
    getSourceBytes(){if(!current)throw new Error('请先载入人物');return current.source.bytes.slice(0);},
    dispose(){
      if(disposed)return;disposed=true;generation++;cancelAnimationFrame(frame);observer?.disconnect();listeners.forEach(remove=>remove());
      clearCurrent();orbit.dispose();transform.dispose();floor.geometry.dispose();floor.material.dispose();grid.geometry.dispose();grid.material.dispose();markerGeometry.dispose();markerMaterial.dispose();fingerMaterial.dispose();selectedMaterial.dispose();
      for(const promise of cache.values())promise.then(source=>releaseResources(source.gltf.scene)).catch(()=>{});cache.clear();key.shadow.dispose();renderer.dispose();canvas.style.touchAction=oldTouchAction;
    },
  };
  let frame=0;function render(){if(disposed)return;orbit.update();sync();renderer.render(scene,camera);frame=requestAnimationFrame(render);}api.setView('perspective');render();return api;
}
