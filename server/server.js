import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomInt} from 'node:crypto';
import {CampusRoom,RoomError} from './room-simulation.js';
import {diffNetworkState} from '../dist/network-state65.js';

const DIST=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function validCommand(command){
 if(!object(command)||typeof command.name!=='string'||!command.name.length||command.name.length>64)return false;
 const args=command.args??[];
 if(!Array.isArray(args)||args.length>3||command.args===null||command.inputSeq!==undefined&&(!Number.isSafeInteger(command.inputSeq)||command.inputSeq<0))return false;
 if(['setMovement','setLook'].includes(command.name)&&!(args.length===2&&args.every(n=>typeof n==='number'&&Number.isFinite(n))))return false;
 if(['setPreference','configureRound'].includes(command.name)&&!(args.length===1&&object(args[0])))return false;
 if(command.name==='startBell'&&(args.length>1||args.length===1&&!object(args[0])))return false;
 return true;
}
function validVoice(kind,payload){
 if(!object(payload)||JSON.stringify(payload).length>10000)return false;
 if(kind==='mute')return typeof payload.muted==='boolean';
 if(kind==='offer'||kind==='answer')return payload.type===kind&&typeof payload.sdp==='string';
 if(kind==='ice')return typeof payload.candidate==='string'&&(payload.sdpMid==null||typeof payload.sdpMid==='string')&&(payload.sdpMLineIndex==null||Number.isInteger(payload.sdpMLineIndex)&&payload.sdpMLineIndex>=0);
 return false;
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ogg':'audio/ogg','.mp3':'audio/mpeg','.mp4':'video/mp4','.svg':'image/svg+xml'};
export function createCampusServer({rooms=new Map(),allowedOrigins=[],tickHz=30,snapshotHz=15,maxRooms=40}={}){
 const streams=new Map(),buckets=new Map();let tickCount=0,last=performance.now(),snapshotAccumulator=0;
 const snapshotInterval=1/Math.max(1,Math.min(30,snapshotHz));
 function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));}
 function auth(req,url){const code=url.searchParams.get('room')||url.pathname.split('/')[3],room=rooms.get(code),token=(req.headers.authorization||'').replace(/^Bearer /,'');const member=room?.findToken(token);if(!room||!member)throw new RoomError(401,'房间连接已失效');return{room,member};}
 async function body(req){let bytes=0,parts=[];for await(const p of req){bytes+=p.length;if(bytes<=16384)parts.push(p);}if(bytes>16384)throw new RoomError(413,'请求太大');try{const input=JSON.parse(Buffer.concat(parts).toString()||'{}');if(!object(input))throw new Error();return input;}catch{throw new RoomError(400,'请求格式错误');}}
 function active(room,member){if(!rooms.has(room.code)||room.members.get(member.id)!==member)throw new RoomError(401,'房间连接已失效');if(!member.connected)throw new RoomError(409,'连接正在恢复，请稍后重试');}
 function send(member,type,data){
  const res=streams.get(member.id);if(!res||res.destroyed||res.writableEnded)return false;
  // A slow client must not accumulate seconds of old world states. Wait for
  // drain, then send one fresh state; retain the event cursor until that write.
  if((type==='state'||type==='patch')&&res.writableNeedDrain)return false;
  if(res.writableLength>524288){res.destroy();return false;}
  res.write(`${type==='state'||type==='patch'?`id: ${data.sequence}\n`:''}event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);return true;
 }
 function sendState(room,member){
  const res=streams.get(member.id);if(!res||res.writableNeedDrain)return;
  const cursor=member.lastSequence,state=room.snapshot(member),now=performance.now();let type='state',packet=state;
  if(res.deltaMode&&res.lastState&&now-res.lastKeyframe<2000&&res.lastState.map===state.map){
   const patch=diffNetworkState(res.lastState,state);type='patch';packet={baseSequence:res.lastState.sequence,sequence:state.sequence,patch:patch||[1,{},[]]};
  }
  if(send(member,type,packet)){if(type==='state')res.lastKeyframe=now;if(res.deltaMode)res.lastState=structuredClone(state);}
  else member.lastSequence=cursor;
 }
 function flush(room){for(const member of room.members.values())if(member.connected&&streams.has(member.id))sendState(room,member);}
 function rate(key,max=150){const now=Date.now();let b=buckets.get(key);if(!b||now-b.since>1000)b={since:now,n:0};b.n++;buckets.set(key,b);if(b.n>max)throw new RoomError(429,'操作过快');}
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost'),origin=req.headers.origin,own=`http://${req.headers.host}`,secureOwn=`https://${req.headers.host}`;
   const localOrigin=origin&&/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/.test(origin);
   if(origin&&origin!==own&&origin!==secureOwn&&!allowedOrigins.includes(origin)&&!localOrigin)throw new RoomError(403,'此网页不能访问该房间服务');
   if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
   if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type,authorization','Access-Control-Max-Age':'600'});res.end();return;}
   if(url.pathname==='/api/health'){json(res,200,{ok:true,protocol:1,rooms:rooms.size});return;}
   if(req.method==='POST'&&url.pathname==='/api/rooms'){
    rate(req.socket.remoteAddress,5);if(rooms.size>=maxRooms)throw new RoomError(503,'当前房间已满，请稍后再试');const input=await body(req);let code;do{code=String(randomInt(100000,1000000));}while(rooms.has(code));
    const room=new CampusRoom({code,map:input.map,floor:input.floor,settings:input.settings}),member=room.join(input);rooms.set(code,room);json(res,201,{token:member.token,room:room.publicRoom(member),state:room.snapshot(member)});return;
   }
   if(req.method==='POST'&&/^\/api\/rooms\/\d{6}\/join$/.test(url.pathname)){
    rate(req.socket.remoteAddress,12);const code=url.pathname.split('/')[3],room=rooms.get(code);if(!room)throw new RoomError(404,'没有这个房间号');const member=room.join(await body(req));json(res,200,{token:member.token,room:room.publicRoom(member),state:room.snapshot(member)});flush(room);return;
   }
   if(req.method==='GET'&&url.pathname==='/api/events'){
    const {room,member}=auth(req,url),since=url.searchParams.get('since')??req.headers['last-event-id'];
    if(since!==undefined&&since!==null&&(!/^\d+$/.test(since)||!Number.isSafeInteger(Number(since))||Number(since)>room.sequence))throw new RoomError(400,'无效的房间状态序号');
    // A successful write is not proof the browser received it. Resume from its
    // applied state cursor; snapshot still filters private/role-only events.
    if(since!==undefined&&since!==null)member.lastSequence=Number(since);
    const previous=streams.get(member.id);res.deltaMode=url.searchParams.get('delta')==='1';res.lastState=null;res.lastKeyframe=0;req.socket.setNoDelay(true);streams.set(member.id,res);previous?.end();room.reconnect(member);
    res.on('close',()=>{if(streams.get(member.id)===res){streams.delete(member.id);room.disconnect(member);flush(room);}});
    res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store','connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': connected\n\n');sendState(room,member);return;
   }
   if(req.method==='POST'&&url.pathname==='/api/command'){
    const {room,member}=auth(req,url);rate(member.id,70);const input=await body(req),batch=input.commands===undefined?[input]:input.commands;active(room,member);
    if(!Array.isArray(batch)||!batch.length||batch.length>12)throw new RoomError(400,'操作数量无效');
    if(!batch.every(validCommand))throw new RoomError(400,'操作参数错误');const results=[];
    for(const c of batch)results.push(Boolean(room.command(member,c.name,c.args??[],c.inputSeq??0)));
    // Coalesce all players' commands into the fixed snapshot cadence.
    // Broadcasting on every mouse update multiplied traffic by player count.
    json(res,200,{ok:true,results});return;
   }
   if(req.method==='POST'&&url.pathname==='/api/voice'){
    const {room,member}=auth(req,url);rate('voice:'+member.id,50);const input=await body(req),target=room.members.get(input.to);active(room,member);
    if(!target||target.id===member.id)throw new RoomError(400,'语音对象不在房间');
    if(!validVoice(input.kind,input.payload))throw new RoomError(400,'语音信令无效');
    send(target,'voice',{from:member.id,kind:input.kind,payload:input.payload});json(res,200,{ok:true});return;
   }
   if(req.method==='POST'&&url.pathname==='/api/leave'){
    const {room,member}=auth(req,url);room.leave(member);streams.get(member.id)?.end();streams.delete(member.id);flush(room);json(res,200,{ok:true});return;
   }
   if(url.pathname.startsWith('/api/'))throw new RoomError(404,'接口不存在');
   if(req.method!=='GET'&&req.method!=='HEAD')throw new RoomError(405,'不支持该请求');
   let relative;try{relative=decodeURIComponent(url.pathname).replace(/^\/+/,'');}catch{throw new RoomError(400,'路径格式错误');}let filename=path.resolve(DIST,relative||'index.html');
   if(filename!==DIST&&!filename.startsWith(DIST+path.sep))throw new RoomError(403,'路径不可访问');
   if((await stat(filename)).isDirectory())filename=path.join(filename,'index.html');const bytes=await readFile(filename);
   res.writeHead(200,{'content-type':types[path.extname(filename)]||'application/octet-stream','cache-control':/\.(html|js|css)$/.test(filename)?'no-cache':'public,max-age=3600'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(error){if(!res.headersSent)json(res,error.status||error.code==='ENOENT'&&404||500,{error:error.status||error.code==='ENOENT'?error.message:'房间服务暂时不可用'});else res.end();if(!error.status&&error.code!=='ENOENT')console.error('Room server error:',error.message);}
 });
 const timer=setInterval(()=>{const now=performance.now(),dt=Math.min(.1,(now-last)/1000);last=now;tickCount++;snapshotAccumulator+=dt;const broadcast=snapshotAccumulator>=snapshotInterval;if(broadcast)snapshotAccumulator%=snapshotInterval;
  for(const [code,room]of rooms){try{room.tick(dt);if(broadcast)flush(room);for(const m of [...room.members.values()]){if(m.connected&&!streams.has(m.id)&&Date.now()-m.lastSeen>15000)room.disconnect(m);if(!m.connected&&Date.now()-m.lastSeen>60000)room.leave(m);}if(!room.members.size&&Date.now()-room.updatedAt>60000)rooms.delete(code);}catch(error){console.error('Room tick stopped:',code,error.message);for(const m of room.members.values()){send(m,'error',{message:'房间运行异常，请返回大厅重开',terminal:true});const stream=streams.get(m.id);streams.delete(m.id);stream?.end();}rooms.delete(code);}}
  if(tickCount%900===0)for(const [key,b]of buckets)if(Date.now()-b.since>10000)buckets.delete(key);
 },1000/tickHz);timer.unref();server.on('close',()=>{clearInterval(timer);for(const res of streams.values())res.end();streams.clear();});
 return {server,rooms,close(){for(const res of streams.values())res.end();return new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT)||8931,host=process.env.HOST||'0.0.0.0';
 const runtime=createCampusServer({allowedOrigins:(process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean)});
 runtime.server.listen(port,host,()=>console.log(`Campus multiplayer listening on http://${host}:${port}`));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>runtime.close().then(()=>process.exit()));
}
