import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {EDITOR_MODELS,rigBones,describeBones,capturePose,applyPose,cloneRig,createClipSampler,isPelvis} from '../dist/animator/rig-view.js';
import {loadGeometry} from './gltf-geometry.mjs';

const bare=name=>name.replace(/^mixamorig[:_]?/,'');
const bone=(root,name)=>rigBones(root).find(value=>bare(value.name)===name);
function update(root){root.updateMatrixWorld(true);root.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.update();});}
function skinPoint(mesh,index){const point=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,index);mesh.applyBoneTransform(index,point);return mesh.localToWorld(point);}
function weightedPoint(root,target){
  let best=null;
  root.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;const joint=mesh.skeleton.bones.indexOf(target);if(joint<0)return;
    const {skinIndex,skinWeight}=mesh.geometry.attributes;
    for(let index=0;index<skinIndex.count;index++)for(let component=0;component<4;component++){
      const weight=skinWeight.getComponent(index,component);
      if(skinIndex.getComponent(index,component)===joint&&weight>.4&&(!best||weight>best.weight))best={mesh,index,weight};
    }
  });return best;
}

for(const [id,file]of Object.entries(EDITOR_MODELS))test(`animation editor ${id}: real individual joints deform an independent skinned rig`,async()=>{
  const gltf=await loadGeometry(file+'.glb'),template=gltf.scene,editor=cloneRig(template),second=cloneRig(template);
  update(editor);update(second);
  const bind=capturePose(editor,{parentBasis:true}),descriptors=describeBones(editor),names=rigBones(editor).map(value=>value.name);
  assert.equal(new Set(names).size,names.length,'Actual names must identify joints unambiguously');
  assert.deepEqual(descriptors.map(value=>value.name),names);
  assert.equal(descriptors.filter(value=>isPelvis(value.name)).length,1);
  assert.ok(descriptors.find(value=>bare(value.name)==='Head')?.group==='头部');
  for(const side of ['Left','Right'])for(const digit of ['Thumb','Index','Middle','Ring','Pinky']){
    const name=side+'Hand'+digit+'1',joint=bone(editor,name),row=descriptors.find(value=>value.name===joint?.name);
    assert.ok(joint&&row,`${name}: individual finger is missing`);
    assert.equal(row.group,side==='Left'?'左手指':'右手指');
    assert.ok(row.parent&&names.includes(row.parent));
    assert.equal(bind[joint.name].parentBasis.length,4);
    assert.ok(Math.abs(new T.Quaternion().fromArray(bind[joint.name].parentBasis).length()-1)<1e-6);
  }
  const finger=bone(editor,'LeftHandIndex1'),tip=bone(editor,'LeftHandIndex3'),sample=weightedPoint(editor,tip);
  assert.ok(sample,'A real skinned finger, not a decorative marker, must be editable');
  const originalSkin=skinPoint(sample.mesh,sample.index),unchanged=capturePose(second),originalTemplate=capturePose(template),position=finger.position.toArray(),scale=finger.scale.toArray();
  const pose=capturePose(editor);pose[finger.name].quaternion=new T.Quaternion().fromArray(pose[finger.name].quaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.45)).toArray();
  applyPose(editor,pose);
  assert.ok(skinPoint(sample.mesh,sample.index).distanceTo(originalSkin)>.001,'Rotating the selected finger did not deform actual skin');
  assert.deepEqual(finger.position.toArray(),position,'Rotating a finger changed its length');assert.deepEqual(finger.scale.toArray(),scale);
  assert.deepEqual(capturePose(second),unchanged,'A cached model instance inherited another instance’s edit');
  assert.deepEqual(capturePose(template),originalTemplate,'Editing modified the cached source skeleton');
  applyPose(editor,bind);assert.ok(skinPoint(sample.mesh,sample.index).distanceTo(originalSkin)<1e-7,'Reset failed to restore the original skinned finger');
  const head=bone(editor,'Head'),expectedParent=head.parent.getWorldQuaternion(new T.Quaternion()).normalize(),basis=new T.Quaternion().fromArray(bind[head.name].parentBasis);
  assert.ok(expectedParent.angleTo(basis)<1e-6,'Mirror basis omitted the imported normalization parent');
});

for(const [id,file]of Object.entries(EDITOR_MODELS))test(`animation editor ${id}: sampling all source clips never overwrites an edited pose`,async()=>{
  const gltf=await loadGeometry(file+'.glb'),editor=cloneRig(gltf.scene),sampler=createClipSampler(gltf.scene,gltf.animations);
  assert.equal(gltf.animations.length,id==='teacher'?5:10,'Original clips were lost');
  const bind=capturePose(editor),edited=structuredClone(bind),head=bone(editor,'Head');
  edited[head.name].quaternion=new T.Quaternion().fromArray(edited[head.name].quaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),.25)).toArray();applyPose(editor,edited);
  const expected=capturePose(editor),sourceBefore=capturePose(gltf.scene);
  for(const clip of gltf.animations){
    const time=clip.duration*.43,first=sampler.sample(clip.name,time);
    assert.deepEqual(Object.keys(first),Object.keys(bind),'Sampling returned a partial pose');
    sampler.sample(clip.name,clip.duration);sampler.sample(clip.name,0);
    assert.deepEqual(sampler.sample(clip.name,time),first,'Repeated/backward sampling accumulated an animation offset');
    assert.deepEqual(capturePose(editor),expected,'A sampler mixer remained attached to the editable skeleton');
    assert.deepEqual(capturePose(gltf.scene),sourceBefore,'Sampling modified the shared cached template');
    for(const value of Object.values(first))assert.ok([...value.position,...value.quaternion,...value.scale].every(Number.isFinite));
  }
  sampler.dispose();assert.throws(()=>sampler.sample('Idle',0),/关闭/);
});
