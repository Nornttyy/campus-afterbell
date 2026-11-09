import * as THREE from './vendor/three.module.js';
import {SURVEILLANCE_MOUNTS} from './surveillance54.js?v=campus-58';
import {floorHeight} from './classroom-layout.js?v=campus-58';
import {createSmokeEffects} from './smoke-effects.js?v=campus-58';

export function createSurveillanceView(scene,renderer,{beforeRender=null}={}){
 const root=new THREE.Group();root.name='classroom-surveillance';scene.add(root);
 const cases=new THREE.MeshStandardMaterial({color:0xd9ded9,roughness:.48}),trim=new THREE.MeshStandardMaterial({color:0x3e5355,roughness:.58}),lens=new THREE.MeshStandardMaterial({color:0x172c38,metalness:.48,roughness:.16}),led=new THREE.MeshBasicMaterial({color:0x9ed96c});
 const owned=[],box=(parent,material,x,y,z,w,h,d)=>{const geo=new THREE.BoxGeometry(w,h,d),mesh=new THREE.Mesh(geo,material);owned.push(geo);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 const records=SURVEILLANCE_MOUNTS.map(mount=>{
  const wallDirection=mount.id==='front'?1:-1;
  const device=new THREE.Group();device.position.set(mount.x,mount.y,mount.z-wallDirection*.08);root.add(device);
  const pivot=new THREE.Group();device.add(pivot);pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(mount.target.x-mount.x,mount.target.y-mount.y,mount.target.z-mount.z).normalize());
  box(pivot,cases,0,0,0,.25,.19,.42);box(pivot,cases,0,.11,.045,.29,.035,.51);box(pivot,trim,0,0,.216,.22,.16,.025);
  const lg=new THREE.CylinderGeometry(.053,.053,.033,20),glass=new THREE.Mesh(lg,lens);owned.push(lg);glass.rotation.x=Math.PI/2;glass.position.z=.242;pivot.add(glass);
  box(pivot,led,.075,-.045,.235,.018,.018,.012);
  // Real wall plate and elbow bracket: the lens needs clearance, not a
  // floating stem ending short of the wall.
  box(device,trim,0,-.14,0,.045,.24,.045);
  box(device,trim,0,-.24,wallDirection*.14,.045,.045,.32);
  box(device,cases,0,-.24,wallDirection*.285,.14,.22,.03);
  const panel=new THREE.Group();panel.position.set(mount.x,1.65,mount.z);panel.rotation.y=mount.id==='front'?Math.PI:0;root.add(panel);panel.name='surveillance-control-'+mount.id;
  box(panel,cases,0,0,0,.22,.3,.05);box(panel,trim,0,.035,.029,.16,.15,.018);box(panel,led,0,-.093,.029,.035,.014,.012);
  // Panel-local negative Z is always toward its wall. A closed mounting
  // box bridges the measured 19.5 cm gap and stops the control hovering.
  box(panel,cases,0,0,-.12,.19,.27,.195);
  return{mount,device,panel};
 });
 const width=384,height=216,target=new THREE.WebGLRenderTarget(width,height,{depthBuffer:false}),linear=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,depthBuffer:true}),camera=new THREE.PerspectiveCamera(79,width/height,.1,55),pixels=new Uint8Array(width*height*4),view=document.createElement('aside');
 const monitorSmoke=createSmokeEffects(renderer,{width,height,samples:0}),frustum=new THREE.Frustum(),projectionView=new THREE.Matrix4(),outputScene=new THREE.Scene(),outputCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 // Render targets contain linear HDR values. Canvas pixels need the same
 // Neutral tone curve and sRGB encoding as the game's main framebuffer.
 const outputMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{image:{value:linear.texture},exposure:{value:1}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform sampler2D image;uniform float exposure;varying vec2 v;
 vec3 neutral(vec3 c){c*=exposure;float x=min(c.r,min(c.g,c.b));c-=x<.08?x-6.25*x*x:.04;float peak=max(c.r,max(c.g,c.b));if(peak<.76)return c;float d=.24;float next=1.-d*d/(peak+d-.76);c*=next/peak;float g=1.-1./(.15*(peak-next)+1.);return mix(c,vec3(next),g);}
 vec3 encode(vec3 c){c=max(c,vec3(0.));return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
 void main(){gl_FragColor=vec4(encode(neutral(texture2D(image,v).rgb)),1.);}`});
 const outputQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),outputMaterial);outputScene.add(outputQuad);
 view.id='surveillance-feed';view.setAttribute('aria-label','监控画面');view.hidden=true;view.style.cssText='position:fixed;right:2vw;bottom:4vh;width:min(384px,40vw);z-index:12;background:#182629;border:3px solid #eef0df;border-radius:5px;box-shadow:0 5px 20px #0005;color:#fff9df;font:16px sans-serif;pointer-events:none';
 const picture=document.createElement('canvas');picture.width=384;picture.height=216;picture.style.cssText='width:100%;display:block';const label=document.createElement('div');label.style.cssText='padding:5px 9px';view.append(picture,label);document.body.append(view);
 const context=picture.getContext('2d'),image=context.createImageData(width,height);let state=null,last=-Infinity,lastMap=null,pending=null,disposed=false;
 const update=s=>{
  state=s;const live=s?.status==='playing'&&s.stage==='class',info=s?.surveillance,ids=new Set(info?.devices?.map(m=>m.id)||[]);
  for(const record of records){record.device.visible=live&&ids.has(record.mount.id);record.panel.visible=live&&(s.role==='teacher'||ids.has(record.mount.id));if(s?.map!==lastMap){const y=floorHeight(record.mount.x,record.mount.z,s?.map);record.device.position.y=record.mount.y+y;record.panel.position.y=1.65+y;}}
  lastMap=s?.map;view.hidden=!(live&&!s.paused&&s.role==='teacher'&&info?.viewing&&ids.has(info.viewing));if(view.hidden)pending=null;
 };
 // Called before the main actor update, once per frame. Only the eight feed
 // frames each second extend the actor visibility set; no second pose update.
 function prepare(s,now){
  update(s);pending=null;if(disposed||view.hidden||now-last<125)return;
  const record=records.find(r=>r.mount.id===state.surveillance.viewing);if(!record)return;
  camera.position.copy(record.device.position);camera.lookAt(record.mount.target.x,record.mount.target.y+floorHeight(record.mount.target.x,record.mount.target.z,state.map),record.mount.target.z);camera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(projectionView.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));pending=record;
 }
 function render(now){
  if(disposed||view.hidden||now-last<125)return;if(!pending)prepare(state,now);const m=pending;if(!m)return;pending=null;last=now;
  const old=renderer.getRenderTarget(),face=renderer.getActiveCubeFace?.()||0,mip=renderer.getActiveMipmapLevel?.()||0,oldAuto=renderer.autoClear,oldXR=renderer.xr.enabled,was=m.device.visible;let cleanup;
  try{
   cleanup=beforeRender?.();m.device.visible=false;renderer.xr.enabled=false;renderer.autoClear=true;
   // setRenderTarget applies its own physical viewport and scissor. Calling
   // setViewport here would multiply 384×216 by the main renderer's DPR.
   monitorSmoke.update(state.smokes||[]);renderer.setRenderTarget(linear);monitorSmoke.render(scene,camera,'low');
   outputMaterial.uniforms.exposure.value=renderer.toneMappingExposure??1;renderer.setRenderTarget(target);renderer.render(outputScene,outputCamera);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
   for(let y=0;y<height;y++)image.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);
   context.putImageData(image,0,0);label.textContent=(m.mount.id==='front'?'监控 1':'监控 2')+'   Q 关闭';
  }finally{cleanup?.();m.device.visible=was;renderer.setRenderTarget(old,face,mip);renderer.autoClear=oldAuto;renderer.xr.enabled=oldXR;}
 }
 return{update,prepare,render,intersectsSphere:sphere=>Boolean(pending&&frustum.intersectsSphere(sphere)),targets:()=>records.filter(r=>r.panel.visible).map(r=>({object:r.panel,id:r.mount.id,installed:Boolean(state?.surveillance?.devices.some(m=>m.id===r.mount.id)),ready:Boolean(state?.surveillance?.available)})),dispose(){if(disposed)return;disposed=true;pending=null;view.remove();root.removeFromParent();monitorSmoke.dispose();linear.dispose();target.dispose();outputQuad.geometry.dispose();outputMaterial.dispose();owned.forEach(g=>g.dispose());[cases,trim,lens,led].forEach(m=>m.dispose());}};
}
