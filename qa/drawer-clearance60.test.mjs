import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {campusScene} from './campus-geometry54-helpers.mjs';
import {buildComputerDrawer55} from '../dist/computer-hardware55.js';
import {syncDrawerCollisions} from '../dist/drawer-collision58.js';
import {LAYOUT_PATTERNS,createSeatLayout,createLayoutContext,floorHeight,OFFICE_DESKS,OFFICE_CHAIRS} from '../dist/classroom-layout.js';

function shape(root){root.updateWorldMatrix(true,true);const triangles=[];root.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position,ix=mesh.geometry.index;for(let n=0;n<(ix?.count||p.count);n+=3){const points=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(n+k):n+k).applyMatrix4(mesh.matrixWorld));triangles.push(new T.Triangle(...points));}});return{bounds:new T.Box3().setFromObject(root,true),triangles};}
function placement(x,y,z,yaw=0){return new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw),new T.Vector3(1,1,1));}
function intersects(box,model,matrix){const local=box.clone().applyMatrix4(matrix.clone().invert());return local.intersectsBox(model.bounds)&&model.triangles.some(t=>local.intersectsTriangle(t));}
function contained(box,solid,label){for(const axis of ['x','y','z']){const A=axis.toUpperCase();assert.ok(box.min[axis]>=solid['min'+A]-.00001&&box.max[axis]<=solid['max'+A]+.00001,label+' actual tray outside collision '+axis);}}
function computerTray(){const parent=new T.Group(),m=new T.MeshBasicMaterial(),box=(material,p,s,r,g)=>{const mesh=new T.Mesh(new T.BoxGeometry(...s),material);mesh.position.set(...p);if(r)mesh.rotation.set(...r);g.add(mesh);return mesh;};const drawer=buildComputerDrawer55({parent,box,rounded:(m,p,s,rad,r,g)=>box(m,p,s,r,g),mat:()=>m});return drawer.group;}
const [deskSource,chairSource]=await Promise.all([loadGeometry('desk-v2.glb'),loadGeometry('chair-v2.glb')]);
const desk=shape(deskSource.scene.getObjectByName('DeskBody')),chair=shape(chairSource.scene.getObjectByName('ChairBody')),tray=shape(deskSource.scene.getObjectByName('DeskDrawer')),labTray=shape(computerTray());

test('actual imported and computer trays stay clear of chair triangles and neighbouring tables throughout opening in every arrangement',()=>{
 for(const map of ['classroom','tiered','computer'])for(const pattern of LAYOUT_PATTERNS){
  const seats=createSeatLayout(73,pattern,map),layout=createLayoutContext(seats),models=seats.map(s=>({s,table:placement(s.deskX,floorHeight(s.deskX,s.deskZ,map),s.deskZ,s.yaw),chair:placement(s.x,floorHeight(s.x,s.z,map),s.z,s.yaw)}));
  syncDrawerCollisions(layout,map,seats.map(s=>({id:s.id,seatId:s.id,seated:true,_drawerOpen:true})));
  for(const [i,entry]of models.entries())for(const open of [0,.25,.5,.75,1]){
   const local=(map==='computer'?labTray:tray).bounds.clone().translate(new T.Vector3(0,0,-open*.24)),actual=local.applyMatrix4(entry.table),label=`${map}/${pattern}/${entry.s.id}/${open}`;
   if(open===1)contained(actual,layout.dynamicSolids[i],label);
   for(const other of models){assert.equal(intersects(actual,chair,other.chair),false,label+' through chair '+other.s.id);
    // The drawer naturally occupies its own desk housing; only neighbours
    // are tested as solid furniture, using their actual triangle surfaces.
    if(map!=='computer'&&other!==entry)assert.equal(intersects(actual,desk,other.table),false,label+' through other desk '+other.s.id);
   }
  }
 }
});

test('all five office drawers remain above actual chair seats and inside their authoritative opened bounds',()=>{
 const f=campusScene();try{
  const chairs=OFFICE_CHAIRS.map(c=>shape(f.scene.getObjectByName(c.id==='office-chair'?'office-sittable-chair':c.id))),layout=createLayoutContext();
  syncDrawerCollisions(layout,'classroom',OFFICE_DESKS.map(d=>({seated:true,_drawerOpen:true,_officeChair:true,_officeDeskId:d.id})));
  for(const closed of [false,true,false]){for(let i=0;i<100;i++)f.campus.update({officeDrawers:OFFICE_DESKS.map(d=>({id:d.id,open:!closed}))},.1);f.scene.updateMatrixWorld(true);
   for(const [i,d]of OFFICE_DESKS.entries()){
    const actual=new T.Box3().setFromObject(f.campus.officeDrawers.get(d.id),true);
    for(const other of chairs)assert.equal(other.triangles.some(t=>actual.intersectsTriangle(t)),false,d.id+' opened tray intersects office chair');
    if(!closed)contained(actual,layout.dynamicSolids[i],d.id);
   }
  }
 }finally{f.dispose();}
});
