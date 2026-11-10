import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampusServer} from '../server/server.js';
import {CampusRoom} from '../server/room-simulation.js';
import {elevatorDuration} from '../dist/elevator-session.js';
import {TEACHER_SPAWN,SEATS,DOORS,LIFT} from '../dist/classroom-layout.js';

async function api(base,path,data,token,extra={}){const res=await fetch(base+path,{method:data?'POST':'GET',headers:{...(data?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`} :{}),...extra},body:data?JSON.stringify(data):undefined});return{status:res.status,data:await res.json()};}
async function stream(base,person){const controller=new AbortController(),messages=[],response=await fetch(`${base}/api/events?room=${person.room.code}`,{headers:{authorization:`Bearer ${person.token}`},signal:controller.signal});assert.equal(response.status,200);const reader=response.body.getReader(),decoder=new TextDecoder();let pending='';const task=(async()=>{try{for(;;){const {value,done}=await reader.read();if(done)return;pending+=decoder.decode(value,{stream:true});let i;while((i=pending.indexOf('\n\n'))>=0){const block=pending.slice(0,i);pending=pending.slice(i+2);const row=block.split('\n').find(l=>l.startsWith('data: '));if(row)messages.push({type:block.match(/event: (\w+)/)?.[1],data:JSON.parse(row.slice(6))});}}}catch(e){if(e.name!=='AbortError')throw e;}})();return{messages,async wait(check,timeout=2500){const start=Date.now();while(Date.now()-start<timeout){const hit=messages.find(check);if(hit)return hit;await new Promise(r=>setTimeout(r,15));}throw new Error('Timed out waiting for room packet');},async close(){controller.abort();await task;}};}

test('two independent HTTP peers share authoritative room, roles, movement, reconnect and voice signaling',async()=>{
 const runtime=createCampusServer();await new Promise(r=>runtime.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${runtime.server.address().port}`;let first,second,reconnected;
 try{
  assert.equal((await fetch(base+'/')).status,200);
  assert.equal((await api(base,'/api/rooms',{name:'reject'},null,{origin:'https://attacker.example'})).status,403);
  const a=(await api(base,'/api/rooms',{name:'房主',rolePreference:'teacher'})).data,b=(await api(base,`/api/rooms/${a.room.code}/join`,{name:'同学乙'})).data;
  assert.equal(a.room.code.length,6);assert.notEqual(a.token,b.token);assert.equal(b.room.members.length,2);assert.equal(JSON.stringify(b.room).includes(a.token),false);
  assert.equal((await api(base,`/api/command?room=${a.room.code}`,{name:'setMovement',args:[1,0]},'wrong')).status,401);
  first=await stream(base,a);second=await stream(base,b);
  const command=(p,name,args=[])=>api(base,`/api/command?room=${p.room.code}`,{name,args},p.token);
  assert.equal((await command(b,'startBell')).status,403);
  assert.equal((await command(b,'_finish',['won'])).status,400);
  assert.equal((await command(b,'setMovement',[999,0])).status,400);
  assert.equal((await command(a,'travelFloor',['computer7'])).status,409);
  const live=runtime.rooms.get(a.room.code);let passenger=0;for(const m of live.members.values())Object.assign(m.context.player,{x:LIFT.x+(passenger++?-.4:.4),z:LIFT.z,seated:false});
  assert.equal((await command(a,'travelFloor',['computer7'])).data.ok,true);assert.equal(live.map,'classroom');live.tick(elevatorDuration('classroom','computer7'));
  await second.wait(m=>m.type==='state'&&m.data.map==='computer7');
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
 r.sim._seatingRoutes.clear();const seat=r.sim.seats[0];Object.assign(a.context.player,{x:seat.x,z:seat.z,yaw:seat.yaw,pitch:.55,seated:false});Object.assign(b.context.player,{x:seat.x+.1,z:seat.z,yaw:seat.yaw,seated:false});
 assert.equal(r.command(a,'interact',[seat.id]),'seated');assert.equal(r.command(b,'interact',[seat.id]),false);
 a.context.player._slots=[{id:0,action:'snack',readyAt:0,progress:0}];a.context.player._selectedSlot=0;a.context.selected='snack';
 assert.equal(r.command(a,'toggleDrawer'),true);assert.equal(r.command(a,'takeSlot',[0]),true);assert.equal(r.command(a,'hold',[true]),true);
 for(let i=0;i<30;i++)r.tick(.1);assert.equal(a.context.player._slots[0].action,null);assert.ok(r.snapshot(a).score>0);assert.equal(r.snapshot(b).score,r.snapshot(a).score);
 r.command(a,'interact');const door=DOORS.find(d=>d.id==='rear');Object.assign(a.context.player,{x:8.00,z:-6.7,yaw:Math.PI,seated:false});r.command(a,'setDoorUse',[true]);for(let i=0;i<29;i++)r.tick(.1);assert.equal(r.sim.layout.rearDoorClosed,false);r.tick(.11);assert.equal(r.sim.layout.rearDoorClosed,true);
 Object.assign(a.context.player,{x:6.7,z:door.center,yaw:-Math.PI/2});r.command(a,'setDoorUse',[true]);r.tick(.1);assert.equal(r.snapshot(a).doorUse.holding,false,'looking away must cancel the interaction');
 Object.assign(a.context.player,{x:6.7,z:door.center,yaw:Math.PI/2});r.command(a,'setDoorUse',[true]);for(let i=0;i<31;i++)r.tick(.1);assert.equal(r.sim.layout.rearDoorClosed,false,'closed leaf can be reopened from corridor');
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
  const room=runtime.rooms.get(a.room.code),seed=room.seed;room.sim._finish('won','mischief');await wait(()=>a.status==='won');await assert.rejects(b.rematch(),/房主/);await a.rematch();await wait(()=>b.snapshot().stage==='gathering'&&b.status==='playing');assert.equal(room.seed,(seed+1)>>>0);assert.equal(room.members.size,2);assert.equal(room.teacherMember,null);assert.equal(a.room.code,b.room.code);assert.equal(a.room.members.every(m=>m.role==='student'),true);
 }finally{await a?.leave();await b?.leave();await runtime.close();}
});
