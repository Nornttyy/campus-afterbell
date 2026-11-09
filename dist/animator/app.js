import {createProject,validateProject,samplePose,upsertKey,removeKey,moveKey,mirrorPose,setBoneEuler,getBoneEuler,createHistory} from './pose-store.js';
import {createRigView} from './rig-view.js';
import {downloadProject,importProjectFile,downloadAnimatedGLB,exportGameClip} from './animation-io.js';

export const MODEL_LABELS=Object.freeze({boy:'男同学',girl:'紫发女同学',ponytail:'棕马尾女同学',glasses:'眼镜同学',teacher:'老师'});
const CLIP_LABELS={Idle:'站立',Walk:'走路',Sit:'坐姿',Write:'写字',Snack:'拿零食',Phone:'手机',Think:'思考',Carry:'持物站立',WalkCarry:'持物走路',Card:'举手',Throw:'投掷'};
const copy=value=>JSON.parse(JSON.stringify(value));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const storageKey=id=>'campus.animator.v1.'+id;
const isHip=name=>/^(?:mixamorig[:_]?)?(?:Hips|Pelvis)$/i.test(name||'');
const cleanTransform=t=>({position:t.position.slice(),quaternion:t.quaternion.slice(),scale:t.scale.slice()});
const cleanPose=p=>Object.fromEntries(Object.entries(p).map(([name,t])=>[name,cleanTransform(t)]));
const typing=target=>Boolean(target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName||''));

// The same event wiring is used by the browser and focused DOM interaction tests.
export async function createAnimatorApp({document:doc=globalThis.document,window:win=globalThis.window,storage:providedStorage,rigFactory=createRigView,io={downloadProject,importProjectFile,downloadAnimatedGLB,exportGameClip}}={}){
  const ids=['project-name','save-status','import-project','export-project','export-game','export-glb','project-file','model-select','bone-count','bone-search','bone-tree','show-skeleton','undo','redo','mode-rotate','mode-translate','view-select','mirror-pose','rig-canvas','viewport-loading','loading-label','retry-load','view-model','view-bone','reset-bone','selected-bone-label','selected-bone-name','rotation-fields','position-fields','reset-pose','clip-select','load-clip','duration','fps','loop','to-start','previous-frame','play','next-frame','to-end','current-time','duration-label','auto-key','add-key','duplicate-key','delete-key','key-count','time-ruler','timeline-track','key-markers','playhead','timeline-selection','notification',...['x','y','z'].flatMap(axis=>['rotation-'+axis,'rotation-'+axis+'-range','position-'+axis])];
  ids.push('focus-bone');const ui=Object.fromEntries(ids.map(id=>[id,doc.getElementById(id)]));
  const listeners=[],sessions=new Map();let storage=providedStorage;
  if(storage===undefined){try{storage=win.localStorage;}catch{storage=null;}}
  let rig,history,currentProject=null,modelId='boy',modelInfo=null,bindPose={},initialPose={},workingPose={},selectedBone=null,selectedKey=null,time=0,playing=false,busy=true,disposed=false,loadToken=0,frame=0,lastFrame=0,saveTimer=0,noticeTimer=0,previewProject=null,dirtyPose=false,redoDraft=null,drag=null,drafts=new Map(),draftHistory=new Map();
  const project=()=>previewProject||currentProject;
  function listen(target,type,callback,options){target.addEventListener(type,callback,options);listeners.push(()=>target.removeEventListener(type,callback,options));}
  function notify(message,error=false){if(disposed)return;clearTimeout(noticeTimer);ui.notification.textContent=message;ui.notification.dataset.error=String(error);ui.notification.hidden=false;noticeTimer=setTimeout(()=>{ui.notification.hidden=true;},error?6500:2800);}
  function fail(error){notify(error?.message||String(error),true);}
  function safely(fn){return (...args)=>{try{const result=fn(...args);if(result?.catch)result.catch(fail);return result;}catch(error){fail(error);}};}
  function saveState(text,state='saved'){ui['save-status'].textContent=text;ui['save-status'].dataset.state=state;}
  function draftTime(){const p=currentProject;return clamp(Math.round(time*p.fps)/p.fps,0,p.duration);}
  function stashPose(){if(dirtyPose&&history)drafts.set(draftTime(),cleanPose(workingPose));}
  function rememberDrafts(){if(currentProject)draftHistory.set(JSON.stringify(currentProject),copy([...drafts]));}
  function restoreDrafts(){drafts=new Map(copy(draftHistory.get(JSON.stringify(currentProject))||[]));dirtyPose=false;}
  function saveNow(){
    clearTimeout(saveTimer);saveTimer=0;if(!history||!modelInfo)return;
    stashPose();const payload={project:currentProject,time,drafts:[...drafts]};
    sessions.set(modelId,{history,time,drafts:copy(payload.drafts),selectedBone,draftHistory});
    try{if(!storage)throw new Error('storage unavailable');storage.setItem(storageKey(modelId),JSON.stringify(payload));storage.setItem('campus.animator.lastModel',modelId);saveState(dirtyPose?'姿势待设关键帧':drafts.size?'已保存 · 含未记录姿势':'已自动保存',drafts.size?'draft':'saved');}
    catch{saveState('本机存储不可用，请保存项目','error');}
  }
  function queueSave(){saveState(dirtyPose?'姿势待设关键帧':'保存中…',dirtyPose?'draft':'pending');clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,300);}
  function backupSaved(id,raw){
    if(!raw)return;try{storage?.setItem(storageKey(id)+'.recovery.'+Date.now(),raw);}catch{throw new Error('无法备份旧项目，请先保存项目再重试');}
  }
  function readSaved(id){
    let raw;try{raw=storage?.getItem(storageKey(id));if(!raw)return null;const value=JSON.parse(raw),saved=validateProject(value.project||value);if(saved.modelId!==id)throw new Error('角色不匹配');return{project:saved,time:Number(value.time)||0,drafts:value.drafts||(value.draft?[[Number(value.time)||0,value.draft]]:[])};}
    catch(error){backupSaved(id,raw);notify('旧项目无法读取，已保留本机恢复副本。',true);return null;}
  }
  function setBusy(value,label='加载角色'){
    busy=value;ui['viewport-loading'].hidden=!value;ui['viewport-loading'].dataset.error='false';ui['loading-label'].textContent=label;ui['retry-load'].hidden=true;renderControls();
  }
  function renderControls(){
    const p=project(),ready=Boolean(history&&modelInfo&&!busy),boneReady=ready&&Boolean(selectedBone&&workingPose[selectedBone]);
    for(const id of ['project-name','export-project','export-game','export-glb','view-select','mirror-pose','reset-pose','duration','fps','loop','auto-key','to-start','previous-frame','play','next-frame','to-end','current-time','add-key','show-skeleton'])ui[id].disabled=!ready;
    ui['model-select'].disabled=busy;ui['import-project'].disabled=busy;ui['bone-search'].disabled=!ready;ui['clip-select'].disabled=!ready;
    ui['load-clip'].disabled=!ready||!ui['clip-select'].value;
    ui.undo.disabled=!ready||(!dirtyPose&&!history.canUndo());ui.redo.disabled=!ready||(!redoDraft&&!history.canRedo());
    ui['reset-bone'].disabled=!boneReady;ui['focus-bone'].disabled=!boneReady;ui['rotation-fields'].disabled=!boneReady;ui['position-fields'].disabled=!boneReady;
    ui['mode-rotate'].disabled=!boneReady;ui['mode-translate'].disabled=!boneReady||!isHip(selectedBone);
    ui['duplicate-key'].disabled=!ready||!p.keys.some(key=>key.id===selectedKey);
    ui['delete-key'].disabled=!ready||p.keys.length<2||!p.keys.some(key=>key.id===selectedKey);
    ui.play.textContent=playing?'Ⅱ':'▶';ui.play.setAttribute('aria-label',playing?'暂停动画':'播放动画');ui.play.setAttribute('aria-pressed',String(playing));
  }
  function renderInspector(){
    const bone=modelInfo?.bones.find(b=>b.name===selectedBone);
    ui['selected-bone-label'].textContent=bone?.label||'尚未选择';ui['selected-bone-name'].textContent=bone?.name||'—';ui['view-bone'].textContent=bone?.label||'选择一个关节';
    ui['position-fields'].hidden=!isHip(selectedBone);
    const angles=selectedBone?getBoneEuler(workingPose,selectedBone,bindPose):[0,0,0];
    for(const [index,axis]of ['x','y','z'].entries()){
      for(const id of ['rotation-'+axis,'rotation-'+axis+'-range'])if(doc.activeElement!==ui[id])ui[id].value=String(Math.round(angles[index]*10)/10);
      const input=ui['position-'+axis];if(doc.activeElement!==input)input.value=String(Math.round(((workingPose[selectedBone]?.position[index]||0)-(bindPose[selectedBone]?.position[index]||0))*1000)/1000);
    }
    for(const button of ui['bone-tree'].querySelectorAll('[data-bone]'))button.setAttribute('aria-pressed',String(button.dataset.bone===selectedBone));
    renderControls();
  }
  function renderBones(){
    const query=ui['bone-search'].value.trim().toLowerCase(),groups=new Map();ui['bone-tree'].replaceChildren();
    for(const bone of modelInfo?.bones||[]){
      if(query&&!(bone.label+' '+bone.name+' '+bone.group).toLowerCase().includes(query))continue;
      const group=bone.group||'其他';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(bone);
    }
    for(const [label,bones]of groups){
      const details=doc.createElement('details');details.className='bone-group';details.open=Boolean(query)||!label.includes('手指')||bones.some(b=>b.name===selectedBone);
      const summary=doc.createElement('summary');summary.textContent=label;details.append(summary);
      for(const bone of bones){const button=doc.createElement('button');button.type='button';button.className='bone-option';button.dataset.bone=bone.name;button.dataset.finger=String(label.includes('手指'));button.textContent=bone.label||bone.name;button.title=bone.name;button.setAttribute('aria-pressed',String(bone.name===selectedBone));details.append(button);}
      ui['bone-tree'].append(details);
    }
    if(!groups.size){const empty=doc.createElement('p');empty.className='bone-empty';empty.textContent='没有找到骨骼';ui['bone-tree'].append(empty);}
    ui['bone-count'].textContent=String(modelInfo?.bones.length||0);
  }
  function selectBone(name,fromRig=false){
    if(!modelInfo?.bones.some(b=>b.name===name))return;selectedBone=name;if(!fromRig)rig.selectBone(name);
    if(!isHip(name))setMode('rotate');renderInspector();
    const button=[...ui['bone-tree'].querySelectorAll('[data-bone]')].find(b=>b.dataset.bone===name);if(button?.parentElement?.tagName==='DETAILS')button.parentElement.open=true;
  }
  function setMode(mode){const next=mode==='translate'&&isHip(selectedBone)?'translate':'rotate';rig?.setMode(next);ui['mode-rotate'].setAttribute('aria-pressed',String(next==='rotate'));ui['mode-translate'].setAttribute('aria-pressed',String(next==='translate'));}
  function renderTime(){
    const p=project();if(!p)return;const fraction=time/p.duration;
    ui.playhead.style.left=(fraction*100)+'%';ui['timeline-track'].setAttribute('aria-valuemax',String(p.duration));ui['timeline-track'].setAttribute('aria-valuenow',time.toFixed(3));ui['timeline-track'].setAttribute('aria-valuetext',time.toFixed(2)+' 秒');
    if(doc.activeElement!==ui['current-time'])ui['current-time'].value=time.toFixed(3);
    ui['current-time'].max=String(p.duration);ui['current-time'].step=String(1/p.fps);ui['duration-label'].textContent='/ '+p.duration.toFixed(2)+' 秒';
    const key=p.keys.find(k=>k.id===selectedKey);ui['timeline-selection'].textContent=dirtyPose?'当前姿势尚未记录（已保留草稿）':key?'关键帧 · '+key.time.toFixed(3)+' 秒':drafts.size?'保留了 '+drafts.size+' 个未记录姿势':'第 '+Math.round(time*p.fps)+' 帧';
  }
  function renderTimeline(){
    const p=project();if(!p)return;
    ui['key-markers'].replaceChildren();ui['time-ruler'].replaceChildren();
    for(let i=0;i<=10;i++){const label=doc.createElement('span');label.textContent=(p.duration*i/10).toFixed(p.duration<10?1:0);label.style.left=(i*10)+'%';ui['time-ruler'].append(label);}
    for(const key of p.keys){const button=doc.createElement('button');button.type='button';button.className='key-marker';button.dataset.keyId=key.id;button.style.left=(key.time/p.duration*100)+'%';button.setAttribute('aria-label','关键帧 '+key.time.toFixed(3)+' 秒');button.setAttribute('aria-pressed',String(key.id===selectedKey));button.title=key.time.toFixed(3)+' 秒 · 拖动更改时间';ui['key-markers'].append(button);}
    for(const [at]of drafts){if(at>p.duration)continue;const button=doc.createElement('button');button.type='button';button.className='draft-marker';button.dataset.draftTime=String(at);button.style.left=(at/p.duration*100)+'%';button.title='未记录姿势 · '+at.toFixed(3)+' 秒';button.setAttribute('aria-label',button.title);ui['key-markers'].append(button);}
    ui['key-count'].textContent=p.keys.length+' 个关键帧';renderTime();renderControls();
  }
  function renderProject(){
    const p=project();if(!p)return;if(doc.activeElement!==ui['project-name'])ui['project-name'].value=p.name;ui.duration.value=String(p.duration);ui.fps.value=String(p.fps);ui.loop.checked=p.loop;
    if(![...ui.fps.options].some(o=>o.value===String(p.fps))){const option=doc.createElement('option');option.value=String(p.fps);option.textContent=String(p.fps);ui.fps.append(option);ui.fps.value=String(p.fps);}
    renderTimeline();renderInspector();
  }
  function setTime(value,{snap=false,keepSelection=false}={}){
    const p=project();if(!p)return;stashPose();time=clamp(Number(value)||0,0,p.duration);if(snap)time=clamp(Math.round(time*p.fps)/p.fps,0,p.duration);
    const draft=!playing&&drafts.get(draftTime());workingPose=draft?copy(draft):samplePose(p,time);dirtyPose=Boolean(draft);rig.setPose(workingPose);if(!keepSelection)selectedKey=p.keys.find(k=>Math.abs(k.time-time)<1e-5)?.id||null;renderTime();renderInspector();
    for(const button of ui['key-markers'].querySelectorAll('[data-key-id]'))button.setAttribute('aria-pressed',String(button.dataset.keyId===selectedKey));
  }
  function stop(){if(playing)rig?.setPlaying(false);playing=false;win.cancelAnimationFrame(frame);frame=0;renderControls();}
  function play(){
    if(busy||!history)return;if(playing){stop();return;}stashPose();if(dirtyPose)notify('播放已记录动作；未记录姿势已保留');dirtyPose=false;const p=project();if(time>=p.duration)setTime(0);playing=true;lastFrame=0;rig.setPlaying(true);renderControls();frame=win.requestAnimationFrame(tick);
  }
  function tick(now){
    if(!playing||disposed)return;const dt=lastFrame?Math.min((now-lastFrame)/1000,.1):0;lastFrame=now;const p=project();let next=time+dt;
    if(next>=p.duration){if(p.loop)next%=p.duration;else{setTime(p.duration);stop();return;}}setTime(next);frame=win.requestAnimationFrame(tick);
  }
  function commit(value,{retainPose=false,clearDrafts=false}={}){
    stashPose();rememberDrafts();if(clearDrafts)drafts=new Map();previewProject=null;currentProject=history.commit(value);rememberDrafts();redoDraft=null;if(!retainPose){dirtyPose=false;time=Math.min(time,value.duration);workingPose=samplePose(currentProject,time);rig.setPose(workingPose);}renderProject();queueSave();
  }
  function editPose(pose,{fromRig=false,finish=false}={}){
    if(busy||!history)return;stop();workingPose=cleanPose(pose);dirtyPose=true;redoDraft=null;if(!fromRig)rig.setPose(workingPose);renderInspector();renderTime();saveState('姿势待设关键帧','draft');if(finish)finishPoseEdit();
  }
  function finishPoseEdit(){if(!dirtyPose)return;if(ui['auto-key'].checked)recordKey();else{stashPose();renderTimeline();queueSave();}}
  function recordKey(){
    if(busy||!history)return;stop();const next=upsertKey(currentProject,time,workingPose),at=clamp(Math.round(time*next.fps)/next.fps,0,next.duration);time=at;drafts.delete(at);dirtyPose=false;selectedKey=next.keys.find(k=>Math.abs(k.time-at)<1e-5)?.id;commit(next);
  }
  function undo(){
    stop();if(dirtyPose){redoDraft=copy(workingPose);drafts.delete(draftTime());dirtyPose=false;workingPose=samplePose(currentProject,time);rig.setPose(workingPose);}else if(history.canUndo()){rememberDrafts();currentProject=history.undo();restoreDrafts();selectedKey=null;setTime(time);}
    renderProject();queueSave();
  }
  function redo(){
    stop();if(redoDraft){workingPose=redoDraft;redoDraft=null;dirtyPose=true;rig.setPose(workingPose);}else if(history.canRedo()){rememberDrafts();currentProject=history.redo();restoreDrafts();selectedKey=null;setTime(time);}renderProject();queueSave();
  }
  function deleteKey(){if(!selectedKey)return;stop();const next=removeKey(currentProject,selectedKey);selectedKey=null;commit(next);}
  function duplicateKey(){
    const p=currentProject,key=p.keys.find(k=>k.id===selectedKey);if(!key)return;let target=null;
    for(let frame=Math.round(key.time*p.fps)+1;frame<=Math.floor(p.duration*p.fps);frame++){const at=frame/p.fps;if(!p.keys.some(k=>Math.abs(k.time-at)<1e-5)){target=at;break;}}
    if(target===null)for(let frame=Math.round(key.time*p.fps)-1;frame>=0;frame--){const at=frame/p.fps;if(!p.keys.some(k=>Math.abs(k.time-at)<1e-5)){target=at;break;}}
    if(target===null)throw new Error('没有空余帧，请先延长动作');stop();time=target;const next=upsertKey(p,target,key.pose);selectedKey=next.keys.find(k=>Math.abs(k.time-target)<1e-5).id;commit(next);
  }
  function compatible(pose){const names=Object.keys(bindPose);return names.length===Object.keys(pose||{}).length&&names.every(name=>pose[name]);}
  async function loadModel(id,imported=null){
    if(!Object.hasOwn(MODEL_LABELS,id))throw new Error('不支持这个角色');
    if(imported){imported=validateProject(imported);if(imported.modelId!==id)throw new Error('项目与所选角色不匹配');}
    stop();saveNow();const request=++loadToken;setBusy(true,'加载'+MODEL_LABELS[id]);
    try{
      const info=await rig.loadModel(id);if(disposed||request!==loadToken)return;
      const names=Object.keys(info.bindPose);
      if(imported&&!imported.keys.every(key=>Object.keys(key.pose).length===names.length&&names.every(name=>key.pose[name]))){
        if(modelInfo){await rig.loadModel(modelId);if(disposed||request!==loadToken)return;rig.setPose(workingPose);rig.setView(ui['view-select'].value);rig.setSkeletonVisible(ui['show-skeleton'].checked);rig.selectBone(selectedBone);ui['model-select'].value=modelId;setBusy(false);}
        notify('导入项目的骨架不匹配，原项目已保留。',true);return;
      }
      modelId=id;modelInfo=info;bindPose=info.bindPose;initialPose=cleanPose(info.initialPose);selectedBone=null;previewProject=null;dirtyPose=false;redoDraft=null;
      const session=imported?null:sessions.get(id),saved=imported?{project:validateProject(imported),time:0}:session?{project:session.history.current(),time:session.time,drafts:session.drafts}:readSaved(id);
      const restored=saved&&compatible(saved.project.keys[0].pose)?saved:null;
      if(saved&&!restored){backupSaved(id,JSON.stringify(saved));notify('旧项目的骨架已变更，已保留本机恢复副本。',true);}
      history=session&&restored?session.history:createHistory(restored?.project||createProject(id,initialPose,{name:'我的动作'}));currentProject=history.current();draftHistory=session?.draftHistory||new Map();time=clamp(restored?.time||0,0,currentProject.duration);drafts=new Map((restored?.drafts||[]).filter(([at,pose])=>Number.isFinite(at)&&compatible(pose)).map(([at,pose])=>[at,cleanPose(pose)]));const restoredDraft=drafts.get(draftTime());workingPose=restoredDraft?copy(restoredDraft):samplePose(currentProject,time);dirtyPose=Boolean(restoredDraft);
      selectedKey=currentProject.keys.find(k=>Math.abs(k.time-time)<1e-5)?.id||null;ui['model-select'].value=id;ui['view-model'].textContent=MODEL_LABELS[id];ui['bone-search'].value='';
      ui['clip-select'].replaceChildren();for(const clip of info.clips){const option=doc.createElement('option');option.value=clip.name;option.textContent=(CLIP_LABELS[clip.name]||clip.name)+' · '+clip.duration.toFixed(2)+'s';ui['clip-select'].append(option);}
      if(!info.clips.length){const option=doc.createElement('option');option.value='';option.textContent='没有已有动作';ui['clip-select'].append(option);}
      rig.setPose(workingPose);rig.setView(ui['view-select'].value);rig.setSkeletonVisible(ui['show-skeleton'].checked);setBusy(false);renderBones();selectBone(session?.selectedBone||info.bones.find(b=>isHip(b.name))?.name||info.bones[0]?.name);renderProject();
      if(imported){sessions.set(id,{history,time,drafts:[],selectedBone});queueSave();notify('项目已打开');}else if(restored)saveState(dirtyPose?'已恢复未记录姿势':'已恢复本机项目',dirtyPose?'draft':'saved');else if(!saved)queueSave();
    }catch(error){if(error.name==='AbortError'||request!==loadToken)return;busy=true;ui['viewport-loading'].hidden=false;ui['viewport-loading'].dataset.error='true';ui['loading-label'].textContent='角色加载失败';ui['retry-load'].hidden=false;ui['model-select'].disabled=false;ui['import-project'].disabled=false;saveState('加载失败','error');fail(error);}
  }
  async function loadClip(){
    const clip=modelInfo.clips.find(c=>c.name===ui['clip-select'].value);if(!clip)return;if(clip.duration>120)throw new Error('暂支持 120 秒以内的动作');stop();setBusy(true,'载入动作…');
    try{
      const duration=Math.max(.1,clip.duration),fps=currentProject.fps;let next=createProject(modelId,rig.sampleClip(clip.name,0),{name:clip.name,duration,fps});const strideFrames=Math.max(1,Math.round(fps/12));
      for(let frame=strideFrames;frame<=Math.floor(duration*fps);frame+=strideFrames){const at=frame/fps;next=upsertKey(next,at,rig.sampleClip(clip.name,at));if(frame%(strideFrames*24)===0)await new Promise(resolve=>setTimeout(resolve,0));}
      if(Math.abs(next.keys.at(-1).time-duration)>1e-6)next=validateProject({...next,keys:[...next.keys,{id:'clip-end-'+Date.now(),time:duration,pose:rig.sampleClip(clip.name,duration)}]});
      stashPose();rememberDrafts();dirtyPose=false;setBusy(false);time=0;selectedKey=next.keys[0].id;commit(next,{clearDrafts:true});notify('已载入 '+(CLIP_LABELS[clip.name]||clip.name));
    }finally{setBusy(false);}
  }
  function changeSettings(){
    const p=currentProject,duration=Number(ui.duration.value),fps=Number(ui.fps.value);if(duration<p.keys.at(-1).time-1e-6){renderProject();throw new Error('请先移动或删除超出新时长的关键帧');}
    let next=validateProject({...p,name:ui['project-name'].value,duration,fps,loop:ui.loop.checked});
    if(fps!==p.fps){const frames=new Map();for(const key of next.keys){const at=Math.abs(key.time-duration)<1e-6?duration:clamp(Math.round(key.time*fps)/fps,0,duration);frames.set(at,{...key,time:at});}next=validateProject({...next,keys:[...frames.values()]});if(next.keys.length<p.keys.length)notify('同一帧上的关键帧已合并，可撤销');}
    stop();commit(next);
  }
  function pointerTime(event){const bounds=ui['timeline-track'].getBoundingClientRect();return clamp((event.clientX-bounds.left)/Math.max(1,bounds.width),0,1)*project().duration;}
  function timelineDown(event){
    if(busy||!history||event.button>0)return;event.preventDefault();stop();finishPoseEdit();const marker=event.target.closest?.('[data-key-id]'),key=marker&&currentProject.keys.find(k=>k.id===marker.dataset.keyId);
    if(key){selectedKey=key.id;setTime(key.time,{keepSelection:true});drag={kind:'key',id:key.id,baseline:currentProject,startX:event.clientX,changed:false};}
    else{const draftMarker=event.target.closest?.('[data-draft-time]');setTime(draftMarker?Number(draftMarker.dataset.draftTime):pointerTime(event),{snap:true});drag={kind:'scrub'};}
    ui['timeline-track'].setPointerCapture?.(event.pointerId);ui['timeline-track'].focus();renderTimeline();
  }
  function timelineMove(event){
    if(!drag)return;if(drag.kind==='scrub'){setTime(pointerTime(event),{snap:true});return;}
    if(Math.abs(event.clientX-drag.startX)<3&&!drag.changed)return;
    try{previewProject=moveKey(drag.baseline,drag.id,pointerTime(event));drag.changed=true;drag.error=null;time=previewProject.keys.find(k=>k.id===drag.id).time;setTime(time,{keepSelection:true});renderTimeline();}
    catch(error){drag.error=error.message;}
  }
  function timelineUp(event){
    if(!drag)return;const gesture=drag;drag=null;ui['timeline-track'].releasePointerCapture?.(event.pointerId);
    if(gesture.kind==='key'&&gesture.changed&&previewProject){const next=previewProject;previewProject=null;commit(next);}else{previewProject=null;queueSave();}
    if(gesture.error)notify(gesture.error,true);renderTimeline();
  }
  function timelineCancel(){if(!drag)return;previewProject=null;drag=null;setTime(time);renderTimeline();}
  function keyboard(event){
    if(typing(event.target)||busy||!history||event.altKey)return;
    const mod=event.metaKey||event.ctrlKey;
    if(mod&&event.code==='KeyZ'){event.preventDefault();event.shiftKey?redo():undo();}
    else if(mod&&event.code==='KeyY'){event.preventDefault();redo();}
    else if(event.code==='Space'){event.preventDefault();play();}
    else if(event.code==='Delete'||event.code==='Backspace'){if(selectedKey&&currentProject.keys.length>1){event.preventDefault();deleteKey();}}
    else if(event.target===ui['timeline-track']&&['ArrowLeft','ArrowRight'].includes(event.code)){event.preventDefault();stop();setTime(time+(event.code==='ArrowLeft'?-1:1)/project().fps,{snap:true});}
  }
  listen(ui['model-select'],'change',safely(()=>loadModel(ui['model-select'].value)));
  listen(ui['retry-load'],'click',safely(()=>loadModel(ui['model-select'].value)));
  listen(ui['bone-search'],'input',renderBones);
  listen(ui['bone-tree'],'click',event=>{const button=event.target.closest?.('[data-bone]');if(button&&!busy)selectBone(button.dataset.bone);});
  listen(ui['show-skeleton'],'change',()=>rig.setSkeletonVisible(ui['show-skeleton'].checked));listen(ui['view-select'],'change',()=>rig.setView(ui['view-select'].value));
  listen(ui['mode-rotate'],'click',()=>setMode('rotate'));listen(ui['mode-translate'],'click',()=>setMode('translate'));
  for(const [index,axis]of ['x','y','z'].entries()){
    for(const id of ['rotation-'+axis,'rotation-'+axis+'-range']){
      listen(ui[id],'input',safely(()=>{if(!selectedBone||ui[id].value.trim()==='')return;const value=Number(ui[id].value);if(!Number.isFinite(value))return;const angles=getBoneEuler(workingPose,selectedBone,bindPose);angles[index]=clamp(value,-3600,3600);editPose(setBoneEuler(workingPose,selectedBone,angles,bindPose));}));
      listen(ui[id],'change',safely(finishPoseEdit));
    }
    listen(ui['position-'+axis],'input',safely(()=>{if(!isHip(selectedBone)||ui['position-'+axis].value.trim()==='')return;const value=Number(ui['position-'+axis].value);if(!Number.isFinite(value))return;const pose=copy(workingPose);pose[selectedBone].position[index]=bindPose[selectedBone].position[index]+clamp(value,-5,5);editPose(pose);}));listen(ui['position-'+axis],'change',safely(finishPoseEdit));
  }
  listen(ui['reset-bone'],'click',safely(()=>{const pose=copy(workingPose);pose[selectedBone]=cleanTransform(bindPose[selectedBone]);editPose(pose,{finish:true});}));
  listen(ui['focus-bone'],'click',safely(()=>rig.focusSelectedBone?.()));
  listen(ui['reset-pose'],'click',safely(()=>editPose(initialPose,{finish:true})));
  listen(ui['mirror-pose'],'click',safely(()=>editPose(mirrorPose(workingPose,bindPose),{finish:true})));
  listen(ui.undo,'click',safely(undo));listen(ui.redo,'click',safely(redo));listen(ui.play,'click',safely(play));
  for(const [id,destination]of [['to-start',()=>0],['to-end',()=>project().duration],['previous-frame',()=>time-1/project().fps],['next-frame',()=>time+1/project().fps]])listen(ui[id],'click',safely(()=>{stop();finishPoseEdit();setTime(destination(),{snap:true});queueSave();}));
  listen(ui['current-time'],'change',safely(()=>{const requestedTime=ui['current-time'].value;stop();finishPoseEdit();setTime(requestedTime,{snap:true});queueSave();}));
  listen(ui['add-key'],'click',safely(recordKey));listen(ui['delete-key'],'click',safely(deleteKey));listen(ui['duplicate-key'],'click',safely(duplicateKey));
  listen(ui['auto-key'],'change',safely(()=>{if(ui['auto-key'].checked&&dirtyPose)recordKey();}));
  listen(ui['clip-select'],'change',renderControls);listen(ui['load-clip'],'click',safely(loadClip));
  for(const id of ['duration','fps','loop','project-name'])listen(ui[id],'change',safely(changeSettings));
  for(const [type,handler]of [['pointerdown',timelineDown],['pointermove',timelineMove],['pointerup',timelineUp],['pointercancel',timelineCancel]])listen(ui['timeline-track'],type,safely(handler));
  listen(ui['key-markers'],'keydown',safely(event=>{if(['Enter','Space'].includes(event.code)){const id=event.target.dataset.keyId,key=project().keys.find(k=>k.id===id);if(key){event.preventDefault();event.stopPropagation();stop();selectedKey=id;setTime(key.time,{keepSelection:true});}}}));
  listen(doc,'keydown',safely(keyboard));
  listen(ui['import-project'],'click',()=>ui['project-file'].click());
  listen(ui['project-file'],'change',safely(async()=>{const file=ui['project-file'].files?.[0];if(!file)return;try{const imported=await io.importProjectFile(file);await loadModel(imported.modelId,imported);}finally{ui['project-file'].value='';}}));
  for(const [id,exporter]of [['export-project',p=>io.downloadProject(p)],['export-game',p=>io.exportGameClip(p)],['export-glb',p=>io.downloadAnimatedGLB(rig.getSourceBytes(),p)]])listen(ui[id],'click',safely(async()=>{stop();stashPose();if(drafts.size){let next=currentProject;for(const [at,pose]of [...drafts].sort((a,b)=>a[0]-b[0])){if(at>next.duration)throw new Error('存在超出动作时长的未记录姿势，请先延长动作');next=upsertKey(next,at,pose);}commit(next,{clearDrafts:true});}saveNow();await exporter(currentProject);notify(id==='export-glb'?'GLB 已导出，包含模型、贴图和当前动作':'文件已导出');}));
  listen(win,'pagehide',()=>{saveNow();dispose();});listen(win,'blur',()=>{stop();if(dirtyPose)finishPoseEdit();});listen(doc,'visibilitychange',()=>{if(doc.hidden)stop();});
  function dispose(){if(disposed)return;saveNow();stop();disposed=true;loadToken++;clearTimeout(saveTimer);clearTimeout(noticeTimer);for(const remove of listeners)remove();rig?.dispose();}
  try{
    rig=await rigFactory(ui['rig-canvas'],{onSelect:name=>selectBone(name,true),onPoseChange:pose=>editPose(pose,{fromRig:true}),onDragEnd:pose=>editPose(pose,{fromRig:true,finish:true}),onError:fail});
    let savedModel;try{savedModel=storage?.getItem('campus.animator.lastModel');}catch{}await loadModel(Object.hasOwn(MODEL_LABELS,savedModel)?savedModel:'boy');
  }catch(error){setBusy(true,'三维视图无法启动');ui['viewport-loading'].dataset.error='true';fail(error);}
  return{dispose,loadModel,getState:()=>({modelId,project:currentProject?copy(currentProject):undefined,pose:copy(workingPose),selectedBone,selectedKey,time,playing,busy,dirtyPose}),elements:ui};
}

if(typeof document!=='undefined')createAnimatorApp().catch(error=>{const status=document.getElementById('notification');status.hidden=false;status.dataset.error='true';status.textContent=error.message;});
