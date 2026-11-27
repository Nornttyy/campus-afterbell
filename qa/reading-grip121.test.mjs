import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {BOOK_COVER_FACE,BOOK_PAPER_FACE,TEXTBOOK,bookSpineHeight} from '../dist/study-book58.js';
import {createSeatLayout} from '../dist/classroom-layout.js';
import {loadGeometry} from './gltf-geometry.mjs';

function fingerPads(actor){
 const pads=[];
 actor.group.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const {skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let index=0;index<skinIndex.count;index++){
   let main=0;
   for(let i=1;i<4;i++)if(skinWeight.getComponent(index,i)>skinWeight.getComponent(index,main))main=i;
   const bone=mesh.skeleton.bones[skinIndex.getComponent(index,main)];
   const digit=bone.name.match(/(Left|Right)Hand(Thumb|Index|Middle|Pinky|Ring)[23]$/);
   if(digit)pads.push({mesh,index,side:digit[1],thumb:digit[2]==='Thumb'});
  }
 });
 return pads;
}

for(const [variant,{file}] of Object.entries(STUDENT_ASSETS))test(variant+' presses the print with each thumb and the cover with its fingers at mixed and cross-facing desks',async()=>{
 const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true});
 const pads=fingerPads(actor),book=new T.Group(),scene=new T.Scene();
 scene.add(book,actor.group);
 for(const side of [-1,1]){
  const leaf=new T.Group();
  leaf.rotation.y=side*TEXTBOOK.leafYaw;
  book.add(leaf);
 }
 actor.setStudyBook(book);
 actor.setMotion({seated:true});
 const layouts=[...createSeatLayout(3,'mixed'),...createSeatLayout(6,'facing-aisle')];
 const seats=new Map(layouts.map(seat=>[seat.yaw,seat]));
 assert.equal(seats.size,4);
 let time=0;
 for(const {yaw,x,z,deskX,deskZ} of seats.values()){
  actor.group.position.set(x,0,z);
  actor.group.rotation.y=yaw;
  book.position.set(deskX-Math.sin(yaw)*TEXTBOOK.deskInset,bookSpineHeight(Math.PI/2),deskZ-Math.cos(yaw)*TEXTBOOK.deskInset);
  book.rotation.set(Math.PI/2,yaw,0,'YXZ');
  scene.updateMatrixWorld(true);
  actor.setMood('writing');
  actor.update(time+=1/60);
  actor.setMood('reading');
  for(let frame=0;frame<64;frame++){
   actor.update(time+=1/60);
   if(frame%21)continue;
   scene.updateMatrixWorld(true);
   const holder=actor.group.getObjectByName('held-original-desk-book');
   for(const [side,sign] of [['Left',1],['Right',-1]]){
    const inverse=holder.children[sign===1?1:0].matrixWorld.clone().invert();
    let printGap=Infinity,coverGap=Infinity,thumbFront=-Infinity;
    const p=new T.Vector3();
    for(const pad of pads){
     if(pad.side!==side)continue;
     pad.mesh.getVertexPosition(pad.index,p).applyMatrix4(pad.mesh.matrixWorld).applyMatrix4(inverse);
     const x=p.x*sign;
     if(x<.18||x>TEXTBOOK.leafWidth-.006||p.y<.012||p.y>.21)continue;
     if(pad.thumb){
      printGap=Math.min(printGap,Math.abs(p.z+BOOK_PAPER_FACE));
      thumbFront=Math.max(thumbFront,p.z);
     }else coverGap=Math.min(coverGap,Math.abs(p.z-BOOK_COVER_FACE));
    }
    assert.ok(printGap<.004,side+' thumb floats off its printed page by '+printGap);
    assert.ok(thumbFront<.001,side+' thumb passes through the paper block');
    assert.ok(coverGap<.005,side+' fingers float off their cover by '+coverGap);
   }
  }
 }
 actor.dispose();
});
