// Offline correction of hidden Ring influences; keep four visible digits and
// prop transforms fixed, avoid stretching their shared palm webbing into sheets.
import {readFileSync,writeFileSync} from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js?v=campus-74';
import {loadPropAssets,CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-74';
import {loadGeometry} from './gltf-geometry.mjs';
import {propSurface} from './whole-palm-geometry54.mjs';
const V=()=>new T.Vector3(),profiles=JSON.parse(readFileSync(process.argv[2])),output=[];
await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:{loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())}});
for(const fit of profiles){
 const gltf=await loadGeometry(STUDENT_ASSETS[fit.variant].file+'.glb'),edges=[],vertices=[],meshes=[];gltf.scene.updateMatrixWorld(true);
 gltf.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();meshes.push(mesh);const ix=mesh.geometry.index,p=mesh.geometry.attributes.position,si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight,keys=[],points=[];
  for(let i=0;i<p.count;i++){let n=-1,w=-1,ring=false;for(let k=0;k<4;k++){const bone=mesh.skeleton.bones[si.getComponent(i,k)].name.replace(/^mixamorig[:_]?/,'');if(sw.getComponent(i,k)>.001&&bone.startsWith('LeftHandRing'))ring=true;if(sw.getComponent(i,k)>w){w=sw.getComponent(i,k);n=si.getComponent(i,k);}}keys[i]=mesh.skeleton.bones[n].name.replace(/^mixamorig[:_]?/,'');points[i]=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld);if(ring)vertices.push({mesh,i});}
  const found=new Set();for(let i=0;i<(ix?.count||p.count);i+=3){const ids=[0,1,2].map(k=>ix?ix.getX(i+k):i+k);for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=[a,b].sort((a,b)=>a-b).join('/');if(found.has(key)||!keys[a].startsWith('LeftHand')||!keys[b].startsWith('LeftHand')||!(keys[a].startsWith('LeftHandRing')||keys[b].startsWith('LeftHandRing')))continue;found.add(key);const rest=points[a].distanceTo(points[b]);if(rest>.001)edges.push({mesh,a,b,rest});}}
 });
 const actor=createRiggedStudent(gltf,{variant:fit.variant,seated:true});actor.setMood(fit.kind);actor.setMotion({seated:true,using:true,carrying:true,heldAction:fit.kind});for(let f=1;f<=120;f++)actor.update(f/60);for(const[n,q]of Object.entries(fit.bones))actor.bones[n].quaternion.fromArray(q);
 const prop=actor.group.getObjectByName({drink:'red-drink-can',banana:'curved-banana',burger:'layered-burger'}[fit.kind]);prop.position.fromArray(fit.position);prop.rotation.set(...fit.rotation);actor.group.updateMatrixWorld(true);const surface=propSurface(prop),inverse=prop.matrixWorld.clone().invert(),bones=['LeftHandRing1','LeftHandRing2','LeftHandRing3'].map(n=>actor.bones[n]),base=bones.map(b=>b.quaternion.clone()),rotation=Array(9).fill(0);let last;
 function evaluate(){for(let i=0;i<3;i++)bones[i].quaternion.copy(base[i]).multiply(new T.Quaternion().setFromEuler(new T.Euler(...rotation.slice(i*3,i*3+3))));actor.group.updateMatrixWorld(true);for(const m of meshes)m.skeleton.update();const cache=new Map();function point(mesh,i){let map=cache.get(mesh);if(!map){map=new Map();cache.set(mesh,map);}if(!map.has(i))map.set(i,mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld));return map.get(i);}
  let max=0,sum=0,over=0,depth=0;for(const e of edges){const length=point(e.mesh,e.a).distanceTo(point(e.mesh,e.b)),ratio=length/e.rest,d=Math.max(0,ratio-1.6);if(length-e.rest>.002){max=Math.max(max,d);sum+=d*d;if(d>0)over++;}}
  for(const v of vertices){const q=surface.query(point(v.mesh,v.i).clone().applyMatrix4(inverse));depth=Math.max(depth,-q.signed);}
  const cost=max*max+sum/Math.max(1,edges.length)*.5+Math.max(0,depth-.0018)**2*40000+rotation.reduce((n,v)=>n+v*v*.001,0);return last={cost,maxRatio:max+1.6,over,depth};
 }
 const before={...evaluate()};if(before.over){for(let pass=0;pass<24;pass++){const step=pass<4?.22:pass<10?.09:pass<16?.035:.012;for(let i=0;i<9;i++){const initial=rotation[i];let winning=initial,best=evaluate().cost;for(const sign of[-1,1]){rotation[i]=T.MathUtils.clamp(initial+sign*step,-.85,.85);const cost=evaluate().cost;if(cost<best){best=cost;winning=rotation[i];}}rotation[i]=winning;}evaluate();}}
 const after={...evaluate()};for(let i=0;i<3;i++)fit.bones['LeftHandRing'+(i+1)]=bones[i].quaternion.toArray();fit.webbing={before,after,correction:rotation};output.push(fit);writeFileSync(process.env.THIRD_WEBBING_OUTPUT||'/tmp/third-person-webbing55.json',JSON.stringify(output,null,2));console.log(fit.variant,fit.kind,JSON.stringify({before,after}));actor.dispose();
}
