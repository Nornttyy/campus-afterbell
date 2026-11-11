import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';
const rigs=await Promise.all(Array.from({length:24},(_,i)=>loadGeometry(Object.values(STUDENT_ASSETS)[i%4].file+'.glb')));
const names=Object.keys(STUDENT_ASSETS),actors=Array.from({length:24},(_,i)=>createRiggedStudent(rigs[i],{variant:names[i%4],seed:i,seated:true}));
for(const [i,a]of actors.entries()){a.setMood(['writing','reading','computer','resting'][i%4]);a.setMotion({seated:true});}
let t=0;for(let i=0;i<120;i++){t+=1/60;for(const a of actors)a.update(t);}
const ms=[];for(let i=0;i<360;i++){const start=performance.now();t+=1/60;for(const a of actors)a.update(t);ms.push(performance.now()-start);}
ms.sort((a,b)=>a-b);console.log(JSON.stringify({actors:actors.length,mean:ms.reduce((a,b)=>a+b)/ms.length,median:ms[180],p95:ms[342]}));for(const a of actors)a.dispose();
