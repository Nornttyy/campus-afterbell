import assert from 'node:assert/strict';
export function checkFoodScore(value,kind){
 const min=kind==='lunch'?3:kind==='phone'?1.8:kind==='drink'?1.5:1;
 const max=kind==='lunch'?3:kind==='phone'?2.5:['snack','chips','noodles'].includes(kind)?1.8:min+.5;
 const cents=Math.round(value*100);
 assert.ok(Math.abs(value*100-cents)<1e-6&&cents>=min*100&&cents<=max*100,kind+' award '+value);
}
