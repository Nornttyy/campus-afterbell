import * as T from './vendor/three.module.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
// Solve in world space so the two imported rigs keep their original joint axes.
function aimBone(bone,child,target,weight){
  bone.updateWorldMatrix(true,true);
  const from=child.getWorldPosition(V()).sub(bone.getWorldPosition(V())).normalize();
  const to=target.clone().sub(bone.getWorldPosition(V())).normalize();
  const delta=new T.Quaternion().setFromUnitVectors(from,to),parent=bone.parent.getWorldQuaternion(new T.Quaternion());
  const desired=parent.clone().invert().multiply(delta).multiply(parent).multiply(bone.quaternion);
  bone.quaternion.slerp(desired,weight);bone.updateWorldMatrix(true,true);
}
function limb(group,a,b,c,target,pole,weight){
  if(!a||!b||!c)return;
  const origin=a.getWorldPosition(V()),middle=b.getWorldPosition(V()),end=c.getWorldPosition(V());
  const l1=origin.distanceTo(middle),l2=middle.distanceTo(end),goal=group.localToWorld(target.clone()),delta=goal.clone().sub(origin),d=T.MathUtils.clamp(delta.length(),.03,l1+l2-.005),direction=delta.normalize();
  const bend=group.localToWorld(pole.clone()).sub(origin);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),elbow=origin.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
  aimBone(a,b,elbow,weight);aimBone(b,c,origin.clone().addScaledVector(direction,d),weight);
}
export function createCapturePose(group,bones){
  let weight=0,lastKind='free';const saved=new Map(),outputs=new Map();
  return{
    restore(){for(const [bone,q]of saved)bone.quaternion.copy(q);saved.clear();},
    apply(kind,time,dt){
      const active=['carried','bound','stunned','rescuing'].includes(kind);if(active)lastKind=kind;
      weight=T.MathUtils.damp(weight,active?1:0,10,dt);if(weight<.001){outputs.clear();return;}
      for(const bone of Object.values(bones))saved.set(bone,bone.quaternion.clone());
      group.updateMatrixWorld(true);
      const phase=time*6.6,wave=Math.sin(phase),bound=lastKind==='bound',carried=lastKind==='carried',help=lastKind==='rescuing';
      for(const [side,sign]of [['Left',1],['Right',-1]]){
        if(carried||bound||help){
          const target=carried?V(sign*(.14+wave*.012),1.10+Math.sin(phase+sign)*.025,.035):bound?V(sign*.17,.87,-.17):V(sign*.15,.92+Math.sin(phase+sign)*.016,.35);
          limb(group,bones[side+'Arm'],bones[side+'ForeArm'],bones[side+'Hand'],target,V(sign*.52,.9,.02),weight);
        }
        if(carried||bound){
          const kick=Math.max(0,Math.sin(phase+sign*1.57));
          limb(group,bones[side+'UpLeg'],bones[side+'Leg'],bones[side+'Foot'],V(sign*(bound?.16:.19),.12+kick*(carried?.14:.035),kick*(carried?.15:.035)),V(sign*.2,.4,.55),weight);
        }
      }
      if(bones.Head){bones.Head.rotateY(wave*(bound?.035:carried?.07:.10)*weight);bones.Head.rotateZ(Math.sin(time*4.5)*.045*weight);}
      // Blend the solved local joints across pose changes, including carried → bound.
      // The mixer remains the untouched base; previous IK never feeds back into it.
      const ease=1-Math.exp(-12*dt);
      for(const bone of Object.values(bones)){
        const previous=outputs.get(bone)||saved.get(bone);
        bone.quaternion.copy(previous.clone().slerp(bone.quaternion,ease));
        outputs.set(bone,bone.quaternion.clone());
      }
      group.updateMatrixWorld(true);
    }
  };
}
