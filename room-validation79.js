const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function validCommand(command){
 if(!object(command)||typeof command.name!=='string'||!command.name.length||command.name.length>64)return false;
 const args=command.args??[];
 if(!Array.isArray(args)||args.length>3||command.args===null||command.inputSeq!==undefined&&(!Number.isSafeInteger(command.inputSeq)||command.inputSeq<0))return false;
 if(['setMovement','setLook'].includes(command.name)&&!(args.length===2&&args.every(n=>typeof n==='number'&&Number.isFinite(n))))return false;
 if(['setPreference','configureRound'].includes(command.name)&&!(args.length===1&&object(args[0])))return false;
 if(command.name==='startBell'&&(args.length>1||args.length===1&&!object(args[0])))return false;
 return true;
}
export function validVoice(kind,payload){
 if(!object(payload)||JSON.stringify(payload).length>10000)return false;
 if(kind==='mute')return typeof payload.muted==='boolean';
 if(kind==='offer'||kind==='answer')return payload.type===kind&&typeof payload.sdp==='string';
 if(kind==='ice')return typeof payload.candidate==='string'&&(payload.sdpMid==null||typeof payload.sdpMid==='string')&&(payload.sdpMLineIndex==null||Number.isInteger(payload.sdpMLineIndex)&&payload.sdpMLineIndex>=0);
 return false;
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ogg':'audio/ogg','.mp3':'audio/mpeg','.mp4':'video/mp4','.svg':'image/svg+xml'};
