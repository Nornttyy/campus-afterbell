import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {campusScene} from './campus-geometry54-helpers.mjs';
import {createLayoutContext,createSeatLayout,moveInRoom,LIFT,CLASSROOM,CORRIDOR} from '../dist/classroom-layout.js';

function visible(object){for(;object;object=object.parent)if(!object.visible)return false;return true;}
function cast(scene,origin,direction,far=1){return new T.Raycaster(new T.Vector3(...origin),new T.Vector3(...direction),0,far).intersectObject(scene,true).filter(h=>visible(h.object));}
function firstObjects(hits){assert.ok(hits.length,'expected a visible architectural face');return new Set(hits.filter(h=>Math.abs(h.distance-hits[0].distance)<1e-6).map(h=>h.object));}
function maps(check){const f=campusScene();try{for(const map of ['classroom','tiered','computer']){f.campus.setMap(map);f.scene.updateMatrixWorld(true);check(f,map);}}finally{f.dispose();}}

test('exterior end piers and raised classroom wall have closed, actual triangle end caps',()=>maps(({scene},map)=>{
 for(const z of [-10.19,-10.15,8.965,9.015])for(const y of [.35,2,4.4]){
  const hit=cast(scene,[CLASSROOM.minX+.20,y,z],[-1,0,0],.5).find(h=>h.object.name==='classroom-exterior-end-pier');
  assert.ok(hit,`${map}: open west end at y=${y}, z=${z}`);
  assert.ok(Math.abs(hit.point.x-CLASSROOM.minX)<1e-5,'rendering follows the shared inner wall face');
 }
 if(map==='tiered')for(const z of [-10.19,9.015])for(const y of [4.6,5.1,5.54])assert.ok(cast(scene,[CLASSROOM.minX+.20,y,z],[-1,0,0],.5).length,`raised end cap open at ${y}, ${z}`);
}));

test('lift jamb triangles leave the same clear opening as authoritative actor collision',()=>maps(({scene},map)=>{
 for(const x of [LIFT.minX+.005,LIFT.maxX-.005])for(const y of [.25,1.2,2.7])assert.equal(cast(scene,[x,y,CORRIDOR.minZ+.2],[0,0,-1],.45).length,0,`${map}: jamb projects into clear opening at ${x},${y}`);
 const layout=createLayoutContext(createSeatLayout(73,null,map),{map});
 for(const x of [LIFT.minX+.185,LIFT.maxX-.185]){
  const end=moveInRoom({x,z:CORRIDOR.minZ+.1},0,-.7,.18,layout);
  assert.ok(Math.abs(end.x-x)<1e-7&&Math.abs(end.z-(CORRIDOR.minZ-.6))<1e-6,`${map}: legal opening path blocked`);
 }
}));

test('wall junctions and lift soffit have one exposed face, not overlapping coplanar surfaces',()=>maps(({scene},map)=>{
 for(const [origin,direction]of [
  [[8,2,CORRIDOR.minZ+.5],[0,0,-1]],[[10.7,2,CORRIDOR.minZ+.5],[0,0,-1]],
  [[9.35,3,CORRIDOR.minZ-.1],[0,1,0]],[[7.25,2,9.5],[0,0,-1]],[[CORRIDOR.maxX+.1,2,9.5],[0,0,-1]],
 ])assert.equal(firstObjects(cast(scene,origin,direction)).size,1,`${map}: coincident visible faces at ${origin}`);
}));

test('partition base trim has a real proud lip on both sides instead of z-fighting with plaster',()=>maps(({scene},map)=>{
 for(const [x,dir]of [[6.9,1],[7.8,-1]]){
  const hits=cast(scene,[x,.06,-9.5],[dir,0,0],.7),trim=hits.find(h=>h.object.name==='partition-base-trim');
  assert.ok(trim,`${map}: missing base trim`);
  const behind=hits.find(h=>h.distance>trim.distance+.005);
  assert.ok(behind&&Math.abs(behind.distance-trim.distance-.012)<1e-5,'plaster and trim must be separate physical surfaces');
 }
}));

test('lift door motion keeps rigid dimensions, closes the aperture and clears it when open',()=>{
 const {scene,campus,dispose}=campusScene();try{
  const sizes=campus.liftDoors.map(g=>g.children.map(o=>o.geometry?.attributes.position.array.slice()));
  for(const closed of [true,false,true,false]){
   for(let i=0;i<120;i++)campus.update({officeLocked:false,rearDoorClosed:false,elevator:{doorClosed:closed}},1/60);
   scene.updateMatrixWorld(true);
   for(const x of [8.3,8.9,9.8,10.4])assert.equal(cast(scene,[x,1.4,CORRIDOR.minZ+.3],[0,0,-1],.7).some(h=>h.object.parent.name.startsWith('lift-door-')),closed);
   for(let i=0;i<campus.liftDoors.length;i++)for(let j=0;j<sizes[i].length;j++)if(sizes[i][j])assert.deepEqual(campus.liftDoors[i].children[j].geometry.attributes.position.array,sizes[i][j],'door was scaled or reshaped during travel');
  }
 }finally{dispose();}
});

test('fully opened sliding doors retract behind the side reveals rather than sharing their exposed face',()=>{
 const {scene,campus,dispose}=campusScene();try{
  for(const closed of [true,false,true,false]){
   for(let i=0;i<120;i++)campus.update({elevator:{doorClosed:closed}},1/60);
   scene.updateMatrixWorld(true);if(closed)continue;
   for(const [x,dir]of [[8.4,-1],[10.3,1]])for(const y of [.20,1.4,2.9])for(const z of [CORRIDOR.minZ-.08,CORRIDOR.minZ-.10,CORRIDOR.minZ-.13]){
    const hits=cast(scene,[x,y,z],[dir,0,0],.5),first=firstObjects(hits);
    assert.equal(first.size,1,`blue door end overlaps plaster at ${x}, ${y}, ${z}`);
    assert.ok(hits[0].object.name.startsWith('lift-entry-'),'plaster reveal must occlude the retracted moving leaf');
    const leaf=hits.find(h=>h.object.parent.name.startsWith('lift-door-'));
    assert.ok(leaf&&leaf.distance-hits[0].distance>.015,'door needs a real pocket setback, not material depth bias');
   }
  }
 }finally{dispose();}
});
