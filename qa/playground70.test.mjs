import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createPlaygroundLayout,PLAYGROUND_LAYOUT,playgroundWalkable,playgroundFloorHeight} from '../dist/playground-layout70.js';
import {createPlaygroundRoom,playgroundTrackRing} from '../dist/playground-room70.js';

test('outdoor footprint joins the existing right corridor without a wall across its entrance',()=>{
 const p=PLAYGROUND_LAYOUT,b=p.bounds,e=p.entrance;
 for(const [actual,expected]of [[b.minX,-32.8],[b.maxX,7.2],[b.minZ,-59.2],[b.maxZ,8.8]])assert.ok(Math.abs(actual-expected)<1e-9);
 for(let x=e.x-.4;x<=p.connector.maxX+.15;x+=.05){assert.ok(playgroundWalkable(x,e.z,.18,p));assert.equal(p.colliders.filter(c=>!c.walkable).some(c=>x>=c.minX&&x<=c.maxX&&e.z>=c.minZ&&e.z<=c.maxZ),false,'door opening is blocked');}
 for(const side of[[b.minX-.2,0],[b.maxX+.4,0],[0,b.minZ-.2],[0,b.maxZ+.2]])assert.equal(playgroundWalkable(...side),false);
});
test('larger dimensions rebuild geometry and retain the fixed right corridor anchor',()=>{
 const p=createPlaygroundLayout({width:42,length:74});assert.equal(p.bounds.maxX,PLAYGROUND_LAYOUT.bounds.maxX);assert.equal(p.bounds.width,42);assert.equal(p.bounds.length,74);assert.equal(p.entrance.x,7.2);assert.ok(p.track.outerRadius>PLAYGROUND_LAYOUT.track.outerRadius);assert.ok(p.track.straightHalf>PLAYGROUND_LAYOUT.track.straightHalf);
});
test('three separate walkable steps and eight binding posts are grounded in the inner field',()=>{
 const p=PLAYGROUND_LAYOUT;assert.equal(p.steps.length,3);assert.equal(p.posts.length,8);
 for(let i=0;i<3;i++){const s=p.steps[i];assert.equal(playgroundFloorHeight(s.x,s.z+s.depth/2-.01,p),s.top);assert.equal(s.top-s.bottom,.18*(i+1)-.18*i);}
 for(const post of p.posts){assert.equal(playgroundFloorHeight(post.x,post.z,p),post.y);assert.ok(post.x>p.bounds.minX&&post.x<p.bounds.maxX);}
 assert.equal(playgroundFloorHeight(p.track.cx,p.track.cz,p),p.steps.at(-1).top);
 assert.equal(playgroundFloorHeight(p.track.cx,p.track.cz+p.steps[0].depth,p),0);
});
test('track is a real stadium-shaped ring with no degenerate seam or inverted top faces',()=>{
 const t=PLAYGROUND_LAYOUT.track,g=playgroundTrackRing(t,t.outerRadius,t.innerRadius),p=g.attributes.position,i=g.index,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3();
 for(let n=0;n<i.count;n+=3){a.fromBufferAttribute(p,i.getX(n));b.fromBufferAttribute(p,i.getX(n+1));c.fromBufferAttribute(p,i.getX(n+2));normal.crossVectors(b.sub(a),c.sub(a));assert.ok(normal.y>1e-6,'track seam must remain nondegenerate and face up');}
 g.computeBoundingBox();assert.ok(Math.abs(g.boundingBox.max.x-(t.cx+t.outerRadius))<1e-5);assert.ok(Math.abs(g.boundingBox.max.z-(t.cz+t.straightHalf+t.outerRadius))<1e-5);g.dispose();
});
test('rendered props match collision sizes; board and portal remain usable without desks or food rules',()=>{
 const scene=new T.Scene(),r=createPlaygroundRoom({parent:scene});try{
  assert.equal(r.group.parent,scene);assert.equal(r.group.userData.independentOutdoor,true);assert.equal(r.colliders,r.layout.colliders);assert.equal(r.boardTarget.userData.interaction,'board');assert.equal(r.diagnostics().seats,0);assert.equal(r.diagnostics().foodRulesDefined,false);assert.ok(r.diagnostics().meshes<45,'static scene should remain batched');assert.ok(r.diagnostics().triangles<70000);
  for(const collider of r.colliders){assert.ok(collider.minX<collider.maxX&&collider.minY<collider.maxY&&collider.minZ<collider.maxZ);}
  const ray=new T.Raycaster(new T.Vector3(r.entrance.x-.3,1.2,r.entrance.z),new T.Vector3(1,0,0),0,.6);r.group.updateMatrixWorld(true);assert.equal(ray.intersectObject(r.group,true).filter(h=>h.object.name!=='playground-outdoor-sky').length,0,'rendered doorway frame crosses the walking opening');
  const stage=r.layout.steps[2];const down=new T.Raycaster(new T.Vector3(stage.x+.15,2,stage.z-.55),new T.Vector3(0,-1,0),0,3);const hit=down.intersectObject(r.group,true).find(h=>h.object.name!=='playground-outdoor-sky');assert.ok(hit&&Math.abs(hit.point.y-stage.top)<1e-5,'rendered top matches the walkable step height');
  let disposal=0;r.group.traverse(o=>{if(o.isMesh)o.geometry.addEventListener('dispose',()=>disposal++);});r.update(2);assert.equal(r.group.userData.lastUpdate,2);r.dispose();r.dispose();assert.equal(r.group.parent,null);assert.ok(disposal>0);
 }finally{r.dispose();}
});

test('the physical UNLOCK button moves inward and the separately pickable food settles on the ground',()=>{
 const r=createPlaygroundRoom({includeBackground:false,includeSky:false});
 try{
  const [id,entry]=r.vendingTargets.entries().next().value;
  const {button,front,ground,pickup,yaw}=entry,normal=new T.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const start=new T.Vector3(front.x,front.y,front.z);r.group.updateMatrixWorld(true);
  const ray=new T.Raycaster(start.clone().addScaledVector(normal,.45),normal.clone().negate());
  assert.equal(ray.intersectObject(button)[0]?.object,button);assert.equal(pickup.visible,false);
  const stock={[id]:{action:'snack',pressedAt:4,droppedAt:4}};
  r.update(4,stock);const startY=pickup.position.y;
  r.update(4.125,stock);assert.ok(button.position.clone().sub(start).dot(normal)<-.012);assert.ok(pickup.position.y<startY);
  r.update(4.5,stock);r.group.updateMatrixWorld(true);
  assert.ok(button.position.distanceTo(start)<.0001);
  assert.ok(Math.abs(new T.Box3().setFromObject(pickup,true).min.y-ground.y)<.001);
  assert.ok(Math.hypot(pickup.position.x-ground.x,pickup.position.z-ground.z)<.001);
  const prop=pickup.children[0];r.update(5,{[id]:{...stock[id],action:null}});assert.equal(pickup.visible,false);
  r.update(6,stock);assert.equal(pickup.children[0],prop);
 }finally{r.dispose();}
});

test('students can crawl through the entire open span but not through its posts',async()=>{
 const {createLayoutContext,moveInRoom}=await import('../dist/classroom-layout.js');
 const layout=createLayoutContext([],{map:'playground'}),n=PLAYGROUND_LAYOUT.notices[0];
 const cross=(z,crouched)=>moveInRoom({x:n.x-.5,z,crouched},1,0,.18,layout).x;
 assert.ok(n.width>3.5&&PLAYGROUND_LAYOUT.speaker.poleHeight>5);
 const panel=PLAYGROUND_LAYOUT.colliders.find(c=>c.id===n.id);
 assert.ok(Math.abs(panel.minY-(n.centerY-(n.height+.12)/2))<1e-8);
 assert.ok(Math.abs(panel.minY-.94)<1e-7);
 assert.ok(cross(n.z,false)<n.x);
 assert.ok(cross(n.z,true)>n.x+.48);
 assert.ok(cross(n.z+n.width/2-.08,true)<n.x);
});

test('the midfield stage supports two evenly spaced rows and the teacher can write in front of it',async()=>{
 const {TeacherRound}=await import('../dist/teacher-rules.js');
 const r=new TeacherRound({map:'playground'});r.start();
 const {track,steps,posts,board}=PLAYGROUND_LAYOUT;
 for(const s of steps){assert.equal(s.x,track.cx);assert.equal(s.z,track.cz);}
 assert.equal(posts.length,8);
 for(const row of [posts.slice(0,4),posts.slice(4)]){
  const spacing=row[1].x-row[0].x;
  for(const [i,p] of row.entries()){
   assert.equal(p.z,row[0].z);assert.equal(p.y,steps.at(-1).top);
   assert.ok(Math.abs(p.x-row[0].x-i*spacing)<1e-8);
  }
 }
 assert.ok(posts[4].z-posts[0].z>2);
 assert.ok(steps[0].width>9&&steps[0].depth>5);
 assert.equal(board.x,track.cx);
 assert.ok(board.z>track.cz+steps[0].depth/2&&board.z-track.cz<5);
 Object.assign(r.player,board.writePosition,{seated:false,pitch:0});
 assert.equal(r.setWriting(true),true);
 r.step(.25);assert.ok(r.teacher.writeProgress>0);
});

test('field poles scale with the room roster, keep stable in class, and match render and collision',async()=>{
 const {CampusRoom}=await import('../dist/room-simulation.js');
 const {createSoloRound}=await import('../dist/solo-round.js');
 const room=new CampusRoom({map:'playground'}),members=[];
 const view=createPlaygroundRoom({includeBackground:false,includeSky:false});
 try{
  for(let count=1;count<=8;count++){
   members.push(room.join({name:'p'+count,rolePreference:count===1?'teacher':'student'}));
   const posts=room.snapshot(members[0]).posts;
   assert.equal(posts.length,count);
   const rows=new Map();
   for(const p of posts){rows.set(p.z,(rows.get(p.z)||0)+1);}
   assert.deepEqual([...rows.values()],count===1?[1]:[Math.ceil(count/2),Math.floor(count/2)]);
   const actual=room.sim.layout.walkSolids.filter(v=>v.kind==='post');
   assert.equal(actual.length,count);
   view.update(0,{},posts);
   const poles=view.group.getObjectByName('playground-capture-posts'),matrix=new T.Matrix4();
   assert.equal(poles.count,count);
   for(const [i,p] of posts.entries()){
    poles.getMatrixAt(i,matrix);assert.ok(Math.abs(matrix.elements[12]-p.x)<1e-5&&Math.abs(matrix.elements[14]-p.z)<1e-5);
    assert.ok(actual.some(v=>p.x>=v.minX&&p.x<=v.maxX&&p.z>=v.minZ&&p.z<=v.maxZ));
   }
  }
  room.disconnect(members[7]);assert.equal(room.sim.posts.length,7);
  room.reconnect(members[7]);assert.equal(room.sim.posts.length,8);
  room.begin(members[0]);room.leave(members[7]);assert.equal(room.sim.posts.length,8);
  const solo=createSoloRound({map:'playground'}),teacher=createSoloRound({map:'playground',role:'teacher'});
  assert.equal(solo.snapshot().posts.length,1);assert.equal(teacher.snapshot().posts.length,teacher._team.size);
 }finally{view.dispose();}
});
