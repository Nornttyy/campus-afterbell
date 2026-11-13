import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {ClassroomRound,AI_WALK_SPEEDS} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {blocked} from '../dist/classroom-layout.js';

function skinBounds(actor){
 const bounds=new T.Box3(),point=new T.Vector3();actor.group.updateMatrixWorld(true);
 actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++)bounds.expandByPoint(mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld));});
 return bounds;
}
for(const [variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: real student skin is shorter, planted, and does not shrink repeatedly after seated/crawl transitions`,async()=>{
 const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:false});let t=0;
 const settle=(seated,crawling=false)=>{actor.setMood('resting');actor.setMotion({seated,crawling,speed:0,carrying:false});for(let i=0;i<120;i++)actor.update(t+=1/60);};
 try{
  settle(false);const initial=skinBounds(actor);assert.ok(Math.abs(initial.max.y-1.68)<.01);assert.ok(initial.min.y>=-.002&&initial.min.y<.018);
  for(let repeat=0;repeat<3;repeat++){settle(true);settle(false,true);settle(false);}
  const final=skinBounds(actor);assert.ok(Math.abs(final.max.y-initial.max.y)<.005);assert.ok(final.min.y>=-.002&&final.min.y<.018);
 }finally{actor.dispose();}
});

test('expanded playground: the whole AI queue reaches clear assembly positions before 30 seconds at normal speed',()=>{
 for(const Round of [ClassroomRound,TeacherRound]){
  const r=new Round({map:'playground'});r.start({gathering:true});r.startBell();
  const actors=r.students.filter(s=>!s.isPlayer),last=new Map(actors.map(s=>[s.id,{x:s.x,z:s.z}]));
  for(let i=0;i<1800;i++){
   r.step(1/60);
   for(const s of actors){const before=last.get(s.id);assert.ok(Math.hypot(s.x-before.x,s.z-before.z)<=AI_WALK_SPEEDS.student/60+1e-7,'arrival accelerated or teleported');if(s.visible&&i%30===0)assert.equal(blocked(s.x,s.z,.18,r.layout),false);last.set(s.id,{x:s.x,z:s.z});}
  }
  assert.equal(r._seatingRoutes.size,0);assert.ok(actors.every(s=>s.visible&&!s.seated));
 }
});
