import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampusServer} from '../server/server.js';
import {connectCampusRoom} from '../dist/network-client.js';

const wait=async(predicate,timeout=2500)=>{const end=Date.now()+timeout;while(Date.now()<end){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Room condition timed out');};
async function start(t,options={}){
 const runtime=createCampusServer(options);await new Promise((resolve,reject)=>{runtime.server.once('error',reject);runtime.server.listen(0,'127.0.0.1',resolve);});
 t.after(()=>runtime.close());const base=`http://127.0.0.1:${runtime.server.address().port}`;
 const request=async(path,data,token)=>{const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(data)});assert.match(response.headers.get('content-type'),/application\/json/);return{status:response.status,body:await response.json()};};
 const person=(await request('/api/rooms',{name:'网络回归'})).body,room=runtime.rooms.get(person.room.code),member=room.findToken(person.token);
 return{runtime,base,request,person,room,member,command:data=>request(`/api/command?room=${person.room.code}`,data,person.token)};
}
async function stream(base,person,since){
 const abort=new AbortController(),packets=[];
 const response=await fetch(`${base}/api/events?room=${person.room.code}${since===undefined?'':`&since=${since}`}`,{headers:{authorization:`Bearer ${person.token}`},signal:abort.signal});
 assert.equal(response.status,200);const reader=response.body.getReader();let buffer='';const decoder=new TextDecoder();
 const task=(async()=>{try{for(;;){const {value,done}=await reader.read();if(done)return;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const packet=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=packet.split('\n').find(line=>line.startsWith('data:'));if(data)packets.push({type:packet.match(/event: (\w+)/)?.[1],data:JSON.parse(data.slice(5))});}}}catch(error){if(error.name!=='AbortError')throw error;}finally{reader.releaseLock();}})();
 return{packets,close:async()=>{abort.abort();await task;}};
}

test('malformed JSON body shapes receive JSON 400 instead of crashing the route',async t=>{
 const f=await start(t);
 for(const [path,value]of[['/api/rooms',null],[`/api/rooms/${f.person.room.code}/join`,[]],[`/api/command?room=${f.person.room.code}`,null],[`/api/voice?room=${f.person.room.code}`,'invalid']]){
  const response=await f.request(path,value,f.person.token);assert.equal(response.status,400,`${path} must reject a non-object body`);
 }
 assert.equal(f.room.members.size,1);
 assert.equal((await f.command({padding:'x'.repeat(17000),name:'setMovement',args:[0,0]})).status,413);
 const badPath=await fetch(f.base+'/%E0%A4%A');assert.equal(badPath.status,400);assert.match(badPath.headers.get('content-type'),/application\/json/);
});

test('a malformed command envelope rejects the entire batch before its first mutation',async t=>{
 const f=await start(t),yaw=f.member.context.player.yaw;
 const response=await f.command({commands:[{name:'setLook',args:[.72,.1]},{name:'setLook',args:'invalid'}]});
 assert.equal(response.status,400);assert.equal(f.member.context.player.yaw,yaw,'a rejected envelope must not partially apply input');
 for(const input of [{commands:[]},{commands:false},{name:'setLook',args:[]},{name:'setLook',args:[null,0]},{name:'setLook',args:[1,0],inputSeq:-1},{name:'setPreference',args:[null]}])assert.equal((await f.command(input)).status,400);
});

test('a disconnected player cannot restart movement or use by a late HTTP command',async t=>{
 const f=await start(t),events=await stream(f.base,f.person);t.after(()=>events.close());await wait(()=>events.packets.length);
 await events.close();await wait(()=>!f.member.connected);
 assert.equal((await f.command({name:'setMovement',args:[1,0]})).status,409);
 assert.deepEqual(f.member.context._movement,{x:0,z:0});
 const again=await stream(f.base,f.person);t.after(()=>again.close());await wait(()=>again.packets.length);
 assert.equal((await f.command({name:'setMovement',args:[1,0]})).status,200,'same token works after SSE reconnect');
});

test('SSE reconnect replays missed events from the client cursor and keeps recipient privacy',async t=>{
 const f=await start(t),events=await stream(f.base,f.person);t.after(()=>events.close());await wait(()=>events.packets.length);
 const cursor=events.packets[0].data.sequence;
 f.room.events.push({type:'banana-slip',studentId:f.member.studentId,networkSequence:++f.room.sequence});
 f.room.events.push({type:'private-test',recipientId:99999,networkSequence:++f.room.sequence});
 await wait(()=>events.packets.some(p=>p.data.events?.some(e=>e.type==='banana-slip')));
 await events.close();await wait(()=>!f.member.connected);
 // The server wrote this event, but a browser can lose that last packet when
 // its socket breaks. Resume from the last state the browser actually applied.
 const resumed=await stream(f.base,f.person,cursor);t.after(()=>resumed.close());await wait(()=>resumed.packets.length);
 assert.equal(resumed.packets[0].data.events.filter(e=>e.type==='banana-slip').length,1);
 assert.equal(resumed.packets[0].data.events.some(e=>e.type==='private-test'),false);
});

test('malformed voice packets cannot be forwarded into another player\'s state stream',async t=>{
 const f=await start(t),other=(await f.request(`/api/rooms/${f.person.room.code}/join`,{name:'接收者'})).body;
 const events=await stream(f.base,other);t.after(()=>events.close());await wait(()=>events.packets.length);
 for(const payload of[null,[],{},'bad'])assert.equal((await f.request(`/api/voice?room=${f.person.room.code}`,{to:other.room.selfId,kind:'mute',payload},f.person.token)).status,400);
 assert.equal((await f.request(`/api/voice?room=${f.person.room.code}`,{to:other.room.selfId,kind:'mute',payload:{muted:true}},f.person.token)).status,200);
 await wait(()=>events.packets.some(p=>p.type==='voice'));assert.equal(events.packets.filter(p=>p.type==='voice').length,1);
});

test('the real browser adapter discards unacknowledged look and refuses actions while reconnecting',async t=>{
 const f=await start(t);let round;try{
  round=await connectCampusRoom({endpoint:f.base,code:f.person.room.code});await wait(()=>round.snapshot().connection==='connected');
  round.setLook(1.1,.4);assert.ok(round._look);round._controller.abort();await wait(()=>round._retry);
  assert.equal(round._look,null);assert.equal(round.setMovement(1,0),false);assert.equal(round._queued.length,0);
  await wait(()=>round.snapshot().connection==='connected');assert.equal(round.setMovement(0,0),true);
 }finally{await round?.leave();}
});

test('repeated state deliveries do not replay gameplay events in the browser adapter',async t=>{
 const f=await start(t);let round;try{
  round=await connectCampusRoom({endpoint:f.base,code:f.person.room.code});await wait(()=>round.snapshot().connection==='connected');round.drainEvents();
  const member=f.room.findToken(round.token),sequence=++f.room.sequence;f.room.events.push({type:'banana-slip',networkSequence:sequence});
  await wait(()=>round._sequence>=sequence);assert.equal(round.drainEvents().filter(e=>e.type==='banana-slip').length,1);
  member.lastSequence=sequence-1;const prior=round._sequence;await wait(()=>round._sequence>prior);
  assert.equal(round.drainEvents().some(e=>e.type==='banana-slip'),false);
 }finally{await round?.leave();}
});

test('a silent SSE stream times out and reconnects instead of leaving the player frozen forever',async t=>{
 const f=await start(t),errors=[];
 // Simulate a gateway that delivers the initial state, then silently stops
 // forwarding SSE bytes. Keep the production server's normal 15Hz cadence.
 f.runtime.server.prependListener('request',(request,response)=>{
  if(new URL(request.url,'http://localhost').pathname!=='/api/events')return;
  const write=response.write.bind(response);let firstState=false;
  response.write=(chunk,...args)=>{
   if(/event: (?:state|patch)\n/.test(String(chunk))){
    if(firstState){const done=args.find(arg=>typeof arg==='function');done?.();return true;}
    firstState=true;
   }
   return write(chunk,...args);
  };
 });
 let round;try{
  round=await connectCampusRoom({endpoint:f.base,code:f.person.room.code,onError:error=>errors.push(error)});await wait(()=>round.snapshot().connection==='connected');
  const first=round._controller;await wait(()=>round._retry,12000);assert.equal(first.signal.aborted,true);assert.equal(round.snapshot().connection,'connecting');assert.match(errors[0],/超时/);
  await wait(()=>round.snapshot().connection==='connected');assert.notEqual(round._controller,first);assert.equal(round._terminalError,undefined);
 }finally{await round?.leave();}
});

test('a simulation failure closes its streams and marks the browser session failed',async t=>{
 const f=await start(t),logs=[],errors=[];t.mock.method(console,'error',(...args)=>logs.push(args.join(' ')));let round;try{
  round=await connectCampusRoom({endpoint:f.base,code:f.person.room.code,onError:error=>errors.push(error)});await wait(()=>round.snapshot().connection==='connected');
  f.room.tick=()=>{throw new Error('intentional simulation fault');};await wait(()=>round.snapshot().connection==='failed');
  assert.equal(f.runtime.rooms.has(f.person.room.code),false);assert.equal(round._retry,null);assert.equal(errors.length,1);assert.match(logs[0],/Room tick stopped/);
  assert.equal((await fetch(f.base+'/api/health')).status,200,'the HTTP service survives a failed room');
 }finally{await round?.leave();}
});

test('abandoned create/join sessions expire even if their SSE never opened',async t=>{
 const f=await start(t);f.member.lastSeen=Date.now()-16000;await wait(()=>!f.member.connected);
 f.member.lastSeen=Date.now()-61000;f.room.updatedAt=Date.now()-61000;await wait(()=>!f.runtime.rooms.has(f.person.room.code));
});

test('local preview ports and an explicitly allowed Pages origin work without opening arbitrary cross-origin access',async t=>{
 const f=await start(t,{allowedOrigins:['https://nornttyy.github.io']});
 for(const origin of['http://127.0.0.1:8922','http://localhost:8921','https://nornttyy.github.io']){const response=await fetch(f.base+'/api/health',{headers:{origin}});assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),origin);}
 const rejected=await fetch(f.base+'/api/health',{headers:{origin:'https://unrelated.example'}});assert.equal(rejected.status,403);assert.equal(rejected.headers.get('access-control-allow-origin'),null);
});
