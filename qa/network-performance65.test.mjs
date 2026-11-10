import test from 'node:test';
import assert from 'node:assert/strict';
import {CampusRoom,MAX_ROOM_PLAYERS} from '../server/room-simulation.js';
import {createCampusServer} from '../server/server.js';
import {NetworkRound} from '../dist/network-client.js';
import {diffNetworkState,applyNetworkDelta} from '../dist/network-state65.js';
import {blocked} from '../dist/classroom-layout.js';

const wait=async(check,timeout=2500)=>{const start=performance.now();while(performance.now()-start<timeout){if(check())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Room did not synchronize');};
async function post(base,path,data,token){const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});return{status:response.status,data:await response.json()};}
async function observe(base,peer,delta=true){
 const controller=new AbortController(),response=await fetch(`${base}/api/events?room=${peer.room.code}${delta?'&delta=1':''}`,{headers:{authorization:'Bearer '+peer.token},signal:controller.signal});assert.equal(response.status,200);
 const out={state:null,packets:0,bytes:0,full:0,patches:0,errors:[],sequences:[]},reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
 const task=(async()=>{try{for(;;){const {value,done}=await reader.read();if(done)break;out.bytes+=value.length;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const packet=buffer.slice(0,end);buffer=buffer.slice(end+2);const type=packet.match(/event: (\w+)/)?.[1],data=packet.match(/data: (.+)/)?.[1];if(!data||!['state','patch'].includes(type))continue;const message=JSON.parse(data);if(type==='patch'){assert.equal(message.baseSequence,out.state.sequence);out.state=applyNetworkDelta(out.state,message.patch);assert.equal(out.state.sequence,message.sequence);out.patches++;}else{out.state=message;out.full++;}out.packets++;out.sequences.push(out.state.sequence);}}}catch(e){if(e.name!=='AbortError')out.errors.push(e);}})();
 return Object.assign(out,{async close(){controller.abort();await task;}});
}

test('hard eight-person room cap includes the teacher and cannot be increased by configuration',()=>{
 for(const requested of [undefined,8,16,999]){const room=new CampusRoom({code:'656565',maxPlayers:requested}),people=Array.from({length:8},(_,i)=>room.join({rolePreference:i?'student':'teacher'}));assert.equal(MAX_ROOM_PLAYERS,8);assert.equal(room.maxPlayers,8);assert.throws(()=>room.join(),/最多8人/);room.begin(people[0]);assert.equal(people.filter(p=>p.role==='teacher').length,1);assert.equal(room.sim._team.size,7);}
});
test('delta state reconstructs changing arrays, hidden fields and clear events without mutating the baseline',()=>{
 const room=new CampusRoom({code:'656566',seed:65}),teacher=room.join({rolePreference:'teacher'}),student=room.join();const before=structuredClone(room.snapshot(student)),original=structuredClone(before);room.begin(teacher);room.tick(.05);const after=structuredClone(room.snapshot(student)),delta=diffNetworkState(before,after),rebuilt=applyNetworkDelta(before,delta);assert.deepEqual(rebuilt,after);assert.deepEqual(before,original);
 const removed={...after,students:after.students.slice(0,3),events:[]};delete removed.teacher;assert.deepEqual(applyNetworkDelta(after,diffNetworkState(after,removed)),removed);
 assert.throws(()=>applyNetworkDelta(before,JSON.parse('[1,{"__proto__":[0,{"polluted":true}]},[]]')));assert.equal({}.polluted,undefined);
});
test('eight actual HTTP streams stay near 15Hz under simultaneous input; ninth join fails; legacy full snapshots still work',async t=>{
 const runtime=createCampusServer();await new Promise(r=>runtime.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${runtime.server.address().port}`,peers=[],streams=[];
 try{
  for(let i=0;i<8;i++){const result=await post(base,i?`/api/rooms/${peers[0].room.code}/join`:'/api/rooms',{name:'同学'+i,rolePreference:i?'student':'teacher'});assert.equal(result.status,i?200:201);peers.push(result.data);streams.push(await observe(base,result.data,i!==7));}
  assert.equal((await post(base,`/api/rooms/${peers[0].room.code}/join`,{name:'第九人'})).status,409);await wait(()=>streams.every(s=>s.state?.room.members.length===8));
  const baseline=streams.map(s=>({packets:s.packets,bytes:s.bytes})),start=performance.now();
  for(let tick=0;tick<20;tick++){const results=await Promise.all(peers.map(p=>post(base,`/api/command?room=${p.room.code}`,{commands:[{name:'setLook',args:[tick*.03,.1],inputSeq:tick+1},{name:'setMovement',args:[0,.15],inputSeq:tick+1}]},p.token)));assert.ok(results.every(r=>r.status===200));await new Promise(r=>setTimeout(r,50));}
  await wait(()=>streams.every(s=>s.state.inputAck.look===20));const seconds=(performance.now()-start)/1000;
  for(let i=0;i<8;i++){assert.deepEqual(streams[i].errors,[]);assert.ok((streams[i].packets-baseline[i].packets)/seconds<25,'one player input must not broadcast the whole room again');assert.ok(streams[i].sequences.every((v,j,a)=>j===0||v>=a[j-1]));assert.equal(streams[i].state.room.maxPlayers,8);}
  assert.ok(streams.slice(0,7).every(s=>s.patches>0));assert.equal(streams[7].patches,0);assert.ok(streams[7].full>0);
  const compactBytes=streams[0].bytes-baseline[0].bytes,fullBytes=streams[7].bytes-baseline[7].bytes;assert.ok(compactBytes<fullBytes*.25,'unchanged classmates/seats should not be resent in every delta');t.diagnostic(`8 HTTP peers: ${(streams[0].packets-baseline[0].packets)/seconds} updates/s, compact ${compactBytes} B versus legacy ${fullBytes} B over ${seconds.toFixed(2)} s`);
  const before=streams[0].state.sequence;await streams[0].close();streams[0]=await observe(base,peers[0]);await wait(()=>streams[0].state?.sequence>=before);assert.ok(streams[0].full>=1,'reconnect always starts with a complete state');assert.deepEqual(streams[0].errors,[]);
 }finally{for(const stream of streams)await stream.close();await runtime.close();}
});

test('local visual movement is immediate, collision bounded, reconciled and stops on lost updates',()=>{
 const room=new CampusRoom({code:'656567',seed:65}),member=room.join(),state=room.snapshot(member),round=Object.create(NetworkRound.prototype);
 Object.assign(round,{_state:state,_connected:true,_closed:false,_localPaused:false,_queued:[],_last:{},_look:null,_lookSeq:0,_moveSeq:0,_localMotion:{x:0,z:0},_visualPosition:null,_correction:{x:0,z:0},_receivedAt:performance.now(),_rtt:50,_predictionLayout:null,_frames:[],room:state.room});
 const initial=round.player.z;round.setMovement(0,1);round.step(1/60);assert.ok(round.player.z>initial,'W should move the camera before the next server response');assert.equal(state.player.z,initial,'prediction may not mutate authoritative state');assert.equal(blocked(round.player.x,round.player.z,.18,round._predictionLayout),false);
 for(let i=0;i<400;i++){round._receivedAt=performance.now();round.step(1/60);assert.equal(blocked(round.player.x,round.player.z,.18,round._predictionLayout),false);}
 const stopped={...round.player};round._receivedAt=performance.now()-300;round.step(.1);assert.equal(round.player.x,stopped.x);assert.equal(round.player.z,stopped.z);
 const seated={...state,player:{...state.player,seated:true,x:1,z:2},sequence:state.sequence+1};round._state=seated;round._reconcileLocal(state,seated);assert.equal(round.player.x,1);assert.equal(round.player.z,2);
});

test('visual scene time advances every render frame while seated and stops on pause or stale connection',()=>{
 const room=new CampusRoom({code:'656568',seed:65}),member=room.join(),state=room.snapshot(member),round=Object.create(NetworkRound.prototype);state.player.seated=true;
 Object.assign(round,{_state:state,_connected:true,_localPaused:false,_visualTime:10,_clockCorrection:-.04,_receivedAt:performance.now(),_frames:[],_look:null,_visualPosition:null,room:state.room});
 const times=[];for(let i=0;i<4;i++)times.push(round.step(1/60).sceneElapsed);assert.ok(times.every((v,i)=>i===0||v>times[i-1]));assert.equal(state.sceneElapsed,0,'render clock may not mutate gameplay time');
 round._localPaused=true;const paused=round.snapshot().sceneElapsed;round.step(1/60);assert.equal(round.snapshot().sceneElapsed,paused);
 round._localPaused=false;round._receivedAt=performance.now()-300;round.step(1/60);assert.equal(round.snapshot().sceneElapsed,paused);
});

test('front and office network hold progress use the shared HUD interaction kind and retain door identity',()=>{
 for(const [id,p]of[['front',{x:6.2,z:7,yaw:Math.PI/2}],['office',{x:9.2,z:7.3,yaw:0}]]){
  const room=new CampusRoom({code:'650066',seed:73}),member=room.join();for(let i=0;i<20;i++)room.tick(.1);Object.assign(member.context.player,p,{seated:false});assert.equal(room.command(member,'setDoorUse',[true,false,id]),true);room.tick(.5);const state=room.snapshot(member);assert.equal(state.interaction.kind,'rear-door');assert.equal(state.interaction.doorId,id);assert.equal(state.doorUse.id,id);assert.ok(state.interaction.progress>0&&state.interaction.progress<1);assert.equal(state.doorUse.progress,state.interaction.progress);
 }
});
