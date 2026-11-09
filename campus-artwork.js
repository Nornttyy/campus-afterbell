import * as T from './vendor/three.module.js';
export const CAMPUS_ARTWORK_SOURCES=Object.freeze({
 teacherTutorial:'./assets/posters/teacher-tutorial54.png?v=black-brush54',
 studentTutorial:'./assets/posters/student-tutorial54.png?v=black-brush54',
 classroomNotice:'./assets/posters/classroom-notice54.png'
});
export async function loadCampusArtwork(sources=CAMPUS_ARTWORK_SOURCES,{loader=new T.TextureLoader()}={}){
 const entries=await Promise.all(Object.entries(sources).map(async([key,path])=>{
  try{const image=await loader.loadAsync(new URL(path,import.meta.url).href);image.colorSpace=T.SRGBColorSpace;image.anisotropy=4;return[key,image];}
  catch{return null;}
 }));return Object.fromEntries(entries.filter(Boolean));
}
