// Optional delta transport. Full keyframes remain valid for older clients;
// every patch refers to one exact applied sequence and never merges prototypes.
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const unsafe=k=>k==='__proto__'||k==='constructor'||k==='prototype';
export function diffNetworkState(previous,next){
 if(Object.is(previous,next))return null;
 if(Array.isArray(previous)&&Array.isArray(next)){
  const changes={};for(let i=0;i<next.length;i++){const diff=diffNetworkState(previous[i],next[i]);if(diff)changes[i]=diff;}
  return previous.length!==next.length||Object.keys(changes).length?[2,next.length,changes]:null;
 }
 if(record(previous)&&record(next)){
  const changes={},removed=[];for(const k of Object.keys(next)){if(unsafe(k))throw new Error('Invalid state field');const diff=diffNetworkState(previous[k],next[k]);if(diff)changes[k]=diff;}
  for(const k of Object.keys(previous))if(!Object.hasOwn(next,k))removed.push(k);
  return removed.length||Object.keys(changes).length?[1,changes,removed]:null;
 }
 return[0,next];
}
export function applyNetworkDelta(previous,patch,depth=0){
 if(depth>24||!Array.isArray(patch)||!Number.isInteger(patch[0]))throw new Error('Invalid state patch');
 if(patch[0]===0){if(patch.length!==2)throw new Error('Invalid state patch');return patch[1];}
 if(patch[0]===1){
  if(patch.length!==3||!record(previous)||!record(patch[1])||!Array.isArray(patch[2])||patch[2].some(k=>typeof k!=='string'||unsafe(k)))throw new Error('Invalid object patch');
  const next={...previous};for(const k of patch[2])delete next[k];for(const[k,value]of Object.entries(patch[1])){if(unsafe(k))throw new Error('Invalid state field');next[k]=applyNetworkDelta(previous[k],value,depth+1);}return next;
 }
 if(patch[0]===2){
  const length=patch[1];if(patch.length!==3||!Array.isArray(previous)||!Number.isInteger(length)||length<0||length>4096||!record(patch[2]))throw new Error('Invalid array patch');
  const next=previous.slice(0,length);next.length=length;for(const[k,value]of Object.entries(patch[2])){if(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=length)throw new Error('Invalid array index');next[k]=applyNetworkDelta(previous[k],value,depth+1);}for(let i=0;i<length;i++)if(!Object.hasOwn(next,i))throw new Error('Missing array entry');return next;
 }
 throw new Error('Invalid patch operation');
}
