import {createSkinContact} from './skin-contact68.js';
import * as T from './vendor/three.module.js';
import {handFrame,createFingerRig} from './hand-motion.js?v=campus-112';
import {TEXTBOOK,studyBookPose} from './study-book58.js?v=campus-110';
import {createPenFingerContact} from './pen-motion.js?v=campus-93';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Q=()=>new T.Quaternion();
const armName=/^(Left|Right)(Shoulder|Arm|ForeArm|Hand.*)$/;

// Reading lengthens the two arm segments along their rig axes to reach the desk.
export function createStudentGestures(group,bones,clips,attachments){
 const saved=new Map(),previous=new Map(),samplers={},sideBlend={Left:0,Right:0};let blend=0,typingBlend=0,lastMood=null,settled=0;
 const readingLengths=new Map();
 const managed=Object.entries(bones).filter(([name])=>armName.test(name)).map(([,b])=>b);
 for(const name of ['Idle','Walk','Sit']){
  const clip=clips.find(c=>c.name===name);samplers[name]=clip?.tracks.filter(t=>t.name.endsWith('.quaternion')).map(track=>{
   const name=track.name.slice(0,-11).replace(/^mixamorig[:_]?/,'');return {bone:bones[name],name,sample:track.createInterpolant()};
  }).filter(s=>s.bone&&armName.test(s.name))||[];
 }
 const fingerRig=createFingerRig(group,bones,'Right');
 const typingRigs={Left:createFingerRig(group,bones,'Left'),Right:fingerRig},typingTips={Left:[],Right:[]};
 const readingTips=Object.fromEntries(['Left','Right'].map(side=>[side,createPenFingerContact(group,bones,{side,finger:'Middle'})]));
 let tipSample=null,best=-Infinity;
 group.updateMatrixWorld(true);const tipBone=bones.RightHandIndex3,tipOrigin=tipBone.getWorldPosition(V()),tipAxis=tipOrigin.clone().sub(tipBone.parent.getWorldPosition(V())).normalize();
 group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const joint=mesh.skeleton.bones.indexOf(tipBone),{skinIndex,skinWeight}=mesh.geometry.attributes;if(joint<0)return;
  for(let i=0;i<skinIndex.count;i++){let w=0;for(let k=0;k<4;k++)if(skinIndex.getComponent(i,k)===joint)w+=skinWeight.getComponent(i,k);if(w<.55)continue;const p=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld),distance=p.clone().sub(tipOrigin).dot(tipAxis);if(distance>best){best=distance;tipSample={mesh,index:i,sample:createSkinContact(mesh,i)};}}
  for(const side of ['Left','Right']){
   const tip=bones[side+'HandIndex3'],joint=mesh.skeleton.bones.indexOf(tip),origin=tip.getWorldPosition(V()),axis=origin.clone().sub(tip.parent.getWorldPosition(V())).normalize(),candidates=[];let furthest=-Infinity;
   for(let i=0;i<skinIndex.count;i++){let weight=0;for(let k=0;k<4;k++)if(skinIndex.getComponent(i,k)===joint)weight+=skinWeight.getComponent(i,k);if(weight<.35)continue;const d=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).sub(origin).dot(axis);furthest=Math.max(furthest,d);candidates.push({mesh,index:i,d,sample:createSkinContact(mesh,i)});}
   // Cache only the real index tip skin. Choosing the underside after posing
   // makes contact independent of each imported rig's local finger axes.
   typingTips[side].push(...candidates.filter(p=>p.d>furthest-.018));
  }
 });
 function point(){group.updateMatrixWorld(true);return tipSample.sample(V());}
 function aim(bone,child,target){const origin=bone.getWorldPosition(V()),from=child.getWorldPosition(V()).sub(origin).normalize(),to=target.clone().sub(origin).normalize(),parent=bone.parent.getWorldQuaternion(Q()),delta=Q().setFromUnitVectors(from,to);bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));bone.updateWorldMatrix(false,true);}
 function arm(side,target,poleHint=null){
  const shoulder=bones[side+'Arm'],elbow=bones[side+'ForeArm'],wrist=bones[side+'Hand'],root=shoulder.getWorldPosition(V()),middle=elbow.getWorldPosition(V()),end=wrist.getWorldPosition(V());
  const upper=root.distanceTo(middle),lower=middle.distanceTo(end),direction=target.clone().sub(root),d=T.MathUtils.clamp(direction.length(),Math.abs(upper-lower)+.005,upper+lower-.005);direction.normalize();target=root.clone().addScaledVector(direction,d);
  // Elbows hang beneath the shoulders; the former outward pole made wrists
  // fold ninety degrees while both arms looked like they were holding a tray.
  const sign=side==='Left'?1:-1,pole=(poleHint||V(sign*.14,-1,-.04)).clone().applyQuaternion(group.getWorldQuaternion(Q()));pole.addScaledVector(direction,-pole.dot(direction)).normalize();
  const along=(upper*upper+d*d-lower*lower)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  aim(shoulder,elbow,root.clone().addScaledVector(direction,along).addScaledVector(pole,height));aim(elbow,wrist,target);
 }
 function orient(side,along,dorsal){
  group.updateMatrixWorld(true);const frame=handFrame(bones,side),current=Q().setFromRotationMatrix(new T.Matrix4().makeBasis(frame.across,frame.along,frame.normal));
  const y=along.clone().normalize(),z=dorsal.clone().addScaledVector(y,-dorsal.dot(y)).normalize(),x=V().crossVectors(y,z).normalize(),target=Q().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z)),wrist=bones[side+'Hand'],parent=wrist.parent.getWorldQuaternion(Q());
  wrist.quaternion.premultiply(parent.clone().invert().multiply(target.multiply(current.invert())).multiply(parent));wrist.updateWorldMatrix(false,true);
 }
 function freeHand(side,seated,moving,walkTime){for(const s of samplers[seated?'Sit':moving>.03?'Walk':'Idle'])if(s.name.startsWith(side))s.bone.quaternion.fromArray(s.sample.evaluate(seated?0:walkTime));group.updateMatrixWorld(true);}
 function hold(side,{seated,mood,time,nearCenter=false}){
  const shoulder=bones[side+'Arm'].getWorldPosition(V()),elbow=bones[side+'ForeArm'].getWorldPosition(V()),wrist=bones[side+'Hand'].getWorldPosition(V()),reach=shoulder.distanceTo(elbow)+elbow.distanceTo(wrist),root=group.worldToLocal(shoulder.clone()),sign=side==='Left'?1:-1;
  const food=['snack','drink','burger'].includes(mood);
  // Food keeps the requested small up/down use, never a mouth-reaching action.
  const bob=food?.0175*(1-Math.cos(time*Math.PI/ .6)):0;
  const phone=mood==='phone'&&seated;
  const local=V(nearCenter?sign*.015:root.x-sign*.025,root.y-(phone?.115:.035)+bob,root.z+reach*(phone?.72:.63)-(phone?.067:0));
  arm(side,group.localToWorld(local));
  // The oversized source head extends below its Head bone. Keep the phone
  // almost flat above the desk, with actual palms below the chin rather than
  // merely placing the wrist below the neck joint.
  const rotation=group.getWorldQuaternion(Q());orient(side,V(0,phone?.435:.76,phone?.90:.65).normalize().applyQuaternion(rotation),V(0,phone?-.90:-.65,phone?.435:.76).normalize().applyQuaternion(rotation));
 }
 function phoneTap(time){
  const frame=handFrame(bones,'Left'),wrist=bones.LeftHand.getWorldPosition(V()),matrix=new T.Matrix4().makeBasis(frame.across,frame.along,frame.normal).setPosition(wrist),fit=attachments.left.phone;
  matrix.multiply(new T.Matrix4().compose(V().fromArray(fit.position),Q().setFromEuler(new T.Euler(...fit.rotation)),V(1,1,1)));
  const normal=V(0,0,1).transformDirection(matrix),down=V(0,-1,0).transformDirection(matrix),phase=time*Math.PI*1.5,lift=.001+.014*(.5+.5*Math.cos(phase));
  const contact=V(.012,-.025,.015+lift).applyMatrix4(matrix);
  for(const d of fingerRig.digits){const curl=d.finger==='Index'?.055+.055*(.5-.5*Math.cos(phase)):d.finger==='Thumb'?.20:.32;d.bone.quaternion.copy(d.rest).multiply(Q().setFromAxisAngle(d.axis,curl*[.62,.87,.62][d.n-1]));}
  // Aim the extended index toward the screen; bend its real phalanges, then
  // solve the arm from the actual weighted fingertip, not a floating bone tip.
  const along=contact.clone().sub(bones.RightArm.getWorldPosition(V())).normalize().add(V(.20,1.20,0).applyQuaternion(group.getWorldQuaternion(Q()))).normalize();orient('Right',along,normal);
  for(let i=0;i<3;i++){const tip=point(),origin=bones.RightHand.getWorldPosition(V()),target=origin.add(contact.clone().sub(tip)),rotation=bones.RightHand.getWorldQuaternion(Q());arm('Right',target,V(-1,-.2,0));bones.RightHand.quaternion.copy(bones.RightHand.parent.getWorldQuaternion(Q()).invert().multiply(rotation));group.updateMatrixWorld(true);}
 }
 function typingPoint(side,worldReady=false){
  if(!worldReady)group.updateMatrixWorld(true);let low=Infinity,point=null;const inverse=group.matrixWorld.clone().invert();
  for(const sample of typingTips[side]){const p=sample.sample(V()).applyMatrix4(inverse);if(p.y<low){low=p.y;point=p;}}
  return point?group.localToWorld(point):bones[side+'HandIndex3'].getWorldPosition(V());
 }
 function deskLean(weight,reading=0){
  // Rotate in the student's sagittal plane, including at side-facing desks.
  const axis=V(1,0,0).applyQuaternion(group.getWorldQuaternion(Q()));
  const neckReach=.40*reading;
  // The neck carries the skull forward from the collar. Counter-rotate at
  // the skull so the later gaze layer can independently aim at the page.
  const rotations=[['Spine',.22*weight],['Spine1',.18*weight],
   ['Neck',neckReach-.16*weight],['Head',-neckReach-.24*weight]];
  for(const [name,angle] of rotations){
   const bone=bones[name];if(!bone)continue;
   saved.set(bone,bone.quaternion.clone());
   const parent=bone.parent.getWorldQuaternion(Q()),turn=Q().setFromAxisAngle(axis,angle);
   bone.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));
   bone.updateWorldMatrix(false,true);
  }
 }
 function keyboard(time){
  const character=group.getWorldQuaternion(Q());
  for(const side of ['Left','Right']){
   const left=side==='Left';
   // Alternate nearby keys in offset phrases. Each hand travels a different
   // distance instead of pecking one spot in perfect opposition.
   const phase=time*Math.PI*2.46+.35*Math.sin(time*2.2)+(left?0:Math.PI+.22*Math.sin(time*3.1));
   const tap=(1-Math.cos(phase))*.5;
   const keyOffset=.014*Math.sin(time*(left?2.65:2.1)+(left?.7:2.4));
   for(const d of typingRigs[side].digits){const long=d.finger!=='Thumb',offset={Index:0,Middle:.8,Ring:1.1,Pinky:1.4}[d.finger]||0,wave=(1-Math.cos(phase+offset))*.5,flex=!long?-.28:d.finger==='Pinky'?-.03+.03*wave:d.finger==='Ring'?.01+.04*wave:.05+.05*wave;d.bone.quaternion.copy(d.rest).multiply(Q().setFromAxisAngle(d.axis,flex*[.62,.87,.62][d.n-1]));}
   orient(side,V(0,-.06,1).normalize().applyQuaternion(character),V(0,1,.06).normalize().applyQuaternion(character));
   // The imported open thumb hangs below the palm. Lift its real base toward
   // the keyboard plane instead of letting it cut through the front desktop.
   const thumb=bones[side+'HandThumb1'],parent=thumb.parent.getWorldQuaternion(Q()),turn=Q().setFromAxisAngle(V(0,0,1).applyQuaternion(character),side==='Left'?-.38:.38);thumb.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));group.updateMatrixWorld(true);
   const contact=group.localToWorld(V((left?.075:-.18)+keyOffset,.902+.009*tap,.535));
   for(let k=0;k<3;k++){const tip=typingPoint(side,true),wrist=bones[side+'Hand'],rotation=wrist.getWorldQuaternion(Q()),target=wrist.getWorldPosition(V()).add(contact.clone().sub(tip));arm(side,target);wrist.quaternion.copy(wrist.parent.getWorldQuaternion(Q()).invert().multiply(rotation));group.updateMatrixWorld(true);}
  }
 }
 function computerRest(){
  const character=group.getWorldQuaternion(Q());
  for(const side of ['Left','Right']){
   // Rest on the clear front strip of the real computer desk, before the
   // keyboard (z=.51). The source Sit clip leaves the small hands suspended.
   for(const d of typingRigs[side].digits){const flex=d.finger==='Thumb'?-.28:d.finger==='Pinky'?-.09:.03;d.bone.quaternion.copy(d.rest).multiply(Q().setFromAxisAngle(d.axis,flex*[.62,.87,.62][d.n-1]));}
   orient(side,V(0,-.04,1).normalize().applyQuaternion(character),V(0,1,.04).normalize().applyQuaternion(character));
   const thumb=bones[side+'HandThumb1'],parent=thumb.parent.getWorldQuaternion(Q()),turn=Q().setFromAxisAngle(V(0,0,1).applyQuaternion(character),side==='Left'?-.38:.38);thumb.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));group.updateMatrixWorld(true);
   const contact=group.localToWorld(V(side==='Left'?.23:-.23,.864,.425));
   for(let k=0;k<3;k++){const tip=typingPoint(side,true),wrist=bones[side+'Hand'],rotation=wrist.getWorldQuaternion(Q()),target=wrist.getWorldPosition(V()).add(contact.clone().sub(tip));arm(side,target);wrist.quaternion.copy(wrist.parent.getWorldQuaternion(Q()).invert().multiply(rotation));group.updateMatrixWorld(true);}
  }
 }
 function readBook(time,bookPose=null){
  const pose=bookPose||studyBookPose(time),character=group.getWorldQuaternion(Q()),bookRotation=pose.quaternion?Q().fromArray(pose.quaternion):Q().setFromEuler(new T.Euler(...pose.rotation));
  for(const side of ['Left','Right']){
   const sign=side==='Left'?1:-1;
   // Roll the clavicles forward as the hands reach. Leaning the whole head
   // into the textbook used to put the pupils through the printed pages.
   const shoulder=bones[side+'Shoulder'],parent=shoulder.parent.getWorldQuaternion(Q());
   const reach=Q().setFromAxisAngle(V(0,1,0).applyQuaternion(character),-sign*.85);
   shoulder.quaternion.premultiply(parent.clone().invert().multiply(reach).multiply(parent));
   shoulder.updateWorldMatrix(false,true);
   // Curved fingers support the outside cover; the thumb opposes them
   // around its lower outer corner. Use real skin pads, not bone tips.
   const page=Q().setFromAxisAngle(V(0,1,0),sign*TEXTBOOK.leafYaw);
   const orientation=character.clone().multiply(bookRotation).multiply(page);
   for(const d of typingRigs[side].digits){
    const flex={Thumb:.24,Index:.44,Middle:.53,Ring:.59,Pinky:.67}[d.finger];
    d.bone.quaternion.copy(d.rest).multiply(Q().setFromAxisAngle(d.axis,flex*[.60,.87,.50][d.n-1]));
   }
   orient(side,V(-sign*.50,.22,.84).applyQuaternion(orientation),V(sign*.88,-.14,.32).applyQuaternion(orientation));
   const gripHeight=.076;
   const edge=group.localToWorld(V(sign*(TEXTBOOK.leafWidth-.006),gripHeight,.013).applyQuaternion(page).applyQuaternion(bookRotation).add(V(...pose.position)));
   // Lengthen both segments from the shoulder toward the actual wrist target.
   // Offsetting the child joints along their bind axes keeps the hands, sleeve
   // width and knuckle spacing constant. Leave a little flex at each elbow.
   const upper=bones[side+'Arm'],forearm=bones[side+'ForeArm'],hand=bones[side+'Hand'];
   const shoulderPoint=upper.getWorldPosition(V()),elbowPoint=forearm.getWorldPosition(V()),handPoint=hand.getWorldPosition(V());
   const wristGoal=handPoint.clone().add(edge).sub(readingTips[side]());
   const armLength=shoulderPoint.distanceTo(elbowPoint)+elbowPoint.distanceTo(handPoint);
   const extension=T.MathUtils.clamp((shoulderPoint.distanceTo(wristGoal)+.017)/armLength,1,1.85);
   for(const joint of [forearm,hand]){
    readingLengths.set(joint,joint.position.clone());
    joint.position.multiplyScalar(extension);
   }
   upper.updateWorldMatrix(false,true);
   // Move the wrist and elbow together. Leave the thumb on its authored joint
   // axes instead of winding the thumb around an unreachable point on the page.
   for(let k=0;k<3;k++){
    group.updateMatrixWorld(true);
    const wrist=bones[side+'Hand'],rotation=wrist.getWorldQuaternion(Q());
    arm(side,wrist.getWorldPosition(V()).add(edge.clone().sub(readingTips[side]())));
    wrist.quaternion.copy(wrist.parent.getWorldQuaternion(Q()).invert().multiply(rotation));
   }

  }
 }

 return {
  restore(){
   for(const [joint,position] of readingLengths)joint.position.copy(position);
   readingLengths.clear();
   for(const [bone,rotation] of saved)bone.quaternion.copy(rotation);
   saved.clear();
  },
  apply({time,dt,reset,seated,mood,carrying,moving,restraint,walkTime=0,bookPose=null}){
   if(mood!==lastMood){lastMood=mood;settled=0;}else settled+=dt;
   const typing=seated&&mood==='computer',computerIdle=seated&&mood==='computer-idle',reading=seated&&mood==='reading'&&(bookPose?.active??true),thinking=seated&&['thinking','chat','hero'].includes(mood),ordinary=typing||computerIdle||reading||thinking||['phone','snack','drink','burger'].includes(mood),active=restraint==='free'&&ordinary&&(seated||carrying);
   if(restraint!=='free'){previous.clear();blend=typingBlend=0;sideBlend.Left=sideBlend.Right=0;return;}
   blend=reset?(active?1:0):T.MathUtils.damp(blend,active?1:0,15,dt);
   // Let the torso come back from the keyboard gradually while the hands
   // slide to the desk edge; dropping the parent pose first jerks both arms.
   const readingReach=reading?(bookPose?.contact??1):0;
   // Bring the shoulders forward to meet the book standing on the desk.
   const lean=typing?1:.45*readingReach;
   typingBlend=reset?lean:T.MathUtils.damp(typingBlend,lean,computerIdle?4:15,dt);
   if(typingBlend>.0001)deskLean(typingBlend,readingReach);
   for(const side of ['Left','Right']){const owned=active&&(typing||computerIdle||reading||thinking||side==='Left'||!seated||mood==='phone');sideBlend[side]=reset?(owned?1:0):T.MathUtils.damp(sideBlend[side],owned?1:0,15,dt);}
   if(!active&&blend<.0001){for(const b of managed)previous.set(b,b.quaternion.clone());return;}
   for(const b of managed)saved.set(b,b.quaternion.clone());
   if(active){
    if(typing)keyboard(time);
    else if(computerIdle)computerRest();
    else if(reading)readBook(time,bookPose);
    else if(thinking){freeHand('Left',true,0,0);freeHand('Right',true,0,0);}
    else {hold('Left',{seated,mood,time,nearCenter:mood==='phone'&&seated});
     if(mood==='phone'&&seated)phoneTap(time);else if(!seated)freeHand('Right',false,moving,walkTime);
    }
   }
   // Follow continuously on entry, interruption and return. Never reset the
   // limb to the beginning of a gesture when a repeated state is received.
   const rate=computerIdle?3+15*T.MathUtils.smoothstep(settled,0,.6):blend>.98?6+12*T.MathUtils.smoothstep(settled,0,.5):6,alpha=reset||reading&&bookPose?1:1-Math.exp(-rate*dt);
   for(const b of managed){const side=b.name.includes('Left')?'Left':'Right',desired=b.quaternion.clone();if(sideBlend[side]<.0001){previous.set(b,desired);continue;}if(!previous.has(b))previous.set(b,saved.get(b).clone());b.quaternion.copy(previous.get(b).slerp(desired,alpha));previous.set(b,b.quaternion.clone());}
   group.updateMatrixWorld(true);
  },
  diagnostics(){return {blend,indexTip:tipSample?point().toArray():null,readingTips:lastMood==='reading'?Object.fromEntries(['Left','Right'].map(side=>[side,group.worldToLocal(readingTips[side]()).toArray()])):null,restingTips:lastMood==='computer-idle'?Object.fromEntries(['Left','Right'].map(side=>[side,group.worldToLocal(typingPoint(side)).toArray()])):null,typingTips:lastMood==='computer'?Object.fromEntries(['Left','Right'].map(side=>[side,group.worldToLocal(typingPoint(side)).toArray()])):null};}
 };
}
