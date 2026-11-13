import * as T from './vendor/three.module.js';
import {PLAYGROUND_LAYOUT} from './playground-layout70.js?v=campus-78';
import {TOILET_STALLS} from './toilet-layout70.js?v=campus-78';
import {toiletBowl} from './map-activities77.js?v=campus-78';
import {activityHandTargets} from './map-activity-pose77.js?v=campus-78';
import {handFrame} from './hand-motion.js?v=campus-78';
const handRigs=new WeakMap();
function frameQuaternion(along,dorsal){const y=along.clone().normalize(),z=dorsal.clone().addScaledVector(y,-dorsal.dot(y)).normalize(),x=new T.Vector3().crossVectors(y,z);return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
export function createMapActivityView(scene){
 const root=new T.Group();root.name='map-activities77';scene.add(root);const geometries=new Set(),materials=new Set(),plungers=new Map(),bars=new Map(),wrappers=new Map();
 const geo=g=>(geometries.add(g),g),mat=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,...extra});materials.add(m);return m;};
 const wood=mat('#b37a3b',{roughness:.54}),rubber=mat('#b13227',{roughness:.78}),paper=mat('#efd648',{roughness:.85}),red=mat('#cc4539',{roughness:.85});
 const pickMaterial=new T.MeshBasicMaterial({visible:false});materials.add(pickMaterial);
 const pickHandle=geo(new T.BoxGeometry(.18,.78,.18));
 const handle=geo(new T.CylinderGeometry(.018,.022,.70,12)),cup=geo(new T.LatheGeometry([[.02,.15],[.045,.11],[.07,.085],[.11,.05],[.14,.018],[.145,0],[.126,0],[.10,.036],[.055,.065],[.018,.10]].map(p=>new T.Vector2(...p)),20));
 const label=geo(new T.BoxGeometry(.125,.003,.055)),wrapperGeo=geo(new T.PlaneGeometry(.14,.18,5,6));const p=wrapperGeo.attributes.position;
 for(let i=0;i<p.count;i++)p.setZ(i,.012*Math.sin(p.getX(i)*83)+.007*Math.cos(p.getY(i)*105));wrapperGeo.computeVertexNormals();paper.side=T.DoubleSide;
 const mesh=(g,m,parent,x=0,y=0,z=0)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 for(const s of TOILET_STALLS){const b=toiletBowl(s.id),g=new T.Group();g.name='toilet-plunger-'+s.id;root.add(g);mesh(cup,rubber,g);mesh(handle,wood,g,0,.49,0);mesh(pickHandle,pickMaterial,g,0,.49,0);const wrapper=new T.Group();wrapper.position.set(b.x,.31,b.z);wrapper.rotation.y=s.id*.9;root.add(wrapper);const sheet=mesh(wrapperGeo,paper,wrapper);sheet.rotation.x=-Math.PI/2;mesh(label,red,wrapper,0,.012,0);wrapper.visible=false;wrappers.set(s.id,wrapper);plungers.set(s.id,g);}
 for(const b of PLAYGROUND_LAYOUT.bars){const object=mesh(geo(new T.BoxGeometry(.13,.13,b.width-.16)),pickMaterial,root,b.x,b.height,b.z);object.name=b.id+'-grip-target';bars.set(b.id,object);}
 let state=null;
 return{
  targets(s){if(s.map==='playground')return[...bars].map(([id,object])=>({id,object,kind:'sports-bar'}));if(s.map==='toilet')return[...plungers].filter(([id])=>s.toiletClogs?.[id]).map(([id,object])=>({id,object,kind:'plunger'}));return[];},
  target(kind,id){return(kind==='sports-bar'?bars:plungers).get(id);},
  update(s){state=s;const people=[...(s?.students||[]),...(s?.player?[s.player]:[])];
   for(const[id,g]of plungers){g.visible=s?.map==='toilet';const b=toiletBowl(id),actor=people.find(a=>a.mapActivity?.kind==='plunge'&&a.mapActivity.id===id);g.position.set(b.x+.40,0,b.z+.05);g.rotation.set(0,0,-.12);
    if(actor){g.position.set(b.x,.22+.065*Math.sin(actor.mapActivity.age*Math.PI*4),b.z+.05);g.rotation.z=0;}
    const wrapper=wrappers.get(id);wrapper.visible=g.visible&&Boolean(s.toiletClogs?.[id]);wrapper.position.y=.31+(actor?.mapActivity?.progress||0)*-.035;
   }
   for(const o of bars.values())o.visible=s?.map==='playground';
  },
  updateFirstPerson(s,hands){const a=s?.player?.mapActivity,targets=activityHandTargets(a);if(!targets||s.role==='teacher')return;hands.group.updateWorldMatrix(true,true);
   for(const[side,target]of Object.entries(targets)){const hand=hands.getHand(side.toLowerCase());if(!hand)continue;
    let bones=handRigs.get(hand);if(!bones){bones={};hand.group.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});handRigs.set(hand,bones);}
    hand.setCurl(.95);hand.group.updateWorldMatrix(true,true);const frame=handFrame(bones,side),wrist=bones[side+'Hand'];if(!frame||!wrist)continue;
    const along=a.kind==='hang'?new T.Vector3(0,1,0):new T.Vector3(side==='Left'?1:-1,0,0),dorsal=a.kind==='hang'?new T.Vector3(-1,0,0):new T.Vector3(0,0,1);
    const delta=frameQuaternion(along,dorsal).multiply(frameQuaternion(frame.along,frame.normal).invert()),parent=hand.group.parent.getWorldQuaternion(new T.Quaternion());
    hand.group.quaternion.copy(parent.clone().invert().multiply(delta).multiply(hand.group.getWorldQuaternion(new T.Quaternion())));hand.group.updateWorldMatrix(true,true);
    const destination=target.clone();if(a.kind==='hang')destination.add(new T.Vector3(-.05,-.01,0));
    const offset=destination.sub(wrist.getWorldPosition(new T.Vector3())),position=hand.group.getWorldPosition(new T.Vector3()).add(offset);hand.group.position.copy(hand.group.parent.worldToLocal(position));hand.opposeThumb?.(.75);
   }
   hands.group.updateMatrixWorld(true);
  },
  dispose(){root.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
 };
}
