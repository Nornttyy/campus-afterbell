// Read-only geometry audit. This reports known defects instead of making the
// normal regression suite accept them. No production module is changed here.
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {loadGeometry} from './gltf-geometry.mjs';
import {buildReferenceCampus} from '../dist/reference-campus.js';
import {createRoomVariants} from '../dist/room-variants.js';
import {ClassroomRound,chalkHit} from '../dist/classroom-rules.js';
import {createSeatLayout,createLayoutContext,LAYOUT_PATTERNS,SEATS,blocked,moveInRoom,OFFICE_CHAIR} from '../dist/classroom-layout.js';

const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),bounds=o=>{o.updateWorldMatrix(true,true);return new T.Box3().setFromObject(o,true);};
const recordBox=b=>({min:b.min.toArray(),max:b.max.toArray()}),report={verified:[],defects:[]};
const assets=new Set(),materials=new Set(),scene=new T.Scene(),room=new T.Group();scene.add(room);
const mat=(color,options={})=>{const m=new T.MeshStandardMaterial({color,...options});materials.add(m);return m;};
const mesh=(g,m,p,s=[1,1,1],r=null,parent=room)=>{assets.add(g);const o=new T.Mesh(g,m);o.position.set(...p);o.scale.set(...s);if(r)o.rotation.set(...r);parent.add(o);return o;};
const box=(m,p,s,r=null,parent=room)=>mesh(new T.BoxGeometry(...s),m,p,[1,1,1],r,parent);
// Identical rounded geometry construction to classroom.js, not a bounding box
// substituted for the actual bevels when checking a visual intersection.
function rounded(m,p,s,r=.015,rotation=null,parent=room){const[w,h,d]=s;r=Math.min(r,h*.24,w*.24,d*.24);const a=w-2*r,b=h-2*r,q=Math.min(r,b*.35),x=-a/2,y=-b/2,shape=new T.Shape();shape.moveTo(x+q,y);shape.lineTo(x+a-q,y);shape.quadraticCurveTo(x+a,y,x+a,y+q);shape.lineTo(x+a,y+b-q);shape.quadraticCurveTo(x+a,y+b,x+a-q,y+b);shape.lineTo(x+q,y+b);shape.quadraticCurveTo(x,y+b,x,y+b-q);shape.lineTo(x,y+q);shape.quadraticCurveTo(x,y,x+q,y);const g=new T.ExtrudeGeometry(shape,{depth:d-2*r,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:3,steps:1,curveSegments:4});g.translate(0,0,-(d-2*r)/2);return mesh(g,m,p,[1,1,1],rotation,parent);}
const cylinder=(m,p,s,r=null,parent=room)=>mesh(new T.CylinderGeometry(s[0],s[2],s[1],12),m,p,[1,1,1],r,parent),texture=()=>new T.Texture(),base=mat('#fff'),M=new Proxy({},{get:()=>base});
const campus=buildReferenceCampus({scene,room,M,mat,mesh,box,rounded,cylinder,texture,assets,materials,floorMat:base});campus.enclosure.visible=true;campus.attachUpperArchitecture();scene.updateMatrixWorld(true);
const ray=(o,a,b)=>{o.updateWorldMatrix(true,true);const delta=b.clone().sub(a);return new T.Raycaster(a,delta.clone().normalize(),0,delta.length()).intersectObject(o,true)[0]||null;};
const horizontalOverlap=(a,b)=>Math.min(a.max.x,b.max.x)-Math.max(a.min.x,b.min.x)>1e-6&&Math.min(a.max.z,b.max.z)-Math.max(a.min.z,b.min.z)>1e-6;

const [deskAsset,chairAsset]=await Promise.all(['desk-v2.glb','chair-v2.glb'].map(loadGeometry));
const desk=deskAsset.scene.getObjectByName('DeskBody'),chair=chairAsset.scene.getObjectByName('ChairBody'),deskBox=bounds(desk),chairBox=bounds(chair);
let checkedPairs=0;
for(const seed of[0,3,7,73,91])for(const pattern of LAYOUT_PATTERNS){const boxes=createSeatLayout(seed,pattern).map(s=>deskBox.clone().applyMatrix4(new T.Matrix4().makeRotationY(s.yaw)).translate(v(s.deskX,0,s.deskZ)));for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){assert.equal(horizontalOverlap(boxes[i],boxes[j]),false,`${pattern}/${seed} desks ${i}/${j}`);checkedPairs++;}}
report.verified.push({id:'four-desk-overlap-fixed',checkedPairs,actualDesktop:recordBox(deskBox),minimumFacingTopGap:.88-deskBox.getSize(v()).z});
for(const [id,objects]of[['floor-seams',scene.getObjectsByProperty('name','campus-continuous-floor')],['ceiling-seams',['classroom','corridor','office'].map(part=>scene.getObjectByName('campus-ceiling-'+part))]]){assert.equal(objects.length,3);const boxes=objects.map(bounds);for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.equal(horizontalOverlap(boxes[i],boxes[j]),false,id);report.verified.push({id,boxes:boxes.map(recordBox)});}

const seat=SEATS[0],ctx=createLayoutContext(SEATS);
const deskCollider=ctx.desks[0];
report.defects.push({id:'desktop-collision-smaller-than-shipped-top',file:'dist/classroom-layout.js:deskSolids',renderedLocalBox:recordBox(deskBox),collisionLocal:{minX:deskCollider.minX-seat.deskX,maxX:deskCollider.maxX-seat.deskX,minZ:deskCollider.minZ-seat.deskZ,maxZ:deskCollider.maxZ-seat.deskZ,maxY:deskCollider.maxY},missedFrontEdgeMetres:Math.abs(deskBox.min.z)-.4,missedTopMetres:deskBox.max.y-deskCollider.maxY});

const worldChair=chair.clone(true);worldChair.position.set(seat.x,0,seat.z);worldChair.rotation.y=seat.yaw;scene.add(worldChair);scene.updateMatrixWorld(true);
const start={x:seat.x,z:seat.z-.90},end=moveInRoom(start,0,1.02,.18,ctx),chairHit=ray(worldChair,v(start.x,.85,start.z),v(end.x,.85,end.z));
assert.ok(chairHit,'read-only reproduction must hit an actual imported backrest triangle');
report.defects.push({id:'walk-through-imported-chair-backrest',file:'dist/classroom-layout.js:createLayoutContext',start,end,actualBackrestHit:chairHit.point.toArray(),endpointBlocked:blocked(end.x,end.z,.18,ctx),actualChairBox:recordBox(bounds(worldChair))});

campus.setDoors({officeLocked:false,rearDoorClosed:false});scene.updateMatrixWorld(true);
const leafStart={x:7.7,z:9.4},leafEnd=moveInRoom(leafStart,1.2,0,.18,ctx),leafHit=ray(campus.officeDoors[0],v(leafStart.x,1,leafStart.z),v(leafEnd.x,1,leafEnd.z));assert.ok(leafHit,'office reproduction must cross a visible door triangle');
report.defects.push({id:'walk-through-open-office-door',file:'dist/classroom-layout.js:updateLayoutDoors',start:leafStart,end:leafEnd,actualDoorHit:leafHit.point.toArray(),renderedDoor:recordBox(bounds(campus.officeDoors[0])),endpointBlocked:blocked(leafEnd.x,leafEnd.z,.18,ctx)});

const variants=createRoomVariants({scene,box,rounded,mat,texture,bakeStatic:()=>{}});variants.setMap('computer');variants.setSeats(SEATS);scene.updateMatrixWorld(true);
const a={x:seat.deskX,y:1.22,z:seat.deskZ+.27},b={x:seat.deskX,y:1.22,z:seat.deskZ+.10},monitorHit=ray(variants.stations.get(seat.id),v(a.x,a.y,a.z),v(b.x,b.y,b.z));assert.ok(monitorHit,'screen reproduction must cross an actual monitor triangle');
const chalk=chalkHit(a,b,[],[],'computer',ctx);
report.defects.push({id:'chalk-passes-through-visible-monitor',file:'dist/classroom-rules.js:chalkHit',start:a,end:b,actualMonitorHit:monitorHit.point.toArray(),physicsHit:chalk,actualLocalZ:[.124,.216],physicsLocalZ:[-.06,.05],needsSeatYaw:true});

const round=new ClassroomRound({seed:73});round.start();Object.assign(round.teacher,{x:6.90,z:0,yaw:Math.PI/2});const actor=round.students[0];Object.assign(actor,{x:6.60,z:.40,seated:false,captivity:'stunned',_chalkUntil:5});assert.equal(blocked(round.teacher.x,round.teacher.z,.23,round.layout),false);assert.equal(round._grab(actor),true);round.elapsed=1;round._advanceCaptivity(1/60);
report.defects.push({id:'carried-student-is-written-through-partition',file:'dist/classroom-rules.js:_advanceCaptivity',teacher:{x:round.teacher.x,z:round.teacher.z,yaw:round.teacher.yaw},student:{x:actor.x,z:actor.z},studentBlocked:blocked(actor.x,actor.z,.20,round.layout)});

const stand=new ClassroomRound({seed:73});stand.start();Object.assign(stand.player,{x:seat.x,z:seat.z,seated:true,seatId:seat.id});const before={x:stand.player.x,z:stand.player.z};assert.equal(stand.interact(),'stood');const standHit=ray(worldChair,v(stand.player.x,.70,stand.player.z),v(stand.player.x,.05,stand.player.z));assert.ok(standHit);
report.defects.push({id:'stand-up-stays-in-chair-seat-volume',file:'dist/classroom-rules.js:interact',before,after:{x:stand.player.x,z:stand.player.z},actualSeatTriangle:standHit.point.toArray(),officeChairSameRule:OFFICE_CHAIR});

console.log(JSON.stringify(report,null,2));
variants.dispose();for(const geometry of assets)geometry.dispose?.();for(const material of materials)material.dispose();
