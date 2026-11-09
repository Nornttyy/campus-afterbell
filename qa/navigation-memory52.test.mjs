import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {createSeatLayout,createLayoutContext,walkRoute,blocked,DOORS} from '../dist/classroom-layout.js';

test('seat-to-grid routing avoids the short diagonal crossing at the real desktop corner',()=>{
  const seats=createSeatLayout(73,'single'),context=createLayoutContext(seats),start=seats[7],end={x:6.8,z:DOORS[0].center},radius=.23;
  // The former .06m connector sampling missed this real expanded desktop
  // corner. Both endpoints are free; the tiny interval between them is solid.
  assert.equal(blocked(start.x,start.z,radius,context),false);
  assert.equal(blocked(-2.65,-5.09,radius,context),false);
  assert.equal(blocked(-2.728260869565217,-5.102173913043478,radius,context),true);
  const route=walkRoute(start,end,radius,context);assert.ok(route.length);assert.deepEqual(route.at(-1),end);
  let previous=start;
  for(const next of route){
    const count=Math.max(1,Math.ceil(Math.hypot(next.x-previous.x,next.z-previous.z)/.005));
    for(let i=0;i<=count;i++)assert.equal(blocked(previous.x+(next.x-previous.x)*i/count,previous.z+(next.z-previous.z)*i/count,radius,context),false,'a returned route crosses a desktop corner between waypoints');
    previous=next;
  }
});

test('a banana peel releases the escorted pupil and clears pursuit while the teacher planner is stunned',()=>{
  const round=new ClassroomRound({seed:73,target:100000});round.start();
  for(const student of round.students){student._decisionAt=Infinity;student.holding=false;}
  const pupil=round.students[6],teacher=round.teacher;
  Object.assign(teacher,{x:9.4,z:0,yaw:0,warning:false});
  Object.assign(pupil,{x:9.4,z:.8,seated:false,seatId:null});
  round._perceive(0);assert.ok(round.snapshot().teacher.observedIds.includes(pupil.id),'fixture must establish an actual visible memory');
  round._setPlan('catch',pupil.id,pupil,1000);assert.ok(round._plan.route.length);
  assert.equal(round._stun(pupil),true);assert.equal(round._grab(pupil),true);
  round._advanceEscort(0);assert.ok(round._escortRoute.length);assert.equal(teacher.carriedId,pupil.id);
  round.peels.push({id:123,x:teacher.x,z:teacher.z,armed:true,age:0,lifetime:10});
  round.step(1/60);
  const snapshot=round.snapshot();
  assert.equal(snapshot.teacher.captivity,'stunned');assert.ok(snapshot.teacher.stunLeft>3);
  assert.equal(pupil.captivity,'free');assert.equal(snapshot.teacher.carriedId,null);
  assert.equal(snapshot.teacher.observedIds.includes(pupil.id),false);
  assert.equal(snapshot.teacher.targetId,null,'snapshot must not expose a target after its memory was removed');
  assert.equal(round._plan.targetId,null);assert.deepEqual(round._plan.route,[]);
  assert.equal(round._escortRoute,null);assert.equal(round._escortPost,null);assert.equal(round._cast,null);
  round.step(.25);assert.equal(round.snapshot().teacher.targetId,null,'stun early-return must not retain the released target');
  assert.equal(round.chalks.length,0);
  const events=round.drainEvents();assert.ok(events.some(e=>e.type==='peel-slip'&&e.actorId===-1));assert.ok(events.some(e=>e.type==='rescued'&&e.studentId===pupil.id));
});
