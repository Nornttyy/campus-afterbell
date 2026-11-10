import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {campusScene} from './campus-geometry54-helpers.mjs';
import {DOORS,CLASSROOM,CORRIDOR} from '../dist/classroom-layout.js';

function visible(o){for(;o;o=o.parent)if(!o.visible)return false;return true;}
function physicalMeshes(scene){const result=[];scene.traverse(o=>{if(o.isMesh&&visible(o)&&['BoxGeometry','ExtrudeGeometry'].includes(o.geometry.type))result.push({object:o,bounds:new T.Box3().setFromObject(o,true)});});return result;}
function hit(objects,x,y,z,dx){return new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(dx,0,0),0,.6).intersectObjects(objects,false);}

test('all intermediate classroom window piers close both halves of each reserved masonry joint',()=>{
 const f=campusScene();try{for(const map of ['classroom','tiered','computer']){
  f.campus.setMap(map);f.scene.updateMatrixWorld(true);const walls=physicalMeshes(f.scene).filter(m=>m.bounds.min.x<7.41&&m.bounds.max.x>7.19).map(m=>m.object);
  // Real long-run window joins, including the formerly uncovered 8cm half.
  for(const center of [-4.725,-2.250,.225])for(const dz of [-.075,-.04,-.005,.005,.04,.075])for(const y of [.30,.70,1.70,2.50,3.40,4.05]){
   const hits=hit(walls,6.9,y,center+dz,1);
   assert.ok(hits.length,`${map}: no wall triangle at window join z=${center+dz}, y=${y}`);
  }
 }}finally{f.dispose();}
});

test('dense visible-triangle sweep finds no unplanned openings in side walls, exterior glazing or raised walls',()=>{
 const f=campusScene();try{for(const map of ['classroom','tiered']){
  f.campus.setMap(map);f.scene.updateMatrixWorld(true);const meshes=physicalMeshes(f.scene);
  for(const [label,x,dx,wallX]of [['exterior',CLASSROOM.minX+.20,-1,CLASSROOM.minX-.10],['partition',7,1,7.30],['corridor',CORRIDOR.maxX-.20,1,CORRIDOR.maxX+.10]]){
   const walls=meshes.filter(m=>m.bounds.min.x<wallX+.15&&m.bounds.max.x>wallX-.15).map(m=>m.object),heights=[.16,.60,1.02,1.15,1.73,2.55,3.08,3.24,3.84,4.05,4.40];
   if(map==='tiered'&&label!=='corridor')heights.push(4.65,5.30);
   for(const y of heights)for(let z=(label==='corridor'?CORRIDOR.minZ:CLASSROOM.minZ)+.01;z<8.79;z+=.037){
    if(label==='partition'&&y<3.10&&DOORS.some(d=>z>d.minZ&&z<d.maxZ))continue;
    assert.ok(hit(walls,x,y,z,dx).length,`${map}/${label}: open triangle seam at y=${y}, z=${z.toFixed(4)}`);
   }
  }
 }}finally{f.dispose();}
});
