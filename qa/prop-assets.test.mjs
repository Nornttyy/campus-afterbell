import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {CLASSROOM_PROP_SOURCES,loadPropAssets,clonePropAsset,propContact,restDeskItem} from '../dist/prop-assets.js?v=campus-67';
import {createDeskItem,createDeskHands,DESK_ITEM_KINDS} from '../dist/game-actors.js?v=campus-67';
import {createRiggedPalm} from '../dist/student-assets.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const bounds=o=>{o.updateMatrixWorld(true);return new T.Box3().setFromObject(o,true);};
const close=(actual,expected,tolerance,label)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: ${actual}, expected ${expected} ± ${tolerance}`);
const propFiles=Object.fromEntries(Object.entries(CLASSROOM_PROP_SOURCES).map(([kind,url])=>[kind,new URL(url,'https://local.test/dist/').pathname.split('/').pop()]));
const filenames=[...Object.values(propFiles),'desk-v2.glb','chair-v2.glb'];
const assetGeometries=new Map(await Promise.all(filenames.map(async file=>[file,await loadGeometry(file)])));
const assetLoader={async loadAsync(url){const file=new URL(url).pathname.split('/').pop();const gltf=assetGeometries.get(file);if(!gltf)throw new Error('Missing test asset '+file);return gltf;}};

function meshes(object){const found=[];object.traverse(o=>{if(o.isMesh)found.push(o);});return found;}
function localSnapshots(object){return meshes(object).map(m=>({geometry:m.geometry,positions:m.geometry.attributes.position.array.slice(),uv:m.geometry.attributes.uv?.array.slice()}));}
function assertUnchanged(saved){for(const row of saved){assert.deepEqual(row.geometry.attributes.position.array,row.positions,'gripping deformed source positions');if(row.uv)assert.deepEqual(row.geometry.attributes.uv.array,row.uv,'gripping changed source UVs');}}
async function glbStructure(file){
 const bytes=await readFile(new URL('../dist/assets/models/'+file,import.meta.url));
 assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength));
 const binHeader=20+jsonLength;assert.equal(bytes.readUInt32LE(binHeader+4),0x004e4942);return{bytes,json,binOffset:binHeader+8};
}

for(const file of filenames)test(`${file}: shipping GLB has static metre-scale mesh, usable UVs and real embedded PBR images`,async()=>{
 const {bytes,json,binOffset}=await glbStructure(file);assert.equal(json.skins?.length||0,0);assert.equal(json.animations?.length||0,0);
 const primitives=json.meshes.flatMap(mesh=>mesh.primitives);
 const triangles=primitives.reduce((n,p)=>n+(p.indices===undefined?json.accessors[p.attributes.POSITION].count:json.accessors[p.indices].count)/3,0);
 assert.ok(triangles>1000&&triangles<30000,`${file}: unexpected delivery triangle budget ${triangles}`);
 const textured=primitives.map(p=>json.materials[p.material]).filter(m=>m.pbrMetallicRoughness?.baseColorTexture);
 assert.ok(textured.length>0,'source atlas was replaced by flat materials');
 for(const material of new Set(textured)){
  const channels=[material.pbrMetallicRoughness.baseColorTexture,material.normalTexture,material.pbrMetallicRoughness.metallicRoughnessTexture];
  // New supplied Tripo files do not all contain normal/roughness maps. Preserve
  // their actual channels; the older PBR set must still contain all three.
  for(const texture of (file.endsWith('-v67.glb')?channels.filter(Boolean):channels)){
   assert.ok(texture,'source PBR channel missing');const img=json.images[json.textures[texture.index].source];assert.ok(img&&!img.uri,'image should be embedded');
   const view=json.bufferViews[img.bufferView];assert.ok(view.byteLength>1024,'placeholder image used');assert.ok(binOffset+(view.byteOffset||0)+view.byteLength<=bytes.length,'image points outside GLB');
   const prefix=bytes.subarray(binOffset+(view.byteOffset||0),binOffset+(view.byteOffset||0)+8);
   assert.ok((img.mimeType==='image/jpeg'&&prefix[0]===255&&prefix[1]===216)||(img.mimeType==='image/png'&&prefix.toString('hex')==='89504e470d0a1a0a'),'invalid embedded image');
  }
 }
 const scene=assetGeometries.get(file).scene,box=bounds(scene),size=box.getSize(V());
 assert.ok(size.toArray().every(n=>n>.01&&n<1.4),'model is empty, flat or exported at source scale');
 for(const mesh of meshes(scene)){
  const {position,uv}=mesh.geometry.attributes;assert.ok(position.count>0&&uv?.count===position.count,'UVs were lost by geometry batching');
  assert.ok([...position.array,...uv.array].every(Number.isFinite),'non-finite position or UV');
 }
});

test('imported prop clones share immutable GPU resources but keep independent transforms and userdata',async()=>{
 const result=await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:assetLoader});assert.deepEqual(new Set(result.loaded),new Set(Object.keys(propFiles)));assert.deepEqual(result.failed,[]);
 for(const kind of Object.keys(propFiles)){
  const a=createDeskItem(kind),b=createDeskItem(kind);assert.ok(a.userData.propAsset?.includes(propFiles[kind]));assert.notEqual(a,b);
  const am=meshes(a),bm=meshes(b);assert.equal(am.length,bm.length);for(let i=0;i<am.length;i++){assert.notEqual(am[i],bm[i]);assert.equal(am[i].geometry,bm[i].geometry);assert.equal(am[i].material,bm[i].material);}
  const original=bounds(b).clone();a.position.set(3,2,1);a.rotation.set(.4,.6,.8);a.userData.contactFit.center[0]+=1;
  assert.ok(bounds(b).equals(original),'another drawer or hand clone moved');assert.notEqual(a.userData.contactFit.center[0],b.userData.contactFit.center[0],'fit data leaked between clones');
 }
 assert.equal(createDeskItem('ink').userData.throwableKind,'ink');
});

test('source prop proportions survive contact fitting and animated palm attachment',async()=>{
 await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:assetLoader});
 const [left,right]=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
 const h=createDeskHands({createHand:(side,scale)=>createRiggedPalm(side<0?left:right,side,scale)});let time=0;
 for(const kind of Object.keys(propFiles)){
  const prop=h.group.getObjectsByProperty('type','Group').find(o=>o.userData.propAsset?.includes('/'+propFiles[kind]));assert.ok(prop,kind+' missing in held view');
  const saved=localSnapshots(prop),hand=h.getHand('left').group.getObjectByName('mixamorigLeftHand');let relative=null;
  for(let i=0;i<140;i++){
   h.update(time+=1/60,{action:kind,carrying:true,holding:i>60,progress:(i%90)/90,viewPitch:Math.sin(time)*.65});h.group.updateMatrixWorld(true);
   assert.ok(prop.matrixWorld.elements.every(Number.isFinite));assert.deepEqual(prop.scale.toArray(),[1,1,1]);
   if(prop.visible){const m=hand.matrixWorld.clone().invert().multiply(prop.matrixWorld);if(relative&&kind!=='pen')assert.ok(m.elements.every((value,j)=>Math.abs(value-relative.elements[j])<.0001),kind+' slides in palm');else relative=m;}
  }
  assert.ok(relative&&prop.visible,kind+' never held '+JSON.stringify(h.getDebug()));assertUnchanged(saved);
  const standalone=createDeskItem(kind),size=bounds(standalone).getSize(V()),origin=V(),contact=propContact(standalone,origin);
  assert.deepEqual(origin.toArray(),[0,0,0],'fitting mutated the reusable authored contact');assert.ok(bounds(standalone).containsPoint(contact),'centre contact escaped the actual mesh bounds');
  const grip=propContact(standalone,V(-.025,-.020,.018));assert.ok(bounds(standalone).clone().expandByScalar(.004).containsPoint(grip),'mapped contact is outside imported prop');
  assert.ok(size.x<.25&&size.y<.25&&size.z<.24,'source prop no longer fits a palm');
 }
});

test('every item rests on the real open drawer floor after arbitrary grip transforms, without rescaling',async()=>{
 await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:assetLoader});
 const floor=.659;
 for(const kind of DESK_ITEM_KINDS)for(const index of [0,1,2]){
  const prop=createDeskItem(kind),saved=localSnapshots(prop),slot=new T.Group();slot.position.set((index-1)*.28,.680,-.16);
  // Return from holding starts with a non-drawer location; the caller restores
  // the drawer orientation before settling its actual rotated geometry.
  prop.position.set(0,1.3,0);prop.rotation.set(['burger','lunch'].includes(kind)?0:-Math.PI/2,0,index===1?.04:index===0?-.07:.08);
  const rotation=prop.quaternion.clone();restDeskItem(prop,floor-slot.position.y);slot.add(prop);const box=bounds(slot);
  close(box.min.y,floor+.003,.00001,`${kind}/${index} drawer contact`);assert.ok(box.max.y<.815,`${kind} protrudes through table (${box.max.y})`);
  assert.ok(box.min.x>-.48&&box.max.x<.48,`${kind} hits side wall`);assert.deepEqual(prop.scale.toArray(),[1,1,1]);assert.ok(prop.quaternion.angleTo(rotation)<1e-7);assertUnchanged(saved);
 }
});

test('prepared furniture has independent identity roots, hollow moving drawer and correctly sized seat',()=>{
 const desk=assetGeometries.get('desk-v2.glb').scene.clone(true),chair=assetGeometries.get('chair-v2.glb').scene.clone(true);
 const body=desk.getObjectByName('DeskBody'),drawer=desk.getObjectByName('DeskDrawer'),seat=chair.getObjectByName('ChairBody');assert.ok(body&&drawer&&seat);
 for(const node of [body,drawer,seat]){assert.deepEqual(node.position.toArray(),[0,0,0]);assert.deepEqual(node.scale.toArray(),[1,1,1]);close(node.quaternion.angleTo(new T.Quaternion()),0,1e-7,node.name+' rotation');}
 const bodyBox=bounds(body);close(bodyBox.max.y,.875,.002,'desktop height');close(bodyBox.getSize(V()).x,1.20,.006,'desktop width');
 const cast=(objects,x,z)=>{objects.forEach(o=>o.updateMatrixWorld(true));return new T.Raycaster(V(x,.79,z),V(0,-1,0),0,.3).intersectObjects(objects,true);};
 const inside=cast([drawer],0,0)[0];assert.ok(inside,'drawer has no bottom');close(inside.point.y,.659,.004,'hollow drawer floor');
 // At its rear, the open drawer must uncover air below the top, not leave a
 // second fixed tray behind. This catches the closed source shell surviving.
 const closed=cast([body,drawer],0,.20)[0];assert.ok(closed);close(closed.point.y,.659,.004,'closed rear floor');
 const bodyBefore=bounds(body).clone();drawer.position.z=-.24;const opened=cast([body,drawer],0,.20);assert.equal(opened.length,0,'fixed drawer shell still blocks the open cavity');assert.ok(bounds(body).equals(bodyBefore));
 const seatBox=bounds(seat);close(seatBox.min.y,0,.002,'chair grounded');close(seatBox.getSize(V()).x,.56,.01,'chair width');assert.ok(seatBox.max.y>.94&&seatBox.max.y<1.05);
 seat.updateMatrixWorld(true);const sit=new T.Raycaster(V(0,.65,0),V(0,-1,0),0,.3).intersectObject(seat,true)[0];assert.ok(sit);close(sit.point.y,.44,.018,'seated pelvis contact');
});

test('one broken replacement falls back without invalidating existing props or other loaded kinds',async()=>{
 await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:assetLoader});const previous=createDeskItem('snack'),saved=localSnapshots(previous);
 const result=await loadPropAssets({snack:'./missing.glb',drink:CLASSROOM_PROP_SOURCES.drink},{loader:assetLoader});assert.deepEqual(result.loaded,['drink']);assert.equal(result.failed.length,1);assert.equal(result.failed[0].kind,'snack');assert.equal(clonePropAsset('snack'),null);
 assert.ok(!createDeskItem('snack').userData.propAsset,'failed replacement stays active');assert.ok(createDeskItem('drink').userData.propAsset);assert.ok(previous.userData.propAsset);assertUnchanged(saved);
 const reload=await loadPropAssets({snack:CLASSROOM_PROP_SOURCES.snack},{loader:assetLoader});assert.deepEqual(reload.failed,[]);
});
