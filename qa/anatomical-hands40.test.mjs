import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {STUDENT_ASSETS,createRiggedStudent,createRiggedPalm} from '../dist/student-assets.js';
import {createRiggedTeacher} from '../dist/imported-actors.js';
import {handFrame} from '../dist/hand-motion.js';
import {loadGeometry} from './gltf-geometry.mjs';

const V=()=>new T.Vector3();
function skinUpdate(group){group.updateMatrixWorld(true);group.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}
function weightedTips(group,bones,side){
 const samples={};
 for(const digit of ['Thumb','Index','Middle','Ring','Pinky']){
  const bone=bones[side+'Hand'+digit+'3'];if(!bone)continue;
  const points=[];
  group.traverse(mesh=>{
   if(!mesh.isSkinnedMesh)return;const joint=mesh.skeleton.bones.indexOf(bone);if(joint<0)return;
   const {skinIndex,skinWeight}=mesh.geometry.attributes,eligible=[];
   for(let i=0;i<skinIndex.count;i++){let weight=0;for(let k=0;k<4;k++)if(skinIndex.getComponent(i,k)===joint)weight+=skinWeight.getComponent(i,k);if(weight>.45)eligible.push(i);}
   const stride=Math.max(1,Math.ceil(eligible.length/24));for(let i=0;i<eligible.length;i+=stride)points.push({mesh,index:eligible[i]});
  });
  if(points.length>=3)samples[digit]=points;
 }
 return samples;
}
function surfaceCenter(samples,wrist){
 const center=V();for(const {mesh,index}of samples){const p=V().fromBufferAttribute(mesh.geometry.attributes.position,index);mesh.applyBoneTransform(index,p);center.add(wrist.worldToLocal(mesh.localToWorld(p)));}return center.multiplyScalar(1/samples.length);
}

for(const [variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: idle/walk palms face thighs and holding bends the actual weighted fingers`,async()=>{
 const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:false}),hands=['Left','Right'];let time=0;
 const advance=(seconds,speed=0)=>{actor.setMotion({seated:false,speed,carrying:false});for(let i=0;i<seconds*60;i++)actor.update(time+=1/60);skinUpdate(actor.group);};
 actor.setMood('resting');advance(1);
 const samples=Object.fromEntries(hands.map(side=>[side,weightedTips(actor.group,actor.bones,side)]));
 const baseline=Object.fromEntries(hands.map(side=>[side,Object.fromEntries(Object.entries(samples[side]).map(([digit,points])=>[digit,surfaceCenter(points,actor.bones[side+'Hand'])]))]));
 for(const speed of [0,.8]){
  const bends={Left:[],Right:[]},wrists={Left:[],Right:[]},clavicles={Left:[],Right:[]};
  for(let frame=0;frame<90;frame++){
   advance(1/60,speed);
   // These diagnostics are already in the character's body frame. A wider
   // forward/back swing naturally pitches the wrist; demanding a near-zero
   // forward component would pin the hand upright instead of following it.
   // The dorsal plane must remain predominantly lateral (inside a 45-degree
   // cone about the body's outward side), so the palm still faces inward.
   // Relaxed fingers stay in the lower hemisphere, never pointing upward.
   for(const hand of actor.diagnostics().hands){
    const [x,y,z]=hand.dorsal,outward=x*(hand.side==='Left'?1:-1);
    if(speed){
     assert.ok(outward>Math.hypot(y,z),`${variant} ${hand.side}: palm no longer faces predominantly inward ${hand.dorsal}`);
     assert.ok(hand.along[1]<0,`${variant} ${hand.side}: swinging fingers point into the upper hemisphere`);
     const wrist=actor.bones[hand.side+'Hand'],wristRotation=wrist.getWorldQuaternion(new T.Quaternion()),bodyInverse=actor.group.getWorldQuaternion(new T.Quaternion()).invert();
     for(const digit of ['Index','Middle','Pinky']){
      const points=samples[hand.side][digit];assert.ok(points?.length>=3,`${variant} ${hand.side} ${digit}: no actual fingertip skin`);
      const tip=surfaceCenter(points,wrist).applyQuaternion(wristRotation).applyQuaternion(bodyInverse);
      assert.ok(tip.y<0,`${variant} ${hand.side} ${digit}: visible finger end is above the wrist`);
     }
    }else{
     assert.ok(outward>.97&&Math.abs(z)<.10,`${variant} ${hand.side}: idle palm is not inward ${hand.dorsal}`);
     assert.ok(hand.along[1]<-.45,`${variant} ${hand.side}: idle fingers no longer point down`);
    }
   }
   for(const side of hands){const p=['Arm','ForeArm','Hand'].map(part=>actor.bones[side+part].getWorldPosition(V()));bends[side].push(p[0].clone().sub(p[1]).angleTo(p[2].clone().sub(p[1])));wrists[side].push(p[2].clone().sub(p[1]).angleTo(handFrame(actor.bones,side).along));clavicles[side].push(actor.bones[side+'Shoulder'].quaternion.clone().normalize());}
  }
  for(const side of hands){
   if(speed){assert.ok(Math.max(...bends[side])-Math.min(...bends[side])>.045,`${variant} ${side}: elbow never flexes during walk`);assert.ok(Math.max(...wrists[side])-Math.min(...wrists[side])>.04,`${variant} ${side}: wrist stays welded to forearm`);assert.ok(Math.max(...clavicles[side].map(q=>q.angleTo(clavicles[side][0])))>.03,`${variant} ${side}: shoulder belt never participates in walk`);}
   else {assert.ok(Math.max(...wrists[side])-Math.min(...wrists[side])<.0001,`${variant} ${side}: walk follow-through leaked into Idle`);assert.ok(clavicles[side].every(q=>q.angleTo(clavicles[side][0])<.0001),`${variant} ${side}: idle shoulder keeps swaying`);}
  }
 }
 // Ordinary items have one carrying hand. The unused hand must stay relaxed,
 // rather than forcing both palms into the old symmetrical tray-holding pose.
 for(const [mood,gripping] of [['phone','Left']]){
  actor.setMood(mood);actor.setMotion({seated:false,carrying:true,speed:0});for(let i=0;i<120;i++)actor.update(time+=1/60);skinUpdate(actor.group);
  for(const side of hands){
   assert.ok(Object.keys(samples[side]).length>=3,`${variant} ${side}: insufficient actually weighted digit chains`);
   for(const [digit,points]of Object.entries(samples[side])){
    const movement=surfaceCenter(points,actor.bones[side+'Hand']).distanceTo(baseline[side][digit]);
    if(side===gripping)assert.ok(movement>.0007,`${variant} ${mood} ${side} ${digit}: visible skin never bends into grip (${movement})`);
    // Idle's runtime thumb adduction differs slightly from the source
    // open-thumb pose. Long fingers must stay relaxed; an 8 mm thumb
    // spread is not a second gripping hand.
    else assert.ok(movement<(digit==='Thumb'?.012:.0015),`${variant} ${mood} ${side} ${digit}: unused hand keeps gripping (${movement})`);
    assert.ok(movement<.18,`${variant} ${side} ${digit}: grip deforms beyond palm size`);
   }
  }
 }
 actor.setMood('resting');advance(1.5);
 for(const side of hands)for(const [digit,points]of Object.entries(samples[side]))assert.ok(surfaceCenter(points,actor.bones[side+'Hand']).distanceTo(baseline[side][digit])<.0015,`${variant} ${side} ${digit}: releasing did not restore relaxed hand`);
 actor.dispose();
});

test('new runtime preserves authored relaxed long-finger keys instead of imposing the same idle fist',async()=>{
 const [gltf,reference]=await Promise.all([loadGeometry('student-boy-v4.glb'),loadGeometry('student-boy-v4.glb')]);
 const actor=createRiggedStudent(gltf,{variant:'boy',seated:false}),mixer=new T.AnimationMixer(reference.scene),bones={};
 reference.scene.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
 mixer.clipAction(reference.animations.find(c=>c.name==='Idle')).play();actor.setMood('resting');actor.setMotion({seated:false});
 for(let i=1;i<=120;i++){
  mixer.update(1/60);actor.update(i/60);
  for(const side of ['Left','Right'])for(const digit of ['Index','Middle','Ring','Pinky'])for(let n=1;n<=3;n++){
   const name=side+'Hand'+digit+n;
   assert.ok(actor.bones[name].quaternion.clone().normalize().angleTo(bones[name].quaternion.clone().normalize())<1e-6,`${name}: runtime erased relaxed animation keys`);
  }
 }
 assert.ok(actor.diagnostics().hands.every(h=>h.gripWeight<.001),'Unheld hands keep an active grip overlay');actor.dispose();
});

test('new teacher keeps palms inward while walking and uses real shoulder/elbow joints to reach a neck',async()=>{
 const actor=createRiggedTeacher(await loadGeometry('teacher-v2.glb'));let time=0;
 for(let i=0;i<120;i++)actor.update(time+=1/60,{walking:1,phase:'watching'});
 for(const hand of actor.diagnostics().hands)assert.ok(hand.dorsal[0]*(hand.side==='Left'?1:-1)>.97&&Math.abs(hand.dorsal[2])<.10,`${hand.side}: teacher relaxed palm is forward`);
 const before=actor.bones.RightHand.getWorldPosition(V()),lengths=['RightForeArm','RightHand'].map(n=>actor.bones[n].position.length());
 actor.gripNeck(new T.Vector3(-.18,1.4,.42));skinUpdate(actor.group);
 assert.ok(actor.bones.RightHand.getWorldPosition(V()).distanceTo(before)>.08,'Grip never moved actual wrist');
 ['RightForeArm','RightHand'].forEach((n,i)=>assert.ok(Math.abs(actor.bones[n].position.length()-lengths[i])<1e-6,'Neck contact stretched the arm'));
 assert.ok(actor.getHand('right').getWorldPosition(V()).distanceTo(actor.bones.RightHand.getWorldPosition(V()))<1e-5,'Visible held contact detached from wrist');
 actor.dispose();
});

for(const side of [-1,1])test(`${side<0?'left':'right'} new first-person palm: weighted finger surfaces curl into the palm, including Ring weights`,async()=>{
 const hand=createRiggedPalm(await loadGeometry(`hand-${side<0?'left':'right'}-v2.glb`),side),bones={};
 hand.group.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
 const prefix=side<0?'Left':'Right',wrist=bones[prefix+'Hand'],samples=weightedTips(hand.group,bones,prefix);
 const frame=handFrame(bones,prefix);
 assert.ok(frame.normal.z>.999&&Math.abs(frame.normal.x)<.005&&Math.abs(frame.normal.y)<.005,`Exported +Z dorsal frame disagrees with real palm knuckles: ${frame.normal.toArray()}`);
 hand.setCurl(0);skinUpdate(hand.group);const rest=Object.fromEntries(Object.entries(samples).map(([digit,points])=>[digit,surfaceCenter(points,wrist)]));
 const dorsal=new T.Vector3(0,0,1).applyQuaternion(wrist.getWorldQuaternion(new T.Quaternion()).invert());
 hand.setCurl(.75);hand.opposeThumb(.6);skinUpdate(hand.group);
 for(const [digit,points]of Object.entries(samples)){
  const delta=surfaceCenter(points,wrist).sub(rest[digit]);assert.ok(delta.length()>.0007,`${prefix} ${digit}: actual finger stayed rigid`);
  if(digit!=='Thumb')assert.ok(delta.dot(dorsal)<-.0005,`${prefix} ${digit}: curls away from palm (${delta.dot(dorsal)})`);
 }
});
