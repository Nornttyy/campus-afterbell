import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as T from '../dist/vendor/three.module.js';
import {applyClassShape} from '../dist/model-delivery93.js';
import {makeSchoolChair} from '../dist/school-furniture91.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {fitUniform} from '../dist/uniform-detail102.js';
import {loadGeometry} from './gltf-geometry.mjs';

const pack=await readFile(new URL('../dist/assets/models/class-shapes103.bin',import.meta.url));
const offset=pack.readUInt32LE(0);
const table=JSON.parse(pack.toString('utf8',4,offset));
const indices=new Uint16Array(pack.buffer,pack.byteOffset+offset,(pack.length-offset)/2);
const material=new T.MeshBasicMaterial({side:T.DoubleSide});
const seat=makeSchoolChair(material,material,material).getObjectByName('school-plywood-seat');
seat.updateMatrixWorld(true);
const down=new T.Vector3(0,-1,0);

function checkPose(actor){
 const ray=new T.Raycaster(),delta=new T.Vector3(),soles=[Infinity,Infinity];
 let minContact=Infinity;
 actor.group.updateMatrixWorld(true);
 actor.group.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  mesh.skeleton.update();
  const g=mesh.geometry,vertices=Array.from({length:g.attributes.position.count},(_,i)=>
   mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));
  for(let i=0;i<g.index.count;i+=3){
   const tri=[0,1,2].map(k=>vertices[g.index.getX(i+k)]);
   for(const v of tri){
    const side=Number(v.x>0);
    soles[side]=Math.min(soles[side],v.y);
    if(v.z>=.17||v.z<-.21||v.y>.60||v.y<.31||Math.abs(v.x)>.24)continue;
    ray.ray.origin.set(v.x,1,v.z);ray.ray.direction.copy(down);ray.far=1;
    const hit=ray.intersectObject(seat,false)[0];
    if(hit)minContact=Math.min(minContact,v.y-hit.point.y);
   }
   if(tri.every(v=>v.y>.44)||tri.every(v=>v.y<.39)||tri.every(v=>v.z>.265))continue;
   for(let j=0;j<3;j++){
    delta.subVectors(tri[(j+1)%3],tri[j]);ray.far=delta.length();
    if(!ray.far)continue;
    ray.ray.origin.copy(tri[j]);ray.ray.direction.copy(delta.normalize());
    assert.equal(ray.intersectObject(seat,false).length,0,'clothing or shin cuts the wooden board');
   }
  }
 });
 assert.ok(minContact>=0&&minContact<.010,'seat contact gap '+minContact);
 for(const sole of soles)assert.ok(sole>.09&&sole<.20,'floor to shoe '+sole);
}

for(const [variant,{file}] of Object.entries(STUDENT_ASSETS)){
 test(variant+' sits on the actual wooden chair with both shoes clear of the floor',async()=>{
  const model=await loadGeometry(file+'.glb');applyClassShape(model,table[file],indices);fitUniform(model.scene,variant);
  const actor=createRiggedStudent(model,{variant}),book=new T.Group();
  book.position.set(0,.88,.50);book.rotation.x=Math.PI/2;actor.setStudyBook(book);
  let time=0;
  for(const mood of ['resting','reading','writing','computer','snack']){
   const eating=mood==='snack';
   actor.setMood(mood);actor.setMotion({seated:true,using:eating,carrying:eating,heldAction:eating?'snack':null});
   for(let i=0;i<100;i++)actor.update(time+=1/60);
   checkPose(actor);
  }
  actor.dispose();
 });
}
