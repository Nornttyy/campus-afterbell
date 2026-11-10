export const CONTROL_KEY='campus-controls-v1';
export const ACTION_KEYS=Object.freeze({forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',interact:'KeyE',return:'KeyQ',crawl:'ShiftLeft',use:'Mouse0',mic:'KeyM',pause:'Escape'});
export const ACTION_LABELS=Object.freeze({forward:'前进',back:'后退',left:'左移',right:'右移',interact:'交互',return:'放回 / 返回',crawl:'爬行',use:'使用',mic:'麦克风',pause:'暂停'});
export const TOUCH_DEFAULTS=Object.freeze({size:74,spacing:14,edge:22,bottom:24,leftHanded:false,sensitivity:1});
const limits={size:[56,96],spacing:[8,28],edge:[8,80],bottom:[12,100],sensitivity:[.5,2]};
export function validBinding(code){return typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Mouse0|Escape)$/.test(code);}
export function normalizeControls(raw={}){
 const keys={...ACTION_KEYS},touch={...TOUCH_DEFAULTS};
 // Apply each proposed mapping through the same swap operation used by the UI.
 // This keeps every action reachable even if stored data contains duplicates.
 for(const action of Object.keys(keys))if(validBinding(raw?.keys?.[action])){
  const code=raw.keys[action];if(code==='Mouse0'&&action!=='use'||code==='Escape'&&action!=='pause')continue;
  const old=keys[action],other=Object.keys(keys).find(k=>k!==action&&keys[k]===code);if(other&&['Mouse0','Escape'].includes(old))continue;keys[action]=code;if(other)keys[other]=old;
 }
 for(const[name,[min,max]]of Object.entries(limits)){const n=Number(raw?.touch?.[name]);if(Number.isFinite(n))touch[name]=Math.min(max,Math.max(min,n));}
 touch.leftHanded=raw?.touch?.leftHanded===true;return{keys,touch};
}
export function readControls(storage){try{return normalizeControls(JSON.parse((storage||globalThis.localStorage)?.getItem(CONTROL_KEY)||'{}'));}catch{return normalizeControls();}}
export function rebindControl(settings,action,code){
 if(!Object.hasOwn(ACTION_KEYS,action)||!validBinding(code)||code==='Mouse0'&&action!=='use'||code==='Escape'&&action!=='pause')return false;
 const old=settings.keys[action],other=Object.keys(settings.keys).find(k=>k!==action&&settings.keys[k]===code);if(other&&['Mouse0','Escape'].includes(old))return false;settings.keys[action]=code;if(other)settings.keys[other]=old;return true;
}
export function actionForCode(code,settings){
 if(code==='Escape')return 'pause';
 const action=Object.keys(settings.keys).find(k=>settings.keys[k]===code);
 if(action)return action;
 if((code==='ShiftLeft'||code==='ShiftRight')&&/^Shift/.test(settings.keys.crawl))return'crawl';return null;
}
export function keyLabel(code){return ({Mouse0:'鼠标左键',Space:'空格',ShiftLeft:'左 Shift',ShiftRight:'右 Shift',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Escape:'Esc'})[code]||String(code||'').replace(/^Key|^Digit/g,'');}
export function applyTouchStyle(element,settings){
 if(!element)return;const t=settings.touch;const set=(key,value)=>element.style.setProperty?.(key,value);
 set('--touch-size',t.size+'px');set('--touch-gap',t.spacing+'px');set('--touch-edge',t.edge+'px');set('--touch-bottom',t.bottom+'px');
 element.dataset&&(element.dataset.leftHanded=String(t.leftHanded));
}
export function setupControlSettings({document=globalThis.document,window=globalThis.window}={}){
 const host=document.querySelector('#control-settings');if(!host)return null;
 let settings=readControls(),pending=null;
 host.innerHTML=`<details class="control-section"><summary>电脑按键</summary><div class="binding-grid">${Object.entries(ACTION_LABELS).map(([id,label])=>`<label>${label}<button type="button" data-bind="${id}" aria-label="修改${label}按键"></button></label>`).join('')}</div><p id="bind-status" role="status"></p></details><details class="control-section"><summary>触屏布局</summary><div class="touch-preview" aria-label="触屏按键布局预览"><div class="preview-stick">移动</div><div class="preview-actions"><i>返回</i><i>交互</i><i>爬行</i><i class="preview-use">使用</i></div></div><div class="touch-adjust">${[['size','按键大小',56,96,1],['spacing','按键间距',8,28,1],['edge','距屏幕边缘',8,80,1],['bottom','距屏幕底部',12,100,1],['sensitivity','转向灵敏度',.5,2,.1]].map(([id,label,min,max,step])=>`<label>${label}<output data-output="${id}"></output><input data-touch="${id}" type="range" min="${min}" max="${max}" step="${step}" aria-label="${label}"></label>`).join('')}<label class="left-handed">左手使用<input data-touch="leftHanded" type="checkbox"></label></div></details><button type="button" id="controls-reset" class="paper-button">恢复默认操作</button>`;
 const buttons=[...host.querySelectorAll('[data-bind]')],inputs=[...host.querySelectorAll('[data-touch]')],status=host.querySelector('#bind-status');
 function save(){try{globalThis.localStorage?.setItem(CONTROL_KEY,JSON.stringify(settings));}catch{}window.dispatchEvent(new Event('campus-controls-change'));render();}
 function render(){for(const b of buttons){b.textContent=pending===b.dataset.bind?'请按键…':keyLabel(settings.keys[b.dataset.bind]);b.setAttribute('aria-pressed',String(pending===b.dataset.bind));b.setAttribute('aria-label',`修改${ACTION_LABELS[b.dataset.bind]}按键，当前${keyLabel(settings.keys[b.dataset.bind])}`);}for(const input of inputs){const id=input.dataset.touch;if(id==='leftHanded')input.checked=settings.touch[id];else{input.value=settings.touch[id];host.querySelector(`[data-output="${id}"]`).textContent=id==='sensitivity'?settings.touch[id].toFixed(1)+'×':Math.round(settings.touch[id])+' px';}}applyTouchStyle(host.querySelector('.touch-preview'),settings);}
 for(const button of buttons)button.addEventListener('click',()=>{pending=pending===button.dataset.bind?null:button.dataset.bind;status.textContent=pending?'按下新按键，Esc 取消。':'';render();});
 function bind(e){if(!pending)return;e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape'){pending=null;status.textContent='';render();return;}if(rebindControl(settings,pending,e.code)){pending=null;status.textContent='已保存';save();}else status.textContent='该按键不可用，请换一个未占用的按键。';}
 document.addEventListener('keydown',bind,true);
 // Rebinding Use back to the mouse is available without capturing UI clicks.
 const mouse=document.createElement('button');mouse.type='button';mouse.className='mouse-use-reset';mouse.textContent='使用：鼠标左键';mouse.addEventListener('click',()=>{rebindControl(settings,'use','Mouse0');pending=null;save();});host.querySelector('.binding-grid').append(mouse);
 for(const input of inputs)input.addEventListener('input',()=>{settings.touch[input.dataset.touch]=input.type==='checkbox'?input.checked:Number(input.value);save();});
 host.querySelector('#controls-reset').addEventListener('click',()=>{settings=normalizeControls();pending=null;status.textContent='已恢复默认';save();});
 document.querySelector('#settings-dialog')?.addEventListener('close',()=>{pending=null;status.textContent='';render();});render();return{dispose(){document.removeEventListener('keydown',bind,true);}};
}
