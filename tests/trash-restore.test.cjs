const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: id => { assert.ok(id in mocks, id); return mocks[id]; }, console: { warn() {}, log() {} }, setTimeout, clearTimeout });
  return exports;
}
const original = { name: 'Same', quantity: 7, status: 'packed', notes: 'notes', source: 'scan', barcode: '001', barcodeType: 'ean13', itemPhotoUri: 'file://photo', itemPhotoStoragePath: 'photo/path', itemPhotoDownloadUrl: 'https://photo', photoBackedUp: true, extraField: 'retain', vehicleId: 'v', compartmentId: 'c', isDeleted: true, deletedAt: '2026-10-04', deletedLocation: { vehicleId: 'v', compartmentId: 'c', roomId: 'r' } };
function setup(options = {}) {
  const docs = new Map([['inventoryItems/i', structuredClone(original)], ['inventoryItems/other', { name: 'Same', quantity: 9 }], ['storageSpaces/v', { name: 'Truck' }], ['compartments/c', { vehicleId: 'v', roomId: 'r' }], ['rooms/r', { storageSpaceId: 'v' }]]);
  const writes = [], reads = [], storage = new Map();
  let cacheFails = false;
  const auth = { currentUser: options.unauthenticated ? null : { uid: 'u' } };
  const firestore = {
    doc: (...parts) => parts.slice(1).join('/'),
    serverTimestamp: () => 'server-time',
    runTransaction: async (_db, fn) => {
      const pending = [];
      const result = await fn({
        get: async ref => { reads.push(ref); if (options.readFails) throw { code: 'unavailable' }; const value = docs.get(ref.replace('users/u/', '')); return { exists: () => !!value, data: () => structuredClone(value) }; },
        update: (ref, data) => pending.push({ ref, data }),
      });
      if (options.writeFails) throw { code: 'unavailable' };
      for (const entry of pending) { writes.push(entry); const key = entry.ref.replace('users/u/', ''); docs.set(key, { ...docs.get(key), ...entry.data }); }
      return result;
    },
  };
  const asyncStorage = { getItem: async key => storage.get(key) ?? null, setItem: async (key, value) => { if (cacheFails) throw Error('cache'); storage.set(key, value); } };
  const queue = load('lib/offlineQueue.ts', { '@react-native-async-storage/async-storage': { default: asyncStorage }, 'firebase/firestore': firestore, '../firebaseConfig': { db: {} } });
  const photos = new Proxy({}, { get() { return () => assert.fail('No photo operations allowed'); } });
  const gear = load('lib/gearService.ts', {
    '@react-native-community/netinfo': { default: { fetch: async () => options.network ?? ({ isConnected: true, isInternetReachable: true }) } },
    'firebase/firestore': firestore, '../firebaseConfig': { db: {}, auth }, './offlineQueue': queue, './cloudPhotoStorage': photos, './localPhotoStorage': photos,
  });
  return { gear, queue, docs, writes, reads, failCache: () => { cacheFails = true; } };
}
async function rejects(h, code) { await assert.rejects(h.gear.restoreDeletedItem('i'), err => err.code === code); assert.equal(h.writes.length, 0); }

test('valid restore preserves exact authenticated ID and all metadata, reconciles raw cache and projections', async () => {
  const h = setup();
  await h.queue.cacheInventoryItems('u', [{ ...original, id: 'i' }, { id: 'other', name: 'Same', quantity: 9 }]);
  const result = await h.gear.restoreDeletedItem('i'); assert.equal(result.cacheUpdated, true);
  assert.equal(h.writes.length, 1); assert.equal(h.writes[0].ref, 'users/u/inventoryItems/i');
  const restored = h.docs.get('inventoryItems/i');
  for (const [key, value] of Object.entries(original)) {
    if (!['isDeleted', 'deletedAt', 'deletedLocation'].includes(key)) assert.deepEqual(restored[key], value);
  }
  assert.equal(restored.isDeleted, false); assert.equal(restored.deletedAt, null); assert.equal(restored.deletedLocation, null);
  assert.equal(h.docs.get('inventoryItems/other').quantity, 9);
  assert.equal((await h.queue.getOfflineDeletedItems('u')).length, 0);
  assert.deepEqual(Array.from(await h.queue.getOfflineItems('u'), item => item.id), ['i', 'other']);
  assert.equal((await h.queue.getOfflineQueue()).length, 0);
  await assert.rejects(h.gear.restoreDeletedItem('i'), e => e.code === 'NOT_DELETED'); assert.equal(h.writes.length, 1);
});

test('unauthenticated restore does not read or mutate', async () => { const h = setup({ unauthenticated: true }); await rejects(h, 'UNAUTHENTICATED'); assert.equal(h.reads.length, 0); });
for (const [name, change, code] of [
  ['missing item', h => h.docs.delete('inventoryItems/i'), 'ITEM_NOT_FOUND'],
  ['active item', h => h.docs.get('inventoryItems/i').isDeleted = false, 'NOT_DELETED'],
  ['missing storage', h => h.docs.delete('storageSpaces/v'), 'NEW_DESTINATION_REQUIRED'],
  ['archived storage', h => h.docs.get('storageSpaces/v').isArchived = true, 'NEW_DESTINATION_REQUIRED'],
  ['missing compartment', h => h.docs.delete('compartments/c'), 'NEW_DESTINATION_REQUIRED'],
  ['moved compartment', h => h.docs.get('compartments/c').vehicleId = 'other', 'NEW_DESTINATION_REQUIRED'],
  ['missing room', h => h.docs.delete('rooms/r'), 'NEW_DESTINATION_REQUIRED'],
  ['archived room', h => h.docs.get('rooms/r').isArchived = true, 'NEW_DESTINATION_REQUIRED'],
  ['room in other storage', h => h.docs.get('rooms/r').storageSpaceId = 'other', 'NEW_DESTINATION_REQUIRED'],
  ['compartment in other room', h => h.docs.get('compartments/c').roomId = 'other', 'NEW_DESTINATION_REQUIRED'],
  ['missing snapshot IDs', h => h.docs.get('inventoryItems/i').deletedLocation = { vehicleName: 'Truck' }, 'NEW_DESTINATION_REQUIRED'],
  ['path in snapshot', h => h.docs.get('inventoryItems/i').deletedLocation.vehicleId = 'users/other', 'NEW_DESTINATION_REQUIRED'],
]) test(name, async () => { const h = setup(); change(h); await rejects(h, code); assert.equal((await h.queue.getOfflineQueue()).length, 0); });
for (const network of [{ isConnected: false }, { isConnected: true, isInternetReachable: null }]) {
  test(`unusable connectivity ${JSON.stringify(network)} never queues or mutates`, async () => { const h = setup({ network }); await rejects(h, 'CONNECT_REQUIRED'); assert.equal(h.reads.length, 0); assert.equal((await h.queue.getOfflineQueue()).length, 0); });
}
for (const option of ['readFails', 'writeFails']) test(`${option} remains a network failure, no queue or cache mutation`, async () => {
  const h = setup({ [option]: true }); await h.queue.cacheInventoryItems('u', [{ ...original, id: 'i' }]);
  await rejects(h, 'unavailable'); assert.equal((await h.queue.getOfflineDeletedItems('u')).length, 1); assert.equal((await h.queue.getOfflineQueue()).length, 0);
});
test('pending inventory operation blocks restore rather than overwriting queued intent', async () => {
  const h = setup(); await h.queue.enqueueOfflineOperation({ id: 'pending', type: 'updateInventoryItem', userId: 'u', payload: { itemId: 'i', updates: { isDeleted: true } }, createdAt: 'now' });
  await rejects(h, 'SYNC_REQUIRED'); assert.equal(h.reads.length, 0);
});
test('cache failure reports server success explicitly and never rolls back server restore', async () => {
  const h = setup(); h.failCache(); const result = await h.gear.restoreDeletedItem('i');
  assert.equal(result.cacheUpdated, false); assert.equal(h.docs.get('inventoryItems/i').isDeleted, false);
});
test('no original room ID is inferred from a name; current room hierarchy is still validated', async () => {
  const h = setup(); h.docs.get('inventoryItems/i').deletedLocation = { vehicleId: 'v', compartmentId: 'c', roomName: 'display only' };
  await h.gear.restoreDeletedItem('i'); assert.ok(h.reads.includes('users/u/rooms/r'));
});
