import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/addons/loaders/GLTFLoader.js';
import {createRiggedTeacher} from '../dist/imported-actors.js';

// Node has no image decoder. Retain the actual skin, weights and clips, replacing
// only materials for this geometry/animation regression check. Visual QA is separate.
async function loadGeometry(file){
  const bytes=await readFile(new URL('../dist/assets/models/'+file,import.meta.url));
  const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length));
  json.materials=[{pbrMetallicRoughness:{metallicFactor:0,roughnessFactor:.78}}];
  for(const mesh of json.meshes)for(const primitive of mesh.primitives)primitive.material=0;
  delete json.images;delete json.textures;delete json.samplers;
  json.extensionsUsed=[];json.extensionsRequired=[];
  const raw=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(padded);
  const bin=bytes.subarray(20+length),out=Buffer.alloc(20+padded.length+bin.length);
  out.write('glTF');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);
  padded.copy(out,20);bin.copy(out,20+padded.length);
  return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'');
}
async function actor(){return createRiggedTeacher(await loadGeometry('teacher-v1.glb'));}
test('imported teacher has five playable clips and grounded finite skinned geometry',async()=>{
  const a=await actor();assert.deepEqual(a.diagnostics().clips.sort(),['Card','Idle','Throw','Walk','Write']);
  for(const phase of ['watching','board','patrol']){
    for(let i=0;i<120;i++){
      a.update(i/60,{phase,walking:phase==='patrol'?1:0});
      a.group.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
      const bounds=new T.Box3().setFromObject(a.group,true);
      assert.ok(bounds.min.y>-.07,`Feet below ground: ${bounds.min.y}`);
      assert.ok(bounds.max.y<2.20,`Skin stretched above head: ${bounds.max.y}`);
      assert.ok(bounds.getSize(new T.Vector3()).x<1.5,'Exploded skin');
    }
  }
});
test('clip changes remain continuous and move the actual hand to the board',async()=>{
  const a=await actor(),hand=a.getHand('right'),p=new T.Vector3();
  for(let i=0;i<60;i++)a.update(i/60,{phase:'watching'});
  const start=hand.getWorldPosition(new T.Vector3());let previous=start.clone(),maxStep=0;
  for(let i=60;i<180;i++){
    a.update(i/60,{phase:'board'});hand.getWorldPosition(p);maxStep=Math.max(maxStep,p.distanceTo(previous));previous.copy(p);
  }
  assert.ok(maxStep<.14,`Hand snapped ${maxStep} m`);
  assert.ok(p.y>start.y+.25,'Writing clip did not raise actual hand');
  assert.ok(p.z>start.z+.12,'Writing hand did not reach forward');
  const root=a.group.position.clone();a.setGesture({card:false,cast:.85});a.update(3,{phase:'watching'});
  assert.equal(a.group.position.distanceTo(root),0,'Animation moved navigation root');
  assert.ok(a.diagnostics().weights.Throw>0,'Throw clip not blended');
});

test('replacement desk fits the existing tabletop and moves only its independent drawer',async()=>{
  const gltf=await loadGeometry('desk-v1.glb'),body=gltf.scene.getObjectByName('DeskBody'),drawer=gltf.scene.getObjectByName('DeskDrawer');
  assert.ok(body&&drawer,'Missing independently movable nodes');
  const bounds=new T.Box3().setFromObject(body,true);
  assert.ok(Math.abs(bounds.max.y-.875)<.005,'Table height no longer matches book/hand anchors');
  assert.ok(Math.abs(bounds.getSize(new T.Vector3()).x-1.2)<.01,'Desk no longer fits shared collision layout');
  const before=new T.Box3().setFromObject(drawer,true);
  assert.ok(before.min.y>.63&&before.min.y<.66,'Drawer floor no longer matches items');
  drawer.position.z-=.24;gltf.scene.updateMatrixWorld(true);
  const after=new T.Box3().setFromObject(drawer,true),fixed=new T.Box3().setFromObject(body,true);
  assert.ok(Math.abs(after.min.z-before.min.z+.24)<.0001,'Drawer opened in the wrong direction');
  assert.ok(fixed.min.distanceTo(bounds.min)<.0001&&fixed.max.distanceTo(bounds.max)<.0001,'Opening drawer moved the desk body');
});
