export const DEFAULT_ROUND_SETTINGS=Object.freeze({duration:600,target:120});
export function validRoundSettings(value){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Number.isInteger(value.duration)&&value.duration>=300&&value.duration<=1200&&Number.isInteger(value.target)&&value.target>=30&&value.target<=120;}
