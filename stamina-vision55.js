import * as T from './vendor/three.module.js';
import {smoothFatigue} from './view-tuning55.js?v=campus-79';

// Copy the completed world frame, including hands, on the GPU. DOM HUD/text
// remain sharp. No second world render, screen capture or per-frame image read.
export function createStaminaVision(renderer){
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1),size=new T.Vector2();
 const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{image:{value:null},amount:{value:0},aspect:{value:1}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform sampler2D image;uniform float amount,aspect;varying vec2 v;
 void main(){
  vec2 offset=v-vec2(.5);float radius=length(offset*vec2(aspect,1.));
  float edge=smoothstep(.10,.68,radius);float spread=amount*edge*.17;
  vec3 color=texture2D(image,v).rgb*.22;float weight=.22;
  for(int i=1;i<=12;i++){float t=float(i)/12.;float w=(1.-t*.65)*.11;vec2 p=clamp(v-offset*spread*t,vec2(.001),vec2(.999));color+=texture2D(image,p).rgb*w;weight+=w;}
  gl_FragColor=vec4(color/weight,1.);
 }`});
 const quad=new T.Mesh(new T.PlaneGeometry(2,2),material);scene.add(quad);let image=null,intensity=0;
 return{
  render(snapshot,dt){
   const active=snapshot?.role==='teacher'&&snapshot.status==='playing';
   const stamina=active?(snapshot.teacher?.stamina??snapshot.player?.stamina??100):100;
   intensity=active?smoothFatigue(intensity,stamina,snapshot.paused?0:dt):0;
   if(intensity<.001){if(stamina>=15)intensity=0;return;}
   renderer.getDrawingBufferSize(size);
   // The default framebuffer already contains display-encoded RGBA pixels.
   // Keep the copy RGBA8 and output it unchanged; SRGB8 copies from the default
   // buffer are not portable across WebGL drivers and can yield a black image.
   if(!image||image.image.width!==size.x||image.image.height!==size.y){image?.dispose();image=new T.FramebufferTexture(size.x,size.y);image.colorSpace=T.NoColorSpace;image.minFilter=image.magFilter=T.LinearFilter;material.uniforms.image.value=image;}
   material.uniforms.amount.value=intensity;material.uniforms.aspect.value=size.x/size.y;
   renderer.copyFramebufferToTexture(image);const auto=renderer.autoClear;renderer.autoClear=false;
   try{renderer.render(scene,camera);}finally{renderer.autoClear=auto;}
  },
  reset(){intensity=0;},diagnostics:()=>({intensity}),
  dispose(){image?.dispose();material.dispose();quad.geometry.dispose();}
 };
}
