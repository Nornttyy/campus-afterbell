import {createClassroom} from '../dist/classroom.js?v=classroom-25';
import {createClassroomGame} from '../dist/classroom-game.js?v=classroom-25';
import {TeacherRound} from '../dist/teacher-rules.js?v=classroom-25';
import {ClassroomRound} from '../dist/classroom-rules.js?v=classroom-25';
const params=new URLSearchParams(location.search),teacher=params.get('role')!=='student',map=params.get('map')||'classroom';
const canvas=document.querySelector('#classroom'),scene=await createClassroom(canvas),round=new (teacher?TeacherRound:ClassroomRound)({seed:44,map,target:100000});
const audio={apply(){},start(){},click(){},effect(){}};
const game=createClassroomGame({scene,audio,round});
document.body.classList.add('scene-ready');document.querySelector('#loader').remove();
document.querySelector('#enter-classroom').onclick=()=>{
 game.start();for(const s of round.students)s._decisionAt=Infinity;
 if(!teacher){round.teacher.x=round.teacher.z=30;round._thinkAt=round._plan.until=Infinity;round._plan.route=[];}
};
function aim(real){const s=round.students.find(s=>!s.caught&&round._team.has(s.id)===real);round.player.x=s.x;round.player.z=s.z+1.4;round.setLook(Math.PI,Math.atan2(.16,1.4));}
document.querySelector('#qa-student').onclick=()=>aim(true);
document.querySelector('#qa-npc').onclick=()=>aim(false);
document.querySelector('#qa-miss').onclick=()=>round.setLook(Math.PI,-1);
document.querySelector('#qa-pitch').oninput=e=>round.setLook(teacher?Math.PI:0,Number(e.target.value));
document.querySelector('#qa-release').onclick=()=>round.hold(false);
setInterval(()=>canvas.dataset.qa=JSON.stringify({role:round.snapshot().role,caught:round.snapshot().caughtCount,wrong:round.wrongCards,completed:round.completed,score:round.score,computer:round.player._computerActive,holding:round.holding}),100);
