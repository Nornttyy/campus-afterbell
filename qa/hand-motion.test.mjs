import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';

const V=()=>new T.Vector3();
const sides=['Left','Right'],fingers=['Index','Middle','Pinky','Thumb'];
const cases=[
  {name:'boy',file:'student-boy-v2.glb',variant:'boy'},
  {name:'girl',file:'student-girl-v2.glb',variant:'girl'},
  {name:'glasses',file:'student-glasses-v1.glb',variant:'boy',glasses:true},
];

function worldPoint(mesh,index){
  const p=V().fromBufferAttribute(mesh.geometry.attributes.position,index);
  mesh.applyBoneTransform(index,p);
  return mesh.localToWorld(p);
}

function updateSkin(group){
  group.updateMatrixWorld(true);
  group.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
}

// Use vertices actually weighted to the distal phalanx, rather than a bone or
// attachment proxy. This catches an animated skeleton with a static mesh.
function digitSurface(meshes,bone){
  const samples=[];
  for(const mesh of meshes){
    const joint=mesh.skeleton.bones.indexOf(bone);
    if(joint<0)continue;
    const {skinIndex,skinWeight}=mesh.geometry.attributes,vertices=[];
    for(let i=0;i<skinIndex.count;i++){
      let weight=0;
      for(let k=0;k<4;k++)if(skinIndex.getComponent(i,k)===joint)weight+=skinWeight.getComponent(i,k);
      if(weight>.55)vertices.push(i);
    }
    const stride=Math.max(1,Math.ceil(vertices.length/48));
    for(let i=0;i<vertices.length;i+=stride)samples.push({mesh,index:vertices[i]});
  }
  assert.ok(samples.length>=3,`${bone.name}: no usable fingertip skin weights`);
  return samples;
}

function skinCenter(samples,wrist){
  const p=V();
  for(const s of samples)p.add(wrist.worldToLocal(worldPoint(s.mesh,s.index)));
  return p.multiplyScalar(1/samples.length);
}

function inspectSource(gltf){
  const bones={},meshes=[];
  gltf.scene.traverse(o=>{
    if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;
    if(o.isSkinnedMesh)meshes.push(o);
  });
  updateSkin(gltf.scene);
  const hands={};
  for(const side of sides){
    const wrist=bones[side+'Hand'],at=n=>bones[side+'Hand'+n].getWorldPosition(V());
    const along=at('Middle1').sub(wrist.getWorldPosition(V())).normalize();
    // Anatomical oracle: thumb identifies the radial edge even when imported
    // Index/Pinky labels are reversed (the female right hand has this layout).
    const radial=at('Thumb1').sub(at('Middle1'));
    radial.addScaledVector(along,-radial.dot(along)).normalize();
    const dorsal=V().crossVectors(radial,along).multiplyScalar(side==='Left'?1:-1).normalize();
    dorsal.applyQuaternion(wrist.getWorldQuaternion(new T.Quaternion()).invert());
    const digits={};
    for(const finger of fingers){
      for(let joint=1;joint<=3;joint++)assert.ok(bones[side+'Hand'+finger+joint],`${side} ${finger}${joint} missing`);
      const samples=digitSurface(meshes,bones[side+'Hand'+finger+'3']);
      digits[finger]={samples,bindCenter:skinCenter(samples,wrist)};
    }
    hands[side]={wrist,dorsal,digits};
  }
  const skinSamples=meshes.flatMap(mesh=>{
    const count=mesh.geometry.attributes.position.count,stride=Math.max(1,Math.floor(count/160));
    return Array.from({length:Math.ceil(count/stride)},(_,i)=>({mesh,index:Math.min(i*stride,count-1)}));
  });
  return {bones,hands,skinSamples};
}

function assertSkinBounds(actor,source,label){
  updateSkin(actor.group);
  const box=new T.Box3();
  for(const s of source.skinSamples){
    const p=actor.group.worldToLocal(worldPoint(s.mesh,s.index));
    assert.ok(p.toArray().every(Number.isFinite),`${label}: non-finite skin`);
    box.expandByPoint(p);
  }
  const size=box.getSize(V());
  assert.ok(box.min.y>-.12&&box.max.y<2.05&&size.x<1.65&&size.z<1.5,`${label}: exploded skin ${JSON.stringify({min:box.min.toArray(),max:box.max.toArray()})}`);
}

for(const spec of cases)test(`${spec.name}: actual four-finger skin bends inward, carried wrists stay outside, and capture transitions remain continuous`,async()=>{
  const gltf=await loadGeometry(spec.file),source=inspectSource(gltf);
  const actor=createRiggedStudent(gltf,{variant:spec.variant,glasses:!!spec.glasses,seated:false,seed:.37});
  actor.setMood('resting');
  const boneRest=new Map(Object.values(actor.bones).map(b=>[b,{position:b.position.clone(),scale:b.scale.clone()}]));
  const palmHeightDirections=Object.fromEntries(sides.map(side=>[side,[]]));
  const palmTurns=Object.fromEntries(sides.map(side=>[side,[]]));
  const shoulderSlopes=[],wristDifferences=[];
  const motionSamples=Object.fromEntries(sides.map(side=>[side,Object.fromEntries(fingers.map(finger=>[finger,[]]))]));
  let time=0,previous=null,maxWristStep=0,maxTipStep=0,maxWristTurn=0,maxWristFrame='',maxTurnFrame='';
  for(const state of ['free','stunned','carried','bound','free']){
    actor.setMotion({seated:false,restraint:state,speed:0,carrying:false});
    for(let frame=0;frame<180;frame++){
      actor.update(time+=1/60);updateSkin(actor.group);
      const now={};
      for(const side of sides){
        const hand=source.hands[side],wrist=hand.wrist;
        const position=actor.group.worldToLocal(wrist.getWorldPosition(V()));
        const rotation=wrist.getWorldQuaternion(new T.Quaternion());
        const tip=worldPoint(hand.digits.Middle.samples[0].mesh,hand.digits.Middle.samples[0].index);
        now[side]={position,rotation,tip};
        if(previous){
          const step=position.distanceTo(previous[side].position);
          if(step>maxWristStep){maxWristStep=step;maxWristFrame=`${state} frame ${frame} ${side}`;}
          maxTipStep=Math.max(maxTipStep,tip.distanceTo(previous[side].tip));
          const turn=rotation.angleTo(previous[side].rotation);
          if(turn>maxWristTurn){maxWristTurn=turn;maxTurnFrame=`${state} frame ${frame} ${side}`;}
        }
        if(frame>90&&state==='carried'){
          palmTurns[side].push(rotation.clone());
          palmHeightDirections[side].push(actor.bones[side+'HandMiddle1'].getWorldPosition(V()).sub(wrist.getWorldPosition(V())).normalize().y);
          const sign=side==='Left'?1:-1;
          assert.ok(position.x*sign>.30,`${spec.name} ${side}: carried wrist hidden in torso (${position.toArray()})`);
          assert.ok(position.z>.065,`${spec.name} ${side}: carried hand remains behind torso (${position.toArray()})`);
          assert.ok(position.y>.72&&position.y<1.36,`${spec.name} ${side}: carried wrist outside natural reach`);
          for(const finger of fingers){
            const center=skinCenter(hand.digits[finger].samples,wrist);
            assert.ok(center.toArray().every(Number.isFinite),`${spec.name} ${side} ${finger}: non-finite fingertip skin`);
            motionSamples[side][finger].push(center);
          }
        }
        // In the source gameplay the bound hands are behind the back at the
        // post. Do not regress this to the earlier, incorrect front-hand pose.
        if(frame>120&&state==='bound')assert.ok(position.z<-.09,`${spec.name} ${side}: bound hand is no longer behind the back`);
      }
      if(frame>90&&state==='carried'){
        const shoulderY=side=>actor.bones[side+'Arm'].getWorldPosition(V()).y;
        shoulderSlopes.push(shoulderY('Left')-shoulderY('Right'));
        wristDifferences.push(now.Left.position.y-now.Right.position.y);
      }
      previous=now;
      for(const [bone,rest]of boneRest){
        if(/^(Hips|Head|Neck|Spine)/.test(bone.name.replace(/^mixamorig[:_]?/,'')))continue;
        assert.ok(bone.position.distanceTo(rest.position)<.00001,`${spec.name} ${state}: ${bone.name} changed bone length`);
        assert.ok(bone.scale.distanceTo(rest.scale)<.00001,`${spec.name} ${state}: ${bone.name} changed scale`);
      }
      if(frame%12===0)assertSkinBounds(actor,source,`${spec.name} ${state} frame ${frame}`);
    }
  }
  const failures=[];
  if(Math.min(...shoulderSlopes)>-.055||Math.max(...shoulderSlopes)<.055)failures.push('shoulder line never changes sides during struggle');
  if(Math.min(...wristDifferences)>-.16||Math.max(...wristDifferences)<.16)failures.push('wrists stay level instead of exchanging raised/dropped poses');
  for(const side of sides){const samples=palmTurns[side],range=Math.max(...samples.map(q=>q.angleTo(samples[0])));if(range<.18)failures.push(`${side}: palm direction is locked during the struggle (${range})`);const y=palmHeightDirections[side];if(Math.max(...y)<.08||Math.min(...y)>-.35)failures.push(`${side}: hand never rises out of the downward pose (${Math.min(...y)}, ${Math.max(...y)})`);}
  if(maxWristStep>=.10)failures.push(`wrist jumps ${maxWristStep.toFixed(4)} m (${maxWristFrame})`);
  if(maxTipStep>=.13)failures.push(`skinned fingertip jumps ${maxTipStep.toFixed(4)} m`);
  if(maxWristTurn>=.6)failures.push(`wrist snaps ${(maxWristTurn*180/Math.PI).toFixed(1)} degrees (${maxTurnFrame})`);
  for(const side of sides)for(const finger of fingers){
    const hand=source.hands[side],digit=hand.digits[finger],samples=motionSamples[side][finger];
    const range=new T.Box3().setFromPoints(samples).getSize(V()).length();
    if(range<=.0007)failures.push(`${side} ${finger}: actual fingertip skin remains static (${range})`);
    if(range>=.08)failures.push(`${side} ${finger}: fingertip deformation is too large (${range})`);
    if(finger!=='Thumb'){
      const mean=samples.reduce((sum,p)=>sum.add(p),V()).multiplyScalar(1/samples.length);
      const towardDorsal=mean.sub(digit.bindCenter).dot(hand.dorsal);
      if(towardDorsal>=-.003)failures.push(`${side} ${finger}: curl goes away from palm (${towardDorsal.toFixed(5)})`);
    }
  }
  actor.dispose();
  assert.deepEqual(failures,[],`${spec.name}: actual rig regressions`);
});

for(const spec of cases)test(`${spec.name}: chalk hit tips the body, bound fingers remain outside the post, and release restores the untouched idle pose`,async()=>{
  const gltf=await loadGeometry(spec.file),source=inspectSource(gltf);
  const actor=createRiggedStudent(gltf,{variant:spec.variant,glasses:!!spec.glasses,seated:false,seed:.37});
  let time=0;
  function advance(restraint,seconds){
    actor.setMood('resting');actor.setMotion({seated:false,speed:0,carrying:false,restraint});
    for(let i=0;i<Math.round(seconds*60);i++)actor.update(time+=1/60);
    updateSkin(actor.group);
  }
  const point=name=>actor.group.worldToLocal(actor.bones[name].getWorldPosition(V()));
  advance('free',1);
  const idleHead=point('Head'),idleHip=point('Hips');
  const idleWrists=Object.fromEntries(sides.map(side=>[side,point(side+'Hand')]));
  const idleFeet=Object.fromEntries(sides.map(side=>[side,point(side+'Foot')]));
  advance('stunned',.35);
  assert.equal(actor.diagnostics().capture.kind,'stunned');
  assert.ok(point('Head').z<idleHead.z-.045,`${spec.name}: head does not recoil after chalk impact`);
  assert.ok(point('Head').x<idleHead.x-.02,`${spec.name}: hit pose remains rigidly symmetrical`);
  assert.ok(point('Hips').y<idleHip.y-.015,`${spec.name}: knees never soften after impact`);
  for(const side of sides)assert.ok(point(side+'Foot').distanceTo(idleFeet[side])<.025,`${spec.name} ${side}: chalk reaction slides the planted foot`);
  advance('carried',1.2);advance('bound',1.6);
  // Sample real skinned distal finger surfaces. The former fist pose passed
  // wrist/bone tests while its visible fingers disappeared inside the wood.
  for(const side of sides){
    const hand=source.hands[side];
    let visibleDigits=0;const contacts=[];
    for(const finger of ['Index','Middle','Pinky']){
      const samples=hand.digits[finger].samples;
      const points=samples.map(s=>actor.group.worldToLocal(worldPoint(s.mesh,s.index)));
      const outside=points.filter(p=>Math.hypot(p.x,p.z+.30)>.08).length/points.length;
      const center=points.reduce((sum,p)=>sum.add(p),V()).multiplyScalar(1/points.length);
      contacts.push({finger,outside,center:center.toArray()});
      if(outside>.6&&center.z<-.31)visibleDigits++;
    }
    assert.ok(visibleDigits>=2,`${spec.name} ${side}: fingers are buried in the post instead of wrapping its back ${JSON.stringify(contacts)}`);
  }
  advance('free',.2);
  assert.equal(actor.diagnostics().capture.kind,'recovering');
  for(const side of sides)assert.ok(Math.abs(point(side+'Hand').x)>.28,`${spec.name} ${side}: release hand cuts through the body`);
  advance('free',1.3);
  assert.equal(actor.diagnostics().capture.kind,'free');
  for(const side of sides){
    assert.ok(point(side+'Hand').distanceTo(idleWrists[side])<.008,`${spec.name} ${side}: wrist is stuck in capture pose after rescue`);
    assert.ok(point(side+'Foot').distanceTo(idleFeet[side])<.008,`${spec.name} ${side}: foot is stuck in capture pose after rescue`);
  }
  assert.ok(point('Hips').distanceTo(idleHip)<.005,`${spec.name}: capture pelvis offset accumulates after rescue`);
  actor.dispose();
});
