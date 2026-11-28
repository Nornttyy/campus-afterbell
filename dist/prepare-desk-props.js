import {CLASSROOM_PROP_SOURCES,loadPropAssets} from './prop-assets.js?v=campus-83';

// All playable scenes and both editors require the same can. If its first
// delivery fails, retry the original GLB directly before building the scene.
export async function prepareDeskProps(sources,options){
 const result=await loadPropAssets(sources,options);
 if(!result.failed.some(entry=>entry.kind==='drink'))return result;
 const retry=await loadPropAssets({drink:CLASSROOM_PROP_SOURCES.drink});
 if(retry.failed.length)throw new Error('可口可乐模型加载失败，请重试',{cause:retry.failed[0].error});
 return {loaded:[...result.loaded,'drink'],failed:result.failed.filter(entry=>entry.kind!=='drink')};
}
