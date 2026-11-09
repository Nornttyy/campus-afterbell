import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGeometry} from './gltf-geometry.mjs';
import {STUDENT_ASSETS,createRiggedStudent} from '../dist/student-assets.js';
import {loadPropAssets,CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-58';
import {fingerPadSurfaceDistance} from './prop-contact-helpers.mjs';
await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:{loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())}});
// The pen now uses the right-hand Write contact, covered by seated-hand-clearance.test.mjs.
const names={banana:'curved-banana',bananaPeel:'banana-peel',garlic:'garlic-clove',gum:'bubblegum-wrapper',lunch:'teacher-lunchbox'};
for(const[variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: new food touches the imported fingers and disappears under restraint`,async()=>{
 for(const[kind,name]of Object.entries(names)){
  const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true});actor.setMood(kind);actor.setMotion({carrying:true});for(let i=0;i<180;i++)actor.update(i/60);actor.group.updateMatrixWorld(true);actor.group.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});const prop=actor.group.getObjectByName(name);assert.ok(prop?.visible,kind+' must be held');assert.equal(prop.parent,actor.getHand('left'));
  for(const finger of ['Index','Thumb'])assert.ok(fingerPadSurfaceDistance(prop,actor,finger)<.012,`${variant}/${kind}/${finger} visible distal-skin grip gap`);
  assert.deepEqual(prop.scale.toArray(),[1,1,1]);const position=prop.position.clone(),rotation=prop.quaternion.clone();for(let i=180;i<210;i++){actor.update(i/60);assert.ok(prop.position.distanceTo(position)<1e-8);assert.ok(prop.quaternion.angleTo(rotation)<1e-7);}
  actor.setMotion({carrying:false,restraint:'bound'});actor.update(4);assert.equal(prop.visible,false);actor.dispose();
 }
});

test('a remote student can carry a banana without eating, then start and stop the use gesture',async()=>{
 const actor=createRiggedStudent(await loadGeometry(STUDENT_ASSETS.boy.file+'.glb'),{variant:'boy',seated:true});
 actor.setMood('writing');actor.setMotion({carrying:true,heldAction:'banana',using:false});for(let i=0;i<180;i++)actor.update(i/60);
 const prop=actor.group.getObjectByName(names.banana);assert.ok(prop?.visible);const anchor=actor.getHand('left'),still=anchor.position.clone();let idleMotion=0;
 for(let i=180;i<240;i++){actor.update(i/60);idleMotion=Math.max(idleMotion,anchor.position.distanceTo(still));}assert.ok(idleMotion<.002,`idle carried food must not cycle to mouth: ${idleMotion}`);
 actor.setMood('banana');actor.setMotion({carrying:true,heldAction:'banana',using:true});let useMotion=0;for(let i=240;i<360;i++){actor.update(i/60);useMotion=Math.max(useMotion,anchor.position.distanceTo(still));}assert.ok(useMotion>.015,'actual use must move the hand');assert.equal(prop.visible,true);
 actor.setMood('writing');actor.setMotion({carrying:true,heldAction:'banana',using:false});for(let i=360;i<480;i++)actor.update(i/60);assert.ok(anchor.position.distanceTo(still)<.002,'releasing use settles back into carry pose');
 actor.setMotion({carrying:false,heldAction:null,using:false});for(let i=480;i<540;i++)actor.update(i/60);assert.equal(prop.visible,false);actor.dispose();
});
