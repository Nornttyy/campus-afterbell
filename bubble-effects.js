import * as T from './vendor/three.module.js';

// A transparent pink gum membrane. Inflation remains charge-dependent, while
// a bubble stuck to a head has one stable size independent of that charge.
export const ATTACHED_GUM_RADIUS=.28;
export function createBubbleEffects(scene,camera,{floorAt=()=>0}={}){
  const geometry=new T.SphereGeometry(1,36,24);
  const makeMaterial=()=>new T.ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:true,
    uniforms:{fade:{value:1},orange:{value:0}},
    vertexShader:`varying vec3 n; varying vec3 eye;
      void main(){vec4 mv=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal);eye=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float fade;uniform float orange;varying vec3 n;varying vec3 eye;
      void main(){vec3 normal=normalize(n),view=normalize(eye);
        float facing=clamp(dot(normal,view),0.0,1.0),rim=pow(1.0-facing,2.8);
        vec3 light=normalize(vec3(-.45,.65,1.0));
        float gloss=pow(max(0.0,dot(normal,light)),55.0);
        vec3 colour=mix(mix(vec3(1.0,.28,.58),vec3(1.0,.55,.12),orange),mix(vec3(1.0,.72,.86),vec3(1.0,.83,.40),orange),rim*.75);
        colour=mix(colour,vec3(1.0,.96,.99),gloss*.9);
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
      if(bubble?.progress>0){
        const r=Number.isFinite(bubble.radius)?bubble.radius:radius(bubble.progress);own.visible=r>0;own.scale.setScalar(r);own.position.set(0,-.13,-.28-r*1.08);own.material.uniforms.fade.value=1;own.material.uniforms.orange.value=bubble.kind==='orange'?1:0;
      }
      for(const student of state.students||[]){
        if(student.id===player?.id||student.visible===false||!(student.bubble?.progress>0))continue;
        const key='held-'+student.id,m=get(key),r=Number.isFinite(student.bubble.radius)?student.bubble.radius:radius(student.bubble.progress),yaw=student.yaw||0,forward=.28+r*1.08;
        m.position.set(student.x+Math.sin(yaw)*forward,(student.stunLeft>0?1.08:student.seated?1.42:1.65)+floorAt(student.x,student.z,state.map),student.z+Math.cos(yaw)*forward);
        m.scale.setScalar(r);m.material.uniforms.fade.value=1;m.material.uniforms.orange.value=student.bubble.kind==='orange'?1:0;used.add(key);
      }
      for(const bubble of state.bubbles||[]){
        const key='released-'+bubble.id,m=get(key);
        const attached=bubble.attachedId!==undefined&&bubble.attachedId!==null,actor=attached?(bubble.attachedId===-1?state.teacher:state.students?.find(s=>s.id===bubble.attachedId)):null,yaw=actor?.yaw||0;
        const r=attached?ATTACHED_GUM_RADIUS:Number.isFinite(bubble.radius)?bubble.radius:radius(bubble.charge);m.material.uniforms.orange.value=bubble.kind==='orange'?1:0;
        m.position.set(bubble.x+Math.sin(yaw)*(attached?.18:0),bubble.y,bubble.z+Math.cos(yaw)*(attached?.18:0));m.scale.set(r,attached?r*.88:r,attached?r*.72:r);if(attached&&bubble.attachedId===player?.id){m.visible=false;}else m.visible=true;m.material.uniforms.fade.value=1-T.MathUtils.smoothstep(bubble.age,Math.max(0,(bubble.lifetime||4)-.7),bubble.lifetime||4);used.add(key);
      }
    }
    for(const [key,m]of pooled){if(!used.has(key)){m.removeFromParent();m.material.dispose();pooled.delete(key);}}
  }
  return{update,dispose(){update(null);root.removeFromParent();view.removeFromParent();own.material.dispose();geometry.dispose();}};
}
