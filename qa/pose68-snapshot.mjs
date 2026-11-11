import {writeFile} from 'node:fs/promises';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';
const result={};
for(const [variant,{file}] of Object.entries(STUDENT_ASSETS)){
 const a=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seed:7}),parent=new T.Group();parent.position.set(2,1,-4);parent.rotation.y=.73;parent.add(a.group);let t=0;
 for(const mood of ['writing','reading','computer','computer-idle','phone','resting']){
  a.setMood(mood);a.setMotion({seated:true,speed:0,lookYaw:.18,lookPitch:.21});
  for(let i=0;i<150;i++){a.update(t+=1/60);if(i%29===0){a.group.updateWorldMatrix(true,true);result[variant+':'+mood+':'+i]=Object.values(a.bones).flatMap(b=>[...b.position.toArray(),...b.quaternion.toArray(),...b.matrixWorld.elements]);}}
 }a.dispose();
}
await writeFile(process.argv[2],JSON.stringify(result));console.log('saved '+Object.keys(result).length+' full-rig poses');
