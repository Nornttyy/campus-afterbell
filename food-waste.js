import * as T from './vendor/three.module.js';

// Preserve the original UVs below the cut. The inward-facing sides of this
// shell carry the lining color, so the original printed label stays outside.
const cuts={snack:.78,chips:.79,noodles:.79,drink:.87,burger:.14,lunch:.35};
const lining={snack:0xbca77f,chips:0xafb4b1,noodles:0xc0aa86,drink:0xb9bfbe,lunch:0xadb7b5,burger:0xe1b577};
function shellMaterial(original,kind,rim,height){
 const material=original.clone(),color=new T.Color(lining[kind]);
 material.side=T.DoubleSide;
 material.onBeforeCompile=shader=>{
  shader.uniforms.wasteLining={value:color};
  shader.uniforms.wasteRim={value:rim};
  shader.uniforms.wasteHeight={value:height};
  shader.vertexShader='varying float wasteDepth;\nuniform float wasteRim, wasteHeight;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwasteDepth = clamp((wasteRim - position.y) / wasteHeight, 0.0, 1.0);');
  shader.fragmentShader='uniform vec3 wasteLining;\nvarying float wasteDepth;\n'+shader.fragmentShader
   .replace('#include <color_fragment>','#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor = vec4(wasteLining * mix(1.0, 0.19, smoothstep(0.0, 0.85, wasteDepth)), 1.0);')
   .replace('#include <normal_fragment_maps>','if (gl_FrontFacing) {\n#include <normal_fragment_maps>\n}');
 };
 material.customProgramCacheKey=()=>'opened-food-lining';
 return material;
}
function trimMesh(mesh,limit,kind,height){
 const surface=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
 if(!surface.attributes.normal)surface.computeVertexNormals();
 const fields=['position','normal','uv','color'].filter(key=>surface.attributes[key]);
 const buffer=Object.fromEntries(fields.map(key=>[key,[]]));
 const clipped=new T.BufferGeometry(),index=surface.index;
 function vertex(i){
  const id=index?index.getX(i):i;
  return fields.map(key=>{const attr=surface.attributes[key];return Array.from({length:attr.itemSize},(_,c)=>attr.getComponent(id,c));});
 }
 const groups=surface.groups.length?surface.groups:[{start:0,count:index?.count??surface.attributes.position.count,materialIndex:0}];
 for(const {start,count,materialIndex} of groups){
  const first=buffer.position.length/3;
  for(let i=start;i<start+count;i+=3){
   const face=[vertex(i),vertex(i+1),vertex(i+2)],poly=[];
   for(let j=0;j<3;j++){
    const a=face[(j+2)%3],b=face[j],ay=a[0][1],by=b[0][1];
    if((ay<limit&&by>limit)||(ay>limit&&by<limit)){
     const t=(limit-ay)/(by-ay);
     poly.push(a.map((field,k)=>field.map((v,c)=>v+t*(b[k][c]-v))));
    }
    if(by<=limit)poly.push(b);
   }
   for(let j=1;j+1<poly.length;j++)for(const v of [poly[0],poly[j],poly[j+1]])fields.forEach((key,k)=>buffer[key].push(...v[k]));
  }
  const length=buffer.position.length/3-first;
  if(length)clipped.addGroup(first,length,materialIndex);
 }
 surface.dispose();
 if(!buffer.position.length)return null;
 for(const key of fields)clipped.setAttribute(key,new T.Float32BufferAttribute(buffer[key],mesh.geometry.attributes[key]?.itemSize??3));
 const materials=Array.isArray(mesh.material)?mesh.material.map(m=>shellMaterial(m,kind,limit,height)):shellMaterial(mesh.material,kind,limit,height);
 const result=new T.Mesh(clipped,materials);
 result.castShadow=mesh.castShadow;result.receiveShadow=mesh.receiveShadow;
 return result;
}
export function openFoodShell(source,kind){
 source.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(source,true),limit=T.MathUtils.lerp(bounds.min.y,bounds.max.y,cuts[kind]);
 const group=new T.Group();
 source.traverse(mesh=>{if(mesh.isMesh){const piece=trimMesh(mesh,limit,kind,limit-bounds.min.y);if(piece)group.add(piece);}});
 return group;
}
