import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {finishSchoolFurniture} from '../dist/school-furniture91.js';
import {modelTriangles} from '../dist/model-budget64.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {createSeatLayout,floorHeight} from '../dist/classroom-layout.js';

test('replacement frames meet the supplied wooden panels, stay within the real furniture envelope and clear a sliding tray',async()=>{
 const [desk,chair]=await Promise.all([loadGeometry('desk-v2.glb'),loadGeometry('chair-v2.glb')]);
 const body=desk.scene.getObjectByName('DeskBody'),sourceChair=chair.scene.getObjectByName('ChairBody'),drawer=desk.scene.getObjectByName('DeskDrawer');
 // The geometry-only fixture intentionally strips image materials. Restore the
 // single source primitive name that identifies each imported wooden shell.
 for(const root of [body,sourceChair,drawer]){
  let first=true;
  root.traverse(o=>{if(o.isMesh){o.material=o.material.clone();if(first)o.material.name='TripoFurnitureOriginalPBR';first=false;}});
 }
 const maps=new T.Texture(),m=finishSchoolFurniture(body,drawer,sourceChair,maps);
 const bounds=o=>new T.Box3().setFromObject(o,true);
 for(const [part,ref] of [[m.body,body],[m.chair,sourceChair]]){
  assert.ok(modelTriangles(part)<modelTriangles(ref));
  const box=bounds(part),old=bounds(ref);
  assert.ok(Math.abs(box.max.y-old.max.y)<.003);
  assert.ok(box.min.x>=old.min.x-.002&&box.max.x<=old.max.x+.002);
  assert.ok(box.min.z>=old.min.z-.002&&box.max.z<=old.max.z+.002);
  assert.ok(box.min.y>=0&&box.min.y<.007);
  const panels=part.children.filter(o=>o.material?.name==='School-maple');
  assert.ok(panels.length);assert.ok(panels.every(o=>o.material.map===maps));
  const rail=part.children.find(o=>o.material?.name==='School-tubular-steel');
  assert.ok(rail.geometry.parameters.radius<.018);
  assert.ok(bounds(rail).max.y>=Math.min(...panels.map(p=>bounds(p).min.y))-.002);
 }
 m.chair.position.z=-.78;m.chair.updateMatrixWorld(true);
 for(let i=0;i<=8;i++){
  drawer.position.z=-.24*i/8;drawer.updateMatrixWorld(true);
  // The seat pan is below the drawer and the back is behind the player's sitting point.
  const tray=bounds(drawer),triangle=new T.Triangle();
  for(const mesh of m.chair.children){
   if(!bounds(mesh).intersectsBox(tray))continue;
   const geom=mesh.geometry,position=geom.attributes.position,indices=geom.index;
   const corner=(v,k)=>v.fromBufferAttribute(position,indices?indices.getX(k):k).applyMatrix4(mesh.matrixWorld);
   for(let k=0;k<(indices?.count??position.count);k+=3){
    corner(triangle.a,k);corner(triangle.b,k+1);corner(triangle.c,k+2);
    assert.equal(tray.intersectsTriangle(triangle),false,'drawer crosses '+mesh.material.name);
   }
  }
 }
 for(const place of createSeatLayout(1,null,'tiered')){
  assert.equal(floorHeight(place.x,place.z,'tiered'),floorHeight(place.deskX,place.deskZ,'tiered'));
 }
});
