import {updateLayoutDoors} from '../dist/classroom-layout.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampusServer} from '../server/server.js';
import {CampusRoom} from '../server/room-simulation.js';
import {elevatorDuration} from '../dist/elevator-session.js';
import {OPEN_CAMPUS_MAPS} from '../dist/campus-destinations.js';
import {TEACHER_SPAWN,SEATS,DOORS,LIFT} from '../dist/classroom-layout.js';

async function api(base,path,data,token,extra={}){const res=await fetch(base+path,{method:data?'POST':'GET',headers:{...(data?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`} :{}),...extra},body:data?JSON.stringify(data):undefined});return{status:res.status,data:await res.json()};}
async function stream(base,person){const controller=new AbortController(),messages=[],response=await fetch(`${base}/api/events?room=${person.room.code}`,{headers:{authorization:`Bearer ${person.token}`},signal:controller.signal});assert.equal(response.status,200);const reader=response.body.getReader(),decoder=new TextDecoder();let pending='';const task=(async()=>{try{for(;;){const {value,done}=await reader.read();if(done)return;pending+=decoder.decode(value,{stream:true});let i;while((i=pending.indexOf('\n\n'))>=0){const block=pending.slice(0,i);pending=pending.slice(i+2);const row=block.split('\n').find(l=>l.startsWith('data: '));if(row)messages.push({type:block.match(/event: (\w+)/)?.[1],data:JSON.parse(row.slice(6))});}}}catch(e){if(e.name!=='AbortError')throw e;}})();return{messages,async wait(check,timeout=2500){const start=Date.now();while(Date.now()-start<timeout){const hit=messages.find(check);if(hit)return hit;await new Promise(r=>setTimeout(r,15));}throw new Error('Timed out waiting for room packet');},async close(){controller.abort();await task;}};}

test('two independent HTTP peers share authoritative room, roles, movement, reconnect and voice signaling',async()=>{
 const runtime=createCampusServer();await new Promise(r=>runtime.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${runtime.server.address().port}`;let first,second,reconnected;
 try{
  assert.equal((await fetch(base+'/')).status,200);
  assert.equal((await api(base,'/api/rooms',{name:'reject'},null,{origin:'https://attacker.example'})).status,403);
  const a=(await api(base,'/api/rooms',{name:'房主',rolePreference:'teacher',map:'classroom',floor:2})).data,b=(await api(base,`/api/rooms/${a.room.code}/join`,{name:'同学乙'})).data;
  for(const joined of [a,b]){assert.equal(joined.room.map,'classroom');assert.equal(joined.state.map,'classroom');assert.equal(joined.state.floor,2);}
  assert.equal(a.room.code.length,6);assert.notEqual(a.token,b.token);assert.equal(b.room.members.length,2);assert.equal(JSON.stringify(b.room).includes(a.token),false);
  assert.equal((await api(base,`/api/command?room=${a.room.code}`,{name:'setMovement',args:[1,0]},'wrong')).status,401);
  first=await stream(base,a);second=await stream(base,b);
  const command=(p,name,args=[])=>api(base,`/api/command?room=${p.room.code}`,{name,args},p.token);
  assert.equal((await command(b,'startBell')).status,403);
  assert.equal((await command(b,'_finish',['won'])).status,400);
  assert.equal((await command(b,'setMovement',[999,0])).status,400);
  assert.equal((await command(a,'travelFloor',['computer7'])).status,409);
  const live=runtime.rooms.get(a.room.code);let passenger=0;for(const m of live.members.values())Object.assign(m.context.player,{x:LIFT.x+(passenger++?-.4:.4),z:LIFT.z,seated:false});
  assert.equal((await command(a,'travelFloor',['computer7'])).data.ok,true);assert.equal(live.map,'classroom');live.tick(elevatorDuration('classroom','computer'));
  await second.wait(m=>m.type==='state'&&m.data.map==='computer'&&m.data.floor===5);
  assert.equal((await command(a,'startBell')).data.results[0],true);
  const teacher=(await first.wait(m=>m.type==='state'&&m.data.role==='teacher')).data;
  const student=(await second.wait(m=>m.type==='state'&&m.data.stage==='seating')).data;
  assert.equal(teacher.students.some(s=>s.networkHuman||s.drawer||s.isTeammate),false);assert.equal(teacher.room.members.some(m=>m.id!==teacher.room.selfId&&Object.hasOwn(m,'studentId')),false);
  assert.equal(teacher.officeLocked,true);assert.equal(teacher.player.x,TEACHER_SPAWN.x);assert.equal(student.role,'student');
  const before=student.player.z;await command(b,'setMovement',[0,1]);await second.wait(m=>m.type==='state'&&m.data.player.z>before+.08);
  assert.equal((await command(a,'setMovement',[0,1])).data.results[0],true,'teacher can walk inside the locked office during preparation');
  assert.equal((await api(base,`/api/voice?room=${a.room.code}`,{to:'outside-room',kind:'offer',payload:{}},a.token)).status,400);
  await api(base,`/api/voice?room=${a.room.code}`,{to:b.room.selfId,kind:'mute',payload:{muted:true}},a.token);
  assert.equal((await second.wait(m=>m.type==='voice')).data.from,a.room.selfId);
  await second.close();second=null;await first.wait(m=>m.type==='state'&&m.data.room.members.some(m=>m.id===b.room.selfId&&!m.connected));
  reconnected=await stream(base,b);const back=await reconnected.wait(m=>m.type==='state');assert.equal(back.data.room.selfId,b.room.selfId);assert.equal(back.data.room.members.length,2);
  assert.equal((await api(base,`/api/rooms/${a.room.code}/join`,{name:'late'})).status,409);
 }finally{await first?.close();await second?.close();await reconnected?.close();await runtime.close();}
});

test('seat ownership, item completion and door duration are authoritative for separate humans',()=>{
 const r=new CampusRoom({code:'654321',seed:73}),host=r.join({rolePreference:'teacher'}),a=r.join({name:'甲'}),b=r.join({name:'乙'});r.begin(host);
 for(let i=0;i<299;i++)r.tick(.1);assert.equal(r.sim.stage,'seating');assert.equal(r.sim.layout.officeLocked,true);r.tick(.1);assert.equal(r.sim.stage,'class');assert.equal(r.sim.layout.officeLocked,false);
 for(const actor of r.sim.students)if(!actor.networkHuman){actor.seated=false;actor.seatId=null;actor.visible=false;}
 r.sim._seatingRoutes.clear();const seat=r.sim.seats[0];Object.assign(a.context.player,{x:seat.x,z:seat.z,yaw:seat.yaw,pitch:1.20,seated:false});Object.assign(b.context.player,{x:seat.x+.1,z:seat.z,yaw:seat.yaw,seated:false});
 assert.equal(r.command(a,'interact',[seat.id]),'seated');assert.equal(r.command(b,'interact',[seat.id]),false);
 a.context.player._slots=[{id:0,action:'snack',readyAt:0,progress:0}];a.context.player._selectedSlot=0;a.context.selected='snack';
 assert.equal(r.command(a,'toggleDrawer'),true);assert.equal(r.command(a,'takeSlot',[0]),true);assert.equal(r.command(a,'hold',[true]),true);
 for(let i=0;i<30;i++)r.tick(.1);assert.equal(a.context.player._slots[0].action,null);assert.ok(r.snapshot(a).score>0);assert.equal(r.snapshot(b).score,r.snapshot(a).score);
 r.command(a,'interact');const door=DOORS.find(d=>d.id==='rear');
 updateLayoutDoors(r.sim.layout,{rearDoorClosed:true});Object.assign(a.context.player,{x:6.30,z:door.center,yaw:-Math.PI/2,seated:false});
 assert.equal(r.command(a,'setDoorUse',[true,false]),false,'looking away cannot operate the door');
 a.context.player.yaw=Math.PI/2;assert.equal(r.command(a,'setDoorUse',[true,false]),true);
 for(let i=0;i<19;i++)r.tick(.1);assert.equal(r.sim.layout.rearDoorClosed,true);
 r.tick(.11);assert.equal(r.sim.layout.rearDoorClosed,false);
 assert.equal(r.command(a,'setDoorUse',[true,true]),false);
 a.context.player._slots=[{id:0,action:'banana',readyAt:0,progress:0}];a.context.player._selectedSlot=0;a.context.player._drawnSlot=0;a.context.player.seated=true;a.context.player.action='banana';a.context.selected='banana';r.command(a,'hold',[true]);for(let i=0;i<31;i++)r.tick(.1);assert.equal(r.snapshot(a).selected,'bananaPeel');assert.equal(a.context.player._slots[0].action,'bananaPeel');
 const other=new CampusRoom({code:'111111',seed:74});assert.notDeepEqual(r.sim.seats,other.sim.seats);assert.equal(other.sim.layout.rearDoorClosed,true);assert.equal(SEATS[0].pattern,'pairs');
});

test('browser adapter predicts each mouse delta immediately and reconciles acknowledged look',async()=>{
 const {connectCampusRoom}=await import('../dist/network-client.js'),runtime=createCampusServer();await new Promise(r=>runtime.server.listen(0,'127.0.0.1',r));const endpoint=`http://127.0.0.1:${runtime.server.address().port}`;let a,b;const errors=[];
 const wait=async(check)=>{for(let i=0;i<150;i++){if(check())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Adapter did not synchronize');};
 try{
  a=await connectCampusRoom({endpoint,name:'甲',onError:e=>errors.push(e)});b=await connectCampusRoom({endpoint,code:a.room.code,name:'乙',onError:e=>errors.push(e)});await wait(()=>a.snapshot().connection==='connected'&&b.snapshot().connection==='connected');
  const yaw=a.player.yaw;for(let i=0;i<8;i++)a.setLook(a.player.yaw+.05,.2);assert.ok(Math.abs(Math.atan2(Math.sin(a.player.yaw-yaw-.4),Math.cos(a.player.yaw-yaw-.4)))<1e-8,'mouse delta must accumulate without waiting for snapshot');assert.equal(a.snapshot().player.pitch,.2);
  await wait(()=>a._state.inputAck.look>=8);assert.ok(Math.abs(a.player.pitch-.2)<1e-5);assert.equal(a.stopComputer(),false,'Q must continue to returnItem when no computer is open');assert.deepEqual(errors,[]);
  const room=runtime.rooms.get(a.room.code),seed=room.seed;room.sim._finish('won','mischief');await wait(()=>a.status==='won');assert.equal(await b.continueAfterClass(),true);await wait(()=>b.snapshot().continued&&!a.snapshot().continued);assert.equal(await a.continueAfterClass(),true);for(let n=0;n<50;n++)room.tick(.1);await wait(()=>b.snapshot().stage==='gathering'&&b.status==='playing');assert.equal(room.seed,(seed+1)>>>0);assert.equal(room.members.size,2);assert.equal(room.teacherMember,null);assert.equal(a.room.code,b.room.code);assert.equal(a.room.members.every(m=>m.role==='student'),true);
 }finally{await a?.leave();await b?.leave();await runtime.close();}
});

test('two HTTP clients share the published playground availability and its vending state',async()=>{
 const {connectCampusRoom}=await import('../dist/network-client.js');
 const {PLAYGROUND_LAYOUT}=await import('../dist/playground-layout70.js');
 const runtime=createCampusServer();await new Promise(resolve=>runtime.server.listen(0,'127.0.0.1',resolve));
 const endpoint='http://127.0.0.1:'+runtime.server.address().port,errors=[];
 const wait=async check=>{for(let i=0;i<180;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,15));}throw new Error('房间状态没有同步');};
 let host,guest;
 try{
  host=await connectCampusRoom({endpoint,map:'playground',onError:error=>errors.push(error)});
  guest=await connectCampusRoom({endpoint,code:host.room.code,onError:error=>errors.push(error)});
  const room=runtime.rooms.get(host.room.code),v=PLAYGROUND_LAYOUT.vending[0];
  if(!OPEN_CAMPUS_MAPS.includes('playground')){
   await wait(()=>host.snapshot().connection==='connected'&&guest.snapshot().connection==='connected');
   for(const client of [host,guest]){
    const s=client.snapshot();assert.equal(s.map,'classroom');assert.equal(s.floor,2);assert.equal(s.vendingStock,undefined);
   }
   await assert.rejects(host._post('/api/command',{name:'travelFloor',args:['playground']}),/暂未开放/);
   assert.deepEqual((await guest._post('/api/command',{name:'pressVendingButton',args:[v.id]})).results,[false]);
   for(const member of room.members.values())Object.assign(member.context.player,{x:LIFT.x,z:LIFT.z,seated:false});
   host.travelFloor('computer');await wait(()=>guest.snapshot().elevator.targetMap==='computer');room.tick(elevatorDuration('classroom','computer'));
   await wait(()=>host.snapshot().map==='computer'&&guest.snapshot().map==='computer');
   assert.deepEqual(errors,[]);return;
  }
  for(const member of room.members.values())Object.assign(member.context.player,{x:v.x+1.2,z:v.z,seated:false});
  await wait(()=>host.snapshot().connection==='connected'&&guest.snapshot().connection==='connected'&&Math.abs(guest._state.player.x-v.x-1.2)<.01);
  host.pressVendingButton(v.id);
  await wait(()=>guest.snapshot().groundItems?.length===1);
  const item=guest.snapshot().groundItems[0],action=item.action;
  guest.takeGroundItem(item.id);await wait(()=>guest.snapshot().drawer.drawnSlot===0&&!host.snapshot().groundItems.length);
  assert.equal(guest.snapshot().selected,action);
  guest.dropItem();await wait(()=>guest.snapshot().drawer.drawnSlot===null&&host.snapshot().groundItems.length===1);
  host.takeGroundItem(host.snapshot().groundItems[0].id);await wait(()=>host.snapshot().drawer.drawnSlot===0&&!guest.snapshot().groundItems.length);
  assert.equal(host.snapshot().selected,action);assert.equal(host.snapshot().score,0);assert.deepEqual(errors,[]);
 }finally{await guest?.leave();await host?.leave();await runtime.close();}
});
