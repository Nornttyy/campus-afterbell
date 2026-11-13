import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/addons/utils/BufferGeometryUtils.js';
import {PLAYGROUND_LAYOUT,createPlaygroundLayout,playgroundFloorHeight} from './playground-layout70.js?v=campus-75';
export {PLAYGROUND_LAYOUT,createPlaygroundLayout,playgroundFloorHeight} from './playground-layout70.js?v=campus-75';

// The reference has an OPEN sports ground, not desks standing on a green floor.
// These authored scene meshes reproduce observed features without introducing
// an unverified food dispenser, score rule, classroom ceiling or seating layout.
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
 if(kind==='sports'){const map=new T.TextureLoader().load(new URL('./assets/posters/playground-sports73.png',import.meta.url).href);if(map){map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;}return map||null;}
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d');
 if(kind==='fence'){
  canvas.height=512;c.clearRect(0,0,512,512);c.strokeStyle='#46534d';c.lineWidth=3;
  for(let x=-512;x<1024;x+=128){c.beginPath();c.moveTo(x,0);c.lineTo(x+512,512);c.stroke();c.beginPath();c.moveTo(x,0);c.lineTo(x-512,512);c.stroke();}
 }else{
  const blue=kind==='blue';c.fillStyle=blue?'#1378b8':'#f2a21e';c.fillRect(0,0,512,256);
  c.fillStyle=blue?'#b9d9e5':'#fff3cc';c.fillRect(15,14,482,228);
  c.fillStyle=blue?'#167bb6':'#ee8220';c.beginPath();c.moveTo(190,14);c.lineTo(497,14);c.lineTo(497,242);c.lineTo(276,242);c.closePath();c.fill();
  c.fillStyle='#fff7d9';c.font='bold 34px sans-serif';c.textAlign='center';c.fillText(blue?'健康成长':'文明校园',365,60);
  c.fillStyle=blue?'#184d77':'#a54c16';c.font='bold 22px sans-serif';c.fillText(blue?'一起运动':'爱护公物',360,100);
  // Simple flat school-poster illustration, not a frame ripped from the video.
  c.strokeStyle='#e9633c';c.lineWidth=15;c.lineCap='round';c.beginPath();c.moveTo(118,112);c.lineTo(147,152);c.lineTo(195,137);c.moveTo(147,152);c.lineTo(129,203);c.moveTo(147,152);c.lineTo(174,203);c.moveTo(122,120);c.lineTo(81,139);c.stroke();
  c.fillStyle='#f3c38c';c.beginPath();c.arc(107,80,25,0,Math.PI*2);c.fill();c.fillStyle='#25383a';c.beginPath();c.arc(106,72,24,Math.PI,0);c.fill();
  c.fillStyle='#fff8df';for(let i=0;i<3;i++)c.fillRect(300,137+i*27,158-(i%2)*30,7);
 }
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4;return map;
}
function rectangleUV(geometry,width,height,scale){const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*width/scale,uv.getY(i)*height/scale);return geometry;}

export function createPlaygroundRoom({parent=null,layout=PLAYGROUND_LAYOUT,width,length,includeBackground=true,includeSky=true}={}){
 if(width!==undefined||length!==undefined)layout=createPlaygroundLayout({width,length});
 const group=new T.Group();group.name='playground70-independent-outdoor';if(parent)parent.add(group);
 const geometries=new Set(),materials=new Set(),textures=new Set(),batches=new Map(),referenceObjects=[];
 const ownGeo=g=>(geometries.add(g),g),ownTexture=t=>(t&&textures.add(t),t);
 const mat=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.77,...extra});materials.add(m);return m;};
 const grass=mat('#ffffff',{map:ownTexture(surfaceTexture('grass')),roughness:.94}),track=mat('#ffffff',{map:ownTexture(surfaceTexture('track')),roughness:.86});
 const concrete=mat('#ffffff',{map:ownTexture(surfaceTexture('concrete')),roughness:.86}),wall=mat('#e9e4d3'),cap=mat('#c9cabc'),steel=mat('#516d6a',{metalness:.27,roughness:.6}),white=mat('#f0efdc'),wood=mat('#ffffff',{map:ownTexture(surfaceTexture('wood')),roughness:.75}),chalk=mat('#113f33'),frame=mat('#84958a',{metalness:.45,roughness:.42});
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
  const g=new T.PlaneGeometry(w,h);if(uvScale)rectangleUV(g,w,h,uvScale);add(g,m,p,[0,yaw,0],[1,1,1],bucket);g.dispose();
 }
 function uprightBoard(x,z,yaw,width,height,material){
  const root=new T.Group();root.position.set(x,0,z);root.rotation.y=yaw;root.updateMatrixWorld(true);
  const pt=(a,b,c)=>new T.Vector3(a,b,c).applyMatrix4(root.matrixWorld).toArray();
  for(const xx of[-width/2+.08,width/2-.08])box(steel,pt(xx,1.12,0),[.07,2.24,.07]);
  box(frame,pt(0,1.62,0),[width+.12,height+.12,.12],[0,yaw,0]);panel(material,pt(0,1.62,.067),width,height,yaw);
  box(cap,pt(0,2.43,.01),[width+.40,.08,.64],[0,yaw,0]);
 }
 const b=layout.bounds,t=layout.track;
 // All seams share the same coordinates as the pure collider layout.
 const groundGeo=new T.PlaneGeometry(b.width,b.length);rectangleUV(groundGeo,b.width,b.length,3.2);add(groundGeo,concrete,[(b.minX+b.maxX)/2,-.006,(b.minZ+b.maxZ)/2],[-Math.PI/2,0,0]);groundGeo.dispose();
 const fieldGeo=playgroundField(t,t.innerRadius);add(fieldGeo,grass,[0,.003,0]);fieldGeo.dispose();
 const ring=playgroundTrackRing(t,t.outerRadius,t.innerRadius);add(ring,track,[0,.004,0]);ring.dispose();
 for(let lane=0;lane<=t.laneCount;lane++){const r=t.innerRadius+lane*t.laneWidth,g=playgroundTrackRing(t,r+t.lineWidth/2,r-t.lineWidth/2);add(g,white,[0,.008,0]);g.dispose();}
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
 box(frame,[board.x,board.y-board.height/2-.04,board.z-.10],[board.width+.12,.04,.16]);
 const boardTarget=new T.Mesh(ownGeo(new T.PlaneGeometry(board.width,board.height)),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));materials.add(boardTarget.material);boardTarget.name='playground-teacher-writing-board';boardTarget.position.set(board.x,board.y,board.z-.061);boardTarget.rotation.y=Math.PI;boardTarget.userData.interaction='board';group.add(boardTarget);referenceObjects.push(boardTarget);
 const posterBlue=mat('#ffffff',{map:ownTexture(paintedTexture('blue')),roughness:.85}),posterOrange=mat('#ffffff',{map:ownTexture(paintedTexture('orange')),roughness:.85});
 const sportsPoster=mat('#ffffff',{map:ownTexture(paintedTexture('sports')),roughness:.85});
 for(const [i,n]of layout.notices.entries())uprightBoard(n.x,n.z,n.yaw,n.width,n.height,i?posterOrange:sportsPoster);
 // A mixture of blue/orange school banners is visible along the real walls.
 for(let i=0;i<6;i++){
  const z=b.minZ+3.2+i*(b.length-6.4)/5;
  if(z+1.7<layout.entrance.minZ||z-1.7>layout.entrance.maxZ)panel(i%2?posterBlue:posterOrange,[b.maxX-.011,1.30,z],3.4,1.34,-Math.PI/2);
  panel(i%2?posterOrange:posterBlue,[b.minX+.011,1.30,z+1.1],3.2,1.34,Math.PI/2);
 }
 panel(sportsPoster,[t.cx,1.30,b.minZ+.011],5.4,1.8,0);
 function czSafe(z,b){return Math.max(b.minZ+1.6,Math.min(b.maxZ-1.6,z));}
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
  mb(sportsBlue,[w/2+.21,.66,.03],[.25,1.32,.23]);mb(lightGlass,[w/2+.21,1.19,.16],[.18,.16,.04]);
  const button=new T.CylinderGeometry(.065,.065,.038,18);add(button,white,pt(w/2+.21,1.19,.19),[Math.PI/2,yaw,0]);button.dispose();

  for(const shelf of[0,1,2]){
   mb(frame,[-.10,.76+shelf*.32,d/2+.055],[.62,.025,.045]);
   for(let j=0;j<4;j++)mb([red,blue,yellow,white][(i+j+shelf)%4],[-.32+j*.145,.85+shelf*.32,d/2+.06],[.095,.16,.055]);
  }
  mb(lightGlass,[.367,1.42,d/2+.02],[.19,.17,.025]);mb(dark,[.37,1.20,d/2+.03],[.13,.028,.025]);
  for(let row=0;row<3;row++)mb(white,[.37,.98-row*.12,d/2+.035],[.075,.055,.03]);
  mb(dark,[-.12,.39,d/2+.03],[.63,.19,.025]);mb(frame,[-.12,.29,d/2+.08],[.68,.06,.16]);
  for(let slat=0;slat<6;slat++)mb(dark,[-.34+slat*.13,.17,d/2+.032],[.075,.02,.012]);
 }
 if(includeBackground){
  // Continuous exterior ground prevents the arena looking like a floating box.
  box(concrete,[t.cx,-.14,t.cz],[115,.12,115]);

  const city=[mat('#b6bfae'),mat('#d4d2bd'),mat('#b3c5c5'),mat('#b5af93')],window=mat('#617f7c',{roughness:.4,metalness:.12}),windowLight=mat('#b3d1c9',{roughness:.4});
  const buildings=[];for(let i=0;i<7;i++)buildings.push({x:b.minX-5.0-(i%2)*2.7,z:b.minZ-8+i*(b.length+16)/6,w:3.1+(i%3),d:3.7,h:10+(i*7%15),seed:i});
  for(let i=0;i<5;i++)buildings.push({x:b.minX-5+i*(b.width+10)/4,z:b.minZ-7.5-(i%2)*3,w:3.2+(i%3),d:3.4,h:13+(i*11%16),seed:i+8});
  for(let i=0;i<4;i++)buildings.push({x:b.minX-3+i*(b.width+6)/3,z:b.maxZ+7.5+(i%2)*4,w:3.5,d:3.6,h:12+(i*5%13),seed:i+15});
  for(const a of buildings){
   const cm=city[a.seed%city.length];box(cm,[a.x,a.h/2-1,a.z],[a.w,a.h,a.d]);box(cap,[a.x,a.h-.93,a.z],[a.w+.14,.16,a.d+.14]);
   for(let level=3;level<a.h-1;level+=3.5)box(cap,[a.x,level,a.z],[a.w+.08,.10,a.d+.08]);
   for(const side of[-1,1])box(cm,[a.x+side*(a.w/2-.11),a.h/2-1,a.z],[.22,a.h+.1,a.d+.13]);
   const rows=Math.floor(a.h/.93),cols=Math.max(2,Math.floor(a.w/.66));
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
   void main(){vec3 n=normalize(localP);float h=max(n.y,0.);vec3 color=mix(vec3(.70,.87,.88),vec3(.16,.74,.84),smoothstep(0.,.8,h));vec2 p=n.xz/max(.23,n.y)*1.8;float f=noise(p)+noise(p*2.)*.35;float cloud=smoothstep(.78,.90,f)*smoothstep(.08,.30,h);color=mix(color,vec3(.95,.96,.90),cloud*.92);gl_FragColor=vec4(color,1.);}`});materials.add(skyMaterial);
  const sky=new T.Mesh(ownGeo(new T.SphereGeometry(90,32,16)),skyMaterial);sky.position.set(t.cx,0,t.cz);sky.name='playground-outdoor-sky';sky.renderOrder=-10;group.add(sky);
 }
 unitBox.dispose();
 for(const {material,geometries:parts,bucket}of batches.values()){
  const geometry=ownGeo(mergeGeometries(parts,false));for(const p of parts)p.dispose();
  const mesh=new T.Mesh(geometry,material);mesh.name='playground-batch-'+bucket+'-'+material.uuid.slice(0,6);mesh.castShadow=bucket!=='fence'&&bucket!=='city-window';mesh.receiveShadow=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();group.add(mesh);
 }
 group.userData.layoutEvidence=layout.evidence;group.userData.independentOutdoor=true;
 let disposed=false;
 return{group,layout,colliders:layout.colliders,posts:layout.posts,board:layout.board,boardTarget,entrance:layout.entrance,
  floorHeight:(x,z)=>playgroundFloorHeight(x,z,layout),
  update(time){if(disposed)return;group.userData.lastUpdate=Number.isFinite(time)?time:0;},
  diagnostics(){let triangles=0,meshes=0;group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});return{meshes,triangles,foodRulesDefined:false,seats:0,width:layout.bounds.width,length:layout.bounds.length,postCount:layout.posts.length,sportsBars:layout.bars.length};},
  dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();group.clear();}
 };
}
