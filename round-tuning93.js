// Ranges and units are shared by both host forms and the authoritative round.
export const RULE_FIELDS=Object.freeze([
 ['chalkCost','每发粉笔消耗','体力',1,20,8],['chalkInterval','投掷间隔','毫秒',250,2000,720],
 ['chalkStun','粉笔眩晕','秒',1,12,3],['correctGrabGain','抓对恢复','体力',0,50,20],
 ['wrongGrabCost','抓错扣除','体力',0,80,40],['writingRegen','板书每秒恢复','体力',1,20,10],
 ['forwardDrainMs','前进扣一点体力','毫秒',100,1000,200],['backDrainMs','后退扣一点体力','毫秒',200,1800,600],
 ['deskRefill','课桌刷新','秒',1,15,3],['labRefill','机房抽屉刷新','秒',1,15,3],
 ['foodPoints','普通食物得分','点',1,8,1],['lunchPoints','教师便当得分','点',1,15,3],
 ['smokeSeconds','烟雾持续','秒',2,20,7],['smokeDelayMs','烟雾落地等待','毫秒',0,2000,500],
 ['inkSeconds','墨水遮挡时间','秒',1,15,7],['peelSeconds','香蕉皮眩晕','秒',1,12,4]
].map(([key,label,unit,min,max,initial])=>Object.freeze({key,label,unit,min,max,initial})));
export const TUNING_DEFAULTS=Object.freeze(Object.fromEntries(RULE_FIELDS.map(f=>[f.key,f.initial])));
export function validTuning(value){
 if(value===undefined)return true;
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).every(([key,n])=>{
  const f=RULE_FIELDS.find(f=>f.key===key);return !!f&&Number.isInteger(n)&&n>=f.min&&n<=f.max;
 });
}
export const expandTuning=value=>({...TUNING_DEFAULTS,...(validTuning(value)?value:{})});
export function tuningForm(prefix){
 const rows=fields=>fields.map(f=>`<label for="${prefix}-${f.key}"><span>${f.label}<small>${f.unit}</small></span><input id="${prefix}-${f.key}" type="number" min="${f.min}" max="${f.max}" value="${f.initial}" inputmode="numeric"></label>`).join('');
 return '<details class="room-advanced"><summary>更多规则</summary><h4>老师与体力</h4><div>'+rows(RULE_FIELDS.slice(0,8))+'</div><h4>课桌与道具</h4><div>'+rows(RULE_FIELDS.slice(8))+'</div></details>';
}
export function readTuning(query,prefix){
 const data={};for(const f of RULE_FIELDS){
  const input=query('#'+prefix+'-'+f.key);if(!input)continue;
  const n=input.value===''?NaN:Number(input.value);
  if(!Number.isInteger(n)||n<f.min||n>f.max){input.reportValidity?.();return null;}
  if(n!==f.initial)data[f.key]=n;
 }
 return data;
}
