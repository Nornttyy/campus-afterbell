import {PeerRoomHost} from './peer-room-host79.js';
let host,timer,last;
self.onmessage=({data:m})=>{
 if(m.type==='init'){
  host=new PeerRoomHost(m.options,(client,packet)=>postMessage({client,packet}));last=performance.now();
  timer=setInterval(()=>{const now=performance.now();host.tick((now-last)/1000);last=now;},1000/30);return;
 }
 if(m.type==='disconnect'){host?.disconnect(m.client);return;}
 if(m.type==='close'){clearInterval(timer);host?.close();self.close();return;}
 if(m.type!=='request'||!host)return;
 try{postMessage({client:m.client,packet:{type:'reply',id:m.id,result:host.request(m.client,m.path,m.data)}});}
 catch(error){postMessage({client:m.client,packet:{type:'reply',id:m.id,error:{message:error.message,status:error.status||400}}});}
};
