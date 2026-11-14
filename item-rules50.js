// Shared duration for timed use/charge interactions in solo and hosted rooms.
// Cooldowns, refill delays and passive minigame scoring have separate pacing.
export const INTERACTION_SECONDS=2;
// Deterministic minigame state. The authoritative simulation advances the
// snake; a client can request a direction but cannot submit earned points.
export const ITEM50_TUNING=Object.freeze({gumSeconds:6,gumCycleSeconds:1.5,gumPoints:[1,2,3,0],peelStun:4,peelLifetime:45,burpWindow:5,burpSpeed:3,burpLifetime:2.5,burpStun:2.5,computerRefill:3});
// Lab storage has one food compartment; lunch remains office stock.
export const COMPUTER_DRAWER_FOODS=Object.freeze(['snack','drink','burger','banana','garlic']);
const vectors={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
export function createSnake(seed=1){return {width:16,height:12,body:[{x:5,y:6},{x:4,y:6},{x:3,y:6}],direction:'right',pending:'right',food:{x:9,y:6},score:0,alive:true,tick:0,seed:seed>>>0};}
export function turnSnake(snake,direction){if(!snake?.alive||!vectors[direction])return false;const a=vectors[snake.direction],b=vectors[direction];if(a[0]+b[0]===0&&a[1]+b[1]===0)return false;snake.pending=direction;return true;}
function food(s){const empty=[];for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++)if(!s.body.some(p=>p.x===x&&p.y===y))empty.push({x,y});s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return empty.length?empty[s.seed%empty.length]:null;}
export function stepSnake(s,dt){if(!s?.alive)return 0;let eaten=0;s.tick+=dt;while(s.tick+1e-9>=.16&&s.alive){s.tick=Math.max(0,s.tick-.16);s.direction=s.pending;const d=vectors[s.direction],h={x:s.body[0].x+d[0],y:s.body[0].y+d[1]},grows=s.food&&h.x===s.food.x&&h.y===s.food.y;const occupied=grows?s.body:s.body.slice(0,-1);if(h.x<0||h.x>=s.width||h.y<0||h.y>=s.height||occupied.some(p=>p.x===h.x&&p.y===h.y)){s.alive=false;break;}s.body.unshift(h);if(grows){s.score++;eaten++;s.food=food(s);if(!s.food)s.alive=false;}else s.body.pop();}return eaten;}
export function snakeSnapshot(s){return s?{width:s.width,height:s.height,body:s.body.map(p=>({...p})),food:s.food?{...s.food}:null,direction:s.direction,score:s.score,alive:s.alive}:null;}
