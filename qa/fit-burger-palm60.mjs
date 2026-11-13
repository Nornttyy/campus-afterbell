// Offline only: fit the unchanged burger GLB to real palm and finger skin.
// Production consumes just the final burger profile, never this optimiser.
import {readFileSync,writeFileSync} from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedPalm} from '../dist/student-assets.js';
import {createDeskItem} from '../dist/game-actors.js';
import {loadPropAssets,CLASSROOM_PROP_SOURCES} from '../dist/prop-assets.js?v=campus-78';
import {WHOLE_PALM_PROFILES} from '../dist/whole-palm-profiles54.js?v=campus-78';
import {loadGeometry} from './gltf-geometry.mjs';
import {handSamplingRig,propSurface} from './whole-palm-geometry54.mjs';
const V=(...a)=>new T.Vector3(...a),Q=()=>new T.Quaternion(),scale=.828;
const fingers=['Index','Middle','Pinky','Thumb'],parts=[...fingers,'Palm','Ring'];
await loadPropAssets({burger:CLASSROOM_PROP_SOURCES.burger},{loader:{loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())}});
const hand=createRiggedPalm(await loadGeometry('hand-left-v3.glb'),-1,scale),rig=handSamplingRig(hand,{samples:100}),prop=createDeskItem('burger');
if(!prop.userData.propAsset)throw Error('The fit requires the actual burger GLB');
const surface=propSurface(prop),original=structuredClone(WHOLE_PALM_PROFILES.burger);
const webEdges=[],webMeshes=[];
hand.group.traverse(mesh=>{
 if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();webMeshes.push(mesh);
 const ix=mesh.geometry.index,p=mesh.geometry.attributes.position,si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight,keys=[],points=[];
 for(let i=0;i<p.count;i++){let strongest=-1,name='';for(let k=0;k<4;k++)if(sw.getComponent(i,k)>strongest){strongest=sw.getComponent(i,k);name=mesh.skeleton.bones[si.getComponent(i,k)].name.replace(/^mixamorig[:_]?/,'');}keys[i]=name;points[i]=mesh.getVertexPosition(i,V());}
 const seen=new Set();for(let i=0;i<(ix?.count||p.count);i+=3){const ids=[0,1,2].map(k=>ix?ix.getX(i+k):i+k);for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=[a,b].sort((a,b)=>a-b).join('/');if(seen.has(key)||!keys[a].startsWith('LeftHand')||!keys[b].startsWith('LeftHand')||!(keys[a].startsWith('LeftHandRing')||keys[b].startsWith('LeftHandRing')))continue;seen.add(key);const rest=points[a].distanceTo(points[b]);if(rest>.001)webEdges.push({mesh,a,b,rest});}}
});
const seed=process.env.GRIP_SEED?JSON.parse(readFileSync(process.env.GRIP_SEED,'utf8')):original;
const profile=structuredClone(seed.profile),offset=V(...seed.position).multiplyScalar(scale),rotation=[...seed.rotation];
const output=process.env.GRIP_OUTPUT||'/tmp/campus60-burger-fit.json';
let randomState=Number(process.env.GRIP_RANDOM||6021)>>>0;
function random(){randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;}
const ranges=f=>f==='Thumb'?[[-.35,1.15],[0,1.2],[.1,1.2],[-.8,1.3],[-.9,.8]]:[[.1,1.35],[.3,1.45],[.25,1.2],[-.65,.65]];
let inverse=Q(),cache={},webCost=0,webMaximum=0;
function orient(){inverse.setFromEuler(new T.Euler(...rotation)).invert();}
function pose(){
 profile.Ring=profile.Middle.map((a,i)=>(a+profile.Pinky[i])/2);
 for(const f of [...fingers,'Ring'])rig.pose(f,profile[f]);
 for(const f of parts)cache[f]=rig.points(f).map(p=>{p.multiplyScalar(scale);return p;});
 webCost=0;webMaximum=0;
 for(const edge of webEdges){const length=edge.mesh.getVertexPosition(edge.a,V()).distanceTo(edge.mesh.getVertexPosition(edge.b,V())),ratio=length/edge.rest;webMaximum=Math.max(webMaximum,ratio);webCost+=Math.max(0,ratio-1.6)**2;}
 webCost=webCost/webEdges.length*.0005+Math.max(0,webMaximum-2.25)**2*.025;
}
orient();pose();
function metric(f){
 let gap=Infinity,padGap=Infinity,depth=0,penetrationCost=0;const segments=[Infinity,Infinity,Infinity];
 for(const v of cache[f]){const p=v.clone().sub(offset).applyQuaternion(inverse),r=surface.query(p);gap=Math.min(gap,r.distance);if(v.pad)padGap=Math.min(padGap,r.distance);if(v.segment)segments[v.segment-1]=Math.min(segments[v.segment-1],r.distance);depth=Math.max(depth,-r.signed);penetrationCost+=Math.max(0,-r.signed-.0008)**2;}
 const contact=f==='Ring'?0:Math.max(0,gap-.0025)**2*(f==='Palm'?160:55);
 const pad=f==='Ring'||f==='Palm'?0:Math.max(0,padGap-.004)**2*15;
 return {gap,padGap,depth,segments,cost:contact+pad+Math.max(0,depth-.0012)**2*2400+penetrationCost/cache[f].length*800};
}
function total(){
 let cost=parts.reduce((sum,f)=>sum+metric(f).cost,0)+webCost;
 // Keep the imported fingers coherent; Ring follows its two visible neighbours.
 for(const f of fingers)for(let j=0;j<profile[f].length;j++)cost+=(profile[f][j]-original.profile[f][j])**2*.000025;
 for(const f of ['Index','Middle','Pinky'])cost+=Math.max(0,1.67-profile[f].slice(0,3).reduce((sum,a)=>sum+a,0))**2*.025;
 for(let j=0;j<3;j++)cost+=(rotation[j]-original.rotation[j])**2*.00008;
 return cost;
}
function metrics(){return Object.fromEntries(parts.map(f=>[f,metric(f)]));}
function save(pass){const result={kind:'burger',position:offset.clone().multiplyScalar(1/scale).toArray(),rotation,palmRoll:original.palmRoll,profile,pass,webMaximum,metrics:metrics()};writeFileSync(output,JSON.stringify(result));return result;}
const passes=Number(process.env.GRIP_PASSES||25);
for(let pass=0;pass<passes;pass++){
 if(pass===8||pass===15||pass===21){rig.resample(pass===8?220:pass===15?420:100000);pose();}
 const jointStep=pass<4?.18:pass<8?.09:pass<15?.045:.018,moveStep=pass<4?.010:pass<8?.005:pass<15?.0025:.0012,rotateStep=pass<4?.10:pass<8?.05:pass<15?.025:.012;
 // Translate/turn the whole real object, then close the fingers around it.
 for(let sweep=0;sweep<2;sweep++){
  for(const axis of ['x','y','z']){const base=offset[axis];let winner=base,best=total();for(const direction of [-1,1]){offset[axis]=base+direction*moveStep;const value=total();if(value<best){best=value;winner=offset[axis];}}offset[axis]=winner;}
  for(let j=0;j<3;j++){const base=rotation[j];let winner=base,best=total();for(const direction of [-1,1]){rotation[j]=T.MathUtils.clamp(base+direction*rotateStep,original.rotation[j]-.65,original.rotation[j]+.65);orient();const value=total();if(value<best){best=value;winner=rotation[j];}}rotation[j]=winner;orient();}
 }
 for(const f of fingers){
  for(let sweep=0;sweep<2;sweep++)for(let j=0;j<profile[f].length;j++){
   const base=profile[f][j];let winner=base,best=total();
   for(const direction of [-1,1]){profile[f][j]=T.MathUtils.clamp(base+direction*jointStep,...ranges(f)[j]);pose();const value=total();if(value<best){best=value;winner=profile[f][j];}}
   profile[f][j]=winner;pose();
  }
  if(pass<15&&pass%3===2){let winner=[...profile[f]],best=total();for(let trial=0;trial<15;trial++){profile[f]=winner.map((v,j)=>T.MathUtils.clamp(v+(random()-.5)*jointStep*3,...ranges(f)[j]));pose();const value=total();if(value<best){best=value;winner=[...profile[f]];}}profile[f]=winner;pose();}
 }
 const result=save(pass);console.log(JSON.stringify({pass,cost:total(),position:result.position,metrics:Object.fromEntries(Object.entries(result.metrics).map(([f,m])=>[f,{gapMM:m.gap*1000,padGapMM:m.padGap*1000,depthMM:m.depth*1000}]))}));
}
rig.resample(100000);pose();save(passes);
