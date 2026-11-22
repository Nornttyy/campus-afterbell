// Artwork is drawn directly on the classroom monitor at its native 768 × 432.
const tiles=['','#f5c649','#58ced7','#bc8ed9','#578de1','#eba466','#77c38d','#e27876'];
function polygon(c,points,fill) {
 c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();
}
function caption(c,text,x,y,size,color,align='left'){
 c.font='bold '+size+'px "PingFang SC",system-ui,sans-serif';c.fillStyle=color;c.textAlign=align;c.fillText(text,x,y);c.textAlign='left';
}
function gem(c,x,y,r,kind){
 const [edge,base,light]=kind==='gold'?['#8e5421','#edb939','#ffeb8a']:kind==='gem'?['#337594','#73dfdf','#c7fff2']:['#514542','#84776d','#aea293'];
 c.save();c.translate(x,y);c.scale(r,r);
 polygon(c,[[-1,.12],[-.84,-.54],[-.32,-.90],[.45,-.95],[.95,-.26],[.8,.48],[.21,.89],[-.65,.72]],edge);
 polygon(c,[[-.89,.02],[-.66,-.53],[-.29,-.77],[.44,-.79],[.78,-.28],[.59,.22],[.02,.57],[-.59,.50]],base);
 polygon(c,[[-.73,-.12],[-.25,-.70],[.4,-.71],[.07,-.25]],light);c.restore();
}
function claw(c,x,y,a,amount){
 c.save();c.translate(x,y);c.rotate(-a);
 c.lineWidth=1.9;c.lineCap='round';c.strokeStyle='#34434a';
 for(const side of [-1,1]){c.beginPath();c.moveTo(0,0);c.lineTo(side*4,3);c.lineTo(side*(4+amount),6);c.lineTo(side*3,8);c.stroke();}
 c.restore();
}
export function arcadeIcon(c,app,x,y,size){
 c.save();c.translate(x,y);c.scale(size/54,size/54);
 if(app==='miner'){
  c.fillStyle='#754626';c.fillRect(1,1,52,52);c.fillStyle='#b17843';c.fillRect(3,3,48,48);gem(c,24,33,15,'gold');
  c.strokeStyle='#28383b';c.lineWidth=3;c.beginPath();c.moveTo(42,3);c.lineTo(34,22);c.stroke();claw(c,34,22,-.44,2);
 }else{
  c.fillStyle='#20334c';c.fillRect(1,1,52,52);
  for(const [i,j,k] of [[1,1,2],[1,2,2],[2,2,2],[3,2,2],[2,0,3],[3,0,3],[3,1,3],[4,1,3],[0,3,5],[1,3,5],[2,3,5],[2,4,5]])tile(c,3+i*9,4+j*9,9,k);
 }
 c.restore();
}
function tile(c,x,y,size,k,ghost=false){
 if(ghost){c.strokeStyle='#669397';c.lineWidth=1.3;c.strokeRect(x+1.5,y+1.5,size-3,size-3);return;}
 c.fillStyle=tiles[k];c.fillRect(x+.7,y+.7,size-1.4,size-1.4);c.fillStyle='#ffffff55';c.fillRect(x+1.5,y+1.5,size-3,2);
 c.fillStyle='#0d213a52';c.fillRect(x+2,y+size-3.4,size-4,1.7);
}
function result(c,text){
 c.fillStyle='#142737dd';c.fillRect(184,139,400,113);caption(c,text,384,185,31,'#fff0c2','center');
 caption(c,'确认键再来一局',384,225,21,'#ffffff','center');
}
function miner(c,g){
 c.save();c.scale(2.4,2.4);
 const ground=c.createLinearGradient(0,20,0,180);ground.addColorStop(0,'#c48f56');ground.addColorStop(.55,'#9a633f');ground.addColorStop(1,'#664238');c.fillStyle=ground;c.fillRect(0,0,320,180);
 for(let i=0;i<74;i++){const x=(i*79+17)%316,y=38+(i*43)%137;c.fillStyle=i%3?'#b080514d':'#67463855';c.fillRect(x,y,2+(i%7),1+(i%2));}
 c.fillStyle='#a8d9db';c.fillRect(0,0,320,23);
 polygon(c,[[0,22],[35,9],[66,19],[90,12],[123,21],[167,12],[203,19],[252,6],[297,19],[320,15],[320,27],[0,27]],'#79a486');
 c.fillStyle='#667846';c.fillRect(0,24,320,3);c.fillStyle='#785031';c.fillRect(0,27,320,3);
 // Cap, hands, reel, timber crosspiece.
 c.fillStyle='#34464b';c.fillRect(144,17,12,8);c.fillStyle='#d8a075';c.fillRect(148,11,8,8);
 c.fillStyle='#dda736';c.fillRect(146,8,10,5);c.fillRect(144,12,15,2);
 c.fillStyle='#775439';c.fillRect(141,21,25,5);c.fillRect(142,25,3,6);c.fillRect(163,25,3,6);
 c.fillStyle='#41494a';c.beginPath();c.arc(160,24,4,0,Math.PI*2);c.fill();
 for(const o of g.ore)gem(c,o.x,o.y,o.r,o.kind);
 const len=g.length+3,x=160+Math.sin(g.angle)*len,y=27+Math.cos(g.angle)*len;
 c.strokeStyle='#3e3931';c.lineWidth=1.15;c.beginPath();c.moveTo(160,26);c.lineTo(x,y);c.stroke();
 if(g.cargo)gem(c,x,y+5,7.8,g.cargo);claw(c,x,y,g.angle,g.cargo?0:2.5);c.restore();
 caption(c,'黄金矿工',15,34,24,'#203a44');caption(c,'金币 '+g.score,15,70,18,'#fff3ce');
 caption(c,g.time+' 秒',749,33,23,'#203a44','right');caption(c,'第 '+g.wave+' 矿区',749,68,17,'#fff3ce','right');
 c.fillStyle='#4a312bdc';c.fillRect(0,400,768,32);caption(c,'确认键或向下放钩',384,423,17,'#fff0d2','center');
 if(!g.alive)result(c,'本轮采矿结束');
}
function blocks(c,g){
 const cell=18,left=282,top=31; c.fillStyle='#1a293c';c.fillRect(0,0,768,432);
 c.fillStyle='#263b50';c.fillRect(left-6,top-6,cell*10+12,cell*20+12);c.fillStyle='#0e1f30';c.fillRect(left,top,180,360);
 c.strokeStyle='#1b3242';c.lineWidth=1;c.beginPath();
 for(let i=1;i<10;i++){c.moveTo(left+i*cell,top);c.lineTo(left+i*cell,top+360);}
 for(let i=1;i<20;i++){c.moveTo(left,top+i*cell);c.lineTo(left+180,top+i*cell);}c.stroke();
 const render=(shape,x,y,id,ghost=false)=>shape.forEach((row,j)=>Array.from(row).forEach((v,i)=>{if(v!=='0')tile(c,left+(x+i)*cell,top+(y+j)*cell,cell,id||Number(v),ghost);}));
 render(g.rows,0,0);if(g.alive)render(g.shape,g.x,g.ghost,g.type,true);render(g.shape,g.x,g.y,g.type);
 caption(c,'俄罗斯方块',32,78,31,'#f4d996');caption(c,'得分',37,144,18,'#aabac8');caption(c,String(g.score),36,185,37,'#fff3d5');
 caption(c,'已消行',37,241,18,'#aabac8');caption(c,String(g.lines),36,278,31,'#91d8ca');
 caption(c,'下一块',507,83,21,'#c8d6df');g.next.forEach((row,j)=>Array.from(row).forEach((v,i)=>{if(v==='1')tile(c,510+i*20,110+j*20,20,g.nextType);}));
 caption(c,'左右移动　向上旋转',498,263,18,'#b9cbd5');caption(c,'向下加速　确认到底',498,296,18,'#b9cbd5');
 if(!g.alive)result(c,'方块堆满了');
}
export function drawArcade(c,app,game){if(app==='tetris')blocks(c,game);else miner(c,game);}
