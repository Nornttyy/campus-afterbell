import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoloRound} from '../dist/solo-round.js';
import {CORRIDOR} from '../dist/classroom-layout.js';
import {CampusRoom} from '../server/room-simulation.js';
const hall=p=>p.x>=CORRIDOR.minX&&p.x<=CORRIDOR.maxX&&p.z>=CORRIDOR.minZ&&p.z<=CORRIDOR.maxZ;
const pose=s=>[s.x,s.z,s.yaw,s.mood,s.visible,s.seated];
for(const map of ['classroom','night','tiered','computer','hotpot','playground','bus'])test(map+' holds the final pose then returns automatically at five seconds',()=>{
 const r=createSoloRound({seed:243,role:'student',map});r.start();r._finish('lost','timeout');
 const before=r.students.map(pose);r.step(4.98);
 assert.equal(r.status,'lost');assert.deepEqual(r.students.map(pose),before);
 r.step(.02);assert.equal(r.stage,'gathering');assert.ok(hall(r.player));
 assert.ok(r.students.every(s=>s.isPlayer||s.visible===false));assert.ok(Object.values(r.layout.doorMotion).every(d=>d.amount===0));
 assert.equal(r.seed,244);
});
test('one room timer resets all people, roles and doors without requiring any acknowledgement',()=>{
 const room=new CampusRoom({code:'920092',seed:7}),host=room.join({rolePreference:'teacher'}),guest=room.join();
 const prior=guest.character;room.begin(host);assert.notEqual(guest.character,prior);
 room.sim._finish('lost','timeout');assert.ok(room.command(guest,'continueAfterClass'));
 for(let i=0;i<49;i++)room.tick(.1);
 assert.equal(room.sim.stage,'dismissal');room.tick(.1);
 for(const m of [host,guest]){const s=room.snapshot(m);assert.equal(s.role,'student');assert.equal(s.lobbyRole,'student');assert.ok(hall(s.player));assert.equal(s.room.code,'920092');}
 assert.equal(room.teacherMember,null);assert.ok(room.sim.students.filter(s=>!s.networkHuman).every(s=>s.visible===false));assert.ok(room.sim.layout.frontDoorClosed&&room.sim.layout.rearDoorClosed&&room.sim.layout.officeDoorClosed);
 const first=guest.character;room.preference(host,{rolePreference:'teacher'});room.begin(host);assert.notEqual(guest.character,first);assert.equal(room.snapshot(guest).player.character,guest.context.player.character);
});
