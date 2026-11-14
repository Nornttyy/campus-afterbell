import test from 'node:test';
import assert from 'node:assert/strict';
import {PeerRoomHost} from '../dist/peer-room-host79.js';
import {applyNetworkDelta} from '../dist/network-state65.js';
const options={code:'123456',seed:73,maxPlayers:8,settings:{duration:600,target:120,chalkStamina:false}};
test('host browser uses the shared 8-player rules and binds identities to connections',()=>{
 const host=new PeerRoomHost(options,()=>{}),sessions=[];
 for(let i=0;i<8;i++)sessions.push(host.request('peer'+i,'/join',{name:'同学'+i}));
 assert.equal(host.room.members.size,8);assert.throws(()=>host.request('ninth','/join',{}),/已满/);
 assert.equal(sessions[0].room.selfId,sessions[0].room.hostId);
 assert.throws(()=>host.request('unknown','/api/command',{name:'setMovement',args:[0,1]}),/重新加入/);
 assert.throws(()=>host.request('peer1','/api/command',{name:'configureRound',args:[{duration:300,target:20,chalkStamina:true}]}),/房主/);
 host.request('peer0','/api/command',{name:'configureRound',args:[{duration:1200,target:160,chalkStamina:true}]});
 assert.equal(host.room.settings.target,160);assert.equal(host.room.settings.duration,1200);
 assert.throws(()=>host.request('peer1','/api/command',{name:'setMovement',args:[NaN,1]}),/无效/);
 host.disconnect('peer7');assert.equal(host.room.members.size,7);host.request('replacement','/join',{});assert.equal(host.room.members.size,8);
});
test('RTC delta updates reconstruct full room state, synchronize movement and start selection',()=>{
 const emitted=[],host=new PeerRoomHost(options,(client,packet)=>emitted.push({client,...packet}));
 const a=host.request('host','/join',{name:'房主',rolePreference:'teacher'}),b=host.request('guest','/join',{name:'朋友'}),states=new Map([['host',a.state],['guest',b.state]]);
 host.request('guest','/api/command',{commands:[{name:'setMovement',args:[0,1],inputSeq:1}]});
 const initial=b.state.player.z;for(let i=0;i<12;i++)host.tick(1/30);
 for(const p of emitted)states.set(p.client,p.type==='state'?p.payload:applyNetworkDelta(states.get(p.client),p.payload.patch));
 assert.ok(states.get('guest').player.z>initial);assert.equal(states.get('host').room.members.length,2);
 host.request('host','/api/command',{name:'startBell',args:[]});assert.equal(host.room.sim.stage,'seating');
 assert.equal(host.room.teacherMember.name,'房主');host.close();assert.throws(()=>host.request('guest','/api/command',{}),/关闭/);
});
test('voice signaling cannot impersonate another room member or target outsiders',()=>{
 const emitted=[],host=new PeerRoomHost(options,(client,packet)=>emitted.push({client,packet}));
 const a=host.request('host','/join',{}),b=host.request('guest','/join',{});
 host.request('guest','/api/voice',{to:a.room.selfId,from:'spoof',kind:'mute',payload:{muted:true}});
 assert.equal(emitted[0].packet.payload.from,b.room.selfId);
 assert.throws(()=>host.request('guest','/api/voice',{to:'outsider',kind:'mute',payload:{muted:true}}),/无效/);
});
