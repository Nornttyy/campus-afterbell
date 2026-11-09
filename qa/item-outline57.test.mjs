import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createOutlineProxy,syncOutlineProxy} from '../dist/item-outline.js';
import {createRiggedStudent} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';
test('rescue outline follows the actual posed skin through binding and release, without new joints',async()=>{
 const actor=createRiggedStudent(await loadGeometry('student-boy-v4.glb'),{variant:'boy',seated:false}),root=new T.Group(),mask=new T.Scene(),material=new T.MeshBasicMaterial();root.position.set(4,.2,7);root.rotation.y=Math.PI;root.add(actor.group);const pairs=[];actor.group.traverse(source=>{if(source.isSkinnedMesh){const proxy=createOutlineProxy(source,material);mask.add(proxy);pairs.push([source,proxy]);}});assert.ok(pairs.length);let time=0;
 for(const restraint of ['free','carried','bound','free']){actor.setMotion({seated:false,speed:0,restraint});for(let i=0;i<100;i++)actor.update(time+=1/60);root.updateMatrixWorld(true);
  for(const [source,proxy]of pairs){source.skeleton.update();syncOutlineProxy(source,proxy);assert.equal(proxy.skeleton,source.skeleton);assert.equal(proxy.geometry,source.geometry);const positions=source.geometry.attributes.position;for(let i=0;i<positions.count;i+=Math.ceil(positions.count/100)){const p=new T.Vector3().fromBufferAttribute(positions,i),a=source.localToWorld(source.applyBoneTransform(i,p.clone())),b=proxy.localToWorld(proxy.applyBoneTransform(i,p.clone()));assert.ok(a.distanceTo(b)<1e-7,`${restraint}: outline detached from actual skin`);}}
 }
 material.dispose();actor.dispose();
});
test('rigid prop outlines keep their original world-space geometry',()=>{
 const root=new T.Group(),source=new T.Mesh(new T.BoxGeometry(.1,.2,.3)),material=new T.MeshBasicMaterial();root.add(source);root.position.set(3,5,7);source.rotation.x=.6;root.updateMatrixWorld(true);const proxy=createOutlineProxy(source,material);syncOutlineProxy(source,proxy);assert.equal(proxy.isSkinnedMesh,undefined);assert.deepEqual(proxy.matrixWorld.elements,source.matrixWorld.elements);source.geometry.dispose();source.material.dispose();material.dispose();
});
