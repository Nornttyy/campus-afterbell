import {teacherViewHeight} from '../dist/camera-height58.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound,AI_WALK_SPEEDS} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {DETENTION,SEATS,walkRoute,blocked} from '../dist/classroom-layout.js';
function quiet(){const r=new ClassroomRound({target:100000,seed:44});r.start();r._thinkAt=r._plan.until=Infinity;r.teacher.x=r.teacher.z=30;for(const s of r.students)s._decisionAt=Infinity;return r;}
function bind(r,s,index=0){r.teacher.x=s.x;r.teacher.z=s.z+.9;r._stun(s);assert.ok(r._grab(s));r.teacher.x=DETENTION[index].x;r.teacher.z=DETENTION[index].z-1.1;assert.ok(r._bind(index));}
function near(r,s){r.player.seated=false;r.player.seatId=null;r.player.x=s.x;r.player.z=s.z-.9;r.player.yaw=0;r.player.pitch=.35;}
test('teammates need continuous nearby rescue input; walking away cancels; success restores gameplay',()=>{
 const r=quiet(),s=r.students[2];bind(r,s);near(r,s);assert.equal(r.rescueTarget().id,2);assert.ok(r.setRescue(2));r.step(1);assert.equal(s.caught,true);assert.ok(r.snapshot().rescue.progress>.49);r.setRescue(null);r.step(2);assert.equal(s.caught,true);
 r.setRescue(2);r.player.x+=3;r.step(.2);assert.equal(r.snapshot().rescue.id,null);assert.equal(s.caught,true);
 near(r,s);r.setRescue(2);r.pause();const before=r.snapshot();r.step(9);assert.deepEqual(r.snapshot(),before);r.pause(false);r.setRescue(2);r.step(2);assert.equal(s.captivity,'free');assert.equal(s.postId,null);assert.equal(r.snapshot().caughtCount,0);assert.ok(!r._memory.get(s.id)?.confirmed);
 const route=s._returnRoute;assert.ok(route?.length,'rescued pupil did not receive a route back to their seat');
 const returnDistance=route.reduce((sum,p,i)=>sum+Math.hypot(p.x-(i?route[i-1].x:s.x),p.z-(i?route[i-1].z:s.z)),0),dt=1/60;
 // Each waypoint may consume one final simulation tick; the budget follows
 // the actual route and ordinary speed rather than assuming a 20-second trip.
 const returnFrames=Math.ceil(returnDistance/AI_WALK_SPEEDS.student/dt)+route.length+1;
 for(let frame=0;frame<returnFrames&&!s.seated;frame++)r.step(dt);
 assert.equal(s.seated,true,'rescued pupil did not reach their seat within the physical route budget');assert.equal(s.seatId,s.id);assert.equal(r.drainEvents().filter(e=>e.type==='rescued').length,1);
});
test('a bound player cannot rescue themselves, move or use items; AI can free the player and they can move again',()=>{
 const r=quiet(),s=r.player;bind(r,s);assert.equal(r.setMovement(1,0),false);assert.equal(r.hold(true),true);assert.equal(r.snapshot().player.bubble.blowing,true);r.hold(false);assert.equal(r.interact(),false);assert.equal(r.setRescue(s.id),false);
 r.teacher.x=r.teacher.z=30;const helper=r.students[2];helper._decisionAt=0;
 for(let i=0;i<2400&&s.caught;i++)r.step(1/60);
 assert.equal(s.captivity,'free');assert.equal(r.setMovement(1,0),true);assert.equal(r.interact(),false);assert.equal(r.status,'playing');
});
test('a used post cannot take another pupil; rescue makes exactly that post reusable',()=>{
 const r=quiet(),a=r.students[2],b=r.students[6];bind(r,a);r.teacher.x=b.x;r.teacher.z=b.z+.9;r._stun(b);r._grab(b);r.teacher.x=DETENTION[0].x;r.teacher.z=DETENTION[0].z-1;assert.equal(r._bind(0),false);assert.equal(r.teacher.carriedId,b.id);r._release(a,r.player);assert.equal(r._bind(0),true);assert.equal(b.postId,0);
});
test('stun expires without a grab; a carried pupil does not teleport to a post and Q releases them',()=>{
 const r=new TeacherRound({target:100000,seed:44});r.start();for(const s of r.students)s._decisionAt=Infinity;const s=r.students[[...r._team][0]];
 r._stun(s);r.step(5.1);assert.equal(s.captivity,'free');
 r.player.x=s.x;r.player.z=s.z+1.2;r.setLook(Math.PI,Math.atan2(teacherViewHeight(r.player)-1.49,1.2));r._stun(s);assert.ok(r.grabStudent());r.step(.4);const z=s.z;r.setMovement(.4,0);r.step(1);assert.ok(Math.abs(s.z-z)<.1);assert.equal(s.caught,false);assert.ok(r.dropStudent());assert.equal(s.captivity,'free');assert.equal(r.teacher.carriedId,null);
});
test('routes between seats and posts stay clear of all desk collision volumes',()=>{
 for(const id of [0,2,9,16,27,29]){const route=walkRoute(SEATS[id],{x:DETENTION[0].x,z:DETENTION[0].z-1.1});assert.ok(route.length>0);assert.ok(route.every(p=>!blocked(p.x,p.z,.2)));assert.ok(Math.hypot(route.at(-1).x-DETENTION[0].x,route.at(-1).z-(DETENTION[0].z-1.1))<.1);}
});
