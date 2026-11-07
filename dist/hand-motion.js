import * as T from './vendor/three.module.js';
import {strugglePose} from './capture-poses.js?v=classroom-33';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Q=()=>new T.Quaternion();
// Pose the palm using the actual digit bases. The female right rig has its
// transverse axis reversed, so a left/right sign alone is not sufficient.
function basis(along,dorsal){
 const y=along.clone().normalize(),z=dorsal.clone().addScaledVector(y,-dorsal.dot(y)).normalize(),x=V().crossVectors(y,z).normalize();
 return Q().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
}
export function createStudentHandMotion(group,bones,{seed=0}={}){
 group.updateMatrixWorld(true);const hands=[],saved=new Map();let restraintBlend=0;
 for(const [side,sign]of [['Left',1],['Right',-1]]){
  const wrist=bones[side+'Hand'];if(!wrist)continue;
  const p=n=>bones[side+'Hand'+n].getWorldPosition(V());
  const along=p('Middle1').sub(wrist.getWorldPosition(V())).normalize(),across=p('Index1').sub(p('Pinky1')),thumb=p('Thumb1').sub(p('Middle1'));
  thumb.addScaledVector(along,-thumb.dot(along));if(across.dot(thumb)<0)across.negate();across.multiplyScalar(sign).addScaledVector(along,-across.dot(along)).normalize();
  const normal=V().crossVectors(across,along).normalize(),inv=wrist.getWorldQuaternion(Q()).invert();
  const h={wrist,sign,side,across:across.clone().applyQuaternion(inv),along:along.clone().applyQuaternion(inv),normal:normal.clone().applyQuaternion(inv),digits:[],previous:null,values:{curl:.15,rx:0,ry:0,rz:0,thumb:0}};
  h.localBasis=basis(h.along,h.normal).invert();
  for(const finger of ['Index','Middle','Pinky','Thumb'])for(let n=1;n<=3;n++){
   const b=bones[side+'Hand'+finger+n];if(!b)continue;
   h.digits.push({bone:b,finger,n,rest:b.quaternion.clone(),axis:across.clone().applyQuaternion(b.getWorldQuaternion(Q()).invert())});
  }hands.push(h);
 }
 return{
  restore(){for(const[b,q]of saved)b.quaternion.copy(q);saved.clear();},
  apply({time=0,dt=0,mood='resting',restraint='free',moving=0,carrying=false,capture=null}={}){
   const a=1-Math.exp(-13*dt),phase=time+seed*.73;
   const kind=capture&&capture.kind!=='free'?capture.kind:restraint==='free'?mood:restraint;
   const poseTime=capture?.age??time;
   const posed=['carried','bound','rescuing','stunned','recovering'].includes(kind);restraintBlend=T.MathUtils.damp(restraintBlend,posed?1:0,11,dt);
   for(const h of hands){
    const {sign,side,values}=h,right=side==='Right',effort=poseTime*4+sign*1.8,squeeze=.5+.5*Math.sin(effort),turn=Math.sin(effort-.55),release=.5+.5*Math.sin(effort-1.1);
    // Most of the time a hand simply stays relaxed or holds its contact point.
    // Visible wrist articulation belongs to a gesture, not a constant idle wobble.
    let curl=.18,rx=0,ry=0,rz=0,thumb=.12;
    if(kind==='writing'||kind==='computer'){
     curl=right?.52:.16;thumb=right?.55:.12;rx=right?.025*Math.sin(phase*5.4):0;
    }else if(['phone','snack','note'].includes(kind)||(carrying&&restraint==='free'&&kind!=='recovering')){
     const holds=!right||kind==='note'||carrying;curl=holds?.63:.19;thumb=holds?.56:.15;
    }else if(kind==='carried'){const lift=T.MathUtils.smoothstep(strugglePose(poseTime)[side.toLowerCase()][1],-.08,.10);curl=.46+.31*lift;thumb=.50+.15*lift;}
    else if(kind==='bound'){curl=.32+.018*squeeze;thumb=.42;}
    else if(kind==='rescuing'){curl=.25+.38*squeeze;thumb=.30+.22*squeeze;}
    else if(kind==='stunned'){curl=.22;thumb=.13;}
    else if(kind==='recovering'){curl=.26;thumb=.20;}
    for(const[k,v]of Object.entries({curl,rx,ry,rz,thumb}))values[k]=T.MathUtils.lerp(values[k],v,a);
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
    h.wrist.quaternion.multiply(Q().setFromAxisAngle(h.across,values.rx));
    for(const d of h.digits){
     saved.set(d.bone,d.bone.quaternion.clone());
     const stagger=posed&&kind!=='bound'&&d.finger!=='Thumb'?.035*Math.sin(effort-(d.finger==='Index'?0:d.finger==='Middle'?.30:.58)):0;
     const amount=d.finger==='Thumb'?values.thumb*.32:values.curl*(d.finger==='Pinky'?1.08:d.finger==='Index'?.9:1)+stagger;
     d.bone.quaternion.copy(d.rest).multiply(Q().setFromAxisAngle(d.axis,-amount*[.62,.87,.62][d.n-1]));
    }
    // Rotate the thumb toward the index/middle grip, in the imported joint basis.
    group.updateMatrixWorld(true);
    const root=bones[side+'HandThumb1'],end=bones[side+'HandThumb3'],goal=bones[side+'HandIndex2'].getWorldPosition(V());
    const origin=root.getWorldPosition(V()),from=end.getWorldPosition(V()).sub(origin).normalize(),to=goal.sub(origin).normalize();
    const delta=Q().setFromUnitVectors(from,to),parent=root.parent.getWorldQuaternion(Q());
    root.quaternion.premultiply(parent.clone().invert().multiply(Q().slerp(delta,values.thumb*.7)).multiply(parent));
   }group.updateMatrixWorld(true);
  },
  diagnostics:()=>hands.map(h=>({side:h.side,...h.values}))
 };
}
