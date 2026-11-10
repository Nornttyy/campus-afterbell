import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {createStudentEyes,STUDENT_EYE_REGIONS,studentEyeGaze} from '../dist/student-eyes56.js?v=campus-59c';
import {useCharacterBaseColor,setCharacterNight} from '../dist/character-materials.js?v=campus-59c';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js?v=campus-59c';
const files=Object.fromEntries(Object.entries(STUDENT_ASSETS).map(([key,data])=>[key,data.file+'.glb']));
function meshes(model){const out=[];model.traverse(mesh=>{if(mesh.isSkinnedMesh)out.push(mesh);});return out;}
function shaderOf(material){const shader={uniforms:{},vertexShader:T.ShaderLib[material.isMeshLambertMaterial?'lambert':'basic'].vertexShader,fragmentShader:T.ShaderLib[material.isMeshLambertMaterial?'lambert':'basic'].fragmentShader};material.onBeforeCompile(shader);return shader;}
test('eye glances hold steady and move smoothly, with a bounded short inter-eye delay',()=>{
 for(const seed of [0,1,4,17]){let held=0,moved=0,offset=0;for(let t=0;t<20;t+=1/60){const a=studentEyeGaze(t,seed),b=studentEyeGaze(t+1/60,seed),delta=Math.max(...a.map((v,i)=>Math.abs(v-b[i])));assert.ok(Math.abs(a[0])<=.10&&Math.abs(a[1])<=.04);assert.ok(delta<.031);if(delta<1e-8)held++;else moved++;offset=Math.max(offset,Math.abs(a[0]-a[2]));}assert.ok(held>1000);assert.ok(moved>30);assert.ok(offset>.001&&offset<.14);}
});
for(const variant of ['boy','girl','ponytail'])test(`${variant}: real eye-only deformation preserves face, UV, body, and shared source`,async()=>{
 const gltf=await loadGeometry(files[variant]);gltf.scene.updateMatrixWorld(true);useCharacterBaseColor(gltf.scene);const mesh=meshes(gltf.scene)[0],source=mesh.geometry,oldUV=new Float32Array(source.attributes.uv.array),oldPositions=new Float32Array(source.attributes.position.array);
 const eyes=createStudentEyes(gltf.scene,{variant,seed:4});assert.ok(eyes.diagnostics().vertices>100);assert.notEqual(mesh.geometry,source);assert.deepEqual(source.attributes.position.array,oldPositions);assert.deepEqual(mesh.geometry.attributes.uv.array,oldUV);
 const region=STUDENT_EYE_REGIONS[variant],weights=mesh.geometry.attributes.studentEyeWeights,positions=mesh.geometry.attributes.position,rest=[],moved=[];const yaw=[.10,-.10],pitch=[.04,-.04];let maximum=0,changed=0;
 for(let i=0;i<positions.count;i++){const p=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld),q=p.clone();rest.push(p);for(let eye=0;eye<2;eye++){const weight=weights.getComponent(i,eye);assert.ok(weight>=0&&weight<=1);if(weight){assert.ok(p.y>1.30&&p.y<1.53&&p.z>.17);const c=new T.Vector3(...region[eye].center),delta=p.clone().sub(c),rotated=delta.clone().applyEuler(new T.Euler(pitch[eye],yaw[eye],0,'YXZ'));q.addScaledVector(rotated.sub(delta),weight);}}moved.push(q);const distance=p.distanceTo(q);if(distance>0)changed++;maximum=Math.max(maximum,distance);}
 assert.ok(maximum>.004&&maximum<.014,`bounded visible motion ${maximum}`);assert.ok(changed<positions.count*.07,`eye patch only: ${changed}/${positions.count}`);
 // Check every actual source triangle edge: the blended socket may not tear,
 // invert a tiny triangle, or stretch into the skin when the eye reaches a limit.
 const ix=mesh.geometry.index;let worst=1;for(let i=0;i<ix.count;i+=3)for(let k=0;k<3;k++){const a=ix.getX(i+k),b=ix.getX(i+(k+1)%3);if(weights.getX(a)+weights.getY(a)+weights.getX(b)+weights.getY(b)===0)continue;const before=rest[a].distanceTo(rest[b]);if(before<.00001)continue;const after=moved[a].distanceTo(moved[b]);worst=Math.max(worst,after/before,before/Math.max(after,1e-8));}assert.ok(worst<1.40,`socket edge strain ${worst.toFixed(3)}`);
 let disposed=0;mesh.material.addEventListener('dispose',()=>disposed++);eyes.dispose();eyes.dispose();assert.equal(mesh.geometry,source);assert.equal(disposed,1);
});
test('each real actor has independent eyes and day/night shaders keep the same animated uniforms',async()=>{
 const a=createRiggedStudent(await loadGeometry(files.boy),{variant:'boy',seed:4,seated:false}),b=createRiggedStudent(await loadGeometry(files.boy),{variant:'boy',seed:21,seated:false});
 try{a.setMotion({seated:false,speed:0});b.setMotion({seated:false,speed:0});a.update(4);b.update(4);const mesh=meshes(a.group)[0],day=mesh.material,shader=shaderOf(day);assert.ok(shader.vertexShader.includes('studentEyeRotation'));assert.ok(shader.vertexShader.indexOf('studentEyeMoved')<shader.vertexShader.indexOf('#include <skinning_vertex>'));assert.notDeepEqual(a.diagnostics().eyes.gaze,b.diagnostics().eyes.gaze);setCharacterNight(a.group,true);const night=mesh.material,nightShader=shaderOf(night);assert.ok(night.isMeshLambertMaterial);assert.equal(nightShader.uniforms.studentEyeGaze,shader.uniforms.studentEyeGaze);a.update(8);assert.deepEqual(nightShader.uniforms.studentEyeGaze.value.toArray(),a.diagnostics().eyes.gaze);setCharacterNight(a.group,false);assert.equal(mesh.material,day);let nightDisposed=0;night.addEventListener('dispose',()=>nightDisposed++);a.dispose();assert.equal(nightDisposed,1);}finally{b.dispose();}
});
test('opaque glasses retain their source geometry, texture and frames unchanged',async()=>{
 const gltf=await loadGeometry(files.glasses);useCharacterBaseColor(gltf.scene);const mesh=meshes(gltf.scene)[0],geometry=mesh.geometry,material=mesh.material,eyes=createStudentEyes(gltf.scene,{variant:'glasses'});eyes.update(4);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.equal(eyes.diagnostics().enabled,false);assert.equal(eyes.diagnostics().reason,'opaque-original-lenses');eyes.dispose();
});
