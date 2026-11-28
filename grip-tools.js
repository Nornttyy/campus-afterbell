import * as T from './vendor/three.module.js';

export function teacherGripProps({box,cylinder,materials:M,rightPalm,leftPalm}){
  const chalk=cylinder(M.paper,[.035,.075,-.025],[.007,.073,.007],[0,0,.8],rightPalm);
  const torch=new T.Group();leftPalm.add(torch);
  cylinder(M.dark,[0,0,0],[.027,.13,.027],null,torch);
  cylinder(M.steel,[0,.077,0],[.038,.034,.038],null,torch);
  cylinder(M.paper,[0,.096,0],[.03,.005,.03],null,torch);
  const eraser=box(M.dark,[0,0,0],[.16,.055,.084],null,rightPalm);
  box(M.wood,[0,.58,0],[1,.27,1],null,eraser);
  eraser.visible=false;
  return {chalk,torch,eraser};
}
