import * as T from './vendor/three.module.js';

// A small, stable set of readable meshes; simulation snapshots own every clock.
// No new particle is allocated each frame and pause cannot keep effects moving.
export function createItemEffects50(scene,{floorAt=()=>0,getActor=()=>null}={}){
 const root=new T.Group();root.name='classroom-item-effects50';scene.add(root);
 const pools={peels:new Map(),burps:new Map(),stars:new Map(),ink:new Map()},geometries=new Set(),materials=new Set();
 const geometry=g=>(geometries.add(g),g),material=m=>(materials.add(m),m);
 const peelOuter=material(new T.MeshStandardMaterial({color:'#f4cf43',roughness:.72,side:T.DoubleSide})),peelInner=material(new T.MeshStandardMaterial({color:'#fff2b6',roughness:.88,side:T.DoubleSide}));
 const stemMaterial=material(new T.MeshStandardMaterial({color:'#76542b',roughness:1}));
 const stemGeometry=geometry(new T.CylinderGeometry(.014,.022,.055,7));
 function ribbon(){
  const vertices=[],indices=[],n=14;
  for(let i=0;i<=n;i++){const t=i/n,center=.035+.24*t,y=.12*(1-t)**2+.014,width=.055*Math.sin(Math.PI*(.06+.91*t));vertices.push(center,y,-width,center,y,width);if(i<n){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return geometry(g);
 }
 const peelGeometry=ribbon();
 function makePeel(){const group=new T.Group();for(let i=0;i<3;i++){const fold=new T.Group(),outer=new T.Mesh(peelGeometry,peelOuter),inner=new T.Mesh(peelGeometry,peelInner);fold.rotation.y=i*Math.PI*2/3+.25;inner.position.y=.002;fold.add(outer,inner);group.add(fold);}const stem=new T.Mesh(stemGeometry,stemMaterial);stem.position.y=.13;group.add(stem);return group;}
 const puffGeometry=geometry(new T.IcosahedronGeometry(1,2));
 function makeBurp(){const group=new T.Group(),m=material(new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{opacity:{value:1}},vertexShader:`varying vec3 n;varying vec3 eye;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);eye=-p.xyz;gl_Position=projectionMatrix*p;}`,fragmentShader:`uniform float opacity;varying vec3 n;varying vec3 eye;void main(){float f=max(0.,dot(normalize(n),normalize(eye)));float edge=smoothstep(0.,.6,f);vec3 colour=mix(vec3(.24,.40,.10),vec3(.64,.76,.24),f);gl_FragColor=vec4(colour,edge*.27*opacity);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')}));for(let i=0;i<3;i++){const puff=new T.Mesh(puffGeometry,m);puff.userData.phase=i;group.add(puff);}group.userData.material=m;return group;}
 const starShape=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI*.5+i*Math.PI/5,r=i%2?.43:1;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?starShape.lineTo(x,y):starShape.moveTo(x,y);}starShape.closePath();
 const starGeometry=geometry(new T.ExtrudeGeometry(starShape,{depth:.12,bevelEnabled:false})),starMaterial=material(new T.MeshBasicMaterial({color:'#ffd73c',toneMapped:false}));
 function makeStars(){const g=new T.Group();for(let i=0;i<3;i++){const star=new T.Mesh(starGeometry,starMaterial);star.scale.setScalar(.078);g.add(star);}return g;}
 // A curved irregular stain sits just ahead of the face surface. It does not
 // tint the shirt or hair, which share the same imported texture atlas.
 const stainVertices=[0,0,.06],stainIndices=[],segments=48;
 for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,r=.86+.07*Math.sin(a*5)+.045*Math.sin(a*11);stainVertices.push(Math.cos(a)*r,Math.sin(a)*r,.005);if(i<segments)stainIndices.push(0,i+1,i+2);}
 const inkGeometry=geometry(new T.BufferGeometry());inkGeometry.setAttribute('position',new T.Float32BufferAttribute(stainVertices,3));inkGeometry.setIndex(stainIndices);inkGeometry.computeVertexNormals();
 function makeInk(){return new T.Mesh(inkGeometry,material(new T.MeshBasicMaterial({color:'#111419',transparent:true,opacity:.97,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,depthWrite:false})));}
 function acquire(pool,id,create){let item=pool.get(id);if(!item){item=create();root.add(item);pool.set(id,item);}item.visible=true;return item;}
 const headPosition=new T.Vector3(),worldQuaternion=new T.Quaternion(),up=new T.Vector3(0,1,0);
 function actorHead(s,state){const record=getActor(s.id??-1),actor=record?.actor||record;const head=actor?.bones?.Head;if(head){head.getWorldPosition(headPosition);return headPosition.clone();}return new T.Vector3(s.x,floorAt(s.x,s.z,state.map)+(s.stunLeft>0?1.05:s.id===-1?1.97:s.seated?1.47:1.73),s.z);}
 function update(state){
  for(const pool of Object.values(pools))for(const entry of pool.values())entry.visible=false;
  if(!state)return;const time=Number.isFinite(state.elapsed)?state.elapsed:0;
  for(const p of state.peels||[]){const mesh=acquire(pools.peels,p.id,makePeel);mesh.position.set(p.x,p.y+(p.armed?-.06:0),p.z);mesh.rotation.set(p.armed?0:p.spinX||0,p.id*.74,p.armed?0:p.spinZ||0);}
  for(const b of state.burps||[]){const group=acquire(pools.burps,b.id,makeBurp);group.position.set(b.x,b.y,b.z);group.rotation.y=b.yaw||0;const fade=Math.min(1,b.age/.12,Math.max(0,(b.lifetime-b.age)/.45));group.userData.material.uniforms.opacity.value=fade;group.children.forEach((p,i)=>{const growth=.10+.11*Math.min(1,b.age/.4),phase=b.age*2+i*2.1;p.scale.set(growth*(1+i*.12),growth*.72,growth*1.25);p.position.set(Math.sin(phase)*.035,Math.cos(phase)*.025,-i*.13);});}
  const actors=[...(state.students||[]),{...state.teacher,id:-1}];
  for(const s of actors){if(s.visible===false||!Number.isFinite(s.x)||!Number.isFinite(s.z))continue;const local=s.id===state.player?.id;
   if(s.stunLeft>0&&!local){const stars=acquire(pools.stars,s.id,makeStars),at=actorHead(s,state);stars.position.copy(at).add(new T.Vector3(0,.45,0));stars.children.forEach((star,i)=>{const a=time*2.8+i*Math.PI*2/3;star.position.set(Math.cos(a)*.28,Math.sin(a*2)*.025,Math.sin(a)*.22);star.rotation.set(.15,a+Math.PI/2,Math.sin(a)*.2);});}
   if(s.inkLeft>0&&!local){const stain=acquire(pools.ink,s.id,makeInk),at=actorHead(s,state),yaw=s.yaw||0,forward=s.id===-1?.31:.28;stain.position.copy(at).add(new T.Vector3(Math.sin(yaw)*forward,-.055,Math.cos(yaw)*forward));stain.rotation.set(0,yaw,0);stain.scale.set(s.id===-1?.38:.31,s.id===-1?.35:.30,1);stain.material.opacity=.97*Math.min(1,s.inkLeft/1.5);}
  }
  // Reuse a bounded pool; completed item IDs cannot grow memory for an endless class.
  for(const pool of Object.values(pools))for(const [id,mesh]of pool)if(!mesh.visible){mesh.removeFromParent();if(mesh.userData.material){materials.delete(mesh.userData.material);mesh.userData.material.dispose();}if(pool===pools.ink){materials.delete(mesh.material);mesh.material.dispose();}pool.delete(id);}
 }
 return{update,dispose(){root.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const p of Object.values(pools))p.clear();},diagnostics:()=>Object.fromEntries(Object.entries(pools).map(([key,pool])=>[key,pool.size]))};
}
