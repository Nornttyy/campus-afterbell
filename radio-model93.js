import * as T from './vendor/three.module.js';
import {radioAnchor} from './campus-radio93.js?v=campus-96';

export function mountSchoolRadio(map,parent,{box,rounded,mat,texture,bakeStatic}){
 const anchor=radioAnchor(map),root=new T.Group();
 root.name='campus-radio-'+map;root.position.set(anchor.x,anchor.y,anchor.z);root.rotation.y=anchor.yaw;parent.add(root);
 const casing=mat('#44545a',{roughness:.59}),aluminium=mat('#bfc3b5',{roughness:.51,metalness:.18});
 const panel=texture(512,228,(c,w,h)=>{
  const base=c.createLinearGradient(0,0,0,h);base.addColorStop(0,'#546369');base.addColorStop(1,'#35454b');c.fillStyle=base;c.fillRect(0,0,w,h);
  for(const x of [74,w-74]){
   const g=c.createRadialGradient(x,119,8,x,119,66);g.addColorStop(0,'#39454a');g.addColorStop(.64,'#232d31');g.addColorStop(.86,'#465254');g.addColorStop(.98,'#1e292d');g.addColorStop(1,'#768183');c.fillStyle=g;c.beginPath();c.arc(x,119,64,0,2*Math.PI);c.fill();
   c.save();c.clip();c.fillStyle='#697476';for(let y=50;y<188;y+=6)for(let j=6;j<141;j+=6)c.fillRect(x-73+j+(y%12?3:0),y,2,2);c.restore();
  }
  c.fillStyle='#1e3031';c.fillRect(160,54,192,53);c.fillStyle='#a1b69a';c.fillRect(167,59,178,42);
  c.fillStyle='#304646';c.font='bold 24px sans-serif';c.textAlign='center';c.fillText('校园广播',256,89);
  for(let j=0;j<6;j++){c.fillStyle=j===5?'#c57952':'#b8c1b7';c.fillRect(161+j*33,137,25,12);}
  c.fillStyle='#ced4c0';c.font='12px sans-serif';c.fillText('FM   •   STEREO',256,178);
 });
 const face=mat('#fff',{map:panel,roughness:.78});rounded(casing,[0,0,0],[.70,.335,.18],.034,null,root);
 box(face,[0,0,.095],[.646,.279,.008],null,root);
 for(const x of [-.19,.19])box(aluminium,[x,.199,-.018],[.025,.079,.033],null,root);
 rounded(aluminium,[0,.237,-.018],[.403,.024,.034],.008,null,root);
 // Mount meets the actual wall, both inside the coach and beside the sports board.
 for(const x of [-.245,.245])box(casing,[x,-.159,-.066],[.032,.040,.19],null,root);
 bakeStatic(root);return root;
}
