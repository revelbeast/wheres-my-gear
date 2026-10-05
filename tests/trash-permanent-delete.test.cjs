const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: id => { assert.ok(id in mocks, id); return mocks[id]; }, URL, console: { warn() {}, log() {} }, setTimeout, clearTimeout });
  return exports;
}
function setup(options = {}) {
  const docs = new Map([['i', { isDeleted: true, name: 'Gear' }], ['active', { name: 'Other' }], ['trash', { isDeleted: true, name: 'Other' }]]);
  const writes = [], storage = new Map();
  let failCache = false;
  const auth = { currentUser: options.unauthenticated ? null : { uid: 'u' } };
  const snapshot = (id, value) => ({ id, exists: () => !!value, data: () => structuredClone(value) });
  const firestore = {
    doc: (...parts) => parts.slice(1).join('/'), collection: (...parts) => parts.slice(1).join('/'),
    getDocsFromServer: async path => { assert.equal(path, 'users/u/inventoryItems'); if (options.serverFails) throw Error('server'); return { docs: [...docs].map(([id, data]) => snapshot(id, data)) }; },
    runTransaction: async (_db, fn) => {
      if (options.beforeTransaction) options.beforeTransaction(docs, auth);
      const pending = [];
      const result = await fn({ get: async path => { assert.equal(path, 'users/u/inventoryItems/i'); return snapshot('i', docs.get('i')); }, delete: path => pending.push(path) });
      if (options.commitFails) throw Error('commit');
      for (const path of pending) { writes.push(path); docs.delete(path.split('/').pop()); }
      return result;
    },
  };
  const queue = load('lib/offlineQueue.ts', { '@react-native-async-storage/async-storage': { default: {
    getItem: async key => storage.get(key) ?? null,
    setItem: async (key, value) => { if (failCache) throw Error('cache'); storage.set(key, value); },
  } }, 'firebase/firestore': firestore, '../firebaseConfig': { db: {} } });
  const photos = new Proxy({}, { get: () => () => assert.fail('No photo or folder mutation/recovery allowed') });
  const gear = load('lib/gearService.ts', {
    '@react-native-community/netinfo': { default: { fetch: async () => options.network ?? { isConnected: true, isInternetReachable: true } } },
    'firebase/firestore': firestore, '../firebaseConfig': { db: {}, auth, storage: { app: { options: { storageBucket: 'bucket' } } } },
    './offlineQueue': queue, './cloudPhotoStorage': photos, './localPhotoStorage': photos, './siriGearCache': photos,
  });
  return { gear, queue, docs, writes, failCache: () => { failCache = true; } };
}
async function rejects(h, code, id = 'i') {
  await assert.rejects(h.gear.permanentlyDeleteDeletedItem(id), e => e.code === code);
  assert.equal(h.writes.length, 0);
}
test('deletes exact Trash ID, reconciles raw cache, preserves unrelated active/Trash and never queues', async () => {
  const h = setup();
  await h.queue.cacheInventoryItems('u', [...h.docs].map(([id, item]) => ({ id, ...item })));
  const result = await h.gear.permanentlyDeleteDeletedItem('i');
  assert.equal(result.itemDeleted, true); assert.equal(result.cacheUpdated, true); assert.equal(result.photoCleanup, 'complete');
  assert.deepEqual(h.writes, ['users/u/inventoryItems/i']);
  assert.deepEqual(Array.from(await h.queue.getCachedInventoryItems('u'), i => i.id), ['active', 'trash']);
  assert.equal((await h.queue.getOfflineQueue()).length, 0);
});
for (const [label, mutate, code] of [
  ['active', h => h.docs.set('i', { isDeleted: false }), 'NOT_DELETED'],
  ['missing', h => h.docs.delete('i'), 'ITEM_NOT_FOUND'],
]) test(`refuses ${label}`, async () => { const h = setup(); mutate(h); await rejects(h, code); });
for (const id of ['', ' ', 'offline-item-1', 'offline-other', 'a/b', '.', '..', ' i ']) test(`invalid ID ${JSON.stringify(id)}`, async () => { await rejects(setup(), 'INVALID_ITEM_ID', id); });
test('unauthenticated', async () => { await rejects(setup({ unauthenticated: true }), 'UNAUTHENTICATED'); });
for (const network of [{ isConnected: false }, { isConnected: true, isInternetReachable: null }, { isConnected: null, isInternetReachable: true }]) test(`connectivity ${JSON.stringify(network)}`, async () => { const h = setup({ network }); await rejects(h, 'CONNECT_REQUIRED'); assert.equal((await h.queue.getOfflineQueue()).length, 0); });
for (const type of ['createItem', 'updateInventoryItem', 'deleteInventoryItem']) test(`pending ${type} blocks even for another item`, async () => {
  const h = setup(); await h.queue.enqueueOfflineOperation({ id: 'op', userId: 'u', type, payload: { itemId: 'other' }, createdAt: 'now' });
  await rejects(h, 'SYNC_REQUIRED'); assert.equal((await h.queue.getOfflineQueue()).length, 1);
});
test('other-user pending operation does not block authenticated deletion', async () => {
  const h = setup(); await h.queue.enqueueOfflineOperation({ id: 'op', userId: 'other-user', type: 'createItem', payload: {}, createdAt: 'now' });
  await h.gear.permanentlyDeleteDeletedItem('i'); assert.equal(h.writes.length, 1);
});
test('authoritative transaction sees concurrent restore and refuses deletion', async () => {
  const h = setup({ beforeTransaction: docs => docs.get('i').isDeleted = false }); await rejects(h, 'NOT_DELETED');
});
test('account change before transaction blocks deletion', async () => {
  const h = setup({ beforeTransaction: (_docs, auth) => auth.currentUser = { uid: 'other' } }); await rejects(h, 'UNAUTHENTICATED');
});
for (const option of ['serverFails', 'commitFails']) test(`${option} leaves document/cache and creates no queue`, async () => {
  const h = setup({ [option]: true }); await h.queue.cacheInventoryItems('u', [{ id: 'i', isDeleted: true }]);
  await assert.rejects(h.gear.permanentlyDeleteDeletedItem('i'));
  assert.ok(h.docs.has('i')); assert.equal((await h.queue.getCachedInventoryItems('u')).length, 1); assert.equal((await h.queue.getOfflineQueue()).length, 0);
});
test('cache failure reports confirmed document deletion accurately', async () => { const h = setup(); h.failCache(); const result = await h.gear.permanentlyDeleteDeletedItem('i'); assert.equal(result.itemDeleted, true); assert.equal(result.cacheUpdated, false); assert.equal(h.docs.has('i'), false); });
for (const id of ['active', 'trash']) test(`shared cloud path with ${id} is retained`, async () => {
  const h = setup(); for (const key of ['i', id]) h.docs.get(key).itemPhotoStoragePath = 'users/u/inventoryItems/i/photo.jpg';
  assert.equal((await h.gear.permanentlyDeleteDeletedItem('i')).photoCleanup, 'retained_shared'); assert.ok(h.docs.has(id));
});
test('canonical download URL with differing tokens matches the same object', async () => {
  const h = setup(); h.docs.get('i').itemPhotoDownloadUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/users%2Fu%2Fphoto.jpg?token=one';
  h.docs.get('active').itemPhotoUri = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/users%2Fu%2Fphoto.jpg?token=two';
  assert.equal((await h.gear.permanentlyDeleteDeletedItem('i')).photoCleanup, 'retained_shared');
});
test('configured bucket path matches canonical URL-only reference', async () => {
  const h = setup(); h.docs.get('i').itemPhotoStoragePath = 'users/u/photo.jpg';
  h.docs.get('trash').itemPhotoDownloadUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/users%2Fu%2Fphoto.jpg';
  assert.equal((await h.gear.permanentlyDeleteDeletedItem('i')).photoCleanup, 'retained_shared');
});
for (const photo of [
  { itemPhotoUri: 'file://documents/wmg-local-photos/shared.jpg' },
  { itemPhotoUri: 'https://external/photo' }, { itemPhotoDownloadUrl: 'malformed' },
  { itemPhotoStoragePath: 'users/u/inventoryItems/i/photo.jpg' },
  { itemPhotoStoragePath: 'one', itemPhotoDownloadUrl: 'https://other/two' },
]) test(`uncertain photo retained without any filesystem/Storage call: ${JSON.stringify(photo)}`, async () => {
  const h = setup(); Object.assign(h.docs.get('i'), photo); Object.assign(h.docs.get('active'), { itemPhotoUri: photo.itemPhotoUri });
  assert.equal((await h.gear.permanentlyDeleteDeletedItem('i')).photoCleanup, 'retained_unverified');
});
test('conflicting references remain unverified even if one field matches another record', async () => {
  const h = setup(); h.docs.get('i').itemPhotoStoragePath = 'one'; h.docs.get('active').itemPhotoStoragePath = 'one';
  h.docs.get('i').itemPhotoDownloadUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/two';
  assert.equal((await h.gear.permanentlyDeleteDeletedItem('i')).photoCleanup, 'retained_unverified');
});
test('same object path in different buckets is not a canonical match', async () => {
  const h = setup(); h.docs.get('i').itemPhotoDownloadUrl = 'https://firebasestorage.googleapis.com/v0/b/one/o/photo';
  h.docs.get('active').itemPhotoDownloadUrl = 'https://firebasestorage.googleapis.com/v0/b/two/o/photo';
  assert.equal((await h.gear.permanentlyDeleteDeletedItem('i')).photoCleanup, 'retained_unverified');
});
