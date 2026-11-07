import {createClassroom} from '../dist/classroom.js?v=classroom-34';
import {createClassroomGame} from '../dist/classroom-game.js?v=classroom-34';
import {ClassroomRound} from '../dist/classroom-rules.js?v=classroom-34';
import {attachReviewLog} from './review-event-log.js?v=classroom-34';
class ReviewRound extends ClassroomRound{
  reset(){return super.reset(11);}
  start(){super.start();this.teacher.x=this.teacher.z=30;this._thinkAt=this._plan.until=Infinity;this._plan.route=[];for(const s of this.students)if(s.isTeammate)s._decisionAt=Infinity;return this.snapshot();}
}
const canvas=document.querySelector('#classroom'),scene=await createClassroom(canvas),round=new ReviewRound({target:100000});
const audio={apply(){},start(){},click(){},effect(){}};
const game=createClassroomGame({scene,audio,round});
attachReviewLog(round);
document.body.classList.add('scene-ready');document.querySelector('#loader').remove();
document.querySelector('#enter-classroom').onclick=()=>game.start();
for(const kind of ['snack','smoke','drink','burger','flash','ink'])document.querySelector('#qa-'+kind).onclick=()=>{
  round.returnItem();if(!round.snapshot().drawer.open)round.toggleDrawer();
  round.player._slots[0]={id:0,action:kind,progress:0,readyAt:0,uses:0};round.takeSlot(0);
};
document.querySelector('#qa-pitch').oninput=e=>round.setLook(0,Number(e.target.value));
// Capture the state before the real mouse-up reaches the game listener.
document.addEventListener('mouseup',e=>{
  if(e.button!==0||e.target!==canvas)return;
  const s=round.snapshot();canvas.dataset.beforeRelease=JSON.stringify({holding:s.holding,progress:s.actionProgress,carrying:s.drawer.drawnSlot,projectiles:s.projectiles.length});
},true);
const holdReview=document.createElement('button');holdReview.id='qa-charge';holdReview.textContent='保持蓄力（检视）';document.querySelector('#qa-controls').append(holdReview);holdReview.onclick=()=>round.hold(true);
