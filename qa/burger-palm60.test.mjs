import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createDeskHands} from '../dist/game-actors.js?v=campus-79';
import {createRiggedPalm} from '../dist/student-assets.js?v=campus-79';
import {loadPropAssets,CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-79';
import {createSoloRound} from '../dist/solo-round.js?v=campus-79';
import {drawerHandTarget} from '../dist/drawer-hand-target58.js?v=campus-79';
import {firstPersonEyeHeight} from '../dist/first-person-view.js?v=campus-79';
import {handFrame} from '../dist/hand-motion.js?v=campus-79';
import {loadGeometry} from './gltf-geometry.mjs';
import {propSurface} from './whole-palm-geometry54.mjs';

const DT=1/60,CONTACT=.0055,PENETRATION=.002;
const fingers=['Index','Middle','Pinky','Thumb'];
const [left,right]=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
const props=await loadPropAssets({burger:CLASSROOM_PROP_SOURCES.burger},{loader:{loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())}});
assert.deepEqual(props.failed,[],'the real burger GLB must load; a procedural fallback is not a grip regression');

// Label the source anatomy before any runtime grip or food gesture. Rebuild
// area-weighted normals from the actual neutral skinned triangles: imported
// undeformed mesh normals cannot safely be compared with skinned positions.
function neutralPalmFaces(source){
 const bones={},meshes=[];source.scene.updateMatrixWorld(true);
 source.scene.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;if(o.isSkinnedMesh)meshes.push(o);});
 const dorsal=handFrame(bones,'Left').normal,wrist=bones.LeftHand.getWorldPosition(new T.Vector3());
 assert.ok(dorsal.z>.99,'the source hand +Z must be its anatomical back');
 return meshes.map(mesh=>{
  mesh.skeleton.update();const geometry=mesh.geometry,index=geometry.index;
  const points=Array.from({length:geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));
  const normals=points.map(()=>new T.Vector3());
  for(let i=0;i<(index?.count??points.length);i+=3){
   const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),[a,b,c]=ids.map(k=>points[k]);
   const normal=new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a));
   for(const k of ids)normals[k].add(normal);
  }
  return{geometry,palmar:points.map((point,i)=>normals[i].normalize().dot(dorsal)<-.25&&point.clone().sub(wrist).dot(dorsal)<0)};
 });
}
const neutralFaces=neutralPalmFaces(left);

// Classify every original vertex independently of the shared sampling helper.
// In particular, a Ring-weighted vertex must never stand in for palm contact.
function fullSkin(hand){
 const rows=[],meshes=[],counts=Object.fromEntries(['Palm',...fingers,'Ring','Other'].map(part=>[part,0]));
 hand.group.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const neutral=neutralFaces[meshes.length];assert.equal(mesh.geometry,neutral.geometry,'neutral labels must use the exact source mesh');
  meshes.push(mesh);
  const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let i=0;i<position.count;i++){
   let weight=-Infinity,name='';
   for(let k=0;k<4;k++)if(skinWeight.getComponent(i,k)>weight){
    weight=skinWeight.getComponent(i,k);
    name=mesh.skeleton.bones[skinIndex.getComponent(i,k)].name.replace(/^mixamorig[:_]?/,'');
   }
   const part=name==='LeftHand'?'Palm':[...fingers,'Ring'].find(f=>name.startsWith('LeftHand'+f))||'Other';
   rows.push({mesh,i,part,name,palmar:part==='Palm'&&neutral.palmar[i]});counts[part]++;
  }
 });
 for(const part of ['Palm',...fingers,'Ring'])assert.ok(counts[part]>100,`${part}: full real skin is missing`);
 assert.ok(rows.filter(row=>row.part==='Palm').every(row=>row.name==='LeftHand'));
 counts.Palmar=rows.filter(row=>row.palmar).length;
 assert.ok(counts.Palmar>=4&&counts.Palmar<counts.Palm,'palm contact must exclude the anatomical back and side-facing skin');
 assert.equal(rows.length,meshes.reduce((sum,mesh)=>sum+mesh.geometry.attributes.position.count,0));
 const palm=meshes[0].skeleton.bones.find(b=>b.name.replace(/^mixamorig[:_]?/,'')==='LeftHand');
 assert.ok(palm);
 return{rows,meshes,counts,palm};
}

function immutableSource(hand,prop){
 const bones=[],skins=[],geometry=[],propChildren=[],scale=hand.group.scale.clone();
 hand.group.traverse(o=>{
  if(o.isBone)bones.push([o,o.position.clone(),o.scale.clone()]);
  if(o.isSkinnedMesh)skins.push([o,o.bindMatrix.clone(),o.bindMode,o.skeleton.boneInverses.map(m=>m.clone()),o.skeleton.bones.slice()]);
 });
 for(const root of [hand.group,prop])root.traverse(o=>{
  if(o.geometry)for(const name of ['position','skinIndex','skinWeight']){
   const attribute=o.geometry.attributes[name];if(attribute)geometry.push([attribute,attribute.array.slice()]);
  }
 });
 prop.traverse(o=>{if(o!==prop){o.updateMatrix();propChildren.push([o,o.matrix.clone()]);}});
 return()=>{
  assert.deepEqual(prop.scale.toArray(),[1,1,1],'burger must retain its original size');
  assert.ok(hand.group.scale.distanceTo(scale)<1e-12,'hand scale changed to fake contact');
  for(const [bone,position,boneScale]of bones){assert.ok(bone.position.distanceTo(position)<1e-10,`${bone.name}: source bone length changed`);assert.ok(bone.scale.distanceTo(boneScale)<1e-12,`${bone.name}: source bone scaled`);}
  for(const [mesh,bind,mode,boneInverses,links]of skins){
   assert.deepEqual(mesh.bindMatrix.elements,bind.elements);assert.equal(mesh.bindMode,mode);
   // Attached skins recompute this inverse as their view anchor moves.
   const inverse=(mode==='attached'?mesh.matrixWorld:mesh.bindMatrix).clone().invert();
   assert.ok(mesh.bindMatrixInverse.elements.every((v,i)=>Math.abs(v-inverse.elements[i])<1e-10),'skin binding no longer follows its actual mesh transform');
   assert.equal(mesh.skeleton.bones.length,links.length);
   links.forEach((bone,i)=>{assert.equal(mesh.skeleton.bones[i],bone);assert.deepEqual(mesh.skeleton.boneInverses[i].elements,boneInverses[i].elements);});
  }
  for(const [attribute,values]of geometry)assert.deepEqual(attribute.array,values,'source mesh or skin weights were edited');
  for(const [child,matrix]of propChildren){child.updateMatrix();assert.deepEqual(child.matrix.elements,matrix.elements,'burger source transform changed');}
 };
}

for(const open of [true,false])test(`seed73 held burger: true palm and four fingers retain contact, with complete skin outside the GLB (${open?'open':'closed'} drawer)`,t=>{
 // Match firstperson58-review.html?mode=held, including its actual seed stock.
 const round=createSoloRound({role:'student',seed:73,target:120});round.start();round._advanceTeacher=()=>{};
 for(const student of round.students)student._decisionAt=Infinity;
 round.setLook(round.player.seatYaw||0,.90);round.setBookRaised(false);
 assert.equal(round.toggleDrawer(),true);assert.equal(round.takeSlot(0),true);
 assert.equal(round.snapshot().selected,'burger');
 if(!open){
  // A held item cannot close its drawer directly. Use the production stand/
  // return-to-seat path, which preserves the burger and closes the drawer.
  const seat=round.player.seatId;assert.equal(round.interact(),'stood');assert.equal(round.interact(seat),'seated');
  round.setLook(round.player.seatYaw||0,.90);
 }
 assert.equal(round.snapshot().drawer.open,open);
 const hands=createDeskHands({createHand:(side,scale)=>createRiggedPalm(side<0?left:right,side,scale)});
 const hand=hands.getHand('left'),burger=hands.group.getObjectByName('layered-burger');
 assert.match(burger.userData.propAsset,/burger-v1\.glb/);
 const skin=fullSkin(hand),unchanged=immutableSource(hand,burger),surface=propSurface(burger);
 const anchor=new T.Group();anchor.add(hands.group);
 let time=0,drawerAmount=0,binding=null,maxBindingDrift=0;
 const results=[];
 function advance(frames){
  for(let f=0;f<frames;f++){
   round.step(DT);time+=DT;const s=round.snapshot(),p=s.player,eyeHeight=firstPersonEyeHeight(p,'student');
   drawerAmount=T.MathUtils.damp(drawerAmount,s.drawer.open?1:0,s.drawer.open?12:18,DT);
   anchor.position.set(p.x,eyeHeight,p.z);anchor.rotation.y=p.seatYaw+Math.PI;
   hands.update(time,{action:s.selected,carrying:s.drawer.drawnSlot!==null,holding:s.holding,eating:p.eating,progress:s.actionProgress,seated:p.seated,freeLook:true,viewPitch:p.pitch,eyeHeight,bookAmount:s.books.find(b=>b.id===p.seatId)?.amount||0,drawer:drawerHandTarget({player:p,drawer:s.drawer,seats:s.seats,map:s.map,amount:drawerAmount})});
   anchor.updateMatrixWorld(true);
   if(binding){const relative=skin.palm.matrixWorld.clone().invert().multiply(burger.matrixWorld);for(let k=0;k<16;k++)maxBindingDrift=Math.max(maxBindingDrift,Math.abs(relative.elements[k]-binding.elements[k]));}
  }
 }
 function measure(label){
  const inverse=burger.matrixWorld.clone().invert(),gaps=Object.fromEntries(['Palm',...fingers,'Ring'].map(part=>[part,Infinity]));
  const tipGaps=Object.fromEntries(fingers.map(part=>[part,Infinity])),palmContacts=[];let palmarGap=Infinity;
  let depth=0,deepestPart='';
  for(const mesh of skin.meshes)mesh.skeleton.update();
  for(const {mesh,i,part,name,palmar}of skin.rows){
   const point=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
   const hit=surface.query(point);if(Object.hasOwn(gaps,part))gaps[part]=Math.min(gaps[part],hit.distance);
   if(Object.hasOwn(tipGaps,part)&&name.endsWith('3'))tipGaps[part]=Math.min(tipGaps[part],hit.distance);
   if(palmar){palmarGap=Math.min(palmarGap,hit.distance);if(hit.distance<=CONTACT)palmContacts.push(point);}
   if(hit.signed<0&&hit.distance>depth){depth=hit.distance;deepestPart=part;}
  }
  let palmSpan=0;for(let i=0;i<palmContacts.length;i++)for(let j=0;j<i;j++)palmSpan=Math.max(palmSpan,palmContacts[i].distanceTo(palmContacts[j]));
  results.push({label,gaps,tipGaps,palmarGap,depth,deepestPart,palmContactCount:palmContacts.length,palmSpan});unchanged();
 }
 advance(120);assert.equal(hands.getDebug().extension,1);assert.equal(burger.visible,true);
 binding=skin.palm.matrixWorld.clone().invert().multiply(burger.matrixWorld);measure('held');
 assert.equal(round.hold(true),true);
 let elapsed=0;
 for(const frame of [1,18,54,108,162]){advance(frame-elapsed);elapsed=frame;assert.equal(round.snapshot().player.eating,true);measure(`eating ${(frame/60).toFixed(2)}s`);}
 assert.equal(round.snapshot().drawer.drawnSlot,0);assert.ok(maxBindingDrift<1e-6,`burger slipped relative to the hand by ${maxBindingDrift}`);
 const mm=record=>Object.fromEntries(Object.entries(record).map(([part,value])=>[part,Number((value*1000).toFixed(3))]));
 t.diagnostic(JSON.stringify({drawer:open?'open':'closed',vertices:skin.counts,poses:results.map(({label,gaps,tipGaps,palmarGap,depth,deepestPart,palmContactCount,palmSpan})=>({label,gapsMm:mm(gaps),tipGapsMm:mm(tipGaps),palmarGapMm:Number((palmarGap*1000).toFixed(3)),penetrationMm:Number((depth*1000).toFixed(3)),deepestPart,palmarContactCount:palmContactCount,palmarSpanMm:Number((palmSpan*1000).toFixed(3))}))}));
 for(const {label,gaps,palmarGap,depth,deepestPart,palmContactCount,palmSpan}of results){
  assert.ok(gaps.Palm<=CONTACT,`${label}: true LeftHand palm is ${(gaps.Palm*1000).toFixed(2)}mm from burger; Ring skin is not palm contact (limit 5.5mm)`);
  assert.ok(palmarGap<=CONTACT,`${label}: palm-facing skin is ${(palmarGap*1000).toFixed(2)}mm from burger; hand-back contact cannot support the food`);
  assert.ok(palmContactCount>=4&&palmSpan>=.005,`${label}: palm-facing contact must cover at least 4 original vertices over 5mm, got ${palmContactCount} / ${(palmSpan*1000).toFixed(2)}mm`);
  for(const finger of fingers)assert.ok(gaps[finger]<=CONTACT,`${label}/${finger}: wrapping contact is ${(gaps[finger]*1000).toFixed(2)}mm (limit 5.5mm)`);
  assert.ok(depth<=PENETRATION,`${label}/${deepestPart}: complete original skin penetrates ${(depth*1000).toFixed(2)}mm (limit 2mm; Ring included)`);
 }
});
