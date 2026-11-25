const smooth=t=>t*t*(3-2*t);
// Pen-tip offsets in metres. Short downstrokes and hooks form a line, then
// the wrist returns to its starting margin. Both renderers use this path.
const strokes=[
 [0,-.026,-.003],[.10,-.018,-.003],[.17,-.020,.009],[.24,-.012,.001],
 [.32,-.004,.001],[.38,-.006,.011],[.47,-.001,-.005],[.55,.008,-.005],
 [.63,.004,.008],[.70,.014,.000],[.76,.020,-.003],[.82,.018,.010],
 [.89,.026,.003],[.93,.026,.003],[1,-.026,-.003]
];
export function writingStroke(time){
 const u=((time/2.25)%1+1)%1;
 const at=strokes.findIndex(k=>k[0]>u),a=strokes[at-1],b=strokes[at];
 const blend=smooth((u-a[0])/(b[0]-a[0]));
 return {x:a[1]+(b[1]-a[1])*blend,z:a[2]+(b[2]-a[2])*blend};
}
export function thirdPersonPenTime(time){
 const cycle=Math.max(0,time)/1.9,index=Math.floor(cycle),phase=cycle-index;
 // Finger push, horizontal turn, catch. A brief catch replaces the former
 // perfectly uniform wheel rotation while the point of contact stays fixed.
 return (index+smooth(Math.min(1,phase/.73)))*1.6;
}
