import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {openRoomPeer,keepRoomRegistered} from '../dist/room-signaling.js';
import {PeerRoomHost} from '../dist/peer-room-host79.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fakePeers(attempts){
  const peers=[];
  class Peer extends EventEmitter{
    constructor(id){
      super();this.id=id;this.script=attempts[peers.length];peers.push(this);
      queueMicrotask(()=>this.script?.(this));
    }
    accept(){this.open=true;this.emit('open',this.id);}
    connect(target){
      this.target=target;this.channel=new EventEmitter();
      queueMicrotask(()=>this.dial?.(this.channel));
      return this.channel;
    }
    destroy(){this.destroyed=true;this.emit('close');}
  }
  return {Peer,peers};
}

test('registration retries a lost signal and a silent socket under the same room number',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {Peer,peers}=fakePeers([p=>p.emit('error',{type:'network'}),()=>{},p=>p.accept()]);
  const retried=[],ready=openRoomPeer(Peer,{onRetry:n=>retried.push(n)});
  await flush();t.mock.timers.tick(600);await flush();
  t.mock.timers.tick(10000);await flush();t.mock.timers.tick(1500);await flush();
  const {code,peer}=await ready;
  assert.deepEqual(retried,[1,2]);assert.ok(peers.slice(0,2).every(p=>p.destroyed));
  assert.equal(peer.id,'campus-afterbell-81-'+code);assert.equal(new Set(peers.map(p=>p.id)).size,1);
  assert.equal(peer.listenerCount('error'),0);
});

test('room number collisions allocate a fresh number; permanent errors stop immediately',async()=>{
  const {Peer,peers}=fakePeers([p=>p.emit('error',{type:'unavailable-id'}),p=>p.accept()]);
  const {code}=await openRoomPeer(Peer);
  assert.match(code,/^\d{6}$/);assert.equal(peers.length,2);assert.ok(peers[0].destroyed);
  const failed=fakePeers([p=>p.emit('error',{type:'browser-incompatible'})]);
  await assert.rejects(openRoomPeer(failed.Peer),{type:'browser-incompatible'});
  assert.equal(failed.peers.length,1);
});

test('a guest retries a transiently missing host and keeps the requested destination',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {Peer,peers}=fakePeers([p=>{p.dial=()=>p.emit('error',{type:'peer-unavailable'});p.accept();},
    p=>{p.dial=c=>{c.open=true;c.emit('open');};p.accept();}]);
  const ready=openRoomPeer(Peer,{code:'123456'});await flush();t.mock.timers.tick(600);await flush();
  const link=await ready;
  assert.equal(link.connection,peers[1].channel);assert.ok(peers[0].destroyed);
  assert.ok(peers.every(p=>p.target==='campus-afterbell-81-123456'));
});

test('closing the dialog interrupts registration, an outstanding dial, or a scheduled retry',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  for(const [code,script] of [['',()=>{}],['123456',p=>p.accept()],['',p=>p.emit('error',{type:'network'})]]){
    const c=new AbortController(),{Peer,peers}=fakePeers([script]);
    const task=openRoomPeer(Peer,{code,signal:c.signal});await flush();
    c.abort();await assert.rejects(task,{name:'AbortError'});
    t.mock.timers.tick(40000);await flush();assert.equal(peers.length,1);assert.ok(peers[0].destroyed);
  }
});

test('repeated signal errors finish after three registrations even without a progress listener',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const fail=peer=>peer.emit('error',{type:'socket-closed'});
  const {Peer,peers}=fakePeers([fail,fail,fail]);
  const rejected=assert.rejects(openRoomPeer(Peer),{type:'socket-closed'});
  await flush();t.mock.timers.tick(600);await flush();t.mock.timers.tick(1500);
  await rejected;assert.equal(peers.length,3);assert.ok(peers.every(peer=>peer.destroyed));
});

test('host restores its registration with bounded backoff and stops reconnecting when the room closes',t=>{
  const peer=new EventEmitter();let attempts=0;
  peer.reconnect=()=>{attempts++;peer.disconnected=false;};
  peer.disconnect=()=>{peer.open=false;peer.disconnected=true;peer.emit('disconnected');};
  const timers=t.mock.timers;timers.enable({apis:['setTimeout']});
  const stop=keepRoomRegistered(peer);
  peer.disconnect();peer.emit('disconnected');timers.tick(500);assert.equal(attempts,1);
  timers.tick(10000);timers.tick(1000);assert.equal(attempts,2);
  peer.open=true;peer.emit('open');timers.tick(20000);assert.equal(attempts,2);
  peer.disconnect();timers.tick(500);assert.equal(attempts,3);
  peer.disconnect();stop();timers.tick(20000);assert.equal(attempts,3);
});

test('room admission works in browsers with secure random bytes but no randomUUID method',t=>{
  const crypto=globalThis.crypto,original=Object.getOwnPropertyDescriptor(crypto,'randomUUID');
  Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true});
  t.after(()=>{if(original)Object.defineProperty(crypto,'randomUUID',original);else delete crypto.randomUUID;});
  const host=new PeerRoomHost({code:'472094',maxPlayers:3},()=>{});
  try{
    const owner=host.request('host','/join',{}),guest=host.request('guest','/join',{});
    assert.notEqual(owner.room.selfId,guest.room.selfId);assert.notEqual(owner.token,guest.token);
    assert.equal(guest.room.hostId,owner.room.selfId);assert.equal(guest.room.members.length,2);
  }finally{host.close();}
});
