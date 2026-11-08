import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound,CLASSROOM_ACTIONS,START_BELL} from '../dist/classroom-rules.js';
import {TeacherRound} from '../dist/teacher-rules.js';
import {createSnake,turnSnake,stepSnake,ITEM50_TUNING} from '../dist/item-rules50.js';
import {OFFICE_CHAIR,TEACHER_SPAWN,BOARD,DETENTION,blocked,createSeatLayout} from '../dist/classroom-layout.js';
const DT=1/60;
function quiet(map='classroom',Round=ClassroomRound){const r=new Round({map,target:1000});r.start();r._thinkAt=r._plan.until=Infinity;for(const s of r.students)s._decisionAt=Infinity;if(Round===ClassroomRound){r.teacher.x=40;r.teacher.z=40;}return r;}
function stock(r,kind){r.player._slots[0]={id:0,action:kind,progress:0,readyAt:0};r.player._selectedSlot=0;r.player._drawnSlot=null;r.selected=r.player.action=kind;if(!r.player._drawerOpen)r.toggleDrawer();assert.equal(r.takeSlot(0),true);}
function bind(r,p){r.teacher.x=p.x;r.teacher.z=p.z-.9;r._stun(p);assert.ok(r._grab(p));r.teacher.x=DETENTION[0].x;r.teacher.z=DETENTION[0].z-1.1;assert.ok(r._bind(0));r.teacher.x=r.teacher.z=40;}

test('gum grows one cycle each second, awards increasing points, and pops at four',()=>{
 const r=quiet();stock(r,'gum');r.hold(true);let expected=0;
 for(let n=1;n<=3;n++){r.step(1);expected+=n;assert.equal(r.score,expected);assert.equal(r.snapshot().player.bubble.cycles,n);assert.equal(r.snapshot().player.bubble.blowing,true);}
 r.step(1);assert.equal(r.score,10);assert.equal(r.player._slots[0].action,null);assert.equal(r.snapshot().player.bubble.progress,0);assert.equal(r.bubbles.length,0);assert.equal(r.drainEvents().filter(e=>e.type==='gum-pop').length,1);
});
test('bound bubble caps at four cycles without popping or consuming, and deliberate release attaches to a head',()=>{
 const r=quiet();bind(r,r.player);r.hold(true);r.step(7);assert.equal(r.snapshot().player.bubble.cycles,4);assert.equal(r.bubbles.length,0);assert.equal(r.score,0);assert.equal(r.releaseUse(),true);
 const b=r.bubbles[0],victim=r.students.find(s=>s.id!==r.player.id&&!s.isTeammate);victim.x=b.x;victim.z=b.z;victim.seated=false;victim.seatId=null;r.step(DT);
 assert.equal(r.bubbles[0].attachedId,victim.id);assert.ok(r.snapshot().students[victim.id].bubbleLeft>9.9);assert.equal(r.snapshot().students[victim.id].bubbleSize,1);
 const x=victim.x+=.2;r.step(DT);assert.equal(r.bubbles[0].x,x);
});
test('banana takes three seconds and returns one peel, whose floor trap stuns once',()=>{
 const r=quiet();stock(r,'banana');r.hold(true);r.step(3-DT);assert.equal(r.player._slots[0].action,'banana');r.step(DT);assert.equal(r.player._slots[0].action,'bananaPeel');assert.equal(r.player._drawnSlot,0);assert.equal(r.score,3);
 r.hold(true);assert.equal(r.releaseUse(),true);assert.equal(r.peels.length,1);const peel=r.peels[0];Object.assign(peel,{x:r.player.x,z:r.player.z,y:.075,armed:true,settled:true});r.step(DT);
 assert.equal(r.player.captivity,'stunned');assert.equal(r.player.seated,false);assert.ok(r.snapshot().player.stunLeft>3.9);assert.equal(r.peels.length,0);r.step(4);assert.equal(r.player.captivity,'free');
});
test('garlic arms one five-second straight burp, no auto-fire or extra uses',()=>{
 const r=quiet();stock(r,'garlic');r.hold(true);r.step(3);assert.equal(r.snapshot().player.burpReadyLeft,5);assert.equal(r.burps.length,0);r.setLook(0,0);assert.equal(r.hold(true),true);assert.equal(r.burps.length,1);assert.equal(r.burp(),false);
 const start={...r.burps[0]};for(const s of r.students)if(s!==r.player){s.x=30;s.z=30;}r.step(.2);assert.equal(r.burps[0].x,start.x);assert.ok(Math.abs(r.burps[0].z-start.z-.6)<1e-6);assert.equal(r.burps[0].y,start.y);
 const expired=quiet();stock(expired,'garlic');expired.hold(true);expired.step(8+DT);assert.equal(expired.burp(),false);assert.equal(expired.burps.length,0);
});
test('office stock is only lunch, refills after three seconds and survives leaving the chair',()=>{
 const r=quiet();r.interact();Object.assign(r.player,{x:OFFICE_CHAIR.x,z:OFFICE_CHAIR.z});assert.equal(r.openOfficeDrawer(),true);assert.equal(r.snapshot().drawer.office,true);assert.deepEqual(r.snapshot().drawer.slots.map(s=>s.action),['lunch']);assert.equal(r.takeSlot(0),true);r.hold(true);r.step(3);assert.equal(r.score,5);assert.equal(r.snapshot().drawer.slots[0].readyIn,3);r.interact();r.step(3);assert.equal(r.officeSlots[0].action,'lunch');
 const normal=r.seats.find(s=>!r.students.some(p=>p.seated&&p.seatId===s.id));Object.assign(r.player,normal);assert.equal(r.interact(normal.id),'seated');assert.equal(r.snapshot().drawer.office,false);assert.equal(r.snapshot().drawer.slots.length,3);
});
test('computer room has a desktop and snake scores only real food, with one five-second drawer slot',()=>{
 const r=quiet('computer7');assert.equal(r.player._slots.length,1);assert.equal(r.startComputer(),true);assert.equal(r.snapshot().player.computer.app,'desktop');r.hold(true);r.step(3);assert.equal(r.score,0);assert.equal(r.computerApp('study'),true);r.step(2);assert.equal(r.score,0);
 assert.equal(r.computerApp('snake'),true);r.step(.65);assert.equal(r.score,1);assert.equal(r.snapshot().player.computer.snake.score,1);assert.equal(r.snakeDirection('left'),false);assert.equal(r.computerApp('snake'),true);assert.equal(r.snapshot().player.computer.snake.score,1,'reopening must not reroll an active snake');
 r.stopComputer();stock(r,'burger');r.hold(true);r.step(3);assert.equal(r.snapshot().drawer.slots[0].readyIn,5);r.step(5-DT);assert.equal(r.player._slots[0].action,null);r.step(DT);assert.ok(r.player._slots[0].action);
});
test('snake rejects reverse turns, stops on collisions and never spawns food inside its body',()=>{
 const s=createSnake(4);assert.equal(turnSnake(s,'left'),false);assert.equal(stepSnake(s,.64),1);assert.equal(s.score,1);assert.ok(!s.body.some(p=>p.x===s.food.x&&p.y===s.food.y));stepSnake(s,5);assert.equal(s.alive,false);const score=s.score;stepSnake(s,5);assert.equal(s.score,score);
});
test('pen is taken from desktop, held without taking a drawer slot, and returned intact',()=>{
 const r=quiet();const before=r.snapshot().drawer.slots;assert.equal(r.takePen(),true);assert.equal(r.player.action,'pen');assert.equal(r.takePen(),false);r.hold(true);r.step(3);assert.equal(r.score,1);assert.equal(r.player._drawnSlot,3);assert.equal(r.returnItem(),true);assert.deepEqual(r.snapshot().drawer.slots,before);assert.equal(r.snapshot().player.penTaken,false);
});
test('stunning a pupil returns the temporary pen to its desk without changing drawer stock',()=>{
 const r=quiet(),seatId=r.player.seatId,before=r.snapshot().drawer.slots;assert.equal(r.takePen(),true);r.hold(true);r.step(.7);assert.equal(r._stun(r.player),true);assert.equal(r.snapshot().player.penTaken,false);assert.equal(r.player._drawnSlot,null);assert.equal(r.player._slots.some(s=>s.temporary),false);assert.deepEqual(r.snapshot().drawer.slots,before);r.step(5);assert.equal(r.interact(seatId),'seated');assert.equal(r.takePen(),true,'the desk pen must be usable again after recovering');
});
test('every teacher chalk cast costs ten stamina; stun sits and blocks casts, ink only blinds',()=>{
 const r=quiet('classroom',TeacherRound);r.teacher.stamina=20;assert.equal(r.throwChalk(),true);assert.equal(r.teacher.stamina,10);r.elapsed=1;assert.equal(r.throwChalk(),true);assert.equal(r.teacher.stamina,0);r.elapsed=2;assert.equal(r.throwChalk(),false);
 r.teacher.stamina=100;r._stunAny(r.teacher,4,'bananaPeel');assert.equal(r.snapshot().teacher.phase,'stunned');assert.ok(r.snapshot().teacher.stunLeft>=4);assert.equal(r.throwChalk(),false);r.step(4);assert.equal(r.player.captivity,'free');
 r._applyProjectileEffect({id:1,ownerId:0},{kind:'ink',x:r.teacher.x,y:1.9,z:r.teacher.z,hitActorId:-1});assert.ok(r.snapshot().teacher.inkLeft>0);assert.equal(r.throwChalk(),true);
});
test('preparation locks the teacher in office for thirty seconds; AI leaves lift at twenty remaining',()=>{
 const r=new ClassroomRound();r.start({gathering:true});assert.ok(r.students.filter(s=>!s.isPlayer).every(s=>s.visible===false));assert.equal(r.startBell(),true);assert.equal(r.layout.officeLocked,true);assert.equal(r.teacher.x,TEACHER_SPAWN.x);assert.equal(r.teacher.z,TEACHER_SPAWN.z);
 r.step(10-DT);assert.ok(r.students.filter(s=>!s.isPlayer).every(s=>s.visible===false));r.step(DT);assert.equal(r.snapshot().stageTimeLeft,20);assert.ok(r.students.some(s=>!s.isPlayer&&s.visible));r.step(20);assert.equal(r.layout.officeLocked,false);assert.equal(r.stage,'class');assert.equal(r.player.seated,false,'free seating must not teleport the player');assert.equal(r.teacher.intent,'enter');
});
test('a player can take any free seat and late AI reroutes instead of occupying it',()=>{
 const r=new ClassroomRound();r.start({gathering:true});r.startBell();const id=2,seat=r.seats[id];Object.assign(r.player,{x:seat.x,z:seat.z});assert.equal(r.interact(id),'seated');assert.equal(r.player.seatId,id);r.step(30);assert.notEqual(r.students[id]._targetSeatId,id);assert.equal(r.students.filter(s=>s.seated&&s.seatId===id).length,1);
});
test('layouts and closed doors belong to each room, and network humans are not AI-controlled',()=>{
 const a=quiet(),b=new ClassroomRound({seed:74});assert.notDeepEqual(a.seats,b.seats);a.setRearDoor(true);assert.equal(a.layout.rearDoorClosed,true);assert.equal(b.layout.rearDoorClosed,false);
 const human=a.students.find(s=>s.isTeammate);human.networkHuman=true;human.isTeammate=false;human._decisionAt=0;human._profile=null;human.holding=false;const before={x:human.x,z:human.z};a.step(5);assert.equal(human.holding,false);assert.deepEqual({x:human.x,z:human.z},before);assert.ok(Object.values(human.completed).every(n=>n===0));
});

test('two pupils cannot duplicate the shared office lunch while one carries it away',()=>{
 const r=quiet(),first=r.player;r.interact();Object.assign(first,{x:OFFICE_CHAIR.x,z:OFFICE_CHAIR.z});r.openOfficeDrawer();assert.equal(r.takeSlot(0),true);r.interact();first.x=8;first.z=12;
 const second=r.students.find(s=>s.isTeammate);second.seated=false;second.seatId=null;Object.assign(second,{x:OFFICE_CHAIR.x,z:OFFICE_CHAIR.z});r.player=second;r.openOfficeDrawer();assert.equal(r.takeSlot(0),false);assert.equal(r.snapshot().drawer.slots[0].action,null);assert.equal(r.officeSlots[0].action,'lunch');
 r.interact();second.x=8;second.z=11;r.player=first;Object.assign(first,{x:OFFICE_CHAIR.x,z:OFFICE_CHAIR.z});assert.equal(r.sitOfficeChair(),'seated');assert.equal(r.returnItem(),true);assert.equal(r.officeSlots[0].heldBy,undefined);
});

test('the local snapshot preserves the chosen chair heading independently of head look',()=>{
 const r=quiet();r.reset(2);r.start();for(const s of r.students){s.seated=false;s.seatId=null;}const seat=r.seats.find(s=>s.yaw===Math.PI);assert.ok(seat,'four-seat layout needs inward facing chairs');Object.assign(r.player,{x:seat.x,z:seat.z});assert.equal(r.interact(seat.id),'seated');r.setLook(.45,.2);
 assert.equal(r.snapshot().player.seatYaw,Math.PI);assert.equal(r.snapshot().player.yaw,.45);assert.equal(r.snapshot().students[r.player.id].seatYaw,Math.PI);
 const teacher=quiet('classroom',TeacherRound);Object.assign(teacher.player,{x:OFFICE_CHAIR.x,z:OFFICE_CHAIR.z});assert.equal(teacher.interact('office-chair'),'seated');teacher.setLook(1,.1);assert.equal(teacher.snapshot().player.seatYaw,OFFICE_CHAIR.yaw);assert.equal(teacher.snapshot().player.officeChair,true);
});
