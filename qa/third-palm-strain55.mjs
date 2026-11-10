// Measures real palm-webbing edge elongation against the authored neutral skin.
import {readFileSync,writeFileSync} from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js?v=campus-61';
import {loadGeometry} from './gltf-geometry.mjs';
const profiles=process.argv.slice(2).flatMap(f=>JSON.parse(readFileSync(f))),results=[];
for(const fit of profiles){
 const gltf=await loadGeometry(STUDENT_ASSETS[fit.variant].file+'.glb'),edges=[],meshes=[];gltf.scene.updateMatrixWorld(true);
 gltf.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();meshes.push(mesh);const ix=mesh.geometry.index,p=mesh.geometry.attributes.position,si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight,keys=[],points=[];
  for(let i=0;i<p.count;i++){let n=-1,w=-1;for(let k=0;k<4;k++)if(sw.getComponent(i,k)>w){w=sw.getComponent(i,k);n=si.getComponent(i,k);}keys[i]=mesh.skeleton.bones[n].name.replace(/^mixamorig[:_]?/,'');points[i]=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);}
  const found=new Set();for(let i=0;i<(ix?.count||p.count);i+=3){const ids=[0,1,2].map(k=>ix?ix.getX(i+k):i+k);for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=[a,b].sort((a,b)=>a-b).join('/');if(found.has(key)||!keys[a].startsWith('LeftHand')||!keys[b].startsWith('LeftHand')||!(keys[a].startsWith('LeftHandRing')||keys[b].startsWith('LeftHandRing')))continue;found.add(key);const rest=points[a].distanceTo(points[b]);if(rest>.001)edges.push({mesh,a,b,rest,keys:[keys[a],keys[b]]});}}
 });
 const actor=createRiggedStudent(gltf,{variant:fit.variant,seated:true});actor.setMood(fit.kind);actor.setMotion({seated:true,using:true,carrying:true,heldAction:fit.kind});for(let f=1;f<=120;f++)actor.update(f/60);for(const[n,q]of Object.entries(fit.bones))actor.bones[n].quaternion.fromArray(q);actor.group.updateMatrixWorld(true);for(const m of meshes)m.skeleton.update();let max=0,over=0,largest=null;
 for(const e of edges){const a=e.mesh.getVertexPosition(e.a,new T.Vector3()).applyMatrix4(e.mesh.matrixWorld),b=e.mesh.getVertexPosition(e.b,new T.Vector3()).applyMatrix4(e.mesh.matrixWorld),length=a.distanceTo(b),ratio=length/e.rest;if(ratio>max){max=ratio;largest={keys:e.keys,restMm:e.rest*1000,lengthMm:length*1000};}if(ratio>1.6&&length-e.rest>.002)over++;}
 const result={variant:fit.variant,kind:fit.kind,edges:edges.length,maxRatio:max,stretchedOver1p6:over,largest};results.push(result);console.log(JSON.stringify(result));actor.dispose();
}
writeFileSync(process.env.THIRD_STRAIN_REPORT||'/tmp/third-palm-strain55.json',JSON.stringify(results,null,2));
