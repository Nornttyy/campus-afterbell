import {teacherViewHeight,STUDENT_VIEW_HEIGHT} from './camera-height58.js?v=campus-81';
import {CRAWL_TUNING} from './crawl-profile.js?v=campus-81';
import * as T from './vendor/three.module.js';
import {setCharacterNight} from './character-materials.js?v=campus-81';
// Hands follow horizontal body turns, never camera pitch. Seated/restrained
// hands keep their body heading while the player looks around.
export function sampleFirstPersonMotion(previous,player,time){
 const seated=player?.seated!==false,restricted=Boolean(player?.caught||['carried','bound','stunned'].includes(player?.captivity));
 const locked=seated||restricted,yaw=Number.isFinite(player?.yaw)?player.yaw:0;
 const reset=!previous||!Number.isFinite(time)||time<previous.time;
 const dt=reset?0:Math.max(0,Math.min(.25,time-previous.time));
 const distance=reset?0:Math.hypot((player.x||0)-previous.x,(player.z||0)-previous.z);
 const travelled=!locked&&dt>0&&distance<.5?distance:0;
 // Physics snapshots arrive at a fixed rate. Smooth measured speed so the
 // intervening render frames do not falsely alternate walking and stopping.
 const rawSpeed=dt>0?Math.min(6,travelled/dt):0;
 const speed=reset||locked?0:dt>0?T.MathUtils.damp(previous.speed||0,rawSpeed,12,dt):previous.speed||0;
 const crawl=Boolean(!seated&&player.crouched),amount=reset?0:T.MathUtils.damp(previous.amount,speed>.015?Math.min(1,speed/1.4):0,10,dt);
 const crawlBlend=reset?(crawl?1:0):T.MathUtils.damp(previous.crawlBlend,crawl?1:0,12,dt);
 const bodyYaw=locked?(seated?(player.seatYaw||0):previous?.locked?previous.bodyYaw:previous?.yaw??yaw):yaw;
 return{x:player?.x||0,z:player?.z||0,time,yaw,locked,bodyYaw,speed,amount,crawlBlend,phase:(previous?.phase||0)+(travelled*(crawl?11:4.1))};
}
export function firstPersonEyeHeight(player,role='student'){
 if(player?.onBed)return Number.isFinite(player.eyeHeight)?player.eyeHeight:.23;
 if(player?.stunLeft>0||player?.captivity==='stunned')return role==='teacher'?1.12:1.05;
 const height=role==='teacher'?teacherViewHeight(player):player?.seated!==false?1.43:player.crouched?CRAWL_TUNING.eyeHeight:STUDENT_VIEW_HEIGHT;
 return height+(['carried','bound'].includes(player?.captivity)?.20:0);
}
export function createFirstPersonView(renderer,camera,groups){
 const scene=new T.Scene(),anchor=new T.Group();scene.add(anchor);for(const group of groups){anchor.add(group);group.userData.viewCamera=camera;}
 const ambient=new T.HemisphereLight('#edf5ff','#dce3e3',2.5);scene.add(ambient);
 const light=new T.DirectionalLight('#fff8ed',4);light.position.set(-10,6,6);scene.add(light);
 const fill=new T.DirectionalLight('#e5eef4',.85);fill.position.set(5,4,6);scene.add(fill);
 return{scene,anchor,
  setNight(night){
   ambient.intensity=night?.30:2.5;ambient.color.set(night?'#7890c5':'#edf5ff');ambient.groundColor.set(night?'#9ca5b5':'#dce3e3');
   light.intensity=night?.035:4;light.color.set(night?'#7084ac':'#fff8ed');fill.intensity=night?.055:.85;
   for(const group of groups)setCharacterNight(group,night);
  },
  align(player,motion,position){
   anchor.position.copy(position);
   // Head pitch changes how the hands are seen, not where the arms point.
   // Looking up can therefore take the low hands naturally out of view.
   anchor.quaternion.setFromAxisAngle(new T.Vector3(0,1,0),motion.bodyYaw+Math.PI);
   anchor.updateMatrixWorld(true);
  },
  render(){
   if(!groups.some(group=>group.visible))return;
   // Own depth buffer: walls/desks cannot hide the viewmodel; fingers and
   // held objects still occlude one another correctly within this last pass.
   const clear=renderer.autoClear,shadows=renderer.shadowMap.enabled;
   renderer.autoClear=false;renderer.shadowMap.enabled=false;renderer.clearDepth();
   try{renderer.render(scene,camera);}finally{renderer.autoClear=clear;renderer.shadowMap.enabled=shadows;}
  }
 };
}
