import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createDeskHands} from '../dist/game-actors.js?v=campus-83';
import {createRiggedPalm} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {CampusRoom} from '../server/room-simulation.js';

test('first person pen continuously writes on the page without a mouse hold or camera-linked pose',async()=>{
 const [left,right]=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
 const h=createDeskHands({createHand:(side,scale)=>createRiggedPalm(side<0?left:right,side,scale)}),pen=h.group.getObjectByName('red-school-pen'),tips=[];
 for(let i=0;i<300;i++){
  h.update(i/60,{action:'pen',carrying:true,holding:false,penWriting:true,seated:true,freeLook:true,viewPitch:Math.sin(i/60)});h.group.updateMatrixWorld(true);
  if(i<120)continue;assert.equal(pen.visible,true);assert.deepEqual(pen.scale.toArray(),[1,1,1]);
  const tip=pen.localToWorld(new T.Vector3(0,-.0875,0));tips.push(tip);
  assert.ok(Math.abs(tip.y-(.88+Math.abs(tip.x)*Math.tan(.14)+.005-1.43))<1e-5,'pen tip left the sloping paper surface');
  assert.ok(tip.z<-.675&&tip.z>-.775&&tip.x>.075&&tip.x<.195,'pen writes outside the page');
 }
 assert.ok(Math.max(...tips.map(p=>p.x))-Math.min(...tips.map(p=>p.x))>.05,'pen must draw continuous strokes');
 for(let i=301;i<370;i++)h.update(i/60,{action:'pen',carrying:false,seated:true,freeLook:true});assert.equal(pen.visible,false);
});

test('multiplayer peers see writing and cannot farm score with the desktop pen',()=>{
 const room=new CampusRoom({code:'521111',seed:50}),teacher=room.join({rolePreference:'teacher'}),student=room.join({rolePreference:'student'});room.begin(teacher);
 for(let i=0;i<301;i++)room.tick(.1);
 room.sim._seatingRoutes.clear();for(const s of room.sim.students)if(!s.networkHuman){s._decisionAt=Infinity;s._restUntil=Infinity;s.holding=false;}
 const actor=student.context.player,seat=room.sim.seats.find(seat=>!room.sim.students.some(s=>s.seated&&!s.caught&&s.seatId===seat.id));assert.ok(seat,'fixture needs a free physical seat');
 Object.assign(actor,{x:seat.x,z:seat.z});assert.equal(room.command(student,'interact',[seat.id]),'seated');
 assert.equal(room.command(student,'takePen'),true);assert.equal(room.snapshot(student).drawer.source.seatId,seat.id);const score=room.sim.score;
 assert.equal(room.snapshot(student).player.penTwirling,true);assert.equal(room.snapshot(student).player.penWriting,false);
 assert.equal(room.command(student,'togglePenMode'),true);
 for(let i=0;i<150;i++){if(i%30===0)room.command(student,'hold',[true]);room.tick(.1);}
 const own=room.snapshot(student),peer=room.snapshot(teacher).students.find(s=>s.id===actor.id);
 assert.equal(room.sim.score,score);assert.equal(own.player.penWriting,true);assert.equal(peer.penWriting,true);assert.equal(peer.mood,'writing');assert.equal(peer.holding,false);assert.equal(own.actionProgress,0);assert.equal(own.completed.pen,0);
 assert.equal(room.command(student,'returnItem'),true);assert.equal(room.snapshot(student).player.penWriting,false);
});
