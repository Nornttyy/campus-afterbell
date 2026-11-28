import * as T from './vendor/three.module.js';
export const CAMPUS_ARTWORK_SOURCES=Object.freeze({
 hotpotMenus:'./assets/posters/hotpot-menus91.webp',
 hotpotVegetables:'./assets/posters/hotpot-vegetables85.webp',
 classroomAward:'./assets/posters/classroom-award72-lossless93.webp',
 dayChalkboard:'./assets/posters/classroom-gratitude90.webp',
 chalkNewspaper:'./assets/posters/chalk-newspaper72-ref-lossless93.webp',
 teacherTutorial:'./assets/posters/teacher-tutorial64-lossless93.webp?v=black-brush64',
 studentTutorial:'./assets/posters/student-tutorial64-lossless93.webp?v=black-brush64',
 classroomNotice:'./assets/posters/classroom-prints90.webp',
 graffitiSnack:'./assets/posters/graffiti-snack64-lossless93.webp',
 graffitiHomework:'./assets/posters/graffiti-homework64-lossless93.webp'
});
export async function loadCampusArtwork(sources=CAMPUS_ARTWORK_SOURCES,{loader=new T.TextureLoader()}={}){
 const entries=await Promise.all(Object.entries(sources).map(async([key,path])=>{
  try{const image=await loader.loadAsync(new URL(path,import.meta.url).href);image.colorSpace=T.SRGBColorSpace;image.anisotropy=4;return[key,image];}
  catch{return null;}
 }));return Object.fromEntries(entries.filter(Boolean));
}

// The first playable position is in the corridor. Keep the tutorials on its
// critical path and stream the prints behind the classroom doors after entry.
export function prepareEntryArtwork(sources){
 const loader=new T.TextureLoader(),later=[],textures={},entry={};
 for(const [key,path] of Object.entries(sources)){
  if(key==='studentTutorial'||key==='teacherTutorial'){entry[key]=path;continue;}
  const map=new T.Texture();
  map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  textures[key]=map;
  later.push(async()=>{
   const loaded=await loader.loadAsync(new URL(path,import.meta.url).href);
   map.image=loaded.image;map.needsUpdate=true;
   loaded.dispose();
  });
 }
 let started=false;
 return {
  ready:loadCampusArtwork(entry).then(first=>Object.assign(textures,first)),
  start(){if(!started){started=true;for(const load of later)load().catch(error=>console.warn('Classroom print unavailable',error));}}
 };
}
