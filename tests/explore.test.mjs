import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {project} from '../core.mjs';
import {WORLD,visibleTiles,viewportBounds,validateArea,overlaps,contains} from '../explore-core.mjs';
import {OnlineMap} from '../online-map.mjs';

test('visible tile grid covers only current viewport and indices remain valid',()=>{
  for(const point of [[138.82,-34.68],[114.17,22.3],[0,0],[-179,84],[179,-84]])for(const units of [.15,2,80,30000]){
    const tiles=visibleTiles(project(point),units,1000,700);assert.ok(tiles.length>0&&tiles.length<80);
    for(const t of tiles){assert.ok(t.x>=0&&t.x<2**t.z&&t.y>=0&&t.y<2**t.z);assert.ok(t.left<1001&&t.left+t.size> -1&&t.top<701&&t.top+t.size> -1);assert.ok(t.z>=0&&t.z<=19);}
  }
});
test('Web Mercator tile locations agree with route projection',()=>{
  const center=project([138.82,-34.68]),units=4,tiles=visibleTiles(center,units,1000,700);
  for(const t of tiles){const span=WORLD/2**t.z;assert.ok(Math.abs(t.left-((t.x*span-WORLD/2-center[0])/units+500))<1e-6);assert.ok(Math.abs(t.top-((t.y*span-WORLD/2-center[1])/units+350))<1e-6);}
});
test('selection frame derives same bounds as drawn 15 percent inset',()=>{const c=project([138.82,-34.68]),whole=viewportBounds(c,5,1000,700),frame=viewportBounds(c,5,1000,700,.15);assert.ok(contains(whole,frame));assert.ok(frame.west>whole.west&&frame.east<whole.east&&frame.north<whole.north&&frame.south>whole.south);assert.ok(validateArea(frame)>1);});
test('area validation prevents world downloads and invalid geometry',()=>{for(const b of [{west:-180,east:180,south:-85,north:85},{west:NaN,east:1,south:0,north:1},{west:2,east:1,south:0,north:1},{west:0,east:1,south:86,north:87}])assert.throws(()=>validateArea(b));});
test('disjoint downloaded regions leave gaps rather than claiming union coverage',()=>{const a={west:0,east:1,south:0,north:1},b={west:10,east:11,south:10,north:11},gap={west:4,east:5,south:4,north:5};assert.equal(overlaps(a,b),false);assert.equal(overlaps(a,gap)||overlaps(b,gap),false);assert.equal(contains(a,b),false);assert.equal(contains(a,{west:.2,east:.3,south:.2,north:.3}),true);});
test('offline renderer makes no tile requests and retries require action',()=>{
  const prior=globalThis.Image,requests=[];globalThis.Image=class {set src(url){requests.push(url);}};
  const online=new OnlineMap(()=>{},()=>{}),c={fillRect(){},drawImage(){}};
  assert.equal(online.draw(c,project([138,-34]),5,400,400),false);online.loadVisible();assert.equal(requests.length,0);
  online.setEnabled(true);online.draw(c,project([138,-34]),5,400,400);online.loadVisible();const count=requests.length;assert.ok(count>0);online.loadVisible();assert.equal(requests.length,count);assert.ok(requests.every(u=>u.startsWith('https://tile.openstreetmap.org/')));
  online.setEnabled(false);online.loadVisible();assert.equal(requests.length,count);globalThis.Image=prior;
});
test('all new static modules deploy and precache, online tiles are not precached',async()=>{
  const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8'),workflow=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  for(const asset of ['explore.mjs','explore-core.mjs','online-map.mjs','explore.css']){assert.ok(sw.includes("'./"+asset+"'"));assert.ok(workflow.includes(asset));}
  assert.equal(sw.includes('tile.openstreetmap.org'),false);
  const areaCode=await readFile(new URL('../explore.mjs',import.meta.url),'utf8');assert.equal(areaCode.includes('tile.openstreetmap.org'),false);
});
