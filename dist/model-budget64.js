// Enforce the same per-asset budget at the loader boundary and in release QA.
// Count shared geometry once; repeated classrooms do not multiply a source's
// mesh budget. Runtime instancing is accounted separately by renderer stats.
export const MODEL_TRIANGLE_LIMIT=8000;
export function modelTriangles(source){
 const scene=source?.scene||source,seen=new Set();let triangles=0;
 if(!scene?.traverse)throw new Error('模型缺少场景');
 scene.traverse(node=>{if(!node.isMesh||!node.geometry||seen.has(node.geometry))return;seen.add(node.geometry);triangles+=(node.geometry.index?.count??node.geometry.attributes.position?.count??0)/3;});
 return triangles;
}
export function requireModelBudget(source,label='模型'){
 const triangles=modelTriangles(source);
 if(!Number.isInteger(triangles)||triangles<1||triangles>MODEL_TRIANGLE_LIMIT)throw new Error(`${label}：${triangles} 三角面，限制 ${MODEL_TRIANGLE_LIMIT}`);
 return source;
}
