import * as T from './vendor/three.module.js';

const shapes=new WeakMap(),paints=new WeakMap();
const smooth=T.MathUtils.smoothstep;

// The source forearm is a cropped tracksuit cuff. Make both halves of the
// closed skin share one elliptical section and the same normal at their seam.
function bareShape(original,side){
 if(shapes.has(original))return shapes.get(original);
 const g=original.clone(),p=g.attributes.position,n=g.attributes.normal;
 const textureWeight=new Float32Array(p.count),colours=new Float32Array(3*p.count);
 const normal=new T.Vector3(),surface=new T.Vector3();
 const cx=side<0?-.00709:.00426,cz=side<0?.01147:.01911;
 const cavity=g.attributes.campusOcclusion;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  normal.fromBufferAttribute(n,i).normalize();
  const thumb=smooth(-z,.045,.088)*smooth(y,-.044,-.015);
  const wrist=(1-smooth(y,.002,.040))*(1-thumb);
  textureWeight[i]=Math.max(thumb,smooth(y,.009,.049));
  if(cavity)cavity.setX(i,cavity.getX(i)*textureWeight[i]);
  if(wrist>0){
   const u=(x-cx)/(side<0?.0793:.0795),v=(z-cz)/(side<0?.0748:.0752);
   const angle=Math.atan2(v,u),cos=Math.cos(angle),sin=Math.sin(angle);
   // Keep a broad continuous heel leading into the palm. An inscribed
   // octagon at the cut gives the short forearm its original blunt outline.
   const end=smooth(-y,.012,.100),palm=smooth(y,-.035,.055);
   const sector=Math.PI/4,faceAngle=angle-sector*Math.round(angle/sector);
   const polygon=1+end*(Math.cos(sector/2)/Math.cos(faceAngle)-1);
   const rx=.046+.002*end+.010*palm,rz=.035+.002*end+.005*palm;
   const t=T.MathUtils.clamp((-.100-y)/.015,0,1);
   const ring=t>.9999?0:Math.sqrt(1-t*t);
   const bx=side*.002*end+rx*polygon*ring*cos,bz=.002*end+rz*polygon*ring*sin;
   // Compress only the overlong arm. A shallow bevel meets a flat terminal
   // face. The scale eases back to one before the thumb joint.
   const shortening=.039*(1-smooth(y,-.100,.002));
   const by=(t>0?-.100-.0035*Math.min(1,t/.50):y)+shortening;
   p.setXYZ(i,T.MathUtils.lerp(x,bx,wrist),T.MathUtils.lerp(y,by,wrist),T.MathUtils.lerp(z,bz,wrist));
   const capFace=smooth(t,0,.50);
   surface.set(cos/rx,0,sin/rz).normalize().multiplyScalar(1-capFace);
   surface.y-=capFace;
   normal.lerp(surface.normalize(),wrist).normalize();
  }
  n.setXYZ(i,normal.x,normal.y,normal.z);
  const fill=.84+.16*T.MathUtils.clamp(.48+.51*normal.z+.18*normal.y-side*.15*normal.x,0,1);
  colours.set([fill,fill*.99,fill*.98],i*3);
 }
 g.setAttribute('skinTextureWeight',new T.BufferAttribute(textureWeight,1));
 g.setAttribute('color',new T.BufferAttribute(colours,3));
 g.computeBoundingBox();g.computeBoundingSphere();shapes.set(original,g);return g;
}

export function useStudentHandSkin(mesh,side){
 mesh.geometry=bareShape(mesh.geometry,side);
 const source=mesh.material;
 if(!paints.has(source)){
  const paint=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,map:source.map,roughness:1,side:source.side});
  paint.name='Student hand skin';paint.userData.handSkin=true;paints.set(source,paint);
 }
 mesh.material=paints.get(source);
}

// Preserve the warm shading in the original hand UVs. Pixels formerly
// belonging to the blue/white cuff use the same flesh pigment as the cap.
export function handSkinShading(shader){
 shader.vertexShader='attribute float skinTextureWeight; varying float handInkWeight;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n handInkWeight=skinTextureWeight;');
 shader.fragmentShader='varying float handInkWeight;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
  vec3 wristPigment=vec3(.856,.482,.339);
  #ifdef USE_MAP
   vec3 sourceInk=diffuseColor.rgb;
   float skin=smoothstep(.035,.19,sourceInk.r-max(sourceInk.g,sourceInk.b))*smoothstep(.12,.36,sourceInk.r)*handInkWeight;
   diffuseColor.rgb=mix(wristPigment,mix(wristPigment,sourceInk,.78),skin);
  #else
   diffuseColor.rgb=wristPigment;
  #endif`);
}
