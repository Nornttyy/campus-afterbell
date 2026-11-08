import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/addons/loaders/GLTFLoader.js';
import {buildAnimatedGLB,createAnimationTracks,importProjectFile} from '../dist/animator/animation-io.js';

const models={boy:'student-boy-v4',girl:'student-girl-v4',ponytail:'student-ponytail-v1',glasses:'student-glasses-v2',teacher:'teacher-v2'};
const hash=x=>createHash('sha256').update(x).digest('hex');
function readGLB(input){
 const bytes=Buffer.from(input),n=bytes.readUInt32LE(12);assert.equal(bytes.readUInt32LE(8),bytes.length);
 return{json:JSON.parse(bytes.subarray(20,20+n)),bin:bytes.subarray(28+n),bytes};
}
function imageHashes({json,bin}){return(json.images||[]).map(image=>{const v=json.bufferViews[image.bufferView];return hash(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));});}
function geometryOnly(input){
 const{json,bin}=readGLB(input);json.materials=[{pbrMetallicRoughness:{metallicFactor:0,roughnessFactor:.8}}];
 for(const mesh of json.meshes)for(const p of mesh.primitives)p.material=0;
 delete json.images;delete json.textures;delete json.samplers;json.extensionsUsed=[];json.extensionsRequired=[];
 const text=Buffer.from(JSON.stringify(json)),length=Math.ceil(text.length/4)*4,out=Buffer.alloc(28+length+bin.length);
 out.write('glTF');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);out.fill(32,20,20+length);text.copy(out,20);out.writeUInt32LE(bin.length,20+length);out.writeUInt32LE(0x004e4942,24+length);bin.copy(out,28+length);
 return out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength);
}
async function loadBytes(bytes){return new GLTFLoader().parseAsync(geometryOnly(bytes),'');}
function readPose(scene){const pose={};scene.traverse(o=>{if(o.isBone)pose[o.name]={position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray()};});return pose;}
function projectFor(modelId,scene,name='编辑器测试'){
 const start=readPose(scene),finish=structuredClone(start),hip=Object.keys(start).find(n=>n.endsWith('Hips')),arm=Object.keys(start).find(n=>n.endsWith('LeftForeArm'));
 finish[hip].position[0]+=.08;
 finish[arm].quaternion=new T.Quaternion().fromArray(start[arm].quaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.28)).toArray();
 return{project:{version:1,modelId,name,duration:1.5,fps:60,loop:false,keys:[{id:'start',time:.25,pose:start},{id:'end',time:.75,pose:finish}]},hip,arm};
}
function animatedPose(gltf,clipName,time){
 const mixer=new T.AnimationMixer(gltf.scene),clip=gltf.animations.find(c=>c.name===clipName);assert.ok(clip);
 const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(time);gltf.scene.updateMatrixWorld(true);
 return{pose:readPose(gltf.scene),mixer,clip};
}
const fixtures=new Map();
async function fixture(modelId){
 if(!fixtures.has(modelId)){const bytes=await readFile(new URL(`../dist/assets/models/${models[modelId]}.glb`,import.meta.url)),gltf=await loadBytes(bytes);fixtures.set(modelId,{bytes,gltf,...projectFor(modelId,gltf.scene)});}
 return fixtures.get(modelId);
}

for(const modelId of Object.keys(models))test(`${modelId}: animated GLB keeps original skin, textures and samplable custom motion`,async()=>{
 const{bytes,project,hip,arm}=await fixture(modelId),before=hash(bytes),input=readGLB(bytes),outputBytes=buildAnimatedGLB(bytes,project),output=readGLB(outputBytes);
 assert.equal(hash(bytes),before,'pure export must not mutate source bytes');
 assert.deepEqual(output.bin.subarray(0,input.bin.length),input.bin,'original binary prefix was changed');
 for(const field of ['meshes','skins','materials','images','textures','samplers'])assert.deepEqual(output.json[field],input.json[field],`${field} changed`);
 assert.deepEqual(imageHashes(output),imageHashes(input));
 assert.deepEqual(output.json.nodes.map(n=>n.name),input.json.nodes.map(n=>n.name),'original node names or indices changed');
 assert.equal(output.json.animations.length,input.json.animations.length+1);
 const loaded=await loadBytes(outputBytes),{pose,mixer,clip}=animatedPose(loaded,project.name,.5);
 assert.ok(Math.abs(clip.duration-1.5)<1e-6,'duration endpoint must be present');
 assert.ok(Math.abs(pose[hip].position[0]-project.keys[0].pose[hip].position[0]-.04)<1e-5,'translation should interpolate at the edited key times');
 const expected=new T.Quaternion().fromArray(project.keys[0].pose[arm].quaternion).slerp(new T.Quaternion().fromArray(project.keys[1].pose[arm].quaternion),.5);
 assert.ok(new T.Quaternion().fromArray(pose[arm].quaternion).angleTo(expected)<.001,'quaternion interpolation changed');
 loaded.scene.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();for(let i=0;i<o.geometry.attributes.position.count;i+=311){const p=new T.Vector3().fromBufferAttribute(o.geometry.attributes.position,i);o.applyBoneTransform(i,p);o.localToWorld(p);assert.ok(p.toArray().every(Number.isFinite));assert.ok(p.length()<5,'exported skin exploded');}}});
 mixer.setTime(1.49);const tail=readPose(loaded.scene);assert.ok(Math.abs(tail[hip].position[0]-project.keys[1].pose[hip].position[0])<1e-5,'nonloop tail must hold last key');
});

test('replacing one named animation preserves every other clip',async()=>{
 const{bytes,project}=await fixture('boy'),p={...project,name:'Walk'},before=readGLB(bytes).json,after=readGLB(buildAnimatedGLB(bytes,p)).json;
 assert.equal(after.animations.filter(a=>a.name==='Walk').length,1);
 assert.equal(after.animations.length,before.animations.length);
 for(const animation of before.animations.filter(a=>a.name!=='Walk'))assert.deepEqual(after.animations.find(a=>a.name===animation.name),animation);
});

test('loop export closes the last gap, respects explicit final keys and avoids quaternion flips',async()=>{
 const{bytes,project,hip,arm}=await fixture('boy'),p=structuredClone(project);p.loop=true;p.keys[1].pose[arm].quaternion=p.keys[1].pose[arm].quaternion.map(x=>-x);
 const tracks=createAnimationTracks(p),rotation=tracks.tracks.find(t=>t.bone===arm&&t.path==='rotation');
 for(let i=4;i<rotation.values.length;i+=4)assert.ok(rotation.values.slice(i,i+4).reduce((sum,x,j)=>sum+x*rotation.values[i-4+j],0)>=0,'adjacent quaternion signs must stay consistent');
 const gltf=await loadBytes(buildAnimatedGLB(bytes,p)),{pose}=animatedPose(gltf,p.name,1.125);
 assert.ok(Math.abs(pose[hip].position[0]-p.keys[0].pose[hip].position[0]-.04)<1e-5,'loop tail should interpolate back to first pose');
 p.keys.push({id:'explicit-final',time:1.5,pose:structuredClone(p.keys[1].pose)});
 const finalTracks=createAnimationTracks(p),translation=finalTracks.tracks.find(t=>t.bone===hip&&t.path==='translation');
 assert.ok(Math.abs(translation.values.at(-3)-p.keys[1].pose[hip].position[0])<1e-9,'explicit final key wins over loop closure');
});

test('source model and complete bone identity are checked before export',async()=>{
 const{bytes,project,hip}=await fixture('boy');
 assert.throws(()=>buildAnimatedGLB(bytes,{...project,modelId:'girl'}),/工程属于.*当前模型/);
 const missing=structuredClone(project);for(const key of missing.keys)delete key.pose[hip];assert.throws(()=>buildAnimatedGLB(bytes,missing),/缺少骨骼/);
 const unknown=structuredClone(project);for(const key of unknown.keys)key.pose['不存在的骨骼']=structuredClone(key.pose[hip]);assert.throws(()=>buildAnimatedGLB(bytes,unknown),/没有骨骼/);
 const duplicate=structuredClone(project);for(const key of duplicate.keys)key.pose['mixamorig:Hips']=structuredClone(key.pose[hip]);assert.throws(()=>buildAnimatedGLB(bytes,duplicate),/重复引用/);
 assert.throws(()=>buildAnimatedGLB(bytes.subarray(0,bytes.length-7),project),/长度不正确/);
 assert.throws(()=>buildAnimatedGLB(new Uint8Array(40),project),/GLB 2.0/);
});

test('JSON project import round-trips editable full poses and reports malformed or oversized files',async()=>{
 const{project}=await fixture('boy'),text=JSON.stringify(project),file={size:Buffer.byteLength(text),text:async()=>text},loaded=await importProjectFile(file);
 assert.equal(loaded.modelId,'boy');assert.equal(loaded.keys.length,2);assert.deepEqual(Object.keys(loaded.keys[0].pose),Object.keys(project.keys[0].pose));
 assert.notEqual(loaded,project);assert.equal(loaded.name,project.name);
 await assert.rejects(()=>importProjectFile({size:3,text:async()=>'{no'}),/有效的动画工程/);
 await assert.rejects(()=>importProjectFile({size:16*1024*1024+1,text:async()=>{throw new Error('must not read');}}),/16 MB/);
 await assert.rejects(()=>importProjectFile({size:1,text:async()=>{throw new Error('read failure');}}),/读取失败/);
});

test('export rejects imported key times that collapse in float32 instead of writing invalid samplers',async()=>{
 const{bytes,project}=await fixture('boy'),p=structuredClone(project);p.duration=120;p.keys[0].time=100;p.keys[1].time=100.000002;
 assert.throws(()=>buildAnimatedGLB(bytes,p),/关键帧的时间过于接近/);
});
