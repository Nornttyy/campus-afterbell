import {createClassroom} from '../dist/classroom.js?v=campus-64';
import {createClassroomGame} from '../dist/classroom-game.js?v=campus-64';
import {TeacherRound} from '../dist/teacher-rules.js?v=campus-64';
import {ClassroomRound} from '../dist/classroom-rules.js?v=campus-64';
import {DETENTION} from '../dist/classroom-layout.js?v=campus-64';
import {attachReviewLog} from './review-event-log.js?v=campus-64';
const params=new URLSearchParams(location.search),teacher=params.get('role')!=='student',map=params.get('map')||'classroom';
const canvas=document.querySelector('#classroom'),scene=await createClassroom(canvas),round=new (teacher?TeacherRound:ClassroomRound)({seed:44,map,target:100000});
const audio={apply(){},start(){},click(){},effect(){}};
const game=createClassroomGame({scene,audio,round});
attachReviewLog(round);
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
document.querySelector('#qa-escort').onclick=()=>{const s=round.students[27];s.x=-.42;s.z=4.6;round.teacher.x=0;round.teacher.z=4;round.teacher.yaw=0;round._stun(s);round._grab(s);round._thinkAt=Infinity;round.player.seated=false;round.player.seatId=null;round.player.x=-2.5;round.player.z=3.8;round.setLook(Math.atan2(2.08,.8),.14);};
document.querySelector('#qa-grip').onclick=()=>{document.querySelector('#qa-escort').click();round._advanceEscort=()=>{};};
setInterval(()=>canvas.dataset.qa=JSON.stringify({role:round.snapshot().role,caught:round.snapshot().caughtCount,wrong:round.wrongGrabs,stamina:round.teacher.stamina,writing:round.teacher.writing,carriedId:round.teacher.carriedId,posts:round.snapshot().posts,rescue:round.snapshot().rescue,player:round.snapshot().player,completed:round.completed,score:round.score,computer:round.player._computerActive,holding:round.holding}),100);

function viewpoint(x,z,yaw,pitch){round.player.seated=false;round.player.seatId=null;round.player.x=x;round.player.z=z;round.setLook(yaw,pitch);}
document.querySelector('#qa-front').onclick=()=>viewpoint(.1,4.40,Math.PI,.17);
document.querySelector('#qa-corridor').onclick=()=>viewpoint(7.12,5.1,Math.PI,.04);
document.querySelector('#qa-glasses').onclick=()=>{const s=round.students[16];viewpoint(s.x,s.z+1.45,Math.PI,.27);};

const boardReview=document.createElement('button');boardReview.id='qa-board';boardReview.textContent='黑板前（体力 50）';document.querySelector('#qa-controls').append(boardReview);boardReview.onclick=()=>{round.player.x=2.0;round.player.z=5.40;round.setLook(0,-.16);round.teacher.stamina=50;};

const boundReview=document.createElement('button');boundReview.id='qa-bound-player';boundReview.textContent='自己绑柱';document.querySelector('#qa-controls').append(boundReview);boundReview.onclick=()=>{if(teacher)return;round.teacher.x=round.player.x;round.teacher.z=round.player.z+.9;round._stun(round.player);round._grab(round.player);round.teacher.x=DETENTION[0].x;round.teacher.z=DETENTION[0].z-1.1;round._bind(0);round.teacher.x=round.teacher.z=30;round._plan.route=[];round.setLook(Math.PI,0);};
