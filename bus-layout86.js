// The station stays in lift coordinates. The two saloons occupy the same x/z
// footprint, so a position on the coach includes its deck.
const rect=(minX,maxX,minZ,maxZ)=>({minX,maxX,minZ,maxZ});
const volume=(id,minX,maxX,minZ,maxZ,minY,maxY)=>({id,minX,maxX,minZ,maxZ,minY,maxY});
export const BUS=Object.freeze({
 body:rect(-6.7,13.4,-15.85,-10.75), station:rect(7.2,12.44,-6.9,8.8),
 lift:rect(8.96,12.02,8.68,12.28), apron:rect(-8.6,15.5,-18.1,-6.9), forecourt:rect(-8.6,7.18,-7.45,3.2),
 entry:rect(9.15,10.95,-11.20,-9.72), stairs:rect(-1.05,3.54,-12.42,-11.09),
 low:.70, high:3.28, gate:[7.76,9.46], driver:{x:12.29,z:-14.18,yaw:-Math.PI/2,pitch:0},
 board:{x:9.15,z:-14.98}, lockerZ:-5.02
});
const {low,high,body,stairs}=BUS;
// Heights are above each deck. The lip ends behind the passenger's shins.
export const COACH_CUSHION=Object.freeze({
 'bus-seat':Object.freeze({top:.410,width:.67,depth:.51,centerZ:-.030}),
 'bus-table':Object.freeze({top:.343,width:.64,depth:.44,centerZ:-.052})
});
const within=(r,x,z,p=0)=>x>=r.minX+p&&x<=r.maxX-p&&z>=r.minZ+p&&z<=r.maxZ-p;
const wall=(id,x1,x2,z1,z2,d=0,h=2.59)=>volume(id,x1,x2,z1,z2,d?high:low,(d?high:low)+h);
export const BUS_POSTS=Object.freeze([-.90,-1.72,-2.54,-3.36,-4.18,-5].map((x,id)=>({x,z:-15.35,id,busDeck:1})));
const seats=[];
function seat(x,z,yaw,deck,exitX,exitZ,deskX,deskZ) {
 const id=seats.length;
 seats.push(Object.freeze({id,x,z,yaw,busDeck:deck,supportHeight:deck?high:low,exitX,exitZ,deskX,deskZ,row:Math.floor(id/4),col:id%4,pattern:'coach',map:'bus',surface:deck?'bus-table':'bus-seat',hideBook:!deck,hidePen:!deck}));
}
for(const rowX of [.45,2.65,4.85,7.05])for(const z of [-15.18,-14.32,-12.30,-11.43]){
 const x=z>-13&&rowX<3?rowX-5.96:rowX;
 seat(x,z,Math.PI/2,0,x+.69,z,x+1.23,z);
}
for(const x of [-.05,3.95,7.95])for(const side of [-1,1])for(const z of [-14.68,-13.71])seat(x+side*.97,z,-side*Math.PI/2,1,x+side*1.65,z,x,z);
export const BUS_SEATS=Object.freeze(seats);
export const BUS_WALLS=Object.freeze([
 volume('station-west',7.13,7.23,-6.88,8.85,0,3.68),volume('station-east',12.40,12.5,-6.88,8.85,0,3.68),
 volume('station-front-a',7.17,BUS.gate[0],-6.95,-6.85,0,3.68),volume('station-front-b',BUS.gate[1],12.48,-6.95,-6.85,0,3.68),
 volume('lift-front-west',7.17,9.50,8.74,8.86,0,3.68),volume('lift-front-east',11.48,12.45,8.74,8.86,0,3.68),
 ...[0,1].flatMap(d=>[wall('bus-far-side-'+d,body.minX,body.maxX,body.minZ,body.minZ+.10,d,d?.99:2.58),wall('tail-'+d,body.minX,body.minX+.12,body.minZ,body.maxZ,d,d?.99:2.58),wall('nose-'+d,body.maxX-.12,body.maxX,body.minZ,body.maxZ,d,d?.99:2.58)]),
 wall('coach-side-back',body.minX,9.15,body.maxZ-.10,body.maxZ),wall('coach-side-front',10.95,body.maxX,body.maxZ-.10,body.maxZ),
 wall('upper-rail',body.minX,body.maxX,body.maxZ-.10,body.maxZ,1,.99),
 wall('wc-side',-6.55,-3.78,-13.67,-13.57),wall('wc-doorjamb',-3.91,-3.79,-15.78,-14.84),
 wall('driver-divider',11.06,11.16,-15.77,-13.49),
 // A guard on the aisle side of the stairwell prevents a sideways deck change.
 wall('stair-rail-lower',stairs.minX,stairs.maxX,stairs.minZ-.07,stairs.minZ,0,1.05),
 wall('stair-rail-upper',stairs.minX,stairs.maxX,stairs.minZ-.07,stairs.minZ,1,.99),
 wall('stair-outer-lower',stairs.minX,stairs.maxX,stairs.maxZ,stairs.maxZ+.07,0,1.05),
 wall('stair-outer-upper',stairs.minX,stairs.maxX,stairs.maxZ,stairs.maxZ+.07,1,.99)
]);
const lowerCabin=within.bind(null,body);
export function onBus(x,z){return lowerCabin(x,z);}
export function onBusStair(x,z){return within(stairs,x,z);}
const centre=(stairs.minX+stairs.maxX)/2;
export function busFloorHeight(x,z,deck=0){
 if(onBusStair(x,z))return low+(high-low)*(stairs.maxX-x)/(stairs.maxX-stairs.minX);
 if(deck===1)return high;
 if(onBus(x,z))return low;
 if(within(BUS.entry,x,z))return low*Math.max(0,Math.min(1,(BUS.entry.maxZ-z)/(BUS.entry.maxZ-body.maxZ)));
 return 0;
}
export function busFootprint(x,z,r=0,deck=0){
 if(deck===1)return within(body,x,z,r);
 return within(body,x,z,r)||within(BUS.apron,x,z,r)||within(BUS.forecourt,x,z,r)||within(BUS.station,x,z,r)||within(BUS.lift,x,z,r)||
  (x>BUS.gate[0]+r&&x<BUS.gate[1]-r&&Math.abs(z+6.9)<r+.06)||
  (x>9.5+r&&x<11.48-r&&z>8.62-r&&z<8.92+r);
}
const fixedFurniture=BUS_SEATS.map(s=>{
 const half=COACH_CUSHION[s.surface].width/2;
 return s.busDeck?wall('upper-chair-'+s.id,s.x-.19,s.x+.19,s.z-half,s.z+half,1,.64):wall('coach-chair-'+s.id,s.x-.30,s.x+.23,s.z-half,s.z+half,0,1.02);
});
for(const s of BUS_SEATS.filter(s=>!s.busDeck))fixedFurniture.push(wall('seat-cabinet-'+s.id,s.deskX-.195,s.deskX+.195,s.z-.286,s.z+.286,0,.90));
for(const x of [-.05,3.95,7.95])fixedFurniture.push(wall('upper-table-'+x,x-.53,x+.53,-15.19,-13.16,1,.86));
for(const p of BUS_POSTS)fixedFurniture.push(wall('upper-post-'+p.id,p.x-.10,p.x+.10,p.z-.10,p.z+.10,1,2.06));
fixedFurniture.push(wall('driver-seat',12.47,12.91,-15.14,-14.53,0,.99),wall('wc-seat',-6.33,-5.56,-15.14,-14.55,0,.78));
export const BUS_FURNITURE=Object.freeze(fixedFurniture);
export const BUS_DECK_SLABS=Object.freeze([
 volume('upper-floor-far',body.minX,body.maxX,body.minZ,stairs.minZ,high-.17,high),
 volume('upper-floor-near',body.minX,body.maxX,stairs.maxZ,body.maxZ,high-.17,high),
 volume('upper-floor-rear',body.minX,stairs.minX,stairs.minZ,stairs.maxZ,high-.17,high),
 volume('upper-floor-front',stairs.maxX,body.maxX,stairs.minZ,stairs.maxZ,high-.17,high)
]);
const decks=[0,1].map(deck=>[...BUS_WALLS,...BUS_FURNITURE].filter(s=>deck?s.minY>=high:s.minY<high));
const touches=(s,x,z,r)=>x>s.minX-r&&x<s.maxX+r&&z>s.minZ-r&&z<s.maxZ+r;
function passengerDoorBlocks(context){return !!context.busDeparted||(context.doorMotion?.front?.amount??(context.frontDoorClosed?0:1))<.64;}
export function busBlocked(x,z,r=.18,deck=0,ctx={}){
 if(ctx.busDeparted&&!within(body,x,z,r))return true;
 if(!busFootprint(x,z,r,deck))return true;
 if(!deck&&ctx.elevatorClosed&&x>9.48-r&&x<11.5+r&&Math.abs(z-8.80)<r+.06)return true;
 if(!deck&&ctx.officeLocked&&x>11.03-r&&x<11.20+r&&z>=-13.52-r&&z<=body.maxZ)return true;
 if(!deck&&passengerDoorBlocks(ctx)&&x>9.12-r&&x<10.99+r&&Math.abs(z-body.maxZ)<r+.06)return true;
 return decks[deck===1?1:0].some(s=>touches(s,x,z,r));
}
export function busSight(a,b,ctx={}){
 const da=a.busDeck??0,db=b.busDeck??0;
 if(da!==db&&!(onBusStair(a.x,a.z)&&onBusStair(b.x,b.z)))return false;
 if(!da&&passengerDoorBlocks(ctx)&&onBus(a.x,a.z)!==onBus(b.x,b.z))return false;
 const length=Math.hypot(a.x-b.x,a.z-b.z),n=Math.max(1,Math.ceil(length/.11));
 for(let i=1;i<n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(BUS_WALLS.some(s=>((s.minY>=high)===Boolean(da))&&touches(s,x,z,0)))return false;}return true;
}
function transition(x,z,nx,nz,deck){
 const was=onBusStair(x,z),is=onBusStair(nx,nz);
 if(was&&!is){if(nx>=stairs.maxX)return 0;if(nx<=stairs.minX)return 1;return -1;}
 if(!was&&is){if(x<=stairs.minX&&deck!==1||x>=stairs.maxX&&deck!==0||x>stairs.minX&&x<stairs.maxX)return -1;}
 return is?Number(nx<centre):deck;
}
export function moveOnBus(pos,dx,dz,r=.18,ctx={}){
 let {x,z}=pos,deck=pos.busDeck===1?1:0;
 const n=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.075));
 for(let i=0;i<n;i++){for(const [a,b]of [[dx/n,0],[0,dz/n]]){if(!a&&!b)continue;const nx=x+a,nz=z+b,d=transition(x,z,nx,nz,deck);if(d>=0&&!busBlocked(nx,nz,r,d,ctx)){x=nx;z=nz;deck=d;}}}return{x,z,busDeck:deck};
}
// A small two-level grid is shared by all arrivals at this door state. The
// only graph edge between decks lies inside the flight of stairs.
const cache=new Map(),step=.28,x0=-8.56,z0=-18.08,W=87,H=110,N=W*H;
function grid(radius,ctx){
 const key=[radius,Number(!!ctx.officeLocked),Number(!!ctx.elevatorClosed),Number(!!ctx.busDeparted),Number(passengerDoorBlocks(ctx))].join('/');
 if(cache.has(key))return cache.get(key);
 const pass=new Uint8Array(N*2),edges=new Int32Array(N*8);edges.fill(-1);
 const point=i=>({x:x0+(i%W)*step,z:z0+Math.floor((i%N)/W)*step,busDeck:i>=N?1:0});
 for(let i=0;i<pass.length;i++){const p=point(i);pass[i]=Number(!busBlocked(p.x,p.z,radius,p.busDeck,ctx)&&(!onBusStair(p.x,p.z)||p.busDeck===Number(p.x<centre)));}
 const offsets=[1,-1,W,-W];
 for(let i=0;i<pass.length;i++)if(pass[i]){const a=point(i);for(const [k,off]of offsets.entries()){const j=(i%N)+off;if(j<0||j>=N||Math.abs(j%W-i%W)>1)continue;const b=point(j),d=transition(a.x,a.z,b.x,b.z,a.busDeck);if(d<0||!pass[j+d*N])continue;const end=moveOnBus(a,b.x-a.x,b.z-a.z,radius,ctx);if(end.busDeck===d&&Math.hypot(end.x-b.x,end.z-b.z)<.001)edges[i*4+k]=j+d*N;}}
 const g={pass,edges,point};if(cache.size>14)cache.clear();cache.set(key,g);return g;
}
export function busRoute(a,b,r=.18,ctx={}){
 const g=grid(r,ctx);
 function nearest(p){const col=Math.round((p.x-x0)/step),row=Math.round((p.z-z0)/step);let id=-1,best=Infinity;
 for(let j=-4;j<=4;j++)for(let i=-4;i<=4;i++){const x=col+i,z=row+j;if(x<0||x>=W||z<0||z>=H)continue;const q=x+z*W+(p.busDeck===1?N:0);if(!g.pass[q])continue;const t=g.point(q),d=Math.hypot(t.x-p.x,t.z-p.z);if(d<best){const v=moveOnBus(p,t.x-p.x,t.z-p.z,r,ctx);if(Math.hypot(v.x-t.x,v.z-t.z)<.003){id=q;best=d;}}}return id;}
 const start=nearest(a),end=nearest(b);if(start<0||end<0)return[];
 const prev=new Int32Array(2*N);prev.fill(-1);prev[start]=start;const queue=new Int32Array(2*N);queue[0]=start;let tail=1;
 for(let h=0;h<tail&&prev[end]<0;h++){const q=queue[h];for(let k=0;k<4;k++){const v=g.edges[q*4+k];if(v>=0&&prev[v]<0){prev[v]=q;queue[tail++]=v;}}}
 if(prev[end]<0)return[];const path=[];for(let q=end;q!==start;q=prev[q])path.push(g.point(q));path.push(g.point(start));path.reverse();
 const out=[];for(let i=0;i<path.length;i++){const p=path[i],l=path[i-1],n=path[i+1];if(!l||!n||l.busDeck!==n.busDeck||(l.x!==p.x||p.x!==n.x)&&(l.z!==p.z||p.z!==n.z))out.push(p);}out.push({...b});
 // Remove grid corners only when a swept actor can follow the diagonal
 // without sliding. This keeps a normal-speed procession inside the bell.
 const smooth=[];let prevPoint=a;
 for(let j=0;j<out.length;j++){while(j+1<out.length&&out[j].busDeck===out[j+1].busDeck&&out[j].busDeck===prevPoint.busDeck&&straight(prevPoint,out[j+1],r,ctx))j++;smooth.push(out[j]);prevPoint=out[j];}
 return smooth;
}

function straight(a,b,r,ctx){
 const n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.14)),dx=(b.x-a.x)/n,dz=(b.z-a.z)/n;
 let p=a;for(let i=1;i<=n;i++){p=moveOnBus(p,dx,dz,r,ctx);if(Math.hypot(p.x-a.x-i*dx,p.z-a.z-i*dz)>.002||p.busDeck!==b.busDeck)return false;}return true;
}
