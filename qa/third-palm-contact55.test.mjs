import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js?v=campus-76';
import {loadPropAssets,CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-76';
import {THIRD_PALM_PROFILES} from '../dist/third-palm-profiles55.js?v=campus-76';
import {loadGeometry} from './gltf-geometry.mjs';
import {propSurface} from './whole-palm-geometry54.mjs';
const parts=['Palm','Thumb','Index','Middle','Pinky'],names={drink:'red-drink-can',banana:'curved-banana',burger:'layered-burger'};
await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:{loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())}});
function skinGroups(actor){
 const groups=Object.fromEntries(parts.map(p=>[p,[]])),meshes=[];
 actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;meshes.push(mesh);const ix=mesh.geometry.attributes.skinIndex,wt=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<ix.count;i++){let index=-1,weight=-1;for(let k=0;k<4;k++)if(wt.getComponent(i,k)>weight){weight=wt.getComponent(i,k);index=ix.getComponent(i,k);}const name=mesh.skeleton.bones[index].name.replace(/^mixamorig[:_]?/,'');const part=name==='LeftHand'||name.startsWith('LeftHandRing')?'Palm':parts.slice(1).find(p=>name.startsWith('LeftHand'+p));if(part)groups[part].push({mesh,i,pad:name.endsWith('3')});}
 });return{groups,meshes};
}
for(const variant of ['boy','girl','glasses','ponytail'])for(const kind of Object.keys(names))test(`${variant} ${kind}: runtime wraps all four fingers without deep hand-skin penetration`,async()=>{
 assert.ok(THIRD_PALM_PROFILES[variant]?.[kind],`${variant}/${kind}: missing fitted profile`);
 const actor=createRiggedStudent(await loadGeometry(STUDENT_ASSETS[variant].file+'.glb'),{variant,seated:true}),skin=skinGroups(actor);actor.setMood(kind);let time=0,surface,prop;
 const poses=[{name:'seated holding',seated:true,using:false,speed:0},{name:'seated eating',seated:true,using:true,speed:0},{name:'standing holding',seated:false,using:false,speed:0},{name:'walking holding',seated:false,using:false,speed:.55}];
 try{for(const pose of poses){actor.setMotion({...pose,carrying:true,heldAction:kind});for(let i=0;i<120;i++)actor.update(time+=1/60);
   prop=actor.group.getObjectByName(names[kind]);assert.ok(prop?.visible&&prop.userData.propAsset,`${pose.name}: must use visible production GLB`);surface??=propSurface(prop);
   for(let sample=0;sample<3;sample++){if(sample)for(let i=0;i<24;i++)actor.update(time+=1/60);actor.group.updateMatrixWorld(true);for(const mesh of skin.meshes)mesh.skeleton.update();const inverse=prop.matrixWorld.clone().invert();
    for(const part of parts){let penetration=0,padGap=Infinity;const rows=skin.groups[part];assert.ok(rows.length>0,`${part}: no skin vertices sampled`);
     for(const {mesh,i,pad}of rows){const point=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse),q=surface.query(point);penetration=Math.max(penetration,-q.signed);if(pad)padGap=Math.min(padGap,q.distance);}
     // Tiny 1–2 mm soft contact is acceptable; do not overtwist the fingers to
     // win a submillimetre surface metric while stretching the palm webbing.
     assert.ok(penetration<=.002001,`${variant}/${kind} ${pose.name} ${part} penetration ${(penetration*1000).toFixed(3)}mm at ${time.toFixed(2)}s`);
     if(part!=='Palm')assert.ok(padGap<=.004,`${variant}/${kind} ${pose.name} ${part} pad gap ${(padGap*1000).toFixed(3)}mm at ${time.toFixed(2)}s`);
    }
   }
  }}finally{actor.dispose();}
});
