import test from 'node:test';
import assert from 'node:assert/strict';
import {TeacherRound} from '../dist/teacher-rules.js';
import {teacherProjectiles} from '../dist/teacher-effects129.js';
import {Group} from '../dist/vendor/three.module.js';
import {CampusRoom} from '../dist/room-simulation.js';
function lesson(variant){
 const r=new TeacherRound();r.start();r.teacher.variant=variant;
 Object.assign(r.player,{x:0,z:0,yaw:0,pitch:0});
 for(const s of r.students)s.visible=false;
 return r;
}
function target(r,id,x,z){
 const s=r.students[id];Object.assign(s,{x,z,visible:true,seated:false,captivity:'free'});return s;
}
function flight(r,seconds){for(let i=0;i<Math.round(seconds*60);i++)r._advanceChalk(1/60);}
test('horizontal wave releases after the swing and hits multiple students only within its sweep',()=>{
 const r=lesson('doubao'),a=target(r,1,-.7,1),b=target(r,2,.8,2.1),c=target(r,3,0,3.6);
 assert.ok(r.throwChalk());assert.equal(r.throwChalk(),false);flight(r,.4);assert.equal(a.captivity,'free');
 flight(r,.80);assert.equal(a.captivity,'stunned');assert.equal(b.captivity,'stunned');assert.equal(c.captivity,'free');
 assert.equal(r.chalks.length,1);flight(r,.8);assert.equal(r.chalks.length,0);assert.equal(r.drainEvents().filter(e=>e.type==='stunned').length,2);
});
test('vertical wave reaches further, stops at a wall and uses a 20 second cooldown',()=>{
 const r=lesson('doubao'),a=target(r,1,0,4),b=target(r,2,0,5.7);
 r.layout.walls=[{minX:-3,maxX:3,minZ:5,maxZ:5.2}];
 assert.ok(r.teacherSkill());flight(r,1.5);assert.equal(a.captivity,'stunned');assert.equal(b.captivity,'free');
 r._sessionElapsed=19.99;assert.equal(r.teacherSkill(),false);r._sessionElapsed=20;assert.ok(r.teacherSkill());
});
test('eraser is a separate ballistic projectile with a 15 second cooldown',()=>{
 const r=lesson('male');assert.ok(r.teacherSkill());const p=r.chalks[0];assert.equal(p.kind,'eraser');
 flight(r,.2);assert.ok(p.z>0);assert.ok(p.vy<1.3);r._sessionElapsed=14.99;assert.equal(r.teacherSkill(),false);r._sessionElapsed=15;assert.ok(r.teacherSkill());
});
test('room selects the locker preference and shares skill cooldown, projectile and attack with the other client',()=>{
 const room=new CampusRoom({code:'123456'}),a=room.join({}),b=room.join({});
 room.command(a,'setPreference',[{rolePreference:'teacher',teacherVariant:'doubao'}]);room.begin(a);
 for(let i=0;i<301;i++)room.tick(.1);
 assert.equal(a.role,'teacher');assert.ok(room.command(a,'teacherSkill'));assert.equal(room.command(a,'teacherSkill'),false);
 const state=room.snapshot(b);assert.equal(state.teacher.variant,'doubao');assert.equal(state.teacher.attackKind,'vertical');assert.equal(state.teacher.skillCooldown,20);assert.ok(state.chalks.some(c=>c.kind==='vertical'));
});

test('upright blade moves straight, fades on the near wall and cannot hit during the fade',()=>{
 const r=lesson('doubao'),parent=new Group(),draw=teacherProjectiles(parent);
 r.layout.walls=[{minX:-2,maxX:2,minZ:3,maxZ:3.025}];assert.ok(r.teacherSkill());
 flight(r,.9);draw(r.chalks);
 const wave=parent.children[0],blade=wave.children[0],level=wave.position.y+blade.position.y;
 const start=wave.position.z;flight(r,.15);draw(r.chalks);
 assert.ok(wave.position.z>start);assert.equal(wave.position.y+blade.position.y,level);
 assert.equal(blade.rotation.z,0);
 flight(r,.3);draw(r.chalks);const z=wave.position.z,opacity=blade.material.uniforms.strength.value;
 assert.ok(z>2.99&&z<=3);assert.ok(opacity>0&&opacity<.98);
 const late=target(r,1,0,z-.05);flight(r,.25);draw(r.chalks);
 assert.equal(wave.position.z,z);assert.equal(wave.position.y+blade.position.y,level);
 assert.equal(late.captivity,'free');assert.ok(blade.material.uniforms.strength.value<opacity);
 flight(r,.7);draw(r.chalks);assert.equal(wave.visible,false);
});
test('Doubao finishes the slower basic swing before another attack can start',()=>{
 const r=lesson('doubao');assert.ok(r.throwChalk());r._sessionElapsed=2.19;
 assert.equal(r.teacherSkill(),false);assert.equal(r.throwChalk(),false);
 r._sessionElapsed=2.20;assert.ok(r.throwChalk());
});
