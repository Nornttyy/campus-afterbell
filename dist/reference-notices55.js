// Only in-game notices verified in the supplied screenshots / reference audit.
// Never forward server text, AI observations or debug events into subtitles.
export function referenceNotice(event, role) {
  if (role !== 'teacher') return null;
  switch (event?.type) {
    case 'surveillance-deployed': return {text:event.remaining>0?(event.unlockIn>0?'监控已开启，下一个还需 '+event.unlockIn+' 秒':'监控已开启，下一个可开启'):'两个监控均已开启',kind:'info'};
    case 'correct-capture': return {text:'抓到了！恢复20体力', kind:'good'};
    case 'wrong-grab': return {text:'抓错了！体力 -40', kind:'bad'};
    case 'stamina-low': return {text:'讲课可恢复体力', kind:'info'};
    default: return null;
  }
}
