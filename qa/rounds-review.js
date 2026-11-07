import {createClassroom} from '../dist/classroom.js?v=restraint-26';
import {createClassroomGame} from '../dist/classroom-game.js?v=restraint-26';
import {TeacherRound} from '../dist/teacher-rules.js?v=restraint-26';
import {ClassroomRound} from '../dist/classroom-rules.js?v=restraint-26';
import {DETENTION} from '../dist/classroom-layout.js?v=restraint-26';
const params=new URLSearchParams(location.search),teacher=params.get('role')!=='student',map=params.get('map')||'classroom';
const canvas=document.querySelector('#classroom'),scene=await createClassroom(canvas),round=new (teacher?TeacherRound:ClassroomRound)({seed:44,map,target:100000});
const audio={apply(){},start(){},click(){},effect(){}};
const game=createClassroomGame({scene,audio,round});
document.body.classList.add('scene-ready');document.querySelector('#loader').remove();
document.querySelector('#enter-classroom').onclick=()=>{
 game.start();for(const s of round.students)s._decisionAt=Infinity;
 if(!teacher){round.teacher.x=round.teacher.z=30;round._thinkAt=round._plan.until=Infinity;round._plan.route=[];}
};
function aim(real){const s=round.students.find(s=>!s.caught&&round._team.has(s.id)===real);round.player.x=s.x;round.player.z=s.z+1.4;round.setLook(Math.PI,Math.atan2(.46,1.4));}
document.querySelector('#qa-student').onclick=()=>aim(true);
document.querySelector('#qa-npc').onclick=()=>aim(false);

document.querySelector('#qa-pitch').oninput=e=>round.setLook(teacher?Math.PI:0,Number(e.target.value));
document.querySelector('#qa-post').onclick=()=>{const p=DETENTION.find(p=>!round.students.some(s=>s.postId===p.id));round.player.x=p.x;round.player.z=p.z-1.12;round.setLook(0,0);};
document.querySelector('#qa-view').onclick=()=>{const s=round.students.find(s=>s.caught);round.player.x=s.x+.45;round.player.z=s.z-2.1;round.player.seated=false;round.player.seatId=null;round.setLook(-.2,.22);};
document.querySelector('#qa-rescue').onclick=()=>{const s=round.students[2];round.teacher.x=s.x;round.teacher.z=s.z+.9;round._stun(s);round._grab(s);round.teacher.x=DETENTION[0].x;round.teacher.z=DETENTION[0].z-1.1;round._bind(0);round.teacher.x=round.teacher.z=30;round.player.seated=false;round.player.seatId=null;round.player.x=s.x;round.player.z=s.z-1.3;round.setLook(0,.35);};
document.querySelector('#qa-escort').onclick=()=>{const s=round.students[27];round.teacher.x=.99;round.teacher.z=s.z;round.teacher.yaw=-Math.PI/2;round._stun(s);round._grab(s);round._thinkAt=Infinity;round.player.seated=false;round.player.seatId=null;round.player.x=s.x+1.4;round.player.z=s.z-2.2;round.setLook(-.5,.15);};
document.querySelector('#qa-grip').onclick=()=>{document.querySelector('#qa-escort').click();round._advanceEscort=()=>{};};
setInterval(()=>canvas.dataset.qa=JSON.stringify({role:round.snapshot().role,caught:round.snapshot().caughtCount,wrong:round.wrongGrabs,carriedId:round.teacher.carriedId,posts:round.snapshot().posts,rescue:round.snapshot().rescue,player:round.snapshot().player,completed:round.completed,score:round.score,computer:round.player._computerActive,holding:round.holding}),100);
