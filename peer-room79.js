import {NetworkRound,RoomConnectionError,readEvent} from './network-client.js?v=campus-117&rev=120';
import {openRoomPeer,keepRoomRegistered} from './room-signaling.js?v=campus-100';

const TIMEOUT=25000;
class Transport{
 constructor(peer){this.peer=peer;this.requests=new Map();this.serial=0;this.queue=[];this.ended=false;this.lastPacket=performance.now();}
 request(path,data){if(this.ended)return Promise.reject(new Error('房间已结束'));return new Promise((resolve,reject)=>{
  const id=++this.serial,timer=setTimeout(()=>{this.requests.delete(id);reject(new RoomConnectionError('房间响应超时，请重新加入。'));},TIMEOUT);
  this.requests.set(id,{resolve,reject,timer});
  try{this.send({type:'request',id,path,data});}catch(error){this.requests.delete(id);clearTimeout(timer);reject(error);}
 });}
 receive(packet){
  if(!packet||typeof packet!=='object')return;this.lastPacket=performance.now();
  if(packet.type==='reply'){
   const request=this.requests.get(packet.id);if(!request)return;clearTimeout(request.timer);this.requests.delete(packet.id);
   if(packet.error)request.reject(new RoomConnectionError(packet.error.message,{status:packet.error.status}));else request.resolve(packet.result);return;
  }
  if(packet.type==='closed'){this.fail('房主已离开，房间已结束。');return;}
  if(this.listener)this.listener(packet);else if(this.queue.length<60)this.queue.push(packet);
 }
 subscribe(listener,onError){this.listener=listener;this.onError=onError;for(const packet of this.queue)listener(packet);this.queue=[];
  this.resume=()=>{if(!document.hidden)this.lastPacket=performance.now();};
  document.addEventListener('visibilitychange',this.resume);
  this.watchdog=setInterval(()=>{if(!document.hidden&&performance.now()-this.lastPacket>12000)this.fail('与房主的连接已中断，请重新加入。');},2000);
 }
 fail(reason){if(this.ended)return;const error=new RoomConnectionError(reason);this.onError?.(error);this.close(error);}
 close(error=new RoomConnectionError('房间已结束')){
  if(this.ended)return;this.ended=true;clearInterval(this.watchdog);
  if(this.resume)document.removeEventListener('visibilitychange',this.resume);
  for(const request of this.requests.values()){clearTimeout(request.timer);request.reject(error);}
  this.requests.clear();try{this.cleanup?.();}finally{this.peer.destroy();}
 }
}
class PeerRound extends NetworkRound{
 constructor({transport,result,...callbacks}){
  super({endpoint:'',result,...callbacks});this.transport=transport;this._connected=true;
  transport.subscribe(packet=>{
   if(this._closed)return;
   try{const state=readEvent(JSON.stringify(packet.payload),packet.type,this.room,this._state);
    if(packet.type==='state'||packet.type==='patch'){if(state.sequence>=this._sequence)this._receiveState(state);}
    else if(packet.type==='voice')this.voice.receive(state).catch(()=>this._onError('语音连接失败，请重试。'));
   }catch(error){this._terminate(error);transport.close();}
  },error=>this._terminate(error));
 }
 _listen(){} // The reliable RTC data channel supplies events instead of SSE.
 async _post(path,data){return this.transport.request(path,data);}
 async leave(){try{await super.leave();}finally{this.transport?.close();}}
}
function attachHost(peer,options){
 const transport=new Transport(peer),worker=new Worker(new URL('./peer-room-worker79.js?v=campus-117&rev=120',import.meta.url),{type:'module'}),connections=new Map();
 worker.postMessage({type:'init',options});
 transport.send=packet=>worker.postMessage({...packet,client:'host'});
 worker.onmessage=({data:{client,packet}})=>{
  if(client==='host'){transport.receive(packet);return;}
  const c=connections.get(client);if(!c?.open)return;
  if((c.dataChannel?.bufferedAmount||0)>1048576){c.close();return;}c.send(packet);
 };
 worker.onerror=()=>transport.fail('房间运行中断，请重新创建。');
 const stopRegistering=keepRoomRegistered(peer);
 peer.on('connection',connection=>{
  if(connections.size>=8||connections.has(connection.peer)){connection.close();return;}connections.set(connection.peer,connection);
  const cleanup=()=>{clearTimeout(joinTimer);if(connections.get(connection.peer)!==connection)return;connections.delete(connection.peer);worker.postMessage({type:'disconnect',client:connection.peer});};
  const closeConnection=()=>{cleanup();connection.close();};
  const joinTimer=setTimeout(closeConnection,TIMEOUT);
  connection.on('data',packet=>{
   if(!packet||packet.type!=='request'||!Number.isSafeInteger(packet.id)||typeof packet.path!=='string'||JSON.stringify(packet).length>32768){closeConnection();return;}
   if(packet.path==='/join'){clearTimeout(joinTimer);}
   worker.postMessage({...packet,client:connection.peer});
  });
  connection.on('close',cleanup);connection.on('error',closeConnection);
 });
 peer.on('error',()=>{}); // Existing RTC sessions survive signaling outages.
 transport.cleanup=()=>{stopRegistering();for(const c of connections.values()){if(c.open)c.send({type:'closed'});c.close();}connections.clear();worker.terminate();};
 return transport;
}
function attachGuest(peer,connection){
 const transport=new Transport(peer);
 transport.send=packet=>connection.send(packet);transport.cleanup=()=>connection.close();
 connection.on('data',packet=>transport.receive(packet));
 connection.on('close',()=>transport.fail('房主已离开或网络已断开，房间已结束。'));
 connection.on('error',()=>transport.fail('与房主连接中断，请重新加入。'));peer.on('error',()=>{});
 return transport;
}
export async function connectPeerRoom({code='',name='同学',character='boy',rolePreference='student',map='classroom',maxPlayers=8,settings,signal,onRetry,...callbacks}={}){
 if(!globalThis.RTCPeerConnection||!globalThis.Worker)throw new Error('此浏览器不支持联机，请使用最新版 Chrome 或 Safari。');
 code=String(code).trim();if(code&&!/^\d{6}$/.test(code))throw new Error('请输入六位房间号');
 await import('./vendor/peerjs-1.5.5.min.js');
 const link=await openRoomPeer(globalThis.Peer,{code,signal,onRetry});
 let transport;
 const abort=()=>transport.close(new DOMException('已取消联机','AbortError'));
 try{
  if(signal?.aborted)throw new DOMException('已取消联机','AbortError');
  transport=link.connection?attachGuest(link.peer,link.connection):attachHost(link.peer,{code:link.code,map,maxPlayers,settings});
  signal?.addEventListener('abort',abort,{once:true});
  const result=await transport.request('/join',{name,character,rolePreference});
  if(signal?.aborted)throw new DOMException('已取消联机','AbortError');
  return new PeerRound({transport,result,...callbacks});
 }catch(error){if(transport)transport.close();else link.peer.destroy();throw error;}
 finally{signal?.removeEventListener('abort',abort);}
}
