import * as T from './vendor/three.module.js';
import {handFrame} from './hand-motion.js?v=campus-74';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Q=()=>new T.Quaternion();
const clamp=T.MathUtils.clamp;
function frame(along,normal){const y=along.clone().normalize(),z=normal.clone().addScaledVector(y,-normal.dot(y)).normalize(),x=V().crossVectors(y,z).normalize();return Q().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
// Longer alternating reaches slow the crawl without speeding up world travel.
export const CRAWL_GAIT=Object.freeze({stride:.34,stance:.70});
const {stride:STRIDE,stance:STANCE}=CRAWL_GAIT;
function contactCycle(phase){
 if(phase<STANCE)return{sweep:STRIDE*.5-STRIDE*phase/STANCE,lift:0};
 const u=(phase-STANCE)/(1-STANCE),u2=u*u,u3=u2*u,m=-STRIDE*(1-STANCE)/STANCE;
 return{sweep:(2*u3-3*u2+1)*(-STRIDE*.5)+(u3-2*u2+u)*m+(-2*u3+3*u2)*(STRIDE*.5)+(u3-u2)*m,lift:Math.sin(Math.PI*u)**2};
}

// Reversible full-body pose layered after the ordinary animation mixer. No
// mesh scale, bone length or skin weights are changed. Goals are in character
// coordinates and solved through each imported bone's actual parent frame.
export function createCrawlPose(group,bones){
 const names=['Hips','Spine','Spine1','Spine2','Neck','Head',...['Left','Right'].flatMap(s=>['Shoulder','Arm','ForeArm','Hand','UpLeg','Leg','Foot','ToeBase'].map(n=>s+n)),...Object.keys(bones).filter(n=>/Hand(?:Thumb|Index|Middle|Ring|Pinky)\d$/.test(n))];
 const controlled=[...new Set(names.map(n=>bones[n]).filter(Boolean))],reference=new Map(),saved=new Map();
 group.updateMatrixWorld(true);const characterInverse=group.getWorldQuaternion(Q()).invert();
 for(const b of controlled)reference.set(b,{q:b.quaternion.clone(),p:b.position.clone(),world:characterInverse.clone().multiply(b.getWorldQuaternion(Q()))});
 const at=n=>group.worldToLocal(bones[n].getWorldPosition(V())),hands={},feet={},limbs={};
 for(const [side,sign]of [['Left',1],['Right',-1]]){
  const h=handFrame(bones,side),inv=bones[side+'Hand'].getWorldQuaternion(Q()).invert();
  hands[side]={basis:frame(h.along.clone().applyQuaternion(inv),h.normal.clone().applyQuaternion(inv)).invert(),sign,height:.04};
  feet[side]={height:at(side+'Foot').y};
  limbs[side]={arm:at(side+'Arm').distanceTo(at(side+'ForeArm'))+at(side+'ForeArm').distanceTo(at(side+'Hand')),leg:at(side+'UpLeg').distanceTo(at(side+'Leg'))+at(side+'Leg').distanceTo(at(side+'Foot')),hipX:at(side+'UpLeg').x};
 }
 const meshes=[];group.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 // Contact padding comes from delivered sole geometry, not a guessed ankle
 // joint height. Palm padding is measured after its flat orientation below.
 const samples={};for(const side of ['Left','Right'])for(const part of ['Foot','Hand']){
  const key=side+part,list=[];for(const mesh of meshes){const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;
   for(let i=0;i<si.count;i++){let w=0;for(let k=0;k<4;k++){const n=mesh.skeleton.bones[si.getComponent(i,k)]?.name.replace(/^mixamorig[:_]?/,'');if(part==='Foot'?(n===key||n?.startsWith(side+'Toe')):n?.startsWith(key))w+=sw.getComponent(i,k);}if(w>(part==='Foot'?.5:.8))list.push({mesh,index:i});}
  }samples[key]=list;
 }
 function minimumY(list){group.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();let y=Infinity;for(const s of list)y=Math.min(y,group.worldToLocal(s.mesh.getVertexPosition(s.index,V()).applyMatrix4(s.mesh.matrixWorld)).y);return y;}
 for(const side of ['Left','Right'])feet[side].height=Math.max(.015,at(side+'Foot').y-minimumY(samples[side+'Foot']))+.005;
 function worldRotation(bone,rotation){bone.quaternion.copy(bone.parent.getWorldQuaternion(Q()).invert().multiply(group.getWorldQuaternion(Q())).multiply(rotation));bone.updateWorldMatrix(true,true);}
 for(const side of ['Left','Right']){
  const bone=bones[side+'Hand'],q=bone.quaternion.clone();worldRotation(bone,frame(V(0,0,1),V(0,1,0)).multiply(hands[side].basis));
  hands[side].height=Math.max(.015,at(side+'Hand').y-minimumY(samples[side+'Hand']))+.002;bone.quaternion.copy(q);bone.updateWorldMatrix(true,true);
 }
 const legLength=(limbs.Left.leg+limbs.Right.leg)*.5,hipHeight=.20+legLength*.11;
 const supportSamples=Object.values(samples).flat();
 let blend=0,phase=0,lastTime=null,travel=0,gaitWeight=0,transitionFrom=0,transitionTo=0,transitionAge=0;
 function aim(bone,child,target){
  group.updateMatrixWorld(true);const root=bone.getWorldPosition(V()),from=child.getWorldPosition(V()).sub(root).normalize(),to=target.clone().sub(root).normalize(),parent=bone.parent.getWorldQuaternion(Q());
  bone.quaternion.premultiply(parent.clone().invert().multiply(Q().setFromUnitVectors(from,to)).multiply(parent));bone.updateWorldMatrix(true,true);
 }
 function solve(a,b,c,target,pole){
  group.updateMatrixWorld(true);const origin=a.getWorldPosition(V()),middle=b.getWorldPosition(V()),end=c.getWorldPosition(V()),l1=origin.distanceTo(middle),l2=middle.distanceTo(end),goal=group.localToWorld(target.clone()),direction=goal.clone().sub(origin),d=clamp(direction.length(),Math.abs(l1-l2)+.001,l1+l2-.001);direction.normalize();
  const bend=group.localToWorld(pole.clone()).sub(origin);bend.addScaledVector(direction,-bend.dot(direction)).normalize();const along=(l1*l1-l2*l2+d*d)/(2*d),joint=origin.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
  aim(a,b,joint);aim(b,c,origin.addScaledVector(direction,d));
 }
 function restore(){for(const[b,s]of saved){b.quaternion.copy(s.q);if(b===bones.Hips)b.position.copy(s.p);}saved.clear();}
 function apply({active=false,time=0,dt=0,speed=0,reset=false}={}){
  if(saved.size)restore();
  const rewind=reset||(lastTime!==null&&time<lastTime);lastTime=time;
  if(rewind){blend=active?1:0;transitionFrom=transitionTo=blend;transitionAge=.65;phase=0;travel=0;gaitWeight=active&&speed>.015?1:0;}
  else{const goal=active?1:0;if(goal!==transitionTo){transitionFrom=blend;transitionTo=goal;transitionAge=0;}transitionAge=Math.min(.65,transitionAge+Math.max(0,dt));blend=T.MathUtils.lerp(transitionFrom,transitionTo,T.MathUtils.smoothstep(transitionAge,0,.65));}
  if(blend<.0001&&!active){blend=0;return;}
  const amount=clamp(Number(speed)||0,0,1.8),cycle=STRIDE/STANCE;
  gaitWeight=T.MathUtils.damp(gaitWeight,active&&amount>.015?1:0,12,Math.max(0,dt));
  if(active&&amount>.015){travel+=amount*Math.max(0,dt);phase=travel/cycle;}
  for(const b of controlled){saved.set(b,{q:b.quaternion.clone(),p:b.position.clone()});b.quaternion.copy(reference.get(b).q);}
  const hips=bones.Hips,pelvis=at('Hips');pelvis.y=hipHeight;pelvis.z=0;hips.position.copy(hips.parent.worldToLocal(group.localToWorld(pelvis)));
  aim(hips,bones.Spine2,group.localToWorld(V(0,hipHeight+.025,.55)));
  // The large head remains readable and faces forward, independent of the
  // near-horizontal torso; this cannot be achieved by lowering a standing rig.
  worldRotation(bones.Head,Q().setFromAxisAngle(V(1,0,0),.08).multiply(reference.get(bones.Head).world));
  for(const [side,sign]of [['Left',1],['Right',-1]]){
   const p=((phase+(side==='Left'?0:.5))%1+1)%1,handCycle=contactCycle(p),swing=handCycle.lift*gaitWeight,sweep=handCycle.sweep*gaitWeight;
   const shoulder=at(side+'Arm'),handGoal=V(shoulder.x+sign*.045,hands[side].height+swing*.045,shoulder.z+.055+sweep);
   solve(bones[side+'Arm'],bones[side+'ForeArm'],bones[side+'Hand'],handGoal,V(shoulder.x+sign*.30,shoulder.y-.045,shoulder.z-.10));
   worldRotation(bones[side+'Hand'],frame(V(sign*.12,0,1),V(0,1,0)).multiply(hands[side].basis));
   const footCycle=contactCycle((p+.5)%1),footLift=footCycle.lift*gaitWeight,footSweep=footCycle.sweep*gaitWeight;
   const hip=at(side+'UpLeg'),footGoal=V(hip.x+sign*.09,feet[side].height+footLift*.025,hip.z-.28*limbs[side].leg/.53+footSweep);
   solve(bones[side+'UpLeg'],bones[side+'Leg'],bones[side+'Foot'],footGoal,V(hip.x+sign*.29,hip.y-.025,hip.z+.22));
   worldRotation(bones[side+'Foot'],reference.get(bones[side+'Foot']).world);
   const sole=minimumY(samples[side+'Foot']);if(sole<.001){footGoal.y+=.001-sole;solve(bones[side+'UpLeg'],bones[side+'Leg'],bones[side+'Foot'],footGoal,V(hip.x+sign*.29,hip.y-.025,hip.z+.22));worldRotation(bones[side+'Foot'],reference.get(bones[side+'Foot']).world);}
  }
  for(const[b,s]of saved){b.quaternion.slerpQuaternions(s.q,b.quaternion.clone(),blend);if(b===hips)b.position.lerpVectors(s.p,b.position.clone(),blend);}
  // A quaternion crossfade alone drops the still-extended shoes below the
  // floor on entry/exit. Preserve contact using delivered skinned soles and
  // palms while the knees fold, rather than shrinking legs or guessing a bob.
  if(blend<.999){const low=minimumY(supportSamples);if(low<0){const p=at('Hips');p.y-=low;hips.position.copy(hips.parent.worldToLocal(group.localToWorld(p)));}}
  group.updateMatrixWorld(true);
 }
 return{restore,apply,state:()=>({blend,phase,hipHeight,handHeight:{Left:hands.Left.height,Right:hands.Right.height}})};
}
