import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRiggedStudent} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';

const specs=[
  {name:'boy',file:'student-boy-v3.glb',variant:'boy'},
  {name:'girl',file:'student-girl-v3.glb',variant:'girl'},
];
const clips=['Idle','Walk','Sit','Write','Snack','Phone','Note','Think','Carry','WalkCarry'].sort();
const V=()=>new T.Vector3();

function surfaces(root,name){
  const result=[];
  root.traverse(o=>{if(o.isMesh&&(o.name===name||o.name.startsWith(name+'_')))result.push(o);});
  return result;
}
function sync(actor){
  actor.group.updateMatrixWorld(true);
  actor.group.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
}
function inHeadSpace(actor,mesh,index){
  const p=V().fromBufferAttribute(mesh.geometry.attributes.position,index);
  mesh.applyBoneTransform(index,p);
  return actor.bones.Head.worldToLocal(mesh.localToWorld(p));
}
function shapeSignature(mesh){
  const points=Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>V().fromBufferAttribute(mesh.geometry.attributes.position,i));
  const box=new T.Box3().setFromPoints(points),center=box.getCenter(V()),width=box.getSize(V()).x;
  assert.ok(width>.01,'mouth surface collapsed to a point');
  // Translation or a uniform size change alone must not count as a new
  // expression. Keep relative height/depth while comparing actual geometry.
  return [...new Set(points.map(p=>p.sub(center).divideScalar(width).toArray().map(v=>v.toFixed(4)).join(',')))].sort().join('|');
}

test('boy and girl use distinct default mouth geometry rather than the same rescaled smile',async()=>{
  const signatures=[];
  for(const spec of specs){
    const gltf=await loadGeometry(spec.file),mouth=surfaces(gltf.scene,'StudentMouth');
    assert.equal(mouth.length,1,`${spec.name}: missing or duplicate mouth surface`);
    signatures.push(shapeSignature(mouth[0]));
    mouth[0].geometry.computeBoundingBox();
    const box=mouth[0].geometry.boundingBox,size=box.getSize(V()),center=box.getCenter(V());
    const expectedWidth={boy:.052,girl:.044}[spec.name];
    assert.ok(Math.abs(size.x-expectedWidth)<.005,`${spec.name}: mouth no longer fits its measured face width`);
    assert.ok(center.y>.70&&center.y<.735,`${spec.name}: mouth left the lower face`);
    assert.ok(size.y<(spec.name==='boy'?.015:.008),`${spec.name}: quiet mouth became an oversized open grin`);
    if(spec.name==='boy')assert.ok(size.y>.009,'boy lost the visible open-mouth expression');
    const teeth=surfaces(gltf.scene,'StudentUpperTeeth');
    assert.equal(teeth.length,spec.name==='boy'?1:0,`${spec.name}: incorrect upper-teeth profile`);
  }
  assert.equal(new Set(signatures).size,2,'two classmates share an identical mouth contour');
});

for(const spec of specs){
  test(`${spec.name}: every visible mouth vertex stays just above the actual repaired face surface`,async()=>{
    const gltf=await loadGeometry(spec.file),mouth=surfaces(gltf.scene,'StudentMouth')[0],bodies=[];
    gltf.scene.traverse(o=>{if(o.isMesh&&!o.name.startsWith('Student'))bodies.push(o);});
    assert.equal(bodies.length,1,'expected the original continuous student body');
    const face=bodies[0].geometry,p=face.attributes.position,indices=face.index,m=mouth.geometry.attributes.position;
    for(let k=0;k<m.count;k++){
      const x=m.getX(k),y=m.getY(k),z=m.getZ(k);let surfaceZ=-Infinity;
      // Compare the real triangle surface, not an approximate head sphere or
      // the authored mouth's own anchor. This catches buried lips and float.
      for(let i=0;i<indices.count;i+=3){
        const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2);
        const ax=p.getX(a),ay=p.getY(a),bx=p.getX(b),by=p.getY(b),cx=p.getX(c),cy=p.getY(c);
        const d=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(d)<1e-9)continue;
        const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/d,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/d,w=1-u-v;
        if(Math.min(u,v,w)<-1e-6)continue;
        surfaceZ=Math.max(surfaceZ,u*p.getZ(a)+v*p.getZ(b)+w*p.getZ(c));
      }
      const clearance=z-surfaceZ;
      assert.ok(Number.isFinite(clearance)&&clearance>.0005&&clearance<.002,`mouth vertex ${k} has ${clearance} m clearance from the face`);
    }
  });

  test(`${spec.name}: mouth repair preserves body, eyes, UVs, skin weights and original animation tracks`,async()=>{
    const [oldAsset,newAsset]=await Promise.all([loadGeometry(`student-${spec.name}-v2.glb`),loadGeometry(spec.file)]);
    const oldMeshes=[];oldAsset.scene.traverse(o=>{if(o.isMesh)oldMeshes.push(o);});
    let changedVertices=0;
    for(const oldMesh of oldMeshes){
      const newMesh=newAsset.scene.getObjectByName(oldMesh.name);assert.ok(newMesh,`removed original mesh ${oldMesh.name}`);
      const before=oldMesh.geometry.attributes,after=newMesh.geometry.attributes;
      for(const attribute of ['uv','skinIndex','skinWeight'])assert.deepEqual(after[attribute].array,before[attribute].array,`${attribute} changed on original skin`);
      assert.deepEqual(newMesh.geometry.index.array,oldMesh.geometry.index.array,'body/face topology changed');
      assert.equal(after.position.count,before.position.count);
      for(let i=0;i<before.position.count;i++){
        const x=before.position.getX(i),y=before.position.getY(i),z=before.position.getZ(i);
        assert.equal(after.position.getX(i),x,'mouth repair shifted original face/body sideways');
        assert.equal(after.position.getY(i),y,'mouth repair shifted original face/body height');
        const dz=Math.abs(after.position.getZ(i)-z);
        if(dz>0){
          changedVertices++;
          assert.ok(Math.abs(x)<.044&&Math.abs(y-.719)<.025&&z>.100,`geometry outside the old mouth changed at ${[x,y,z]}`);
          assert.ok(dz<.015,'face smoothing made a deep dent or floating patch');
        }
      }
    }
    assert.ok(changedVertices>10,'old modeled smile crease was not repaired');
    assert.ok(changedVertices<500,'repair modified too much of the original face');
    const animationData=asset=>asset.animations.map(clip=>({
      name:clip.name,duration:clip.duration,blendMode:clip.blendMode,
      tracks:clip.tracks.map(track=>({name:track.name,type:track.ValueTypeName,interpolation:track.getInterpolation(),times:track.times,values:track.values})),
    }));
    assert.deepEqual(animationData(newAsset),animationData(oldAsset),'export changed existing animation data');
  });

  test(`${spec.name}: mouth and teeth are weighted to the actual animated Head and retain all ten clips`,async()=>{
    const gltf=await loadGeometry(spec.file),actor=createRiggedStudent(gltf,{...spec,seated:false});
    assert.deepEqual(actor.diagnostics().clips.slice().sort(),clips);
    assert.ok(actor.bones.Head?.isBone);
    const mouths=surfaces(actor.group,'StudentMouth'),teeth=surfaces(actor.group,'StudentUpperTeeth');
    assert.equal(mouths.length,1,'mouth was duplicated while creating the actor');
    for(const mesh of [...mouths,...teeth]){
      assert.ok(mesh.isSkinnedMesh,`${mesh.name}: rigid overlay will detach from the animated head`);
      const headIndex=mesh.skeleton.bones.indexOf(actor.bones.Head);
      assert.ok(headIndex>=0,`${mesh.name}: bound to another rig's Head`);
      const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
      assert.ok(position.count>=4,`${mesh.name}: empty surface`);
      for(let i=0;i<position.count;i++){
        let total=0,headWeight=0;
        for(let c=0;c<4;c++){
          const weight=skinWeight.getComponent(i,c);total+=weight;
          if(skinIndex.getComponent(i,c)===headIndex)headWeight+=weight;
        }
        assert.ok(Math.abs(total-1)<.00001,`${mesh.name}: unnormalized vertex ${i}`);
        assert.ok(headWeight>.99999,`${mesh.name}: vertex ${i} stretches with neck/body instead of Head`);
      }
    }
    sync(actor);
    const samples=[...mouths,...teeth].map(mesh=>({mesh,index:Math.floor(mesh.geometry.attributes.position.count/2)}));
    const rest=samples.map(({mesh,index})=>inHeadSpace(actor,mesh,index));
    const playback=new T.AnimationMixer(gltf.scene);
    for(const clip of gltf.animations){
      playback.stopAllAction();const action=playback.clipAction(clip).reset().play();
      for(let frame=0;frame<8;frame++){
        playback.update(clip.duration/8);sync(actor);
        for(let i=0;i<samples.length;i++){
          const {mesh,index}=samples[i],point=inHeadSpace(actor,mesh,index);
          assert.ok(point.toArray().every(Number.isFinite),`${clip.name}: mouth became non-finite`);
          assert.ok(point.distanceTo(rest[i])<.00002,`${clip.name}: mouth detached from animated Head`);
        }
      }
      action.stop();
    }
    playback.stopAllAction();playback.uncacheRoot(gltf.scene);
    actor.dispose();
  });

  test(`${spec.name}: visible mouth follows head turns and capture poses without slipping or separating`,async()=>{
    const actor=createRiggedStudent(await loadGeometry(spec.file),{...spec,seated:false,seed:.37});
    const carrier=new T.Group();carrier.add(actor.group);actor.setMood('resting');actor.update(0);sync(actor);
    const meshes=[...surfaces(actor.group,'StudentMouth'),...surfaces(actor.group,'StudentUpperTeeth')];
    assert.ok(meshes.length);
    const samples=meshes.flatMap(mesh=>{
      const count=mesh.geometry.attributes.position.count,stride=Math.max(1,Math.floor(count/32));
      return Array.from({length:Math.ceil(count/stride)},(_,i)=>({mesh,index:Math.min(i*stride,count-1)}));
    });
    const rest=samples.map(({mesh,index})=>inHeadSpace(actor,mesh,index));
    let time=0,maxSlip=0,previousCenter=null,maxFrameMovement=0,unlookedHead=null;
    for(const restraint of ['free','stunned','carried','bound','free']){
      actor.setMotion({restraint,seated:false,restraintStartedAt:time});
      for(let frame=0;frame<90;frame++){
        time+=1/60;carrier.position.set(Math.sin(time)*1.4,.1,Math.cos(time)*1.4);carrier.rotation.y=time*.7;
        if(unlookedHead)actor.bones.Head.quaternion.copy(unlookedHead);
        actor.update(time);
        unlookedHead=actor.bones.Head.quaternion.clone();
        // Head look is applied after the animation, just as in the real scene.
        actor.bones.Head.rotateY(Math.sin(time*2.1)*.35);
        actor.bones.Head.rotateX(Math.sin(time*1.6)*.17);
        sync(actor);
        const center=V();
        for(let i=0;i<samples.length;i++){
          const {mesh,index}=samples[i],p=inHeadSpace(actor,mesh,index);
          assert.ok(p.toArray().every(Number.isFinite),'mouth skin became non-finite');
          maxSlip=Math.max(maxSlip,p.distanceTo(rest[i]));
          center.add(actor.group.worldToLocal(actor.bones.Head.localToWorld(p.clone())));
        }
        center.divideScalar(samples.length);
        if(previousCenter)maxFrameMovement=Math.max(maxFrameMovement,center.distanceTo(previousCenter));
        previousCenter=center;
      }
    }
    assert.ok(maxSlip<.00002,`mouth slipped ${maxSlip.toFixed(6)} m in Head space`);
    assert.ok(maxFrameMovement<.06,`mouth/head jumped ${maxFrameMovement.toFixed(4)} m between capture frames`);
    assert.equal(surfaces(actor.group,'StudentMouth').length,1,'capture animation created a second mouth');
    actor.dispose();
  });
}
