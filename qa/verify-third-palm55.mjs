// Independent dense skin-to-surface verification for offline third-person fits.
// Profiles are applied after each real animation update, as runtime will do.
import {readFileSync,writeFileSync} from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js?v=campus-59c';
import {loadPropAssets,CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-59c';
import {loadGeometry} from './gltf-geometry.mjs';
import {propSurface} from './whole-palm-geometry54.mjs';
const V=(...v)=>new T.Vector3(...v),parts=['Palm','Thumb','Index','Middle','Pinky'];
const names={drink:'red-drink-can',banana:'curved-banana',burger:'layered-burger'};
await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:{loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())}});
const profiles=process.argv.slice(2).flatMap(file=>JSON.parse(readFileSync(file,'utf8'))),results=[];
for(const profile of profiles){
 const {variant,kind}=profile,gltf=await loadGeometry(STUDENT_ASSETS[variant].file+'.glb'),actor=createRiggedStudent(gltf,{variant,seated:true});
 actor.setMood(kind);actor.setMotion({seated:true,carrying:true,heldAction:kind,using:true});
 for(let frame=1;frame<=120;frame++)actor.update(frame/60);
 const prop=actor.group.getObjectByName(names[kind]);if(!prop?.userData.propAsset)throw new Error('Real prop missing');
 const surface=propSurface(prop),groups=Object.fromEntries(parts.map(p=>[p,[]])),meshes=[];
 actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;meshes.push(mesh);const ix=mesh.geometry.attributes.skinIndex,wt=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<ix.count;i++){let index=-1,weight=0;for(let k=0;k<4;k++)if(wt.getComponent(i,k)>weight){weight=wt.getComponent(i,k);index=ix.getComponent(i,k);}const name=mesh.skeleton.bones[index].name.replace(/^mixamorig[:_]?/,'');const part=(name==='LeftHand'||name.startsWith('LeftHandRing'))?'Palm':parts.slice(1).find(p=>name.startsWith('LeftHand'+p));if(part)groups[part].push({mesh,i,pad:name.endsWith('3')});}
 });
 const snapshots=[];
 for(const time of [2,2.4,2.8]){
  actor.update(time);for(const [name,q]of Object.entries(profile.bones))actor.bones[name].quaternion.fromArray(q);prop.position.fromArray(profile.position);prop.rotation.set(...profile.rotation);
  actor.group.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();const inverse=prop.matrixWorld.clone().invert(),metrics={};
  for(const part of parts){let gap=Infinity,padGap=Infinity,depth=0,count=0,worst=null;
   for(const {mesh,i,pad}of groups[part]){const point=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse),q=surface.query(point);gap=Math.min(gap,q.distance);if(pad)padGap=Math.min(padGap,q.distance);if(q.signed< -depth){depth=-q.signed;worst=point.clone();}if(q.signed<-.001)count++;}
   const parity=worst&&depth>.001?[V(.719,.403,.566),V(-.501,.811,.303),V(.242,-.446,.862)].map(d=>surface.inside(worst,d.normalize())):[];
   metrics[part]={gapMm:gap*1000,padGapMm:Number.isFinite(padGap)?padGap*1000:null,penetrationMm:depth*1000,insideOver1mm:count,vertices:groups[part].length,deepestParity:parity};
  }
  snapshots.push({time,metrics});
 }
 const result={variant,kind,asset:prop.userData.propAsset,snapshots};results.push(result);console.log(variant,kind,JSON.stringify(snapshots[0].metrics));actor.dispose();
}
writeFileSync(process.env.THIRD_GRIP_REPORT||'/tmp/third-person-profile-verification55.json',JSON.stringify(results,null,2));
