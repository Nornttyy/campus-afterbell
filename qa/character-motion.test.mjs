import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// Uses the real model meshes without a renderer. This catches discontinuities
// and invalid geometry; it cannot decide whether a hand looks natural.
// CAMPUS_MODEL_DIR can point at an older build for regression comparison.
const base=process.env.CAMPUS_MODEL_DIR
  ? pathToFileURL(path.resolve(process.env.CAMPUS_MODEL_DIR)+path.sep)
  : new URL('../dist/',import.meta.url);
const T=await import(new URL('vendor/three.module.js',base));
const {createStudent}=await import(new URL('characters.js',base));
const {createDeskHands,createTeacher}=await import(new URL('game-actors.js?v=campus-68b',base));
const DT=1/60;

function studentHands(actor){
  const named=['left-student-hand','right-student-hand'].map(n=>actor.group.getObjectByName(n));
  if(named.every(Boolean))return named;
  // The older build did not name hands. Keep a structural fallback so comparing
  // it fails on motion, rather than on the newly added debug names.
  const body=actor.group.children[0];
  const arms=body.children.filter(g=>g.isGroup&&g.children.some(m=>m.isMesh)&&g.children.filter(c=>c.isGroup).length===1);
  const hands=arms.map(g=>g.children.find(h=>h.isGroup&&h.children.filter(c=>c.isGroup).length===2));
  assert.equal(hands.length,2,'The student must have two inspectable hands.');
  assert.ok(hands.every(Boolean),'Missing student hand group.');
  return hands;
}
function deskHands(actor){
  return ['left','right'].map(side=>{
    const arm=actor.group.getObjectByName(`${side}-desk-arm`);
    const hand=actor.group.getObjectByName(`${side}-desk-hand`)??arm?.children.find(c=>c.isGroup);
    assert.ok(hand,`Missing ${side} desk hand.`);return hand;
  });
}

test('first-person hands have three fingers and one thumb each',()=>{
  const actor=createDeskHands();
  for(const hand of deskHands(actor)){
    const digits=[];hand.traverse(o=>{if(o.name==='finger'||o.name==='thumb')digits.push(o.name);});
    assert.equal(digits.filter(n=>n==='finger').length,3);
    assert.equal(digits.filter(n=>n==='thumb').length,1);
  }
});
function pose(hand){return{p:hand.position.clone(),q:hand.quaternion.clone()};}
function worldPose(hand){return{p:hand.getWorldPosition(new T.Vector3()),q:hand.getWorldQuaternion(new T.Quaternion())};}
function assertFiniteModel(root,label){
  root.updateMatrixWorld(true);
  root.traverse(o=>{
    assert.ok(o.matrixWorld.elements.every(Number.isFinite),`${label}: non-finite transform ${o.name}`);
    if(!o.isMesh)return;
    for(const key of ['position','normal']){
      const attribute=o.geometry.attributes[key];
      if(attribute)assert.ok(attribute.array.every(Number.isFinite),`${label}: non-finite ${key} in ${o.name}`);
    }
  });
}
function localGrip(prop,hand){
  return new T.Matrix4().copy(hand.matrixWorld).invert().multiply(prop.matrixWorld);
}
function assertRigidContact(a,b,label){
  const ap=new T.Vector3(),aq=new T.Quaternion(),as=new T.Vector3(),bp=new T.Vector3(),bq=new T.Quaternion(),bs=new T.Vector3();
  a.decompose(ap,aq,as);b.decompose(bp,bq,bs);
  assert.ok(ap.distanceTo(bp)<.0005,`${label}: held object slipped ${(ap.distanceTo(bp)*1000).toFixed(1)} mm in the palm.`);
  assert.ok(aq.angleTo(bq)<.002,`${label}: held object rotated independently of the palm.`);
}

test('student mood changes move the hand continuously, then actually reach the raised pose',()=>{
  for(const variant of ['boy','girl']){
    const actor=createStudent({variant,seated:false,mood:'resting',seed:3});
    const hand=studentHands(actor)[1];let time=0;
    for(let i=0;i<60;i++)actor.update(time+=DT,DT);
    const start=pose(hand);let previous=start,maxStep=0,maxTurn=0;
    actor.setMood('hero');
    for(let i=0;i<90;i++){
      actor.update(time+=DT,DT);const current=pose(hand);
      maxStep=Math.max(maxStep,current.p.distanceTo(previous.p));
      maxTurn=Math.max(maxTurn,current.q.angleTo(previous.q));previous=current;
    }
    assert.ok(maxStep<.12,`${variant}: wrist jumped ${(maxStep*100).toFixed(1)} cm in one 60 Hz frame.`);
    assert.ok(maxTurn<.6,`${variant}: wrist snapped ${(maxTurn*180/Math.PI).toFixed(1)} degrees.`);
    assert.ok(previous.p.y-start.p.y>.55,`${variant}: smoothing must not freeze or suppress the raised-hand action.`);
    assertFiniteModel(actor.group,variant);
  }
});

test('interrupting a student gesture and repeating its target never restart it with a snap',()=>{
  const actor=createStudent({variant:'girl',seated:false,mood:'resting',seed:5});
  const hand=studentHands(actor)[1];let time=0;
  for(let i=0;i<60;i++)actor.update(time+=DT,DT);
  actor.setMood('hero');
  for(let i=0;i<7;i++)actor.update(time+=DT,DT);
  let previous=pose(hand);actor.setMood('resting');
  for(let i=0;i<80;i++){
    actor.setMood('resting');actor.update(time+=DT,DT);const current=pose(hand);
    assert.ok(current.p.distanceTo(previous.p)<.12,'Interrupted gesture snapped its wrist position.');
    assert.ok(current.q.angleTo(previous.q)<.6,'Interrupted gesture snapped its wrist rotation.');previous=current;
  }
  assert.ok(hand.position.y<.75,'Repeated requests prevented returning to the resting pose.');
});

test('student gesture smoothing follows elapsed time even when scene updates are throttled',()=>{
  function run(rate){
    const actor=createStudent({variant:'boy',seed:4,seated:false,mood:'resting'}),hand=studentHands(actor)[1];
    for(let i=1;i<=rate;i++)actor.update(i/rate,DT);
    actor.setMood('hero');
    for(let i=1;i<=rate;i++)actor.update(1+i/rate,DT);
    return pose(hand);
  }
  const baseline=run(60);
  for(const rate of [30,12]){
    const throttled=run(rate);
    assert.ok(baseline.p.distanceTo(throttled.p)<.015,`${rate} Hz: actual elapsed time was lost in the pose smoother.`);
    assert.ok(baseline.q.angleTo(throttled.q)<.04,`${rate} Hz: wrist rotation depends on renderer update rate.`);
  }
});

test('held objects stay in their palm grip while wrists, view pitch and body pose move',()=>{
  const configs=[['snack','snack-packet',0],['drink','red-drink-can',0],['burger','layered-burger',0],['phone','handheld-phone',0],];
  for(const [action,name,index]of configs){
    const actor=createDeskHands(),hand=deskHands(actor)[index],prop=actor.group.getObjectByName(name);
    assert.ok(prop,`Missing ${name}.`);let baseline=null,samples=0;
    for(let frame=1;frame<=180;frame++){
      const time=frame*DT;
      actor.update(time,{action,holding:true,progress:0,seated:frame<130,crouched:frame>90&&frame<125,viewPitch:.15*Math.sin(time)});
      actor.group.updateMatrixWorld(true);
      if(prop.visible){const relative=localGrip(prop,hand);if(baseline)assertRigidContact(baseline,relative,action);else baseline=relative.clone();samples++;}
    }
    assert.ok(samples>60,`${action}: no sustained visible grasp to verify.`);
    assertFiniteModel(actor.group,action);
  }
});

test('both palm lofts close their longitudinal seam after asymmetric thumb-base shaping',()=>{
  const actor=createDeskHands();
  for(let frame=1;frame<=136;frame++)actor.update(frame*DT,{action:'phone',holding:true});
  for(const hand of deskHands(actor)){
    const palm=hand.children.find(c=>c.isGroup)?.children.find(c=>c.isMesh);
    assert.ok(palm,'Missing palm surface.');
    const geometry=palm.geometry,positions=geometry.attributes.position;
    // Indexed loft quads begin [a, a+1, b], so b locates the next ring.
    // Derive the stride rather than depending on a particular resolution.
    const stride=geometry.index.array[2];
    assert.ok(stride>3&&positions.count%stride===0,'Palm is no longer an indexed ring surface; update this topology audit.');
    for(let start=0;start<positions.count;start+=stride){
      const first=new T.Vector3().fromBufferAttribute(positions,start);
      const last=new T.Vector3().fromBufferAttribute(positions,start+stride-1);
      const gap=first.distanceTo(last);
      assert.ok(gap<.000001,`${hand.name}: open palm seam ${(gap*1000).toFixed(3)} mm wide.`);
    }
  }
});

test('changing a held item retracts the old item before the new one appears',()=>{
  const actor=createDeskHands(),hands=deskHands(actor);
  const props=['snack-packet','handheld-phone'].map(n=>actor.group.getObjectByName(n));
  let time=0;
  for(let i=0;i<80;i++)actor.update(time+=DT,{holding:true,action:'snack'});
  actor.group.updateMatrixWorld(true);let previous=hands.map(worldPose),sawEmpty=false,sawPhone=false;
  for(let i=0;i<150;i++){
    actor.update(time+=DT,{holding:true,action:'phone'});actor.group.updateMatrixWorld(true);
    const visible=props.filter(p=>p.visible);
    assert.ok(visible.length<=1,'Two selected objects were rendered at once.');
    if(!visible.length)sawEmpty=true;
    if(props[1].visible){assert.ok(sawEmpty,'The new item appeared before the old item was put away.');sawPhone=true;}
    const current=hands.map(worldPose);
    current.forEach((p,j)=>assert.ok(p.p.distanceTo(previous[j].p)<.12,`Hand ${j} snapped during the item change.`));previous=current;
  }
  assert.ok(sawPhone,'Requested phone never became available after retraction.');
});

test('eating brings the held food to the centre, bobs it, then returns without scaling or a detached bite',()=>{
  const actor=createDeskHands(),hands=deskHands(actor),food=actor.group.getObjectByName('snack-packet');
  assert.equal(actor.group.getObjectByName('single-crisp'),undefined);
  let time=0;for(let i=0;i<120;i++)actor.update(time+=DT,{carrying:true,action:'snack',freeLook:true});
  const positions=[],resting=[],scales=[];
  for(let i=0;i<=180;i++){
    actor.update(time+=DT,{holding:true,carrying:true,progress:i/180,action:'snack',freeLook:true});actor.group.updateMatrixWorld(true);
    assert.ok(food.visible);positions.push(food.getWorldPosition(new T.Vector3()));resting.push(hands[1].position.clone());scales.push(food.scale.clone());
  }
  const range=axis=>Math.max(...positions.map(p=>p[axis]))-Math.min(...positions.map(p=>p[axis]));
  assert.ok(range('y')>.075,'Food must visibly move up and down.');
  assert.ok(Math.abs(positions[90].x)<.025&&Math.abs(positions[90].x)<Math.abs(positions[0].x),'Food did not move to the screen centre.');
  assert.ok(positions.at(-1).distanceTo(positions[0])<.002,'The complete three-second motion did not return to its carry pose.');
  assert.ok(resting.every(p=>p.distanceTo(resting[0])<.001),'The empty hand should rest, not mime carrying a bite.');
  assert.ok(scales.every(s=>s.distanceTo(new T.Vector3(1,1,1))<1e-9),'Eating must not scale the held food.');
});

test('seated, standing and teacher geometry remain finite through representative actions',()=>{
  for(const seated of [false,true])for(const variant of ['boy','girl']){
    const actor=createStudent({variant,seated,seed:5});
    let t=0;for(const mood of ['resting','writing','snack','hero','chat']){
      actor.setMood(mood);for(let i=0;i<12;i++)actor.update(t+=1/12,DT);
      assertFiniteModel(actor.group,`${variant}/${seated}/${mood}`);
    }
  }
  const teacher=createTeacher();
  for(const phase of ['scan','walk','investigate']){
    teacher.update(1,{walking:1,look:.4,phase,alert:.7});assertFiniteModel(teacher.group,`teacher/${phase}`);
  }
});
