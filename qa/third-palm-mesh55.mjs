// Exports actual skinned hand + unchanged prop triangles for offline pose inspection.
import {readFileSync,writeFileSync} from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js?v=campus-59c';
import {loadPropAssets,CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-59c';
import {loadGeometry} from './gltf-geometry.mjs';
const [file,variant='boy',kind='drink']=process.argv.slice(2),profile=JSON.parse(readFileSync(file)).find(r=>r.variant===variant&&r.kind===kind);
await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:{loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())}});
const actor=createRiggedStudent(await loadGeometry(STUDENT_ASSETS[variant].file+'.glb'),{variant,seated:true});actor.setMood(kind);actor.setMotion({seated:true,carrying:true,heldAction:kind,using:true});for(let frame=1;frame<=120;frame++)actor.update(frame/60);
const prop=actor.getHand('left').getObjectByName({drink:'red-drink-can',banana:'curved-banana',burger:'layered-burger'}[kind]);for(const[name,q]of Object.entries(profile.bones))actor.bones[name].quaternion.fromArray(q);prop.position.fromArray(profile.position);prop.rotation.set(...profile.rotation);actor.group.updateMatrixWorld(true);const inverse=actor.getHand('left').matrixWorld.clone().invert(),triangles=[];
actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const p=mesh.geometry.attributes.position,ix=mesh.geometry.index,si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight,points=[],selected=[];
 for(let i=0;i<p.count;i++){let n=-1,w=0;for(let k=0;k<4;k++)if(sw.getComponent(i,k)>w){w=sw.getComponent(i,k);n=si.getComponent(i,k);}selected[i]=/^(?:mixamorig[:_]?)?LeftHand/.test(mesh.skeleton.bones[n].name);points[i]=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse).toArray();}
 for(let i=0;i<(ix?.count||p.count);i+=3){const ids=[0,1,2].map(k=>ix?ix.getX(i+k):i+k);if(ids.some(n=>selected[n]))triangles.push({points:ids.map(n=>points[n]),color:[.94,.66,.43]});}
});
prop.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position,ix=mesh.geometry.index,m=inverse.clone().multiply(mesh.matrixWorld),points=[];for(let i=0;i<p.count;i++)points.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(m).toArray());for(let i=0;i<(ix?.count||p.count);i+=3)triangles.push({points:[0,1,2].map(k=>points[ix?ix.getX(i+k):i+k]),color:kind==='banana'?[.95,.82,.16]:kind==='burger'?[.68,.38,.12]:[.1,.52,.82]});});
writeFileSync('/tmp/third-palm-mesh55.json',JSON.stringify({variant,kind,triangles}));
