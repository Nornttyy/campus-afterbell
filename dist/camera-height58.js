// View height is independent of the unchanged character mesh and its eyes.
export const STUDENT_VIEW_HEIGHT=1.65;
export const STUDENT_SEATED_VIEW_HEIGHT=1.43;
export const TEACHER_VIEW_RATIO=1.20;
export const TEACHER_VIEW_HEIGHT=STUDENT_VIEW_HEIGHT*TEACHER_VIEW_RATIO;
export function teacherViewHeight(player){return (player?.seated?STUDENT_SEATED_VIEW_HEIGHT:STUDENT_VIEW_HEIGHT)*TEACHER_VIEW_RATIO;}
