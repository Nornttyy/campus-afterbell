// The board enamel stays in the room. Only the transparent chalk layer changes.
// All floors share this texture and only upload it when another glyph appears.
const rows=[
 [90,112,'数学　课堂练习',60],[115,298,'(a + b)² = a² + 2ab + b²',69],
 [114,437,'(a + b)(a − b) = a² − b²',65],[110,573,'练习　三　　P.48',48]
];
export function createBoardInk({mat,texture}){
 let ctx;const map=texture(1400,650,c=>{ctx=c;});
 const ink=mat('#f0f0dc',{map,transparent:true,opacity:0,depthWrite:false,roughness:.96});
 if(!ctx)return{material:ink,update(){}};
 let last=-1;
 const glyphs=[];
 for(const [start,y,words,size] of rows){
  let x=start;ctx.font=size+'px "Kaiti SC",KaiTi,Georgia,serif';
  for(const ch of words){const w=ctx.measureText(ch).width;
   if(ch.trim())glyphs.push({ch,x,y,size});x+=w;
  }
 }
 return {material:ink,update(teacher){
  const amount=teacher?.boardAmount||0,n=Math.min(glyphs.length,Math.floor(amount*glyphs.length+1e-7));
  ink.opacity=teacher?.boardOpacity||0;
  if(n===last)return;last=n;ctx.clearRect(0,0,1400,650);
  ctx.fillStyle='#f1f1de';
  for(let i=0;i<n;i++){const g=glyphs[i];ctx.font=g.size+'px "Kaiti SC",KaiTi,Georgia,serif';ctx.fillText(g.ch,g.x,g.y);}
  map.needsUpdate=true;
 }};
}
