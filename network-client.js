// Server-authoritative room adapter. No client command can assign scores,
// positions, inventory, another player's identity or the room's teacher.
const NO_ROOM_SERVICE='这个地址没有多人房间服务，请先玩单人模式，或填写已部署的联机服务器地址。';
const INVALID_RESPONSE='联机服务器返回了无效数据，请检查服务器地址或稍后重试。';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const text=value=>typeof value==='string'&&value.length>0&&value.length<=160&&!/[<>\u0000-\u001f]/.test(value);
class RoomConnectionError extends Error{constructor(message,{terminal=true,status=0}={}){super(message);this.name='RoomConnectionError';this.terminal=terminal;this.status=status;}}
const protocolError=()=>new RoomConnectionError(INVALID_RESPONSE);
function mime(response){return (response.headers.get('content-type')||'').split(';',1)[0].trim().toLowerCase();}
function isJSON(response){return /^application\/(?:json|[\w.+-]+\+json)$/.test(mime(response));}
function httpError(response,body){
 const status=response.status,terminal=[401,404,405,410].includes(status);
 const fallback=status===401?'房间连接已失效，请返回大厅重新加入。':status===403?'联机服务器拒绝了此网页的访问。':status===404?'没有找到房间或联机接口，请检查服务器地址和房间号。':status===429?'操作过快，请稍后再试。':'联机服务器暂时不可用，请稍后再试。';
 return new RoomConnectionError(object(body)&&text(body.error)?body.error:fallback,{status,terminal});
}
async function readJSON(response,{health=false,validate=()=>true}={}){
 if(!isJSON(response)){
  await response.body?.cancel().catch(()=>{});
  if(health&&[200,404,405].includes(response.status))throw new RoomConnectionError(NO_ROOM_SERVICE,{status:response.status});
  if(!response.ok)throw httpError(response);
  throw protocolError();
 }
 let body;try{body=await response.json();}catch(error){if(error.name==='AbortError')throw error;if(!response.ok)throw httpError(response);throw protocolError();}
 if(!response.ok){if(health&&response.status===404)throw new RoomConnectionError(NO_ROOM_SERVICE,{status:404});throw httpError(response,body);}
 if(!validate(body))throw protocolError();return body;
}
async function requestJSON(url,options={},schema={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{return await readJSON(await fetch(url,{...options,signal:controller.signal,cache:'no-store'}),schema);}
 catch(error){if(error instanceof RoomConnectionError)throw error;throw new RoomConnectionError(error.name==='AbortError'?'联机服务器响应超时，请稍后重试。':'无法连接联机服务器，请检查网络和服务器地址。',{terminal:false});}
 finally{clearTimeout(timer);}
}
function validRoom(room){return object(room)&&/^\d{6}$/.test(room.code)&&typeof room.selfId==='string'&&typeof room.hostId==='string'&&Array.isArray(room.members)&&room.members.length>0&&room.members.length<=16&&room.members.every(m=>object(m)&&typeof m.id==='string'&&typeof m.connected==='boolean'&&['student','teacher'].includes(m.role))&&room.members.some(m=>m.id===room.selfId)&&room.members.some(m=>m.id===room.hostId);}
function validActor(actor){return object(actor)&&Number.isInteger(actor.id)&&['x','z','yaw'].every(k=>finite(actor[k]));}
function validState(state,room=null){return object(state)&&validRoom(state.room)&&(!room||state.room.code===room.code&&state.room.selfId===room.selfId)&&['student','teacher'].includes(state.role)&&['ready','playing','won','lost'].includes(state.status)&&['gathering','seating','class'].includes(state.stage)&&typeof state.map==='string'&&validActor(state.player)&&validActor(state.teacher)&&Array.isArray(state.students)&&state.students.every(validActor)&&object(state.drawer)&&Array.isArray(state.drawer.slots)&&state.drawer.slots.every(s=>object(s)&&Number.isInteger(s.id))&&Array.isArray(state.seats)&&Array.isArray(state.books)&&object(state.completed)&&finite(state.score)&&finite(state.target)&&finite(state.elapsed)&&Number.isSafeInteger(state.sequence)&&Array.isArray(state.events)&&state.events.every(e=>object(e)&&typeof e.type==='string');}
function validSession(result){return object(result)&&typeof result.token==='string'&&result.token.length>=16&&validRoom(result.room)&&validState(result.state,result.room);}
function readEvent(data,type,room){
 let message;try{message=JSON.parse(data);}catch{throw protocolError();}
 if(type==='state'&&!validState(message,room))throw protocolError();
 if(type==='voice'&&(!object(message)||typeof message.from!=='string'||!['offer','answer','ice','mute'].includes(message.kind)||!object(message.payload)))throw protocolError();
 if(type==='error'&&(!object(message)||!text(message.message)))throw protocolError();
 return message;
}
export function defaultCampusEndpoint(){
 if(typeof location==='undefined')return 'http://127.0.0.1:8931';
 if(location.hostname==='github.io'||location.hostname.endsWith('.github.io'))return '';
 return ['localhost','127.0.0.1'].includes(location.hostname)&&location.port!=='8931'?`${location.protocol}//${location.hostname}:8931`:location.origin;
}
export async function connectCampusRoom({endpoint=defaultCampusEndpoint(),code='',name='同学',character='boy',rolePreference='student',map='classroom',floor=1,onRoom=()=>{},onError=()=>{},onVoice=()=>{}}={}){
 endpoint=String(endpoint??'').trim().replace(/\/+$/,'');if(!endpoint)throw new RoomConnectionError('该网站尚未连接联机服务器，请先玩单人模式，或填写联机服务器地址。');
 let parsed;try{parsed=new URL(endpoint);}catch{throw new RoomConnectionError('请输入完整的 HTTP 或 HTTPS 联机服务器地址。');}if(!['http:','https:'].includes(parsed.protocol))throw new RoomConnectionError('房间地址必须是 HTTP 或 HTTPS');
 code=String(code).trim();if(code&&!/^\d{6}$/.test(code))throw new Error('请输入六位房间号');
 await requestJSON(`${endpoint}/api/health`,{}, {health:true,validate:value=>object(value)&&value.ok===true&&value.protocol===1&&Number.isInteger(value.rooms)&&value.rooms>=0});
 const result=await requestJSON(`${endpoint}/api/rooms${code?`/${code}/join`:''}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,character,rolePreference,map,floor})},{validate:validSession});
 return new NetworkRound({endpoint,result,onRoom,onError,onVoice});
}
export class NetworkRound{
 constructor({endpoint,result,onRoom=()=>{},onError=()=>{},onVoice=()=>{}}){
  this.network=true;this.endpoint=endpoint;this.token=result.token;this.room=result.room;this._state=result.state;this._events=[];this._queued=[];this._last={};this._localPaused=false;this._closed=false;this._connected=false;this._onRoom=onRoom;this._onError=onError;this._controller=null;this._retry=null;this._busy=false;this._look=null;this._lookSeq=0;this._frames=[];
  this.voice=new RoomVoice(this,onVoice);this._timer=setInterval(()=>this._flush(),40);this._listen();this._onRoom(this.room,this._state);
 }
 get player(){return this._look?{...this._state.player,yaw:this._look.yaw,pitch:this._look.pitch}:this._state.player;}get teacher(){return this._state.teacher;}get status(){return this._state.status;}get paused(){return this._localPaused;}get elapsed(){return this._state.elapsed;}get map(){return this._state.map;}
 snapshot(){return {...this._state,...this._interpolatedActors(),player:this.player,paused:this._localPaused||!this._connected,network:true,connection:this._terminalError?'failed':this._connected?'connected':'connecting',room:this.room};}
 step(){return this.snapshot();}reset(){return this.snapshot();}start(){return this.snapshot();}
 drainEvents(){const e=this._events;this._events=[];return e;}
 async _post(path,data){try{return await requestJSON(`${this.endpoint}${path}?room=${encodeURIComponent(this.room.code)}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${this.token}`},body:JSON.stringify(data)},{validate:out=>object(out)&&out.ok===true&&(path!=='/api/command'||Array.isArray(out.results)&&out.results.every(value=>typeof value==='boolean'))});}catch(error){if(error.terminal&&!this._closed)this._terminate(error);throw error;}}
 _terminate(error){if(this._terminalError||this._closed)return;this._terminalError=error;this._connected=false;this._queued=[];this._last={};clearInterval(this._timer);clearTimeout(this._retry);this._retry=null;this._controller?.abort();this.voice.close();this._onError(error.message);}
 command(name,...args){
  if(this._closed||this._terminalError)return false;
  if(name==='setWriting'&&args[0]===false&&this._state.role!=='teacher')return false;
  if(name==='setRescue'&&args[0]===null&&this._state.role==='teacher')return false;
  if(['setMovement','setLook','setCrouch'].includes(name)){
   const key=JSON.stringify(args),now=performance.now();if(this._last[name]?.key===key&&now-this._last[name].at<180)return true;this._last[name]={key,at:now};
   const old=this._queued.findIndex(c=>c.name===name);if(old>=0)this._queued.splice(old,1);
  }
  let inputSeq=0;if(name==='setLook'&&args.slice(0,2).every(Number.isFinite)){inputSeq=++this._lookSeq;this._look={yaw:Math.atan2(Math.sin(args[0]),Math.cos(args[0])),pitch:Math.max(-1.3,Math.min(1.3,args[1])),sequence:inputSeq};}
  if(name==='stopComputer'&&!this._state.player.computerActive)return false;
  this._queued.push({name,args,inputSeq});if(this._queued.length>24)this._queued.splice(0,this._queued.length-24);return true;
 }
 async _flush(){if(this._closed||this._terminalError||this._busy||!this._queued.length)return;this._busy=true;const commands=this._queued.splice(0,12);try{await this._post('/api/command',{commands});}catch(error){if(error!==this._terminalError&&!this._closed)this._onError(error.message);}finally{this._busy=false;}}
 async _listen(){
  if(this._closed||this._terminalError)return;this._controller=new AbortController();let reader;
  try{
   const res=await fetch(`${this.endpoint}/api/events?room=${this.room.code}`,{headers:{authorization:`Bearer ${this.token}`,accept:'text/event-stream'},signal:this._controller.signal,cache:'no-store'});
   if(!res.ok){try{await readJSON(res);}catch(error){if(res.status>=400&&res.status<500&&![408,429].includes(res.status))error.terminal=true;throw error;}}
   if(mime(res)!=='text/event-stream'||!res.body){await res.body?.cancel().catch(()=>{});throw protocolError();}
   reader=res.body.getReader();const decoder=new TextDecoder();let buffer='';
   while(!this._closed&&!this._terminalError){const {value,done}=await reader.read();if(done)break;buffer=(buffer+decoder.decode(value,{stream:true})).replace(/\r\n/g,'\n');if(buffer.length>524288)throw protocolError();let index;
    while((index=buffer.indexOf('\n\n'))>=0){const packet=buffer.slice(0,index);buffer=buffer.slice(index+2);let type='message',data='';for(const line of packet.split('\n')){if(line.startsWith('event:'))type=line.slice(6).trim();if(line.startsWith('data:'))data+=(data?'\n':'')+line.slice(5).trimStart();}if(!data||!['state','voice','error'].includes(type))continue;const message=readEvent(data,type,this.room);if(type==='state')this._connected=true;
     if(type==='state'){const before=this.room,previous=this._state;this._state=message;const actorChanged=previous.player.id!==message.player.id||previous.player.seated!==message.player.seated||previous.map!==message.map;if(actorChanged)this._look=null;else if(this._look&&(message.inputAck?.look||0)>=this._look.sequence)this._look=null;if(previous.map!==message.map||previous.stage!==message.stage)this._frames=[];this._frames.push({time:performance.now(),state:message});if(this._frames.length>5)this._frames.shift();this.room=message.room;this._events.push(...(message.events||[]));this.voice.sync(this.room);if(JSON.stringify(before)!==JSON.stringify(this.room))this._onRoom(this.room,this._state);}
     if(type==='voice')this.voice.receive(message).catch(error=>this._onError('语音连接失败：'+error.message));
     if(type==='error')this._onError(message.message);
    }
   }
  }catch(error){if(!this._closed&&error.name!=='AbortError'){if(error.terminal)this._terminate(error);else if(!this._terminalError)this._onError(error instanceof RoomConnectionError?error.message:'联机连接中断，正在尝试重新连接。');}}
  finally{try{await reader?.cancel();}catch{}reader?.releaseLock();}
  this._connected=false;if(!this._closed&&!this._terminalError){this._queued=[];this._last={};this._retry=setTimeout(()=>this._listen(),1500);}
 }
 _interpolatedActors(){
  const frames=this._frames;if(frames.length<2)return{};const target=performance.now()-70;let a=frames[0],b=frames[frames.length-1];for(let i=1;i<frames.length;i++)if(frames[i].time>=target){a=frames[i-1];b=frames[i];break;}
  const t=Math.max(0,Math.min(1,(target-a.time)/Math.max(1,b.time-a.time))),blend=(x,y)=>{if(!x||!y||x.captivity!==y.captivity||x.seated!==y.seated||x.visible!==y.visible||Math.hypot(x.x-y.x,x.z-y.z)>2)return y;const turn=Math.atan2(Math.sin(y.yaw-x.yaw),Math.cos(y.yaw-x.yaw));return{...y,x:x.x+(y.x-x.x)*t,z:x.z+(y.z-x.z)*t,yaw:x.yaw+turn*t};};
  return{students:this._state.students.map(p=>p.isPlayer?p:blend(a.state.students.find(s=>s.id===p.id),b.state.students.find(s=>s.id===p.id))||p),teacher:this._state.role==='teacher'?this._state.teacher:blend(a.state.teacher,b.state.teacher)};
 }
 pause(value=true){this._localPaused=Boolean(value);if(value){this.command('setMovement',0,0);this.command('hold',false);this.command('setCrouch',false);this.command('setRescue',null);}return this.snapshot();}
 setPreference(rolePreference,character){return this.command('setPreference',{rolePreference,character});}
 travelFloor(map){return this.command('travelFloor',map);}
 async rematch(){const before=this._state.sequence;await this._post('/api/command',{name:'rematch',args:[]});for(let i=0;i<100;i++){if(this._state.stage==='gathering'&&this._state.sequence>before)return this.snapshot();await new Promise(r=>setTimeout(r,50));}throw new Error('房间已重置，正在重新连接');}
 toggleMicrophone(){return this.voice.toggle();}
 async leave(){if(this._closed)return;this._closed=true;clearInterval(this._timer);clearTimeout(this._retry);this.voice.close();try{await this._post('/api/leave',{});}catch{}this._controller?.abort();}
 dispose(){return this.leave();}
}
for(const method of ['setMovement','setLook','setCrouch','hold','releaseUse','toggleDrawer','toggleBook','takeSlot','returnItem','interact','startComputer','stopComputer','computerApp','snakeDirection','takePen','openOfficeDrawer','sitOfficeChair','burp','setRescue','selectSlot','selectAction','throwChalk','grabStudent','bindStudent','dropStudent','releaseBoundStudent','setWriting','startBell','setDoorUse','interactDoor','setInteraction']){
 NetworkRound.prototype[method]=function(...args){return this.command(method,...args);};
}

class RoomVoice{
 constructor(round,onChange){this.round=round;this.onChange=onChange;this.peers=new Map();this.stream=null;this.enabled=false;this.closed=false;this.pending=false;}
 async toggle(){
  if(this.closed||this.pending)return this.enabled;
  if(this.enabled){this.enabled=false;for(const track of this.stream?.getAudioTracks()||[])track.enabled=false;for(const id of this.peers.keys())this.signal(id,'mute',{muted:true});this.onChange({enabled:false});return false;}
  if(!globalThis.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('麦克风需要 HTTPS 或本机 localhost 地址');
  if(!globalThis.RTCPeerConnection)throw new Error('当前浏览器不支持语音');
  if(!this.stream){this.pending=true;try{this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});}finally{this.pending=false;}if(this.closed){this.stream.getTracks().forEach(t=>t.stop());this.stream=null;return false;}}
  for(const track of this.stream.getAudioTracks())track.enabled=true;this.enabled=true;
  for(const member of this.round.room.members){if(member.id===this.round.room.selfId||!member.connected)continue;const peer=this.peer(member.id);await this.attach(peer);await this.offer(peer);this.signal(member.id,'mute',{muted:false});}
  for(const peer of this.peers.values())peer.audio?.play().catch(()=>{});this.onChange({enabled:true});return true;
 }
 signal(to,kind,payload){return this.round._post('/api/voice',{to,kind,payload}).catch(error=>{if(!this.closed&&error!==this.round._terminalError)this.round._onError(error.message);});}
 peer(id){
  if(this.peers.has(id))return this.peers.get(id);
  const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]}),peer={id,pc,makingOffer:false,ignoreOffer:false,polite:this.round.room.selfId.localeCompare(id)>0,pendingIce:[],audio:null};this.peers.set(id,peer);
  pc.onicecandidate=e=>{if(e.candidate)this.signal(id,'ice',e.candidate.toJSON());};
  pc.ontrack=e=>{if(!peer.audio){peer.audio=document.createElement('audio');peer.audio.autoplay=true;peer.audio.setAttribute('playsinline','');peer.audio.hidden=true;document.body.append(peer.audio);}peer.audio.srcObject=e.streams[0]||new MediaStream([e.track]);peer.audio.play().catch(()=>{});};
  pc.onconnectionstatechange=()=>this.onChange({enabled:this.enabled,peer:id,state:pc.connectionState});
  return peer;
 }
 async attach(peer){if(!this.stream)return;for(const track of this.stream.getAudioTracks()){const sender=peer.pc.getSenders().find(s=>s.track?.kind==='audio');if(sender)await sender.replaceTrack(track);else peer.pc.addTrack(track,this.stream);}}
 async offer(peer){try{peer.makingOffer=true;await peer.pc.setLocalDescription(await peer.pc.createOffer());await this.signal(peer.id,'offer',peer.pc.localDescription);}finally{peer.makingOffer=false;}}
 async receive({from,kind,payload}){
  if(this.closed||!this.round.room.members.some(m=>m.id===from))return;
  if(kind==='mute'){this.onChange({enabled:this.enabled,peer:from,muted:payload?.muted});return;}
  if(!globalThis.RTCPeerConnection)return;
  const peer=this.peer(from),pc=peer.pc;
  if(kind==='ice'){if(!pc.remoteDescription){peer.pendingIce.push(payload);return;}try{await pc.addIceCandidate(payload);}catch(error){if(!peer.ignoreOffer)throw error;}return;}
  if(kind==='offer'||kind==='answer'){
   const collision=kind==='offer'&&(peer.makingOffer||pc.signalingState!=='stable');peer.ignoreOffer=!peer.polite&&collision;if(peer.ignoreOffer)return;
   if(collision&&peer.polite)await pc.setLocalDescription({type:'rollback'});
   await pc.setRemoteDescription(payload);for(const ice of peer.pendingIce.splice(0))await pc.addIceCandidate(ice);
   if(kind==='offer'){await this.attach(peer);await pc.setLocalDescription(await pc.createAnswer());await this.signal(from,'answer',pc.localDescription);}
  }
 }
 sync(room){for(const[id,peer]of this.peers)if(!room.members.some(m=>m.id===id&&m.connected)){peer.pc.close();peer.audio?.remove();this.peers.delete(id);}if(this.enabled)for(const m of room.members)if(m.id!==room.selfId&&m.connected&&!this.peers.has(m.id)){const peer=this.peer(m.id);this.attach(peer).then(()=>this.offer(peer)).catch(error=>this.round._onError(error.message));}}
 close(){this.closed=true;for(const track of this.stream?.getTracks()||[])track.stop();for(const p of this.peers.values()){p.pc.close();p.audio?.remove();}this.peers.clear();this.stream=null;this.enabled=false;}
}
