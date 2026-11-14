import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {loadFurniture67,cloneFurniture67} from '../dist/furniture-assets67.js?v=campus-79';
import {createToiletRoom} from '../dist/toilet-room70.js?v=campus-79';
import {TOILET_SOLIDS,TOILET_STALLS} from '../dist/toilet-layout70.js?v=campus-79';
import {createRiggedStudent,STUDENT_ASSETS} from '../dist/student-assets.js?v=campus-79';
import {hotpotHelpers} from './hotpot70-helpers.mjs';
const V=()=>new T.Vector3();
const report=await loadFurniture67({loader:{loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())}});
function vertices(group,re){const out=[];group.updateMatrixWorld(true);group.traverse(m=>{if(!m.isSkinnedMesh)return;m.skeleton.update();const si=m.geometry.attributes.skinIndex,sw=m.geometry.attributes.skinWeight;for(let i=0;i<si.count;i++){let w=0;for(let j=0;j<4;j++)if(re.test(m.skeleton.bones[si.getComponent(i,j)].name))w+=sw.getComponent(i,j);if(w>.8)out.push(m.getVertexPosition(i,V()).applyMatrix4(m.matrixWorld));}});return out;}
test('supplied toilet retains embedded 2K maps, is correctly oriented, and replaces every procedural bowl',async()=>{
 assert.ok(report.find(r=>r.name==='toilet')?.ok,JSON.stringify(report));const bytes=await readFile(new URL('../dist/assets/models/toilet-v78.glb',import.meta.url)),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 assert.ok(json.images.length>=2);assert.ok(json.materials[0].pbrMetallicRoughness.baseColorTexture);assert.ok(json.materials[0].normalTexture);
 const helper=hotpotHelpers(new T.Group()),room=createToiletRoom(helper);room.group.updateMatrixWorld(true);
 for(const [id,seat]of room.seats){const imported=seat.fixture.getObjectByName('tripo67-toilet');assert.ok(imported);assert.equal(seat.fixture.children.length,1,'old bowl remains underneath');const bounds=new T.Box3().setFromObject(imported,true),s=TOILET_STALLS[id];assert.ok(Math.abs(bounds.min.y)<1e-5);assert.ok(bounds.max.y<.76&&bounds.max.y>.73);const boxes=TOILET_SOLIDS.filter(v=>v.id===`toilet-bowl-${id}`||v.id===`toilet-tank-${id}`);const collision=new T.Box3();for(const b of boxes)collision.union(new T.Box3(new T.Vector3(b.minX,b.minY,b.minZ),new T.Vector3(b.maxX,b.maxY,b.maxZ)));assert.ok(collision.containsBox(bounds),'bounds outside fixture collision');assert.ok(bounds.min.z<s.z-.8&&bounds.max.z<s.z-.22,'tank faces away from the student');}
 let disposed=0;const template=cloneFurniture67('toilet');template.traverse(m=>{if(m.isMesh)m.geometry.addEventListener('dispose',()=>disposed++);});room.dispose();assert.equal(disposed,0,'shared model disposed during map switch');const second=createToiletRoom(helper);assert.ok(second.seats.get(0).fixture.getObjectByName('tripo67-toilet'));second.dispose();helper.dispose();
});
for(const[variant,{file}]of Object.entries(STUDENT_ASSETS))test(`${variant}: toilet sit plants feet, bends knees in front of the bowl, and leaves normal animation intact`,async()=>{
 const a=createRiggedStudent(await loadGeometry(file+'.glb'),{variant,seated:false}),original=Object.values(a.bones).map(b=>[b,b.position.clone()]);a.setMotion({seated:true,seatSurface:'toilet',speed:0});for(let i=0;i<120;i++)a.update(i/60);
 const feet=new T.Box3().setFromPoints(vertices(a.group,/Foot|ToeBase/));assert.ok(feet.min.y>=-.003&&feet.min.y<.015,`feet ${feet.min.y}`);assert.ok(feet.min.z>.34,'feet must be in front of the porcelain');
 for(const side of['Left','Right']){const hip=a.bones[side+'UpLeg'].getWorldPosition(V()),knee=a.bones[side+'Leg'].getWorldPosition(V()),ankle=a.bones[side+'Foot'].getWorldPosition(V()),hand=a.bones[side+'Hand'].getWorldPosition(V());assert.ok(knee.z-hip.z>.15,'knee is too straight');assert.ok(knee.y-ankle.y>.20);assert.ok(hand.y<.62&&hand.y>knee.y+.06,'hands stay at invisible desktop height');}
 // Check the actual skinned thigh silhouette where it overlaps the visible rim.
 const toilet=cloneFurniture67('toilet');toilet.updateMatrixWorld(true);const ray=new T.Raycaster(V(),new T.Vector3(0,-1,0)),points=vertices(a.group,/UpLeg/);let contact=Infinity;
 for(const p of points){if(p.z<.07||p.z>.23||Math.abs(p.x)>.19)continue;ray.ray.origin.set(p.x,1,p.z);const hit=ray.intersectObject(toilet,true)[0];if(hit&&hit.point.y>.32)contact=Math.min(contact,p.y-hit.point.y);}
 assert.ok(Number.isFinite(contact),'no measurable seat contact region');assert.ok(contact>-.018,`thigh penetrates rim ${contact}`);
 a.setMotion({seated:false,seatSurface:null,speed:0});for(let i=120;i<240;i++)a.update(i/60);for(const[b,p]of original)assert.ok(b.position.distanceTo(p)<1e-6,'seat pose leaked into standing '+b.name);a.dispose();
});
