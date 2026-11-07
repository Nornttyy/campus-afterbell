import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const bytes=readFileSync(new URL('../dist/assets/models/student-glasses-v1.glb',import.meta.url));
const jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonLength)),binary=bytes.subarray(28+jsonLength);
function accessor(index){
 const a=gltf.accessors[index],view=gltf.bufferViews[a.bufferView];
 const size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],width={5121:1,5123:2,5125:4,5126:4}[a.componentType];
 const read={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType];
 return Array.from({length:a.count},(_,i)=>Array.from({length:size},(_,c)=>binary[read]((view.byteOffset||0)+(a.byteOffset||0)+i*(view.byteStride||size*width)+c*width)));
}
const surfaces=gltf.meshes.find(mesh=>mesh.name==='GlassesStudentBodyMesh').primitives.map(p=>({
 material:gltf.materials[p.material].name,vertices:accessor(p.attributes.POSITION),indices:accessor(p.indices).flat(),uv:accessor(p.attributes.TEXCOORD_0)
}));

test('glasses chin underside shares its skin surface with the rebuilt face when the head tilts back',()=>{
 let underside=0;
 for(const surface of surfaces)for(let i=0;i<surface.indices.length;i+=3){
  const indices=surface.indices.slice(i,i+3),points=indices.map(n=>surface.vertices[n]);
  const center=points[0].map((_,axis)=>points.reduce((sum,p)=>sum+p[axis],0)/3);
  // This closed surface is exposed in the carried pose. The old shaded
  // source-atlas island made it look like a circular hole below the chin.
  if(Math.abs(center[0])<.06&&center[1]>.652&&center[1]<.665&&center[2]>.035){
   underside++;
   assert.equal(surface.material,'Continuous face and nape','old shaded chin island is exposed below the new face');
   for(const vertex of indices){const uv=surface.uv[vertex];assert.ok(Math.abs(uv[0]-.25)<.00001&&Math.abs(uv[1]-.975)<.00001,'underside samples a face feature instead of the continuous skin patch');}
  }
 }
 assert.ok(underside>60,'missing the real chin underside; an overlay must not replace it');
});

test('glasses head remains joined at the neck with no open or doubled surface edges',()=>{
 const edges=new Map();
 for(const surface of surfaces)for(let i=0;i<surface.indices.length;i+=3){
  const points=surface.indices.slice(i,i+3).map(index=>surface.vertices[index]);
  for(let k=0;k<3;k++){
   const a=points[k],b=points[(k+1)%3];if(Math.min(a[1],b[1])<.6649)continue;
   // glTF legitimately duplicates vertices at UV/material boundaries.
   const ka=a.map(v=>v.toFixed(6)).join(','),kb=b.map(v=>v.toFixed(6)).join(',');if(ka===kb)continue;
   const key=[ka,kb].sort().join('|');edges.set(key,(edges.get(key)||0)+1);
  }
 }
 assert.ok(edges.size>10000);
 assert.equal([...edges.values()].filter(count=>count!==2).length,0,'head/neck seam has exposed or overlapping triangles');
});
