import {prepareDeskProps} from './prepare-desk-props.js?v=campus-117&rev=178';
import {endOfJoint,installGripDrag} from './grip-drag.js?v=campus-117&rev=172';
import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
import {OrbitControls} from './vendor/addons/controls/OrbitControls.js';
import {createRiggedPalm} from './student-assets.js?v=campus-117&rev=180';
import {createDeskHands} from './game-actors.js?v=campus-117&rev=178';
import {CLASSROOM_PROP_SOURCES} from './prop-assets.js?v=campus-83';
import {teacherGripProps} from './grip-tools.js?v=campus-117&rev=171';
import {createPropGripLayer,createGripLayer,gripSides,teacherItem,FINGERS} from './item-grips.js?v=campus-117&rev=175';
import {TEXTBOOK,bookSpineHeight} from './study-book58.js?v=campus-110';
import {createUpperFloorView} from './upper-floor-view85.js?v=campus-117&rev=180';
import {createMapActivityView} from './map-activity-view77.js?v=campus-117&rev=180';

const vec=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function makeBook(redraw){
  const group=new T.Group(),{leafWidth:w,leafHeight:h,leafYaw,readingTilt}=TEXTBOOK,loader=new T.TextureLoader();
  function print(file){const t=loader.load(new URL('./assets/materials/'+file,import.meta.url).href,redraw);t.colorSpace=T.SRGBColorSpace;return new T.MeshStandardMaterial({map:t,roughness:.93});}
  const cover=print('grade7-cover-107.webp');
  for(const side of [-1,1]){
    const leaf=new T.Group();leaf.rotation.y=side*leafYaw;group.add(leaf);
    const pages=new T.Mesh(new T.BoxGeometry(w,h,.018),new T.MeshStandardMaterial({color:0xeee7d3}));pages.position.set(side*w/2,h/2,0);leaf.add(pages);
    const face=new T.Mesh(new T.PlaneGeometry(w-.012,h-.014),print(side>0?'lunyu-12-107.webp':'laozi-4-107.webp'));face.position.copy(pages.position);face.position.z=-.0092;face.rotation.y=Math.PI;leaf.add(face);
    const back=new T.Mesh(new T.PlaneGeometry(w+.002,h+.002),cover),uv=back.geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setX(i,(uv.getX(i)+(side<0?0:1))*.5);
    back.position.copy(pages.position);back.position.z=.0113;leaf.add(back);
  }
  group.position.set(0,bookSpineHeight(readingTilt)-1.43,-TEXTBOOK.seatDistance);group.rotation.set(-readingTilt,Math.PI,0);return group;
}
function canvasTexture(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
export function createGripPreview(canvas,lookup,edit){
  const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=T.NeutralToneMapping;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(39,1,.002,50),orbit=new OrbitControls(camera,canvas);
  scene.background=new T.Color('#dbe5df');orbit.minDistance=.045;orbit.maxDistance=3;
  scene.add(new T.HemisphereLight(0xffffff,0xb3b2a2,2.05));const sun=new T.DirectionalLight(0xfff6e7,2);sun.position.set(-3,5,4);scene.add(sun);
  const loader=new GLTFLoader(),cache=new Map(),nothing=()=>null,isolated=new T.Group();
  const assetReady=prepareDeskProps(Object.fromEntries(Object.entries(CLASSROOM_PROP_SOURCES).filter(([kind])=>kind!=='garlic')),{loader});
  let id,rig,roleRig,prop,book,exam,activities,fixture,generation=0,visibleSides=[],nodesVisible=true,selection='left:Thumb1',busy=false;
  const itemLayer=createPropGripLayer(lookup);let tool="finger";
  const dots=new T.Group();scene.add(dots);const pointGeo=new T.SphereGeometry(.003,10,7);
  const marker=(color)=>new T.MeshBasicMaterial({color,depthTest:false,depthWrite:false});
  const normal=marker(0x508579),selected=marker(0xff8937);
  const draw=()=>{if(!busy)renderer.render(scene,camera);};orbit.addEventListener('change',draw);
  const resize=new ResizeObserver(()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();draw();});resize.observe(canvas);
  async function build(role){
    const teacher=role==='teacher',files=teacher?['teacher-hand-left-v1','teacher-hand-right-v1']:['ponytail-hand-left-v2','ponytail-hand-right-v2'];
    const [assets]=await Promise.all([Promise.all(files.map(n=>loader.loadAsync(new URL('./assets/models/'+n+'.glb',import.meta.url).href))),assetReady]);
    const rig=createDeskHands({gripForItem:nothing,createHand:(side,scale)=>{const hand=createRiggedPalm(assets[side<0?0:1],side,scale,role);hand.group.userData.characterRole=role;return hand;}});
    rig.group.visible=false;scene.add(rig.group);
    const layers=Object.fromEntries(['left','right'].map(s=>[s,createGripLayer(rig.getHand(s),s,lookup)]));
    let tools;
    if(teacher){
      const material=color=>new T.MeshStandardMaterial({color}),boxGeo=new T.BoxGeometry(1,1,1),cylGeo=new T.CylinderGeometry(1,1,1,12);
      const make=geo=>(m,p,s,r,parent)=>{const o=new T.Mesh(geo,m);o.position.set(...p);o.scale.set(...s);if(r)o.rotation.set(...r);parent.add(o);return o;};
      tools=teacherGripProps({box:make(boxGeo),cylinder:make(cylGeo),materials:{paper:material('#fff8e5'),dark:material('#444f54'),wood:material('#de9c24'),steel:material('#d0d4cc')},leftPalm:rig.getHand('left').group,rightPalm:rig.getHand('right').group});
    }
    return {rig,layers,tools};
  }
  function markers(){
    dots.clear();dots.visible=nodesVisible;
    if(!roleRig||!nodesVisible)return;
    for(const side of visibleSides)for(const finger of Object.keys(FINGERS))for(const n of [1,2,3]){
      const joint=finger+n,bone=roleRig.layers[side].bone(joint);if(!bone)continue;
      const active=selection===side+':'+joint,point=new T.Mesh(pointGeo,active?selected:normal);
      point.userData={side,finger,n};point.renderOrder=active?4:3;point.position.copy(endOfJoint(roleRig.layers[side],finger,n));if(active)point.scale.setScalar(1.55);dots.add(point);
    }
  }
  function apply(){
    if(!roleRig||busy)return;
    itemLayer.restore();
    for(const side of visibleSides){const layer=roleRig.layers[side];layer.restore();layer.apply(id,prop);}
    itemLayer.apply(id,prop);
    scene.updateMatrixWorld(true);markers();draw();
  }
  function center(){
    if(!rig||!visibleSides.length)return;
    const bounds=new T.Box3();
    for(const side of visibleSides){
      const layer=roleRig.layers[side];for(const bone of ['','Thumb3','Index3','Middle3','Pinky3']){const node=layer.bone(bone);if(node)bounds.expandByPoint(node.getWorldPosition(vec()));}
    }
    if(prop&&id!=='plunger')bounds.union(new T.Box3().setFromObject(prop,true));
    const origin=bounds.getCenter(vec());const size=Math.max(.13,bounds.getSize(vec()).length()*.67);
    const fov=Math.min(1,camera.aspect)*Math.tan(camera.fov*Math.PI/360),distance=size/fov;
    const dir=id==='book'||id==='answerCard'?vec(.12,.25,1):id==='plunger'?vec(.34,.25,1):vec(.34,.95,.82);
    camera.position.copy(origin).addScaledVector(dir.normalize(),distance);orbit.target.copy(origin);orbit.update();draw();
  }
  async function show(item){
    const ticket=++generation;busy=true;
    const role=teacherItem(item)?'teacher':'student';if(!cache.has(role))cache.set(role,build(role));
    let next;try{next=await cache.get(role);}catch(err){cache.delete(role);throw err;}
    if(ticket!==generation)return false;
    itemLayer.restore();
    if(roleRig){for(const layer of Object.values(roleRig.layers))layer.restore();rig.group.visible=false;}
    if(book)book.visible=false;if(fixture){scene.remove(fixture);fixture=null;}
    if(exam)exam.update({player:{},students:[]});
    id=item;roleRig=next;rig=next.rig;rig.group.visible=true;visibleSides=gripSides(id);
    const [base,dish]=item.split('-'),special=['answerCard','book','plunger'].includes(item)||role==='teacher';
    const action=base;
    const state={seated:true,freeLook:true,carrying:!special,action,mealDish:dish,bookAmount:item==='book'?1:item==='answerCard'?.6:0,answerCard:item==='answerCard'};
    rig.update(0,{seated:true});for(let i=1;i<=14;i++)rig.update(i*.08,state);
    prop=special?null:rig.getProp(action);
    if(next.tools){
      for(const [name,o] of Object.entries(next.tools))o.visible=name===id;
      prop=next.tools[id];const hand=rig.getHand(visibleSides[0]);
      if(id==='torch'){hand.setCurl(.8);hand.opposeThumb(.8);prop.position.copy(hand.indexTip()).add(vec(0,-.01,0));prop.rotation.x=-.5;}
      if(id==='eraser'){hand.setCurl(.75);prop.position.copy(hand.indexTip());}
      if(id==='chalk'){hand.group.rotation.set(-.65,.1,.11);hand.setCurl(.80);hand.opposeThumb(.8);prop.position.copy(hand.indexTip()).add(vec(.004,-.013,.001));}
    }
    if(id==='book'){if(!book){book=makeBook(draw);scene.add(book);}book.visible=true;prop=book;}
    if(id==='answerCard'){
      if(!exam){exam=createUpperFloorView({scene:isolated,box(){},mat:(color,options)=>new T.MeshStandardMaterial({color,...options}),texture:canvasTexture});exam.setMap('exam');exam.setSeats([{id:0,deskX:0,deskZ:0,yaw:Math.PI}]);isolated.position.y=-1.43;}
      exam.update({player:{seatId:0,seated:true},students:[],exam:{mode:'card',card:0,cards:[0,1]},drawer:{open:true}});
      prop=exam.gripAnswerSlip(rig.getHand('left'));
    }
    if(id==='plunger'){
      if(!activities)activities=createMapActivityView(new T.Group());
      const a={kind:'plunge',id:0,age:0};
      const state={role:'student',map:'toilet',player:{mapActivity:a},students:[]};
      activities.update(state);activities.updateFirstPerson(state,rig);
      const model=activities.target('plunger',a.id);fixture=model.clone(true);
      scene.add(fixture);prop=fixture;
    }
    for(const side of ['left','right'])rig.getHand(side).group.parent.visible=visibleSides.includes(side);
    busy=false;apply();center();return true;
  }
  installGripDrag(canvas,camera,orbit,()=>busy||!prop?null:{dots,prop,layers:roleRig.layers,hands:Object.fromEntries(visibleSides.map(s=>[s,rig.getHand(s).group])),fingerMode:tool==='finger'&&edit.isFinger(),tool:tool==='finger'?'translate':tool,record:lookup(id)},edit);
  return {show,apply,center,select(side,joint,visible,dragTool){
    tool=dragTool;selection=side+':'+joint;nodesVisible=visible&&tool==='finger';markers();draw();
  }};
}
