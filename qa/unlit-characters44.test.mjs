import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/addons/loaders/GLTFLoader.js';
import {createRiggedStudent,createRiggedPalm,STUDENT_ASSETS} from '../dist/student-assets.js';
import {createRiggedTeacher} from '../dist/imported-actors.js';
import {createDeskHands} from '../dist/game-actors.js?v=campus-77';
import {useCharacterBaseColor,setCharacterNight} from '../dist/character-materials.js';

// Parse the real skin, material factors, attributes and embedded image bytes.
// Node has no browser image decoder: only image decoding is substituted; the
// original compressed image is retained on Texture.image for identity checks.
// These assertions test material integration, not GPU colour rendering.
async function loadCharacter(file){
 const bytes=await readFile(new URL('../dist/assets/models/'+file+'.glb',import.meta.url));
 const loader=new GLTFLoader();
 loader.register(parser=>({name:'NodeEmbeddedTextureInspection',loadTexture:async index=>{
  const definition=parser.json.textures[index],image=parser.json.images[definition.source];
  assert.ok(Number.isInteger(image.bufferView),'character image should be embedded in its GLB');
  const encoded=await parser.getDependency('bufferView',image.bufferView);
  assert.ok(encoded.byteLength>1024,'unexpected empty character texture');
  const texture=new T.Texture({encoded,mimeType:image.mimeType});texture.flipY=false;
  parser.associations.set(texture,{textures:index});return texture;
 }}));
 return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
const list=material=>Array.isArray(material)?material:[material];
function originals(root){
 const byGeometry=new Map();byGeometry.sourceMeshes=new Map();root.traverse(mesh=>{if(!mesh.isMesh)return;
  byGeometry.sourceMeshes.set(mesh,mesh.geometry);
  byGeometry.set(mesh.geometry,list(mesh.material).map(material=>({material,map:material.map,alphaMap:material.alphaMap,color:material.color.clone(),vertexColors:material.vertexColors,side:material.side,opacity:material.opacity,transparent:material.transparent,alphaTest:material.alphaTest,alphaHash:material.alphaHash,depthWrite:material.depthWrite,depthTest:material.depthTest})));
 });return byGeometry;
}
function verifySurfaces(root,before){
 let surfaces=0,textured=0,caps=0;
 root.traverse(mesh=>{if(!mesh.isMesh)return;
  // Eye repair subdivides a small sclera patch on a runtime clone. All
  // original non-eye triangles, UVs and skinning must still match the GLB.
  const sourceGeometry=before.has(mesh.geometry)?mesh.geometry:before.sourceMeshes.get(mesh);
  if(!sourceGeometry)return;
  if(sourceGeometry!==mesh.geometry){
   const eyeMask=mesh.geometry.attributes.studentEyeWeights;
   if(eyeMask){
    const sourcePosition=sourceGeometry.attributes.position,bounds=new T.Box3(),v=new T.Vector3();
    for(let i=0;i<sourcePosition.count;i++)if(eyeMask.getX(i)+eyeMask.getY(i)>0)bounds.expandByPoint(v.fromBufferAttribute(sourcePosition,i));
    bounds.expandByScalar(.02);
    const indices=mesh.geometry.index.array,triangles=new Set();
    for(let i=0;i<indices.length;i+=3)triangles.add([indices[i],indices[i+1],indices[i+2]].join(','));
    const original=sourceGeometry.index.array;
    for(let i=0;i<original.length;i+=3){
     const ids=[original[i],original[i+1],original[i+2]],box=new T.Box3();
     for(const id of ids)box.expandByPoint(v.fromBufferAttribute(sourcePosition,id));
     if(!box.intersectsBox(bounds))assert.ok(triangles.has(ids.join(',')),'a triangle outside the local eye patch changed');
    }
    for(let i=sourcePosition.count;i<mesh.geometry.attributes.position.count;i++)assert.ok(bounds.containsPoint(v.fromBufferAttribute(mesh.geometry.attributes.position,i)),'subdivision escaped the eye patch');
   }else assert.deepEqual(mesh.geometry.index?.array,sourceGeometry.index?.array,'non-eye triangles changed');
   const sculpted=new Set(mesh.geometry.userData.studentFace75?.changedIndices||[]);
   for(const [name,attribute]of Object.entries(sourceGeometry.attributes)){
    const repaired=mesh.geometry.attributes[name],eyeMask=mesh.geometry.attributes.studentEyeWeights;
    if((eyeMask||sculpted.size)&&(name==='position'||name==='normal')){
     assert.ok(repaired.count>=attribute.count);
     for(let i=0;i<attribute.count;i++){
      if(sculpted.has(i)||(eyeMask&&eyeMask.getX(i)+eyeMask.getY(i)>0))continue;
      for(let k=0;k<attribute.itemSize;k++)assert.equal(repaired.getComponent(i,k),attribute.getComponent(i,k),`${name} changed outside eye/face repair`);
     }
    }else assert.deepEqual(repaired?.array.slice(0,attribute.array.length),attribute.array,`original ${name} attribute changed`);
   }
  }
  surfaces++;assert.equal(mesh.receiveShadow,false,`${mesh.name}: still receives scene shadows`);
  assert.equal(mesh.userData.characterSurface,true,`${mesh.name}: classroom shadow override cannot identify this surface`);
  const mats=list(mesh.material),saved=before.get(sourceGeometry);assert.equal(mats.length,saved.length);
  for(let i=0;i<mats.length;i++){
   const material=mats[i],source=saved[i];
   assert.equal(material.isMeshBasicMaterial,true,`${material.name}: character is still lit`);
   assert.equal(material.toneMapped,false);assert.equal(material.fog,false);
   assert.equal(material.map,source.map,'base colour texture was replaced');assert.equal(material.alphaMap,source.alphaMap);
   assert.deepEqual(material.color.toArray(),source.color.toArray());
   for(const key of ['vertexColors','side','opacity','transparent','alphaTest','alphaHash','depthWrite','depthTest'])assert.equal(material[key],source[key],`${material.name}: lost ${key}`);
   assert.equal(source.material.isMeshStandardMaterial,true,'source PBR material was mutated');
   assert.deepEqual(source.material.color.toArray(),source.color.toArray(),'source colour was modified');
   if(source.map){textured++;assert.ok(source.map.image.encoded.byteLength>1024);assert.equal(source.map.colorSpace,T.SRGBColorSpace);}
   if(/WristSkin/.test(source.material.name)){caps++;assert.ok(mesh.geometry.attributes.color,'wrist cap lost its vertex colours');assert.equal(material.vertexColors,true);}
  }
 });
 assert.equal(surfaces,before.size,'a source character mesh was lost');assert.ok(textured>0,'test did not exercise the real GLB base-colour map');
 return {surfaces,textured,caps};
}
function assertLit(root,label){
 let count=0;root.traverse(mesh=>{if(!mesh.isMesh)return;count++;
  assert.notEqual(mesh.userData.characterSurface,true,`${label}: prop marked as body`);
  for(const material of list(mesh.material)){assert.equal(material.isMeshStandardMaterial,true,`${label}: prop was converted with the character`);assert.equal(material.toneMapped,true);}
 });assert.ok(count>0,`${label}: no actual meshes tested`);
}

for(const [variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: actual imported body keeps authored colour and held items remain lit`,async()=>{
 const source=await loadCharacter(file),before=originals(source.scene),actor=createRiggedStudent(source,{variant,seated:true});
 actor.update(1/60);verifySurfaces(actor.group,before);
 assertLit(actor.group.getObjectByName('held-writing-pencil'),'held writing pencil');
 // This factory creates real food geometry beneath the grip, independently
 // of source character meshes; all three must retain their lighting material.
 const hand=actor.getHand('left');let foodMeshes=0;
 hand.traverse(mesh=>{if(mesh.isMesh&&!before.has(mesh.geometry)){foodMeshes++;for(const material of list(mesh.material))assert.equal(material.isMeshStandardMaterial,true,'held food converted to unlit');}});
 assert.ok(foodMeshes>=3,'three held food props were not present');actor.dispose();
});

test('teacher: actual imported skin is unlit while the chalk retains lighting',async()=>{
 const source=await loadCharacter('teacher-v2'),before=originals(source.scene),actor=createRiggedTeacher(source);
 actor.update(1/60,{phase:'board'});verifySurfaces(actor.group,before);
 assertLit(actor.group.getObjectByName('teacher-writing-chalk'),'teacher chalk');actor.dispose();
});

for(const side of [-1,1])test(`${side<0?'left':'right'}: real first-person palm and wrist cap retain their original colours`,async()=>{
 const source=await loadCharacter(side<0?'hand-left-v3':'hand-right-v3'),before=originals(source.scene);
 const hand=createRiggedPalm(source,side);hand.setCurl(.55);hand.opposeThumb(.6);
 const result=verifySurfaces(hand.group,before);assert.equal(result.caps,1,'wrist closure material was not covered');
});

test('first-person view keeps both imported hands unlit and attached food lit after posing',async()=>{
 const sources=await Promise.all(['hand-left-v3','hand-right-v3'].map(loadCharacter)),originalsBySide=sources.map(s=>originals(s.scene));
 const hands=createDeskHands({createHand:(side,scale)=>createRiggedPalm(sources[side<0?0:1],side,scale)});
 for(let i=0;i<60;i++)hands.update(i/60,{action:'burger',holding:true,carrying:true,seated:true});
 for(const [index,side]of ['left','right'].entries())verifySurfaces(hands.group.getObjectByName(side+'-desk-hand'),originalsBySide[index]);
 // Primitive fallback material names are optional; the factory-level food
 // assertions above cover them. Here ensure there are non-character lit props.
 assert.ok(hands.group.children.some(child=>{let lit=false;child.traverse(mesh=>{if(mesh.isMesh&&!mesh.userData.characterSurface&&mesh.material?.isMeshStandardMaterial)lit=true;});return lit;}));
});

test('unlit conversion preserves non-default transparency and shared material identity',()=>{
 const map=new T.DataTexture(new Uint8Array([170,110,90,180]),1,1),alphaMap=new T.DataTexture(new Uint8Array([255,180,255,255]),1,1);
 const source=new T.MeshStandardMaterial({map,alphaMap,color:'#b3d0e7',transparent:true,opacity:.47,alphaTest:.15,alphaHash:true,vertexColors:true,side:T.DoubleSide,depthWrite:false});
 const root=new T.Group(),a=new T.Mesh(new T.PlaneGeometry(),source),b=new T.Mesh(new T.PlaneGeometry(),source);root.add(a,b);a.castShadow=b.castShadow=true;
 useCharacterBaseColor(root);assert.equal(a.material,b.material);assert.equal(a.material.map,map);assert.equal(a.material.alphaMap,alphaMap);assert.ok(a.material.color.equals(source.color));
 for(const key of ['transparent','opacity','alphaTest','alphaHash','vertexColors','side','depthWrite'])assert.equal(a.material[key],source[key]);
 assert.equal(a.castShadow,true,'unlit colour should not remove the character ground shadow');assert.equal(source.isMeshStandardMaterial,true);
 const material=a.material;useCharacterBaseColor(root);assert.equal(a.material,material,'second conversion allocates another material');
});

test('power-cut lighting switches every real character and viewmodel surface to diffuse light, then restores original daytime colours',async()=>{
 for(const file of ['student-boy-v4.glb','student-girl-v4.glb','student-glasses-v2.glb','student-ponytail-v1.glb','teacher-v2.glb','hand-left-v3.glb','teacher-hand-left-v1.glb']){
  const {scene}=await loadCharacter(file.replace(/\.glb$/,''));useCharacterBaseColor(scene);const originals=new Map();scene.traverse(o=>{if(o.isMesh)originals.set(o,o.material);});
  const prop=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({color:'red'}));scene.add(prop);const propMaterial=prop.material;
  setCharacterNight(scene,true);for(const [mesh,day]of originals){assert.equal(mesh.material.isMeshLambertMaterial,true);assert.equal(mesh.material.map,day.map);assert.equal(mesh.material.emissive.getHex(),0);assert.equal(mesh.material.toneMapped,true);assert.equal(mesh.receiveShadow,true);}
  const first=[...originals][0][0].material;setCharacterNight(scene,true);assert.equal([...originals][0][0].material,first);assert.equal(prop.material,propMaterial);
  setCharacterNight(scene,false);for(const [mesh,day]of originals){assert.equal(mesh.material,day);assert.equal(mesh.receiveShadow,false);}
 }
});
