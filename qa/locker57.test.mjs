import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {campusScene} from './campus-geometry54-helpers.mjs';
import assert from 'node:assert/strict';
import {createSoloRound,switchSoloRole} from '../dist/solo-round.js';
import {createSessionUI} from '../dist/session-ui.js';
import {CampusRoom} from '../server/room-simulation.js';
import {createRolePortraits} from '../dist/role-figures57.js';
import {createRiggedStudent} from '../dist/student-assets.js';
import {createRiggedTeacher} from '../dist/imported-actors.js';
import {loadGeometry} from './gltf-geometry.mjs';
import * as T from '../dist/vendor/three.module.js';

function solo(){const r=createSoloRound({seed:55,map:'night6',duration:420,target:83});r.start({gathering:true});return r;}
test('solo changing role keeps the exact lobby world, pose, settings and used lift',()=>{
 const r=solo();r.elevator.used=true;r.paused=true;r._sessionElapsed=19;Object.assign(r.player,{x:9.2,z:6.2,yaw:.42,pitch:.17});
 const seats=r.snapshot().seats,trip=r.elevator;
 const teacher=switchSoloRole(r,'teacher');assert.equal(teacher.snapshot().role,'teacher');assert.equal(teacher.paused,true);
 for(const k of ['seed','map','target','_defaultDuration','_sessionElapsed'])assert.equal(teacher[k],r[k],k);
 assert.equal(teacher.elevator,trip);assert.deepEqual(teacher.snapshot().seats,seats);assert.equal(teacher.stage,'gathering');
 const student=switchSoloRole(teacher,'student');assert.equal(student.snapshot().role,'student');assert.deepEqual(student.snapshot().seats,seats);assert.equal(student.elevator,trip);assert.equal(student._team.size,1);
 for(const k of ['x','z','yaw','pitch'])assert.equal(student.player[k],r.player[k]);
 teacher.stage='seating';assert.equal(switchSoloRole(teacher,'student'),null);teacher.stage='class';assert.equal(switchSoloRole(teacher,'student'),null);
 r.elevator.phase='travel';assert.equal(switchSoloRole(r,'teacher'),null);
});

test('network locker previews change immediately after command without assigning multiple actual teachers',()=>{
 const room=new CampusRoom({code:'570001',seed:73}),host=room.join({}),a=room.join({}),b=room.join({});
 room.command(a,'setPreference',[{rolePreference:'teacher'}]);room.command(b,'setPreference',[{rolePreference:'teacher'}]);
 assert.equal(room.snapshot(a).lobbyRole,'teacher');assert.equal(room.snapshot(host).students.find(s=>s.id===a.studentId).previewRole,'teacher');assert.equal(a.role,'student');
 room.begin(host);assert.ok([a,b].includes(room.teacherMember));assert.equal([...room.members.values()].filter(m=>m.role==='teacher').length,1);
 assert.equal(room.snapshot(a).lobbyRole,null);assert.throws(()=>room.command(a,'setPreference',[{rolePreference:'student'}]),/开始后/);
 room.sim.status='won';room.rematch(host);assert.equal(room.sim.stage,'gathering');room.command(a,'setPreference',[{rolePreference:'student'}]);room.command(b,'setPreference',[{rolePreference:'student'}]);room.begin(host);assert.ok([host,a,b].includes(room.teacherMember));
});

test('host settings are rejected during seating/class and guests cannot configure before or after class',()=>{
 const room=new CampusRoom({code:'570002',seed:73}),host=room.join({}),guest=room.join({});const values={duration:300,target:30};
 assert.throws(()=>room.configureRound(guest,values),/房主/);assert.equal(room.configureRound(host,values),true);room.begin(host);
 assert.throws(()=>room.configureRound(host,{duration:600,target:60}),/开局后/);room.sim.stage='class';assert.throws(()=>room.configureRound(host,values),/开局后/);
 room.sim.status='won';room.rematch(host);assert.equal(room.configureRound(host,{duration:1200,target:120}),true);assert.throws(()=>room.configureRound(guest,values),/房主/);
 const r=solo();r.pause(true);assert.equal(r.configureRound(values),true);assert.equal(r.paused,true);r.elevator.phase='travel';assert.equal(r.configureRound({duration:600,target:60}),false);r.elevator.phase='idle';r.stage='seating';assert.equal(r.configureRound(values),false);
});

function uiFixture({network=false,guest=false}={}){
 const saved=new Map(),nodes=new Map();
 class Element extends EventTarget{
  constructor(){super();this.nodes=new Map();this.children=[];this.style={};this.dataset={};this.attrs={};this.value='';this.open=false;this.firstElementChild={style:{}};}
  set id(value){this._id=value;nodes.set('#'+value,this);}get id(){return this._id;}
  set innerHTML(html){for(const m of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){const n=new Element();n.id=m[1];n.value=m[0].match(/\bvalue="([^"]*)"/)?.[1]||'';const c=m[0].match(/data-choice="([^"]+)"/);if(c)n.dataset.choice=c[1];this.nodes.set('#'+n.id,n);}}
  querySelector(k){if(!this.nodes.has(k))this.nodes.set(k,new Element());return this.nodes.get(k);}
  querySelectorAll(s){return s==='[data-choice]'?[...this.nodes.values()].filter(n=>n.dataset.choice):[...this.nodes.values()].filter(n=>n.open);}
  append(n){this.children.push(n);}setAttribute(k,v){this.attrs[k]=v;}showModal(){this.open=true;}close(){this.open=false;}remove(){}reportValidity(){return false;}
 }
 const pause=new Element();pause.id='pause-dialog';pause.showModal();const document={activeElement:null,createElement:()=>new Element(),querySelector:s=>nodes.get(s)||null},root=new Element();
 for(const[name,value]of Object.entries({document,matchMedia:()=>({matches:false}),navigator:{maxTouchPoints:0}})){saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});}
 const room=network?new CampusRoom({code:'570003',seed:73}):null,host=room?.join({}),peer=room?.join({}),member=guest?peer:host;let round=room?{room:room.publicRoom(member)}:solo(),resumed=0,suspended=0;
 const ui=createSessionUI({root,commands:{unlock(){},suspend(){suspended++;round.pause?.(true);},resumeLook(){resumed++;round.pause?.(false);},previews:()=>({student:'data:student',teacher:'data:teacher'}),preference:role=>{if(room){room.command(member,'setPreference',[{rolePreference:role}]);return true;}const next=switchSoloRole(round,role);if(!next)return false;round=next;return true;},configure:settings=>room?room.configureRound(member,settings):round.configureRound(settings)}});
 const update=()=>{if(room)round.room=room.publicRoom(member);ui.update(room?room.snapshot(member):round.snapshot(),round);};update();
 return{ui,pause,nodes,room,host,member,update,get round(){return round;},get resumed(){return resumed;},get suspended(){return suspended;},click(id){nodes.get(id).dispatchEvent(new Event('click'));},type(id,value){nodes.get(id).value=String(value);nodes.get(id).dispatchEvent(new Event('input'));nodes.get(id).dispatchEvent(new Event('change'));},close(){ui.dispose();for(const[name,d]of saved)if(d)Object.defineProperty(globalThis,name,d);else delete globalThis[name];}};
}

test('real session locker click applies selected role once, closes and resumes view without a Done button',()=>{
 const f=uiFixture();try{assert.equal(f.nodes.has('#locker-close'),false);f.pause.close();assert.equal(f.ui.openLocker(),true);assert.equal(f.suspended,1);assert.equal(f.ui.modal,true);assert.equal(f.nodes.get('#locker-teacher-image').src,'data:teacher');f.click('#locker-teacher');assert.equal(f.round.snapshot().role,'teacher');assert.equal(f.ui.modal,false);assert.equal(f.resumed,1);assert.equal(f.round.paused,false);f.update();f.ui.openLocker();f.click('#locker-student');assert.equal(f.round.snapshot().role,'student');assert.equal(f.resumed,2);f.update();f.ui.openLocker();const q=new Event('keydown',{cancelable:true});Object.defineProperty(q,'code',{value:'KeyQ'});f.nodes.get('#locker-dialog').dispatchEvent(q);assert.equal(f.ui.modal,false);assert.equal(f.round.snapshot().role,'student');assert.equal(f.resumed,3);}finally{f.close();}
});

test('pause menu settings entry is clickable, edits paused solo, and returns to pause until Continue',()=>{
 const f=uiFixture();try{f.round.pause(true);f.update();assert.ok(f.pause.children.includes(f.nodes.get('#session-settings-open')));f.click('#session-settings-open');assert.equal(f.nodes.get('#session-settings').open,true);f.type('#session-duration',5);f.type('#session-target',30);assert.deepEqual(f.round.snapshot().settings,{duration:300,target:30});assert.equal(f.round.paused,true);f.click('#session-settings-close');assert.equal(f.nodes.get('#session-settings').open,false);assert.equal(f.pause.open,true);assert.equal(f.resumed,0);f.round.stage='seating';f.update();assert.equal(f.nodes.get('#session-settings-open').hidden,true);assert.equal(f.ui.openSettings(),false);}finally{f.close();}
 const guest=uiFixture({network:true,guest:true});try{assert.equal(guest.nodes.get('#session-settings-open').hidden,true);assert.equal(guest.ui.openSettings(),false);}finally{guest.close();}
});

test('locker icons reuse the shipped rigs at original metric sizes, with no world attachment',async()=>{
 const boy=await loadGeometry('student-boy-v4.glb'),gltf=await loadGeometry('teacher-v2.glb');const student=createRiggedStudent(boy,{variant:'boy',metric:true,motionProfile:boy.parser.json.asset.extras.characters40,seated:false}),teacher=createRiggedTeacher(gltf);student.setMotion({seated:false,speed:0});student.setMood('resting');student.update(0,0);
 const figures=createRolePortraits({student,teacher});student.group.updateMatrixWorld(true);teacher.group.updateMatrixWorld(true);const height=o=>new T.Box3().setFromObject(o,true).getSize(new T.Vector3()).y;
 assert.ok(height(teacher.group)>height(student.group)*1.1);assert.deepEqual(student.group.scale.toArray(),[1,1,1]);assert.deepEqual(teacher.group.scale.toArray(),[1,1,1]);assert.equal(figures.group,undefined);assert.equal(figures.targets,undefined);assert.equal(teacher.group.parent,null);assert.equal(student.group.parent,null);figures.dispose();
});

test('the original physical cabinet remains the world target; no teacher/student figures replace it',async()=>{
 const f=campusScene();try{const targets=f.campus.getTargets().lockers;assert.equal(targets.length,1);assert.equal(targets[0].object.name,'role-changing-locker');assert.equal(targets[0].object.visible,true);assert.ok(targets[0].object.children.length>10);let skins=0;targets[0].object.traverse(o=>{if(o.isSkinnedMesh)skins++;});assert.equal(skins,0);assert.equal(f.scene.getObjectByName('role-changing-figures'),undefined);
 const source=await readFile(new URL('../dist/classroom.js',import.meta.url),'utf8');assert.doesNotMatch(source,/roleFigures|lockers\.splice|old\.object\.visible=false/);assert.match(source,/let rolePortraits=null;[\s\S]*function getRolePreviews\(\)/);
 }finally{f.dispose();}
});

test('centre crosshair hits the real cabinet stile at the tested approach position',()=>{
 const f=campusScene();try{const locker=f.campus.getTargets().lockers[0].object;const direction=new T.Vector3(1,-Math.tan(.06),0).normalize();for(const z of[6.64,6.65,6.66]){const ray=new T.Raycaster(new T.Vector3(8.85,1.65,z),direction,0,2.5),hit=ray.intersectObject(locker,true)[0];assert.ok(hit,'centred crosshair must not pass through an empty door seam');assert.equal(hit.object.name,'locker-central-stile');assert.equal(hit.object.userData.campusTarget.type,'locker');const blocker=ray.intersectObject(f.scene,true).find(h=>!h.object.material.transparent);assert.equal(blocker.object,hit.object,'no invisible or through-wall target');}}
 finally{f.dispose();}
});
