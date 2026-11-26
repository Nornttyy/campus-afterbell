import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {ClassroomRound} from '../dist/classroom-rules.js';
import {ordinaryStudyState} from '../dist/npc-study58.js';
import {normalWalkSpeed} from '../dist/movement55.js';
import {PLAYGROUND_LAYOUT} from '../dist/playground-layout70.js';
import {createDeskHands} from '../dist/game-actors.js';
import {createRiggedPalm} from '../dist/student-assets.js';
import {createHandAnimationRuntime} from '../dist/hand-animation-runtime59.js';
import {PUBLISHED_HAND_ANIMATIONS} from '../dist/published-hand-animations61.js';
import {loadGeometry} from './gltf-geometry.mjs';

test('stunned ordinary classmates sit again and respect a seat taken during their stun',()=>{
  const r=new ClassroomRound({seed:117});r.start();
  const npc=r.students.find(s=>!s.isTeammate&&!s.isPlayer),original=npc.seatId;
  const recover=actor=>{r.elapsed=actor._chalkUntil;r._advanceCaptivity(0);};
  assert.ok(r._stun(npc));assert.equal(npc.seated,false);recover(npc);
  assert.equal(npc.captivity,'free');assert.equal(npc.seatId,original);assert.ok(npc.seated);
  assert.ok(r._stun(npc));r._placeAtClassSeat(r.player,r.seats[original]);recover(npc);
  assert.notEqual(npc._targetSeatId,original);
  for(let i=0;i<2400&&!npc.seated;i++)r._advanceRescuer(npc,1/60);
  assert.ok(npc.seated);assert.notEqual(npc.seatId,original);
  assert.equal(r.player.seatId,original);assert.ok(r._stun(r.player));recover(r.player);
  assert.equal(r.player.seated,false);
});

test('ordinary pupils inspect empty drawers without taking items or receiving points',()=>{
  for(const map of ['classroom','computer','night','tiered']){
    const r=new ClassroomRound({seed:117,map});r.start();
    const pupil=r.students.find(s=>!s.isPlayer&&!s.isTeammate);
    let opened=false,thenClosed=false;
    for(let tick=0;tick<380;tick++){
      r.elapsed=tick/10;
      Object.assign(pupil,ordinaryStudyState(pupil,r.teacher,r.elapsed,r.seed,map));
      if(pupil._drawerOpen){
        const view=r.snapshot().students.find(s=>s.id===pupil.id);
        assert.ok(view.drawerOpen);assert.equal(view.drawer,undefined);
        assert.equal(view.holding,false);assert.equal(view.studyBookHeld,false);
        assert.ok(view.pitch>1.1);opened=true;
      }else if(opened)thenClosed=true;
    }
    assert.ok(opened&&thenClosed,map);assert.equal(r.score,0);
  }
});

test('the automatic running lane follows the stadium bends as well as the straights',()=>{
  const t=PLAYGROUND_LAYOUT.track,r=(t.innerRadius+t.outerRadius)/2;
  for(const [x,z] of [[t.cx+r,t.cz],[t.cx,t.cz-t.straightHalf-r]]){
    assert.ok(normalWalkSpeed({id:1,x,z},'playground')>normalWalkSpeed({id:1,x:t.cx,z:t.cz},'playground'));
    assert.equal(normalWalkSpeed({id:1,x,z,seated:true},'playground'),1.8);
    assert.equal(normalWalkSpeed({id:-1,x,z},'playground'),2.2);
  }
});

test('picking up and walking with an item retain both published wrist tracks at every frame',async()=>{
  const palms=await Promise.all(['hand-left-v3.glb','hand-right-v3.glb'].map(loadGeometry));
  const make=()=>createDeskHands({createHand:(side,k)=>createRiggedPalm(palms[Number(side>0)],side,k)});
  const empty=make(),held=make();
  const runtime=()=>createHandAnimationRuntime({storage:null,eventTarget:null,fallbackDocument:PUBLISHED_HAND_ANIMATIONS});
  const a=runtime(),b=runtime(),state={role:'student',seated:false,freeLook:true,movement:1};
  const kinds=['burger','phone','smoke','drink'],propNames=['layered-burger','handheld-phone','smoke-canister','red-drink-can'];
  for(let i=0;i<180;i++){
    const block=Math.floor(i/36)-1,carrying=block>=0,action=kinds[block]||'snack',time=i/60;
    const p=a.sample(state,time),q=b.sample({...state,carrying,foodItem:action==='burger'||action==='drink'},time);
    empty.update(time,{...state,walkPhase:time*5,animationPose:p});
    held.update(time,{...state,walkPhase:time*5,action,carrying,animationPose:q});
    if(!carrying)continue;
    assert.equal(q.clipId,'student-walk');assert.equal(held.getExtension(),1);
    assert.ok(held.group.getObjectByName(propNames[block]).visible);
    assert.ok(held.group.getObjectByName('right-desk-arm').visible);
    for(const side of ['left','right']){
      const x=empty.getHand(side).group,y=held.getHand(side).group;
      assert.ok(x.getWorldPosition(new T.Vector3()).distanceTo(y.getWorldPosition(new T.Vector3()))<.00001);
      assert.ok(x.getWorldQuaternion(new T.Quaternion()).angleTo(y.getWorldQuaternion(new T.Quaternion()))<.00001);
    }
  }
  a.dispose();b.dispose();
});
