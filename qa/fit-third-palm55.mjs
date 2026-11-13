// Offline only: fit the real third-person hand skin to production props.
// No character scale, bone translation, prop scale, or runtime solver changes.
import {readFileSync,writeFileSync} from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import {createFingerRig,handFrame} from '../dist/hand-motion.js?v=campus-75';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js?v=campus-75';
import {loadPropAssets,CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-75';
import {loadGeometry} from './gltf-geometry.mjs';
import {propSurface} from './whole-palm-geometry54.mjs';
const V=(...a)=>new T.Vector3(...a),Q=()=>new T.Quaternion(),digits=['Index','Middle','Pinky','Thumb'];
const names={drink:'red-drink-can',banana:'curved-banana',burger:'layered-burger'};
await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:{loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())}});
const variants=process.argv[2]?process.argv[2].split(','):['boy','girl'];
const kinds=process.argv[3]?process.argv[3].split(','):Object.keys(names),output=[];
let randomState=5509;function random(){randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;}
for(const variant of variants)for(const kind of kinds){
 const gltf=await loadGeometry(STUDENT_ASSETS[variant].file+'.glb'),sourceBones={};gltf.scene.traverse(o=>{if(o.isBone)sourceBones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
 const neutral=createFingerRig(gltf.scene,sourceBones,'Left'),anatomy=handFrame(sourceBones,'Left');
 const chains=Object.fromEntries([...digits,'Ring'].map(f=>{const d=neutral.digits.filter(d=>d.finger===f),inv=d[0].bone.getWorldQuaternion(Q()).invert();return[f,{digits:d,spread:anatomy.normal.clone().applyQuaternion(inv),opposition:anatomy.along.clone().applyQuaternion(inv)}];}));
 const actor=createRiggedStudent(gltf,{variant,seated:true});actor.setMood(kind);actor.setMotion({seated:true,carrying:true,heldAction:kind,using:true});for(let frame=1;frame<=120;frame++)actor.update(frame/60);actor.group.updateMatrixWorld(true);
 const anchor=actor.getHand('left'),inverseAnchor=anchor.matrixWorld.clone().invert(),prop=actor.group.getObjectByName(names[kind]);if(!prop?.userData.propAsset)throw Error(`${variant}/${kind}: not the production GLB`);
 const surface=propSurface(prop),originalPosition=prop.position.clone(),offset=prop.position.clone(),rotation=[prop.rotation.x,prop.rotation.y,prop.rotation.z],orient=Q(),inverse=Q();
 const all=Object.fromEntries([...digits,'Palm'].map(k=>[k,[]])),meshes=[];
 actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;meshes.push(mesh);const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;for(let i=0;i<si.count;i++){let n=-1,weight=0;for(let k=0;k<4;k++)if(sw.getComponent(i,k)>weight){weight=sw.getComponent(i,k);n=si.getComponent(i,k);}const key=mesh.skeleton.bones[n].name.replace(/^mixamorig[:_]?/,'');const part=(key==='LeftHand'||key.startsWith('LeftHandRing'))?'Palm':digits.find(p=>key.startsWith('LeftHand'+p));if(part)all[part].push({mesh,i,pad:key.endsWith('3'),segment:Number(key.slice(-1))||0});}});
 let samples=100,groups={},cache={},profile={Index:[.55,.8,.6,0],Middle:[.55,.8,.6,0],Pinky:[.55,.8,.6,.05],Thumb:[.15,.35,.3,1,-.3]};
 function sample(count){samples=count;groups=Object.fromEntries(Object.entries(all).map(([key,pts])=>[key,Array.from({length:Math.min(count,pts.length)},(_,i)=>pts[Math.floor(i*pts.length/Math.min(count,pts.length))])]));}
 function recache(f){actor.group.updateMatrixWorld(true);for(const m of meshes)m.skeleton.update();cache[f]=groups[f].map(({mesh,i,pad,segment})=>{const p=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverseAnchor);p.pad=pad;p.segment=segment;return p;});}
 function poseChain(f,values){const chain=chains[f];chain.digits.forEach((d,i)=>{d.bone.quaternion.copy(d.rest).multiply(Q().setFromAxisAngle(d.axis,values[i]));if(i===0){d.bone.quaternion.multiply(Q().setFromAxisAngle(chain.spread,values[3]||0));if(f==='Thumb')d.bone.quaternion.multiply(Q().setFromAxisAngle(chain.opposition,values[4]||0));}});}
 function pose(f){poseChain(f,profile[f]);if(f==='Middle'||f==='Pinky'){profile.Ring=profile.Middle.map((v,i)=>(v+profile.Pinky[i])*.5);poseChain('Ring',profile.Ring);for(const part of digits)recache(part);}else recache(f);if(cache.Palm)recache('Palm');}
 function orientProp(){orient.setFromEuler(new T.Euler(...rotation));inverse.copy(orient).invert();}
 const seed=process.env.THIRD_GRIP_SEED?JSON.parse(readFileSync(process.env.THIRD_GRIP_SEED,'utf8')).find(r=>r.variant===variant&&r.kind===kind):null;
 if(seed){offset.fromArray(seed.position);rotation.splice(0,3,...seed.rotation);profile=structuredClone(seed.profile);}
 sample(samples);for(const f of digits)pose(f);recache('Palm');orientProp();
 if(process.env.FIT_PALM_SEAT==='1'){
  let best=Infinity,shift=V();for(const point of cache.Palm){const p=point.clone().sub(offset).applyQuaternion(inverse),r=surface.query(p);if(r.distance<best){best=r.distance;shift.copy(p).sub(r.point).applyQuaternion(orient);}}
  if(best>.006)offset.addScaledVector(shift,1-.006/best);
 }
 const contactSeat=process.env.FIT_CONTACT_SEAT||(process.env.FIT_PINKY_SEAT==='1'?'Pinky':null);
 if(contactSeat&&digits.includes(contactSeat)){
  let best=Infinity,shift=V();for(const point of cache[contactSeat].filter(p=>p.pad)){const p=point.clone().sub(offset).applyQuaternion(inverse),r=surface.query(p);if(r.distance<best){best=r.distance;shift.copy(p).sub(r.point).applyQuaternion(orient);}}
  if(best>.0015)offset.addScaledVector(shift,1-.0015/best);
 }
 function metric(f){let gap=Infinity,padGap=Infinity,depth=0,squares=0,inside=0;const segments=[Infinity,Infinity,Infinity];for(const point of cache[f]){const r=surface.query(point.clone().sub(offset).applyQuaternion(inverse)),d=Math.max(0,-r.signed-.0012);gap=Math.min(gap,r.distance);if(point.pad)padGap=Math.min(padGap,r.distance);if(point.segment)segments[point.segment-1]=Math.min(segments[point.segment-1],r.distance);depth=Math.max(depth,d);squares+=d*d;if(r.signed<-.002)inside++;}
  const required=f==='Palm'?.008:f==='Pinky'?.002:.0018,contact=f==='Palm'?gap:padGap,weight=f==='Thumb'||f==='Index'?28:f==='Palm'?(Number(process.env.FIT_PALM_WEIGHT)||8):f==='Pinky'?80:12;
  const shaft=f==='Index'||f==='Middle'||f==='Pinky'?Math.max(0,segments[1]-.010)**2*2:0;
  return{gap,padGap,segments,depth,inside,samples:cache[f].length,cost:Math.max(0,contact-required)**2*weight+shaft+depth**2*(Number(process.env.FIT_DEPTH_WEIGHT)||3000)+squares/Math.max(1,cache[f].length)*600};
 }
 function fingerCost(f){const curl=profile[f].slice(0,3).reduce((a,b)=>a+b,0);return metric(f).cost+metric('Palm').cost+Math.max(0,(f==='Thumb'?.25:1.0)-curl)**2*.0003+profile[f].reduce((a,v,i)=>a+v*v*(i>2?.00003:.000002),0);}
 function total(){return digits.reduce((n,f)=>n+fingerCost(f),0)+metric('Palm').cost+offset.distanceToSquared(originalPosition)*.004;}
 const ranges=f=>f==='Thumb'?[[-.7,1.4],[-.2,1.5],[-.2,1.4],[-2.5,2.5],[-1.8,1.8]]:f==='Pinky'?[[-.1,1.8],[-.1,1.8],[-.1,1.5],[-1.2,1.0]]:[[-.35,1.45],[-.1,1.7],[-.1,1.5],[-.7,.7]];
 const steps=Number(process.env.FIT_PASSES)||24;
 for(let pass=0;pass<steps;pass++){
  if(pass===12||pass===18){sample(pass===12?350:100000);for(const f of digits)pose(f);recache('Palm');}
  const step=pass<3?.35:pass<6?.18:pass<12?.08:pass<18?.035:.012;
  for(const f of digits){
   if(process.env.FIT_DIGITS&&!process.env.FIT_DIGITS.split(',').includes(f))continue;
   if(pass%3===0){let winning=[...profile[f]],best=fingerCost(f);for(let trial=0;trial<(pass<12?300:50);trial++){profile[f]=winning.map((v,j)=>{const[lo,hi]=ranges(f)[j];return pass<12&&trial%7===0?lo+random()*(hi-lo):T.MathUtils.clamp(v+(random()-.5)*(pass<6?1.2:.5),lo,hi);});pose(f);const cost=fingerCost(f);if(cost<best){best=cost;winning=[...profile[f]];}}profile[f]=winning;pose(f);}
   for(let sweep=0;sweep<2;sweep++)for(let j=0;j<profile[f].length;j++){const base=profile[f][j];let value=base,best=fingerCost(f);for(const sign of[-1,1]){profile[f][j]=T.MathUtils.clamp(base+sign*step,...ranges(f)[j]);pose(f);const cost=fingerCost(f);if(cost<best){best=cost;value=profile[f][j];}}profile[f][j]=value;pose(f);}
  }
  for(let sweep=0;sweep<(process.env.FIT_FIXED_PROP==='1'?0:2);sweep++)for(let dim=0;dim<6;dim++){
   const axis=['x','y','z'][dim],base=dim<3?offset[axis]:rotation[dim-3];let value=base,best=total();
   for(const sign of[-1,1]){const delta=dim<3?(pass<4?.014:pass<9?.006:pass<18?.002:.0007):(pass<4?.18:pass<9?.08:pass<18?.025:.008),v=base+sign*delta;if(dim<3)offset[axis]=v;else rotation[dim-3]=v;orientProp();const cost=total();if(cost<best){best=cost;value=v;}}
   if(dim<3)offset[axis]=value;else rotation[dim-3]=value;orientProp();
  }
  if(pass%4===3)console.error(variant,kind,pass+1,'cost',total().toFixed(6),Object.fromEntries([...digits,'Palm'].map(f=>[f,+(metric(f).depth*1000).toFixed(2)])));
 }
 sample(100000);for(const f of digits)pose(f);recache('Palm');const bones=Object.fromEntries(Object.entries(actor.bones).filter(([name])=>/^LeftHand(?:Index|Middle|Pinky|Thumb|Ring)\d$/.test(name)).map(([name,bone])=>[name,bone.quaternion.toArray()]));
 const row={variant,kind,position:offset.toArray(),rotation,bones,profile,metrics:Object.fromEntries([...digits,'Palm'].map(f=>[f,metric(f)])),asset:prop.userData.propAsset};output.push(row);
 writeFileSync(process.env.THIRD_GRIP_OUTPUT||'/tmp/third-person-grips55.json',JSON.stringify(output,null,2));console.error('DONE',variant,kind);actor.dispose();
}
console.log(JSON.stringify(output,null,2));
