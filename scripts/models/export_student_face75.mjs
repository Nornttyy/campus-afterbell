// Write editable review GLBs beside the untouched originals. Only position /
// normal accessor bytes and their bounds change; embedded maps, UVs, skeleton,
// weights and authored animation buffers are copied byte-for-byte.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {loadGeometry} from '../../qa/gltf-geometry.mjs';
import {createStudentFaceShape} from '../../dist/student-face-shape75.js';
import {STUDENT_ASSETS} from '../../dist/student-assets.js';
const output=new URL('../../art-source/student-face75/',import.meta.url);await mkdir(output,{recursive:true});
for(const [variant,{file}]of Object.entries(STUDENT_ASSETS)){
 const source=await readFile(new URL('../../dist/assets/models/'+file+'.glb',import.meta.url));
 const length=source.readUInt32LE(12),json=JSON.parse(source.subarray(20,20+length)),bin=Buffer.from(source.subarray(28+length));
 const gltf=await loadGeometry(file+'.glb'),edit=createStudentFaceShape(gltf.scene,{variant});
 gltf.scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const association=gltf.parser.associations.get(mesh),primitive=json.meshes[association.meshes].primitives[association.primitives];
  for(const [semantic,name]of [['POSITION','position'],['NORMAL','normal']]){
   const accessor=json.accessors[primitive.attributes[semantic]],view=json.bufferViews[accessor.bufferView],attribute=mesh.geometry.attributes[name];
   if(accessor.componentType!==5126||accessor.type!=='VEC3'||attribute.count!==accessor.count)throw Error('Unexpected vertex storage');
   const stride=view.byteStride||12,offset=(view.byteOffset||0)+(accessor.byteOffset||0),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
   for(let i=0;i<attribute.count;i++)for(let k=0;k<3;k++){const value=attribute.getComponent(i,k);bin.writeFloatLE(value,offset+i*stride+k*4);min[k]=Math.min(min[k],value);max[k]=Math.max(max[k],value);}
   if(semantic==='POSITION'){accessor.min=min;accessor.max=max;}
  }
 });
 json.asset.extras??={};json.asset.extras.faceSculpt75={source:file,...edit.diagnostics()};
 const raw=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(padded);
 const result=Buffer.alloc(28+padded.length+bin.length);result.write('glTF');result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(padded.length,12);result.writeUInt32LE(0x4e4f534a,16);padded.copy(result,20);result.writeUInt32LE(bin.length,20+padded.length);result.writeUInt32LE(0x004e4942,24+padded.length);bin.copy(result,28+padded.length);
 await writeFile(new URL(file+'-sculpt75.glb',output),result);console.log(variant,edit.diagnostics(),result.length);edit.dispose();
}
