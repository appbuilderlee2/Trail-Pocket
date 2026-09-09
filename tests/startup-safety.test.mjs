import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read = name => readFile(new URL('../'+name,import.meta.url),'utf8');

test('stalled styles release the shell and expose recovery after timeout', async()=>{
  const html=await read('index.html');
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const classes=new Set(['styles-pending']);
  const message={},repair={hidden:true};let timeout;
  vm.runInNewContext(script,{
    window:{},setTimeout:fn=>{timeout=fn;},
    document:{documentElement:{classList:{contains:x=>classes.has(x),remove:x=>classes.delete(x),add:x=>classes.add(x)}},
      getElementById:id=>id==='bootMessage'?message:repair,querySelectorAll:()=>[]},
  });
  timeout();assert.equal(classes.has('styles-pending'),false);
  assert.equal(classes.has('boot-delayed'),true);assert.equal(repair.hidden,false);
});

test('shell retries transient failures in bounded batches and retains old caches',async()=>{
  const events={};let attempts=0;const deleted=[];
  vm.runInNewContext(await read('sw.js'),{
    URL,Request,Response,AbortSignal,
    caches:{open:async()=>({addAll:async paths=>{assert.ok(paths.length<=4);if(++attempts===1)throw Error('temporary');}}),keys:async()=>['trail-pocket-shell:/app/:v4.1.7'],delete:async x=>deleted.push(x)},
    self:{registration:{scope:'https://example.org/app/'},location:{origin:'https://example.org'},clients:{claim:async()=>{}},addEventListener:(n,f)=>events[n]=f},
  });
  let pending;events.install({waitUntil:p=>pending=p});await pending;
  assert.ok(attempts>2);
  events.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,[]);
});

test('repair is opt-in and never unregisters or deletes a working shell',async()=>{
  const repair=await read('repair.html');
  assert.doesNotMatch(repair,/\.unregister\(|caches\.delete\(/);
  assert.doesNotMatch(repair,/^\s*repair\(\);/m);
  assert.ok(repair.indexOf('await verify(worker,latest.version)')<repair.indexOf("worker.postMessage({type:'UPDATE'})"));
  assert.match(repair,/worker\.state==='activated'/);
  assert.doesNotMatch(repair,/location\.replace\('\.\/\?recover/);
});
