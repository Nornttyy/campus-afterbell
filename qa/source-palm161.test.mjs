import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {Texture} from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/addons/loaders/GLTFLoader.js';
import {createRiggedPalm} from '../dist/student-assets.js';
import {createFirstPersonHandMotion} from '../dist/first-person-hand-motion.js';

for(const side of [-1,1]){
 const label=side<0?'left':'right';
 test(label+' playable hand preserves the original palm, fingertips and authored open pose',async()=>{
  const data=await readFile(new URL('../dist/assets/models/ponytail-hand-'+label+'-v1.glb',import.meta.url));
  const loader=new GLTFLoader();
  loader.register(()=>({name:'EXT_texture_webp',loadTexture:async()=>new Texture()}));
  const source=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const hand=createRiggedPalm(source,side);
  const meshes=new Map();
  source.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.set(o.name,o);});
  let thumbVertices=0,armChanges=0;
  hand.group.traverse(o=>{
   if(!o.isSkinnedMesh)return;
   const src=meshes.get(o.name),a=src.geometry.attributes,b=o.geometry.attributes;
   for(const key of ['skinIndex','skinWeight','uv'])assert.deepEqual(b[key].array,a[key].array);
   for(let i=0;i<a.position.count;i++){
    let arm=0,thumb=0;
    for(let k=0;k<4;k++){
     const bone=src.skeleton.bones[a.skinIndex.getComponent(i,k)].name;
     const w=a.skinWeight.getComponent(i,k);
     if(bone.endsWith('ForeArm'))arm+=w;
     if(bone.includes('Thumb'))thumb+=w;
    }
    if(thumb>.99)thumbVertices++;
    if(thumb>.99||a.position.getY(i)>=-.030){
     for(const attr of ['position','normal','color'])for(let k=0;k<3;k++)
      assert.equal(b[attr].getComponent(i,k),a[attr].getComponent(i,k),attr+' vertex '+i);
     assert.equal(b.skinTextureWeight.getX(i),1);
    }else if(a.position.getY(i)!==b.position.getY(i))armChanges++;
   }
  });
  assert.ok(thumbVertices>20&&armChanges>0);
  const reference=createRiggedPalm(source,side),motion=createFirstPersonHandMotion(hand,side);
  for(const curl of [0,.08,.5]){
   const fingers={Thumb:curl,Index:0,Middle:.3,Pinky:.5};
   reference.setCurl(curl);
   for(const [digit,value] of Object.entries({...fingers,Ring:.4}))reference.setFingerCurl(digit,value);
   motion.applyAuthoredFingers({curl,fingers},1);
   hand.group.traverse(bone=>{
    if(!bone.isBone||!bone.name.includes('Hand'))return;
    const expected=reference.group.getObjectByName(bone.name);
    assert.ok(1-Math.abs(bone.quaternion.dot(expected.quaternion))<1e-7,bone.name);
    assert.deepEqual(bone.scale.toArray(),expected.scale.toArray());
   });
  }
 });
}
