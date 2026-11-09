import * as T from './vendor/three.module.js';
export function createChalkPowder(scene){
 const root=new T.Group();root.name='chalk-impact-powder';scene.add(root);const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const c=canvas.getContext('2d'),g=c.createRadialGradient(48,48,2,48,48,47);g.addColorStop(0,'rgba(255,252,235,.88)');g.addColorStop(.3,'rgba(255,253,241,.65)');g.addColorStop(.7,'rgba(255,255,246,.16)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,96,96);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const chipGeometry=new T.IcosahedronGeometry(.009,0),chipMaterial=new T.MeshBasicMaterial({color:'#fffcee'}),bursts=[];let next=0;
 for(let i=0;i<6;i++){const group=new T.Group();group.visible=false;root.add(group);const powderMaterial=new T.SpriteMaterial({map:texture,transparent:true,opacity:0,depthWrite:false,toneMapped:false}),cloud=new T.Sprite(powderMaterial);group.add(cloud);const chips=Array.from({length:5},(_,j)=>{const chip=new T.Mesh(chipGeometry,chipMaterial);group.add(chip);return chip;});bursts.push({group,cloud,material:powderMaterial,chips,age:9});}
 return{
  emit(event){if(event?.type!=='chalk-hit'||![event.x,event.y,event.z].every(Number.isFinite))return;const b=bursts[next++%bursts.length];b.age=0;b.group.visible=true;b.group.position.set(event.x,event.y,event.z);b.cloud.position.set(0,.025,0);b.cloud.scale.setScalar(.055);b.material.opacity=.9;},
  update(dt){for(const b of bursts){if(!b.group.visible)continue;b.age+=Math.max(0,Math.min(.1,dt||0));const t=b.age;if(t>=.55){b.group.visible=false;continue;}b.cloud.scale.setScalar(.055+.38*(1-Math.exp(-t*7)));b.cloud.position.y=.025+t*.10;b.material.opacity=Math.max(0,1-t/.55)**1.7*.8;for(let j=0;j<b.chips.length;j++){const angle=j*2.39996,vel=.21+j*.035;b.chips[j].position.set(Math.cos(angle)*t*vel,.015+t*(.22+j*.025)-t*t*.8,Math.sin(angle)*t*vel);b.chips[j].rotation.set(t*3+j,t*5+j,0);b.chips[j].visible=t<.42;}}},
  clear(){for(const b of bursts)b.group.visible=false;},
  dispose(){root.removeFromParent();texture.dispose();chipGeometry.dispose();chipMaterial.dispose();for(const b of bursts)b.material.dispose();}
 };
}
