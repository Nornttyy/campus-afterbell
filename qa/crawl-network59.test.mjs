import test from 'node:test';
import assert from 'node:assert/strict';
import {CampusRoom} from '../server/room-simulation.js';

test('authoritative crawl state reaches both teacher and student peer snapshots and clears on standing',()=>{
 for(const map of ['classroom','tiered','computer']){
  const room=new CampusRoom({code:'595959',seed:73,map}),teacher=room.join({rolePreference:'teacher'}),student=room.join({name:'爬行同学'}),peer=room.join({name:'观察同学'});room.begin(teacher);
  for(let i=0;i<301;i++)room.tick(.1);
  Object.assign(student.context.player,{x:9.1,z:0,seated:false,seatId:null,captivity:'free',caught:false});
  assert.equal(room.command(student,'setCrouch',[true]),true);
  room.tick(1/60);
  for(const observer of [teacher,peer]){
   const snapshot=room.snapshot(observer),remote=snapshot.students.find(s=>s.id===student.studentId);
   assert.equal(remote.crouched,true,`${map}: remote crawl flag was stripped`);assert.equal(remote.seated,false);assert.equal(remote.captivity,'free');
  }
  assert.equal(room.command(teacher,'setCrouch',[true]),false,'teacher must not enter a student-only pose');
  assert.equal(room.command(student,'setCrouch',[false]),true);room.tick(1/60);
  for(const observer of [teacher,peer])assert.equal(room.snapshot(observer).students.find(s=>s.id===student.studentId).crouched,false);
 }
});
