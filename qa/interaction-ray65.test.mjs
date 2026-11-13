import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import {createDrawerPickTarget,pickDrawerItem,drawerObjectVisible} from '../dist/drawer-picking.js';
import {LIFT,mapKind} from '../dist/classroom-layout.js';

// Execute the production closures against real Three.js geometry without
// constructing a WebGL renderer. The hit/occlusion logic is not copied here.
const source=readFileSync(new URL('../dist/classroom.js',import.meta.url),'utf8');
const pickSource=source.slice(source.indexOf('  function pickDrawerSlot(){'),source.indexOf('  const campusTargets=campus.getTargets();'));
const interactionSource=source.slice(source.indexOf('  function getInteraction(){'),source.indexOf('  function updateItemHover(){'));
assert.ok(pickSource.startsWith('  function pickDrawerSlot(){'));
assert.ok(interactionSource.startsWith('  function getInteraction(){'));

function fixture(){
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,1,.01,100),room=new T.Group(),teachingEnd=new T.Group(),variantGroup=new T.Group(),drawerHost=new T.Group(),drawerItems=new T.Group();
 scene.add(camera,room,teachingEnd,variantGroup,drawerHost);drawerHost.add(drawerItems);
 const gameplay={status:'playing',stage:'class',role:'student',player:{id:0,x:0,z:0,seated:false,caught:false,seatId:0},students:[],drawer:{open:false,drawnSlot:null}};
 const itemRay=new T.Raycaster(),chairTargets=new Map(),furnitureRows=new Map(),drawerSlotProps=[];
 const seenFar=[];let blockerCalls=0;const intersect=itemRay.intersectObjects.bind(itemRay);
 itemRay.intersectObjects=(...args)=>{blockerCalls++;seenFar.push(itemRay.far);return intersect(...args);};
 const scope={gameplay,scene,camera,itemRay,neutralPointer:new T.Vector2(),drawerFocus:1,drawerSlotProps,room,furnitureRows,drawerItems,
  variants:{seatTarget:()=>null,specialRoots:[],group:variantGroup,screens:new Map(),stations:new Map(),drawers:new Map()},campusTargets:{lockers:[],doors:[],officeChairs:[],officeDesks:[]},
  startBellModel:null,campus:{},chairTargets,surveillanceView:{targets:()=>[]},deskTargets:new Map(),drawerRecords:new Map(),deskBooks:new Map(),deskPens:new Map(),mapVariant:'classroom',
  LIFT,mapKind,teachingEnd,pickDrawerItem,isObjectVisible:drawerObjectVisible};
 const api=new Function('scope',`const {${Object.keys(scope).join(',')}}=scope;\n${pickSource}\n${interactionSource}\nreturn {getInteraction,pickDrawerSlot};`)(scope);
 const mesh=(distance,parent=scene,size=.2)=>{const m=new T.Mesh(new T.BoxGeometry(size,size,size),new T.MeshBasicMaterial());m.position.z=-distance;parent.add(m);const raycast=m.raycast.bind(m);m.raycast=(r,hits)=>{seenFar.push(r.far);return raycast(r,hits);};return m;};
 return{...api,gameplay,itemRay,scene,room,chairTargets,furnitureRows,drawerSlotProps,drawerItems,seenFar,mesh,get blockerCalls(){return blockerCalls;},
  food(distance=1.4){const m=mesh(distance,drawerItems,.1);scene.updateMatrixWorld(true);drawerSlotProps.push({pickTargets:[createDrawerPickTarget(m,0)]});Object.assign(gameplay.player,{seated:true});gameplay.drawer.open=true;return m;},
  dispose(){scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}};
}

test('centre ray still selects a nearby chair and restores its shared far distance',()=>{
 const f=fixture();try{f.chairTargets.set(3,f.mesh(1.6));assert.deepEqual(f.getInteraction(),{kind:'chair',id:3});assert.equal(f.itemRay.far,Infinity);assert.ok(f.seenFar.length>0);assert.ok(f.seenFar.every(d=>d<=2.5));assert.equal(f.blockerCalls,1);}finally{f.dispose();}
});

test('distant or just-outside-reach furniture cannot be selected and skips room occlusion work',()=>{
 for(const distance of[2.27,2.7,20]){const f=fixture();try{f.chairTargets.set(3,f.mesh(distance));assert.equal(f.getInteraction(),null);assert.equal(f.blockerCalls,0);assert.equal(f.itemRay.far,Infinity);}finally{f.dispose();}}
});

test('a solid wall still blocks a nearby target while its own geometry is allowed',()=>{
 const f=fixture();try{const chair=f.mesh(1.6);f.chairTargets.set(3,chair);f.furnitureRows.set(3,chair);assert.deepEqual(f.getInteraction(),{kind:'chair',id:3});const wall=f.mesh(.8,f.room);assert.equal(f.getInteraction(),null,'the nearer wall must win over the chair');wall.visible=false;assert.deepEqual(f.getInteraction(),{kind:'chair',id:3});assert.equal(f.itemRay.far,Infinity);}finally{f.dispose();}
});

test('preexisting shorter ray range is respected and restored',()=>{
 const f=fixture();try{f.chairTargets.set(3,f.mesh(1.6));f.itemRay.far=1;assert.equal(f.getInteraction(),null);assert.equal(f.itemRay.far,1);assert.equal(f.blockerCalls,0);}finally{f.dispose();}
});

test('empty physical targets preserve teacher and rescue fallback actions without raycasting the room',()=>{
 const rows=[['teacher',{releaseStudent:4},{kind:'release',id:4}],['teacher',{writeBoardAvailable:true},{kind:'blackboard'}],['teacher',{bindPost:2},{kind:'post',id:2}],['teacher',{teacherAim:{id:7}},{kind:'student',id:7}],['student',{rescueAim:5},{kind:'rescue',id:5}]];
 for(const[role,state,wanted]of rows){const f=fixture();try{Object.assign(f.gameplay,{role},state);assert.deepEqual(f.getInteraction(),wanted);assert.equal(f.blockerCalls,0);assert.equal(f.itemRay.far,Infinity);}finally{f.dispose();}}
 const f=fixture();try{Object.assign(f.gameplay,{stage:'gathering',role:'teacher',writeBoardAvailable:true});assert.equal(f.getInteraction(),null);assert.equal(f.blockerCalls,0);}finally{f.dispose();}
});

test('drawer selection works directly and nested inside getInteraction without leaking the range limit',()=>{
 const f=fixture();try{f.food();assert.equal(f.pickDrawerSlot(),0);assert.equal(f.itemRay.far,Infinity);assert.deepEqual(f.getInteraction(),{kind:'item',slot:0});assert.equal(f.itemRay.far,Infinity);assert.ok(f.seenFar.every(d=>d<=2.5));}finally{f.dispose();}
});

test('drawer food remains blocked by solid furniture and cannot be taken beyond its own 2.2m reach',()=>{
 const f=fixture();try{f.food();const barrier=f.mesh(.8,f.room);assert.equal(f.pickDrawerSlot(),null);barrier.visible=false;assert.equal(f.pickDrawerSlot(),0);assert.equal(f.itemRay.far,Infinity);}finally{f.dispose();}
 const far=fixture();try{far.food(2.4);assert.equal(far.pickDrawerSlot(),null);assert.equal(far.itemRay.far,Infinity);}finally{far.dispose();}
});

test('ray range restores after a mesh raycast failure, including nested drawer picking',()=>{
 for(const drawer of[false,true]){const f=fixture();try{const m=drawer?f.food():f.mesh(1.6);if(!drawer)f.chairTargets.set(3,m);m.raycast=()=>{throw new Error('test mesh failure');};f.itemRay.far=7;assert.throws(()=>f.getInteraction(),/test mesh failure/);assert.equal(f.itemRay.far,7);}finally{f.dispose();}}
});
