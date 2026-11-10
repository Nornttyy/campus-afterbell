import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createFirstPersonView,sampleFirstPersonMotion,firstPersonEyeHeight} from '../dist/first-person-view.js';
import {createDeskHands} from '../dist/game-actors.js?v=campus-60';
import {createRiggedPalm} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';

test('seated and restrained palms stay body anchored through camera turns; standing follows yaw only',()=>{
 const camera=new T.PerspectiveCamera(),hands=new T.Group(),view=createFirstPersonView({},camera,[hands]),position=new T.Vector3(2,1.43,3);
 let player={x:2,z:3,yaw:0,seated:true,captivity:'free'},motion=sampleFirstPersonMotion(null,player,0);
 view.align(player,motion,position);const base=view.anchor.quaternion.clone();
 for(let i=1;i<60;i++){camera.rotation.set(-i*.01,i*.025,0);player.yaw=i*.025;motion=sampleFirstPersonMotion(motion,player,i/60);view.align(player,motion,position);assert.ok(view.anchor.quaternion.angleTo(base)<1e-7);}
 player={...player,seated:false};motion=sampleFirstPersonMotion(motion,player,1.1);view.align(player,motion,position);assert.ok(view.anchor.quaternion.angleTo(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),player.yaw+Math.PI))<1e-7);
 const standing=view.anchor.quaternion.clone();for(const pitch of [-1.2,0,1.2]){camera.rotation.x=-pitch;view.align(player,motion,position);assert.ok(view.anchor.quaternion.angleTo(standing)<1e-7,'standing hands follow head pitch');}
 player.captivity='carried';motion=sampleFirstPersonMotion(motion,player,1.2);view.align(player,motion,position);const caught=view.anchor.quaternion.clone();
 camera.rotation.set(-.7,-2,0);player.yaw=-2;motion=sampleFirstPersonMotion(motion,player,1.3);view.align(player,motion,position);assert.ok(view.anchor.quaternion.angleTo(caught)<1e-7);
});

test('foreground pass clears scene depth without disabling depth between fingers and items',()=>{
 const order=[],renderer={autoClear:true,shadowMap:{enabled:true},clearDepth(){order.push('clearDepth')},render(scene,camera){assert.equal(this.autoClear,false);assert.equal(this.shadowMap.enabled,false);order.push('hands')}},camera=new T.PerspectiveCamera(),hand=new T.Group(),view=createFirstPersonView(renderer,camera,[hand]);
 view.render();assert.deepEqual(order,['clearDepth','hands']);assert.equal(renderer.autoClear,true);assert.equal(renderer.shadowMap.enabled,true);
 hand.visible=false;view.render();assert.equal(order.length,2,'hidden hands still render on menu');
});

test('walking phase follows actual distance, freezes while blocked or paused and decays when stopped',()=>{
 let p={x:0,z:0,yaw:0,seated:false,captivity:'free'},s=sampleFirstPersonMotion(null,p,0);
 for(let i=1;i<=60;i++){p.z+=1.8/60;s=sampleFirstPersonMotion(s,p,i/60);}
 assert.ok(s.amount>.99);assert.ok(Math.abs(s.phase-7.38)<1e-7);
 const phase=s.phase;s=sampleFirstPersonMotion(s,p,1);assert.equal(s.phase,phase);
 for(let i=1;i<=90;i++)s=sampleFirstPersonMotion(s,p,1+i/60);
 assert.equal(s.phase,phase);assert.ok(s.amount<1e-5);
});

test('actual short forearms sway alternately at walking speed while the held phone remains in its palm',async()=>{
 const [left,right]=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
 const hands=createDeskHands({createHand:(side,scale)=>createRiggedPalm(side<0?left:right,side,scale)});
 let previous=null,minZ=Infinity,maxZ=-Infinity;const palm=hands.getHand('left').group,phone=hands.group.getObjectByName('handheld-phone');
 for(let i=0;i<240;i++){
  hands.update(i/60,{action:'phone',carrying:true,seated:false,movement:1,walkPhase:i/60*7});hands.group.updateMatrixWorld(true);
  if(i<90)continue;
  minZ=Math.min(minZ,palm.position.z);maxZ=Math.max(maxZ,palm.position.z);
  const relative=palm.matrixWorld.clone().invert().multiply(phone.matrixWorld);
  if(previous)for(let k=0;k<16;k++)assert.ok(Math.abs(previous.elements[k]-relative.elements[k])<1e-6,'phone slips out of hand during sway');
  previous=relative;
 }
 assert.ok(maxZ-minZ>.045&&maxZ-minZ<.065);assert.equal(hands.getDebug().palmsOnly,false);
});


test('fixed-step movement snapshots do not switch walking off between render frames',()=>{
 let p={x:0,z:0,yaw:0,seated:false},s=sampleFirstPersonMotion(null,p,0),min=Infinity;
 for(let i=1;i<=180;i++){if(i%2===0)p.z+=1.8/30;s=sampleFirstPersonMotion(s,p,i/60);if(i>90)min=Math.min(min,s.amount);}
 assert.ok(min>.97,`steady walking amplitude fell to ${min}`);
 assert.ok(Math.abs(s.phase-5.4*4.1)<1e-6);
});


test('empty walking hands travel forwards/backwards, rise/fall and rotate continuously',async()=>{
 const [left,right]=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
 const h=createDeskHands({createHand:(side,scale)=>createRiggedPalm(side<0?left:right,side,scale)});
 let t=0;for(let i=0;i<120;i++)h.update(t+=1/60,{seated:false});
 const points=[],rotations=[];let last=null,maxJump=0;
 for(let i=0;i<=120;i++){h.update(t+=1/60,{seated:false,movement:1,walkPhase:i/120*Math.PI*2});const a=h.getHand('left').group.getObjectByName('mixamorigLeftHand'),p=a.getWorldPosition(new T.Vector3()),q=a.getWorldQuaternion(new T.Quaternion());points.push(p);rotations.push(q);if(last)maxJump=Math.max(maxJump,last.angleTo(q));last=q;}
 const range=axis=>Math.max(...points.map(p=>p[axis]))-Math.min(...points.map(p=>p[axis]));
 assert.ok(range('z')>.25&&range('y')>.11);
 assert.ok(Math.max(...rotations.map(q=>q.angleTo(rotations[0])))>.35);
 assert.ok(maxJump<.04,'wrist flips discontinuously');
});

test('the phone and its tapping hand share the carrying sway transform',async()=>{
 const [left,right]=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
 const h=createDeskHands({createHand:(side,scale)=>createRiggedPalm(side<0?left:right,side,scale)});
 const rightHand=h.getHand('right').group,phone=h.group.getObjectByName('handheld-phone');let previous=null;
 for(let i=0;i<240;i++){h.update(i/60,{action:'phone',carrying:true,seated:false,movement:1,walkPhase:i/60*7.38});h.group.updateMatrixWorld(true);if(i<120)continue;const fit=rightHand.matrixWorld.clone().invert().multiply(phone.matrixWorld);if(previous)for(let k=0;k<16;k++)assert.ok(Math.abs(fit.elements[k]-previous.elements[k])<1e-6);previous=fit;}
});


test('the hands stay aligned with the chosen facing seat, and stun lowers the actual eye height',()=>{
 const player={x:0,z:0,yaw:Math.PI,seated:true,seatYaw:Math.PI,captivity:'free'};
 let motion=sampleFirstPersonMotion(null,player,0);
 for(let i=1;i<=20;i++){player.yaw-=.04;motion=sampleFirstPersonMotion(motion,player,i/60);assert.equal(motion.bodyYaw,Math.PI);}
 assert.equal(firstPersonEyeHeight({seated:false},'student'),1.65);
 assert.equal(firstPersonEyeHeight({seated:false,stunLeft:2},'student'),1.05);
 assert.equal(firstPersonEyeHeight({seated:false,stunLeft:2},'teacher'),1.12);
 assert.equal(firstPersonEyeHeight({seated:false,captivity:'stunned'},'student'),1.05);
 assert.equal(firstPersonEyeHeight({seated:true},'teacher'),1.43*1.20);
});
