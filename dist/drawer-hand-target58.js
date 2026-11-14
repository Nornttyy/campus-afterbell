import {mapKind,OFFICE_DESKS} from './classroom-layout.js?v=campus-82';

// All lengths are metres. Heights are relative to the actor's floor; the view
// anchor already follows the floor, including the raised lecture-room rows.
export function drawerHandTarget({player,drawer,seats,map,amount=0,geometry=null}){
 if(!player?.seated||player.caught||!drawer)return null;
 const office=Boolean(player.officeChair),computer=!office&&mapKind(map)==='computer';
 const desk=office?OFFICE_DESKS.find(d=>d.id===player.officeDeskId)||OFFICE_DESKS[0]:seats?.find(s=>s.id===player.seatId);
 if(!desk)return null;
 const a=Math.max(0,Math.min(1,amount)),yaw=desk.yaw||0;
 const localZ=office?-.08-.52*a:-.08-.24*a;
 const dx=(office?desk.x+(geometry?.x||0):desk.deskX)+Math.sin(yaw)*localZ-player.x;
 const dz=(office?desk.z:desk.deskZ)+Math.cos(yaw)*localZ-player.z;
 const bodyYaw=(player.seatYaw||0)+Math.PI,c=Math.cos(bodyYaw),s=Math.sin(bodyYaw);
 return {amount:a,centerX:c*dx-s*dz,centerZ:s*dx+c*dz,
  floor:office?(geometry?.floor??.57):computer?.620:.659,
  lip:office?(geometry?.lip??.82):computer?.770:.811,
  width:office?(geometry?.width??1.38):computer?.51:.93,depth:office?(geometry?.depth??.70):.60};
}
