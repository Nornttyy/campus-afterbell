import * as T from './vendor/three.module.js';

// Keep the authored colour texture, including palm-cap vertex colours.
// Share replacements across classmates without changing source GLB materials.
const baseMaterials=new WeakMap();
const nightMaterials=new WeakMap(),windowMaterials=new WeakMap(),dayMaterials=new WeakMap();
const classroomDay={value:false};
export function setCharacterClassroomDay(active){classroomDay.value=Boolean(active);}
function classroomShading(shader){
 shader.uniforms.classroomDay=classroomDay;
 shader.vertexShader='attribute float campusOcclusion; varying float cavity; varying vec3 classroomNormalV;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
  #if defined(USE_SKINNING) || defined(USE_ENVMAP)
   vec3 classroomNormal=transformedNormal;
  #else
   vec3 classroomNormal=normalMatrix*normal;
  #endif
  cavity=campusOcclusion;
  classroomNormalV=normalize(classroomNormal);`);
 shader.fragmentShader='varying float cavity; uniform bool classroomDay; varying vec3 classroomNormalV;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  if(classroomDay){
   // The blue textile catches cyan window light. Preserve the paper, sclera
   // and skin hues; the broad wrap gives the chin and sleeve a shaded side.
   vec3 col=diffuseColor.rgb;
   float cloth=smoothstep(.07,.29,col.b-max(col.r,col.g))*smoothstep(.12,.46,col.b);
   diffuseColor.rgb=mix(col,vec3(col.r*.80+.037*col.b,col.g*.90+.114*col.b,col.b*.90),cloth);

  }`);
 // Apply shading after the eye, hair and shirt pigments have been restored.
 shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
  if(classroomDay){
   // Broad window light and warm desk bounce read on curved surfaces. Neither
   // depends on camera yaw. Soft cloth catches a wider lobe than skin.
   vec3 n=normalize(classroomNormalV);
   vec3 win=mat3(viewMatrix)*normalize(vec3(-.75,.62,.24));
   float facing=smoothstep(-.68,.91,dot(n,win));
   float top=dot(n,viewMatrix[1].xyz);
   float down=smoothstep(.04,.97,-top);
   vec3 paint=diffuseColor.rgb;
   float skin=smoothstep(.11,.30,paint.r-paint.b)*smoothstep(.035,.12,paint.g-paint.b);
   float blue=smoothstep(.07,.25,paint.b-paint.r)*smoothstep(.08,.40,paint.b);
   vec3 sky=mix(vec3(.65,.67,.72),vec3(1.13,1.095,1.05),facing);
   sky+=down*vec3(.090,.047,.018);
   sky+=skin*(1.-facing)*vec3(.09,.034,.008);
   float textile=pow(max(dot(n,win),0.),4.)*blue;
   outgoingLight=outgoingLight*sky+textile*vec3(.012,.018,.024);
  }
  #ifndef CAMPUS_NIGHT
   outgoingLight*=mix(vec3(1.),vec3(.46,.395,.375),smoothstep(.025,.76,cavity));
  #endif
  #include <opaque_fragment>`);
}
function baseColorMaterial(source){
 if(source.userData.characterBaseColor)return source;
 let material=baseMaterials.get(source);
 if(!material){
  material=new T.MeshBasicMaterial({
   map:source.map||null,alphaMap:source.alphaMap||null,
   color:source.color||0xffffff,vertexColors:!!source.vertexColors,
   side:source.side,transparent:source.transparent,opacity:source.opacity,
   alphaTest:source.alphaTest,alphaHash:source.alphaHash,
   depthWrite:source.depthWrite,depthTest:source.depthTest,
   blending:source.blending,premultipliedAlpha:source.premultipliedAlpha,
   polygonOffset:source.polygonOffset,polygonOffsetFactor:source.polygonOffsetFactor,
   polygonOffsetUnits:source.polygonOffsetUnits,
   toneMapped:false,fog:false
  });
  material.name=source.name;material.defaultAttributeValues={campusOcclusion:[0]};
  material.onBeforeCompile=classroomShading;
  material.customProgramCacheKey=()=>'campus-character-window-cloth109';
  material.userData={...source.userData,characterBaseColor:true};
  baseMaterials.set(source,material);
 }
 return material;
}

// Apply only to a character's model, before attaching held objects.
// Daytime keeps authored colours; the power-cut variant enables diffuse light.
export function useCharacterBaseColor(model){
 model.traverse(mesh=>{
  if(!mesh.isMesh)return;
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(baseColorMaterial):baseColorMaterial(mesh.material);
  mesh.receiveShadow=false;
  mesh.userData.characterSurface=true;
 });
 return model;
}

// The authored daytime colour remains untouched. In the power-cut classroom
// use real diffuse lighting, so white eyes, clothes and hands cannot glow in
// darkness. Cache both states; switching floors does not recreate textures.
export function setCharacterNight(model,night=false,windowShadows=false){
 function select(source){
  const day=dayMaterials.get(source)||source;
  if(!night&&!windowShadows)return day;
  const cache=night?nightMaterials:windowMaterials;
  let lit=cache.get(day);
  if(!lit){
   lit=new T.MeshLambertMaterial();
   for(const key of ['map','alphaMap','vertexColors','side','transparent','opacity','alphaTest','alphaHash','depthWrite','depthTest','blending','premultipliedAlpha','polygonOffset','polygonOffsetFactor','polygonOffsetUnits'])lit[key]=day[key];
   lit.color.copy(day.color);lit.emissive.set(0);lit.toneMapped=true;lit.fog=true;
   lit.name=day.name+(night?'-night':'-window');lit.userData={...day.userData,characterNight:night};
   lit.defaultAttributeValues={campusOcclusion:[0]};
   lit.onBeforeCompile=day.onBeforeCompile;lit.customProgramCacheKey=day.customProgramCacheKey;
   if(night)lit.defines={...lit.defines,CAMPUS_NIGHT:1};
   if(!night){
    lit.toneMapped=false;lit.fog=false;
    lit.onBeforeCompile=function(shader,renderer){
     day.onBeforeCompile.call(this,shader,renderer);
     shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>','#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',`float sunVisibility=getShadowMask();
       vec3 outgoingLight=diffuseColor.rgb*mix(vec3(.68,.72,.78),vec3(1.015),sunVisibility);`);
    };
    lit.customProgramCacheKey=()=>day.customProgramCacheKey()+'-window-shadows';
   }
   cache.set(day,lit);dayMaterials.set(lit,day);
   day.addEventListener('dispose',()=>{lit.dispose();cache.delete(day);dayMaterials.delete(lit);});
  }
  return lit;
 }
 model.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.userData.characterSurface)return;
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(select):select(mesh.material);
  mesh.receiveShadow=Boolean(night||windowShadows);
 });
}
