import * as T from './vendor/three.module.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
// Authored from the visible shoulder/wrist relationships in the official
// trailer at 25, 25.5 and 26 seconds. Coordinates and loop timing are our
// reconstruction, not measurements of the original game's animation data.
const STRUGGLE_KEYS=[
  {t:0,roll:.24,left:[.20,.13,.12],right:[-.24,-.07,.15],pitch:-.50},
  {t:.28,roll:.17,left:[.17,.10,.19],right:[-.23,-.03,.16],pitch:-.54},
  {t:.5,roll:.015,left:[.14,.02,.25],right:[-.24,-.025,.15],pitch:-.49},
  {t:.78,roll:-.18,left:[.18,-.12,.18],right:[-.20,.08,.18],pitch:-.46},
  {t:1,roll:-.24,left:[.18,-.17,.12],right:[-.20,.13,.12],pitch:-.51},
  {t:1.32,roll:-.12,left:[.24,-.05,.16],right:[-.16,.08,.22],pitch:-.55},
  {t:1.58,roll:.04,left:[.22,.04,.19],right:[-.16,-.01,.23],pitch:-.50},
  {t:1.82,roll:.20,left:[.20,.12,.14],right:[-.22,-.08,.17],pitch:-.47},
  {t:2,roll:.24,left:[.20,.13,.12],right:[-.24,-.07,.15],pitch:-.50},
];
// A sampled pose is not a separate gesture. Smoothstep on every interval made
// the wrists brake to zero at all eight samples. Periodic, monotone Hermite
// tangents keep each pull travelling through intermediate poses without
// enlarging the observed range or adding elastic overshoot.
const STRUGGLE_CHANNELS=Array.from({length:8},(_,channel)=>{
 const read=key=>channel===0?key.roll:channel===1?key.pitch:channel<5?key.left[channel-2]:key.right[channel-5];
 const values=STRUGGLE_KEYS.slice(0,-1).map(read),n=values.length;
 const slopes=values.map((value,i)=>{
  const p=(i+n-1)%n,next=(i+1)%n;
  const before=STRUGGLE_KEYS[i].t-(i?STRUGGLE_KEYS[p].t:STRUGGLE_KEYS[p].t-2);
  const after=(next?STRUGGLE_KEYS[next].t:2)-STRUGGLE_KEYS[i].t;
  const a=(value-values[p])/before,b=(values[next]-value)/after;
  if(a*b<=0)return 0;
  const w1=2*after+before,w2=after+2*before;
  return(w1+w2)/(w1/a+w2/b);
 });
 return{values,slopes};
});
export function strugglePose(time){
  const t=((time%2)+2)%2;let i=0;while(i<STRUGGLE_KEYS.length-2&&t>STRUGGLE_KEYS[i+1].t)i++;
  const duration=STRUGGLE_KEYS[i+1].t-STRUGGLE_KEYS[i].t,f=(t-STRUGGLE_KEYS[i].t)/duration,f2=f*f,f3=f2*f;
  const sample=({values,slopes})=>{const next=(i+1)%values.length;return(2*f3-3*f2+1)*values[i]+(f3-2*f2+f)*duration*slopes[i]+(-2*f3+3*f2)*values[next]+(f3-f2)*duration*slopes[next];};
  const values=STRUGGLE_CHANNELS.map(sample);
  return{roll:values[0],pitch:values[1],left:values.slice(2,5),right:values.slice(5)};
}
function rotateInCharacterSpace(group,bone,x,y,z,weight){
  if(!bone)return;bone.updateWorldMatrix(true,false);
  const parent=bone.parent.getWorldQuaternion(new T.Quaternion()),character=group.getWorldQuaternion(new T.Quaternion());
  const local=new T.Quaternion().setFromEuler(new T.Euler(x*weight,y*weight,z*weight,'XYZ'));
  const world=character.clone().multiply(local).multiply(character.clone().invert());
  bone.quaternion.premultiply(parent.clone().invert().multiply(world).multiply(parent));
  bone.updateWorldMatrix(true,true);
}
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
// The wrists sit on the sides of the post, rather than disappearing into the
// spine. classroom-rules places the post 0.30 m behind the bound student.
export const POST_GRIP={left:[.25,.95,-.32],right:[-.25,.925,-.32]};
export function createCapturePose(group,bones){
  let weight=0,lastKind='free',inputKind='free',enteredAt=0,age=0;
  const saved=new Map(),outputs=new Map(),savedPositions=new Map(),positionOutputs=new Map(),lastWrists={},entryWrists={};
  const confined=kind=>['carried','bound','stunned','rescuing'].includes(kind);
  function offsetPelvis(y){
    const hip=bones.Hips;if(!hip)return;
    const p=group.worldToLocal(hip.getWorldPosition(V()));p.y+=y;
    hip.position.copy(hip.parent.worldToLocal(group.localToWorld(p)));hip.updateWorldMatrix(true,true);
  }
  return{
    restore(){for(const [bone,q]of saved)bone.quaternion.copy(q);for(const [bone,p]of savedPositions)bone.position.copy(p);saved.clear();savedPositions.clear();},
    state:()=>({kind:lastKind,age,weight}),
    apply(kind,time,dt,{startedAt=null,reset=false}={}){
      const rewound=reset||time<enteredAt;
      if(rewound){weight=0;inputKind=lastKind='free';outputs.clear();positionOutputs.clear();for(const side of ['Left','Right']){delete lastWrists[side];delete entryWrists[side];}}
      const changed=rewound||kind!==inputKind||(Number.isFinite(startedAt)&&startedAt!==enteredAt);
      if(changed){
        lastKind=confined(kind)?kind:confined(inputKind)?'recovering':'free';
        for(const side of ['Left','Right'])if(lastWrists[side])entryWrists[side]=lastWrists[side].clone();
        enteredAt=Number.isFinite(startedAt)?Math.min(time,startedAt):time;inputKind=kind;
      }
      age=Math.max(0,time-enteredAt);
      // State changes are tracked even while the mesh is culled. If the
      // transition finished off camera, restore its current pose immediately.
      const resumed=rewound||(changed&&age>.65);
      const active=confined(kind)||(lastKind==='recovering'&&age<.65);
      weight=resumed?(active?1:0):T.MathUtils.damp(weight,active?1:0,13,dt);if(weight<.001){outputs.clear();positionOutputs.clear();if(!active)lastKind='free';return resumed;}
      for(const bone of Object.values(bones))saved.set(bone,bone.quaternion.clone());
      if(bones.Hips)savedPositions.set(bones.Hips,bones.Hips.position.clone());
      group.updateMatrixWorld(true);
      const phase=age*4.0,wave=Math.sin(phase),bound=lastKind==='bound',carried=lastKind==='carried',help=lastKind==='rescuing',stunned=lastKind==='stunned',recover=lastKind==='recovering',struggle=carried?strugglePose(age):null;
      const baseFeet={};for(const side of ['Left','Right'])if(bones[side+'Foot'])baseFeet[side]=group.worldToLocal(bones[side+'Foot'].getWorldPosition(V()));
      if(stunned){
        // A hit first tips the chest/head backward and to one side, then the
        // knees soften and the forearms hang. It is not a thinking/idle clip.
        // This follows the visible 1565.75–1566.25 s hit reaction, not an
        // invented measurement of its exact timing.
        const impact=Math.exp(-age*5),sway=Math.sin(age*2.6)*.025;
        offsetPelvis(-(.028+.016*impact)*weight);
        rotateInCharacterSpace(group,bones.Spine1,-.10-.11*impact,0,.075+sway,weight);
        rotateInCharacterSpace(group,bones.Spine2,-.09-.10*impact,0,.04+sway*.4,weight);
        rotateInCharacterSpace(group,bones.Neck,-.06,0,-.055,weight);
        rotateInCharacterSpace(group,bones.Head,-.10-.08*impact,.035,-.09,weight);
      }
      if(carried){
        // Lift one shoulder and drop the other before solving the arms. The
        // previous parallel shoulders + identical wrist heights read as a
        // static puppet even when every finger was technically animated.
        rotateInCharacterSpace(group,bones.Spine1,-.09,0,struggle.roll*.4,weight);
        rotateInCharacterSpace(group,bones.Spine2,-.055,0,struggle.roll*.6,weight);
        rotateInCharacterSpace(group,bones.Neck,struggle.pitch*.35,0,-struggle.roll*.18,weight);
      }
      if(bound){
        rotateInCharacterSpace(group,bones.Spine1,-.035,0,.012*Math.sin(age*2.3),weight);
        rotateInCharacterSpace(group,bones.Spine2,-.025,0,-.008*Math.sin(age*2.3),weight);
      }
      if(recover){
        const settle=1-T.MathUtils.smoothstep(age,.05,.60);
        offsetPelvis(-.035*Math.sin(Math.min(1,age/.65)*Math.PI)*weight);
        rotateInCharacterSpace(group,bones.Spine1,.10*settle,0,.025*settle,weight);
      }
      for(const [side,sign]of [['Left',1],['Right',-1]]){
        if(carried||bound||help||stunned||recover){
          // Carried wrist targets are relative to each animated shoulder;
          // one reaches up/forward while the other drops, then they exchange.
          // Bound wrists remain behind the back at the post.
          const effort=.5+.5*Math.sin(phase+sign*1.8);
          const shoulder=group.worldToLocal(bones[side+'Arm'].getWorldPosition(V()));
          const offset=carried?struggle[side.toLowerCase()]:null;
          let target=carried?shoulder.clone().add(V(...offset))
            :bound?V(...POST_GRIP[side.toLowerCase()])
            :stunned?shoulder.clone().add(V(sign*.10,-.27,.10+sign*.025))
            :recover?V(sign*.28,.72,.08)
            :V(sign*.15,.94+Math.sin(phase+sign)*.022,.35);
          if((bound||recover)&&age<.52&&entryWrists[side]){
            // Move around the flank before approaching/leaving the post. A
            // direct front-to-back wrist lerp went through the chest.
            const around=V(sign*.43,bound?.96:.80,bound?-.04:-.08);
            target=age<.24?entryWrists[side].clone().lerp(around,T.MathUtils.smoothstep(age,0,.24))
              :around.lerp(target,T.MathUtils.smoothstep(age,.24,.52));
          }
          const pole=carried?shoulder.clone().add(V(sign*.45,offset[1]*.35,-.10))
            :bound?V(sign*.43,.86,-.12)
            :stunned?V(sign*.45,.79,-.04)
            :V(sign*.54,.9,.05);
          limb(group,bones[side+'Arm'],bones[side+'ForeArm'],bones[side+'Hand'],target,pole,weight);
        }
        if(carried||bound){
          const kick=Math.max(0,Math.sin(phase+sign*1.57));
          limb(group,bones[side+'UpLeg'],bones[side+'Leg'],bones[side+'Foot'],V(sign*(bound?.16:.19),.12+kick*(carried?.18:.009),kick*(carried?.19:.012)),V(sign*.2,.4,.55),weight);
        }
        if((stunned||recover)&&baseFeet[side])limb(group,bones[side+'UpLeg'],bones[side+'Leg'],bones[side+'Foot'],baseFeet[side],V(sign*.18,.36,.45),weight);
      }
      if(bones.Head){
        if(carried)rotateInCharacterSpace(group,bones.Head,struggle.pitch*.65,0,-struggle.roll*.12,weight);
        else if(bound){rotateInCharacterSpace(group,bones.Head,.02,wave*.035,Math.sin(age*2.3)*.018,weight);}
        else if(help){rotateInCharacterSpace(group,bones.Head,.12,wave*.035,0,weight);}}
      // Blend the solved local joints across pose changes, including carried → bound.
      // The mixer remains the untouched base; previous IK never feeds back into it.
      const ease=resumed?1:1-Math.exp(-(stunned?12:7.5)*dt);
      for(const bone of Object.values(bones)){
        const previous=outputs.get(bone)||saved.get(bone);
        bone.quaternion.copy(previous.clone().slerp(bone.quaternion,ease));
        outputs.set(bone,bone.quaternion.clone());
      }
      for(const [bone,p]of savedPositions){const previous=positionOutputs.get(bone)||p;bone.position.copy(previous.clone().lerp(bone.position,ease));positionOutputs.set(bone,bone.position.clone());}
      group.updateMatrixWorld(true);
      for(const side of ['Left','Right'])if(bones[side+'Hand'])lastWrists[side]=group.worldToLocal(bones[side+'Hand'].getWorldPosition(V()));
      return resumed;
    }
  };
}
