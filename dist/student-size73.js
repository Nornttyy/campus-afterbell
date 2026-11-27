import * as T from './vendor/three.module.js';
import {TEXTBOOK,writingPageY} from './study-book58.js?v=campus-110';
import {STUDENT_PROPORTIONS} from './student-proportions73.js?v=campus-83';
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
// Retarget the accepted pose to a shorter body. Keep the furniture and held
// objects in physical units, and preserve the calibrated arm and palm/finger size.
// Source meshes/clips are not rewritten; first-person user clips are separate.
const schoolSeatFits={
 boy:     {lift:.039,forward:.140,ankleLift:.100,ankleForward:.180,paperLift:.046},
 girl:    {lift:.022,forward:.140,ankleLift:.160,ankleForward:.200,paperLift:.051},
 glasses: {lift:.054,forward:.120,ankleLift:.120,ankleForward:.200,paperLift:.038},
 ponytail:{lift:.018,forward:.140,ankleLift:.120,ankleForward:.180,paperLift:.049}
};
export function createStudentSize(group,model,bones,variant){
 const factor=STUDENT_PROPORTIONS.height/STUDENT_PROPORTIONS.sourceHeight;
 const sourceScale=model.scale.clone(),sourcePosition=model.position.clone(),saved=new Map();let seatedBlend=0,chairBlend=0,writingLean=0,writingReach=0,pairedBlend=0;
 // Board-relative offsets in metres, calibrated on the four skinned silhouettes.
 // Shoes have different thicknesses, and the broad trouser knees need to clear
 // the rounded front edge before the shins can hang in front of the chair.
 const seatFit=schoolSeatFits[variant]??schoolSeatFits.boy;
 const hasGlasses=variant==='glasses';
 const penShoulder=hasGlasses?.92:.60,penReach=hasGlasses?.176:.183;
 const penMargin=hasGlasses?-.071:-.049,penCant=hasGlasses?.145:.075;
 const supportElbow=hasGlasses||variant==='ponytail'?.22:-.30,penElbow=hasGlasses?1.20:.70;
 const spinePosition=bones.Spine.position.clone(),nibFromWrist=V();
 const armRoots=['LeftArm','RightArm'].map(n=>bones[n]),armScales=armRoots.map(b=>b.scale.clone());
 function save(b){if(!saved.has(b))saved.set(b,b.quaternion.clone());}
 function aim(a,b,target){const from=b.getWorldPosition(V()).sub(a.getWorldPosition(V())).normalize(),to=target.clone().sub(a.getWorldPosition(V())).normalize(),parent=a.parent.getWorldQuaternion(Q()),turn=Q().setFromUnitVectors(from,to);save(a);a.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));a.updateWorldMatrix(false,true);}
 function limb(a,b,end,target,rotation,palmAlong=null,deskPole=null,poleWeight=0){
  const origin=a.getWorldPosition(V()),middle=b.getWorldPosition(V()),tip=end.getWorldPosition(V()),upper=origin.distanceTo(middle),lower=middle.distanceTo(tip),direction=target.clone().sub(origin),distance=T.MathUtils.clamp(direction.length(),Math.abs(upper-lower)+.001,upper+lower-.001);direction.normalize();
  const bend=middle.clone().sub(origin).addScaledVector(direction,-middle.clone().sub(origin).dot(direction));if(bend.lengthSq()<1e-8)bend.set(0,0,1).applyQuaternion(group.getWorldQuaternion(Q())).addScaledVector(direction,-direction.z);bend.normalize();
  if(palmAlong){
   // Swivel the elbow around the shoulder-to-wrist line. The hand can keep
   // its real contact point while the forearm follows the back of the hand.
   const toward=palmAlong.clone().negate().addScaledVector(direction,palmAlong.dot(direction));
   const deviation=tip.clone().sub(middle).angleTo(palmAlong);
   if(toward.lengthSq()>.001){
    toward.normalize();
    const angle=Math.atan2(direction.dot(V().crossVectors(bend,toward)),bend.dot(toward));
    const swivel=T.MathUtils.clamp(angle,-.76,.76)*T.MathUtils.smoothstep(deviation,.40,1.05);
    bend.applyAxisAngle(direction,swivel);
   }
  }
  if(deskPole){
   deskPole.addScaledVector(direction,-deskPole.dot(direction)).normalize();
   const swivel=Math.atan2(direction.dot(V().crossVectors(bend,deskPole)),bend.dot(deskPole));
   bend.applyAxisAngle(direction,swivel*T.MathUtils.smoothstep(poleWeight,0,.55));
  }
  const along=(upper*upper+distance*distance-lower*lower)/(2*distance),rise=Math.sqrt(Math.max(0,upper*upper-along*along));save(end);aim(a,b,origin.clone().addScaledVector(direction,along).addScaledVector(bend,rise));aim(b,end,origin.addScaledVector(direction,distance));end.quaternion.copy(end.parent.getWorldQuaternion(Q()).invert().multiply(rotation));end.updateWorldMatrix(false,true);
 }
 return {
  restore(){for(const [b,q] of saved)b.quaternion.copy(q);saved.clear();bones.Spine.position.copy(spinePosition);model.scale.copy(sourceScale);model.position.copy(sourcePosition);armRoots.forEach((b,i)=>b.scale.copy(armScales[i]));},
  apply({cutStudy=false,seated,crawling,restraint,dt,reset,tableSupport=true,pairedHands=false,deskArms=false,schoolChair=false,studyPose,writingTip,lookYaw=0}){
   seatedBlend=reset?(seated?1:0):T.MathUtils.damp(seatedBlend,seated?1:0,10,dt);
   group.updateMatrixWorld(true);
   const atChair=seated&&schoolChair&&!crawling&&restraint==='free';
   pairedBlend=reset?Number(pairedHands):T.MathUtils.damp(pairedBlend,Number(pairedHands),10,dt);
   const lean=atChair?(studyPose==='writing'?1.35:studyPose==='reading'?.42:studyPose==='pen'?.65:0):0;
   chairBlend=reset?Number(atChair):T.MathUtils.damp(chairBlend,Number(atChair),12,dt);
   writingLean=reset||cutStudy?lean:T.MathUtils.damp(writingLean,lean,7,dt);
   const onPage=Number(atChair&&studyPose==='writing'&&Boolean(writingTip));
   // A phone or twirling pen is still moving when the Write clip takes
   // over. Ease the extra desk reach through that overlap. Study cuts land
   // on the paper on their first frame.
   writingReach=reset||cutStudy||!atChair?onPage:T.MathUtils.damp(writingReach,onPage,6,dt);
   const support={};for(const side of ['Left','Right'])for(const part of ['Hand','Foot']){const b=bones[side+part];if(b)support[side+part]={position:group.worldToLocal(b.getWorldPosition(V())),rotation:b.getWorldQuaternion(Q())};}
   if(writingTip)nibFromWrist.copy(writingTip).sub(support.RightHand.position);
   const pivot=group.worldToLocal(bones[restraint==='carried'?'Neck':'Hips'].getWorldPosition(V()));
   const anchorY=restraint==='carried'?pivot.y:pivot.y*seatedBlend;
   model.scale.copy(sourceScale).multiplyScalar(factor);model.position.copy(sourcePosition);model.position.y+=anchorY*(1-factor);
   // The original seated clips were fitted to a lower chair. Settle onto
   // this seat board, then solve the shoes and working hands independently.
   model.position.y+=(.063+seatFit.lift)*chairBlend;
   const seatForward=seatFit.forward*chairBlend;
   model.position.z+=seatForward;
   armRoots.forEach((b,i)=>b.scale.copy(armScales[i]).multiplyScalar(1/factor));group.updateMatrixWorld(true);
   // Sit further onto the front of the seat without pulling the shoulders
   // into the book. Keep the upper body's established desk reach in world space.
   if(chairBlend>.001){
    const spine=bones.Spine;
    const back=V().set(0,-seatFit.lift*chairBlend,(.028-seatFit.forward)*chairBlend).applyQuaternion(group.getWorldQuaternion(Q()));
    spine.position.copy(spine.parent.worldToLocal(spine.getWorldPosition(V()).add(back)));
    spine.updateWorldMatrix(false,true);
   }
   // Raise the seated chest slightly without moving the pelvis off the chair.
   // A small forward lean keeps the existing tabletop contacts within reach;
   // elbows solve to those exact contacts without stretching either limb.
   const upperSupport=tableSupport?1:writingReach;
   if(upperSupport>.001&&seatedBlend>.001&&restraint==='free'){
    const spine=bones.Spine;
    const lift=new T.Vector3(0,(.05-.037*chairBlend)*seatedBlend*upperSupport,0).applyQuaternion(group.getWorldQuaternion(Q()));
    spine.position.copy(spine.parent.worldToLocal(spine.getWorldPosition(V()).add(lift)));spine.updateWorldMatrix(false,true);
    const headRotation=bones.Head.getWorldQuaternion(Q()),world=group.getWorldQuaternion(Q()),parent=spine.parent.getWorldQuaternion(Q()),turn=Q().setFromAxisAngle(new T.Vector3(1,0,0).applyQuaternion(world),(.11*seatedBlend-.073*chairBlend)*upperSupport+.115*writingLean+.115*writingReach);
    if(writingReach>.0001)turn.premultiply(Q().setFromAxisAngle(V().set(0,0,1).applyQuaternion(world),.055*writingReach));
    if(atChair&&studyPose==='listening'){
     // Let the shoulders follow a glance at the teacher while the pelvis
     // stays on the seat and the hands keep their recorded desk contacts.
     const twist=T.MathUtils.clamp(lookYaw,-.72,.72)*.31;
     turn.premultiply(Q().setFromAxisAngle(new T.Vector3(0,1,0).applyQuaternion(world),twist));
    }
    save(spine);spine.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));spine.updateWorldMatrix(false,true);
    save(bones.Head);bones.Head.quaternion.copy(bones.Head.parent.getWorldQuaternion(Q()).invert().multiply(headRotation));bones.Head.updateWorldMatrix(false,true);
   }
   for(const side of ['Left','Right']){
    if(restraint==='free'){
     const foot=support[side+'Foot'],target=foot.position.clone();target.x*=factor;target.z*=factor;
     if(chairBlend>.001){
      const sideSign=side==='Left'?1:-1;
      target.y+=seatFit.ankleLift*chairBlend;
      target.z+=(sideSign*.009+seatFit.ankleForward)*chairBlend;
      target.x+=sideSign*.009*chairBlend;
      const across=V().set(1,0,0).applyQuaternion(group.getWorldQuaternion(Q()));
      foot.rotation.premultiply(Q().setFromAxisAngle(across,(.18+sideSign*.025)*chairBlend));
     }
     limb(bones[side+'UpLeg'],bones[side+'Leg'],bones[side+'Foot'],group.localToWorld(target),foot.rotation);
    }
    const hand=support[side+'Hand'];
    const shoulder=bones[side+'Shoulder'];
    if(writingReach>.0001&&shoulder){
     const sign=side==='Left'?1:-1;
     const world=group.getWorldQuaternion(Q()),parent=shoulder.parent.getWorldQuaternion(Q());
     const turn=Q().setFromAxisAngle(V().set(0,1,0).applyQuaternion(world),-sign*(side==='Left'?.32:penShoulder)*writingReach);
     save(shoulder);shoulder.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));
     shoulder.updateWorldMatrix(false,true);
    }
    hand.position.y+=.063*chairBlend*pairedBlend;hand.position.z+=.028*chairBlend*pairedBlend;
    if(writingReach>.0001){
     // Both wrists come across the front edge. Keep the nib on its
     // calibrated stroke plane and ease the other palm onto the paper.
     hand.position.z+=(side==='Left'?.165:penReach)*writingReach;
     if(side==='Left'){
      hand.position.y+=seatFit.paperLift*writingReach;
      const forward=V().set(0,0,1).applyQuaternion(group.getWorldQuaternion(Q()));
      hand.rotation.premultiply(Q().setFromAxisAngle(forward,TEXTBOOK.leafYaw*writingReach));
     }else{
      // Cant the writing grip about its actual nib, then move the contact
      // along the sloped page. The barrel and finger pads rotate together.
      const turn=Q().setFromAxisAngle(V().set(1,0,0),penCant*writingReach);
      const dx=penMargin*writingReach,tipX=hand.position.x+nibFromWrist.x;
      hand.position.add(nibFromWrist).sub(nibFromWrist.clone().applyQuaternion(turn));
      hand.position.x+=dx;
      hand.position.y+=writingPageY(tipX+dx)-writingPageY(tipX);
      const world=group.getWorldQuaternion(Q());
      hand.rotation.premultiply(world.clone().multiply(turn).multiply(world.invert()));
     }
    }
    if(((tableSupport||pairedHands||side==='Right'||writingReach>.001)&&seatedBlend>.001)||crawling||restraint==='bound'){
     const current=group.worldToLocal(bones[side+'Hand'].getWorldPosition(V())),weight=crawling||restraint==='bound'?1:seatedBlend*(tableSupport||pairedHands||side==='Right'?1:T.MathUtils.smoothstep(writingReach,0,.6));
     const palmAlong=deskArms&&seated&&restraint==='free'&&!crawling
      ?bones[side+'HandMiddle1'].getWorldPosition(V()).sub(bones[side+'Hand'].getWorldPosition(V())).normalize():null;
     const deskPole=writingReach>.0001?V().set(side==='Left'?1:-1,side==='Left'?supportElbow:penElbow,0).applyQuaternion(group.getWorldQuaternion(Q())):null;
     current.lerp(hand.position,weight);limb(bones[side+'Arm'],bones[side+'ForeArm'],bones[side+'Hand'],group.localToWorld(current),hand.rotation,palmAlong,deskPole,writingReach);
    }
   }
  },
  diagnostics:()=>({height:STUDENT_PROPORTIONS.height,factor,seatedBlend})
 };
}
