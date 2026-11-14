// Night values are the existing campus-58 profile, deliberately unchanged.
export const ROOM_LIGHTING=Object.freeze({
 day:Object.freeze({ambient:3.45,sun:4.6,fill:1.05,teaching:1.05,lamp:1.0,sky:'#fafbff',ground:'#f7f2e8',sunColor:'#fff6e7',ceiling:'#fff8ed',background:'#d2e7e9',fog:'#e3edf1'}),
 night:Object.freeze({ambient:.30,sun:.035,fill:.055,teaching:.055,lamp:.015,sky:'#7890c5',ground:'#9ca5b5',sunColor:'#7084ac',ceiling:'#3c4b67',background:'#0a1428',fog:'#15223a'})
});
export function applyRoomLighting(night,{ambient,sun,fill,teachingFill,lampMat,ceilingMaterial,scene}){
 const p=ROOM_LIGHTING[night?'night':'day'];
 ambient.intensity=p.ambient;sun.intensity=p.sun;fill.intensity=p.fill;teachingFill.intensity=p.teaching;lampMat.emissiveIntensity=p.lamp;
 ambient.color.set(p.sky);ambient.groundColor.set(p.ground);sun.color.set(p.sunColor);ceilingMaterial.color.set(p.ceiling);scene.background.set(p.background);scene.fog.color.set(p.fog);
 return p;
}
