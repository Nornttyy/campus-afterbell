import * as T from './vendor/three.module.js';
import {sectionRandom} from './excursion-journey91.js?v=campus-93';

// Four actual elevations. Each tile describes one structural bay on one floor.
// Its physical size stays constant when the instance is a 4- or a 16-storey block.
export function paintCityBays(c,w,h){
 const width=w/4;
 for(let type=0;type<4;type++){
  c.save();c.translate(type*width,0);c.scale(width/160,h/192);
  const glass=(x,y,dx,dy,top,bottom)=>{
   const sky=c.createLinearGradient(0,y,0,y+dy);sky.addColorStop(0,top);sky.addColorStop(1,bottom);
   c.fillStyle=sky;c.fillRect(x,y,dx,dy);c.fillStyle='rgba(207,237,238,.19)';c.fillRect(x+3,y+4,dx-6,2);c.fillRect(x+3,y+4,2,dy-6);
  };
  const rect=(x,y,dx,dy,color)=>{c.fillStyle=color;c.fillRect(x,y,dx,dy);};
  if(type===0){
   rect(0,0,160,192,'#69818b');glass(4,4,152,132,'#85a9b8','#7c9bab');glass(4,142,152,44,'#809eab','#7794a1');
   rect(75,5,3,126,'#67828e');rect(78,5,2,126,'#a4b9bb');
   rect(0,132,160,8,'#90a9af');rect(0,138,160,4,'#4b697a');rect(0,0,4,192,'#b7c7c7');rect(156,0,4,192,'#577481');
  }else if(type===1){
   rect(0,0,160,192,'#a5b3b8');glass(14,5,65,161,'#a2c3d1','#5a788e');glass(82,5,65,161,'#95b9cd','#627f95');
   rect(0,0,9,192,'#c4cbc8');rect(9,0,6,192,'#84969c');rect(0,164,160,25,'#a5b3ba');rect(0,167,160,3,'#ccd3d0');rect(0,188,160,4,'#6d818d');
  }else if(type===2){
   rect(0,0,160,192,'#c6bbaa');rect(10,17,139,127,'#957f71');glass(15,22,62,116,'#aebbc0','#647b81');glass(82,22,62,116,'#b3b9b6','#74858b');
   rect(17,24,22,99,'#d4cbb4');rect(128,24,15,97,'#cdc7b4');rect(0,146,160,18,'#867a70');rect(0,152,160,25,'#c6c4b8');rect(0,151,160,4,'#ebe8da');
   for(let x=1;x<160;x+=20)rect(x,115,3,37,'#778a89');rect(0,113,160,3,'#91a4a5');rect(0,174,160,6,'#a69d8d');
  }else{
   rect(0,0,160,192,'#c4c1ab');rect(13,22,131,126,'#91998c');glass(18,27,54,112,'#9aafb1','#5f7478');glass(77,27,61,112,'#a7b7b1','#5f7379');
   rect(15,76,125,6,'#d0d3bb');rect(12,144,135,6,'#f0e5c7');rect(12,150,135,4,'#a99e88');rect(0,175,160,10,'#beb6a0');
  }
  c.restore();
 }
}

export function cityGlazing(atlas,fallback){
 const material=new T.MeshStandardMaterial({map:atlas||fallback||null,color:atlas||fallback?0xffffff:0x7b9fb2,roughness:.68});
 if(!atlas)return material;
 // All elevations share a mobile draw batch. Explicit gradients keep distant
 // windows stable at the seam of a repeated atlas bay.
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float elevation; varying vec3 vElevation; varying vec2 vFace93;').replace('#include <uv_vertex>',`#include <uv_vertex>
    vec2 metres = vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
    vec2 bay = elevation < 1.5 ? vec2(1.85,2.42) : vec2(2.74,2.68);
    vFace93=uv;vElevation = vec3(uv * max(vec2(1.),floor(metres/bay+.5)),elevation);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vElevation; varying vec2 vFace93;').replace('#include <map_fragment>',`
    vec2 pattern=vElevation.xy;
    vec2 tile=fract(pattern)*.986+.007;
    vec2 sampleUV=vec2((vElevation.z+tile.x)*.25,tile.y);
    vec2 rate=vec2(.2465,.986);
    vec4 surface=textureGrad(map,sampleUV,dFdx(pattern)*rate,dFdy(pattern)*rate);
    float story=dot(floor(pattern),vec2(63.726,24.53));
    float room=fract(sin(story)*43758.54);
    float glass=step(.11,tile.y)*step(.09,tile.x)*step(tile.x,.92)*step(tile.y,.86);
    float skyline=.20+.27*fract(sin(floor(vFace93.x*7.+.1)*23.7+4.9)*372.2);
    float shadow=1.-smoothstep(skyline-.006,skyline+.006,vFace93.y);
    surface.rgb *= 1.+glass*((room-.5)*.16+.17*vFace93.y-.22*shadow*float(vElevation.z<1.5));
    diffuseColor *= surface;`);
 };
 return material;
}

// Crossed leaf cards provide gaps in the silhouette and between branch tips,
// while the real trunk, branches and separate crowns retain parallax.
export function paintFoliage(c,w,h){
 const rng=sectionRandom(4624,17),leaves=[];
 for(let i=0;i<125;i++){
  const angle=rng()*Math.PI*2,r=Math.sqrt(rng()),x=.50+.39*r*Math.cos(angle),y=.51+.38*r*Math.sin(angle);
  const bright=.27+.41*(1-y)+.20*(1-x)+rng()*.13;
  for(let j=0;j<18;j++)leaves.push({x:x+(rng()-.50)*.155,y:y+(rng()-.5)*.121,r:.009+rng()*.019,angle:rng()*4,b:bright+(rng()-.5)*.26});
 }
 leaves.sort((a,b)=>a.b-b.b);
 for(const l of leaves){
  c.fillStyle='rgb('+[.47+l.b*.55,.56+l.b*.44,.39+l.b*.50].map(v=>Math.min(255,Math.round(v*255))).join(',')+')';
  c.beginPath();c.ellipse(l.x*w,l.y*h,l.r*w,l.r*h*.61,l.angle,0,Math.PI*2);c.fill();
 }
}

export function leafCards(){
 const p=[],uv=[],colour=[],normals=[],indices=[];
 for(let i=0;i<3;i++){
  const a=i*Math.PI/3,dx=Math.cos(a),dz=Math.sin(a),j=i*4;
  p.push(-dx,-1,-dz,dx,-1,dz,dx,1,dz,-dx,1,-dz);uv.push(0,0,1,0,1,1,0,1);
  colour.push(.53,.62,.55,.57,.65,.57,1,.99,.82,.94,.98,.80);
  for(let j=0;j<4;j++)normals.push(-.19,.96,.20);
  indices.push(j,j+1,j+2,j,j+2,j+3);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colour,3));g.setIndex(indices);return g;
}

// Ellipsoidal crowns share a single leafy silhouette with dapple and underside
// occlusion baked into the vertices. Their bounds remain inside a unit sphere.
export function streetCrown(){
 const g=new T.IcosahedronGeometry(1,2),p=g.attributes.position,colors=[],v=new T.Vector3();
 const sun=new T.Vector3(-.46,.73,.51).normalize(),shade=new T.Color(),top=new T.Color('#ffefaa'),bottom=new T.Color('#62776c');
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i);
  const noise=Math.sin(v.x*18+Math.sin(v.z*13)*2)*Math.sin(v.y*17+v.z*7);
  const r=.89+.075*noise+.035*Math.sin(v.z*23+v.y*19);
  const light=T.MathUtils.clamp(.44+.40*v.dot(sun)+.14*noise,0,1);
  shade.copy(bottom).lerp(top,light);colors.push(shade.r,shade.g,shade.b);p.setXYZ(i,v.x*r,v.y*r,v.z*r);
 }
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingBox();return g;
}
