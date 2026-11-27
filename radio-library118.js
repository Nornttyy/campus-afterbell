const storeName='recordings';
const changed='campus-radio-library-change';
const titles={'track-window':'雨爱','track-weekend':'朋友的酒'};
let connection;

function openLibrary(){
  if(!connection)connection=new Promise((resolve,reject)=>{
    const req=indexedDB.open('campus-afterbell-radio',1);
    req.onupgradeneeded=()=>req.result.createObjectStore(storeName);
    req.onsuccess=()=>{
      const db=req.result;
      db.onversionchange=()=>{db.close();connection=null;};
      resolve(db);
    };
    req.onerror=()=>reject(req.error);
  }).catch(error=>{connection=null;throw error;});
  return connection;
}

async function access(mode,run){
  const db=await openLibrary();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(storeName,mode);
    const request=run(tx.objectStore(storeName));
    tx.oncomplete=()=>resolve(request?.result);
    tx.onabort=()=>reject(tx.error||new Error('保存失败'));
  });
}

export function readRadioRecording(id){
  return access('readonly',store=>store.get(id));
}

function trackFor(file){
  const name=file.name.normalize('NFKC').toLowerCase();
  if(/雨[爱愛]|rain-sifeng/.test(name))return 'track-window';
  if(/朋友的酒|friends-dj/.test(name))return 'track-weekend';
  throw new Error('请选择文件名含「雨爱」或「朋友的酒」的录音');
}

function checkAudio(file){
  return new Promise((resolve,reject)=>{
    const media=document.createElement('audio'),url=URL.createObjectURL(file);
    const timer=setTimeout(()=>finish(false),15000);
    function finish(ok){
      clearTimeout(timer);media.onloadedmetadata=media.onerror=null;
      media.removeAttribute('src');media.load();URL.revokeObjectURL(url);
      if(ok)resolve();else reject(new Error('无法播放这份录音，请选择有效的音频文件'));
    }
    media.preload='metadata';
    media.onloadedmetadata=()=>finish(Number.isFinite(media.duration)&&media.duration>0);
    media.onerror=()=>finish(false);
    media.src=url;
  });
}

function bindSettings(panel){
  const choose=panel.querySelector('[data-choose]'),input=panel.querySelector('input');
  const clear=panel.querySelector('[data-clear]'),status=panel.querySelector('output');
  async function refresh(){
    const keys=await access('readonly',store=>store.getAllKeys());
    clear.hidden=!keys.length;
    status.textContent=keys.length?'本机已导入：'+keys.map(k=>titles[k]).join('、'):'可导入《雨爱》和《朋友的酒》';
  }
  async function edit(callback){
    choose.disabled=clear.disabled=true;
    try{await callback();document.dispatchEvent(new Event(changed));await refresh();}
    catch(error){status.textContent=error.message||'浏览器无法保存录音';}
    finally{input.value='';choose.disabled=clear.disabled=false;}
  }
  choose.onclick=()=>input.click();
  input.onchange=()=>{
    const files=Array.from(input.files);
    if(!files.length)return;
    void edit(async()=>{
      const entries=files.map(file=>[trackFor(file),file]);
      if(new Set(entries.map(([id])=>id)).size!==entries.length)throw new Error('每首歌请选择一份录音');
      await Promise.all(files.map(checkAudio));
      await access('readwrite',store=>{for(const [id,file] of entries)store.put(file,id);});
    });
  };
  clear.onclick=()=>edit(()=>access('readwrite',store=>store.clear()));
  refresh().catch(()=>{status.textContent='当前浏览器无法保存本机录音';choose.disabled=true;});
}

const panel=globalThis.document?.getElementById('radio-import');
if(panel)bindSettings(panel);
