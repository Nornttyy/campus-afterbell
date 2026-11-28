import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
import {PUBLISHED_HAND_ANIMATIONS} from './published-hand-animations61.js?v=campus-83';
import {sampleHandAnimationClip} from './hand-animation-data59.js?v=campus-111';
import {attacks} from './teacher-attacks129.js?v=campus-117&rev=180';

// Camera-local handle position, shaft yaw and elevation, grip roll, tip bend.
// The zero-time contact key coincides with the authority releasing its wave.
// In this grip mesh the wrist lies off the shaft's local X axis. Clock the whole
// grip so the palm is on edge and the cuff extends back toward the player.
const uprightPalmRoll=-63;
const ready=[.176,-.355,-.50, 1,-6,98,.035];
const horizontal=[
 [-attacks.horizontal.windup,ready],[-.38,[.31,-.17,-.44,50,38,9,.06]],
 [-.18,[.39,-.11,-.46,83,21,20,.18]],
 [0,[.09,-.13,-.66,3,3,33,.66]],
 [.22,[-.25,-.16,-.65,-68,-9,54,.96]],
 [.40,[-.30,-.19,-.58,-83,-13,58,.42]],
 [.67,[-.21,-.24,-.51,-61,-10,40,.10]],
 [1.05,[.07,-.28,-.45,-4,9,11,.08]],[attacks.horizontal.duration-attacks.horizontal.windup,ready]
];
const vertical=[
 [-attacks.vertical.windup,ready],[-.40,[.27,-.05,-.43,23,67,-6,.05]],
 [-.18,[.23,.18,-.46,9,111,-11,.18]],
 [0,[.12,-.03,-.65,3,19,0,.65]],
 [.20,[.04,-.29,-.69,1,-48,10,.94]],
 [.40,[.02,-.32,-.64,1,-61,16,.36]],
 [.71,[.10,-.28,-.55,6,-33,7,.06]],
 [1.08,[.18,-.25,-.48,15,12,-4,.065]],[attacks.vertical.duration-attacks.vertical.windup,ready]
];

function sample(keys,time,values){
 let i=0;while(i<keys.length-2&&keys[i+1][0]<time)i++;
 const [a,p]=keys[i],[b,q]=keys[i+1],span=b-a;
 const t=T.MathUtils.clamp((time-a)/span,0,1),u=t*t,v=u*t;
 const [prev,back]=keys[Math.max(0,i-1)],[next,front]=keys[Math.min(keys.length-1,i+2)];
 for(let j=0;j<p.length;j++){
  const m=i===0?0:(q[j]-back[j])*span/(b-prev);
  const n=i+2===keys.length?0:(front[j]-p[j])*span/(next-a);
  values[j]=(2*v-3*u+1)*p[j]+(v-2*u+t)*m+(-2*v+3*u)*q[j]+(v-u)*n;
 }
}

// Keep the fore/aft timing of the player's authored teacher walk. Retarget its
// travel to wrist sockets so the grip, short cuff and shaft stay together.
const teacherWalk=PUBLISHED_HAND_ANIMATIONS.clips['teacher-walk'];
const reach=teacherWalk.keyframes.map(frame=>frame.right.position[2]);
const front=Math.min(...reach),back=Math.max(...reach);
function swingDepth(hand){return 1-2*(hand.position[2]-front)/(back-front);}

export function pointerGait(phase,amount,run){
 const cycle=phase*.82/(2*Math.PI),angle=cycle*2*Math.PI;
 const pose=sampleHandAnimationClip(teacherWalk,(cycle%1)*teacherWalk.duration);
 const right=swingDepth(pose.right),left=swingDepth(pose.left);
 const lift=(1-Math.cos(2*angle))*.5;
 return {
  x:amount*(.014+run*.007-right*(.018+.022*run)),
  y:amount*(-.012+.008*run+right*(.065+.028*run)+lift*.012),
  z:-amount*(.008+right*(.090+.072*run)),
  yaw:amount*(-1-right*(3+2*run)),
  pitch:amount*(-9-run*2+right*(13+4*run)-Math.sin(angle)*(2+run)),
  roll:amount*(right*(2+2*run)+Math.sin(angle)*2),
  // This mesh is wrist-centred: fingers point along -Z and the thumb edge along +Y.
  leftX:-.219+amount*left*(.017+.013*run),
  leftY:-.373+amount*(left*(.082+.020*run)+lift*.014),
  leftZ:-.48-amount*left*(.084+.058*run),
  leftPitch:.09+amount*left*(.055+.065*run),
  leftRoll:amount*Math.sin(angle)*(.025+.025*run)
 };
}

export function createPointerView(parent){
 const socket=new T.Group(),axis=new T.Vector3(),side=new T.Vector3(),normal=new T.Vector3(),basis=new T.Matrix4();
 parent.add(socket);socket.visible=false;
 const values=ready.slice(),flex=[];
 let loading,model,freeHand,runBlend=0;
 return function update(visible,teacher,motion,aspect,dt=0,leftAvailable=true){
  if(visible&&!loading){
   loading=new GLTFLoader().loadAsync(new URL('./assets/models/doubao-grip136.glb',import.meta.url).href)
    .then(asset=>{
     model=asset.scene;model.traverse(o=>{if(o.morphTargetDictionary?.Bend!=null)flex.push(o);});
     socket.add(model);
     freeHand=model.getObjectByName('DoubaoFreeHand');parent.add(freeHand);freeHand.visible=false;
    }).catch(error=>console.error('教鞭手部加载失败',error));
  }
  socket.visible=Boolean(visible&&model);
  if(freeHand)freeHand.visible=socket.visible&&leftAvailable;
  if(!socket.visible){runBlend=0;return false;}
  const kind=teacher.attackKind,age=teacher.attackAge;
  const keys=kind==='vertical'?vertical:horizontal;
  const time=age==null?Infinity:age-attacks[kind]?.windup;
  const swinging=Number.isFinite(time)&&time<=keys.at(-1)[0];
  if(swinging)sample(keys,time,values);else for(let i=0;i<ready.length;i++)values[i]=ready[i];
  const [x,y,z,baseYaw,basePitch,baseRoll,bend]=values,rad=Math.PI/180;
  runBlend=T.MathUtils.damp(runBlend,teacher.sprinting?1:0,8,dt);
  const spec=attacks[kind];
  const gaitWeight=swinging?1-T.MathUtils.smoothstep(age,0,.15)*(1-T.MathUtils.smoothstep(age,spec.duration-.22,spec.duration)):1;
  const amount=motion&&!motion.locked&&!(teacher.jumpHeight>.02)?motion.amount*gaitWeight:0;
  const gait=pointerGait(motion?.phase||0,amount,runBlend),frameWidth=Math.min(1,aspect/.97);
  socket.position.set((x+gait.x)*frameWidth,y+gait.y,z+gait.z);
  const yaw=baseYaw+gait.yaw,pitch=basePitch+gait.pitch,roll=uprightPalmRoll+baseRoll+gait.roll;
  freeHand.position.set(gait.leftX*frameWidth,gait.leftY,gait.leftZ);
  freeHand.rotation.set(gait.leftPitch,-.15,gait.leftRoll,'YXZ');
  axis.set(Math.sin(yaw*rad)*Math.cos(pitch*rad),Math.sin(pitch*rad),-Math.cos(yaw*rad)*Math.cos(pitch*rad));
  side.set(Math.cos(yaw*rad),0,Math.sin(yaw*rad)).applyAxisAngle(axis,roll*rad);
  normal.crossVectors(side,axis);socket.quaternion.setFromRotationMatrix(basis.makeBasis(side,axis,normal));
  for(const o of flex)o.morphTargetInfluences[o.morphTargetDictionary.Bend]=T.MathUtils.clamp(bend*.38,0,1);
  return true;
 };
}
