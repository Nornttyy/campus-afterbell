import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {CLASSROOM,CORRIDOR,DOORS,START_BELL_POSITION} from '../dist/classroom-layout.js';
import {campusScene} from './campus-geometry54-helpers.mjs';

test('ordinary classroom floor shade follows the physical desk and chair when a layout changes',()=>{
 const {campus,dispose}=campusScene();
 try{
  const {setSeats,seatShade}=campus.daylight,{data,width,height}=seatShade.image;
  const sample=(x,z)=>data[Math.floor((z-CLASSROOM.minZ)/(CLASSROOM.maxZ-CLASSROOM.minZ)*height)*width+
    Math.floor((x-CLASSROOM.minX)/(CLASSROOM.maxX-CLASSROOM.minX)*width)];
  setSeats([{deskX:-2,deskZ:1,x:-2.78,z:1,yaw:Math.PI/2}]);
  assert.ok(sample(-2,1)>95&&sample(-2.78,1)>75);
  assert.equal(sample(1,1),0);
  setSeats([{deskX:2,deskZ:-2,x:2,z:-2.78,yaw:0}]);
  assert.equal(sample(-2,1),0);
  assert.ok(sample(2,-2)>95&&sample(2,-2.78)>75);
 }finally{dispose();}
});

test('daylight comes through real openings and follows both rows of hall fixtures',()=>{
 const {campus,dispose}=campusScene();
 try{
  const {data,width,height}=campus.daylight.map.image,margin=.44;
  function at(x,z){
   const col=Math.floor(width*(x-CLASSROOM.minX+margin)/(CORRIDOR.maxX-CLASSROOM.minX+2*margin));
   const row=Math.floor(height*(z-CORRIDOR.minZ+margin)/(CLASSROOM.maxZ-CORRIDOR.minZ+2*margin));
   const offset=(row*width+col)*4;
   return data.subarray(offset,offset+4);
  }
  assert.ok(at(-6,.8)[1]>at(0,.8)[1]+90,'the courtyard window lights the nearest desk');
  assert.ok(at(12.3,5.1)[0]>at(12.3,-6)[0]+90,'the lift-side exterior window lights the hall floor');
  const mid=(CORRIDOR.minX+CORRIDOR.maxX)/2,z=CORRIDOR.minZ+3+4.5;
  for(const x of [mid-1.16,mid+1.16]){
   assert.ok(at(x,z)[2]>at(mid,z)[2]+70);
   assert.ok(at(x,z)[2]>at(x,z+2.25)[2]+90);
  }
  assert.equal(at(0,.8)[2],0,'hall lamps stay outside the classroom');
 }finally{dispose();}
});

test('only visible interior glass scatters the view and leaving the ordinary day restores its materials',()=>{
 const {scene,campus,dispose}=campusScene();
 try{
  const pane=scene.getObjectByName('pale-blue-interior-pane').material;
  const clear=scene.getObjectByName('clear-exterior-pane').material;
  const lights=scene.getObjectByName('daytime-paired-hall-lights'),single=scene.getObjectByName('single-row-hall-lights');
  const panels=scene.getObjectByName('corridor-lower-wall-panels');
  const camera=new T.PerspectiveCamera(45,1.66,.08,70);
  camera.position.set(0,1.65,0);
  function seesGlass(x){
   camera.lookAt(x,1.65,0);camera.updateMatrixWorld();
   return campus.daylight.glassInView(camera);
  }
  for(let repeat=0;repeat<2;repeat++){
   campus.setDaylight(true);
   assert.equal(seesGlass(7.3),true);
   assert.equal(seesGlass(-6.65),false);
   assert.equal(pane.blending,T.CustomBlending);assert.equal(pane.blendDstAlpha,T.ZeroFactor);
   assert.equal(clear.blending,T.NormalBlending);
   assert.equal(lights.visible,true);assert.equal(single.visible,false);assert.equal(panels.visible,false);
   campus.setDaylight(false);
   assert.equal(seesGlass(7.3),false);
   assert.equal(pane.blending,T.NormalBlending);assert.equal(pane.blendDstAlpha,null);
   assert.equal(lights.visible,false);assert.equal(single.visible,true);assert.equal(panels.visible,true);
  }
 }finally{dispose();}
});

test('a shared desk material keeps its imported shader and follows the day switch without recompilation',()=>{
 const {campus,dispose}=campusScene(),wood=new T.MeshStandardMaterial();
 try{
  let called=0;
  wood.onBeforeCompile=()=>{called++;};wood.customProgramCacheKey=()=>'imported-desk';
  campus.daylight.bind(wood,'furniture');campus.daylight.bind(wood,'furniture');
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
  wood.onBeforeCompile(shader);
  assert.doesNotMatch(shader.fragmentShader,/--\d/,'signed wall coordinates must compile on the shadow-map-free path');
  const shaderKey=wood.customProgramCacheKey(),version=wood.version;
  assert.equal(called,1);assert.equal(shader.uniforms.campusBounce88.value,campus.daylight.map);
  for(const active of [true,false,true]){
   campus.setDaylight(active);
   assert.equal(shader.uniforms.campusDay88.value,active);
   assert.equal(wood.customProgramCacheKey(),shaderKey);assert.equal(wood.version,version);
  }
 }finally{wood.dispose();dispose();}
});

test('ordinary classroom prints occupy opposite solid window piers and the hall notice clears the bell',()=>{
 const {scene,campus,artwork,dispose}=campusScene();try{
  const near=scene.getObjectByName('classroom-pillar-notice'),far=scene.getObjectByName('classroom-window-notice'),sign=scene.getObjectByName('corridor-conduct-poster');
  assert.equal(near.material.map,artwork.classroomNotice);assert.equal(near.material,far.material);assert.equal(near.material,sign.material);
  assert.ok(near.position.x>7&&far.position.x<-6.6&&near.rotation.y<0&&far.rotation.y>0);
  for(const [index,print] of [near,far,sign].entries()){
   const uv=print.geometry.attributes.uv;for(let i=0;i<uv.count;i++)assert.equal(Math.floor(uv.getX(i)*3),index);
  }
  const door=DOORS.find(d=>d.id==='front');assert.ok(sign.position.z-sign.geometry.parameters.width/2>door.maxZ);
  assert.ok(Math.abs(sign.position.z-START_BELL_POSITION.z)>1);
  campus.setMap('classroom');assert.equal(far.parent.visible,true);campus.setMap('computer');assert.equal(far.parent.visible,false);
 }finally{dispose();}
});
