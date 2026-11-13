import test from 'node:test';
import assert from 'node:assert/strict';
import {CampusRoom} from '../server/room-simulation.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {createSoloRound,switchSoloRole} from '../dist/solo-round.js';
import {validRoundSettings} from '../dist/round-settings55.js';

test('room options accept both endpoints, reject malformed values and survive role/rematch',()=>{
 for(const duration of[300,1200])for(const target of[20,160])for(const chalkStamina of[false,true]){
  const settings={duration,target,chalkStamina},r=new CampusRoom({code:'690001',settings}),h=r.join({rolePreference:'teacher'}),p=r.join({});
  assert.deepEqual(r.snapshot(p).settings,settings);assert.deepEqual(r.publicRoom(p).settings,settings);
  assert.throws(()=>r.configureRound(p,settings),/房主/);r.begin(h);r.sim._finish('lost','timeout');r.rematch(h);assert.deepEqual(r.snapshot(h).settings,settings);
  const solo=createSoloRound(settings);solo.start({gathering:true});const teacher=switchSoloRole(solo,'teacher');assert.deepEqual(teacher.snapshot().settings,settings);
 }
 for(const bad of[{target:19},{target:161},{duration:299},{duration:1201},{chalkStamina:'true'},{chalkStamina:8},{target:20.5}])assert.equal(validRoundSettings({duration:600,target:120,...bad}),false);
});

test('an accepted chalk costs exactly eight only when enabled; misses, cooldown and insufficient stamina cannot charge again',()=>{
 for(const chalkStamina of[true,false]){
  const r=new TeacherRound({chalkStamina});r.start();r.teacher.stamina=16;
  assert.equal(r.throwChalk(),true);assert.equal(r.teacher.stamina,chalkStamina?8:16);
  assert.equal(r.throwChalk(),false);assert.equal(r.teacher.stamina,chalkStamina?8:16);
  r._sessionElapsed+=1;assert.equal(r.throwChalk(),true);assert.equal(r.teacher.stamina,chalkStamina?0:16);
  r._sessionElapsed+=1;r.teacher.stamina=chalkStamina?7:0;assert.equal(r.throwChalk(),false);assert.equal(r.teacher.stamina,chalkStamina?7:0);
 }
});

test('countdown practice remains free with the option on, and real member throw commands share the same cost',()=>{
 const r=new CampusRoom({code:'690002',settings:{duration:300,target:160,chalkStamina:true}}),h=r.join({rolePreference:'teacher'});r.join({});r.begin(h);
 r.sim.teacher.stamina=70;assert.equal(r.command(h,'throwChalk'),true);assert.equal(r.sim.teacher.stamina,70);
 for(let i=0;i<310;i++)r.tick(.1);
 r.sim.teacher.stamina=70;assert.equal(r.command(h,'throwChalk'),true);assert.equal(r.snapshot(h).teacher.stamina,62);
 assert.equal(r.command(h,'throwChalk'),false);assert.equal(r.sim.teacher.stamina,62);
});

test('every chosen capacity from 2 through 8 includes the host and survives rematch',()=>{
 for(let maxPlayers=2;maxPlayers<=8;maxPlayers++){
  const room=new CampusRoom({code:'690003',maxPlayers}),host=room.join({rolePreference:'teacher'});
  for(let i=1;i<maxPlayers;i++)room.join();assert.equal(room.publicRoom(host).maxPlayers,maxPlayers);
  assert.throws(()=>room.join(),new RegExp('最多'+maxPlayers+'人'));room.begin(host);room.sim._finish('lost','timeout');room.rematch(host);assert.equal(room.maxPlayers,maxPlayers);
 }
});

test('real HTTP creation enforces the selected capacity and transmits all gameplay settings',async()=>{
 const {createCampusServer}=await import('../server/server.js');const runtime=createCampusServer();await new Promise(r=>runtime.server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${runtime.server.address().port}`,post=async(path,value)=>{const res=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});return{status:res.status,data:await res.json()};};
 try{
  for(const maxPlayers of[1,9,'2',2.5])assert.equal((await post('/api/rooms',{maxPlayers})).status,400);
  const settings={target:160,duration:1200,chalkStamina:true},a=await post('/api/rooms',{maxPlayers:2,settings});assert.equal(a.status,201);assert.equal(a.data.room.maxPlayers,2);assert.deepEqual(a.data.state.settings,settings);
  const path=`/api/rooms/${a.data.room.code}/join`,b=await post(path,{maxPlayers:8,settings:{target:20,duration:300,chalkStamina:false}});assert.equal(b.status,200);assert.equal(b.data.room.maxPlayers,2);assert.deepEqual(b.data.state.settings,settings);assert.equal((await post(path,{})).status,409);
 }finally{await runtime.close();}
});
