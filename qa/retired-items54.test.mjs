import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound,CLASSROOM_ACTIONS} from '../dist/classroom-rules.js';
import {CampusRoom} from '../server/room-simulation.js';

function quiet(){const r=new ClassroomRound({target:1000});r.start();r._advanceTeacher=()=>{};r._perceive=()=>{};for(const actor of r.students)actor._decisionAt=Infinity;return r;}
function corrupt(actor){actor._slots[0]={id:0,action:'note',progress:.99,readyAt:0};actor._selectedSlot=actor._drawnSlot=0;actor.action=actor.mood='note';actor.holding=true;actor.completed.note=8;}

test('removed paper is absent from definitions, generation, refill and completion counters',()=>{
 assert.equal(Object.hasOwn(CLASSROOM_ACTIONS,'note'),false);
 for(let seed=0;seed<32;seed++){const r=new ClassroomRound({seed});const state=r.snapshot();assert.equal(Object.hasOwn(state.completed,'note'),false);for(let i=0;i<100;i++)assert.notEqual(r._drawItem(),'note');for(const actor of r.students)for(const slot of actor._slots)assert.notEqual(slot.action,'note');}
});
test('legacy held paper is put away and replaced without scoring or losing valid neighbour items',()=>{
 const r=quiet(),p=r.player,other={...p._slots[1]};corrupt(p);r.selected='note';r.holding=true;r.completed.note=9;
 const state=r.snapshot();assert.equal(state.selected,'snack');assert.equal(state.holding,false);assert.equal(state.drawer.drawnSlot,null);assert.equal(state.drawer.slots[0].action,'snack');assert.equal(Object.hasOwn(state.completed,'note'),false);assert.equal(Object.hasOwn(state.students[p.id].completed,'note'),false);assert.deepEqual(p._slots[1],other);assert.equal(r.selectAction('note'),false);r.step(.25);assert.equal(r.score,0);
});
test('stale completion and unknown legacy item cannot award points or crash AI item selection',()=>{
 const r=quiet(),p=r.player;corrupt(p);r._completeAction(p,p._slots[0]);assert.equal(r.score,0);assert.equal(p._drawnSlot,null);
 const ai=r.students.find(s=>s.isTeammate);corrupt(ai);ai._decisionAt=0;ai._slots[1].action='removed-item';r.step(.5);assert.ok(ai._slots.every(s=>!s.action||Object.hasOwn(CLASSROOM_ACTIONS,s.action)));assert.equal(Object.hasOwn(ai.completed,'note'),false);assert.equal(r.score,0);
});
test('authenticated multiplayer rejects removed selections and sanitizes old peer snapshots',()=>{
 const room=new CampusRoom({code:'540008',seed:54}),host=room.join({name:'老师',rolePreference:'teacher'}),peer=room.join({name:'学生'});room.begin(host);for(let i=0;i<301;i++)room.tick(.1);
 corrupt(peer.context.player);peer.context.selected='note';peer.context.holding=true;peer.context.completed.note=2;
 assert.equal(room.command(peer,'selectAction',['note']),false);const state=room.snapshot(peer);assert.equal(state.selected,'snack');assert.equal(state.drawer.drawnSlot,null);assert.equal(state.holding,false);assert.equal(state.drawer.slots[0].action,'snack');assert.equal(Object.hasOwn(state.completed,'note'),false);room.tick(.1);assert.notEqual(room.snapshot(peer).selected,'note');assert.equal(room.snapshot(host).students[peer.studentId].carrying,false);
});
