import * as T from './vendor/three.module.js';
import {BUS,BUS_SEATS} from './bus-layout86.js?v=campus-94';
import {sectionRandom} from './excursion-journey91.js?v=campus-93';

// Upholstered pieces taper and lean independently of the passenger's level
// sitting surface. The ivory piping follows the same cross section as the pad.
export function coachPad(rings){
 const p=[],uv=[],indices=[],segments=5,loop=4*(segments+1);
 for(const [i,[y,width,depth,z,radius]] of rings.entries()){
  for(let corner=0;corner<4;corner++){
   const sx=corner===0||corner===3?1:-1,sz=corner<2?1:-1;
   for(let j=0;j<=segments;j++){
    const a=(corner+j/segments)*Math.PI*.5;
    p.push(sx*(width*.5-radius)+Math.cos(a)*radius,y,z+sz*(depth*.5-radius)+Math.sin(a)*radius);
    uv.push((corner+j/segments)*.25,i/(rings.length-1));
   }
  }
 }
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<loop;j++){
  const a=i*loop+j,b=i*loop+(j+1)%loop;
  indices.push(a,a+loop,b,b,a+loop,b+loop);
 }
 for(let j=1;j<loop-1;j++){
  indices.push(0,j,j+1);const last=(rings.length-1)*loop;indices.push(last,last+j+1,last+j);
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setIndex(indices);g.computeVertexNormals();return g;
}

export function seatPads(cushion,upper){
 const width=cushion.width,top=cushion.top,high=upper?.94:1.115;
 return {
  base:coachPad([[top-.115,width-.08,cushion.depth-.07,cushion.centerZ,.071],[top-.091,width,cushion.depth,cushion.centerZ,.083],[top-.025,width,cushion.depth,cushion.centerZ,.083],[top,width-.055,cushion.depth-.053,cushion.centerZ,.078]]),
  back:coachPad([[top-.032,width-.12,.145,-.20,.060],[top+.046,width-.065,.188,-.21,.074],[high-.089,width,.217,-.281,.083],[high-.02,width-.034,.204,-.285,.079],[high,width-.106,.168,-.285,.068]]),
  piping:coachPad([[high-.028,width-.034,.208,-.285,.080],[high-.011,width-.038,.208,-.285,.081],[high+.009,width-.10,.178,-.285,.073]]),
  head:coachPad([[high+.021,width-.16,.145,-.290,.067],[high+.041,width-.13,.175,-.290,.077],[high+.196,width-.15,.175,-.306,.077],[high+.225,width-.212,.143,-.306,.066]])
 };
}

export function stationFrost(c,w,h){
 const sky=c.createLinearGradient(0,0,w*.25,h);
 for(const [i,color] of [[0,'#9cb9b9'],[.21,'#d3e2da'],[.48,'#bad3d3'],[.72,'#aac4c0'],[1,'#d1d5bf']])sky.addColorStop(i,color);
 c.fillStyle=sky;c.fillRect(0,0,w,h);
 const rng=sectionRandom(560,2);c.save();c.filter='blur(13px)';
 for(let i=0;i<29;i++){const x=rng()*w,y=h*(.32+rng()*.55),r=10+rng()*42;
  c.fillStyle=i%3?'rgba(126,158,140,.34)':'rgba(245,245,216,.49)';
  c.beginPath();c.ellipse(x,y,r,r*.83,0,0,Math.PI*2);c.fill();
 }c.restore();
 const edge=c.createLinearGradient(0,h,0,h*.84);edge.addColorStop(0,'rgba(105,133,128,.25)');edge.addColorStop(1,'transparent');
 c.fillStyle=edge;c.fillRect(0,0,w,h);
}

export function coachSunlight(c,w,h){
 const {body}=BUS,rangeX=body.maxX-body.minX,rangeZ=body.maxZ-body.minZ;
 // Local +z maps towards the bottom of a horizontal plane's texture.
 const toX=x=>(x-body.minX)/rangeX*w,toZ=z=>(z-body.minZ)/rangeZ*h;
 c.fillStyle='rgba(28,41,56,.37)';c.fillRect(0,0,w,h);
 function light(x0,x1,start,end){
  c.save();c.globalCompositeOperation='destination-out';c.fillStyle='rgba(0,0,0,.86)';c.shadowColor='rgba(0,0,0,.67)';c.shadowBlur=5;
  c.beginPath();c.moveTo(toX(x0),toZ(start));c.lineTo(toX(x1),toZ(start));
  c.lineTo(toX(x1+1.40),toZ(end));c.lineTo(toX(x0+1.40),toZ(end));c.closePath();c.fill();c.restore();
 }
 for(let x=body.minX+.11;x<body.maxX-.66;x+=2.56)light(x,x+2.23,body.minZ-.05,body.maxZ-.42);
 for(const s of BUS_SEATS)if(!s.busDeck){
  const x=toX(s.x+.17),y=toZ(s.z+.09);
  c.save();c.translate(x,y);c.scale(w/rangeX,h/rangeZ);
  const contact=c.createRadialGradient(0,0,0,0,0,.55);contact.addColorStop(0,'rgba(20,25,32,.37)');contact.addColorStop(.48,'rgba(22,27,32,.22)');contact.addColorStop(1,'transparent');
  c.fillStyle=contact;c.fillRect(-.55,-.55,1.1,1.1);c.restore();
 }
}

export function stationSunlight(c,w,h){
 c.fillStyle='rgba(51,66,63,.17)';c.fillRect(0,0,w,h);
 for(let i=0;i<6;i++)for(let pane=0;pane<2;pane++){
  const y=(i*.177+pane*.069-.04)*h;
  c.save();c.globalCompositeOperation='destination-out';c.shadowColor='rgba(0,0,0,.55)';c.shadowBlur=5;c.fillStyle='#171717';c.beginPath();
  c.moveTo(-10,y);c.lineTo(w*.84,y+h*.105);c.lineTo(w*.84,y+h*.163);c.lineTo(-10,y+h*.06);c.closePath();c.fill();c.restore();
  c.save();c.fillStyle='rgba(255,247,214,.34)';c.shadowBlur=5;c.shadowColor='rgba(255,242,211,.24)';c.fill();c.restore();
 }
}

export function queuePrint(c,w,h){
 c.strokeStyle='#e5b62d';c.lineWidth=w*.022;c.strokeRect(w*.034,h*.03,w*.932,h*.94);
 for(const side of [-1,1]){c.save();c.translate(w*(.50+side*.16),h*.47);c.scale(w*.51,h*.64);c.rotate(side*.14);c.fillStyle='#f1eddf';
  c.beginPath();c.moveTo(-.10,.13);c.bezierCurveTo(-.18,-.03,-.20,-.36,-.03,-.40);c.bezierCurveTo(.13,-.43,.22,-.20,.144,-.05);c.lineTo(.085,.13);c.closePath();c.fill();
  c.beginPath();c.moveTo(-.10,.175);c.lineTo(.086,.175);c.bezierCurveTo(.112,.41,-.13,.42,-.10,.175);c.fill();c.restore();}
}
