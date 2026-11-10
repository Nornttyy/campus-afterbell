import {createHandAnimationRuntime} from './hand-animation-runtime59.js?v=campus-63';
import {PUBLISHED_HAND_ANIMATIONS} from './published-hand-animations61.js?v=campus-63';
import {drawerHandTarget} from './drawer-hand-target58.js?v=campus-63';
import {ROOM_LIGHTING,applyRoomLighting} from './room-lighting58.js?v=campus-63';
import {createRolePortraits,teacherLobbyActor} from './role-figures57.js?v=campus-63';
import {gameplayFov} from './view-tuning55.js?v=campus-63';
import {setCharacterNight} from './character-materials.js?v=campus-63';
import {createStaminaVision} from './stamina-vision55.js?v=campus-63';
import {createSoundCues} from './sound-cue55.js?v=campus-63';
import {createChalkPowder} from './chalk-powder55.js?v=campus-63';
import {createSurveillanceView} from './surveillance-view54.js?v=campus-63';
import {CRAWL_TUNING} from './crawl-profile.js?v=campus-63';
import {createFirstPersonView,sampleFirstPersonMotion,firstPersonEyeHeight} from './first-person-view.js?v=campus-63';
import {instanceRigidProps} from './rigid-instances.js?v=campus-63';
import {createItemEffects50} from './item-effects50.js?v=campus-63';
import {createBubbleEffects} from './bubble-effects.js?v=campus-63';
import {loadCampusArtwork} from './campus-artwork.js?v=campus-63';
import {buildReferenceCampus} from './reference-campus.js?v=campus-63';
import {TEACHER_EYE_HEIGHT} from './classroom-layout.js?v=campus-63';
import {createRoomVariants} from './room-variants.js?v=campus-63';
import {createComputerScreenContent} from './computer-screen55.js?v=campus-63';
import * as THREE from './vendor/three.module.js';
import {loadCampusSurfaces,surfaceHeight,addTerrazzoGrout} from './surface-materials.js?v=campus-63';
import {createSmokeEffects} from './smoke-effects.js?v=campus-63';
import {createItemOutline} from './item-outline.js?v=campus-63';
import {createDeskHands,createDeskItem,DESK_ITEM_KINDS,THROWABLE_ITEM_KINDS} from './game-actors.js?v=campus-63';
import {loadStudentAssets} from './student-assets.js?v=campus-63';
import {loadPropAssets,CLASSROOM_PROP_SOURCES,restDeskItem} from './prop-assets.js?v=campus-63';
import {createDrawerPickTarget,pickDrawerItem} from './drawer-picking.js?v=campus-63';
import {loadDeskModel,loadTeacherModel} from './imported-actors.js?v=campus-63';
import {SEATS,PLAYER_SEAT,FRIEND_SEATS,COVERED_SEATS,BOARD,DETENTION,floorHeight,actorFloorHeight,CAMPUS_MAPS,LIFT,START_BELL_POSITION,OFFICE_CHAIR,OFFICE_DESK,createLayoutContext,updateLayoutDoors,mapKind,walkRoute} from './classroom-layout.js?v=campus-63';

export const STUDENT_VARIANTS=Object.freeze(['boy','girl','glasses','ponytail']);

// Animation receives metres per simulation second, not a mood-derived constant.
// Sample even culled actors so re-entering the camera cannot invent a stride.
export function sampleActorMotion(previous,actor,time,active=true){
  const valid=actor&&Number.isFinite(actor.x)&&Number.isFinite(actor.z)&&Number.isFinite(time);
  const free=valid&&actor.seated!==true&&(!actor.captivity||actor.captivity==='free');
  const sample={x:valid?actor.x:0,z:valid?actor.z:0,time,free,speed:0};
  if(!valid||!active||!free||!previous?.free||!Number.isFinite(previous.time)||time<previous.time)return sample;
  if(time===previous.time){sample.speed=actor.x===previous.x&&actor.z===previous.z?previous.speed:0;return sample;}
  const dt=time-previous.time,distance=Math.hypot(actor.x-previous.x,actor.z-previous.z);
  // Seat/capture changes reset above; a discontinuous relocation is not walking.
  // 3.6 m/s is twice the fastest current movement (1.8), not a new movement cap.
  const speed=distance/dt;
  if(dt>.25||speed>3.6)return sample;
  // A blocked or stopped actor should blend to Idle immediately, not treadmill.
  sample.speed=speed<1e-4?0:THREE.MathUtils.lerp(previous.speed||0,speed,1-Math.exp(-dt*14));
  return sample;
}

// Navigation follows a collision-safe grid, whose corners can change heading
// by 90 degrees in one tick. Turn only the free pupil's visible body through
// that angle; seating, captivity and action alignment remain authoritative.
export function captureBodyYaw(actor,state){
  if(actor?.captivity==='bound'){
    const post=state?.posts?.find(p=>p.id===actor.postId);
    return post?Math.atan2(actor.x-post.x,actor.z-post.z):Math.PI;
  }
  return actor?.captivity==='carried'&&Number.isFinite(state?.teacher?.yaw)?state.teacher.yaw+Math.PI:null;
}
export function captureHeadLook(actor,bodyYaw){
  const yaw=Number.isFinite(actor?.yaw)?Math.atan2(Math.sin(actor.yaw-bodyYaw),Math.cos(actor.yaw-bodyYaw)):null,pitch=actor?.pitch||0;
  // Looking around does not turn a restrained head through the wooden post.
  // Keep camera freedom while the visible neck respects its contact limits.
  return actor?.captivity==='bound'?{yaw:THREE.MathUtils.clamp(yaw??0,-.45,.45),pitch:THREE.MathUtils.clamp(pitch,0,.45)}:{yaw,pitch};
}
export function sampleActorHeading(previous,actor,time,captureYaw=null){
  const yaw=Number.isFinite(actor?.yaw)?actor.yaw:0;
  const bodyLocked=Boolean(actor?.seated||actor?.caught||['carried','bound','stunned'].includes(actor?.captivity));
  if(bodyLocked){
    const lock=actor?.seated?'seated':actor?.captivity||'caught',entered=!previous||time<previous.time||previous.lock!==lock;
    // Enter capture in its authoritative frame. Keeping the old seat heading
    // turned only the head 180 degrees and put the bound hands at the chest.
    const aligned=Number.isFinite(captureYaw)?captureYaw:entered?yaw:previous.yaw;
    return{yaw:actor?.seated&&Number.isFinite(actor.seatYaw)?actor.seatYaw:aligned,time,free:false,lock};
  }
  const free=actor?.seated===false&&(!actor.captivity||actor.captivity==='free')&&actor.mood!=='rescuing'&&!(actor.itemThrowAge>=0&&actor.itemThrowAge<.58)&&!(actor.holding&&THROWABLE_ITEM_KINDS.includes(actor.action));
  const sample={yaw,time,free};
  if(!free||!previous?.free||!Number.isFinite(previous.time)||!Number.isFinite(time)||time<previous.time||time-previous.time>.25)return sample;
  if(time===previous.time){sample.yaw=previous.yaw;return sample;}
  const dt=time-previous.time,delta=Math.atan2(Math.sin(yaw-previous.yaw),Math.cos(yaw-previous.yaw));
  sample.yaw=previous.yaw+THREE.MathUtils.clamp(delta*(1-Math.exp(-dt*16)),-5.5*dt,5.5*dt);
  return sample;
}

// A writing pupil holds the desk's one pen; it must not also remain on the desk.
// Check the whole visible chain because cached actors and off-camera pupils can
// keep their local pencil flag while no longer contributing to the scene.
export function syncDeskPenVisibility(records,deskPens){
  for(const pen of deskPens.values())pen.visible=true;
  for(const record of records){
    const pencil=record.actor?.group.getObjectByName('held-writing-pencil');
    if(!pencil)continue;
    let held=true;for(let node=pencil;node;node=node.parent)if(!node.visible){held=false;break;}
    if(held){const pen=deskPens.get(record.currentSeatId??record.seat.id);if(pen)pen.visible=false;}
  }
}

// Editable classroom geometry with generated surfaces and imported game assets.
export async function createClassroom(canvas, {onReady,active=true,snapEntry=false}={}) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.04;
  renderer.info.autoReset=false;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const staminaVision=createStaminaVision(renderer),soundCues=createSoundCues(canvas.parentElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#d2e7e9');
  scene.fog=new THREE.Fog('#e3edf1',28,55);
  const camera=new THREE.PerspectiveCamera(40,1,.08,70);
  const chalkPowder=createChalkPowder(scene);
  const bubbleEffects=createBubbleEffects(scene,camera,{floorAt:floorHeight});
  const surveillanceView=createSurveillanceView(scene,renderer,{beforeRender(){
    const cameraVisible=camera.visible,teacherVisible=teacher.group.visible;
    // Camera-attached feedback/bubble masks belong only to the local view.
    camera.visible=false;if(gameplay?.role==='teacher'&&gameplay.teacher?.visible!==false)teacher.group.visible=true;
    return()=>{camera.visible=cameraVisible;teacher.group.visible=teacherVisible;};
  }});
  const itemOutline=createItemOutline(renderer),itemRay=new THREE.Raycaster(),itemPointer=new THREE.Vector2(0,0);let hoveredSlot=null,pointerPresent=false;
  const room=new THREE.Group();scene.add(room);
  const dynamic=new THREE.Group();scene.add(dynamic);
  const [deskAsset,studentAsset,surfaceAsset,propAsset,teacherAsset,artworkAsset]=await Promise.allSettled([loadDeskModel(),loadStudentAssets(),loadCampusSurfaces(),loadPropAssets(CLASSROOM_PROP_SOURCES),loadTeacherModel(),loadCampusArtwork()]);
  // Do not silently replace a failed new character with an obsolete generated model.
  if(studentAsset.status==='rejected'||teacherAsset.status==='rejected'){
    soundCues.dispose();staminaVision.dispose();chalkPowder.dispose();surveillanceView.dispose();bubbleEffects.dispose();itemOutline.dispose();renderer.dispose();
    throw new Error('人物模型加载失败',{cause:studentAsset.reason||teacherAsset.reason});
  }
  canvas.dataset.propAssets=JSON.stringify(propAsset.status==='fulfilled'?propAsset.value.loaded:[]);
  if(propAsset.status==='rejected'||propAsset.value.failed.length)console.error('Prop asset failed to load',propAsset.reason||propAsset.value.failed);
  // Build navigation grids during loading, before the first teacher decision.
  walkRoute(BOARD,SEATS[0],.20);walkRoute(BOARD,SEATS[0],.23);
  const importedStudents=studentAsset.value;
  canvas.dataset.studentAsset='tripo-characters-40';
  const importedDesk=deskAsset.status==='fulfilled'?deskAsset.value:null;
  if(!importedDesk)console.error('Desk model failed to load',deskAsset.reason);
  canvas.dataset.deskAsset=importedDesk?.source||'fallback';
  const assets=new Set(), materials=new Set();
  const artwork=artworkAsset.status==='fulfilled'?artworkAsset.value:{};for(const image of Object.values(artwork))assets.add(image);canvas.dataset.campusArtwork=JSON.stringify(Object.keys(artwork));
  const surfaces=surfaceAsset.status==='fulfilled'?surfaceAsset.value:null;
  if(surfaces)for(const map of Object.values(surfaces))assets.add(map);
  else console.error('Generated classroom surfaces failed to load',surfaceAsset.reason);
  canvas.dataset.surfaceAssets=surfaces?'generated-34':'fallback';
  const mat=(color,more={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.82,...more});materials.add(m);return m;};
  const M={wall:mat('#f0efe7'),trim:mat('#6caaa6'),blue:mat('#387487'),wood:mat('#de9c24'),edge:mat('#ac6c25'),steel:mat('#d0d4cc',{metalness:.22,roughness:.38}),dark:mat('#444f54'),paper:mat('#fff8e5'),red:mat('#ca6a55'),green:mat('#7b9f75'),bookBlue:mat('#7b9ebc'),yellow:mat('#e9c861'),leaf:mat('#69ad3e',{emissive:'#86b934',emissiveIntensity:.12}),soil:mat('#544334'),pot:mat('#c77757'),curtain:mat('#b9dce0',{side:THREE.DoubleSide}),white:mat('#f5f2e7'),black:mat('#303d3b')};
  const boxGeo=new THREE.BoxGeometry(1,1,1), sphereGeo=new THREE.SphereGeometry(1,14,10), cylGeo=new THREE.CylinderGeometry(1,1,1,12);assets.add(boxGeo);assets.add(sphereGeo);assets.add(cylGeo);
  function mesh(g,m,p,s=[1,1,1],r=null,parent=room){const o=new THREE.Mesh(g,m);o.position.set(...p);o.scale.set(...s);if(r)o.rotation.set(...r);o.castShadow=!(m.transparent&&m.opacity<.8);o.receiveShadow=true;parent.add(o);return o;}
  const box=(m,p,s,r=null,parent=room)=>mesh(boxGeo,m,p,s,r,parent);
  const ball=(m,p,s,parent=room)=>mesh(sphereGeo,m,p,s,null,parent);
  const cylinder=(m,p,s,r=null,parent=room)=>mesh(cylGeo,m,p,s,r,parent);
  function texture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;assets.add(t);return t;}
  function boardTexture(){return texture(1600,800,(c,w,h)=>{
    c.fillStyle='#275b50';c.fillRect(0,0,w,h);let seed=20;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    for(let i=0;i<9000;i++){c.fillStyle=`rgba(216,234,211,${rand()*.05})`;c.fillRect(rand()*w,rand()*h,rand()*22,rand()*3);}
    c.fillStyle='#e7ebd8';c.font='38px "PingFang SC","Microsoft YaHei",sans-serif';c.fillText('数学',100,90);
    c.font='italic 58px Georgia,serif';c.fillText('y = ax² + bx + c',110,225);
    c.font='italic 45px Georgia,serif';c.fillText('a² + b² = c²',110,330);c.fillText('(a + b)² = a² + 2ab + b²',110,440);
    c.font='32px "PingFang SC","Microsoft YaHei",sans-serif';c.fillText('练习 3 · P.48',110,630);
    c.strokeStyle='#dbe3d0';c.lineWidth=4;c.beginPath();c.moveTo(970,480);c.lineTo(1340,480);c.lineTo(1340,205);c.closePath();c.stroke();c.beginPath();c.moveTo(1312,480);c.lineTo(1312,452);c.lineTo(1340,452);c.stroke();
    c.font='italic 35px Georgia,serif';c.fillText('a',1140,525);c.fillText('b',1370,360);c.fillText('c',1110,315);
    c.strokeStyle='#e6dba7';c.lineWidth=3;c.beginPath();c.moveTo(930,700);c.lineTo(1440,700);c.moveTo(1180,750);c.lineTo(1180,565);c.stroke();c.beginPath();c.moveTo(990,585);c.quadraticCurveTo(1180,810,1370,585);c.stroke();

  });}
  // Rounded edges catch narrow highlights, as on everyday laminated school furniture.
  const roundedCache=new Map();
  function roundedGeometry(w,h,d,r=.015){const key=[w,h,d,r].join(',');if(roundedCache.has(key))return roundedCache.get(key);r=Math.min(r,h*.24,w*.24,d*.24);const a=w-2*r,b=h-2*r,q=Math.min(r,b*.35),x=-a/2,y=-b/2,shape=new THREE.Shape();shape.moveTo(x+q,y);shape.lineTo(x+a-q,y);shape.quadraticCurveTo(x+a,y,x+a,y+q);shape.lineTo(x+a,y+b-q);shape.quadraticCurveTo(x+a,y+b,x+a-q,y+b);shape.lineTo(x+q,y+b);shape.quadraticCurveTo(x,y+b,x,y+b-q);shape.lineTo(x,y+q);shape.quadraticCurveTo(x,y,x+q,y);const g=new THREE.ExtrudeGeometry(shape,{depth:d-2*r,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:3,steps:1,curveSegments:4});g.translate(0,0,-(d-2*r)/2);assets.add(g);roundedCache.set(key,g);return g;}
  function rounded(m,p,s,r=.015,rotation=null,parent=room){return mesh(roundedGeometry(...s,r),m,p,[1,1,1],rotation,parent);}
  const pipeCache=new Map();
  function pipe(m,points,radius=.022,parent=room){const key=radius+'|'+JSON.stringify(points);let g=pipeCache.get(key);if(!g){g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal'),Math.max(10,points.length*4),radius,6,false);pipeCache.set(key,g);assets.add(g);}return mesh(g,m,[0,0,0],[1,1,1],null,parent);}
  const grain=texture(1024,512,(c,w,h)=>{c.fillStyle='#efa323';c.fillRect(0,0,w,h);let seed=71;const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647;};for(let i=0;i<650;i++){const yy=rand()*h;c.strokeStyle=`rgba(${rand()>.45?'129,74,22':'255,217,132'},${.035+rand()*.10})`;c.lineWidth=.3+rand()*1.5;c.beginPath();c.moveTo(0,yy);c.bezierCurveTo(w*.3,yy+Math.sin(i)*7,w*.7,yy-Math.sin(i)*6,w,yy+Math.cos(i)*4);c.stroke();}for(let i=0;i<3;i++){const x=rand()*w,y=rand()*h;for(let j=0;j<5;j++){c.strokeStyle='rgba(145,83,25,.06)';c.lineWidth=1;c.beginPath();c.ellipse(x,y,20+j*11,2+j*2,0,0,Math.PI*2);c.stroke();}}});
  grain.wrapS=grain.wrapT=THREE.RepeatWrapping;M.wood.color.set('#ffffff');M.wood.map=grain;M.wood.roughness=.43;M.wood.needsUpdate=true;M.edge.color.set('#c77e24');
  const pageTexture=texture(256,128,(c,w,h)=>{c.fillStyle='#eee9d8';c.fillRect(0,0,w,h);for(let y=2;y<h;y+=4){c.strokeStyle=y%8?'#d4d0c1':'#c7c4b8';c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}});
  const pageMat=mat('#ffffff',{map:pageTexture,roughness:.93});
  const coverTexture=texture(512,640,(c,w,h)=>{
    c.fillStyle='#e8e3d6';c.fillRect(0,0,w,h);c.fillStyle='#b02c2b';c.fillRect(0,0,22,h);c.fillRect(22,0,w-22,206);c.fillRect(22,590,w-22,50);
    c.fillStyle='#f5e9d4';c.font='bold 39px "Songti SC","SimSun",serif';c.fillText('数学',61,100);c.font='16px "PingFang SC",sans-serif';c.fillText('MATHEMATICS',63,144);
    c.fillStyle='#4d514b';c.font='18px "Songti SC",serif';c.fillText('义务教育教科书',58,248);c.font='30px "Songti SC",serif';c.fillText('七年级  上册',58,294);
    c.strokeStyle='#929a8c';c.lineWidth=2;for(let i=0;i<8;i++){c.beginPath();c.moveTo(60,360+i*23);c.lineTo(455,360+i*23);c.stroke();}for(let i=0;i<10;i++){c.beginPath();c.moveTo(60+i*43,350);c.lineTo(60+i*43,545);c.stroke();}
    c.strokeStyle='#697c78';c.lineWidth=5;c.beginPath();c.moveTo(90,520);c.lineTo(360,355);c.lineTo(360,520);c.closePath();c.stroke();
  });
  const coverMat=mat('#ffffff',{map:coverTexture,roughness:.81});
  function exercisePrint(right=false){return texture(512,640,(c,w,h)=>{
    c.fillStyle='#faf8ef';c.fillRect(0,0,w,h);c.fillStyle='#252b2a';
    c.font='bold 26px "PingFang SC","Microsoft YaHei",sans-serif';c.fillText(right?'随堂练习  03':'数学  ·  课堂笔记',30,46);
    c.fillRect(30,61,452,3);c.font='17px "PingFang SC","Microsoft YaHei",sans-serif';c.fillText('班级 ______  姓名 ______  日期 ______',30,91);
    const paragraph=(x,y,width,rows)=>{const lines=['观察图形，并根据条件完成下列问题。','已知两个角相等，求另一条边的长度。','请在横线上填写答案，并说明你的理由。','结合本节所学知识，写出计算的过程。','画出辅助线，标出图中对应的角和边。'];c.font='11px "Songti SC","SimSun",serif';c.fillStyle='#575951';for(let row=0;row<rows;row++)c.fillText(lines[(row+(right?2:0))%lines.length].slice(0,Math.floor(width/11)),x,y+row*15);};
    c.fillStyle='#252b2a';c.font='bold 20px "PingFang SC",sans-serif';c.fillText(right?'一、选择与填空':'一、观察与思考',30,129);
    paragraph(30,148,450,8);
    c.fillStyle='#343b39';c.font='italic 24px Georgia,serif';c.fillText('a² + b² = c²',50,303);c.fillText('y = ax² + bx + c',50,341);
    paragraph(30,367,260,10);
    if(right){
      c.fillStyle='#202523';c.fillRect(310,365,172,205);
      c.strokeStyle='#f2f1e8';c.lineWidth=3;c.beginPath();c.moveTo(334,535);c.lineTo(458,535);c.lineTo(458,402);c.closePath();c.stroke();
      c.font='italic 22px Georgia,serif';c.fillStyle='#f5f2e8';c.fillText('a',383,558);c.fillText('b',463,474);c.fillText('c',375,459);
    }else{
      c.fillStyle='#b0b3a8';c.fillRect(310,365,172,150);c.fillStyle='#727d73';
      for(let i=0;i<7;i++)c.fillRect(321+i*22,394+(i%3)*15,13,110-(i%3)*15);
      c.fillStyle='#4b554d';c.fillRect(310,492,172,23);paragraph(310,534,170,3);
    }
    c.strokeStyle='#707771';c.lineWidth=2;c.strokeRect(30,579,452,29);c.font='16px "PingFang SC",sans-serif';c.fillStyle='#434b45';c.fillText('认真观察  ·  写出你的解题过程',43,600);
    c.font='15px Georgia,serif';c.textAlign='center';c.fillText(right?'48':'47',256,629);
  });}
  const printMat=mat('#ffffff',{map:exercisePrint(false),roughness:.94}),printRightMat=mat('#ffffff',{map:exercisePrint(true),roughness:.94});
  // Terrazzo is a warm cement field with sparse irregular aggregates, not white confetti.
  const floorTexture=surfaces?.floor||texture(1024,1024,(c,w,h)=>{
    let seed=123;const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
    const pixels=c.createImageData(w,h);
    for(let i=0;i<pixels.data.length;i+=4){const v=(rand()-.5)*7;pixels.data[i]=182+v;pixels.data[i+1]=184+v;pixels.data[i+2]=176+v;pixels.data[i+3]=255;}
    c.putImageData(pixels,0,0);
    const colors=['#ddded5','#cbd0c7','#939a90','#727b73','#b8b3a2','#eeeee5'];
    for(let i=0;i<4000;i++){
      const x=rand()*w,y=rand()*h,r=(i<2200?.6+rand()*2.2:3+rand()*8),n=4+Math.floor(rand()*3),col=colors[Math.floor(rand()*colors.length)];
      c.fillStyle=col;c.beginPath();for(let j=0;j<n;j++){const a=j/n*Math.PI*2,rr=r*(.65+rand()*.35);const xx=x+Math.cos(a)*rr,yy=y+Math.sin(a)*rr*.75;j?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.closePath();c.fill();
    }
    // Grout belongs to the surface texture, including the elevated terrace treads.
    c.strokeStyle='#858c83';c.lineWidth=1.4;for(const q of [0,512,1024]){c.beginPath();c.moveTo(q,0);c.lineTo(q,h);c.moveTo(0,q);c.lineTo(w,q);c.stroke();}
  });
  floorTexture.wrapS=floorTexture.wrapT=surfaces?THREE.MirroredRepeatWrapping:THREE.RepeatWrapping;floorTexture.repeat.set(surfaces?2:1,surfaces?2:1);
  const floorBump=surfaceHeight(floorTexture,assets,surfaces?2:1,surfaces?2:1);
  const floorMat=mat(surfaces?'#e3e5de':'#ffffff',{map:floorTexture,bumpMap:floorBump,bumpScale:surfaces?.0009:.004,roughness:.88,roughnessMap:surfaces?floorBump:null});
  if(surfaces)addTerrazzoGrout(floorMat);
  const contactTexture=texture(128,128,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,5,w/2,h/2,w/2);g.addColorStop(0,'rgba(49,54,48,.48)');g.addColorStop(.45,'rgba(49,54,48,.24)');g.addColorStop(1,'rgba(49,54,48,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
  const contactMat=new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,opacity:.62});materials.add(contactMat);
  function contact(x,z,w=1.7,d=1.2,parent=room){const g=new THREE.PlaneGeometry(w,d);assets.add(g);const o=mesh(g,contactMat,[x,.004,z],[1,1,1],[-Math.PI/2,0,0],parent);o.castShadow=false;}

  const campus=buildReferenceCampus({room,scene,M,mat,box,rounded,cylinder,mesh,texture,assets,materials,floorMat,surfaces,artwork,bakeStatic});
  const {enclosure:teachingEnd,ceilingMaterial,curtains,setNight:setCampusNight}=campus;
  // A physical wall button, selected through the same centre ray as desks.
  const startBellModel=new THREE.Group();startBellModel.name='school-start-bell';teachingEnd.add(startBellModel);startBellModel.position.set(START_BELL_POSITION.x-6.02,0,START_BELL_POSITION.z-2.60);
  rounded(M.white,[6.02,1.52,2.60],[.05,.64,.57],.015,null,startBellModel);
  cylinder(M.dark,[6.055,1.52,2.60],[.245,.065,.245],[0,0,Math.PI/2],startBellModel);
  const startBellCap=cylinder(mat('#ef5d4d',{roughness:.38}),[6.10,1.52,2.60],[.212,.045,.212],[0,0,Math.PI/2],startBellModel);
  const bellLabel=texture(640,480,(c,w,h)=>{
    c.fillStyle='#252b29';c.font='bold 95px "Kaiti SC","STKaiti",sans-serif';c.textAlign='center';c.textBaseline='middle';c.save();c.translate(320,125);c.rotate(-.055);c.fillText('上课啦!',0,0);c.restore();
    c.strokeStyle='#252b29';c.lineWidth=17;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(480,220);c.bezierCurveTo(457,290,393,333,302,350);c.lineTo(346,299);c.moveTo(302,350);c.lineTo(375,372);c.stroke();
  });
  const bellLabelGeo=new THREE.PlaneGeometry(.76,.57);assets.add(bellLabelGeo);
  mesh(bellLabelGeo,mat('#ffffff',{map:bellLabel,transparent:true,depthWrite:false}),[6.035,2.17,2.60],[1,1,1],[0,Math.PI/2,0],startBellModel);
  const curtainRests=curtains.map(c=>({x:c.position.x,z:c.rotation.z}));
  // Honey-yellow laminate desks on grey tubular steel legs.
  function book(parent,x,y,z,color,angle=0){const b=new THREE.Group();b.position.set(x,y,z);b.rotation.y=angle;parent.add(b);rounded(color,[0,.002,0],[.35,.004,.26],.002,null,b);box(pageMat,[.004,.009,.001],[.335,.010,.249],null,b);rounded(color,[0,.016,0],[.35,.003,.26],.001,null,b);box(M.paper,[.015,.018,0],[.21,.001,.025],null,b);return b;}
  function openBook(parent,x,y,z,angle=0,standing=false){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=angle+Math.PI;parent.add(g);for(const side of [-1,1]){const pg=new THREE.Group();pg.position.x=side*.008;pg.rotation.z=side*.025;g.add(pg);rounded(M.bookBlue,[side*.155,.002,0],[.31,.004,.42],.001,null,pg);box(pageMat,[side*.155,.007,0],[.30,.006,.40],null,pg);const face=new THREE.PlaneGeometry(.29,.39);assets.add(face);mesh(face,side<0?printMat:printRightMat,[side*.155,.011,0],[1,1,1],[-Math.PI/2,0,0],pg);}return g;}
  const deskBooks=new Map(),deskPens=new Map(),drawerRecords=new Map(),deskTargets=new Map();
  const coveredSeats=new Set(COVERED_SEATS);
  const uprightPageGeometry=new THREE.PlaneGeometry(.32,.43);assets.add(uprightPageGeometry);
  function uprightBook(parent){
    const book=new THREE.Group();book.position.set(0,.88,.12);parent.add(book);
    for(const side of [-1,1]){
      const leaf=new THREE.Group();leaf.rotation.y=side*.14;book.add(leaf);
      rounded(M.paper,[side*.1675,.225,0],[.335,.45,.008],.002,null,leaf);
      mesh(uprightPageGeometry,side<0?printMat:printRightMat,[side*.1675,.225,-.005],[1,1,1],[0,Math.PI,0],leaf);
      mesh(uprightPageGeometry,coverMat,[side*.1675,.225,.005],[1,1,1],null,leaf);
    }
    return book;
  }
  function pen(parent,x,y,z,color,rotation=0){const g=createDeskItem('pen');g.position.set(x,y,z);g.rotation.set(Math.PI/2,rotation,0);parent.add(g);g.traverse(o=>{if(o.isMesh)o.userData.animated=true;});return g;}
  const deskTray=mat('#d2d6cc',{metalness:.12,roughness:.52}),drawerFront=mat('#e6e7d9',{metalness:.06,roughness:.48});
  // Clone and tune the imported material once; every desk keeps its UV atlas and batching.
  if(importedDesk&&!importedDesk.source?.startsWith('tripo')){const woodMaterials=new Map();importedDesk.body.traverse(o=>{
    if(!o.isMesh||!/wood|top|table/i.test(o.material?.name||''))return;
    const original=o.material;let laminate=woodMaterials.get(original);
    if(!laminate){laminate=original.clone();laminate.color.setRGB(3.85,2.55,.86);laminate.roughness=.34;laminate.normalScale?.set(.45,.45);woodMaterials.set(original,laminate);materials.add(laminate);}
    o.material=laminate;
  });}
  function desk(x,z,seed=0,rot=0,hero=false,parent=room){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;parent.add(g);contact(0,0,1.55,1.4,g);
    if(importedDesk){const body=importedDesk.body.clone(true);g.add(body);const target=new THREE.Group();target.position.set(x,0,z);target.rotation.y=rot;target.add(body.clone(true));target.updateMatrixWorld(true);deskTargets.set(seed,target);}else{
    rounded(M.edge,[0,.842,0],[1.19,.038,.78],.012,null,g);rounded(M.wood,[0,.866,0],[1.20,.010,.79],.003,null,g);
    // Tubular side frames bend around the lower stretchers and upper desk rail.
    for(const a of [-.49,.49]){pipe(M.steel,[[a,.035,-.29],[a,.12,-.29],[a,.74,-.27],[a,.817,-.23],[a,.817,.23],[a,.74,.27],[a,.12,.29],[a,.035,.29]],.025,g);pipe(M.steel,[[a,.24,-.28],[a,.22,-.19],[a,.22,.19],[a,.24,.28]],.019,g);for(const b of [-.29,.29])rounded(M.dark,[a,.035,b],[.067,.055,.073],.008,null,g);}
    pipe(M.steel,[[-.49,.27,-.27],[-.42,.24,-.27],[.42,.24,-.27],[.49,.27,-.27]],.018,g);
    }
    // The official desk is a sliding metal drawer, with a closed cream front.
    const drawer=new THREE.Group();drawer.position.set(x,0,z);drawer.rotation.y=rot;dynamic.add(drawer);
    if(importedDesk)drawer.add(importedDesk.drawer.clone(true));else{
    rounded(deskTray,[0,.644,-.08],[.96,.012,.65],.003,null,drawer);
    for(const side of [-1,1])rounded(deskTray,[side*.474,.733,-.08],[.012,.174,.65],.003,null,drawer);
    rounded(deskTray,[0,.733,.239],[.96,.174,.012],.003,null,drawer);
    rounded(drawerFront,[0,.733,-.405],[.99,.18,.024],.006,null,drawer);
    pipe(M.black,[[-.13,.756,-.427],[-.13,.714,-.453],[.13,.714,-.453],[.13,.756,-.427]],.012,drawer);
    }
    drawerRecords.set(seed,{group:drawer,x,z,yaw:rot,open:0});
    if(!importedDesk)for(const a of [-.47,.47])for(const b of [-.23,.23]){box(M.steel,[a,.814,b],[.09,.026,.10],null,g);cylinder(M.dark,[a,.832,b],[.009,.012,.009],null,g);}
    if(seed%4===0)book(drawer,-.27,(importedDesk?.drawerFloor??.65)+.002,-.035,M.red,.06);
    // Exactly one foldable book and one pen on every student desktop.
    const cover=uprightBook(dynamic);cover.name='desk-book-'+seed;cover.position.set(x,.88,z-.28);cover.rotation.set(coveredSeats.has(seed)?0:Math.PI/2,rot,0,'YXZ');deskBooks.set(seed,cover);
    const writingPen=pen(g,seed%2?-.39:.43,.888,.12,M.red,seed%2?.18:-.28);writingPen.name='desk-pen-'+seed;deskPens.set(seed,writingPen);
    return g;
  }
  const chairPanel=new THREE.BufferGeometry(),cp=[],ci=[];for(let side=0;side<2;side++)for(let row=0;row<2;row++)for(let i=0;i<=16;i++){const x=-.28+i*.035;cp.push(x,.76+row*.28,-.22+.052*(1-(x/.28)**2)+(side?-.018:.018));}const addQuad=(a,b,c,d)=>ci.push(a,b,d,b,c,d);for(let i=0;i<16;i++){addQuad(i,i+1,18+i,17+i);addQuad(34+i,51+i,52+i,35+i);addQuad(i,34+i,35+i,i+1);addQuad(17+i,18+i,52+i,51+i);}addQuad(0,17,51,34);addQuad(16,50,67,33);chairPanel.setAttribute('position',new THREE.Float32BufferAttribute(cp,3));chairPanel.setIndex(ci);chairPanel.computeVertexNormals();assets.add(chairPanel);
  function chair(x,z,rot=0,parent=room){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;parent.add(g);contact(0,0,.80,.9,g);if(importedDesk?.chair){g.add(importedDesk.chair.clone(true));return g;}rounded(M.wood,[0,.4125,0],[.56,.055,.51],.020,null,g);for(const a of [-.23,.23]){pipe(M.steel,[[a,.03,.19],[a,.12,.19],[a,.41,.17],[a,.49,.12],[a,.49,-.13],[a,.41,-.19],[a,.03,-.22]],.023,g);pipe(M.steel,[[a,.42,-.17],[a,.52,-.21],[a,1.00,-.23]],.021,g);for(const b of [-.22,.19])rounded(M.dark,[a,.022,b],[.058,.043,.063],.008,null,g);}mesh(chairPanel,M.wood,[0,0,0],[1,1,1],null,g);for(const x of [-.22,.22])cylinder(M.steel,[x,.91,-.164],[.014,.008,.014],[Math.PI/2,0,0],g);pipe(M.steel,[[-.23,.23,-.21],[0,.23,-.21],[.23,.23,-.21]],.017,g);return g;}
  // Every playable seat uses the exact collision-layout coordinates.
  const seatFurniture=new Map(),furnitureRows=new Map(),chairTargets=new Map();
  let currentSeats=SEATS,layoutSignature='',renderLayout=createLayoutContext(currentSeats);
  for(const seat of SEATS){
    const group=new THREE.Group();group.name='seat-furniture-'+seat.id;scene.add(group);furnitureRows.set(seat.id,group);
    const body=desk(0,0,seat.id,0,false,group),seatChair=chair(0,-.78,0,group);seatFurniture.set(seat.id,{group,body,chair:seatChair});chairTargets.set(seat.id,seatChair);
    if(!deskTargets.has(seat.id)){const target=body.clone(true);deskTargets.set(seat.id,target);}
  }
  const fans=[];
  const lampMat=mat('#fffdf2',{emissive:'#fff9e8',emissiveIntensity:.85});
  const fixtureMetal=mat('#698b92',{metalness:.35,roughness:.38}),fixtureInside=mat('#d9dfdc',{metalness:.12,roughness:.42});
  for(const z of [-4.7,-.4,3.2])for(const x of [-3,2.5]){
    for(const dx of [-.58,.58]){cylinder(fixtureMetal,[x+dx,4.37,z],[.008,.34,.008],null,campus.ceilingRig);rounded(fixtureInside,[x+dx,4.53,z],[.10,.035,.08],.004,null,campus.ceilingRig);}
    rounded(fixtureMetal,[x,4.18,z],[1.56,.045,.26],.009,null,campus.ceilingRig);
    for(const dz of [-.14,.14])box(fixtureMetal,[x,4.15,z+dz],[1.56,.06,.018],null,campus.ceilingRig);
    box(fixtureInside,[x,4.149,z],[1.48,.014,.245],null,campus.ceilingRig);
    for(const dz of [-.067,.067])cylinder(lampMat,[x,4.122,z+dz],[.014,1.39,.014],[0,0,Math.PI/2],campus.ceilingRig);
    for(const dx of [-.72,.72])box(fixtureInside,[x+dx,4.125,z],[.035,.048,.24],null,campus.ceilingRig);
  }
  for(const z of [-2.5,1.6]){
    rounded(M.white,[.05,4.51,z],[.90,.055,.90],.012,null,campus.ceilingRig);
    box(M.dark,[.05,4.469,z],[.73,.012,.73],null,campus.ceilingRig);
    for(let i=0;i<10;i++)box(M.white,[.05,4.457,z-.34+i*.075],[.76,.014,.033],null,campus.ceilingRig);
  }
  // Near pupils are articulated. Shared instanced poses keep all thirty seats responsive.
  const pupilRecords=SEATS.map(seat=>{
    const group=new THREE.Group();group.name='student-seat-'+seat.id;group.position.set(seat.x,0,seat.z);dynamic.add(group);
    const variant=seat.id===PLAYER_SEAT?'boy':STUDENT_VARIANTS[seat.id%STUDENT_VARIANTS.length];
    return{seat,group,variant,glasses:variant==='glasses',seed:seat.id===PLAYER_SEAT?4:3+(seat.id*7+Math.floor(seat.id/6))%6,menuMood:seat.id===27?'snack':seat.id===26?'chat':'writing',actors:new Map(),actor:null,lastUpdate:-Infinity,lastMood:'',caught:false};
  });
  const pupilMatrix=new THREE.Matrix4(),poseRotation=new THREE.Quaternion(),poseEuler=new THREE.Euler();
  const hiddenScale=new THREE.Vector3(0,0,0),unitScale=new THREE.Vector3(1,1,1),posePosition=new THREE.Vector3();
  function rememberActor(actor){actor.group.traverse(o=>{if(o.geometry)assets.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});return actor;}
  function actorFor(record,standing){
    const key=record.previewRole==='teacher'?'teacher':record.variant;let actor=record.actors.get(key);
    if(!actor){actor=rememberActor(key==='teacher'?teacherLobbyActor(teacherAsset.value.createClone()):importedStudents.createStudent({variant:record.variant,glasses:record.glasses,seated:!standing,seed:record.seed}));actor.group.visible=false;actor.group.traverse(o=>{if(o.isMesh){o.castShadow=o.geometry.attributes.position.count>1600;o.receiveShadow=!o.userData.characterSurface;}});record.group.add(actor.group);record.actors.set(key,actor);}
    const isNight=mapKind(mapVariant)==='night';if(actor.nightLighting!==isNight){setCharacterNight(actor.group,isNight);actor.nightLighting=isNight;}
    return actor;
  }
  function materialParts(object){
    const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
    if(!Array.isArray(object.material))return[{material:object.material,geometry}];
    const groups=geometry.groups.length?geometry.groups:[{start:0,count:geometry.attributes.position.count,materialIndex:0}],parts=[];
    for(const group of groups){const material=object.material[group.materialIndex];if(!material)continue;const part=new THREE.BufferGeometry();
      for(const [name,attribute]of Object.entries(geometry.attributes)){const array=new Float32Array(group.count*attribute.itemSize);for(let i=0;i<group.count;i++)for(let c=0;c<attribute.itemSize;c++)array[i*attribute.itemSize+c]=attribute[['getX','getY','getZ','getW'][c]](group.start+i);part.setAttribute(name,new THREE.BufferAttribute(array,attribute.itemSize));}
      parts.push({material,geometry:part});
    }
    geometry.dispose();return parts;
  }
  function mergeParts(parts){
    const count=parts.reduce((n,g)=>n+g.attributes.position.count,0),geometry=new THREE.BufferGeometry();
    for(const name of ['position','normal','uv','color']){
      const size=name==='uv'?2:name==='color'?Math.max(3,...parts.map(p=>p.attributes.color?.itemSize||3)):3,array=new Float32Array(count*size);if(name==='color')array.fill(1);let offset=0;
      for(const part of parts){const attribute=part.attributes[name];if(attribute){
        if(!attribute.normalized&&!attribute.isInterleavedBufferAttribute&&attribute.itemSize===size)array.set(attribute.array,offset);
        else for(let i=0;i<attribute.count;i++)for(let c=0;c<Math.min(size,attribute.itemSize);c++)array[offset+i*size+c]=attribute[['getX','getY','getZ','getW'][c]](i);
      }offset+=part.attributes.position.count*size;}
      geometry.setAttribute(name,new THREE.BufferAttribute(array,size));
    }
    assets.add(geometry);return geometry;
  }
  const pageFlipGeometry=new THREE.PlaneGeometry(.32,.43);pageFlipGeometry.translate(.1675,.225,-.008);assets.add(pageFlipGeometry);
  const pageFlipMaterial=printRightMat.clone();pageFlipMaterial.side=THREE.DoubleSide;materials.add(pageFlipMaterial);
  const pageFlips=new THREE.InstancedMesh(pageFlipGeometry,pageFlipMaterial,SEATS.length);pageFlips.castShadow=false;pageFlips.receiveShadow=true;pageFlips.frustumCulled=false;pageFlips.instanceMatrix.setUsage(THREE.DynamicDrawUsage);dynamic.add(pageFlips);
  // The windows admit directional sunlight; broad fill only keeps the shaded faces readable.
  const ambient=new THREE.HemisphereLight(ROOM_LIGHTING.day.sky,ROOM_LIGHTING.day.ground,ROOM_LIGHTING.day.ambient);scene.add(ambient);
  const sun=new THREE.DirectionalLight('#fff2d7',4.2);sun.position.set(-17,7.4,7);sun.target.position.set(0,.65,-2);scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-19,right:19,top:16,bottom:-16,near:1,far:65});sun.shadow.bias=-.00015;sun.shadow.normalBias=.012;sun.shadow.radius=3.0;sun.shadow.intensity=.9;
  const fill=new THREE.DirectionalLight('#f4edda',ROOM_LIGHTING.day.fill);fill.position.set(5,4,6);scene.add(fill);
  canvas.dataset.lighting='bright-interior-58';
  // No flat additive rectangles: window mullions now create real sun/shadow shapes.
  // Batch fixed props by material. Animated pupils, curtain cloth and fans stay separate.
  function bakeStatic(group){
    group.updateMatrixWorld(true);const local=new THREE.Matrix4().copy(group.matrixWorld).invert(),buckets=new Map(),originals=[];
    group.traverse(o=>{if(!o.isMesh||o.userData.animated)return;const transform=new THREE.Matrix4().multiplyMatrices(local,o.matrixWorld);for(const {material,geometry}of materialParts(o)){geometry.applyMatrix4(transform);const key=material.uuid+'_'+o.castShadow;let bucket=buckets.get(key);if(!bucket){bucket={material,cast:o.castShadow,parts:[]};buckets.set(key,bucket);}bucket.parts.push(geometry);}originals.push(o);});
    for(const object of originals)object.removeFromParent();for(const bucket of buckets.values()){const geometry=mergeParts(bucket.parts),object=new THREE.Mesh(geometry,bucket.material);object.castShadow=bucket.cast;object.receiveShadow=true;group.add(object);bucket.parts.forEach(g=>g.dispose());}
  }
  campus.liftPanel.traverse(o=>{if(o.isMesh)o.userData.animated=true;});
  // Preserve the physical bell's own meshes for picking and its pressed pose.
  startBellModel.traverse(o=>{if(o.isMesh)o.userData.animated=true;});
  bakeStatic(room);bakeStatic(teachingEnd);for(const facade of campus.facades||[])bakeStatic(facade);bakeStatic(campus.tiered);for(const furniture of seatFurniture.values()){bakeStatic(furniture.body);bakeStatic(furniture.chair);}
  const screenContent=createComputerScreenContent();
  const variants=createRoomVariants({scene,box,rounded,mat,texture,bakeStatic,screenContent,officeScreens:campus.officeScreens});let mapVariant='classroom';
  for(const drawer of drawerRecords.values())bakeStatic(drawer.group);
  for(const book of deskBooks.values())bakeStatic(book);
  const rigidProps=instanceRigidProps([...drawerRecords.values()].map(d=>d.group).concat([...deskBooks.values(),...deskPens.values()]),scene);
  canvas.dataset.deskSurface=JSON.stringify({seats:SEATS.length,books:deskBooks.size,pens:deskPens.size,extraDesktopProps:0});
  // Add the inventory after baking: each slot reuses its three real prop models.
  const drawerItems=new THREE.Group();drawerItems.name='player-drawer-items';drawerItems.visible=false;
  const drawerSlotProps=Array.from({length:3},(_,index)=>{
    const slot=new THREE.Group();slot.name='drawer-slot-'+index;slot.position.set((index-1)*.28,.680,-.16);drawerItems.add(slot);
    const props=new Map(DESK_ITEM_KINDS.map(action=>{
      const prop=createDeskItem(action);prop.rotation.set(action==='burger'?0:-Math.PI/2,0,(index===1?.04:index===0?-.07:.08)+(prop.userData.propAsset&&action!=='burger'?Math.PI:0));restDeskItem(prop,(importedDesk?.drawerFloor??.65)-slot.position.y);prop.visible=false;slot.add(prop);
      prop.traverse(o=>{if(o.geometry)assets.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
      return[action,prop];
    }));return{group:slot,props,pickTargets:[...props.values()].map(prop=>createDrawerPickTarget(prop,index))};
  });
  drawerRecords.get(PLAYER_SEAT).group.add(drawerItems);
  let drawerItemSignature='',raisedSlot=null,drawerFocus=0;
  bakeStatic(teachingEnd);
  bakeStatic(campus.ceilingRig);bakeStatic(campus.upperWalls);campus.attachUpperArchitecture();
  // Light from the seated side illuminates faces and chalk without washing the floor.
  const teachingFill=new THREE.DirectionalLight('#e7eff3',ROOM_LIGHTING.day.teaching);
  teachingFill.position.set(0,3.0,-3.0);teachingFill.target.position.set(0,2.25,5.3);
  teachingEnd.add(teachingFill,teachingFill.target);
  const teacher=rememberActor(teacherAsset.value);canvas.dataset.teacherAsset=teacher.group.userData.asset||'teacher-v2';
  teacher.group.position.set(BOARD.x,0,BOARD.z);teacher.group.visible=false;dynamic.add(teacher.group);
  let rolePortraits=null;
  function getRolePreviews(){
    if(!rolePortraits){
      const student=rememberActor(importedStudents.createStudent({variant:'boy',seated:false,seed:4}));student.setMood('resting');student.setMotion({seated:false,speed:0,carrying:false});student.update(0,0);
      rolePortraits=createRolePortraits({student,teacher:rememberActor(teacher.createClone())});
    }
    return rolePortraits.previews(renderer);
  }
  const itemEffects50=createItemEffects50(scene,{floorAt:floorHeight,getActor:id=>id===-1?teacher:pupilRecords[id]?.actor});
  const hands=createDeskHands({createHand:importedStudents?.createHand});hands.group.visible=false;scene.add(camera);
  // The teacher uses its own original skin, forearms and skeleton.
  const teacherHands=createDeskHands({createHand:importedStudents?.createTeacherHand});teacherHands.group.visible=false;
  const firstPersonView=createFirstPersonView(renderer,camera,[hands.group,teacherHands.group]);
  const customHandAnimation=createHandAnimationRuntime({fallbackDocument:PUBLISHED_HAND_ANIMATIONS});
  let firstPersonMotion=null,eyeHeight=null,firstPersonDrawer=null;
  const rightPalm=teacherHands.group.getObjectByName('right-desk-hand');
  const fpChalk=cylinder(M.paper,[.035,.075,-.025],[.007,.073,.007],[0,0,.8],rightPalm);
  const leftPalm=teacherHands.group.getObjectByName('left-desk-hand');
  const fpTorch=new THREE.Group();leftPalm.add(fpTorch);
  cylinder(M.dark,[0,0,0],[.027,.13,.027],null,fpTorch);cylinder(M.steel,[0,.077,0],[.038,.034,.038],null,fpTorch);cylinder(M.paper,[0,.096,0],[.03,.005,.03],null,fpTorch);
  const chalkModels=[];
  function updateTeacherTools(state,dt){
    const isTeacher=(state?.stage==='gathering'?state.lobbyRole||state.role:state?.role)==='teacher';teacherHands.group.visible=isTeacher;hands.group.visible=Boolean(state&&!isTeacher&&state.player.captivity!=='bound');
    if(state&&!isTeacher&&state.player.captivity==='carried'){for(const [side,x]of [['left',-.22],['right',.22]]){const hand=hands.getHand(side),sign=x<0?-1:1,phase=state.elapsed*4+sign*1.8,wave=Math.sin(phase),pull=.5+.5*Math.sin(phase-.6);hand.group.position.set(x+sign*pull*.025,-.25+wave*.035,-.42+pull*.018);hand.group.rotation.set(-.48+pull*.20,sign*(.20+wave*.25),sign*(.08+pull*.17));hand.setCurl(.51+.15*pull);hand.opposeThumb(.58+.1*pull);}}
    if(isTeacher){
      const stunned=state.player.stunLeft>0||state.player.captivity==='stunned';
      teacherHands.update(gameTime,{animationPose:customHandAnimation.sample({role:'teacher',freeLook:true,seated:state.player.seated,holding:Boolean(state.holding),drawerOpen:Boolean(state.drawer?.open),captivity:state.player.captivity,carrying:mapKind(state.map)==='night'||state.teacher.carriedId!==null||Boolean(state.teacher.writing)||(state.throwAge>=0&&state.throwAge<.58),caught:stunned,computer:state.player.computerActive,movement:firstPersonMotion?.amount||0,crawlBlend:0},gameTime),drawer:firstPersonDrawer,eyeHeight:firstPersonEyeHeight(state.player,'teacher'),seated:Boolean(state.player.seated),carrying:false,freeLook:true,office:Boolean(state.player.officeChair),computer:Boolean(state.player.computerActive),typing:Boolean(state.player.computerActive),movement:firstPersonMotion?.amount||0,walkPhase:firstPersonMotion?.phase||0,crawlBlend:firstPersonMotion?.crawlBlend||0});
      const age=state.throwAge,throwing=!stunned&&age>=0&&age<.58,wind=throwing?THREE.MathUtils.smoothstep(age,0,.11):0,release=throwing?THREE.MathUtils.smoothstep(age,.11,.20):0,recover=throwing?THREE.MathUtils.smoothstep(age,.25,.58):0;
      const extension=release*(1-recover),writing=!stunned&&Boolean(state.teacher.writing);
      const grip=teacherHands.getHand('right');
      if(throwing){rightPalm.position.set(.22-.07*extension,-.24+.08*wind*(1-recover),-.51-.22*extension);rightPalm.rotation.set(-.65-.28*wind*(1-release)+.92*extension,.1-.23*extension,.11-.36*extension);grip.setCurl(.80-.67*extension);grip.opposeThumb(.8-.58*extension);}
      if(writing){const t=state.elapsed;rightPalm.position.set(.13+Math.sin(t*6)*.022,-.11+Math.cos(t*8)*.014,-.55);rightPalm.rotation.set(-.23,.12,.20+Math.sin(t*6)*.08);grip.setCurl(.64);grip.pointIndex(.25);grip.opposeThumb(.74);}
      if(stunned){rightPalm.position.set(.22,-.40,-.48);rightPalm.rotation.set(-.25,.12,.1);grip.setCurl(.25);grip.opposeThumb(.3);}
      fpChalk.position.copy(grip.indexTip()).add(new THREE.Vector3(.004,-.013,.001));
      fpTorch.visible=!stunned&&mapKind(state.map)==='night';if(fpTorch.visible){const l=teacherHands.getHand('left');l.setCurl(.8);l.opposeThumb(.8);fpTorch.position.copy(l.indexTip()).add(new THREE.Vector3(0,-.01,0));fpTorch.rotation.x=-.5;}
      fpChalk.visible=!stunned&&state.teacher.carriedId===null&&throwing&&age<.20;
      if(!stunned&&state.teacher.carriedId!==null){
        const record=pupilRecords[state.teacher.carriedId],neck=record?.actor?.bones?.Neck;
        if(neck){
          const contact=neck.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,-.025,.085).applyAxisAngle(upAxis,record.group.rotation.y));
          rightPalm.parent.updateWorldMatrix(true,false);rightPalm.position.copy(rightPalm.parent.worldToLocal(contact));
          rightPalm.rotation.set(-.65,0,-.15);grip.setCurl(.70);grip.opposeThumb(.70);
          rightPalm.position.sub(grip.indexTip().multiplyScalar(rightPalm.scale.x).applyQuaternion(rightPalm.quaternion).multiplyScalar(.55));
        }
      }
    }
    const chalks=state?.chalks||[];
    while(chalkModels.length<chalks.length){const c=cylinder(M.paper,[0,0,0],[.012,.11,.012],null,dynamic);chalkModels.push(c);}
    for(let i=0;i<chalkModels.length;i++){const c=chalks[i],mesh=chalkModels[i];mesh.visible=Boolean(c);if(c){mesh.position.set(c.x,c.y,c.z);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(c.vx,c.vy,c.vz).normalize());}}
  }
  function setSeats(seats=currentSeats,force=false){
    if(!Array.isArray(seats)||!seats.length||seats.length>SEATS.length)return;
    const signature=seats.map(p=>`${p.id},${p.deskX},${p.deskZ},${p.x},${p.z},${p.yaw||0}`).join('|');if(!force&&signature===layoutSignature)return;
    layoutSignature=signature;currentSeats=seats;renderLayout=createLayoutContext(seats,{officeLocked:gameplay?.officeLocked,rearDoorClosed:gameplay?.rearDoorClosed});
    const activeSeats=new Set(seats.map(seat=>seat.id));
    for(const[id,furniture]of seatFurniture)furniture.group.visible=activeSeats.has(id);
    for(const[id,drawer]of drawerRecords)drawer.group.visible=activeSeats.has(id)&&mapKind(mapVariant)!=='computer';
    for(const[id,book]of deskBooks)book.visible=activeSeats.has(id)&&mapKind(mapVariant)!=='computer';
    for(const record of pupilRecords)record.layoutActive=activeSeats.has(record.seat.id);
    for(const seat of seats){const furniture=seatFurniture.get(seat.id);if(!furniture)continue;const yaw=seat.yaw||0,h=floorHeight(seat.x,seat.z,mapVariant),sin=Math.sin(yaw),cos=Math.cos(yaw);
      furniture.group.position.set(seat.deskX,h,seat.deskZ);furniture.group.rotation.y=yaw;furniture.body.visible=mapKind(mapVariant)!=='computer';
      const drawer=drawerRecords.get(seat.id);Object.assign(drawer,{x:seat.deskX,z:seat.deskZ,yaw});drawer.group.position.set(drawer.x-sin*drawer.open*.24,h,drawer.z-cos*drawer.open*.24);drawer.group.rotation.y=yaw;
      const book=deskBooks.get(seat.id);book.position.set(seat.deskX-sin*.28,.88+h,seat.deskZ-cos*.28);book.rotation.order='YXZ';book.rotation.y=yaw;
      const target=deskTargets.get(seat.id);if(target){target.position.set(seat.deskX,h,seat.deskZ);target.rotation.y=yaw;target.updateMatrixWorld(true);}
      if(pupilRecords[seat.id])pupilRecords[seat.id].seat=seat;
    }
    variants.setSeats(seats);canvas.dataset.seatLayout=JSON.stringify({pattern:seats[0]?.pattern||'',seats:seats.map(({id,deskX,deskZ,yaw})=>({id,deskX,deskZ,yaw}))});
  }
  function setMap(value){
    mapVariant=CAMPUS_MAPS.includes(value)?value:'classroom';variants.setMap(mapVariant);campus.setMap(mapVariant);setSeats(currentSeats,true);
    const night=mapKind(mapVariant)==='night';setCampusNight(night);
    setCharacterNight(scene,night);firstPersonView.setNight(night);
    applyRoomLighting(night,{ambient,sun,fill,teachingFill,lampMat,ceilingMaterial,scene});canvas.dataset.map=mapVariant;
  }
  // Gestures come from the imported rig; its real hand anchor carries the chalk.
  const teacherHand=teacher.getHand('right');
  const chalkGeometry=new THREE.CylinderGeometry(.012,.012,.11,8);assets.add(chalkGeometry);
  const chalkMaterial=mat('#fff7df',{emissive:'#fff5d3',emissiveIntensity:.15});
  const heldChalk=new THREE.Mesh(chalkGeometry,chalkMaterial);heldChalk.position.set(.012,.075,.028);heldChalk.rotation.x=Math.PI/2;heldChalk.visible=false;teacherHand.add(heldChalk);
  const flyingChalk=new THREE.Mesh(chalkGeometry,chalkMaterial);flyingChalk.visible=false;scene.add(flyingChalk);
  const castOrigin=new THREE.Vector3(),castTarget=new THREE.Vector3(),wristPosition=new THREE.Vector3();
  let lastFeedbackElapsed=-Infinity,activeCastTarget=null,previousCastProgress=0;
  const stakes=new THREE.Group();stakes.name='capture-posts';dynamic.add(stakes);
  const postModels=DETENTION.map(p=>{
    const g=new THREE.Group();g.name='wooden-post-'+p.id;g.position.set(p.x,floorHeight(p.x,p.z,mapVariant),p.z);stakes.add(g);
    cylinder(M.edge,[0,1.03,0],[.085,2.06,.10],null,g);
    rounded(M.wood,[0,2.035,0],[.15,.055,.15],.018,null,g);
    for(const z of [-.13,.13])rounded(M.dark,[0,.035,z],[.36,.07,.13],.018,null,g);
    for(const y of [.18,.34])cylinder(M.steel,[0,y,-.099],[.018,.009,.018],[Math.PI/2,0,0],g);
    return g;
  });
  // The restrained pose bends both arms behind the real post; no rope meshes
  // are shown. Rescue outlines the student's current skinned silhouette.
  function clearTeacherFeedback(state=null){heldChalk.visible=false;flyingChalk.visible=false;activeCastTarget=null;previousCastProgress=0;lastFeedbackElapsed=state?.elapsed??-Infinity;}
  function updateTeacherFeedback(state,dt){
    const elapsed=state.elapsed||0;if(elapsed<lastFeedbackElapsed)clearTeacherFeedback(state);lastFeedbackElapsed=elapsed;
    const students=state.students||[],t=state.teacher||{},progress=THREE.MathUtils.clamp(t.castProgress||0,0,1),target=students.find(student=>student.id===t.targetId);
    teacher.castChalk?.(progress);
    const carried=t.carriedId!==null&&t.carriedId!==undefined?pupilRecords[t.carriedId]:null,neck=carried?.actor?.bones?.Neck;
    if(neck&&state.role!=='teacher')teacher.gripNeck?.(neck.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,-.025,.085).applyAxisAngle(upAxis,carried.group.rotation.y)));
    teacher.group.updateMatrixWorld(true);
    if(teacherHand)teacherHand.getWorldPosition(wristPosition);else wristPosition.set(.27,1.75,.35).applyMatrix4(teacher.group.matrixWorld);
    heldChalk.visible=progress>0&&progress<.68;
    if(progress>.68&&target&&!target.caught){
      if(activeCastTarget!==target.id||previousCastProgress<=.68){castOrigin.copy(wristPosition);activeCastTarget=target.id;}
      const flight=THREE.MathUtils.clamp((progress-.68)/.32,0,1);castTarget.set(target.x,floorHeight(target.x,target.z,mapVariant)+(target.seated===false?1.45:1.29),target.z);
      flyingChalk.visible=true;flyingChalk.position.lerpVectors(castOrigin,castTarget,flight);flyingChalk.position.y+=Math.sin(flight*Math.PI)*.10;flyingChalk.quaternion.setFromUnitVectors(upAxis,castTarget.clone().sub(castOrigin).normalize());
    }else{flyingChalk.visible=false;if(progress===0)activeCastTarget=null;}
    previousCastProgress=progress;
    canvas.dataset.teacherFeedback=JSON.stringify({castProgress:progress,targetId:t.targetId??null,chalking:flyingChalk.visible,carriedId:t.carriedId,bound:students.filter(s=>s.captivity==='bound').map(s=>s.id)});
  }
  // Teacher rounds randomize the five active seats, so any pupil can hold a prop.
  const friendProps=new Map(SEATS.map(({id})=>{
    const group=new THREE.Group();group.visible=false;pupilRecords[id].group.add(group);
    const phone=createDeskItem('phone');group.add(phone);
    return[id,{group,phone}];
  }));
  const smokeEffects=createSmokeEffects(renderer),thrownCanisters=[];
  const throwableTemplates=new Map(THROWABLE_ITEM_KINDS.map(kind=>[kind,createDeskItem(kind)]));
  function updateSmoke(state){
    smokeEffects.update(state?.smokes||[]);
    const projectiles=state?.projectiles||[];
    while(thrownCanisters.length<projectiles.length){const model=new THREE.Group();for(const [kind,template]of throwableTemplates){const child=template.clone(true);child.userData.throwKind=kind;model.add(child);}scene.add(model);thrownCanisters.push(model);}
    for(let i=0;i<thrownCanisters.length;i++){
      const model=thrownCanisters[i],p=projectiles[i];model.visible=Boolean(p);if(!p)continue;
      for(const child of model.children)child.visible=child.userData.throwKind===(p.kind||'smoke');
      model.position.set(p.x,p.y,p.z);model.rotation.set(p.settled?Math.PI/2:p.spinX||0,0,p.spinZ||0);
    }
    canvas.dataset.smokeDebug=JSON.stringify({projectiles:projectiles.map(p=>({id:p.id,kind:p.kind||'smoke',x:p.x,y:p.y,z:p.z,age:p.age,charge:p.charge,bounces:p.bounces,settled:p.settled,restTime:p.restTime})),clouds:(state?.smokes||[]).map(s=>({x:s.x,y:s.y,z:s.z,age:s.age,radius:s.radius,density:s.density}))});
  }
  const flashMat=new THREE.MeshBasicMaterial({color:'#ffd4a1',transparent:true,opacity:0,depthWrite:false,depthTest:false,toneMapped:false});materials.add(flashMat);
  const flashGeometry=new THREE.PlaneGeometry(2,2);assets.add(flashGeometry);
  const flash=new THREE.Mesh(flashGeometry,flashMat);flash.position.z=-.1;flash.renderOrder=1000;flash.frustumCulled=false;flash.visible=false;camera.add(flash);
  let alive=true,renderActive=Boolean(active),motion=true,quality='high',mode='classroom',tourEnabled=false,dragging=false,lastX=0,dragYaw=0,dragPitch=0;
  let viewFloor=0;
  let gameplay=null,gameTime=0,entryTime=0,feedbackTime=0,feedbackKind='',lastTeacherPhase='board',teacherWorldSample=null,teacherWorldHeading=null,teacherWorldSpeed=0;
  const pointer=new THREE.Vector2(),smoothPointer=new THREE.Vector2(),neutralPointer=new THREE.Vector2();
  const basePosition=new THREE.Vector3(.30,2.70,6.65),look=new THREE.Vector3(-2.05,.93,1.60);
  const playerPosition=new THREE.Vector3(SEATS[PLAYER_SEAT].x,1.43,SEATS[PLAYER_SEAT].z),teacherTarget=new THREE.Vector3(BOARD.x,0,BOARD.z);
  const entryPosition=new THREE.Vector3(),entryQuaternion=new THREE.Quaternion(),targetQuaternion=new THREE.Quaternion(),menuOffset=new THREE.Vector3(),targetLook=new THREE.Vector3(),upAxis=new THREE.Vector3(0,1,0);
  const playerEuler=new THREE.Euler(0,Math.PI,0,'YXZ');let entryFov=40;
  camera.position.copy(basePosition);camera.lookAt(look);
  const menuFov=()=>camera.aspect<.9?52:48;
  const viewRole=()=>gameplay?.stage==='gathering'?gameplay.lobbyRole||gameplay.role:gameplay?.role;
  const gameFov=()=>gameplayFov(viewRole(),camera.aspect);
  function resize(){const rect=canvas.getBoundingClientRect();const w=Math.max(1,rect.width),h=Math.max(1,rect.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=gameplay?THREE.MathUtils.lerp(entryFov,gameFov(),THREE.MathUtils.smoothstep(entryTime/.7,0,1)):menuFov();camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  function move(e){if(gameplay){const r=canvas.getBoundingClientRect();itemPointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);pointerPresent=e.target===canvas;return;}const r=canvas.getBoundingClientRect();pointer.set(THREE.MathUtils.clamp((e.clientX-r.left)/r.width-.5,-.5,.5),THREE.MathUtils.clamp((e.clientY-r.top)/r.height-.5,-.5,.5));if(dragging&&!gameplay){dragYaw+=(e.clientX-lastX)*.004;lastX=e.clientX;dragYaw=THREE.MathUtils.clamp(dragYaw,-.55,.55);}}
  function down(e){if(!tourEnabled||gameplay)return;dragging=true;lastX=e.clientX;canvas.setPointerCapture?.(e.pointerId);}
  function up(){dragging=false;}
  window.addEventListener('pointermove',move,{passive:true});canvas.addEventListener('pointerdown',down);window.addEventListener('pointerup',up);
  function heroMood(){return mode==='chase'?'hero':mode==='search'?'thinking':'snack';}
  function restorePupils(){for(const record of pupilRecords){record.group.position.set(record.seat.x,0,record.seat.z);record.group.rotation.y=record.seat.yaw||0;record.group.visible=true;record.caught=false;record.lastUpdate=-Infinity;const prop=friendProps.get(record.seat.id);if(prop)prop.group.visible=false;}}
  function setGameplay(state){
    if(!state){
      if(!gameplay)return;gameplay=null;teachingEnd.visible=false;teacher.group.visible=false;hands.group.visible=false;flash.visible=false;flashMat.opacity=0;feedbackTime=0;teacherWorldSample=null;teacherWorldSpeed=0;drawerItems.visible=false;raisedSlot=null;drawerFocus=0;drawerItemSignature='';
      staminaVision.reset();chalkPowder.clear();soundCues.update(null,0);surveillanceView.update(null);updateSmoke(null);bubbleEffects.update(null);itemEffects50.update(null);updateTeacherTools(null,0);clearTeacherFeedback();
      setSeats(SEATS,true);restorePupils();camera.fov=menuFov();camera.updateProjectionMatrix();canvas.style.cursor=tourEnabled?'grab':'';canvas.dataset.gameplay='false';canvas.dataset.itemReady='false';return;
    }
    if(!gameplay){
      viewFloor=actorFloorHeight(state.player,state.map,state.teacher);
      entryPosition.copy(camera.position);entryQuaternion.copy(camera.quaternion);entryFov=snapEntry?gameFov():camera.fov;entryTime=snapEntry?.7:0;gameTime=0;feedbackTime=0;teacherWorldSample=null;teacherWorldSpeed=0;firstPersonMotion=null;eyeHeight=null;drawerFocus=0;raisedSlot=null;drawerItemSignature='';
      pointer.set(0,0);dragging=false;teacher.group.position.set(BOARD.x,0,BOARD.z);teacher.group.rotation.y=0;lastTeacherPhase='board';
      teachingEnd.visible=true;teacher.group.visible=true;hands.group.visible=true;canvas.style.cursor='';canvas.dataset.gameplay='true';
      for(const record of pupilRecords){record.lastUpdate=-Infinity;record.worldMotion=null;record.worldHeading=null;}clearTeacherFeedback(state);
    }
    setSeats(state.seats||currentSeats);if(state.map!==mapVariant)setMap(state.map);updateLayoutDoors(renderLayout,{officeLocked:state.officeLocked,rearDoorClosed:state.rearDoorClosed,elevatorClosed:state.elevator?.doorClosed});campus.setDoors(state);
    teacher.group.visible=state.stage!=='gathering'&&state.role!=='teacher'&&state.teacher?.visible!==false;
    gameplay=state;
  }
  const moodMap={standing:'resting',walking:'resting',carried:'resting',bound:'resting',stunned:'thinking',rescuing:'rescuing',listening:'listening','computer-idle':'computer-idle',reading:'reading',writing:'writing',thinking:'thinking',snack:'snack',drink:'drink',burger:'burger',phone:'phone',computer:'computer',smoke:'smoke',flash:'flash',ink:'ink',banana:'banana',bananaPeel:'bananaPeel',garlic:'garlic',gum:'gum',lunch:'lunch',pen:'pen',caught:'resting',resting:'resting',alert:'thinking'};
  const pupilFrustum=new THREE.Frustum(),pupilView=new THREE.Matrix4(),pupilBounds=new THREE.Sphere(new THREE.Vector3(),1.15);
  function updatePupils(state,animationTime,dt){
    camera.updateMatrixWorld();pupilFrustum.setFromProjectionMatrix(pupilView.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    const snapshots=new Map((state?.students||[]).map(s=>[s.id??s.seatId,s])),playerId=state?.player?.id??PLAYER_SEAT,playerSeat=state?.player?.seatId??null;
    const bookStates=new Map((state?.books||[]).map(b=>[b.id,b]));
    const readingSeats=state?new Set((state.students||[]).filter(student=>student.seated&&!student.caught&&student.id!==playerId).map(student=>student.seatId)):null;
    for(const [id,book] of deskBooks){const a=state?(bookStates.get(id)?.amount??(coveredSeats.has(id)?1:0)):(coveredSeats.has(id)?1:0);book.visible=pupilRecords[id]?.layoutActive!==false&&mapKind(mapVariant)!=='computer';book.rotation.x=(1-a)*Math.PI/2;book.userData.raised=a>.5;}
    const candidates=[];let detentionIndex=0;
    for(const record of pupilRecords){
      const id=record.seat.id,snapshot=snapshots.get(id),caught=Boolean(snapshot?.caught);record.caught=caught;record.previewRole=state?.stage==='gathering'?snapshot?.previewRole:null;
      if(STUDENT_VARIANTS.includes(snapshot?.character)&&record.variant!==snapshot.character){record.variant=snapshot.character;record.glasses=record.variant==='glasses';record.lastUpdate=-Infinity;record.lastMood='';}
      record.worldMotion=sampleActorMotion(record.worldMotion,snapshot,animationTime,Boolean(state&&state.status==='playing'&&!state.paused));
      const motionKind=snapshot?.mood==='rescuing'?'rescuing':snapshot?.captivity||'free';
      if(record.motionKind!==motionKind||animationTime<record.motionAt){record.motionKind=motionKind;record.motionAt=animationTime;}
      record.group.visible=record.layoutActive!==false&&!(state&&id===playerId)&&snapshot?.visible!==false&&(!state||Boolean(snapshot));
      const fallback=caught?DETENTION[detentionIndex++%DETENTION.length]:record.seat;
      record.captureLift=THREE.MathUtils.damp(record.captureLift||0,['carried','bound'].includes(snapshot?.captivity)?.20:0,12,dt);
      record.group.position.set(Number.isFinite(snapshot?.x)?snapshot.x:fallback.x,record.captureLift+actorFloorHeight(snapshot||fallback,mapVariant,state?.teacher),Number.isFinite(snapshot?.z)?snapshot.z:fallback.z);
      record.worldHeading=sampleActorHeading(record.worldHeading,snapshot,animationTime,captureBodyYaw(snapshot,state));
      record.group.rotation.y=snapshot?record.worldHeading.yaw:caught?Math.PI:record.seat.yaw||0;
      record.currentMood=state?(snapshot?.mood||snapshot?.currentAction||snapshot?.action||'writing'):id===27?heroMood():record.menuMood;
      record.distance=record.group.position.distanceTo(camera.position);
      pupilBounds.center.copy(record.group.position);pupilBounds.center.y+=1.03;
      record.inView=record.distance<2.8||pupilFrustum.intersectsSphere(pupilBounds)||surveillanceView.intersectsSphere(pupilBounds);
      record.group.visible=record.group.visible&&record.inView;
      if(record.group.visible)candidates.push(record);
    }
    candidates.sort((a,b)=>a.distance-b.distance);
    const detailed=new Set(candidates.filter(r=>r.distance<4.8).slice(0,quality==='low'?4:6).map(r=>r.seat.id));
    if(!state){detailed.add(26);detailed.add(27);}
    for(const record of candidates)if(FRIEND_SEATS.includes(record.seat.id)&&!['writing','reading','resting'].includes(record.currentMood)&&record.distance<8)detailed.add(record.seat.id);
    for(const record of pupilRecords){
      const id=record.seat.id,student=snapshots.get(id),standing=record.caught||student?.seated===false,near=record.group.visible&&(detailed.has(id)||importedStudents),prop=friendProps.get(id);
      for(const actor of record.actors.values())actor.group.visible=false;
      if(near){
        const actor=actorFor(record,standing),headLook=captureHeadLook(student,record.group.rotation.y);record.actor=actor;actor.setStudyBook?.(deskBooks.get(student?.seatId??record.seat.id));actor.group.visible=true;actor.setMood(moodMap[record.currentMood]||(standing?'resting':'writing'));actor.setMotion?.({crawling:Boolean(student?.crouched&&standing),seated:!standing,speed:record.worldMotion.speed,carrying:student?.carrying??(student?.drawer?.drawnSlot!=null),heldAction:student?.heldAction,using:Boolean(Object.hasOwn(student||{},'eating')&&['snack','drink','burger','banana','garlic','lunch'].includes(student?.heldAction||student?.action)?student.eating:student?.holding),penWriting:Boolean(student?.penWriting),penTwirling:Boolean(student?.penTwirling),lookYaw:headLook.yaw,lookPitch:headLook.pitch,restraint:record.motionKind,restraintStartedAt:record.motionAt,throwProgress:student?.progress||0,throwAge:student?.itemThrowAge??Infinity});
        const articulating=['carried','bound','stunned','rescuing'].includes(student?.captivity)||student?.mood==='rescuing';
        // Every visible pupil animates continuously; off-camera actors are culled above.
        const interval=quality==='low'&&!articulating&&record.distance>7?1/30:0;
        if(animationTime<record.lastUpdate||animationTime-record.lastUpdate>=interval||record.lastMood!==record.currentMood){actor.update(animationTime,dt);record.lastUpdate=animationTime;record.lastMood=record.currentMood;}
        if(actor.studyBookVisible?.()){const source=deskBooks.get(student?.seatId??record.seat.id);if(source)source.visible=false;}
      }
      record.currentSeatId=student?.seatId??record.seat.id;
      if(prop){
        const phone=record.currentMood==='phone',kind='phone';
        const hand=near?record.actor?.getHand?.('left'):null,attachment=hand?.userData.attachments?.[kind];
        prop.group.visible=Boolean(record.group.visible&&!record.caught&&phone&&attachment&&(hand.userData.gripWeight??1)>.65);
        prop.phone.visible=phone;
        if(attachment){
          if(prop.group.parent!==hand)hand.add(prop.group);
          prop.group.position.fromArray(attachment.position);prop.group.rotation.fromArray(attachment.rotation);
        }
      }
      const cycle=(animationTime+id*.83)%8,turn=cycle<1.15?Math.sin(cycle/1.15*Math.PI)*.48:0,flipping=record.layoutActive!==false&&mapKind(mapVariant)!=='computer'&&deskBooks.get(id)?.userData.raised&&(!state||readingSeats.has(id))&&!record.caught&&turn>.01;
      const seatYaw=record.seat.yaw||0;posePosition.set(record.seat.deskX-Math.sin(seatYaw)*.28,.88+floorHeight(record.seat.x,record.seat.z,mapVariant),record.seat.deskZ-Math.cos(seatYaw)*.28);poseRotation.setFromEuler(poseEuler.set(0,seatYaw-turn,0));pupilMatrix.compose(posePosition,poseRotation,flipping?unitScale:hiddenScale);pageFlips.setMatrixAt(id,pupilMatrix);
    }
    syncDeskPenVisibility(pupilRecords,deskPens);
    for(const [id,pen]of deskPens){
      const taken=(state?.students||[]).some(p=>(p.penSeatId??p.seatId)===id&&(p.penTaken||(p.action==='pen'&&(p.carrying??(p.drawer?.drawnSlot!=null)))));
      if(mapKind(mapVariant)==='computer'||((state?.player?.penSeatId??state?.player?.seatId)===id&&state.player.penTaken)||taken)pen.visible=false;
    }
    pageFlips.instanceMatrix.needsUpdate=true;
  }
  function updateDrawers(state,dt,handState=null){
    variants.updateDrawers(state,dt);
    const seat=state?.player?.seated&&!state.player.caught?state.player.seatId:null;
    const otherOpen=new Set((state?.students||[]).filter(s=>s.seated&&!s.caught&&(s.drawerOpen??s.drawer?.open)).map(s=>s.seatId));
    for(const [id,drawer] of drawerRecords){
      const target=id===seat&&state.drawer?.open||otherOpen.has(id)?1:0;
      drawer.open=THREE.MathUtils.damp(drawer.open,target,target>drawer.open?12:18,dt);
      drawer.group.position.x=drawer.x-Math.sin(drawer.yaw||0)*drawer.open*.24;drawer.group.position.z=drawer.z-Math.cos(drawer.yaw||0)*drawer.open*.24;
    }
    // Track the model that is actually in the hand through its retraction, even
    // after the selected slot changes. The same object must not appear twice.
    if(!handState?.visible)raisedSlot=null;
    else if(state?.drawer?.drawnSlot!=null&&handState.active===state.drawer.slots[state.drawer.drawnSlot]?.action)raisedSlot=state.drawer.drawnSlot;
    const inventory=state?.drawer,officeSeat=Boolean(state?.player?.officeChair),computerDrawer=!officeSeat&&mapKind(mapVariant)==='computer'?variants.drawers.get(seat):null,host=officeSeat?(campus.officeDrawers.get(state?.player?.officeDeskId)||campus.officeDrawer):seat===null?null:computerDrawer?.group||drawerRecords.get(seat)?.group;
    drawerItems.visible=Boolean(inventory&&host);
    if(host&&drawerItems.parent!==host)host.add(drawerItems);drawerItems.position.y=officeSeat?-.77:computerDrawer?computerDrawer.floor-(importedDesk?.drawerFloor??.65):0;drawerSlotProps.forEach((slot,index)=>{slot.group.position.x=(inventory?.slots?.length===1?0:index-1)*.28;slot.group.position.z=computerDrawer?.itemZ??-.16;});
    const signature=inventory?inventory.slots.map((slot,index)=>`${slot.action||''}:${index===raisedSlot}`).join('|'):'';
    if(signature!==drawerItemSignature){drawerItemSignature=signature;drawerSlotProps.forEach((slot,index)=>{
      for(const [action,prop]of slot.props)prop.visible=Boolean(inventory?.slots[index]?.action===action&&index!==raisedSlot);
    });}
    canvas.dataset.drawerOpen=String(seat===null?0:Number((computerDrawer||drawerRecords.get(seat))?.open.toFixed(3)||0));
    canvas.dataset.drawerItems=JSON.stringify(inventory?inventory.slots.map((slot,index)=>({id:index,action:slot.action,visible:Boolean(host&&slot.action&&index!==raisedSlot)})):[]);
  }
  function pickDrawerSlot(){
    if(!gameplay||gameplay.paused||gameplay.status!=='playing'||!gameplay.player.seated||gameplay.player.caught||!gameplay.drawer?.open||gameplay.drawer.drawnSlot!==null||drawerFocus<.9)return null;

    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);itemRay.setFromCamera(neutralPointer,camera);
    // Exact mesh hits first; a small local bounds margin makes a garlic clove
    // usable without enlarging the model or allowing a pick through furniture.
    return pickDrawerItem(itemRay,drawerSlotProps.flatMap(slot=>slot.pickTargets),[room,...furnitureRows.values(),variants.group,drawerItems.parent]);
  }
  const campusTargets=campus.getTargets();
  const isObjectVisible=object=>{for(let n=object;n;n=n.parent)if(!n.visible&&!n.userData.rigidInstanceSource)return false;return true;};
  const campusTargetObject=(kind,id)=>kind==='rear-door'?campusTargets.doors.find(d=>d.id==='rear')?.object:kind==='office-desk'?campusTargets.officeDesks.find(d=>d.id===(id||OFFICE_DESK.id))?.object:kind==='office-chair'?campusTargets.officeChairs.find(c=>c.id===(id||OFFICE_CHAIR.id))?.object:kind==='locker'?campusTargets.lockers.find(l=>l.id===id)?.object||campusTargets.lockers[0]?.object:kind==='chair'?chairTargets.get(id):kind==='pen'?deskPens.get(id):null;
  function getInteraction(){
    if(!gameplay||gameplay.paused||gameplay.status!=='playing'||gameplay.player.caught||gameplay.elevator?.phase==='travel')return null;
    const player=gameplay.player,preClass=gameplay.stage&&gameplay.stage!=='class';
    camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);itemRay.setFromCamera(neutralPointer,camera);
    const candidates=[];
    const add=(object,result,max=2.2)=>{if(!object||!isObjectVisible(object))return;object.updateWorldMatrix(true,true);const hit=itemRay.intersectObject(object,true).find(h=>h.distance<max);if(hit)candidates.push({object,result,hit});};
    if(gameplay.stage==='gathering'&&gameplay.startBellAvailable)add(startBellModel,{kind:'bell'});
    if(gameplay.stage==='gathering'&&!player.seated&&player.x>LIFT.minX&&player.x<LIFT.maxX&&player.z>LIFT.minZ&&player.z<LIFT.maxZ){campus.liftPanel.updateWorldMatrix(true,true);const hit=itemRay.intersectObject(campus.liftPanel,true).find(h=>h.object.userData.floorMap&&h.distance<2.5);if(hit)candidates.push({object:campus.liftPanel,hit,result:{kind:'lift',map:hit.object.userData.floorMap,floor:hit.object.userData.floor,current:hit.object.userData.floorMap===mapVariant}});}
    if(gameplay.stage==='gathering'&&!player.seated)for(const target of campusTargets.lockers)add(target.object,{kind:'locker',id:target.id,role:target.id},2.5);
    if(player.seated&&gameplay.role!=='teacher'&&player.penTaken&&!player.officeChair)add(chairTargets.get(player.seatId),{kind:'chair',id:player.seatId},2.15);
    if(!player.seated&&gameplay.role!=='teacher'){
      const occupied=new Set((gameplay.students||[]).filter(p=>p.seated&&!p.caught).map(p=>p.seatId));
      for(const [id,chair]of chairTargets)if(!occupied.has(id))add(chair,{kind:'chair',id},2.15);
    }
    if(!preClass){
      if(gameplay.role==='teacher')for(const target of surveillanceView.targets())add(target.object,{kind:'surveillance',id:target.id,installed:target.installed,ready:target.ready},2.5);
      const rear=campusTargets.doors.find(d=>d.id==='rear');add(rear?.object,{kind:'rear-door',closed:!!gameplay.rearDoorClosed});
      if(!player.seated)for(const c of campusTargets.officeChairs)add(c.object,{kind:'office-chair',id:c.id});
      for(const d of campusTargets.officeDesks)add(d.object,{kind:'office-desk',id:d.id});
      if(player.seated){
        const slot=pickDrawerSlot();if(slot!==null)return{kind:'item',slot};
        if(mapKind(mapVariant)==='computer'&&!player.officeChair&&gameplay.drawer?.drawnSlot===null)add(variants.screens.get(player.seatId),{kind:'computer'});
        if(!player.officeChair){
          const body=mapKind(mapVariant)==='computer'?variants.stations.get(player.seatId):deskTargets.get(player.seatId),drawer=(mapKind(mapVariant)==='computer'?variants.drawers:drawerRecords).get(player.seatId)?.group;
          add(body,{kind:'desk'});add(drawer,{kind:'desk'});
          const book=deskBooks.get(player.seatId);if(mapKind(mapVariant)!=='computer'){add(book,{kind:'book'});if(!player.penTaken&&gameplay.drawer?.drawnSlot===null)add(deskPens.get(player.seatId),{kind:'pen',id:player.seatId});}
        }
      }
    }
    candidates.sort((a,b)=>a.hit.distance-b.hit.distance);
    // No selection through walls or an intervening desktop. Repeated prop
    // source meshes stay raycastable even though GPU submission is instanced.
    const blockers=itemRay.intersectObjects([room,teachingEnd,variants.group,...furnitureRows.values()],true).filter(h=>isObjectVisible(h.object)&&!h.object.material?.transparent);
    for(const c of candidates){const barrier=blockers.find(h=>h.distance<c.hit.distance-.035);if(!barrier)return c.result;let ancestor=barrier.object;while(ancestor&&ancestor!==c.object)ancestor=ancestor.parent;if(ancestor===c.object)return c.result;}
    if(preClass)return null;
    if(gameplay.role==='teacher'&&gameplay.releaseStudent!=null)return{kind:'release',id:gameplay.releaseStudent};
    if(gameplay.role==='teacher'&&gameplay.writeBoardAvailable)return{kind:'blackboard'};
    if(gameplay.role==='teacher')return gameplay.bindPost!=null?{kind:'post',id:gameplay.bindPost}:gameplay.teacherAim?{kind:'student',...gameplay.teacherAim}:null;
    if(gameplay.rescueAim!=null)return{kind:'rescue',id:gameplay.rescueAim};
    return null;
  }
  function updateItemHover(){
    const target=getInteraction();hoveredSlot=target?.kind==='item'?target.slot:null;
    let prop=campusTargetObject(target?.kind,target?.id);
    if(!prop)prop=target?.kind==='bell'?startBellCap:target?.kind==='lift'?campus.liftPanel:target?.kind==='post'?postModels[target.id]:['rescue','release'].includes(target?.kind)?pupilRecords[target.id]?.actor?.group:hoveredSlot===null?target?.kind==='computer'?variants.screens.get(gameplay.player.seatId):target?.kind==='book'?deskBooks.get(gameplay.player.seatId):target?.kind==='desk'?(mapKind(mapVariant)==='computer'?variants.stations.get(gameplay.player.seatId):deskTargets.get(gameplay.player.seatId)||drawerRecords.get(gameplay.player.seatId)?.group):null:drawerSlotProps[hoveredSlot]?.props.get(gameplay.drawer.slots[hoveredSlot].action);
    itemOutline.select(prop||null);canvas.dataset.hoveredSlot=hoveredSlot===null?'':String(hoveredSlot);canvas.dataset.interaction=target?JSON.stringify(target):'';
    if(gameplay?.drawer?.open)canvas.dataset.drawerTargets=JSON.stringify(drawerSlotProps.map((slot,id)=>{const p=slot.group.getWorldPosition(new THREE.Vector3());p.project(camera);return{id,x:(p.x+1)/2,y:(1-p.y)/2};}));
  }
  const wrappedAngle=(a)=>Math.atan2(Math.sin(a),Math.cos(a));
  function updateTeacher(state,dt){
    const t=state.teacher||{},phase=t.phase||'board',walk=phase==='patrol',progress=THREE.MathUtils.clamp(t.walkProgress||0,0,1);
    if(Number.isFinite(t.x)&&Number.isFinite(t.z)&&Number.isFinite(t.yaw)){
      // Perception and the rendered teacher use the same pose, without extra easing.
      const elapsed=Number.isFinite(state.sceneElapsed)?state.sceneElapsed:Number.isFinite(state.elapsed)?state.elapsed:gameTime;
      teacherWorldSample=sampleActorMotion(teacherWorldSample,t,elapsed,state.status==='playing'&&!state.paused);teacherWorldSpeed=teacherWorldSample.speed;
      teacher.group.position.set(t.x,floorHeight(t.x,t.z,mapVariant),t.z);teacherWorldHeading=sampleActorHeading(teacherWorldHeading,{...t,captivity:phase==='stunned'?'stunned':'free'},elapsed);teacher.group.rotation.y=teacherWorldHeading.yaw;
      const walking=state.paused||state.status!=='playing'?0:THREE.MathUtils.clamp(teacherWorldSpeed/1.35,0,1);
      teacher.update(gameTime,{seated:Boolean(t.seated),crawling:Boolean(t.crouched&&t.carriedId==null),walking,speed:teacherWorldSpeed,lookYaw:wrappedAngle(t.yaw-teacher.group.rotation.y),lookPitch:t.pitch||0,phase:t.castProgress>0||t.carriedId!==null?'watching':phase,alert:Math.max((state.suspicion||0)/100,feedbackKind==='caught'?feedbackTime/.55:0)});
      lastTeacherPhase=phase;return;
    }
    teacherWorldSample=null;teacherWorldSpeed=0;
    teacherTarget.set(BOARD.x,floorHeight(BOARD.x,BOARD.z,mapVariant),BOARD.z);
    if(phase==='watching')teacherTarget.z=3.55;
    if(walk)teacherTarget.z=4.4-5.1*Math.sin(progress*Math.PI);
    teacher.group.position.lerp(teacherTarget,1-Math.exp(-dt*(walk?12:2.8)));
    let yaw=0;
    if(phase==='turning')yaw=-Math.PI*THREE.MathUtils.smoothstep((t.phaseTime||0)/Math.max(.01,t.phaseDuration||.8),0,1);
    else if(phase==='watching')yaw=Math.atan2(playerPosition.x-teacher.group.position.x,playerPosition.z-teacher.group.position.z);
    else if(walk)yaw=t.looking?Math.atan2(playerPosition.x-teacher.group.position.x,playerPosition.z-teacher.group.position.z):progress<.5?-Math.PI:0;
    // Shortest-path easing preserves the turn instead of flipping the teacher model.
    const angleDelta=wrappedAngle(yaw-teacher.group.rotation.y);
    teacher.group.rotation.y+=angleDelta*(1-Math.exp(-dt*(phase==='turning'?12:6)));
    let headLook=0;
    if(walk&&t.looking){const bearing=Math.atan2(playerPosition.x-teacher.group.position.x,playerPosition.z-teacher.group.position.z);headLook=THREE.MathUtils.clamp(wrappedAngle(bearing-teacher.group.rotation.y),-.8,.8);}
    teacher.update(gameTime,{walking:walk?1:teacher.group.position.distanceTo(teacherTarget)>.1?.5:0,look:headLook,phase,alert:Math.max((state.suspicion||0)/100,feedbackKind==='caught'?feedbackTime/.55:0)});
    lastTeacherPhase=phase;
  }
  let last=performance.now(),time=0,frame=0,lastDebugTime=0,lastHandsDebug=0,frameAverage=16.7,renderAverage=0,updateAverage=0,sceneDrawCalls=0,sceneTriangles=0;
  function render(now){const cpuStart=performance.now();if(!alive||!renderActive){frame=0;return;}frame=requestAnimationFrame(render);if(document.hidden){last=now;return;}const dt=Math.min((now-last)/1000,.08);last=now;
    const frozen=Boolean(gameplay&&(gameplay.paused||gameplay.status!=='playing'));
    surveillanceView.prepare(gameplay,now);
    if(!gameplay){
      if(motion)time+=dt;
      smoothPointer.lerp(motion?pointer:neutralPointer,.035);
      const angle=tourEnabled?dragYaw:(motion?Math.sin(time*.09)*.013:0);
      menuOffset.copy(basePosition).sub(look).applyAxisAngle(upAxis,angle);
      camera.position.copy(look).add(menuOffset);camera.position.x+=smoothPointer.x*.20;camera.position.y+=smoothPointer.y*.10;camera.lookAt(look);
      updatePupils(null,time,motion?dt:0);updateDrawers(null,dt);
    }else{
      const simulationTime=Number.isFinite(gameplay.sceneElapsed)?gameplay.sceneElapsed:Number.isFinite(gameplay.elapsed)?gameplay.elapsed:gameTime+(frozen?0:dt);
      const activeDt=frozen?0:Math.max(0,simulationTime-gameTime);
      gameTime=simulationTime;
      if(!frozen)entryTime=Math.min(.7,entryTime+dt);
      const player=gameplay.player||{...SEATS[PLAYER_SEAT],seated:true,yaw:0,pitch:.08},seated=player.seated!==false,crouched=Boolean(player.crouched),caught=Boolean(player.caught);
      drawerFocus=THREE.MathUtils.damp(drawerFocus,seated&&!caught&&gameplay.drawer?.open?1:0,8,activeDt);
      const basePitch=Number.isFinite(player.pitch)?player.pitch:.08,drawerPitch=0;
      firstPersonMotion=sampleFirstPersonMotion(firstPersonMotion,player,gameTime);
      const officeTray=player.officeChair?(campus.officeDrawers.get(player.officeDeskId)||campus.officeDrawer):null,deskTrayRecord=mapKind(mapVariant)==='computer'?variants.drawers.get(player.seatId):drawerRecords.get(player.seatId);
      const previousDrawerAmount=officeTray?Math.max(0,Math.min(1,(-officeTray.position.z-.08)/.52)):deskTrayRecord?.open||0,drawerTarget=gameplay.drawer?.open?1:0;
      const currentDrawerAmount=THREE.MathUtils.damp(previousDrawerAmount,drawerTarget,officeTray?14:drawerTarget>previousDrawerAmount?12:18,activeDt);
      firstPersonDrawer=drawerHandTarget({player,drawer:gameplay.drawer,seats:currentSeats,map:mapVariant,amount:currentDrawerAmount});
      hands.update(gameTime,{animationPose:viewRole()==='teacher'?null:customHandAnimation.sample({role:'student',freeLook:true,seated,crouched,carrying:gameplay.drawer?.drawnSlot!=null,holding:Boolean(gameplay.holding),eating:Boolean(player.eating),penWriting:Boolean(player.penWriting),penTwirling:Boolean(player.penTwirling),drawerOpen:Boolean(gameplay.drawer?.open),captivity:player.captivity,caught,computer:player.computerActive,bookAmount:gameplay.books?.find(b=>b.id===player.seatId)?.amount||0,movement:firstPersonMotion.amount,crawlBlend:firstPersonMotion.crawlBlend},gameTime),drawer:firstPersonDrawer,eyeHeight:firstPersonEyeHeight(player,'student'),action:gameplay.selected,penWriting:Boolean(player.penWriting),penTwirling:Boolean(player.penTwirling),holding:Boolean(gameplay.holding&&!caught),eating:Boolean(player.eating&&!caught),carrying:gameplay.drawer?.drawnSlot!=null&&!caught,progress:gameplay.actionProgress,alert:feedbackKind==='caught'?feedbackTime/.55:(gameplay.suspicion||0)/150,seated,crouched,caught,freeLook:true,viewPitch:basePitch+drawerPitch,computer:gameplay.player.computerActive,typing:Boolean(player.computerActive),bookAmount:!player.officeChair&&mapKind(mapVariant)!=='computer'?(gameplay.books?.find(b=>b.id===player.seatId)?.amount||0):0,office:Boolean(player.officeChair),throwAge:player.itemThrowAge??Infinity,movement:firstPersonMotion.amount,walkPhase:firstPersonMotion.phase,crawlBlend:firstPersonMotion.crawlBlend});
      const focus=THREE.MathUtils.clamp(hands.getFocus?.()||0,0,1),handState=hands.getDebug?.();canvas.dataset.itemReady=String(focus>.92&&gameplay.holding&&(handState?.extension??1)>=.99&&entryTime>=.7);
      const viewFocus=0,extraDrop=0;
      const yaw=Number.isFinite(player.yaw)?player.yaw:0,pitch=THREE.MathUtils.clamp(basePitch,-1.40,1.40);
      // Match the hands' existing inverse camera transform without changing their pose.
      hands.group.position.y+=extraDrop*Math.cos(pitch);hands.group.position.z+=extraDrop*Math.sin(pitch);
      const desiredHeight=firstPersonEyeHeight(player,viewRole());
      eyeHeight=eyeHeight===null?desiredHeight:THREE.MathUtils.damp(eyeHeight,desiredHeight,13,activeDt);
      playerPosition.set(Number.isFinite(player.x)?player.x:SEATS[PLAYER_SEAT].x,eyeHeight-viewFocus*.12,Number.isFinite(player.z)?player.z:SEATS[PLAYER_SEAT].z);
      targetQuaternion.setFromEuler(playerEuler.set(-pitch,yaw+Math.PI,0,'YXZ'));
      const blend=THREE.MathUtils.smoothstep(entryTime/.7,0,1);
      const floor=actorFloorHeight(player,mapVariant,gameplay.teacher);
      // Footfalls follow discrete risers; the eye eases over a step instead of popping.
      const floorBlend=1-Math.exp(-dt*18);viewFloor+= (floor-viewFloor)*floorBlend;
      playerPosition.y+=viewFloor;
      if(blend<1){camera.position.lerpVectors(entryPosition,playerPosition,blend);camera.quaternion.slerpQuaternions(entryQuaternion,targetQuaternion,blend);}else{camera.position.copy(playerPosition);camera.quaternion.copy(targetQuaternion);}
      firstPersonView.align(player,firstPersonMotion,playerPosition);
      const nextFov=THREE.MathUtils.lerp(entryFov,gameFov(),blend);if(Math.abs(camera.fov-nextFov)>.001){camera.fov=nextFov;camera.updateProjectionMatrix();}
      if(!gameplay.paused)feedbackTime=Math.max(0,feedbackTime-dt);
      flash.visible=feedbackTime>0;flashMat.opacity=feedbackKind==='caught'?.045*Math.sin(Math.min(1,feedbackTime/.55)*Math.PI):.018*Math.sin(Math.min(1,feedbackTime/.4)*Math.PI);
      startBellCap.position.x=gameplay.stage==='seating'?6.075:6.10;
      updateDrawers(gameplay,activeDt,handState);updateTeacher(gameplay,activeDt);updatePupils(gameplay,gameTime,activeDt);itemEffects50.update(gameplay);updateSmoke(gameplay);bubbleEffects.update(gameplay);updateTeacherFeedback(gameplay,activeDt);
    }
    if(motion&&!frozen){const ambientTime=gameplay?gameTime:time;fans.forEach((f,i)=>f.rotation.y=ambientTime*(1.7+i*.08));curtains.forEach((c,i)=>{c.rotation.z=curtainRests[i].z+Math.sin(ambientTime*.65+i)*.012;c.position.x=curtainRests[i].x+Math.sin(ambientTime*.8+i)*.025;});}
    chalkPowder.update(frozen?0:dt);soundCues.update(gameplay,dt);surveillanceView.update(gameplay);campus.update(gameplay,frozen?0:dt);variants.update(gameplay);updateTeacherTools(gameplay,frozen?0:dt);updateItemHover();rigidProps.sync();const renderStart=performance.now();updateAverage+=(renderStart-cpuStart-updateAverage)*.08;renderer.info.reset();smokeEffects.render(scene,camera,quality);sceneDrawCalls=renderer.info.render.calls;sceneTriangles=renderer.info.render.triangles;itemOutline.render(camera);if(gameplay)firstPersonView.render();staminaVision.render(gameplay,dt);surveillanceView.render(now);
    if(gameplay&&now-lastHandsDebug>200){lastHandsDebug=now;const handDebug=(viewRole()==='teacher'?teacherHands:hands).getDebug?.();canvas.dataset.handsDebug=JSON.stringify({...handDebug,gameTime,cameraPitch:playerEuler.x*-1,entryTime,bodyLocked:firstPersonMotion?.locked,bodyYaw:firstPersonMotion?.bodyYaw,crawlBlend:firstPersonMotion?.crawlBlend,walkAmount:firstPersonMotion?.amount});}
    frameAverage+=(dt*1000-frameAverage)*.08;renderAverage+=(performance.now()-renderStart-renderAverage)*.08;
    if(now-lastDebugTime>1000){lastDebugTime=now;const stats={frameMs:Number(frameAverage.toFixed(2)),renderMs:Number(renderAverage.toFixed(2)),updateMs:Number(updateAverage.toFixed(2)),visibleStudents:pupilRecords.filter(r=>r.group.visible).length,rigidBatches:rigidProps.batchCount,rigidSources:rigidProps.sourceCount,drawCalls:sceneDrawCalls,triangles:sceneTriangles,quality,fov:camera.fov,fatigue:staminaVision.diagnostics().intensity,soundCues:soundCues.diagnostics(),gameplay:Boolean(gameplay),teacherPhase:gameplay?lastTeacherPhase:null,seats:currentSeats.length,player:gameplay?{x:camera.position.x,z:camera.position.z,y:camera.position.y}:null};canvas.dataset.sceneDebug=JSON.stringify(stats);canvas.dataset.frameMs=String(stats.frameMs);canvas.dataset.drawCalls=String(stats.drawCalls);}
  }
  function setActive(value){
    const next=Boolean(value)&&alive;if(next===renderActive)return;
    renderActive=next;canvas.dataset.renderActive=String(next);cancelAnimationFrame(frame);frame=0;
    if(next){last=performance.now();resize();frame=requestAnimationFrame(render);}
  }
  setSeats(currentSeats,true);updatePupils(null,0,0);canvas.dataset.renderActive=String(renderActive);if(renderActive)frame=requestAnimationFrame(render);renderer.render(scene,camera);onReady?.();
  return {
    setGameplay,setMap,setSeats,setActive,
    getRolePreviews,
    getComputerPlayback:()=>(screenContent.getPlayback?.()??{playing:false,visible:false,mediaTime:0}),
    setSoundCues:enabled=>soundCues.setEnabled(enabled),
    playWorldEffect(event){chalkPowder.emit(event);soundCues.emit(event,gameplay);},
    getHoveredSlot:()=>pickDrawerSlot(),getInteraction,
    playFeedback(kind){if(!gameplay)return;feedbackKind=kind;feedbackTime=kind==='caught'?.55:kind==='chalk'?.22:['complete','bell','help'].includes(kind)?.4:0;flashMat.color.set(kind==='chalk'?'#fcf6dc':'#ffd4a1');},
    setQuality(value){quality=value==='low'?'low':'high';renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1:1.6));renderer.shadowMap.enabled=quality!=='low';resize();},
    setMotion(value){motion=Boolean(value);},
    setMode(value){mode=value;pupilRecords[27].lastUpdate=-Infinity;},
    setCharacter(value){const record=pupilRecords[PLAYER_SEAT],variant=STUDENT_VARIANTS.includes(value)?value:'boy';if(record.variant===variant)return;record.variant=variant;record.glasses=variant==='glasses';record.lastUpdate=-Infinity;record.lastMood='';canvas.dataset.playerCharacter=variant;},
    tour(value){tourEnabled=Boolean(value);if(!tourEnabled){dragYaw=0;dragPitch=0;}canvas.style.cursor=tourEnabled&&!gameplay?'grab':'';},
    dispose(){customHandAnimation.dispose();rolePortraits?.dispose();staminaVision.dispose();soundCues.dispose();chalkPowder.dispose();surveillanceView.dispose();itemEffects50.dispose();bubbleEffects.dispose();rigidProps.dispose();variants.dispose();smokeEffects.dispose();itemOutline.dispose();for(const record of pupilRecords)for(const actor of record.actors.values())actor.dispose?.();teacher.dispose?.();alive=false;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('pointermove',move);canvas.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);const geometries=new Set(),mats=new Set();for(const tree of [scene,firstPersonView.scene])tree.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));});geometries.forEach(g=>g.dispose());assets.forEach(a=>a.dispose?.());materials.forEach(m=>m.dispose());mats.forEach(m=>m.dispose());renderer.dispose();}
  };
}
