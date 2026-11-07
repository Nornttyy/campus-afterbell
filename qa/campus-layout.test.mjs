import test from 'node:test';
import assert from 'node:assert/strict';
import {SEATS,DETENTION,DOORS,DOOR_LEAVES,CORRIDOR,TEACHER_EYE_HEIGHT,CEILING_HEIGHT,TIERED_CEILING_HEIGHT,ceilingVolumes,blocked,moveInRoom,walkRoute,clearWallSegment,floorHeight,actorFloorHeight} from '../dist/classroom-layout.js';
import {ClassroomRound,canSee} from '../dist/classroom-rules.js';
import {TeacherRound,chalkHit} from '../dist/teacher-rules.js';
import {createSmokeProjectile,stepSmokeProjectile} from '../dist/smoke-physics.js';

test('classroom partition and opened leaves are solid, while both door apertures remain walkable',()=>{
  const stopped=moveInRoom({x:5.3,z:0},2,0,.23);assert.ok(stopped.x<=5.57+1e-8);
  for(const d of DOORS){const crossed=moveInRoom({x:5.3,z:d.center},2,0,.23);assert.ok(crossed.x>7.2);assert.ok(clearWallSegment({x:5.3,z:d.center},{x:7.4,z:d.center}));}
  for(const leaf of DOOR_LEAVES){const x=(leaf.minX+leaf.maxX)/2,stopped=moveInRoom({x,z:leaf.minZ-.6},0,1.2,.2);assert.ok(stopped.z<=leaf.minZ-.2+1e-8);}
  assert.equal(canSee({x:5.3,z:0,yaw:Math.PI/2},{x:6.5,z:0},[]),false);
});

test('every seat can reach every detention post and return without cutting across desk or doorway corners',()=>{
  for(const radius of [.20,.23])for(const seat of SEATS)for(const post of DETENTION){
    const end={x:post.x,z:post.z-1.1},route=walkRoute(seat,end,radius);
    assert.ok(route.length,`No route for seat ${seat.id} to post ${post.id}, radius ${radius}`);
    assert.ok(Math.hypot(route.at(-1).x-end.x,route.at(-1).z-end.z)<.01);
    for(let i=0;i<route.length;i++){
      const a=i?route[i-1]:seat,b=route[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.025));
      for(let n=0;n<=steps;n++)assert.equal(blocked(a.x+(b.x-a.x)*n/steps,a.z+(b.z-a.z)*n/steps,radius),false);
    }
    const reverse=walkRoute(end,seat,radius);assert.ok(reverse.length);assert.deepEqual(reverse.at(-1),{...seat});
  }
});

test('reused routes preserve exact destinations and cannot be corrupted by a caller moving waypoints',()=>{
  const start={x:6.7,z:9.6},end={...SEATS[9]},expected=walkRoute(start,end,.23);
  assert.ok(expected.length>2);assert.deepEqual(expected.at(-1),end);
  const consumed=walkRoute(start,end,.23);consumed[0].x=1000;consumed[1].z=-1000;consumed.at(-1).id=-1;consumed.splice(2,5);
  assert.deepEqual(walkRoute(start,end,.23),expected);
  assert.deepEqual(end,{...SEATS[9]});
});

test('cached navigation never gives a wide actor the narrower actor clearance',()=>{
  const start={x:4.9,z:4.96},end={x:7.64,z:4.96};
  assert.equal(blocked(start.x,start.z,.6),false);assert.equal(blocked(end.x,end.z,.6),false);
  for(const radius of [.2,.6,.23,.6,.2]){
    const route=walkRoute(start,end,radius);
    if(radius===.6)assert.deepEqual(route,[],'both open doors are too narrow for this radius');
    else {assert.ok(route.length);assert.deepEqual(route.at(-1),end);}
  }
});

test('small actors route around thin open door leaves, never through the edge between grid points',()=>{
  const radius=.02;
  for(const leaf of DOOR_LEAVES){
    const x=(leaf.minX+leaf.maxX)/2,start={x,z:leaf.minZ-.20},end={x,z:leaf.maxZ+.20},route=walkRoute(start,end,radius);
    assert.ok(route.length);
    let from=start;
    for(const to of route){
      const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.01));
      for(let i=0;i<=steps;i++)assert.equal(blocked(from.x+(to.x-from.x)*i/steps,from.z+(to.z-from.z)*i/steps,radius),false);
      from=to;
    }
    assert.deepEqual(route.at(-1),end);
  }
});

test('chalk first hits solid walls or door leaves; aimed shots pass through an open doorway',()=>{
  const a={x:5.3,y:1.4,z:0},b={x:7.5,y:1.4,z:0},student={id:0,x:7.3,z:0,seated:false};
  assert.equal(chalkHit(a,b,[student],[],'classroom').kind,'wall');
  for(const door of DOORS){const hit=chalkHit({...a,z:door.center},{...b,z:door.center},[{...student,z:door.center}],[],'classroom');assert.equal(hit.kind,'student');assert.equal(chalkHit({...a,y:3.3,z:door.center},{...b,y:3.3,z:door.center},[],[],'classroom').kind,'wall');}
  const leaf=DOOR_LEAVES[0],x=(leaf.minX+leaf.maxX)/2;
  assert.equal(chalkHit({x,y:1.4,z:leaf.minZ-.6},{x,y:1.4,z:leaf.maxZ+.6},[],[],'classroom').kind,'wall');
  assert.equal(chalkHit({x:-.8,y:.8,z:4.7},{x:-.8,y:.8,z:6.25},[],[],'classroom').kind,'desk');
});

test('chalk hits the visible map ceiling and cannot escape over the raised classroom walls',()=>{
  for(const map of ['classroom','night','computer','tiered']){
    for(const [x,z,height] of [[0,0,map==='tiered'?TIERED_CEILING_HEIGHT:CEILING_HEIGHT],[7.15,0,CEILING_HEIGHT],[5.5,9.5,CEILING_HEIGHT]]){
      const a={x,y:4,z},b={x,y:6,z},hit=chalkHit(a,b,[],[],map);
      assert.equal(hit?.kind,'wall');assert.ok(Math.abs(a.y+(b.y-a.y)*hit.t-height)<1e-9);
      assert.ok(ceilingVolumes(map).some(v=>x>=v.minX&&x<=v.maxX&&z>=v.minZ&&z<=v.maxZ&&v.minY===height));
    }
  }
  assert.equal(chalkHit({x:0,y:4.4,z:0},{x:0,y:4.9,z:0},[],[],'tiered'),null,'the old low ceiling must be absent');
  for(const [a,b] of [[{x:-5.5,z:0},{x:-6.3,z:0}],[{x:5.5,z:0},{x:6.3,z:0}],[{x:0,z:-6.2},{x:0,z:-7}],[{x:0,z:6.2},{x:0,z:7}]]){
    assert.equal(chalkHit({...a,y:4.85},{...b,y:4.85},[],[],'tiered')?.kind,'wall');
  }
});

test('a near-wall smoke throw releases on the player side, bounces, and can pass through open doors',()=>{
  for(const [x,yaw,side] of [[5.45,Math.PI/2,-1],[6.35,-Math.PI/2,1]]){
    const p=createSmokeProjectile({id:0,x,z:0,yaw,pitch:0,seated:false},1,1);
    assert.ok(side<0?p.x<=5.725:p.x>=6.075);
    for(let i=0;i<24;i++){stepSmokeProjectile(p,1/120);assert.ok(side<0?p.x<5.80:p.x>6.00);}
    assert.ok(p.bounces>0);
  }
  for(const door of DOORS){const p=createSmokeProjectile({id:0,x:5.35,z:door.center,yaw:Math.PI/2,pitch:0,seated:false},1,0);for(let i=0;i<24;i++)stepSmokeProjectile(p,1/120);assert.ok(p.x>6.0);}
});

test('teacher aiming, chalk and smoke start at the same raised platform height as the actor',()=>{
  const r=new TeacherRound();r.start();Object.assign(r.player,{x:1.25,z:5.55,yaw:Math.PI,pitch:0});
  assert.equal(floorHeight(r.player.x,r.player.z),.16);assert.ok(r.throwChalk());assert.equal(r.chalks[0].y,TEACHER_EYE_HEIGHT+.16);
  const a=createSmokeProjectile({id:0,x:1.25,z:4,yaw:Math.PI,pitch:0},0),b=createSmokeProjectile({...r.player},1);
  assert.ok(Math.abs((b.y-a.y)-.16)<1e-9);
  assert.equal(floorHeight(4,5.55),0);assert.equal(floorHeight(1.25,4.4),0);
  const pupil={id:0,x:1.25,z:5.55,seated:false};
  assert.equal(chalkHit({x:.5,y:1.94,z:5.55},{x:2,y:1.94,z:5.55},[pupil],[],'classroom').kind,'student');
});

test('grabs, binding and AI rescue cannot reach through the classroom partition',()=>{
  const r=new ClassroomRound({target:100000});r.start();r._thinkAt=r._plan.until=Infinity;for(const s of r.students)s._decisionAt=Infinity;
  const s=r.students[2];Object.assign(s,{x:5.45,z:0,seated:false});Object.assign(r.teacher,{x:6.35,z:0});r._stun(s);assert.equal(r._grab(s),false);
  Object.assign(r.teacher,{x:5.3,z:0});assert.ok(r._grab(s));Object.assign(r.teacher,{x:6.3,z:DETENTION[5].z});assert.equal(r._bind(5),false);
  Object.assign(r.teacher,{x:DETENTION[5].x,z:DETENTION[5].z-1.1});assert.ok(r._bind(5));r.teacher.x=r.teacher.z=30;s._boundAt=-10;
  const helper=r.students[6];Object.assign(helper,{x:6.35,z:s.z+.35,seated:false,seatId:null,_decisionAt:0});r._advanceRescuer(helper,.2);
  assert.equal(s.captivity,'bound');assert.equal(helper._helpProgress,0);assert.ok(helper._rescueRoute.length);
  for(let i=0;i<60*20&&s.caught;i++)r._advanceRescuer(helper,1/60);
  assert.equal(s.captivity,'free');
});

test('the carried pupil turns toward the teacher without an instant half-turn',()=>{
  const r=new ClassroomRound();r.start();const s=r.students[2];Object.assign(r.teacher,{x:s.x,z:s.z+.9,yaw:0});r._stun(s);assert.ok(r._grab(s));
  const initial=s.yaw;r.elapsed+=1/60;r._advanceCaptivity(1/60);assert.ok(Math.abs(s.yaw-initial)<1);
  for(let i=0;i<60;i++){r.elapsed+=1/60;r._advanceCaptivity(1/60);}
  assert.ok(Math.abs(Math.cos(s.yaw-r.teacher.yaw)+1)<.001);
  assert.ok(Math.abs(s.x-(r.teacher.x-.42))<1e-6);assert.ok(Math.abs(s.z-(r.teacher.z+.60))<1e-6);
});

test('office, both classroom doors and blue lift form one walkable route, while outside the L footprint stays solid',()=>{
  const points=[{x:5.5,z:9.5},{x:7.15,z:6},{x:7.15,z:4.96},{x:4.8,z:4.96},{x:1.58,z:4.15},{x:1.58,z:-5.35},{x:5.48,z:-5.14},{x:7.3,z:-5.14},{x:7.15,z:-8.05}];
  let current=points[0];for(const end of points.slice(1)){const route=walkRoute(current,end,.2);assert.ok(route.length,JSON.stringify({current,end}));for(const target of route){for(let tries=0;Math.hypot(current.x-target.x,current.z-target.z)>.04&&tries<100;tries++){const dx=target.x-current.x,dz=target.z-current.z,d=Math.hypot(dx,dz),step=Math.min(.025,d);current=moveInRoom(current,dx/d*step,dz/d*step,.2);assert.equal(blocked(current.x,current.z,.2),false);}assert.ok(Math.hypot(current.x-target.x,current.z-target.z)<.045);}assert.ok(Math.hypot(current.x-end.x,current.z-end.z)<.045);}
  assert.equal(blocked(0,9),true);assert.equal(blocked(0,-8),true);
  assert.equal(clearWallSegment({x:0,z:5.8},{x:3,z:8}),false);
  assert.equal(clearWallSegment({x:7.15,z:6},{x:7.15,z:8}),true);
  const teacher=new TeacherRound();assert.ok(teacher.player.z>6.6);assert.equal(blocked(teacher.player.x,teacher.player.z),false);
});

test('tiered floors hold every desk and seat on the same terrace, with small stair risers and flat thresholds',async()=>{
  const {floorTiles}=await import('../dist/classroom-layout.js');
  assert.equal(floorHeight(SEATS[0].x,SEATS[0].z,'tiered'),.96);assert.equal(floorHeight(SEATS[24].x,SEATS[24].z,'tiered'),0);
  for(const seat of SEATS){const h=floorHeight(seat.x,seat.z,'tiered');for(const x of [seat.x-.50,seat.x+.50])for(const z of [seat.deskZ-.29,seat.deskZ+.29])assert.equal(floorHeight(x,z,'tiered'),h);}
  for(const tile of floorTiles()){const x=(tile.minX+tile.maxX)/2,z=(tile.minZ+tile.maxZ)/2;assert.equal(floorHeight(x,z,'tiered'),tile.height);}
  let previous=floorHeight(1.58,3,'tiered');for(let z=3;z>=-5.4;z-=.02){const h=floorHeight(1.58,z,'tiered');assert.ok(Math.abs(h-previous)<=.120001);previous=h;}
  for(const door of DOORS){assert.equal(floorHeight(5.79,door.center,'tiered'),0);assert.equal(floorHeight(6.1,door.center,'tiered'),0);}
});

test('raised desks, pupils and thrown items share tiered geometry instead of the old flat floor',()=>{
  const seat=SEATS[0],h=floorHeight(seat.x,seat.z,'tiered'),actor={id:0,x:seat.x,z:seat.z,yaw:0,pitch:0,seated:true};
  const flat=createSmokeProjectile(actor,0,0,'classroom'),raised=createSmokeProjectile(actor,1,0,'tiered');assert.ok(Math.abs(raised.y-flat.y-h)<1e-9);
  const pupil={id:0,x:seat.x,z:seat.z,seated:true};assert.equal(chalkHit({x:seat.x-1,y:h+1.3,z:seat.z},{x:seat.x+1,y:h+1.3,z:seat.z},[pupil],[],'tiered')?.kind,'student');
  assert.equal(chalkHit({x:seat.x,y:h+.84,z:seat.deskZ-1},{x:seat.x,y:h+.84,z:seat.deskZ+1},[],[],'tiered')?.kind,'desk');
  for(let i=0;i<300;i++){stepSmokeProjectile(raised,1/120);assert.ok(raised.y>=floorHeight(raised.x,raised.z,'tiered')+.07499);}assert.ok(raised.bounces>0);
});

test('a carried pupil and first-person eye use the carrier terrace, then return to their own floor on release',()=>{
  const carrier={x:1.58,z:1.5},pupil={x:1.16,z:2.1,captivity:'carried'};
  assert.equal(floorHeight(pupil.x,pupil.z,'tiered'),0);
  assert.equal(actorFloorHeight(pupil,'tiered',carrier),.24);
  pupil.captivity='free';assert.equal(actorFloorHeight(pupil,'tiered',carrier),0);
  for(const seat of SEATS){const h=floorHeight(seat.x,seat.z,'tiered');assert.equal(actorFloorHeight({...seat,seated:true},'tiered'),h);assert.equal(actorFloorHeight({...seat,seated:false},'tiered'),h);}
  pupil.captivity='bound';assert.equal(actorFloorHeight(pupil,'tiered',carrier),0);
});

test('teacher starts in the clear office aisle facing through the exit, with space to move',()=>{
  const p=new TeacherRound().player;
  assert.equal(blocked(p.x,p.z,.60),false);
  const travel=4,forward={x:p.x+Math.sin(p.yaw)*travel,z:p.z+Math.cos(p.yaw)*travel};
  assert.ok(forward.z<6.4,'forward view reaches the corridor');
  assert.equal(clearWallSegment(p,forward),true);
  const end=moveInRoom(p,forward.x-p.x,forward.z-p.z,.23);
  assert.ok(Math.hypot(end.x-forward.x,end.z-forward.z)<1e-8,'straight movement through the exit is unobstructed');
  assert.equal(chalkHit({x:p.x,y:TEACHER_EYE_HEIGHT,z:p.z},{x:forward.x,y:TEACHER_EYE_HEIGHT,z:forward.z},[],[],'classroom'),null);
});

test('widened corridor is usable, with solid returns beside unchanged office and lift doors',()=>{
 assert.ok(Math.abs(CORRIDOR.maxX-CORRIDOR.minX-3.15)<1e-9);
 for(const z of [-5,-3,0,2,3.5])assert.equal(blocked(8.8,z,.23),false);
 assert.ok(moveInRoom({x:8,z:0},2,0,.23).x<9,'outer wall must stop the player');
 for(const z of [-6.3,6.2]){
  const towardEnd=z<0?-1:1,a={x:8.8,z},b={x:8.8,z:z+towardEnd*.8};
  assert.equal(clearWallSegment(a,b),false,'widening cannot open a gap beside an end room');
  assert.equal(chalkHit({...a,y:1.5},{...b,y:1.5},[],[],'classroom')?.kind,'wall');
 }
 assert.ok(walkRoute({x:8.8,z:-4.5},{x:7.15,z:8},.23).length);
 assert.ok(walkRoute({x:8.8,z:0},{x:7.15,z:-8},.23).length);
 assert.equal(blocked(8.8,4.5,.23),true,'end cabinet has a matching collision solid');
 assert.equal(blocked(7.8,2.5,.23),false,'old floating cabinet collision must be removed');
 assert.ok(ceilingVolumes().some(v=>v.minX<8.8&&v.maxX>8.8&&v.minY===CEILING_HEIGHT));
});

test('rendered corridor walls, bell pier, lift header and widened floor agree with collision',async()=>{
 const T=await import('../dist/vendor/three.module.js'),{buildReferenceCampus}=await import('../dist/reference-campus.js');
 const scene=new T.Scene(),room=new T.Group();scene.add(room);const assets=new Set(),materials=new Set();
 const mat=(color,options={})=>{const m=new T.MeshStandardMaterial({color,...options});materials.add(m);return m;};
 const mesh=(geometry,material,position,scale=[1,1,1],rotation=null,parent=room)=>{const o=new T.Mesh(geometry,material);o.position.set(...position);o.scale.set(...scale);if(rotation)o.rotation.set(...rotation);o.castShadow=true;parent.add(o);return o;};
 const box=(m,p,s,r=null,parent=room)=>mesh(new T.BoxGeometry(...s),m,p,[1,1,1],r,parent);
 const rounded=(m,p,s,_radius,r=null,parent=room)=>box(m,p,s,r,parent);
 const cylinder=(m,p,s,r=null,parent=room)=>mesh(new T.CylinderGeometry(s[0],s[2],s[1],8),m,p,[1,1,1],r,parent);
 const texture=()=>new T.Texture(),base=mat('#ffffff'),M=new Proxy({},{get:()=>base});
 const campus=buildReferenceCampus({scene,room,mat,mesh,box,rounded,cylinder,texture,M,assets,materials,floorMat:base});campus.enclosure.visible=true;campus.attachUpperArchitecture();scene.updateMatrixWorld(true);
 const hit=(p,d,filter=()=>true)=>new T.Raycaster(new T.Vector3(...p),new T.Vector3(...d),0,2).intersectObject(scene,true).find(h=>h.object.material&&filter(h.object));
 const opaque=o=>!o.material.transparent;
 assert.ok(Math.abs(hit([8.8,2,0],[1,0,0],opaque).point.x-CORRIDOR.maxX)<1e-5,'long wall is missing or in old narrow position');
 assert.ok(Math.abs(hit([6.4,1.52,2.60],[-1,0,0],opaque).point.x-6.0)<1e-5,'bell has no masonry behind it');
 const glazing=hit([6.3,2,0],[-1,0,0],o=>o.material.transparent&&o.material.opacity>.5);assert.ok(glazing&&glazing.distance<.5,'classroom partition must have frosted lower glazing');
 assert.ok(Math.abs(hit([7.18,4,-5.8],[0,0,-1],opaque).point.z+6.49)<1e-5,'lift fascia leaves a sky hole');
 assert.ok(Math.abs(hit([8.8,4,0],[0,1,0],opaque).point.y-CEILING_HEIGHT)<1e-5,'wide corridor ceiling does not reach the wall');
 const floor=hit([8.8,.8,0],[0,-1,0],o=>o.material===base);assert.ok(floor&&Math.abs(floor.point.y+.01)<1e-6);
 assert.ok(Math.abs(floor.uv.x-floor.point.x/1.6)<1e-6&&Math.abs(floor.uv.y-floor.point.z/1.6)<1e-6,'new floor uses a different texture scale');
 scene.traverse(o=>o.geometry?.dispose());for(const m of materials)m.dispose();for(const a of assets)a.dispose?.();
});
