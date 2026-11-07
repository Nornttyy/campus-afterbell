import test from 'node:test';
import assert from 'node:assert/strict';
import {createSmokeProjectile,stepSmokeProjectile,smokeEnvelope} from '../dist/smoke-physics.js';
import {ROOM,DESKS,AISLES,CEILING_HEIGHT} from '../dist/classroom-layout.js';

const actor={id:9,x:AISLES[1],z:-4,yaw:0,pitch:0,seated:false};
const advance=(p,seconds)=>{let collisions=[];for(let i=0;i<seconds*120;i++)collisions.push(...stepSmokeProjectile(p,1/120));return collisions;};

test('aim controls throw heading and upward throws travel farther than downward throws',()=>{
  const right=createSmokeProjectile({...actor,yaw:Math.PI/2},1);assert.ok(right.vx>4);assert.ok(Math.abs(right.vz)<1e-6);
  const up=createSmokeProjectile({...actor,pitch:-.2},2),down=createSmokeProjectile({...actor,pitch:.7},3);
  advance(up,.5);advance(down,.5);assert.ok(up.y>down.y+.5);assert.ok(down.firstImpact!==null);
  assert.ok(up.z-actor.z>1,'Projectile must actually travel through the world');
});
test('a level throw visibly rises, crests, then falls on the gravity parabola at every frame rate',()=>{
  const start=createSmokeProjectile(actor,1),flight=.75,apexTime=start.vy/9.8;
  const apex={...start};stepSmokeProjectile(apex,apexTime);
  assert.equal(apex.firstImpact,null);assert.ok(apex.y-start.y>.45,'The lob must have a visible upward leg');
  assert.ok(Math.abs(apex.vy)<1e-10);
  for(const fps of [20,30,60,120,144]){
    const p={...start};let time=0;
    while(time<flight-1e-9){const dt=Math.min(1/fps,flight-time);stepSmokeProjectile(p,dt);time+=dt;
      assert.equal(p.firstImpact,null);
      assert.ok(Math.abs(p.y-(start.y+start.vy*time-4.9*time*time))<1e-9);
      assert.ok(Math.abs(p.z-(start.z+start.vz*time))<1e-9);
    }
    assert.ok(p.vy<0);assert.ok(p.y<apex.y-.6,'The downward leg must be visible before contact');
  }
});
test('release point follows the left palm when the player turns or changes stance',()=>{
  const facing=createSmokeProjectile({...actor,seated:true},1),turned=createSmokeProjectile({...actor,seated:true,yaw:Math.PI},2);
  assert.ok(facing.x>actor.x);assert.ok(turned.x<actor.x);
  const standing=createSmokeProjectile(actor,3),crouched=createSmokeProjectile({...actor,crouched:true},4);
  assert.ok(standing.y>facing.y&&facing.y>crouched.y);
});
test('canisters bounce off floor, walls, ceiling and thin desk tops without tunnelling',()=>{
  const floor=createSmokeProjectile(actor,1);floor.y=.2;floor.vy=-8;floor.vx=floor.vz=0;
  const hit=advance(floor,.05);assert.ok(hit.length);assert.ok(floor.y>=.075);assert.ok(floor.vy>0);
  const wall=createSmokeProjectile({...actor,x:ROOM.maxX-.12,yaw:Math.PI/2},2);wall.x=ROOM.maxX-.1;
  advance(wall,.05);assert.ok(wall.x<=ROOM.maxX-.075);assert.ok(wall.vx<0);
  const ceiling=createSmokeProjectile(actor,3);ceiling.y=CEILING_HEIGHT-.18;ceiling.vy=10;advance(ceiling,.05);assert.ok(ceiling.vy<0);assert.ok(ceiling.y<=CEILING_HEIGHT-.075);
  const d=DESKS[0],desk=createSmokeProjectile(actor,4);Object.assign(desk,{x:(d.minX+d.maxX)/2,z:(d.minZ+d.maxZ)/2,y:1.2,vx:0,vy:-20,vz:0});
  advance(desk,.04);assert.ok(desk.bounces>0);assert.ok(desk.y>=.97);assert.ok(desk.vy>0);
});
test('settled canisters stay at rest instead of jittering or sinking into a surface',()=>{
  const p=createSmokeProjectile(actor,1);advance(p,4);assert.equal(p.settled,true);const {x,y,z,spinX,spinZ}=p;
  advance(p,2);assert.deepEqual([p.x,p.y,p.z,p.spinX,p.spinZ],[x,y,z,spinX,spinZ]);
  for(const d of DESKS)assert.ok(!(p.x>d.minX-.075&&p.x<d.maxX+.075&&p.z>d.minZ-.075&&p.z<d.maxZ+.075&&p.y>.725&&p.y<.97),'Canister settled inside a desk');
});
test('smoke expands before reaching full cover and fades before removal',()=>{
  const start=smokeEnvelope(0,7),mid=smokeEnvelope(.6,6.4),full=smokeEnvelope(2,5),end=smokeEnvelope(6.9,.1);
  assert.equal(start.density,0);assert.ok(mid.radius>start.radius&&mid.radius<full.radius);assert.ok(full.radius<=1.9);
  assert.ok(end.density<.1);assert.equal(smokeEnvelope(7,0).density,0);
});

test('charged throws land farther along the same aim direction',()=>{
 const distances=[];
 for(const charge of [0,.5,1]){const p=createSmokeProjectile(actor,1,charge),start=p.z;for(let i=0;i<360&&p.firstImpact===null;i++)stepSmokeProjectile(p,1/120);distances.push(p.z-start);}
 assert.ok(distances[1]>distances[0]+1&&distances[2]>distances[1]+1);
});
