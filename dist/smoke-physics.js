import {ROOM,DESKS,enclosureVolumes,LECTERN,OFFICE_SOLIDS,floorTiles,floorHeight} from './classroom-layout.js?v=campus-60';
import {CRAWL_TUNING} from './crawl-profile.js?v=campus-60';

const R=.075,GRAVITY=9.8;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const colliderCache=new Map();
function tablesFor(map='classroom',layout=null){const key=map,cache=layout?(layout.projectileColliderCache??=new Map()):colliderCache;if(!cache.has(key))cache.set(key,[...(layout?.desks||DESKS).map(d=>{const h=floorHeight((d.minX+d.maxX)/2,(d.minZ+d.maxZ)/2,map);return{...d,minY:h+.80,maxY:h+.895};}),...enclosureVolumes(map,layout),...OFFICE_SOLIDS,...floorTiles(map).map(t=>({...t,minY:0,maxY:t.height})),{...LECTERN,minY:.16,maxY:1.15}]);return cache.get(key);}

function safeRelease(origin,hand,map,layout){
  const tables=tablesFor(map,layout);
  let travel=1;
  // Sweep the canister out from the player rather than spawning beyond a wall.
  for(const box of tables){
    let lo=0,hi=1;
    for(const axis of ['x','y','z']){
      const d=hand[axis]-origin[axis],min=box['min'+axis.toUpperCase()]-R,max=box['max'+axis.toUpperCase()]+R;
      if(Math.abs(d)<1e-9){if(origin[axis]<min||origin[axis]>max){lo=2;break;}}
      else{const a=(min-origin[axis])/d,b=(max-origin[axis])/d;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
    }
    if(lo<=hi&&lo<=1&&hi>=0)travel=Math.min(travel,Math.max(0,lo-.002));
  }
  const p=Object.fromEntries(['x','y','z'].map(axis=>[axis,origin[axis]+(hand[axis]-origin[axis])*travel]));
  p.x=clamp(p.x,ROOM.minX+R,ROOM.maxX-R);p.z=clamp(p.z,ROOM.minZ+R,ROOM.maxZ-R);
  p.y=Math.max(p.y,floorHeight(p.x,p.z,map)+R);return p;
}

export function createSmokeProjectile(actor,id,charge=0,map='classroom',layout=null){
  charge=clamp(Number.isFinite(charge)?charge:0,0,1);
  const yaw=actor.yaw||0,pitch=actor.pitch||0,elevation=clamp(.66-pitch,-.8,1.2),speed=5.2+2.8*charge;
  // Release from the left palm, in the same look basis as the first-person camera.
  // Horizontal aim adds an upward lob; looking down still permits a close throw.
  const eye=floorHeight(actor.x,actor.z,map)+(actor.seated?1.43:actor.crouched?CRAWL_TUNING.eyeHeight:1.65);
  const forward=.55*Math.cos(pitch)-.06*Math.sin(pitch);
  const release=safeRelease({x:actor.x,y:eye,z:actor.z},{x:actor.x+Math.sin(yaw)*forward+Math.cos(yaw)*.14,
    y:eye-.55*Math.sin(pitch)-.06*Math.cos(pitch),z:actor.z+Math.cos(yaw)*forward-Math.sin(yaw)*.14},map,layout);
  return{id,ownerId:actor.id,charge,map,...release,
    vx:Math.sin(yaw)*Math.cos(elevation)*speed,vy:Math.sin(elevation)*speed,
    vz:Math.cos(yaw)*Math.cos(elevation)*speed,age:0,firstImpact:null,bounces:0,
    spinX:0,spinZ:0,settled:false,restTime:0,emitting:false};
}

// Small swept steps keep a thrown canister from tunnelling through desk slabs.
export function stepSmokeProjectile(p,dt,layout=null){
  const map=p.map||'classroom',tables=tablesFor(map,layout);
  let impacts=[];
  const count=Math.max(1,Math.ceil(dt/.008)),h=dt/count;
  for(let i=0;i<count;i++){
    p.age+=h;if(p.settled){p.restTime+=h;continue;}
    p.restTime=0;
    const before={x:p.x,y:p.y,z:p.z};
    // Exact constant-gravity integration between contacts. Frame size cannot
    // flatten the arc or change its apex; collisions start a new ballistic leg.
    p.x+=p.vx*h;p.y+=p.vy*h-.5*GRAVITY*h*h;p.z+=p.vz*h;p.vy-=GRAVITY*h;
    let normal=null;
    if(p.y<floorHeight(p.x,p.z,map)+R){p.y=floorHeight(p.x,p.z,map)+R;normal=[0,1,0];}
    if(p.x<ROOM.minX+R){p.x=ROOM.minX+R;normal=[1,0,0];}
    else if(p.x>ROOM.maxX-R){p.x=ROOM.maxX-R;normal=[-1,0,0];}
    if(p.z<ROOM.minZ+R){p.z=ROOM.minZ+R;normal=[0,0,1];}
    else if(p.z>ROOM.maxZ-R){p.z=ROOM.maxZ-R;normal=[0,0,-1];}
    for(const d of tables){
      if(p.x<d.minX-R||p.x>d.maxX+R||p.z<d.minZ-R||p.z>d.maxZ+R||p.y<d.minY-R||p.y>d.maxY+R)continue;
      const faces=[['y',d.maxY+R,1],['y',d.minY-R,-1],['x',d.minX-R,-1],['x',d.maxX+R,1],['z',d.minZ-R,-1],['z',d.maxZ+R,1]];
      const crossed=faces.filter(([axis,b,sign])=>sign*(before[axis]-b)>=-1e-7);
      const [axis,b,sign]=(crossed.length?crossed:faces).sort((a,b)=>Math.abs(p[a[0]]-a[1])-Math.abs(p[b[0]]-b[1]))[0];
      p[axis]=b;normal=[axis==='x'?sign:0,axis==='y'?sign:0,axis==='z'?sign:0];break;
    }
    if(normal){
      const vn=p.vx*normal[0]+p.vy*normal[1]+p.vz*normal[2],impact=Math.abs(vn);
      if(vn<0){
        const restitution=impact>.65?.32:0;
        p.vx-=normal[0]*vn*(1+restitution);p.vy-=normal[1]*vn*(1+restitution);p.vz-=normal[2]*vn*(1+restitution);
        if(normal[1]>.5){p.vx*=.55;p.vz*=.55;}
        if(impact>.35){p.bounces++;impacts.push({x:p.x,y:p.y,z:p.z,strength:impact});}
        if(p.firstImpact===null)p.firstImpact=p.age;
        if(normal[1]>.5&&Math.hypot(p.vx,p.vy,p.vz)<.22){p.vx=p.vy=p.vz=0;p.settled=true;}
      }
    }
    p.spinX+=h*(p.vz*3+(!p.settled?1:0));p.spinZ-=h*p.vx*3;
  }
  return impacts;
}

export function smokeEnvelope(age,remaining){
  const x=clamp(age/1.35,0,1),growth=x*x*(3-2*x),fade=clamp(remaining/1.65,0,1);
  return{radius:.22+1.68*growth,density:Math.min(1,age/.45)*fade};
}
