import {mapKind,OFFICE_DESKS} from './classroom-layout.js?v=campus-117&rev=157';

export const DESK_DRAWER_TRAVEL=.40;
export const LAB_DRAWER_TRAVEL=.36;
export const DRAWER_LOOK_PITCH=1.18;

// Both directions retrace the same rail. The hand arrives before the tray
// travels and lets go after it stops, including when a slide is reversed.
export function advanceDeskDrawer(drawer,open,dt){
 const old=drawer.slide??0;
 const slide=Math.max(0,Math.min(1,old+(open?1:-1)*dt/.50));
 if(old===slide&&drawer.slide!==undefined)return;
 drawer.slide=slide;
 const rail=Math.max(0,Math.min(1,(slide-.19)/.62));
 drawer.open=rail*rail*(3-2*rail);
}

// All lengths are metres. Heights are relative to the actor's floor; the view
// anchor already follows the floor, including the raised lecture-room rows.
export function drawerHandTarget({player,drawer,seats,map,amount=0,geometry=null}){
 if(!player?.seated||player.caught||!drawer)return null;
 const office=Boolean(player.officeChair),computer=!office&&mapKind(map)==='computer';
 const desk=office?OFFICE_DESKS.find(d=>d.id===player.officeDeskId)||OFFICE_DESKS[0]:seats?.find(s=>s.id===player.seatId);
 if(!desk)return null;
 const a=Math.max(0,Math.min(1,amount)),yaw=desk.yaw||0;
 const coach=map==='bus'&&!office,upper=coach&&desk.busDeck===1;
 const localZ=coach?-(upper?.37:0)-.12-.18*a:office?-.08-.52*a:-.08-(computer?LAB_DRAWER_TRAVEL:DESK_DRAWER_TRAVEL)*a;
 const trayX=office?(geometry?.x||0):0;
 const dx=(office?desk.x:desk.deskX)+Math.cos(yaw)*trayX+Math.sin(yaw)*localZ-player.x;
 const dz=(office?desk.z:desk.deskZ)-Math.sin(yaw)*trayX+Math.cos(yaw)*localZ-player.z;
 const bodyYaw=(player.seatYaw||0)+Math.PI,c=Math.cos(bodyYaw),s=Math.sin(bodyYaw);
 return {amount:a,centerX:c*dx-s*dz,centerZ:s*dx+c*dz,
  floor:coach?(upper?.51:.38):office?(geometry?.floor??.57):computer?.620:.659,
  lip:coach?(upper?.61:.52):office?(geometry?.lip??.82):computer?.770:.811,
  width:coach?.48:office?(geometry?.width??1.38):computer?.51:.93,depth:coach?.34:office?(geometry?.depth??.70):.60};
}
