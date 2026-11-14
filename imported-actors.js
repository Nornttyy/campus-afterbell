import {TEACHER_PROPORTIONS} from './teacher-proportions73.js?v=campus-79';
import {createFacialEffects} from './facial-effects64.js?v=campus-79';
import {requireModelBudget} from './model-budget64.js';
import {createCapturePose} from './capture-poses.js?v=campus-79';
import * as THREE from './vendor/three.module.js';
import {normalWalkCycleRate} from './movement55.js?v=campus-79';
import {cloneCharacter as cloneSkin} from './clone-character57.js?v=campus-79';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
import {createCrawlPose} from './crawl-pose.js?v=campus-79';
import {useCharacterBaseColor} from './character-materials.js?v=campus-79';
import {createStudentHandMotion,createFingerRig,handFrame} from './hand-motion.js?v=campus-79';
import {createWalkingArmPose} from './walking-arm-pose.js?v=campus-79';

export async function loadTeacherModel(){
  const url=new URL('./assets/models/teacher-v2.glb?v=mesh-64',import.meta.url);
  const source=await new GLTFLoader().loadAsync(url.href);
  requireModelBudget(source,'teacher-v2');
  const create=()=>createRiggedTeacher({...source,scene:cloneSkin(source.scene)});
  const actor=create();actor.createClone=create;return actor;
}

export async function loadDeskModel(){
  const loader=new GLTFLoader();
  const [gltf,chairAsset]=await Promise.all(['desk-v2','chair-v2'].map(name=>loader.loadAsync(new URL(`./assets/models/${name}.glb?v=mesh-64`,import.meta.url).href)));
  requireModelBudget(gltf,'desk-v2');requireModelBudget(chairAsset,'chair-v2');
  const body=gltf.scene.getObjectByName('DeskBody'),drawer=gltf.scene.getObjectByName('DeskDrawer');
  const chair=chairAsset.scene.getObjectByName('ChairBody');
  if(!body||!drawer||!chair)throw new Error('Furniture must have separate body, drawer and chair');
  const shared=new Map();
  body.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat())if(m.name==='TripoFurnitureOriginalPBR')shared.set(m.name,m);});
  // Correct the source laminate's brown albedo to honey-yellow under the
  // classroom light. Preserve its grain, normal/roughness maps and grey metal.
  for(const material of shared.values()){
    material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float laminate = smoothstep(1.20,1.65,diffuseColor.r/max(diffuseColor.g,0.001))
                     * (1.0-smoothstep(0.55,0.85,diffuseColor.b/max(diffuseColor.g,0.001)));
      diffuseColor.rgb = mix(diffuseColor.rgb,min(diffuseColor.rgb*vec3(1.55,1.85,1.35),vec3(0.94)),laminate);
    `);};
    material.customProgramCacheKey=()=> 'school-laminate-55';
  }
  const replaced=new Set();
  chair.traverse(o=>{if(!o.isMesh)return;const map=m=>{const same=shared.get(m.name);if(same&&same!==m){replaced.add(m);return same;}return m;};o.material=Array.isArray(o.material)?o.material.map(map):map(o.material);});
  const discardedMaps=new Set();for(const m of replaced){for(const value of Object.values(m))if(value?.isTexture)discardedMaps.add(value);m.dispose();}for(const map of discardedMaps)map.dispose();
  for(const scene of [gltf.scene,chairAsset.scene])scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return{body,drawer,chair,source:'tripo-furniture-v2',drawerFloor:.659};
}

// Runtime consumes the authored skin and clips. Only root navigation is external.
export function createRiggedTeacher(gltf){
  const group=new THREE.Group();group.name='classroom-teacher-tripo';
  const model=gltf.scene;group.add(model);
  const metric=gltf.parser?.json?.asset?.extras?.characters40?.normalized===true;
  if(!metric){const bounds=new THREE.Box3().setFromObject(model,true),size=bounds.getSize(new THREE.Vector3()),factor=TEACHER_PROPORTIONS.height/size.y;model.scale.multiplyScalar(factor);model.position.y-=bounds.min.y*factor;}
  if(metric)model.scale.multiplyScalar(TEACHER_PROPORTIONS.height/(gltf.parser.json.asset.extras.characters40.height||TEACHER_PROPORTIONS.sourceHeight));
  group.updateMatrixWorld(true);
  group.userData.asset=metric?'teacher-v2':'teacher-v1';group.userData.fingersPerHand=4;
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;if(o.isSkinnedMesh)o.frustumCulled=false;}});
  useCharacterBaseColor(model);
  const faceEffects=createFacialEffects(model,{variant:'teacher'});
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
  const nominalWalkSpeed=Number(gltf.parser?.json?.asset?.extras?.characters40?.nominalWalkSpeed)||1.35;
  let lastTime=null,gesture={card:false,cast:0},lookValue=0,lookPitchValue=0,neckContact=null,walkRate=1,lastDt=0,neckRequestedAt=-Infinity,seatWeight=0,seatHipSaved=null;
  const crawlPose=createCrawlPose(group,bones),capturePose=createCapturePose(group,bones),handMotion=createStudentHandMotion(group,bones,{authoredNeutral:metric}),gripRig=createFingerRig(group,bones,'Right'),poseSaved=new Map();
  const neckPose=new Map(),groundPose=new Map();
  const walkingArms=metric?createWalkingArmPose(group,bones):null;
  function saveBone(bone){if(!poseSaved.has(bone))poseSaved.set(bone,bone.quaternion.clone());}
  function aimBone(bone,child,target,save=saveBone){
    group.updateMatrixWorld(true);const from=child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize(),to=target.clone().sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
    const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()),delta=new THREE.Quaternion().setFromUnitVectors(from,to);save(bone);
    bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));group.updateMatrixWorld(true);
  }
  function chairLimb(a,b,c,target,pole,save=saveBone){
    if(!a||!b||!c)return;
    const origin=a.getWorldPosition(new THREE.Vector3()),middle=b.getWorldPosition(new THREE.Vector3()),end=c.getWorldPosition(new THREE.Vector3());
    const upper=origin.distanceTo(middle),lower=middle.distanceTo(end),direction=target.clone().sub(origin),distance=THREE.MathUtils.clamp(direction.length(),Math.abs(upper-lower)+.001,upper+lower-.003);direction.normalize();
    const bend=pole.clone().sub(origin).addScaledVector(direction,-pole.clone().sub(origin).dot(direction)).normalize();
    const along=(upper*upper+distance*distance-lower*lower)/(2*distance),height=Math.sqrt(Math.max(0,upper*upper-along*along));
    const wristRotation=c.getWorldQuaternion(new THREE.Quaternion());save(c);
    aimBone(a,b,origin.clone().addScaledVector(direction,along).addScaledVector(bend,height),save);aimBone(b,c,origin.clone().addScaledVector(direction,distance),save);
    // Preserve the feet's ground-facing soles while the knees bend.
    c.quaternion.copy(c.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wristRotation));group.updateMatrixWorld(true);
  }
  function sitOnOfficeChair(seated,dt,reset){
    seatWeight=reset?(seated?1:0):THREE.MathUtils.damp(seatWeight,seated?1:0,9,dt);
    if(seatWeight<.0001){seatWeight=0;return;}
    group.updateMatrixWorld(true);const hip=bones.Hips;if(!hip)return;
    const feet={},hands={};for(const side of ['Left','Right']){feet[side]=group.worldToLocal(bones[side+'Foot'].getWorldPosition(new THREE.Vector3()));hands[side]=group.worldToLocal(bones[side+'Hand'].getWorldPosition(new THREE.Vector3()));}
    // The cushion top is 0.5225 m. The pelvis is above it, with thighs going
    // forward and shins down; this is separate from the 0.34 m floor stun.
    seatHipSaved=hip.position.clone();const pelvis=group.worldToLocal(hip.getWorldPosition(new THREE.Vector3()));pelvis.y=THREE.MathUtils.lerp(pelvis.y,.5225+(.685-.5225)*TEACHER_PROPORTIONS.height/TEACHER_PROPORTIONS.sourceHeight,seatWeight);pelvis.z-=.025*seatWeight;hip.position.copy(hip.parent.worldToLocal(group.localToWorld(pelvis)));group.updateMatrixWorld(true);
    for(const [side,sign]of [['Left',1],['Right',-1]]){
      const foot=feet[side].clone().lerp(new THREE.Vector3(sign*.14,feet[side].y,.24),seatWeight);
      chairLimb(bones[side+'UpLeg'],bones[side+'Leg'],bones[side+'Foot'],group.localToWorld(foot),group.localToWorld(new THREE.Vector3(sign*.25,.55,.68)));
      if(gesture.cast>0||gesture.card)continue;
      const hand=hands[side].clone().lerp(new THREE.Vector3(sign*.235,.70,.26),seatWeight);
      chairLimb(bones[side+'Arm'],bones[side+'ForeArm'],bones[side+'Hand'],group.localToWorld(hand),group.localToWorld(new THREE.Vector3(sign*.38,.91,.08)));
      const wrist=bones[side+'Hand'],frame=handFrame(bones,side),character=group.getWorldQuaternion(new THREE.Quaternion());
      const along=new THREE.Vector3(0,0,1).applyQuaternion(character),dorsal=new THREE.Vector3(0,1,0).applyQuaternion(character),across=new THREE.Vector3().crossVectors(along,dorsal).normalize();
      const source=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.across,frame.along,frame.normal)),desired=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,along,dorsal));
      const delta=desired.multiply(source.invert()),parent=wrist.parent.getWorldQuaternion(new THREE.Quaternion()),rotation=wrist.quaternion.clone();saveBone(wrist);wrist.quaternion.slerp(parent.clone().invert().multiply(delta).multiply(parent).multiply(rotation),seatWeight);
      group.updateMatrixWorld(true);
    }
  }
  function gripNeck(contact){
    if(!contact?.toArray().every(Number.isFinite))return;
    neckContact=contact.clone();neckRequestedAt=lastTime;group.updateMatrixWorld(true);
    const arm=bones.RightArm,elbow=bones.RightForeArm,wrist=bones.RightHand;if(!arm||!elbow||!wrist)return;
    const affected=[arm,elbow,wrist,...gripRig.digits.map(d=>d.bone)],before=new Map(affected.map(bone=>[bone,bone.quaternion.clone()]));
    const character=group.getWorldQuaternion(new THREE.Quaternion()),along=new THREE.Vector3(0,.72,.69).normalize().applyQuaternion(character);
    const origin=arm.getWorldPosition(new THREE.Vector3()),middle=elbow.getWorldPosition(new THREE.Vector3()),end=wrist.getWorldPosition(new THREE.Vector3()),goal=contact.clone().addScaledVector(along,-.075);
    const upper=origin.distanceTo(middle),lower=middle.distanceTo(end),direction=goal.clone().sub(origin),distance=THREE.MathUtils.clamp(direction.length(),.025,upper+lower-.008);direction.normalize();
    const pole=new THREE.Vector3(-1,-.3,0).applyQuaternion(character);pole.addScaledVector(direction,-pole.dot(direction)).normalize();
    const reach=(upper*upper+distance*distance-lower*lower)/(2*distance),bend=Math.sqrt(Math.max(0,upper*upper-reach*reach));
    aimBone(arm,elbow,origin.clone().addScaledVector(direction,reach).addScaledVector(pole,bend));aimBone(elbow,wrist,origin.clone().addScaledVector(direction,distance));
    const frame=handFrame(bones,'Right'),dorsal=new THREE.Vector3(0,.69,-.72).applyQuaternion(character);
    const source=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.across,frame.along,frame.normal));
    const across=new THREE.Vector3().crossVectors(along,dorsal).normalize(),target=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,along,dorsal));
    const delta=target.multiply(source.invert()),parent=wrist.parent.getWorldQuaternion(new THREE.Quaternion());saveBone(wrist);wrist.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
    for(const d of gripRig.digits){saveBone(d.bone);const amount=d.finger==='Thumb'?.35:d.finger==='Index'?.46:.57;d.bone.quaternion.copy(d.rest).multiply(new THREE.Quaternion().setFromAxisAngle(d.axis,amount*[.62,.87,.62][d.n-1]));}
    // IK computes the contact pose, but never teleports the visible arm there.
    // Store local rotations so carrying turns transport the hand with its body.
    const blend=1-Math.exp(-10*lastDt);
    for(const bone of affected){bone.quaternion.copy(before.get(bone).slerp(bone.quaternion,blend));neckPose.set(bone,bone.quaternion.clone());}
    syncAnchors();
  }
  function settleNeckPose(time,dt){
    if(!neckPose.size)return;
    // gripNeck is called after update by the classroom. Retain the previous
    // contact for that one frame, then blend back if no new request arrives.
    const stillRequested=neckContact&&time-neckRequestedAt<=Math.max(dt,lastDt)*1.5+1e-7;
    const blend=stillRequested?0:1-Math.exp(-10*dt);let remaining=0;
    for(const [bone,previous]of neckPose){
      const target=bone.quaternion.clone();saveBone(bone);bone.quaternion.copy(previous.clone().slerp(target,blend));
      remaining=Math.max(remaining,bone.quaternion.angleTo(target));neckPose.set(bone,bone.quaternion.clone());
    }
    if(!stillRequested&&remaining<.0002){neckPose.clear();neckContact=null;}
  }
  const weights={Idle:1,Walk:0,Write:0,Card:0,Throw:0};
  actions.Idle.setEffectiveWeight(1);
  function syncAnchors(){
    group.updateMatrixWorld(true);group.getWorldQuaternion(inverse).invert();
    for(const [side,anchor] of Object.entries(anchors)){
      const bone=bones[side==='right'?'RightHand':'LeftHand'];
      bone.getWorldPosition(position);anchor.position.copy(group.worldToLocal(position));
      const frame=handFrame(bones,side==='right'?'Right':'Left');
      rotation.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.across,frame.along,frame.normal));anchor.quaternion.copy(inverse).multiply(rotation);
    }
    group.updateMatrixWorld(true);
  }
  function update(time,{inkLeft=0,walking=0,speed=null,look=0,lookYaw=null,lookPitch=0,phase='board',crawling=false,seated=false}={}){
    // The teacher never crawls, including stale motion snapshots or editor input.
    crawling=false;
    const reset=lastTime===null||time<lastTime;
    // Match the game's 250 ms foreground bound; dropping time here alone
    // makes the teacher move farther than its feet animate on slow frames.
    const dt=reset?0:Math.min(.25,Math.max(0,time-lastTime));lastTime=time;lastDt=dt;
    if(reset){neckPose.clear();neckContact=null;neckRequestedAt=-Infinity;}
    // A measured speed controls cadence. Do not also shrink the stride by
    // mixing Idle into Walk at that same fractional speed.
    const moving=phase==='stunned'||seated?0:Number.isFinite(speed)?(speed>.03?1:0):THREE.MathUtils.clamp(walking,0,1),write=phase==='board'&&!seated?(1-moving):0;
    const target={Idle:1-moving-write,Walk:moving,Write:write,Card:0,Throw:0};
    if(gesture.card){Object.keys(target).forEach(k=>target[k]=k==='Card'?1:0);}
    else if(gesture.cast>0){Object.keys(target).forEach(k=>target[k]=k==='Throw'?1:0);}
    const alpha=reset?1:1-Math.exp(-dt*12);
    for(const [name,action] of Object.entries(actions)){
      weights[name]=THREE.MathUtils.lerp(weights[name]||0,target[name]||0,alpha);
      action.setEffectiveWeight(weights[name]);
      if(reset)action.time=0;
    }
    const requestedRate=Number.isFinite(speed)?metric?normalWalkCycleRate('teacher',speed,nominalWalkSpeed):THREE.MathUtils.clamp(Math.max(0,speed)/nominalWalkSpeed,.1,3.8):.55+moving*.45;
    walkRate=reset?requestedRate:THREE.MathUtils.damp(walkRate,requestedRate,16,dt);actions.Walk.setEffectiveTimeScale(walkRate);
    actions.Throw.paused=true;actions.Throw.time=THREE.MathUtils.clamp(gesture.cast,0,1)*actions.Throw.getClip().duration;
    for(const [bone,q]of groundPose)bone.quaternion.copy(q);groundPose.clear();
    capturePose.restore();crawlPose.restore();
    if(seatHipSaved){bones.Hips.position.copy(seatHipSaved);seatHipSaved=null;}
    walkingArms?.restore();
    for(const [bone,rotation]of poseSaved)bone.quaternion.copy(rotation);poseSaved.clear();handMotion.restore();mixer.update(dt);
    handMotion.apply({time,dt,reset,seated:write>.35,mood:write>.35?'writing':'resting',moving,carrying:false});settleNeckPose(time,dt);
    walkingArms?.apply({weight:neckContact?0:weights.Walk||0,seated,crawling,restraint:phase==='stunned'?'stunned':'free',teacher:true,walkTime:actions.Walk.time,cycleDuration:actions.Walk.getClip().duration});
    sitOnOfficeChair(seated&&phase!=='stunned',dt,reset);
    // Look offset is applied after sampling, never accumulated into the bind pose.
    const yawTarget=Number.isFinite(lookYaw)?lookYaw:THREE.MathUtils.clamp(look,-.5,.5);
    lookValue+=Math.atan2(Math.sin(yawTarget-lookValue),Math.cos(yawTarget-lookValue))*alpha;lookPitchValue=THREE.MathUtils.lerp(lookPitchValue,Number(lookPitch)||0,alpha);
    const characterRotation=group.getWorldQuaternion(new THREE.Quaternion()),headParent=bones.Head.parent.getWorldQuaternion(new THREE.Quaternion());
    lookRotation.setFromEuler(new THREE.Euler(lookPitchValue,lookValue,0,'YXZ')).premultiply(characterRotation).multiply(characterRotation.clone().invert());
    saveBone(bones.Head);bones.Head.quaternion.premultiply(headParent.clone().invert().multiply(lookRotation).multiply(headParent));
    crawlPose.apply({active:crawling&&!seated,time,dt,speed:Number.isFinite(speed)?speed:0,reset});
    const support={};for(const side of ['Left','Right']){const foot=bones[side+'Foot'];if(foot)support[side]={height:group.worldToLocal(foot.getWorldPosition(new THREE.Vector3())).y,rotation:foot.getWorldQuaternion(new THREE.Quaternion())};}
    capturePose.apply(phase==='stunned'?'stunned':'free',time,dt,{reset});
    if(capturePose.state().weight>.001){
      // Pose blending alone can send a recovering knee through the floor.
      // Replant each foot after that blend, without moving/scaling the root.
      const save=bone=>{if(!groundPose.has(bone))groundPose.set(bone,bone.quaternion.clone());};
      for(const [side,sign]of [['Left',1],['Right',-1]]){const foot=bones[side+'Foot'],base=support[side];if(!base)continue;const goal=group.worldToLocal(foot.getWorldPosition(new THREE.Vector3()));goal.y=Math.max(goal.y,base.height);chairLimb(bones[side+'UpLeg'],bones[side+'Leg'],foot,group.localToWorld(goal),group.localToWorld(new THREE.Vector3(sign*.28,.42,.58)),save);foot.quaternion.copy(foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(base.rotation));group.updateMatrixWorld(true);}
    }
    faceEffects.update({stunned:phase==='stunned',inkLeft},dt,reset);
    chalk.visible=phase!=='stunned'&&!crawling&&weights.Write>.35;
    syncAnchors();
  }
  update(0,{phase:'watching'});
  return{group,bones,update,getHand:side=>anchors[side],castChalk:progress=>{gesture.cast=THREE.MathUtils.clamp(Number(progress)||0,0,1);},gripNeck,setGesture:value=>{gesture={card:false,cast:0,...value};},
    dispose(){faceEffects.dispose();mixer.stopAllAction();mixer.uncacheRoot(model);},
    diagnostics:()=>({asset:group.userData.asset,clips:Object.keys(actions),weights:{...weights},height:TEACHER_PROPORTIONS.height,face:faceEffects.diagnostics(),animation:{time:mixer.time,walkRate,nominalWalkSpeed},hands:handMotion.diagnostics(),headLook:{yaw:lookValue,pitch:lookPitchValue},seatedWeight:seatWeight,capture:capturePose.state(),crawl:crawlPose.state()})};
}
