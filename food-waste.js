import * as T from './vendor/three.module.js';

const crumb=new T.IcosahedronGeometry(1,0);
const crust=new T.MeshStandardMaterial({color:0xa66434,roughness:.96,flatShading:true});
const filling=new T.MeshStandardMaterial({color:0xdfba79,roughness:1,flatShading:true});

export function foodWaste(){
 const group=new T.Group();
 group.name='food-scraps';
 for(const [x,y,z,w,h,d,material] of [
  [-.024,0,0,.036,.048,.023,crust],[.019,-.007,.008,.031,.026,.020,filling],
  [.037,.023,0,.019,.021,.016,crust],[-.005,.037,.006,.017,.018,.013,filling]
 ]){
  const piece=new T.Mesh(crumb,material);
  piece.position.set(x,y,z);piece.scale.set(w,h,d);piece.rotation.z=x*23;
  group.add(piece);
 }
 return group;
}
