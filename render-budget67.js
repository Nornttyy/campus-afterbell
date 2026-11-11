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
// Keep the selected rendering resolution fixed under load. Optimizations must
// remove redundant work, not quietly blur the image after a slow frame.
export function createRenderBudget(){
 return{get scale(){return 1;},reset(){},sample(){return false;}};
}
