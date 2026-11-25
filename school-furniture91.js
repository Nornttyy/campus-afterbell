import * as T from './vendor/three.module.js';

// Sections measured on the supplied furniture. A closed shell replaces height
// cuts through the welded Tripo frame, which left holes along the back and seat.
const boards={
 top:{width:1.198,span:.846,radius:.066,thickness:.028},
 seat:{width:.548,span:.481,radius:.063,thickness:.029},
 back:{width:.546,span:.279,radius:.048,thickness:.032}
};
function plywood(kind,material){
 const {width,span,radius,thickness}=boards[kind],hw=width/2,hh=span/2;
 const outline=[];
 for(let corner=0;corner<4;corner++){
  const angle=corner*Math.PI/2,sx=corner===0||corner===3?1:-1,sy=corner<2?1:-1;
  for(let i=0;i<=3;i++){
   const a=angle+i*Math.PI/6;
   outline.push([sx*(hw-radius)+radius*Math.cos(a),sy*(hh-radius)+radius*Math.sin(a)]);
  }
  const x=sx*(hw-radius)+radius*Math.cos(angle+Math.PI/2),y=sy*(hh-radius)+radius*Math.sin(angle+Math.PI/2);
  const nextX=corner%2===0?-x:x,nextY=corner%2===1?-y:y;
  for(let i=1;i<3;i++)outline.push([x+(nextX-x)*i/3,y+(nextY-y)*i/3]);
 }
 const xyz=[],uv=[],colors=[],index=[];
 function vertex(x,y,z,tone){
  const across=(x/hw)**2,along=y/hh,back=kind==='back';
  if(back)xyz.push(x,.847+y,-.327-.229*y+.024*across+z);
  else if(kind==='seat')xyz.push(x,.406+z+.007*across+.006*along*along,.024-y);
  else xyz.push(x,.875-thickness/2+z,-y);
  uv.push(.50+x*.86,.50+y*(back?1.09:.99));
  colors.push(tone,tone,tone);return colors.length/3-1;
 }
 const rings=[];
 function ring(scale,z,tone,inset=0){
  rings.push(outline.map(([x,y])=>vertex(x*scale*(1-inset/hw),y*scale*(1-inset/hh),z,tone)));
 }
 const half=thickness/2,bevel=.004;
 const bottom=vertex(0,0,-half,.83);
 ring(1,-half,.83,bevel);
 ring(1,-half+.006,.82);
 ring(1,.0003,.67);
 ring(1,half-bevel,.89);
 ring(1,half,1,bevel);
 const top=vertex(0,0,half,1),last=rings.at(-1);
 for(let i=0;i<outline.length;i++){
  const j=(i+1)%outline.length;index.push(bottom,rings[0][j],rings[0][i],top,last[i],last[j]);
  for(let k=1;k<rings.length;k++){
   const a=rings[k-1],b=rings[k];index.push(a[i],a[j],b[i],a[j],b[j],b[i]);
  }
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 geometry.setIndex(index);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const part=new T.Mesh(geometry,material);part.name='school-plywood-'+kind;return part;
}

function tube(group, material, points, radius) {
  const vertices = points.map(p=>new T.Vector3(...p));
  const path = new T.CurvePath();
  let from=vertices[0];
  for(let i=1;i<vertices.length-1;i++){
    const corner=vertices[i], next=vertices[i+1];
    const bend=Math.min(.053,corner.distanceTo(from)*.32,corner.distanceTo(next)*.32);
    const near=corner.clone().addScaledVector(from.clone().sub(corner).normalize(),bend);
    const far=corner.clone().addScaledVector(next.clone().sub(corner).normalize(),bend);
    path.add(new T.LineCurve3(from,near));path.add(new T.QuadraticBezierCurve3(near,corner,far));from=far;
  }
  path.add(new T.LineCurve3(from,vertices.at(-1)));
  const o=new T.Mesh(new T.TubeGeometry(path,vertices.length===2?1:vertices.length*3,radius,6,false),material);
  group.add(o);
}

export function makeSchoolChair(oak,steel,cap){
  const seat=new T.Group();
  seat.add(plywood('seat',oak),plywood('back',oak));
  for(const x of [-.225,.225]){
    tube(seat,steel,[[x,.018,-.277],[x,.373,-.19],[x,.384,.177],[x,.018,.224]],.013);
    tube(seat,steel,[[x,.354,.13],[x,.354,-.186],[x,.773,-.292],[x,.921,-.322]],.0115);
    for(const z of [-.277,.224])tube(seat,cap,[[x,.002,z],[x,.033,z]],.0158);
    for(const y of [.783,.911]){
      const z=y>.8?-.305:-.275;
      tube(seat,steel,[[x,y,z],[x,y,z+.011]],.009);
    }
  }
  tube(seat,steel,[[-.225,.198,-.24],[.225,.198,-.24]],.009);
  return seat;
}

export function finishSchoolFurniture(body,drawer,chair,grain){
  const oak=new T.MeshStandardMaterial({color:grain?'#ffffff':'#dba64f',map:grain,roughness:.50,vertexColors:true});
  const steel=new T.MeshStandardMaterial({color:'#99a19d',metalness:.30,roughness:.48});
  const cap=new T.MeshStandardMaterial({color:'#444944',roughness:.86});
  const tray=new T.MeshStandardMaterial({color:'#afb5af',metalness:.14,roughness:.60});
  oak.name='School-maple';steel.name='School-tubular-steel';cap.name='School-foot-caps';tray.name='School-drawer-enamel';
  const table=new T.Group(),seat=makeSchoolChair(oak,steel,cap);
  table.name=body.name;seat.name=chair.name;
  table.add(plywood('top',oak));
  for(const x of [-.532,.532]){
    tube(table,steel,[[x,.018,-.325],[x,.834,-.275],[x,.834,.278],[x,.018,.325]],.0155);
    tube(table,steel,[[x,.17,-.311],[x,.17,.311]],.010);
    for(const z of [-.325,.325])tube(table,cap,[[x,.002,z],[x,.046,z]],.0183);
  }
  tube(table,steel,[[-.532,.21,.311],[.532,.21,.311]],.014);
  tube(table,steel,[[-.532,.821,-.298],[.532,.821,-.298]],.014);
  drawer.traverse(o=>{if(o.isMesh&&o.material?.name==='TripoFurnitureOriginalPBR')o.material=tray;});
  for(const root of [table,seat,drawer])root.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
  return {body:table,drawer,chair:seat,source:'tripo-furniture-v2',drawerFloor:.659};
}

