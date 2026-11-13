import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {createStudentEyes,STUDENT_EYE_REGIONS,studentEyeGaze,clampStudentEyeLook,studentEyeVertex,STUDENT_PUPIL_GEOMETRY} from '../dist/student-eyes56.js?v=campus-77';
import {useCharacterBaseColor,setCharacterNight} from '../dist/character-materials.js?v=campus-77';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js?v=campus-77';
const files=Object.fromEntries(Object.entries(STUDENT_ASSETS).map(([key,data])=>[key,data.file+'.glb']));
function euler(geometry){const edges=new Set(),index=geometry.index.array,used=new Set(index);for(let i=0;i<index.length;i+=3)for(const [a,b] of [[index[i],index[i+1]],[index[i+1],index[i+2]],[index[i+2],index[i]]])edges.add(a<b?a+','+b:b+','+a);return used.size-edges.size+index.length/3;}
function meshes(model){const out=[];model.traverse(mesh=>{if(mesh.isSkinnedMesh)out.push(mesh);});return out;}
function shaderOf(material){const shader={uniforms:{},vertexShader:T.ShaderLib[material.isMeshLambertMaterial?'lambert':'basic'].vertexShader,fragmentShader:T.ShaderLib[material.isMeshLambertMaterial?'lambert':'basic'].fragmentShader};material.onBeforeCompile(shader);return shader;}
test('eye glances hold steady and move smoothly, with a bounded short inter-eye delay',()=>{
 for(const seed of [0,1,4,17]){let held=0,moved=0,offset=0;for(let t=0;t<20;t+=1/60){const a=studentEyeGaze(t,seed),b=studentEyeGaze(t+1/60,seed),delta=Math.max(...a.map((v,i)=>Math.abs(v-b[i])));assert.ok(Math.abs(a[0])<=.78&&Math.abs(a[1])<=.62);assert.ok(delta<.16);if(delta<1e-8)held++;else moved++;offset=Math.max(offset,Math.abs(a[0]-a[2]));}assert.ok(held>1000);assert.ok(moved>30);assert.ok(offset>.001&&offset<=1.16);}
});
for(const variant of ['boy','girl','ponytail'])test(`${variant}: real inset pupil changes physical depth while preserving body, bone weights and original UVs`,async()=>{
 const gltf=await loadGeometry(files[variant]);gltf.scene.updateMatrixWorld(true);useCharacterBaseColor(gltf.scene);const mesh=meshes(gltf.scene)[0],source=mesh.geometry,oldUV=new Float32Array(source.attributes.uv.array),oldPositions=new Float32Array(source.attributes.position.array);
 const eyes=createStudentEyes(gltf.scene,{variant,seed:4});assert.ok(eyes.diagnostics().vertices>100);assert.notEqual(mesh.geometry,source);assert.deepEqual(source.attributes.position.array,oldPositions);assert.deepEqual(mesh.geometry.attributes.uv.array.slice(0,oldUV.length),oldUV);
 const repairedPositions=new Float32Array(mesh.geometry.attributes.position.array);
 let repaired=0,maxRepair=0;const p0=new T.Vector3(),p1=new T.Vector3();
 for(let i=0;i<source.attributes.position.count;i++){
  p0.fromBufferAttribute(source.attributes.position,i).applyMatrix4(mesh.matrixWorld);p1.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld);
  const delta=p0.distanceTo(p1);if(delta<1e-7)continue;repaired++;maxRepair=Math.max(maxRepair,delta);
  assert.ok(Math.abs(p0.x-p1.x)<1e-7&&Math.abs(p0.y-p1.y)<1e-7,'only pupil depth changes');
  assert.ok(STUDENT_EYE_REGIONS[variant].some(r=>Math.hypot(p0.x-r.center[0],p0.y-r.center[1])<.047&&p0.z>r.front[0]),'repair stays inside original eye');
 }
 assert.ok(repaired>5&&repaired<100);assert.ok(maxRepair>.003&&maxRepair<.012);
 assert.equal(euler(mesh.geometry),euler(source),'local subdivision must not introduce a topological hole or hanging seam');assert.ok(mesh.geometry.index.count>source.index.count);assert.ok(mesh.geometry.index.count-source.index.count<12000,'only a small eye area is refined');
 assert.deepEqual(mesh.geometry.attributes.skinWeight.array.slice(0,source.attributes.skinWeight.array.length),source.attributes.skinWeight.array);
 const joints=mesh.geometry.attributes.skinIndex,skin=mesh.geometry.attributes.skinWeight;
 for(let i=0;i<skin.count;i++){assert.ok(Math.abs(skin.getX(i)+skin.getY(i)+skin.getZ(i)+skin.getW(i)-1)<1e-5);for(let j=0;j<4;j++)assert.ok(Number.isInteger(joints.array[i*4+j]));}
 const shader=shaderOf(mesh.material);assert.ok(shader.fragmentShader.includes('studentEyeSurface'));assert.ok(shader.vertexShader.includes('transformed=(studentEyeLocalFromRest*vec4(studentEyeRest+studentEyeInset,1.)).xyz;'));assert.ok(shader.vertexShader.indexOf('studentEyeInset=')<shader.vertexShader.indexOf('#include <skinning_vertex>'));
 for(const look of [{yaw:-.5,pitch:0},{yaw:.5,pitch:0},{yaw:0,pitch:-.3},{yaw:0,pitch:.3}]){
  eyes.update(4,look);assert.deepEqual(eyes.diagnostics().gaze,[look.yaw,look.pitch,look.yaw,look.pitch]);assert.deepEqual(mesh.geometry.attributes.position.array,repairedPositions);
 }
 const weights=mesh.geometry.attributes.studentEyeWeights,positions=mesh.geometry.attributes.position;let changed=0;
 for(let i=0;i<positions.count;i++){const p=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);if(weights.getX(i)+weights.getY(i)>0){changed++;assert.ok(p.y>1.30&&p.y<1.53&&p.z>.17,'body/face outside eye mask');}}
 assert.ok(changed<positions.count*.4);
 // Sample actual vertices with the same displacement evaluation used by GLSL.
 // At each gaze a dense black cup is physically behind the original white
 // surface, never a raised dot. Off-eye vertices remain exactly in place.
 for(const [yaw,pitch] of [[0,0],[-.78,0],[.78,0],[0,-.62],[0,.62],clampStudentEyeLook(-.78,-.62),clampStudentEyeLook(.78,.62)]){
  let recessed=0,maxDepth=0;const projected=[];
  for(let i=0;i<positions.count;i++){
   const base=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);let result=base.clone();
   for(const r of STUDENT_EYE_REGIONS[variant])result.add(studentEyeVertex(base,r,variant,yaw,pitch).sub(base));
   const d=base.distanceTo(result);if(d>1e-6){recessed++;maxDepth=Math.max(maxDepth,d);assert.ok(result.z<base.z,'every affected point moves inside, never protrudes');projected.push(result.x);}
   if(weights.getX(i)+weights.getY(i)===0)assert.ok(d<1e-9,'body cannot be displaced');
  }
  assert.ok(recessed>10,`at least ten vertices form the physical cup at ${yaw},${pitch}: ${recessed}`);
  assert.ok(maxDepth>STUDENT_PUPIL_GEOMETRY[variant].depth*.9);assert.ok(maxDepth<=STUDENT_PUPIL_GEOMETRY[variant].depth+1e-7);
 }
 let disposed=0;mesh.material.addEventListener('dispose',()=>disposed++);eyes.dispose();eyes.dispose();assert.equal(mesh.geometry,source);assert.equal(disposed,1);
});
test('free gaze stays inside the sclera at all directional limits',()=>{
 for(const yaw of [-20,-.78,0,.78,20])for(const pitch of [-20,-.62,0,.62,20]){
  const [x,y]=clampStudentEyeLook(yaw,pitch);assert.ok(Math.abs(x)<=.78&&Math.abs(y)<=.62);
  // Largest pupil cap plus its direction must remain within the paintable
  // sclera. This also prevents showing the old baked dot at a limit.
  assert.ok(Math.hypot(Math.sin(x)*Math.cos(y),Math.sin(y))+.225<.96);
 }
});
test('each real actor has independent eyes and day/night shaders keep the same animated uniforms',async()=>{
 const a=createRiggedStudent(await loadGeometry(files.boy),{variant:'boy',seed:4,seated:false}),b=createRiggedStudent(await loadGeometry(files.boy),{variant:'boy',seed:21,seated:false});
 try{a.setMotion({seated:false,speed:0});b.setMotion({seated:false,speed:0});a.update(4);b.update(4);const mesh=meshes(a.group)[0],day=mesh.material,shader=shaderOf(day);assert.ok(shader.fragmentShader.includes('studentEyeSurface'));assert.ok(shader.vertexShader.indexOf('studentEyeRest=')<shader.vertexShader.indexOf('#include <skinning_vertex>'));assert.ok(shader.fragmentShader.indexOf('diffuseColor.rgb=studentEyeSurface')>=0&&shader.fragmentShader.indexOf('diffuseColor.rgb=studentEyeSurface')<shader.fragmentShader.indexOf('float face='),'ink and eyelids must cover pupils');assert.notDeepEqual(a.diagnostics().eyes.gaze,b.diagnostics().eyes.gaze);setCharacterNight(a.group,true);const night=mesh.material,nightShader=shaderOf(night);assert.ok(night.isMeshLambertMaterial);assert.equal(nightShader.uniforms.studentEyeGaze,shader.uniforms.studentEyeGaze);a.update(8);assert.deepEqual(nightShader.uniforms.studentEyeGaze.value.toArray(),a.diagnostics().eyes.gaze);setCharacterNight(a.group,false);assert.equal(mesh.material,day);let nightDisposed=0;night.addEventListener('dispose',()=>nightDisposed++);a.dispose();assert.equal(nightDisposed,1);}finally{b.dispose();}
});
test('opaque glasses retain their source geometry, texture and frames unchanged',async()=>{
 const gltf=await loadGeometry(files.glasses);useCharacterBaseColor(gltf.scene);const mesh=meshes(gltf.scene)[0],geometry=mesh.geometry,material=mesh.material,eyes=createStudentEyes(gltf.scene,{variant:'glasses'});eyes.update(4);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.equal(eyes.diagnostics().enabled,false);assert.equal(eyes.diagnostics().reason,'opaque-original-lenses');eyes.dispose();
});
