import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPUS_MAPS,LECTERN,OFFICE_DESKS,BOARD,DETENTION,createSeatLayout,createLayoutContext,updateLayoutDoors,updateSpecialFurnitureCollisions,blocked,moveInRoom,clearWallSegment,ceilingVolumes,enclosureVolumes,floorHeight,actorFloorHeight,actorEyeHeight,actorBodyVolume,boardForMap,detentionForMap} from '../dist/classroom-layout.js';
import {HOTPOT_TABLES} from '../dist/hotpot-layout70.js';
import {TOILET_STALLS,toiletDoorSolids,toiletCabinetDoorSolids} from '../dist/toilet-layout70.js';
import {DORM_BEDS,dormCabinetDoorSolids} from '../dist/dorm-layout70.js';
import {PLAYGROUND_LAYOUT} from '../dist/playground-layout70.js';
import {syncDrawerCollisions} from '../dist/drawer-collision58.js';
import {createSmokeProjectile,stepSmokeProjectile} from '../dist/smoke-physics.js';
import {effectEye,clearEffectSight,stepThrowableProjectile} from '../dist/projectile-effects-rules.js';
const context=map=>createLayoutContext(createSeatLayout(73,null,map));
const contains=(b,x,y,z)=>x>=b.minX&&x<=b.maxX&&y>=b.minY&&y<=b.maxY&&z>=b.minZ&&z<=b.maxZ;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const projectile=(map,layout,values)=>Object.assign(createSmokeProjectile({id:9,x:6.5,z:6,yaw:0},90,0,map,layout),values);

test('special maps keep genuine actor places without synthesizing ordinary desks or chairs',()=>{
 for(const [map,count] of [['hotpot',24],['toilet',12],['dorm',24],['playground',24]]){
  const c=context(map);assert.equal(c.seats.length,count);assert.equal(c.desks.length,0);assert.ok(c.furnitureVolumes.length);
  if(map!=='hotpot')assert.equal(c.chairBacks.length,OFFICE_DESKS.length);
  if(map!=='hotpot')assert.ok(!c.walkSolids.includes(LECTERN));
  for(const v of c.furnitureWalkSolids)assert.ok(c.walkSolids.includes(v));
  const volumes=enclosureVolumes(map,c);for(const v of c.furnitureVolumes)assert.equal(volumes.filter(s=>s===v).length,1,'furniture appears once in projectile enclosure');
  if(map==='playground')for(const s of c.seats){assert.equal(s.standing,true);assert.equal(blocked(s.x,s.z,.18,c),false);}
 }
 assert.equal(CAMPUS_MAPS.length,8);
});

test('current cubicle and cabinet angles update movement, sight and projectile caches independently',()=>{
 const c=context('toilet'),s=TOILET_STALLS[0],a={x:s.x,z:s.z+.4},b={x:s.x,z:s.z+1.7};
 assert.equal(clearWallSegment(a,b,c),false);assert.ok(moveInRoom(a,0,1.3,.18,c).z<s.z+1.19);
 c.routeGrids.set('probe',{});c.projectileColliderCache=new Map([['probe',{}]]);
 assert.equal(updateSpecialFurnitureCollisions(c,{toiletDoors:{0:.5},toiletCabinets:{1:.25}}),true);
 assert.equal(c.routeGrids.size,0);assert.equal(c.projectileColliderCache.size,0);
 assert.deepEqual(c.furnitureVolumes.filter(v=>v.id.startsWith('toilet-door-0-')),toiletDoorSolids(0,.5));
 assert.deepEqual(c.furnitureVolumes.filter(v=>v.id.startsWith('toilet-cabinet-door-1-')),toiletCabinetDoorSolids(1,.25));
 assert.equal(updateSpecialFurnitureCollisions(c,{toiletDoors:{0:.5}}),false);
 updateSpecialFurnitureCollisions(c,{toiletDoors:{0:1}});assert.equal(clearWallSegment(a,b,c),true);near(moveInRoom(a,0,1.3,.18,c).z,b.z);
 updateLayoutDoors(c,{rearDoorClosed:true});assert.equal(clearWallSegment(a,b,c),true,'building door rebuild retains cubicle geometry');
 const before=c.furnitureVolumes;syncDrawerCollisions(c,'toilet',[{seated:true,seatId:0,_drawerOpen:true}]);assert.equal(c.dynamicSolids.length,0);assert.strictEqual(c.furnitureVolumes,before);
 for(const v of c.furnitureWalkSolids)assert.ok(c.walkSolids.includes(v));
});

test('bedside cabinet leaves use their own upper and lower geometry while office drawers remain usable',()=>{
 const c=context('dorm');updateSpecialFurnitureCollisions(c,{dormCabinets:{0:.2,1:.8}});
 for(const [id,amount] of [[0,.2],[1,.8]])assert.deepEqual(c.furnitureVolumes.filter(v=>v.id.startsWith(`dorm-cabinet-door-${id}-`)),dormCabinetDoorSolids(id,amount));
 syncDrawerCollisions(c,'dorm',[{seated:true,seatId:0,_drawerOpen:true},{seated:true,_officeChair:true,_officeDeskId:OFFICE_DESKS[0].id,_drawerOpen:true}]);
 assert.equal(c.dynamicSolids.length,1);const drawer=c.dynamicSolids[0];updateSpecialFurnitureCollisions(c,{dormCabinets:{1:.6}});assert.ok(c.walkSolids.includes(drawer));
 const other=context('dorm');assert.deepEqual(other.furnitureVolumes.filter(v=>v.id.startsWith('dorm-cabinet-door-1-')),dormCabinetDoorSolids(1,0),'rooms do not share moving cabinet state');
});

test('throws collide with the current cubicle door leaf instead of an ordinary .8m desktop',()=>{
 const c=context('toilet'),s=TOILET_STALLS[0];
 for(const open of[0,1]){
  updateSpecialFurnitureCollisions(c,{toiletDoors:{0:open}});
  const p=projectile('toilet',c,{x:s.x,z:s.z+.5,y:1.45,vx:0,vy:0,vz:5});
  for(let i=0;i<25;i++)stepSmokeProjectile(p,.008,c);
  assert.ok(open?p.z>s.z+1.35:p.z<s.z+1.19,`door ${open?'open':'closed'} must control throw passage`);
 }
 const h=context('hotpot'),t=HOTPOT_TABLES[0],p=projectile('hotpot',h,{x:t.x,z:t.z,y:1.45,vx:0,vy:-5,vz:0});
 for(let i=0;i<12;i++)stepSmokeProjectile(p,.008,h);
 assert.ok(p.bounces>0);assert.ok(p.y>1.16,'pot rim is higher than a desktop');
});

test('lower and upper bunk eyes and ink hit boxes follow sitting and lying poses above the mattress',()=>{
 for(const bed of DORM_BEDS.slice(0,2))for(const lying of[false,true]){
  const actor={id:1,x:bed.x,z:bed.z,yaw:bed.lieYaw,seated:true,seatId:bed.id,bedId:bed.id,lying};
  near(actorFloorHeight(actor,'dorm'),bed.supportHeight);near(actorEyeHeight(actor,'dorm'),lying?.23:.94);near(effectEye(actor,'dorm').y,bed.supportHeight+(lying?.23:.94));
  const body=actorBodyVolume(actor,'dorm');near(body.maxY,bed.supportHeight+(lying?.45:1.13));assert.ok(contains(body,actor.x,effectEye(actor,'dorm').y,actor.z));
  const p=projectile('dorm',null,{kind:'ink',ownerId:9,x:actor.x,z:actor.z-.6,y:bed.supportHeight+.90,vx:0,vy:0,vz:15,retired:false});
  // Empty geometry isolates swept actor contact from the physical bunk frame.
  const empty={desks:[],furnitureVolumes:[],wallVolumes:[],dynamicSolids:[]};
  const result=stepThrowableProjectile(p,.08,[actor],empty);
  assert.equal(result.effect?.hitActorId===actor.id,!lying,'a lying student cannot be hit at their former upright head position');
 }
 const lower=DORM_BEDS[0],actor={id:1,x:lower.x,z:lower.z,seated:false,bedId:lower.id};assert.equal(actorFloorHeight(actor,'dorm'),0);
 actor.seated=true;actor.officeChair=true;assert.equal(actorFloorHeight(actor,'dorm'),0);assert.equal(actorEyeHeight(actor,'dorm'),1.43);
});

test('outdoor sky, stage heights and one gate agree with movement while corridor and office stay enclosed',()=>{
 const c=context('playground'),p=PLAYGROUND_LAYOUT,stage=p.steps[2];
 assert.equal(ceilingVolumes('playground').some(v=>contains(v,0,v.minY,0)),false);
 const up=projectile('playground',c,{x:0,z:0,y:4.35,vx:0,vy:10,vz:0});stepSmokeProjectile(up,.05,c);assert.ok(up.y>4.51&&up.vy>0,'outdoor throw crosses former classroom roof');
 near(floorHeight(stage.x,stage.z-.4,'playground'),.54);assert.equal(blocked(stage.x,stage.z-.4,.18,c),false);
 const falling=projectile('playground',c,{x:stage.x,z:stage.z-.4,y:1,vx:0,vy:-5,vz:0});for(let i=0;i<20;i++)stepSmokeProjectile(falling,.008,c);assert.ok(falling.y>=.54+.07499);
 assert.ok(moveInRoom({x:6.7,z:7},2.8,0,.18,c).x>9,'single outdoor gate reaches corridor');assert.ok(moveInRoom({x:6.7,z:-8},2.8,0,.18,c).x<7.2,'former classroom rear door stays enclosed');
 assert.equal(clearWallSegment({x:9.2,z:8.5},{x:9.2,z:10},c),true);updateLayoutDoors(c,{officeLocked:true});assert.equal(clearWallSegment({x:9.2,z:8.5},{x:9.2,z:10},c),false);
 assert.deepEqual(boardForMap('playground'),p.board.writePosition);assert.deepEqual(detentionForMap('playground'),p.posts);assert.equal(boardForMap('classroom'),BOARD);assert.equal(detentionForMap('classroom'),DETENTION);
});

test('outdoor throws start at the actual far-field player and remain in the expanded field',()=>{
 const c=context('playground'),actor={id:9,x:-20,z:-40,yaw:0,seated:false};
 const p=createSmokeProjectile(actor,1,0,'playground',c);
 assert.ok(Math.abs(p.x-actor.x)<.7&&Math.abs(p.z-actor.z)<.7,'release cannot clamp to the old classroom');
 for(let i=0;i<36;i++)stepSmokeProjectile(p,1/60,c);
 assert.ok(Math.abs(p.x-actor.x)<.7&&p.z>actor.z&&p.z<actor.z+6,'projectile follows a local ballistic arc');
 assert.equal(p.firstImpact,null,'open air has no phantom old-room boundary');
});


test('projectiles see empty space under hotpot edges and inside open food cupboards',()=>{
 const hotpot=context('hotpot'),t=HOTPOT_TABLES[0],under=projectile('hotpot',hotpot,{x:t.x+1,z:t.z-1.65,y:.55,vx:0,vy:0,vz:5});
 for(let i=0;i<20;i++)stepSmokeProjectile(under,.008,hotpot);
 assert.equal(under.firstImpact,null);assert.ok(under.z>t.z-1,'a narrow pedestal leaves real air below the tabletop');
 for(const map of['toilet','dorm']){
  const c=context(map),place=c.seats[0],front=map==='toilet'?place.cabinetZ+.187:place.cabinetZ+.307,y=map==='toilet'?.91:place.cabinetY+.6;
  const a={x:place.cabinetX,y,z:front+.23},b={x:place.cabinetX,y,z:front-.16},key=map==='toilet'?'toiletCabinets':'dormCabinets';
  assert.equal(clearEffectSight(a,b,map,c),false,'closed cabinet door occludes its interior');
  updateSpecialFurnitureCollisions(c,{[key]:{0:1}});assert.equal(clearEffectSight(a,b,map,c),true,'open cupboard interior is hollow');
  const p=projectile(map,c,{...a,vx:0,vy:0,vz:-3});for(let i=0;i<15;i++)stepSmokeProjectile(p,.008,c);
  assert.equal(p.firstImpact,null);assert.ok(p.z<front,'projectile enters the open shelf bay');
 }
});
