import * as T from './vendor/three.module.js';
import {attacks} from './teacher-attacks129.js?v=campus-117&rev=156';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
import {TEACHER_PROPORTIONS} from './teacher-proportions73.js?v=campus-83';

import {cloneCharacter} from './clone-character57.js?v=campus-83';
import {JUMP_SPEED,JUMP_GRAVITY} from './actor-jump90.js?v=campus-117&rev=156';
let template;

function restRig(model){
 let skin;model.traverse(o=>{if(!skin&&o.isSkinnedMesh)skin=o.skeleton;});
 const bones=new Map();
 if(skin)skin.bones.forEach((bone,i)=>{
  const matrix=skin.boneInverses[i].clone().invert(),orientation=new T.Quaternion();
  matrix.decompose(new T.Vector3(),orientation,new T.Vector3());
  bones.set(bone.name,{bone,orientation});
 });
 return bones;
}
export function mountDoubao(group){
 const male=group.children[0];
 let body,mixer,clips={},playing,loading,failed=false,pairs=[],pointer;
 const rotation=new T.Quaternion(),parentRotation=new T.Quaternion();
 function load(){
  template??=new GLTFLoader().loadAsync(new URL('./assets/models/doubao-teacher136.glb',import.meta.url).href);
  loading=template.then(asset=>{
   body=cloneCharacter(asset.scene);
   pointer=body.getObjectByName('HomeroomPointer');
   const source=restRig(male),dest=restRig(body);
   body.traverse(b=>{const from=source.get(b.name),to=dest.get(b.name);if(from&&to)pairs.push({src:from.bone,dst:b,offset:from.orientation.clone().invert().multiply(to.orientation)});});
   const bounds=new T.Box3().setFromObject(body,true);
   body.scale.multiplyScalar(TEACHER_PROPORTIONS.height/(bounds.max.y-bounds.min.y));
   body.traverse(o=>{if(o.isSkinnedMesh){o.frustumCulled=false;o.castShadow=true;}});
   body.visible=false;group.add(body);
   mixer=new T.AnimationMixer(body);
   for(const original of asset.animations){
    const clip=original.clone();
    // Physics supplies flight height. The clip contributes limb poses and compression.
    if(clip.name==='Jump')for(const track of clip.tracks)if(track.name.endsWith('Hips.position')){
     const rest=track.values[1];for(let i=1;i<track.values.length;i+=3)track.values[i]=Math.min(rest,track.values[i]);
    }
    clips[clip.name]=mixer.clipAction(clip);
   }
  }).catch(e=>{failed=true;console.error('女班主任模型加载失败',e);});
 }
 return (state,dt,speed)=>{
  const t=state.teacher,wanted=t.variant==='doubao';
  if(wanted&&!loading&&!failed)load();
  if(!body)return;
  male.visible=!wanted;body.visible=wanted;
  if(!wanted){if(playing)mixer.stopAllAction();playing=null;return;}
  const attack=attacks[t.attackKind];
  const action=t.attackKind==='vertical'?'VerticalSlash':'HorizontalSlash';
  let name=attack&&t.attackAge!=null&&clips[action]&&t.attackAge<attack.duration?action:
    t.jumpHeight>.015?'Jump':speed>.10?(t.sprinting?'Run':'Walk'):'PointerIdle';
  const a=clips[name];
  if(playing!==a){
   const before=playing;playing=a;a.reset().setEffectiveWeight(1).play();
   if(before)before.crossFadeTo(a,.085,false);
  }
  if(name===action){a.time=t.attackAge*a.getClip().duration/attack.duration;a.timeScale=0;}
  else a.timeScale=1;
  if(name==='Jump'&&Number.isFinite(t.jumpSpeed)){
   a.time=.40+T.MathUtils.clamp((JUMP_SPEED-t.jumpSpeed)/JUMP_GRAVITY,0,.55);a.timeScale=0;
  }
  mixer.update(dt);
  const contextual=t.phase==='stunned'||t.seated||t.writing||t.carriedId!=null||t.emote;
  if(pointer)pointer.visible=!contextual;
  if(contextual){
   // Apply the actor's existing seated, stun and interaction poses in rest-bone space.
   for(const {src,dst,offset} of pairs){
    src.getWorldQuaternion(rotation).multiply(offset);
    dst.parent.getWorldQuaternion(parentRotation);
    dst.quaternion.copy(parentRotation.invert().multiply(rotation));
   }
  }
 };
}

// Rounded leading edge and a translucent swept tail. The crown rises above
// the sheet, keeping its silhouette readable even looking directly along it.
function waveGeometry(vertical){
 const vertices=[],uv=[],indices=[];
 const section=[[0,0],[.075,.066],[.22,.052],[.52,.018],[1,0],[.42,-.025],[.09,-.055],[0,0]];
 for(let i=0;i<=40;i++){
  const x=i/20-1,taper=Math.pow(Math.max(0,1-x*x),.72);
  for(let j=0;j<section.length;j++){
   const [trail,h]=section[j];
   if(vertical){
    // The upright blade has a straight spine and pointed ends in its own plane.
    const width=1-Math.abs(x);
    vertices.push(h*width,x,(.06-.37*trail)*width);
   }else vertices.push(x,(.26-.18*trail)*(1-x*x)+h*taper,.59*(1-x*x)-.46*trail*taper);
   uv.push(trail,x);
   if(i&&j){const n=i*section.length+j,k=n-section.length;indices.push(k-1,k,n,k-1,n,n-1);}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);return g;
}
function waveMaterial(){
 return new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,uniforms:{strength:{value:1}},
  vertexShader:`varying vec2 edge;void main(){edge=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec2 edge;uniform float strength;void main(){
   float coverage=(1.-smoothstep(.16,1.,edge.x))*(1.-smoothstep(.83,1.,abs(edge.y)));
   gl_FragColor=vec4(vec3(1.0),coverage*strength);
   #include <colorspace_fragment>
  }`});
}
export function teacherProjectiles(parent){
 const waves={vertical:waveGeometry(true),horizontal:waveGeometry(false)};
 const felt=new T.MeshStandardMaterial({color:0x454648}),wood=new T.MeshStandardMaterial({color:0xdca96b});
 const block=new T.BoxGeometry(.22,.075,.12),chalk=new T.CylinderGeometry(.012,.012,.11,8),white=new T.MeshStandardMaterial({color:0xfff9e7});
 const pools=new Map(),up=new T.Vector3(0,1,0),velocity=new T.Vector3();
 return entries=>{
  const used=new Map();
  for(const c of entries){
   if(c.windup>0||c.dead)continue;
   const kind=c.kind||'chalk',n=used.get(kind)||0;used.set(kind,n+1);
   if(!pools.has(kind))pools.set(kind,[]);
   const pool=pools.get(kind);let m=pool[n];
   if(!m){
    if(kind==='eraser'){m=new T.Mesh(block,felt);const lid=new T.Mesh(block,wood);lid.position.y=.046;lid.scale.y=.30;m.add(lid);}
    else if(kind==='chalk')m=new T.Mesh(chalk,white);
    else{m=new T.Group();const arc=new T.Mesh(waves[kind],waveMaterial());m.add(arc);}
    parent.add(m);pool[n]=m;
   }
   m.visible=true;m.position.set(c.x,c.y,c.z);
   if(kind==='chalk')m.quaternion.setFromUnitVectors(up,velocity.set(c.vx,c.vy,c.vz).normalize());
   else if(kind==='eraser')m.rotation.set(c.age*9,c.yaw,c.age*4);
   else{
    const vertical=kind==='vertical',spec=attacks[kind];
    const arc=m.children[0];
    m.rotation.y=c.yaw;
    arc.position.y=.22;
    arc.rotation.z=vertical?0:.085;
    arc.rotation.x=vertical?0:-.18;
    arc.scale.set(vertical?1:spec.width,vertical?spec.height:1,.8);
    arc.material.uniforms.strength.value=.98*(1-T.MathUtils.smoothstep(c.fadeAge??0,0,spec.fade));
   }
  }
  for(const [kind,pool] of pools)for(let i=used.get(kind)||0;i<pool.length;i++)pool[i].visible=false;
 };
}
