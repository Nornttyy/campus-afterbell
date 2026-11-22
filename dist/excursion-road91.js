// A fixed pool of street sections sits in station/world coordinates. Only a
// section that has left the camera's range is redressed for the road ahead.
import * as T from './vendor/three.module.js';
import {ROAD_SECTION_LENGTH as LENGTH,ROAD_RADIUS,roadSectionAt,sectionRandom} from './excursion-journey91.js?v=campus-93';
import {cityGlazing,leafCards,streetCrown} from './excursion-city93.js?v=campus-93';

const PLASTER=['#d9c6a7','#b5c8c7','#c7b0a0','#c0b5a4'];
const TREE=['#51824d','#95a34a','#699147','#859946','#598458','#98a350'];
const position=new T.Vector3(),scale=new T.Vector3(),angle=new T.Euler(),orientation=new T.Quaternion(),matrix=new T.Matrix4(),tint=new T.Color();

export function createExcursionRoad(parent,{asphalt,facade,cityAtlas,leaves}={}){
 const box=new T.BoxGeometry(1,1,1),face=new T.PlaneGeometry(1,1),crown=leaves?leafCards():streetCrown();
 const solid=new T.MeshStandardMaterial({color:0xffffff,roughness:.83});
 const fallbackRoad=asphalt?null:new T.MeshStandardMaterial({color:0x525b5e,roughness:.96});
 const glazing=cityGlazing(cityAtlas,facade);
 const greenery=leaves?new T.MeshLambertMaterial({color:0xffffff,map:leaves,alphaTest:.44,side:T.DoubleSide,vertexColors:true,emissive:'#323b1c',emissiveIntensity:.22}):new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.96});
 // Counts cover the densest street section. Lights, curbs and window rows
 // are instanced; building a new section never allocates geometry or textures.
 const specs={ground:[box,solid,56,false],asphalt:[box,asphalt||fallbackRoad,2,false],shell:[box,solid,256,true],windows:[face,glazing,72,false],foliage:[crown,greenery,112,true]};
 const sections=Array.from({length:2*ROAD_RADIUS+1},()=>{
  const root=new T.Group();root.name='excursion-road-section';parent.add(root);
  const batches={};for(const [id,[geometry,material,max,shadow]] of Object.entries(specs)){
   const instanceGeometry=id==='windows'?geometry.clone():geometry;
   if(id==='windows')instanceGeometry.setAttribute('elevation',new T.InstancedBufferAttribute(new Float32Array(max),1).setUsage(T.DynamicDrawUsage));
   const mesh=new T.InstancedMesh(instanceGeometry,material,max);mesh.name='road-'+id;
   mesh.castShadow=shadow;mesh.receiveShadow=id!=='foliage';mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
   root.add(mesh);batches[id]=mesh;
  }
  return {root,batches,key:null};
 });
 let lastCentre=null,lastSeed=null,lastStop=null;
 function dress(slot,key,seed,stationX){
  const random=sectionRandom(seed,key);
  // Each side has a character for several adjacent sections, with lots and
  // setbacks determined by the full section index rather than a short cycle.
  const district=sectionRandom(seed^0x78c430,Math.floor(key/3)),parks=[district()<.32,district()<.38];
  const counts={ground:0,asphalt:0,shell:0,windows:0,foliage:0};
  function put(kind,color,x,y,z,w,h,d,yaw=0,style=0){
   // Reserve the station at its real arrival position too. Checking each
   // primitive with its extent also catches foliage or rail ends from the next lot.
   if(kind!=='ground'&&kind!=='asphalt'){
    const c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw));
    // The canopy is a unit-radius sphere; the box and plane have unit widths.
    const half=kind==='foliage'?1:.5,depth=kind==='windows'?0:d;
    const rx=half*(w*c+depth*s),rz=half*(w*s+depth*c),worldX=key*LENGTH+x;
    if(z+rz>=-8.0&&z-rz<=12.55&&worldX+rx>=stationX-8.8&&worldX-rx<=stationX+15.7)return;
   }
   const batch=slot.batches[kind],i=counts[kind]++;
   matrix.compose(position.set(x,y,z),orientation.setFromEuler(angle.set(0,yaw,0)),scale.set(w,h,d));
   batch.setMatrixAt(i,matrix);batch.setColorAt(i,tint.set(color));
   if(kind==='windows')batch.geometry.getAttribute('elevation').setX(i,style);
  }
  const ground=(color,x,y,z,w,h,d)=>put('ground',color,x,y,z,w,h,d);
  const structure=(color,x,y,z,w,h,d)=>put('shell',color,x,y,z,w,h,d);
  function tree(x,z,size){
   structure('#68513d',x,1.33*size,z,.25*size,2.66*size,.24*size);
   structure('#74604b',x-.22*size,2.07*size,z,.54*size,.18*size,.17*size);
   const leaf=TREE[Math.floor(random()*TREE.length)],t=size*(.86+random()*.23);
   for(const [dx,dy,dz,rx,ry,rz] of [[-.86,3.06,-.18,1.50,.98,1.24],[.71,3.21,.34,1.48,1.23,1.52],[-.25,4.02,-.29,1.39,1.12,1.29],[.26,3.76,.86,1.16,.97,1.04],[-.39,3.41,-.94,1.37,.93,1.07]])put('foliage',leaf,x+dx*t,dy*size,z+dz*t,rx*t,ry*t,rz*t,random()*3);
  }
  function tower(x,z,w,h,depth,side,style,wall,base=0){
   structure(wall,x,base+h*.5,z,w,h,depth);
   structure(style<2?'#9bafba':'#b0aba0',x,base+h+.09,z,w+.21,.18,depth+.21);
   const front=z-side*(depth*.5+.028);
   put('windows','#ffffff',x,base+h*.502,front,w-.18,h-.34,1,side>0?Math.PI:0,style);
   for(const edge of [-1,1])put('windows',edge>0?'#e3ebf1':'#f3f5ef',x+edge*(w*.5+.028),base+h*.502,z,depth-.18,h-.34,1,edge*Math.PI*.5,style);
  }
  const middle=LENGTH/2;
  ground('#839664',middle,-.48,-12,LENGTH,.50,224);
  put('asphalt','#ffffff',middle,-.129,-15.8,LENGTH,.17,15.4);
  ground('#d0c6b0',middle,-.072,-25.06,LENGTH,.16,3.14);
  // The station setback is part of the asphalt forecourt at both stops.
  function nearPavement(color,y,z,height,depth){
   const left=stationX-8.8-key*LENGTH,right=stationX+15.7-key*LENGTH;
   for(const [a,b] of [[0,Math.min(LENGTH,left)],[Math.max(0,right),LENGTH]]){
    if(b>a)ground(color,(a+b)/2,y,z,b-a,height,depth);
   }
  }
  nearPavement('#c8bfae',-.074,-6.48,.16,3.22);
  ground('#c4c4b8',middle,.020,-23.48,LENGTH,.115,.15);
  nearPavement('#c4c4b8',.020,-8.10,.115,.15);
  ground('#e1dbc4',middle,-.038,-22.88,LENGTH,.008,.085);
  nearPavement('#efe5d0',-.038,-8.71,.008,.085);
  for(let x=2;x<LENGTH;x+=6){
   for(const z of [-19.91,-12.18])ground('#e4dfce',x,-.036,z,2.76,.012,.095);
  }
  ground('#ddbb6e',middle,-.037,-16.03,LENGTH,.013,.08);
  for(const side of [-1,1]){
   const park=parks[side>0?1:0],nearZ=side<0?-28.4:-3.45;
   for(let i=0;i<4;i++){
    const x=i*12+5+random()*2.2,worldX=key*LENGTH+x;
    // Leave space for the real starting station and its entrance.
    if(side>0&&worldX>-15&&worldX<19)continue;
    const setback=2.0+random()*4,depth=6+3.5*random(),z=nearZ+side*(setback+depth*.5);
    if(!park||random()>.61){
     const style=random()<.60?2+Math.floor(random()*2):Math.floor(random()*2);
     const w=7.5+random()*3.8,h=3.2+Math.floor(random()*(park?3:5))*2.66,wall=PLASTER[Math.floor(random()*PLASTER.length)];
     tower(x,z,w,h,depth,side,style,wall);
     const front=z-side*depth*.5;
     structure('#b8b6a9',x,.19,z,w+.16,.38,depth+.16);
     if(style>=2){
      structure(['#6c8d88','#ac7660','#b29d69'][i%3],x,2.45,front-side*.26,w*.82,.25,.75);
      structure('#587075',x,.99,front-side*.043,w*.71,1.59,.058);
      for(const dx of [-1,0,1])structure('#c1bcb0',x+dx*w*.23,1.04,front-side*.084,.08,1.69,.062);
     }
     if(random()>.30)structure('#b2b7ad',x+.81,h+.44,z,1.65,.80,1.39);
    }else{
     tree(x+1.2,z,1.25+random()*.48);
     if(random()>.4){structure('#987953',x,.52,nearZ,.49,.13,1.8);structure('#686e66',x-.10,.26,nearZ-.56,.11,.49,.12);structure('#686e66',x-.10,.26,nearZ+.56,.11,.49,.12);}
    }
    if(i%2===0||park)tree(x-2.1,nearZ+side*.85,.82+random()*.36);
   }
   for(const x of [4,28]){
    if(side>0&&key===0&&x<17)continue;
    const z=side<0?-24.33:-7.02;
    structure('#697a79',x,2.77,z,.095,5.54,.095);
    structure('#748581',x,5.50,z-side*.53,.086,.075,1.12);
    structure('#e1d9bb',x,5.43,z-side*1.07,.26,.12,.47);
   }
   // Towers occupy two deeper streets. Step-backs vary independently of the
   // near buildings so neither window sees the same repeated block receding.
   for(let i=0;i<3;i++){
    const x=4+i*15+random()*6,z=nearZ+side*(30+i%2*17+random()*7),w=8+random()*8,d=7+random()*6;
    const h=(park?12:19)+random()*23+(i===2?6:0),style=random()<.59?0:1;
    tower(x,z,w,h,d,side,style,style?'#b2c1c6':'#849eac');
    if(i!==1){const bh=2.6+random()*4;tower(x+.37,z,w*.69,bh,d*.66,side,style,'#a7b7bf',h+.17);}
   }
   const distantX=8+random()*30,distantZ=nearZ+side*(67+random()*10),height=21+random()*23;
   tower(distantX,distantZ,13,height,11,side,1,'#aebfca');
  }
  for(const [kind,batch] of Object.entries(slot.batches)){
   batch.count=counts[kind];batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;if(kind==='windows')batch.geometry.getAttribute('elevation').needsUpdate=true;batch.computeBoundingSphere();
  }
  slot.key=key;slot.root.position.x=key*LENGTH;slot.root.userData.section=key;
 }
 function update(distance,seed,stationX=0){
  const centre=roadSectionAt(distance);
  if(centre===lastCentre&&seed===lastSeed&&stationX===lastStop)return;
  for(let key=centre-ROAD_RADIUS;key<=centre+ROAD_RADIUS;key++){
   const i=((key%sections.length)+sections.length)%sections.length,slot=sections[i];
   if(lastSeed!==seed||slot.key!==key||stationX!==lastStop)dress(slot,key,seed,stationX);
  }
  lastCentre=centre;lastSeed=seed;lastStop=stationX;
 }
 function dispose(){
  for(const {root,batches} of sections){batches.windows.geometry.dispose();for(const mesh of Object.values(batches))mesh.dispose();root.removeFromParent();}
  box.dispose();face.dispose();crown.dispose();greenery.dispose();solid.dispose();glazing.dispose();fallbackRoad?.dispose();
 }
 return {update,dispose};
}
