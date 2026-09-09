import test from 'node:test';import assert from 'node:assert/strict';import {readFile,access} from 'node:fs/promises';import vm from 'node:vm';
const code=await readFile(new URL('../sw.js',import.meta.url),'utf8');
function harness(fail=false){const scope='https://example.org/hiking/',events={},entries=new Map(),keys=['unrelated','trail-pocket-shell:/other/:v1'],removed=[];const cache={async addAll(paths){if(fail)throw Error('asset missing');for(const p of paths){const key=typeof p==='string'?new URL(p,scope).href:p.url;if(typeof p!=='string')assert.equal(p.cache,'reload');entries.set(key,new Response(typeof p==='string'?p:new URL(key).pathname));}},async match(req){const u=typeof req==='string'?req:req.url;return entries.get(u)?.clone();}};const context={URL,Response,Request,AbortSignal,fetch:async()=>{throw Error('offline');},caches:{open:async()=>cache,keys:async()=>keys,delete:async k=>{removed.push(k);}},self:{registration:{scope},location:{origin:'https://example.org'},clients:{claim:async()=>{}},skipWaiting(){},addEventListener:(n,f)=>events[n]=f}};vm.runInNewContext(code,context);return {scope,events,entries,removed};}
const dispatchWait=(fn,extra={})=>new Promise((resolve,reject)=>fn({...extra,waitUntil:p=>p.then(resolve,reject)}));
test('precache files exist and service worker supports offline reopening under a subpath',async()=>{const h=harness();await dispatchWait(h.events.install);for(const u of h.entries.keys()){const relative=new URL(u).pathname.replace('/hiking/','')||'index.html';await access(new URL('../'+relative,import.meta.url));}let answer;await dispatchWait(h.events.message,{data:{type:'STATUS'},ports:[{postMessage:m=>answer=m}]});assert.equal(answer.ready,true);const result=await new Promise((resolve,reject)=>h.events.fetch({request:{method:'GET',url:h.scope,mode:'navigate'},respondWith:p=>p.then(resolve,reject)}));assert.equal(await result.text(),'/hiking/');let handled=false;h.events.fetch({request:{method:'GET',url:'https://overpass.kumi.systems/api/interpreter'},respondWith:()=>handled=true});assert.equal(handled,false);await dispatchWait(h.events.activate);assert.equal(h.removed.length,0);});
test('failed precaching does not report installation success',async()=>{const h=harness(true);await assert.rejects(dispatchWait(h.events.install));let answer;await dispatchWait(h.events.message,{data:{type:'STATUS'},ports:[{postMessage:m=>answer=m}]});assert.equal(answer.ready,false);});
test('Pages build copies every service-worker shell asset',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  const assetBlock=code.match(/const ASSETS = \[([\s\S]*?)\n\];/)?.[1]||'';
  const assets=[...assetBlock.matchAll(/"\.\/(.*?)"/g)].map(match=>match[1]).filter(Boolean);
  for(const asset of assets)assert.ok(workflow.includes(asset)||workflow.includes(asset.split('/').at(-1)),`Pages build is missing ${asset}`);
});
test('first visit paints a loading shell without waiting for every stylesheet',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/<html[^>]+class="styles-pending"/);
  assert.match(html,/id="bootSplash"/);
  assert.match(html,/id="bootRepair"[^>]+hidden/);
  const styles=[...html.matchAll(/<link class="app-stylesheet"[^>]+>/g)].map(match=>match[0]);
  assert.ok(styles.length>=10,'expected all app stylesheets to use the non-blocking loader');
  for(const style of styles){
    assert.match(style,/media="print"/);
    assert.match(style,/onload="trailStyleSettled\(this\)"/);
    assert.match(style,/onerror="trailStyleSettled\(this,true\)"/);
  }
  assert.match(html,/<script defer src="\.\/vendor\/pmtiles\.js"><\/script>/);
  assert.match(html,/<link rel="modulepreload" href="\.\/app\.mjs"/);
});
test('deployed module preload and boot import share the same versioned URL',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  assert.match(workflow,/html=html\.replace\('href="\.\/app\.mjs"',`href="\.\/app\.mjs\?v=\$\{version\}"`\)/);
  assert.match(code,/\.replace\('href="\.\/app\.mjs"', `href="\.\/app\.mjs\?v=\$\{APP_VERSION\}"`\)/);
});
