// Review pages only: expose verification evidence without browser-side state injection.
const panel=document.createElement('aside');
panel.id='qa-event-log';
panel.setAttribute('aria-label','测试事件与报错');
panel.style.cssText='position:fixed;right:8px;bottom:68px;z-index:120;width:320px;max-height:240px;overflow:auto;padding:8px;color:#152332;background:#ffffffeb;font:11px/1.4 monospace;white-space:pre-wrap;pointer-events:none';
document.body.append(panel);
const entries=[];let stateLine='测试尚未开始';
function draw(){panel.textContent=stateLine+'\n'+entries.join('\n');}
function log(message){entries.push(message);if(entries.length>8)entries.shift();draw();}
window.addEventListener('error',e=>log('ERROR '+e.message));
window.addEventListener('unhandledrejection',e=>log('REJECTION '+String(e.reason?.stack||e.reason)));
for(const level of ['warn','error']){const original=console[level].bind(console);console[level]=(...args)=>{original(...args);log(level.toUpperCase()+' '+args.map(String).join(' ').slice(0,230));};}
draw();
export function attachReviewLog(round){
 const drain=round.drainEvents.bind(round);
 round.drainEvents=()=>{const events=drain();for(const e of events)if(['flash-throw','ink-throw','flash-burst','ink-splash','bubble-release','bound','rescued'].includes(e.type))log(JSON.stringify(e));return events;};
 setInterval(()=>{
  const s=round.snapshot(),p=s.player,b=p.bubble||{};
  stateLine=`状态 ${s.status}/${s.stage} | 暂停 ${s.paused?'是':'否'}\n${s.selected} | 手持 ${s.drawer.drawnSlot??'无'} | 投掷后 ${p.itemThrowAge}s\n弹体 ${s.projectiles.length}(${s.projectiles.map(p=>p.kind).join(',')||'无'}) | 泡泡 ${s.bubbles.length}\n闪光 ${p.flashLeft}s / 墨水 ${p.inkLeft}s\n泡泡 ${Math.round((b.progress||0)*100)}% | 冷却 ${b.cooldown||0}s | ${b.blowing?'吹气':'松开'}`;
  draw();
 },100);
}
