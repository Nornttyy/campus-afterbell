import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';

export async function loadTeacherModel(){
  const url=new URL('./assets/models/teacher-v1.glb?v=classroom-33',import.meta.url);
  return createRiggedTeacher(await new GLTFLoader().loadAsync(url.href));
}

export async function loadDeskModel(){
  const url=new URL('./assets/models/desk-v1.glb?v=classroom-33',import.meta.url);
  const gltf=await new GLTFLoader().loadAsync(url.href);
  const body=gltf.scene.getObjectByName('DeskBody'),drawer=gltf.scene.getObjectByName('DeskDrawer');
  if(!body||!drawer)throw new Error('Desk model must have separate body and drawer');
  gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return{body,drawer};
}

// Runtime consumes the authored skin and clips. Only root navigation is external.
export function createRiggedTeacher(gltf){
  const group=new THREE.Group();group.name='classroom-teacher-tripo';
  const model=gltf.scene;group.add(model);
  const bounds=new THREE.Box3().setFromObject(model,true),size=bounds.getSize(new THREE.Vector3());
  const factor=2.08/size.y;
  model.scale.multiplyScalar(factor);model.position.y-=bounds.min.y*factor;
  group.userData.asset='teacher-v1';group.userData.fingersPerHand=4;
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.isSkinnedMesh)o.frustumCulled=false;}});
  const bones={};model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
  for(const name of ['Head','LeftHand','RightHand'])if(!bones[name])throw new Error(`Teacher rig missing ${name}`);
  const mixer=new THREE.AnimationMixer(model),actions={};
  for(const clip of gltf.animations){actions[clip.name]=mixer.clipAction(clip);actions[clip.name].setEffectiveWeight(0).play();}
  for(const name of ['Idle','Walk','Write','Card','Throw'])if(!actions[name])throw new Error(`Teacher clip missing ${name}`);
  const anchors={left:new THREE.Group(),right:new THREE.Group()};
  for(const [side,anchor] of Object.entries(anchors)){anchor.name=`teacher-${side}-grip`;group.add(anchor);}
  const chalk=new THREE.Mesh(new THREE.CylinderGeometry(.0045,.0045,.048,10),new THREE.MeshStandardMaterial({color:'#fff7df',roughness:.9}));
  chalk.position.set(.008,.071,.012);chalk.rotation.x=Math.PI/2;chalk.name='teacher-writing-chalk';anchors.right.add(chalk);
  const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),inverse=new THREE.Quaternion();
  const lookRotation=new THREE.Quaternion();
  let lastTime=null,gesture={card:false,cast:0},lookValue=0;
  const weights={Idle:1,Walk:0,Write:0,Card:0,Throw:0};
  actions.Idle.setEffectiveWeight(1);
  function syncAnchors(){
    group.updateMatrixWorld(true);group.getWorldQuaternion(inverse).invert();
    for(const [side,anchor] of Object.entries(anchors)){
      const bone=bones[side==='right'?'RightHand':'LeftHand'];
      bone.getWorldPosition(position);anchor.position.copy(group.worldToLocal(position));
      bone.getWorldQuaternion(rotation);anchor.quaternion.copy(inverse).multiply(rotation);
    }
    group.updateMatrixWorld(true);
  }
  function update(time,{walking=0,look=0,phase='board'}={}){
    const reset=lastTime===null||time<lastTime;
    const dt=reset?0:Math.min(.1,Math.max(0,time-lastTime));lastTime=time;
    const moving=THREE.MathUtils.clamp(walking,0,1),write=phase==='board'?(1-moving):0;
    const target={Idle:1-moving-write,Walk:moving,Write:write,Card:0,Throw:0};
    if(gesture.card){Object.keys(target).forEach(k=>target[k]=k==='Card'?1:0);}
    else if(gesture.cast>0){Object.keys(target).forEach(k=>target[k]=k==='Throw'?1:0);}
    const alpha=reset?1:1-Math.exp(-dt*12);
    for(const [name,action] of Object.entries(actions)){
      weights[name]=THREE.MathUtils.lerp(weights[name]||0,target[name]||0,alpha);
      action.setEffectiveWeight(weights[name]);
      if(reset)action.time=0;
    }
    actions.Walk.setEffectiveTimeScale(.55+moving*.45);
    actions.Throw.paused=true;actions.Throw.time=THREE.MathUtils.clamp(gesture.cast,0,1)*actions.Throw.getClip().duration;
    mixer.update(dt);
    // Look offset is applied after sampling, never accumulated into the bind pose.
    lookValue=THREE.MathUtils.lerp(lookValue,THREE.MathUtils.clamp(look,-.5,.5),alpha);
    lookRotation.setFromAxisAngle(new THREE.Vector3(0,1,0),lookValue);
    bones.Head.quaternion.premultiply(lookRotation);
    chalk.visible=weights.Write>.35;
    syncAnchors();
  }
  update(0,{phase:'watching'});
  return{group,update,getHand:side=>anchors[side],setGesture:value=>{gesture=value;},
    dispose(){mixer.stopAllAction();mixer.uncacheRoot(model);},
    diagnostics:()=>({asset:group.userData.asset,clips:Object.keys(actions),weights:{...weights},height:2.08})};
}
