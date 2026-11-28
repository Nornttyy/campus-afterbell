import {actorEyeHeight} from './classroom-layout.js?v=campus-117&rev=174';
import {diningPlanForSeats} from './hotpot-layout70.js?v=campus-94&rev=154';
export const HOTPOT_RECIPES=Object.freeze({beef:3,cabbage:3,meatball:2,lotus:3,luncheon:1,shiitake:3});
export const COOK_SECONDS=10;
const dishes=Object.keys(HOTPOT_RECIPES);
export function drawIngredient(draw){return dishes[Math.min(dishes.length-1,Math.floor(draw*dishes.length))];}
export function makeCookingRound(seats){
 return diningPlanForSeats(seats).tables.map(t=>({id:t.id,x:t.x,z:t.z,nextPiece:0,pieces:[]}));
}
function inReach(round,actor,pot){
 return pot&&Math.hypot(actor.x-pot.x,actor.z-pot.z)<2.55&&round._clearWallSegment(actor,pot);
}
// Intersect the sight line with the circular mouth of a reachable pot, including
// the far edge when the player sits off-centre at an eight-place table.
export function aimedPot(round,actor){
 if(round.map!=='hotpot'||round._restrained(actor))return null;
 const height=actorEyeHeight(actor,round.map)+(actor.jumpHeight||0);
 const yaw=actor.yaw||0,sin=Math.sin(yaw),cos=Math.cos(yaw),slope=Math.tan(actor.pitch||0);
 for(const pot of round.hotpots){
  if(!inReach(round,actor,pot))continue;
  const dx=pot.x-actor.x,dz=pot.z-actor.z,along=dx*sin+dz*cos,across=dx*cos-dz*sin;
  if(along<=0||Math.abs(across)>.79)continue;
  if(!actor.isPlayer&&!actor.networkHuman)return pot;
  if(Math.abs(height-along*slope-1.10)<.27)return pot;
 }
 return null;
}
export function pourPlate(round,actor,slot,pot){
 const count=HOTPOT_RECIPES[slot.dish];
 if(!pot||!count||pot.pieces.length+count>48)return false;
 for(let i=0;i<count;i++)pot.pieces.push({id:pot.nextPiece++,dish:slot.dish,readyAt:round.elapsed+COOK_SECONDS});
 return true;
}
export function takeCookedPiece(round,id,pieceId,p=round.player){
 const pot=round.hotpots?.[id];
 if(!round._classInputAllowed()||p.id<0||round._restrained(p)||p._drawnSlot!==null||!pot||aimedPot(round,p)!==pot)return false;
 const index=pot.pieces.findIndex(v=>v.id===pieceId&&v.readyAt<=round.elapsed+1e-8);
 if(index<0)return false;
 const [piece]=pot.pieces.splice(index,1);
 p._slots=[{id:0,action:'hotpotBite',dish:piece.dish,temporary:true,progress:0,heldBy:p.id}];
 p._selectedSlot=p._drawnSlot=0;p._heldSource={pot:id,pieceId:piece.id,dish:piece.dish};
 p.action='hotpotBite';p._drawerOpen=false;p.holding=false;p.progress=0;
 if(p===round.player){round.selected=p.action;round.holding=false;}
 return true;
}
export function canReplacePiece(round,actor){
 const source=actor._heldSource,pot=round.hotpots?.[source?.pot];
 return inReach(round,actor,pot)&&pot.pieces.length<48&&!pot.pieces.some(piece=>piece.id===source.pieceId);
}
