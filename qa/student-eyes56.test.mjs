import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {STUDENT_EYE_REGIONS,createStudentEyes} from '../dist/student-eyes56.js';
import {useCharacterBaseColor,setCharacterNight} from '../dist/character-materials.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
const load=variant=>loadGeometry(STUDENT_ASSETS[variant].file+'.glb');
const v=(x,y,z)=>new T.Vector3(x,y,z);
for(const variant of Object.keys(STUDENT_EYE_REGIONS))test(variant+' has two fixed spheres behind a continuous white shell',async()=>{
 const asset=await load(variant);asset.scene.updateMatrixWorld(true);useCharacterBaseColor(asset.scene);
 let mesh;asset.scene.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
 const source=mesh.geometry,oldUV=source.attributes.uv.array,originalTriangles=source.index.count;
 const eyes=createStudentEyes(asset.scene,{variant}),balls=asset.scene.getObjectByName('student-eye-interiors'),wall=asset.scene.getObjectByName('student-sclera-shell');
 assert.equal(balls.count,2);assert.equal(wall.skeleton,mesh.skeleton);assert.equal(wall.material.transparent,false,'the near eye must occlude the far eye in profile');
 assert.equal(wall.material.depthWrite,true,'adjacent skin triangles must respect the visible eye surface');
 assert.equal(mesh.geometry.index.count+wall.geometry.index.count,originalTriangles);
 assert.equal(wall.geometry.attributes.position,mesh.geometry.attributes.position);
 assert.deepEqual(mesh.geometry.attributes.uv.array,oldUV);
 asset.scene.updateMatrixWorld(true);
 for(let i=0;i<2;i++){
  const matrix=new T.Matrix4();balls.getMatrixAt(i,matrix);
  const center=v().setFromMatrixPosition(matrix),radius=v().setFromMatrixScale(matrix).x;
  const hits=new T.Raycaster(v(center.x,center.y,1),v(0,0,-1)).intersectObject(wall,false);
  assert.ok(hits.length);assert.ok(hits[0].point.z-center.z-radius>.05,'the actual front of the dark sphere is at least 5 cm behind the white wall');
  assert.ok(center.z<STUDENT_EYE_REGIONS[variant][i].center[2],'pupil centre is in the rear half');
 }
 eyes.dispose();eyes.dispose();assert.equal(mesh.geometry,source);assert.ok(!asset.scene.getObjectByName(wall.name));assert.ok(!balls.parent);
});
test('animated heads and different viewing angles never move the pupils within their sockets',async()=>{
 const a=createRiggedStudent(await load('boy'),{variant:'boy',seated:false});
 try{
  const balls=a.group.getObjectByName('student-eye-interiors'),wall=a.group.getObjectByName('student-sclera-shell');
  assert.equal(balls.parent,a.head);const matrices=balls.instanceMatrix.array.slice();
  for(let i=0;i<64;i++){
   a.setMotion({seated:false,speed:1,lookYaw:Math.sin(i/9)*.7,lookPitch:.15});a.update(i/20);
   const cam=new T.PerspectiveCamera();cam.position.set(Math.sin(i/9),1.4,1);cam.updateMatrixWorld();wall.onBeforeRender(null,null,cam);
   assert.deepEqual(balls.instanceMatrix.array,matrices);
  }
  const day=wall.material;setCharacterNight(a.group,true);assert.ok(wall.material.isMeshLambertMaterial&&balls.material.isMeshLambertMaterial);
  assert.equal(wall.material.onBeforeCompile,day.onBeforeCompile);
 }finally{a.dispose();}
});
test('the spectacled student keeps the original opaque lenses',async()=>{
 const asset=await load('glasses');const eyes=createStudentEyes(asset.scene,{variant:'glasses'});
 assert.equal(eyes.diagnostics().reason,'opaque-original-lenses');assert.equal(asset.scene.getObjectByName('student-eye-interiors'),undefined);eyes.dispose();
});
