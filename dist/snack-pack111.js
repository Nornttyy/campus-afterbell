import * as T from './vendor/three.module.js';

const wrappers = {
  gum: {name:'bubblegum-wrapper', size:[.130,.055,.017], edge:0xf18ab7},
  chips: {name:'potato-chip-bag', size:[.126,.174,.072], edge:0xf6b732},
  noodles: {name:'crunchy-noodle-bag', size:[.124,.169,.041], edge:0xe67b32},
  snack: {name:'snack-packet', size:[.12,.209,.026], edge:0x211f23}
};
const templates = new Map(), materials = new Map(), rewrapped = new WeakMap();
function ink(kind){
  if(materials.has(kind))return materials.get(kind);
  const url=new URL('./assets/packets111/'+kind+'.webp',import.meta.url);
  const map=typeof document==='undefined'?null:new T.TextureLoader().load(url.href);
  if(map)map.colorSpace=T.SRGBColorSpace;
  const surface=new T.MeshStandardMaterial({map,color:map?0xffffff:wrappers[kind].edge,roughness:.96,metalness:0});
  materials.set(kind,surface);
  return surface;
}
// Front and back are separate faces of one folded wrapper. The narrow ends
// pinch shut, while the broad middle has room for the fingers to grip it.
function packetGeometry([width,height,depth]){
  const positions=[],uv=[],index=[];
  function face(corners,coords){
    const first=positions.length/3;
    for(const p of corners)positions.push(...p);
    for(const pair of coords)uv.push(...pair);
    index.push(first,first+1,first+2,first,first+2,first+3);
  }
  const rings=[[-.5,.48,.12],[-.43,.5,.75],[.06,.5,1],[.43,.5,.75],[.5,.48,.12]].map(([level,w,d])=>({
    y:level+.5,points:[[-w,level,d*.5],[w,level,d*.5],[w,level,-d*.5],[-w,level,-d*.5]].map(([x,y,z])=>[x*width,y*height,z*depth])
  }));
  for(let i=1;i<rings.length;i++){
    const a=rings[i-1],b=rings[i];
    for(let k=0;k<4;k++){
      const next=(k+1)%4;
      const [u,v]=k===2?[.003,.497]:k===0?[.503,.997]:k===1?[.495,.497]:[.997,.999];
      face([a.points[k],a.points[next],b.points[next],b.points[k]],[[u,a.y],[v,a.y],[v,b.y],[u,b.y]]);
    }
  }
  for(const [r,top] of [[rings[0],false],[rings.at(-1),true]]){
    face(top?r.points:r.points.slice().reverse(),[[.01,r.y],[.49,r.y],[.49,r.y],[.01,r.y]]);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}
// A pillow pouch expands across both printed panels. Its side pleats fold
// inward and the heat-sealed strips at the top and bottom stay flat.
function chipBagGeometry([width,height,depth]){
  const positions=[],uv=[],indices=[];
  const levels=[
    [-.50,.97,.035],[-.46,.97,.035],[-.37,.93,.49],[-.20,.97,.89],
    [.02,1,1],[.24,.96,.84],[.38,.92,.42],[.46,.98,.035],[.50,.98,.035]
  ];
  const columns=[-1,-.83,-.51,0,.51,.83,1];
  const vertex=(x,y,z,u,v)=>{
    positions.push(x*width/2,y*height,z*depth/2);
    uv.push(u,v);
    return positions.length/3-1;
  };
  function strip(rows){
    for(let i=1;i<rows.length;i++)for(let j=1;j<rows[i].length;j++){
      const a=rows[i-1][j-1],b=rows[i-1][j],c=rows[i][j],d=rows[i][j-1];
      indices.push(a,b,c,a,c,d);
    }
  }
  for(const side of [1,-1]){
    strip(levels.map(([y,w,fill])=>columns.map(u=>{
      const curve=1-.73*u*u;
      const ink=(side===1?.503:.003)+(u+1)*.247;
      return vertex(side*u*w,y,side*fill*curve,ink,y+.5);
    })));
    strip(levels.map(([y,w,fill])=>[1,0,-1].map(fold=>{
      const crease=fold===0&&Math.abs(y)<.46?.10*fill:0;
      return vertex(side*(w-crease),y,side*fold*fill*.27,side===1?.497:.998,y+.5);
    })));
  }
  for(const end of [0,levels.length-1]){
    const [y,w,fill]=levels[end],sign=end===0?-1:1;
    strip([1,-1].map(side=>columns.map(u=>vertex(sign*u*w,y,side*fill*(1-.73*u*u),.503+(u+1)*.247,y+.5))));
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
function remapSpicyBag(mesh){
  const original=mesh.geometry;
  if(!rewrapped.has(original)){
    const g=original.clone(),p=g.attributes.position,n=g.attributes.normal,uv=[];
    g.computeBoundingBox();const min=g.boundingBox.min,size=g.boundingBox.getSize(new T.Vector3());
    for(let i=0;i<p.count;i++){
      const x=(p.getX(i)-min.x)/size.x,y=(p.getY(i)-min.y)/size.y;
      const front=n.getZ(i)>=0;uv.push((front?.003:.503)+(front?x:1-x)*.494,y*.996+.002);
    }
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));rewrapped.set(original,g);
  }
  mesh.geometry=rewrapped.get(original);mesh.material=ink('snack');
}
export function printedPacket(kind,source=null){
  if(kind==='snack'&&source){
    source.traverse(mesh=>{if(mesh.isMesh)remapSpicyBag(mesh);});
    source.userData.printedAsset=kind;return source;
  }
  if(!templates.has(kind)){
    const spec=wrappers[kind],group=new T.Group(),mesh=new T.Mesh(kind==='chips'?chipBagGeometry(spec.size):packetGeometry(spec.size),ink(kind));
    group.name=spec.name;group.userData.printedAsset=kind;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);templates.set(kind,group);
  }
  const packet=templates.get(kind).clone(true);
  if(source){
    const bounds=new T.Box3().setFromObject(packet,true),size=bounds.getSize(new T.Vector3()),ref=[.13,.06,.03];
    packet.userData.propAsset=source.userData.propAsset;
    packet.userData.contactFit={center:[0,0,0],scale:size.toArray().map((x,i)=>x/ref[i]),min:bounds.min.toArray(),max:bounds.max.toArray()};
  }
  return packet;
}

// The hand picks up the pouch from its reverse side. Moving the printed
// panels on the held copy keeps its front readable after the inward turn.
const heldPanels=new WeakMap();
export function reverseHeldPanels(packet){
 packet.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const original=mesh.geometry;
  if(!heldPanels.has(original)){
   const geometry=original.clone(),uv=geometry.attributes.uv;
   for(let i=0;i<uv.count;i++){
    const u=uv.getX(i);
    uv.setX(i,u<.5?u+.5:u-.5);
   }
   heldPanels.set(original,geometry);
  }
  mesh.geometry=heldPanels.get(original);
 });
}
