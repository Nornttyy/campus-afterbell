// Rendering policy only: never changes simulation time, authored motion or meshes.
export function prefersMobileRendering({coarse=false,hover=true,touchPoints=0}={}){
 return coarse&&(!hover||touchPoints>1);
}
export function initialQuality(saved,mobile=false){
 return ['high','low'].includes(saved)?saved:mobile?'low':'high';
}
export function renderPixelRatio({width=1,height=1,dpr=1,quality='high',mobile=false,scale=1}={}){
 const pixels=Math.max(1,width)*Math.max(1,height),budget=mobile?1100000:3600000;
 const native=Math.max(.5,Number.isFinite(dpr)?dpr:1);
 return Math.max(.35,Math.min(native,quality==='low'?1:1.6,Math.sqrt(budget/pixels))*scale);
}
export function createRenderBudget({mobile=false}={}){
 let scale=1,age=0,slow=0,fast=0,cooldown=0;
 return{
  get scale(){return scale;},
  reset(){scale=1;age=slow=fast=cooldown=0;},
  sample(frameMs,{active=true}={}){
   // Ignore background tabs, loading and debugger stalls. Hysteresis avoids
   // resizing render targets every frame or oscillating near a threshold.
   if(!mobile||!active||!Number.isFinite(frameMs)||frameMs<=0||frameMs>150){slow=fast=0;return false;}
   const dt=frameMs/1000;age+=dt;cooldown=Math.max(0,cooldown-dt);
   if(age<3||cooldown>0)return false;
   slow=frameMs>28?Math.min(2,slow+dt):Math.max(0,slow-dt*2);
   fast=frameMs<18?fast+dt:0;
   const next=slow>1.6?Math.max(.72,Math.round((scale-.08)*100)/100):fast>8?Math.min(1,Math.round((scale+.04)*100)/100):scale;
   if(next===scale)return false;
   scale=next;slow=fast=0;cooldown=3;return true;
  }
 };
}
