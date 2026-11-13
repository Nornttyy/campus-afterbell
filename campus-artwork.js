import * as T from './vendor/three.module.js';
export const CAMPUS_ARTWORK_SOURCES=Object.freeze({
 classroomAward:'./assets/posters/classroom-award72.png',
 chalkNewspaper:'./assets/posters/chalk-newspaper72-ref.png',
 teacherTutorial:'./assets/posters/teacher-tutorial64.png?v=black-brush64',
 studentTutorial:'./assets/posters/student-tutorial64.png?v=black-brush64',
 classroomNotice:'./assets/posters/classroom-notice54.png',
 graffitiSnack:'./assets/posters/graffiti-snack64.png',
 graffitiHomework:'./assets/posters/graffiti-homework64.png'
});
export async function loadCampusArtwork(sources=CAMPUS_ARTWORK_SOURCES,{loader=new T.TextureLoader()}={}){
 const entries=await Promise.all(Object.entries(sources).map(async([key,path])=>{
  try{const image=await loader.loadAsync(new URL(path,import.meta.url).href);image.colorSpace=T.SRGBColorSpace;image.anisotropy=4;return[key,image];}
  catch{return null;}
 }));return Object.fromEntries(entries.filter(Boolean));
}
