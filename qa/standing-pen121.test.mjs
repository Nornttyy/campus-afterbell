import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {propSurface} from './whole-palm-geometry54.mjs';
import {loadGeometry} from './gltf-geometry.mjs';

for(const [variant,asset] of Object.entries(STUDENT_ASSETS)){
 test(variant+' keeps a visible horizontal twirl in its right hand while standing and walking',async()=>{
  const actor=createRiggedStudent(await loadGeometry(asset.file+'.glb'),{variant,seated:false});
  const pen=actor.group.getObjectByName('school-writing-pen'),surface=propSurface(pen),pads=[];
  actor.group.traverse(mesh=>{
   if(!mesh.isSkinnedMesh)return;
   const {skinIndex,skinWeight}=mesh.geometry.attributes;
   for(let i=0;i<skinIndex.count;i++){
    let main=0;
    for(let j=1;j<4;j++)if(skinWeight.getComponent(i,j)>skinWeight.getComponent(i,main))main=j;
    const bone=mesh.skeleton.bones[skinIndex.getComponent(i,main)];
    if(/RightHand(?:Index|Middle|Pinky|Thumb)/.test(bone.name))pads.push({mesh,i});
   }
  });
  let time=0;
  actor.setMood('pen');
  for(const speed of [0,1.8,0]){
   actor.setMotion({seated:false,carrying:true,heldAction:'pen',penTwirling:true,speed});
   let previous,turn=0,maxGap=0;
   for(let i=0;i<120;i++){
    actor.group.rotation.y=.72;
    actor.update(time+=1/60);actor.group.updateMatrixWorld(true);
    assert.ok(pen.parent.visible);
    if(i<40)continue;
    const axis=new T.Vector3(0,1,0).transformDirection(pen.matrixWorld);
    assert.ok(Math.abs(axis.y)<.003,'barrel should roll horizontally');
    if(previous)turn+=axis.angleTo(previous);
    previous=axis;
    if(i%12===0){
     let gap=Infinity;
     const inverse=pen.matrixWorld.clone().invert();
     for(const {mesh,i} of pads){
      const v=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
      gap=Math.min(gap,Math.abs(surface.query(v).signed));
     }
     maxGap=Math.max(maxGap,gap);
    }
   }
   assert.ok(turn>1,'spin has stalled');
   assert.ok(maxGap<.006,'finger to barrel gap '+maxGap);
   if(speed)assert.ok(actor.diagnostics().weights.Walk>.99);
  }
  actor.setMood('resting');actor.setMotion({seated:false});
  actor.update(time+=1/60);assert.equal(pen.parent.visible,false);
  actor.dispose();
 });
}
