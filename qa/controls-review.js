import {createClassroom} from '../dist/classroom.js?v=classroom-25';
import {createClassroomGame} from '../dist/classroom-game.js?v=classroom-25';
import {ClassroomRound} from '../dist/classroom-rules.js?v=classroom-25';
class ReviewRound extends ClassroomRound{
  reset(){return super.reset(11);}
  start(){super.start();this.teacher.x=this.teacher.z=30;this._thinkAt=this._plan.until=Infinity;this._plan.route=[];for(const s of this.students)if(s.isTeammate)s._decisionAt=Infinity;return this.snapshot();}
}
const canvas=document.querySelector('#classroom'),scene=await createClassroom(canvas),round=new ReviewRound({target:100000});
const audio={apply(){},start(){},click(){},effect(){}};
const game=createClassroomGame({scene,audio,round});
document.body.classList.add('scene-ready');document.querySelector('#loader').remove();
document.querySelector('#enter-classroom').onclick=()=>game.start();
for(const kind of ['snack','smoke'])document.querySelector('#qa-'+kind).onclick=()=>{
  round.returnItem();if(!round.snapshot().drawer.open)round.toggleDrawer();round.takeSlot(round.player._slots.findIndex(s=>s.action===kind));
};
document.querySelector('#qa-pitch').oninput=e=>round.setLook(0,Number(e.target.value));
// Capture the state before the real mouse-up reaches the game listener.
document.addEventListener('mouseup',e=>{
  if(e.button!==0||e.target!==canvas)return;
  const s=round.snapshot();canvas.dataset.beforeRelease=JSON.stringify({holding:s.holding,progress:s.actionProgress,carrying:s.drawer.drawnSlot,projectiles:s.projectiles.length});
},true);
const holdReview=document.createElement('button');holdReview.id='qa-charge';holdReview.textContent='保持蓄力（检视）';document.querySelector('#qa-controls').append(holdReview);holdReview.onclick=()=>round.hold(true);
