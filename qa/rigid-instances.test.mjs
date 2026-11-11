import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {instanceRigidProps} from '../dist/rigid-instances.js';

test('repeated drawers batch while opening and elevated floors retain independent transforms',()=>{
 const scene=new T.Scene(),material=new T.MeshBasicMaterial(),groups=[];
 for(let i=0;i<30;i++){const g=new T.Group(),m=new T.Mesh(new T.BoxGeometry(1,.2,.6),material);g.position.set(i,0,0);g.add(m);scene.add(g);groups.push(g);}
 const batch=instanceRigidProps(groups,scene);assert.equal(batch.sourceCount,30);assert.equal(batch.batchCount,1);
 groups[4].position.set(4,.96,-.24);groups[8].rotation.x=.9;batch.sync();
 const instance=scene.children.find(o=>o.isInstancedMesh),matrix=new T.Matrix4();instance.getMatrixAt(4,matrix);assert.ok(matrix.elements.every((v,i)=>Math.abs(v-groups[4].children[0].matrixWorld.elements[i])<1e-6));
 instance.getMatrixAt(8,matrix);assert.ok(matrix.elements.every((v,i)=>Math.abs(v-groups[8].children[0].matrixWorld.elements[i])<1e-6));
 // Source meshes remain raycast targets even though GPU drawing is instanced.
 const ray=new T.Raycaster(new T.Vector3(4,2,-.24),new T.Vector3(0,-1,0));assert.ok(ray.intersectObject(groups[4],true).length>0);
 groups[8].visible=false;batch.sync();instance.getMatrixAt(8,matrix);assert.equal(matrix.elements[0],0);
 batch.dispose();assert.ok(groups.every(g=>g.children[0].visible));assert.ok(!scene.children.some(o=>o.isInstancedMesh));
});
test('different geometry or material never shares the wrong prop shape',()=>{
 const scene=new T.Scene(),a=new T.Group(),b=new T.Group(),m=new T.MeshBasicMaterial();scene.add(a,b);a.add(new T.Mesh(new T.BoxGeometry(1,1,1),m));b.add(new T.Mesh(new T.BoxGeometry(2,1,1),m));const batch=instanceRigidProps([a,b],scene);assert.equal(batch.batchCount,2);batch.dispose();
});
test('hidden groups submit no batches and moving a visible group refreshes culling bounds',()=>{
 const scene=new T.Scene(),root=new T.Group(),group=new T.Group();scene.add(root);root.position.set(4,2,7);root.add(group);
 const mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());group.add(mesh);
 const batch=instanceRigidProps([group],root),instance=root.children.find(o=>o.isInstancedMesh);
 assert.equal(instance.frustumCulled,true);assert.ok(instance.boundingSphere.center.length()<1e-6,'world transform applied twice');
 group.visible=false;batch.sync();assert.equal(instance.visible,false);
 group.visible=true;group.position.x=40;batch.sync();assert.equal(instance.visible,true);assert.ok(Math.abs(instance.boundingSphere.center.x-40)<1e-6);
 const m=new T.Matrix4();instance.getMatrixAt(0,m);assert.equal(m.elements[12],40);batch.dispose();
});
test('stationary fractional transforms do not re-upload instance matrices or rebuild bounds',()=>{
 const scene=new T.Scene(),g=new T.Group(),m=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());g.add(m);scene.add(g);g.position.set(.123456789,.8625,-.19);g.rotation.y=.73;
 const batch=instanceRigidProps([g],scene),instance=scene.children.find(o=>o.isInstancedMesh);let bounds=0;const old=instance.computeBoundingSphere;instance.computeBoundingSphere=function(){bounds++;return old.call(this);};const version=instance.instanceMatrix.version;
 for(let i=0;i<120;i++)batch.sync();assert.equal(instance.instanceMatrix.version,version);assert.equal(bounds,0);
 g.position.z-=.24;batch.sync();assert.equal(instance.instanceMatrix.version,version+1);assert.equal(bounds,1);batch.dispose();
});
