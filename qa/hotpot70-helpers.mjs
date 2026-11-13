import * as T from '../dist/vendor/three.module.js';
export function hotpotHelpers(parent,{textureDraw=false}={}){
 const boxGeo=new T.BoxGeometry(1,1,1),sharedGeometries=new Set([boxGeo]),materials=new Set(),cache=new Map();
 const mat=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.82,...extra});materials.add(m);return m;};
 const mesh=(g,m,p,s=[1,1,1],r=null,root=parent)=>{const o=new T.Mesh(g,m);o.position.set(...p);o.scale.set(...s);if(r)o.rotation.set(...r);o.castShadow=o.receiveShadow=true;root.add(o);return o;};
 const box=(m,p,s,r=null,root=parent)=>mesh(boxGeo,m,p,s,r,root);
 const rounded=(m,p,s,r=.015,rotation=null,root=parent)=>{
  const key=[...s,r].join(',');let g=cache.get(key);if(!g){const[w,h,d]=s;r=Math.min(r,h*.24,w*.24,d*.24);const a=w-2*r,b=h-2*r,q=Math.min(r,b*.35),x=-a/2,y=-b/2,shape=new T.Shape();shape.moveTo(x+q,y);shape.lineTo(x+a-q,y);shape.quadraticCurveTo(x+a,y,x+a,y+q);shape.lineTo(x+a,y+b-q);shape.quadraticCurveTo(x+a,y+b,x+a-q,y+b);shape.lineTo(x+q,y+b);shape.quadraticCurveTo(x,y+b,x,y+b-q);shape.lineTo(x,y+q);shape.quadraticCurveTo(x,y,x+q,y);g=new T.ExtrudeGeometry(shape,{depth:d-2*r,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:3,steps:1,curveSegments:4});g.translate(0,0,-(d-2*r)/2);cache.set(key,g);sharedGeometries.add(g);}return mesh(g,m,p,[1,1,1],rotation,root);
 };
 const texture=(w,h,draw)=>{if(!textureDraw)return new T.Texture();const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;draw(canvas.getContext('2d'),w,h);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;};
 return{parent,box,rounded,mat,texture,sharedGeometries,materials,dispose(){for(const g of sharedGeometries)g.dispose();for(const m of materials)m.dispose();}};
}
