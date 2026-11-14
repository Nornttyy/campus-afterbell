import test from 'node:test';
import assert from 'node:assert/strict';
import {SEATS,CLASSROOM,OFFICE,LIFT,BOARD,TEACHER_SPAWN,OFFICE_CHAIR,OFFICE_CHAIRS,OFFICE_DESKS,DETENTION,DOORS,DOOR_LEAVES,CORRIDOR,CAMPUS_MAPS,LAYOUT_PATTERNS,CEILING_HEIGHT,TIERED_CEILING_HEIGHT,createSeatLayout,createLayoutContext,updateLayoutDoors,mapKind,ceilingVolumes,enclosureVolumes,blocked,moveInRoom,walkRoute,clearWallSegment,floorHeight,actorFloorHeight,floorTiles} from '../dist/classroom-layout.js';
import {DORM_BOUNDS} from '../dist/dorm-layout70.js';
import {chalkHit} from '../dist/teacher-rules.js';
import {createSmokeProjectile,stepSmokeProjectile} from '../dist/smoke-physics.js';

function validRoute(a,b,r,ctx){const path=walkRoute(a,b,r,ctx);assert.ok(path.length,`No path from ${JSON.stringify(a)} to ${JSON.stringify(b)}`);assert.deepEqual(path.at(-1),{...b});let from=a;for(const to of path){const n=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.04));for(let i=0;i<=n;i++)assert.equal(blocked(from.x+(to.x-from.x)*i/n,from.z+(to.z-from.z)*i/n,r,ctx),false);from=to;}return path;}

test('six deterministic twenty/thirty-seat arrangements preserve furniture sizes and free seat positions',()=>{
 for(const pattern of LAYOUT_PATTERNS){const seats=createSeatLayout(73,pattern),ctx=createLayoutContext(seats);assert.equal(seats.length,pattern.startsWith('rows-')?20:30);assert.equal(new Set(seats.map(s=>s.id)).size,seats.length);assert.deepEqual(seats,createSeatLayout(73,pattern));for(const s of seats){assert.ok([0,Math.PI].includes(s.yaw));assert.equal(blocked(s.x,s.z,.23,ctx),false);assert.ok(Math.abs(Math.hypot(s.x-s.deskX,s.z-s.deskZ)-.78)<1e-9);}for(let i=0;i<ctx.desks.length;i++)for(let j=i+1;j<ctx.desks.length;j++){const a=ctx.desks[i],b=ctx.desks[j];assert.ok(a.maxX<=b.minX||a.minX>=b.maxX||a.maxZ<=b.minZ||a.minZ>=b.maxZ,'tables must not overlap');}}
 assert.notDeepEqual(createSeatLayout(0),createSeatLayout(1));assert.notDeepEqual(createSeatLayout(3),createSeatLayout(7));
});

test('actual shipped desk meshes do not intersect in single, pair, square or mixed layouts',async()=>{
 const T=await import('../dist/vendor/three.module.js'),{loadGeometry}=await import('./gltf-geometry.mjs'),{scene}=await loadGeometry('desk-v2.glb'),body=scene.getObjectByName('DeskBody');assert.ok(body);body.updateMatrixWorld(true);
 const original=new T.Box3().setFromObject(body,true),size=original.getSize(new T.Vector3());assert.ok(size.z>.84,'test must measure the actual imported .8486m deep desktop');
 const overlap=(a,b)=>Math.min(a.max.x,b.max.x)-Math.max(a.min.x,b.min.x)>1e-6&&Math.min(a.max.z,b.max.z)-Math.max(a.min.z,b.min.z)>1e-6;
 for(const seed of[7,73,91])for(const pattern of LAYOUT_PATTERNS){const boxes=createSeatLayout(seed,pattern).map(s=>original.clone().applyMatrix4(new T.Matrix4().makeRotationY(s.yaw)).translate(new T.Vector3(s.deskX,0,s.deskZ)));for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.equal(overlap(boxes[i],boxes[j]),false,`${pattern}/${seed}: imported tables ${i} and ${j} intersect`);}
});

test('multiple room layout and door contexts cannot mutate each other or the default seats',()=>{
 const baseline=JSON.stringify(SEATS),a=createLayoutContext(createSeatLayout(0)),b=createLayoutContext(createSeatLayout(2));const route=walkRoute(LIFT,TEACHER_SPAWN,.23,b);updateLayoutDoors(a,{officeLocked:true,rearDoorClosed:true});assert.deepEqual(walkRoute(LIFT,TEACHER_SPAWN,.23,b),route);assert.equal(JSON.stringify(SEATS),baseline);assert.notStrictEqual(a.routeGrids,b.routeGrids);assert.notStrictEqual(a.walkSolids,b.walkSolids);
});

test('every seat in every layout can reach the front and rear of class and the detention posts',()=>{
 for(const pattern of LAYOUT_PATTERNS){const seats=createSeatLayout(73,pattern),ctx=createLayoutContext(seats);for(const radius of [.20,.23])for(const seat of seats){validRoute(seat,{x:6.8,z:DOORS[0].center},radius,ctx);for(const post of DETENTION)validRoute(seat,{x:post.x,z:post.z-1.1},radius,ctx);}}
});

test('both classroom door apertures open onto the long corridor, while partition and leaves are solid',()=>{
 const ctx=createLayoutContext(SEATS),stopped=moveInRoom({x:6.7,z:0},2,0,.23,ctx);assert.ok(stopped.x<=CLASSROOM.maxX-.23+1e-8);
 for(const d of DOORS){const crossed=moveInRoom({x:6.7,z:d.center},2.8,0,.23,ctx);assert.ok(crossed.x>9.2);assert.equal(clearWallSegment({x:6.7,z:d.center},{x:9.2,z:d.center},ctx),true);}
 for(const leaf of DOOR_LEAVES){const x=(leaf.minX+leaf.maxX)/2,stopped=moveInRoom({x,z:leaf.minZ-.6},0,1.2,.2,ctx);assert.ok(stopped.z<=leaf.minZ-.2+1e-8);}
});

test('closed office door prevents preparation-phase escape, then clears navigation when opened',()=>{
 const ctx=createLayoutContext(SEATS,{officeLocked:true}),inside={x:OFFICE.doorX,z:10},outside={x:OFFICE.doorX,z:8};assert.equal(clearWallSegment(inside,outside,ctx),false);assert.deepEqual(walkRoute(inside,outside,.23,ctx),[]);assert.ok(moveInRoom(inside,0,-3,.23,ctx).z>=OFFICE.minZ-.22+.23);updateLayoutDoors(ctx,{officeLocked:false});validRoute(inside,outside,.23,ctx);assert.ok(moveInRoom(inside,0,-3,.23,ctx).z<8);
});

test('rear door closes the local opening but leaves the front door available',()=>{
 const ctx=createLayoutContext(SEATS),rear=DOORS[0],front=DOORS[1],a={x:6.8,z:rear.center},b={x:9.2,z:rear.center};assert.equal(clearWallSegment(a,b,ctx),true);updateLayoutDoors(ctx,{rearDoorClosed:true});assert.equal(clearWallSegment(a,b,ctx),false);assert.ok(moveInRoom(a,2.4,0,.2,ctx).x<7.1);validRoute(a,b,.2,ctx);assert.equal(clearWallSegment({x:6.8,z:front.center},{x:9.2,z:front.center},ctx),true);
});

test('office, both classroom entrances and elevator form one continuous walkable school',()=>{
 const ctx=createLayoutContext(SEATS);for(const end of [TEACHER_SPAWN,OFFICE_CHAIR,...DOORS.map(d=>({x:6.8,z:d.center})),SEATS[9]])validRoute(LIFT,end,.23,ctx);assert.equal(blocked(OFFICE.minX-.3,12,.2,ctx),true);assert.equal(blocked(0,12,.2,ctx),false);assert.equal(blocked(0,-12,.2,ctx),true);assert.equal(blocked(LIFT.x,LIFT.z,.2,ctx),false);assert.equal(blocked(TEACHER_SPAWN.x,TEACHER_SPAWN.z,.6,ctx),false);
});

test('cached navigation preserves caller endpoints and cannot be corrupted by consuming a route',()=>{
 const ctx=createLayoutContext(SEATS),end={...SEATS[9]},expected=walkRoute(TEACHER_SPAWN,end,.23,ctx);assert.ok(expected.length>2);const consumed=walkRoute(TEACHER_SPAWN,end,.23,ctx);consumed[0].x=1000;consumed[1].z=-1000;consumed.at(-1).id=-1;consumed.splice(2,5);assert.deepEqual(walkRoute(TEACHER_SPAWN,end,.23,ctx),expected);assert.deepEqual(end,{...SEATS[9]});
});

test('different actor radii never reuse narrower doorway clearance',()=>{
 const ctx=createLayoutContext([]),a={x:6,z:4.8},b={x:9.2,z:4.8};for(const radius of[.2,.81,.23,.81,.2]){assert.equal(blocked(a.x,a.z,radius,ctx),false);assert.equal(blocked(b.x,b.z,radius,ctx),false);const path=walkRoute(a,b,radius,ctx);if(radius===.81)assert.deepEqual(path,[]);else assert.ok(path.length);}
});

test('small actors cannot route through a thin open door leaf',()=>{
 const ctx=createLayoutContext(SEATS);for(const leaf of DOOR_LEAVES){const x=(leaf.minX+leaf.maxX)/2;validRoute({x,z:leaf.minZ-.20},{x,z:leaf.maxZ+.20},.02,ctx);}
});

test('chalk geometry follows the enlarged partitions, open door headers, lectern and per-room closed doors',()=>{
 const ctx=createLayoutContext(SEATS),a={x:6.7,y:1.4,z:0},b={x:9.3,y:1.4,z:0};assert.equal(chalkHit(a,b,[],[],'classroom',ctx).kind,'wall');for(const door of DOORS){const student={id:1,x:9.1,z:door.center,seated:false};assert.equal(chalkHit({...a,z:door.center},{...b,z:door.center},[student],[],'classroom',ctx).kind,'student');assert.equal(chalkHit({...a,y:3.4,z:door.center},{...b,y:3.4,z:door.center},[],[],'classroom',ctx).kind,'wall');}updateLayoutDoors(ctx,{rearDoorClosed:true});assert.equal(chalkHit({...a,z:DOORS[0].center},{...b,z:DOORS[0].center},[],[],'classroom',ctx).kind,'wall');
});

test('eight distinct maps preserve corridor/office roofs and give the outdoor playground open sky',()=>{
 assert.deepEqual(CAMPUS_MAPS,['classroom','night','tiered','computer','hotpot','toilet','dorm','playground']);for(const map of CAMPUS_MAPS){const expected=map==='dorm'?DORM_BOUNDS.height:mapKind(map)==='tiered'?TIERED_CEILING_HEIGHT:CEILING_HEIGHT;for(const [x,z,height]of[[map==='dorm'?4.1:0,0,expected],[9.2,0,CEILING_HEIGHT],[6.5,12,CEILING_HEIGHT]]){const roof=ceilingVolumes(map).find(v=>x>=v.minX&&x<=v.maxX&&z>=v.minZ&&z<=v.maxZ&&v.minY===height);assert.equal(Boolean(roof),map!=='playground'||x!==0);if(roof)assert.ok(enclosureVolumes(map).includes(roof));}}
});

test('each floor variant supports a whole table and chair on the same local elevation',()=>{
 for(const map of ['classroom','night','tiered','computer','hotpot']){assert.equal(floorTiles(map).length>0,mapKind(map)==='tiered');for(const pattern of LAYOUT_PATTERNS)for(const seat of createSeatLayout(73,pattern,map)){const h=floorHeight(seat.x,seat.z,map);assert.equal(floorHeight(seat.deskX,seat.deskZ,map),h);if(mapKind(map)!=='tiered')assert.equal(h,0);}assert.equal(floorHeight(BOARD.x,BOARD.z,map),.16);}
 const carrier={x:BOARD.x,z:BOARD.z},actor={x:0,z:3,captivity:'carried'};assert.equal(actorFloorHeight(actor,'classroom',carrier),.16);actor.captivity='free';assert.equal(actorFloorHeight(actor,'classroom',carrier),0);
});

test('throws collide with each room layout and update when that room closes a door',()=>{
 const ctx=createLayoutContext(createSeatLayout(2)),d=DOORS[0];for(const closed of[false,true]){updateLayoutDoors(ctx,{rearDoorClosed:closed});const p=createSmokeProjectile({id:0,x:6.75,z:d.center,yaw:Math.PI/2,pitch:0},1,0,'classroom',ctx);for(let i=0;i<24;i++)stepSmokeProjectile(p,1/120,ctx);assert.ok(closed?p.x<7.2:p.x>7.4);}
 const seat=ctx.seats[0],p=createSmokeProjectile({id:0,x:seat.x,z:seat.z,yaw:seat.yaw,pitch:0,seated:true},2,0,'tiered',ctx);for(let i=0;i<240;i++){stepSmokeProjectile(p,1/120,ctx);assert.ok(p.y>=floorHeight(p.x,p.z,'tiered')+.07499);}assert.ok(p.bounces>0);
});

test('rendered walls, floors, eight-floor controls and interactive furniture agree with collision coordinates',async()=>{
 const T=await import('../dist/vendor/three.module.js'),{buildReferenceCampus}=await import('../dist/reference-campus.js'),scene=new T.Scene(),room=new T.Group();scene.add(room);const assets=new Set(),materials=new Set();
 const mat=(color,o={})=>{const m=new T.MeshStandardMaterial({color,...o});materials.add(m);return m;},mesh=(g,m,p,s=[1,1,1],r=null,parent=room)=>{const o=new T.Mesh(g,m);o.position.set(...p);o.scale.set(...s);if(r)o.rotation.set(...r);parent.add(o);return o;},box=(m,p,s,r=null,parent=room)=>mesh(new T.BoxGeometry(...s),m,p,[1,1,1],r,parent),rounded=(m,p,s,rad,r=null,parent=room)=>box(m,p,s,r,parent),cylinder=(m,p,s,r=null,parent=room)=>mesh(new T.CylinderGeometry(s[0],s[2],s[1],8),m,p,[1,1,1],r,parent),texture=()=>new T.Texture(),base=mat('#fff'),M=new Proxy({},{get:()=>base});
 const campus=buildReferenceCampus({scene,room,M,mat,mesh,box,rounded,cylinder,texture,assets,materials,floorMat:base});campus.enclosure.visible=true;campus.attachUpperArchitecture();scene.updateMatrixWorld(true);
 const hit=(p,d,filter=o=>!o.material.transparent)=>new T.Raycaster(new T.Vector3(...p),new T.Vector3(...d),0,3).intersectObject(scene,true).find(h=>h.object.material&&filter(h.object));
 for(const z of[-9.9,-8.1,-7.4,0,6,8.5])assert.ok(Math.abs(hit([10,3.25,z],[1,0,0]).point.x-CORRIDOR.maxX)<.12,`outer wall hole at ${z}`);
 assert.ok(Math.abs(hit([8,1.52,3.15],[-1,0,0]).point.x-7.40)<1e-5);assert.ok(hit([8,2,0],[-1,0,0],o=>o.material.transparent&&o.material.opacity>.50&&o.material.opacity<.75));
 const floor=hit([9.2,.8,0],[0,-1,0],o=>o.material===base);assert.ok(Math.abs(floor.point.y)<1e-6);assert.ok(Math.abs(floor.uv.x-floor.point.x/1.6)<1e-6);assert.ok(Math.abs(floor.uv.y-floor.point.z/1.6)<1e-6);
 const planarOverlap=(a,b)=>Math.min(a.max.x,b.max.x)-Math.max(a.min.x,b.min.x)>1e-6&&Math.min(a.max.z,b.max.z)-Math.max(a.min.z,b.min.z)>1e-6;
 for(const [objects,count] of [[scene.getObjectsByProperty('name','campus-continuous-floor'),5],[['classroom','corridor','office'].map(part=>scene.getObjectByName('campus-ceiling-'+part)),3]]){assert.equal(objects.length,count);assert.ok(objects.every(Boolean));const boxes=objects.map(o=>new T.Box3().setFromObject(o,true));for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.equal(planarOverlap(boxes[i],boxes[j]),false,'coplanar school slabs overlap and flicker at the room seam');}
 assert.equal(campus.liftPanel.children.filter(o=>o.userData.floorMap).length,8);const t=campus.getTargets();assert.equal(t.doors.length,4);assert.deepEqual([...new Set(t.doors.map(d=>d.id))].sort(),['front','office','rear']);assert.equal(t.officeDesks.length,OFFICE_DESKS.length);assert.equal(t.officeChairs.length,OFFICE_CHAIRS.length);assert.equal(t.lockers.length,1);for(const target of[...t.doors,...t.officeDesks,...t.officeChairs,...t.lockers])target.object.traverse(o=>{if(o.isMesh&&o.userData.campusTarget)assert.equal(o.userData.animated,true);});
 const liftRay=new T.Raycaster(new T.Vector3(9.30,1.6,CORRIDOR.minZ+.6),new T.Vector3(0,0,-1),0,1.4),closed={elevator:{doorClosed:true}},opened={elevator:{doorClosed:false}};
 assert.equal(campus.liftDoors.length,2);assert.equal(liftRay.intersectObjects(campus.liftDoors,true).length,0);
 campus.update(closed,.1);assert.ok(campus.liftDoors[0].userData.openAmount>0&&campus.liftDoors[0].userData.openAmount<1,'door begins sliding rather than snapping');
 for(let i=0;i<4;i++)campus.update(closed,.1);scene.updateMatrixWorld(true);assert.equal(campus.liftDoors[0].userData.openAmount,0);assert.ok(liftRay.intersectObjects(campus.liftDoors,true).length>0,'closed door fills the real doorway');
 for(let i=0;i<4;i++)campus.update(opened,.1);scene.updateMatrixWorld(true);assert.equal(campus.liftDoors[0].userData.openAmount,1);assert.equal(liftRay.intersectObjects(campus.liftDoors,true).length,0);
 for(const door of campus.liftDoors)door.traverse(o=>{if(o.isMesh)assert.equal(o.userData.animated,true,'sliding leaf cannot be baked into static geometry');});
 campus.setDoors({officeLocked:true,rearDoorClosed:true});assert.equal(campus.doors.get('rear').rotation.y,-Math.PI/2);campus.update({officeLocked:true,rearDoorClosed:true},.1);assert.ok(campus.doors.get('rear').rotation.y<0&&campus.doors.get('rear').rotation.y>-Math.PI/2);campus.update({officeLocked:true,rearDoorClosed:true},2);assert.equal(campus.doors.get('rear').rotation.y,0);campus.setOfficeDrawer(true);campus.update({officeDeskOpen:true},1);assert.ok(campus.officeDrawer.position.z<-.4);campus.setMap('tiered8');assert.equal(campus.tiered.visible,true);campus.setMap('computer7');assert.equal(campus.tiered.visible,false);
 scene.traverse(o=>o.geometry?.dispose());for(const m of materials)m.dispose();for(const a of assets)a.dispose?.();
});
