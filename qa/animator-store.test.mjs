import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Euler} from '../dist/vendor/three.module.js';
import {createProject,validateProject,samplePose,upsertKey,removeKey,moveKey,mirrorPose,setBoneEuler,getBoneEuler,createHistory} from '../dist/animator/pose-store.js';
const base={Hips:{position:[0,1,0],quaternion:[0,0,0,1],scale:[1,1,1]},LeftHand:{position:[.2,0,0],quaternion:[0,0,0,1],scale:[1,1,1]},RightHand:{position:[-.2,0,0],quaternion:[0,0,0,1],scale:[1,1,1]}};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('editor stores frame-snapped keys and interpolates through the shortest rotation',()=>{
 let project=createProject('boy',base,{duration:2}),a=setBoneEuler(base,'LeftHand',[0,170,0],base),b=setBoneEuler(base,'LeftHand',[0,-170,0],base);
 project=upsertKey(project,0,a);project=upsertKey(project,1,b);
 const middle=samplePose(project,.5).LeftHand.quaternion;
 close(Math.abs(middle[1]),1);close(middle[3],0);
 const edited=upsertKey(project,1.011,b);assert.equal(edited.keys.length,2);assert.equal(edited.keys[1].time,1);
 assert.equal(project.keys[0].pose.LeftHand.quaternion[1],a.LeftHand.quaternion[1]);
});
test('loop tail closes smoothly while non-loop tail holds its final pose',()=>{
 let p=createProject('boy',base,{duration:2}),next=structuredClone(base);next.Hips.position[0]=1;p=upsertKey(p,1,next);
 close(samplePose(p,1.5).Hips.position[0],.5);close(samplePose(p,2).Hips.position[0],0);
 p.loop=false;close(samplePose(p,2).Hips.position[0],1);
 p=upsertKey(p,2,next);p.loop=true;close(samplePose(p,2).Hips.position[0],1);
});
test('moving keys never silently destroys another pose and the last key stays recoverable',()=>{
 let p=upsertKey(createProject('girl',base),1,base),id=p.keys[1].id;
 assert.throws(()=>moveKey(p,id,0),/已有关键帧/);p=moveKey(p,id,1.5);close(p.keys[1].time,1.5);
 p=removeKey(p,id);assert.throws(()=>removeKey(p,p.keys[0].id),/至少保留/);
});
test('mirror twice preserves pose even when left and right bone axes differ',()=>{
 const bind=structuredClone(base);bind.LeftHand.parentBasis=new Quaternion().setFromEuler(new Euler(.3,-.5,.8)).toArray();bind.RightHand.parentBasis=new Quaternion().setFromEuler(new Euler(-.4,.2,-.7)).toArray();
 bind.LeftHand.quaternion=new Quaternion().setFromEuler(new Euler(.4,0,.1)).toArray();bind.RightHand.quaternion=new Quaternion().setFromEuler(new Euler(-.3,.2,0)).toArray();
 let pose=setBoneEuler(bind,'LeftHand',[32,-18,47],bind);pose.Hips.position[0]=.11;pose.LeftHand.position[1]+=.04;
 const twice=mirrorPose(mirrorPose(pose,bind),bind);
 for(const name of Object.keys(pose)){pose[name].position.forEach((v,i)=>close(v,twice[name].position[i]));close(Math.abs(new Quaternion().fromArray(pose[name].quaternion).dot(new Quaternion().fromArray(twice[name].quaternion))),1);}
 const angles=getBoneEuler(pose,'LeftHand',bind);[32,-18,47].forEach((v,i)=>close(v,angles[i]));
});
test('undo/redo stores independent projects and a new edit replaces the redo branch',()=>{
 const initial=createProject('boy',base),h=createHistory(initial),next=upsertKey(initial,.5,base);h.commit(next);
 assert.equal(h.current().keys.length,2);assert.equal(h.undo().keys.length,1);assert.equal(h.redo().keys.length,2);
 h.undo();h.commit(upsertKey(initial,1,base));assert.equal(h.canRedo(),false);
 const current=h.current();current.keys[0].pose.Hips.position[0]=8;close(h.current().keys[0].pose.Hips.position[0],0);
});
test('invalid import data cannot corrupt the model or inject prototype keys',()=>{
 const p=createProject('boy',base);const broken=structuredClone(p);broken.keys[0].pose.Hips.quaternion=[0,0,0,0];assert.throws(()=>validateProject(broken),/旋转不能为零/);
 assert.throws(()=>validateProject({...p,duration:Infinity}),/时长/);
 const polluted=JSON.parse(JSON.stringify(p).replace('"Hips":','"__proto__":'));assert.throws(()=>validateProject(polluted),/骨骼名称/);
 const missing=upsertKey(p,1,base);delete missing.keys[1].pose.LeftHand;assert.throws(()=>validateProject(missing),/骨骼不一致/);
});
