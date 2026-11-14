import {readFileSync} from 'node:fs';
import {loadGeometry} from './gltf-geometry.mjs';
import {createRiggedPalm} from '../dist/student-assets.js';
import {createDeskItem} from '../dist/game-actors.js';
import {loadPropAssets,CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-79';
import * as T from '../dist/vendor/three.module.js';
import {propSurface,handSamplingRig} from './whole-palm-geometry54.mjs';
const V=(...a)=>new T.Vector3(...a),Q=()=>new T.Quaternion(),fingers=['Index','Middle','Pinky','Thumb'];
await loadPropAssets(CLASSROOM_PROP_SOURCES,{loader:{loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())}});
const source=await loadGeometry('hand-left-v3.glb');
for(const kind of process.argv.slice(2).length?process.argv.slice(2):['banana']){
 const hand=createRiggedPalm(source,-1,.828),rig=handSamplingRig(hand,{samples:100}),prop=createDeskItem(kind),surface=propSurface(prop),bounds=surface.bounds,size=bounds.getSize(V()),center=bounds.getCenter(V());
 if(Object.hasOwn(CLASSROOM_PROP_SOURCES,kind)&&!prop.userData.propAsset)throw new Error(kind+' must use the production GLB');
 const baseY=kind==='snack'?.17:kind==='burger'||kind==='lunch'?.12:.10;
 const rotation=[0,0,kind==='snack'?0:kind==='banana'?Math.PI*.75:Math.PI/2],startQ=Q().setFromEuler(new T.Euler(...rotation));
 const offset=V(0,baseY,-size.z/2-.025).sub(center.clone().applyQuaternion(startQ));
 let profile={Index:[.55,1.0,.75,0],Middle:[.55,1.0,.75,0],Pinky:[.55,1.0,.75,.12],Thumb:[.2,.40,.40,1.2,-.5]};
 if(process.env.GRIP_SEED){const seed=readFileSync(process.env.GRIP_SEED,'utf8').trim().split('\n').map(JSON.parse).find(d=>d.kind===kind);if(seed){offset.fromArray(seed.position).multiplyScalar(.828);rotation.splice(0,3,...seed.rotation);profile=seed.profile;}}
 for(const f of fingers){const limits=f==='Thumb'?[[-.35,1.15],[0,1.3],[0,1.2],[-1.5,1.75],[-1.1,1.1]]:[[.1,1.5],[.35,1.5],[.25,1.3],[-.85,.85]];profile[f]=profile[f].map((a,i)=>T.MathUtils.clamp(a,...limits[i]));}
 profile.Ring=profile.Middle.map((a,i)=>(a+profile.Pinky[i])/2);rig.pose('Ring',profile.Ring);
 const cache={};function pose(finger){rig.pose(finger,profile[finger]);if(finger==='Middle'||finger==='Pinky'){profile.Ring=profile.Middle.map((a,i)=>(a+profile.Pinky[i])/2);rig.pose('Ring',profile.Ring);}cache[finger]=rig.points(finger).map(p=>p.multiplyScalar(.828));cache.Palm=rig.points('Palm').map(p=>p.multiplyScalar(.828));}
 for(const f of fingers)pose(f);cache.Palm=rig.points('Palm').map(p=>p.multiplyScalar(.828));
 let inverse=Q();const q=Q();function orient(){q.setFromEuler(new T.Euler(...rotation));inverse=q.clone().invert();}orient();
 function metric(finger){let min=Infinity,maxDepth=0,totalDepth=0;const segments=[Infinity,Infinity,Infinity];for(const world of cache[finger]){const p=world.clone().sub(offset).applyQuaternion(inverse),r=surface.query(p),depth=Math.max(0,-r.signed-.0011);if(world.pad)min=Math.min(min,r.distance);if(world.segment)segments[world.segment-1]=Math.min(segments[world.segment-1],r.distance);maxDepth=Math.max(maxDepth,depth);totalDepth+=depth*depth;}const long=finger!=='Thumb'&&finger!=='Palm',shaft=long?Math.max(0,segments[1]-.004)**2*5:0;return {gap:min,segments,penetration:maxDepth,cost:Math.max(0,min-(finger==='Palm'?.005:.0015))**2*(finger==='Palm'?12:70)+shaft+maxDepth**2*1800+totalDepth/cache[finger].length*400};}
 function digitCost(f){const m=metric(f),curl=profile[f].slice(0,3).reduce((a,b)=>a+b,0);return m.cost+metric('Palm').cost+Math.max(0,(f==='Thumb'?.6:kind==='snack'?1.5:2.1)-curl)**2*.005+profile[f].reduce((n,a,i)=>n+(a-(i<3?.55:0))**2*.000001,0);}
 function total(){return fingers.reduce((n,f)=>n+digitCost(f),0)+metric('Palm').cost+offset.x**2*.02+(offset.y-baseY)**2*.3;}
 const ranges=f=>f==='Thumb'?[[-.35,1.15],[0,1.3],[0,1.2],[-1.5,1.75],[-1.1,1.1]]:[[.1,1.5],[.35,1.5],[.25,1.3],[-.85,.85]];
 for(let pass=0;pass<25;pass++){
  if(pass===14||pass===20){rig.resample(pass===14?350:1200);for(const f of fingers)pose(f);cache.Palm=rig.points('Palm').map(p=>p.multiplyScalar(.828));}
  const step=pass<3?.35:pass<6?.18:pass<12?.08:pass<16?.035:.012;
  for(const finger of fingers){
   if(pass%3===0){let best=digitCost(finger),winning=[...profile[finger]];for(let trial=0;trial<150;trial++){profile[finger]=winning.map((v,j)=>T.MathUtils.clamp(v+(Math.random()-.5)*(pass<6?1.2:.5),...ranges(finger)[j]));pose(finger);const cost=digitCost(finger);if(cost<best){best=cost;winning=[...profile[finger]];}}profile[finger]=winning;pose(finger);}
   for(let sweep=0;sweep<3;sweep++)for(let j=0;j<profile[finger].length;j++){
   const base=profile[finger][j];let value=base,best=digitCost(finger);
   for(const sign of [-1,1]){profile[finger][j]=T.MathUtils.clamp(base+sign*step,...ranges(finger)[j]);pose(finger);const cost=digitCost(finger);if(cost<best){best=cost;value=profile[finger][j];}}
   profile[finger][j]=value;pose(finger);
  }}
  for(const f of fingers)cache[f]=rig.points(f).map(p=>p.multiplyScalar(.828));cache.Palm=rig.points('Palm').map(p=>p.multiplyScalar(.828));
  for(let sweep=0;sweep<2;sweep++)for(const axis of ['x','y','z']){const base=offset[axis];let value=base,best=total();for(const sign of [-1,1]){offset[axis]=base+sign*(pass<4?.012:pass<8?.005:.002);const cost=total();if(cost<best){best=cost;value=offset[axis];}}offset[axis]=value;}
 }
 console.log(JSON.stringify({kind,position:offset.clone().multiplyScalar(1/.828).toArray(),rotation,palmRoll:-Math.PI/2,profile,metrics:Object.fromEntries([...fingers,'Palm'].map(f=>[f,metric(f)]))}));
}
