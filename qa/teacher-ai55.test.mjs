import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound,AI_WALK_SPEEDS} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {BOARD,DETENTION} from '../dist/classroom-layout.js';
import {CampusRoom} from '../server/room-simulation.js';
const dt=1/60;

test('exhausted AI reaches, chalks, grabs and binds a far confirmed pupil rather than cycling back to the board',()=>{
 for(const seed of[1,55]){
  const r=new ClassroomRound({seed,target:100000});r.start();r._perceive=()=>{};for(const s of r.students)s._decisionAt=Infinity;
  Object.assign(r.teacher,{...BOARD,stamina:0,phase:'watching'});const pupil=r.students.reduce((a,b)=>Math.hypot(a.x-BOARD.x,a.z-BOARD.z)>Math.hypot(b.x-BOARD.x,b.z-BOARD.z)?a:b);
  const memory=r._remember(pupil);Object.assign(memory,{confirmed:true,evidence:100});r._setPlan('catch',memory.id,memory,1000);let recoveries=0,previous='',events=[],maxPursuit=0;
  for(let i=0;i<90/dt&&!pupil.caught;i++){
   const before={x:r.teacher.x,z:r.teacher.z};r.step(dt);if(r.teacher.intent==='write'&&previous!=='write')recoveries++;previous=r.teacher.intent;
   if(r.teacher.intent==='catch')maxPursuit=Math.max(maxPursuit,Math.hypot(r.teacher.x-before.x,r.teacher.z-before.z)/dt);events.push(...r.drainEvents());
  }
  assert.equal(pupil.captivity,'bound',`seed ${seed} remained ${pupil.captivity}`);assert.equal(recoveries,1);assert.ok(maxPursuit>1.5&&maxPursuit<=AI_WALK_SPEEDS.teacherPursuit+.001);
  assert.equal(events.filter(e=>e.type==='grabbed'&&e.studentId===pupil.id).length,1);assert.equal(events.filter(e=>e.type==='bound'&&e.studentId===pupil.id).length,1);assert.ok(events.some(e=>e.type==='chalk'&&e.studentId===pupil.id));
 }
});

test('AI and human teachers share one binding reward or penalty, based on identity rather than current action',()=>{
 for(const Round of[ClassroomRound,TeacherRound])for(const correct of[true,false])for(const stamina of[10,95]){
  const r=new Round({seed:73,target:1000});r.start();const p=r.students.find(s=>r._team.has(s.id)===correct);p.action=null;p.holding=false;
  Object.assign(r.teacher,{x:p.x,z:p.z-.9});assert.equal(r._stun(p),true);assert.equal(r._grab(p),true);Object.assign(r.teacher,{x:DETENTION[0].x,z:DETENTION[0].z-1.1,stamina});
  r.drainEvents();assert.equal(r._bind(0),true);assert.equal(r.teacher.stamina,correct?Math.min(100,stamina+20):Math.max(0,stamina-40));const events=r.drainEvents();assert.equal(events.filter(e=>e.type===(correct?'correct-capture':'wrong-grab')).length,1);assert.equal(r._bind(0),false);assert.equal(r.drainEvents().length,0);r.reset();assert.equal(r.wrongGrabs,0);
 }
});

test('network idle human identity is a correct capture while an ordinary AI pupil is a wrong capture',()=>{
 const r=new CampusRoom({code:'552222',seed:73}),host=r.join({rolePreference:'teacher'}),peer=r.join({name:'静静坐着'});r.begin(host);for(let i=0;i<301;i++)r.tick(.1);
 for(const [p,correct,postId]of[[peer.context.player,true,0],[r.sim.students.find(p=>!p.networkHuman),false,1]]){
  p.action=null;p.holding=false;Object.assign(r.sim.teacher,{x:p.x,z:p.z-.9});assert.ok(r.sim._stun(p));assert.ok(r.sim._grab(p));Object.assign(r.sim.teacher,{x:DETENTION[postId].x,z:DETENTION[postId].z-1.1,stamina:50});assert.ok(r.sim._bind(postId));assert.equal(r.sim.teacher.stamina,correct?70:10);
 }
});

test('a stunned teacher never emits low-stamina guidance, while a free teacher at zero does',()=>{
 const r=new TeacherRound();r.start();for(const p of r.students)p._decisionAt=Infinity;r._stunAny(r.teacher,4,'bananaPeel');
 for(const stamina of[100,0]){r.teacher.stamina=stamina;r.drainEvents();assert.equal(r.throwChalk(),false);assert.equal(r.drainEvents().some(e=>e.type==='stamina-low'),false);assert.equal(r.chalks.length,0);}
 r.step(4);r.teacher.stamina=0;r.drainEvents();assert.equal(r.throwChalk(),false);assert.deepEqual(r.drainEvents().map(e=>e.type),['stamina-low']);r.teacher.stamina=.1;assert.equal(r.throwChalk(),true);assert.equal(r.teacher.stamina,.1);
});
