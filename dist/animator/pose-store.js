import {Quaternion,Euler,Vector3} from '../vendor/three.module.js';

const MODELS=new Set(['boy','girl','ponytail','glasses','teacher']);
const clone=value=>JSON.parse(JSON.stringify(value));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let sequence=0;
const keyId=()=>`key-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
const q=v=>new Quaternion().fromArray(v);
const finiteArray=(value,n,label)=>{
 if(!Array.isArray(value)||value.length!==n||value.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>10000))throw new Error(`${label}数据无效`);
 return value.slice();
};
function cleanPose(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('关键帧缺少骨骼姿势');
 const entries=Object.entries(value);
 if(!entries.length||entries.length>256)throw new Error('骨骼数量不正确');
 return Object.fromEntries(entries.map(([name,t])=>{
  if(!name||name.length>160||['__proto__','constructor','prototype'].includes(name)||!t)throw new Error('骨骼名称无效');
  const position=finiteArray(t.position,3,'关节位置'),rotation=finiteArray(t.quaternion,4,'关节旋转'),scale=finiteArray(t.scale||[1,1,1],3,'关节比例');
  const length=Math.hypot(...rotation);if(length<1e-8)throw new Error('关节旋转不能为零');
  if(scale.some(x=>x<=0||x>1000))throw new Error('关节比例无效');
  return [name,{position,quaternion:rotation.map(x=>x/length),scale}];
 }));
}
export function validateProject(value){
 if(!value||value.version!==1||!MODELS.has(value.modelId))throw new Error('这不是支持的角色动画工程');
 const duration=Number(value.duration),fps=Number(value.fps);
 if(!Number.isFinite(duration)||duration<.1||duration>120)throw new Error('动作时长应在 0.1 到 120 秒之间');
 if(!Number.isInteger(fps)||fps<1||fps>60)throw new Error('帧率应在 1 到 60 之间');
 if(!Array.isArray(value.keys)||!value.keys.length||value.keys.length>3601)throw new Error('工程需要 1 到 3601 个关键帧');
 let names;const ids=new Set();
 const keys=value.keys.map(k=>{
  if(!k||!Number.isFinite(k.time)||k.time<0||k.time>duration+1e-5)throw new Error('关键帧超出了动作时长');
  const pose=cleanPose(k.pose),signature=Object.keys(pose).sort().join('\n');
  if(names!==undefined&&signature!==names)throw new Error('关键帧的骨骼不一致');names=signature;
  const id=typeof k.id==='string'&&k.id.length<160?k.id:keyId();
  if(ids.has(id))throw new Error('关键帧编号重复');ids.add(id);
  return {id,time:clamp(k.time,0,duration),pose};
 }).sort((a,b)=>a.time-b.time);
 if(keys.some((k,i)=>i>0&&k.time-keys[i-1].time<1e-6))throw new Error('同一时间只能有一个关键帧');
 return {version:1,modelId:value.modelId,name:String(value.name||'我的动作').trim().slice(0,80)||'我的动作',duration,fps,loop:value.loop!==false,keys};
}
export function createProject(modelId,pose,{duration=2,name='我的动作',fps=30}={}){
 return validateProject({version:1,modelId,name,duration,fps,loop:true,keys:[{id:keyId(),time:0,pose}]});
}
function blendPose(a,b,amount){
 const out={};for(const name of Object.keys(a)){
  const x=a[name],y=b[name]||x;
  out[name]={position:x.position.map((v,i)=>v+(y.position[i]-v)*amount),quaternion:q(x.quaternion).slerp(q(y.quaternion),amount).normalize().toArray(),scale:x.scale.map((v,i)=>v+(y.scale[i]-v)*amount)};
 }return out;
}
export function samplePose(project,time){
 const keys=project.keys,t=clamp(Number(time)||0,0,project.duration),first=keys[0],last=keys.at(-1);
 if(t<=first.time||keys.length===1)return clone(first.pose);
 for(let i=1;i<keys.length;i++)if(t<=keys[i].time){const a=keys[i-1],b=keys[i];return blendPose(a.pose,b.pose,(t-a.time)/(b.time-a.time));}
 if(project.loop&&last.time<project.duration)return blendPose(last.pose,first.pose,(t-last.time)/(project.duration-last.time));
 return clone(last.pose);
}
function snap(project,time){const n=Number(time);if(!Number.isFinite(n))throw new Error('时间无效');return clamp(Math.round(n*project.fps)/project.fps,0,project.duration);}
export function upsertKey(project,time,pose){
 const out=clone(project),at=snap(out,time),existing=out.keys.find(k=>Math.abs(k.time-at)<1e-5);
 if(existing)existing.pose=cleanPose(pose);else out.keys.push({id:keyId(),time:at,pose:cleanPose(pose)});
 return validateProject(out);
}
export function removeKey(project,id){
 if(project.keys.length===1)throw new Error('至少保留一个关键帧');
 const out=clone(project);out.keys=out.keys.filter(k=>k.id!==id);return validateProject(out);
}
export function moveKey(project,id,time){
 const out=clone(project),key=out.keys.find(k=>k.id===id);if(!key)throw new Error('找不到关键帧');
 const at=snap(out,time);
 if(out.keys.some(k=>k.id!==id&&Math.abs(k.time-at)<1e-5))throw new Error('这个时间已有关键帧');
 key.time=at;return validateProject(out);
}
export function setBoneEuler(pose,boneName,anglesDegrees,bindPose){
 if(!pose[boneName]||!bindPose[boneName])throw new Error('请先选择一个关节');
 finiteArray(anglesDegrees,3,'角度');const out=clone(pose),angles=anglesDegrees.map(v=>v*Math.PI/180);
 out[boneName].quaternion=q(bindPose[boneName].quaternion).multiply(new Quaternion().setFromEuler(new Euler(...angles,'XYZ'))).normalize().toArray();return out;
}
export function getBoneEuler(pose,boneName,bindPose){
 if(!pose[boneName]||!bindPose[boneName])return [0,0,0];
 const delta=q(bindPose[boneName].quaternion).invert().multiply(q(pose[boneName].quaternion));
 const e=new Euler().setFromQuaternion(delta,'XYZ');return [e.x,e.y,e.z].map(v=>v*180/Math.PI);
}
export function mirrorPose(pose,bindPose){
 const out=clone(pose),other=name=>name.includes('Left')?name.replace('Left','Right'):name.includes('Right')?name.replace('Right','Left'):name;
 for(const [target,t]of Object.entries(pose)){
  const source=other(target),a=pose[source],aBind=bindPose[source],bBind=bindPose[target];if(!a||!aBind||!bBind)continue;
  const sourceBasis=q(aBind.parentBasis||[0,0,0,1]),targetBasis=q(bBind.parentBasis||[0,0,0,1]);
  const delta=q(a.quaternion).multiply(q(aBind.quaternion).invert());
  const world=sourceBasis.clone().multiply(delta).multiply(sourceBasis.clone().invert());
  // Reflection in character X flips the Y/Z rotation components, not X.
  const reflected=new Quaternion(world.x,-world.y,-world.z,world.w);
  out[target].quaternion=targetBasis.clone().invert().multiply(reflected).multiply(targetBasis).multiply(q(bBind.quaternion)).normalize().toArray();
  const offset=new Vector3().fromArray(a.position).sub(new Vector3().fromArray(aBind.position)).applyQuaternion(sourceBasis);offset.x=-offset.x;
  out[target].position=offset.applyQuaternion(targetBasis.clone().invert()).add(new Vector3().fromArray(bBind.position)).toArray();
  out[target].scale=t.scale.slice();
 }return out;
}
export function createHistory(initial){
 const encode=p=>JSON.stringify(validateProject(p));let states=[encode(initial)],index=0;
 function trim(){let bytes=states.reduce((n,s)=>n+s.length*2,0);while(states.length>100||bytes>32*1024*1024&&states.length>2){bytes-=states[0].length*2;states.shift();index--;}}
 return {current:()=>JSON.parse(states[index]),commit(project){const text=encode(project);if(text===states[index])return this.current();states=states.slice(0,index+1);states.push(text);index++;trim();return this.current();},undo(){if(index>0)index--;return this.current();},redo(){if(index<states.length-1)index++;return this.current();},canUndo:()=>index>0,canRedo:()=>index<states.length-1};
}
