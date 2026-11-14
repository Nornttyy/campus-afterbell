import {CampusRoom,RoomError} from './room-simulation.js?v=campus-83';
import {diffNetworkState} from './network-state65.js?v=campus-83';
import {validCommand,validVoice} from './room-validation79.js?v=campus-83';

// One authoritative simulation per host. Transport identities are assigned by
// the data connection, never by fields inside a guest's packet.
export class PeerRoomHost {
 constructor(options,send){this.room=new CampusRoom(options);this.send=send;this.clients=new Map();this.previous=new Map();this.limits=new Map();this.closed=false;this.frames=0;}
 request(client,path,data={}){
  if(this.closed)throw new RoomError(410,'房主已关闭房间');
  const now=Date.now(),limit=this.limits.get(client)||{time:now,count:0};
  if(now-limit.time>1000){limit.time=now;limit.count=0;}if(++limit.count>80)throw new RoomError(429,'操作过快');this.limits.set(client,limit);
  if(path==='/join'){
   if(this.clients.has(client))throw new RoomError(409,'已经在房间中');
   const member=this.room.join(data);this.clients.set(client,member);
   const state=this.room.snapshot(member);this.previous.set(client,state);
   return{token:member.token,room:this.room.publicRoom(member),state};
  }
  const member=this.clients.get(client);if(!member)throw new RoomError(401,'请重新加入房间');
  if(path==='/api/command'){
   const batch=data.commands===undefined?[data]:data.commands;
   if(!Array.isArray(batch)||batch.length>12||!batch.every(validCommand))throw new RoomError(400,'无效操作');
   return{ok:true,results:batch.map(c=>Boolean(this.room.command(member,c.name,c.args??[],c.inputSeq??0)))};
  }
  if(path==='/api/voice'){
   const target=[...this.clients.entries()].find(([,m])=>m.id===data.to);
   if(!target||target[1]===member||!validVoice(data.kind,data.payload))throw new RoomError(400,'无效语音连接');
   this.send(target[0],{type:'voice',payload:{from:member.id,kind:data.kind,payload:data.payload}});return{ok:true};
  }
  if(path==='/api/leave'){this.disconnect(client);return{ok:true};}
  throw new RoomError(400,'无效请求');
 }
 tick(dt){
  if(this.closed)return;this.room.tick(Math.max(0,Math.min(.1,dt)));
  if(++this.frames%2)return;
  for(const[client,member]of this.clients){
   const state=this.room.snapshot(member),previous=this.previous.get(client);
   const keyframe=!previous||this.frames%60===0;
   this.send(client,keyframe?{type:'state',payload:state}:{type:'patch',payload:{baseSequence:previous.sequence,sequence:state.sequence,patch:diffNetworkState(previous,state)}});
   this.previous.set(client,state);
  }
 }
 disconnect(client){const member=this.clients.get(client);if(!member)return;this.room.leave(member);this.clients.delete(client);this.previous.delete(client);this.limits.delete(client);}
 close(){this.closed=true;this.clients.clear();this.previous.clear();this.limits.clear();}
}
