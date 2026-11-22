import * as T from './vendor/three.module.js';

// Post-mixer layer. Rotations are in character axes so the same gesture plays
// correctly on each of the imported student rigs and the separate teacher rig.
export function createSocialPose(actor){
 const saved=new Map(),axis=new T.Vector3(),body=new T.Quaternion(),parent=new T.Quaternion(),turn=new T.Quaternion();
 let blend=0,last=null;
 function restore(){for(const [b,q] of saved)b.quaternion.copy(q);saved.clear();}
 function rotate(name,x,y,z,angle){
  const b=actor.bones?.[name];if(!b||Math.abs(angle*blend)<.0001)return;
  if(!saved.has(b))saved.set(b,b.quaternion.clone());
  b.parent.getWorldQuaternion(parent);axis.set(x,y,z).applyQuaternion(body);
  turn.setFromAxisAngle(axis,angle*blend);b.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));
 }
 function pose(emote,clock,dt){
  if(!emote&&!last)return;
  if(emote){if(last?.start!==emote.start||last?.id!==emote.id)blend=0;last=emote;}
  blend=T.MathUtils.damp(blend,emote?1:0,16,Math.min(.1,dt));
  if(!emote&&blend<.015){last=null;blend=0;return;}
  actor.group.getWorldQuaternion(body);
  const age=Math.max(0,clock-last.start),p=age*Math.PI*2/(last.id==='step'?1.30:1.72);
  const beat=Math.sin(p),counter=Math.cos(p),half=Math.sin(p*2);
  rotate('Spine',0,0,1,beat*(last.id==='wave'?.045:.14));
  rotate('Head',0,1,0,Math.sin(p-.32)*.15);
  for(const [side,sign] of [['Left',1],['Right',-1]]){
   if(last.id==='wave'){
    if(side==='Right'){
     rotate(side+'Arm',0,0,1,sign*1.64);rotate(side+'ForeArm',0,0,1,sign*(1.20+.28*half));
     rotate(side+'Hand',1,0,0,.25*half);rotate(side+'Hand',0,1,0,.35*counter);
    }
   }else{
    const swing=last.id==='swing';
    rotate(side+'UpLeg',1,0,0,-(.09+.31*Math.max(0,sign*beat)));
    rotate(side+'Leg',1,0,0,.11+.42*Math.max(0,sign*beat));
    rotate(side+'Arm',0,0,1,sign*(swing?1.05+.57*sign*beat:.48+.16*counter));
    rotate(side+'Arm',1,0,0,swing?-.26:.52*sign*beat);
    rotate(side+'ForeArm',1,0,0,-.48-.24*sign*counter);
    rotate(side+'Hand',0,1,0,sign*.3*half);
   }
  }
  actor.group.updateWorldMatrix(false,true);
 }
 return{restore,pose};
}
