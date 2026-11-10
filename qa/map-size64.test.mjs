import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {campusScene} from './campus-geometry54-helpers.mjs';
import {CLASSROOM,CORRIDOR,LIFT,ROLE_LOCKER,OFFICE,SEATS,createLayoutContext,blocked,moveInRoom,walkRoute} from '../dist/classroom-layout.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function visible(o){for(;o;o=o.parent)if(!o.visible)return false;return true;}
function ray(scene,origin,direction,far=1){return new T.Raycaster(new T.Vector3(...origin),new T.Vector3(...direction),0,far).intersectObject(scene,true).filter(h=>visible(h.object));}
test('requested sizing preserves classroom door positions and expands only the existing corridor footprint',()=>{
 close((CORRIDOR.maxX-CORRIDOR.minX)/3.6,1.4);close((CORRIDOR.maxZ-CORRIDOR.minZ)/18.8,1.4);
 assert.ok(CLASSROOM.maxX-CLASSROOM.minX<14.4);assert.ok(CLASSROOM.maxX-CLASSROOM.minX>13.5);
 close(LIFT.maxX-LIFT.minX,2.5);close(LIFT.maxZ-LIFT.minZ,2.8);close(LIFT.maxZ,CORRIDOR.minZ-.2);
 const context=createLayoutContext(SEATS),z=(CLASSROOM.minZ+CORRIDOR.minZ)/2;
 assert.equal(blocked(0,z,.18,context),true,'extension must not invent a classroom behind the rear wall');
 assert.equal(blocked((CORRIDOR.minX+CORRIDOR.maxX)/2,z,.18,context),false);
 assert.ok(walkRoute(LIFT,{x:9,z:7},.23,context).length);
 for(const [origin,dx]of [[{x:CORRIDOR.minX+.3,z},-2],[{x:CORRIDOR.maxX-.3,z},2]]){
  const p=moveInRoom(origin,dx,0,.18,context);assert.equal(blocked(p.x,p.z,.18,context),false);assert.ok(Math.abs(p.x-origin.x)<.15);
 }
});
test('corridor extension has continuous floor, walls and ceiling with no stretched floor UV or open corner',()=>{
 const f=campusScene();try{
  for(let z=CORRIDOR.minZ+.05;z<CLASSROOM.minZ-.25;z+=.19){
   for(const [x,dx,expected]of [[CORRIDOR.minX+.25,-1,CORRIDOR.minX],[CORRIDOR.maxX-.25,1,CORRIDOR.maxX]])for(const y of [.2,1.7,4.1]){
    const hits=ray(f.scene,[x,y,z],[dx,0,0],.6);assert.ok(hits.length,`wall opening at ${x},${y},${z}`);assert.ok(Math.abs(hits[0].point.x-expected)<.15);
   }
   const x=(CORRIDOR.minX+CORRIDOR.maxX)/2,floor=ray(f.scene,[x,.7,z],[0,-1,0],1).find(h=>h.object.name==='campus-continuous-floor');assert.ok(floor);close(floor.point.y,0);close(floor.uv.x,floor.point.x/1.6);close(floor.uv.y,floor.point.z/1.6);
   const ceiling=ray(f.scene,[x,4,z],[0,1,0],.6).find(h=>h.object.name==='campus-ceiling-corridor');assert.ok(ceiling);close(ceiling.point.y,4.51);
  }
  for(const [x,z]of [[7.3,CLASSROOM.minZ-.2],[7.3,CORRIDOR.minZ-.1],[CORRIDOR.maxX+.1,CORRIDOR.minZ-.1]])for(const y of [.3,2,4.4]){
   const hits=ray(f.scene,[x+.4,y,z],[-1,0,0],.7);assert.ok(hits.length,`open corridor corner ${x},${z}`);
  }
  const cabin=f.scene.getObjectByName('walkable-eight-floor-lift');assert.deepEqual(cabin.scale.toArray(),[1,1,1]);close(cabin.position.z,CORRIDOR.minZ-CLASSROOM.minZ);
  const panel=f.campus.liftPanel.getWorldPosition(new T.Vector3());assert.ok(panel.z<LIFT.maxZ&&panel.z>LIFT.minZ);
  close(f.scene.getObjectByName('role-changing-locker').position.x,ROLE_LOCKER.x);close(OFFICE.maxX,CORRIDOR.maxX);
 }finally{f.dispose();}
});
