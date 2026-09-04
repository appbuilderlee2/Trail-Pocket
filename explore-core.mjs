import {R,unproject,areaKm2} from './core.mjs';
export const WORLD=2*Math.PI*R;
export function viewportBounds(center,units,width,height,inset=.0){
  const a=unproject([center[0]-width*units*(.5-inset),center[1]-height*units*(.5-inset)]),b=unproject([center[0]+width*units*(.5-inset),center[1]+height*units*(.5-inset)]);
  return {west:Math.max(-180,a[0]),east:Math.min(180,b[0]),north:Math.min(85,a[1]),south:Math.max(-85,b[1])};
}
export function overlaps(a,b){return a.west<b.east&&a.east>b.west&&a.south<b.north&&a.north>b.south;}
export function contains(a,b){return a.west<=b.west&&a.east>=b.east&&a.south<=b.south&&a.north>=b.north;}
export function validateArea(b){if(!b||!Object.values(b).every(Number.isFinite)||b.west>=b.east||b.south>=b.north||b.west< -180||b.east>180||b.south< -85||b.north>85)throw Error('所選範圍無效，請移到地圖內。');const size=areaKm2(b);if(size>300)throw Error('範圍超過 300 km²，請放大地圖再選取。');if(size<.001)throw Error('範圍太細，請縮小地圖少少。');return size;}
export function visibleTiles(center,units,width,height){
  const z=Math.max(0,Math.min(19,Math.round(Math.log2(WORLD/(256*units))))),count=2**z,span=WORLD/count;
  const left=center[0]-width*units/2,top=center[1]-height*units/2;
  const minX=Math.max(0,Math.floor((left+WORLD/2)/span)),maxX=Math.min(count-1,Math.floor((left+width*units+WORLD/2)/span));
  const minY=Math.max(0,Math.floor((top+WORLD/2)/span)),maxY=Math.min(count-1,Math.floor((top+height*units+WORLD/2)/span)),result=[];
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)result.push({key:`${z}/${x}/${y}`,z,x,y,left:(x*span-WORLD/2-left)/units,top:(y*span-WORLD/2-top)/units,size:span/units});
  return result;
}
