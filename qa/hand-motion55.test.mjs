import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../dist/vendor/three.module.js';
import {createDeskHands,FOOD_ITEM_KINDS} from '../dist/game-actors.js?v=campus-82';
import {createRiggedPalm,createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js?v=campus-82';
import {createRiggedTeacher} from '../dist/imported-actors.js?v=campus-82';
import {loadPropAssets,CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-82';
import {WHOLE_PALM_PROFILES} from '../dist/whole-palm-profiles54.js?v=campus-82';
import {createRoomVariants} from '../dist/room-variants.js?v=campus-82';
import {ClassroomRound} from '../dist/classroom-rules.js?v=campus-82';
import {TeacherRound} from '../dist/teacher-rules.js?v=campus-82';
import {OFFICE_CHAIRS} from '../dist/classroom-layout.js?v=campus-82';
import {campusScene} from './campus-geometry54-helpers.mjs';
import {loadGeometry} from './gltf-geometry.mjs';
import {propSurface,handSamplingRig} from './whole-palm-geometry54.mjs';
const V=(...a)=>new T.Vector3(...a),DT=1/60;
const [left,right,teacherLeft,teacherRight]=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb','teacher-hand-left-v1.glb','teacher-hand-right-v1.glb'].map(loadGeometry));
await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:{loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())}});
function make(teacher=false){return createDeskHands({createHand:(side,scale)=>{const h=createRiggedPalm(teacher?(side<0?teacherLeft:teacherRight):(side<0?left:right),side,scale);if(teacher)h.group.userData.characterRole='teacher';return h;}});}
const names={snack:'snack-packet',drink:'red-drink-can',burger:'layered-burger',banana:'curved-banana',garlic:'garlic-clove',gum:'bubblegum-wrapper',lunch:'teacher-lunchbox',ink:'ink-glass-bottle',smoke:'smoke-canister',flash:'flash-perforated-canister',bananaPeel:'banana-peel',phone:'handheld-phone'};
for(const [kind,fit]of Object.entries(WHOLE_PALM_PROFILES))test(`${kind}: every actual finger and palm skin stays outside the real prop throughout the food gesture`,()=>{
 const actor=make(),hand=actor.getHand('left'),sampling=handSamplingRig(hand,{samples:100000}),prop=actor.group.getObjectByName(names[kind]),surface=propSurface(prop);
 if(CLASSROOM_PROP_SOURCES[kind])assert.ok(prop.userData.propAsset,'silently tested a procedural fallback');
 const relaxed=['Index','Middle','Pinky'].map(f=>sampling.bones['LeftHand'+f+'2'].quaternion.clone());let time=0;for(let i=0;i<120;i++)actor.update(time+=DT,{action:kind,carrying:true,freeLook:true});
 const poses=FOOD_ITEM_KINDS.includes(kind)?[0,.5,1]:[0];
 for(const progress of poses){for(let f=0;f<60;f++)actor.update(time+=DT,{action:kind,carrying:true,holding:true,eating:true,progress,freeLook:true});actor.group.updateMatrixWorld(true);const inverse=prop.matrixWorld.clone().invert();
  for(const finger of ['Index','Middle','Pinky','Thumb','Palm','Ring']){let gap=Infinity,depth=0;const points=sampling.points(finger);assert.ok(points.length>100,`${finger} skin sampling missing`);for(const p of points){p.applyMatrix4(hand.group.matrixWorld).applyMatrix4(inverse);const r=surface.query(p),distance=r.distance;gap=Math.min(gap,distance);if(surface.bounds.containsPoint(p)){const votes=[V(.719,.403,.566).normalize(),V(-.431,.811,.395).normalize(),V(.301,-.527,.795).normalize()].filter(d=>surface.inside(p,d)).length;if(votes>=2)depth=Math.max(depth,distance);}}
   assert.ok(depth<.002,`${kind}/${finger}: real skin penetrates ${(depth*1000).toFixed(2)}mm at ${progress}`);
   if(!['Palm','Ring'].includes(finger))assert.ok(gap<.0055,`${kind}/${finger}: no wrapping contact (${(gap*1000).toFixed(2)}mm)`);
  }
 }
 for(const [i,finger]of ['Index','Middle','Pinky'].entries()){assert.ok(sampling.bones['LeftHand'+finger+'2'].quaternion.angleTo(relaxed[i])>.12,'actual source finger never closes');assert.ok(fit.profile[finger].slice(0,3).filter(a=>a>.30).length>=2,'only a rigid fingertip points at the object');assert.ok(fit.profile[finger].slice(0,3).reduce((a,b)=>a+b,0)>1.6,'the finger never wraps');}
 assert.deepEqual(prop.scale.toArray(),[1,1,1]);
});

test('effective eating pauses when looking up, release returns to carry and a new press restarts the lift',()=>{
 const h=make(),prop=h.group.getObjectByName('snack-packet');let time=0;const step=o=>h.update(time+=DT,{action:'snack',carrying:true,freeLook:true,...o});
 for(let i=0;i<120;i++)step({});const carry=prop.getWorldPosition(V());
 for(let i=0;i<90;i++)step({holding:true,eating:true,progress:i/180});assert.ok(prop.getWorldPosition(V()).distanceTo(carry)>.10);
 for(let i=0;i<90;i++)step({holding:true,eating:false,progress:.5});assert.ok(prop.getWorldPosition(V()).distanceTo(carry)<.002,'looking up continues eating');
 for(let i=0;i<60;i++)step({holding:false,eating:false,progress:0});assert.equal(h.getDebug().foodPhase,0);
 step({holding:true,eating:true,progress:0});assert.equal(h.getDebug().foodPhase,0);assert.ok(prop.getWorldPosition(V()).distanceTo(carry)<.002,'new press resumes the old chewing phase');
});

test('student and teacher palms support on table and keyboard; typing bends separate source finger joints',()=>{
 for(const teacher of [false,true])for(const computer of [false,true]){const h=make(teacher),anchor=new T.Group();anchor.add(h.group);let time=0;for(let i=0;i<120;i++)h.update(time+=DT,{seated:true,computer,typing:computer,freeLook:true});
  const hand=h.getHand('left'),rig=handSamplingRig(hand,{samples:100000}),rotations=[];
  for(let frame=0;frame<60;frame++){h.update(time+=DT,{seated:true,computer,typing:computer,freeLook:true});anchor.updateMatrixWorld(true);if(frame%10===0){let min=Infinity;for(const part of ['Index','Middle','Pinky','Thumb','Palm','Ring'])for(const p of rig.points(part))min=Math.min(min,p.applyMatrix4(hand.group.matrixWorld).y);const surface=(computer?.901:.87496)-1.43;assert.ok(min>=surface-.0003&&min<surface+.006,`${teacher?'teacher':'student'} ${computer?'keys':'table'}: skin at ${min}, expected ${surface}`);}rotations.push(rig.bones.LeftHandMiddle2.quaternion.clone());}
  if(computer)assert.ok(rotations.some(q=>q.angleTo(rotations[0])>.03),'typing only moves the whole hand');
 }
});

test('teacher hand extraction retains actual teacher texture bytes and every finger bone length',async()=>{
 const source=await loadGeometry('teacher-v2.glb'),sourceBones={};source.scene.traverse(o=>{if(o.isBone)sourceBones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
 async function imageHashes(file){const b=await readFile(new URL('../dist/assets/models/'+file,import.meta.url)),length=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+length)),binary=b.subarray(28+length);return j.images.map(image=>{const v=j.bufferViews[image.bufferView],offset=v.byteOffset||0;return createHash('sha256').update(binary.subarray(offset,offset+v.byteLength)).digest('hex');});}
 source.scene.updateMatrixWorld(true);teacherLeft.scene.updateMatrixWorld(true);teacherRight.scene.updateMatrixWorld(true);const texture=await imageHashes('teacher-v2.glb');for(const side of ['Left','Right']){assert.deepEqual(await imageHashes('teacher-hand-'+side.toLowerCase()+'-v1.glb'),texture);(side==='Left'?teacherLeft:teacherRight).scene.traverse(o=>{if(o.isBone&&o.name.includes('Hand')&&!o.name.endsWith('Hand')){const ref=sourceBones[o.name.replace(/^mixamorig[:_]?/,'')];assert.ok(ref);assert.ok(Math.abs(o.getWorldPosition(V()).distanceTo(o.parent.getWorldPosition(V()))-ref.getWorldPosition(V()).distanceTo(ref.parent.getWorldPosition(V())))<.00001,'teacher finger length was changed');}});}
});

test('look continues through sitting and restraint on actual student and teacher head bones',async()=>{
 const student=createRiggedStudent(await loadGeometry(STUDENT_ASSETS.boy.file+'.glb'),{variant:'boy',seated:true}),teacher=createRiggedTeacher(await loadGeometry('teacher-v2.glb'));let time=0;
 for(const restraint of ['free','bound','stunned']){student.setMotion({seated:true,restraint,lookYaw:1.2,lookPitch:.7});for(let i=0;i<90;i++){time+=DT;student.update(time);teacher.update(time,{phase:restraint==='stunned'?'stunned':'watching',lookYaw:1.2,lookPitch:.7});}assert.ok(Math.abs(student.diagnostics().headLook.yaw-1.2)<.001);assert.ok(Math.abs(teacher.diagnostics().headLook.pitch-.7)<.001);}
 student.dispose();teacher.dispose();
});


test('formal classroom typing alternates real finger contacts without entering keys, and office palms meet the desks',()=>{
 const scene=new T.Scene(),materials=[],mat=(color,options={})=>{const m=new T.MeshStandardMaterial({color,...options});materials.push(m);return m;},box=(m,p,s,r,parent)=>{const mesh=new T.Mesh(new T.BoxGeometry(...s),m);mesh.position.set(...p);if(r)mesh.rotation.set(...r);parent.add(mesh);return mesh;};
 const lab=createRoomVariants({scene,mat,box,rounded:(m,p,s,rad,r,g)=>box(m,p,s,r,g),texture:()=>new T.Texture(),bakeStatic:()=>{}}),round=new ClassroomRound({map:'computer',seed:2});round.start();lab.setMap('computer');lab.setSeats(round.seats);
 const p=round.player;assert.equal(round.startComputer(),true);round.computerApp('snake');round.hold(true);
 const actor=make(),anchor=new T.Group();anchor.position.set(p.x,1.43,p.z);anchor.rotation.y=p.seatYaw+Math.PI;scene.add(anchor);anchor.add(actor.group);
 const rigs=['left','right'].map((side,i)=>({hand:actor.getHand(side),rig:handSamplingRig(actor.getHand(side),{side:i?'Right':'Left',samples:100000})}));scene.updateMatrixWorld(true);const keyBoxes=[];
 lab.stations.get(p.seatId).traverse(o=>{const g=o.geometry?.parameters;if(g?.width===.035&&g?.height===.008)keyBoxes.push(new T.Box3().setFromObject(o,true));});assert.equal(keyBoxes.length,33);
 const gaps=rigs.map(()=>({Index:Infinity,Middle:Infinity,Pinky:Infinity}));
 for(let frame=0;frame<240;frame++){const snapshot=round.snapshot();actor.update(frame*DT,{seated:true,computer:snapshot.player.computerActive,typing:snapshot.holding,freeLook:true});if(frame<120||frame%6)continue;scene.updateMatrixWorld(true);
  rigs.forEach(({hand,rig},i)=>{for(const finger of ['Index','Middle','Pinky','Thumb','Palm','Ring'])for(const v of rig.points(finger)){const pad=v.pad;v.applyMatrix4(hand.group.matrixWorld);for(const b of keyBoxes){if(b.containsPoint(v))assert.ok(Math.min(v.x-b.min.x,b.max.x-v.x,v.y-b.min.y,b.max.y-v.y,v.z-b.min.z,b.max.z-v.z)<.0003,`hand ${i}/${finger} enters actual keycap`);if(!pad||!Object.hasOwn(gaps[i],finger))continue;const d=Math.hypot(Math.max(0,b.min.x-v.x,v.x-b.max.x),v.y-b.max.y,Math.max(0,b.min.z-v.z,v.z-b.max.z));gaps[i][finger]=Math.min(gaps[i][finger],d);}}});
 }
 for(const [i,parts]of gaps.entries()){for(const [finger,gap]of Object.entries(parts))assert.ok(gap<.010,`hand ${i}/${finger} leaves the key region by ${(gap*1000).toFixed(2)}mm`);assert.ok(Object.values(parts).filter(gap=>gap<.006).length>=2,`hand ${i} has no alternating key contacts`);}
 lab.dispose();scene.traverse(o=>o.geometry?.dispose());materials.forEach(m=>m.dispose());
 const campus=campusScene(),teacher=new TeacherRound({seed:3});teacher.start();try{for(const chair of OFFICE_CHAIRS){Object.assign(teacher.player,{x:chair.x,z:chair.z-.2,seated:false});assert.equal(teacher.sitOfficeChair(chair.id),'seated');const snapshot=teacher.snapshot(),hands=make(true),rig=handSamplingRig(hands.getHand('left'),{samples:100000}),anchor=new T.Group();anchor.position.set(snapshot.player.x,1.43,snapshot.player.z);anchor.rotation.y=Math.PI+snapshot.player.seatYaw;anchor.add(hands.group);
  for(let f=0;f<120;f++)hands.update(f*DT,{seated:snapshot.player.seated,office:snapshot.player.officeChair,freeLook:true});anchor.updateMatrixWorld(true);let nearest=Infinity;
  for(const part of ['Index','Middle','Pinky','Thumb','Palm','Ring'])for(const v of rig.points(part)){v.applyMatrix4(hands.getHand('left').group.matrixWorld);const hit=new T.Raycaster(v.clone().add(V(0,.01,0)),V(0,-1,0),0,.03).intersectObject(campus.scene,true).find(h=>!h.object.material.transparent);if(hit){const distance=v.y-hit.point.y;assert.ok(distance>-.0003,'teacher skin enters the actual office table');nearest=Math.min(nearest,distance);}}
  assert.ok(nearest<.007,'teacher palm floats above its actual office desk');}
 }finally{campus.dispose();}
});
