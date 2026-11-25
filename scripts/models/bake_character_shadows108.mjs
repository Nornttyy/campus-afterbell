// From the repository root: node scripts/models/bake_character_shadows108.mjs
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadGeometry} from '../../qa/gltf-geometry.mjs';
import * as T from '../../dist/vendor/three.module.js';
const names=['student-boy-v4','student-girl-v4','student-glasses-v2','student-ponytail-v1','teacher-v2','hand-left-v3','hand-right-v3','teacher-hand-left-v1','teacher-hand-right-v1'];
const raw=readFileSync('dist/assets/models/class-shapes103.bin'),offset=raw.readUInt32LE(0),table=JSON.parse(raw.subarray(4,offset).toString());
const indices=new Uint16Array(raw.buffer,raw.byteOffset+offset,(raw.length-offset)/2);
const meshes=[];
for(const file of names){
 const doc=await loadGeometry(file+'.glb');doc.scene.updateMatrixWorld(true);
 doc.scene.traverse(m=>{
 if(!m.isMesh)return;
 const {meshes:i,primitives:j}=doc.parser.associations.get(m),key=i+'/'+j,g=m.geometry;
 const shape=table[file]?.[key],ind=shape?indices.subarray(shape[0],shape[0]+shape[1]):g.index.array;
 const v=new T.Vector3(),nm=new T.Matrix3().getNormalMatrix(m.matrixWorld);
 const pos=g.attributes.position,norm=g.attributes.normal;
 const coords=Array.from({length:pos.count},(_,k)=>v.fromBufferAttribute(pos,k).applyMatrix4(m.matrixWorld).toArray());
 const normals=Array.from({length:pos.count},(_,k)=>v.fromBufferAttribute(norm,k).applyMatrix3(nm).normalize().toArray());
 meshes.push({file,key,coords,normals,indices:Array.from(ind)});
 });}
const scratch=mkdtempSync(join(tmpdir(),'school-occlusion-'));
try{
 const data=join(scratch,'mesh.json');
 writeFileSync(data,JSON.stringify(meshes));
 const bake=fileURLToPath(new URL('./bake_character_shadows108.py',import.meta.url));
 const result=spawnSync(process.env.BLENDER_BINARY||'blender',['-b','--python-exit-code','1','-P',bake,'--',data,'dist/assets/models/character-occlusion108.bin'],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('Blender shading bake failed');
}finally{rmSync(scratch,{recursive:true,force:true});}
