import {BUS,onBus} from './bus-layout86.js?v=campus-94';
import {PLAYGROUND_LAYOUT} from './playground-layout70.js?v=campus-92';

// Providers serve their published recordings in their own players. The round
// sends a catalogue key and a clock, never a media URL supplied by a peer.
export const RADIO_SONGS=Object.freeze([
 {id:'champions26',title:'炽日将烬',artist:'VCT 2026 全球冠军赛',duration:235,bvid:'BV1rtew6hEnF',source:'https://www.bilibili.com/video/BV1rtew6hEnF/'},
 {id:'rain',title:'雨爱',artist:'司凤版 · 古岛斐',duration:280,bvid:'BV117HW6eE9Z',source:'https://y.qq.com/n/ryqq/songDetail/000FKMIu2SVEZE'},
 {id:'friends',title:'朋友的酒',artist:'李晓杰',duration:280,bvid:'BV1Zc411N7ZL',source:'https://www.bilibili.com/video/BV1Zc411N7ZL/'}
].map(Object.freeze));
export const radioSong=id=>RADIO_SONGS.find(s=>s.id===id);
export function radioAnchor(map){
 if(map==='bus')return {x:10.60,y:BUS.low+1.30,z:BUS.body.minZ+.19,yaw:0};
 if(map==='playground'){const board=PLAYGROUND_LAYOUT.board;return {x:board.x+2.44,y:1.33,z:board.z-.14,yaw:Math.PI};}
 return null;
}
export function reachesRadio(map,p){
 const a=radioAnchor(map);
 if(!a||!p||p.seated||p.caught||p.mapActivity||p.captivity&&p.captivity!=='free')return false;
 if(map==='bus'&&(p.busDeck||!onBus(p.x,p.z)||p.x>11.06))return false;
 const dx=p.x-a.x,dz=p.z-a.z;
 return Math.hypot(dx,dz)<=2.18&&dx*Math.sin(a.yaw)+dz*Math.cos(a.yaw)>-.04;
}
export function radioPlayerUrl(song,seconds=0){
 const t=Math.max(0,Math.floor(seconds)||0);
 return 'https://player.bilibili.com/player.html?bvid='+song.bvid+'&page=1&danmaku=0&muted=0&autoplay=1&t='+t;
}
