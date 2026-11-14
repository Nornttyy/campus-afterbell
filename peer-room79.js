import {NetworkRound,RoomConnectionError,readEvent} from './network-client.js?v=campus-82';

const PREFIX='campus-afterbell-81-',TIMEOUT=25000;
const message=error=>error?.type==='peer-unavailable'?'没找到这个房间，请确认房间号和房主是否在线。':error?.type==='unavailable-id'?'房间号已被占用，请再试一次。':'暂时无法建立联机，请换个网络重试。';
function openPeer(Peer,id){return new Promise((resolve,reject)=>{
 const peer=new Peer(id,{debug:0,config:{iceServers:[{urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:stun.l.google.com:19302'}]}});
 const timer=setTimeout(()=>{peer.destroy();reject(new Error('联机服务连接超时，请检查网络后重试。'));},TIMEOUT);
 const error=e=>{clearTimeout(timer);peer.destroy();const failure=new Error(message(e));failure.type=e.type;reject(failure);};
 peer.once('error',error);peer.once('open',()=>{clearTimeout(timer);peer.off('error',error);resolve(peer);});
});}
class Transport{
 constructor(peer){this.peer=peer;this.requests=new Map();this.serial=0;this.queue=[];this.ended=false;this.lastPacket=performance.now();}
 request(path,data){if(this.ended)return Promise.reject(new Error('房间已结束'));return new Promise((resolve,reject)=>{
  const id=++this.serial,timer=setTimeout(()=>{this.requests.delete(id);reject(new RoomConnectionError('房间响应超时，请重新加入。'));},TIMEOUT);
  this.requests.set(id,{resolve,reject,timer});this.send({type:'request',id,path,data});
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
  this.watchdog=setInterval(()=>{if(performance.now()-this.lastPacket>12000)this.fail('与房主的连接已中断，请重新加入。');},2000);
 }
 fail(reason){if(this.ended)return;this.onError?.(new RoomConnectionError(reason));this.close();}
 close(){if(this.ended)return;this.ended=true;clearInterval(this.watchdog);for(const request of this.requests.values()){clearTimeout(request.timer);request.reject(new Error('房间已结束'));}this.requests.clear();this.cleanup?.();this.peer.destroy();}
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
 const transport=new Transport(peer),worker=new Worker(new URL('./peer-room-worker79.js?v=campus-82',import.meta.url),{type:'module'}),connections=new Map();
 worker.postMessage({type:'init',options});
 transport.send=packet=>worker.postMessage({...packet,client:'host'});
 worker.onmessage=({data:{client,packet}})=>{
  if(client==='host'){transport.receive(packet);return;}
  const c=connections.get(client);if(!c?.open)return;
  if((c.dataChannel?.bufferedAmount||0)>1048576){c.close();return;}c.send(packet);
 };
 worker.onerror=()=>transport.fail('房间运行中断，请重新创建。');
 peer.on('connection',connection=>{
  if(connections.size>=8||connections.has(connection.peer)){connection.close();return;}connections.set(connection.peer,connection);
  const cleanup=()=>{if(connections.get(connection.peer)!==connection)return;connections.delete(connection.peer);worker.postMessage({type:'disconnect',client:connection.peer});};
  const joinTimer=setTimeout(()=>{if(!connection.metadata?.joined)connection.close();},TIMEOUT);
  connection.on('data',packet=>{
   if(!packet||packet.type!=='request'||!Number.isSafeInteger(packet.id)||typeof packet.path!=='string'||JSON.stringify(packet).length>32768){connection.close();return;}
   if(packet.path==='/join'){clearTimeout(joinTimer);}
   worker.postMessage({...packet,client:connection.peer});
  });
  connection.on('close',()=>{clearTimeout(joinTimer);cleanup();});connection.on('error',()=>{clearTimeout(joinTimer);cleanup();connection.close();});
 });
 peer.on('error',()=>{}); // Existing RTC sessions survive signaling outages.
 transport.cleanup=()=>{for(const c of connections.values()){if(c.open)c.send({type:'closed'});c.close();}connections.clear();worker.terminate();};
 return transport;
}
async function attachGuest(peer,code){
 const transport=new Transport(peer),connection=peer.connect(PREFIX+code,{reliable:true,serialization:'binary'});
 transport.send=packet=>connection.send(packet);transport.cleanup=()=>connection.close();
 connection.on('data',packet=>transport.receive(packet));
 try{await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{cleanup();reject(new Error('未能连到房主。请确认房主在线，或尝试其他网络。'));},TIMEOUT);
  const error=e=>{cleanup();reject(new Error(message(e)));};
  const cleanup=()=>{clearTimeout(timer);peer.off('error',error);connection.off('error',error);};
  peer.on('error',error);connection.on('error',error);connection.once('open',()=>{cleanup();resolve();});
 });}catch(error){transport.close();throw error;}
 connection.on('close',()=>transport.fail('房主已离开或网络已断开，房间已结束。'));
 connection.on('error',()=>transport.fail('与房主连接中断，请重新加入。'));peer.on('error',()=>{});
 return transport;
}
export async function connectPeerRoom({code='',name='同学',character='boy',rolePreference='student',map='classroom',maxPlayers=8,settings,...callbacks}={}){
 if(!globalThis.RTCPeerConnection||!globalThis.Worker)throw new Error('此浏览器不支持联机，请使用最新版 Chrome 或 Safari。');
 code=String(code).trim();if(code&&!/^\d{6}$/.test(code))throw new Error('请输入六位房间号');
 await import('./vendor/peerjs-1.5.5.min.js');const Peer=globalThis.Peer;
 let peer,transport;
 try{
  if(code){peer=await openPeer(Peer,'campus-guest-'+crypto.randomUUID());transport=await attachGuest(peer,code);}
  else{
   for(let attempt=0;attempt<5;attempt++){
    code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);
    try{peer=await openPeer(Peer,PREFIX+code);break;}catch(error){if(error.type!=='unavailable-id'||attempt===4)throw error;}
   }
   transport=attachHost(peer,{code,map,maxPlayers,settings});
  }
  const result=await transport.request('/join',{name,character,rolePreference});
  return new PeerRound({transport,result,...callbacks});
 }catch(error){transport?.close();peer?.destroy();throw error;}
}
