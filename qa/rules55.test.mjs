import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassroomRound,FOOD_ACTIONS,START_BELL,CLASS_START_TIMING} from '../dist/classroom-rules.js';
import {createSoloRound} from '../dist/solo-round.js';
import {CampusRoom} from '../server/room-simulation.js';
import {OFFICE_CHAIRS} from '../dist/classroom-layout.js';
const tick=(r,time)=>{for(let n=0;n<Math.ceil(time*60);n++)r.step(Math.min(1/60,time-n/60));};
function quiet(map='classroom'){const r=new ClassroomRound({target:1000,map});r.start();r._advanceTeacher=()=>{};r._perceive=()=>{};for(const s of r.students)s._decisionAt=Infinity;r.teacher.x=r.teacher.z=50;return r;}
function take(r,action){Object.assign(r.player,{_selectedSlot:0,_drawnSlot:0,action,pitch:.55});r.player._slots[0]={id:0,action,progress:0,readyAt:0};r.selected=action;}
function room(){const r=new CampusRoom({code:'550001',seed:73}),host=r.join({name:'老师',rolePreference:'teacher'}),student=r.join({name:'同学'}),peer=r.join({name:'同桌'});return{r,host,student,peer};}

test('food requires lowered head with hysteresis; release resets, raised head alone only pauses',()=>{
 const r=quiet();take(r,'burger');r.player.pitch=0;r.hold(true);tick(r,1);assert.equal(r.player._slots[0].progress,0);assert.equal(r.snapshot().player.eating,false);
 r.setLook(0,.5);tick(r,1);const first=r.snapshot().actionProgress;assert.ok(first>.32&&first<.34);assert.equal(r.snapshot().player.eating,true);
 r.setLook(0,.34);tick(r,.2);assert.ok(r.snapshot().actionProgress>first);r.setLook(0,.2);const paused=r.snapshot().actionProgress;tick(r,.5);assert.equal(r.snapshot().actionProgress,paused);assert.equal(r.snapshot().player.eating,false);
 r.releaseUse();assert.equal(r.snapshot().actionProgress,0);r.setLook(0,.5);r.hold(true);tick(r,3);assert.equal(r.score,1);assert.equal(r.player._drawnSlot,null);r.releaseUse();assert.equal(r.score,1);assert.equal(r.drainEvents().filter(e=>e.type==='food-complete').length,1);
});
test('all foods reset use and private sounds on release; throws and pen are unaffected by low-head rule',()=>{
 for(const kind of FOOD_ACTIONS){const r=quiet();take(r,kind);r.hold(true);tick(r,.9);assert.ok(r.player._useElapsed>.8);r.hold(false);assert.equal(r.snapshot().actionProgress,0);assert.equal(r.player._useElapsed,0);r.drainEvents();r.setLook(0,0);r.hold(true);tick(r,1);assert.equal(r.drainEvents().filter(e=>e.type.startsWith('use-')).length,0);assert.equal(r.score,0);}
 const r=quiet();take(r,'smoke');r.player.pitch=0;r.hold(true);tick(r,.3);r.releaseUse();assert.equal(r.projectiles.length,1);
});
test('pink gum uses 1.5-second circles, pops on release or circle four, and never launches',()=>{
 const r=quiet();take(r,'gum');for(const a of r.students)if(a!==r.player)Object.assign(a,{x:-100,z:-100});r.hold(true);
 for(const [i,points]of[1,2,3,0].entries()){const prior=r.score;tick(r,1.5);assert.equal(r.score-prior,points);if(i<3)assert.equal(r.snapshot().player.bubble.cycles,i+1);}assert.equal(r.score,6);assert.equal(r.bubbles.length,0);assert.equal(r.drainEvents().filter(e=>e.type==='gum-pop').length,1);
 take(r,'gum');r.hold(true);tick(r,.5);r.releaseUse();assert.equal(r.bubbles.length,0);assert.equal(r.player._drawnSlot,null);assert.equal(r.drainEvents().filter(e=>e.type==='gum-pop').length,1);
});
test('orange bound bubble holds full size, launches on release, and attaches with fixed head size',()=>{
 const r=quiet(),p=r.player;for(const a of r.students)if(a!==p)Object.assign(a,{x:-100,z:-100});Object.assign(p,{x:9,z:0,yaw:0,pitch:0,seated:false,caught:true,captivity:'bound',postId:0});r.hold(true);tick(r,7);assert.equal(r.snapshot().player.bubble.cycles,4);assert.equal(r.snapshot().player.bubble.kind,'orange');assert.equal(r.bubbles.length,0);
 assert.equal(r.releaseUse(),true);const flight=r.bubbles[0];assert.equal(flight.kind,'orange');assert.equal(flight.attachedId,null);const z=flight.z;r._advanceBubbles(.1);assert.ok(flight.z>z);const target=r.students.find(a=>a!==p);Object.assign(target,{x:9,z:3.1,seated:false,visible:true});for(let i=0;i<60;i++)r._advanceBubbles(1/60);const attached=r.bubbles.find(b=>b.attachedId===target.id);assert.ok(attached);assert.equal(attached.charge,1);assert.equal(target._bubbleKind,'orange');
});
test('solo pupil is the sole mischievous student and ordinary computer pupils study',()=>{
 const r=createSoloRound({seed:73,map:'computer'});r.start();r._advanceTeacher=()=>{};tick(r,10);assert.deepEqual([...r._team],[r.player.id]);assert.equal(r.score,0);for(const s of r.snapshot().students.filter(s=>!s.isPlayer)){assert.equal(s.isTeammate,false);assert.equal(s.computer.app,'photoshop');assert.equal(s.mood,'computer');}assert.equal(r.snapshot().computerGamingCount,0);
});
test('four desktop apps select with directions, E opens and Q returns, games alone count as gaming',()=>{
 const r=quiet('computer');assert.equal(r.startComputer(),true);assert.equal(r.computerConfirm(),true);assert.equal(r.snapshot().player.computer.app,'photoshop');assert.equal(r.snapshot().computerGamingCount,0);r.computerBack();r.computerSelect('right');r.computerConfirm();assert.equal(r.snapshot().player.computer.app,'unity');r.computerBack();r.computerSelect('down');r.computerConfirm();assert.equal(r.snapshot().player.computer.app,'valorant');tick(r,5);assert.equal(r.score,0);assert.equal(r.snapshot().computerGamingCount,1);r.computerBack();r.computerSelect('left');r.computerConfirm();assert.equal(r.snapshot().player.computer.app,'snake');r.computerBack();assert.equal(r.player._computerActive,true);r.computerBack();assert.equal(r.player._computerActive,false);
});
test('host-only configuration validates bounds, locks after start and survives rematch',()=>{
 const {r,host,student}=room();assert.throws(()=>r.command(student,'configureRound',[{duration:300,target:30}]),/房主/);for(const v of[{duration:299,target:30},{duration:1201,target:30},{duration:600,target:121},{duration:600,target:29},{duration:'600',target:120}])assert.throws(()=>r.command(host,'configureRound',[v]),/5–20/);
 assert.equal(r.command(host,'configureRound',[{duration:1200,target:30}]),true);assert.deepEqual(r.publicRoom(student).settings,{duration:1200,target:30});r.begin(host);assert.equal(r.sim.duration,1200);assert.equal(r.sim.target,30);assert.throws(()=>r.command(host,'configureRound',[{duration:300,target:120}]),/开局后/);r.sim._finish('lost','timeout');r.rematch(host);assert.equal(r.sim.duration,1200);assert.equal(r.sim.target,30);
});
test('network food enforces authoritative pitch and sends chewing only to its owner, completion to everyone',()=>{
 const {r,host,student,peer}=room();r.begin(host);for(let i=0;i<301;i++)r.tick(.1);const actor=student.context.player;Object.assign(actor,{seated:true,seatId:0,pitch:0,_drawnSlot:0,_selectedSlot:0});actor._slots[0]={id:0,action:'drink',progress:0,readyAt:0};student.context.selected=actor.action='drink';r.command(student,'hold',[true]);for(let i=0;i<10;i++)r.tick(.1);assert.equal(actor._slots[0].progress,0);r.command(student,'setLook',[0,.55]);for(let i=0;i<10;i++)r.tick(.1);assert.ok(r.snapshot(student).events.some(e=>e.type==='use-gulp'));assert.equal(r.snapshot(peer).events.some(e=>e.type==='use-gulp'),false);assert.equal(r.snapshot(host).events.some(e=>e.type==='use-gulp'),false);r.command(student,'releaseUse');assert.equal(actor._slots[0].progress,0);r.command(student,'hold',[true]);for(let i=0;i<31;i++)r.tick(.1);assert.equal(r.snapshot(host).events.filter(e=>e.type==='drink-complete').length,1);assert.equal(r.snapshot(peer).events.filter(e=>e.type==='drink-complete').length,1);
});
test('every office chair can be sat on and every independent drawer only supplies lunch',()=>{
 const r=quiet();for(const c of OFFICE_CHAIRS){Object.assign(r.player,{x:c.x+.6,z:c.z,seated:false,_drawnSlot:null});assert.equal(r.interact(c.id),'seated');assert.equal(r.setOfficeDrawerOpen(true,c.deskId),true);assert.equal(r.snapshot().player.officeDeskId,c.deskId);assert.deepEqual(r.snapshot().drawer.slots.map(s=>s.action),['lunch']);assert.ok(r.snapshot().officeDrawers.find(d=>d.id===c.deskId).open);}
});
test('AI leaves the lift early, individually, and every pupil owns a seat by 30 seconds',()=>{
 for(const map of ['classroom','computer','tiered'])for(const seed of [0,2,4,5]){const r=createSoloRound({map,seed});r.start({gathering:true});Object.assign(r.player,{x:START_BELL.x+.7,z:START_BELL.z,yaw:-Math.PI/2});r.startBell();let visible=0;
  let firstArrival=null;
  for(let i=0;i<1801;i++){r.step(1/60);const elapsed=(i+1)/60,count=r.students.filter(s=>!s.isPlayer&&s.visible!==false).length;assert.ok(count-visible<=1);if(elapsed<CLASS_START_TIMING.firstArrival-1e-8)assert.equal(count,0);if(count>0&&firstArrival===null)firstArrival=elapsed;visible=count;}
  assert.ok(firstArrival>=CLASS_START_TIMING.firstArrival-1e-8&&firstArrival<=CLASS_START_TIMING.firstArrival+1/60,'first pupil should use the early fixed-speed arrival schedule');
  const ai=r.students.filter(s=>!s.isPlayer);assert.ok(ai.every(s=>s.seated),map+' '+seed);assert.equal(new Set(ai.map(s=>s.seatId)).size,ai.length);assert.equal(r.stage,'class');}
});


test('office chair ownership is per furniture across teacher and pupils; separate drawers stay independent',()=>{
 const {r,host,student,peer}=room();r.begin(host);for(let i=0;i<301;i++)r.tick(.1);r.sim._seatingRoutes.clear();for(const a of r.sim.students)if(!a.networkHuman)Object.assign(a,{x:-100,z:-100,seated:false});
 const first=OFFICE_CHAIRS[0],second=OFFICE_CHAIRS[1];for(const m of[host,student,peer])Object.assign(m.context.player,{x:first.x,z:first.z,seated:false});
 assert.equal(r.command(host,'interact',[first.id]),'seated');assert.equal(r.command(host,'setOfficeDrawerOpen',[true,first.deskId]),true);
 assert.equal(r.command(student,'interact',[first.id]),false);assert.equal(r.command(student,'setOfficeDrawerOpen',[true,first.deskId]),false);
 Object.assign(student.context.player,{x:second.x,z:second.z});assert.equal(r.command(student,'interact',[second.id]),'seated');assert.equal(r.command(student,'setOfficeDrawerOpen',[true,second.deskId]),true);
 const state=r.snapshot(peer);assert.equal(state.officeDrawers.find(d=>d.id===first.deskId).open,true);assert.equal(state.officeDrawers.find(d=>d.id===second.deskId).open,true);
 assert.equal(r.command(student,'takeSlot',[0]),true);assert.equal(r.sim.officeSlotsByDesk.get(first.deskId)[0].heldBy,undefined);assert.equal(r.sim.officeSlotsByDesk.get(second.deskId)[0].heldBy,student.studentId);
});
test('disconnect cancels a partial meal and reconnect cannot resume stale progress',()=>{
 const {r,host,student}=room();r.begin(host);for(let i=0;i<301;i++)r.tick(.1);const actor=student.context.player;Object.assign(actor,{seated:true,pitch:.55,_selectedSlot:0,_drawnSlot:0,action:'burger'});actor._slots[0]={id:0,action:'burger',progress:0,readyAt:0};student.context.selected='burger';r.command(student,'hold',[true]);for(let i=0;i<10;i++)r.tick(.1);assert.ok(actor._slots[0].progress>0);r.disconnect(student);assert.equal(actor._slots[0].progress,0);assert.equal(actor.holding,false);r.reconnect(student);assert.equal(r.snapshot(student).actionProgress,0);
});
test('private inflation cues fire once per 1.5-second circle and public item cues include a world position',()=>{
 const r=quiet();take(r,'gum');r.hold(true);tick(r,6);const events=r.drainEvents(),inflate=events.filter(e=>e.type==='gum-inflate');assert.deepEqual(inflate.map(e=>e.cycle),[1,2,3,4]);assert.ok(inflate.every(e=>e.recipientId===r.player.id));const pop=events.find(e=>e.type==='gum-pop');assert.ok([pop.x,pop.y,pop.z].every(Number.isFinite));
 take(r,'garlic');r.hold(true);tick(r,3);r.burp();const finish=r.drainEvents();for(const kind of['food-complete','burp']){const event=finish.find(e=>e.type===kind);assert.ok(event);assert.ok([event.x,event.y,event.z].every(Number.isFinite));assert.equal(event.recipientId,undefined);}
});
