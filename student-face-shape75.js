import * as T from './vendor/three.module.js';

// Local, reversible sculpt of the authored Tripo mesh. The reference students
// have a broad, fairly flat lower face, rather than a tapered doll-like jaw.
// Metre-space profiles are measured on the four shipping rest-pose meshes.
// Eyes, hair, ears, neck, clothes, UVs and skin weights are deliberately retained.
const profiles = {
 boy:{bottom:1.175,top:1.356,halfWidth:.205,front:.215,mouthY:1.289,mouthWidth:.058,mouthHeight:.026,mouthFlatten:.45,noseY:1.355,noseZ:.240,noseDepth:.009},
 girl:{bottom:1.192,top:1.350,halfWidth:.203,front:.195,mouthY:1.294,mouthWidth:.048,mouthHeight:.020,mouthFlatten:.28,noseY:1.353,noseZ:.216,noseDepth:.004},
 ponytail:{bottom:1.145,top:1.309,halfWidth:.200,front:.184,mouthY:1.255,mouthWidth:.052,mouthHeight:.021,mouthFlatten:.22,noseY:1.299,noseZ:.205,noseDepth:.004},
 glasses:{bottom:1.151,top:1.338,halfWidth:.221,front:.254,mouthY:1.264,mouthWidth:.065,mouthHeight:.025,mouthFlatten:.18,noseY:1.344,noseZ:.287,noseDepth:.015}
};
const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const cache=new WeakMap();

export function sculptStudentFace(point,variant,target=new T.Vector3()){
 const s=profiles[variant];target.copy(point);if(!s)return target;
 const {x,y,z}=point,ax=Math.abs(x);
 // Limit this sculpt to the lower front of the head. In particular the side
 // hair of the girls and the separate spectacle frame must not be inflated.
 const lower=smooth(s.bottom-.006,s.bottom+.040,y)*(1-smooth(s.top-.040,s.top,y));
 const front=smooth(.045,.105,z)*(1-smooth(s.halfWidth+.012,s.halfWidth+.048,ax));
 const jaw=lower*front;
 const side=smooth(.035,.155,ax);
 target.x+=Math.sign(x)*.020*side*jaw;
 // Lower the curved corners, leaving the centre of the chin/neck junction.
 target.y-=.004*side*jaw;
 // Compress the rounded cheek profile into a broader front plane. Never
 // clamp depth: that creates a visible ridge at the lip and the side of jaw.
 target.z+=(s.front-z)*.64*smooth(s.front-.045,s.front+.012,z)*jaw;
 const mouth=(1-smooth(.48,1,Math.hypot(x/s.mouthWidth,(y-s.mouthY)/s.mouthHeight)))*smooth(s.front-.035,s.front,z);
 target.y-=(y-s.mouthY)*s.mouthFlatten*mouth;
 // Flatten the small spherical nose, keeping its silhouette and UV colour.
 const nose=(1-smooth(.25,1,Math.hypot(x/.031,(y-s.noseY)/.026)))*smooth(s.noseZ-.006,s.noseZ+.012,z);
 target.z-=s.noseDepth*nose;
 return target;
}

function prepare(geometry,rest,variant){
 const copy=geometry.clone(),p=copy.attributes.position,n=copy.attributes.normal;
 const local=rest.clone().invert(),toRestNormal=new T.Matrix3().getNormalMatrix(rest),toLocalNormal=new T.Matrix3().getNormalMatrix(local);
 const point=new T.Vector3(),next=new T.Vector3(),normal=new T.Vector3(),columns=[new T.Vector3(),new T.Vector3(),new T.Vector3()];
 const jacobian=new T.Matrix3(),inverseTranspose=new T.Matrix3(),epsilon=.0001,changedIndices=[];let changed=0,maxDisplacement=0;
 for(let i=0;i<p.count;i++){
  point.fromBufferAttribute(p,i).applyMatrix4(rest);sculptStudentFace(point,variant,next);
  const displacement=point.distanceTo(next);if(displacement<1e-8)continue;
  changed++;changedIndices.push(i);maxDisplacement=Math.max(maxDisplacement,displacement);
  if(n){
   // Transform the authored normal by the sculpt's Jacobian; this preserves
   // smoothing across UV seams instead of recomputing hard seam normals.
   for(let axis=0;axis<3;axis++){
    const a=point.clone(),b=point.clone();a.setComponent(axis,a.getComponent(axis)+epsilon);b.setComponent(axis,b.getComponent(axis)-epsilon);
    sculptStudentFace(a,variant,a);sculptStudentFace(b,variant,b);columns[axis].subVectors(a,b).multiplyScalar(.5/epsilon);
   }
   jacobian.set(columns[0].x,columns[1].x,columns[2].x,columns[0].y,columns[1].y,columns[2].y,columns[0].z,columns[1].z,columns[2].z);
   inverseTranspose.copy(jacobian).invert().transpose();normal.fromBufferAttribute(n,i).applyMatrix3(toRestNormal).normalize().applyMatrix3(inverseTranspose).applyMatrix3(toLocalNormal).normalize();
   n.setXYZ(i,normal.x,normal.y,normal.z);
  }
  next.applyMatrix4(local);p.setXYZ(i,next.x,next.y,next.z);
 }
 copy.userData.studentFace75={variant,changedIndices};
 copy.computeBoundingBox();copy.computeBoundingSphere();
 return {geometry:copy,changed,maxDisplacement,refs:0};
}

export function createStudentFaceShape(model,{variant='boy',enabled=true}={}){
 const entries=[];let disposed=false;
 if(enabled&&profiles[variant]){
  model.updateWorldMatrix(true,true);
  model.traverse(mesh=>{
   if(!mesh.isSkinnedMesh)return;
   const original=mesh.geometry,rest=mesh.matrixWorld.clone(),key=variant+':'+rest.elements.join(',');
   let variants=cache.get(original);if(!variants){variants=new Map();cache.set(original,variants);}
   let prepared=variants.get(key);if(!prepared){prepared=prepare(original,rest,variant);variants.set(key,prepared);}
   prepared.refs++;mesh.geometry=prepared.geometry;entries.push({mesh,original,prepared,variants,key});
  });
 }
 return {
  diagnostics:()=>({enabled:entries.length>0,revision:75,changedVertices:entries.reduce((sum,e)=>sum+e.prepared.changed,0),maxDisplacement:Math.max(0,...entries.map(e=>e.prepared.maxDisplacement))}),
  dispose(){if(disposed)return;disposed=true;for(const e of entries){e.mesh.geometry=e.original;if(--e.prepared.refs===0){e.prepared.geometry.dispose();e.variants.delete(e.key);}}}
 };
}
