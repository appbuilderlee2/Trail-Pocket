import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePackageManifest} from '../package-manifest.mjs';

const manifest=()=>({schema:1,id:'para-wirra',name:'Para Wirra',version:'2026.09.08',bounds:[138.76,-34.76,138.94,-34.57],builtAt:'2026-09-08T00:00:00Z',osmDate:'2026-09-08',minAppVersion:'4.0.0',files:['map.pmtiles','search.index','routing.graph'].map(name=>({name,size:10,sha256:'a'.repeat(64),url:`https://example.test/${name}`}))});

test('v4 manifest requires exact logical files and safe geographic bounds',()=>{
  assert.equal(validatePackageManifest(manifest()).files.length,3);
  const reversed=manifest();reversed.bounds=[139,-34,138,-35];
  assert.throws(()=>validatePackageManifest(reversed),/覆蓋範圍/);
  const duplicate=manifest();duplicate.files[2].name='search.index';
  assert.throws(()=>validatePackageManifest(duplicate),/檔案/);
});

test('v4 manifest rejects oversized or unsafe file entries',()=>{
  const oversized=manifest();oversized.files[0].size=5*1024*1024*1024;
  assert.throws(()=>validatePackageManifest(oversized),/檔案/);
  const unsafe=manifest();unsafe.files[0].url='javascript:alert(1)';
  assert.throws(()=>validatePackageManifest(unsafe),/網址/);
});
