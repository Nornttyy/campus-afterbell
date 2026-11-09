import fs from 'node:fs/promises';
import * as T from '../dist/vendor/three.module.js';
import {createDeskHands} from '../dist/game-actors.js';
import {createRiggedPalm} from '../dist/student-assets.js';
import {createFingerRig,handFrame} from '../dist/hand-motion.js';
import {loadGeometry} from './gltf-geometry.mjs';
const V=(...a)=>new T.Vector3(...a),Q=()=>new T.Quaternion(),result={};
const sources=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
const cylinders=[[-.055,.065,.0088],[-.0615,-.0165,.0105],[.0695,.0815,.008]];
function sd(p){let d=Infinity;for(const[a,b,r]of cylinders){const x=Math.hypot(p.x,p.z)-r,y=Math.abs(p.y-(a+b)/2)-(b-a)/2;d=Math.min(d,Math.hypot(Math.max(x,0),Math.max(y,0))+Math.min(Math.max(x,y),0));}return d;}
for(const mode of ['write',...Array.from({length:24},(_,i)=>'twirl'+i)]){
 const actor=createDeskHands({createHand:(s,k)=>createRiggedPalm(sources[s<0?0:1],s,k)}),hand=actor.getHand('right'),bones={};hand.group.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
 actor.group.userData.fitPenOffline=true;let time=0;for(let f=0;f<180;f++)actor.update(time+=1/60,{action:'pen',carrying:true,penWriting:mode==='write',freeLook:true});
 if(mode!=='write'){const target=Number(mode.slice(5))*1.6/24;for(let f=0;f<1300;f++){const phase=actor.getDebug().penAge%1.6;if(Math.abs(phase-target)<.01)break;actor.update(time+=1/600,{action:'pen',carrying:true,freeLook:true});}}
 actor.group.updateMatrixWorld(true);const prop=actor.group.getObjectByName('red-school-pen'),inverse=prop.matrixWorld.clone().invert(),rig=createFingerRig(hand.group,bones,'Right'),frame=handFrame(bones,'Right'),groups={};
 hand.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const{skinIndex:ix,skinWeight:wt}=mesh.geometry.attributes;for(let i=0;i<ix.count;i++){let w=-1,name='';for(let j=0;j<4;j++)if(wt.getComponent(i,j)>w){w=wt.getComponent(i,j);name=mesh.skeleton.bones[ix.getComponent(i,j)].name.replace('mixamorigRightHand','');}if(!['Index','Middle','Pinky','Ring','Thumb'].some(f=>name.startsWith(f)))continue;(groups[name.replace(/[123]$/,'')]??=[]).push({mesh,i,pad:name.endsWith('3')});}});
 const fit={};
 for(const finger of ['Index','Thumb','Middle','Pinky','Ring']){const digits=rig.digits.filter(d=>d.finger===finger);if(!groups[finger]||!digits.length)continue;const inv=digits[0].bone.getWorldQuaternion(Q()).invert(),spread=frame.normal.clone().applyQuaternion(inv),opp=frame.along.clone().applyQuaternion(inv),full=groups[finger],pts=full.filter((_,i)=>i%Math.max(1,Math.floor(full.length/240))===0);
  function pose(v){digits.forEach((d,i)=>{d.bone.quaternion.copy(d.rest).multiply(Q().setFromAxisAngle(d.axis,v[i]));if(i===0)d.bone.quaternion.multiply(Q().setFromAxisAngle(spread,v[3])).multiply(Q().setFromAxisAngle(opp,v[4]));});actor.group.updateMatrixWorld(true);const seen=new Set();for(const{mesh}of pts)if(!seen.has(mesh.skeleton)){seen.add(mesh.skeleton);mesh.skeleton.update();}}
  function cost(v,dense=false){pose(v);let score=0,gap=Infinity,depth=0;for(const{mesh,i,pad}of dense?full:pts){const p=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse),d=sd(p);depth=Math.max(depth,-d);if(d<-.0004)score+=900*(d+.0004)**2;if(pad)gap=Math.min(gap,Math.max(0,d));}if(['Index','Thumb'].includes(finger))score+=70*Math.max(0,gap-.0010)**2;score+=v.reduce((s,a)=>s+a*a,0)*.000001;return{score,depth,gap};}
  let values=[0,0,0,0,0],best=cost(values);for(let trial=0;trial<30;trial++){let local=trial?values.map((x,i)=>trial%3===0?1.2*Math.sin(trial*12.34+i*7.31):Math.max(-1.2,Math.min(1.2,x+.3*Math.sin(trial*12.34+i*7.31)))):[...values],c0=cost(local);for(const step of [.28,.14,.07,.03,.012,.006])for(let pass=0;pass<6;pass++){let changed=false;for(let axis=0;axis<5;axis++)for(const dir of [-1,1]){const v=[...local];v[axis]+=step*dir;if(Math.abs(v[axis])>1.3)continue;const c=cost(v);if(c.score<c0.score){local=v;c0=c;changed=true;}}if(!changed)break;}if(c0.score<best.score){values=local;best=c0;}if(best.score<.0000004)break;}
  best=cost(values,true);for(const d of digits)fit[d.bone.name.replace(/^mixamorig[:_]?/,'')]=d.rest.clone().invert().multiply(d.bone.quaternion).toArray();console.log(mode,finger,JSON.stringify({phase:actor.getDebug().penAge%1.6,...best}));
 }
 result[mode]={phase:actor.getDebug().penAge%1.6,bones:fit};
}
await fs.writeFile(new URL('../dist/first-person-pen-fit58.js',import.meta.url),'// Real hand-v3 skin fits for the full-size gel pen; rotations only.\nexport const FIRST_PERSON_PEN_FITS='+JSON.stringify(result)+';\n');
