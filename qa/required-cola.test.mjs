import test from 'node:test';
import assert from 'node:assert/strict';
import {GLTFLoader} from '../dist/vendor/addons/loaders/GLTFLoader.js';
import {CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-83';
import {prepareDeskProps} from '../dist/prepare-desk-props.js';
import {createDeskItem,setWasteModel} from '../dist/game-actors.js';
import {loadGeometry} from './gltf-geometry.mjs';

test('a missing can retries the shipping GLB and never constructs substitute cans or shells',async t=>{
 const source={drink:CLASSROOM_PROP_SOURCES.drink};
 const fail=async()=>{throw new Error('network interrupted');};
 const firstAttempt={loader:{loadAsync:fail}};
 const raw=t.mock.method(GLTFLoader.prototype,'loadAsync',fail);
 await assert.rejects(prepareDeskProps(source,firstAttempt),/可口可乐模型加载失败/);
 assert.throws(()=>createDeskItem('drink'),/可口可乐模型尚未加载/);
 assert.throws(()=>setWasteModel(createDeskItem('foodWaste'),'drink'),/可口可乐模型尚未加载/);
 raw.mock.mockImplementation(url=>{
  assert.equal(new URL(url).pathname.split('/').pop(),'drink-v1.glb');
  return loadGeometry('drink-v1.glb');
 });
 assert.deepEqual(await prepareDeskProps(source,firstAttempt),{loaded:['drink'],failed:[]});
 assert.match(createDeskItem('drink').userData.propAsset,/drink-v1\.glb/);
 const shell=createDeskItem('foodWaste');setWasteModel(shell,'drink');assert.equal(shell.userData.wasteKind,'drink');
});
