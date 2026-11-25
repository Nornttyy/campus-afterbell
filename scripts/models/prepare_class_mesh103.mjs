// Rebuild the classroom index pack with meshoptimizer 0.18.1. Source GLBs and
// their joint weights, UVs, clips and original vertex positions stay editable.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {loadGeometry} from '../../qa/gltf-geometry.mjs';
import * as T from '../../dist/vendor/three.module.js';

const require=createRequire(import.meta.url);
const {MeshoptSimplifier:simplifier}=require(process.argv[2]||'meshoptimizer');
await simplifier.ready;
const base=new URL('../../dist/assets/',import.meta.url);
const files=Object.keys(JSON.parse(await readFile(new URL('stream93/models.json',base),'utf8')));
const directory={},chunks=[];let count=0;
for(const file of files){
 if(/hand-|^desk-|^chair-/.test(file))continue;
 const model=await loadGeometry(file+'.glb'),parts={};
 model.scene.updateMatrixWorld(true);
 model.scene.traverse(node=>{
  if(!node.isMesh)return;
  const g=node.geometry,pos=g.attributes.position;if(!g.index||g.index.count<600)return;
  const {meshes,primitives}=model.parser.associations.get(node)||{};
  if(meshes===undefined||primitives===undefined)throw Error('Missing primitive id '+file);
  const old=g.index.array,points=new Float32Array(pos.count*3),fixed=[],body=[],p=new T.Vector3();
  const joints=g.attributes.skinIndex,weights=g.attributes.skinWeight;
  const protect=new Uint8Array(pos.count);
  for(let i=0;i<pos.count;i++){
   p.fromBufferAttribute(pos,i);p.toArray(points,i*3);
   if(!joints)continue;
   p.applyMatrix4(node.matrixWorld);
   const teacher=file==='teacher-v2';
   const face=p.z>(teacher ? .08 : .05)&&p.y>(teacher?1.48:1.18)&&p.y<(teacher?2.03:file.includes('ponytail')?1.45:1.52);
   if(face)protect[i]=1;
   // Side-view ears and weighted hinge rings need their original edges.
   // A triangle spanning one of these bends appears as a flat flap in motion.
   const ear=Math.abs(p.x)>(teacher?.195:.18)&&p.y>(teacher?1.65:1.28)&&p.y<(teacher?1.90:1.50)&&p.z>-.115&&p.z<.07;
   if(ear)protect[i]=1;
   let dominant=0,hinge=false;
   for(let j=0;j<4;j++){
    const bone=node.skeleton.bones[joints.getComponent(i,j)];
    const weight=weights.getComponent(i,j);
    if(weight>.05&&/Hand/.test(bone.name))protect[i]=1;
    if(weight>.10&&/Shoulder|Arm|Leg/.test(bone.name))hinge=true;
    dominant=Math.max(dominant,weight);
   }
   if(hinge&&dominant<.80)protect[i]=1;
  }
  for(let i=0;i<old.length;i+=3){
   const target=protect[old[i]]||protect[old[i+1]]||protect[old[i+2]]?fixed:body;
   target.push(old[i],old[i+1],old[i+2]);
  }
  const fraction=joints ? .47 : .45;
  const [reduced]=simplifier.simplify(new Uint32Array(body),points,3,3*Math.floor(body.length*fraction/3),joints ? .008 : .012,['LockBorder']);
  const size=reduced.length+fixed.length;if(size>=old.length*.98)return;
  if(pos.count>65535)throw Error('Primitive too large for short indices');
  const indices=Uint16Array.from([...reduced,...fixed]);
  parts[meshes+'/'+primitives]=[count,indices.length,old.length,pos.count];
  chunks.push(Buffer.from(indices.buffer));count+=indices.length;
 });
 if(Object.keys(parts).length)directory[file]=parts;
}
const meta=Buffer.from(JSON.stringify(directory)),head=Buffer.alloc(4+meta.length+(meta.length%2));
head.writeUInt32LE(head.length,0);meta.copy(head,4);if(meta.length%2)head[head.length-1]=32;
const pack=Buffer.concat([head,...chunks]);
await writeFile(new URL('models/class-shapes103.bin',base),pack);
for(const [file,parts] of Object.entries(directory)){
 const total=k=>Object.values(parts).reduce((n,v)=>n+v[k]/3,0);console.log(file,total(2),'->',total(1));
}
