import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {syncDeskPenVisibility} from '../dist/classroom.js';

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
