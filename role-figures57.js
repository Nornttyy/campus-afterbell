import * as T from './vendor/three.module.js';
import {cloneCharacter as cloneSkin} from './clone-character57.js?v=campus-75';

// Reuse the authored rigs at their authored metric heights. No new skin,
// stretched model or synthetic portrait is introduced by the changing station.
export function createRolePortraits({student,teacher}){
 // Portrait rigs are intentionally unattached to the campus scene. The world
 // interaction remains the original metal changing cabinet.
 const actors={student,teacher};let portraits=null;
 return{
  previews(renderer){
   if(portraits)return portraits;portraits={};
   const previous=renderer.getRenderTarget(),target=new T.WebGLRenderTarget(256,320),pixels=new Uint8Array(256*320*4);target.texture.colorSpace=T.SRGBColorSpace;
   try{for(const [role,actor]of Object.entries(actors)){
    const scene=new T.Scene();scene.background=new T.Color('#fff9e9');
    const figure=cloneSkin(actor.group);figure.position.set(0,0,0);figure.rotation.set(0,0,0);figure.visible=true;scene.add(figure);
    scene.add(new T.HemisphereLight('#fff6e6','#687a86',2.2));const light=new T.DirectionalLight('#ffffff',2);light.position.set(-2,4,3);scene.add(light);
    const camera=new T.OrthographicCamera(-1,1,1.3,-1.2,.01,12);camera.position.set(0,1.15,5);camera.lookAt(0,1.15,0);
    renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,256,320,pixels);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=320;const ctx=canvas.getContext('2d'),image=ctx.createImageData(256,320);
    for(let y=0;y<320;y++)image.data.set(pixels.subarray((319-y)*1024,(320-y)*1024),y*1024);
    ctx.putImageData(image,0,0);portraits[role]=canvas.toDataURL('image/png');
   }}finally{renderer.setRenderTarget(previous);target.dispose();}
   return portraits;
  },dispose(){student.dispose?.();teacher.dispose?.();}
 };
}
export function teacherLobbyActor(actor){
 let motion={speed:0};return{...actor,setMood(){},setMotion(value){motion=value;},update(time){actor.update(time,{phase:'watching',speed:motion.speed||0,seated:false,crawling:motion.crawling,lookYaw:motion.lookYaw,lookPitch:motion.lookPitch});}};
}
