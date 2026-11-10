import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoloRound} from '../dist/solo-round.js';
import {CampusRoom} from '../server/room-simulation.js';
import {LIFT,moveInRoom} from '../dist/classroom-layout.js';
import {elevatorDuration} from '../dist/elevator-session.js';
import {readFileSync} from 'node:fs';
const board=(p,i=0)=>Object.assign(p,{x:LIFT.x+(i%2?-.4:.4),z:LIFT.z+Math.floor(i/2)*.4,yaw:Math.PI,pitch:0,seated:false,caught:false,captivity:'free'});

for(const role of ['student','teacher'])test(`solo ${role}: no server, all-human boarding, walkable three seconds to adjacent floor, one use and next-round reset`,()=>{
 const r=createSoloRound({role,seed:400,map:'classroom'});r.start({gathering:true});
 assert.equal(r.snapshot().elevator.total,1);assert.equal(r.snapshot().elevator.canTravel,false);
 assert.equal(r.travelFloor('night'),false);assert.equal(r.elevator.used,false);
 board(r.player);assert.equal(r.snapshot().elevator.canTravel,true);
 const pose={x:r.player.x,z:r.player.z},seats=r.seats,seed=r.seed;
 assert.equal(r.travelFloor('classroom'),false);assert.equal(r.travelFloor('unknown'),false);
 assert.equal(r.travelFloor('night'),true);assert.equal(r.layout.elevatorClosed,true);
 assert.equal(r.setMovement(0,1),true);r.step(.2);assert.ok(r.player.z>pose.z,'passenger walks during transit');assert.equal(r.setLook(.6,.2),true);r.setMovement(0,0);pose.x=r.player.x;pose.z=r.player.z;assert.equal(r.interact(0),false);assert.equal(r.startBell(),false);assert.equal(r.travelFloor('computer'),false);
 r.step(2.79);assert.equal(r.map,'classroom');assert.ok(r.elevator.remaining>0);
 assert.deepEqual({x:r.player.x,z:r.player.z},pose);assert.equal(r.snapshot().elevator.doorAmount,0);
 r.step(.01);assert.equal(r.map,'night');assert.equal(r.seed,seed);assert.deepEqual(r.seats,seats.map(s=>({...s,map:'night'})));
 assert.deepEqual({x:r.player.x,z:r.player.z},pose);assert.equal(r.layout.elevatorClosed,false);assert.equal(r.snapshot().elevator.doorAmount,1);
 assert.equal(r.elevator.used,true);assert.equal(r.travelFloor('computer'),false);assert.equal(r.snapshot().role,role);
 r._finish('won','mischief');r.returnToGathering();assert.equal(r.elevator.used,false);assert.equal(r.map,'night');
 board(r.player);assert.equal(r.travelFloor('computer7'),true);r.step(elevatorDuration('night','computer7'));assert.equal(r.map,'computer7');
});

test('solo pause freezes cabin and an edge-standing passenger cannot close doors through their body',()=>{
 const r=createSoloRound({seed:22});r.start({gathering:true});board(r.player);
 r.player.z=LIFT.maxZ-.02;assert.equal(r.travelFloor('night'),false);
 board(r.player);r.travelFloor('night');r.pause();r.step(8);assert.equal(r.elevator.remaining,3);r.pause(false);r.step(3);assert.equal(r.map,'night');
});

test('the solo player can walk from the real gathering spawn into the cabin without teleporting',()=>{
 const r=createSoloRound({seed:22});r.start({gathering:true});r.setLook(Math.PI,0);
 // Follow the outside half of the corridor around the open rear door leaf.
 r.setMovement(1,0);for(let i=0;i<6;i++)r.step(.1);r.setMovement(0,-1);
 const walkSeconds=Math.abs(r.player.z-LIFT.z)/1.8;for(let i=0;i<Math.ceil(walkSeconds/.1);i++)r.step(.1);r.setMovement(0,0);
 assert.ok(r.player.z<LIFT.maxZ-.18);assert.ok(r.player.z>LIFT.minZ);assert.equal(r.snapshot().elevator.canTravel,true);
 assert.equal(r.travelFloor('night'),true);r.step(3);r.setMovement(0,1);for(let i=0;i<25;i++)r.step(.1);assert.ok(r.player.z>LIFT.maxZ+.20,'arrival opens a walkable exit');
});

test('network authority: every human boards; AI, look, blocked actions, joining, disconnect and repeated commands',()=>{
 const r=new CampusRoom({code:'525252',seed:400}),a=r.join({name:'甲'}),b=r.join({name:'乙'});
 assert.throws(()=>r.travelFloor(a,'night'),/所有玩家/);board(a.context.player);assert.equal(r.snapshot(a).elevator.inside,1);
 assert.throws(()=>r.command(a,'travelFloor',['night']),/所有玩家/);board(b.context.player,1);
 assert.throws(()=>r.travelFloor(b,'night'),/房主/);assert.throws(()=>r.travelFloor(a,'missing'),/不存在/);assert.throws(()=>r.travelFloor(a,'classroom'),/这一层/);
 r.disconnect(b);assert.throws(()=>r.travelFloor(a,'night'),/断线/);r.reconnect(b);
 const poses=[a,b].map(m=>({x:m.context.player.x,z:m.context.player.z})),seed=r.seed;
 assert.equal(r.command(a,'travelFloor',['night']),true);assert.equal(r.sim.layout.elevatorClosed,true);
 assert.equal(r.snapshot(a).elevator.total,2);assert.equal(r.snapshot(b).elevator.phase,'travel');
 assert.equal(r.command(b,'setMovement',[0,1]),true);r.tick(.2);assert.ok(b.context.player.z>poses[1].z);r.command(b,'setMovement',[0,0]);poses[1].z=b.context.player.z;assert.equal(r.command(a,'interact',[0]),false);assert.equal(r.command(a,'startBell'),false);
 assert.equal(r.command(b,'setDoorUse',[true]),false);assert.equal(r.command(a,'setPreference',[{rolePreference:'teacher'}]),false);
 assert.throws(()=>r.command(a,'travelFloor',['computer']),/正在运行/);assert.throws(()=>r.join({name:'晚到'}),/正在运行/);
 assert.equal(r.command(a,'setLook',[.8,.1]),true);
 r.disconnect(b);r.tick(2.79);assert.equal(r.map,'classroom');r.tick(.01);
 assert.equal(r.map,'night');assert.equal(r.seed,seed);assert.equal(r.sim.layout.elevatorClosed,false);
 assert.deepEqual([a,b].map(m=>({x:m.context.player.x,z:m.context.player.z})),poses);
 assert.equal(b.connected,false);r.reconnect(b);assert.equal(r.snapshot(b).map,'night');assert.equal(r.snapshot(b).elevator.used,true);
 assert.throws(()=>r.command(a,'travelFloor',['computer']),/已使用/);
 r.sim._finish('won','mischief');r.rematch(a);assert.equal(r.elevator.used,false);assert.equal(r.members.size,2);assert.equal(r.seed,seed+1);
});

test('departed humans no longer block the cabin, host transfer does not reset per-round use',()=>{
 const r=new CampusRoom({code:'525253'}),a=r.join({}),b=r.join({});board(a.context.player);r.disconnect(b);r.leave(b);
 assert.equal(r.travelFloor(a,'computer'),true);const c=a.context.player;
 const crossing=moveInRoom({x:LIFT.x,z:LIFT.maxZ-.3},0,1,.18,r.sim.layout);assert.ok(crossing.z<LIFT.maxZ-.19,'closed physical leaf blocks exit');
 r.tick(elevatorDuration('classroom','computer'));assert.equal(r.map,'computer');assert.equal(r.elevator.used,true);
 const d=r.join({});r.leave(a);board(d.context.player);assert.equal(r.hostId,d.id);assert.throws(()=>r.travelFloor(d,'night'),/已使用/);
});


test('travel time grows with actual floor separation and is symmetric',()=>{
 assert.equal(elevatorDuration('classroom','night'),3);
 assert.equal(elevatorDuration('classroom','tiered8'),9);
 assert.equal(elevatorDuration('tiered8','classroom'),9);
 assert.equal(elevatorDuration('night6','computer7'),3);
});

for(const role of ['student','teacher'])test(`solo ${role}: moving passengers remain within closed cabin until arrival`,()=>{
 const r=createSoloRound({role,seed:22});r.start({gathering:true});board(r.player);
 r.travelFloor('tiered8');const stamina=r.teacher.stamina;
 r.setMovement(0,1);r.step(3);assert.ok(r.player.z<=LIFT.maxZ-.18+1e-8);assert.equal(r.map,'classroom');
 r.setMovement(-1,0);r.step(3);assert.ok(r.player.x>=LIFT.minX+.18-1e-8);assert.ok(r.player.x<LIFT.x);
 assert.equal(r.teacher.stamina,stamina,'elevator movement is still before class');
 const pose={x:r.player.x,z:r.player.z};r.setMovement(0,0);r.step(3);assert.equal(r.map,'tiered8');
 assert.deepEqual({x:r.player.x,z:r.player.z},pose,'arrival preserves current cabin position');
});

test('transit UI contains no elevator countdown',()=>{
 const source=readFileSync(new URL('../dist/classroom-game.js',import.meta.url),'utf8');
 assert.ok(!/textContent[^;]*elevator\.remaining/.test(source));
 assert.ok(!source.includes('电梯运行 · '));
});
