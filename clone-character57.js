// A clone owns its skeleton, while the authored geometry/materials stay shared.
export function cloneCharacter(source){
 const copy=source.clone(true),map=new Map();
 function pair(a,b){map.set(a,b);a.children.forEach((c,i)=>pair(c,b.children[i]));}pair(source,copy);
 source.traverse(o=>{if(o.isSkinnedMesh){const n=map.get(o);n.skeleton=o.skeleton.clone();n.skeleton.bones=o.skeleton.bones.map(b=>map.get(b));n.bindMatrix.copy(o.bindMatrix);n.bind(n.skeleton,n.bindMatrix);n.frustumCulled=false;}});return copy;
}
