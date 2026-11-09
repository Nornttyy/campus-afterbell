import * as T from './vendor/three.module.js';

// Half-resolution volume integration, clipped by the real classroom depth.
// Each cloud is a 3D density field: no billboard circles or screen-wide fog wash.
export function createSmokeEffects(renderer,{width=0,height=0,samples=4}={}){
  const size=new T.Vector2(),volumeScene=new T.Scene(),screenScene=new T.Scene();
  const screenCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  const opaque=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true});
  opaque.samples=samples;
  opaque.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
  const mist=new T.WebGLRenderTarget(1,1,{depthBuffer:false,minFilter:T.LinearFilter,magFilter:T.LinearFilter});
  const data=new Uint8Array(32**3);let seed=17831;
  for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed>>>24;}
  const noise=new T.Data3DTexture(data,32,32,32);noise.format=T.RedFormat;noise.type=T.UnsignedByteType;
  noise.minFilter=noise.magFilter=T.LinearFilter;noise.wrapS=noise.wrapT=noise.wrapR=T.RepeatWrapping;noise.unpackAlignment=1;noise.needsUpdate=true;
  const bounds=new T.BoxGeometry(2,2,2),pool=[],inverse=new T.Matrix4(),clearColor=new T.Color();
  const vertex=`out vec3 world;
    void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`;
  const fragment=`precision highp sampler3D;
    uniform sampler3D noiseField;uniform sampler2D sceneDepth;
    uniform mat4 inverseVP;uniform vec2 resolution;
    uniform vec3 center,extent;uniform float clock,life,density,baseY,seedOffset;
    in vec3 world;out vec4 fragColor;
    float field(vec3 w){
      vec3 p=(w-center)/extent*1.22;
      vec3 advect=w+vec3(sin(clock*.6+w.y)*.13,-clock*.22,cos(clock*.45+w.x)*.12)+seedOffset;
      float broad=texture(noiseField,advect*.045).r;
      float curls=texture(noiseField,(advect+vec3(broad,-broad,broad))*.15).r;
      float fine=texture(noiseField,advect*.32).r;
      float n=broad*.58+curls*.30+fine*.12;
      float lobes=min(length(p-vec3(-.21,-.14,.1)),min(length((p-vec3(.24,-.12,-.15))*vec3(1.,1.1,1.)),length((p-vec3(-.05,.22,-.1))*vec3(1.16,1.,1.12))));
      // Connect the expanding cloud to the landed canister, not a floating ball.
      lobes=min(lobes,length(vec3(p.x*2.2,(p.y+.65)*.72,p.z*2.2)));
      float edge=1.-smoothstep(.38,.85,lobes+(n-.5)*.95);
      float floorFade=smoothstep(baseY-.06,baseY+.14,w.y);
      return edge*floorFade*(.08+smoothstep(.22,.76,n)*1.35)*density;
    }
    void main(){
      vec2 uv=gl_FragCoord.xy/resolution;
      vec3 ray=normalize(world-cameraPosition),safeRay=ray+vec3(1e-7);
      vec3 t0=(center-extent-cameraPosition)/safeRay,t1=(center+extent-cameraPosition)/safeRay;
      vec3 mn=min(t0,t1),mx=max(t0,t1);
      float begin=max(0.,max(mn.x,max(mn.y,mn.z))),end=min(mx.x,min(mx.y,mx.z));
      float depth=texture(sceneDepth,uv).r;
      vec4 surface=inverseVP*vec4(uv*2.-1.,depth*2.-1.,1.);surface/=surface.w;
      end=min(end,dot(surface.xyz-cameraPosition,ray));
      if(end<=begin)discard;
      float stride=(end-begin)/40.;
      // Stable spatial jitter avoids ray bands without temporal sparkling.
      float jitter=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);
      vec4 sum=vec4(0.);vec3 lightDir=normalize(vec3(-.8,.72,-.22));
      for(int i=0;i<40;i++){
        vec3 w=cameraPosition+ray*(begin+(float(i)+jitter)*stride);
        float d=field(w);
        if(d>.012){
          float shade=exp(-field(w+lightDir*.38)*2.6-field(w+lightDir*.85)*1.4);
          float height=clamp((w.y-baseY)/2.7,0.,1.);
          vec3 color=mix(vec3(.25,.28,.32),vec3(.95,.95,.93),.18+shade*.62+height*.18);
          float alpha=1.-exp(-d*stride*9.0);
          sum.rgb+=(1.-sum.a)*color*alpha;sum.a+=(1.-sum.a)*alpha;
          if(sum.a>.998)break;
        }
      }
      if(sum.a<.002)discard;fragColor=vec4(sum.rgb/sum.a,sum.a);
    }`;
  function makeCloud(){
    const material=new T.ShaderMaterial({glslVersion:T.GLSL3,transparent:true,depthTest:false,depthWrite:false,side:T.BackSide,toneMapped:false,
      uniforms:{noiseField:{value:noise},sceneDepth:{value:opaque.depthTexture},inverseVP:{value:inverse},resolution:{value:new T.Vector2()},center:{value:new T.Vector3()},extent:{value:new T.Vector3()},clock:{value:0},life:{value:0},density:{value:0},baseY:{value:0},seedOffset:{value:0}},vertexShader:vertex,fragmentShader:fragment});
    const mesh=new T.Mesh(bounds,material);mesh.frustumCulled=false;volumeScene.add(mesh);pool.push(mesh);return mesh;
  }
  const composite=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:true,
    uniforms:{colorMap:{value:opaque.texture},smokeMap:{value:mist.texture},depthMap:{value:opaque.depthTexture},projectionInverse:{value:new T.Matrix4()},projection:{value:new T.Matrix4()},screenSize:{value:new T.Vector2()},smokeActive:{value:0},contactStrength:{value:.52}},
    vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D colorMap,smokeMap,depthMap;uniform mat4 projectionInverse,projection;uniform vec2 screenSize;uniform float smokeActive,contactStrength;varying vec2 v;
      vec3 surface(vec2 uv){float d=texture2D(depthMap,clamp(uv,vec2(.001),vec2(.999))).r;vec4 p=projectionInverse*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
      float contactShade(){
        if(contactStrength<.001||texture2D(depthMap,v).r>.9999)return 1.;
        vec2 pixel=1./screenSize;vec3 p=surface(v);
        vec3 l=surface(v-vec2(pixel.x,0.)),r=surface(v+vec2(pixel.x,0.));
        vec3 d=surface(v-vec2(0.,pixel.y)),u=surface(v+vec2(0.,pixel.y));
        vec3 dx=abs(l.z-p.z)<abs(r.z-p.z)?p-l:r-p,dy=abs(d.z-p.z)<abs(u.z-p.z)?p-d:u-p;
        vec3 n=normalize(cross(dx,dy));if(dot(n,-p)<0.)n=-n;
        float radius=.32,occlusion=0.;vec2 footprint=vec2(projection[0][0],projection[1][1])*radius/max(-p.z,.1)*.5;
        for(int i=0;i<16;i++){
          float a=float(i)*2.39996323;float ring=sqrt((float(i)+.5)/16.);
          vec3 delta=surface(v+vec2(cos(a),sin(a))*footprint*ring)-p;float dist=length(delta);
          float horizon=max(dot(n,delta)/max(dist,.001)-.075,0.);
          occlusion+=horizon*(1.-smoothstep(radius*.15,radius,dist))*smoothstep(.003,.018,dist);
        }
        return 1.-clamp(occlusion*(3.0/16.)*contactStrength,0.,.42);
      }
      void main(){vec3 scene=texture2D(colorMap,v).rgb*contactShade();vec4 smoke=smokeActive>.5?texture2D(smokeMap,v):vec4(0.);gl_FragColor=vec4(scene*(1.-smoke.a)+smoke.rgb,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  const quad=new T.Mesh(new T.PlaneGeometry(2,2),composite);screenScene.add(quad);
  let active=0;
  function update(smokes=[]){
    active=smokes.length;while(pool.length<active)makeCloud();
    for(let i=0;i<pool.length;i++){
      const mesh=pool[i],s=smokes[i];mesh.visible=Boolean(s);if(!s)continue;
      const radius=s.radius||.22,h=radius*.83+.15,u=mesh.material.uniforms;
      mesh.position.set(s.x,s.y+h*.86,s.z);mesh.scale.set(radius*1.28,h,radius*1.28);
      u.center.value.copy(mesh.position);u.extent.value.copy(mesh.scale);u.baseY.value=s.y;
      u.clock.value=s.age;u.life.value=s.remaining;u.density.value=s.density??1;u.seedOffset.value=s.id*3.137;
    }
  }
  function render(scene,camera,quality='high'){
    if(!active&&quality==='low'){renderer.render(scene,camera);return;}
    // Monitor feeds have physical render-target dimensions, independent of
    // the main canvas pixel ratio. Keep their buffers small and persistent.
    if(width>0&&height>0)size.set(width,height);else renderer.getDrawingBufferSize(size);
    if(opaque.width!==size.x||opaque.height!==size.y)opaque.setSize(size.x,size.y);
    const ratio=quality==='low'?.35:.5,w=Math.max(1,Math.floor(size.x*ratio)),h=Math.max(1,Math.floor(size.y*ratio));
    if(mist.width!==w||mist.height!==h)mist.setSize(w,h);
    camera.updateMatrixWorld();
    inverse.multiplyMatrices(camera.matrixWorld,camera.projectionMatrixInverse);
    composite.uniforms.projectionInverse.value.copy(camera.projectionMatrixInverse);composite.uniforms.projection.value.copy(camera.projectionMatrix);composite.uniforms.screenSize.value.copy(size);composite.uniforms.smokeActive.value=active?1:0;composite.uniforms.contactStrength.value=quality==='low'?0:.52;
    for(const mesh of pool)if(mesh.visible)mesh.material.uniforms.resolution.value.set(w,h);
    const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace?.()||0,mip=renderer.getActiveMipmapLevel?.()||0,auto=renderer.autoClear,alpha=renderer.getClearAlpha();renderer.getClearColor(clearColor);
    try{
      renderer.autoClear=true;renderer.setRenderTarget(opaque);renderer.render(scene,camera);
      if(active){renderer.setRenderTarget(mist);renderer.setClearColor(0x000000,0);renderer.clear();renderer.render(volumeScene,camera);}
      renderer.setClearColor(clearColor,alpha);renderer.setRenderTarget(target,face,mip);renderer.render(screenScene,screenCamera);
    }finally{renderer.setClearColor(clearColor,alpha);renderer.setRenderTarget(target,face,mip);renderer.autoClear=auto;}
  }
  return{update,render,dispose(){opaque.dispose();opaque.depthTexture.dispose();mist.dispose();noise.dispose();bounds.dispose();for(const m of pool)m.material.dispose();quad.geometry.dispose();composite.dispose();}};
}
