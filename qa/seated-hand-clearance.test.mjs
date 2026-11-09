import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';
const V=()=>new T.Vector3();
function skinSamples(actor){const list=[],meshes=[];actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;meshes.push(mesh);const {skinIndex,skinWeight}=mesh.geometry.attributes;for(let i=0;i<skinIndex.count;i++){let strongest=0,name='';for(let k=0;k<4;k++)if(skinWeight.getComponent(i,k)>strongest){strongest=skinWeight.getComponent(i,k);name=mesh.skeleton.bones[skinIndex.getComponent(i,k)].name.replace(/^mixamorig[:_]?/,'');}if(/^(Left|Right)(Hand|ForeArm)/.test(name))list.push({mesh,index:i,name});}});return {list,meshes};}
function assertClear(actor,samples,label){actor.group.updateMatrixWorld(true);for(const m of samples.meshes)m.skeleton.update();const inverse=actor.group.matrixWorld.clone().invert();for(const s of samples.list){const p=s.mesh.getVertexPosition(s.index,V()).applyMatrix4(s.mesh.matrixWorld).applyMatrix4(inverse);assert.ok(!(Math.abs(p.x)<.585&&p.z>.356&&p.z<1.20&&p.y>.835&&p.y<.8749),`${label} ${s.name} skin enters actual DeskBody slab: ${p.toArray()}`);}}
for(const [variant,{file}] of Object.entries(STUDENT_ASSETS)){
 test(`${variant}: actual hand/forearm skin clears the real desktop through seated actions and interruptions on reversed seats`,async()=>{
  const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true}),pivot=new T.Group();pivot.position.set(2,.36,-4);pivot.rotation.y=Math.PI;pivot.add(actor.group);pivot.updateMatrixWorld(true);
  const samples=skinSamples(actor),lengths=new Map(Object.values(actor.bones).map(b=>[b,b.position.clone()]));let time=0,previous=null;
  const states=[['resting',120],['writing',120],['snack',120],['phone',120],['thinking',120],['resting',120],['phone',7],['writing',120],['snack',120],['phone',120],['thinking',120]];
  for(const [mood,frames]of states){actor.setMood(mood);actor.setMotion({seated:true,carrying:['snack','phone'].includes(mood),using:true});for(let frame=0;frame<frames;frame++){actor.update(time+=1/60);actor.group.updateMatrixWorld(true);const wrists=['Left','Right'].map(s=>actor.bones[s+'Hand'].getWorldPosition(V()));if(previous)for(let s=0;s<2;s++)assert.ok(wrists[s].distanceTo(previous[s])<.06,`${variant} ${mood} frame ${frame} side ${s}: correction snaps a wrist ${wrists[s].distanceTo(previous[s])}`);previous=wrists;if(frame%2===0)assertClear(actor,samples,`${variant} ${mood} frame ${frame}`);}}
  for(const [bone,p]of lengths)assert.ok(bone.position.distanceTo(p)<.00002,`${bone.name}: changed source bone length`);actor.dispose();
 });
 test(`${variant}: picked-up pen loops the authored right-hand Write pose without a food prop or held input`,async()=>{
  const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true});actor.setMood('pen');actor.setMotion({seated:true,carrying:true,heldAction:'pen',using:false,penWriting:true});const samples=skinSamples(actor);let time=0;
  for(let f=0;f<180;f++)actor.update(time+=1/60);
  const pencil=actor.group.getObjectByName('held-writing-pencil'),nibs=[];assert.equal(pencil.parent,actor.getHand('right'));assert.equal(actor.group.getObjectByName('red-school-pen'),undefined,'a second left-hand food-style pen was spawned');
  for(let f=0;f<120;f++){actor.update(time+=1/60);if(f%4)continue;assertClear(actor,samples,`${variant} pen`);assert.equal(pencil.visible,true);const weights=actor.diagnostics().weights;assert.ok(weights.Write>.999&&weights.Snack<.001);const nib=pencil.localToWorld(new T.Vector3(0,-.129,0));nibs.push(nib.clone());const page=.88+.005/Math.cos(.14)+Math.abs(nib.x)*Math.tan(.14);assert.ok(Math.abs(nib.y-page)<.003,`${variant}: nib leaves page: ${nib.y-page}`);assert.ok(nib.z>.44&&nib.z<.89&&Math.abs(nib.x)<.31);}
  assert.ok(nibs.some(p=>p.distanceTo(nibs[0])>.001),'Write loop never moves the actual pencil');actor.setMotion({seated:false,carrying:false,penWriting:false,restraint:'bound'});actor.update(time+=1/60);assert.equal(pencil.visible,false,'writing pen remains visible under restraint');actor.dispose();
 });
}
