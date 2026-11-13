import * as T from './vendor/three.module.js';
// One baked lighting probe shared by the new-map materials; no per-frame cube
// renders, extra shadow casters or mesh subdivision. Day character shading stays intact.
export function createSchoolMaterialFinish(renderer,roots){
 const studio=new T.Scene();studio.background=new T.Color('#747d80');const owned=[];
 function panel(color,w,h,x,y,z,rx=0,ry=0){const g=new T.PlaneGeometry(w,h),m=new T.MeshBasicMaterial({color,side:T.DoubleSide}),o=new T.Mesh(g,m);o.position.set(x,y,z);o.rotation.set(rx,ry,0);studio.add(o);owned.push(g,m);}
 panel('#e6f0ec',7,4,0,5,0,Math.PI/2);panel('#bcdbe4',3,4,-4,2,0,0,Math.PI/2);panel('#6e7770',6,4,4,2,0,0,-Math.PI/2);panel('#ede2ba',5,2,0,2,-4);panel('#574b39',8,8,0,-2,0,-Math.PI/2);
 const generator=new T.PMREMGenerator(renderer),probe=generator.fromScene(studio,.035,.1,30);generator.dispose();owned.forEach(o=>o.dispose());
 const list=[],seen=new Set();for(const root of roots)root.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.isMeshStandardMaterial&&!seen.has(m)){seen.add(m);list.push({m,root,env:m.envMap,intensity:m.envMapIntensity});m.envMap=probe.texture;m.envMapIntensity=root.name.includes('dorm')?.08:m.metalness>.4?.65:.22;m.needsUpdate=true;}});
 return{update(){},dispose(){for(const{m,env,intensity}of list){m.envMap=env;m.envMapIntensity=intensity;}probe.dispose();}};
}
