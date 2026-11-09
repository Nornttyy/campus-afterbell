import * as T from './vendor/three.module.js';
import {handFrame,createFingerRig} from './hand-motion.js?v=campus-52';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Q=()=>new T.Quaternion();
const armName=/^(Left|Right)(Shoulder|Arm|ForeArm|Hand.*)$/;

// This layer changes joint rotations only. Source geometry, skin weights,
// calibrated finger grips and held-item dimensions remain untouched.
export function createStudentGestures(group,bones,clips,attachments){
 const saved=new Map(),previous=new Map(),samplers={},sideBlend={Left:0,Right:0};let blend=0,lastMood=null,settled=0;
 const managed=Object.entries(bones).filter(([name])=>armName.test(name)).map(([,b])=>b);
 for(const name of ['Idle','Walk','Sit']){
  const clip=clips.find(c=>c.name===name);samplers[name]=clip?.tracks.filter(t=>t.name.endsWith('.quaternion')).map(track=>{
   const name=track.name.slice(0,-11).replace(/^mixamorig[:_]?/,'');return {bone:bones[name],name,sample:track.createInterpolant()};
  }).filter(s=>s.bone&&armName.test(s.name))||[];
 }
 const fingerRig=createFingerRig(group,bones,'Right');
 let tipSample=null,best=-Infinity;
 group.updateMatrixWorld(true);const tipBone=bones.RightHandIndex3,tipOrigin=tipBone.getWorldPosition(V()),tipAxis=tipOrigin.clone().sub(tipBone.parent.getWorldPosition(V())).normalize();
 group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const joint=mesh.skeleton.bones.indexOf(tipBone),{skinIndex,skinWeight}=mesh.geometry.attributes;if(joint<0)return;
  for(let i=0;i<skinIndex.count;i++){let w=0;for(let k=0;k<4;k++)if(skinIndex.getComponent(i,k)===joint)w+=skinWeight.getComponent(i,k);if(w<.55)continue;const p=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld),distance=p.clone().sub(tipOrigin).dot(tipAxis);if(distance>best){best=distance;tipSample={mesh,index:i};}}
 });
 function point(){group.updateMatrixWorld(true);tipSample.mesh.skeleton.update();return tipSample.mesh.getVertexPosition(tipSample.index,V()).applyMatrix4(tipSample.mesh.matrixWorld);}
 function aim(bone,child,target){const origin=bone.getWorldPosition(V()),from=child.getWorldPosition(V()).sub(origin).normalize(),to=target.clone().sub(origin).normalize(),parent=bone.parent.getWorldQuaternion(Q()),delta=Q().setFromUnitVectors(from,to);bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));group.updateMatrixWorld(true);}
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
  wrist.quaternion.premultiply(parent.clone().invert().multiply(target.multiply(current.invert())).multiply(parent));group.updateMatrixWorld(true);
 }
 function freeHand(side,seated,moving,walkTime){for(const s of samplers[seated?'Sit':moving>.03?'Walk':'Idle'])if(s.name.startsWith(side))s.bone.quaternion.fromArray(s.sample.evaluate(seated?0:walkTime));group.updateMatrixWorld(true);}
 function hold(side,{seated,mood,time,nearCenter=false}){
  const shoulder=bones[side+'Arm'].getWorldPosition(V()),elbow=bones[side+'ForeArm'].getWorldPosition(V()),wrist=bones[side+'Hand'].getWorldPosition(V()),reach=shoulder.distanceTo(elbow)+elbow.distanceTo(wrist),root=group.worldToLocal(shoulder.clone()),sign=side==='Left'?1:-1;
  const food=['snack','drink','burger'].includes(mood),pass=mood==='note'?(.5-.5*Math.cos(time*Math.PI)):0;
  // Food keeps the requested small up/down use, never a mouth-reaching action.
  const bob=food?.0175*(1-Math.cos(time*Math.PI/ .6)):0;
  const phone=mood==='phone'&&seated;
  const local=V(nearCenter?sign*.015:root.x-sign*.025,root.y-(phone?.115:.035)+bob,root.z+reach*(phone?.72:.63)+pass*.024-(phone?.067:0));
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
 return {
  restore(){for(const[b,q]of saved)b.quaternion.copy(q);saved.clear();},
  apply({time,dt,reset,seated,mood,carrying,moving,restraint,walkTime=0}){
   if(mood!==lastMood){lastMood=mood;settled=0;}else settled+=dt;
   const thinking=seated&&['thinking','chat','hero'].includes(mood),ordinary=thinking||['phone','note','snack','drink','burger'].includes(mood),active=restraint==='free'&&ordinary&&(seated||carrying);
   if(restraint!=='free'){previous.clear();blend=0;sideBlend.Left=sideBlend.Right=0;return;}
   blend=reset?(active?1:0):T.MathUtils.damp(blend,active?1:0,15,dt);
   for(const side of ['Left','Right']){const owned=active&&(thinking||side==='Left'||!seated||mood==='phone'||mood==='note');sideBlend[side]=reset?(owned?1:0):T.MathUtils.damp(sideBlend[side],owned?1:0,15,dt);}
   if(!active&&blend<.0001){for(const b of managed)previous.set(b,b.quaternion.clone());return;}
   for(const b of managed)saved.set(b,b.quaternion.clone());
   if(active){
    if(thinking){freeHand('Left',true,0,0);freeHand('Right',true,0,0);}
    else if(mood==='note'){hold('Right',{seated,mood,time});freeHand('Left',seated,moving,walkTime);}
    else {hold('Left',{seated,mood,time,nearCenter:mood==='phone'&&seated});
     if(mood==='phone'&&seated)phoneTap(time);else if(!seated)freeHand('Right',false,moving,walkTime);
    }
   }
   // Follow continuously on entry, interruption and return. Never reset the
   // limb to the beginning of a gesture when a repeated state is received.
   const rate=blend>.98?6+12*T.MathUtils.smoothstep(settled,0,.5):6,alpha=reset?1:1-Math.exp(-rate*dt);
   for(const b of managed){const side=b.name.includes('Left')?'Left':'Right',desired=b.quaternion.clone();if(sideBlend[side]<.0001){previous.set(b,desired);continue;}if(!previous.has(b))previous.set(b,saved.get(b).clone());b.quaternion.copy(previous.get(b).slerp(desired,alpha));previous.set(b,b.quaternion.clone());}
   group.updateMatrixWorld(true);
  },
  diagnostics(){return {blend,indexTip:tipSample?point().toArray():null};}
 };
}
