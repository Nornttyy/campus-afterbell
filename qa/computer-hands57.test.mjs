import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js';
import {createRoomVariants} from '../dist/room-variants.js';
import {createSoloRound} from '../dist/solo-round.js';
import {CampusRoom} from '../server/room-simulation.js';
import {loadGeometry} from './gltf-geometry.mjs';

function keyboardBoxes(){
 const scene=new T.Scene(),boxes=[],mat=(color,opts={})=>new T.MeshBasicMaterial({color}),box=(material,p,size,rotation,parent)=>{const mesh=new T.Mesh(new T.BoxGeometry(...size),material);mesh.position.fromArray(p);if(rotation)mesh.rotation.fromArray(rotation);parent.add(mesh);if(size[0]===.035&&size[1]===.008&&size[2]===.029)boxes.push(mesh);return mesh;};
 const room=createRoomVariants({scene,box,rounded:(m,p,s,r,rot,parent)=>box(m,p,s,rot,parent),mat,texture:()=>null,bakeStatic:()=>{}});
 room.setSeats([{id:0,deskX:0,deskZ:.78,x:0,z:0,yaw:0}]);room.setMap('computer');scene.updateMatrixWorld(true);
 return boxes.filter(mesh=>mesh.parent.parent===room.stations.get(0)).map(mesh=>new T.Box3().setFromObject(mesh));
}
const keys=keyboardBoxes();assert.equal(keys.length,33);
function handSkin(actor){const points=[];actor.group.updateMatrixWorld(true);actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const {skinIndex,skinWeight}=mesh.geometry.attributes;for(let i=0;i<skinIndex.count;i++){let max=-1,j=0;for(let k=0;k<4;k++)if(skinWeight.getComponent(i,k)>max){max=skinWeight.getComponent(i,k);j=skinIndex.getComponent(i,k);}if(/(?:Left|Right)Hand/.test(mesh.skeleton.bones[j].name))points.push({mesh,index:i});}});return points;}

for(const [variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: computer uses both real hands above keyboard, not Write, with alternating presses`,async t=>{
 const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true}),points=handSkin(actor),tips={Left:[],Right:[]};
 actor.setMood('computer');actor.setMotion({seated:true,carrying:false});let time=0,maxDeskDepth=0,maxKeyDepth=0,worstKey=null;
 for(let frame=0;frame<300;frame++){
  actor.update(time+=1/60);if(frame<180)continue;
  const d=actor.diagnostics();assert.ok(d.weights.Write<1e-8);assert.equal(actor.group.getObjectByName('held-writing-pencil').visible,false);
  for(const side of ['Left','Right']){const p=d.gestures.typingTips[side];assert.ok(p[2]>.519&&p[2]<.55,`${side} finger misses the real near key row: ${p}`);assert.ok(p[1]>.899&&p[1]<.915,`${side} finger floats or penetrates keys: ${p}`);tips[side].push(p[1]);}
  if(frame%12)continue;actor.group.updateMatrixWorld(true);const updated=new Set();
  for(const {mesh,index}of points){if(!updated.has(mesh.skeleton)){mesh.skeleton.update();updated.add(mesh.skeleton);}const p=mesh.getVertexPosition(index,new T.Vector3()).applyMatrix4(mesh.matrixWorld);
   if(Math.abs(p.x)<.61&&p.z>.38&&p.z<1.18)maxDeskDepth=Math.max(maxDeskDepth,.8625-p.y);
   for(const key of keys)if(p.x>key.min.x&&p.x<key.max.x&&p.z>key.min.z&&p.z<key.max.z&&key.max.y-p.y>maxKeyDepth){maxKeyDepth=key.max.y-p.y;worstKey={index,position:p.toArray(),joints:[0,1,2,3].map(k=>mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(index,k)].name)};}
  }
 }
 assert.ok(maxDeskDepth<.001,`hand skin enters desktop: ${maxDeskDepth}`);assert.ok(maxKeyDepth<.002,`hand skin enters keyboard: ${maxKeyDepth} ${JSON.stringify(worstKey)}`);
 for(const side of ['Left','Right'])assert.ok(Math.max(...tips[side])-Math.min(...tips[side])>.005,`${side} does not press keys`);
 const mean=a=>a.reduce((x,y)=>x+y,0)/a.length,lm=mean(tips.Left),rm=mean(tips.Right),correlation=mean(tips.Left.map((y,i)=>(y-lm)*(tips.Right[i]-rm)))/Math.sqrt(mean(tips.Left.map(y=>(y-lm)**2))*mean(tips.Right.map(y=>(y-rm)**2)));
 assert.ok(correlation<-.65,'hands must alternate, not move together');
 const reference=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true});reference.setMood('resting');for(let f=1;f<=300;f++)reference.update(f/60);reference.group.updateMatrixWorld(true);
 const neutralHead=actor.bones.Head.getWorldQuaternion(new T.Quaternion()),seatedHead=reference.bones.Head.getWorldQuaternion(new T.Quaternion());assert.ok(neutralHead.angleTo(seatedHead)<.01,'computer torso lean forces the head down into the keyboard');reference.dispose();
 actor.setMotion({seated:true,lookYaw:.55,lookPitch:.30});for(let f=0;f<60;f++)actor.update(time+=1/60);actor.group.updateMatrixWorld(true);assert.ok(actor.bones.Head.getWorldQuaternion(new T.Quaternion()).angleTo(neutralHead)>.25,'computer pose locks a human head to the screen');actor.setMotion({seated:true,lookYaw:0,lookPitch:0});
 actor.setMood('writing');for(let f=0;f<180;f++)actor.update(time+=1/60);assert.ok(actor.diagnostics().weights.Write>.999);assert.equal(actor.group.getObjectByName('held-writing-pencil').visible,true);
 actor.setMood('pen');actor.setMotion({seated:true,heldAction:'pen',penTwirling:true});for(let f=0;f<120;f++)actor.update(time+=1/60);assert.ok(actor.diagnostics().pen.blend>.99);
 t.diagnostic(JSON.stringify({maxDeskDepth,maxKeyDepth,correlation}));actor.dispose();
});

for(const [variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: computer idle rests both hands on the clear front desk edge`,async t=>{
 const actor=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:true}),points=handSkin(actor),lengths=Object.values(actor.bones).map(b=>[b,b.position.clone()]);
 actor.setMotion({seated:true,carrying:false});actor.setMood('computer');let time=0;
 for(let f=0;f<180;f++)actor.update(time+=1/60);
 const typed=actor.diagnostics().gestures.typingTips;actor.setMood('computer-idle');
 let maxDepth=0,furthest=0,maxStep=0;const gap={Left:Infinity,Right:Infinity},rest={Left:[],Right:[]},previous=Object.fromEntries(['Left','Right'].map(side=>[side,actor.bones[side+'Hand'].getWorldPosition(new T.Vector3())]));
 for(let f=0;f<300;f++){
  actor.update(time+=1/60);const d=actor.diagnostics();assert.equal(actor.group.getObjectByName('held-writing-pencil').visible,false);assert.ok(d.weights.Write<1e-8);
  // Contact picks the lowest skin sample, which may change vertex as a hand
  // rotates. Track the same wrist point for actual temporal continuity.
  for(const side of ['Left','Right']){const p=new T.Vector3(...d.gestures.restingTips[side]),wrist=actor.bones[side+'Hand'].getWorldPosition(new T.Vector3());maxStep=Math.max(maxStep,wrist.distanceTo(previous[side]));previous[side]=wrist;if(f>=180)rest[side].push(p);}
  if(f<180||f%15)continue;actor.group.updateMatrixWorld(true);const updated=new Set();
  for(const {mesh,index}of points){if(!updated.has(mesh.skeleton)){mesh.skeleton.update();updated.add(mesh.skeleton);}const p=mesh.getVertexPosition(index,new T.Vector3()).applyMatrix4(mesh.matrixWorld),side=p.x>0?'Left':'Right';furthest=Math.max(furthest,p.z);if(Math.abs(p.x)<.61&&p.z>.38&&p.z<1.18){maxDepth=Math.max(maxDepth,.8625-p.y);gap[side]=Math.min(gap[side],p.y-.8625);}}
 }
 for(const side of ['Left','Right']){const p=rest[side][0];assert.ok(gap[side]>=-.001&&gap[side]<.004,`${side} real skin does not rest on desktop: ${gap[side]}`);assert.ok(p.z<typed[side][2]-.07&&p.y<typed[side][1]-.03,`${side} kept its typing pose`);assert.ok(Math.max(...rest[side].map(p=>p.y))-Math.min(...rest[side].map(p=>p.y))<.001,'idle keeps tapping');}
 assert.ok(maxDepth<.001,`idle hand skin enters desktop: ${maxDepth}`);assert.ok(furthest<.505,'resting fingers overlap the keyboard');assert.ok(maxStep<.025,`hands snap leaving keyboard: ${maxStep}`);for(const [bone,position]of lengths)assert.ok(bone.position.distanceTo(position)<.00002,'rest pose stretches rig');
 t.diagnostic(JSON.stringify({maxDepth,gap,furthest,maxStep}));actor.dispose();
});

test('solo computer idle retains computer mood; ordinary classroom pupils continue writing',()=>{
 const r=createSoloRound({map:'computer',seed:73});r.start();r._advanceTeacher=()=>{};r._perceive=()=>{};assert.equal(r.startComputer(),true);r.step(1/60);const s=r.snapshot();assert.ok(s.students.every(p=>['computer','computer-idle'].includes(p.mood)));assert.equal(s.player.computerActive,true);
 r.stopComputer();r.step(1/60);assert.equal(r.snapshot().students.find(p=>p.isPlayer).mood,'computer-idle');
 const ordinary=createSoloRound({seed:73});ordinary.start();ordinary.step(1/60);assert.ok(ordinary.snapshot().students.some(s=>s.mood==='writing'));assert.ok(ordinary.snapshot().students.every(s=>s.mood!=='computer'));
});

test('network peers and teacher receive computer pose even when the player is not holding a mouse button',()=>{
 const r=new CampusRoom({code:'570057',seed:73,map:'computer'}),teacher=r.join({name:'teacher',rolePreference:'teacher'}),student=r.join({name:'student'}),peer=r.join({name:'peer'});r.begin(teacher);for(let n=0;n<1801;n++)r.tick(1/60);
 const p=student.context.player;Object.assign(p,{seated:true,seatId:0,_drawnSlot:null});assert.equal(r.command(student,'startComputer'),true);r.tick(1/60);
 for(const who of [teacher,student,peer]){const s=r.snapshot(who).students.find(s=>s.id===student.studentId);assert.equal(s.computerActive,true);assert.equal(s.mood,'computer');assert.equal(s.holding,false);}
 r.command(student,'stopComputer');r.tick(1/60);assert.equal(r.snapshot(peer).students.find(s=>s.id===student.studentId).mood,'computer-idle');
});
