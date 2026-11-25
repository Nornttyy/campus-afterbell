import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/addons/utils/BufferGeometryUtils.js';
import {createDeskItem} from './game-actors.js?v=campus-104';
import {PLAYGROUND_LAYOUT,createPlaygroundLayout,playgroundFloorHeight,vendingPoint,VENDING_FALL_SECONDS} from './playground-layout70.js?v=campus-92';
export {PLAYGROUND_LAYOUT,createPlaygroundLayout,playgroundFloorHeight} from './playground-layout70.js?v=campus-92';

// The reference has an OPEN sports ground, not desks standing on a green floor.
// The track, bars and vending machines share their placement with the rules.
export function playgroundTrackRing(track,outerRadius,innerRadius){
 const positions=[],uv=[],index=[],samples=[];
 for(let half=0;half<2;half++)for(let i=0;i<=48;i++){const a=half*Math.PI+i/48*Math.PI;samples.push({a,z:half===0?track.straightHalf:-track.straightHalf});}
 for(const {a,z}of samples)for(const r of[outerRadius,innerRadius]){const x=track.cx+Math.cos(a)*r,zz=track.cz+z+Math.sin(a)*r;positions.push(x,0,zz);uv.push(x/.85,zz/.85);}
 for(let i=0;i<samples.length;i++){const a=i*2,b=((i+1)%samples.length)*2;index.push(a,a+1,b,b,a+1,b+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}
function playgroundField(track,radius){
 const position=[track.cx,0,track.cz],uv=[track.cx/1.6,track.cz/1.6],index=[];
 for(let half=0;half<2;half++)for(let i=0;i<=48;i++){
  const a=half*Math.PI+i/48*Math.PI,x=track.cx+Math.cos(a)*radius,z=track.cz+(half===0?track.straightHalf:-track.straightHalf)+Math.sin(a)*radius;
  position.push(x,0,z);uv.push(x/1.6,z/1.6);
 }
 const count=position.length/3-1;for(let i=0;i<count;i++)index.push(0,1+(i+1)%count,1+i);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(position,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}

function surfaceTexture(type){
 if(typeof document!=='undefined'&&['track','grass'].includes(type)){
  const filename=type==='track'?'playground-rubber73.png':'playground-grass73.png';
  const map=new T.TextureLoader().load(new URL('./assets/materials/'+filename,import.meta.url).href);
  if(map){map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.MirroredRepeatWrapping;map.anisotropy=8;return map;}
 }
 const size=256,data=new Uint8Array(size*size*4);let seed=92713;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
 const base=type==='track'?[173,69,48]:type==='grass'?[119,147,47]:type==='concrete'?[187,185,167]:[150,99,51];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const fine=(random()-.5)*(type==='track'?24:type==='grass'?17:12);
  const broad=type==='grass'?Math.sin(x*.038+y*.012)*4+Math.cos(x*.11-y*.035)*2:type==='wood'?Math.sin(x*.14+Math.sin(y*.02)*2)*12:0;
  const i=(y*size+x)*4;for(let c=0;c<3;c++)data[i+c]=Math.max(0,Math.min(255,base[c]+fine+broad));data[i+3]=255;
 }
 const map=new T.DataTexture(data,size,size,T.RGBAFormat);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;
}
function paintedTexture(kind){
 if(typeof document==='undefined')return null;
 const printFile={sports:'./assets/posters/playground-sports73-lossless93.webp','vending-shelf':'./assets/materials/playground-vending84.webp',campaigns:'./assets/posters/athletics-meet91.webp'}[kind];
 if(printFile){
  const map=new T.TextureLoader().load(new URL(printFile,import.meta.url).href);
  if(map){map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;}
  return map||null;
 }
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d');
 if(kind==='unlock'){
  c.fillStyle='#096ba5';c.fillRect(0,0,512,256);c.fillStyle='#fff9e8';
  c.font='bold 106px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('UNLOCK',256,136);
 }else if(kind==='track-banner'){
  canvas.width=768;c.fillStyle='#eee4bf';c.fillRect(0,0,768,256);c.fillStyle='#ec983a';c.fillRect(6,6,756,244);
  for(const [offset,color] of [[0,'#f4b52c'],[32,'#d84e27']]){
   c.fillStyle=color;c.beginPath();c.moveTo(8,24+offset);c.bezierCurveTo(250,170,470,100,760,12+offset);c.lineTo(760,48+offset);c.bezierCurveTo(430,180,230,192,8,60+offset);c.closePath();c.fill();
  }
  for(const [x,y,color] of [[118,127,'#78b446'],[174,143,'#77bdcf']]){
   c.fillStyle=color;c.beginPath();c.arc(x,y,44,0,Math.PI*2);c.fill();c.fillStyle='#234055';c.beginPath();c.arc(x+9,y-25,6,0,Math.PI*2);c.fill();
   c.strokeStyle='#234055';c.lineWidth=7;c.lineJoin='round';c.lineCap='round';
   for(const line of [[-20,-8,-6,-12,5,-19,17,-8,26,-16],[6,-16,-3,1,10,10,19,24],[-3,1,-14,18,-26,15]]){
    c.beginPath();c.moveTo(x+line[0],y+line[1]);for(let i=2;i<line.length;i+=2)c.lineTo(x+line[i],y+line[i+1]);c.stroke();
   }
  }
  c.font='bold 125px "PingFang SC", sans-serif';c.textAlign='center';c.strokeStyle='#fff4d2';c.lineWidth=8;c.strokeText('奋进',470,187);c.fillStyle='#193b79';c.fillText('奋进',470,187);
 }else if(kind==='fence'){
  canvas.width=480;canvas.height=480;c.clearRect(0,0,480,480);c.lineCap='round';
  for(const direction of [-1,1])for(let x=-512;x<1024;x+=80){
   c.lineWidth=5.6;c.strokeStyle='#435657';c.beginPath();c.moveTo(x,0);c.lineTo(x+direction*400,480);c.stroke();
   c.lineWidth=1.5;c.strokeStyle='#83908a';c.beginPath();c.moveTo(x-1,0);c.lineTo(x-1+direction*400,480);c.stroke();
  }
 }
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4;return map;
}
function rectangleUV(geometry,width,height,scale){const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*width/scale,uv.getY(i)*height/scale);return geometry;}

export function createPlaygroundRoom({parent=null,layout=PLAYGROUND_LAYOUT,width,length,includeBackground=true,includeSky=true,finishes={},boardInk=null}={}){
 if(width!==undefined||length!==undefined)layout=createPlaygroundLayout({width,length});
 const group=new T.Group();group.name='playground70-independent-outdoor';if(parent)parent.add(group);
 const geometries=new Set(),materials=new Set(),textures=new Set(),batches=new Map(),referenceObjects=[];
 const ownGeo=g=>(geometries.add(g),g),ownTexture=t=>(t&&textures.add(t),t);
 const mat=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.77,...extra});materials.add(m);return m;};
 const grass=mat('#ffffff',{map:finishes.turf||ownTexture(surfaceTexture('grass')),roughness:.94}),track=mat('#ffffff',{map:finishes.track||ownTexture(surfaceTexture('track')),roughness:.86});
 grass.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
  vec2 turfMetres=vMapUv*1.6;
  float mowing=.5+.5*sin(turfMetres.y*1.27+.16*sin(turfMetres.x*.81));
  float patches=sin(turfMetres.x*.73+turfMetres.y*.20)*sin(turfMetres.y*.94);
  diffuseColor.rgb*=vec3(.79,.82,.62)*(.88+.12*mowing+.074*patches);`);
 };grass.customProgramCacheKey=()=> 'mown-school-field91';
 const concrete=mat('#ffffff',{map:ownTexture(surfaceTexture('concrete')),roughness:.86}),wall=mat('#e9e4d3'),cap=mat('#c9cabc'),steel=mat('#516d6a',{metalness:.27,roughness:.6}),white=mat('#f0efdc'),wood=mat('#ffffff',{map:ownTexture(surfaceTexture('wood')),roughness:.75}),chalk=mat('#113f33'),frame=mat('#84958a',{metalness:.45,roughness:.42});
 // Let rubber aggregate show through the lane paint at the same metre-based UV as the track.
 const lanePaint=mat('#e8dfcb',{map:track.map,roughness:.92});
 lanePaint.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   vec3 grain=texture2D(map,vMapUv).rgb;
   float coverage=.70+.23*smoothstep(.04,.42,grain.r);
   diffuseColor.rgb=mix(grain,diffuseColor.rgb,coverage);`);
 };
 lanePaint.customProgramCacheKey=()=> 'worn-track-markings101';
 const fenceMap=ownTexture(paintedTexture('fence')),fence=mat('#ffffff',{map:fenceMap,side:T.DoubleSide,alphaTest:.25,roughness:.72,metalness:.12});
 const machineColors=[mat('#265b81',{roughness:.4}),mat('#e0ddd0',{roughness:.4}),mat('#c44631',{roughness:.4})],dark=mat('#263d46'),glass=mat('#7bb8be',{roughness:.25}),lightGlass=mat('#d3e5d6',{roughness:.28}),amber=mat('#e8b649'),blue=mat('#2799b7'),red=mat('#d84532'),yellow=mat('#d9bd3b');
 const unitBox=new T.BoxGeometry(1,1,1); // Geometry transforms are baked, never stretch a downloaded prop.
 const v=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3(),matrix=new T.Matrix4();
 function add(geometry,material,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1],bucket='static'){
  const g=geometry.clone();q.setFromEuler(new T.Euler(...rotation));matrix.compose(v.set(...position),q,s.set(...scale));g.applyMatrix4(matrix);
  const key=material.uuid+':'+bucket;if(!batches.has(key))batches.set(key,{material,geometries:[],bucket});batches.get(key).geometries.push(g);return g;
 }
 const box=(m,p,size,rotation)=>add(unitBox,m,p,rotation||[0,0,0],size);
 function panel(m,p,w,h,yaw=0,uvScale=null,bucket='static'){
  const g=new T.PlaneGeometry(w,h);if(uvScale)rectangleUV(g,w,h,uvScale);const surface=add(g,m,p,[0,yaw,0],[1,1,1],bucket);g.dispose();return surface;
 }
 function setPrintBand(surface,band){
  const uv=surface.attributes.uv,pad=4/960;
  for(let i=0;i<uv.count;i++)uv.setXY(i,pad+uv.getX(i)*(1-2*pad),(2-band)/3+pad+uv.getY(i)*(1/3-2*pad));
 }
 function uprightBoard(x,z,yaw,width,height,material){
  const root=new T.Group();root.position.set(x,0,z);root.rotation.y=yaw;root.updateMatrixWorld(true);
  const pt=(a,b,c)=>new T.Vector3(a,b,c).applyMatrix4(root.matrixWorld).toArray();
  for(const xx of[-width/2+.08,width/2-.08])box(steel,pt(xx,1.12,0),[.07,2.24,.07]);
  box(frame,pt(0,1.62,0),[width+.12,height+.12,.12],[0,yaw,0]);
  box(cap,pt(0,2.43,.01),[width+.40,.08,.64],[0,yaw,0]);
  return panel(material,pt(0,1.62,.067),width,height,yaw);
 }
 const b=layout.bounds,t=layout.track;
 // All seams share the same coordinates as the pure collider layout.
 const groundGeo=new T.PlaneGeometry(b.width,b.length);rectangleUV(groundGeo,b.width,b.length,3.2);add(groundGeo,concrete,[(b.minX+b.maxX)/2,-.006,(b.minZ+b.maxZ)/2],[-Math.PI/2,0,0]);groundGeo.dispose();
 const fieldGeo=playgroundField(t,t.innerRadius);add(fieldGeo,grass,[0,.003,0]);fieldGeo.dispose();
 const ring=playgroundTrackRing(t,t.outerRadius,t.innerRadius);add(ring,track,[0,.004,0]);ring.dispose();
 for(let lane=0;lane<=t.laneCount;lane++){const r=t.innerRadius+lane*t.laneWidth,g=playgroundTrackRing(t,r+t.lineWidth/2,r-t.lineWidth/2);add(g,lanePaint,[0,.008,0]);g.dispose();}
 // Broad field markings visible in the reference. No invented sports goal.
 const fieldW=t.innerRadius*1.45,fieldL=t.straightHalf*2+t.innerRadius*1.05;
 for(const x of[-1,1])box(white,[t.cx+x*fieldW/2,.007,t.cz],[.065,.004,fieldL]);
 for(const z of[-1,0,1])box(white,[t.cx,.007,t.cz+z*fieldL/2],[fieldW,.004,.065]);
 // The field line belongs to the field plane, never a floating white box.
 const centerCircle=new T.RingGeometry(1.36,1.42,64);add(centerCircle,white,[t.cx,.009,t.cz],[-Math.PI/2,0,0]);centerCircle.dispose();
 // Painted straight start line on the track. All three lanes retain real width.
 box(white,[t.cx+t.innerRadius+(t.outerRadius-t.innerRadius)/2,.009,t.cz-t.straightHalf*.55],[t.outerRadius-t.innerRadius,.004,.075]);
 const c=layout.connector;box(concrete,[(c.minX+c.maxX)/2,-.06,(c.minZ+c.maxZ)/2],[c.maxX-c.minX,.12,c.maxZ-c.minZ]);
 const wallSections=layout.colliders.filter(c=>c.id.includes('-wall'));
 for(const w of wallSections){
  box(wall,[(w.minX+w.maxX)/2,1.04,(w.minZ+w.maxZ)/2],[w.maxX-w.minX,2.08,w.maxZ-w.minZ]);
  box(cap,[(w.minX+w.maxX)/2,2.10,(w.minZ+w.maxZ)/2],[w.maxX-w.minX+.055,.10,w.maxZ-w.minZ+.055]);
  // Painted low plinth and recessed panel joints give the perimeter thickness.
  const joint=dark;
  const alongWallZ=w.maxZ-w.minZ>w.maxX-w.minX;
  box(cap,[(w.minX+w.maxX)/2,.14,(w.minZ+w.maxZ)/2],[w.maxX-w.minX+.022,.28,w.maxZ-w.minZ+.022]);
  const panelLength=alongWallZ?w.maxZ-w.minZ:w.maxX-w.minX;
  for(let n=1;n<Math.ceil(panelLength/3.0);n++){
   const d=-panelLength/2+n*panelLength/Math.ceil(panelLength/3.0);
   box(cap,[(w.minX+w.maxX)/2+(alongWallZ?0:d),1.15,(w.minZ+w.maxZ)/2+(alongWallZ?d:0)],alongWallZ?[w.maxX-w.minX+.012,1.78,.018]:[.018,1.78,w.maxZ-w.minZ+.012]);
  }
  const alongZ=w.maxZ-w.minZ>w.maxX-w.minX,len=alongZ?w.maxZ-w.minZ:w.maxX-w.minX,px=(w.minX+w.maxX)/2,pz=(w.minZ+w.maxZ)/2;
  const yaw=alongZ?Math.PI/2:0;panel(fence,[px,3.12,pz],len,2.0,yaw,1.20,'fence');
  const segments=Math.max(1,Math.ceil(len/1.55));
  for(let i=0;i<=segments;i++)box(steel,[px+(alongZ?0:(i/segments-.5)*len),3.13,pz+(alongZ?(i/segments-.5)*len:0)],[.045,2.14,.045]);
  for(const y of[2.16,4.14])box(steel,[px,y,pz],alongZ?[.04,.04,len]:[len,.04,.04]);
 }
 // Gate-frame lintel leaves the complete right-hand corridor opening empty.
 for(const z of[layout.entrance.minZ-.035,layout.entrance.maxZ+.035])box(frame,[b.maxX+.04,1.18,z],[.11,2.36,.07]);
 box(frame,[b.maxX+.04,2.39,layout.entrance.z],[.11,.08,layout.entrance.width+.14]);
 for(const step of layout.steps){
  box(concrete,[step.x,(step.top+step.bottom)/2,step.z],[step.width,step.top-step.bottom,step.depth]);
  box(cap,[step.x,step.top-.018,step.z-step.depth/2-.006],[step.width,.036,.026]);
  box(cap,[step.x,step.top-.018,step.z+step.depth/2+.006],[step.width,.036,.026]);
  for(let x=step.x-step.width/2+.9;x<step.x+step.width/2;x+=.9)box(cap,[x,step.top+.001,step.z],[.008,.002,step.depth]);
 }
 const sportsBlue=mat('#2763b5',{roughness:.46,metalness:.25}),sportsYellow=mat('#f7c437',{roughness:.4,metalness:.32});
 function pipe(a,b,radius,material,sides=12){
  const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av),g=new T.CylinderGeometry(radius,radius,delta.length(),sides);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));add(g,material,av.add(bv).multiplyScalar(.5).toArray());g.dispose();
 }
 for(const bar of layout.bars){
  for(const side of[-1,1]){
   const z=bar.z+side*bar.width/2;
   pipe([bar.x,.08,z],[bar.x,bar.height+.05,z],bar.radius,sportsBlue);
   const base=new T.CylinderGeometry(.13,.15,.10,16);add(base,frame,[bar.x,.05,z]);base.dispose();
   const capGeo=new T.SphereGeometry(bar.radius,12,8);add(capGeo,sportsBlue,[bar.x,bar.height+.05,z]);capGeo.dispose();
  }
  pipe([bar.x,bar.height,bar.z-bar.width/2],[bar.x,bar.height,bar.z+bar.width/2],.038,sportsYellow);
 }

 const postGeo=new T.CylinderGeometry(1,1,1,12,1);
 for(const p of layout.posts){add(postGeo,wood,[p.x,p.y+p.height/2,p.z],[0,0,0],[p.radius,p.height,p.radius]);const capGeo=new T.CircleGeometry(p.radius,12);add(capGeo,wood,[p.x,p.y+p.height+.001,p.z],[-Math.PI/2,0,0]);capGeo.dispose();}
 postGeo.dispose();
 const board=layout.board;box(frame,[board.x,board.y,board.z],[board.width+.10,board.height+.10,.10]);
 panel(chalk,[board.x,board.y,board.z-.056],board.width,board.height,Math.PI);
 if(boardInk){const inkGeo=ownGeo(new T.PlaneGeometry(board.width-.03,board.height-.03)),marks=new T.Mesh(inkGeo,boardInk);
  marks.position.set(board.x,board.y,board.z-.061);marks.rotation.y=Math.PI;marks.castShadow=false;group.add(marks);
 }
 box(frame,[board.x,board.y-board.height/2-.04,board.z-.10],[board.width+.12,.04,.16]);
 const boardTarget=new T.Mesh(ownGeo(new T.PlaneGeometry(board.width,board.height)),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));materials.add(boardTarget.material);boardTarget.name='playground-teacher-writing-board';boardTarget.position.set(board.x,board.y,board.z-.061);boardTarget.rotation.y=Math.PI;boardTarget.userData.interaction='board';group.add(boardTarget);referenceObjects.push(boardTarget);
 const campaigns=mat('#ffffff',{map:ownTexture(paintedTexture('campaigns')),roughness:.85});
 const sportsPoster=mat('#ffffff',{map:ownTexture(paintedTexture('sports')),roughness:.85});
 for(const [i,n]of layout.notices.entries()){
  const face=uprightBoard(n.x,n.z,n.yaw,n.width,n.height,i===0?sportsPoster:campaigns);
  if(i>0)setPrintBand(face,(i-1)%3);
 }
 const sportsBanner=mat('#ffffff',{map:ownTexture(paintedTexture('track-banner')),roughness:.85});
 const bannerZ=layout.vending[0].z-2.3;
 panel(sportsBanner,[b.minX+.023,1.30,bannerZ],4.55,1.35,Math.PI/2);
 for(let i=0;i<12;i++){
  const z=b.minZ+3.2+i*(b.length-6.4)/11;
  if(z+1.7<layout.entrance.minZ||z-1.7>layout.entrance.maxZ)setPrintBand(panel(campaigns,[b.maxX-.011,1.30,z],3.4,1.34,-Math.PI/2),i%3);
  if(Math.abs(z+1.1-bannerZ)>3.9)setPrintBand(panel(campaigns,[b.minX+.011,1.30,z+1.1],3.2,1.34,Math.PI/2),(i+1)%3);
 }
 panel(sportsPoster,[t.cx,1.30,b.minZ+.011],5.4,1.8,0);
 const vendingTargets=new Map();
 const buttonGeometry=ownGeo(new T.CylinderGeometry(.080,.084,.037,12).rotateX(Math.PI/2));
 const buttonRed=mat('#d51918',{roughness:.46}),controlBlue=mat('#096ba5',{roughness:.52});
 const label=mat('#ffffff',{map:ownTexture(paintedTexture('unlock'))}),shelf=mat('#ffffff',{map:ownTexture(paintedTexture('vending-shelf')),roughness:.58});
 for(const [i,machine]of layout.vending.entries()){
  const {x,z,yaw,width:w,height:h,depth:d}=machine,root=new T.Group();root.position.set(x,0,z);root.rotation.y=yaw;root.updateMatrixWorld(true);
  const pt=(a,b,c)=>new T.Vector3(a,b,c).applyMatrix4(root.matrixWorld).toArray(),mb=(m,p,dim)=>box(m,pt(...p),dim,[0,yaw,0]);
  mb(machineColors[i],[0,h/2,0],[w,h,d]);mb(frame,[0,.10,0],[w+.035,.14,d+.025]);mb(frame,[0,h-.025,.01],[w+.035,.06,d+.025]);
  mb(dark,[-.105,1.18,d/2+.012],[.69,1.08,.025]);mb(glass,[-.105,1.18,d/2+.030],[.62,1.01,.012]);
  mb(white,[0,h-.14,d/2+.025],[w-.12,.12,.028]);
  mb(frame,[-w/2+.025,h/2,d/2+.018],[.025,h-.10,.025]);mb(frame,[w/2-.025,h/2,d/2+.018],[.025,h-.10,.025]);
  // Four front glass edges and a diagonal soft reflection, without opaque flat glass.
  for(const sx of[-.435,.225])mb(frame,[sx,1.18,d/2+.047],[.018,1.07,.018]);
  mb(lightGlass,[-.33,1.20,d/2+.047],[.035,.86,.008]);
  panel(shelf,pt(-.105,1.18,d/2+.057),.61,1.0,yaw);
  const side=w/2-.155;
  mb(white,[-.135,h/2,d/2+.010],[w-.30,h-.12,.014]);
  mb(controlBlue,[side,h/2,d/2+.031],[.286,h-.09,.045]);
  for(const sx of [-1,1])for(const sy of [-1,1]){
   mb(white,[side+sx*.093,1.19+sy*.110,d/2+.058],[.043,.008,.009]);
   mb(white,[side+sx*.111,1.19+sy*.089,d/2+.058],[.008,.049,.009]);
  }
  mb(white,[side,1.19,d/2+.057],[.195,.194,.034]);
  panel(label,pt(side,1.345,d/2+.059),.262,.118,yaw);
  const front=vendingPoint(machine,'button'),ground=vendingPoint(machine,'pickup');
  const button=new T.Mesh(buttonGeometry,buttonRed);button.name=machine.id+'-button';button.position.set(front.x,front.y,front.z);button.rotation.y=yaw;group.add(button);
  const pickup=new T.Group();pickup.name=machine.id+'-pickup';pickup.visible=false;pickup.rotation.y=yaw;group.add(pickup);
  vendingTargets.set(machine.id,{machine,button,pickup,front,ground,yaw,models:new Map(),action:null,baseY:0});
  mb(dark,[-.12,.39,d/2+.03],[.63,.19,.025]);mb(frame,[-.12,.29,d/2+.08],[.68,.06,.16]);
  for(let slat=0;slat<6;slat++)mb(dark,[-.34+slat*.13,.17,d/2+.032],[.075,.02,.012]);
 }
 if(includeBackground){
  // Continuous exterior ground prevents the arena looking like a floating box.
  box(concrete,[t.cx,-.14,t.cz],[115,.12,115]);

  const glazing=finishes.facade?mat('#f5f4ed',{map:finishes.facade,roughness:.69}):null;
  const city=[mat('#b6bfae'),mat('#d4d2bd'),mat('#b3c5c5'),mat('#b5af93')],window=mat('#617f7c',{roughness:.4,metalness:.12}),windowLight=mat('#b3d1c9',{roughness:.4});
  // Three residential clusters leave the long elevations open to the sky.
  const buildings=[
   [b.minX-7,b.minZ+4,6.5,4.4,15],[b.minX-12,b.minZ+9,5.2,4.7,17],
   [b.minX-5,b.maxZ-10,5.6,4.2,13],[b.minX-10,b.maxZ-5,6.1,4.8,17],
   [t.cx-12,b.minZ-9,7.1,4.8,12],[t.cx-6,b.minZ-12,4.2,4.5,9],
   [t.cx+9,b.maxZ+8,5.2,4.6,20],[t.cx+15,b.maxZ+13,6.8,4.2,15],
   [b.maxX+6,b.maxZ-5,4.6,4.1,8]
  ].map(([x,z,w,d,h],seed)=>({x,z,w,d,h,seed}));
  for(const a of buildings){
   const cm=city[a.seed%city.length];box(cm,[a.x,a.h/2-1,a.z],[a.w,a.h,a.d]);box(cap,[a.x,a.h-.93,a.z],[a.w+.14,.16,a.d+.14]);
   for(let level=3;level<a.h-1;level+=3.5)box(cap,[a.x,level,a.z],[a.w+.08,.10,a.d+.08]);
   for(const side of[-1,1])box(cm,[a.x+side*(a.w/2-.11),a.h/2-1,a.z],[.22,a.h+.1,a.d+.13]);
   const rows=Math.floor(a.h/.93),cols=Math.max(2,Math.floor(a.w/.66));
   if(glazing){
    for(const side of [-1,1]){
     panel(glazing,[a.x,(a.h-1)*.5,a.z+side*(a.d/2+.022)],a.w-.28,a.h-.98,side===1?0:Math.PI,3.65,'city-window');
     panel(glazing,[a.x+side*(a.w/2+.018),(a.h-1)*.5,a.z],a.d-.29,a.h-.98,side*Math.PI/2,3.65,'city-window');
    }
    for(const dx of [-.32,0,.32])box(cap,[a.x+a.w*dx,a.h*.5-1,a.z+a.d*.5+.050],[.085,a.h,.095]);
    continue;
   }
   for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const y=.20+row*.93,x=a.x+(col-(cols-1)/2)*.66,wm=(row+col+a.seed)%7===0?windowLight:window;
    // Exterior panes are single outward faces: hidden back/side box faces do
    // not change the distant facade, and need not enter every shadow pass.
    for(const side of[-1,1])panel(wm,[x,y,a.z+side*(a.d/2+.014)],.39,.55,side===1?0:Math.PI,null,'city-window');
   }
   for(let row=0;row<rows;row++)for(let col=0;col<4;col++)for(const side of[-1,1])panel(window,[a.x+side*(a.w/2+.014),.2+row*.93,a.z+(col-1.5)*.68],.40,.55,side*Math.PI/2,null,'city-window');
  }
 }
 if(includeSky){
  const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 localP; void main(){localP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 localP;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
   void main(){vec3 n=normalize(localP);float h=max(n.y,0.);vec3 color=mix(vec3(.70,.87,.88),vec3(.16,.74,.84),smoothstep(0.,.8,h));vec2 p=n.xz/(.20+n.y*.78)*2.15;
    float coarse=noise(p), detail=noise(p*2.7+.43), f=coarse*.62+detail*.26+noise(p*6.5)*.12;
    float bank=smoothstep(.47,.64,f)*smoothstep(.025,.22,h);
    float sunward=smoothstep(.41,.72,noise(p+vec2(.09,.15))*.70+.30*detail);
    vec3 cloud=mix(vec3(.72,.83,.86),vec3(1.,.986,.94),sunward);
    color=mix(color,cloud,bank*.97);gl_FragColor=vec4(color,1.);}`});materials.add(skyMaterial);
  const sky=new T.Mesh(ownGeo(new T.SphereGeometry(90,32,16)),skyMaterial);sky.position.set(t.cx,0,t.cz);sky.name='playground-outdoor-sky';sky.renderOrder=-10;group.add(sky);
 }
 unitBox.dispose();
 for(const {material,geometries:parts,bucket}of batches.values()){
  const geometry=ownGeo(mergeGeometries(parts,false));for(const p of parts)p.dispose();
  const mesh=new T.Mesh(geometry,material);mesh.name='playground-batch-'+bucket+'-'+material.uuid.slice(0,6);mesh.castShadow=bucket!=='fence'&&bucket!=='city-window';mesh.receiveShadow=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();group.add(mesh);
 }
 group.userData.layoutEvidence=layout.evidence;group.userData.independentOutdoor=true;
 function updateVending(time,stock){
  for(const [id,entry] of vendingTargets){
   const item=stock[id],action=item?.action??null,age=time-(item?.pressedAt??-100);
   const press=age>=0&&age<.25 ? .027*Math.sin(Math.PI*age/.25) : 0,sin=Math.sin(entry.yaw),cos=Math.cos(entry.yaw);
   entry.button.position.set(entry.front.x-sin*press,entry.front.y,entry.front.z-cos*press);
   if(action!==entry.action){
    entry.pickup.clear();entry.action=action;entry.pickup.visible=Boolean(action);
    if(action){
     if(!entry.models.has(action)){
      const model=createDeskItem(action);model.rotation.set(action==='burger' ? .05 : -1.24,0,-.14);model.updateMatrixWorld(true);
      if(!model.userData.propAsset)model.traverse(o=>{if(o.isMesh)ownGeo(o.geometry);});
      const minY=new T.Box3().setFromObject(model,true).min.y;
      entry.models.set(action,{model,baseY:-minY});
     }
     const {model,baseY}=entry.models.get(action);entry.baseY=baseY;entry.pickup.add(model);
    }
   }
   if(action){
    const t=Math.min(1,Math.max(0,(time-item.droppedAt)/VENDING_FALL_SECONDS)),back=(1-t)*.31;
    entry.pickup.position.set(entry.ground.x-sin*back,entry.ground.y+entry.baseY+.30*(1-t*t),entry.ground.z-cos*back);
   }
  }
 }
 let disposed=false;
 return{group,layout,vendingTargets,colliders:layout.colliders,posts:layout.posts,board:layout.board,boardTarget,entrance:layout.entrance,
  floorHeight:(x,z)=>playgroundFloorHeight(x,z,layout),
  update(time,stock={}){if(disposed)return;group.userData.lastUpdate=Number.isFinite(time)?time:0;updateVending(group.userData.lastUpdate,stock);},
  diagnostics(){let triangles=0,meshes=0;group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});return{meshes,triangles,foodRulesDefined:false,seats:0,width:layout.bounds.width,length:layout.bounds.length,postCount:layout.posts.length,sportsBars:layout.bars.length};},
  dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();group.clear();}
 };
}
