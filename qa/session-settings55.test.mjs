import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionUI} from '../dist/session-ui.js';
import {CampusRoom} from '../server/room-simulation.js';
import {NetworkRound} from '../dist/network-client.js';

// Production session UI event handlers + real authoritative simulation. Only
// browser layout is replaced. Snapshots deliberately arrive before command ACKs.
function fixture({guest=false,touch=false}={}){
 const room=new CampusRoom({code:'553001',seed:73}),host=room.join({name:'房主',rolePreference:'teacher'}),peer=room.join({name:'同学'}),member=guest?peer:host,queue=[],saved=new Map();
 class Element extends EventTarget{
  constructor(){super();this.nodes=new Map();this.style={};this.attrs={};this.value='';this.firstElementChild={style:{}};}
  set innerHTML(html){for(const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){const node=new Element();node.value=match[0].match(/\bvalue="([^"]*)"/)?.[1]||'';this.nodes.set('#'+match[1],node);}}
  querySelector(key){if(!this.nodes.has(key))this.nodes.set(key,new Element());return this.nodes.get(key);}
  querySelectorAll(){return[];}append(child){this.child=child;}setAttribute(key,value){this.attrs[key]=value;}remove(){}reportValidity(){this.reported=true;return false;}
 }
 const document={activeElement:null,createElement:()=>new Element()},root=new Element();
 for(const[name,value]of Object.entries({document,matchMedia:()=>({matches:touch}),navigator:{maxTouchPoints:touch?1:0}})){saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});}
 const round={room:room.publicRoom(member)},ui=createSessionUI({root,commands:{configure:settings=>queue.push({name:'configureRound',args:[settings]}),bell:settings=>queue.push({name:'startBell',args:[settings]})}}),el=id=>root.child.querySelector(id);
 const update=()=>{round.room=room.publicRoom(member);ui.update(room.snapshot(member),round);};update();
 return{room,host,peer,member,ui,queue,round,el,document,update,
  type(id,value){document.activeElement=el(id);el(id).value=value;el(id).dispatchEvent(new Event('input'));},
  tab(id){document.activeElement=null;el(id).dispatchEvent(new Event('change'));},
  clickStart(){el('#session-bell').dispatchEvent(new Event('click'));},
  deliver(){for(const command of queue.splice(0))room.command(member,command.name,command.args);update();},
  close(){ui.dispose();for(const[name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
 };
}

test('fill, Tab, delayed snapshots, fill, Tab, immediate Start preserves host 5min/30 on both clients',()=>{
 const f=fixture();try{
  f.type('#session-duration','5');f.tab('#session-duration');for(let i=0;i<8;i++)f.update();assert.equal(f.el('#session-duration').value,'5','unacknowledged input must survive the 80ms HUD refresh');
  f.type('#session-target','30');f.tab('#session-target');f.update();f.clickStart();
  assert.deepEqual(f.queue.map(c=>{assert.equal(c.args[0].chalkStamina,false);const {chalkStamina,...rest}=c.args[0];return rest;}),[{duration:300,target:120},{duration:300,target:30},{duration:300,target:30}]);
  f.deliver();assert.equal(f.room.sim.stage,'seating');assert.equal(f.room.sim.duration,300);assert.equal(f.room.sim.target,30);
  for(let i=0;i<330;i++)f.room.tick(.1);
  for(const member of[f.host,f.peer]){const state=f.room.snapshot(member);assert.equal(state.target,30);assert.equal(state.settings.duration,300);assert.ok(state.timeLeft<=300&&state.timeLeft>=296);}
 }finally{f.close();}
});

test('starting from an actively edited field carries the last value even before blur/change',()=>{
 const f=fixture();try{
  f.type('#session-duration','5');f.tab('#session-duration');f.type('#session-target','30');f.update();f.clickStart();
  assert.deepEqual(f.queue.at(-1),{name:'startBell',args:[{duration:300,target:30,chalkStamina:false}]});
  // Even if no separate settings update has reached the server, Start is atomic.
  f.room.command(f.host,f.queue.at(-1).name,f.queue.at(-1).args);assert.deepEqual(f.room.settings,{duration:300,target:30,chalkStamina:false});assert.equal(f.room.sim.stage,'seating');
 }finally{f.close();}
});

test('invalid intermediate input is kept for editing and cannot start or send bad settings',()=>{
 const f=fixture();try{
  for(const value of['','4','20.5','21']){f.type('#session-duration',value);f.tab('#session-duration');f.update();f.clickStart();assert.equal(f.el('#session-duration').value,value);assert.equal(f.queue.length,0);assert.equal(f.el('#session-duration').reported,true);}
  f.type('#session-duration','20');f.tab('#session-duration');f.type('#session-target','19');f.tab('#session-target');const count=f.queue.length;f.clickStart();assert.equal(f.queue.length,count);assert.equal(f.el('#session-target').reported,true);
 }finally{f.close();}
});

test('non-host stays read-only, and leaving the lobby clears previous round drafts',()=>{
 const f=fixture({guest:true});try{
  assert.equal(f.el('#session-duration').readOnly,true);f.type('#session-duration','5');f.tab('#session-duration');f.clickStart();assert.equal(f.queue.length,0);f.document.activeElement=null;f.update();assert.equal(Number(f.el('#session-duration').value),10);
 }finally{f.close();}
 const h=fixture();try{h.type('#session-duration','5');h.tab('#session-duration');h.clickStart();h.deliver();h.room.sim.status='won';h.room.rematch(h.host);h.update();assert.equal(Number(h.el('#session-duration').value),5);h.room.configureRound(h.host,{duration:1200,target:40});h.update();assert.equal(Number(h.el('#session-duration').value),20);assert.equal(Number(h.el('#session-target').value),40);}finally{h.close();}
});

test('atomic Start rejects guest and malformed settings without starting, and ignores duplicate started commands',()=>{
 const room=new CampusRoom({code:'553002',seed:73}),host=room.join({}),guest=room.join({});
 assert.throws(()=>room.command(guest,'startBell',[{duration:300,target:30}]),/房主/);
 for(const settings of[{duration:299,target:30},{duration:1201,target:30},{duration:600,target:161},{duration:'300',target:30},null])assert.throws(()=>room.command(host,'startBell',[settings]),/5–20/);
 assert.equal(room.sim.stage,'gathering');assert.deepEqual(room.settings,{duration:600,target:120});
 assert.equal(room.command(host,'startBell',[{duration:300,target:30}]),true);assert.equal(room.command(host,'startBell',[{duration:1200,target:120}]),false);assert.deepEqual(room.settings,{duration:300,target:30});
});

test('network adapter preserves final Start settings as one ordered command',async()=>{
 const sent=[],round=Object.create(NetworkRound.prototype);Object.assign(round,{_closed:false,_connected:true,_terminalError:null,_busy:false,_queued:[],_last:{},_state:{role:'student'},_post:async(path,body)=>{sent.push({path,body});return{ok:true};},_onError:message=>assert.fail(message)});
 round.configureRound({duration:600,target:120});round.startBell({duration:300,target:30});await round._flush();assert.deepEqual(sent[0].body.commands.map(({name,args})=>({name,args})),[{name:'configureRound',args:[{duration:600,target:120}]},{name:'startBell',args:[{duration:300,target:30}]}]);
});

test('touch crawl is cleared when leaving the game and remains off when the session renders again',()=>{
 const f=fixture({touch:true});try{
  assert.equal(f.ui.touch,true);assert.equal(f.ui.axes().crawl,false);
  f.el('#touch-crawl').dispatchEvent(new Event('click'));assert.equal(f.ui.axes().crawl,true);assert.equal(f.el('#touch-crawl').attrs['aria-pressed'],'true');
  f.ui.reset();f.update();assert.deepEqual(f.ui.axes(),{side:0,forward:0,crawl:false});assert.equal(f.el('#touch-crawl').attrs['aria-pressed'],'false');
  // The first new-session click must enable crawling, not clear stale state.
  f.el('#touch-crawl').dispatchEvent(new Event('click'));assert.equal(f.ui.axes().crawl,true);f.ui.reset();assert.equal(f.ui.axes().crawl,false);
 }finally{f.close();}
});
