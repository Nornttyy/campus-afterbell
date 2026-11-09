import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Follow the URLs the browser actually resolves from the production entry.
// Different query strings instantiate separate ES modules even when their
// filesystem pathname is identical; that can split asset registries/caches.
async function productionGraph(){
  const entry=new URL('../dist/index.html',import.meta.url),html=await readFile(entry,'utf8');
  const roots=[...html.matchAll(/<script\b(?=[^>]*\btype="module")(?=[^>]*\bsrc="([^"]+)")[^>]*>/g)].map(m=>new URL(m[1],entry));
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
  return byPath;
}

test('production menu and classroom share one URL per physical module',async()=>{
  const graph=await productionGraph(),duplicates=[...graph].filter(([,urls])=>urls.size>1);
  assert.equal(duplicates.length,0,duplicates.map(([file,urls])=>`${file}: ${[...urls].join(', ')}`).join('\n'));
  for(const file of ['app.js','network-client.js','classroom.js','student-assets.js','imported-actors.js','hand-motion.js']){
    const match=[...graph].find(([path])=>path.endsWith('/dist/'+file));assert.ok(match,`${file} is not reachable from the production menu`);
    assert.equal(new URL([...match[1]][0]).searchParams.get('v'),'campus-58',`${file} still points at a stale module revision`);
  }
  for(const file of ['prop-assets.js','game-actors.js','classroom-layout.js','vendor/three.module.js'])assert.ok([...graph].some(([path])=>path.endsWith('/dist/'+file)),`shared dependency ${file} was not inspected`);
});
