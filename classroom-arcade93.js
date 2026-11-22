// The round owns all game time, collisions and awards. Clients send button directions.
const ROWS=20,COLS=10,EMPTY='0'.repeat(COLS);
const pieces=['','11/11','1111','010/111','001/111','100/111','011/110','110/011'];
const kinds=['gold','rock','gold','gem','gold','rock','gold','rock','gold','gem','rock','gold'];
function random(state){
 state.seed=(Math.imul(state.seed,1664525)+1013904223)>>>0;
 return state.seed/4294967296;
}
function oreField(s){
 s.ore=kinds.map((kind,i)=>({
  kind,x:37+(i%4)*78+Math.floor(random(s)*21),y:70+Math.floor(i/4)*42+Math.floor(random(s)*12),
  r:kind==='gem'?6:8+Math.floor(random(s)*6),gone:false
 }));
 s.length=0;s.phase='swing';s.cargo=-1;
}
export function createArcade(app,seed){
 const s={app,seed:seed>>>0,score:0,earned:0,alive:true};
 if(app==='miner'){
  Object.assign(s,{time:60,wave:1,angle:0,clock:0});oreField(s);
 }else if(app==='tetris'){
  Object.assign(s,{rows:Array(ROWS).fill(EMPTY),bag:[],next:0,lines:0,gravity:0});spawn(s);
 }else return null;
 return s;
}
const hook=(s,length=s.length)=>({x:160+Math.sin(s.angle)*length,y:27+Math.cos(s.angle)*length});
function advanceMiner(s,dt){
 s.time=Math.max(0,s.time-dt);
 if(s.time===0){s.alive=false;return;}
 if(s.phase==='swing'){
  s.clock+=dt;s.angle=Math.sin(s.clock*1.52)*1.16;return;
 }
 const ore=s.ore[s.cargo];
 if(s.phase==='cast'){
  const prev=hook(s);s.length+=150*dt;const tip=hook(s);
  const dx=tip.x-prev.x,dy=tip.y-prev.y,n=dx*dx+dy*dy;let first=Infinity;
  for(const [i,o] of s.ore.entries()){
   if(o.gone)continue;
   const t=Math.max(0,Math.min(1,((o.x-prev.x)*dx+(o.y-prev.y)*dy)/(n||1)));
   if(t<first&&Math.hypot(prev.x+t*dx-o.x,prev.y+t*dy-o.y)<=o.r+2){s.cargo=i;first=t;}
  }
  if(s.cargo>=0){s.length-=Math.hypot(dx,dy)*(1-first);s.phase='reel';}
  else if(tip.x<5||tip.x>315||tip.y>=176)s.phase='reel';
 }else{
  const speed=!ore?198:ore.kind==='rock'?46:ore.kind==='gem'?121:70;
  s.length=Math.max(0,s.length-speed*dt);
  if(s.length===0){
   if(ore){ore.gone=true;if(ore.kind!=='rock'){s.score+=ore.kind==='gem'?100:ore.r*5;s.earned++;}}
   s.phase='swing';s.cargo=-1;
   if(s.ore.every(o=>o.gone||o.kind==='rock')){s.wave++;s.time=Math.min(60,s.time+15);oreField(s);}
  }
 }
}
function takePiece(s){
 if(!s.bag.length){
  s.bag=[1,2,3,4,5,6,7];
  for(let i=6;i>0;i--){const j=Math.floor(random(s)*(i+1));[s.bag[i],s.bag[j]]=[s.bag[j],s.bag[i]];}
 }
 return s.bag.pop();
}
function occupied(s,shape,x,y){
 return shape.some((row,dy)=>Array.from(row).some((v,dx)=>v==='1'&&(
  x+dx<0||x+dx>=COLS||y+dy<0||y+dy>=ROWS||s.rows[y+dy][x+dx]!=='0'
 )));
}
function spawn(s){
 s.type=s.next||takePiece(s);s.next=takePiece(s);
 s.shape=pieces[s.type].split('/');s.x=Math.floor((COLS-s.shape[0].length)/2);s.y=0;s.gravity=0;
 if(occupied(s,s.shape,s.x,0))s.alive=false;
}
function drop(s){
 if(!occupied(s,s.shape,s.x,s.y+1)){s.y++;return true;}
 for(const [dy,row] of s.shape.entries()){
  const cells=s.rows[s.y+dy].split('');
  for(let dx=0;dx<row.length;dx++)if(row[dx]==='1')cells[s.x+dx]=String(s.type);
  s.rows[s.y+dy]=cells.join('');
 }
 const kept=s.rows.filter(row=>row.includes('0')),lines=ROWS-kept.length;
 s.rows=[...Array(lines).fill(EMPTY),...kept];s.lines+=lines;s.earned+=lines;
 s.score+=[0,100,300,500,800][lines];spawn(s);return false;
}
export function arcadeInput(s,dir){
 if(!s?.alive)return false;
 if(s.app==='miner'){
  if((dir!=='confirm'&&dir!=='down')||s.phase!=='swing')return false;
  s.phase='cast';return true;
 }
 if(dir==='confirm'){while(drop(s)){}return true;}
 if(dir==='down'){drop(s);s.gravity=0;return true;}
 if(dir==='left'||dir==='right'){
  const x=s.x+(dir==='left'?-1:1);if(occupied(s,s.shape,x,s.y))return false;
  s.x=x;return true;
 }
 if(dir==='up'){
  const shape=Array.from(s.shape[0],(_,i)=>s.shape.map(r=>r[i]).reverse().join(''));
  for(const dx of [0,-1,1,-2,2])if(!occupied(s,shape,s.x+dx,s.y)){s.shape=shape;s.x+=dx;return true;}
 }
 return false;
}
export function advanceArcade(s,dt){
 if(!s)return 0;
 if(s.alive){
  if(s.app==='miner'){
   // Substeps keep a fast hook from tunnelling through a small gem on a slow tick.
   while(dt>0&&s.alive){const step=Math.min(dt,1/30);advanceMiner(s,step);dt-=step;}
  }else{
   const interval=Math.max(.13,.73-.058*Math.floor(s.lines/5));s.gravity+=dt;
   while(s.alive&&s.gravity>=interval){s.gravity-=interval;drop(s);}
  }
 }
 const earned=s.earned;s.earned=0;return earned;
}
export function arcadeSnapshot(s){
 if(!s)return null;
 if(s.app==='miner')return{score:s.score,wave:s.wave,alive:s.alive,time:Math.ceil(s.time),angle:Math.round(s.angle*512)/512,length:Math.round(s.length*2)/2,ore:s.ore.filter((o,i)=>!o.gone&&i!==s.cargo).map(({kind,x,y,r})=>({kind,x,y,r})),cargo:s.cargo<0?null:s.ore[s.cargo].kind,phase:s.phase};
 let ghost=s.y;if(s.alive)while(!occupied(s,s.shape,s.x,ghost+1))ghost++;
 return {score:s.score,alive:s.alive,lines:s.lines,rows:[...s.rows],x:s.x,y:s.y,ghost,type:s.type,shape:s.shape,next:pieces[s.next].split('/'),nextType:s.next};
}
