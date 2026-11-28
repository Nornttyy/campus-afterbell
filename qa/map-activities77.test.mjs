import test from 'node:test';import assert from 'node:assert/strict';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {interactionIntent} from '../dist/interaction-intent54.js';
import {PLAYGROUND_LAYOUT} from '../dist/playground-layout70.js';
import {toiletBowl} from '../dist/map-activities77.js';
import {actorFloorHeight,blocked} from '../dist/classroom-layout.js';
import {CampusRoom} from '../server/room-simulation.js';
function quiet(map){const r=new ClassroomRound({map,target:10000});r.start();r._advanceTeacher=()=>{};r._perceive=()=>{};r._hear=()=>{};for(const a of r.students)if(a!==r.player){a.isTeammate=false;a._profile=null;a._slots=[];}return r;}
function dirtyToilet(r){const p=r.player,id=p.seatId;Object.assign(p._slots[0],{action:'snack',progress:0,readyAt:0});r.setDrawerOpen(true);r.takeSlot(0);r.setLook(p.yaw,1.20);r.hold(true);r.step(3.1);const trash=[...r.groundItems.values()].find(t=>t.action==='foodWaste');assert.ok(trash);assert.ok(r.takeGroundItem(trash.id));assert.equal(r.snapshot().selected,'foodWaste');assert.ok(!r.toiletClogs[id]);const roll=r._drawerRoll;r._drawerRoll=()=>.04;assert.equal(r.dropIntoToilet(id),true);r._drawerRoll=roll;assert.equal(r.toiletClogs[id],true);r.toggleToiletDoor(id);r.step(1);assert.equal(r.interact(),'stood');const b=toiletBowl(id);Object.assign(p,{x:b.x,z:b.z+1.0});return id;}
test('toilet has complete snack -> scraps -> release food -> plunge -> clear flow; cancellation resets and adds no score',()=>{const r=quiet('toilet'),id=dirtyToilet(r),score=r.score;assert.equal(r.startMapActivity('plunge',id),true);r.step(1.1);assert.ok(r.snapshot().player.mapActivity.progress>.3);r.releaseMapActivity();assert.equal(r.toiletClogs[id],true);assert.equal(r.startMapActivity('plunge',id),true);assert.equal(r.player.mapActivity.progress,0);r.step(2-1/60);assert.equal(r.toiletClogs[id],true);r.step(1/60);assert.equal(r.toiletClogs[id],false);assert.equal(r.player.mapActivity,null);assert.equal(r.score,score);assert.equal(r.startMapActivity('plunge',id),false);});
test('plunger is unavailable through closed doors, while carrying, in other maps or while another actor occupies the bowl',()=>{const r=quiet('toilet'),id=dirtyToilet(r),a=r.students.find(a=>a!==r.player);r.toiletDoors[id]=0;assert.equal(r.startMapActivity('plunge',id),false);r.toiletDoors[id]=1;Object.assign(a,{seated:true,seatId:id});assert.equal(r.startMapActivity('plunge',id),false);a.seated=false;r.player._drawnSlot=0;assert.equal(r.startMapActivity('plunge',id),false);assert.equal(quiet('classroom').startMapActivity('plunge',id),false);});
test('pause cancels a held plunger; resumed play cannot silently finish it',()=>{const r=quiet('toilet'),id=dirtyToilet(r);r.startMapActivity('plunge',id);r.step(1);r.pause(true);assert.equal(r.player.mapActivity,null);r.pause(false);r.step(4);assert.equal(r.toiletClogs[id],true);});
test('removed bars cannot be used locally or through room commands',()=>{
 const r=quiet('playground');
 assert.equal(PLAYGROUND_LAYOUT.bars.length,0);
 assert.equal(r.startMapActivity('hang','playground-bar-2'),false);
 const room=new CampusRoom({map:'playground',seed:91}),host=room.join({name:'A'});
 assert.equal(room.command(host,'startMapActivity',['hang','playground-bar-2'],1),false);
});
test('round completion clears plunger locks',()=>{
 const r=quiet('toilet'),id=dirtyToilet(r);assert.ok(r.startMapActivity('plunge',id));
 r._finish('won','mischief');assert.equal(r.player.mapActivity,null);assert.equal(actorFloorHeight(r.player,r.map),0);
});
test('authoritative toilet state is shared, rejects a second user and cancels stale input',()=>{const room=new CampusRoom({map:'toilet',seed:91}),a=room.join({name:'A'}),b=room.join({name:'B'}),r=room.sim,id=9,t=toiletBowl(id);r.toiletClogs[id]=true;r.toiletDoors[id]=1;r._toiletDoorTargets[id]=true;r._advanceFurniture(0);for(const member of [a,b])Object.assign(member.context.player,{x:t.x,z:t.z+1,seated:false,_drawnSlot:null});b.context.player.x+=.6;assert.equal(room.command(a,'startMapActivity',['plunge',id]),true);assert.equal(room.command(b,'startMapActivity',['plunge',id]),false);for(let i=0;i<15;i++){room.command(a,'setMovement',[0,0]);room.tick(.1);}assert.equal(room.snapshot(b).toiletClogs[id],true);assert.ok(room.snapshot(b).students.find(s=>s.id===a.studentId).mapActivity.progress>.7);a.lastInput=Date.now()-1500;room.tick(.1);assert.equal(a.context.player.mapActivity,null);assert.equal(r.toiletClogs[id],true);assert.equal(room.command(a,'startMapActivity',['plunge',id]),true);for(let i=0;i<31;i++){room.command(a,'setMovement',[0,0]);room.tick(.1);}assert.equal(room.snapshot(b).toiletClogs[id],false);assert.equal(a.context.player.mapActivity,null);});
