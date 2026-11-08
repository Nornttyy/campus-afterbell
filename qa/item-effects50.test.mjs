import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createItemEffects50} from '../dist/item-effects50.js';
import {createBubbleEffects} from '../dist/bubble-effects.js';
import {createRiggedTeacher} from '../dist/imported-actors.js';
import {createRiggedStudent} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';

test('item effect meshes track authoritative states, disappear on expiration and reset without leaks',()=>{
 const scene=new T.Scene(),effects=createItemEffects50(scene),state={elapsed:3,map:'classroom',player:{id:9},students:[{id:1,x:0,z:0,stunLeft:3,inkLeft:5}],teacher:{x:2,z:2,inkLeft:4},peels:[{id:1,x:1,y:.075,z:1,armed:true}],burps:[{id:2,x:2,y:1.5,z:2,yaw:1,age:.3,lifetime:2.5}]};effects.update(state);
 assert.deepEqual(effects.diagnostics(),{peels:1,burps:1,stars:1,ink:2});scene.updateMatrixWorld(true);scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
 effects.update({...state,peels:[],burps:[],students:[],teacher:{}});assert.deepEqual(effects.diagnostics(),{peels:0,burps:0,stars:0,ink:0});effects.dispose();assert.equal(scene.children.length,0);
});
test('gum grows for ordinary use as well as bound pupils, and an own head attachment does not render through the camera',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),fx=createBubbleEffects(scene,camera),p={id:9,captivity:'free',bubble:{progress:.5}},state={player:p,students:[{id:1,x:1,z:1,yaw:0,seated:true,captivity:'free',bubble:{progress:.4}}],bubbles:[]};fx.update(state);assert.equal(camera.getObjectByName('first-person-gum-bubble').children[0].visible,true);assert.equal(scene.getObjectByName('released-gum-bubbles').children.length,1);
 fx.update({...state,player:{...p,bubble:{progress:0}},students:[],bubbles:[{id:1,charge:1,age:0,lifetime:10,x:0,y:1.7,z:0,attachedId:9}]});assert.equal(scene.getObjectByName('released-gum-bubbles').children[0].visible,false);fx.dispose();assert.equal(camera.children.length,0);assert.equal(scene.children.length,0);
});
for(const [name,file,teacher]of[['boy','student-boy-v4.glb',false],['girl','student-girl-v4.glb',false],['teacher','teacher-v2.glb',true]])test(`${name} stun settles onto the floor with forward legs, finite skin, and restores normal height`,async()=>{
 const g=await loadGeometry(file),actor=teacher?createRiggedTeacher(g):createRiggedStudent(g,{seated:false,variant:name==='girl'?'girl':'boy'});let time=0;const initialHip=actor.group.worldToLocal(actor.bones.Hips.getWorldPosition(new T.Vector3())).y;
 for(let i=0;i<120;i++){time+=1/60;if(!teacher)actor.setMotion({restraint:'stunned',seated:false});actor.update(time,{phase:'stunned'});}
 const hip=actor.group.worldToLocal(actor.bones.Hips.getWorldPosition(new T.Vector3()));assert.ok(hip.y>.30&&hip.y<.39);
 for(const side of ['Left','Right']){const foot=actor.group.worldToLocal(actor.bones[side+'Foot'].getWorldPosition(new T.Vector3()));assert.ok(foot.z>.40,'legs should extend forward on ground');}
 const box=new T.Box3().setFromObject(actor.group,true);assert.ok(box.min.y>-.035,'skin penetrates ground');assert.ok(box.max.y<1.8,'still standing');
 for(let i=0;i<90;i++){time+=1/60;if(!teacher)actor.setMotion({restraint:'free',seated:false});actor.update(time,{phase:'watching'});}
 const recovered=actor.group.worldToLocal(actor.bones.Hips.getWorldPosition(new T.Vector3()));assert.ok(recovered.y>hip.y+.22);assert.ok(Math.abs(recovered.y-initialHip)<.06);actor.group.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));actor.dispose();
});
