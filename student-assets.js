import {createStudentHandMotion} from './hand-motion.js?v=map-30c';
import {createCapturePose} from './capture-poses.js?v=map-30c';
import * as T from './vendor/three.module.js';
import {createDeskItem} from './game-actors.js?v=map-30c';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function cloneSkin(source){
  const copy=source.clone(true),map=new Map();
  function pair(a,b){map.set(a,b);a.children.forEach((c,i)=>pair(c,b.children[i]));}pair(source,copy);
  source.traverse(o=>{if(o.isSkinnedMesh){const n=map.get(o);n.skeleton=o.skeleton.clone();n.skeleton.bones=o.skeleton.bones.map(b=>map.get(b));n.bindMatrix.copy(o.bindMatrix);n.bind(n.skeleton,n.bindMatrix);n.frustumCulled=false;}});return copy;
}
export async function loadStudentAssets(){
 const loader=new GLTFLoader(),files=['student-boy-v2','student-girl-v2','student-glasses-v1','hand-left-v1','hand-right-v1'];
 const [boy,girl,glasses,left,right]=await Promise.all(files.map(n=>loader.loadAsync(new URL(`./assets/models/${n}.glb?v=map-30c`,import.meta.url).href)));
 return {createStudent:(options={})=>{const source=options.glasses&&options.variant!=='girl'?glasses:options.variant==='girl'?girl:boy;return createRiggedStudent({scene:cloneSkin(source.scene),animations:source.animations},options);},createHand:(side,scale)=>createRiggedPalm(side<0?left:right,side,scale)};
}
export function createRiggedStudent(gltf,{seated=true,seed=0,variant='boy',glasses=false}={}){
 const group=new T.Group();group.name=`student-${variant}-tripo`;group.userData.asset=glasses&&variant!=='girl'?'student-glasses-v1':`student-${variant}-v2`;
 const model=gltf.scene;model.scale.setScalar(1.80);group.add(model);
 const bones={};model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
 const head=bones.Head;
 const mixer=new T.AnimationMixer(model),actions={},weights={};
 for(const clip of gltf.animations){const a=mixer.clipAction(clip);actions[clip.name]=a;a.setEffectiveWeight(0).play();a.time=(seed*.17)%clip.duration;weights[clip.name]=0;}
 const mapping={resting:'Sit',writing:'Write',computer:'Write',snack:'Snack',phone:'Phone',note:'Note',thinking:'Think',chat:'Think',hero:'Think'};
 let mood='writing',last=null,moving=0,held=false,isSeated=seated,captivity='free';const capturePose=createCapturePose(group,bones),handMotion=createStudentHandMotion(group,bones,{seed});
 const grips={left:new T.Group(),right:new T.Group()};
 for(const [side,anchor]of Object.entries(grips)){
  anchor.name=side+'-student-hand';group.add(anchor);
  anchor.userData.attachments={phone:{position:[0,.075,-.035],rotation:[0,Math.PI,0]},note:{position:[0,.055,-.02],rotation:[0,Math.PI,0]}};
 }
 const snack=createDeskItem('snack');snack.position.set(0,.065,-.035);snack.rotation.y=Math.PI;grips.left.add(snack);
 const pencil=new T.Group();pencil.name='held-writing-pencil';pencil.position.set(-.015,.105,.065);pencil.rotation.x=2.15;grips.right.add(pencil);
 const barrel=new T.Mesh(new T.CylinderGeometry(.005,.005,.23,8),new T.MeshStandardMaterial({color:'#b66a28',roughness:.8}));pencil.add(barrel);
 const tip=new T.Mesh(new T.ConeGeometry(.005,.014,8),new T.MeshStandardMaterial({color:'#34332e',roughness:.85}));tip.position.y=-.122;tip.rotation.z=Math.PI;pencil.add(tip);
 const pos=V(),q=new T.Quaternion(),inv=new T.Quaternion();
 function update(t){
  const reset=last===null||t<last,dt=reset?0:Math.min(.25,t-last);last=t;
  const target=isSeated?(mapping[mood]||'Sit'):(moving>.03?(held?'WalkCarry':'Walk'):(held?'Carry':'Idle')),alpha=reset?1:1-Math.exp(-dt*10);
  for(const [name,a]of Object.entries(actions)){
   weights[name]=T.MathUtils.lerp(weights[name],name===target?1:0,alpha);a.setEffectiveWeight(weights[name]);
   // Match walk playback to movement speed within the supported clip range.
   a.setEffectiveTimeScale(name.startsWith('Walk')?T.MathUtils.clamp(moving/.475,.1,3.8):1);
  }
  handMotion.restore();capturePose.restore();mixer.update(dt);capturePose.apply(captivity==='free'&&mood==='rescuing'?'rescuing':captivity,t,dt);handMotion.apply({time:t,dt,mood,restraint:captivity,moving,carrying:held,capture:capturePose.state()});group.updateMatrixWorld(true);group.getWorldQuaternion(inv).invert();
  for(const [side,a]of Object.entries(grips)){
   const b=bones[side==='left'?'LeftHand':'RightHand'];b.getWorldPosition(pos);a.position.copy(group.worldToLocal(pos));const prefix=side==='left'?'Left':'Right',center=bones[prefix+'HandMiddle1'].getWorldPosition(V()),index=bones[prefix+'HandIndex1'].getWorldPosition(V()),pinky=bones[prefix+'HandPinky1'].getWorldPosition(V());
   const y=center.sub(b.getWorldPosition(V())).normalize(),x=index.sub(pinky),thumb=bones[prefix+'HandThumb1'].getWorldPosition(V()).sub(bones[prefix+'HandMiddle1'].getWorldPosition(V()));thumb.addScaledVector(y,-thumb.dot(y));if(x.dot(thumb)<0)x.negate();x.multiplyScalar(side==='left'?1:-1).addScaledVector(y,-x.dot(y)).normalize();const z=V().crossVectors(x,y).normalize();q.setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));a.quaternion.copy(inv).multiply(q);a.userData.gripWeight=(weights.Phone||0)+(weights.Note||0)+(weights.Carry||0)+(weights.WalkCarry||0);
  }
  snack.visible=captivity==='free'&&(weights.Snack||0)>.6;pencil.visible=captivity==='free'&&mood!=='computer'&&(weights.Write||0)>.6;
 }
 update(0);return{group,head,bones,update,seated,setMood:m=>mood=m,setMotion:({seated=isSeated,speed=moving,carrying=held,restraint='free'}={})=>{captivity=restraint;isSeated=seated;moving=Math.max(0,speed);held=carrying;},getHand:s=>grips[s],dispose(){mixer.stopAllAction();mixer.uncacheRoot(model);},diagnostics:()=>({clips:Object.keys(actions),weights:{...weights},asset:group.userData.asset,glasses,hands:handMotion.diagnostics(),capture:capturePose.state()})};
}
export function createRiggedPalm(gltf,side,scale=1){
 const group=new T.Group();group.name=side<0?'left-desk-hand':'right-desk-hand';group.userData.asset='tripo-palm-only';group.userData.fingersPerHand=4;
 const model=cloneSkin(gltf.scene);group.add(model);group.scale.setScalar(scale);
 const bones={};let mesh;
 model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;if(o.isMesh){if(!mesh||o.geometry.attributes.position.count>mesh.geometry.attributes.position.count)mesh=o;o.castShadow=false;o.receiveShadow=true;o.frustumCulled=false;}});
 group.updateMatrixWorld(true);const prefix=side<0?'Left':'Right',rest=new Map(),axis=new Map();
 for(const b of Object.values(bones)){rest.set(b,b.quaternion.clone());const q=b.getWorldQuaternion(new T.Quaternion());axis.set(b,V(1,0,0).applyQuaternion(q.invert()));}
 // Use the actual skinned fingertip as the contact point, rather than a proxy.
 const positions=mesh.geometry.attributes.position,indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
 const boneIndex=mesh.skeleton.bones.indexOf(bones[prefix+'HandIndex3']);let tipVertex=0,best=-Infinity;
 for(let i=0;i<positions.count;i++){let w=0;for(let j=0;j<4;j++)if(indices[['getX','getY','getZ','getW'][j]](i)===boneIndex)w+=weights[['getX','getY','getZ','getW'][j]](i);if(w>.30){const p=V().fromBufferAttribute(positions,i);mesh.localToWorld(p);group.worldToLocal(p);if(p.y>best){best=p.y;tipVertex=i;}}}
 let curl=.1;
 function bend(finger,amount){for(let i=1;i<=3;i++){const b=bones[prefix+'Hand'+finger+i];if(!b)continue;b.quaternion.copy(rest.get(b)).multiply(new T.Quaternion().setFromAxisAngle(axis.get(b),-amount*[.62,.87,.62][i-1]));}}
 function setCurl(a){curl=T.MathUtils.clamp(a,0,1);for(const f of ['Index','Middle','Pinky'])bend(f,curl);for(let i=1;i<=3;i++){const b=bones[prefix+'HandThumb'+i];b.quaternion.copy(rest.get(b));}}
 function setFingerCurl(finger,a){if(['Index','Middle','Pinky'].includes(finger))bend(finger,T.MathUtils.clamp(a,0,1));}
 function pointIndex(a=1){bend('Index',curl*(1-T.MathUtils.clamp(a,0,1)));}
 function indexTip(){group.updateMatrixWorld(true);mesh.skeleton.update();const p=V().fromBufferAttribute(positions,tipVertex);mesh.applyBoneTransform(tipVertex,p);mesh.localToWorld(p);return group.worldToLocal(p);}
 function aimThumb(target,amount=1){
  const root=bones[prefix+'HandThumb1'],end=bones[prefix+'HandThumb3'];group.updateMatrixWorld(true);
  const h=group.worldToLocal(root.getWorldPosition(V())),tip=group.worldToLocal(end.getWorldPosition(V()));
  const from=tip.sub(h).normalize(),to=target.clone().sub(h).normalize();
  const delta=new T.Quaternion().setFromUnitVectors(from,to),limited=new T.Quaternion().slerp(delta,Math.min(.8,amount));
  const parentQ=root.parent.getWorldQuaternion(new T.Quaternion()),groupQ=group.getWorldQuaternion(new T.Quaternion());
  const worldDelta=groupQ.clone().multiply(limited).multiply(groupQ.clone().invert());
  root.quaternion.premultiply(parentQ.clone().invert().multiply(worldDelta).multiply(parentQ));
 }
 function opposeThumb(amount=1){aimThumb(indexTip().add(V(side*.01,-.008,.012)),amount);}
 setCurl(.1);return{group,setCurl,setFingerCurl,pointIndex,indexTip,aimThumb,opposeThumb};
}
