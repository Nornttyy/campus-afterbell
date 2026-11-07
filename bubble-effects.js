import * as T from './vendor/three.module.js';

// A transparent gum membrane in world space. The reference shows warm orange
// bubbles, rather than smoke sprites or a full-screen coloured overlay.
export function createBubbleEffects(scene,camera,{floorAt=()=>0}={}){
  const geometry=new T.SphereGeometry(1,36,24);
  const makeMaterial=()=>new T.ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:true,
    uniforms:{fade:{value:1}},
    vertexShader:`varying vec3 n; varying vec3 eye;
      void main(){vec4 mv=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal);eye=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float fade;varying vec3 n;varying vec3 eye;
      void main(){vec3 normal=normalize(n),view=normalize(eye);
        float facing=clamp(dot(normal,view),0.0,1.0),rim=pow(1.0-facing,2.8);
        vec3 light=normalize(vec3(-.45,.65,1.0));
        float gloss=pow(max(0.0,dot(normal,light)),55.0);
        vec3 colour=mix(vec3(1.0,.56,.15),vec3(1.0,.85,.56),rim*.75);
        colour=mix(colour,vec3(1.0,.99,.95),gloss*.9);
        gl_FragColor=vec4(colour,(.13+rim*.50+gloss*.23)*fade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const pooled=new Map(),root=new T.Group(),view=new T.Group();root.name='released-gum-bubbles';view.name='first-person-gum-bubble';scene.add(root);camera.add(view);
  const own=new T.Mesh(geometry,makeMaterial());own.visible=false;own.frustumCulled=false;view.add(own);
  const radius=charge=>.035+.88*T.MathUtils.smoothstep(T.MathUtils.clamp(charge,0,1),0,1);
  function get(key){if(!pooled.has(key)){const m=new T.Mesh(geometry,makeMaterial());m.renderOrder=3;root.add(m);pooled.set(key,m);}return pooled.get(key);}
  function update(state){
    own.visible=false;const used=new Set();
    if(state){
      const player=state.player,bubble=player?.bubble;
      if(bubble?.progress>0&&player.captivity==='bound'){
        const r=radius(bubble.progress);own.visible=true;own.scale.setScalar(r);own.position.set(0,-.13,-.28-r*1.08);own.material.uniforms.fade.value=1;
      }
      for(const student of state.students||[]){
        if(student.id===player?.id||student.captivity!=='bound'||!(student.bubble?.progress>0))continue;
        const key='held-'+student.id,m=get(key),r=radius(student.bubble.progress),yaw=student.yaw||0;
        m.position.set(student.x+Math.sin(yaw)*(r+.22),1.71+floorAt(student.x,student.z,state.map),student.z+Math.cos(yaw)*(r+.22));
        m.scale.setScalar(r);m.material.uniforms.fade.value=1;used.add(key);
      }
      for(const bubble of state.bubbles||[]){
        const key='released-'+bubble.id,m=get(key),r=radius(bubble.charge);
        m.position.set(bubble.x,bubble.y,bubble.z);m.scale.setScalar(r);m.material.uniforms.fade.value=1-T.MathUtils.smoothstep(bubble.age,Math.max(0,(bubble.lifetime||4)-.7),bubble.lifetime||4);used.add(key);
      }
    }
    for(const [key,m]of pooled){if(!used.has(key)){m.removeFromParent();m.material.dispose();pooled.delete(key);}}
  }
  return{update,dispose(){update(null);root.removeFromParent();view.removeFromParent();own.material.dispose();geometry.dispose();}};
}
