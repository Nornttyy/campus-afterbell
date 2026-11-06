// Mouse capture and Pointer Lock cannot be active together. Listen for mouse
// down/up at document level so acquiring lock never cancels a held action.
export function bindHeldUseInput({canvas,document:doc,window:win,canInput,onHold,onRelease,onLock}){
  let mouseHeld=false,touchId=null,wasLocked=doc.pointerLockElement===canvas;
  const listeners=[];
  const listen=(target,type,fn)=>{target.addEventListener(type,fn);listeners.push(()=>target.removeEventListener(type,fn));};
  const release=()=>{mouseHeld=false;touchId=null;onRelease();};
  listen(doc,'mousedown',e=>{
    if(e.button!==0||!canInput()||(doc.pointerLockElement!==canvas&&e.target!==canvas))return;
    e.preventDefault();canvas.focus({preventScroll:true});mouseHeld=true;onHold(true);onLock();
  });
  listen(doc,'mouseup',e=>{if(e.button===0&&mouseHeld){mouseHeld=false;onHold(false);}});
  listen(canvas,'pointerdown',e=>{
    if(e.pointerType==='mouse'||e.button!==0||!canInput())return;
    e.preventDefault();touchId=e.pointerId;onHold(true);
    try{canvas.setPointerCapture?.(e.pointerId);}catch{}
  });
  const touchEnd=e=>{if(e.pointerType!=='mouse'&&e.pointerId===touchId){touchId=null;onHold(false);}};
  const touchCancel=e=>{if(e.pointerType!=='mouse'&&e.pointerId===touchId)release();};
  listen(doc,'pointerup',touchEnd);listen(canvas,'pointercancel',touchCancel);listen(canvas,'lostpointercapture',touchCancel);
  listen(doc,'pointerlockchange',()=>{
    const locked=doc.pointerLockElement===canvas;
    if(wasLocked&&!locked)release();wasLocked=locked;
  });
  listen(win,'blur',release);
  return{release,dispose(){release();for(const remove of listeners)remove();}};
}
