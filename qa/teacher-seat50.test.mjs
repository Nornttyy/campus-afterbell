import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedTeacher} from '../dist/imported-actors.js';
import {loadGeometry} from './gltf-geometry.mjs';

const local=(a,name)=>a.group.worldToLocal(a.bones[name].getWorldPosition(new T.Vector3()));
function hipSurfaceLow(a){let bottom=Infinity;a.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const {position,skinIndex,skinWeight}=mesh.geometry.attributes;for(let i=0;i<position.count;i++){let weight=-1,name='';for(let j=0;j<4;j++)if(skinWeight.getComponent(i,j)>weight){weight=skinWeight.getComponent(i,j);name=mesh.skeleton.bones[skinIndex.getComponent(i,j)].name;}if(/Hips$/.test(name)){const p=a.group.worldToLocal(mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));bottom=Math.min(bottom,p.y);}}});return bottom;}

test('shipping teacher sits on the office cushion with bent knees, grounded soles and unchanged bone lengths',async()=>{
 const a=createRiggedTeacher(await loadGeometry('teacher-v2.glb'));let t=0;for(let i=0;i<60;i++)a.update(t+=1/60,{phase:'watching'});
 const lengths=Object.fromEntries(Object.entries(a.bones).filter(([name])=>name!=='Hips').map(([name,b])=>[name,b.position.length()])),root=a.group.position.clone(),initialHip=local(a,'Hips').y;
 for(let i=0;i<180;i++)a.update(t+=1/60,{seated:true,phase:'board',speed:1.8});
 assert.ok(Math.abs(local(a,'Hips').y-.685)<.002);assert.ok(initialHip-local(a,'Hips').y>.2);assert.ok(a.diagnostics().weights.Walk<.001&&a.diagnostics().weights.Write<.001,'sitting must not walk or write at the blackboard');
 const bottom=hipSurfaceLow(a);assert.ok(bottom>.50&&bottom<.545,`pelvis skin missed the .5225m cushion: ${bottom}`);
 for(const side of ['Left','Right']){const hip=local(a,side+'UpLeg'),knee=local(a,side+'Leg'),ankle=local(a,side+'Foot'),toe=local(a,side+'ToeBase');assert.ok(knee.z>.28&&ankle.z>.20);assert.ok(toe.y>.005&&toe.y<.03,'shoe toe must remain on the floor');const bend=hip.clone().sub(knee).angleTo(ankle.clone().sub(knee));assert.ok(bend>.9&&bend<1.9,`knee must bend for a chair: ${bend}`);assert.ok(local(a,side+'Hand').y>.65&&local(a,side+'Hand').y<.82,'palms rest above the thighs');}
 for(const[name,length]of Object.entries(lengths))assert.ok(Math.abs(a.bones[name].position.length()-length)<1e-7,`${name} stretched`);assert.deepEqual(a.group.position,root);assert.deepEqual(a.group.scale.toArray(),[1,1,1]);assert.ok(new T.Box3().setFromObject(a.group,true).min.y>-.02);
 a.dispose();
});

test('teacher chair sitting, floor stun and standing blend continuously and do not accumulate a hip offset',async()=>{
 const a=createRiggedTeacher(await loadGeometry('teacher-v2.glb'));let t=0,previous=null,maxStep=0;const heights=[];
 for(const pose of [{seated:false,phase:'watching'},{seated:true,phase:'watching'},{seated:true,phase:'stunned'},{seated:false,phase:'watching'},{seated:true,phase:'watching'},{seated:false,phase:'watching'}]){
  for(let i=0;i<150;i++){a.update(t+=1/60,pose);const at=local(a,'LeftHand');if(previous)maxStep=Math.max(maxStep,at.distanceTo(previous));previous=at;const bounds=new T.Box3().setFromObject(a.group,true);assert.ok(bounds.min.y>-.04&&bounds.max.y<2.2,'pose escaped floor/height bounds');}
  heights.push(local(a,'Hips').y);
 }
 assert.ok(maxStep<.10,`wrist snapped ${maxStep}m`);assert.ok(Math.abs(heights[1]-.685)<.002&&Math.abs(heights[2]-.34)<.005,'chair and floor stun must be distinct poses');assert.ok(Math.abs(heights[0]-heights.at(-1))<.005,'leaving chair accumulated an offset');
 a.update(0,{seated:false,phase:'watching'});assert.equal(a.diagnostics().seatedWeight,0);assert.ok(Math.abs(local(a,'Hips').y-heights[0])<.005);a.dispose();
});
