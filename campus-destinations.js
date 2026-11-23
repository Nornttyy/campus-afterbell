import {CAMPUS_MAPS,isCampusMap,mapKind} from './classroom-layout.js?v=campus-95';

// Keep the authored floor numbers so reopening a destination does not move any other map.
const suspended=new Set(['playground','exam','bus','cafeteria']);
export const OPEN_CAMPUS_MAPS=Object.freeze(['bus',...CAMPUS_MAPS].filter(map=>!suspended.has(map)));

export function playableCampusMap(map){
  if(!isCampusMap(map))return null;
  const kind=mapKind(map);
  return OPEN_CAMPUS_MAPS.includes(kind)?kind:null;
}
