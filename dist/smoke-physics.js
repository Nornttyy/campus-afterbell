import {ROOM,DESKS} from './classroom-layout.js';

const R=.075,GRAVITY=9.8;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const tables=DESKS.map(d=>({...d,minY:.80,maxY:.895}));

export function createSmokeProjectile(actor,id,charge=0){
  charge=clamp(Number.isFinite(charge)?charge:0,0,1);
  const yaw=actor.yaw||0,pitch=actor.pitch||0,elevation=clamp(.66-pitch,-.8,1.2),speed=5.2+2.8*charge;
  // Release from the left palm, in the same look basis as the first-person camera.
  // Horizontal aim adds an upward lob; looking down still permits a close throw.
  const eye=actor.seated?1.43-(actor.crouched?.24:0):actor.crouched?1.02:1.65;
  const forward=.55*Math.cos(pitch)-.06*Math.sin(pitch);
  return{id,ownerId:actor.id,charge,x:actor.x+Math.sin(yaw)*forward+Math.cos(yaw)*.14,
    y:eye-.55*Math.sin(pitch)-.06*Math.cos(pitch),z:actor.z+Math.cos(yaw)*forward-Math.sin(yaw)*.14,
    vx:Math.sin(yaw)*Math.cos(elevation)*speed,vy:Math.sin(elevation)*speed,
    vz:Math.cos(yaw)*Math.cos(elevation)*speed,age:0,firstImpact:null,bounces:0,
    spinX:0,spinZ:0,settled:false,restTime:0,emitting:false};
}

// Small swept steps keep a thrown canister from tunnelling through desk slabs.
export function stepSmokeProjectile(p,dt){
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
    if(p.y<R){p.y=R;normal=[0,1,0];}
    else if(p.y>4.28-R){p.y=4.28-R;normal=[0,-1,0];}
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
