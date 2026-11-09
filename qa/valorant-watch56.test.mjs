import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoloRound} from '../dist/solo-round.js';
import {CampusRoom} from '../server/room-simulation.js';
import {NetworkRound} from '../dist/network-client.js';

function tick(round,seconds){for(let left=seconds;left>1e-8;){const dt=Math.min(1/60,left);left-=dt;round.step(dt);}}
function solo(){const round=createSoloRound({map:'computer',target:120,seed:73});round.start();round._advanceTeacher=()=>{};round._perceive=()=>{};round.teacher.x=round.teacher.z=50;for(const actor of round.students)actor._decisionAt=Infinity;assert.equal(round.startComputer(),true);assert.equal(round.computerApp('valorant'),true);return round;}
function watch(round,seconds,{media=10,playing=true,visible=true,frozen=false}={}){
 round.setComputerPlayback({playing,visible,mediaTime:media});
 for(let elapsed=0;elapsed<seconds-1e-8;){const dt=Math.min(.25,seconds-elapsed);tick(round,dt);elapsed+=dt;round.setComputerPlayback({playing,visible,mediaTime:media+(frozen?0:elapsed)});}
 tick(round,1/60);
}
function network(){const room=new CampusRoom({code:'560001',map:'computer',seed:73}),teacher=room.join({name:'老师',rolePreference:'teacher'}),pupil=room.join({name:'学生'});room.begin(teacher);for(let i=0;i<301;i++)room.tick(.1);const actor=pupil.context.player,seat=room.sim.seats.find(s=>!room.sim.students.some(a=>a!==actor&&a.seated&&a.seatId===s.id));assert.ok(seat);Object.assign(actor,{x:seat.x,z:seat.z,seated:true,seatId:seat.id,captivity:'free',caught:false,_drawnSlot:null});room.command(pupil,'startComputer');room.command(pupil,'computerApp',['valorant']);return{room,teacher,pupil,actor};}

test('solo real advancing playback gives one point per three seconds, with no passive app-open score',()=>{
 const r=solo();tick(r,10);assert.equal(r.score,0);watch(r,3);assert.equal(r.score,1);assert.equal(r.player._earnedPoints,1);watch(r,6,{media:13});assert.equal(r.score,3);assert.equal(r.snapshot().player.computer.valorant.elapsed<.05,true);const events=r.drainEvents().filter(e=>e.type==='valorant-watch');assert.equal(events.length,3);assert.ok(events.every(e=>e.points===1&&e.studentId===r.player.id));
});
test('buffered, paused, invisible and repeated video frames never accumulate watched time',()=>{
 for(const mode of[{playing:false},{visible:false},{frozen:true}]){const r=solo();watch(r,2);const partial=r.player._computerProgress;watch(r,6,{media:12,...mode});assert.equal(r.score,0);assert.equal(r.player._computerProgress,partial);watch(r,1.25,{media:18});assert.equal(r.score,1);}
 const r=solo();watch(r,2);r.pause();watch(r,6,{media:12});assert.equal(r.score,0);r.pause(false);watch(r,1.25,{media:18});assert.equal(r.score,1);
});
test('returning to desktop, switching app, leaving the chair or getting stunned discards unfinished watch time',()=>{
 for(const leave of[r=>r.computerBack(),r=>r.computerApp('photoshop'),r=>r.stopComputer(),r=>r._stun(r.player)]){const r=solo();watch(r,2);assert.ok(r.player._computerProgress>1.9);leave(r);assert.equal(r.player._computerProgress,0);tick(r,5);assert.equal(r.score,0);}
 const r=solo();watch(r,2);r.computerBack();r.computerApp('valorant');watch(r,1.25,{media:12});assert.equal(r.score,0);watch(r,1.75,{media:13.25});assert.equal(r.score,1);
});
test('stale heartbeats, seeks and command bursts cannot create offline time or faster-than-clock points',()=>{
 const r=solo();r.setComputerPlayback({playing:true,visible:true,mediaTime:0});tick(r,.25);r.setComputerPlayback({playing:true,visible:true,mediaTime:.25});tick(r,20);assert.equal(r.score,0);assert.ok(r.player._computerProgress<=.25);
 for(let n=0;n<1000;n++)r.setComputerPlayback({playing:true,visible:true,mediaTime:n*3});tick(r,.1);assert.equal(r.score,0);
 watch(r,6,{media:900,frozen:true});assert.equal(r.score,0);
 const before=r.player._computerProgress;r.setComputerPlayback({playing:true,visible:true,mediaTime:2});tick(r,.1);assert.equal(r.player._computerProgress,before,'loop/seek resets the media baseline without awarding its jump');
});
test('network authority awards shared points only for the reporting player and hides score identity from teacher',()=>{
 const {room,teacher,pupil,actor}=network();let media=4;room.command(pupil,'setComputerPlayback',[{playing:true,visible:true,mediaTime:media}]);
 for(let i=0;i<12;i++){for(let t=0;t<15;t++)room.tick(1/60);media+=.25;room.command(pupil,'setComputerPlayback',[{playing:true,visible:true,mediaTime:media}]);}room.tick(1/60);
 assert.equal(room.sim.score,1);assert.equal(actor._earnedPoints,1);assert.equal(room.snapshot(pupil).score,1);const teacherState=room.snapshot(teacher);assert.equal(teacherState.score,1);assert.ok(!teacherState.events.some(e=>e.type==='valorant-watch'));
 room.command(pupil,'setComputerPlayback',[{playing:false,visible:false,mediaTime:media}]);for(let i=0;i<60;i++)room.tick(.1);assert.equal(room.sim.score,1);
 room.command(pupil,'computerBack');assert.equal(actor._computerProgress,0);assert.equal(room.command(pupil,'setComputerPlayback',[{playing:true,visible:true,mediaTime:media+10}]),false);for(let i=0;i<40;i++)room.tick(.1);assert.equal(room.sim.score,1);
});
test('network validates reports and disconnect clears the playback lease',()=>{
 const {room,pupil,actor}=network();for(const value of[null,{},true,{playing:1,visible:true,mediaTime:1},{playing:true,visible:true,mediaTime:Infinity},{playing:true,visible:true,mediaTime:-1}])assert.throws(()=>room.command(pupil,'setComputerPlayback',[value]),/无效播放状态/);
 room.command(pupil,'setComputerPlayback',[{playing:true,visible:true,mediaTime:1}]);room.tick(.1);room.command(pupil,'setComputerPlayback',[{playing:true,visible:true,mediaTime:1.1}]);room.disconnect(pupil);assert.equal(actor._videoPlayback,null);for(let i=0;i<60;i++)room.tick(.1);assert.equal(room.sim.score,0);
});
test('adapter coalesces playback heartbeats and sends pause stop instead of leaving a true latch',()=>{
 const round=Object.create(NetworkRound.prototype);Object.assign(round,{_closed:false,_connected:true,_queued:[],_last:{},_state:{role:'student'},snapshot:()=>({})});
 for(let i=0;i<30;i++)round.setComputerPlayback({playing:true,visible:true,mediaTime:i*.01});assert.equal(round._queued.length,1);assert.equal(round._queued[0].args[0].mediaTime,.29);round.pause(true);const report=round._queued.find(e=>e.name==='setComputerPlayback');assert.equal(report.args[0].playing,false);assert.equal(report.args[0].visible,false);
});
