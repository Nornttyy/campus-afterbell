import test from 'node:test';
import assert from 'node:assert/strict';
import {gameplayFov,fatigueTarget,smoothFatigue} from '../dist/view-tuning55.js';
import {movementScale,spendTeacherMovement} from '../dist/movement55.js';
import {audibleCue,relativeSoundBearing} from '../dist/sound-cue55.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {BOARD} from '../dist/classroom-layout.js';

test('teacher view is modestly narrower on landscape and portrait screens',()=>{for(const aspect of[.56,1,1.78,2.3])assert.equal(gameplayFov('student',aspect)-gameplayFov('teacher',aspect),6);});
test('fatigue fades in and out continuously, frame-rate independently, leaving 15+ sharp',()=>{
 assert.equal(fatigueTarget(15),0);assert.equal(fatigueTarget(100),0);assert.equal(fatigueTarget(0),1);assert.ok(fatigueTarget(14)<.02);
 const values=[];for(const hz of[30,60,120]){let v=0;for(let i=0;i<hz;i++){const next=smoothFatigue(v,0,1/hz);assert.ok(next>=v&&next-v<.12);v=next;}values.push(v);for(let i=0;i<hz*3;i++)v=smoothFatigue(v,20,1/hz);assert.ok(v<.001);}
 assert.ok(Math.max(...values)-Math.min(...values)<1e-9);assert.equal(smoothFatigue(.5,0,0),.5);
});
test('only public eating, drinking, pop or burp produce teacher direction cues',()=>{
 for(const type of['food-complete','drink-complete','gum-pop','burp'])assert.ok(audibleCue({type,x:1,z:2}));
 for(const type of['use-crunch','use-gulp','gum-inflate','chalk-hit'])assert.equal(audibleCue({type,x:1,z:2}),false);
 assert.equal(audibleCue({type:'food-complete',x:1,z:2,audience:'self'}),false);assert.equal(audibleCue({type:'food-complete',x:1,z:2,recipientId:3}),false);
 assert.equal(relativeSoundBearing({x:0,z:1},{x:0,z:0,yaw:0}),0);assert.equal(relativeSoundBearing({x:1,z:0},{x:0,z:0,yaw:0}),Math.PI/2);
 assert.ok(audibleCue({type:'food-complete',x:13.9,z:0},{x:0,z:0}));
 for(const x of[14,100])assert.equal(audibleCue({type:'food-complete',x,z:0},{x:0,z:0}),false,'inaudible distant events must not reveal direction');
});
test('backwards and diagonal backwards use sixty percent speed, forward/sideways stay unchanged',()=>{
 for(const yaw of[0,Math.PI/2,Math.PI*7]){const actor={yaw},x=Math.sin(yaw),z=Math.cos(yaw);assert.equal(movementScale(actor,{x,z}),1);assert.equal(movementScale(actor,{x:-x,z:-z}),.6);assert.equal(movementScale(actor,{x:z,z:-x}),1);}
});
test('teacher actual movement costs 5 points/sec forward and 5/3 backwards without idle drain',()=>{
 for(const hz of[30,60,120])for(const backward of[false,true]){const t={x:0,z:0,yaw:0,stamina:100};for(let i=0;i<hz*3;i++){const before={x:t.x,z:t.z};t.z+=(backward?-.6:1)/hz;spendTeacherMovement(t,before,1/hz);}assert.equal(t.stamina,backward?95:85);for(let i=0;i<hz;i++)spendTeacherMovement(t,{x:t.x,z:t.z},1/hz);assert.equal(t.stamina,backward?95:85);}
});
test('throwing chalk with any positive stamina is free; zero prevents it; resting no longer drains',()=>{
 const r=new TeacherRound({seed:44});r.start();for(const s of r.students)s._decisionAt=Infinity;
 r.teacher.stamina=.5;assert.ok(r.throwChalk());assert.equal(r.teacher.stamina,.5);r.step(1);assert.equal(r.teacher.stamina,.5);assert.ok(r.throwChalk());assert.equal(r.teacher.stamina,.5);r.step(1);r.teacher.stamina=0;assert.equal(r.throwChalk(),false);assert.ok(r.drainEvents().some(e=>e.type==='stamina-low'));
});

test('exhausted AI returns to the board and resumes its known suspect after recovering',()=>{
 const r=new ClassroomRound({seed:55,target:120});r.start();r._perceive=()=>{};
 for(const s of r.students)s._decisionAt=Infinity;
 Object.assign(r.teacher,{x:BOARD.x+.6,z:BOARD.z-.2,stamina:0,phase:'watching'});
 const m=r._remember(r.player);Object.assign(m,{confirmed:true,evidence:100});r._setPlan('catch',m.id,m,1000);
 r._think();assert.equal(r._plan.intent,'write');
 let atBoard=false,peak=0,resumed=false;
 for(let i=0;i<1200;i++){r.step(1/60);atBoard ||= r.teacher.phase==='board';peak=Math.max(peak,r.teacher.stamina);resumed ||= peak>=100&&r._plan.intent==='catch';}
 assert.ok(atBoard);assert.ok(peak>=100);assert.ok(resumed);assert.equal(m.confirmed,true);
});
