import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createCrawlPose,CRAWL_GAIT} from '../dist/crawl-pose.js';
import {CRAWL_TUNING} from '../dist/crawl-profile.js';
import {loadGeometry} from './gltf-geometry.mjs';
const assets={boy:'student-boy-v4',girl:'student-girl-v4',glasses:'student-glasses-v2',ponytail:'student-ponytail-v1',teacher:'teacher-v2'},V=()=>new T.Vector3();
async function fixture(file){
 const gltf=await loadGeometry(file+'.glb'),group=new T.Group(),bones={},meshes=[],samples={};group.add(gltf.scene);group.rotation.y=.63;group.position.y=1.2;
 group.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;if(o.isSkinnedMesh)meshes.push(o);});group.updateMatrixWorld(true);
 const rest=new Map(Object.values(bones).map(b=>[b,{q:b.quaternion.clone(),p:b.position.clone(),length:b.position.length()}]));
 for(const side of ['Left','Right'])for(const part of ['Foot','Hand']){
  const key=side+part,list=[];for(const mesh of meshes){const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;
   for(let i=0;i<si.count;i++){let w=0;for(let k=0;k<4;k++){const n=mesh.skeleton.bones[si.getComponent(i,k)]?.name.replace(/^mixamorig[:_]?/,'');if(part==='Foot'?(n===key||n?.startsWith(side+'Toe')):n?.startsWith(key))w+=sw.getComponent(i,k);}if(w>.8)list.push({mesh,index:i});}
  }samples[key]=list;
 }
 const local=bone=>group.worldToLocal(bone.getWorldPosition(V()));
 function update(){group.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();}
 function bounds(){update();const b=new T.Box3();for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i++)b.expandByPoint(group.worldToLocal(mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld)));return b;}
 const low=key=>Math.min(...samples[key].map(s=>group.worldToLocal(s.mesh.getVertexPosition(s.index,V()).applyMatrix4(s.mesh.matrixWorld)).y));
 const pose=createCrawlPose(group,bones);
 return{group,bones,meshes,rest,pose,local,update,bounds,low};
}

for(const[role,file]of Object.entries(assets))test(`${role}: crawling is horizontal, preserves bone lengths and plants alternating actual palms and soles`,async()=>{
 const f=await fixture(file),{group,bones,pose}=f,cycle=(CRAWL_GAIT.stride/CRAWL_GAIT.stance)/CRAWL_TUNING.speed,dt=cycle/48,forward=V().set(Math.sin(group.rotation.y),0,Math.cos(group.rotation.y));
 let previous=null;const bends={arm:[],leg:[]};
 for(let i=0;i<48;i++){
  const t=i*dt;pose.restore();group.position.x=forward.x*t*CRAWL_TUNING.speed;group.position.z=forward.z*t*CRAWL_TUNING.speed;
  pose.apply({active:true,time:t,dt,speed:CRAWL_TUNING.speed,reset:i===0});const box=f.bounds();
  assert.ok(box.min.y>-.002,`${role}: skin went below floor (${box.min.y})`);assert.ok(box.max.y<CRAWL_TUNING.bodyMaxY,`${role}: body remained upright (${box.max.y})`);
  const torso=f.local(bones.Spine2).sub(f.local(bones.Hips)).normalize();assert.ok(torso.z>.98&&Math.abs(torso.y)<.1,'torso did not turn toward horizontal +Z');
  for(const [kind,names]of [['arm',['LeftArm','LeftForeArm','LeftHand']],['leg',['LeftUpLeg','LeftLeg','LeftFoot']]]){const[a,b,c]=names.map(n=>f.local(bones[n]));bends[kind].push(a.sub(b).angleTo(c.sub(b)));}
  for(const[b,r]of f.rest)if(b!==bones.Hips)assert.ok(b.position.distanceTo(r.p)<1e-10,`${role}: ${b.name} changed bone length`);
  const current={};for(const side of ['Left','Right'])for(const part of ['Hand','Foot']){
   const phase=(pose.state().phase+(side==='Left'?0:.5)+(part==='Foot'?.5:0))%1,key=side+part,world=bones[key].getWorldPosition(V());current[key]={phase,world};
   if(phase<CRAWL_GAIT.stance)assert.ok(f.low(key)>=-.002&&f.low(key)<.013,`${key} not on the floor in support (${f.low(key)})`);
   if(previous&&phase>.03&&phase<CRAWL_GAIT.stance-.04&&previous[key].phase>.03&&previous[key].phase<CRAWL_GAIT.stance-.04)assert.ok(Math.abs(world.clone().sub(previous[key].world).dot(forward))<.002,`${key} skids during world-space support`);
  }previous=current;
 }
 for(const [kind,angles]of Object.entries(bends))assert.ok(Math.max(...angles)-Math.min(...angles)>.5,`${role}: ${kind} stays rigid rather than reaching and recovering`);
});

for(const[role,file]of Object.entries(assets))test(`${role}: stationary crawl does not paddle and exit restores the incoming mixer pose`,async()=>{
 const f=await fixture(file),{pose,bones}=f;pose.apply({active:true,time:0,dt:0,speed:0,reset:true});f.update();
 const still=new Map(Object.values(bones).map(b=>[b,b.getWorldPosition(V())]));
 for(let i=1;i<=20;i++){pose.restore();pose.apply({active:true,time:i*.1,dt:.1,speed:0});f.update();for(const[b,p]of still)assert.ok(b.getWorldPosition(V()).distanceTo(p)<1e-9,'stationary limbs continue crawling');}
 assert.equal(pose.state().phase,0);pose.restore();
 for(const[b,r]of f.rest){assert.ok(b.position.distanceTo(r.p)<1e-10);assert.ok(b.quaternion.toArray().every((v,i)=>Math.abs(v-r.q.toArray()[i])<1e-10));}
 const previous=new Map(Object.values(bones).map(b=>[b,b.getWorldPosition(V())]));let maxStep=0;
 pose.apply({active:false,time:0,dt:0,reset:true});
 for(let i=0;i<120;i++){
  pose.restore();pose.apply({active:i<60,time:i/60,dt:1/60,speed:0});f.update();
  for(const[b,p]of previous){const current=b.getWorldPosition(V());maxStep=Math.max(maxStep,current.distanceTo(p));previous.set(b,current);}
  if(i%6===0)assert.ok(f.bounds().min.y>-.002,'entering/exiting pushes skin through the floor');
 }
 assert.ok(maxStep<.075,`transition jumps ${maxStep}m in one frame`);assert.equal(pose.state().blend,0);
 for(const[b,r]of f.rest){assert.ok(b.position.distanceTo(r.p)<1e-10);assert.ok(b.quaternion.toArray().every((v,i)=>Math.abs(v-r.q.toArray()[i])<1e-10));}
});

// Exercise the real factories too: the crawl layer must survive the ordinary
// hand/capture overlays, and leave no lowered pelvis behind after standing.
for(const[role,file]of Object.entries(assets))test(`${role}: production actor respects its role's crawling permission`,async()=>{
 const gltf=await loadGeometry(file+'.glb');
 const actor=role==='teacher'?(await import('../dist/imported-actors.js')).createRiggedTeacher(gltf):(await import('../dist/student-assets.js')).createRiggedStudent(gltf,{variant:role,seated:false});
 let t=0;const step=crawling=>{if(role==='teacher')actor.update(t+=1/30,{crawling,speed:crawling?.55:0,phase:'watching'});else{actor.setMood('resting');actor.setMotion({seated:false,crawling,speed:crawling?.55:0});actor.update(t+=1/30);}};
 for(let i=0;i<45;i++)step(false);const upright=actor.bones.Hips.getWorldPosition(V()).y;
 for(let i=0;i<60;i++)step(true);
 if(role==='teacher'){assert.equal(actor.diagnostics().crawl.blend,0);assert.ok(Math.abs(actor.bones.Hips.getWorldPosition(V()).y-upright)<.04,'teacher lowers into a crawling pose');actor.dispose();return;}
 assert.ok(actor.diagnostics().crawl.blend>.99);assert.ok(actor.bones.Hips.getWorldPosition(V()).y<upright-.3);
 const bounds=new T.Box3().setFromObject(actor.group,true);assert.ok(bounds.max.y<CRAWL_TUNING.bodyMaxY+.03,`${role} body still stands while camera crawls`);
 for(let i=0;i<60;i++)step(false);assert.equal(actor.diagnostics().crawl.blend,0);assert.ok(Math.abs(actor.bones.Hips.getWorldPosition(V()).y-upright)<.02);
});
