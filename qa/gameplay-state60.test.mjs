import test from 'node:test';
import assert from 'node:assert/strict';
import {SoloStudentRound} from '../dist/solo-round.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {CampusRoom} from '../server/room-simulation.js';
import {OFFICE_CHAIR,OFFICE_DESK} from '../dist/classroom-layout.js';
import {teacherViewHeight} from '../dist/camera-height58.js';
import {interactionIntent} from '../dist/interaction-intent54.js';
const DT=1/60;
function roomFixture(){
 const room=new CampusRoom({code:'600060',seed:60}),teacher=room.join({rolePreference:'teacher'}),a=room.join({name:'A'}),b=room.join({name:'B'});room.begin(teacher);for(let i=0;i<301;i++)room.tick(.1);room.sim._seatingRoutes.clear();
 for(const p of room.sim.students)if(!p.networkHuman)Object.assign(p,{seated:false,seatId:null,visible:false,x:-50-p.id,z:-50});return{room,teacher,a,b};
}
function sit(room,member,id){const p=member.context.player,s=room.sim.seats[id];Object.assign(p,{x:s.x,z:s.z});assert.equal(room.command(member,'interact',[id]),'seated');}
function take(room,member,kind='burger'){
 const p=member.context.player;Object.assign(p._slots[0],{action:kind,progress:0,readyAt:0});assert.equal(room.command(member,'setDrawerOpen',[true]),true);assert.equal(room.command(member,'takeSlot',[0]),true);return p._slots[0];
}
function away(room,member,z){assert.equal(room.command(member,'interact'),'stood');Object.assign(member.context.player,{x:8.8,z});}
function tick(room,seconds){for(let n=0;n<Math.round(seconds/DT);n++)room.tick(DT);}

test('an empty-handed peer at the source desk cannot reset another pupil food by release, stun or disconnect',()=>{
 const {room,a,b}=roomFixture();sit(room,a,9);const item=take(room,a);away(room,a,2);sit(room,b,9);room.command(a,'setLook',[0,.55]);room.command(a,'hold',[true]);tick(room,1);
 const progress=item.progress;assert.ok(progress>.33);assert.equal(room.snapshot(b).actionProgress,0,'a reserved foreign item is not my action progress');
 room.command(b,'hold',[false]);assert.equal(item.progress,progress,'empty-hand release reset the owner');
 room.sim._stun(b.context.player);assert.equal(item.progress,progress,'stopping a nearby peer reset the owner');room.disconnect(b);assert.equal(item.progress,progress,'disconnect reset the owner');
 tick(room,2);assert.equal(item.action,null);assert.equal(room.snapshot(a).score,1);assert.equal(a.context.player._drawnSlot,null);
});

test('late release after consuming and switching drawer stock cannot clear the next desk owner progress',()=>{
 const {room,a,b}=roomFixture();sit(room,b,0);const other=take(room,b,'drink');away(room,b,3);room.command(b,'setLook',[0,.55]);room.command(b,'hold',[true]);tick(room,1);room.command(b,'setLook',[0,0]);const progress=other.progress;
 sit(room,a,9);take(room,a);away(room,a,2);sit(room,a,0);room.command(a,'setLook',[0,.55]);room.command(a,'hold',[true]);tick(room,3);
 assert.equal(a.context.player._slots,b.context.player._slots);assert.equal(a.context.player._drawnSlot,null);assert.equal(other.heldBy,b.studentId);assert.equal(other.progress,progress);assert.equal(room.snapshot(a).actionProgress,0);
 room.command(a,'hold',[false]);assert.equal(other.progress,progress);room.disconnect(a);assert.equal(other.progress,progress);
 room.command(b,'hold',[false]);assert.equal(other.progress,0,'the real owner must still reset their own partial meal');
});

for(const [kind,points] of Object.entries({snack:1,drink:1,burger:1,banana:1,garlic:1,lunch:3}))test(`${kind}: active low-head use earns exactly ${points}, interrupted use restarts and never credits twice`,()=>{
 const r=new SoloStudentRound({target:1000});r.start();r._advanceTeacher=()=>{};r._perceive=()=>{};
 if(kind==='lunch'){r.interact();Object.assign(r.player,{x:OFFICE_CHAIR.x,z:OFFICE_CHAIR.z});assert.equal(r.openOfficeDrawer(),true);}
 else{Object.assign(r.player._slots[0],{action:kind,progress:0,readyAt:0});r.setDrawerOpen(true);}
 assert.equal(r.takeSlot(0),true);const item=r.player._slots[0];r.setLook(0,0);r.hold(true);r.step(1);assert.equal(item.progress,0);r.setLook(0,.55);r.step(1);assert.ok(item.progress>.33);r.hold(false);assert.equal(item.progress,0);
 r.hold(true);r.step(3-DT);assert.equal(r.score,0);r.step(DT);assert.equal(r.score,points);assert.equal(r.completed[kind],1);r.hold(false);r.step(3);assert.equal(r.score,points);assert.equal(r.completed[kind],1);
});

function teacherFixture(seated){
 const r=new TeacherRound({target:10000});r.start();for(const s of r.students){s._decisionAt=Infinity;Object.assign(s,{visible:false,seated:false,seatId:null,x:-50-s.id,z:-50});}
 Object.assign(r.player,{x:OFFICE_CHAIR.x,z:OFFICE_CHAIR.z});if(seated)assert.equal(r.interact(OFFICE_CHAIR.id),'seated');
 const s=r.students[0];Object.assign(s,{visible:true,x:OFFICE_CHAIR.x+1.2,z:OFFICE_CHAIR.z});r.setLook(Math.PI/2,Math.atan2(teacherViewHeight(r.player)-1.49,1.2));assert.equal(r.hold(true),true);r.step(.15);assert.equal(s.captivity,'stunned');return{r,s};
}
test('a seated teacher may throw chalk but must stand before grabbing a stunned pupil',()=>{
 const {r,s}=teacherFixture(true),state=r.snapshot();assert.equal(state.teacherAim?.id,s.id);assert.equal(state.teacherAim.grabReady,false);assert.equal(interactionIntent(state,{kind:'student',id:s.id,grabReady:true},'E'),null);assert.equal(r.grabStudent(),false);assert.equal(r.teacher.carriedId,null);assert.equal(s.captivity,'stunned');assert.equal(r.interact(),'stood');
});
test('carrying a pupil blocks all office sit entry paths until the pupil is released',()=>{
 const {r,s}=teacherFixture(false);assert.equal(r.grabStudent(),true);const state=r.snapshot();assert.equal(interactionIntent(state,{kind:'office-chair',id:OFFICE_CHAIR.id},'E'),null);
 for(const fn of [()=>r.interact(OFFICE_CHAIR.id),()=>r.sitOfficeChair(OFFICE_CHAIR.id),()=>r.openOfficeDrawer(OFFICE_DESK.id)]){assert.equal(fn(),false);assert.equal(r.player.seated,false);assert.equal(r.teacher.carriedId,s.id);}
 assert.equal(r.dropStudent(),true);assert.equal(r.interact(OFFICE_CHAIR.id),'seated');
});
