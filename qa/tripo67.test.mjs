import test from 'node:test';import assert from 'node:assert/strict';import*as T from '../dist/vendor/three.module.js';
import{loadGeometry}from './gltf-geometry.mjs';import{loadFurniture67,cloneFurniture67,MONITOR67}from '../dist/furniture-assets67.js?v=campus-81';
import{createRoomVariants}from '../dist/room-variants.js?v=campus-81';import{modelTriangles}from '../dist/model-budget64.js';
const loader={loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())};const report=await loadFurniture67({loader});
const V=()=>new T.Vector3(),bounds=o=>{o.updateWorldMatrix(true,true);return new T.Box3().setFromObject(o,true);};
function fixture(){const scene=new T.Scene(),mat=(color,opts={})=>new T.MeshStandardMaterial({color,...opts});const make=(m,p,s,r,g)=>{const mesh=new T.Mesh(new T.BoxGeometry(...s),m);mesh.position.set(...p);if(r)mesh.rotation.set(...r);g.add(mesh);return mesh;};const variants=createRoomVariants({scene,box:make,rounded:(m,p,s,rad,r,g)=>make(m,p,s,r,g),mat,bakeStatic:()=>{},texture:()=>new T.Texture()});variants.setMap('computer');variants.setSeats([{id:0,deskX:0,deskZ:0,yaw:0}]);return {scene,variants};}
test('all supplied furniture loads within the unchanged 8000-triangle budget and touches its floor',()=>{
 assert.ok(report.every(r=>r.ok),JSON.stringify(report));for(const r of report){const a=cloneFurniture67(r.name),b=cloneFurniture67(r.name);assert.ok(modelTriangles(a)<=8000);assert.ok(Math.abs(bounds(a).min.y)<1e-5,r.name+' floats');assert.deepEqual(a.scale.toArray(),[1,1,1]);a.position.x=10;assert.ok(bounds(b).max.x<2,'shared clone transformed');}
});
test('keyboard and mouse lie flat; monitor display stays in front of the real screen and is raycastable',()=>{
 const {scene,variants}=fixture(),station=variants.stations.get(0),screen=variants.screens.get(0);scene.updateMatrixWorld(true);
 for(const name of['keyboard','mouse']){const o=station.getObjectByName('tripo67-'+name),b=bounds(o),size=b.getSize(V());assert.ok(size.y<.04,name+' stands upright');assert.ok(Math.abs(b.min.y-.8625)<1e-5,name+' floats on table');}
 const centre=screen.getWorldPosition(V()),origin=centre.clone().add(new T.Vector3(0,0,-1)),ray=new T.Raycaster(origin,centre.clone().sub(origin).normalize());const hits=ray.intersectObject(station,true);assert.equal(hits[0]?.object,screen,'screen hidden behind bezel/old procedural monitor');assert.equal(screen.geometry.parameters.width,MONITOR67.width);
 const tower=bounds(station.getObjectByName('tripo67-computer-tower')),drawer=variants.drawers.get(0);for(let i=0;i<60;i++){variants.updateDrawers({player:{id:0,seatId:0,seated:true},drawer:{open:true},students:[]},1/60);scene.updateMatrixWorld(true);assert.ok(!tower.intersectsBox(bounds(drawer.group)),'tower intersects sliding tray');}
 variants.dispose();
});
test('office desk keeps its actual textured drawer front separate, with no duplicate front in the body',()=>{
 const desk=cloneFurniture67('office-desk'),front=desk.getObjectByName('office-desk-drawer-front'),body=desk.getObjectByName('office-desk-body');assert.ok(front&&body);const original=bounds(front),bodyBox=bounds(body);front.position.z-=.52;const moved=bounds(front);assert.ok(Math.abs(moved.min.z-(original.min.z-.52))<1e-6);assert.deepEqual(bounds(body).min.toArray(),bodyBox.min.toArray());const ray=new T.Raycaster(new T.Vector3(-.255,.81,-2),new T.Vector3(0,0,1));const bodyHits=ray.intersectObject(body,true);assert.ok(!bodyHits.some(hit=>hit.point.z<-.37),'closed textured front left behind');
});
test('full-size supplied tower rests on the floor and clears every fixed desk part, not just the drawer',()=>{
 const {scene,variants}=fixture(),station=variants.stations.get(0),tower=station.getObjectByName('tripo67-computer-tower');scene.updateMatrixWorld(true);
 const b=bounds(tower),overlaps=(a,b)=>['x','y','z'].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>1e-6);
 assert.ok(Math.abs(b.min.y-.002)<1e-6,'tower must not float');assert.deepEqual(tower.scale.toArray(),[1,1,1]);
 const source=bounds(cloneFurniture67('computer-tower'));assert.ok(b.getSize(V()).distanceTo(source.getSize(V()))<1e-8,'tower dimensions changed');
 station.children[0].traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(p===tower)return;assert.ok(!overlaps(b,bounds(o)),`tower intersects ${o.name||o.geometry.type}`);});
 for(let i=0;i<=30;i++){variants.drawers.get(0).group.position.z=-.24*i/30;assert.ok(!overlaps(b,bounds(variants.drawers.get(0).group)),'opening tray hits tower');}variants.dispose();
});
