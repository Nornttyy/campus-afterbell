import * as T from './vendor/three.module.js';

// One receiver batch for the class. Derive contact from the posed fingers and
// elbow each frame so shadows follow the paper even on devices without shadow maps.
export function createDeskHandShadows(limit){
 const geometry=new T.PlaneGeometry(1.18,.80).rotateX(-Math.PI/2);
 const joints=['LeftHandMiddle2','LeftForeArm','RightHandMiddle2','RightForeArm'];
 const attributes=joints.map((_,i)=>{
  const attribute=new T.InstancedBufferAttribute(new Float32Array(limit*3),3);
  attribute.setUsage(T.DynamicDrawUsage);geometry.setAttribute('joint'+i,attribute);return attribute;
 });
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,
  vertexShader:`attribute vec3 joint0,joint1,joint2,joint3;
   varying vec3 a,b,c,d; varying vec2 desk;
   void main(){desk=position.xz;a=joint0;b=joint1;c=joint2;d=joint3;
    gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec3 a,b,c,d; varying vec2 desk;
   float shade(vec3 hand,vec3 elbow){
    vec3 wrist=mix(hand,elbow,.38);
    vec2 delta=wrist.xz-hand.xz;
    float s=clamp(dot(desk-hand.xz,delta)/max(.00001,dot(delta,delta)),0.,1.);
    vec3 p=mix(hand,wrist,s);float h=max(0.,p.y);
    vec2 v=desk-(p.xz+vec2(.22,.07)*h);
    float radius=.047+.16*h;
    return .43*exp(-dot(v,v)/(radius*radius))*(1.-smoothstep(.02,.36,h));
   }
   void main(){float coverage=max(shade(a,b),shade(c,d));
    gl_FragColor=vec4(.075,.060,.049,coverage);
    #include <colorspace_fragment>
   }`});
 const mesh=new T.InstancedMesh(geometry,material,limit),basis=new T.Object3D(),point=new T.Vector3();
 mesh.name='tabletop-hand-shadows';mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
 return {mesh,begin(){mesh.count=0;},add(actor,seat,top){
  if(!seat||!actor.bones?.LeftHandMiddle2||mesh.count>=limit)return;
  const i=mesh.count++,yaw=seat.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
  basis.position.set(seat.deskX,top+.0008,seat.deskZ);basis.rotation.y=yaw;basis.updateMatrix();mesh.setMatrixAt(i,basis.matrix);
  joints.forEach((joint,k)=>{
   actor.bones[joint].getWorldPosition(point);
   const x=point.x-seat.deskX,z=point.z-seat.deskZ;
   attributes[k].setXYZ(i,x*c-z*s,point.y-top,x*s+z*c);
  });
 },end(){mesh.visible=mesh.count>0;if(mesh.visible){mesh.instanceMatrix.needsUpdate=true;for(const a of attributes)a.needsUpdate=true;}}};
}
