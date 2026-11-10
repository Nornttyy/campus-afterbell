import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {cloneCharacter} from '../dist/clone-character57.js';
import {createRiggedStudent} from '../dist/student-assets.js';
import {createRiggedTeacher} from '../dist/imported-actors.js';
import {setCharacterNight} from '../dist/character-materials.js';

const cases=[
 ['boy','student-boy-v4.glb'],['girl','student-girl-v4.glb'],
 ['ponytail','student-ponytail-v1.glb'],['glasses','student-glasses-v2.glb'],
 ['teacher','teacher-v2.glb']
];
const hash=array=>createHash('sha256').update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
function skinMeshes(root){const result=[];root.traverse(mesh=>{if(mesh.isSkinnedMesh)result.push(mesh);});assert.ok(result.length);return result;}
function geometryState(root){return skinMeshes(root).map(mesh=>({index:hash(mesh.geometry.index.array),attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name,attribute])=>[name,hash(attribute.array)]))}));}
function skinMaterial(root){const material=skinMeshes(root)[0].material;return Array.isArray(material)?material[0]:material;}
function compile(material){
 const shader=T.ShaderLib[material.isMeshLambertMaterial?'lambert':'basic'];
 const result={uniforms:{},vertexShader:shader.vertexShader,fragmentShader:shader.fragmentShader};
 material.onBeforeCompile(result);
 // Test the production hook with Three's actual shader chunks. Do not copy
 // the mask shape or its GLSL equations into a parallel test implementation.
 assert.ok(result.uniforms.faceClosed&&result.uniforms.faceInk,'facial shader hook is present');
 return result;
}
function actorFrom(source,variant,seed=0){
 // The real loader clones skeletons but shares the source's materials/geometry.
 // Independent loads would hide accidental mutation of those shared assets.
 const gltf={...source,scene:cloneCharacter(source.scene)};
 const actor=variant==='teacher'?createRiggedTeacher(gltf):createRiggedStudent(gltf,{variant,seed,seated:false});
 let time=0;
 return{actor,advance(state={},frames=1){
  const {stunned=false,inkLeft=0}=state;
  if(variant!=='teacher'){actor.setMood('resting');actor.setMotion({seated:false,speed:0,restraint:stunned?'stunned':'free',inkLeft});}
  for(let i=0;i<frames;i++){time+=1/60;actor.update(time,variant==='teacher'?{phase:stunned?'stunned':'scan',walking:0,inkLeft}:undefined);}
  return actor.diagnostics().face;
 }};
}

for(const [variant,file]of cases){
 test(`${variant}: real shared-source actors keep stun and ink uniforms independent`,async()=>{
  const source=await loadGeometry(file),sourceState=geometryState(source.scene),sourceMaterial=skinMaterial(source.scene),sourceHook=sourceMaterial.onBeforeCompile;
  const a=actorFrom(source,variant,4),b=actorFrom(source,variant,21);
  try{
   a.advance();b.advance();const aMaterial=skinMaterial(a.actor.group),bMaterial=skinMaterial(b.actor.group),aShader=compile(aMaterial),bShader=compile(bMaterial);
   assert.notEqual(aMaterial,bMaterial);assert.notEqual(aMaterial,sourceMaterial);
   for(const key of ['faceClosed','faceInk'])assert.notEqual(aShader.uniforms[key],bShader.uniforms[key],key+' must be owned per actor');
   const affected=a.advance({stunned:true,inkLeft:4},40),clear=b.advance({},40);
   assert.ok(affected.closed>.99);assert.equal(affected.ink,1);assert.equal(clear.closed,0);assert.equal(clear.ink,0);
   assert.equal(aShader.uniforms.faceClosed.value,affected.closed);assert.equal(aShader.uniforms.faceInk.value,1);
   assert.equal(bShader.uniforms.faceClosed.value,0);assert.equal(bShader.uniforms.faceInk.value,0);
   assert.deepEqual(geometryState(source.scene),sourceState);assert.equal(skinMaterial(source.scene),sourceMaterial);assert.equal(sourceMaterial.onBeforeCompile,sourceHook);
  }finally{a.actor.dispose();b.actor.dispose();}
 });

 test(`${variant}: day/night switching retains facial masks and the pupil shader chain`,async()=>{
  const source=await loadGeometry(file),a=actorFrom(source,variant,4);let disposed=false;
  try{
   a.advance({stunned:true,inkLeft:3},30);const day=skinMaterial(a.actor.group),dayShader=compile(day);
   setCharacterNight(a.actor.group,true);const night=skinMaterial(a.actor.group),nightShader=compile(night);
   assert.ok(night.isMeshLambertMaterial);assert.equal(night.emissive.getHex(),0,'night characters must receive scene lighting');
   assert.equal(night.onBeforeCompile,day.onBeforeCompile,'night keeps the full original hook chain');
   for(const key of ['faceClosed','faceInk','faceBounds','faceRestFromLocal'])assert.equal(nightShader.uniforms[key].value,dayShader.uniforms[key].value);
   for(const key of ['faceClosed','faceInk'])assert.equal(nightShader.uniforms[key],dayShader.uniforms[key],'updates must reach the already-compiled night shader');
   if(!['teacher','glasses'].includes(variant)){
    assert.ok(dayShader.uniforms.studentEyeGaze,'facial patch must not replace animated pupils');
    assert.equal(nightShader.uniforms.studentEyeGaze,dayShader.uniforms.studentEyeGaze);
   }
   const state=a.advance({stunned:false,inkLeft:.75},30);assert.ok(state.closed<.01);assert.ok(state.ink>0&&state.ink<1);
   assert.equal(nightShader.uniforms.faceClosed.value,state.closed);assert.equal(nightShader.uniforms.faceInk.value,state.ink);
   setCharacterNight(a.actor.group,false);assert.equal(skinMaterial(a.actor.group),day);
   let nightDisposed=0;night.addEventListener('dispose',()=>nightDisposed++);a.actor.dispose();disposed=true;assert.equal(nightDisposed,1);
  }finally{if(!disposed)a.actor.dispose();}
 });

 test(`${variant}: closed eyes reopen without changing source or runtime geometry`,async()=>{
  const source=await loadGeometry(file),beforeSource=geometryState(source.scene),a=actorFrom(source,variant);
  try{
   a.advance();const beforeRuntime=geometryState(a.actor.group);
   const closing=a.advance({stunned:true},1);assert.ok(closing.closed>0&&closing.closed<1,'stun enters continuously');
   const closed=a.advance({stunned:true},60);assert.ok(closed.closed>.999);
   const opening=a.advance({},1);assert.ok(opening.closed>0&&opening.closed<closed.closed,'recovery does not leave eyes closed or snap them open');
   const recovered=a.advance({},100);assert.ok(recovered.closed<1e-7);assert.equal(recovered.ink,0);
   assert.deepEqual(geometryState(source.scene),beforeSource);assert.deepEqual(geometryState(a.actor.group),beforeRuntime,'facial expression must not mutate eye, hand or body vertices');
  }finally{a.actor.dispose();}
 });

 test(`${variant}: ink expiration is continuous, bounded and clears at authoritative zero`,async()=>{
  const a=actorFrom(await loadGeometry(file),variant);
  try{
   a.advance();const shader=compile(skinMaterial(a.actor.group));let prior=1,maxStep=0;
   for(let frame=0;frame<=120;frame++){
    const left=2-frame/60,state=a.advance({inkLeft:left});assert.ok(Number.isFinite(state.ink)&&state.ink>=0&&state.ink<=1);assert.ok(state.ink<=prior+1e-12);
    maxStep=Math.max(maxStep,prior-state.ink);prior=state.ink;assert.equal(shader.uniforms.faceInk.value,state.ink);
   }
   assert.equal(prior,0);assert.ok(maxStep>0&&maxStep<.03,'fade progresses across frames instead of disappearing at the last second');
   const justBelow=a.advance({inkLeft:1.5-1e-5}).ink,atBoundary=a.advance({inkLeft:1.5}).ink,justAbove=a.advance({inkLeft:1.5+1e-5}).ink;
   assert.ok(Math.abs(justBelow-atBoundary)<1e-6);assert.equal(atBoundary,justAbove);assert.equal(atBoundary,1);
   assert.ok(a.advance({inkLeft:1e-5}).ink<1e-6);assert.equal(a.advance({inkLeft:0}).ink,0);assert.equal(a.advance({inkLeft:-1}).ink,0);
   assert.equal(a.advance({inkLeft:5}).ink,1,'a new hit after recovery becomes opaque again');
  }finally{a.actor.dispose();}
 });
}
