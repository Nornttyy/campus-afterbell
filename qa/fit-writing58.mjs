import fs from 'node:fs/promises';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {WRITING_GRIPS} from '../dist/writing-grips58.js';
import {createFingerRig,handFrame} from '../dist/hand-motion.js';
import {loadGeometry} from './gltf-geometry.mjs';
const V=(...a)=>new T.Vector3(...a),Q=()=>new T.Quaternion(),result={};
const cylinders=[[-.055,.065,.0088],[-.0615,-.0165,.0105],[.0695,.0815,.008]];
function sd(p){let d=Infinity;for(const[a,b,r]of cylinders){const x=Math.hypot(p.x,p.z)-r,y=Math.abs(p.y-(a+b)/2)-(b-a)/2;d=Math.min(d,Math.hypot(Math.max(x,0),Math.max(y,0))+Math.min(Math.max(x,y),0));}return d;}
for(const[variant,{file}]of Object.entries(STUDENT_ASSETS)){
 const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant});actor.setMood('writing');for(let n=0;n<180;n++)actor.update(n/60);actor.group.updateMatrixWorld(true);
 for(const[name,q]of Object.entries(WRITING_GRIPS[variant]||{}))actor.bones[name].quaternion.multiply(Q().fromArray(q).invert());actor.group.updateMatrixWorld(true);
 const prop=actor.group.getObjectByName('school-writing-pen'),inverse=prop.matrixWorld.clone().invert(),rig=createFingerRig(actor.group,actor.bones,'Right'),frame=handFrame(actor.bones,'Right'),groups={},all=[];
 actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const {skinIndex:ix,skinWeight:wt}=mesh.geometry.attributes;for(let i=0;i<ix.count;i++){let w=-1,name='';for(let j=0;j<4;j++)if(wt.getComponent(i,j)>w){w=wt.getComponent(i,j);name=mesh.skeleton.bones[ix.getComponent(i,j)].name.replace('mixamorigRightHand','');}if(!['Index','Middle','Pinky','Ring','Thumb'].some(f=>name.startsWith(f)))continue;const f=name.replace(/[123]$/,'');(groups[f]??=[]).push({mesh,i,pad:name.endsWith('3')});all.push({mesh,i});}});
 const fit={};
 for(const finger of ['Index','Thumb','Middle','Pinky','Ring']){
  const digits=rig.digits.filter(d=>d.finger===finger);if(!groups[finger]||!digits.length)continue;const base=digits[0],inv=base.bone.getWorldQuaternion(Q()).invert(),spread=frame.normal.clone().applyQuaternion(inv),opp=frame.along.clone().applyQuaternion(inv),full=groups[finger],pts=full.filter((_,i)=>i%Math.max(1,Math.floor(full.length/120))===0);
  function pose(v){digits.forEach((d,i)=>{d.bone.quaternion.copy(d.rest).multiply(Q().setFromAxisAngle(d.axis,v[i]));if(i===0)d.bone.quaternion.multiply(Q().setFromAxisAngle(spread,v[3])).multiply(Q().setFromAxisAngle(opp,v[4]));});actor.group.updateMatrixWorld(true);const seen=new Set();for(const {mesh}of pts)if(!seen.has(mesh.skeleton)){seen.add(mesh.skeleton);mesh.skeleton.update();}}
  function cost(v,dense=false){pose(v);let score=0,gap=Infinity,depth=0,table=0;for(const{mesh,i,pad}of dense?full:pts){const world=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld),p=world.clone().applyMatrix4(inverse),d=sd(p);depth=Math.max(depth,-d);if(d<-.001)score+=180*(d+.001)**2;if(pad)gap=Math.min(gap,Math.max(0,d));if(Math.abs(world.x)<.6&&world.z>.325&&world.z<1.115){table=Math.max(table,.878-world.y);if(world.y<.879)score+=250*(world.y-.879)**2;}}
   if(['Index','Thumb'].includes(finger))score+=60*Math.max(0,gap-.002)**2;score+=v.reduce((s,a)=>s+a*a,0)*.000008;return{score,depth,gap,table};}
  let values=[0,0,0,0,0],best=cost(values);for(let trial=0;trial<12;trial++){let local=trial?values.map((x,i)=>Math.max(-.68,Math.min(.68,x+.16*Math.sin(trial*12.34+i*7.31)))):[...values],c0=cost(local);for(const step of [.22,.11,.055,.025,.012,.006])for(let pass=0;pass<7;pass++){let changed=false;for(let axis=0;axis<5;axis++)for(const dir of [-1,1]){const v=[...local];v[axis]+=step*dir;if(Math.abs(v[axis])>.72)continue;const c=cost(v);if(c.score<c0.score){local=v;c0=c;changed=true;}}if(!changed)break;}if(c0.score<best.score){values=local;best=c0;}if(best.score<.0000005)break;}
  best=cost(values,true);for(const d of digits)fit[d.bone.name.replace(/^mixamorig[:_]?/,'')]=d.rest.clone().invert().multiply(d.bone.quaternion).toArray();console.log(variant,finger,JSON.stringify({values,...best}));
 }
 result[variant]=fit;actor.dispose();
}
await fs.writeFile(new URL('../dist/writing-grips58.js',import.meta.url),'// Joint rotation deltas fitted to the shared full-size school pen. No mesh scaling.\nexport const WRITING_GRIPS='+JSON.stringify(result)+';\n');
