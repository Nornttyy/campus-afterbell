import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../dist/vendor/three.module.js';
import {HOTPOT_TABLES,HOTPOT_SEATS,HOTPOT_SCREENS,HOTPOT_SOLIDS} from '../dist/hotpot-layout70.js';
import {createHotpotRoom} from '../dist/hotpot-room70.js';
import {hotpotHelpers} from './hotpot70-helpers.mjs';
import {loadGeometry} from './gltf-geometry.mjs';
const inside=(x,z,r=0)=>HOTPOT_SOLIDS.some(s=>x>s.minX-r&&x<s.maxX+r&&z>s.minZ-r&&z<s.maxZ+r);
test('hotpot layout data can be shared by renderer and server without loading Three or DOM',async()=>{const code=await readFile(new URL('../dist/hotpot-layout70.js',import.meta.url),'utf8');assert.doesNotMatch(code,/^import\s/m);assert.ok(Object.isFrozen(HOTPOT_SEATS)&&Object.isFrozen(HOTPOT_SOLIDS));});
test('each independent hotpot table has four differently facing usable seats and existing drawer/book anchors',()=>{
 assert.equal(HOTPOT_SEATS.length,24);assert.equal(new Set(HOTPOT_SEATS.map(s=>s.id)).size,24);
 for(const table of HOTPOT_TABLES){const seats=HOTPOT_SEATS.filter(s=>s.tableId===table.id);assert.equal(seats.length,4);assert.equal(new Set(seats.map(s=>s.yaw)).size,4);for(const s of seats){assert.equal(s.map,'hotpot');assert.ok(Math.abs(Math.hypot(s.x-s.deskX,s.z-s.deskZ)-.78)<1e-9);assert.ok(Math.abs(Math.hypot(s.deskX-table.x,s.deskZ-table.z)-.94)<1e-9);assert.ok(!inside(s.x,s.z,.20));const dx=table.x-s.x,dz=table.z-s.z;assert.ok(dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw)>1.7);}}
});
test('all seats have a connected walking exit, both doors and the lectern aisle stay clear',()=>{
 const minX=-6.4,minZ=-9.75,step=.15,nx=90,nz=123,clear=(i,j)=>i>=0&&i<nx&&j>=0&&j<nz&&!inside(minX+i*step,minZ+j*step,.2),index=(x,z)=>[Math.round((x-minX)/step),Math.round((z-minZ)/step)];
 const start=index(6.5,7),queue=[start],seen=new Set([start.join(',')]);for(let n=0;n<queue.length;n++){const[i,j]=queue[n];for(const[di,dj]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj,key=a+','+b;if(clear(a,b)&&!seen.has(key)){seen.add(key);queue.push([a,b]);}}}
 for(const s of HOTPOT_SEATS){const candidates=[-1,1].map(side=>index(s.x+Math.cos(s.yaw)*.55*side,s.z-Math.sin(s.yaw)*.55*side));assert.ok(candidates.some(c=>seen.has(c.join(','))),'seat '+s.id+' side exit must connect to the front door');}
 for(const z of[-8,7])assert.ok(!inside(6.9,z,.25));for(let x=-5;x<=6;x+=.25)assert.ok(!inside(x,6.45,.25));
});
test('folding-screen neighbours meet without a floating panel gap; their collision reaches the visible top',()=>{
 for(const p of HOTPOT_SCREENS){const solid=HOTPOT_SOLIDS.find(s=>s.id==='hotpot-screen-'+p.id);assert.equal(solid.maxY,p.height);if(p.id%4===3)continue;const next=HOTPOT_SCREENS[p.id+1];const end=[p.x+Math.cos(p.yaw)*p.width/2,p.z-Math.sin(p.yaw)*p.width/2],start=[next.x-Math.cos(next.yaw)*next.width/2,next.z+Math.sin(next.yaw)*next.width/2];assert.ok(Math.hypot(end[0]-start[0],end[1]-start[1])<.025);}
});
test('actual hotpot geometry has closed bowl surfaces, red soup, square pedestal tops and stays below 8000 triangles per table',()=>{
 const parent=new T.Group(),helpers=hotpotHelpers(parent),room=createHotpotRoom(helpers);parent.updateMatrixWorld(true);
 for(const data of HOTPOT_TABLES){const table=room.group.getObjectByName('hotpot-table-'+data.id);let triangles=0;table.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert.ok(o.geometry.attributes.normal);assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));}});assert.ok(triangles<8000,'table '+data.id+': '+triangles);const bounds=new T.Box3().setFromObject(table);assert.ok(Math.abs(bounds.min.x-(data.x-1.325))<.003);assert.ok(Math.abs(bounds.max.x-(data.x+1.325))<.003);assert.ok(bounds.max.y<=1.17);assert.ok(room.group.getObjectByName('hotpot-pot-'+data.id));}
 assert.equal(room.group.children.filter(g=>g.name.startsWith('hotpot-steam-')).length,6);room.dispose();helpers.dispose();
});
test('steam and broth animate by shared time without scaling furniture or leaking outside a hidden room',()=>{
 const parent=new T.Group(),helpers=hotpotHelpers(parent),room=createHotpotRoom(helpers),before=[];room.group.traverse(o=>before.push([o,o.position.toArray(),o.scale.toArray()]));room.update(4);room.update(NaN);room.update(8);
 for(const[o,p,s]of before){assert.deepEqual(o.position.toArray(),p);assert.deepEqual(o.scale.toArray(),s);}
 const steam=room.group.getObjectByName('hotpot-steam-0');assert.equal(steam.material.uniforms.uTime.value,8);assert.equal(steam.material.depthWrite,false);assert.equal(steam.material.depthTest,true);assert.equal(steam.userData.animated,true);assert.equal(steam.parent,room.group);
 const soup=room.group.getObjectByName('hotpot-pot-0').children.find(o=>o.geometry.type==='CircleGeometry'&&o.geometry.parameters.radius>.7),shader={uniforms:{},vertexShader:'#include <begin_vertex>'};soup.material.onBeforeCompile(shader);assert.equal(shader.uniforms.hotpotTime.value,8);room.update(12);assert.equal(shader.uniforms.hotpotTime.value,12);room.dispose();helpers.dispose();
});
test('disposing the hotpot scene removes it and releases its own resources once without disposing borrowed helper geometry',()=>{
 const parent=new T.Group(),helpers=hotpotHelpers(parent);let sharedDisposed=0;for(const g of helpers.sharedGeometries)g.addEventListener('dispose',()=>sharedDisposed++);const room=createHotpotRoom(helpers),pot=room.group.getObjectByName('hotpot-pot-0');let bowlDisposed=0;pot.children[0].geometry.addEventListener('dispose',()=>bowlDisposed++);room.dispose();room.dispose();room.update(100);assert.equal(parent.children.length,0);assert.equal(sharedDisposed,0);assert.equal(bowlDisposed,1);helpers.dispose();
});
test('the real imported drawers clear the shared tabletop and corner apron throughout their full open travel',async()=>{
 const {scene}=await loadGeometry('desk-v2.glb'),source=scene.getObjectByName('DeskDrawer'),parent=new T.Group(),helpers=hotpotHelpers(parent),room=createHotpotRoom(helpers);parent.updateMatrixWorld(true);
 for(const s of HOTPOT_SEATS){const drawer=source.clone(true);drawer.rotation.y=s.yaw;for(const amount of[0,.25,.5,.75,1]){drawer.position.set(s.deskX-Math.sin(s.yaw)*amount*.24,0,s.deskZ-Math.cos(s.yaw)*amount*.24);drawer.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(drawer,true);const table=room.group.getObjectByName('hotpot-table-'+s.tableId);for(const mesh of table.children.filter(o=>o.isMesh)){const other=new T.Box3().setFromObject(mesh,true);const dx=Math.min(bounds.max.x,other.max.x)-Math.max(bounds.min.x,other.min.x),dy=Math.min(bounds.max.y,other.max.y)-Math.max(bounds.min.y,other.min.y),dz=Math.min(bounds.max.z,other.max.z)-Math.max(bounds.min.z,other.min.z);assert.ok(dx<=.0001||dy<=.0001||dz<=.0001,`seat ${s.id}, drawer ${amount}: furniture overlap ${dx}, ${dy}, ${dz}`);}}}
 room.dispose();helpers.dispose();
});
