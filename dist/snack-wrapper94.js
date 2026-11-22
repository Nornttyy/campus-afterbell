import * as T from './vendor/three.module.js';

const foil=new T.PlaneGeometry(.138,.145,6,7);
const points=foil.attributes.position;
for(let i=0;i<points.count;i++){
 const x=points.getX(i),y=points.getY(i);
 points.setXYZ(i,x*(.74+.20*Math.cos(y*37)),y,.012*Math.sin(x*74+y*36)+.004*Math.cos(y*105));
}
foil.computeVertexNormals();
const paper=new T.MeshStandardMaterial({color:'#e9bc4e',side:T.DoubleSide,roughness:.72});
const print=new T.MeshStandardMaterial({color:'#b64032',roughness:.82});
const binding=new T.BoxGeometry(.094,.009,.004);
export function snackWrapper(){
 const group=new T.Group();group.name='empty-snack-wrapper';
 group.add(new T.Mesh(foil,paper));const seam=new T.Mesh(binding,print);seam.position.set(0,-.057,.012);seam.rotation.z=-.06;group.add(seam);
 return group;
}
