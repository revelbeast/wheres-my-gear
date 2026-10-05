const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function setup(options = {}) {
  const docs = new Map([['a', { isDeleted: true, itemPhotoStoragePath: 'shared' }], ['b', { isDeleted: true, itemPhotoStoragePath: 'shared' }], ['active', { name: 'Active' }]]);
  let cached = [...docs].map(([id, data]) => ({ id, ...data })), reads = 0, transactions = 0;
  const writes = [], auth = { currentUser: options.unauthenticated ? null : { uid: 'u' } };
  const queue = options.pending ?? [];
  const exports = {};
  const photos = new Proxy({}, { get: () => () => assert.fail('Photos/Siri must not be mutated') });
  const snapshot = (id, value) => ({ id, exists: () => !!value, data: () => value });
  const mocks = {
    '@react-native-community/netinfo': { default: { fetch: async () => options.network ?? { isConnected: true, isInternetReachable: true } } },
    '../firebaseConfig': { db: {}, auth, storage: { app: { options: { storageBucket: 'bucket' } } } },
    './cloudPhotoStorage': photos, './localPhotoStorage': photos, './siriGearCache': photos,
    './offlineQueue': {
      getOfflineQueue: async () => queue,
      enqueueOfflineOperation: () => assert.fail('No queue creation'),
      getCachedInventoryItems: async () => cached,
      cacheInventoryItems: async (_uid, items) => { if (options.cacheFails) throw Error('cache'); cached = items; },
    },
    'firebase/firestore': {
      doc: (...parts) => parts.slice(1).join('/'), collection: (...parts) => parts.slice(1).join('/'),
      getDocsFromServer: async path => {
        assert.equal(path, 'users/u/inventoryItems'); reads++;
        if (options.verifyFails && reads === 4) throw Error('verify');
        if (options.newTrash && reads === 4) docs.set('new', { isDeleted: true });
        return { docs: [...docs].map(([id, value]) => snapshot(id, value)) };
      },
      runTransaction: async (_db, fn) => {
        transactions++;
        if (options.restoreSecond && transactions === 2) docs.get('b').isDeleted = false;
        const pending = [];
        const result = await fn({ get: async path => snapshot(path.split('/').pop(), docs.get(path.split('/').pop())), delete: path => pending.push(path) });
        if (options.failAt === transactions) throw { code: 'unavailable' };
        for (const path of pending) { assert.ok(path.startsWith('users/u/inventoryItems/')); docs.delete(path.split('/').pop()); writes.push(path); }
        return result;
      },
    },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/gearService.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; }, URL, console: { warn() {} }, setTimeout, clearTimeout });
  return { service: exports, docs, writes, queue, cache: () => cached };
}
test('multiple Trash items delete sequentially; active data/cache survive; retained photos count as successes', async () => {
  const h = setup(); const result = await h.service.emptyDeletedItems();
  assert.equal(result.deletedCount, 2); assert.equal(result.remainingItems.length, 0); assert.equal(result.failureCode, null);
  assert.deepEqual(h.writes, ['users/u/inventoryItems/a', 'users/u/inventoryItems/b']);
  assert.equal(h.docs.get('active').name, 'Active'); assert.deepEqual(Array.from(h.cache(), x => x.id), ['active']); assert.equal(h.queue.length, 0);
});
for (const [name, options, code] of [
  ['unauthenticated', { unauthenticated: true }, 'UNAUTHENTICATED'],
  ['offline', { network: { isConnected: false } }, 'CONNECT_REQUIRED'],
  ['unknown', { network: { isConnected: true, isInternetReachable: null } }, 'CONNECT_REQUIRED'],
  ...['createItem', 'updateInventoryItem', 'deleteInventoryItem'].map(type => [type, { pending: [{ userId: 'u', type }] }, 'SYNC_REQUIRED']),
]) test(`preflight ${name} refuses before mutation`, async () => {
  const h = setup(options); await assert.rejects(h.service.emptyDeletedItems(), e => e.code === code); assert.equal(h.writes.length, 0); assert.equal(h.docs.size, 3);
});
test('partial failure stops, keeps confirmed deletion, refreshes remaining Trash and preserves its cache', async () => {
  const h = setup({ failAt: 2 }); const result = await h.service.emptyDeletedItems();
  assert.equal(result.deletedCount, 1); assert.equal(result.failureCode, 'unavailable'); assert.deepEqual(Array.from(result.remainingItems, x => x.id), ['b']);
  assert.equal(h.docs.has('a'), false); assert.equal(h.docs.has('b'), true); assert.deepEqual(Array.from(h.cache(), x => x.id), ['b', 'active']);
});
test('first-item failure is not partial deletion', async () => {
  const h = setup({ failAt: 1 }); const result = await h.service.emptyDeletedItems(); assert.equal(result.deletedCount, 0); assert.equal(result.remainingItems.length, 2);
});
test('concurrently restored target is rechecked and never deleted', async () => {
  const h = setup({ restoreSecond: true }); const result = await h.service.emptyDeletedItems();
  assert.equal(result.deletedCount, 1); assert.equal(result.failureCode, 'NOT_DELETED'); assert.equal(h.docs.get('b').isDeleted, false); assert.equal(result.remainingItems.length, 0);
});
test('final server-read failure does not claim verified empty Trash', async () => {
  const h = setup({ verifyFails: true }); const result = await h.service.emptyDeletedItems(); assert.equal(result.deletedCount, 2); assert.equal(result.remainingItems, null); assert.equal(result.failureCode, 'VERIFY_FAILED');
});
test('newly deleted item appears in final state instead of assuming all Trash is gone', async () => {
  const h = setup({ newTrash: true }); const result = await h.service.emptyDeletedItems(); assert.equal(result.deletedCount, 2); assert.deepEqual(Array.from(result.remainingItems, x => x.id), ['new']);
});
test('cache failure does not misclassify confirmed deletion', async () => {
  const h = setup({ cacheFails: true }); const result = await h.service.emptyDeletedItems(); assert.equal(result.deletedCount, 2); assert.equal(result.cacheUpdated, false); assert.equal(result.failureCode, null); assert.equal(result.remainingItems.length, 0);
});
test('already empty Trash makes no mutations', async () => { const h = setup(); h.docs.delete('a'); h.docs.delete('b'); const result = await h.service.emptyDeletedItems(); assert.equal(result.deletedCount, 0); assert.equal(result.remainingItems.length, 0); assert.equal(h.writes.length, 0); });
