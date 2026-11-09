import test from 'node:test';
import assert from 'node:assert/strict';
import {NetworkRound} from '../dist/network-client.js';
import {CampusRoom} from '../server/room-simulation.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
class Track extends EventTarget{
 constructor({stopEvent=false}={}){super();this.kind='audio';this.enabled=true;this.readyState='live';this.stopCount=0;this.stopEvent=stopEvent;this.listeners=new Set();}
 addEventListener(type,listener,options){if(type==='ended')this.listeners.add(listener);super.addEventListener(type,listener,options);}
 removeEventListener(type,listener,options){if(type==='ended')this.listeners.delete(listener);super.removeEventListener(type,listener,options);}
 end(){this.readyState='ended';this.dispatchEvent(new Event('ended'));}
 stop(){this.stopCount++;this.readyState='ended';if(this.stopEvent)this.dispatchEvent(new Event('ended'));}
}
const media=(tracks=[new Track()])=>({getTracks:()=>tracks,getAudioTracks:()=>tracks});
function globalValue(t,key,value){const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});t.after(()=>{if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});}
function fixture(t,{getMedia,offer}={}){
 const calls=[],signals=[],changes=[],errors=[],pcs=[],audios=[];
 globalValue(t,'isSecureContext',true);globalValue(t,'navigator',{mediaDevices:{getUserMedia:async options=>{calls.push(options);return getMedia?getMedia(calls.length):media();}}});
 globalValue(t,'document',{body:{append:()=>{}},createElement:()=>{const audio={srcObject:null,removed:false,paused:false,setAttribute(){},play:async()=>{},pause(){this.paused=true;},remove(){this.removed=true;}};audios.push(audio);return audio;}});
 globalValue(t,'RTCPeerConnection',class{
  constructor(){this.senders=[];this.closeCount=0;this.connectionState='new';this.signalingState='stable';pcs.push(this);}
  getSenders(){return this.senders;}addTrack(track){this.senders.push({track,replaceTrack:async replacement=>{this.senders[0].track=replacement;}});}
  async createOffer(){return offer?offer(this,pcs.indexOf(this)):{type:'offer',sdp:'fixture'};}
  async createAnswer(){return{type:'answer',sdp:'fixture'};}async setLocalDescription(description){this.localDescription=description;}async setRemoteDescription(description){this.remoteDescription=description;}async addIceCandidate(){}
  close(){this.closeCount++;this.connectionState='closed';this.onconnectionstatechange?.();}
 });
 t.mock.method(NetworkRound.prototype,'_listen',async()=>{});
 const room=new CampusRoom({code:'575757',seed:57}),member=room.join({}),peer=room.join({});
 const round=new NetworkRound({endpoint:'https://rooms.invalid',result:{token:member.token,room:room.publicRoom(member),state:room.snapshot(member)},onVoice:value=>changes.push(value),onError:value=>errors.push(value)});
 t.mock.method(round,'_post',async(path,data)=>{signals.push({path,...data});return{ok:true};});t.after(()=>round.leave());
 return{round,voice:round.voice,peer,calls,signals,changes,errors,pcs,audios};
}

test('a production RoomVoice switches off and releases a microphone whose audio track ended',async t=>{
 const source=media(),f=fixture(t,{getMedia:()=>source});assert.equal(await f.round.toggleMicrophone(),true);const track=source.getAudioTracks()[0];
 track.end();await settle();assert.equal(f.voice.enabled,false);assert.equal(f.voice.stream,null);assert.equal(f.voice.peers.size,0);assert.equal(f.pcs[0].closeCount,1);assert.equal(track.listeners.size,0);assert.equal(f.changes.at(-1).enabled,false);
 assert.ok(f.signals.some(s=>s.kind==='mute'&&s.payload.muted===true));assert.deepEqual(f.errors,[]);
});

test('M after device loss requests fresh media, and a queued old ended callback cannot close it',async t=>{
 const first=media(),second=media(),f=fixture(t,{getMedia:n=>n===1?first:second});await f.round.toggleMicrophone();const old=first.getAudioTracks()[0],stale=[...old.listeners];
 old.end();assert.equal(await f.round.toggleMicrophone(),true);assert.equal(f.calls.length,2);assert.equal(f.voice.stream,second);
 for(const callback of stale)callback(new Event('ended'));assert.equal(f.voice.enabled,true);assert.equal(f.voice.stream,second);assert.equal(second.getAudioTracks()[0].readyState,'live');assert.equal(f.pcs[1].closeCount,0);
});

test('an ended track is discarded even while locally muted',async t=>{
 const first=media(),second=media(),f=fixture(t,{getMedia:n=>n===1?first:second});await f.round.toggleMicrophone();assert.equal(await f.round.toggleMicrophone(),false);first.getAudioTracks()[0].end();
 assert.equal(f.voice.stream,null);assert.equal(await f.round.toggleMicrophone(),true);assert.equal(f.calls.length,2);
});

test('ending one input track stops its siblings without recursive ended notifications',async t=>{
 const a=new Track(),b=new Track({stopEvent:true}),f=fixture(t,{getMedia:()=>media([a,b])});await f.round.toggleMicrophone();f.changes.length=0;a.end();
 assert.equal(b.readyState,'ended');assert.equal(b.stopCount,1);assert.equal(f.voice.stream,null);assert.equal(f.changes.filter(s=>s.enabled===false).length,1);assert.equal(a.listeners.size+b.listeners.size,0);
});

test('leaving while microphone permission is pending stops the late result without reopening UI or peers',async t=>{
 const capture=deferred(),source=media(),f=fixture(t,{getMedia:()=>capture.promise});const activation=f.round.toggleMicrophone();assert.equal(f.voice.pending,true);await f.round.leave();capture.resolve(source);
 assert.equal(await activation,false);assert.equal(source.getAudioTracks()[0].stopCount,1);assert.equal(f.voice.stream,null);assert.equal(f.voice.pending,false);assert.equal(f.voice.enabled,false);assert.equal(f.pcs.length,0);assert.deepEqual(f.changes,[]);
});

test('dispose removes audio elements, listeners and callbacks; stale peer events do not leak into another room',async t=>{
 const source=media([new Track({stopEvent:true})]),f=fixture(t,{getMedia:()=>source});await f.round.toggleMicrophone();const pc=f.pcs[0],staleTrack=pc.ontrack,staleState=pc.onconnectionstatechange;
 pc.ontrack({streams:[media()],track:new Track()});assert.equal(f.audios.length,1);const count=f.changes.length;await f.round.dispose();f.voice.close();
 assert.equal(source.getAudioTracks()[0].stopCount,1);assert.equal(source.getAudioTracks()[0].listeners.size,0);assert.equal(pc.closeCount,1);assert.equal(f.audios[0].srcObject,null);assert.equal(f.audios[0].removed,true);assert.equal(f.audios[0].paused,true);
 staleTrack({streams:[media()],track:new Track()});staleState();assert.equal(f.audios.length,1);assert.equal(f.changes.length,count);assert.equal(await f.round.toggleMicrophone(),false);
});

test('ending media during offer negotiation cannot later reactivate the old stream or disable a replacement',async t=>{
 const pending=deferred(),first=media(),second=media(),f=fixture(t,{getMedia:n=>n===1?first:second,offer:(_,index)=>index===0?pending.promise:{type:'offer',sdp:'new'}});
 const activation=f.round.toggleMicrophone();await settle();assert.equal(f.pcs.length,1);first.getAudioTracks()[0].end();assert.equal(await f.round.toggleMicrophone(),true);
 pending.resolve({type:'offer',sdp:'old'});assert.equal(await activation,false);assert.equal(f.voice.stream,second);assert.equal(f.voice.enabled,true);assert.equal(f.changes.at(-1).enabled,true);assert.equal(f.signals.some(s=>s.kind==='offer'&&s.payload.sdp==='old'),false);assert.deepEqual(f.errors,[]);
});

test('a denied capture clears pending state and permits a later retry',async t=>{
 const f=fixture(t,{getMedia:n=>{if(n===1)throw new DOMException('Denied','NotAllowedError');return media();}});
 await assert.rejects(f.round.toggleMicrophone(),{name:'NotAllowedError'});assert.equal(f.voice.pending,false);assert.equal(f.voice.stream,null);assert.equal(f.voice.enabled,false);assert.equal(await f.round.toggleMicrophone(),true);assert.equal(f.calls.length,2);
});
