import * as T from './vendor/three.module.js';
import {COOLER,coolerPoint} from './field-items116.js?v=campus-116';
import {createDeskItem} from './game-actors.js?v=campus-116';
import {restDeskItem} from './prop-assets.js?v=campus-83';
import {setDish} from './hotpot-food94.js?v=campus-94';

function stockModel(kind,dish){
 const mesh=createDeskItem(kind);
 if(mesh.userData.foodStyle&&dish)setDish(mesh,dish);
 if(['gum','chips','noodles'].includes(kind))mesh.rotation.x=Math.PI/2;
 else if(!['burger','lunch','hotpotPlate','hotpotBite'].includes(kind))mesh.rotation.x=-Math.PI/2;
 restDeskItem(mesh,-.075);
 mesh.updateMatrixWorld(true);
 return mesh;
}

export function looseItemView(scene){
 const roots=new Map(),templates=new Map(),group=new T.Group();scene.add(group);
 return {
  get:id=>roots.get(id)?.root,
  update(items=[]){
   const present=new Set();
   for(const item of items){
    present.add(item.id);
    const key=item.action+':'+(item.dish||'');let record=roots.get(item.id);
    if(record?.key!==key){
     record?.root.removeFromParent();
     if(!templates.has(key))templates.set(key,stockModel(item.action,item.dish));
     const root=new T.Group();root.name='loose-'+item.action;root.add(templates.get(key).clone(true));group.add(root);
     record={root,key};roots.set(item.id,record);
    }
    record.root.position.set(item.x,item.y,item.z);record.root.rotation.set(item.settled?0:item.spinX||0,item.yaw||0,item.settled?0:item.spinZ||0,'YXZ');
   }
   for(const [id,record] of roots)if(!present.has(id)){record.root.removeFromParent();roots.delete(id);}
  }
 };
}

export function mountCooler(parent,{box,rounded,mat,texture,bakeStatic}){
 const root=new T.Group();root.name='ice-cream-pushcart';root.position.set(COOLER.x,0,COOLER.z);root.rotation.y=COOLER.yaw;parent.add(root);
 const enamel=mat('#fffaf1'),rim=mat('#a8c7c6'),liner=mat('#c2dddc'),tire=mat('#383d41'),steel=mat('#809095');
 rounded(enamel,[0,.53,0],[1.50,.65,.73],.05,null,root);
 for(const x of [-.59,.59])for(const z of [-.24,.24]){
  box(steel,[x,.195,z],[.046,.15,.05],null,root);
  const wheel=new T.Mesh(new T.CylinderGeometry(.108,.108,.055,14),tire);wheel.rotation.x=Math.PI/2;wheel.position.set(x,.11,z);root.add(wheel);
 }
 for(const z of [-.22,.22])box(steel,[.84,.68,z],[.23,.034,.034],null,root);
 box(steel,[.95,.68,0],[.035,.035,.47],null,root);
 box(liner,[0,.853,0],[1.43,.025,.65],null,root);
 for(const x of [-.73,-.22,.22,.73])box(rim,[x,.908,0],[.035,.11,.73],null,root);
 for(const z of [-.35,.35])box(rim,[0,.91,z],[1.49,.11,.035],null,root);
 const sign=texture(768,230,(c,w,h)=>{
  c.fillStyle='#c72133';c.fillRect(0,0,w,h);c.fillStyle='#fff8ed';c.textAlign='center';c.font='bold 94px sans-serif';c.fillText('蜜雪冰城',w/2,h*.56);
  c.font='35px sans-serif';c.fillText('冰 淇 淋   ·   茶 饮',w/2,h*.82);
 });
 box(mat('#fff',{map:sign}),[0,.55,.369],[1.25,.38,.008],null,root);
 bakeStatic(root);
 const slots=Array.from({length:3},(_,i)=>{const r=new T.Group(),p=coolerPoint(i);r.position.set(p.x,p.y,p.z);parent.add(r);return r;});
 const templates=new Map();
 return {slots,update(kinds=[]){
  slots.forEach((r,i)=>{const k=kinds[i]||null;if(r.userData.kind===k)return;r.userData.kind=k;r.clear();r.visible=!!k;if(!k)return;
   if(!templates.has(k))templates.set(k,stockModel(k,null));r.add(templates.get(k).clone(true));});
 }};
}
