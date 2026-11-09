// Measured media motion, not the selected application, confirms playback.
export function sampleComputerPlayback(previous,video,now,visible){
 const mediaTime=Number.isFinite(video.currentTime)?video.currentTime:0,eligible=Boolean(visible&&!video.paused&&!video.ended&&!video.error&&!video.seeking&&video.readyState>=3);
 const elapsed=previous?Math.max(0,(now-previous.sampledAt)/1000):0;let advance=previous?mediaTime-previous.mediaTime:0;
 if(advance<0&&video.loop&&Number.isFinite(video.duration)&&previous.mediaTime>video.duration-.75&&mediaTime<.75)advance+=video.duration;
 const moved=eligible&&previous?.eligible&&advance>.0001&&advance<=elapsed+.20;
 const discontinuity=previous&&Math.abs(advance)>.0001&&(advance<0||advance>elapsed+.20);
 const advancedAt=moved?now:eligible&&!discontinuity?(previous?.advancedAt??-Infinity):-Infinity;
 return{playing:eligible&&now-advancedAt<500,visible:Boolean(visible),eligible,mediaTime,sampledAt:now,advancedAt};
}
