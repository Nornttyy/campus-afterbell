import * as T from './vendor/three.module.js';

// Keep the measured top, seat and back from the supplied furniture. Give the
// veneer a continuous projection across the original atlas seams.
function plywood(source, kind, material) {
  const parts = [];
  source.traverse(node => {
    if (!node.isMesh || node.material?.name !== 'TripoFurnitureOriginalPBR') return;
    const g = node.geometry, p = g.attributes.position, n = g.attributes.normal;
    const index = g.index, count = index ? index.count : p.count;
    const positions = [], normals = [], uvs = [], indices = [], seen = new Map();
    const coordinate = (i, axis) => axis === 1 ? p.getY(i) : p.getZ(i);
    for (let i = 0; i < count; i += 3) {
      const ids = [0, 1, 2].map(j => index ? index.getX(i+j) : i+j);
      const mean = axis => ids.reduce((sum,id) => sum + coordinate(id,axis),0)/3;
      const y = mean(1), z = mean(2);
      if (kind === 'top' ? y < .812 : kind === 'seat' ? y < .379 || y > .448 || z < -.203 : y < .729) continue;
      for (const id of ids) {
        if (!seen.has(id)) {
          seen.set(id, positions.length/3);
          const x = p.getX(id), py = p.getY(id), pz = p.getZ(id);
          positions.push(x,kind==='top'?.875-(.875-py)*.61:py,pz);
          const up = n.getY(id);
          if (kind === 'top' && py > .864 && up > .73) normals.push(0,1,0);
          else normals.push(n.getX(id),up,n.getZ(id));
          uvs.push(.5+x*.83,kind==='back' ? .19+py*.73 : .5+pz*1.06);
        }
        indices.push(seen.get(id));
      }
    }
    if (!indices.length) return;
    const board = new T.BufferGeometry();
    board.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    board.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
    board.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
    board.setIndex(indices); board.computeBoundingSphere();
    parts.push(new T.Mesh(board,material));
  });
  return parts;
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
  const o=new T.Mesh(new T.TubeGeometry(path,vertices.length===2?1:vertices.length*5,radius,8,false),material);
  group.add(o);
}

export function finishSchoolFurniture(body,drawer,chair,grain){
  const oak=new T.MeshStandardMaterial({color:grain?'#ffffff':'#dba64f',map:grain,roughness:.48});
  const steel=new T.MeshStandardMaterial({color:'#99a19d',metalness:.30,roughness:.48});
  const cap=new T.MeshStandardMaterial({color:'#444944',roughness:.86});
  const tray=new T.MeshStandardMaterial({color:'#afb5af',metalness:.14,roughness:.60});
  oak.name='School-maple';steel.name='School-tubular-steel';cap.name='School-foot-caps';tray.name='School-drawer-enamel';
  const table=new T.Group(),seat=new T.Group();
  table.name=body.name;seat.name=chair.name;
  const slab=plywood(body,'top',oak),seatPan=plywood(chair,'seat',oak),back=plywood(chair,'back',oak);
  if(!slab.length||!seatPan.length||!back.length) throw Error('School furniture source panels missing');
  table.add(...slab);seat.add(...seatPan,...back);
  for(const x of [-.532,.532]){
    tube(table,steel,[[x,.018,-.325],[x,.831,-.275],[x,.831,.278],[x,.018,.325]],.0155);
    tube(table,steel,[[x,.17,-.311],[x,.17,.311]],.010);
    for(const z of [-.325,.325])tube(table,cap,[[x,.002,z],[x,.046,z]],.0183);
  }
  tube(table,steel,[[-.532,.21,.311],[.532,.21,.311]],.014);
  tube(table,steel,[[-.532,.821,-.298],[.532,.821,-.298]],.014);
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
  drawer.traverse(o=>{if(o.isMesh&&o.material?.name==='TripoFurnitureOriginalPBR')o.material=tray;});
  for(const root of [table,seat,drawer])root.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
  return {body:table,drawer,chair:seat,source:'tripo-furniture-v2',drawerFloor:.659};
}

