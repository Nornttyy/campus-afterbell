const PREFIX='campus-afterbell-81-';
const REGISTRATION_TIMEOUT=10000, JOIN_TIMEOUT=18000;
const transient=new Set(['network','server-error','socket-error','socket-closed','timeout','connection-closed']);

function failure(type,joining=false){
  let message='联机服务暂时连不上，请稍后重试。';
  if(type==='peer-unavailable')message='没找到这个房间，请确认六位房间号和房主是否在线。';
  else if(type==='unavailable-id')message='房间号暂时无法使用，请再试一次。';
  else if(type==='browser-incompatible')message='此浏览器不支持联机，请使用最新版 Chrome 或 Safari。';
  else if(joining)message='未能连到房主，请确认双方网络可用后重试。';
  return Object.assign(new Error(message),{type});
}

function cancelled(){return new DOMException('已取消联机','AbortError');}

function waitForOpen(peer,target,signal){
  const joining=target!==peer;
  return new Promise((resolve,reject)=>{
    const opened=()=>finish();
    const errored=error=>finish(failure(error?.type||'network',joining));
    const disconnected=()=>finish(failure('network',joining));
    const closed=()=>finish(failure('connection-closed',joining));
    const abort=()=>finish(cancelled());
    const timer=setTimeout(()=>finish(failure('timeout',joining)),joining?JOIN_TIMEOUT:REGISTRATION_TIMEOUT);
    function finish(error){
      clearTimeout(timer);
      target.off('open',opened);target.off('close',closed);
      peer.off('error',errored);peer.off('disconnected',disconnected);
      if(joining)target.off('error',errored);
      signal?.removeEventListener('abort',abort);
      if(error)reject(error);else resolve();
    }
    target.on('open',opened);target.on('close',closed);
    peer.on('error',errored);peer.on('disconnected',disconnected);
    if(joining)target.on('error',errored);
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();else if(target.open)opened();else if(peer.disconnected||peer.destroyed)disconnected();
  });
}

function waitToRetry(ms,signal){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
    function abort(){clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(cancelled());}
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();
  });
}

const randomCode=()=>String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);

// Only retry registration and the data channel handshake. Once /join is sent
// the host may already have admitted that player, so it must never be replayed.
export async function openRoomPeer(Peer,{code='',signal,onRetry}={}){
  let roomCode=code||randomCode(),retries=0,collisions=0;
  while(true){
    if(signal?.aborted)throw cancelled();
    const id=code?'campus-guest-'+crypto.getRandomValues(new Uint32Array(4)).join('-'):PREFIX+roomCode;
    const peer=new Peer(id,{debug:0,config:{iceServers:[{urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:stun.l.google.com:19302'}]}});
    try{
      await waitForOpen(peer,peer,signal);
      let connection=null;
      if(code){
        connection=peer.connect(PREFIX+code,{reliable:true,serialization:'binary'});
        if(!connection)throw failure('network',true);
        await waitForOpen(peer,connection,signal);
      }
      return {peer,connection,code:roomCode};
    }catch(error){
      peer.destroy();
      if(!code&&error.type==='unavailable-id'&&++collisions<5){roomCode=randomCode();continue;}
      // A room can be briefly absent while its host re-registers the same ID.
      const retryable=transient.has(error.type)||(code&&error.type==='peer-unavailable'&&retries===0);
      if(!retryable||retries>=2)throw error;
      retries++;onRetry?.(retries);
      await waitToRetry(retries===1?600:1500,signal);
    }
  }
}

// PeerJS keeps established data channels alive across a signaling outage.
// Re-register the original peer (including its ownership token) so new guests
// can find the room without replacing its worker or disconnecting classmates.
export function keepRoomRegistered(peer){
  let timer=null,deadline=null,delay=500,stopped=false;
  function registered(){
    clearTimeout(timer);clearTimeout(deadline);timer=deadline=null;delay=500;
  }
  function disconnected(){
    clearTimeout(deadline);deadline=null;
    if(stopped||peer.destroyed||!peer.disconnected||timer!==null)return;
    timer=setTimeout(()=>{
      timer=null;
      if(stopped||peer.destroyed||!peer.disconnected)return;
      deadline=setTimeout(()=>{if(!stopped&&!peer.open&&!peer.destroyed)peer.disconnect();},REGISTRATION_TIMEOUT);
      try{peer.reconnect();}catch{disconnected();}
    },delay);
    delay=Math.min(delay*2,8000);
  }
  peer.on('open',registered);peer.on('disconnected',disconnected);
  if(peer.disconnected)disconnected();
  return ()=>{stopped=true;registered();peer.off('open',registered);peer.off('disconnected',disconnected);};
}
