import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {STUDENT_ASSETS,createRiggedStudent} from '../dist/student-assets.js';
import {createStudyBook,bookSpineHeight,setDeskBookReach,TEXTBOOK} from '../dist/study-book58.js';
import {loadGeometry} from './gltf-geometry.mjs';

function sourceBook(){const book=new T.Group();book.position.set(0,bookSpineHeight(Math.PI/2),TEXTBOOK.seatDistance);book.rotation.x=Math.PI/2;for(const sign of [-1,1]){const leaf=new T.Group();leaf.rotation.y=sign*TEXTBOOK.leafYaw;book.add(leaf);const mesh=new T.Mesh(new T.BoxGeometry(TEXTBOOK.leafWidth,TEXTBOOK.leafHeight,.018));mesh.position.set(sign*TEXTBOOK.leafWidth/2,TEXTBOOK.leafHeight/2,0);leaf.add(mesh);}return book;}
function handSamples(actor){const out=[];actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const a=mesh.geometry.attributes;for(let i=0;i<a.skinIndex.count;i++){let sum=0,side='';for(let j=0;j<4;j++){const name=mesh.skeleton.bones[a.skinIndex.getComponent(i,j)].name;if(name.includes('Hand')){sum+=a.skinWeight.getComponent(i,j);side=name.includes('Left')?'Left':'Right';}}if(sum>.8)out.push({mesh,index:i,side});}});return out;}

test('an upright textbook stays supported on its own desk as the pupil turns',()=>{
 const pupil=new T.Group(),source=sourceBook(),scene=new T.Group();scene.add(pupil,source);
 const book=createStudyBook(pupil);book.setSource(source);
 const getPosition=source.getWorldPosition.bind(source);let deskReads=0;
 source.getWorldPosition=out=>{deskReads++;return getPosition(out);};
 for(let i=0;i<8;i++)book.update(false,1/60);
 assert.equal(deskReads,0);
 book.update(true,1/60,true);
 const holder=pupil.getObjectByName('held-study-book'),cover=holder.children[0].children[1];
 const centre=cover.localToWorld(new T.Vector3(TEXTBOOK.leafWidth/2,TEXTBOOK.leafHeight/2,.005));
 const normal=cover.getWorldDirection(new T.Vector3()),teacher=new T.Vector3(0,1.92,2.1);
 assert.ok(normal.dot(teacher.clone().sub(centre).normalize())>.40,'the teacher should see the cover face');
 const hinge=()=>holder.getWorldPosition(new T.Vector3());
 assert.ok(hinge().distanceTo(new T.Vector3(0,bookSpineHeight(TEXTBOOK.readingTilt),TEXTBOOK.seatDistance))<1e-6);
 const bottom=cover.localToWorld(new T.Vector3(TEXTBOOK.leafWidth,0,-.009));
 assert.ok(Math.abs(bottom.y-.875)<.002,'lower cover rests on the tabletop');
 const upper=cover.localToWorld(new T.Vector3(TEXTBOOK.leafWidth,TEXTBOOK.leafHeight,-.009));
 assert.ok(Math.abs(upper.y-bottom.y-TEXTBOOK.leafHeight*Math.cos(TEXTBOOK.readingTilt))<1e-6);
 source.position.x+=.2;pupil.rotation.y=.28;book.update(true,1/60);
 assert.ok(hinge().distanceTo(new T.Vector3(.2,bookSpineHeight(TEXTBOOK.readingTilt),TEXTBOOK.seatDistance))<1e-6);
 assert.ok(cover.getWorldDirection(new T.Vector3()).distanceTo(normal)<1e-6);
 for(let i=0;i<90;i++)book.update(false,1/60);
 assert.ok(deskReads>0);assert.equal(book.visible(),false);
 assert.ok(hinge().distanceTo(source.position)<.001,'the book returns to its actual desk');
 const raisedLocation=source.position.clone();
 for(const yaw of [0,Math.PI/2,-Math.PI/2,Math.PI]){
  source.rotation.set(Math.PI/2,yaw,0,'YXZ');
  const forward=new T.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const flatLocation=raisedLocation.clone().addScaledVector(forward,TEXTBOOK.flatSeatDistance-TEXTBOOK.seatDistance);
  for(let frame=0;frame<3;frame++)setDeskBookReach(source,false);
  assert.ok(source.position.distanceTo(flatLocation)<1e-6);
  book.update(true);
  assert.ok(hinge().distanceTo(raisedLocation.clone().setY(bookSpineHeight(TEXTBOOK.readingTilt)))<1e-6);
  setDeskBookReach(source,true);
  assert.ok(source.position.distanceTo(raisedLocation)<1e-6);
 }
 book.dispose();
});

for(const [variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: reading and writing cut on the first frame with both hands on the upright book`,async t=>{
 const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true}),book=sourceBook(),scene=new T.Group();scene.add(book,actor.group);actor.setStudyBook(book);actor.setMotion({seated:true});const samples=handSamples(actor);let time=0,maxStep=0,maxGap=0,lastHands=null,maxCut=0;
 for(const mood of ['resting','reading','writing','reading','listening']){
  actor.setMood(mood);
  for(let frame=0;frame<150;frame++){
   actor.update(time+=1/60);scene.updateMatrixWorld(true);const info=actor.diagnostics().studyBook,holder=actor.group.getObjectByName('held-study-book');
   const hands=['Left','Right'].map(side=>actor.bones[side+'Hand'].getWorldPosition(new T.Vector3()));if(lastHands){const step=Math.max(...hands.map((p,i)=>p.distanceTo(lastHands[i])));if(frame===0)maxCut=Math.max(maxCut,step);else maxStep=Math.max(maxStep,step);}lastHands=hands;
   assert.equal(info.blend,Number(mood==='reading'));assert.equal(info.contact,info.blend);
   assert.equal(actor.group.getObjectByName('held-writing-pencil').visible,mood==='writing');
   if(info.blend>.02)assert.equal(actor.group.getObjectByName('held-writing-pencil').visible,false,'writing begins with the book still in the air');
   if(frame%3)continue;
   const pages=[];holder.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.computeBoundingBox();pages.push({box:mesh.geometry.boundingBox,inv:mesh.matrixWorld.clone().invert()});}});
   const gap={Left:Infinity,Right:Infinity};for(const {mesh,index,side}of samples){const p=mesh.getVertexPosition(index,new T.Vector3()).applyMatrix4(mesh.matrixWorld);for(const page of pages)gap[side]=Math.min(gap[side],page.box.distanceToPoint(p.clone().applyMatrix4(page.inv)));}
   if(info.blend>.12&&info.contact===1)maxGap=Math.max(maxGap,gap.Left,gap.Right);
  }
 }
 assert.ok(maxCut>.050,'expected an immediate change at the mood boundary');
 assert.ok(maxStep<.045,`hand jumps ${maxStep} m in one 60 Hz frame`);
 assert.ok(maxGap<.025,`a hand separates from the moving book by ${maxGap} m`);
 // Minor desk overlap is allowed: preserve the book gesture instead of
 // raising elbows or shrinking the motion to satisfy furniture clearance.
 actor.setMood('reading');for(let i=0;i<100;i++)actor.update(time+=1/60);actor.setStudyBook(null);actor.setMood('resting');actor.update(time+=1/60);assert.equal(actor.studyBookVisible(),false,'old seat book remains after the source is removed');assert.equal(actor.group.getObjectByName('held-study-book').children.length,0);
 t.diagnostic(JSON.stringify({maxStep,maxGap}));actor.dispose();
});
