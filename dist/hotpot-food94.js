import * as T from './vendor/three.module.js';
export const dishLabels={beef:'肥牛',cabbage:'白菜',meatball:'牛肉丸',lotus:'藕片',luncheon:'午餐肉',shiitake:'香菇'};
const cache=new Map(),materials=new Map();
function material(color){
 if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.63}));
 return materials.get(color);
}
function part(group,geometry,color,x,y,z){
 const mesh=new T.Mesh(geometry,material(color));mesh.position.set(x,y,z);group.add(mesh);return mesh;
}
const ball=new T.SphereGeometry(1,12,8),fat=new T.BoxGeometry(.059,.0014,.0032);
function oval(g,color,x,y,z,w,h,d){
 const m=part(g,ball,color,x,y,z);m.scale.set(w,h,d);return m;
}
function ingredient(dish,done){
 const g=new T.Group();
 if(dish==='meatball'){oval(g,done?'#9a603a':'#ce997b',0,.022,0,.029,.024,.028);}
 else if(dish==='shiitake'){oval(g,'#e9c894',0,.010,0,.011,.013,.011);oval(g,done?'#704027':'#95613c',0,.024,0,.034,.017,.032);}
 else if(dish==='cabbage'){
  for(let i=-1;i<=1;i++){const leaf=oval(g,done?'#91a14e':'#a9c86c',i*.013,.011,.004,.013,.007,.034);leaf.rotation.y=i*.28;}
  oval(g,'#e6dfab',0,.014,-.014,.010,.007,.023);
 }else if(dish==='lotus'){
  const shape=new T.Shape();shape.absarc(0,0,.032,0,Math.PI*2,false);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,hole=new T.Path();hole.absarc(.0165*Math.cos(a),.0165*Math.sin(a),.0057,0,Math.PI*2,true);shape.holes.push(hole);}
  const geo=new T.ExtrudeGeometry(shape,{steps:1,depth:.009,bevelEnabled:false,curveSegments:6});geo.rotateX(-Math.PI/2);part(g,geo,done?'#cca46c':'#ebd3a4',0,.002,0);
 }else{
  const meat=dish==='luncheon',color=done?(meat?'#bd785a':'#996945'):(meat?'#d8908b':'#bf5855');
  const m=part(g,new T.BoxGeometry(.065,meat?.019:.009,.044),color,0,meat?.010:.005,0);m.rotation.z=meat?0:.06;
  for(let i=-1;i<=1;i++){const line=part(g,fat,done?'#d1ad79':'#eac4a9',0,meat?.020:.011,i*.012);line.rotation.y=i*.10;}
 }
 return g;
}
function prototype(dish,style){
 if(!Object.hasOwn(dishLabels,dish))dish='beef';
 const key=style+'-'+dish;if(cache.has(key))return cache.get(key);
 const g=new T.Group(),done=style==='cooked';
 if(style==='plate'){
  const profile=[[0,0],[.074,0],[.086,.002],[.106,.012],[.109,.013],[.110,.016],[.105,.018],[.078,.009],[0,.008]];
  part(g,new T.LatheGeometry(profile.map(([x,y])=>new T.Vector2(x,y)),24),'#e8ebe2',0,0,0);
  const count=dish==='luncheon'?1:dish==='meatball'?2:3;
  const food=ingredient(dish,false);
  for(let i=0;i<count;i++){const m=food.clone();m.position.set((i-(count-1)/2)*.044,.013,(i%2)*.017-.008);m.rotation.y=(i-1)*.3;g.add(m);}
 }else g.add(ingredient(dish,done));
 cache.set(key,g);return g;
}
export function hotpotFood(style,dish='beef'){
 const g=new T.Group();g.userData.foodStyle=style;setDish(g,dish);return g;
}
export function setDish(g,dish,style=g?.userData.foodStyle){
 if(!style||!g)return;
 if(!Object.hasOwn(dishLabels,dish))dish='beef';
 if(g.userData.dish===dish&&g.userData.foodStyle===style)return;
 g.clear();g.add(prototype(dish,style).clone(true));g.userData.foodStyle=style;g.userData.dish=dish;
}
