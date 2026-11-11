import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createSkinContact} from '../dist/skin-contact68.js';

function fixture(detached=false,morph=false){
 const root=new T.Group(),meshRoot=new T.Group(),boneRoot=new T.Group();root.add(meshRoot,boneRoot);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([.17,.91,-.23],3));
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute([0,1,2,3],4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute([.125,.25,.375,.25],4));
 if(morph){geometry.morphAttributes.position=[new T.Float32BufferAttribute([.08,.03,-.06],3)];geometry.morphTargetsRelative=true;}
 const bones=Array.from({length:4},()=>new T.Bone());boneRoot.add(bones[0]);for(let i=1;i<4;i++){bones[i-1].add(bones[i]);bones[i].position.set(.08,.12,.03);}
 const mesh=new T.SkinnedMesh(geometry,new T.MeshBasicMaterial());meshRoot.add(mesh);root.updateMatrixWorld(true);mesh.bind(new T.Skeleton(bones));if(detached)mesh.bindMode='detached';
 return{root,meshRoot,bones,mesh};
}
for(const detached of [false,true])test(`cached contact equals Three skinning after bone and parent movement (${detached?'detached':'attached'})`,()=>{
 const {root,meshRoot,bones,mesh}=fixture(detached),sample=createSkinContact(mesh,0),expected=new T.Vector3(),actual=new T.Vector3();
 for(let frame=0;frame<90;frame++){
  root.position.set(frame*.13,-.7,2.1);root.rotation.y=frame*.03;meshRoot.rotation.z=Math.sin(frame*.07)*.2;
  bones.forEach((b,i)=>b.rotation.set(Math.sin(frame*.04+i)*.8,Math.cos(frame*.06+i)*.3,frame*.001));root.updateMatrixWorld(true);
  mesh.getVertexPosition(0,expected).applyMatrix4(mesh.matrixWorld);sample(actual);assert.ok(actual.distanceTo(expected)<1e-10,`frame ${frame}`);
 }
});
test('a future morph target is evaluated by the engine instead of ignored',()=>{
 const {root,bones,mesh}=fixture(false,true),sample=createSkinContact(mesh,0);mesh.morphTargetInfluences[0]=.73;bones[2].rotation.x=.8;root.updateMatrixWorld(true);
 const expected=mesh.getVertexPosition(0,new T.Vector3()).applyMatrix4(mesh.matrixWorld);assert.ok(sample(new T.Vector3()).distanceTo(expected)<1e-10);
});
