import * as T from './vendor/three.module.js';

// Locally modelled from the user's classroom door/front-wall screenshots.
// These are decorative wall fixtures, not new interaction targets or downloads.
export function createCampusWallProps({parent,mat,box,rounded,mesh,assets}){
 const root=new T.Group();root.name='classroom-wall-fixtures54';parent.add(root);
 const plastic=mat('#e7e9de',{roughness:.58}),recess=mat('#899b99',{roughness:.76}),ink=mat('#344b4c',{roughness:.68}),display=mat('#a8bcb0',{roughness:.69});
 const controls=new T.Group();controls.name='classroom-switch-control-cluster';controls.position.set(7.199,1.42,3.15);controls.rotation.y=-Math.PI/2;root.add(controls);
 // Mounting backs end 1mm in front of the actual plaster face, with real bevels,
 // recessed rocker sockets and separate hinged rocker surfaces.
 rounded(recess,[0,0,.012],[.282,.282,.024],.012,null,controls);
 rounded(plastic,[0,0,.026],[.274,.274,.020],.011,null,controls);
 for(const x of[-.066,.066])for(const y of[-.066,.066]){
  rounded(ink,[x,y,.038],[.112,.112,.006],.006,null,controls);
  rounded(plastic,[x,y,.044],[.102,.102,.012],.006,[x<0?.045:-.045,0,0],controls);
 }
 rounded(recess,[0,.40,.014],[.278,.246,.028],.009,null,controls);
 rounded(plastic,[0,.40,.030],[.272,.240,.018],.009,null,controls);
 rounded(ink,[0,.435,.041],[.207,.091,.005],.004,null,controls);
 rounded(display,[0,.435,.044],[.193,.077,.003],.003,null,controls);
 // Quiet LCD segments. No tutorial words, titles or invented prompts.
 for(const [x,y,w,h]of[[-.055,.452,.034,.003],[-.025,.438,.003,.030],[-.055,.425,.034,.003],[.020,.452,.034,.003],[.004,.438,.003,.030],[.020,.425,.034,.003]])box(ink,[x,y,.046],[w,h,.001],null,controls);
 for(const x of[-.074,0,.074])rounded(plastic,[x,.346,.043],[.046,.030,.008],.004,null,controls);

 const clock=new T.Group();clock.name='classroom-wall-clock';clock.position.set(0,4.22,8.785);clock.rotation.y=Math.PI;root.add(clock);
 const backing=new T.CylinderGeometry(.228,.228,.038,48);assets.add(backing);mesh(backing,ink,[0,0,.019],[1,1,1],[Math.PI/2,0,0],clock);
 const dial=new T.CircleGeometry(.208,48);assets.add(dial);mesh(dial,plastic,[0,0,.039],[1,1,1],null,clock);
 const bezel=new T.TorusGeometry(.218,.012,8,48);assets.add(bezel);mesh(bezel,recess,[0,0,.039],[1,1,1],null,clock);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;box(ink,[Math.sin(a)*.179,Math.cos(a)*.179,.041],[i%3?.005:.009,i%3?.015:.025,.003],[0,0,-a],clock);}
 box(ink,[-.035,.039,.046],[.012,.112,.005],[0,0,.73],clock);
 box(ink,[.062,.034,.048],[.010,.147,.005],[0,0,-1.07],clock);
 const pin=new T.CircleGeometry(.013,16);assets.add(pin);mesh(pin,ink,[0,0,.052],[1,1,1],null,clock);
 return{root,controls,clock};
}
