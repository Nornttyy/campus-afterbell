import {CRAWL_TUNING} from './crawl-profile.js?v=campus-83&rev=157';
import * as T from './vendor/three.module.js';
import {OrbitControls} from './vendor/addons/controls/OrbitControls.js';
import {TransformControls} from './vendor/addons/controls/TransformControls.js';
import {createRiggedPalm} from './student-assets.js?v=campus-117&rev=160';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
import {createDeskHands} from './game-actors.js?v=campus-117&rev=157';
import {ITEM_HAND_CLIPS,newItemHandClip,createHandAnimationDocument,validateHandAnimationDocument,sampleHandAnimationClip} from './hand-animation-data59.js?v=campus-111';
import {loadHandAnimations,saveCurrentHandAnimation,clearHandAnimations} from './hand-animation-runtime59.js?v=campus-117';
import {createAnimationHistory,putAnimationFrame,moveAnimationFrame,retimeAnimationClip,mirrorAnimationHand,completeAnimationDocument} from './animation-editor-state59.js?v=campus-83';

import {prepareAnimationEditorDocument} from './animation-editor-start59.js?v=campus-111';

import {loadPropAssets,CLASSROOM_PROP_SOURCES} from './prop-assets.js?v=campus-83';
const $=id=>document.getElementById(id),clone=v=>JSON.parse(JSON.stringify(v)),DRAFT='campus.handAnimationDraft.v2',LEGACY_DRAFT='campus.handAnimationDraft.v1',RAD=Math.PI/180;
let doc=createHandAnimationDocument(),draftError='',draftNotice='';
try{const current=localStorage.getItem(DRAFT),raw=current||localStorage.getItem(LEGACY_DRAFT);let saved=null;
 if(raw){const result=validateHandAnimationDocument(JSON.parse(raw));if(result.ok)saved=result.value;else draftError='旧草稿格式有误，原文件保留；已从静止姿势开始。';}else saved=loadHandAnimations();
 const ready=prepareAnimationEditorDocument(saved,{legacy:!current});doc=ready.document;
 if(ready.cleared.length)draftNotice='已移除未修改的旧动画；你的修改和旧草稿均保留。';
}catch{draftError='无法读取本机草稿，可以用导入恢复。';}
const history=createAnimationHistory(doc);let clipId='student-idle',side='left',time=0,playing=false,speed=1,view='first',poseClipboard=null,gesture=false,frameSelection=0,saveTimer=null,applied=false,renderReady=false,needPaths=true;
let tool='translate', directDrag=null;
let renderer,scene,camera,orbit,gizmo,handle,floor,grid,arms,rigs,pathGroup,resizeObserver,raf;
const clip=()=>doc.clips[clipId],pose=()=>sampleHandAnimationClip(clip(),time);
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
function status(text){$('save-state').textContent=text;}
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(DRAFT,JSON.stringify(doc));status(applied?'已保存到游戏':'草稿已保存在本机');}catch{status('草稿未保存，请导出备份');}},160);}
function changed({commit=true,fields=true}={}){applied=false;if(commit)history.commit(doc);needPaths=true;persist();updateTimeline();if(fields)updateFields();$('undo').disabled=!history.canUndo;$('redo').disabled=!history.canRedo;}
function edit(fn){playing=false;const before=clone(doc);try{fn();changed();}catch(e){doc=before;time=Math.min(time,clip().duration);updateTimeline();updateFields();notice(e.message,true);}}
function editHand(fn,{commit=true}={}){playing=false;const p=pose();fn(p[side]);try{time=putAnimationFrame(clip(),time,p);}catch(e){notice(e.message,true);return;}frameSelection=time;changed({commit,fields:false});updateFields({skipActive:true});}
function currentFrame(){return clip().keyframes.find(f=>Math.abs(f.time-time)<.0011);}
function updateFields({skipActive=false}={}){
 const p=pose()[side];$('depth').value=Math.round(p.position[2]*100);$('depth-output').value=Math.round(-p.position[2]*100)+' cm';
 $('clip-select').value=clipId;$('item-picker').hidden=!ITEM_HAND_CLIPS.includes(clipId);
 for(const kind of ['position','rotation'])for(let i=0;i<3;i++){const field=$(`${kind}-${i}`);if(skipActive&&document.activeElement===field)continue;field.value=(p[kind][i]*(kind==='position'?100:1/RAD)).toFixed(kind==='position'?1:0);}
 $('curl').value=p.curl;$('curl-output').value=`${Math.round(p.curl*100)}%`;
 for(const finger of ['Thumb','Index','Middle','Pinky'])$(`finger-${finger}`).value=p.fingers?.[finger]??p.curl;
 $('duration').value=+clip().duration.toFixed(3);$('loop').checked=clip().loop;$('easing').value=clip().easing;$('frame-time').value=time.toFixed(3);$('frame-time').max=clip().duration;$('frame-time').disabled=!currentFrame()||time===0;
 $('delete-frame').disabled=!currentFrame()||time===0||clip().keyframes.length<=1;$('paste-pose').disabled=!poseClipboard;
 for(const b of document.querySelectorAll('[data-side]'))b.setAttribute('aria-pressed',String(b.dataset.side===side));
 for(const b of document.querySelectorAll('[data-clip]'))b.classList.toggle('active',b.dataset.clip===clipId);
 $('view-label').textContent=`${clipId.startsWith('teacher-')?'老师':'学生'} · ${{first:'第一人称',side:'侧面',front:'正面'}[view]}`;
}
function updateTime(){const text=`${time.toFixed(2)} / ${clip().duration.toFixed(2)} s`;$('time-text').textContent=text;$('preview-time').textContent=`${time.toFixed(2)} s`;$('scrubber').max=clip().duration;$('scrubber').value=time;$('playhead').style.left=`${time/clip().duration*100}%`;$('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'暂停':'播放');$('editor-canvas').dataset.clip=clipId;$('editor-canvas').dataset.time=time.toFixed(3);}
function selectTime(value){playing=false;time=Math.max(0,Math.min(clip().duration,Number(value)||0));frameSelection=currentFrame()?.time??null;updateTime();updateFields();for(const b of document.querySelectorAll('.key'))b.classList.toggle('selected',Math.abs(Number(b.dataset.time)-time)<.0011);}
function updateTimeline(){
 $('ruler').replaceChildren();for(let i=0;i<=4;i++){const s=document.createElement('span');s.textContent=(clip().duration*i/4).toFixed(2);s.style.left=`${i*25}%`;$('ruler').append(s);}
 $('keys').replaceChildren();clip().keyframes.forEach((f,i)=>{const b=document.createElement('button');b.className='key'+(Math.abs(f.time-time)<.0011?' selected':'');b.style.left=`${f.time/clip().duration*100}%`;b.dataset.time=f.time;b.title=`${f.time.toFixed(2)} 秒`;b.setAttribute('aria-label',`关键帧 ${i+1}，${f.time.toFixed(2)} 秒`);b.addEventListener('click',e=>{e.stopPropagation();selectTime(Number(b.dataset.time));});b.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.stopPropagation();playing=false;const initial=clone(doc),startX=e.clientX,startTime=f.time,width=$('track').getBoundingClientRect().width;let next=startTime,moved=false;b.setPointerCapture(e.pointerId);selectTime(startTime);const move=ev=>{if(startTime===0||Math.abs(ev.clientX-startX)<3&&!moved)return;moved=true;doc=clone(initial);next=Math.round(Math.max(0,Math.min(clip().duration,startTime+(ev.clientX-startX)/width*clip().duration))*100)/100;moveAnimationFrame(clip(),startTime,next);time=next;b.style.left=`${next/clip().duration*100}%`;needPaths=true;updateTime();};const up=()=>{b.removeEventListener('pointermove',move);b.removeEventListener('pointerup',up);b.removeEventListener('pointercancel',up);if(moved){frameSelection=next;changed();}else updateFields();};b.addEventListener('pointermove',move);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);});$('keys').append(b);});
 $('frame-count').textContent=`${clip().keyframes.length} 个关键帧`;updateTime();
}
for(const kind of ['position','rotation'])for(let i=0;i<3;i++){
 const label=document.createElement('label'),tag=document.createElement('span'),input=document.createElement('input');tag.textContent='XYZ'[i];input.type='number';input.id=`${kind}-${i}`;input.step=kind==='position'?1:5;input.min=kind==='position'?-200:-360;input.max=kind==='position'?200:360;input.setAttribute('aria-label',`${kind==='position'?'位置':'朝向'} ${'XYZ'[i]}`);input.addEventListener('input',()=>{if(input.value===''||!Number.isFinite(Number(input.value)))return;const n=Number(input.value);editHand(h=>h[kind][i]=Math.max(+input.min,Math.min(+input.max,n))*(kind==='position'?.01:RAD),{commit:false});});input.addEventListener('change',()=>{changed();});input.addEventListener('blur',()=>{history.commit(doc);updateFields();$('undo').disabled=!history.canUndo;$('redo').disabled=!history.canRedo;});label.append(tag,input);$(`${kind}-fields`).append(label);
}
for(const [finger,name]of [['Thumb','拇指'],['Index','食指'],['Middle','中指'],['Pinky','小指']]){const label=document.createElement('label'),s=document.createElement('span'),input=document.createElement('input');s.textContent=name;input.type='range';input.id=`finger-${finger}`;input.min=0;input.max=1;input.step=.01;input.setAttribute('aria-label',`${name}弯曲`);input.addEventListener('input',()=>editHand(h=>{h.fingers={Thumb:h.curl,Index:h.curl,Middle:h.curl,Pinky:h.curl,...h.fingers,[finger]:+input.value};},{commit:false}));input.addEventListener('change',()=>changed());label.append(s,input);$('finger-fields').append(label);}
$('curl').oninput=()=>editHand(h=>{h.curl=+$('curl').value;delete h.fingers;},{commit:false});$('curl').onchange=()=>changed();
function selectClip(id){
 clipId=id;if(!doc.clips[id])doc.clips[id]=newItemHandClip(id);
 applied=false;status('本机草稿');
 time=0;frameSelection=0;playing=false;needPaths=true;setView(view);updateTimeline();updateFields();
}
$('clip-select').onchange=e=>selectClip(e.target.value);
$('depth').oninput=()=>editHand(h=>{h.position[2]=+$('depth').value/100;},{commit:false});
$('depth').onchange=()=>changed();
for(const b of document.querySelectorAll('[data-side]'))b.onclick=()=>{side=b.dataset.side;playing=false;updateFields();};
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{setView(b.dataset.view);updateFields();};
for(const b of document.querySelectorAll('[data-tool]'))b.onclick=()=>{tool=b.dataset.tool;gizmo?.setMode(tool);notice(tool==='translate'?'拖动手掌移动；用前后位置调整深度。':'拖动手掌转动手腕；精确数值里可以调整翻腕角度。');for(const x of document.querySelectorAll('[data-tool]'))x.setAttribute('aria-pressed',String(x===b));};
$('duration').onchange=()=>edit(()=>{time*=retimeAnimationClip(clip(),+$('duration').value);});$('loop').onchange=()=>edit(()=>clip().loop=$('loop').checked);$('easing').onchange=()=>edit(()=>clip().easing=$('easing').value);
$('play').onclick=()=>{if(time>=clip().duration)time=0;playing=!playing;updateTime();};$('to-start').onclick=()=>selectTime(0);$('to-end').onclick=()=>selectTime(clip().duration);$('scrubber').oninput=()=>selectTime($('scrubber').value);
$('track').addEventListener('pointerdown',e=>{if(e.target.closest('.key'))return;const r=$('track').getBoundingClientRect();selectTime((e.clientX-r.left)/r.width*clip().duration);});
$('add-frame').onclick=()=>edit(()=>{time=putAnimationFrame(clip(),time,pose());frameSelection=time;});$('delete-frame').onclick=()=>{if(!currentFrame()||time===0||clip().keyframes.length<=1)return;edit(()=>{clip().keyframes=clip().keyframes.filter(f=>Math.abs(f.time-time)>.0011);frameSelection=null;});};
$('frame-time').onchange=()=>{if(!currentFrame())return;const target=+$('frame-time').value;edit(()=>{time=moveAnimationFrame(clip(),time,target)??time;frameSelection=time;});};
$('copy-pose').onclick=()=>{poseClipboard=clone(pose());updateFields();notice('已复制双手姿势。');};$('paste-pose').onclick=()=>{if(poseClipboard)edit(()=>putAnimationFrame(clip(),time,poseClipboard));};$('duplicate').onclick=()=>edit(()=>{
 const c=clip(),p=pose();let next=time;
 do{next=Math.min(c.duration,Math.round((next+.2)*1000)/1000);if(Math.abs(next-time)<.001)throw Error('已到末尾，可以延长动作时长。');if(next>=c.duration&&c.keyframes.some(f=>Math.abs(f.time-next)<.001))throw Error('末尾已有关键帧，可以延长动作时长。');}while(c.keyframes.some(f=>Math.abs(f.time-next)<.001));
 time=putAnimationFrame(c,next,p);frameSelection=time;
});
$('mirror').onclick=()=>edit(()=>{const p=pose();p[side==='left'?'right':'left']=mirrorAnimationHand(p[side]);putAnimationFrame(clip(),time,p);});$('swap').onclick=()=>edit(()=>{const p=pose();putAnimationFrame(clip(),time,{left:mirrorAnimationHand(p.right),right:mirrorAnimationHand(p.left)});});
function recover(next){doc=next;if(!doc.clips[clipId])doc.clips[clipId]=newItemHandClip(clipId);time=Math.min(time,clip().duration);playing=false;changed({commit:false});}
$('undo').onclick=()=>recover(history.undo());$('redo').onclick=()=>recover(history.redo());$('restore').onclick=()=>edit(()=>{doc.clips[clipId]={...clip(),keyframes:(createHandAnimationDocument().clips[clipId]||newItemHandClip(clipId)).keyframes};time=0;notice('已清空为一个静止姿势；可以撤销。');});
$('apply').onclick=async()=>{try{const checked=validateHandAnimationDocument(doc);if(!checked.ok)throw Error(checked.errors.join('；'));await saveCurrentHandAnimation(clipId,checked.value.clips[clipId]);
 applied=true;persist();status('当前动作已应用');notice('当前动作已应用到这个浏览器的游戏。');}catch(e){notice(`保存失败：${e.message}`,true);}};
$('disable-custom').onclick=()=>{try{clearHandAnimations();applied=false;clearTimeout(saveTimer);notice('游戏已恢复已发布的默认动作，编辑器草稿仍保留。');status('游戏使用已发布动作');}catch(e){notice(e.message,true);}};
function downloadAnimation(single){const checked=validateHandAnimationDocument(single?{...doc,clips:{[clipId]:clip()}}:doc);if(!checked.ok)return notice(checked.errors.join('；'),true);const blob=new Blob([JSON.stringify(checked.value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=single?$('clip-select').selectedOptions[0].textContent+'.json':'校园手部动作.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('已导出动作文件。');document.querySelector('.file-menu').open=false;}
$('export').onclick=()=>downloadAnimation(false);$('export-one').onclick=()=>downloadAnimation(true);
$('import').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1024*1024)throw Error('文件不能超过 1 MB');const result=validateHandAnimationDocument(JSON.parse(await file.text()));if(!result.ok)throw Error(result.errors.join('；'));edit(()=>{doc={...doc,clips:{...doc.clips,...result.value.clips}};clipId=Object.keys(result.value.clips)[0]||clipId;time=0;setView(view);});notice('已导入。预览满意后，点击保存到游戏。');}catch(error){notice(`没有导入：${error.message}`,true);}finally{e.target.value='';}};
$('speed').onchange=()=>speed=+$('speed').value;$('grid').onchange=()=>{if(grid)grid.visible=$('grid').checked;};$('show-path').onchange=()=>needPaths=true;$('show-gizmo').onchange=()=>{};$('look-pitch').oninput=()=>{if(view==='first')setView('first');};$('view-reset').onclick=()=>{$('look-pitch').value=0;setView(view);};
addEventListener('keydown',e=>{const typing=e.target.closest('input,select,textarea');if(typing)return;const mod=e.metaKey||e.ctrlKey;if(mod&&e.code==='KeyZ'){e.preventDefault();$(e.shiftKey?'redo':'undo').click();}else if(mod&&e.code==='KeyS'){e.preventDefault();$('apply').click();}else if(e.code==='Space'){e.preventDefault();$('play').click();}else if(e.code==='KeyK')$('add-frame').click();else if(e.code==='Delete'||e.code==='Backspace'){e.preventDefault();$('delete-frame').click();}else if(e.code==='ArrowLeft'||e.code==='ArrowRight'){e.preventDefault();selectTime(time+(e.code==='ArrowLeft'?-1:1)/30);}});
function setView(next){view=next;for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===view));if(!camera)return;const crawl=clipId.startsWith('student-crawl'),eye=crawl?CRAWL_TUNING.eyeHeight:clipId.startsWith('teacher-')?1.98:1.65;floor.position.y=grid.position.y=-eye;grid.position.y+=.004;orbit.enabled=view!=='first';if(view==='first'){camera.position.set(0,0,0);camera.rotation.set(-Number($('look-pitch').value)*RAD,0,0);camera.fov=clipId.startsWith('teacher-')?56:62;}else{const target=new T.Vector3(0,crawl?-.48:-.55,-.45);camera.position.set(view==='side'?1.8:0,target.y+.35,view==='side'?-.35:-2.1);camera.lookAt(target);orbit.target.copy(target);camera.fov=50;}camera.updateProjectionMatrix();document.querySelector('.crosshair').hidden=view!=='first';}
function rebuildPaths(){needPaths=false;while(pathGroup.children.length){const l=pathGroup.children[0];pathGroup.remove(l);l.geometry.dispose();l.material.dispose();}pathGroup.visible=$('show-path').checked;if(!pathGroup.visible)return;for(const [s,color]of [['left',0x3c91ad],['right',0xdb9b64]]){const points=[];for(let i=0;i<=100;i++){const p=sampleHandAnimationClip(clip(),clip().duration*i/100);points.push(new T.Vector3(...p[s].position));}pathGroup.add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color,transparent:true,opacity:.65,depthTest:false})));}}
async function init(){
 const canvas=$('editor-canvas');renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1.04;renderer.outputColorSpace=T.SRGBColorSpace;
 scene=new T.Scene();scene.background=new T.Color('#e7eff2');scene.fog=new T.Fog('#e7eff2',7,18);camera=new T.PerspectiveCamera(62,1,.015,40);
 scene.add(new T.HemisphereLight(0xffffff,0x9aaab7,2.6));const light=new T.DirectionalLight(0xfff5e6,2);light.position.set(-3,5,4);scene.add(light);
 floor=new T.Mesh(new T.PlaneGeometry(40,40),new T.MeshLambertMaterial({color:0xdce8eb}));floor.rotation.x=-Math.PI/2;scene.add(floor);grid=new T.GridHelper(24,48,0xa7c4ca,0xcbdce0);scene.add(grid);pathGroup=new T.Group();scene.add(pathGroup);
 orbit=new OrbitControls(camera,canvas);orbit.enableDamping=true;orbit.enablePan=true;orbit.minDistance=.3;orbit.maxDistance=5;
 handle=new T.Object3D();scene.add(handle);gizmo=new TransformControls(camera,canvas);gizmo.setSize(.68);gizmo.setSpace('world');scene.add(gizmo.getHelper());gizmo.attach(handle);
 gizmo.addEventListener('mouseDown',()=>{gesture=true;playing=false;});gizmo.addEventListener('dragging-changed',e=>{orbit.enabled=view!=='first'&&!e.value;});gizmo.addEventListener('objectChange',()=>{if(!gesture)return;editHand(h=>{h.position=handle.position.toArray().map(v=>Math.max(-2,Math.min(2,v)));const e=new T.Euler().setFromQuaternion(handle.quaternion,'XYZ');h.rotation=[e.x,e.y,e.z];},{commit:false});});gizmo.addEventListener('mouseUp',()=>{if(gesture){gesture=false;changed();}});
 const loader=new GLTFLoader(),files=['ponytail-hand-left-v1','ponytail-hand-right-v1','teacher-hand-left-v1','teacher-hand-right-v1'],sources=await Promise.all(files.map(n=>loader.loadAsync(new URL(`./assets/models/${n}.glb`,import.meta.url).href)));
 const itemKeys=['snack','gum','burger','drink'];await loadPropAssets(Object.fromEntries(itemKeys.filter(k=>CLASSROOM_PROP_SOURCES[k]).map(k=>[k,CLASSROOM_PROP_SOURCES[k]])),{loader});
 const factory=role=>(side,scale)=>{const h=createRiggedPalm(sources[(role==='teacher'?2:0)+(side<0?0:1)],side,scale,role);if(role==='teacher')h.group.userData.characterRole='teacher';return h;};rigs={student:createDeskHands({createHand:factory('student')}),teacher:createDeskHands({createHand:factory('teacher')})};scene.add(rigs.student.group,rigs.teacher.group);arms=rigs.student;
 const pickRay=new T.Raycaster(),plane=new T.Plane();
 function pointerRay(e){const r=canvas.getBoundingClientRect();pickRay.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);return pickRay.ray;}
 canvas.addEventListener('pointerdown',e=>{
  if(!e.isPrimary||e.button!==0||playing||gesture||$('show-gizmo').checked&&gizmo.axis)return;
  pointerRay(e);const hands=['left','right'].map(s=>arms.getHand(s).group);
  hands.forEach(h=>h.traverse(o=>{if(o.isSkinnedMesh)o.computeBoundingSphere();}));
  const hit=pickRay.intersectObjects(hands,true)[0];if(!hit)return;
  let o=hit.object;while(o&&!hands.includes(o))o=o.parent;if(!o)return;
  side=o===hands[0]?'left':'right';updateFields();if($('show-gizmo').checked)return;
  const selected=pose()[side];plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()),new T.Vector3(...selected.position));
  const start=pickRay.ray.intersectPlane(plane,new T.Vector3());if(!start)return;
  directDrag={id:e.pointerId,x:e.clientX,y:e.clientY,start,hand:selected,before:clone(doc),changed:false};
  canvas.setPointerCapture(e.pointerId);orbit.enabled=false;e.stopImmediatePropagation();e.preventDefault();
 },true);
 canvas.addEventListener('pointermove',e=>{
  const drag=directDrag;if(!drag||drag.id!==e.pointerId)return;e.stopImmediatePropagation();
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.changed&&Math.hypot(dx,dy)<2)return;
  const hit=pointerRay(e).intersectPlane(plane,new T.Vector3());if(!hit)return;drag.changed=true;
  editHand(h=>{if(tool==='translate')h.position=hit.sub(drag.start).add(new T.Vector3(...drag.hand.position)).toArray().map(n=>T.MathUtils.clamp(n,-2,2));
   else{const cq=camera.getWorldQuaternion(new T.Quaternion()),delta=cq.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(dy*.009,dx*.009,0,'YXZ'))).multiply(cq.invert()),q=delta.multiply(new T.Quaternion().setFromEuler(new T.Euler(...drag.hand.rotation)));
    const r=new T.Euler().setFromQuaternion(q);h.rotation=[r.x,r.y,r.z];}},{commit:false});
 },true);
 function finishDrag(e){const d=directDrag;if(!d||d.id!==e.pointerId)return;directDrag=null;
  if(d.changed){if(e.type==='pointercancel')recover(d.before);else changed();}orbit.enabled=view!=='first';if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);e.stopImmediatePropagation();}
 canvas.addEventListener('pointerup',finishDrag,true);canvas.addEventListener('pointercancel',finishDrag,true);canvas.addEventListener('lostpointercapture',finishDrag,true);
 const resize=()=>{const r=$('viewport').getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};resizeObserver=new ResizeObserver(resize);resizeObserver.observe($('viewport'));resize();setView('first');renderReady=true;canvas.dataset.ready='true';$('loading').hidden=true;
 let last=performance.now();function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(playing){time+=dt*speed;if(time>=clip().duration){if(clip().loop)time%=clip().duration;else{time=clip().duration;playing=false;updateFields();}}updateTime();}const p=pose(),teacher=clipId.startsWith('teacher-');rigs.student.group.visible=!teacher;rigs.teacher.group.visible=teacher;arms=rigs[teacher?'teacher':'student'];const itemClip=ITEM_HAND_CLIPS.includes(clipId);arms.update(time,{animationPose:itemClip?{...p,clipId}:p,action:$('preview-item').value,progress:time/clip().duration,carrying:itemClip,seated:false,freeLook:true,movement:0,crawlBlend:0});
 if(!gesture){handle.position.fromArray(p[side].position);handle.quaternion.setFromEuler(new T.Euler(...p[side].rotation));}gizmo.enabled=!playing&&$('show-gizmo').checked;gizmo.getHelper().visible=gizmo.enabled;if(needPaths)rebuildPaths();if(view!=='first')orbit.update();renderer.render(scene,camera);raf=requestAnimationFrame(loop);}
 raf=requestAnimationFrame(loop);notice(draftError||draftNotice||'拖动手掌摆姿势，拖动时间线后可继续摆下一帧。',Boolean(draftError));
}
const requested=new URLSearchParams(location.search).get('clip');if(requested&&(ITEM_HAND_CLIPS.includes(requested)||doc.clips[requested]))selectClip(requested);
updateTimeline();updateFields();$('undo').disabled=true;$('redo').disabled=true;
init().catch(error=>{$('loading').textContent=`模型未能载入：${error.message}。刷新页面重试。`;$('loading').setAttribute('role','alert');notice('模型未就绪，仍可导出草稿。',true);console.error(error);});
addEventListener('pagehide',()=>{cancelAnimationFrame(raf);clearTimeout(saveTimer);try{localStorage.setItem(DRAFT,JSON.stringify(doc));}catch{}resizeObserver?.disconnect();gizmo?.dispose();orbit?.dispose();renderer?.dispose();},{once:true});
