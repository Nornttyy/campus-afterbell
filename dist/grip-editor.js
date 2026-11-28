import {GRIP_GROUPS,GRIP_ITEMS,FINGERS,newHandGrip,readGrips,gripSides,applyGripEdits,validateGripSet} from './item-grips.js?v=campus-117&rev=171';
import {createGripPreview} from './grip-preview.js?v=campus-117&rev=171';

const $=id=>document.getElementById(id),draftKey='campus.gripDraft.v1';
let edits={},id='drink',side='left',finger='Thumb',number=1,mode='joints',preview,ready=false;
let persisted=true;const undo=[],redo=[];
function notice(text,error=false){$('notice').textContent=text;$('notice').dataset.error=String(error);}
try{const raw=localStorage.getItem(draftKey);if(raw)edits=validateGripSet(JSON.parse(raw)).items;}catch{notice('草稿读取失败，可导入握姿备份。',true);}
const entry=item=>edits[item]??readGrips().items[item];
const joint=()=>finger+number;
const current=()=>entry(id)?.[side]??newHandGrip();
const values=()=>mode==='joints'?current().joints[joint()]??[0,0,0]:current()[mode];
function persist(){try{localStorage.setItem(draftKey,JSON.stringify({version:1,items:edits}));persisted=true;}catch{persisted=false;notice('浏览器未能保存草稿，请导出 JSON 备份。',true);}}
function record(){const before=JSON.stringify(edits);if(undo.at(-1)!==before)undo.push(before);if(undo.length>100)undo.shift();redo.length=0;}
function updateButtons(){ $('undo').disabled=!undo.length;$('redo').disabled=!redo.length;$('apply').disabled=!Object.keys(edits).length||!ready;}
function change(next){
  const copy=structuredClone(current());if(mode==='joints')copy.joints[joint()]=next;else copy[mode]=next;
  edits[id]={...entry(id),[side]:copy};persist();preview?.apply();sync();
  if(persisted)notice('握姿已存为草稿。点击「应用到本机游戏」即可试玩。');
}
function history(from,to){if(!from.length)return;to.push(JSON.stringify(edits));edits=JSON.parse(from.pop());persist();preview?.apply();sync();}
function choice(parent,title,key,handler){const b=document.createElement('button');b.type='button';b.textContent=title;b.dataset.key=key;b.onclick=handler;parent.append(b);return b;}
for(const [group,list] of Object.entries(GRIP_GROUPS)){const g=document.createElement('optgroup');g.label=group;for(const [k,n] of Object.entries(list))g.append(new Option(n,k));$('item').append(g);}
for(const [key,label] of Object.entries(FINGERS))choice($('fingers'),label,key,()=>{finger=key;sync();});
for(const [i,name] of ['指根','中节','指尖'].entries())choice($('joints'),name,String(i+1),()=>{number=i+1;sync();});
const axes=['X','Y','Z'].map((axis,i)=>{
  const row=document.createElement('label');row.className='axis';
  const label=document.createElement('span');label.textContent=axis;
  const slider=document.createElement('input'),field=document.createElement('input'),unit=document.createElement('span');
  slider.type='range';field.type='number';unit.className='unit';slider.setAttribute('aria-label',axis+' 轴滑杆');field.setAttribute('aria-label',axis+' 轴数值');
  for(const input of [slider,field]){
    input.step='1';
    const commit=()=>{const raw=input.valueAsNumber;if(!Number.isFinite(raw))return;const n=Math.round(Math.max(+input.min,Math.min(+input.max,raw)));const v=values().slice();if(v[i]===n)return;v[i]=n;change(v);};
    if(input===slider){input.onpointerdown=record;input.onkeydown=e=>{if(['Home','End','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown'].includes(e.key)&&!e.repeat)record();};input.oninput=commit;}
    else input.onchange=()=>{record();commit();sync();};
  }
  row.append(label,slider,field,unit);$('axes').append(row);return {slider,field,unit};
});
function pressed(parent,value){for(const b of parent.querySelectorAll('button'))b.setAttribute('aria-pressed',String((b.dataset.key??b.dataset.mode)===value));}
function sync(){
  const sides=gripSides(id);$('side').replaceChildren(...sides.map(s=>new Option(s==='left'?'左手':'右手',s)));
  $('side').value=side;$('side').disabled=sides.length===1;$('item').value=id;
  $('digits').hidden=mode!=='joints';pressed($('mode'),mode);pressed($('fingers'),finger);pressed($('joints'),String(number));
  $('axis-help').textContent=mode==='joints'?'点击模型上的关节点，或选择上方指节，再转动三个轴。':mode==='position'?'沿手掌自身的三个方向移动，可用数值框微调到毫米。':'调整整只手相对于物品的角度。';
  const v=values(),limit=mode==='position'?300:180;
  for(const [i,{slider,field,unit}] of axes.entries()){for(const input of [slider,field]){input.min=-limit;input.max=limit;input.value=v[i];input.disabled=!ready;}unit.textContent=mode==='position'?'mm':'°';}
  preview?.select(side,joint(),$('markers').checked&&mode==='joints');updateButtons();
}
let attempt=0;
async function selectItem(item){
  const token=++attempt;id=item;side=gripSides(id)[0];ready=false;$('loading').hidden=false;$('loading').textContent='正在载入'+GRIP_ITEMS[id]+'…';sync();
  try{if(await preview.show(item)&&token===attempt){ready=true;$('loading').hidden=true;document.body.dataset.ready=item;sync();}}
  catch(err){if(token===attempt){$('loading').textContent='模型载入失败，请刷新重试';notice(err.message,true);}}
}
$('item').onchange=()=>selectItem($('item').value);$('side').onchange=()=>{side=$('side').value;sync();};
for(const b of $('mode').querySelectorAll('button'))b.onclick=()=>{mode=b.dataset.mode;sync();};
$('markers').onchange=sync;$('reset-view').onclick=()=>preview?.center();
$('zero').onclick=()=>{record();change([0,0,0]);};
$('undo').onclick=()=>history(undo,redo);$('redo').onclick=()=>history(redo,undo);
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','SELECT'].includes(e.target.tagName)){e.preventDefault();e.shiftKey?history(redo,undo):history(undo,redo);}});
$('apply').onclick=()=>{try{const count=Object.keys(edits).length;applyGripEdits(edits);edits={};undo.length=redo.length=0;persist();sync();notice('已将 '+count+' 件物品的握姿应用到这个浏览器。');}catch(err){notice('应用失败，请导出备份。'+err.message,true);}};
$('export').onclick=()=>{const set=validateGripSet({version:1,items:{...readGrips().items,...edits}}),blob=new Blob([JSON.stringify(set,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='校园物品握姿.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=validateGripSet(JSON.parse(await file.text()));record();edits={...edits,...data.items};persist();preview?.apply();sync();notice('已导入 '+Object.keys(data.items).length+' 件物品的握姿草稿。');}catch(err){notice(err.message,true);}e.target.value='';};
try{preview=createGripPreview($('view'),entry,selection=>{side=selection.side;finger=selection.finger;number=selection.n;mode='joints';sync();});selectItem(id);}catch(err){$('loading').textContent='无法启动 3D 预览';notice(err.message,true);}
