import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {buildReferenceCampus} from '../dist/reference-campus.js';
import {createSoloRound} from '../dist/solo-round.js';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {CAMPUS_MAPS,LAYOUT_PATTERNS,LIFT,BOARD,OFFICE,TEACHER_SPAWN,createSeatLayout,createLayoutContext,mapKind,floorHeight,floorTiles,blocked,chairExit,walkRoute,moveInRoom} from '../dist/classroom-layout.js';

function campusScene(){
 const scene=new T.Scene(),room=new T.Group();scene.add(room);const assets=new Set(),materials=new Set();
 const mat=(color,o={})=>{const m=new T.MeshStandardMaterial({color,...o});materials.add(m);return m;};
 const mesh=(g,m,p,s=[1,1,1],r=null,parent=room)=>{const o=new T.Mesh(g,m);o.position.set(...p);o.scale.set(...s);if(r)o.rotation.set(...r);parent.add(o);return o;};
 const box=(m,p,s,r=null,parent=room)=>mesh(new T.BoxGeometry(...s),m,p,[1,1,1],r,parent),rounded=(m,p,s,rad,r=null,parent=room)=>box(m,p,s,r,parent),cylinder=(m,p,s,r=null,parent=room)=>mesh(new T.CylinderGeometry(s[0],s[2],s[1],8),m,p,[1,1,1],r,parent),texture=()=>new T.Texture(),base=mat('#fff'),M=new Proxy({},{get:()=>base});
 const artwork={teacherTutorial:new T.Texture(),studentTutorial:new T.Texture(),classroomNotice:new T.Texture()},campus=buildReferenceCampus({scene,room,M,mat,mesh,box,rounded,cylinder,texture,assets,materials,floorMat:base,artwork});campus.enclosure.visible=true;campus.attachUpperArchitecture();scene.updateMatrixWorld(true);
 return{scene,campus,artwork,dispose(){scene.traverse(o=>o.geometry?.dispose());for(const m of materials)m.dispose();for(const a of assets)a.dispose?.();}};
}

test('all six tiered patterns support every real desk and chair on one complete terrace',async()=>{
 const [{scene:desk},{scene:chair}]=await Promise.all([loadGeometry('desk-v2.glb'),loadGeometry('chair-v2.glb')]);
 const body=desk.getObjectByName('DeskBody');assert.ok(body);const deskBox=new T.Box3().setFromObject(body,true),chairBox=new T.Box3().setFromObject(chair,true);
 for(const seed of [0,1,2,3,73])for(const pattern of LAYOUT_PATTERNS){const seats=createSeatLayout(seed,pattern,'tiered8');assert.equal(seats.length,pattern.startsWith('rows-')?20:30);const heights=new Set();
  for(const s of seats){const h=floorHeight(s.deskX,s.deskZ,'tiered8');heights.add(h);assert.equal(floorHeight(s.x,s.z,'tiered8'),h);
   for(const [box,x,z,label]of [[deskBox,s.deskX,s.deskZ,'desk'],[chairBox,s.x,s.z,'chair']]){
    const world=box.clone().applyMatrix4(new T.Matrix4().makeRotationY(s.yaw)).translate(new T.Vector3(x,h,z));
    for(const xx of [world.min.x,world.max.x])for(const zz of [world.min.z,world.max.z])assert.ok(Math.abs(floorHeight(xx,zz,'tiered8')-h)<1e-8,`${seed}/${pattern}/${s.id}: ${label} straddles a step`);
   }
  }
  assert.deepEqual([...heights].sort((a,b)=>a-b).map(h=>+h.toFixed(2)),[0,.24,.48,.72]);
 }
});

test('tiered seats have navigable routes and chair exits; path support rises by at most one twelve-centimetre step',()=>{
 for(const pattern of LAYOUT_PATTERNS){const seats=createSeatLayout(73,pattern,'tiered'),ctx=createLayoutContext(seats);
  for(const seat of seats){assert.equal(blocked(seat.x,seat.z,.23,ctx),false);assert.ok(chairExit(seat,.18,ctx));
   const route=walkRoute(LIFT,seat,.23,ctx);assert.ok(route.length,`${pattern}/${seat.id}: no route`);let from=LIFT,last=floorHeight(from.x,from.z,'tiered');
   for(const to of route){const n=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.015));for(let i=1;i<=n;i++){const p={x:from.x+(to.x-from.x)*i/n,z:from.z+(to.z-from.z)*i/n},h=floorHeight(p.x,p.z,'tiered');assert.equal(blocked(p.x,p.z,.23,ctx),false);assert.ok(Math.abs(h-last)<=.120001,`route crosses cliff ${pattern}/${seat.id}`);last=h;}from=to;}
  }
 }
});

test('tier floor rendered surfaces are non-overlapping and exactly match walking support',()=>{
 const {scene,campus,dispose}=campusScene();try{campus.setMap('tiered');scene.updateMatrixWorld(true);assert.equal(campus.tiered.visible,true);
 const tiles=floorTiles('tiered');assert.ok(tiles.length>12);for(let i=0;i<tiles.length;i++){const a=tiles[i],x=(a.minX+a.maxX)/2,z=(a.minZ+a.maxZ)/2;const hit=new T.Raycaster(new T.Vector3(x,3,z),new T.Vector3(0,-1,0)).intersectObject(campus.tiered,true)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-floorHeight(x,z,'tiered'))<1e-6);for(let j=i+1;j<tiles.length;j++){const b=tiles[j];assert.ok(a.maxX<=b.minX||a.minX>=b.maxX||a.maxZ<=b.minZ||a.minZ>=b.maxZ);}}
 campus.setMap('classroom');assert.equal(campus.tiered.visible,false);
 }finally{dispose();}
});

test('corridor has glazing only at lift end, while other outer wall spans are actual solid geometry',()=>{
 const {scene,dispose}=campusScene();try{
  const panes=scene.getObjectsByProperty('name','clear-exterior-pane').filter(o=>{const p=o.getWorldPosition(new T.Vector3());return p.x>10.99&&p.x<11.20;});assert.equal(panes.length,4);
  for(const pane of panes){const p=pane.getWorldPosition(new T.Vector3());assert.ok(p.z>=-7.45&&p.z<=-4.27);assert.ok(pane.material.opacity<.10);}
  for(const z of[-9.0,-3.8,0,3.8,7.9]){const hit=new T.Raycaster(new T.Vector3(10.5,2,z),new T.Vector3(1,0,0),0,1).intersectObject(scene,true).find(h=>h.object.name==='corridor-solid-outer-wall');assert.ok(hit,`hole at z=${z}`);assert.ok(Math.abs(hit.point.x-11)<1e-6);assert.equal(hit.object.material.transparent,false);}
  const inner=scene.getObjectsByProperty('name','pale-blue-interior-pane');assert.ok(inner.length>10);assert.ok(inner.every(p=>p.material.opacity>=.58&&p.material.opacity<=.70));
 }finally{dispose();}
});

test('teacher and student tutorials use independent 2:1 image planes without canvas text overlays',()=>{
 const {scene,artwork,dispose}=campusScene();try{
  const teacher=scene.getObjectByName('teacher-tutorial-whiteboard'),student=scene.getObjectByName('corridor-student-tutorial');assert.ok(teacher&&student);
  assert.equal(teacher.material.map,artwork.teacherTutorial);assert.ok(Math.abs(teacher.geometry.parameters.width/teacher.geometry.parameters.height-2)<1e-9);
  const picture=student.children.find(o=>o.geometry?.type==='PlaneGeometry');assert.equal(student.children.length,1,'student tutorial is only a transparent wall decal, no white panel/frame');assert.equal(picture.material.transparent,true);assert.equal(picture.material.map,artwork.studentTutorial);assert.equal(picture.geometry.parameters.width/picture.geometry.parameters.height,2);
  assert.equal(scene.getObjectsByProperty('name','classroom-red-award').length,9);
 }finally{dispose();}
});

test('round and one-use lift reconstruct terrain-compatible seats while preserving seed, pattern and cabin pose',()=>{
 for(const role of ['student','teacher']){const r=createSoloRound({role,seed:402,map:'classroom'});r.start({gathering:true});Object.assign(r.player,{x:LIFT.x,z:LIFT.z});assert.equal(r.travelFloor('tiered8'),true);r.step(3);assert.equal(r.map,'tiered8');assert.equal(r.seed,402);assert.equal(r.seats[0].pattern,createSeatLayout(402)[0].pattern);assert.deepEqual(r.seats,createSeatLayout(402,null,'tiered8'));assert.deepEqual({x:r.player.x,z:r.player.z},{x:LIFT.x,z:LIFT.z});assert.equal(r.travelFloor('night'),false);}
 for(const map of CAMPUS_MAPS){const r=new ClassroomRound({map,seed:73});assert.deepEqual(r.seats,createSeatLayout(73,null,map));assert.equal(r.layout.map,mapKind(map)==='tiered'?'tiered':'classroom');}
});

test('pre-class exterior boundaries stay closed while class and office door rules remain independent',()=>{
 const r=new ClassroomRound({seed:3});r.start({gathering:true});
 for(const [p,dx,dz]of [[{x:10.7,z:0},3,0],[{x:-6.8,z:0},-3,0],[{x:0,z:-9.6},0,-3],[{x:6,z:OFFICE.maxZ-.4},0,3],[{x:LIFT.x,z:-12.7},0,-3]]){const q=moveInRoom(p,dx,dz,.18,r.layout);assert.equal(blocked(q.x,q.z,.18,r.layout),false);assert.ok(Math.hypot(q.x-p.x,q.z-p.z)<.5);}
 assert.equal(r.layout.officeLocked,false);r.startBell();assert.equal(r.layout.officeLocked,true);assert.ok(walkRoute(LIFT,{x:6.8,z:7},.18,r.layout).length);assert.deepEqual(walkRoute(LIFT,TEACHER_SPAWN,.18,r.layout),[]);
 assert.equal(floorHeight(BOARD.x,BOARD.z,'tiered'),.16);
});
