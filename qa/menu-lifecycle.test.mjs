import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture(saved={}){
  class Element extends EventTarget{
    constructor(id='',dataset={}){super();this.id=id;this.dataset=dataset;this.style={};this.open=false;this.hidden=false;this.disabled=false;this.attrs={};this.nodes=new Map();this.tagName='BUTTON';this.value='';const values=new Set();this.classList={add:(...v)=>v.forEach(n=>values.add(n)),remove:(...v)=>v.forEach(n=>values.delete(n)),toggle:(n,v)=>v?values.add(n):values.delete(n),contains:n=>values.has(n)};}
    querySelector(s){if(!this.nodes.has(s))this.nodes.set(s,new Element());return this.nodes.get(s);}
    querySelectorAll(s){return s==='.close'?[this.querySelector('.close')]:[];}
    setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}
    focus(){}closest(s){return s==='button'?this:null;}getBoundingClientRect(){return{left:0,top:0,right:800,bottom:500};}
    showModal(){this.open=true;}close(){this.open=false;this.dispatchEvent(new Event('close'));}
  }
  const nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>['#'+m[1],new Element(m[1])]));
  nodes.get('#classroom').hidden=true;
  const data={role:['student','teacher'],map:['classroom','night','tiered','computer'],character:[...html.matchAll(/data-character="([^"]+)"/g)].map(match=>match[1]),quality:['high','low']};
  const dataNodes=Object.fromEntries(Object.entries(data).map(([k,values])=>[k,values.map(v=>new Element('',{[k]:v}))]));
  const doc=new EventTarget(),win=new EventTarget();doc.body=new Element();doc.documentElement=new Element();
  doc.querySelector=s=>{if(s==='dialog[open]')return[...nodes.values()].find(n=>n.open)||null;if(!nodes.has(s))nodes.set(s,new Element(s));return nodes.get(s);};
  doc.querySelectorAll=s=>{if(s==='dialog[open]')return[...nodes.values()].filter(n=>n.open);const data=s.match(/^\[data-(\w+)\]$/);if(data)return dataNodes[data[1]];return s.split(',').map(v=>doc.querySelector(v.trim()));};
  const calls={imports:[],creates:[],controllers:0,starts:[],active:[],characters:[],saved:[],disposed:0,errors:[],connections:0},pending=[];
  const scene={setMap:v=>calls.map=v,setCharacter:v=>calls.characters.push(v),setQuality(){},setMotion(){},setActive:v=>calls.active.push(v),dispose:()=>calls.disposed++};
  let game;
  const loadModule=async spec=>{
    calls.imports.push(spec);
    if(spec.includes('classroom-game'))return{createClassroomGame:({onExit})=>{calls.controllers++;game={active:false,setRound(r){this.round=r;},start(options){calls.starts.push(options);this.active=true;doc.body.classList.add('playing');},exit(){this.active=false;doc.body.classList.remove('playing');onExit();},dispose(){this.exit();}};return game;}};
    return{createClassroom:(canvas,options)=>{calls.creates.push(options);return new Promise((resolve,reject)=>pending.push({resolve:()=>resolve(scene),reject}));}};
  };
  const context={connectCampusRoom:async()=>{calls.connections++;return{snapshot:()=>({map:'classroom'}),leave(){}};},defaultCampusEndpoint:()=> 'http://localhost:8931',playNovelEffect:()=>false,document:doc,window:win,matchMedia:()=>({matches:false}),localStorage:{getItem:()=>JSON.stringify(saved),setItem:(key,value)=>calls.saved.push(JSON.parse(value))},console:{error:(...args)=>calls.errors.push(args)},setTimeout,clearTimeout,setInterval,clearInterval,loadModule};
  // Substitute only dynamic imports, leaving the production lifecycle and DOM
  // event handlers intact. This is an event-only test, not a browser renderer.
  vm.runInNewContext(source.replace(/^import .*;\n/gm,'').replace(/\bimport\(/g,'loadModule('),context,{filename:'app.js'});
  const click=id=>{const el=doc.querySelector(id);if(!el.disabled)el.dispatchEvent(new Event('click'));};
  return{calls,pending,scene,doc,win,get game(){return game;},el:doc.querySelector,click,chooseCharacter(value){const button=dataNodes.character.find(b=>b.dataset.character===value);assert.ok(button,'character must exist in the actual menu');button.dispatchEvent(new Event('click'));}};
}

test('opening the illustrated menu performs no 3D imports or classroom construction',()=>{
  const f=fixture();assert.deepEqual(f.calls.imports,[]);assert.equal(f.calls.controllers,0);assert.equal(f.el('#classroom').hidden,true);
  assert.match(html,/class="menu-illustration"[\s\S]*assets\/menu-reference-33\.jpg/);
});

test('single-player entry loads once and starts without connecting to any room server',async()=>{
  const f=fixture({role:'teacher',character:'girl'});f.click('#enter-solo');await flush();
  assert.equal(f.el('#room-dialog').open,true);assert.equal(f.el('.room-connect').hidden,true);
  f.pending[0].resolve();await flush();assert.equal(f.calls.connections,0);assert.equal(f.calls.starts.length,1);
  assert.equal(f.calls.starts[0].solo,true);assert.equal(f.calls.starts[0].role,'teacher');assert.equal(f.calls.characters.at(-1),'girl');
  assert.equal(f.el('#room-dialog').open,false);assert.equal(f.el('#classroom').hidden,false);assert.equal(f.game.round,null);
  f.game.exit();f.click('#enter-classroom');f.click('#room-enter');await flush();assert.equal(f.calls.connections,1);
  f.game.exit();f.click('#enter-solo');await flush();assert.equal(f.calls.connections,1);assert.equal(f.game.round,null);assert.equal(f.calls.creates.length,1);
});
test('closing single-player loading cancels entry, and a failed load can be retried',async()=>{
  const f=fixture();f.click('#enter-solo');await flush();f.el('#room-dialog').close();f.pending[0].resolve();await flush();assert.equal(f.calls.starts.length,0);
  f.click('#enter-solo');await flush();assert.equal(f.calls.starts.length,1);
  const failed=fixture();failed.click('#enter-solo');await flush();failed.pending[0].reject(new Error('load failure'));await flush();assert.equal(failed.calls.starts.length,0);
  failed.click('#room-enter');await flush();failed.pending[1].resolve();await flush();assert.equal(failed.calls.starts.length,1);assert.equal(failed.calls.connections,0);
});
test('room preparation is deduplicated and never starts automatically; reentry reuses one controller',async()=>{
  const f=fixture();f.click('#enter-classroom');await flush();
  assert.equal(f.el('#room-dialog').open,true);assert.equal(f.el('#room-enter').disabled,true);assert.equal(f.calls.creates.length,1);
  assert.equal(f.calls.creates[0].active,false);assert.equal(f.calls.creates[0].snapEntry,true);
  f.el('#room-dialog').close();f.click('#enter-classroom');await flush();assert.equal(f.calls.creates.length,1);
  f.el('#room-dialog').close();f.pending[0].resolve();await flush();assert.equal(f.calls.starts.length,0);assert.equal(f.el('#classroom').hidden,true);
  for(let i=0;i<3;i++){
    f.click('#enter-classroom');f.click('#room-enter');await flush();assert.equal(f.game.active,true);assert.equal(f.el('#classroom').hidden,false);assert.equal(f.calls.active.at(-1),true);
    f.game.exit();assert.equal(f.el('#classroom').hidden,true);assert.equal(f.calls.active.at(-1),false);
  }
  assert.equal(f.calls.controllers,1);assert.equal(f.calls.creates.length,1);assert.equal(f.calls.starts.length,3);
});
test('failed preparation exposes a retry and does not permanently disable the main menu',async()=>{
  const f=fixture();f.click('#enter-classroom');await flush();f.pending[0].reject(new Error('model download failed'));await flush();
  assert.equal(f.el('#room-enter').disabled,false);assert.equal(f.el('#room-enter').textContent,'重新准备');assert.equal(f.el('#enter-classroom').disabled,false);
  f.click('#room-enter');await flush();assert.equal(f.calls.creates.length,2);f.pending[1].resolve();await flush();
  assert.equal(f.calls.controllers,1);assert.equal(f.el('#room-enter').textContent,'创建 / 加入房间');assert.equal(f.calls.starts.length,0);
});
test('a world finishing after page disposal is disposed without binding a controller',async()=>{
  const f=fixture();f.click('#enter-classroom');await flush();f.win.dispatchEvent(new Event('pagehide'));f.pending[0].resolve();await flush();
  assert.equal(f.calls.disposed,1);assert.equal(f.calls.controllers,0);assert.equal(f.calls.starts.length,0);
});

test('all four menu skins are saved and forwarded unchanged to the real scene entry',async()=>{
  const f=fixture();
  for(const variant of ['boy','girl','glasses','ponytail']){
    f.chooseCharacter(variant);f.click('#confirm-character');
    assert.equal(f.calls.saved.at(-1).character,variant);
    f.click('#enter-classroom');await flush();
    if(!f.game){f.pending[0].resolve();await flush();}
    f.click('#room-enter');await flush();assert.equal(f.calls.characters.at(-1),variant);f.game.exit();
  }
  assert.equal(f.calls.controllers,1);assert.equal(f.calls.creates.length,1);
});

test('a saved ponytail skin survives reload, while unconfirmed choices do not replace it',async()=>{
  const f=fixture({character:'ponytail'});f.chooseCharacter('girl');
  f.click('#enter-classroom');await flush();
  assert.equal(f.el('#room-character').textContent,'马尾同学');
  f.pending[0].resolve();await flush();f.click('#room-enter');await flush();assert.equal(f.calls.characters.at(-1),'ponytail');
});
