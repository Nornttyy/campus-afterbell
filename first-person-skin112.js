import * as T from './vendor/three.module.js';

const shapes=new WeakMap(),paints=new WeakMap();
const smooth=T.MathUtils.smoothstep;

// The source forearm is a cropped tracksuit cuff. Make both halves of the
// closed skin share one elliptical section and the same normal at their seam.
function bareShape(original,side){
 if(shapes.has(original))return shapes.get(original);
 const g=original.clone(),p=g.attributes.position,n=g.attributes.normal;
 const textureWeight=new Float32Array(p.count),colours=new Float32Array(3*p.count),normal=new T.Vector3(),surface=new T.Vector3();
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  normal.fromBufferAttribute(n,i).normalize();
  // The original sleeve folds overlap the hand up to the thumb saddle.
  // Keep the protruding thumb lobe independent of the wrist section.
  const thumb=smooth(-z,.036,.078)*smooth(y,-.044,-.018);
  const blend=(1-smooth(y,-.030,.025))*(1-thumb);
  textureWeight[i]=Math.max(thumb,smooth(y,-.005,.036));
  const cavity=g.attributes.campusOcclusion;
  if(cavity)cavity.setX(i,cavity.getX(i)*textureWeight[i]);
  if(blend>0){
   const along=smooth(-y,.029,.100),rx=.041+.009*along+.006*smooth(y,-.035,.018),rz=.032+.008*along;
   const u=(x-(side<0?-.00709:.00426))/(side<0?.0793:.0795);
   const v=(z-(side<0?.01147:.01911))/(side<0?.0748:.0752);
   const len=Math.hypot(u,v)||1,cos=u/len,sin=v/len;
   const t=T.MathUtils.clamp((-.100-y)/.015,0,1),ring=t>.9999?0:Math.sqrt(1-t*t);
   // Leave the thumb web on its original rig and match the native wrist as
   // this section opens into the heel of the palm.
   const centreX=side*.003*along,centreZ=.004*along;
   p.setXYZ(i,T.MathUtils.lerp(x,centreX+rx*ring*cos,blend),y,T.MathUtils.lerp(z,centreZ+rz*ring*sin,blend));
   const slope=(y<-.029&&y>-.100)?6*((-y-.029)/.071)*(1-(-y-.029)/.071)/.071:0;
   surface.set(ring*cos/rx,t?-t/.015:slope*(.009*cos*cos/rx+.008*sin*sin/rz),ring*sin/rz).normalize();
   normal.lerp(surface,blend).normalize();n.setXYZ(i,normal.x,normal.y,normal.z);
  }
  // Soft baked form is visible in the editor as well as during a round.
  const fill=.82+.18*T.MathUtils.clamp(.48+.51*normal.z+.18*normal.y-side*.15*normal.x,0,1);
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
