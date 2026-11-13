import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {PLAYGROUND_LAYOUT} from '../dist/playground-layout70.js';
import {activityHandTargets} from '../dist/map-activity-pose77.js';
for(const[variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: both real wrists reach bar; temporary pose releases without accumulated bone stretch`,async()=>{
 const source=await loadGeometry(file+'.glb'),actor=createRiggedStudent(source,{variant,seated:false}),b=PLAYGROUND_LAYOUT.bars[2],pivot=new T.Group();pivot.add(actor.group);pivot.position.set(b.x-.45,b.height-1.65,b.z);pivot.rotation.y=Math.PI/2;
 actor.setMotion({seated:false,mapActivity:null});actor.update(0);const lengths=Object.entries(actor.bones).filter(([name])=>/^(Left|Right)(ForeArm|Hand)$/.test(name)).map(([,bone])=>[bone,bone.position.clone()]);
 const activity={kind:'hang',id:b.id,age:0,progress:0,bodyYaw:Math.PI/2};actor.setMotion({seated:false,mapActivity:activity});
 for(let i=1;i<=240;i++){actor.update(i/60);if(i%60)continue;pivot.updateMatrixWorld(true);for(const[side,p]of Object.entries(activityHandTargets(activity)))assert.ok(actor.bones[side+'Hand'].getWorldPosition(new T.Vector3()).distanceTo(p)<.005,`${side} wrist misses the physical bar`);}
 actor.setMotion({seated:false,mapActivity:null});for(let i=241;i<300;i++)actor.update(i/60);for(const[bone,rest]of lengths)assert.ok(bone.position.distanceTo(rest)<1e-7,'temporary reach changed the normal animation skeleton');actor.dispose();
});
