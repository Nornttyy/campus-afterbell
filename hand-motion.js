import * as T from './vendor/three.module.js';
import {strugglePose} from './capture-poses.js?v=campus-67';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Q=()=>new T.Quaternion();
// Pose the palm using the actual digit bases. The female right rig has its
// transverse axis reversed, so a left/right sign alone is not sufficient.
function basis(along,dorsal){
 const y=along.clone().normalize(),z=dorsal.clone().addScaledVector(y,-dorsal.dot(y)).normalize(),x=V().crossVectors(y,z).normalize();
 return Q().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
}
// Work in the imported anatomical frame, not a guessed Mixamo local X axis.
// Tripo may retain Ring bones for a four-finger hand; animate every weighted
// chain without adding, deleting or changing any visible finger geometry.
export function handFrame(bones,side){
 const wrist=bones[side+'Hand'];if(!wrist)return null;
 const at=name=>bones[side+'Hand'+name]?.getWorldPosition(V());
 const middle=at('Middle1'),index=at('Index1'),pinky=at('Pinky1')||at('Ring1'),thumb=at('Thumb1');
 if(!middle||!index||!pinky||!thumb)return null;
 const along=middle.clone().sub(wrist.getWorldPosition(V())).normalize();
 const radial=thumb.sub(middle);radial.addScaledVector(along,-radial.dot(along)).normalize();
 const across=index.sub(pinky);if(across.dot(radial)<0)across.negate();
 across.multiplyScalar(side==='Left'?1:-1).addScaledVector(along,-across.dot(along)).normalize();
 return {along,across,normal:V().crossVectors(across,along).normalize()};
}
export function createFingerRig(group,bones,side){
 group.updateMatrixWorld(true);const frame=handFrame(bones,side),digits=[];
 if(!frame)return {digits,frame};
 for(const finger of ['Index','Middle','Ring','Pinky','Thumb'])for(let n=1;n<=3;n++){
  const bone=bones[side+'Hand'+finger+n];if(!bone)continue;
  const next=bones[side+'Hand'+finger+(n+1)],previous=bones[side+'Hand'+finger+(n-1)];
  const tangent=next?next.getWorldPosition(V()).sub(bone.getWorldPosition(V())):previous?bone.getWorldPosition(V()).sub(previous.getWorldPosition(V())):frame.along.clone();tangent.normalize();
  // Positive flexion rotates the fingertip toward the palm, never through its back.
  const axis=(finger==='Thumb'?V().crossVectors(frame.normal,tangent).normalize():frame.across.clone().negate()).applyQuaternion(bone.getWorldQuaternion(Q()).invert());
  digits.push({bone,finger,n,rest:bone.quaternion.clone(),axis});
 }
 return {digits,frame};
}
export function createStudentHandMotion(group,bones,{seed=0,authoredNeutral=false,authoredTableContact=false}={}){
 group.updateMatrixWorld(true);const hands=[],saved=new Map();let restraintBlend=0;
 for(const [side,sign]of [['Left',1],['Right',-1]]){
  const wrist=bones[side+'Hand'];if(!wrist)continue;
  const rig=createFingerRig(group,bones,side);if(!rig.frame)continue;
  const {along,across,normal}=rig.frame,inv=wrist.getWorldQuaternion(Q()).invert();
  const h={wrist,sign,side,across:across.clone().applyQuaternion(inv),along:along.clone().applyQuaternion(inv),normal:normal.clone().applyQuaternion(inv),digits:rig.digits,previous:null,idleWeight:0,contactWeight:0,gripWeight:authoredNeutral?0:1,values:{curl:authoredNeutral?.08:.15,rx:0,ry:0,rz:0,thumb:0}};
  h.localBasis=basis(h.along,h.normal).invert();
  hands.push(h);
 }
 return{
  restore(){for(const[b,q]of saved)b.quaternion.copy(q);saved.clear();},
  apply({time=0,dt=0,reset=false,seated=true,mood='resting',restraint='free',moving=0,carrying=false,capture=null}={}){
   const a=reset?1:1-Math.exp(-13*dt),phase=time+seed*.73;
   const freeMood=!seated&&!carrying&&['writing','computer','phone','snack','thinking','chat','hero'].includes(mood)?'resting':mood;
   const kind=capture&&capture.kind!=='free'?capture.kind:restraint==='free'?freeMood:restraint;
   const poseTime=capture?.age??time;
   const posed=['carried','bound','rescuing','stunned','recovering'].includes(kind);restraintBlend=T.MathUtils.damp(restraintBlend,posed?1:0,11,dt);
   for(const h of hands){
    const {sign,side,values}=h,right=side==='Right',effort=poseTime*4+sign*1.8,squeeze=.5+.5*Math.sin(effort),turn=Math.sin(effort-.55),release=.5+.5*Math.sin(effort-1.1);
    // Most of the time a hand simply stays relaxed or holds its contact point.
    // Visible wrist articulation belongs to a gesture, not a constant idle wobble.
    let curl=authoredNeutral?.08:.18,rx=0,ry=0,rz=0,thumb=authoredNeutral?.05:.12,activeGrip=posed;
    if(kind==='writing'){
     activeGrip=right;curl=right?(authoredNeutral?.24:.52):.16;thumb=right?(authoredNeutral?.35:.55):.12;rx=right?.025*Math.sin(phase*5.4):0;
    }else if(['phone','snack'].includes(kind)||(carrying&&restraint==='free'&&kind!=='recovering')){
     const holds=!right||(!authoredNeutral&&carrying);activeGrip=holds;curl=holds?.63:.19;thumb=holds?.56:.15;
    }else if(kind==='carried'){const lift=T.MathUtils.smoothstep(strugglePose(poseTime)[side.toLowerCase()][1],-.08,.10);curl=.46+.31*lift;thumb=.50+.15*lift;}
    else if(kind==='bound'){curl=.32+.018*squeeze;thumb=.42;}
    else if(kind==='rescuing'){curl=.25+.38*squeeze;thumb=.30+.22*squeeze;}
    else if(kind==='stunned'){curl=.22;thumb=.13;}
    else if(kind==='recovering'){curl=.26;thumb=.20;}
    const tableContact=authoredTableContact&&seated&&!posed&&restraint==='free'&&(['resting','writing'].includes(kind)||(right&&kind==='snack'));
    h.contactWeight=reset?(tableContact?1:0):T.MathUtils.damp(h.contactWeight,tableContact?1:0,13,dt);
    if(tableContact){activeGrip=false;rx=0;}
    for(const[k,v]of Object.entries({curl,rx,ry,rz,thumb}))values[k]=T.MathUtils.lerp(values[k],v,a);
    h.gripWeight=authoredNeutral?(reset?(activeGrip?1:0):T.MathUtils.damp(h.gripWeight,activeGrip?1:0,13,dt)):1;
    saved.set(h.wrist,h.wrist.quaternion.clone());
    if(posed||restraintBlend>.001){
     let along,dorsal;
     if(kind==='carried'){
      // Follow the actual forearm when pulling; relax at the wrist on release.
      // A permanently negative Y target made every sampled pose point down.
      const forearm=h.wrist.getWorldPosition(V()).sub(bones[side+'ForeArm'].getWorldPosition(V())).normalize();
      forearm.applyQuaternion(group.getWorldQuaternion(Q()).invert());
      const pull=T.MathUtils.smoothstep(strugglePose(poseTime)[side.toLowerCase()][1],-.10,.08);
      along=V(sign*.14,-.86,.28).normalize().lerp(forearm,pull).normalize();
      dorsal=V(sign*.45*turn,.10+.20*release,1);
     }
     // Palm backs face away from the post, and the digits curl around its
     // sides. Once attached, wrist orientation must not oscillate off wood.
     else if(kind==='bound'){along=V(-sign*.68,-.04,-.73);dorsal=V(sign*.73,0,-.68);}
     else if(kind==='rescuing'){along=V(sign*(.14+.12*turn),.24+.18*release,1);dorsal=V(sign*.30*turn,1,-.3);}
     else if(kind==='stunned'){along=V(sign*.12,-1,.17);dorsal=V(sign*.12,.10,1);}
     else if(kind==='recovering'){along=V(sign*.10,-1,.11);dorsal=V(sign*.12,0,1);}
     const character=group.getWorldQuaternion(Q());
     if(along){const target=basis(along,dorsal);
      target.multiply(h.localBasis);
      // Filter in character space: the palm can lag the moving forearm, but
      // must travel with its carrier through a turn. World-space history left
      // the hand behind, and even reversed it while the recovery faded out.
      h.previous=(h.previous||character.clone().invert().multiply(h.wrist.getWorldQuaternion(Q()))).slerp(target,1-Math.exp(-6*dt));}
     if(h.previous)h.wrist.quaternion.slerp(h.wrist.parent.getWorldQuaternion(Q()).invert().multiply(character).multiply(h.previous),restraintBlend);
    }else h.previous=null;
    // In ordinary standing/walking the back of each hand faces out and its
    // thumb faces forward. Apply only wrist pronation; retain the clip's real
    // shoulder/elbow flexion and follow the forearm instead of locking world Y.
    const idle=!authoredNeutral&&!seated&&!carrying&&!posed&&kind==='resting';
    h.idleWeight=reset?(idle?1:0):T.MathUtils.damp(h.idleWeight,idle?1:0,12,dt);
    if(h.idleWeight>.001){
     const character=group.getWorldQuaternion(Q()),forearm=bones[side+'ForeArm'];
     const along=forearm?h.wrist.getWorldPosition(V()).sub(forearm.getWorldPosition(V())).normalize().applyQuaternion(character.clone().invert()):V(0,-1,0);
     const dorsal=V(sign,0,0).addScaledVector(along,-sign*along.x).normalize();
     const target=basis(along,dorsal).multiply(h.localBasis);
     h.wrist.quaternion.slerp(h.wrist.parent.getWorldQuaternion(Q()).invert().multiply(character).multiply(target),h.idleWeight*(1-restraintBlend));
    }
    h.wrist.quaternion.multiply(Q().setFromAxisAngle(h.across,values.rx));
    for(const d of h.digits){
     saved.set(d.bone,d.bone.quaternion.clone());
     const stagger=posed&&kind!=='bound'&&d.finger!=='Thumb'?.035*Math.sin(effort-(d.finger==='Index'?0:d.finger==='Middle'?.30:.58)):0;
     const amount=d.finger==='Thumb'?values.thumb*.32:values.curl*(d.finger==='Pinky'?1.08:d.finger==='Index'?.9:1)+stagger;
     // The new exported Idle/Walk clips already contain a relaxed hand. A
     // blanket bind-pose curl here erased those keys and made every idle hand
     // hook inward. Only blend toward an explicit grip while it is requested.
     const grip=d.rest.clone().multiply(Q().setFromAxisAngle(d.axis,amount*[.62,.87,.62][d.n-1]));
     d.bone.quaternion.slerp(grip,h.gripWeight);
    }
    // Rotate the thumb toward the index/middle grip, in the imported joint basis.
    group.updateMatrixWorld(true);
    const root=bones[side+'HandThumb1'],end=bones[side+'HandThumb3'],goal=bones[side+'HandIndex2'].getWorldPosition(V());
    const origin=root.getWorldPosition(V()),from=end.getWorldPosition(V()).sub(origin).normalize(),to=goal.sub(origin).normalize();
    const delta=Q().setFromUnitVectors(from,to),parent=root.parent.getWorldQuaternion(Q());
    // Source A-pose thumbs splay straight forward. A small adduction softens
    // the empty hand without replacing the authored long-finger keys.
    const neutralThumb=authoredNeutral?Math.min(.1,.14/Math.max(.001,Q().angleTo(delta)))*(1-h.gripWeight)*(1-h.contactWeight):0;
    root.quaternion.premultiply(parent.clone().invert().multiply(Q().slerp(delta,neutralThumb+values.thumb*.7*h.gripWeight)).multiply(parent));
   }group.updateMatrixWorld(true);
  },
  diagnostics:()=>{group.updateMatrixWorld(true);const inverse=group.getWorldQuaternion(Q()).invert();return hands.map(h=>({side:h.side,...h.values,idleWeight:h.idleWeight,gripWeight:h.gripWeight,contactWeight:h.contactWeight,dorsal:h.normal.clone().applyQuaternion(h.wrist.getWorldQuaternion(Q())).applyQuaternion(inverse).toArray(),along:h.along.clone().applyQuaternion(h.wrist.getWorldQuaternion(Q())).applyQuaternion(inverse).toArray(),fingerChains:[...new Set(h.digits.map(d=>d.finger))]}));}
 };
}
