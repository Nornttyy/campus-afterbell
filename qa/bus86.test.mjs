import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoloRound} from '../dist/solo-round.js';
import {CampusRoom} from '../dist/room-simulation.js';
import {BUS,BUS_SEATS,busFloorHeight,busBlocked,onBusStair,busRoute,moveOnBus} from '../dist/bus-layout86.js';
import {CAMPUS_MAPS,LIFT,isCampusMap,campusFloor,createLayoutContext,clearWallSegment,actorFloorHeight} from '../dist/classroom-layout.js';
import {elevatorDuration} from '../dist/elevator-session.js';
import {canSee,chalkHit} from '../dist/classroom-rules.js';
import {surveillanceMounts,reachesSurveillance} from '../dist/surveillance54.js';
import {ordinaryStudyState} from '../dist/npc-study58.js';

test('the G stop is separate from 1–10 and uses the normal cabin and one-trip rules',()=>{
 assert.equal(CAMPUS_MAPS.length,10);assert.ok(isCampusMap('bus'));assert.equal(campusFloor('bus'),0);
 assert.equal(elevatorDuration('exam','bus'),12);assert.equal(elevatorDuration('bus','classroom'),4);
 assert.equal(isCampusMap('bus11'),false);
 for(const role of ['teacher','student']){
  const r=createSoloRound({role,map:'classroom'});r.start({gathering:true});Object.assign(r.player,{x:LIFT.x,z:LIFT.z,seated:false});
  assert.ok(r.travelFloor('bus'));r.step(3.9);assert.equal(r.map,'classroom');r.step(.1);assert.equal(r.snapshot().floor,0);assert.equal(r.map,'bus');assert.equal(r.travelFloor('exam'),false);
 }
 const r=new CampusRoom({code:'86',map:'classroom'}),a=r.join({name:'甲'}),b=r.join({name:'乙'});
 Object.assign(a.context.player,{x:LIFT.x,z:LIFT.z,seated:false});assert.throws(()=>r.command(a,'travelFloor',['bus']),/所有玩家/);
 Object.assign(b.context.player,{x:LIFT.x+.3,z:LIFT.z,seated:false});assert.ok(r.command(a,'travelFloor',['bus']));r.tick(4);
 for(const m of [a,b]){const state=r.snapshot(m);assert.equal(state.floor,0);assert.equal(state.room.floor,0);assert.equal(state.map,'bus');assert.equal(state.seats.length,28);}
});

function walk(from,to,ctx={},radius=.18){
 const path=busRoute(from,to,radius,ctx);assert.ok(path.length,'reachable '+JSON.stringify(to));let p={busDeck:0,...from};
 for(const q of path){const dx=q.x-p.x,dz=q.z-p.z,n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));
  for(let i=0;i<n;i++){const old=p;p=moveOnBus(p,dx/n,dz/n,radius,ctx);if(p.busDeck!==old.busDeck)assert.ok(onBusStair(p.x,p.z));assert.ok(Math.abs(busFloorHeight(p.x,p.z,p.busDeck)-busFloorHeight(old.x,old.z,old.busDeck))<.13);}
 }
 assert.ok(Math.hypot(p.x-to.x,p.z-to.z)<.01);assert.equal(p.busDeck,to.busDeck||0);return p;
}
test('the two saloons share a footprint and connect only on the flight of stairs',()=>{
 const origin={x:LIFT.x,z:LIFT.z},a=walk(origin,{x:-5,z:-14.35,busDeck:0}),b=walk(a,{x:6.03,z:-12.91,busDeck:1}),c=walk(b,{x:9.70,z:-13.1,busDeck:0});
 assert.equal(actorFloorHeight(b,'bus'),BUS.high);assert.equal(actorFloorHeight(c,'bus'),BUS.low);
 assert.ok(busBlocked(BUS.body.minX,-14,.2,1));assert.ok(busBlocked(7.19,0,.18,0));assert.ok(busBlocked(10.05,BUS.body.maxZ,.18,0,{busDeparted:true}));
 const cross=moveOnBus({x:7,z:BUS.body.maxZ-.3,busDeck:1},0,2);assert.ok(cross.z<BUS.body.maxZ);
 const layout=createLayoutContext(BUS_SEATS),upper={...b,x:6.32,z:-13.12,yaw:0},lower={...upper,z:-12.91,busDeck:0};
 assert.equal(clearWallSegment(upper,lower,layout),false);assert.equal(canSee(upper,lower,[],layout),false);
 assert.equal(chalkHit({x:6.3,z:-13,y:BUS.low+1.6},{x:6.3,z:-13,y:BUS.high+1.4},[],[],'bus',layout)?.kind,'wall');
});
test('every seat admits an ordinary-speed arrival before the bell, with no duplicated assignments',()=>{
 const r=createSoloRound({map:'bus',role:'teacher'});r.start({gathering:true});assert.ok(r.startBell());assert.equal(r.layout.officeLocked,true);
 assert.equal(busBlocked(11.12,-13,.18,0,r.layout),true);
 for(let i=0;i<30;i++)r.step(1);assert.equal(r.stage,'class');assert.equal(r._seatingRoutes.size,0);
 assert.equal(r.students.filter(s=>s.seated).length,BUS_SEATS.length);assert.equal(new Set(r.students.map(s=>s.seatId)).size,28);
 for(const s of r.students){const seat=BUS_SEATS[s.seatId];assert.equal(s.busDeck,seat.busDeck);assert.equal(actorFloorHeight(s,'bus'),seat.supportHeight);assert.equal(busBlocked(seat.exitX,seat.exitZ,.18,seat.busDeck),false);}
});
test('the bell boards a student waiting at the station and their cabin cabinet remains usable',()=>{
 const r=createSoloRound({map:'bus',role:'student'});r.start({gathering:true});assert.ok(r.startBell());
 for(let i=0;i<29;i++)r.step(1);assert.equal(r.snapshot().busDeparted,false);
 r.step(1);assert.equal(r.snapshot().busDeparted,true);
 const seat=BUS_SEATS[r.player.seatId],p=r.player;assert.ok(p.seated);assert.equal(p.busDeck,seat.busDeck);
 assert.equal(r.setDrawerOpen(true),true);assert.equal(r.snapshot().drawer.slots.length,3);
 assert.ok(r.setDrawerOpen(false));r.step(.25);assert.equal(r.snapshot().busDeparted,true);assert.equal(r.interact(),'stood');assert.equal(r.layout.busDeparted,true);
 const before=r.snapshot().busDepartureAt;r.step(.5);assert.equal(r.snapshot().busDepartureAt,before);
});
test('lower passengers look around, upper pupils can read, and camera control stays on its own deck',()=>{
 const top={id:3,busDeck:1,seatYaw:0,x:0,z:-13},low={...top,busDeck:0};
 assert.ok(Array.from({length:40},(_,i)=>ordinaryStudyState(low,null,i,0,'bus')).every(s=>s.mood==='riding'&&!s.studyBookHeld));
 assert.ok(Array.from({length:40},(_,i)=>ordinaryStudyState(top,null,i,0,'bus')).some(s=>s.studyBookHeld));
 const r=createSoloRound({map:'bus',role:'teacher'});r.start();const mounts=surveillanceMounts('bus');assert.deepEqual(mounts.map(m=>m.busDeck),[0,1]);
 for(const m of mounts){Object.assign(r.player,{x:m.x,z:m.z+(m.busDeck?-.7:.7),busDeck:m.busDeck,yaw:m.busDeck?0:Math.PI,pitch:.64});assert.ok(reachesSurveillance(r,m.id));r.player.busDeck=1-m.busDeck;assert.equal(reachesSurveillance(r,m.id),false);}
});
