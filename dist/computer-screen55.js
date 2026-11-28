import * as T from './vendor/three.module.js';
import {sampleComputerPlayback} from './computer-playback56.js?v=campus-83';

import {COMPUTER_APPS,COMPUTER_GAMES} from './computer-rules55.js?v=campus-96';
import {arcadeIcon,drawArcade} from './arcade-screen93.js?v=campus-93';
export {COMPUTER_APPS};
const W=768,H=432;
const names={photoshop:'Adobe Photoshop',unity:'Unity',snake:'贪吃蛇',valorant:'VALORANT',miner:'黄金矿工',tetris:'俄罗斯方块'};
const assets={
 wallpaper:new URL('./assets/computer/desktop-hills152.jpg',import.meta.url).href,
 photoshop:new URL('./assets/computer/photoshop.svg',import.meta.url).href,
 unity:new URL('./assets/computer/unity.svg',import.meta.url).href,
 valorant:new URL('./assets/computer/valorant.png',import.meta.url).href,
 photoshopScreen:new URL('./assets/computer/photoshop-workspace.jpg',import.meta.url).href,
 unityScreen:new URL('./assets/computer/unity-workspace.png',import.meta.url).href,
 video:new URL('./assets/computer/valorant-zmjjkk-2024.mp4',import.meta.url).href
};

// The same in-world display is used before, during and after interaction.
// Desktop/editor materials are shared; only active snakes need their own canvas.
function desktopTile(i){return {x:26+i%2*142,y:22+Math.floor(i/2)*122};}
export function desktopAppAtUV(u,v){
 const x=u*W,y=(1-v)*H;
 return COMPUTER_APPS.find((_,i)=>{const tile=desktopTile(i);return x>=tile.x-9&&x<tile.x+122&&y>=tile.y-9&&y<tile.y+110;})||null;
}
export function createComputerScreenContent(){
 const surfaces=new Map(),icons={},screenshots={},owned=new Set();let hoverSeat=null,hoverApp=null,disposed=false,videoWanted=false,lastPlay=-Infinity,playback=null,viewerActive=false;
 const video=document.createElement('video');video.src=assets.video;video.muted=true;video.loop=true;video.playsInline=true;video.preload='metadata';
 const videoTexture=new T.VideoTexture(video);videoTexture.colorSpace=T.SRGBColorSpace;videoTexture.minFilter=T.LinearFilter;
 const videoMaterial=new T.MeshBasicMaterial({map:videoTexture,toneMapped:false});owned.add(videoMaterial);
 let wallpaper=null;
 const background=new Image();
 background.onload=()=>{
  if(disposed)return;
  wallpaper=background;
  for(const [key,entry] of surfaces)if(key.startsWith('desktop:'))entry.dirty=true;
 };
 background.src=assets.wallpaper;
 for(const app of ['photoshop','unity','valorant']){
  const image=new Image();image.onload=()=>{icons[app]=image;for(const entry of surfaces.values())entry.dirty=true;};image.src=assets[app];
 }
 for(const app of ['photoshop','unity']){const image=new Image();image.onload=()=>{screenshots[app]=image;const entry=surfaces.get(app);if(entry)entry.dirty=true;};image.src=assets[app+'Screen'];}
 function surface(key){let entry=surfaces.get(key);if(entry)return entry;const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;const material=new T.MeshBasicMaterial({map:texture,toneMapped:false});owned.add(material);entry={canvas,texture,material,dirty:true,key:''};surfaces.set(key,entry);return entry;}
 function draw(entry,key,paint){if(!entry.dirty&&entry.key===key)return;paint(entry.canvas.getContext('2d'));entry.key=key;entry.dirty=false;entry.texture.needsUpdate=true;}
 function label(c,text,x,y,size=18,color='#e7eef3',align='left'){c.fillStyle=color;c.font=`${size}px sans-serif`;c.textAlign=align;c.fillText(text,x,y);c.textAlign='left';}
 function snakeIcon(c,x,y,size){c.fillStyle='#d3e9b8';c.fillRect(x,y,size,size);c.strokeStyle='#3d7e48';c.lineWidth=size*.14;c.lineCap='round';c.beginPath();c.moveTo(x+size*.23,y+size*.76);c.lineTo(x+size*.23,y+size*.29);c.lineTo(x+size*.75,y+size*.29);c.lineTo(x+size*.75,y+size*.6);c.stroke();c.fillStyle='#224930';c.fillRect(x+size*.70,y+size*.24,size*.06,size*.06);c.lineCap='butt';}
 function desktop(selected=-1){const entry=surface(`desktop:${selected}`);draw(entry,String(selected),c=>{
  if(wallpaper)c.drawImage(wallpaper,0,0,W,H);
  else{c.fillStyle='#4386c6';c.fillRect(0,0,W,H);}
  COMPUTER_APPS.forEach((app,i)=>{const {x,y}=desktopTile(i);if(selected===i){c.fillStyle='rgba(204,230,245,.30)';c.fillRect(x-9,y-9,131,119);c.strokeStyle='#d8ecf2';c.lineWidth=2;c.strokeRect(x-9,y-9,131,119);}const ix=x+31;if(app==='miner'||app==='tetris')arcadeIcon(c,app,ix,y,54);else if(app==='snake')snakeIcon(c,ix,y,54);else if(icons[app])c.drawImage(icons[app],ix,y,54,54);else{c.fillStyle=app==='valorant'?'#ed5061':app==='photoshop'?'#153c57':'#e9eeef';c.fillRect(ix,y,54,54);}c.shadowColor='#29444f';c.shadowBlur=3;label(c,names[app],x+57,y+81,15,'#ffffff','center');c.shadowBlur=0;});
  c.fillStyle='#dce5df';c.fillRect(0,H-30,W,30);label(c,'开始',16,H-9,15,'#324b50');label(c,'14:30',W-20,H-9,15,'#324b50','right');
 });return entry.material;}
 function editor(app){const entry=surface(app);draw(entry,app,c=>{
  c.fillStyle='#202124';c.fillRect(0,0,W,H);const image=screenshots[app];if(!image)return;
  // Preserve the source screenshot's proportions and complete application UI.
  const scale=Math.min(W/image.naturalWidth,H/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
  c.drawImage(image,(W-w)/2,(H-h)/2,w,h);
 });return entry.material;}
 function snake(id,game){const entry=surface(`snake:${id}`),key=JSON.stringify(game||{});draw(entry,key,c=>{
  c.fillStyle='#000000';c.fillRect(0,0,W,H);
  const cols=game?.width||16,rows=game?.height||12,cell=Math.floor(Math.min((W-32)/cols,(H-44)/rows));
  const left=(W-cols*cell)/2,top=38+(H-42-rows*cell)/2;
  c.strokeStyle='#484848';c.lineWidth=2;c.strokeRect(left-1,top-1,cols*cell+2,rows*cell+2);
  label(c,'得分 '+(game?.score||0),left+cols*cell,28,24,'#ff0000','right');
  c.fillStyle='#00ff00';
  for(const p of game?.body||[])c.fillRect(left+p.x*cell+1,top+p.y*cell+1,cell-2,cell-2);
  if(game?.food){const food=game.food;c.fillStyle='#ff0000';c.fillRect(left+food.x*cell+4,top+food.y*cell+4,cell-8,cell-8);}
  if(game?.alive===false)label(c,'点击重玩',left,28,19,'#ffffff');
 });return entry.material;}
 const gesture=()=>{if(videoWanted)void video.play().catch(()=>{});};document.addEventListener('pointerdown',gesture);
 function materialFor(id,computer){const app=computer?.app||'desktop';if(app==='valorant'){videoWanted=true;return video.readyState>=2?videoMaterial:desktop(3);}if(computer?.arcade&&(app==='miner'||app==='tetris')){const entry=surface(app+':'+id);draw(entry,JSON.stringify(computer.arcade),c=>drawArcade(c,app,computer.arcade));return entry.material;}if(app==='snake')return snake(id,computer?.snake);if(app==='photoshop'||app==='unity')return editor(app);if(id===hoverSeat&&hoverApp&&computer?.active)return desktop(COMPUTER_APPS.indexOf(hoverApp));return desktop(computer?.active?Math.max(0,Math.min(COMPUTER_APPS.length-1,computer.selectedApp||0)):-1);}
 function teacher(count){const entry=surface('teacher');draw(entry,String(count),c=>{c.fillStyle='#e8efe8';c.fillRect(0,0,W,H);c.fillStyle='#527b73';c.fillRect(0,0,W,52);label(c,'课堂电脑',25,35,23,'#fff');label(c,'正在玩游戏',W/2,164,31,'#385451','center');label(c,String(count),W/2,285,104,count?'#bd6351':'#487768','center');});return entry.material;}
 return{
  materialFor,
  setHover(seatId,app){hoverSeat=seatId;hoverApp=app;},
  getPlayback(){const visible=viewerActive&&document.visibilityState!=='hidden'&&!disposed;return{playing:Boolean(visible&&playback?.playing&&performance.now()-playback.sampledAt<750&&!video.paused&&!video.ended&&!video.error&&video.readyState>=3),visible,mediaTime:Number.isFinite(video.currentTime)?video.currentTime:0};},
  update(state,screens,teacherScreen,officeScreens){if(disposed)return;videoWanted=false;const students=(state?.students||[]).filter(s=>s.id!==state?.player?.id);if(state?.player)students.push(state.player);const bySeat=new Map(students.filter(s=>s.computer?.active).map(s=>[s.computer.stationId??s.seatId,s]));for(const [id,screen]of screens||[]){const s=bySeat.get(id);screen.material=materialFor(id,s?.computer||{active:false,app:'desktop'});}for(const screen of officeScreens?.values?.()||[])screen.material=desktop(-1);if(teacherScreen)teacherScreen.material=teacher(students.filter(s=>s.computer?.active&&COMPUTER_GAMES.includes(s.computer.app)).length);
   const now=performance.now();viewerActive=Boolean(state?.player?.computer?.active&&state.player.computer.app==='valorant'&&!state.paused&&state.status==='playing');if(document.visibilityState==='hidden')videoWanted=false;if(videoWanted&&video.paused&&now-lastPlay>1000){lastPlay=now;void video.play().catch(()=>{});}if(!videoWanted&&!video.paused)video.pause();playback=sampleComputerPlayback(playback,video,now,viewerActive&&document.visibilityState!=='hidden');
  },
  dispose(){disposed=true;document.removeEventListener('pointerdown',gesture);video.pause();video.removeAttribute('src');video.load();videoTexture.dispose();for(const entry of surfaces.values())entry.texture.dispose();for(const m of owned)m.dispose();surfaces.clear();},
  diagnostics:()=>({surfaces:surfaces.size,videoReady:video.readyState,videoPlaying:!video.paused,actualPlaying:playback?.playing||false,mediaTime:video.currentTime,screenshots:Object.keys(screenshots),videoDuration:video.duration,apps:COMPUTER_APPS})
 };
}
