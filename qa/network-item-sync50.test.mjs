import test from 'node:test';
import assert from 'node:assert/strict';
import {CampusRoom} from '../server/room-simulation.js';
import {OFFICE_CHAIR} from '../dist/classroom-layout.js';
import {effectEye} from '../dist/projectile-effects-rules.js';

function activeRoom(){
 const room=new CampusRoom({code:'501234',seed:50}),teacher=room.join({rolePreference:'teacher'}),a=room.join({name:'甲'}),b=room.join({name:'乙'});room.begin(teacher);
 for(let i=0;i<301;i++)room.tick(.1);
 room.sim._seatingRoutes.clear();for(const s of room.sim.students)if(!s.networkHuman)Object.assign(s,{x:-100-s.id,z:-100,seated:false,seatId:null,visible:false});
 for(const m of [a,b])Object.assign(m.context.player,{x:8.8,z:m===a?0:5,seated:false,seatId:null,yaw:0});
 return{room,teacher,a,b};
}
function equip(room,member,action){const p=member.context.player;p._slots=[{id:0,action,readyAt:0,progress:0}];p._selectedSlot=0;p._drawnSlot=0;p._drawerOpen=true;p.action=member.context.selected=action;}
function advance(room,seconds){for(let i=0;i<Math.ceil(seconds*30);i++)room.tick(1/30);}

test('public carrying and use poses synchronize without exposing private drawer or another player score feedback',()=>{
 const {room,teacher,a,b}=activeRoom();equip(room,a,'garlic');a.context.player.seated=true;
 const carry=room.snapshot(b).students.find(s=>s.id===a.studentId);assert.equal(carry.carrying,true);assert.equal(carry.heldAction,'garlic');assert.equal(carry.drawerOpen,true);assert.equal(carry.drawer,undefined);
 room.command(a,'hold',[true]);room.tick(.1);const using=room.snapshot(b).students.find(s=>s.id===a.studentId);assert.equal(using.mood,'garlic');assert.equal(using.holding,true);
 advance(room,3);const own=room.snapshot(a),peer=room.snapshot(b),t=room.snapshot(teacher);assert.ok(own.player.burpReadyLeft>0);assert.equal(own.events.find(e=>e.type==='complete').actor,'player');assert.equal(peer.events.find(e=>e.type==='complete').actor,'peer');assert.equal(t.events.some(e=>e.type==='complete'),false);
 assert.equal(peer.students.find(s=>s.id===a.studentId).carrying,false);assert.equal(peer.students.find(s=>s.id===a.studentId).action,null);
 a.context.player._slots.push({id:1,action:'snack',readyAt:0,progress:0},{id:2,action:'drink',readyAt:0,progress:0});room.command(a,'takePen');assert.equal(room.snapshot(b).students.find(s=>s.id===a.studentId).penTaken,true);a.context.player._drawnSlot=null;assert.equal(room.command(a,'takeSlot',[3]),true,'the real temporary pen slot is selectable');assert.throws(()=>room.command(a,'takeSlot',[4]),/无效物品/);
 room.sim._events.push({type:'stamina-low'},{type:'wrong-grab',studentId:10});room.tick(.01);assert.equal(room.snapshot(b).events.some(e=>['wrong-grab','stamina-low'].includes(e.type)),false);assert.equal(room.snapshot(teacher).events.some(e=>e.type==='stamina-low'),true);
});

test('office chair is exclusive across roles and opening its drawer is visible to every peer',()=>{
 const {room,teacher,a,b}=activeRoom();const {x,z,yaw}=OFFICE_CHAIR;Object.assign(teacher.context.player,{x,z,yaw});Object.assign(a.context.player,{x,z,yaw});
 assert.equal(room.command(teacher,'interact',['office-chair']),'seated');assert.equal(room.command(teacher,'openOfficeDrawer'),true);
 assert.equal(room.snapshot(b).officeDeskOpen,true);assert.equal(room.snapshot(b).teacher.officeChair,true);assert.equal(room.command(a,'interact',['office-chair']),false);
 assert.equal(room.command(teacher,'interact'),'stood');assert.equal(room.command(a,'interact',['office-chair']),'seated');assert.equal(room.command(a,'openOfficeDrawer'),true);assert.equal(room.command(a,'takeSlot',[0]),true);assert.equal(room.snapshot(a).selected,'lunch');assert.equal(room.snapshot(b).students.find(s=>s.id===a.studentId).heldAction,'lunch');
 room.command(a,'hold',[true]);advance(room,3.1);assert.ok(room.snapshot(a).score>0);assert.equal(room.snapshot(b).officeDeskOpen,true);
});

test('banana peel flight, landing and peer stun synchronize with consistent public events',()=>{
 const {room,a,b}=activeRoom();equip(room,a,'bananaPeel');assert.equal(room.command(a,'hold',[true]),true);assert.equal(room.command(a,'releaseUse'),true);
 room.tick(.02);assert.equal(room.snapshot(b).peels.length,1);assert.equal(room.snapshot(a).events.some(e=>e.type==='peel-thrown'),true);
 for(let i=0;i<300&&!room.sim.peels[0]?.armed;i++)room.tick(1/60);const peel=room.sim.peels[0];assert.ok(peel?.armed);Object.assign(b.context.player,{x:peel.x,z:peel.z});room.tick(.04);
 const own=room.snapshot(b),other=room.snapshot(a);assert.equal(own.player.captivity,'stunned');assert.ok(own.player.stunLeft>0);assert.equal(other.students.find(s=>s.id===b.studentId).captivity,'stunned');assert.equal(own.peels.length,0);assert.equal(other.events.some(e=>e.type==='peel-slip'&&e.actorId===b.studentId),true);
});

test('garlic burp and bubble attachment reach other humans; flash and ink reach teacher own view',()=>{
 const {room,teacher,a,b}=activeRoom();a.context.player._burpUntil=room.sim.elapsed+5;Object.assign(b.context.player,{x:8.8,z:1.6});assert.equal(room.command(a,'burp'),true);room.tick(.02);assert.equal(room.snapshot(b).burps.length,1);advance(room,.6);assert.equal(room.snapshot(b).player.captivity,'stunned');assert.equal(room.snapshot(a).events.some(e=>e.type==='burp'),true);
 advance(room,5);Object.assign(a.context.player,{x:8.8,z:0,yaw:0,seated:true});Object.assign(b.context.player,{x:8.8,z:1.5,seated:false,captivity:'free',_chalkUntil:0});equip(room,a,'gum');room.command(a,'hold',[true]);advance(room,2);const growing=room.snapshot(b).students.find(s=>s.id===a.studentId);assert.ok(growing.bubble.cycles>1.8);room.command(a,'releaseUse');advance(room,1.4);
 const attached=room.snapshot(b);assert.ok(attached.player.bubbleLeft>0);assert.ok(attached.bubbles.some(p=>p.attachedId===b.studentId));assert.ok(room.snapshot(a).events.some(e=>e.type==='bubble-attached'&&e.targetId===b.studentId));
 const t=room.sim.teacher;room.sim._applyProjectileEffect({id:999,ownerId:a.studentId},{kind:'ink',x:t.x,y:1.6,z:t.z,hitActorId:-1});room.tick(.01);assert.ok(room.snapshot(teacher).player.inkLeft>0);assert.ok(room.snapshot(a).teacher.inkLeft>0);
 room.sim._applyProjectileEffect({id:1000,ownerId:a.studentId},{kind:'flash',...effectEye(t,room.map)});room.tick(.01);assert.ok(room.snapshot(teacher).player.flashLeft>0);assert.ok(room.snapshot(a).teacher.flashLeft>0);
 room.sim._stunAny(room.sim.teacher,4,'bananaPeel');room.tick(.04);assert.equal(room.snapshot(teacher).player.captivity,'stunned');assert.equal(room.snapshot(a).teacher.phase,'stunned');assert.ok(room.snapshot(a).teacher.stunLeft>0);
});
