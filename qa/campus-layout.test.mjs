import test from 'node:test';
import assert from 'node:assert/strict';
import {SEATS,DETENTION,DOORS,DOOR_LEAVES,TEACHER_EYE_HEIGHT,blocked,moveInRoom,walkRoute,clearWallSegment,floorHeight,actorFloorHeight} from '../dist/classroom-layout.js';
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

test('chalk first hits solid walls or door leaves; aimed shots pass through an open doorway',()=>{
  const a={x:5.3,y:1.4,z:0},b={x:7.5,y:1.4,z:0},student={id:0,x:7.3,z:0,seated:false};
  assert.equal(chalkHit(a,b,[student],[],'classroom').kind,'wall');
  for(const door of DOORS){const hit=chalkHit({...a,z:door.center},{...b,z:door.center},[{...student,z:door.center}],[],'classroom');assert.equal(hit.kind,'student');assert.equal(chalkHit({...a,y:3.3,z:door.center},{...b,y:3.3,z:door.center},[],[],'classroom').kind,'wall');}
  const leaf=DOOR_LEAVES[0],x=(leaf.minX+leaf.maxX)/2;
  assert.equal(chalkHit({x,y:1.4,z:leaf.minZ-.6},{x,y:1.4,z:leaf.maxZ+.6},[],[],'classroom').kind,'wall');
  assert.equal(chalkHit({x:-.8,y:.8,z:4.7},{x:-.8,y:.8,z:6.25},[],[],'classroom').kind,'desk');
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
