import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {STUDENT_ASSETS,createRiggedStudent} from '../dist/student-assets.js';
import {fingerPadSurfaceDistance} from './prop-contact-helpers.mjs';
import {handFrame} from '../dist/hand-motion.js';
import {loadGeometry} from './gltf-geometry.mjs';
const V=(...x)=>new T.Vector3(...x);
function skinUpdate(group){group.updateMatrixWorld(true);group.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}
function handVertices(group,side){const samples=[];group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const{skinIndex,skinWeight}=mesh.geometry.attributes;for(let i=0;i<skinIndex.count;i++){let sum=0,strong=0,joint='';for(let k=0;k<4;k++){const name=mesh.skeleton.bones[skinIndex.getComponent(i,k)]?.name.replace(/^mixamorig[:_]?/,'');const w=skinWeight.getComponent(i,k);if(name?.startsWith(side+'Hand'))sum+=w;if(w>strong){strong=w;joint=name;}}if(sum>.5)samples.push({mesh,index:i,joint});}});return samples;}
function point(sample){return sample.mesh.getVertexPosition(sample.index,V()).applyMatrix4(sample.mesh.matrixWorld);}
function checkSurface(samples,role,pose){let min=Infinity,over=0;for(const s of samples){const p=point(s);if(Math.abs(p.x)<=.6&&p.z>=.325&&p.z<=1.115){min=Math.min(min,p.y);over++;}}assert.ok(over>10,`${role} ${pose}: test did not sample actual skin above the desk`);assert.ok(min>=.878,`${role} ${pose}: actual hand skin penetrates desk, Y=${min}`);}
for(const [role,{file}]of Object.entries(STUDENT_ASSETS))test(`${role}: seated skin clears the desktop and an actual finger grip holds the writing pencil to the page`,async()=>{
 const gltf=await loadGeometry(file+'.glb');assert.ok(gltf.parser.json.asset.extras.characters40.writeContact42,`${role}: missing calibrated writing pose`);
 const actor=createRiggedStudent(gltf,{variant:role,seated:true}),samples={Left:handVertices(actor.group,'Left'),Right:handVertices(actor.group,'Right')},boneLengths=Object.fromEntries(Object.entries(actor.bones).map(([n,b])=>[n,b.position.length()]));let t=0;
 for(const mood of ['resting','writing','snack']){
  actor.setMood(mood);actor.setMotion({seated:true,carrying:mood==='snack'});for(let f=0;f<90;f++){actor.update(t+=1/60);if(f%6)continue;skinUpdate(actor.group);for(const side of mood==='snack'?['Right']:['Left','Right'])checkSurface(samples[side],role,mood+' transition');for(const name of ['RightForeArm','RightHand'])assert.ok(Math.abs(actor.bones[name].position.length()-boneLengths[name])<.00002,`${role} ${name}: transition stretched the arm instead of bending its joints`);}
  for(let f=0;f<120;f++){actor.update(t+=1/60);if(f%6)continue;skinUpdate(actor.group);for(const side of mood==='snack'?['Right']:['Left','Right'])checkSurface(samples[side],role,mood);
   for(const[n,b]of Object.entries(actor.bones))if(n.startsWith('LeftHand')||n.startsWith('RightHand'))assert.ok(Math.abs(b.position.length()-boneLengths[n])<.00002,`${role} ${n}: contact stretched a finger segment`);
   if(mood==='resting')for(const side of ['Left','Right']){const frame=handFrame(actor.bones,side),wrist=actor.bones[side+'Hand'].getWorldPosition(V());assert.ok(frame.normal.y>.98&&Math.abs(frame.along.y)<.12,`${role} ${side}: resting palm is raised sideways instead of lying relaxed`);assert.ok(wrist.y<.96,`${role} ${side}: wrist was lifted toward the face to avoid the desk`);assert.ok(samples[side].every(s=>point(s).y<wrist.y+.075),`${role} ${side}: resting fingers/thumb form an upright claw`);}
   const pencil=actor.group.getObjectByName('held-writing-pencil');assert.equal(pencil.visible,mood==='writing');if(mood!=='writing')continue;
   const nib=pencil.localToWorld(V(0,-.129,0)),pageHeight=.88+.005/Math.cos(.14)+Math.abs(nib.x)*Math.tan(.14);
   assert.ok(nib.z>.44&&nib.z<.89&&Math.abs(nib.x)<.31,`${role}: pencil misses the actual folded-book footprint ${nib.toArray()}`);
   assert.ok(Math.abs(nib.y-pageHeight)<.003,`${role}: pencil tip floats above or penetrates the page by ${nib.y-pageHeight} m`);
   for(const finger of ['Index','Thumb']){const gap=fingerPadSurfaceDistance(actor.group.getObjectByName('school-writing-pen'),actor,finger,'Right');assert.ok(gap<.003,`${role}: actual ${finger} skin does not contact the shared pen surface (${gap} m)`);}
  }
 }
 actor.dispose();
});
for(const [role,{file}]of Object.entries(STUDENT_ASSETS))test(`${role}: charged throwing uses the same long-finger palm plane as idle and held props`,async()=>{
 const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant:role,seated:false});actor.setMood('smoke');actor.setMotion({seated:false,carrying:true,throwProgress:1});for(let i=0;i<120;i++)actor.update(i/60);skinUpdate(actor.group);
 const actual=handFrame(actor.bones,'Left'),along=V(.04,.96,.28).normalize(),across=V(1,0,0);across.addScaledVector(along,-across.dot(along)).normalize();const dorsal=across.clone().cross(along).normalize();
 assert.ok(actual.along.dot(along)>.999,`${role}: throwing fingers aim away from the authored lift`);
 assert.ok(actual.normal.dot(dorsal)>.999,`${role}: thumb-base axis rolled the thrown prop off the real palm plane`);actor.dispose();
});
