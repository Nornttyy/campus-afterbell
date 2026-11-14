import {placeFurniture67,hasComputer67,MONITOR67} from './furniture-assets67.js?v=campus-83';
import * as T from './vendor/three.module.js';

// A single compartment fits beside the existing tower without changing the
// workstation footprint. Contents keep their original GLB size and transforms.
export const COMPUTER_DRAWER55=Object.freeze({floor:.62,itemZ:-.25,travel:.24});
export function buildComputerDrawer55({parent,box,rounded,mat,id='computer-drawer',bakeStatic=()=>{}}){
 const group=new T.Group();group.name=id;parent.add(group);
 const tray=mat('#a8b6b3',{metalness:.12,roughness:.55}),front=mat('#d1d5cb',{roughness:.68}),handle=mat('#3e5055',{roughness:.55});
 rounded(tray,[0,.614,-.08],[.54,.012,.65],.003,null,group);
 for(const side of[-1,1])box(tray,[side*.264,.695,-.08],[.012,.15,.65],null,group);
 box(tray,[0,.695,.239],[.54,.15,.012],null,group);
 rounded(front,[0,.695,-.405],[.56,.15,.024],.006,null,group);
 for(const x of[-.10,.10])box(handle,[x,.701,-.433],[.016,.016,.035],null,group);
 rounded(handle,[0,.701,-.454],[.22,.022,.022],.006,null,group);
 bakeStatic(group);
 return{group,open:0,...COMPUTER_DRAWER55};
}

// Physical hardware only. Display content has one owner, computer-screen55.
// Dimensions are authored in metres rather than scaling classroom furniture.
export function buildDesktop55({parent,box,rounded,mat,x=0,y=0,z=0,id='computer',bakeStatic=()=>{}}){
 const root=new T.Group();root.name=id;root.position.set(x,y,z);parent.add(root);
 const hardware=new T.Group();root.add(hardware);
 const casing=mat('#48515b',{roughness:.53}),metal=mat('#8a969c',{metalness:.3,roughness:.45}),key=mat('#c7cecf',{roughness:.71}),black=mat('#1e2c35',{roughness:.83});
 const imported=hasComputer67();
 if(imported){placeFurniture67(hardware,'monitor',0,0,.19);placeFurniture67(hardware,'keyboard',-.04,0,-.22);placeFurniture67(hardware,'mouse',-.43,0,-.20);}else{
 rounded(casing,[0,.38,.19],[.74,.43,.075],.014,null,hardware);box(metal,[0,.14,.20],[.065,.23,.075],null,hardware);rounded(metal,[0,.025,.15],[.30,.025,.20],.008,null,hardware);
 rounded(casing,[0,.026,-.22],[.63,.030,.19],.007,null,hardware);
 for(let row=0;row<3;row++)for(let col=0;col<12;col++)box(key,[-.275+col*.05,.045,-.276+row*.053],[.039,.008,.037],null,hardware);
 rounded(casing,[.43,.03,-.20],[.09,.043,.13],.015,null,hardware);box(black,[.43,.05,-.218],[.004,.004,.03],null,hardware);
 }
 const screen=new T.Mesh(new T.PlaneGeometry(imported?MONITOR67.width:.666,imported?MONITOR67.height:.366),new T.MeshBasicMaterial({color:'#71959d',toneMapped:false}));screen.position.set(0,imported?MONITOR67.y:.38,imported?.19+MONITOR67.z:.151);screen.rotation.y=Math.PI;screen.name=id+'-screen';screen.userData.animated=true;root.add(screen);
 bakeStatic(hardware);return{root,screen};
}

export function buildLaptop55({parent,box,rounded,mat,x=0,y=0,z=0,bakeStatic=()=>{}}){
 const root=new T.Group();root.name='teacher-lecture-laptop';root.position.set(x,y,z);parent.add(root);
 const hardware=new T.Group();root.add(hardware);const casing=mat('#525e66',{metalness:.25,roughness:.53}),key=mat('#c7cecf',{roughness:.71}),black=mat('#17272f',{roughness:.8});
 rounded(casing,[0,.018,0],[.66,.036,.43],.012,null,hardware);rounded(black,[0,.039,.035],[.59,.011,.22],.004,null,hardware);
 for(let row=0;row<4;row++)for(let col=0;col<12;col++)box(key,[-.26+col*.047,.047,-.040+row*.046],[.035,.009,.030],null,hardware);
 rounded(black,[0,.040,-.142],[.20,.004,.075],.005,null,hardware);
 const lid=new T.Group();lid.position.set(0,.036,.195);lid.rotation.x=.12;hardware.add(lid);rounded(casing,[0,.193,0],[.66,.386,.028],.01,null,lid);
 const screen=new T.Mesh(new T.PlaneGeometry(.604,.340),new T.MeshBasicMaterial({color:'#74958a',toneMapped:false}));screen.position.set(0,.193,-.016);screen.rotation.y=Math.PI;screen.name='teacher-laptop-screen';screen.userData.animated=true;lid.add(screen);
 // userData.animated keeps the real tilted display out of static baking.
 bakeStatic(hardware);return{root,screen};
}
