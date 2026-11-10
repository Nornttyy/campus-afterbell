const clone=value=>JSON.parse(JSON.stringify(value));
export function createAnimationHistory(initial,limit=80){
 let entries=[clone(initial)],index=0;
 return {commit(value){const next=clone(value);if(JSON.stringify(entries[index])===JSON.stringify(next))return false;entries=entries.slice(0,index+1);entries.push(next);if(entries.length>limit)entries.shift();index=entries.length-1;return true;},undo(){if(index>0)index--;return clone(entries[index]);},redo(){if(index<entries.length-1)index++;return clone(entries[index]);},get canUndo(){return index>0;},get canRedo(){return index<entries.length-1;}};
}
export function putAnimationFrame(clip,time,pose){
 let t=Math.min(clip.duration,Math.round(Math.max(0,Math.min(clip.duration,time))*1000)/1000);
 const index=clip.keyframes.findIndex(f=>Math.abs(f.time-t)<.0011);if(index<0&&clip.keyframes.length>=128)throw new RangeError('每段最多 128 个关键帧，请先删掉不需要的帧');if(index>=0&&clip.keyframes[index].time===0)t=0;const frame={time:t,left:clone(pose.left),right:clone(pose.right)};
 if(index>=0)clip.keyframes[index]=frame;else clip.keyframes.push(frame);
 clip.keyframes.sort((a,b)=>a.time-b.time);return t;
}
export function moveAnimationFrame(clip,from,to){
 const index=clip.keyframes.findIndex(f=>Math.abs(f.time-from)<.0011);if(index<0)return null;if(clip.keyframes[index].time===0)return 0;
 const frame=clip.keyframes.splice(index,1)[0];return putAnimationFrame(clip,to,frame);
}
export function retimeAnimationClip(clip,duration){
 const next=Math.max(.2,Math.min(20,Number(duration)||clip.duration)),ratio=next/clip.duration;
 clip.keyframes.forEach(f=>f.time*=ratio);clip.duration=next;return ratio;
}
// Reflection around the character's sagittal plane: x position and the Y/Z
// rotation angles change sign. Fingers and the X rotation retain their pose.
export function mirrorAnimationHand(hand){return {...clone(hand),position:[-hand.position[0],hand.position[1],hand.position[2]],rotation:[hand.rotation[0],-hand.rotation[1],-hand.rotation[2]]};}

export function completeAnimationDocument(document,defaults){return {...clone(defaults),...clone(document),clips:{...clone(defaults.clips),...clone(document.clips)}};}
