import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { openPackageCatalog, openPackageFiles } from '../package-storage.mjs';

test('v4 catalog is isolated from the v3 rollback database', async () => {
  const factory = new IDBFactory();
  const old = await new Promise((resolve, reject) => {
    const r = factory.open('trail-pocket:/test/', 5);
    r.onupgradeneeded = () => {
      for (const name of ['routes','maps','settings','areas','activities','geopdfs','markers'])
        r.result.createObjectStore(name, { keyPath: 'id' }).put({ id: 'keep', value: name });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const catalog = await openPackageCatalog(factory, '/test/');
  assert.deepEqual([...catalog.objectStoreNames], ['downloads','manifests','packages']);
  assert.equal(old.version, 5);
  for (const name of old.objectStoreNames) {
    const result = await new Promise(resolve => {
      const r = old.transaction(name).objectStore(name).get('keep');
      r.onsuccess = () => resolve(r.result);
    });
    assert.equal(result.value, name);
  }
  old.close(); catalog.close();
});

test('unsupported file storage fails explicitly', async () => {
  await assert.rejects(openPackageFiles({}), /未支援/);
});

test('partial writes require the exact resume offset and reject paths', async () => {
  let data = new Uint8Array();
  const handle = {
    getFile: async () => new Blob([data]),
    createWritable: async () => ({
      async write({position, data: chunk}) {
        const next = new Uint8Array(position + chunk.length);
        next.set(data); next.set(chunk, position); data = next;
      }, async close() {}, async abort() {},
    }),
  };
  const files = await openPackageFiles({getDirectory: async () => ({
    getDirectoryHandle: async () => ({getFileHandle: async () => handle}),
  })});
  await files.append('park.partial', 0, new Uint8Array([1,2]));
  await files.append('park.partial', 2, new Uint8Array([3]));
  assert.deepEqual([...new Uint8Array(await files.read('park.partial'))], [1,2,3]);
  await assert.rejects(files.append('park.partial', 1, new Uint8Array([9])), /不一致/);
  await assert.rejects(files.read('../other'), /名稱/);
  await assert.rejects(files.append('active.pmtiles', 3, new Uint8Array()), /只可/);
});
