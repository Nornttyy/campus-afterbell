import {isCampusMap,mapKind,CAMPUS_MAPS} from './classroom-layout.js?v=campus-117&rev=157';

// Keep the authored floor numbers so reopening a destination does not move any other map.
export const OPEN_CAMPUS_MAPS=CAMPUS_MAPS;

export function playableCampusMap(map){
  if(!isCampusMap(map))return null;
  const kind=mapKind(map);
  return OPEN_CAMPUS_MAPS.includes(kind)?kind:null;
}

const assetMaps={
  turf:['playground'],track:['playground'],facade:['playground','bus'],upholstery:['bus'],
  tile:['toilet'],toilet:['toilet','bus'],cloth:['dorm'],
  broth:['hotpot'],hotpotMenus:['hotpot'],hotpotVegetables:['hotpot']
};

export function assetsForOpenMaps(sources){
  return Object.fromEntries(Object.entries(sources).filter(([key])=>{
    const maps=Object.hasOwn(assetMaps,key)?assetMaps[key]:null;
    return !maps||maps.some(map=>OPEN_CAMPUS_MAPS.includes(map));
  }));
}
