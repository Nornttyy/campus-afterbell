import {createSkinContact} from './skin-contact68.js';
import * as T from './vendor/three.module.js';
import {clonePropAsset} from './prop-assets.js?v=campus-78';
const V=()=>new T.Vector3();
export const SCHOOL_PEN=Object.freeze({length:.175,tipY:-.0875,gripY:-.030,radius:.010,gripRadius:.0105});
export function createSchoolPen(){
 const supplied=clonePropAsset('pen');if(supplied){supplied.userData.pen={...SCHOOL_PEN};return supplied;}
 const group=new T.Group();group.name='red-school-pen';
 const body=new T.MeshStandardMaterial({color:'#c8302d',roughness:.40}),rubber=new T.MeshStandardMaterial({color:'#282c30',roughness:.86}),metal=new T.MeshStandardMaterial({color:'#bfc7ca',roughness:.28,metalness:.72}),dark=new T.MeshStandardMaterial({color:'#12191c',roughness:.55});
 const part=(name,geometry,material,y=0)=>{const m=new T.Mesh(geometry,material);m.name=name;m.position.y=y;group.add(m);return m;};
 part('gel-pen-barrel',new T.CylinderGeometry(.0088,.0088,.120,16),body,.005);
 part('gel-pen-grip',new T.CylinderGeometry(.0105,.0100,.045,16),rubber,-.039);
 for(let i=0;i<6;i++)part('gel-pen-grip-ring-'+i,new T.TorusGeometry(.0103,.0006,5,16),rubber,-.058+i*.007).rotation.x=Math.PI/2;
 const cone=part('gel-pen-nose',new T.ConeGeometry(.0098,.022,16),metal,-.0725);cone.rotation.z=Math.PI;
 const nib=part('gel-pen-nib',new T.ConeGeometry(.0028,.006,12),dark,-.0845);nib.rotation.z=Math.PI;
 part('gel-pen-button',new T.CylinderGeometry(.008,.008,.012,16),metal,.0755);
 const clip=part('gel-pen-clip',new T.BoxGeometry(.003,.040,.004),metal,.051);clip.position.x=.010;
 group.userData.pen={...SCHOOL_PEN};return group;
}

// One actual skinned fingertip, chosen once from the imported weights. Pen
// posing reads this cached vertex instead of traversing a character per frame.
export function createPenFingerContact(group,bones,{side='Right',finger='Index'}={}){
 const bone=bones[side+'Hand'+finger+'3'];group.updateMatrixWorld(true);
 const origin=bone.getWorldPosition(V()),axis=origin.clone().sub(bone.parent.getWorldPosition(V())).normalize();
 let chosen=null,best=-Infinity;
 group.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const bi=mesh.skeleton.bones.indexOf(bone);if(bi<0)return;
  const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;mesh.skeleton.update();
  for(let i=0;i<indices.count;i++){
   let w=0;for(let j=0;j<4;j++)if(indices.getComponent(i,j)===bi)w+=weights.getComponent(i,j);
   if(w<.3)continue;
   const score=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).sub(origin).dot(axis);
   if(score>best){best=score;chosen={mesh,i,sample:createSkinContact(mesh,i)};}
  }
 });
 return ()=>{if(!chosen)return bone.getWorldPosition(V());return chosen.sample(V());};
}

// The shaft lies on the desk plane, rotating about the vertical axis. Callers
// compose this with their character frame rather than a vertical pinwheel.
export function penTwirlQuaternion(time){return new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),time*Math.PI*2/1.6).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),Math.PI/2));}
