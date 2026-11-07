import * as T from './vendor/three.module.js';
import {SEATS,TEACHER_EYE_HEIGHT,floorHeight} from './classroom-layout.js?v=map-30d';

export function createRoomVariants({scene,box,rounded,mat,texture,bakeStatic}){
  const group=new T.Group(),hardware=new T.Group(),screens=new Map();group.name='computer-lab';group.add(hardware);scene.add(group);group.visible=false;
  const shell=mat('#424b59',{roughness:.42}),keys=mat('#d5d9df'),base=mat('#909ba9',{metalness:.35,roughness:.48});
  const work=texture(512,288,(c,w,h)=>{
    c.fillStyle='#b9d7e1';c.fillRect(0,0,w,h);c.fillStyle='#305264';c.fillRect(0,0,w,28);
    c.fillStyle='#f4f5ed';c.fillRect(55,48,402,207);c.fillStyle='#354956';c.font='bold 22px sans-serif';c.fillText('课堂练习',80,85);
    for(let i=0;i<6;i++){c.fillStyle=i%2?'#abbcc1':'#718b96';c.fillRect(80,105+i*22,280-(i%3)*45,5);}c.fillStyle='#6cb6a8';c.fillRect(342,219,80,21);
  });
  function drawPlay(c,w,h,t=0){
    c.fillStyle='#1b2e48';c.fillRect(0,0,w,h);c.fillStyle='#c0e9ed';for(let i=0;i<25;i++)c.fillRect(((i*103-t*28)%w+w)%w,(i*79)%h,3,3);
    c.save();c.translate(0,Math.sin(t*2)*14);c.fillStyle='#55d1cc';c.beginPath();c.moveTo(95,122);c.lineTo(148,143);c.lineTo(95,164);c.closePath();c.fill();c.restore();
    c.fillStyle='#ffba5b';for(let i=0;i<3;i++){c.fillRect(310+i*59,52+i%2*120,29,28);c.fillRect(317+i*59,46+i%2*120,15,40);}
    c.fillStyle='#eaefff';c.fillRect(163+(t*140)%130,140,26,5);c.fillRect(290+(t*140)%120,140,15,5);
  }
  const play=texture(512,288,drawPlay);let animationTick=-1;
  const workMat=mat('#ffffff',{map:work,emissive:'#ffffff',emissiveMap:work,emissiveIntensity:.38,roughness:.6});
  const gameMat=mat('#ffffff',{map:play,emissive:'#ffffff',emissiveMap:play,emissiveIntensity:.55,roughness:.6});
  const screenGeo=new T.PlaneGeometry(.586,.326);
  for(const s of SEATS){
    const pos=s.deskZ;
    rounded(shell,[s.x,1.23,pos],[.66,.4,.092],.018,null,hardware);
    box(base,[s.x,.964,pos],[.075,.19,.075],null,hardware);rounded(base,[s.x,.873,pos],[.32,.022,.20],.008,null,hardware);
    rounded(shell,[s.x,.88,pos-.25],[.58,.028,.16],.008,null,hardware);
    for(let r=0;r<3;r++)for(let k=0;k<11;k++)box(keys,[s.x-.24+k*.046,.897,pos-.295+r*.045],[.035,.008,.029],null,hardware);
    rounded(shell,[s.x+.42,.886,pos-.23],[.08,.035,.12],.016,null,hardware);
    const screen=new T.Mesh(screenGeo,workMat);screen.position.set(s.x,1.23,pos-.048);screen.rotation.y=Math.PI;group.add(screen);screens.set(s.id,screen);
  }
  bakeStatic(hardware);
  const light=new T.SpotLight('#fff4d5',75,13,.43,.65,1.4);light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.bias=-.001;scene.add(light,light.target);light.visible=false;
  return{group,screens,light,
    setMap(map){group.visible=map==='computer';light.visible=map==='night';},
    update(state){
      if(group.visible&&state?.students.some(s=>s.computerActive&&s.holding)){const tick=Math.floor(state.elapsed*10);if(tick!==animationTick){animationTick=tick;drawPlay(play.image.getContext('2d'),512,288,tick/10);play.needsUpdate=true;}}
      if(group.visible){const bySeat=new Map((state?.students||[]).filter(s=>s.seated).map(s=>[s.seatId,s]));for(const [id,screen]of screens)screen.material=bySeat.get(id)?.computerActive?gameMat:workMat;}
      if(light.visible){
        const t=state?.teacher||{x:.99,z:5.55,yaw:Math.PI},pitch=state?.role==='teacher'?state.player.pitch:.08;
        const height=TEACHER_EYE_HEIGHT+floorHeight(t.x,t.z,state?.map);light.position.set(t.x,height,t.z);light.target.position.set(t.x+Math.sin(t.yaw)*6,height-Math.tan(pitch)*6,t.z+Math.cos(t.yaw)*6);
      }
    },dispose(){screenGeo.dispose();light.shadow.map?.dispose();}
  };
}
