import {validTuning} from './round-tuning93.js?v=campus-117';
export const DEFAULT_ROUND_SETTINGS=Object.freeze({duration:600,target:120});
export function validRoundSettings(value){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Number.isInteger(value.duration)&&value.duration>=300&&value.duration<=1200&&Number.isInteger(value.target)&&value.target>=20&&value.target<=160&&validTuning(value.tuning)&&(value.capacity===undefined||Number.isInteger(value.capacity)&&value.capacity>=2&&value.capacity<=8)&&(value.chalkStamina===undefined||typeof value.chalkStamina==='boolean');}

export function chalkStaminaCost(round){return round.chalkStamina&&round.stage==='class'?(round.tuning?.chalkCost??8):0;}
export function canThrowWithStamina(round){return round.teacher.stamina>0&&round.teacher.stamina>=chalkStaminaCost(round);}
