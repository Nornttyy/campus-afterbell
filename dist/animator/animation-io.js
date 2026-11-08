import {validateProject,samplePose} from './pose-store.js';

const JSON_CHUNK=0x4e4f534a,BIN_CHUNK=0x004e4942,MAX_PROJECT_BYTES=16*1024*1024;
const encoder=new TextEncoder(),decoder=new TextDecoder();
const validModels=new Set(['boy','girl','ponytail','glasses','teacher']);
// This is the same node-name sanitisation used by Three PropertyBinding.
const alias=name=>String(name).replace(/\s/g,'_').replace(/[\[\]\.:/]/g,'');
const align=n=>Math.ceil(n/4)*4;

function parseGLB(input){
 let bytes;
 if(input instanceof ArrayBuffer)bytes=new Uint8Array(input);
 else if(ArrayBuffer.isView(input))bytes=new Uint8Array(input.buffer,input.byteOffset,input.byteLength);
 else throw new Error('没有可导出的模型，请先选择一个角色。');
 if(bytes.byteLength<28)throw new Error('模型文件不完整，无法导出。');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw new Error('模型不是有效的 GLB 2.0 文件。');
 if(view.getUint32(8,true)!==bytes.byteLength)throw new Error('模型文件长度不正确，请重新载入角色。');
 let json=null,bin=null;const unknown=[];
 for(let offset=12;offset<bytes.length;){
  if(offset+8>bytes.length)throw new Error('模型数据块不完整。');
  const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
  if(length%4||offset+length>bytes.length)throw new Error('模型数据块长度不正确。');
  const data=bytes.subarray(offset,offset+length);offset+=length;
  if(type===JSON_CHUNK){
   if(json)throw new Error('模型包含重复的 JSON 数据块。');
   try{json=JSON.parse(decoder.decode(data).trim());}catch{throw new Error('模型描述无法读取。');}
  }else if(type===BIN_CHUNK){if(bin)throw new Error('模型包含重复的二进制数据块。');bin=data;}
  else unknown.push({type,data});
 }
 if(!json||!bin||json.asset?.version!=='2.0'||!Array.isArray(json.nodes)||!Array.isArray(json.skins))throw new Error('模型缺少骨骼或蒙皮数据。');
 if(json.buffers?.length!==1||json.buffers[0].uri||json.buffers[0].byteLength>bin.length)throw new Error('模型需要一个完整的内嵌数据包，请重新载入角色。');
 return{json,bin,unknown};
}

function serialiseGLB(json,binParts,unknown=[]){
 const binaryLength=binParts.reduce((n,p)=>n+p.byteLength,0),paddedBinaryLength=align(binaryLength);
 json.buffers[0].byteLength=binaryLength;
 const raw=encoder.encode(JSON.stringify(json)),jsonLength=align(raw.length);
 const total=12+8+jsonLength+8+paddedBinaryLength+unknown.reduce((n,c)=>n+8+c.data.length,0);
 if(total>0xffffffff)throw new Error('动画文件太大，请减少关键帧。');
 const output=new ArrayBuffer(total),bytes=new Uint8Array(output),view=new DataView(output);
 view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,total,true);
 view.setUint32(12,jsonLength,true);view.setUint32(16,JSON_CHUNK,true);bytes.fill(32,20,20+jsonLength);bytes.set(raw,20);
 let offset=20+jsonLength;view.setUint32(offset,paddedBinaryLength,true);view.setUint32(offset+4,BIN_CHUNK,true);offset+=8;
 for(const part of binParts){bytes.set(part,offset);offset+=part.byteLength;}
 offset+=paddedBinaryLength-binaryLength;
 for(const chunk of unknown){view.setUint32(offset,chunk.data.length,true);view.setUint32(offset+4,chunk.type,true);bytes.set(chunk.data,offset+8);offset+=8+chunk.data.length;}
 return output;
}

function boneMap(json,project){
 const role=json.asset?.extras?.characters40?.role;
 if(!validModels.has(role))throw new Error('无法识别源模型，请在编辑器中重新选择角色。');
 if(role!==project.modelId)throw new Error(`工程属于 ${project.modelId}，当前模型是 ${role}。请选择对应角色后再导出。`);
 const required=new Set(json.skins.flatMap(s=>s.joints||[])),eligible=new Set(required),visit=i=>{
  for(const child of json.nodes[i]?.children||[])if(!eligible.has(child)){eligible.add(child);visit(child);}
 };
 for(const i of required)visit(i);
 const exact=new Map(),aliases=new Map();
 for(const i of eligible){
  const name=json.nodes[i]?.name;if(!name)continue;
  if(exact.has(name))exact.set(name,null);else exact.set(name,i);
  const key=alias(name);if(aliases.has(key))aliases.set(key,null);else aliases.set(key,i);
 }
 const mapping=new Map(),seen=new Set();
 for(const name of Object.keys(project.keys[0].pose)){
  const i=exact.has(name)?exact.get(name):aliases.get(alias(name));
  if(i===null)throw new Error(`骨骼名称“${name}”有重复，无法确定导出目标。`);
  if(i===undefined)throw new Error(`当前模型没有骨骼“${name}”，工程与角色不匹配。`);
  if(seen.has(i))throw new Error(`工程中重复引用了骨骼“${name}”。`);
  mapping.set(name,i);seen.add(i);
 }
 for(const i of required)if(!seen.has(i))throw new Error(`工程缺少骨骼“${json.nodes[i]?.name||i}”，请重新载入完整动作。`);
 for(const key of project.keys)for(const name of mapping.keys())if(!key.pose[name])throw new Error(`第 ${key.time} 秒缺少骨骼“${name}”的姿势。`);
 return mapping;
}

function matrixToTRS(node){
 if(!node.matrix)return;
 const m=node.matrix;if(m.length!==16||!m.every(Number.isFinite))throw new Error(`骨骼“${node.name}”的变换矩阵不正确。`);
 let sx=Math.hypot(m[0],m[1],m[2]),sy=Math.hypot(m[4],m[5],m[6]),sz=Math.hypot(m[8],m[9],m[10]);
 const det=m[0]*(m[5]*m[10]-m[9]*m[6])-m[4]*(m[1]*m[10]-m[9]*m[2])+m[8]*(m[1]*m[6]-m[5]*m[2]);
 if(det<0)sx=-sx;
 if(Math.min(Math.abs(sx),sy,sz)<1e-9)throw new Error(`骨骼“${node.name}”被缩放到零，不能导出。`);
 const x=[m[0]/sx,m[1]/sx,m[2]/sx],y=[m[4]/sy,m[5]/sy,m[6]/sy],z=[m[8]/sz,m[9]/sz,m[10]/sz],dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
 if(Math.max(Math.abs(dot(x,y)),Math.abs(dot(x,z)),Math.abs(dot(y,z)))>1e-5)throw new Error(`骨骼“${node.name}”含剪切变换，不能直接导出动画。`);
 const a=x[0],b=y[0],c=z[0],d=x[1],e=y[1],f=z[1],g=x[2],h=y[2],i=z[2],trace=a+e+i;let q;
 if(trace>0){const s=2*Math.sqrt(trace+1);q=[(h-f)/s,(c-g)/s,(d-b)/s,s/4];}
 else if(a>e&&a>i){const s=2*Math.sqrt(1+a-e-i);q=[s/4,(b+d)/s,(c+g)/s,(h-f)/s];}
 else if(e>i){const s=2*Math.sqrt(1+e-a-i);q=[(b+d)/s,s/4,(f+h)/s,(c-g)/s];}
 else{const s=2*Math.sqrt(1+i-a-e);q=[(c+g)/s,(f+h)/s,s/4,(d-b)/s];}
 node.translation=[m[12],m[13],m[14]];node.rotation=q;node.scale=[sx,sy,sz];delete node.matrix;
}

/** Pure track data; the same keys can be consumed later by the game adapter. */
export function createAnimationTracks(value){
 const project=validateProject(value),keys=project.keys.map(k=>({time:k.time,pose:k.pose}));
 if(keys[0].time>0)keys.unshift({time:0,pose:samplePose(project,0)});
 if(keys.at(-1).time<project.duration)keys.push({time:project.duration,pose:samplePose(project,project.duration)});
 // glTF stores time as float32. Imported JSON can contain distinct doubles
 // that collapse to the same sample time and would make an invalid sampler.
 if(keys.some((key,i)=>i>0&&Math.fround(key.time)<=Math.fround(keys[i-1].time)))throw new Error('有两个关键帧的时间过于接近，请拉开到至少一帧后再导出。');
 const tracks=[];
 for(const name of Object.keys(keys[0].pose))for(const[path,field,size]of[['translation','position',3],['rotation','quaternion',4],['scale','scale',3]]){
  let prior=null;const rows=keys.map(k=>{
   const row=[...k.pose[name][field]];
   if(path==='rotation'&&prior&&row.reduce((n,v,i)=>n+v*prior[i],0)<0)for(let i=0;i<4;i++)row[i]=-row[i];
   prior=row;return row;
  });
  // Static channels need only the two endpoints. This keeps large full-pose
  // projects compact while retaining the same local transform at every time.
  const same=rows.every(row=>row.every((v,i)=>Math.abs(v-rows[0][i])<1e-9));
  const times=same?[0,project.duration]:keys.map(k=>k.time),values=same?[...rows[0],...rows[0]]:rows.flat();
  tracks.push({bone:name,path,itemSize:size,interpolation:'LINEAR',times,values});
 }
 return{name:project.name,modelId:project.modelId,duration:project.duration,fps:project.fps,loop:project.loop,tracks};
}

/** Preserve source buffers and append only animation tracks. Never re-export skin. */
export function buildAnimatedGLB(sourceBytes,value){
 const project=validateProject(value),{json,bin,unknown}=parseGLB(sourceBytes),mapping=boneMap(json,project),clip=createAnimationTracks(project);
 const parts=[bin];let offset=bin.length;json.bufferViews||=[];json.accessors||=[];
 const append=(values,type)=>{
  const pad=align(offset)-offset;if(pad){parts.push(new Uint8Array(pad));offset+=pad;}
  const floats=new Float32Array(values),bytes=new Uint8Array(floats.buffer),view=json.bufferViews.length;
  json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});parts.push(bytes);offset+=bytes.length;
  const itemSize=type==='SCALAR'?1:type==='VEC4'?4:3,accessor={bufferView:view,componentType:5126,count:floats.length/itemSize,type};
  if(type==='SCALAR'){accessor.min=[floats[0]];accessor.max=[floats.at(-1)];}
  const index=json.accessors.length;json.accessors.push(accessor);return index;
 };
 const animation={name:clip.name,samplers:[],channels:[],extras:{campusAnimator:{version:1,modelId:project.modelId,loop:project.loop,fps:project.fps,duration:project.duration}}},timeAccessors=new Map();
 for(const track of clip.tracks){
  const node=mapping.get(track.bone);matrixToTRS(json.nodes[node]);const timesKey=track.times.join(',');
  if(!timeAccessors.has(timesKey))timeAccessors.set(timesKey,append(track.times,'SCALAR'));
  const output=append(track.values,track.itemSize===4?'VEC4':'VEC3'),sampler=animation.samplers.length;
  animation.samplers.push({input:timeAccessors.get(timesKey),output,interpolation:'LINEAR'});animation.channels.push({sampler,target:{node,path:track.path}});
 }
 json.animations=(json.animations||[]).filter(a=>a.name!==project.name);json.animations.push(animation);
 json.asset.extras||={};json.asset.extras.campusAnimator={version:1,modelId:project.modelId,clip:project.name,sourceBinaryBytes:bin.length};
 return serialiseGLB(json,parts,unknown);
}

function safeName(name){return String(name||'我的动作').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/g,'').slice(0,80)||'我的动作';}
function download(data,mime,name){
 if(typeof document==='undefined'||typeof URL.createObjectURL!=='function')throw new Error('下载功能需要在浏览器中打开编辑器。');
 const blob=new Blob([data],{type:mime}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.hidden=true;document.body.append(link);
 try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return name;
}
export function downloadProject(value){const p=validateProject(value);return download(JSON.stringify(p,null,2),'application/json',`${safeName(p.name)}-${p.modelId}.animation.json`);}
export async function importProjectFile(file){
 if(!file||typeof file.text!=='function')throw new Error('请选择动画工程 JSON 文件。');
 if(Number.isFinite(file.size)&&file.size>MAX_PROJECT_BYTES)throw new Error('工程文件超过 16 MB，请减少关键帧后再导入。');
 let text;try{text=await file.text();}catch{throw new Error('工程文件读取失败，请重新选择文件。');}
 if(encoder.encode(text).byteLength>MAX_PROJECT_BYTES)throw new Error('工程文件超过 16 MB，请减少关键帧后再导入。');
 let data;try{data=JSON.parse(text);}catch{throw new Error('这不是有效的动画工程 JSON 文件。');}
 return validateProject(data);
}
export function downloadAnimatedGLB(sourceBytes,value){const p=validateProject(value),bytes=buildAnimatedGLB(sourceBytes,p);return download(bytes,'model/gltf-binary',`${safeName(p.name)}-${p.modelId}.glb`);}
export function exportGameClip(value){const p=validateProject(value),clip=createAnimationTracks(p);return download(JSON.stringify({format:'campus-animation-clip',version:1,...clip},null,2),'application/json',`${safeName(p.name)}-${p.modelId}.clip.json`);}
