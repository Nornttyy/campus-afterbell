import test from 'node:test';
import assert from 'node:assert/strict';
import {connectCampusRoom,defaultCampusEndpoint} from '../dist/network-client.js';
import {CampusRoom} from '../server/room-simulation.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8'}});
const html=(status=200)=>new Response('<html><head>Private proxy debug page</head><body>Not found</body></html>',{status,headers:{'content-type':'text/html'}});
const health=()=>json({ok:true,protocol:1,rooms:0});
const wait=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,5));}throw new Error('Adapter did not reach expected state');};
const cleanError=error=>{assert.notEqual(error.name,'SyntaxError');assert.doesNotMatch(error.message,/<html|<head|Unexpected token|Private proxy|JSON\.parse/i);return true;};
function session(){const room=new CampusRoom({code:'535353',seed:53}),person=room.join({name:'测试'});return{token:person.token,room:room.publicRoom(person),state:room.snapshot(person)};}
function mockServer(t,{events,command,healthResponse,join}={}){
 const result=session(),calls=[],streams=[],errors=[];
 t.mock.method(globalThis,'fetch',async(url,options={})=>{
  const path=new URL(url).pathname;calls.push(path);
  if(path==='/api/health')return healthResponse?healthResponse():health();
  if(path==='/api/rooms'||path.endsWith('/join'))return join?join():json(result);
  if(path==='/api/command')return command?command():json({ok:true,results:[true]});
  if(path==='/api/leave'||path==='/api/voice')return json({ok:true});
  if(path==='/api/events'){
   if(events)return events(result);
   const body=new ReadableStream({start(controller){streams.push(controller);controller.enqueue(new TextEncoder().encode('event: state\r\ndata: '+JSON.stringify(result.state)+'\r\n\r\n'));options.signal?.addEventListener('abort',()=>{try{controller.error(new DOMException('Aborted','AbortError'));}catch{}},{once:true});}});
   return new Response(body,{headers:{'content-type':'text/event-stream; charset=utf-8'}});
  }
  throw new Error('Unexpected fixture path '+path);
 });
 return{result,calls,errors,streams,connect:options=>connectCampusRoom({endpoint:'https://rooms.example',onError:e=>errors.push(e),...options})};
}

test('GitHub Pages has no default API; blank addresses never issue any request',async t=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'location');let requests=0;t.mock.method(globalThis,'fetch',async()=>{requests++;throw new Error('must not fetch');});
 try{
  for(const hostname of ['github.io','nornttyy.github.io']){Object.defineProperty(globalThis,'location',{configurable:true,value:{hostname,origin:`https://${hostname}`,protocol:'https:',port:''}});assert.equal(defaultCampusEndpoint(),'');await assert.rejects(connectCampusRoom(),e=>cleanError(e)&&/尚未连接/.test(e.message));}
  Object.defineProperty(globalThis,'location',{configurable:true,value:{hostname:'127.0.0.1',origin:'http://127.0.0.1:8921',protocol:'http:',port:'8921'}});assert.equal(defaultCampusEndpoint(),'http://127.0.0.1:8931');
  Object.defineProperty(globalThis,'location',{configurable:true,value:{hostname:'rooms.example',origin:'https://rooms.example',protocol:'https:',port:''}});assert.equal(defaultCampusEndpoint(),'https://rooms.example');
  for(const endpoint of ['',null,'   ','not a URL','file:///local'])await assert.rejects(connectCampusRoom({endpoint}),cleanError);
  assert.equal(requests,0);
 }finally{if(original)Object.defineProperty(globalThis,'location',original);else delete globalThis.location;}
});

for(const status of [200,404,405])test(`HTML health ${status} is identified as a missing backend before creating a room`,async t=>{
 const f=mockServer(t,{healthResponse:()=>html(status)});await assert.rejects(f.connect(),e=>cleanError(e)&&/没有多人房间服务/.test(e.message));assert.deepEqual(f.calls,['/api/health']);
});
test('health protocol and schema are checked; transport failures are understandable',async t=>{
 let response=()=>json({ok:true,protocol:2,rooms:0});const f=mockServer(t,{healthResponse:()=>response()});
 for(const data of [{ok:true,protocol:2,rooms:0},{ok:true},null,[]]){response=()=>json(data);await assert.rejects(f.connect(),cleanError);}
 response=()=>html(503);await assert.rejects(f.connect(),e=>cleanError(e)&&/暂时不可用/.test(e.message)&&e.terminal===false);
 response=()=>{throw new TypeError('Failed to fetch <secret>');};await assert.rejects(f.connect(),e=>cleanError(e)&&/无法连接/.test(e.message));
 assert.ok(f.calls.every(path=>path==='/api/health'));
});

for(const code of ['', '535353'])test(`${code?'join':'create'} checks HTML, malformed JSON and session schema`,async t=>{
 let response=()=>html();const f=mockServer(t,{join:()=>response()});
 for(const factory of [()=>html(),()=>html(404),()=>new Response('<html>bad</html>',{headers:{'content-type':'application/json'}}),()=>json({token:'token'}),()=>json({token:f.result.token,room:f.result.room,state:{player:{}}})]){response=factory;await assert.rejects(f.connect({code}),cleanError);}
 assert.equal(f.calls.includes('/api/events'),false);assert.ok(f.calls.includes(code?'/api/rooms/535353/join':'/api/rooms'));
});
test('valid JSON room errors remain specific without surfacing markup in malformed error bodies',async t=>{
 let body={error:'没有这个房间号'};const f=mockServer(t,{join:()=>json(body,404)});
 await assert.rejects(f.connect({code:'535353'}),/没有这个房间号/);body={error:'<html>Private proxy</html>'};await assert.rejects(f.connect({code:'535353'}),cleanError);
});

for(const kind of ['html','broken-json','bad-schema'])test(`POST ${kind} is rejected and stops sending commands after a protocol failure`,async t=>{
 const f=mockServer(t,{command:()=>kind==='html'?html():kind==='broken-json'?new Response('<html>',{headers:{'content-type':'application/json'}}):json({ok:true,results:'yes'})});const round=await f.connect();
 try{await wait(()=>round.snapshot().connection==='connected');await assert.rejects(round._post('/api/command',{name:'setMovement',args:[0,0]}),cleanError);assert.equal(round.snapshot().connection,'failed');assert.equal(round.command('setMovement',1,0),false);assert.equal(round._retry,null);assert.equal(f.errors.length,1);assert.doesNotMatch(f.errors[0],/<|Unexpected token/);}
 finally{await round.leave();}
});
test('business rejection does not close the healthy stream or prevent later commands',async t=>{
 let forbidden=true;const f=mockServer(t,{command:()=>forbidden?json({error:'只有房主可以开始'},403):json({ok:true,results:[true]})});const round=await f.connect();
 try{await wait(()=>round.snapshot().connection==='connected');await assert.rejects(round._post('/api/command',{name:'startBell'}),/只有房主/);assert.equal(round.snapshot().connection,'connected');assert.equal(round._terminalError,undefined);forbidden=false;assert.deepEqual(await round._post('/api/command',{name:'setMovement',args:[0,0]}),{ok:true,results:[true]});}
 finally{await round.leave();}
});

for(const kind of ['html200','json200','bad-json-event','bad-state','wrong-room','bad-voice'])test(`SSE ${kind} cannot enter an automatic reconnect loop`,async t=>{
 const f=mockServer(t,{events:result=>{
  if(kind==='html200')return html();if(kind==='json200')return json({ok:true});
  const type=kind==='bad-voice'?'voice':'state',value=kind==='bad-json-event'?'<html>Private proxy</html>':JSON.stringify(kind==='bad-state'?{player:null}:kind==='wrong-room'?{...result.state,room:{...result.room,code:'999999'}}:kind==='bad-voice'?{from:'x',kind:'unknown',payload:{}}:result.state);
  return new Response(`event: ${type}\ndata: ${value}\n\n`,{headers:{'content-type':'text/event-stream'}});
 }});const round=await f.connect();
 try{await wait(()=>round.snapshot().connection==='failed');assert.equal(round._retry,null);assert.equal(round._queued.length,0);assert.equal(f.calls.filter(p=>p==='/api/events').length,1);assert.equal(f.errors.length,1);assert.doesNotMatch(f.errors[0],/<|Unexpected token|Private proxy/);}
 finally{await round.leave();}
});
test('SSE temporary gateway failures retain recovery while authorization failure stops it',async t=>{
 let status=503;const f=mockServer(t,{events:()=>status===503?html(503):json({error:'房间连接已失效'},401)});let round=await f.connect();
 try{await wait(()=>round._retry);assert.equal(round.snapshot().connection,'connecting');assert.equal(round._terminalError,undefined);assert.match(f.errors[0],/暂时不可用/);}finally{await round.leave();}
 status=401;round=await f.connect();try{await wait(()=>round.snapshot().connection==='failed');assert.equal(round._retry,null);assert.match(f.errors.at(-1),/连接已失效/);}finally{await round.leave();}
});
test('valid CRLF event stream updates the room and authoritative state only after validation',async t=>{
 const f=mockServer(t),round=await f.connect({code:'535353'});
 try{await wait(()=>round.snapshot().connection==='connected');const next={...f.result.state,score:19,sequence:f.result.state.sequence+1};f.streams[0].enqueue(new TextEncoder().encode('event:state\r\ndata:'+JSON.stringify(next)+'\r\n\r\n'));await wait(()=>round.snapshot().score===19);assert.deepEqual(f.errors,[]);assert.equal(round.room.code,'535353');}
 finally{await round.leave();}
});

test('coalesced valid SSE events over 512KB remain connected after a delayed browser read',async t=>{
 let controller,finalSequence;const f=mockServer(t,{events:result=>{
  const packet=index=>'event: state\r\ndata: '+JSON.stringify({...result.state,score:index,sequence:result.state.sequence+index})+'\r\n\r\n';
  const events=[];let size=0;for(let i=1;size<700000;i++){const next=packet(i);assert.ok(next.length<524288);events.push(next);size+=next.length;finalSequence=result.state.sequence+i;}
  const body=new ReadableStream({start(out){controller=out;out.enqueue(new TextEncoder().encode(events.join('')));}});
  return new Response(body,{headers:{'content-type':'text/event-stream'}});
 }}),round=await f.connect();
 try{await wait(()=>round.snapshot().sequence===finalSequence);assert.equal(round.snapshot().connection,'connected');assert.deepEqual(f.errors,[]);assert.equal(round._retry,null);assert.equal(f.calls.filter(path=>path==='/api/events').length,1);}
 finally{controller.close();await round.leave();}
});

for(const ended of[true,false])test(`oversized ${ended?'complete':'unfinished'} SSE event still terminates without retry`,async t=>{
 const f=mockServer(t,{events:result=>new Response('event: state\ndata: '+JSON.stringify({...result.state,padding:'x'.repeat(524288)})+(ended?'\n\n':''),{headers:{'content-type':'text/event-stream'}})}),round=await f.connect();
 try{await wait(()=>round.snapshot().connection==='failed');assert.equal(f.errors.length,1);assert.equal(round._retry,null);assert.equal(round._terminalError.terminal,true);}
 finally{await round.leave();}
});

test('a malformed event inside a valid coalesced batch is still rejected',async t=>{
 const f=mockServer(t,{events:result=>new Response('event: state\ndata: '+JSON.stringify(result.state)+'\n\nevent: state\ndata: '+JSON.stringify({...result.state,player:{...result.state.player,x:null}})+'\n\n',{headers:{'content-type':'text/event-stream'}})}),round=await f.connect();
 try{await wait(()=>round.snapshot().connection==='failed');assert.equal(f.errors.length,1);assert.equal(round._retry,null);}
 finally{await round.leave();}
});
