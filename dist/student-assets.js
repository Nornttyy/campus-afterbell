import {createStudentSize} from './student-size73.js?v=campus-83';
import {createFacialEffects} from './facial-effects64.js?v=campus-83';
import {requireModelBudget} from './model-budget64.js';
import {WRITING_PROPS} from './writing-props58.js?v=campus-83';
import {WRITING_GRIPS} from './writing-grips58.js?v=campus-83';
import {THIRD_PALM_PROFILES} from './third-palm-profiles55.js?v=campus-83';
import {createStudentHandMotion,createFingerRig,handFrame} from './hand-motion.js?v=campus-83';
import {createCapturePose} from './capture-poses.js?v=campus-83';
import {createToiletSeatPose} from './toilet-seat78.js?v=campus-83';
import {createBedPose} from './bed-pose78.js?v=campus-83';
import {createMapActivityPose} from './map-activity-pose77.js?v=campus-83';
import * as T from './vendor/three.module.js';
import {createDeskItem,THROWABLE_ITEM_KINDS,FOOD_ITEM_KINDS} from './game-actors.js?v=campus-83';
import {propContact} from './prop-assets.js?v=campus-83';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
import {useCharacterBaseColor} from './character-materials.js?v=campus-83';
import {createCrawlPose} from './crawl-pose.js?v=campus-83';
import {createStudentGestures} from './student-gestures.js?v=campus-83';
import {createSeatedHandClearance} from './seated-hand-clearance.js?v=campus-83';
import {createWalkingArmPose} from './walking-arm-pose.js?v=campus-83';
import {createSchoolPen,SCHOOL_PEN,createPenFingerContact,penTwirlQuaternion} from './pen-motion.js?v=campus-83';
import {createStudentFaceShape} from './student-face-shape75.js?v=campus-83';
import {createStudentEyes} from './student-eyes56.js?v=campus-83';
import {createStudyBook} from './study-book58.js?v=campus-83';
import {normalWalkCycleRate} from './movement55.js?v=campus-83';
import {writingStroke,thirdPersonPenTime} from './study-motion64.js?v=campus-83';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export const STUDENT_ASSETS=Object.freeze({
 boy:Object.freeze({file:'student-boy-v4',contact:'boy'}),
 girl:Object.freeze({file:'student-girl-v4',contact:'girl'}),
 glasses:Object.freeze({file:'student-glasses-v2',contact:'boy'}),
 ponytail:Object.freeze({file:'student-ponytail-v1',contact:'girl'})
});
export function normalizeStudentVariant(value,{glasses=false}={}){
 if(glasses&&(value===undefined||value==='boy'))return 'glasses';
 return Object.hasOwn(STUDENT_ASSETS,value)?value:'boy';
}
// Surface anchors measured from the authored Snack/throw pose: the midpoint of
// the old prop's closest surfaces to the actual skinned index and thumb tips.
// Moving the replacement around that anchor preserves the original grip while
// keeping its proportions, hand animation and wrist orientation unchanged.
const heldSurface={
 boy:{snack:[-.05518,.07367,.03026],drink:[-.02955,.06281,.02890],burger:[-.05521,.05100,.05354],ink:[-.02026,.04977,.03294]},
 girl:{snack:[-.05740,.01915,.03099],drink:[-.03418,.01742,.02794],burger:[-.06268,.02983,.05301],ink:[-.02751,.01201,.03941]}
};
// Fixed hand-space contacts fitted against the new imported index/thumb skin,
// retaining the prop's real dimensions. Source measurements and residuals live
// in art-source/characters40/runtime/grip-fit.json, not in a per-frame solver.
const metricGrip={
 boy:{snack:[[.066182,.157397,-.107051],.3],drink:[[.053703,.116425,-.094486],0],burger:[[.003264,.135440,-.113577],0],ink:[[.039499,.116713,-.085633],0]},
 girl:{snack:[[.078095,.133082,-.096877],-.6],drink:[[.063957,.086544,-.073317],0],burger:[[.114134,.094834,-.099207],0],ink:[[.060694,.106770,-.066941],0]},
 glasses:{snack:[[.052249,.112558,-.091754],0],drink:[[.060168,.078741,-.060639],0],burger:[[.039447,.055429,-.060556],0],ink:[[.052156,.093239,-.056775],0]},
 ponytail:{snack:[[.073171,.117963,-.090958],-.6],drink:[[.036152,.067442,-.066014],0],burger:[[.028923,.096505,-.083670],0],ink:[[.036282,.083803,-.050635],0]}
};
const metricSmallGrip={
 boy:{smoke:[[.070452,.138667,-.090442],0],flash:[[.076819,.108710,-.101287],0],phone:[[.065590,.108071,-.116576],.45]},
 girl:{smoke:[[.064968,.061000,-.074039],0],flash:[[.059902,.058719,-.067953],0],phone:[[.045670,.117387,-.081249],-.6]},
 glasses:{smoke:[[.060446,.061000,-.061745],0],flash:[[.053070,.058786,-.069772],0],phone:[[.034405,.075000,-.088908],0]},
 ponytail:{smoke:[[.037172,.061000,-.066628],0],flash:[[.042740,.063494,-.059682],0],phone:[[.032615,.101093,-.075035],-.6]}
};
// Each writing grip is fitted to the imported thumb/index skin, then the
// unchanged pencil is aimed at the sloped page. These only apply alongside
// the matching authored writing pose, never to the older flat-palm clips.
const metricWritingPencil={
 boy:{position:[-.07466496,.14386362,-.07507658],quaternion:[.15971176,-.68762509,-.67741954,-.20680099]},
 girl:{position:[0.00357238,0.10551309,-0.10905607],quaternion:[-.62278070,.31417243,.64358707,.31501677]},
 glasses:{position:[0.00732372,0.14586900,-0.10130272],quaternion:[-.60746472,.33025672,.64622399,.32297318]},
 ponytail:{position:[-.01952132,.11594614,-.09114515],quaternion:[-.58624631,.32258945,.69039004,.27497802]}
};
// Fitted against actual skinned index/thumb surfaces. Metre-space transforms
// for the shipping four rigs; no mesh scaling or animation changes.
const novelMetricGrip={"boy":{"banana":[[0.025703,0.153425,-0.094486],[0,3.841593,-1.75]],"bananaPeel":[[0.070452,0.132667,-0.090442],[0,2.791593,0]],"garlic":[[0.070499,0.153713,-0.119633],[-0.847,0.714593,-0.022]],"gum":[[0.084499,0.145713,-0.100633],[0.7,2.374593,-1.4]],"lunch":[[-0.024736,0.16544,-0.083577],[-0.88,3.141593,0.135]],"pen":[[0.065499,0.135713,-0.115633],[0.61,1.133593,0]]},"girl":{"banana":[[0.069957,0.116544,-0.065317],[1.333,3.141593,0.18]],"bananaPeel":[[0.056968,0.102,-0.119039],[-0.7,2.441593,0]],"garlic":[[0.075694,0.12577,-0.076941],[0.62,2.069593,0]],"gum":[[0.082694,0.12277,-0.066941],[-0.588,2.441593,0.722]],"lunch":[[0.122134,0.125834,-0.129207],[0.745,2.261593,0]],"pen":[[0.060694,0.11877,-0.103941],[1.43,2.566593,0.88]]},"glasses":{"banana":[[0.030168,0.108741,-0.084639],[0.53,3.141593,0.112]],"bananaPeel":[[0.060446,0.091,-0.091745],[-0.09,2.441593,-0.52]],"garlic":[[0.082156,0.108239,-0.099775],[-1.58,3.141593,1.4]],"gum":[[0.052156,0.123239,-0.086775],[-1.05,3.311593,-0.113]],"lunch":[[0.022447,0.115429,-0.061556],[-1.422,2.463593,0]],"pen":[[0.111156,0.078239,-0.082775],[-0.619,3.311593,-0.876]]},"ponytail":{"banana":[[0.036152,0.096442,-0.096014],[-0.915,2.441593,0]],"bananaPeel":[[0.037172,0.091,-0.091628],[-0.7,2.441593,0]],"garlic":[[0.067282,0.113803,-0.080635],[-0.7,2.530593,0.022]],"gum":[[0.066282,0.113803,-0.080635],[-0.722,2.351593,-0.7]],"lunch":[[0.028923,0.081505,-0.11767],[0.022,3.141593,0.678]],"pen":[[0.072282,0.060803,-0.052635],[-0.628,2.000593,0]]}};
function fitHeldSurface(prop,kind,variant,metric=false){
 const whole=metric&&prop.userData.propAsset&&THIRD_PALM_PROFILES[variant]?.[kind];if(whole){prop.position.fromArray(whole.position);prop.rotation.fromArray(whole.rotation);return;}
 const novel=metric&&novelMetricGrip[variant]?.[kind];
 if(novel&&(!['banana','garlic'].includes(kind)||prop.userData.propAsset)){prop.position.fromArray(novel[0]);prop.rotation.fromArray(novel[1]);return;}
 const calibrated=metric&&(prop.userData.contactFit?metricGrip[variant]?.[kind]:metricSmallGrip[variant]?.[kind]);
 if(calibrated){prop.position.fromArray(calibrated[0]);prop.rotation.set(calibrated[1],Math.PI,0);return;}
 const equivalent={banana:'drink',bananaPeel:'smoke',garlic:'ink',gum:'ink',lunch:'burger',pen:'ink'}[kind];
 if(metric&&equivalent){const fit=metricGrip[variant]?.[equivalent]||metricSmallGrip[variant]?.[equivalent];if(fit){prop.position.fromArray(fit[0]);prop.rotation.set(fit[1],Math.PI,0);return;}}
 const point=heldSurface[STUDENT_ASSETS[variant]?.contact||'boy'][kind];
 if(!point||!prop.userData.contactFit)return;
 const original=V(...point),replacement=propContact(prop,original);
 prop.position.add(original.sub(replacement).applyQuaternion(prop.quaternion));
}
function cloneSkin(source){
  const copy=source.clone(true),map=new Map();
  function pair(a,b){map.set(a,b);a.children.forEach((c,i)=>pair(c,b.children[i]));}pair(source,copy);
  source.traverse(o=>{if(o.isSkinnedMesh){const n=map.get(o);n.skeleton=o.skeleton.clone();n.skeleton.bones=o.skeleton.bones.map(b=>map.get(b));n.bindMatrix.copy(o.bindMatrix);n.bind(n.skeleton,n.bindMatrix);n.frustumCulled=false;}});return copy;
}
export async function loadStudentAssets(){
 const loader=new GLTFLoader(),variants=Object.keys(STUDENT_ASSETS),files=[...variants.map(v=>STUDENT_ASSETS[v].file),'hand-left-v3','hand-right-v3','teacher-hand-left-v1','teacher-hand-right-v1'];
 const loaded=await Promise.all(files.map(n=>loader.loadAsync(new URL(`./assets/models/${n}.glb?v=mesh-64`,import.meta.url).href)));
 loaded.forEach((asset,i)=>requireModelBudget(asset,files[i]));
 const sources=Object.fromEntries(variants.map((v,i)=>[v,loaded[i]]));
 return {createStudent:(options={})=>{const variant=normalizeStudentVariant(options.variant,options),source=sources[variant];return createRiggedStudent({scene:cloneSkin(source.scene),animations:source.animations},{...options,variant,metric:true,motionProfile:source.parser.json.asset.extras.characters40,asset:STUDENT_ASSETS[variant].file});},createHand:(side,scale)=>createRiggedPalm(loaded[side<0?4:5],side,scale),createTeacherHand:(side,scale)=>{const hand=createRiggedPalm(loaded[side<0?6:7],side,scale);hand.group.userData.characterRole='teacher';hand.group.userData.asset=side<0?'teacher-hand-left-v1':'teacher-hand-right-v1';return hand;}};
}
export function createRiggedStudent(gltf,{seated=true,seed=0,variant='boy',glasses=false,metric=gltf.parser?.json?.asset?.extras?.characters40?.normalized===true,motionProfile=gltf.parser?.json?.asset?.extras?.characters40||{},asset=null,referenceShape=false}={}){
 variant=normalizeStudentVariant(variant,{glasses});glasses=variant==='glasses';
 const group=new T.Group();group.name=`student-${variant}-tripo`;group.userData.character=variant;group.userData.asset=asset||(metric?STUDENT_ASSETS[variant].file:glasses?'student-glasses-v1':`student-${variant}-v3`);
 const model=gltf.scene;model.scale.setScalar(metric?1:1.80);group.add(model);
 const bones={};model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;if(o.isMesh){o.castShadow=true;o.frustumCulled=false;}});
 useCharacterBaseColor(model);
 const faceShape=createStudentFaceShape(model,{variant,enabled:metric&&referenceShape});
 const eyes=createStudentEyes(model,{variant,seed,enabled:metric});let eyeLook=null;
 const faceEffects=createFacialEffects(model,{variant});let faceInkLeft=0;

 for(const name of ['Head','Hips','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand'])if(!bones[name])throw new Error(`${group.userData.asset}: missing ${name} bone`);
 const head=bones.Head;
 const bodySize=metric?createStudentSize(group,model,bones):null;
 const mixer=new T.AnimationMixer(model),actions={},weights={};
 for(const clip of gltf.animations){const a=mixer.clipAction(clip);actions[clip.name]=a;a.setEffectiveWeight(0).play();a.time=(seed*.17)%clip.duration;weights[clip.name]=0;}
 for(const name of ['Idle','Walk','Sit','Write','Snack','Phone','Think','Carry','WalkCarry'])if(!actions[name])throw new Error(`${group.userData.asset}: missing ${name} clip`);
 const mapping={resting:'Sit',listening:'Sit',reading:'Sit','computer-idle':'Sit',writing:'Write',computer:'Sit',snack:'Snack',drink:'Snack',burger:'Snack',banana:'Snack',garlic:'Snack',gum:'Snack',lunch:'Snack',pen:'Write',bananaPeel:'Sit',phone:'Phone',smoke:'Sit',flash:'Sit',ink:'Sit',thinking:'Think',chat:'Think',hero:'Think'};
 const nominalWalkSpeed=Number(motionProfile.nominalWalkSpeed)||.475;
 let crawling=false,seatSurface=null,mapActivity=null,onBed=false,lying=false,sleeping=false;const toiletPose=createToiletSeatPose(group,bones,variant);const bedPose=createBedPose(group,bones,variant);const mapPose=createMapActivityPose(group,bones);
 const headLook={yaw:0,pitch:0},headTarget={yaw:null,pitch:0};
 let walkRate=1,mood='writing',last=null,moving=0,held=false,heldAction=null,using=null,penWriting=false,penTwirling=false,penTwirlBlend=0,penTwirlAge=0,isSeated=seated,captivity='free',restraintStartedAt=null,throwProgress=0,throwAge=Infinity,throwBlend=0,lastThrowable=null;
 const crawlPose=createCrawlPose(group,bones),capturePose=createCapturePose(group,bones),handMotion=createStudentHandMotion(group,bones,{seed,authoredNeutral:metric,authoredTableContact:!!motionProfile.writeContact42}),throwSaved=new Map(),headLookSaved=new Map();
 const digitRest=new Map(Object.entries(bones).filter(([name])=>/^LeftHand(?:Index|Middle|Ring|Pinky|Thumb)\d$/.test(name)).map(([,bone])=>[bone,bone.quaternion.clone()]));
 const grips={left:new T.Group(),right:new T.Group()};
 for(const [side,anchor]of Object.entries(grips)){
  anchor.name=side+'-student-hand';group.add(anchor);
  anchor.userData.attachments={phone:{position:[0,.075,-.035],rotation:[0,Math.PI,0]}};
  if(metric)for(const kind of ['phone']){const contact=metricSmallGrip[variant][kind];anchor.userData.attachments[kind]={position:[...contact[0]],rotation:[contact[1],Math.PI,0]};}
 }
 const gestureMotion=metric?createStudentGestures(group,bones,gltf.animations,Object.fromEntries(Object.entries(grips).map(([side,g])=>[side,g.userData.attachments]))):null;
 const walkingArms=metric?createWalkingArmPose(group,bones):null;
 const wholeTargets=Object.fromEntries(Object.entries(THIRD_PALM_PROFILES[variant]||{}).map(([kind,fit])=>[kind,Object.entries(fit.bones).filter(([name])=>bones[name]).map(([name,q])=>({bone:bones[name],target:new T.Quaternion().fromArray(q)}))]));let wholeGripWeight=0,wholeGripKind=null;
 function poseWholeGrip(kind,dt,reset,enabled){const target=enabled&&wholeTargets[kind]?1:0;if(target)wholeGripKind=kind;wholeGripWeight=reset?target:T.MathUtils.damp(wholeGripWeight,target,16,dt);if(wholeGripWeight<.0001)return;for(const {bone,target}of wholeTargets[wholeGripKind]||[]){saveThrowBone(bone);bone.quaternion.slerp(target,wholeGripWeight);}}
 const seatedClearance=metric?createSeatedHandClearance(group,bones):null;
 const foods=Object.fromEntries(['snack','drink','burger'].map(kind=>{const prop=createDeskItem(kind);prop.position.set(0,kind==='burger'?.047:.065,-.035);prop.rotation.y=Math.PI;fitHeldSurface(prop,kind,variant,metric);prop.visible=false;grips.left.add(prop);return[kind,prop];}));
 function ensureFood(kind){if(!foods[kind]){const prop=createDeskItem(kind);prop.position.set(0,kind==='lunch'?.047:.065,-.035);prop.rotation.y=Math.PI;fitHeldSurface(prop,kind,variant,metric);prop.visible=false;grips.left.add(prop);foods[kind]=prop;}return foods[kind];}
 const throwables={};
 function ensureThrowable(kind){if(!throwables[kind]){const prop=createDeskItem(kind);prop.position.set(0,.061,-.028);prop.rotation.y=Math.PI;fitHeldSurface(prop,kind,variant,metric);prop.visible=false;grips.left.add(prop);throwables[kind]=prop;}return throwables[kind];}
 const studyBook=createStudyBook(group);
 const pencil=new T.Group();pencil.name='held-writing-pencil';
 const writingFit=metric&&motionProfile.writeContact42&&metricWritingPencil[variant];
 if(writingFit){pencil.position.fromArray(writingFit.position);pencil.quaternion.fromArray(writingFit.quaternion).normalize();}
 else{pencil.position.set(-.015,.105,.065);pencil.rotation.x=2.15;}
 grips.right.add(pencil);
 const schoolPen=createSchoolPen();schoolPen.name='school-writing-pen';schoolPen.position.y=-.129-SCHOOL_PEN.tipY;const penFit=WRITING_PROPS[variant];if(penFit){schoolPen.position.fromArray(penFit.position);schoolPen.quaternion.fromArray(penFit.quaternion);}pencil.add(schoolPen);
 const writingGrip=Object.entries(WRITING_GRIPS[variant]||{}).map(([name,q])=>({bone:bones[name],delta:new T.Quaternion().fromArray(q)}));
 const pencilRest={position:pencil.position.clone(),quaternion:pencil.quaternion.clone()},penFinger=createPenFingerContact(group,bones),penDigits=createFingerRig(group,bones,'Right');
 const penHandSamples=[];model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const {skinIndex,skinWeight}=mesh.geometry.attributes;for(let i=0;i<skinIndex.count;i++){let best=0,joint=0;for(let k=0;k<4;k++)if(skinWeight.getComponent(i,k)>best){best=skinWeight.getComponent(i,k);joint=skinIndex.getComponent(i,k);}if(mesh.skeleton.bones[joint].name.includes('RightHand'))penHandSamples.push({mesh,index:i});}});
 const pos=V(),q=new T.Quaternion(),inv=new T.Quaternion();
 function saveThrowBone(bone){if(!throwSaved.has(bone))throwSaved.set(bone,bone.quaternion.clone());}
 function aimBone(bone,child,target){
  const origin=bone.getWorldPosition(V()),from=child.getWorldPosition(V()).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
  const delta=new T.Quaternion().setFromUnitVectors(from,to),parent=bone.parent.getWorldQuaternion(new T.Quaternion());saveThrowBone(bone);
  bone.quaternion.copy(parent.clone().invert().multiply(delta).multiply(bone.getWorldQuaternion(new T.Quaternion())));group.updateMatrixWorld(true);
 }
 function clearWritingTransition(){
  // Turning a flat hand into the pencil grip sweeps curved fingers through
  // the desk when all joints interpolate together. Lift only that brief
  // turn, with two-bone IK; the accepted endpoint poses remain unchanged.
  const shared=(weights.Sit||0)+(weights.Write||0)+(weights.Snack||0);
  if(!motionProfile.writeContact42||!isSeated||captivity!=='free'||shared<.995)return;
  const phase=T.MathUtils.clamp((weights.Write||0)/shared,0,1);
  const lift=({girl:.016,glasses:.010,ponytail:.024}[variant]||0)*4*phase*(1-phase);
  liftWritingHand(lift);
 }
 function liftWritingHand(lift,offset=null){
  if(lift<.00001&&!offset)return;
  group.updateMatrixWorld(true);
  const arm=bones.RightArm,fore=bones.RightForeArm,wrist=bones.RightHand;
  const root=arm.getWorldPosition(V()),middle=fore.getWorldPosition(V()),end=wrist.getWorldPosition(V()),wristRotation=wrist.getWorldQuaternion(new T.Quaternion());
  const upper=root.distanceTo(middle),lower=middle.distanceTo(end),target=end.clone().add((offset||V(0,lift,0)).applyQuaternion(group.getWorldQuaternion(new T.Quaternion())));
  const direction=target.clone().sub(root),distance=T.MathUtils.clamp(direction.length(),Math.abs(upper-lower)+.001,upper+lower-.001);direction.normalize();target.copy(root).addScaledVector(direction,distance);
  const pole=middle.clone().sub(root).addScaledVector(direction,-middle.clone().sub(root).dot(direction));
  if(pole.lengthSq()<.000001)pole.copy(V(-1,0,0).applyQuaternion(group.getWorldQuaternion(new T.Quaternion()))).addScaledVector(direction,-pole.dot(direction));
  pole.normalize();
  const along=(upper*upper+distance*distance-lower*lower)/(2*distance),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  saveThrowBone(wrist);aimBone(arm,fore,root.clone().addScaledVector(direction,along).addScaledVector(pole,height));aimBone(fore,wrist,target);
  wrist.quaternion.copy(wrist.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(wristRotation));group.updateMatrixWorld(true);
 }
 function poseWritingStroke(time,enabled){
  if(!enabled||!motionProfile.writeContact42||(weights.Write||0)<.99)return;
  group.updateMatrixWorld(true);
  const hand=bones.RightHand,frame=handFrame(bones,'Right'),matrix=new T.Matrix4().makeBasis(frame.across,frame.along,frame.normal).setPosition(hand.getWorldPosition(V()));
  matrix.multiply(new T.Matrix4().compose(pencilRest.position,pencilRest.quaternion,V(1,1,1)));
  const nib=group.worldToLocal(V(0,-.129,0).applyMatrix4(matrix));
  const {x:dx,z:dz}=writingStroke(time),dy=(Math.abs(nib.x+dx)-Math.abs(nib.x))*Math.tan(.14);
  liftWritingHand(0,V(dx,dy,dz));
 }
 function posePenTwirl(dt,reset,enabled){
  penTwirlBlend=reset?(enabled?1:0):T.MathUtils.damp(penTwirlBlend,enabled?1:0,9,dt);
  if(enabled&&penTwirlBlend>.99)penTwirlAge+=dt;
  if(penTwirlBlend<.0001||captivity!=='free'||!isSeated)return;
  liftWritingHand(.075*penTwirlBlend);
  const phase=thirdPersonPenTime(penTwirlAge)*Math.PI*2/1.6;
  for(const d of penDigits.digits){
   if(!['Index','Middle','Pinky'].includes(d.finger))continue;
   saveThrowBone(d.bone);
   const offset=d.finger==='Index'?0:d.finger==='Middle'?-.6:-1.1;
   const amount=(d.finger==='Middle'?-.10:.055)*Math.sin(phase+offset)*penTwirlBlend;
   d.bone.quaternion.multiply(new T.Quaternion().setFromAxisAngle(d.axis,amount));
  }
 }
 function poseHeadLook(dt,reset){
  const yaw=headTarget.yaw??0,pitch=(Number.isFinite(headTarget.pitch)?headTarget.pitch:0)-(isSeated?.08*(weights.Phone||0):0),alpha=reset?1:1-Math.exp(-16*dt);
  const difference=Math.atan2(Math.sin(yaw-headLook.yaw),Math.cos(yaw-headLook.yaw));headLook.yaw+=difference*alpha;headLook.pitch=T.MathUtils.lerp(headLook.pitch,pitch,alpha);
  const character=group.getWorldQuaternion(new T.Quaternion());
  for(const [name,weight]of [['Neck',.32],['Head',.68]]){const bone=bones[name];if(!bone)continue;headLookSaved.set(bone,bone.quaternion.clone());const parent=bone.parent.getWorldQuaternion(new T.Quaternion()),turn=new T.Quaternion().setFromEuler(new T.Euler(headLook.pitch*weight,headLook.yaw*weight,0,'YXZ'));turn.premultiply(character).multiply(character.clone().invert());bone.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));group.updateMatrixWorld(true);}
 }
 function poseThrow(dt,reset){
  const selected=THROWABLE_ITEM_KINDS.includes(heldAction||mood),releasing=lastThrowable!==null&&throwAge>=0&&throwAge<.34;
  const enabled=captivity==='free'&&(selected&&held||releasing);
  throwBlend=reset?(enabled?1:0):T.MathUtils.damp(throwBlend,enabled?1:0,14,dt);
  if(throwBlend<.001||captivity!=='free')return;
  group.updateMatrixWorld(true);
  const arm=bones.LeftArm,forearm=bones.LeftForeArm,wrist=bones.LeftHand,root=arm.getWorldPosition(V()),elbow=forearm.getWorldPosition(V()),hand=wrist.getWorldPosition(V());
  const charge=T.MathUtils.smoothstep(throwProgress,0,1)*(releasing?1-T.MathUtils.smoothstep(throwAge,0,.16):1);
  const stroke=releasing?Math.sin(Math.PI*T.MathUtils.smoothstep(throwAge,0,.34)):0;
  const localRoot=group.worldToLocal(root.clone());
  const target=group.localToWorld(localRoot.add(V(.065-.035*stroke,-.10+.14*charge+.08*stroke,.235-.105*charge+.08*stroke)));
  target.lerp(hand,1-throwBlend);
  const upper=root.distanceTo(elbow),lower=elbow.distanceTo(hand),direction=target.clone().sub(root),distance=T.MathUtils.clamp(direction.length(),.025,upper+lower-.002);direction.normalize();target.copy(root).addScaledVector(direction,distance);
  const pole=V(1,-.10,0).applyQuaternion(group.getWorldQuaternion(new T.Quaternion()));pole.addScaledVector(direction,-pole.dot(direction)).normalize();
  const along=(upper*upper+distance*distance-lower*lower)/(2*distance),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  aimBone(arm,forearm,root.clone().addScaledVector(direction,along).addScaledVector(pole,height));aimBone(forearm,wrist,target);
  // Match the visible four-finger palm basis rather than assuming Mixamo axes.
  const frame=handFrame(bones,'Left');
  const current=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(frame.across,frame.along,frame.normal));
  const release=T.MathUtils.smoothstep(throwAge,.035,.12),desiredY=V(.04,.96,.28).lerp(V(0,.18,.98),releasing?release:0).normalize(),desiredX=V(1,0,0);desiredX.addScaledVector(desiredY,-desiredX.dot(desiredY)).normalize();
  const desiredZ=V().crossVectors(desiredX,desiredY).normalize(),desired=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(desiredX,desiredY,desiredZ));
  desired.premultiply(group.getWorldQuaternion(new T.Quaternion()));const delta=desired.multiply(current.invert()),parent=wrist.parent.getWorldQuaternion(new T.Quaternion());saveThrowBone(wrist);
  const rotation=parent.clone().invert().multiply(delta).multiply(wrist.getWorldQuaternion(new T.Quaternion()));wrist.quaternion.slerp(rotation,throwBlend);
  if(releasing)for(const [bone,rest]of digitRest){saveThrowBone(bone);bone.quaternion.slerp(rest,release*.94);}
  group.updateMatrixWorld(true);
 }
 function update(t){
  const reset=last===null||t<last,dt=reset?0:Math.min(.25,t-last);last=t;
  if(captivity==='free'&&isSeated)studyBook.update(mood==='reading',dt,reset,t);else studyBook.clear();
  const bookPose=studyBook.pose(),studyReturning=bookPose.active&&mood!=='reading',poseMood=bookPose.active?'reading':mood;
  const itemKind=heldAction||mood,heldPen=!studyReturning&&isSeated&&(penWriting||penTwirling||itemKind==='pen'),writingPen=heldPen&&penWriting,idleCarry=held&&using===false&&!heldPen;
  const target=isSeated?(heldPen?'Write':idleCarry?(THROWABLE_ITEM_KINDS.includes(itemKind)?'Sit':'Snack'):(mapping[poseMood]||'Sit')):(moving>.03?(held?'WalkCarry':'Walk'):(held?'Carry':'Idle')),alpha=reset?1:1-Math.exp(-dt*10);
  const desiredRate=metric?normalWalkCycleRate('student',moving,nominalWalkSpeed):T.MathUtils.clamp(moving/nominalWalkSpeed,.1,3.8);walkRate=reset?desiredRate:T.MathUtils.damp(walkRate,desiredRate,16,dt);
  for(const [name,a]of Object.entries(actions)){
   if(reset)a.time=(seed*.17)%a.getClip().duration;
   weights[name]=T.MathUtils.lerp(weights[name],name===target?1:0,alpha);a.setEffectiveWeight(weights[name]);
   // The source duration already contains cadence. Role travel speed is
   // normalized separately, never used to multiply the full gait faster.
   a.setEffectiveTimeScale(name.startsWith('Walk')?walkRate:name==='Snack'&&idleCarry?0:1);if(name==='Snack'&&idleCarry)a.time=0;
  }
  bedPose.restore();mapPose.restore();toiletPose.restore();seatedClearance?.restore();bodySize?.restore();
  for(const [bone,rotation]of headLookSaved)bone.quaternion.copy(rotation);headLookSaved.clear();
  crawlPose.restore();
  for(const [bone,rotation]of throwSaved)bone.quaternion.copy(rotation);throwSaved.clear();
  walkingArms?.restore();gestureMotion?.restore();handMotion.restore();capturePose.restore();mixer.update(dt);const resumed=capturePose.apply(captivity==='free'&&mood==='rescuing'?'rescuing':captivity,t,dt,{startedAt:restraintStartedAt,reset});
  const throwable=THROWABLE_ITEM_KINDS.includes(itemKind),handMood=bookPose.active?'reading':heldPen?'writing':FOOD_ITEM_KINDS.includes(itemKind)||throwable?'snack':mood,gestureMood=bookPose.active?'reading':heldPen?'writing':['banana','garlic','gum','lunch'].includes(itemKind)?'snack':idleCarry?itemKind:mood;
  handMotion.apply({time:t,dt:resumed?1:dt,reset,seated:isSeated,mood:handMood,restraint:captivity,moving,carrying:held,capture:capturePose.state()});gestureMotion?.apply({time:idleCarry?0:t,dt,reset,seated:isSeated,mood:gestureMood,carrying:held,moving,restraint:captivity,walkTime:actions.Walk.time,bookPose});
  walkingArms?.apply({weight:(weights.Walk||0)+(weights.WalkCarry||0),seated:isSeated,crawling,restraint:captivity,mood,carrying:held,walkTime:actions.Walk.time,cycleDuration:actions.Walk.getClip().duration});
  for(const {bone,delta}of writingGrip){if(!bone||!isSeated||captivity!=='free'||(weights.Write||0)<.01)continue;saveThrowBone(bone);bone.quaternion.multiply(new T.Quaternion().slerp(delta,T.MathUtils.smoothstep(weights.Write,.10,.99)));}
  clearWritingTransition();poseWritingStroke(t,captivity==='free'&&isSeated&&!studyReturning&&(mood==='writing'||writingPen));poseThrow(dt,reset);poseWholeGrip(itemKind,dt,reset,captivity==='free'&&Boolean(foods[itemKind]?.userData.propAsset)&&(held||(weights.Snack||0)>.01));posePenTwirl(dt,reset,heldPen&&!writingPen&&captivity==='free');crawlPose.apply({active:crawling&&!isSeated&&captivity==='free',time:t,dt,speed:moving,reset});poseHeadLook(dt,reset);bodySize?.apply({seated:isSeated,crawling,restraint:captivity,dt,reset,tableSupport:seatSurface!=='toilet'&&!FOOD_ITEM_KINDS.includes(itemKind)&&!throwable&&itemKind!=='phone',pairedHands:itemKind==='phone'});seatedClearance?.apply({seated:isSeated&&seatSurface!=='toilet'&&!bookPose.active,crawling,restraint:captivity,transition:1-Math.max(...Object.values(weights)),settledSupport:(weights.Sit||0)+(weights.Write||0)>.999999});toiletPose.apply({active:isSeated&&seatSurface==='toilet'&&captivity==='free',carrying:held});mapPose.apply(mapActivity);bedPose.apply({onBed,lying,time:t,dt,reset,carrying:held,using});group.updateMatrixWorld(true);group.getWorldQuaternion(inv).invert();
  for(const [side,a]of Object.entries(grips)){
   const b=bones[side==='left'?'LeftHand':'RightHand'];b.getWorldPosition(pos);a.position.copy(group.worldToLocal(pos));const prefix=side==='left'?'Left':'Right',center=bones[prefix+'HandMiddle1'].getWorldPosition(V()),index=bones[prefix+'HandIndex1'].getWorldPosition(V()),pinky=bones[prefix+'HandPinky1'].getWorldPosition(V());
   const y=center.sub(b.getWorldPosition(V())).normalize(),x=index.sub(pinky),thumb=bones[prefix+'HandThumb1'].getWorldPosition(V()).sub(bones[prefix+'HandMiddle1'].getWorldPosition(V()));thumb.addScaledVector(y,-thumb.dot(y));if(x.dot(thumb)<0)x.negate();x.multiplyScalar(side==='left'?1:-1).addScaledVector(y,-x.dot(y)).normalize();const z=V().crossVectors(x,y).normalize();q.setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));a.quaternion.copy(inv).multiply(q);a.userData.gripWeight=(weights.Phone||0)+(weights.Carry||0)+(weights.WalkCarry||0);
  }
  if(FOOD_ITEM_KINDS.includes(itemKind)&&held&&captivity==='free')ensureFood(itemKind);
  for(const [kind,prop]of Object.entries(foods))prop.visible=captivity==='free'&&itemKind===kind&&((weights.Snack||0)>.6||held);
  if(throwable&&held&&captivity==='free')ensureThrowable(itemKind);
  for(const [kind,prop]of Object.entries(throwables))prop.visible=captivity==='free'&&itemKind===kind&&held&&throwBlend>.6&&!(throwAge>=0&&throwAge<.34);
  pencil.position.copy(pencilRest.position);pencil.quaternion.copy(pencilRest.quaternion);
  if(penTwirlBlend>.0001&&heldPen){
   group.updateMatrixWorld(true);const spin=grips.right.getWorldQuaternion(new T.Quaternion()).invert().multiply(group.getWorldQuaternion(new T.Quaternion())).multiply(penTwirlQuaternion(thirdPersonPenTime(penTwirlAge))).multiply(schoolPen.quaternion.clone().invert()),contact=V(-SCHOOL_PEN.gripRadius,SCHOOL_PEN.gripY,0).applyQuaternion(schoolPen.quaternion).add(schoolPen.position),index=grips.right.worldToLocal(penFinger());
   pencil.position.lerp(index.sub(contact.applyQuaternion(spin)),penTwirlBlend);pencil.quaternion.slerp(spin,penTwirlBlend);
   if(penTwirlBlend>.65){
    // Blend support continuously while the wrist rotates between writing
    // and twirling, rather than snapping it on at the settled-pose threshold.
    // A horizontal pen rolls over the real upper finger skin; rotating a
    // fixed side contact made its far end cut through the neighbouring knuckle.
    group.updateMatrixWorld(true);const center=schoolPen.getWorldPosition(V()),up=V(0,1,0).applyQuaternion(group.getWorldQuaternion(new T.Quaternion())),axis=V(0,1,0).transformDirection(schoolPen.matrixWorld),across=V().crossVectors(axis,up).normalize(),updated=new Set();let lift=0;
    for(const {mesh,index}of penHandSamples){if(!updated.has(mesh.skeleton)){mesh.skeleton.update();updated.add(mesh.skeleton);}const offset=mesh.getVertexPosition(index,V()).applyMatrix4(mesh.matrixWorld).sub(center),along=offset.dot(axis),side=offset.dot(across),radius=along<-.016?SCHOOL_PEN.gripRadius:.0094;if(Math.abs(along)>.082||Math.abs(side)>radius)continue;lift=Math.max(lift,offset.dot(up)+Math.sqrt(radius*radius-side*side)+.0005);}
    if(lift>0)pencil.position.add(up.multiplyScalar(lift*T.MathUtils.smoothstep(penTwirlBlend,.65,.99)).applyQuaternion(grips.right.getWorldQuaternion(new T.Quaternion()).invert()));
   }
  }
  pencil.visible=!studyReturning&&captivity==='free'&&(heldPen||mood==='writing')&&(weights.Write||0)>.6;
  eyes.update(t,eyeLook);faceEffects.update({stunned:captivity==='stunned'||sleeping,inkLeft:faceInkLeft},dt,reset);
 }
 update(0);return{group,head,bones,update,seated,setEyeLook:look=>{eyeLook=look;},setStudyBook:source=>studyBook.setSource(source),studyBookVisible:()=>studyBook.visible(),setMood:m=>{mood=m;if(THROWABLE_ITEM_KINDS.includes(m))lastThrowable=m;},setMotion:({seatSurface:surface=null,onBed:bed=false,lying:reclined=false,sleeping:sleep=false,mapActivity:activity=null,inkLeft=0,crawling:prone=false,seated=isSeated,speed=moving,carrying=held,heldAction:heldKind=null,using:isUsing=null,penWriting:writing=false,penTwirling:twirling=false,lookYaw:headYaw=null,lookPitch:headPitch=0,restraint='free',restraintStartedAt:startedAt=null,throwProgress:progress=0,throwAge:age=Infinity}={})=>{seatSurface=surface;onBed=Boolean(bed);lying=onBed;sleeping=Boolean(bed&&sleep);mapActivity=activity;faceInkLeft=inkLeft;crawling=Boolean(prone);captivity=restraint;restraintStartedAt=Number.isFinite(startedAt)?startedAt:null;isSeated=seated;moving=Math.max(0,speed);held=carrying;heldAction=heldKind;using=isUsing;penWriting=Boolean(writing);penTwirling=Boolean(twirling);headTarget.yaw=Number.isFinite(headYaw)?headYaw:null;headTarget.pitch=Number(headPitch)||0;if(THROWABLE_ITEM_KINDS.includes(heldAction))lastThrowable=heldAction;throwProgress=T.MathUtils.clamp(Number(progress)||0,0,1);throwAge=Number.isFinite(age)?age:Infinity;},getHand:s=>grips[s],dispose(){studyBook.dispose();faceEffects.dispose();eyes.dispose();faceShape.dispose();mixer.stopAllAction();mixer.uncacheRoot(model);},diagnostics:()=>({bed:bedPose.diagnostics(),faceShape:faceShape.diagnostics(),proportions:bodySize?.diagnostics(),clips:Object.keys(actions),weights:{...weights},asset:group.userData.asset,glasses,heldAction,using,headLook:{...headLook},eyes:eyes.diagnostics(),face:faceEffects.diagnostics(),pen:{writing:penWriting,twirling:penTwirling,blend:penTwirlBlend,time:penTwirlAge},studyBook:studyBook.diagnostics(),animation:{time:mixer.time,walkRate,nominalWalkSpeed},hands:handMotion.diagnostics(),crawl:crawlPose.state(),gestures:gestureMotion?.diagnostics(),clearance:seatedClearance?.diagnostics(),capture:capturePose.state(),throwing:{kind:lastThrowable,blend:throwBlend,progress:throwProgress,age:throwAge}})};
}
export function createRiggedPalm(gltf,side,scale=1){
 const group=new T.Group();group.name=side<0?'left-desk-hand':'right-desk-hand';group.userData.asset='tripo-palm-only';group.userData.fingersPerHand=4;
 group.userData.shortForearm=Boolean(gltf.parser?.json?.asset?.extras?.characters40?.shortForearm);
 if(group.userData.shortForearm)group.userData.asset='tripo-hand-short-forearm';
 group.userData.firstPersonScale=gltf.parser?.json?.asset?.extras?.characters40?.parts?.includes('palm')?.60:1;
 const model=cloneSkin(gltf.scene);group.add(model);group.scale.setScalar(scale);
 const bones={};let mesh;
 model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;if(o.isMesh){if(!mesh||o.geometry.attributes.position.count>mesh.geometry.attributes.position.count)mesh=o;o.castShadow=false;o.frustumCulled=false;}});
 for(const bone of Object.values(bones))bone.quaternion.normalize();
 useCharacterBaseColor(model);
 group.updateMatrixWorld(true);const prefix=side<0?'Left':'Right',rig=createFingerRig(group,bones,prefix),rest=new Map();
 for(const b of Object.values(bones))rest.set(b,b.quaternion.clone());
 // Use the actual skinned fingertip as the contact point, rather than a proxy.
 const positions=mesh.geometry.attributes.position,indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
 const boneIndex=mesh.skeleton.bones.indexOf(bones[prefix+'HandIndex3']);let tipVertex=0,best=-Infinity;
 const along=rig.frame.along.clone();
 mesh.skeleton.update();
 for(let i=0;i<positions.count;i++){let w=0;for(let j=0;j<4;j++)if(indices[['getX','getY','getZ','getW'][j]](i)===boneIndex)w+=weights[['getX','getY','getZ','getW'][j]](i);if(w>.30){const p=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld);const projected=p.dot(along);if(projected>best){best=projected;tipVertex=i;}}}
 let curl=.1;
 function bend(finger,amount){for(const d of rig.digits)if(d.finger===finger)d.bone.quaternion.copy(d.rest).multiply(new T.Quaternion().setFromAxisAngle(d.axis,amount*[.62,.87,.62][d.n-1]));}
 function setCurl(a){
  curl=T.MathUtils.clamp(a,0,1);for(const f of ['Index','Middle','Ring','Pinky'])bend(f,curl);
  // Opposition turns the thumb base below. Its two distal joints still need
  // their own flexion, otherwise the whole visible thumb acts like one stick.
  for(const d of rig.digits)if(d.finger==='Thumb')d.bone.quaternion.copy(rest.get(d.bone)).multiply(new T.Quaternion().setFromAxisAngle(d.axis,curl*[0,.36,.28][d.n-1]));
 }
 function setFingerCurl(finger,a){if(['Index','Middle','Ring','Pinky','Thumb'].includes(finger))bend(finger,T.MathUtils.clamp(a,0,1));}
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
 setCurl(.1);return{group,setCurl,setFingerCurl,pointIndex,indexTip,aimThumb,opposeThumb,diagnostics:()=>({fingerChains:[...new Set(rig.digits.map(d=>d.finger))],curl,dorsal:handFrame(bones,prefix)?.normal.toArray()})};
}
