// Observed layout: research70 first-detail 0300/0310/0320/0340/0540/0570.
// Reconstructed from the track/character/stage ratios in 0300, 0310, 0340
// and the sports bars at second-detail 0001. Metres are estimates, not a scan.
// The right-side campus gate remains at its existing world-space anchor.
const volume=(id,minX,maxX,minZ,maxZ,minY=0,maxY=2.2,extra={})=>Object.freeze({id,minX,maxX,minZ,maxZ,minY,maxY,...extra});
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
export function createPlaygroundLayout(options={}){
 const maxX=finite(options.maxX,7.20),maxZ=finite(options.maxZ,8.80);
 const width=Math.max(12,finite(options.width,maxX-finite(options.minX,-28.8)));
 const length=Math.max(width+2,finite(options.length,maxZ-finite(options.minZ,-51.2)));
 const minX=maxX-width,minZ=maxZ-length,cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
 const entranceZ=Math.min(maxZ-1.0,Math.max(minZ+1.0,finite(options.entranceZ,7.0)));
 const entranceWidth=1.72,entranceMin=entranceZ-entranceWidth/2,entranceMax=entranceZ+entranceWidth/2;
 const laneCount=3,laneWidth=.88,outerRadius=width/2-2.35,innerRadius=outerRadius-laneCount*laneWidth;
 const straightHalf=length/2-2.35-outerRadius;
 const track=Object.freeze({cx,cz,outerRadius,innerRadius,straightHalf,laneCount,laneWidth,lineWidth:.07});
 const stageZ=cz+straightHalf+innerRadius*.48,stageWidth=Math.min(7.6,innerRadius*1.3),stageDepth=3.05;
 const steps=Array.from({length:3},(_,i)=>Object.freeze({id:'playground-stage-'+i,x:cx,z:stageZ,width:stageWidth-i*.34,depth:stageDepth-i*.34,bottom:i*.18,top:(i+1)*.18}));
 const postCount=Math.min(8,Math.max(1,Math.round(finite(options.postCount,7))));
 const postSpan=steps[2].width-.68;
 const posts=Array.from({length:postCount},(_,i)=>Object.freeze({id:i,x:cx+(postCount===1?0:(i/(postCount-1)-.5)*postSpan),z:stageZ+.28,y:.54,height:2.12,radius:.064,yaw:Math.PI}));
 const board=Object.freeze({id:'playground-teacher-board',x:cx,z:maxZ-.17,y:1.40,width:3.8,height:1.46,yaw:Math.PI,writePosition:Object.freeze({x:cx,z:maxZ-.96,y:0,yaw:0})});
 const vending=Array.from({length:3},(_,i)=>Object.freeze({id:'playground-vending-'+i,x:minX+.52,z:cz-straightHalf*.72+i*straightHalf*.72,yaw:Math.PI/2,width:1.04,height:1.86,depth:.64}));
 const notices=[{x:cx+innerRadius-.18,z:cz-1.4,yaw:Math.PI/2},{x:cx-innerRadius+.18,z:cz+1.6,yaw:-Math.PI/2}].map((p,i)=>Object.freeze({...p,id:'playground-notice-'+i,width:2.45,height:1.16}));
 const bars=Array.from({length:6},(_,i)=>Object.freeze({id:'playground-bar-'+i,x:maxX-1.18,z:cz-straightHalf+1.25+i*2.35,width:1.55,height:1.55+(i%3)*.24,radius:.07}));
 const colliders=[
  volume('playground-west-wall',minX-.15,minX,minZ-.15,maxZ+.15),
  volume('playground-north-wall',minX,maxX+.15,minZ-.15,minZ),
  volume('playground-south-wall',minX,maxX+.15,maxZ,maxZ+.15),
  volume('playground-east-wall-a',maxX,maxX+.15,minZ,entranceMin),
  volume('playground-east-wall-b',maxX,maxX+.15,entranceMax,maxZ),
  ...steps.map(s=>volume(s.id,s.x-s.width/2,s.x+s.width/2,s.z-s.depth/2,s.z+s.depth/2,s.bottom,s.top,{walkable:true,kind:'step'})),
  ...posts.map(p=>volume('playground-post-'+p.id,p.x-p.radius,p.x+p.radius,p.z-p.radius,p.z+p.radius,p.y,p.y+p.height,{kind:'post'})),
  ...bars.flatMap(bar=>[-1,1].map((side,i)=>volume(bar.id+'-post-'+i,bar.x-bar.radius,bar.x+bar.radius,bar.z+side*bar.width/2-bar.radius,bar.z+side*bar.width/2+bar.radius,0,bar.height,{kind:'sports-bar'}))),
  ...vending.map(v=>volume(v.id,v.x-v.depth/2,v.x+v.depth/2,v.z-v.width/2,v.z+v.width/2,0,v.height,{kind:'vending'})),
  ...vending.map(v=>volume(v.id+'-unlock',v.x-.105,v.x+.165,v.z-v.width/2-.335,v.z-v.width/2-.085,0,1.32,{kind:'vending-button'})),
  ...notices.map(n=>volume(n.id,n.x-.22,n.x+.22,n.z-n.width/2,n.z+n.width/2,0,2.65,{kind:'notice'}))
 ];
 return Object.freeze({bounds:Object.freeze({minX,maxX,minZ,maxZ,width,length}),track,steps:Object.freeze(steps),posts:Object.freeze(posts),board,bars:Object.freeze(bars),vending:Object.freeze(vending),notices:Object.freeze(notices),colliders:Object.freeze(colliders),entrance:Object.freeze({x:maxX,z:entranceZ,minZ:entranceMin,maxZ:entranceMax,width:entranceWidth,yaw:-Math.PI/2}),connector:Object.freeze({minX:maxX,maxX:maxX+.20,minZ:entranceMin,maxZ:entranceMax}),evidence:'reference-ratio reconstruction from 0300/0310/0340 and sports bars from second video 0001; exact dimensions unmeasured'});
}
export const PLAYGROUND_LAYOUT=createPlaygroundLayout();
export const PLAYGROUND_SOLIDS=PLAYGROUND_LAYOUT.colliders;
export const PLAYGROUND_POSTS=PLAYGROUND_LAYOUT.posts;
export const PLAYGROUND_BOARD=PLAYGROUND_LAYOUT.board;
// Spawn markers keep the existing actor roster contract without inventing
// outdoor desks. They have no rendered chair, desktop or seating collider.
// Assemble near the entry at normal walking speed; enlarging the sports field
// must not force the arrival queue to sprint or teleport before class starts.
export const PLAYGROUND_SEATS=Object.freeze([5.8,4.5,3.2,1.9,.6,-.7].flatMap((z,row)=>[-4.3,-1.8,.7,3.2].map((x,col)=>{
 const id=row*4+col;
 return Object.freeze({id,row,col,x,z,deskX:x,deskZ:z,yaw:0,map:'playground',pattern:'outdoor-standing',standing:true,hideBook:true,hidePen:true});
})));
export function playgroundFloorHeight(x,z,layout=PLAYGROUND_LAYOUT){let y=0;for(const s of layout.steps)if(Math.abs(x-s.x)<=s.width/2&&Math.abs(z-s.z)<=s.depth/2)y=Math.max(y,s.top);return y;}
export function playgroundWalkable(x,z,r=.18,layout=PLAYGROUND_LAYOUT){const b=layout.bounds,c=layout.connector;return(x>=b.minX+r&&x<=b.maxX-r&&z>=b.minZ+r&&z<=b.maxZ-r)||(x>=b.maxX-r-.01&&x<=c.maxX+r&&z>=c.minZ+r&&z<=c.maxZ-r);}
