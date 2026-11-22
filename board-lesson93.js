export const BOARD_SECONDS=10;
export const BOARD_FADE_SECONDS=2.4;

export function advanceBoard(teacher,dt,writing){
 if(writing){
  if(!teacher.markingBoard)teacher.boardAmount=0;
  teacher.boardAmount=Math.min(1,(teacher.boardAmount||0)+dt/BOARD_SECONDS);
  teacher.boardOpacity=1;
 }else if(teacher.boardOpacity){
  teacher.boardOpacity=Math.max(0,teacher.boardOpacity-dt/BOARD_FADE_SECONDS);
  if(!teacher.boardOpacity)teacher.boardAmount=0;
 }
 teacher.markingBoard=Boolean(writing);
}
