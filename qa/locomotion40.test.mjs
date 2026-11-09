import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';

for(const [variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: planted feet remain on the floor as the actor actually moves`,async t=>{
 const source=await loadGeometry(file+'.glb'),meta=source.parser.json.asset.extras.characters40;
 const speed=meta.nominalWalkSpeed,duration=meta.walkCycleDuration||source.animations.find(c=>c.name==='Walk').duration;
 assert.ok(speed>0&&duration>0,'Walk must declare its authored distance/time contract');
 const actor=createRiggedStudent(source,{variant,seated:false,seed:0});
 actor.setMood('resting');actor.setMotion({speed,seated:false,carrying:false});
 const dt=1/120,samples={Left:[],Right:[]};let time=0;
 for(let i=0;i<Math.ceil(duration*5/dt);i++){
  time+=dt;actor.group.position.z=time*speed;actor.update(time);actor.group.updateMatrixWorld(true);
  if(time<duration*3)continue;
  for(const side of ['Left','Right'])samples[side].push({time,p:actor.bones[side+'Foot'].getWorldPosition(new T.Vector3())});
 }
 for(const side of ['Left','Right']){
  const list=samples[side],low=Math.min(...list.map(s=>s.p.y)),high=Math.max(...list.map(s=>s.p.y));
  // This samples ankle-bone travel, not the visible sole. The low walking
  // gait lifts the ankle about 4.5 cm; requiring strictly MORE than that
  // rejected the intended motion at its sampled peak. Keep a bounded low
  // step here; walk-gait43 also checks actual sole clearance and floor contact.
  const ankleLift=high-low;
  assert.ok(ankleLift>.035&&ankleLift<.06,`${side}: ankle lift ${ankleLift.toFixed(4)} m is outside the low walking range`);
  const slip=[];
  for(let i=1;i<list.length;i++){
   const a=list[i-1],b=list[i];
   if(a.p.y<low+.004&&b.p.y<low+.004){const d=b.p.clone().sub(a.p);slip.push(Math.hypot(d.x,d.z)/(b.time-a.time));}
  }
  assert.ok(slip.length>list.length*.25,`${side}: no sustained support phase`);
  slip.sort((a,b)=>a-b);
  assert.ok(slip[Math.floor(slip.length*.75)]<.12,`${side}: support foot slides ${slip[Math.floor(slip.length*.75)].toFixed(3)} m/s`);
  t.diagnostic(`${variant} ${side}: support-foot slip P75 ${slip[Math.floor(slip.length*.75)].toFixed(4)} m/s at source pace ${speed.toFixed(4)} m/s`);
 }
 actor.dispose();
});
