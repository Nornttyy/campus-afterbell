import * as T from './vendor/three.module.js';

const shells=new WeakMap(),materialSets=new WeakMap();
let enamel;
function labelMaterial(){
 if(!enamel){
  const map=typeof document==='undefined'?null:new T.TextureLoader().load(new URL('./assets/packets111/coca-cola-cn.webp',import.meta.url).href);
  if(map){map.colorSpace=T.SRGBColorSpace;map.wrapS=T.RepeatWrapping;}
  enamel=new T.MeshStandardMaterial({name:'可口可乐罐身',map,color:map?0xffffff:0xed1726,roughness:.37,metalness:.17});
 }
 return enamel;
}

// Keep the tab and rolled rims on the model's original atlas. The can wall
// receives cylindrical UVs, including triangles crossing the back seam.
function labelledGeometry(source){
 if(shells.has(source))return shells.get(source);
 const g=source.index?source.toNonIndexed():source.clone();
 g.computeBoundingBox();
 const {min,max}=g.boundingBox,center=g.boundingBox.getCenter(new T.Vector3()),height=max.y-min.y;
 const p=g.attributes.position,uv=g.attributes.uv;
 const metal=[],print=[];
 for(let i=0;i<p.count;i+=3){
  const indices=[i,i+1,i+2],levels=indices.map(j=>(p.getY(j)-min.y)/height);
  const low=Math.min(...levels),highY=Math.max(...levels);
  const cap=highY<.065||low>.895||
   (highY>.84&&indices.some(j=>Math.hypot(p.getX(j)-center.x,p.getZ(j)-center.z)<.40*(max.x-min.x)));
  if(cap){metal.push(...indices);continue;}
  const u=indices.map(j=>.25+Math.atan2(p.getX(j)-center.x,p.getZ(j)-center.z)/(2*Math.PI));
  const high=Math.max(...u);
  for(let k=0;k<3;k++){
   const j=indices[k];uv.setXY(j,u[k]+(high-u[k]>.5?1:0),(p.getY(j)-min.y)/height);
  }
  print.push(...indices);
 }
 g.setIndex([...metal,...print]);g.clearGroups();g.addGroup(0,metal.length,0);g.addGroup(metal.length,print.length,1);
 shells.set(source,g);return g;
}
export function labelColaCan(can){
 can.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const original=mesh.material;
  if(!materialSets.has(original))materialSets.set(original,[original,labelMaterial()]);
  mesh.geometry=labelledGeometry(mesh.geometry);mesh.material=materialSets.get(original);
 });
 return can;
}
