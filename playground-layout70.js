import {CRAWL_TUNING} from './crawl-profile.js?v=campus-83&rev=157';
// Observed layout: research70 first-detail 0300/0310/0320/0340/0540/0570.
// Reconstructed from the track/character/stage ratios in 0300, 0310, 0340
// with the central platform and freestanding board placed along the field axis.
// The right-side campus gate remains at its existing world-space anchor.
const volume=(id,minX,maxX,minZ,maxZ,minY=0,maxY=2.2,extra={})=>Object.freeze({id,minX,maxX,minZ,maxZ,minY,maxY,...extra});
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
export function createPlaygroundLayout(options={}){
 const maxX=finite(options.maxX,7.20),maxZ=finite(options.maxZ,8.80);
 const width=Math.max(12,finite(options.width,maxX-finite(options.minX,-32.8)));
 const length=Math.max(width+2,finite(options.length,maxZ-finite(options.minZ,-59.2)));
 const minX=maxX-width,minZ=maxZ-length,cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
 const entranceZ=Math.min(maxZ-1.0,Math.max(minZ+1.0,finite(options.entranceZ,7.0)));
 const entranceWidth=1.72,entranceMin=entranceZ-entranceWidth/2,entranceMax=entranceZ+entranceWidth/2;
 const rearZ=Math.max(minZ+1,Math.min(entranceMin-2,-8));
 const rearEntrance=Object.freeze({x:maxX,z:rearZ,minZ:rearZ-.86,maxZ:rearZ+.86,width:1.72});
 const laneCount=3,laneWidth=1.00,outerRadius=width/2-2.35,innerRadius=outerRadius-laneCount*laneWidth;
 const straightHalf=length/2-2.35-outerRadius;
 const track=Object.freeze({cx,cz,outerRadius,innerRadius,straightHalf,laneCount,laneWidth,lineWidth:.07});
 const stageZ=cz,stageWidth=Math.min(9.8,innerRadius*1.7),stageDepth=5.1;
 const steps=Array.from({length:3},(_,i)=>Object.freeze({id:'playground-stage-'+i,x:cx,z:stageZ,width:stageWidth-i*.34,depth:stageDepth-i*.34,bottom:i*.18,top:(i+1)*.18}));
 const postCount=Math.min(8,Math.max(1,Math.round(finite(options.postCount,8))));
 const rows=[Math.ceil(postCount/2),Math.floor(postCount/2)];
 const spacing=(steps[2].width-1.45)/3;
 const posts=rows.flatMap((count,row)=>Array.from({length:count},(_,column)=>Object.freeze({
  id:(row?rows[0]:0)+column,x:cx+(column-(count-1)/2)*spacing,
  z:stageZ+(postCount===1?0:(row?1:-1)*1.13),y:steps[2].top,height:2.12,radius:.064,yaw:Math.PI
 })));
 const boardZ=cz+stageDepth/2+2.20;
 const board=Object.freeze({id:'playground-teacher-board',x:cx,z:boardZ,y:1.40,width:3.8,height:1.46,yaw:Math.PI,writePosition:Object.freeze({x:cx,z:boardZ-.79,y:0,yaw:0})});
 const vending=Array.from({length:3},(_,i)=>Object.freeze({id:'playground-vending-'+i,x:minX+.52,z:cz-straightHalf*.72+i*straightHalf*.72,yaw:Math.PI/2,width:1.04,height:1.86,depth:.64}));
 const cooler=Object.freeze({x:vending[0].x+.29,z:(vending[0].z+vending[1].z)/2,yaw:vending[0].yaw});
 const notices=[{x:cx+innerRadius-.18,z:cz-1.4,yaw:Math.PI/2},{x:cx-innerRadius+.18,z:cz+1.6,yaw:-Math.PI/2}].map((p,i)=>Object.freeze({...p,id:'playground-notice-'+i,width:5.6,height:1.16}));
 for(const [i,v] of vending.entries())notices.push(Object.freeze({
  id:'playground-vending-notice-'+i,x:v.x+3.15,z:v.z+.62,
  yaw:v.yaw,width:4.85,height:1.10
 }));
 // Share the same framed panel dimensions with the renderer and collision.
 for(const [i,notice] of notices.entries()){
  const bottom=CRAWL_TUNING.bodyMaxY+.02;
  const centerY=bottom+(notice.height+.12)/2;
  notices[i]=Object.freeze({...notice,bottom,centerY,postHeight:bottom+notice.height+.12});
 }
 const bars=[];
 const speaker=Object.freeze({x:cx,z:cz-straightHalf*.50,y:1.18,poleHeight:5.1,yaw:0});
 const colliders=[
  volume(board.id,board.x-board.width/2-.05,board.x+board.width/2+.05,board.z-.06,board.z+.06,board.y-board.height/2-.05,board.y+board.height/2+.05),
  ...[-1,1].map(side=>{
   const x=board.x+side*(board.width/2-.28);
   return volume(board.id+'-foot-'+side,x-.08,x+.08,board.z-.27,board.z+.27,0,board.y);
  }),
  volume('field-pa-base',speaker.x-.14,speaker.x+.14,speaker.z-.25,speaker.z+.04,0,speaker.poleHeight),
  volume('playground-west-wall',minX-.15,minX,minZ-.15,maxZ+.15),
  volume('playground-north-wall',minX,maxX+.15,minZ-.15,minZ),
  volume('playground-south-wall',minX,maxX+.15,maxZ,maxZ+.15),
  volume('playground-east-wall-a',maxX,maxX+.15,minZ,rearEntrance.minZ),
  volume('playground-east-wall-middle',maxX,maxX+.15,rearEntrance.maxZ,entranceMin),
  volume('playground-east-wall-b',maxX,maxX+.15,entranceMax,maxZ),
  ...steps.map(s=>volume(s.id,s.x-s.width/2,s.x+s.width/2,s.z-s.depth/2,s.z+s.depth/2,s.bottom,s.top,{walkable:true,kind:'step'})),
  ...posts.map(p=>volume('playground-post-'+p.id,p.x-p.radius,p.x+p.radius,p.z-p.radius,p.z+p.radius,p.y,p.y+p.height,{kind:'post'})),
  ...vending.map(v=>volume(v.id,v.x-v.depth/2,v.x+v.depth/2,v.z-v.width/2,v.z+v.width/2,0,v.height,{kind:'vending'})),
  volume('ice-cream-cart',cooler.x-.365,cooler.x+.365,cooler.z-.75,cooler.z+.75,.22,.97),
  ...notices.flatMap(n=>[
   volume(n.id,n.x-.06,n.x+.06,n.z-n.width/2-.06,n.z+n.width/2+.06,n.bottom,n.postHeight+.08,{kind:'notice',crawlUnder:true}),
   ...[-1,1].map(side=>{
    const z=n.z+side*(n.width/2-.08);
    return volume(n.id+'-leg-'+side,n.x-.035,n.x+.035,z-.035,z+.035,0,n.postHeight,{kind:'notice-leg'});
   })
  ])
 ];
 return Object.freeze({cooler,bounds:Object.freeze({minX,maxX,minZ,maxZ,width,length}),speaker,rearEntrance,track,steps:Object.freeze(steps),posts:Object.freeze(posts),board,bars:Object.freeze(bars),vending:Object.freeze(vending),notices:Object.freeze(notices),colliders:Object.freeze(colliders),entrance:Object.freeze({x:maxX,z:entranceZ,minZ:entranceMin,maxZ:entranceMax,width:entranceWidth,yaw:-Math.PI/2}),connector:Object.freeze({minX:maxX,maxX:maxX+.20,minZ:entranceMin,maxZ:entranceMax}),evidence:'reference-ratio reconstruction from 0300/0310/0340; exact dimensions unmeasured'});
}
// Shared points on the front of the cabinet, in metres. Picking and reach
// checks use the same points for every orientation of the cabinet.
export function vendingPoint(machine,part){
 const button=part==='button',side=button?machine.width/2-.155:-.11;
 const front=machine.depth/2+(button ? .085 : .42),sin=Math.sin(machine.yaw),cos=Math.cos(machine.yaw);
 return {x:machine.x+cos*side+sin*front,y:button ? 1.19 : .008,z:machine.z-sin*side+cos*front};
}
export function canReachVending(actor,machine,part){
 const point=vendingPoint(machine,part),dx=actor.x-machine.x,dz=actor.z-machine.z;
 const front=dx*Math.sin(machine.yaw)+dz*Math.cos(machine.yaw);
 return front>.12&&Math.hypot(actor.x-point.x,actor.z-point.z)<1.7;
}
export const VENDING_FALL_SECONDS=.34;
export const PLAYGROUND_LAYOUT=createPlaygroundLayout();
const populationLayouts=new Map([[8,PLAYGROUND_LAYOUT]]);
export function playgroundForPlayers(count=8){
 const size=Math.min(8,Math.max(1,Math.round(finite(count,8))));
 if(!populationLayouts.has(size))populationLayouts.set(size,createPlaygroundLayout({postCount:size}));
 return populationLayouts.get(size);
}
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
export function onRunningTrack(x,z,track=PLAYGROUND_LAYOUT.track){
 const r=Math.hypot(x-track.cx,Math.max(0,Math.abs(z-track.cz)-track.straightHalf));
 return r>=track.innerRadius&&r<=track.outerRadius;
}
export function playgroundFloorHeight(x,z,layout=PLAYGROUND_LAYOUT){let y=0;for(const s of layout.steps)if(Math.abs(x-s.x)<=s.width/2&&Math.abs(z-s.z)<=s.depth/2)y=Math.max(y,s.top);return y;}
export function playgroundWalkable(x,z,r=.18,layout=PLAYGROUND_LAYOUT){const b=layout.bounds,c=layout.connector;return(x>=b.minX+r&&x<=b.maxX-r&&z>=b.minZ+r&&z<=b.maxZ-r)||(x>=b.maxX-r-.01&&x<=c.maxX+r&&[c,layout.rearEntrance].some(g=>z>=g.minZ+r&&z<=g.maxZ-r));}
