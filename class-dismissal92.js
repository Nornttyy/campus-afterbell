export const RESULT_SECONDS=5;

const uniforms=['boy','girl','glasses','ponytail'];
export function nextStudentAppearance(previous,random){
 const choices=uniforms.filter(kind=>kind!==previous);
 return choices[Math.floor(random()*choices.length)];
}
