// Night values are the existing campus-58 profile, deliberately unchanged.
export const ROOM_LIGHTING=Object.freeze({
 day:Object.freeze({ambient:3.6,sun:4.2,fill:1.85,teaching:1.10,lamp:1.0,sky:'#f4f7f7',ground:'#fff9ed',sunColor:'#fff2d7',ceiling:'#f1eee5',background:'#d2e7e9',fog:'#e3edf1'}),
 night:Object.freeze({ambient:.30,sun:.035,fill:.055,teaching:.055,lamp:.015,sky:'#7890c5',ground:'#9ca5b5',sunColor:'#7084ac',ceiling:'#3c4b67',background:'#0a1428',fog:'#15223a'})
});
export function applyRoomLighting(night,{ambient,sun,fill,teachingFill,lampMat,ceilingMaterial,scene}){
 const p=ROOM_LIGHTING[night?'night':'day'];
 ambient.intensity=p.ambient;sun.intensity=p.sun;fill.intensity=p.fill;teachingFill.intensity=p.teaching;lampMat.emissiveIntensity=p.lamp;
 ambient.color.set(p.sky);ambient.groundColor.set(p.ground);sun.color.set(p.sunColor);ceilingMaterial.color.set(p.ceiling);scene.background.set(p.background);scene.fog.color.set(p.fog);
 return p;
}
