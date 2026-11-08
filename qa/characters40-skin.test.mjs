import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent} from '../dist/student-assets.js';
import {createRiggedTeacher} from '../dist/imported-actors.js';
import {loadGeometry} from './gltf-geometry.mjs';

const cases=[
 ['男同学','student-boy-v4.glb',{variant:'boy'}],
 ['紫发女同学','student-girl-v4.glb',{variant:'girl'}],
 ['棕马尾女同学','student-ponytail-v1.glb',{variant:'ponytail'}],
 ['眼镜同学','student-glasses-v2.glb',{variant:'boy',glasses:true}],
 ['老师','teacher-v2.glb',null],
];
const hash=data=>createHash('sha256').update(data).digest('hex');
async function glb(path){const bytes=await readFile(new URL(path,import.meta.url));assert.equal(bytes.readUInt32LE(8),bytes.length);const length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length);return{doc,bin};}
function imageHashes({doc,bin}){return doc.images.map(image=>{assert.ok(Number.isInteger(image.bufferView));const v=doc.bufferViews[image.bufferView],start=v.byteOffset||0;return hash(bin.subarray(start,start+v.byteLength));}).sort();}

for(const[label,file,options]of cases){
 test(`${label}: current game asset preserves the user's embedded textures and rig`,async()=>{
  const [source,current]=await Promise.all([glb('../art-source/tripo-exports-20261108/'+label+'.glb'),glb('../dist/assets/models/'+file)]);
  assert.deepEqual(imageHashes(current),imageHashes(source),'User-authored texture bytes changed during animation preparation');
  assert.equal(current.doc.skins.length,source.doc.skins.length);
  assert.deepEqual(current.doc.skins.map(s=>s.joints.length),source.doc.skins.map(s=>s.joints.length));
  const clips=current.doc.animations.map(a=>a.name);
  for(const name of options?['Idle','Walk','Sit','Write','Snack','Phone','Note','Think','Carry','WalkCarry']:['Idle','Walk','Write','Card','Throw'])assert.ok(clips.includes(name),`${file}: missing ${name}`);
 });
 test(`${label}: runtime animation keeps the skin finite and preserves limb lengths`,async()=>{
  const source=await loadGeometry(file),actor=options?createRiggedStudent(source,{...options,seated:false}):createRiggedTeacher(source);
  const bones={};actor.group.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
  const lengths=new Map();for(const name of['LeftForeArm','RightForeArm','LeftHand','RightHand','LeftLeg','RightLeg'])lengths.set(name,bones[name].position.length());
  let time=0;
  for(const mood of options?['idle','walking','writing','snack','phone','carried','bound','idle']:['idle','walking','writing']){
   if(options){actor.setMood(['idle','walking'].includes(mood)?'resting':mood);actor.setMotion({seated:['writing','snack','phone'].includes(mood),speed:mood==='walking'?.8:0,carrying:['snack','phone'].includes(mood),restraint:['carried','bound'].includes(mood)?mood:'free'});}
   for(let i=0;i<72;i++){
    time+=1/60;if(options)actor.update(time);else actor.update(time,{walking:mood==='walking'?1:0,phase:mood==='writing'?'board':'scan'});
    actor.group.updateMatrixWorld(true);
    for(const[name,length]of lengths)assert.ok(Math.abs(bones[name].position.length()-length)<1e-6,`${mood}: ${name} stretched`);
    actor.group.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(!o.isSkinnedMesh)return;o.skeleton.update();for(let v=0;v<o.geometry.attributes.position.count;v+=217){const p=new T.Vector3().fromBufferAttribute(o.geometry.attributes.position,v);o.applyBoneTransform(v,p);o.localToWorld(p);assert.ok(p.toArray().every(Number.isFinite));assert.ok(p.length()<4,`${mood}: skin escaped scene bounds`);}});
   }
  }
  actor.dispose();
 });
}
