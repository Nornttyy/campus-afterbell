import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound,chalkHit} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {CRAWL_TUNING} from '../dist/crawl-profile.js';
import {BOARD,floorHeight} from '../dist/classroom-layout.js';
import {effectEye,createThrowableProjectile,stepThrowableProjectile} from '../dist/projectile-effects-rules.js';

test('crawling is a free standing posture in both roles and pause clears it',()=>{
 for(const Round of [ClassroomRound,TeacherRound]){
  const r=new Round();r.start({gathering:true});Object.assign(r.player,{x:7,z:0,seated:false,yaw:0});
  assert.equal(r.setCrouch(true),true);r.setMovement(0,1);r.step(.5);
  assert.ok(Math.abs(r.player.z-CRAWL_TUNING.speed*.5)<1e-8);assert.equal(r.snapshot().player.crouched,true);
  r.pause();assert.equal(r.player.crouched,false);assert.equal(r.setCrouch(true),false);assert.equal(r.setCrouch(false),true);r.pause(false);
  r.player.seated=true;assert.equal(r.setCrouch(true),false);r.player.seated=false;
  for(const captivity of ['stunned','carried','bound']){r.player.captivity=captivity;assert.equal(r.setCrouch(true),false);assert.equal(r.setCrouch(false),true);}
 }
});

test('crawling uses floor-level projectile exposure and hit heights, including tiered floors',()=>{
 for(const map of ['classroom','tiered'])for(const id of [8,-1]){
  const actor={id,x:1.42,z:0,yaw:0,pitch:0,seated:false,crouched:true},floor=floorHeight(actor.x,actor.z,map);
  assert.equal(effectEye(actor,map).y,floor+CRAWL_TUNING.eyeHeight);
  const p=createThrowableProjectile(actor,1,'smoke',0,map);
  assert.ok(p.y>floor+.075&&p.y<floor+CRAWL_TUNING.eyeHeight,'throw did not leave the palm below the crawling eye');
 }
 const target={id:99,x:1.42,z:.5,seated:false,crouched:true};
 for(const height of [.40,.95]){
  const a={x:1.42,y:height,z:0},b={x:1.42,y:height,z:1};
  assert.equal(chalkHit(a,b,[target],[],'classroom')?.kind??null,height<CRAWL_TUNING.bodyMaxY?'student':null);
  const p=Object.assign(createThrowableProjectile({id:0,x:1.42,z:0},1,'ink'),{...a,vx:0,vy:0,vz:20});
  assert.equal(stepThrowableProjectile(p,.05,[target]).effect?.hitActorId??null,height<CRAWL_TUNING.bodyMaxY?99:null);
 }
});

test('crawling teachers throw chalk from the low view and stand to carry or write',()=>{
 const r=new TeacherRound();r.start();Object.assign(r.player,{x:7,z:0,yaw:0,pitch:0});assert.equal(r.setCrouch(true),true);
 assert.equal(r.throwChalk(),true);assert.equal(r.chalks[0].y,CRAWL_TUNING.eyeHeight);
 Object.assign(r.player,{x:BOARD.x,z:BOARD.z});assert.equal(r.canWriteBoard(),false);r.setCrouch(false);assert.equal(r.canWriteBoard(),true);
 r.teacher.carriedId=2;assert.equal(r.setCrouch(true),false);
});
