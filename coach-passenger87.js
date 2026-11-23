import * as T from './vendor/three.module.js';
import {createFingerRig,handFrame} from './hand-motion.js?v=campus-98';
import {COACH_CUSHION} from './bus-layout86.js?v=campus-94';

const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const quat=()=>new T.Quaternion();
const sides=['Left','Right'];
const seatKeys=new WeakMap();
const fit={
 boy:{hip:.139,ankle:.115,thigh:.149},
 glasses:{hip:.147,ankle:.096,thigh:.130},
 girl:{hip:.145,ankle:.135,thigh:.147},
 ponytail:{hip:.135,ankle:.113,thigh:.157}
};

function basis(along,back){
 const y=along.clone().normalize(),z=back.clone().addScaledVector(y,-back.dot(y)).normalize();
 return quat().setFromRotationMatrix(new T.Matrix4().makeBasis(v().crossVectors(y,z),y,z));
}

// The authored skeleton supplies limb lengths and digit axes. Fit relaxed and reaching
// key poses once per source rig and support, then sample local rotations.
export function createCoachPassengerPose(group,bones,variant,seed,sourceClips){
 const measure=fit[variant]||fit.boy;
 const rest=new Map(),originals=new Map(),written=[];
 const keys=seatKeys.get(sourceClips)||new Map();seatKeys.set(sourceClips,keys);
 const groups={legs:[],torso:[],Left:[],Right:[]};
 for(const [name,bone] of Object.entries(bones)){
  let region;
  if(/^(Hips|(?:Left|Right)(?:UpLeg|Leg|Foot|ToeBase))$/.test(name))region='legs';
  else if(/^Spine\d*$/.test(name))region='torso';
  else if(/^(?:Left|Right)(?:Shoulder|Arm|ForeArm|Hand(?:$|(?:Thumb|Index|Middle|Ring|Pinky)[123]$))/.test(name))region=name.startsWith('Left')?'Left':'Right';
  if(region){groups[region].push(bone);rest.set(bone,bone.quaternion.clone());}
 }
 const hip=bones.Hips,hipBefore=v(),tmpQ=quat(),tmpP=v();
 const blend={legs:0,torso:0,Left:0,Right:0};
 let lastSurface=null,hipSaved=false,reachBlend=0;
 const local=bone=>group.worldToLocal(bone.getWorldPosition(v()));
 const world=p=>group.localToWorld(p);
 function aim(a,b,target){
  const root=a.getWorldPosition(v()),from=b.getWorldPosition(v()).sub(root).normalize();
  const delta=quat().setFromUnitVectors(from,target.clone().sub(root).normalize()),parent=a.parent.getWorldQuaternion(quat());
  a.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));a.updateWorldMatrix(false,true);
 }
 function reach(a,b,end,goal,pole,rotation){
  const root=a.getWorldPosition(v()),middle=b.getWorldPosition(v()),tip=end.getWorldPosition(v());
  const upper=root.distanceTo(middle),lower=middle.distanceTo(tip),axis=world(goal).sub(root);
  const distance=T.MathUtils.clamp(axis.length(),Math.abs(upper-lower)+.0001,upper+lower-.0001);axis.normalize();
  pole.applyQuaternion(group.getWorldQuaternion(quat())).addScaledVector(axis,-pole.dot(axis)).normalize();
  const along=(upper*upper+distance*distance-lower*lower)/(2*distance);
  aim(a,b,root.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,upper*upper-along*along))));
  aim(b,end,root.addScaledVector(axis,distance));
  end.quaternion.copy(end.parent.getWorldQuaternion(quat()).invert().multiply(rotation));end.updateWorldMatrix(false,true);
 }
 function hipTarget(surface){return v(0,COACH_CUSHION[surface].top+measure.hip,surface==='bus-seat'?.095:.035);}
 function bake(surface,key){
  const previous=new Map([...rest].map(([bone])=>[bone,bone.quaternion.clone()])),position=hip.position.clone(),frames=[];
  const orientation=group.getWorldQuaternion(quat()),handed=seed%2?1:-1;
  let fingers;
  for(const bent of [0,1,2]){
   const reaching=bent===2;
   for(const [bone,q] of rest)bone.quaternion.copy(q);
   hip.position.copy(hip.parent.worldToLocal(world(hipTarget(surface))));group.updateMatrixWorld(true);
   fingers??=Object.fromEntries(sides.map(side=>[side,createFingerRig(group,bones,side).digits]));
   const spine=bones.Spine,parent=spine.parent.getWorldQuaternion(quat());
   const turn=quat().setFromEuler(new T.Euler(-.08+.22*bent,.045*handed*bent,.052*handed*(1-1.5*bent),'YXZ'));
   spine.quaternion.premultiply(parent.clone().invert().multiply(orientation).multiply(turn).multiply(orientation.clone().invert()).multiply(parent));spine.updateWorldMatrix(false,true);
   for(const side of sides){
    const sign=side==='Left'?1:-1,thigh=bones[side+'UpLeg'],knee=bones[side+'Leg'],foot=bones[side+'Foot'];
    const shift=sign*handed,ankle=v(sign*(Math.abs(local(thigh).x)+.025),measure.ankle,surface==='bus-seat'?.30+.022*shift:.26+.012*shift);
    reach(thigh,knee,foot,ankle,v(sign*.18,0,1),foot.getWorldQuaternion(quat()));
    const arm=bones[side+'Arm'],elbow=bones[side+'ForeArm'],hand=bones[side+'Hand'],frame=handFrame(bones,side);
    const along=v(-sign*(.12+.10*bent),-.62-.10*shift,1),back=v(sign*.13,1,.28);
    const rotation=basis(along.applyQuaternion(orientation),back.applyQuaternion(orientation))
     .multiply(basis(frame.along,frame.normal).invert()).multiply(hand.getWorldQuaternion(quat()));
    const offset=bones[side+'HandMiddle1'].getWorldPosition(v()).sub(hand.getWorldPosition(v()))
     .applyQuaternion(hand.getWorldQuaternion(quat()).invert()).applyQuaternion(rotation).applyQuaternion(orientation.clone().invert());
    const contact=local(thigh).lerp(local(knee),.65+.115*shift+.10*bent);
    contact.y+=measure.thigh;contact.addScaledVector(offset,-.64);
    if(reaching&&side==='Left')contact.set(.14,measure.hip+.49,.54);
    reach(arm,elbow,hand,contact,v(sign*.72,-.5,-.82),rotation);
    for(const digit of fingers[side]){
     const curl=digit.finger==='Thumb'?.17:([.20,.25,.16][digit.n-1]+(digit.finger==='Pinky'?.10:0))*(1+.20*bent);
     digit.bone.quaternion.copy(digit.rest).multiply(quat().setFromAxisAngle(digit.axis,curl));
    }
   }
   frames.push(new Map([...rest].map(([bone])=>[bone.name,bone.quaternion.clone()])));
  }
  hip.position.copy(position);for(const [bone,q] of previous)bone.quaternion.copy(q);
  group.updateMatrixWorld(true);keys.set(key,frames);return frames;
 }
 return {
  restore(){for(const bone of written)bone.quaternion.copy(originals.get(bone));written.length=0;if(hipSaved)hip.position.copy(hipBefore);hipSaved=false;},
  apply({surface,seated,captivity,resting,carrying,twoHands,drawerOpen,time,dt,reset}){
   const aboard=seated&&captivity==='free'&&(surface==='bus-seat'||surface==='bus-table');
   if(!aboard&&!lastSurface)return;
   if(captivity!=='free'||seated&&!aboard){for(const k of Object.keys(blend))blend[k]=0;reachBlend=0;lastSurface=null;return;}
   // An active tabletop gesture owns its fitted pen/book contacts. A lower
   // passenger still sits on the cushion while the occupied hand uses an item.
   const body=aboard&&(surface==='bus-seat'||resting);
   const targets={legs:+body,torso:+(body&&resting),Left:+(body&&resting),Right:+(body&&!twoHands&&(resting||carrying))};
   reachBlend=reset?+drawerOpen:T.MathUtils.damp(reachBlend,+drawerOpen,10,dt);
   for(const k of Object.keys(blend)){
    blend[k]=reset?targets[k]:T.MathUtils.damp(blend[k],targets[k],12,dt);
    if(Math.abs(blend[k]-targets[k])<.0002)blend[k]=targets[k];
   }
   if(aboard)lastSurface=surface;
   if(!blend.legs&&!blend.torso&&!blend.Left&&!blend.Right){if(!aboard)lastSurface=null;return;}
   const key=lastSurface+':'+(seed%2);
   const [a,b,r]=keys.get(key)||bake(lastSurface,key);
   const phase=(1-Math.cos(time*(.63+.021*(seed%5))+seed*2.17))*.5;
   hipSaved=true;hipBefore.copy(hip.position);
   hip.position.lerp(hip.parent.worldToLocal(world(tmpP.copy(hipTarget(lastSurface)))),blend.legs);
   for(const [region,list] of Object.entries(groups)){
    const weight=blend[region];if(!weight)continue;
    for(const bone of list){
     if(!originals.has(bone))originals.set(bone,quat());
     originals.get(bone).copy(bone.quaternion);written.push(bone);
     tmpQ.slerpQuaternions(a.get(bone.name),b.get(bone.name),phase);
     if(reachBlend>.001)tmpQ.slerp(r.get(bone.name),reachBlend);
     bone.quaternion.slerp(tmpQ,weight);
    }
   }
  },
  diagnostics:()=>({surface:lastSurface,...blend})
 };
}
