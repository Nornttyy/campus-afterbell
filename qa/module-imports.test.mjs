import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Follow the URLs the browser actually resolves from the production entry.
// Different query strings instantiate separate ES modules even when their
// filesystem pathname is identical; that can split asset registries/caches.
async function productionGraph(){
  const entry=new URL('../dist/index.html',import.meta.url),html=await readFile(entry,'utf8');
  const roots=[...html.matchAll(/<script\b(?=[^>]*\btype="module")(?=[^>]*\bsrc="([^"]+)")[^>]*>/g)].map(m=>new URL(m[1].replaceAll('&amp;','&'),entry));
  assert.ok(roots.length,'production module entry missing');
  const visited=new Set(),byPath=new Map();
  async function visit(url){
    if(visited.has(url.href))return;visited.add(url.href);
    if(!byPath.has(url.pathname))byPath.set(url.pathname,new Set());byPath.get(url.pathname).add(url.href);
    const file=new URL(url);file.search='';file.hash='';
    const source=await readFile(file,'utf8');
    for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g)){
      if(match[1].startsWith('.'))await visit(new URL(match[1],url));
    }
  }
  for(const root of roots)await visit(root);
  const app=roots.find(url=>url.pathname.endsWith('/app.js'));
  assert.ok(app,'production app entry missing');
  const revision=app.searchParams.get('v');assert.match(revision||'',/^campus-\d+[a-z]*$/,'production entry needs an explicit campus revision');
  return {graph:byPath,revision};
}

test('production menu and classroom share one URL per physical module',async()=>{
  const {graph,revision}=await productionGraph(),duplicates=[...graph].filter(([,urls])=>urls.size>1);
  assert.equal(duplicates.length,0,duplicates.map(([file,urls])=>`${file}: ${[...urls].join(', ')}`).join('\n'));
  for(const file of ['app.js','network-client.js','classroom.js','student-assets.js','imported-actors.js','hand-motion.js']){
    const match=[...graph].find(([path])=>path.endsWith('/dist/'+file));assert.ok(match,`${file} is not reachable from the production menu`);
    assert.equal(new URL([...match[1]][0]).searchParams.get('v'),revision,`${file} still points at a stale module revision`);
  }
  for(const file of ['prop-assets.js','game-actors.js','classroom-layout.js','vendor/three.module.js'])assert.ok([...graph].some(([path])=>path.endsWith('/dist/'+file)),`shared dependency ${file} was not inspected`);
});

// Workers have their own module realm. Pin the rules chain as well as the page
// so an existing browser cannot host a new room with cached older use timers.
test('multiplayer worker and authoritative rules use the current release cache key',async()=>{
  const {graph,revision}=await productionGraph();
  const client=await readFile(new URL('../dist/peer-room79.js',import.meta.url),'utf8');
  const roomRevision=revision+'&rev=167';
  assert.ok(client.includes(`new URL('./peer-room-worker79.js?v=${roomRevision}'`));
  const chain={
    'peer-room-worker79.js':['peer-room-host79.js'],
    'peer-room-host79.js':['room-simulation.js'],
    'room-simulation.js':['classroom-rules.js','teacher-rules.js'],
    'classroom-rules.js':['field-items116.js'],
  };
  for(const [file,dependencies]of Object.entries(chain)){
    const source=await readFile(new URL('../dist/'+file,import.meta.url),'utf8');
    const expected=roomRevision;
    for(const name of dependencies)assert.ok(source.includes(`'./${name}?v=${expected}'`),`${file} can load stale ${name}`);
  }
  const hostSource=await readFile(new URL('../dist/room-simulation.js',import.meta.url),'utf8');
  for(const name of ['item-rules50.js','classroom-rules.js','teacher-rules.js','elevator-session.js','campus-destinations.js','classroom-layout.js']){
    const path=new URL('../dist/'+name,import.meta.url).pathname;
    const [pageUrl]=graph.get(path);
    assert.ok(hostSource.includes(`'./${name}${new URL(pageUrl).search}'`),'worker and page must share '+name);
  }
});
