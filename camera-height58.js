import {STUDENT_PROPORTIONS} from './student-proportions73.js?v=campus-81';
import {TEACHER_PROPORTIONS} from './teacher-proportions73.js?v=campus-81';
// Standing eye height follows the updated teacher model. Keep seated hands authored.
export const STUDENT_VIEW_HEIGHT=STUDENT_PROPORTIONS.eyeHeight;
export const STUDENT_SEATED_VIEW_HEIGHT=1.43;
export const TEACHER_VIEW_RATIO=TEACHER_PROPORTIONS.eyeHeight/STUDENT_VIEW_HEIGHT;
export const TEACHER_VIEW_HEIGHT=STUDENT_VIEW_HEIGHT*TEACHER_VIEW_RATIO;
export function teacherViewHeight(player){return player?.seated?STUDENT_SEATED_VIEW_HEIGHT*1.20:TEACHER_PROPORTIONS.eyeHeight;}
