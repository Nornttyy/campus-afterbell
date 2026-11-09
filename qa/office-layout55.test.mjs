import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {campusScene} from './campus-geometry54-helpers.mjs';
import {createRoomVariants} from '../dist/room-variants.js';
import {OFFICE,OFFICE_DESKS,OFFICE_CHAIRS,OFFICE_BOARD,LIFT,LECTERN,CLASSROOM,CORRIDOR,createLayoutContext,createSeatLayout,walkRoute,chairExit,blocked,enclosureVolumes} from '../dist/classroom-layout.js';
const box=o=>{o.updateWorldMatrix(true,true);return new T.Box3().setFromObject(o,true);};
const overlaps=(a,b)=>['x','y','z'].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>1e-5);
function lab(scene,screenContent=null,officeScreens=new Map()){
 const materials=[],mat=(color,opts={})=>{const m=new T.MeshStandardMaterial({color,...opts});materials.push(m);return m;},make=(m,p,s,r,g)=>{const o=new T.Mesh(new T.BoxGeometry(...s),m);o.position.set(...p);if(r)o.rotation.set(...r);g.add(o);return o;};
 const variants=createRoomVariants({scene,box:make,rounded:(m,p,s,rad,r,g)=>make(m,p,s,r,g),mat,texture:()=>new T.Texture(),bakeStatic:()=>{},screenContent,officeScreens});return{variants,dispose(){variants.dispose();scene.traverse(o=>o.geometry?.dispose());materials.forEach(m=>m.dispose());}};
}

test('larger office has five full-size non-overlapping workstations and reachable chair exits',()=>{
 const f=campusScene(),ctx=createLayoutContext();try{
  assert.ok((OFFICE.maxX-OFFICE.minX)*(OFFICE.maxZ-OFFICE.minZ)>130);assert.equal(OFFICE_DESKS.length,5);assert.equal(f.campus.officeScreens.size,5);
  const entries=OFFICE_DESKS.map(d=>({id:d.id,box:box(f.scene.getObjectByName(d.id==='office-lunch'?'office-openable-lunch-desk':d.id))}));
  for(const c of OFFICE_CHAIRS)entries.push({id:c.id,box:box(f.scene.getObjectByName(c.id==='office-chair'?'office-sittable-chair':c.id))});
  entries.push({id:'whiteboard',box:box(f.scene.getObjectByName('office-mobile-board'))});
  for(let i=0;i<entries.length;i++){const a=entries[i];assert.ok(a.box.min.x>OFFICE.minX&&a.box.max.x<OFFICE.maxX&&a.box.min.z>OFFICE.minZ&&a.box.max.z<OFFICE.maxZ,a.id+' intersects exterior');for(let j=i+1;j<entries.length;j++)assert.equal(overlaps(a.box,entries[j].box),false,a.id+' intersects '+entries[j].id);}
  for(const c of OFFICE_CHAIRS){assert.ok(walkRoute(LIFT,c,.23,ctx).length,c.id+' unreachable');assert.ok(chairExit(c,.23,ctx),c.id+' cannot stand');}
  for(const d of OFFICE_DESKS){assert.equal(blocked(d.x,d.z,.18,ctx),true);const monitor=f.campus.officeScreens.get(d.id),b=box(monitor);assert.ok(b.min.y>.985&&b.max.y<1.59);}
 }finally{f.dispose();}
});

test('office exterior and ceiling enclose expanded floor with no leftover old wall',()=>{
 const f=campusScene();try{
  const cast=(origin,dir)=>new T.Raycaster(new T.Vector3(...origin),new T.Vector3(...dir),0,2).intersectObject(f.scene,true).filter(h=>h.object.material&&!h.object.material.transparent);
  for(const z of[10,15.8,18,20.1]){const left=cast([OFFICE.minX+.5,3,z],[-1,0,0]);assert.ok(left.some(h=>Math.abs(h.point.x-OFFICE.minX)<1e-5));const right=cast([OFFICE.maxX-.5,3,z],[1,0,0]);assert.ok(right.some(h=>Math.abs(h.point.x-OFFICE.maxX)<1e-5));}
  for(const x of[0,4,9]){const top=cast([x,4,19],[0,1,0]);assert.ok(top.some(h=>Math.abs(h.point.y-4.51)<1e-5));}
  assert.equal(enclosureVolumes().some(v=>v.minZ===15.8&&v.minY===0),false,'old back wall must not remain inside the office');
  const board=box(f.scene.getObjectByName('office-mobile-board'));assert.ok(board.max.z<OFFICE.maxZ);assert.ok(Math.abs(f.scene.getObjectByName('teacher-tutorial-whiteboard').getWorldPosition(new T.Vector3()).z-(OFFICE_BOARD.z-.05))<1e-6);
 }finally{f.dispose();}
});

test('complete courtyard tree crowns stay beyond the enlarged office and school glazing',()=>{
 const f=campusScene();try{
  const trees=[];f.scene.traverse(o=>{if(o.name==='courtyard-branched-tree')trees.push(o);});assert.equal(trees.length,8);
  // Includes the wall thickness and a clear air gap. These are actual rendered
  // branch/crown/leaf bounds, not trunk-position or collision-only checks.
  const interiors=[CLASSROOM,CORRIDOR,OFFICE,LIFT].map(r=>new T.Box3(new T.Vector3(r.minX-.25,-.2,r.minZ-.25),new T.Vector3(r.maxX+.25,5,r.maxZ+.25)));
  const wings=f.scene.getObjectByName('courtyard-school-wings').children.map(box);
  for(const tree of trees){const b=box(tree);for(const interior of interiors)assert.equal(overlaps(b,interior),false,`tree at ${tree.position.x},${tree.position.z} intersects campus`);for(const wing of wings)assert.equal(overlaps(b,wing),false,'relocated tree intersects an exterior school wing');assert.deepEqual(tree.scale.toArray(),[1,1,1]);}
 }finally{f.dispose();}
});

test('each office drawer opens independently and retains its own item parent and pick target',()=>{
 const f=campusScene();try{
  const targets=f.campus.getTargets();assert.equal(targets.officeDesks.length,5);assert.equal(targets.officeChairs.length,5);assert.equal(f.campus.officeDrawers.size,5);
  const selected=OFFICE_DESKS[3].id;
  for(let i=0;i<12;i++)f.campus.update({officeDrawers:OFFICE_DESKS.map(d=>({id:d.id,open:d.id===selected}))},.1);
  for(const d of OFFICE_DESKS){const drawer=f.campus.officeDrawers.get(d.id),target=targets.officeDesks.find(t=>t.id===d.id);assert.equal(target.drawer,drawer);assert.equal(target.itemParent,drawer);if(d.id===selected)assert.ok(drawer.position.z<-.599);else assert.equal(drawer.position.z,-.08);}
  const chair=OFFICE_CHAIRS.find(c=>c.deskId===selected);assert.ok(chair);assert.ok(targets.officeChairs.some(c=>c.id===chair.id));
 }finally{f.dispose();}
});

test('twenty-seat layouts hide spare hardware and pass exactly the active screens to the content owner',()=>{
 const scene=new T.Scene(),calls=[],content={update(...a){calls.push(a);},dispose(){}},f=lab(scene,content,new Map([[0,'office-screen']]));try{
  f.variants.setMap('computer');for(const [pattern,rows,cols]of[['rows-wide',4,5],['rows-long',5,4]]){const seats=createSeatLayout(73,pattern);assert.equal(seats.length,20);const zs=new Set(seats.map(s=>s.deskZ));assert.equal(zs.size,rows);assert.ok([...zs].every(z=>seats.filter(s=>s.deskZ===z).length===cols));assert.ok(seats.every(s=>s.yaw===0));f.variants.setSeats(seats);f.variants.update({students:[]});const latest=calls.at(-1);assert.equal(latest[1].size,20);assert.equal([...f.variants.stations.values()].filter(o=>o.visible).length,20);assert.equal(latest[2],f.variants.teacherScreen);assert.equal(latest[3].get(0),'office-screen');}
  f.variants.setSeats(createSeatLayout(73,'pairs'));assert.equal([...f.variants.stations.values()].filter(o=>o.visible).length,30);f.variants.setMap('classroom');f.variants.update({});assert.equal(calls.at(-1)[1].size,0);assert.equal(calls.at(-1)[2],null);
 }finally{f.dispose();}
});

test('lecture laptop rests exactly on the lectern without intersecting bezel or scaling furniture',()=>{
 const scene=new T.Scene(),f=lab(scene);try{
  f.variants.setMap('computer');const laptop=scene.getObjectByName('teacher-lecture-laptop'),b=box(laptop);assert.ok(Math.abs(b.min.y-1.1475)<1e-6);assert.ok(b.min.x>LECTERN.minX&&b.max.x<LECTERN.maxX&&b.min.z>LECTERN.minZ&&b.max.z<LECTERN.maxZ);assert.deepEqual(laptop.scale.toArray(),[1,1,1]);
  const screen=f.variants.teacherScreen;assert.equal(screen.userData.animated,true);const world=screen.getWorldPosition(new T.Vector3()),normal=new T.Vector3(0,0,1).applyQuaternion(screen.getWorldQuaternion(new T.Quaternion()));const hit=new T.Raycaster(world.clone().addScaledVector(normal,.01),normal.clone().negate(),0,.015).intersectObject(laptop,true);assert.equal(hit[0].object,screen,'display face must stay in front of physical lid');
 }finally{f.dispose();}
});
