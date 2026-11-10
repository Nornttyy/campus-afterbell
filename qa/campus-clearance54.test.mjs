import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {campusScene} from './campus-geometry54-helpers.mjs';
import {loadGeometry} from './gltf-geometry.mjs';
import {createRoomVariants} from '../dist/room-variants.js';
import {createSurveillanceView} from '../dist/surveillance-view54.js';
import {createSeatLayout,LAYOUT_PATTERNS,floorHeight,DOORS,CLASSROOM,CORRIDOR,CEILING_HEIGHT,OFFICE_BOARD} from '../dist/classroom-layout.js';

const bounds=o=>{o.updateWorldMatrix(true,true);return new T.Box3().setFromObject(o,true);};
const visible=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
function acrossWall(scene,side,y,z){return new T.Raycaster(new T.Vector3(side<0?CLASSROOM.minX+.25:CLASSROOM.maxX-.25,y,z),new T.Vector3(side,0,0),0,.52).intersectObject(scene,true).filter(h=>visible(h.object));}
function overlaps(a,b){return ['x','y','z'].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>1e-5);}

test('door transoms have no open horizontal or side seams in either ceiling configuration',()=>{
 const {scene,campus,dispose}=campusScene();try{
  for(const map of['classroom','tiered']){campus.setMap(map);scene.updateMatrixWorld(true);
   for(const d of DOORS)for(const z of[d.center,d.minZ+.012,d.maxZ-.012])for(const y of[3.09,3.095,3.13,3.4,4.205,4.21,4.22,4.30]){
    assert.ok(acrossWall(scene,1,y,z).length,`${map}/${d.id}: light leaks at ${y}, ${z}`);
   }
  }
 }finally{dispose();}
});

test('window sash profiles actually meet their lower, upper and transom rails',()=>{
 const {scene,campus,dispose}=campusScene();try{
  for(const map of['classroom','tiered']){campus.setMap(map);scene.updateMatrixWorld(true);const top=map==='tiered'?2.95:3.83,transom=top-.50;
   for(const side of[-1,1])for(const z of[0,1,4.5])for(const y of[1.14,1.15,1.16,transom-.055,transom-.045,transom+.045,transom+.055,top-.055,top-.045]){
    assert.ok(acrossWall(scene,side,y,z).length,`${map}/${side}: sash gap at ${y}, ${z}`);
   }
  }
 }finally{dispose();}
});

test('wall controls, clock and tutorials stand clear of plaster, posters, board and ceiling',()=>{
 const {scene,dispose}=campusScene();try{
  const controls=bounds(scene.getObjectByName('classroom-switch-control-cluster')),clock=bounds(scene.getObjectByName('classroom-wall-clock'));
  assert.ok(controls.max.x<7.20&&7.20-controls.max.x<.003,'control backs must meet the wall, not float or bury into plaster');
  assert.ok(controls.max.y<2.0,'switches must not overlap the habits poster');
  assert.ok(clock.max.z<8.8&&8.8-clock.max.z<.02);assert.ok(clock.max.y<CEILING_HEIGHT);assert.ok(clock.min.y>3.925,'clock clears blackboard top');
  const student=bounds(scene.getObjectByName('corridor-student-tutorial'));assert.ok(student.max.x<CORRIDOR.maxX&&CORRIDOR.maxX-student.max.x<.006);
  const teacher=bounds(scene.getObjectByName('teacher-tutorial-whiteboard'));assert.ok(Math.abs(teacher.max.z-(OFFICE_BOARD.z-.05))<1e-5);
  assert.equal(overlaps(controls,clock),false);
 }finally{dispose();}
});

test('different real desks and chairs never overlap across all floor/layout combinations',async()=>{
 const [{scene:desk},{scene:chair}]=await Promise.all([loadGeometry('desk-v2.glb'),loadGeometry('chair-v2.glb')]);
 const deskBox=bounds(desk.getObjectByName('DeskBody')),chairBox=bounds(chair.getObjectByName('ChairBody'));
 for(const map of['classroom','tiered'])for(const seed of[0,3,73,91])for(const pattern of LAYOUT_PATTERNS){
  const boxes=createSeatLayout(seed,pattern,map).flatMap(s=>[[deskBox,s.deskX,s.deskZ,'desk'],[chairBox,s.x,s.z,'chair']].map(([b,x,z,kind])=>({id:s.id,kind,box:b.clone().applyMatrix4(new T.Matrix4().makeRotationY(s.yaw)).translate(new T.Vector3(x,floorHeight(x,z,map),z))})));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(boxes[i].id!==boxes[j].id)assert.equal(overlaps(boxes[i].box,boxes[j].box),false,`${map}/${seed}/${pattern}: ${boxes[i].id} ${boxes[i].kind} through ${boxes[j].id} ${boxes[j].kind}`);
 }
});

test('computer stations retain a physical gap in face-to-face four-table layouts',()=>{
 const scene=new T.Scene(),materials=[],mat=(color,options={})=>{const m=new T.MeshStandardMaterial({color,...options});materials.push(m);return m;};
 const box=(m,p,s,r,parent)=>{const mesh=new T.Mesh(new T.BoxGeometry(...s),m);mesh.position.set(...p);if(r)mesh.rotation.set(...r);parent.add(mesh);return mesh;};
 const variants=createRoomVariants({scene,mat,box,rounded:(m,p,s,rad,r,parent)=>box(m,p,s,r,parent),texture:()=>new T.Texture(),bakeStatic:()=>{}});
 try{for(const pattern of LAYOUT_PATTERNS){variants.setMap('computer');variants.setSeats(createSeatLayout(73,pattern));scene.updateMatrixWorld(true);const entries=[...variants.stations].filter(([,o])=>o.visible).map(([id,o])=>({id,box:bounds(o)}));for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)assert.equal(overlaps(entries[i].box,entries[j].box),false,`${pattern}: lab station ${entries[i].id}/${entries[j].id}`);}}
 finally{variants.dispose();scene.traverse(o=>o.geometry?.dispose());materials.forEach(m=>m.dispose());}
});

test('actual pitched surveillance housings and hoods remain inside the classroom walls',()=>{
 const original=globalThis.document,element=()=>({style:{},setAttribute(){},append(){},remove(){},getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)}}};}});
 globalThis.document={createElement:element,body:{append(){}}};const scene=new T.Scene(),view=createSurveillanceView(scene,{});
 try{for(const map of['classroom','tiered']){view.update({map,status:'playing',stage:'class',role:'teacher',surveillance:{devices:[{id:'front'},{id:'back'}]}});scene.updateMatrixWorld(true);
  for(const object of scene.getObjectByName('classroom-surveillance').children){const b=bounds(object);assert.ok(b.min.x>=CLASSROOM.minX&&b.max.x<=CLASSROOM.maxX);assert.ok(b.min.z>=-10&&b.max.z<=8.8,`${object.name||'camera hood'} crosses wall at ${b.min.z}…${b.max.z}`);}
 }}finally{view.dispose();globalThis.document=original;}
});
