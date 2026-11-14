import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {STUDENT_ASSETS,createRiggedStudent} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';

function sourceBook(){const book=new T.Group();book.position.set(0,.88,.50);book.rotation.x=Math.PI/2;for(const sign of [-1,1]){const leaf=new T.Group();leaf.rotation.y=sign*.14;book.add(leaf);const mesh=new T.Mesh(new T.BoxGeometry(.335,.45,.008));mesh.position.set(sign*.1675,.225,0);leaf.add(mesh);}return book;}
function handSamples(actor){const out=[];actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const a=mesh.geometry.attributes;for(let i=0;i<a.skinIndex.count;i++){let sum=0,side='';for(let j=0;j<4;j++){const name=mesh.skeleton.bones[a.skinIndex.getComponent(i,j)].name;if(name.includes('Hand')){sum+=a.skinWeight.getComponent(i,j);side=name.includes('Left')?'Left':'Right';}}if(sum>.8)out.push({mesh,index:i,side});}});return out;}

for(const [variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: returning a book keeps both hands with it and delays writing until it rests on the desk`,async t=>{
 const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true}),book=sourceBook(),scene=new T.Group();scene.add(book,actor.group);actor.setStudyBook(book);actor.setMotion({seated:true});const samples=handSamples(actor);let time=0,maxStep=0,maxGap=0,lastHands=null;
 for(const mood of ['resting','reading','writing','reading','listening']){
  actor.setMood(mood);
  for(let frame=0;frame<150;frame++){
   actor.update(time+=1/60);scene.updateMatrixWorld(true);const info=actor.diagnostics().studyBook,holder=actor.group.getObjectByName('held-study-book');
   const hands=['Left','Right'].map(side=>actor.bones[side+'Hand'].getWorldPosition(new T.Vector3()));if(lastHands){const step=Math.max(...hands.map((p,i)=>p.distanceTo(lastHands[i])));maxStep=Math.max(maxStep,step);}lastHands=hands;
   if(info.blend>.02)assert.equal(actor.group.getObjectByName('held-writing-pencil').visible,false,'writing begins with the book still in the air');
   if(frame%3)continue;
   const pages=[];holder.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.computeBoundingBox();pages.push({box:mesh.geometry.boundingBox,inv:mesh.matrixWorld.clone().invert()});}});
   const gap={Left:Infinity,Right:Infinity};for(const {mesh,index,side}of samples){const p=mesh.getVertexPosition(index,new T.Vector3()).applyMatrix4(mesh.matrixWorld);for(const page of pages)gap[side]=Math.min(gap[side],page.box.distanceToPoint(p.clone().applyMatrix4(page.inv)));}
   if(info.blend>.12&&info.contact===1)maxGap=Math.max(maxGap,gap.Left,gap.Right);
  }
 }
 assert.ok(maxStep<.045,`hand jumps ${maxStep} m in one 60 Hz frame`);
 assert.ok(maxGap<.025,`a hand separates from the moving book by ${maxGap} m`);
 // Minor desk overlap is allowed: preserve the book gesture instead of
 // raising elbows or shrinking the motion to satisfy furniture clearance.
 actor.setMood('reading');for(let i=0;i<100;i++)actor.update(time+=1/60);actor.setStudyBook(null);actor.setMood('resting');actor.update(time+=1/60);assert.equal(actor.studyBookVisible(),false,'old seat book remains after the source is removed');assert.equal(actor.group.getObjectByName('held-study-book').children.length,0);
 t.diagnostic(JSON.stringify({maxStep,maxGap}));actor.dispose();
});
