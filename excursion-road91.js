// A fixed pool of street sections sits in station/world coordinates. Only a
// section that has left the camera's range is redressed for the road ahead.
import * as T from './vendor/three.module.js';
import {ROAD_SECTION_LENGTH as LENGTH,ROAD_RADIUS,roadSectionAt,sectionRandom} from './excursion-journey91.js?v=campus-91';

const PLASTER=['#d9c6a7','#b5c8c7','#c7b0a0','#c0b5a4'];
const TREE=['#82965f','#9c9a53','#6e925b','#ac9254','#718a57'];
const position=new T.Vector3(),scale=new T.Vector3(),angle=new T.Euler(),orientation=new T.Quaternion(),matrix=new T.Matrix4(),tint=new T.Color();

export function createExcursionRoad(parent,{asphalt,facade}={}){
 const box=new T.BoxGeometry(1,1,1),face=new T.PlaneGeometry(1,1),crown=new T.IcosahedronGeometry(1,1);
 const solid=new T.MeshStandardMaterial({color:0xffffff,roughness:.83});
 const fallbackRoad=asphalt?null:new T.MeshStandardMaterial({color:0x525b5e,roughness:.96});
 const glazing=new T.MeshStandardMaterial({map:facade||null,color:facade?0xffffff:0x879da4,roughness:.73});
 // Counts cover the densest street section. Lights, curbs and window rows
 // are instanced; building a new section never allocates geometry or textures.
 const specs={ground:[box,solid,56,false],asphalt:[box,asphalt||fallbackRoad,2,false],shell:[box,solid,235,true],windows:[face,glazing,32,false],foliage:[crown,solid,66,true]};
 const sections=Array.from({length:2*ROAD_RADIUS+1},()=>{
  const root=new T.Group();root.name='excursion-road-section';parent.add(root);
  const batches={};for(const [id,[geometry,material,max,shadow]] of Object.entries(specs)){
   const mesh=new T.InstancedMesh(geometry,material,max);mesh.name='road-'+id;
   mesh.castShadow=shadow;mesh.receiveShadow=id!=='foliage';mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
   root.add(mesh);batches[id]=mesh;
  }
  return {root,batches,key:null};
 });
 let lastCentre=null,lastSeed=null;
 function dress(slot,key,seed){
  const random=sectionRandom(seed,key);
  // Each side has a character for several adjacent sections, with lots and
  // setbacks determined by the full section index rather than a short cycle.
  const district=sectionRandom(seed^0x78c430,Math.floor(key/3)),parks=[district()<.32,district()<.38];
  const counts={ground:0,asphalt:0,shell:0,windows:0,foliage:0};
  function put(kind,color,x,y,z,w,h,d,yaw=0){
   const batch=slot.batches[kind],i=counts[kind]++;
   matrix.compose(position.set(x,y,z),orientation.setFromEuler(angle.set(0,yaw,0)),scale.set(w,h,d));
   batch.setMatrixAt(i,matrix);batch.setColorAt(i,tint.set(color));
  }
  const ground=(color,x,y,z,w,h,d)=>put('ground',color,x,y,z,w,h,d);
  const structure=(color,x,y,z,w,h,d)=>put('shell',color,x,y,z,w,h,d);
  function tree(x,z,size){
   structure('#795f47',x,1.15*size,z,.25*size,2.3*size,.25*size);
   const leaf=TREE[Math.floor(random()*TREE.length)],t=size*(.86+random()*.23);
   for(const [dx,dy,dz,r] of [[-.65,3.1,0,1.45],[.69,3.25,.27,1.38],[-.13,4.03,-.24,1.53]])put('foliage',leaf,x+dx*t,dy*size,z+dz*t,r*t,r*t*1.05,r*t,random()*3);
  }
  const middle=LENGTH/2;
  ground('#839664',middle,-.48,-12,LENGTH,.50,224);
  put('asphalt','#ffffff',middle,-.129,-15.8,LENGTH,.17,15.4);
  ground('#d0c6b0',middle,-.072,-25.06,LENGTH,.16,3.14);
  ground('#c8bfae',middle,-.074,-6.48,LENGTH,.16,3.22);
  for(const z of [-23.48,-8.10])ground('#c4c4b8',middle,.020,z,LENGTH,.115,.15);
  ground('#e1dbc4',middle,-.038,-22.88,LENGTH,.008,.085);
  ground('#efe5d0',middle,-.038,-8.71,LENGTH,.008,.085);
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
     const w=6.8+random()*3.7,h=4+Math.floor(random()*(park?3:7))*2.35,wall=PLASTER[Math.floor(random()*PLASTER.length)];
     structure(wall,x,h*.5,z,w,h,depth);
     structure('#a2a99f',x,h+.095,z,w+.26,.19,depth+.24);
     structure('#b5b3a1',x,.28,z,w+.12,.55,depth+.12);
     const front=z-side*(depth*.5+.017);
     put('windows','#ffffff',x,h*.51,front,w*.94,h*.9,1,side>0?Math.PI:0);
     for(const edge of [-1,1])put('windows','#ffffff',x+edge*(w*.5+.017),h*.51,z,depth*.91,h*.9,1,edge*Math.PI*.5);
     if(random()>.44)structure('#b6b8ae',x+.73,h+.42,z,1.57,.72,1.45);
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
   // Distant silhouettes add parallax beyond the street and tree line.
   const farZ=side<0?-65:46,x=11+random()*24;
   if(park)put('foliage','#80926b',x,.4,farZ,26,5+random()*6,9);
   else{const h=10+random()*13;structure('#adb7b2',x,h/2,farZ,14,h,8);put('windows','#c3caca',x,h*.5,farZ-side*4.02,13.4,h*.91,1,side>0?Math.PI:0);}
  }
  for(const [kind,batch] of Object.entries(slot.batches)){
   batch.count=counts[kind];batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;batch.computeBoundingSphere();
  }
  slot.key=key;slot.root.position.x=key*LENGTH;slot.root.userData.section=key;
 }
 function update(distance,seed){
  const centre=roadSectionAt(distance);
  if(centre===lastCentre&&seed===lastSeed)return;
  for(let key=centre-ROAD_RADIUS;key<=centre+ROAD_RADIUS;key++){
   const i=((key%sections.length)+sections.length)%sections.length,slot=sections[i];
   if(lastSeed!==seed||slot.key!==key)dress(slot,key,seed);
  }
  lastCentre=centre;lastSeed=seed;
 }
 function dispose(){
  for(const {root,batches} of sections){for(const mesh of Object.values(batches))mesh.dispose();root.removeFromParent();}
  box.dispose();face.dispose();crown.dispose();solid.dispose();glazing.dispose();fallbackRoad?.dispose();
 }
 return {update,dispose};
}
