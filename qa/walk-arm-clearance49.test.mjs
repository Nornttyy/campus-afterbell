import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';

const DT=1/60,V=()=>new T.Vector3();
function tick(actor,time,frames=120){for(let i=0;i<frames;i++)actor.update(time+=DT);return time;}
function skinSamples(actor){
 const samples=[];
 actor.group.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const {skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let i=0;i<skinIndex.count;i++){
   const weights={trunk:0,Left:0,Right:0};
   for(let j=0;j<4;j++){
    const name=mesh.skeleton.bones[skinIndex.getComponent(i,j)].name.replace(/^mixamorig[:_]?/,'');
    const part=/^(Hips|Spine|Spine1|Spine2)$/.test(name)?'trunk':/^(Left|Right)(ForeArm|Hand)/.test(name)?(name.startsWith('Left')?'Left':'Right'):null;
    if(part)weights[part]+=skinWeight.getComponent(i,j);
   }
   const part=Object.keys(weights).find(part=>weights[part]>.70);
   if(part)samples.push({mesh,index:i,part});
  }
 });
 assert.ok(samples.some(p=>p.part==='trunk')&&samples.some(p=>p.part==='Left')&&samples.some(p=>p.part==='Right'));
 return samples;
}
function skinGaps(actor,samples){
 actor.group.updateMatrixWorld(true);actor.group.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
 const inverse=actor.group.matrixWorld.clone().invert();
 const points=samples.map(({mesh,index,part})=>({part,p:mesh.getVertexPosition(index,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse)}));
 // Compare the visible forearm/palm with the ACTUAL trunk at that height.
 // Do not use the giant head, the full character AABB, or the axilla where a
 // sleeve must join the body. The small padded bands cover gaps in tessellation.
 // Require separation, not an arbitrary visible gap that forces arms too wide.
 const bands=new Map();
 for(const {part,p}of points){if(part!=='trunk')continue;const y=Math.round(p.y/.02);for(let k=y-1;k<=y+1;k++){const b=bands.get(k)||{Left:-Infinity,Right:Infinity};b.Left=Math.max(b.Left,p.x);b.Right=Math.min(b.Right,p.x);bands.set(k,b);}}
 const gap={Left:Infinity,Right:Infinity},count={Left:0,Right:0};
 const shoulder=Object.fromEntries(['Left','Right'].map(side=>[side,actor.group.worldToLocal(actor.bones[side+'Arm'].getWorldPosition(V())).y]));
 for(const {part,p}of points){if(part==='trunk'||p.y>shoulder[part]-.08)continue;const band=bands.get(Math.round(p.y/.02));if(!band)continue;gap[part]=Math.min(gap[part],part==='Left'?p.x-band.Left:band.Right-p.x);count[part]++;}
 return {gap,count};
}
function localBone(actor,name){return actor.group.worldToLocal(actor.bones[name].getWorldPosition(V()));}

for(const [variant,{file}]of Object.entries(STUDENT_ASSETS)){
 test(`${variant}: actual walking forearm and palm skin stays outside the torso through a full gait`,async()=>{
  const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:false});
  // A rotated actor catches corrections accidentally applied in world axes.
  actor.group.position.set(2,0,-3);actor.group.rotation.y=.73;
  const original=new Map(Object.entries(actor.bones).filter(([name])=>/^(Left|Right)(Shoulder|Arm|ForeArm|Hand)/.test(name)).map(([,b])=>[b,{position:b.position.clone(),scale:b.scale.clone()}]));
  const samples=skinSamples(actor);actor.setMood('resting');actor.setMotion({seated:false,speed:.70});
  let time=tick(actor,0),last=null;const range={Left:[Infinity,-Infinity],Right:[Infinity,-Infinity]};
  for(let frame=0;frame<144;frame++){
   actor.update(time+=DT);actor.group.updateMatrixWorld(true);
   const wrists=Object.fromEntries(['Left','Right'].map(side=>[side,localBone(actor,side+'Hand')]));
   for(const side of ['Left','Right']){
    range[side][0]=Math.min(range[side][0],wrists[side].z);range[side][1]=Math.max(range[side][1],wrists[side].z);
    if(last)assert.ok(wrists[side].distanceTo(last[side])<.035,`${side} hand snaps between walk samples`);
   }
   last=wrists;
   if(frame%4===0){const {gap,count}=skinGaps(actor,samples);for(const side of ['Left','Right']){assert.ok(count[side]>50,`${side}: missing visible arm/palm samples`);assert.ok(gap[side]>0,`${side}: walking skin overlaps trunk silhouette (gap ${gap[side]} m)`);}}
  }
  for(const side of ['Left','Right'])assert.ok(range[side][1]-range[side][0]>.10,`${side}: clearing torso froze the forward/back arm swing`);
  for(const [bone,before]of original){assert.ok(bone.position.distanceTo(before.position)<.00002,`${bone.name}: correction stretched a bone`);assert.ok(bone.scale.distanceTo(before.scale)<.00002,`${bone.name}: correction scaled a body part`);}
  actor.dispose();
 });
 test(`${variant}: the free hand also clears the trunk while walking with a phone or note`,async()=>{
  const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:false});const samples=skinSamples(actor);let time=0;
  for(const [mood,freeSide]of [['phone','Right'],['note','Left']]){
   actor.setMood(mood);actor.setMotion({seated:false,speed:.70,carrying:true});time=tick(actor,time);
   for(let frame=0;frame<120;frame++){
    actor.update(time+=DT);if(frame%6)continue;
    const {gap,count}=skinGaps(actor,samples);assert.ok(count[freeSide]>50);assert.ok(gap[freeSide]>0,`${mood}: free ${freeSide} arm overlaps torso (gap ${gap[freeSide]} m)`);
   }
  }
  actor.dispose();
 });
}
