import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {syncDeskPenVisibility} from '../dist/classroom.js';
import {SoloStudentRound} from '../dist/solo-round.js';
import {ordinaryStudyState} from '../dist/npc-study58.js';

function pupil(id){
  const group=new T.Group(),actorGroup=new T.Group(),grip=new T.Group(),pencil=new T.Group();
  pencil.name='held-writing-pencil';group.add(actorGroup);actorGroup.add(grip);grip.add(pencil);
  return{seat:{id},group,actor:{group:actorGroup},pencil,grip};
}

test('the desk pen disappears only while its pupil visibly holds it, then returns',()=>{
  const record=pupil(2),deskPen=new T.Group(),pens=new Map([[2,deskPen]]);
  syncDeskPenVisibility([record],pens);assert.equal(deskPen.visible,false);
  record.pencil.visible=false;syncDeskPenVisibility([record],pens);assert.equal(deskPen.visible,true);
  record.pencil.visible=true;record.actor.group.visible=false;syncDeskPenVisibility([record],pens);assert.equal(deskPen.visible,true,'hidden cached actor stole the desk pen');
  record.actor.group.visible=true;record.group.visible=false;syncDeskPenVisibility([record],pens);assert.equal(deskPen.visible,true,'off-camera actor left a visible empty desk');
  record.group.visible=true;record.grip.visible=false;syncDeskPenVisibility([record],pens);assert.equal(deskPen.visible,true,'hidden hand prop stole the desk pen');
});

test('seating changes transfer the one pen without altering other desks or deleting objects',()=>{
  const a=pupil(2),b=pupil(5),pens=new Map([2,5,8].map(id=>[id,new T.Group()]));
  a.currentSeatId=8;b.pencil.visible=false;
  const before=[...pens.values()];syncDeskPenVisibility([a,b],pens);
  assert.equal(pens.get(8).visible,false);assert.equal(pens.get(2).visible,true);assert.equal(pens.get(5).visible,true);
  a.pencil.visible=false;b.pencil.visible=true;syncDeskPenVisibility([a,b],pens);
  assert.equal(pens.get(8).visible,true);assert.equal(pens.get(5).visible,false);assert.deepEqual([...pens.values()],before);
  assert.equal(a.pencil.parent,a.grip);assert.equal(b.pencil.parent,b.grip);
});

test('writing, dropping and retrieving a borrowed pen at another desk preserve both desk states',()=>{
  const round=new SoloStudentRound({seed:59,map:'classroom'});round.start();
  const student=round.player,source=student.seatId,desk=round.seats.find(s=>s.id!==source&&round.books[s.id].raised);
  const classmate=round.students.find(s=>s.seatId===desk.id);
  const record=pupil(student.id),pens=new Map([source,desk.id].map(id=>[id,new T.Group()]));
  function checkPens(pencilVisible,sourceVisible){
    const state=round.snapshot();record.penSeatId=state.player.penSeatId;record.currentSeatId=state.player.seatId;
    record.pencil.visible=pencilVisible;syncDeskPenVisibility([record],pens,state);
    assert.equal(pens.get(source).visible,sourceVisible);assert.equal(pens.get(desk.id).visible,true);
  }
  assert.equal(round.takePen(),true);assert.equal(round.snapshot().books[source].amount,0);
  assert.equal(round.interact(),'stood');Object.assign(student,{x:desk.x,z:desk.z});
  assert.equal(round.interact(desk.id),false,'another student occupies this chair');
  round._placeAtClassSeat(classmate,round.seats[source]);assert.equal(round.interact(desk.id),'seated');
  assert.equal(round.togglePenMode(),true);assert.equal(round.snapshot().player.penWriting,true);
  assert.equal(round.books[desk.id].amount,0);assert.equal(round.toggleBook(),false);
  checkPens(true,false);
  round.elapsed=Array.from({length:37},(_,i)=>i).find(t=>ordinaryStudyState(classmate,round.teacher,t,round.seed,round.map).mood==='writing');
  round._advanceStudents(0);assert.equal(classmate.mood,'listening');
  assert.equal(round.returnItem(),false);assert.equal(round.dropItem(),true);
  assert.equal(round.snapshot().students[student.id].mood,'listening');
  const [item]=round.snapshot().groundItems;assert.equal(item.penSeatId,source);
  round._advanceStudents(0);assert.equal(classmate.mood,'listening');checkPens(false,false);
  assert.equal(round.takeGroundItem(item.id),true);assert.equal(round.snapshot().groundItems.length,0);
  assert.equal(round.snapshot().students[student.id].mood,'pen-twirling');
  checkPens(true,false);assert.equal(round.interact(),'stood');
  Object.assign(student,{x:round.seats[source].x,z:round.seats[source].z});
  assert.equal(round.returnItem(),true);checkPens(false,true);
  round._advanceStudents(0);assert.equal(classmate.mood,'writing');
  round._placeAtClassSeat(classmate,desk);assert.equal(round.interact(source),'seated');
  assert.equal(round.setBookRaised(true),true);assert.equal(round.snapshot().students[student.id].mood,'reading');
  assert.equal(round.setBookRaised(false),true);assert.equal(round.snapshot().students[student.id].mood,'listening');
});

for(const map of ['classroom','night','tiered'])test(map+': an ordinary classmate puts the book flat on the very first writing frame',()=>{
  const round=new SoloStudentRound({seed:73,map});round.start();
  const student=round.students.find(s=>s.seated&&!s.isPlayer&&s.seatId!==s.id)??round.students.find(s=>s.seated&&!s.isPlayer),moods=new Set();
  for(let t=0;t<37;t+=.5){
    round.elapsed=t;round._advanceStudents(0);const reading=student.mood==='reading';
    moods.add(student.mood);assert.equal(round.books[student.seatId].raised,reading);
    assert.equal(round.books[student.seatId].amount,Number(reading));
  }
  assert.deepEqual([...moods].sort(),['listening','reading','writing']);
});
