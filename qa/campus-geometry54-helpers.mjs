import * as T from '../dist/vendor/three.module.js';
import {buildReferenceCampus} from '../dist/reference-campus.js';
export function campusScene(){
 const scene=new T.Scene(),room=new T.Group();scene.add(room);const assets=new Set(),materials=new Set();
 const mat=(color,o={})=>{const m=new T.MeshStandardMaterial({color,...o});materials.add(m);return m;};
 const mesh=(g,m,p,s=[1,1,1],r=null,parent=room)=>{const o=new T.Mesh(g,m);o.position.set(...p);o.scale.set(...s);if(r)o.rotation.set(...r);parent.add(o);return o;};
 const box=(m,p,s,r=null,parent=room)=>mesh(new T.BoxGeometry(...s),m,p,[1,1,1],r,parent),rounded=(m,p,s,rad,r=null,parent=room)=>box(m,p,s,r,parent),cylinder=(m,p,s,r=null,parent=room)=>mesh(new T.CylinderGeometry(s[0],s[2],s[1],8),m,p,[1,1,1],r,parent),texture=()=>new T.Texture(),base=mat('#fff'),M=new Proxy({},{get:()=>base});
 const artwork={teacherTutorial:new T.Texture(),studentTutorial:new T.Texture(),classroomNotice:new T.Texture()},campus=buildReferenceCampus({scene,room,M,mat,mesh,box,rounded,cylinder,texture,assets,materials,floorMat:base,artwork});campus.enclosure.visible=true;campus.attachUpperArchitecture();scene.updateMatrixWorld(true);
 return{scene,campus,artwork,dispose(){scene.traverse(o=>o.geometry?.dispose());for(const m of materials)m.dispose();for(const a of assets)a.dispose?.();}};
}
