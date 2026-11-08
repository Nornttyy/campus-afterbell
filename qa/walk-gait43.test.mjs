import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';

const assets={boy:'student-boy-v4',girl:'student-girl-v4',glasses:'student-glasses-v2',ponytail:'student-ponytail-v1',teacher:'teacher-v2'};
const V=()=>new T.Vector3();
const limbNames=['Hips','Head',...['Left','Right'].flatMap(s=>['UpLeg','Leg','Foot','ToeBase','Hand'].map(n=>s+n))];
function vertexSamples(scene,side){
 const samples=[];
 scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<si.count;i++){let weight=0;for(let k=0;k<4;k++){const name=mesh.skeleton.bones[si.getComponent(i,k)]?.name.replace(/^mixamorig[:_]?/,'');if(name===side+'Foot'||name?.startsWith(side+'Toe'))weight+=sw.getComponent(i,k);}if(weight>.75)samples.push({mesh,index:i});}
 });return samples;
}
for(const[role,file]of Object.entries(assets))test(`${role}: delivered walking plants feet continuously without a squat-bounce or loop hitch`,async()=>{
 const gltf=await loadGeometry(file+'.glb'),profile=gltf.parser.json.asset.extras.characters40;
 assert.equal(profile.walkGaitRevision,43,`${role}: missing corrected gait asset`);
 const speed=profile.nominalWalkSpeed,duration=profile.cycleDuration,stance=profile.stanceFraction;
 const bones={};gltf.scene.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
 const standingHipY=bones.Hips.getWorldPosition(V()).y;
 const skins={Left:vertexSamples(gltf.scene,'Left'),Right:vertexSamples(gltf.scene,'Right')};
 const clips=gltf.animations.filter(c=>c.name==='Walk'||c.name==='WalkCarry');
 assert.equal(clips.length,role==='teacher'?1:2);
 for(const clip of clips){
  const mixer=new T.AnimationMixer(gltf.scene),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const pose=t=>{action.paused=false;action.enabled=true;mixer.setTime(t);gltf.scene.updateMatrixWorld(true);return Object.fromEntries(limbNames.map(n=>[n,{position:bones[n].getWorldPosition(V()),quaternion:bones[n].getWorldQuaternion(new T.Quaternion()).normalize()}]));};
  const first=pose(0),last=pose(duration);
  for(const name of limbNames){assert.ok(first[name].position.distanceTo(last[name].position)<.00003,`${role} ${clip.name} ${name}: loop position jumps`);assert.ok(first[name].quaternion.angleTo(last[name].quaternion)<.0002,`${role} ${clip.name} ${name}: loop rotation jumps`);}
  let low=Infinity,high=-Infinity;
  for(let i=0;i<=96;i++){const t=duration*i/96,p=pose(t);low=Math.min(low,p.Hips.position.y);high=Math.max(high,p.Hips.position.y);}
  // An adult stride needs the pelvis to rise over its supporting leg. A
  // fixed 1.6 cm envelope forced the teacher to crouch throughout the cycle.
  // Bound both travel AND support-leg posture, rather than accepting low bob
  // while the entire actor remains squatting. Student limits stay unchanged.
  assert.ok(high-low>=.009&&high-low<=(role==='teacher'?.04:.021),`${role} ${clip.name}: body bounces ${(high-low)*100} cm per step`);
  if(role==='teacher'){
   assert.ok(low>standingHipY-.055&&high>standingHipY-.02,`${role}: pelvis remains lowered throughout walking`);
  }
  const dt=1/240;
  for(const side of ['Left','Right']){
   const offset=side==='Left'?0:.5,foot=side+'Foot';
   // Compare actual delivered-bone velocities before and after toe-off and
   // landing, including the wrap. Endpoint equality alone misses a hitch.
   for(const phase of [0,stance]){
    const t=((phase-offset+1)%1)*duration;
    const p0=pose(t)[foot].position,pBefore=pose(t-dt<0?duration-dt:t-dt)[foot].position,pAfter=pose(t+dt>duration?dt:t+dt)[foot].position;
    const before=p0.clone().sub(pBefore).divideScalar(dt),after=pAfter.clone().sub(p0).divideScalar(dt);
    assert.ok(before.distanceTo(after)<.16,`${role} ${clip.name} ${side}: landing/toe-off velocity jumps ${before.distanceTo(after)} m/s`);
   }
   let plantedLow=Infinity,plantedHigh=-Infinity,airHigh=-Infinity;const supportKnees=[];
   for(let i=0;i<96;i++){
    const t=duration*i/96,phase=(t/duration+offset)%1;const p=pose(t);
    gltf.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
    let sole=Infinity;for(const sample of skins[side])sole=Math.min(sole,sample.mesh.getVertexPosition(sample.index,V()).applyMatrix4(sample.mesh.matrixWorld).y);
    if(phase<stance){plantedLow=Math.min(plantedLow,sole);plantedHigh=Math.max(plantedHigh,sole);}else airHigh=Math.max(airHigh,sole);
    if(phase>.06&&phase<stance-.06){const next=pose(t+dt)[foot].position,v=next.sub(p[foot].position).divideScalar(dt);assert.ok(Math.abs(v.z+speed)<.025,`${role} ${clip.name} ${side}: planted foot slides against world movement`);assert.ok(Math.abs(v.y)<.05,`${role} ${clip.name} ${side}: planted ankle jitters vertically`);}
    const root=p[side+'UpLeg'].position,knee=p[side+'Leg'].position,ankle=p[foot].position;const direction=ankle.clone().sub(root).normalize(),projected=root.clone().addScaledVector(direction,knee.clone().sub(root).dot(direction));
    assert.ok(knee.z-projected.z>.005,`${role} ${clip.name} ${side}: knee bends backward`);
    if(phase<stance)supportKnees.push((Math.PI-root.clone().sub(knee).angleTo(ankle.clone().sub(knee)))*180/Math.PI);
   }
   assert.ok(plantedLow>-.006&&plantedHigh<.006,`${role} ${clip.name} ${side}: visible sole does not stay on the floor (${plantedLow},${plantedHigh})`);
   assert.ok(airHigh>.025&&airHigh<.068,`${role} ${clip.name} ${side}: visible swing foot marches too high (${airHigh})`);
   if(role==='teacher'){
    supportKnees.sort((a,b)=>a-b);
    assert.ok(supportKnees.at(-1)<33&&supportKnees[Math.floor(supportKnees.length/2)]<25,`${role} ${side}: support knee stays crouched (${supportKnees.at(-1)} degrees maximum)`);
   }
  }
  mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
 }
});
