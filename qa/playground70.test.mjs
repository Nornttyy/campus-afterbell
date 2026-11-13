import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createPlaygroundLayout,PLAYGROUND_LAYOUT,playgroundWalkable,playgroundFloorHeight} from '../dist/playground-layout70.js';
import {createPlaygroundRoom,playgroundTrackRing} from '../dist/playground-room70.js';

test('outdoor footprint joins the existing right corridor without a wall across its entrance',()=>{
 const p=PLAYGROUND_LAYOUT,b=p.bounds,e=p.entrance;
 for(const [actual,expected]of [[b.minX,-28.8],[b.maxX,7.2],[b.minZ,-51.2],[b.maxZ,8.8]])assert.ok(Math.abs(actual-expected)<1e-9);
 for(let x=e.x-.4;x<=p.connector.maxX+.15;x+=.05){assert.ok(playgroundWalkable(x,e.z,.18,p));assert.equal(p.colliders.filter(c=>!c.walkable).some(c=>x>=c.minX&&x<=c.maxX&&e.z>=c.minZ&&e.z<=c.maxZ),false,'door opening is blocked');}
 for(const side of[[b.minX-.2,0],[b.maxX+.4,0],[0,b.minZ-.2],[0,b.maxZ+.2]])assert.equal(playgroundWalkable(...side),false);
});
test('larger dimensions rebuild geometry and retain the fixed right corridor anchor',()=>{
 const p=createPlaygroundLayout({width:42,length:70});assert.equal(p.bounds.maxX,PLAYGROUND_LAYOUT.bounds.maxX);assert.equal(p.bounds.width,42);assert.equal(p.bounds.length,70);assert.equal(p.entrance.x,7.2);assert.ok(p.track.outerRadius>PLAYGROUND_LAYOUT.track.outerRadius);assert.ok(p.track.straightHalf>PLAYGROUND_LAYOUT.track.straightHalf);
});
test('three separate walkable steps and seven binding posts are grounded in the inner field',()=>{
 const p=PLAYGROUND_LAYOUT;assert.equal(p.steps.length,3);assert.equal(p.posts.length,7);
 for(let i=0;i<3;i++){const s=p.steps[i];assert.equal(playgroundFloorHeight(s.x,s.z+s.depth/2-.01,p),s.top);assert.equal(s.top-s.bottom,.18*(i+1)-.18*i);}
 for(const post of p.posts){assert.equal(playgroundFloorHeight(post.x,post.z,p),post.y);assert.ok(post.x>p.bounds.minX&&post.x<p.bounds.maxX);}
 assert.equal(playgroundFloorHeight(p.track.cx,p.track.cz,p),0);
});
test('track is a real stadium-shaped ring with no degenerate seam or inverted top faces',()=>{
 const t=PLAYGROUND_LAYOUT.track,g=playgroundTrackRing(t,t.outerRadius,t.innerRadius),p=g.attributes.position,i=g.index,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3();
 for(let n=0;n<i.count;n+=3){a.fromBufferAttribute(p,i.getX(n));b.fromBufferAttribute(p,i.getX(n+1));c.fromBufferAttribute(p,i.getX(n+2));normal.crossVectors(b.sub(a),c.sub(a));assert.ok(normal.y>1e-6,'track seam must remain nondegenerate and face up');}
 g.computeBoundingBox();assert.ok(Math.abs(g.boundingBox.max.x-(t.cx+t.outerRadius))<1e-5);assert.ok(Math.abs(g.boundingBox.max.z-(t.cz+t.straightHalf+t.outerRadius))<1e-5);g.dispose();
});
test('rendered props match collision sizes; board and portal remain usable without desks or food rules',()=>{
 const scene=new T.Scene(),r=createPlaygroundRoom({parent:scene});try{
  assert.equal(r.group.parent,scene);assert.equal(r.group.userData.independentOutdoor,true);assert.equal(r.colliders,r.layout.colliders);assert.equal(r.boardTarget.userData.interaction,'board');assert.equal(r.diagnostics().seats,0);assert.equal(r.diagnostics().foodRulesDefined,false);assert.ok(r.diagnostics().meshes<45,'static scene should remain batched');assert.ok(r.diagnostics().triangles<70000);
  for(const collider of r.colliders){assert.ok(collider.minX<collider.maxX&&collider.minY<collider.maxY&&collider.minZ<collider.maxZ);}
  const ray=new T.Raycaster(new T.Vector3(r.entrance.x-.3,1.2,r.entrance.z),new T.Vector3(1,0,0),0,.6);r.group.updateMatrixWorld(true);assert.equal(ray.intersectObject(r.group,true).filter(h=>h.object.name!=='playground-outdoor-sky').length,0,'rendered doorway frame crosses the walking opening');
  const stage=r.layout.steps[2];const down=new T.Raycaster(new T.Vector3(stage.x+.15,2,stage.z-.55),new T.Vector3(0,-1,0),0,3);const hit=down.intersectObject(r.group,true).find(h=>h.object.name!=='playground-outdoor-sky');assert.ok(hit&&Math.abs(hit.point.y-stage.top)<1e-5,'rendered top matches the walkable step height');
  let disposal=0;r.group.traverse(o=>{if(o.isMesh)o.geometry.addEventListener('dispose',()=>disposal++);});r.update(2);assert.equal(r.group.userData.lastUpdate,2);r.dispose();r.dispose();assert.equal(r.group.parent,null);assert.ok(disposal>0);
 }finally{r.dispose();}
});
