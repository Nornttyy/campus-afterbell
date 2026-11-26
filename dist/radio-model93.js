import * as T from './vendor/three.module.js';
import {radioAnchor} from './campus-radio93.js?v=campus-116';
export function mountSchoolRadio(map,parent,{box,rounded,mat,texture,bakeStatic}){
 const a=radioAnchor(map),root=new T.Group();root.name='pa-'+map;root.position.set(a.x,a.y,a.z);root.rotation.y=a.yaw;parent.add(root);
 const enamel=mat('#bfc9bd'),metal=mat('#72847e',{metalness:.28,roughness:.64}),grille=mat('#354342');
 if(map==='playground'){
  const pole=new T.Mesh(new T.CylinderGeometry(.054,.079,3.56,12),metal);pole.position.set(0,1.78-a.y,-.105);root.add(pole);
  box(metal,[0,.15-a.y,-.105],[.28,.29,.29],null,root);
  const horn=new T.Group();horn.position.set(0,3.32-a.y,-.11);horn.rotation.x=Math.PI*.55;root.add(horn);
  const profile=[[.049,0],[.07,.12],[.11,.24],[.19,.36],[.29,.45],[.30,.48],[.284,.48],[.174,.36],[.096,.24],[.058,.12],[.04,.07]].map(([r,y])=>new T.Vector2(r,y));
  horn.add(new T.Mesh(new T.LatheGeometry(profile,24),enamel));
  const driver=new T.Mesh(new T.CylinderGeometry(.058,.046,.07,12),grille);driver.position.y=.13;horn.add(driver);
 }else{
  rounded(enamel,[0,.04,-.012],[.46,.30,.056],.018,null,root);
  for(let i=0;i<9;i++)box(grille,[-.13+i*.022,.076,.019],[.009,.132,.008],null,root);
 }
 const panel=new T.Group();panel.name='pa-button';panel.position.z=.026;root.add(panel);
 rounded(metal,[0,0,0],map==='bus'?[.21,.13,.033]:[.24,.32,.13],.019,null,panel);
 const button=new T.Mesh(new T.CylinderGeometry(.061,.067,.042,16),mat('#c34c32'));button.rotation.x=Math.PI/2;button.position.z=map==='bus'?.033:.081;panel.add(button);
 // Bake the surrounding housing separately so only the switch receives input.
 root.remove(panel);bakeStatic(root);root.add(panel);return panel;
}
