import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {propSurface} from './whole-palm-geometry54.mjs';
import {ordinaryStudyState} from '../dist/npc-study58.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {createSoloRound} from '../dist/solo-round.js';
import {CampusRoom} from '../server/room-simulation.js';
import {loadGeometry} from './gltf-geometry.mjs';
const V=(...a)=>new T.Vector3(...a);
function bookSource(){const book=new T.Group();book.position.set(0,.88,.5);book.rotation.x=Math.PI/2;for(const sign of [-1,1]){const leaf=new T.Group();leaf.rotation.y=sign*.14;book.add(leaf);const page=new T.Mesh(new T.BoxGeometry(.335,.45,.008),new T.MeshStandardMaterial());page.position.set(sign*.1675,.225,0);page.visible=false;page.userData.rigidInstanceSource=true;leaf.add(page);}return book;}
function bodySamples(actor){const samples=[];actor.group.updateMatrixWorld(true);actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const {skinIndex,skinWeight}=mesh.geometry.attributes;for(let i=0;i<skinIndex.count;i++){let max=-1,j=0;for(let k=0;k<4;k++)if(skinWeight.getComponent(i,k)>max){max=skinWeight.getComponent(i,k);j=skinIndex.getComponent(i,k);}const name=mesh.skeleton.bones[j].name;if(/Hand|Head/.test(name))samples.push({mesh,index:i,head:name.includes('Head')});}});return samples;}
for(const [variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: real reading hands support original book, computer-idle never writes`,async t=>{
 const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true}),source=bookSource(),samples=bodySamples(actor),lengths=Object.entries(actor.bones).filter(([name])=>/^(Left|Right)(ForeArm|Hand)/.test(name)).map(([,b])=>[b,b.position.clone()]);actor.setStudyBook(source);actor.setMood('reading');actor.setMotion({seated:true,carrying:false,lookPitch:.08});let time=0,maxDeskDepth=0,maxBookDepth=0,minHandGap=Infinity;
 for(let f=0;f<240;f++){actor.update(time+=1/60);if(f<150||f%15)continue;actor.group.updateMatrixWorld(true);const updated=new Set(),pages=[];actor.group.getObjectByName('held-study-book').traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();pages.push({mesh:o,box:o.geometry.boundingBox,inverse:o.matrixWorld.clone().invert()});assert.equal(o.visible,true);}});assert.equal(pages.length,2);assert.equal(actor.studyBookVisible(),true);assert.equal(actor.group.getObjectByName('held-writing-pencil').visible,false);
  for(const {mesh,index,head}of samples){if(!updated.has(mesh.skeleton)){updated.add(mesh.skeleton);mesh.skeleton.update();}const p=mesh.getVertexPosition(index,V()).applyMatrix4(mesh.matrixWorld);if(!head&&Math.abs(p.x)<.55&&p.z>.3557&&p.z<1.12)maxDeskDepth=Math.max(maxDeskDepth,.875-p.y);for(const {box,inverse}of pages){const q=p.clone().applyMatrix4(inverse);if(!head)minHandGap=Math.min(minHandGap,box.distanceToPoint(q));if(box.containsPoint(q))maxBookDepth=Math.max(maxBookDepth,Math.min(q.x-box.min.x,box.max.x-q.x,q.y-box.min.y,box.max.y-q.y,q.z-box.min.z,box.max.z-q.z));}}
  for(const [bone,p]of lengths)assert.ok(bone.position.distanceTo(p)<.00002,'reading stretches bone');
 }
 assert.ok(maxDeskDepth<.001,`reading hand skin enters desk ${maxDeskDepth}`);assert.ok(maxBookDepth<.002,`reading skin enters pages ${maxBookDepth}`);assert.ok(minHandGap<.008,`book floats away from actual fingers ${minHandGap}`);
 actor.setMood('computer-idle');for(let n=0;n<180;n++){actor.update(time+=1/60);assert.equal(actor.group.getObjectByName('held-writing-pencil').visible,false,'computer idle shows a pencil while changing pose');}assert.equal(actor.studyBookVisible(),false);assert.ok(actor.diagnostics().weights.Write<1e-8);assert.ok(actor.diagnostics().weights.Sit>.9999);
 actor.setMood('computer');for(let n=0;n<180;n++)actor.update(time+=1/60);assert.ok(actor.diagnostics().gestures.typingTips);actor.setMood('computer-idle');for(let n=0;n<180;n++)actor.update(time+=1/60);assert.equal(actor.diagnostics().gestures.typingTips,null);
 t.diagnostic(JSON.stringify({maxDeskDepth,maxBookDepth,minHandGap}));actor.dispose();
});

test('ordinary study schedule alternates three useful actions without items or score and looks toward teacher',()=>{
 for(const id of [0,7,29]){const actor={id,x:0,z:0,seatYaw:0},moods=new Set();for(let elapsed=0;elapsed<75;elapsed+=.1){const s=ordinaryStudyState(actor,{x:3,z:2},elapsed,42);moods.add(s.mood);assert.equal(s.holding,false);assert.equal(s.action,null);assert.equal(s._computerActive,false);if(s.mood==='listening')assert.ok(s.yaw>0&&s.yaw<=.72);const pc=ordinaryStudyState(actor,{x:3,z:2},elapsed,42,true);assert.ok(['computer','computer-idle'].includes(pc.mood));assert.equal(pc.studyBookHeld,false);assert.equal(pc._computerApp,'photoshop');}assert.deepEqual([...moods].sort(),['listening','reading','writing']);}
});

for(const map of ['classroom','computer'])test(`${map}: solo/network ordinary NPCs never use food, including initial and arrival paths`,()=>{
 const rooms=[createSoloRound({map,seed:73}),createSoloRound({map,seed:73,role:'teacher'})];const network=new CampusRoom({code:'580058',seed:73,map}),host=network.join({rolePreference:'teacher'}),guest=network.join({rolePreference:'student'});network.begin(host);
 for(const r of rooms){r.start();r._advanceTeacher=()=>{};r._perceive=()=>{};}
 const inspect=(snapshot)=>{for(const s of snapshot.students.filter(s=>!s.isTeammate&&!s.isPlayer)){if(!s.seated)continue;assert.equal(s.holding,false);if(map==='computer'){assert.ok(['computer','computer-idle'].includes(s.mood),s.mood);assert.equal(s.studyBookHeld,false);}else assert.ok(['listening','reading','writing'].includes(s.mood),s.mood);assert.equal(Object.values(s.completed).reduce((a,b)=>a+b,0),0);}};
 for(let f=0;f<700;f++){for(const r of rooms){r.step(.1);inspect(r.snapshot());}network.tick(.1);inspect(network.snapshot(guest));}
});

for(const [variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: shared thick pen clears complete skin and larger strokes stay on actual page`,async t=>{
 const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant}),samples=bodySamples(actor).filter(s=>!s.head),pen=actor.group.getObjectByName('school-writing-pen'),nibs=[];actor.setMood('writing');let time=0,maxDepth=0;
 for(let f=0;f<360;f++){actor.update(time+=1/60);if(f<180)continue;actor.group.updateMatrixWorld(true);const nib=pen.localToWorld(V(0,-.0875,0));nibs.push(nib);const page=.88+.005/Math.cos(.14)+Math.abs(nib.x)*Math.tan(.14);assert.ok(Math.abs(nib.y-page)<.003,'actual shared pen nib left page');if(f%60)continue;const surface=propSurface(pen),inverse=pen.matrixWorld.clone().invert(),updated=new Set();for(const {mesh,index}of samples){if(!updated.has(mesh.skeleton)){mesh.skeleton.update();updated.add(mesh.skeleton);}const p=mesh.getVertexPosition(index,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);maxDepth=Math.max(maxDepth,-surface.query(p).signed);}}
 const span=Math.max(...nibs.map(p=>p.x))-Math.min(...nibs.map(p=>p.x));assert.ok(span>.035,'writing barely moves across paper');assert.ok(maxDepth<.002,`thick school pen enters real skin ${maxDepth}`);assert.deepEqual(pen.scale.toArray(),[1,1,1]);
 actor.setMood('pen');actor.setMotion({seated:true,carrying:true,heldAction:'pen',penTwirling:true});for(let f=0;f<200;f++)actor.update(time+=1/60);for(let f=0;f<120;f++){actor.update(time+=1/60);actor.group.updateMatrixWorld(true);const axis=V(0,1,0).transformDirection(pen.matrixWorld);assert.ok(Math.abs(axis.y)<.0001,'pen twirls vertically instead of flat above desk');}
 t.diagnostic(JSON.stringify({maxDepth,strokeSpan:span}));actor.dispose();
});
