import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {DESK_ITEM_KINDS} from '../dist/game-actors.js';
import {GRIP_ITEMS,gripKey,gripSides,newHandGrip,validateGripSet,createGripLayer,applyGripEdits,savedGrip} from '../dist/item-grips.js';

test('every carried desk item and serving variant resolves to its own editable grip',()=>{
  for(const name of DESK_ITEM_KINDS)assert.ok(GRIP_ITEMS[gripKey(name)],name);
  for(const food of ['layerCake','chickenBucket'])assert.equal(gripKey('burger',food),food);
  for(const type of ['hotpotPlate','hotpotBite'])assert.ok(GRIP_ITEMS[gripKey(type,'lotus')]);
  assert.deepEqual(gripSides('book'),['left','right']);assert.deepEqual(gripSides('pen'),['right']);
});
test('import validates bone, side, unit limits and keeps poses separate',()=>{
  const hand=newHandGrip();hand.joints.Thumb2=[31,4,-6];
  const set={version:1,items:{drink:{left:hand}}};
  assert.deepEqual(validateGripSet(set),set);assert.throws(()=>validateGripSet({version:1,items:{pen:{left:hand}}}));
  const bad=structuredClone(set);bad.items.drink.left.joints.Thumb2[0]=181;assert.throws(()=>validateGripSet(bad));
  const store=new Map();globalThis.localStorage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
  applyGripEdits(set.items);applyGripEdits({chips:{left:newHandGrip()}});
  assert.deepEqual(savedGrip('drink'),set.items.drink);assert.equal(savedGrip('burger'),undefined);
});
test('joint and wrist edits preserve the mounted prop in world space and restore the animation input',()=>{
  const root=new T.Group(),palm=new T.Group(),prop=new T.Mesh(),bone=new T.Bone();root.rotation.y=.4;palm.scale.setScalar(1.38);palm.rotation.z=.3;bone.name='mixamorig:RightHandIndex2';root.add(palm);palm.add(prop,bone);prop.position.set(.13,.21,.1);
  const pose=newHandGrip();pose.position=[23,-17,9];pose.rotation=[35,70,-32];pose.joints.Index2=[22,8,9];
  const rig=createGripLayer({group:palm},'right',id=>id==='chalk'?{right:pose}:null);
  root.updateMatrixWorld(true);const before=prop.matrixWorld.clone(),p=palm.position.clone(),q=palm.quaternion.clone(),expected=new T.Quaternion().setFromEuler(new T.Euler(...pose.joints.Index2.map(n=>n*Math.PI/180)));
  for(let n=0;n<5;n++){
    rig.apply('chalk',prop);root.updateMatrixWorld(true);assert.ok(expected.angleTo(bone.quaternion)<1e-6);
    assert.ok(before.elements.every((x,i)=>Math.abs(x-prop.matrixWorld.elements[i])<1e-7));
    rig.restore();assert.ok(palm.position.equals(p)&&palm.quaternion.equals(q));assert.ok(bone.quaternion.angleTo(new T.Quaternion())<1e-6);
  }
});

test('saved grip follows carrying and drinking on the live skin and leaves the empty idle pose intact',async()=>{
  const {loadGeometry}=await import('./gltf-geometry.mjs');
  const {createDeskHands}=await import('../dist/game-actors.js');
  const {createRiggedPalm}=await import('../dist/student-assets.js');
  const {applyGripEdits}=await import('../dist/item-grips.js?v=campus-117&rev=171');
  const models=await Promise.all(['left','right'].map(s=>loadGeometry('ponytail-hand-'+s+'-v2.glb')));
  const factory=(sign,scale)=>createRiggedPalm(models[sign<0?0:1],sign,scale);
  const stock=createDeskHands({createHand:factory,gripForItem:()=>null}),game=createDeskHands({createHand:factory});
  const pose=newHandGrip();pose.joints.Thumb2=[27,-4,19];pose.position=[24,-16,7];applyGripEdits({drink:{left:pose}});
  const joint=r=>{let b;r.getHand('left').group.traverse(o=>{if(o.isBone&&o.name.endsWith('LeftHandThumb2'))b=o;});return b;};
  const delta=new T.Quaternion().setFromEuler(new T.Euler(...pose.joints.Thumb2.map(n=>n*Math.PI/180)));
  for(let i=0;i<50;i++){
    const state={action:'drink',seated:i>=12,carrying:i<35,holding:i>=15&&i<34,eating:i>=15&&i<34,progress:i/50,freeLook:true};
    stock.update(i/60,state);game.update(i/60,state);
    const expected=joint(stock).quaternion.clone();if(state.carrying)expected.multiply(delta);
    assert.ok(expected.angleTo(joint(game).quaternion)<1e-6);
    assert.ok(stock.getProp('drink').position.distanceTo(game.getProp('drink').position)<1e-7);
  }
});
