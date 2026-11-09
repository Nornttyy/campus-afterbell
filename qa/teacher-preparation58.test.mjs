import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {CampusRoom} from '../server/room-simulation.js';
import {NORMAL_WALK_SPEEDS,BACKWARD_SPEED_RATIO} from '../dist/movement55.js';
import {firstPersonEyeHeight} from '../dist/first-person-view.js';
import {TEACHER_VIEW_HEIGHT,STUDENT_VIEW_HEIGHT} from '../dist/camera-height58.js';
import {applyRoomLighting,ROOM_LIGHTING} from '../dist/room-lighting58.js';
import {TEACHER_SPAWN} from '../dist/classroom-layout.js';

for(const hz of [30,60,120])test(`office countdown at ${hz} Hz preserves stamina, view and free movement; chalk still animates`,()=>{
 const r=new TeacherRound();r.start({gathering:true});r.startBell();r.teacher.stamina=67;
 const before={...r.player};r.setLook(0,0);r.setMovement(0,1);
 assert.equal(r.setCrouch(true),false);assert.equal(r.throwChalk(),true);
 const initial={...r.chalks[0]};r.step(2/hz);assert.ok(r.chalks.length);assert.ok(r.chalks[0].z>initial.z);assert.equal(r.throwChalk(),false);
 for(let i=2;i<hz;i++)r.step(1/hz);
 assert.ok(Math.abs(r.player.z-before.z-NORMAL_WALK_SPEEDS.teacher)<1e-7);
 assert.equal(r.teacher.stamina,67);assert.equal(r.teacher._movementFatigue||0,0);assert.equal(r.stage,'seating');assert.equal(r.throwChalk(),true);
 r.setMovement(0,0);r.step(1);assert.ok(r.drainEvents().some(e=>e.type==='chalk-hit'),'practice chalk must collide with office geometry');
 r.pause();const frozen=r.chalks.map(c=>({...c}));r.step(3);assert.deepEqual(r.chalks,frozen);assert.equal(r.throwChalk(),false);r.pause(false);
 r._beginClass();assert.equal(r.chalks.length,0);assert.equal(r.teacher._movementFatigue,0);Object.assign(r.player,{...TEACHER_SPAWN});Object.assign(r.teacher,TEACHER_SPAWN);r.setLook(0,0);r.setMovement(0,1);r.step(1);assert.equal(r.teacher.stamina,62);
});

test('multiplayer teacher can walk and practise chalk in the office without per-tick teleport or stamina drain',()=>{
 const room=new CampusRoom({code:'PREP58',seed:73}),teacher=room.join({name:'老师',rolePreference:'teacher'}),student=room.join({name:'学生'});room.begin(teacher);
 const before={...teacher.context.player};room.command(teacher,'setLook',[0,0]);room.command(teacher,'setMovement',[0,1]);
 assert.equal(room.command(teacher,'setCrouch',[true]),false);assert.equal(room.command(teacher,'throwChalk',[]),true);
 for(let i=0;i<60;i++){teacher.lastInput=Date.now();room.tick(1/60);}
 const s=room.snapshot(teacher);assert.ok(Math.abs(s.player.z-before.z-2.2)<1e-7);assert.equal(s.player.yaw,0);assert.equal(s.teacher.stamina,100);assert.equal(s.stage,'seating');assert.equal(s.player.crouched,false);assert.equal(s.teacher.officeLocked,true);assert.equal(room.snapshot(student).stage,'seating');
});

for(const backward of [false,true])test(`carrying a pupil keeps normal ${backward?'backward':'forward'} teacher speed`,()=>{
 const run=carry=>{const r=new TeacherRound();r.start();for(const s of r.students)s._decisionAt=Infinity;Object.assign(r.player,{x:9.7,z:0,seated:false,yaw:0});if(carry){r.teacher.carriedId=0;Object.assign(r.students[0],{captivity:'carried',_grabAt:0,_grabStart:{x:9.7,z:0}});}r.setMovement(0,backward?-1:1);r.step(.4);return r;};
 const free=run(false),held=run(true);assert.ok(Math.abs(free.player.z-held.player.z)<1e-8);assert.ok(Math.abs(Math.abs(held.player.z)-NORMAL_WALK_SPEEDS.teacher*(backward?BACKWARD_SPEED_RATIO:1)*.4)<1e-8);assert.equal(held.students[0].captivity,'carried');
});

test('teacher standing camera is 65 percent above student and ignores invalid crawl state',()=>{
 assert.equal(TEACHER_VIEW_HEIGHT,STUDENT_VIEW_HEIGHT*1.65);
 assert.equal(firstPersonEyeHeight({seated:false,crouched:true},'teacher'),TEACHER_VIEW_HEIGHT);
 assert.equal(firstPersonEyeHeight({seated:false},'student'),STUDENT_VIEW_HEIGHT);
});

test('bright daytime profile returns after switching maps; the existing blackout night profile is unchanged',()=>{
 assert.deepEqual(ROOM_LIGHTING.night,{ambient:.30,sun:.035,fill:.055,teaching:.055,lamp:.015,sky:'#7890c5',ground:'#9ca5b5',sunColor:'#7084ac',ceiling:'#3c4b67',background:'#0a1428',fog:'#15223a'});
 const refs={ambient:new T.HemisphereLight(),sun:new T.DirectionalLight(),fill:new T.DirectionalLight(),teachingFill:new T.DirectionalLight(),lampMat:new T.MeshStandardMaterial(),ceilingMaterial:new T.MeshStandardMaterial(),scene:{background:new T.Color(),fog:{color:new T.Color()}}};
 for(const night of [false,true,false]){applyRoomLighting(night,refs);const p=ROOM_LIGHTING[night?'night':'day'];assert.equal(refs.ambient.intensity,p.ambient);assert.equal(refs.fill.intensity,p.fill);assert.equal('#'+refs.scene.background.getHexString(),p.background);}
});
