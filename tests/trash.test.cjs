const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, module: { exports }, require: id => mocks[id] ?? require(id), console: { ...console, warn() {} }, setTimeout, clearTimeout }, { filename: file });
  return exports;
}
const item = { id: 'permanent', name: 'Same', quantity: 3, status: 'packed', compartmentId: 'c', compartmentName: 'Box', vehicleId: 'v', vehicleName: 'Truck', roomName: 'Room without ID', barcode: '001', barcodeType: 'code128', notes: 'Keep', source: 'scan', itemPhotoUri: 'local', itemPhotoStoragePath: 'owned/photo', itemPhotoDownloadUrl: 'remote', photoBackedUp: true };
function setup({ online = true, storage = new Map(), records = [item, { ...item, id: 'other' }], siriFails = false } = {}) {
  const docs = new Map(records.map(x => [x.id, { ...x }]));
  const writes = [];
  const suppressed = [];
  const firestore = {
    collection: (...parts) => parts.flat(), doc: (...parts) => parts.flat(),
    query: ref => ref, where: () => null,
    getDocs: async () => { if (!online) throw Error('offline'); return { docs: [...docs].map(([id, data]) => ({ id, data: () => data })) }; },
    serverTimestamp: () => 'server-time',
    updateDoc: async (ref, data) => { const id = ref.at(-1); writes.push({ type: 'update', id, data, ref }); docs.set(id, { ...docs.get(id), ...data }); },
    deleteDoc: async ref => { writes.push({ type: 'delete', id: ref.at(-1) }); docs.delete(ref.at(-1)); },
  };
  const asyncStorage = { getItem: async k => storage.get(k) ?? null, setItem: async (k, v) => storage.set(k, v) };
  const queue = load('lib/offlineQueue.ts', { '@react-native-async-storage/async-storage': { default: asyncStorage }, 'firebase/firestore': firestore, '../firebaseConfig': { db: 'db' } });
  const forbiddenPhoto = () => { throw Error('Photo mutation forbidden'); };
  const gear = load('lib/gearService.ts', {
    '@react-native-community/netinfo': { default: { fetch: async () => ({ isConnected: online, isInternetReachable: online }) } },
    'firebase/firestore': firestore, '../firebaseConfig': { db: 'db', auth: { currentUser: { uid: 'u' } } }, './offlineQueue': queue,
    './siriGearCache': { suppressSiriGearItem: async (uid, id) => { suppressed.push([uid, id]); if (siriFails) throw Error("Siri cache failed"); }, releaseSiriGearItem: async () => {} }, './cloudPhotoStorage': { deleteCloudPhotoByStoragePath: forbiddenPhoto, cleanupOldCloudPhotosInFolder: forbiddenPhoto },
    './localPhotoStorage': { localPhotoExists: async () => true, downloadPhotoToLocalDocumentStorage: forbiddenPhoto },
  });
  return { gear, queue, storage, docs, writes, suppressed };
}
test('online user removal preserves exact record, fields, photos and location; all active readers exclude it', async () => {
  const { gear, queue, docs, writes } = setup();
  await gear.softDeleteItem('permanent');
  const deleted = docs.get('permanent');
  for (const [key, value] of Object.entries(item)) assert.equal(deleted[key], value);
  assert.equal(deleted.isDeleted, true);
  assert.ok(deleted.deletedAt);
  assert.equal(deleted.deletedLocation.compartmentId, 'c');
  assert.equal(deleted.deletedLocation.roomName, item.roomName);
  assert.equal(deleted.deletedLocation.roomId, undefined);
  assert.equal(docs.get('other').isDeleted, undefined);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].ref.join('/'), 'db/users/u/inventoryItems/permanent');
  for (const active of [await gear.getAllItems(), await gear.getItemsByCompartment('c'), await gear.getItemsByStatus('packed'), await gear.searchItemsForUser('u', 'Same')]) {
    assert.deepEqual(Array.from(active, x => x.id), ['other']);
  }
  assert.deepEqual(Array.from(await gear.getDeletedItems(), x => x.id), ['permanent']);
  assert.equal((await queue.getCachedInventoryItems('u')).length, 2);
});
test('offline soft deletion survives restart and replay as metadata update, with moved location and photos intact', async () => {
  const h = setup({ online: false });
  await h.queue.cacheInventoryItems('u', [item, { ...item, id: 'other' }]);
  await h.gear.updateItem('permanent', { compartmentId: 'new' });
  await h.gear.softDeleteItem('permanent');
  const ops = await h.queue.getOfflineQueue();
  assert.equal(ops.length, 2);
  assert.ok(ops.every(op => op.type === 'updateInventoryItem' && op.payload.itemId === 'permanent'));
  assert.equal(ops[1].payload.updates.deletedLocation.compartmentId, 'new');
  const fresh = setup({ online: false, storage: h.storage });
  for (const active of [await fresh.queue.getOfflineItems('u'), await fresh.queue.getOfflineItemsByCompartment('u', 'c'), await fresh.queue.getOfflineItemsByStatus('u', 'packed'), await fresh.gear.getAllItems(), await fresh.gear.getItemsByStatus('packed'), await fresh.gear.getItemsByCompartment('c')]) {
    assert.deepEqual(Array.from(active, x => x.id), ['other']);
  }
  for (const deleted of [await fresh.queue.getOfflineDeletedItems('u'), await fresh.gear.getDeletedItems()]) {
    assert.equal(deleted.length, 1); assert.equal(deleted[0].id, 'permanent');
    assert.equal(deleted[0].barcode, item.barcode); assert.equal(deleted[0].itemPhotoUri, item.itemPhotoUri);
  }
  await fresh.queue.flushOfflineQueue();
  assert.equal((await fresh.queue.getOfflineQueue()).length, 0);
  assert.ok(fresh.writes.every(w => w.type === 'update' && w.id === 'permanent'));
});
test('projection precedes filtering, including ordered metadata reversal without removing raw records', async () => {
  const h = setup({ online: false });
  await h.queue.cacheInventoryItems('u', [{ ...item, isDeleted: true }]);
  await h.queue.enqueueOfflineOperation({ id: 'a', type: 'updateInventoryItem', userId: 'u', payload: { itemId: item.id, updates: { isDeleted: false } }, createdAt: '1' });
  assert.equal((await h.queue.getOfflineItems('u'))[0].id, item.id);
  assert.equal((await h.gear.getAllItems())[0].id, item.id);
  assert.equal((await h.gear.getDeletedItems()).length, 0);
  assert.equal((await h.queue.getCachedInventoryItems('u'))[0].isDeleted, true);
});
test('temporary user removal cancels creation and creates no Trash', async () => {
  const h = setup({ online: false });
  const id = await h.gear.createItem({ name: 'New' });
  await h.gear.updateItem(id, { quantity: 2 });
  await h.gear.softDeleteItem(id);
  assert.equal((await h.queue.getOfflineQueue()).length, 0);
  assert.equal((await h.queue.getOfflineDeletedItems('u')).length, 0);
  assert.equal(h.writes.length, 0);
});
test('legacy queued deletion still hard deletes on replay', async () => {
  const h = setup();
  await h.queue.enqueueOfflineOperation({ id: 'old', type: 'deleteInventoryItem', userId: 'u', payload: { itemId: item.id }, createdAt: '1' });
  await h.queue.flushOfflineQueue();
  assert.equal(h.docs.has(item.id), false);
  assert.equal(h.writes[0].type, 'delete');
});
test('checklist zero quantity hard deletes exact stable target, without Trash or same-name effects', async () => {
  const h = setup();
  await h.gear.removeOrDecrementInventoryItemFromChecklist({ name: 'Same', quantity: 3, inventoryItemId: item.id }, { id: 'c', name: 'Box', vehicleId: 'v' });
  assert.equal(h.docs.has(item.id), false);
  assert.equal(h.docs.get('other').quantity, 3);
  assert.equal(h.writes[0].type, 'delete');
  assert.equal((await h.gear.getDeletedItems()).length, 0);
});
test('both user quantity-to-zero handlers invoke soft deletion', async () => {
  for (const file of ['app/(tabs)/storage/index.tsx', 'app/(tabs)/vehicles/[vehicleId]/compartments/[compartmentId].tsx']) {
    const text = fs.readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let handler;
    function visit(node) {
      if (ts.isFunctionDeclaration(node) && node.name?.text === 'handleChangeQuantity') handler = node.getText(source);
      ts.forEachChild(node, visit);
    }
    visit(source);
    const calls = [];
    const context = { updatingQuantityId: null, selectedItemId: null, items: [item], isMountedRef: { current: true }, isBusy: () => false,
      getSafeQuantity: Number, runWithLock: fn => fn(), setUpdatingQuantityId() {}, setItems() {}, setCompartmentItems() {}, setSelectedItemId() {},
      softDeleteItem: async id => calls.push(id), updateItem: async () => assert.fail('must not update quantity at zero'),
      refreshItems: async () => {}, console, Alert: { alert: () => assert.fail('unexpected error') } };
    vm.createContext(context);
    vm.runInContext(ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    await context.handleChangeQuantity({ ...item, quantity: 1 }, -1);
    assert.deepEqual(calls, [item.id]);
    assert.equal((text.match(/await softDeleteItem\(item.id\)/g) ?? []).length, 2);
    assert.doesNotMatch(text, /await deleteItem\(/);
  }
});

for (const online of [true, false]) test(`soft delete suppresses exact Siri ID after accepted inventory mutation (online=${online})`, async () => {
  const h = setup({ online }); await h.queue.cacheInventoryItems('u', [item]);
  await h.gear.softDeleteItem('permanent');
  assert.deepEqual(h.suppressed, [['u', 'permanent']]);
  if (online) assert.equal(h.docs.get('permanent').isDeleted, true);
  else assert.equal((await h.queue.getOfflineQueue())[0].payload.updates.isDeleted, true);
});
test('Siri failure rejects soft delete without rolling back persisted inventory; retry reattempts suppression', async () => {
  const h = setup({ siriFails: true });
  await assert.rejects(h.gear.softDeleteItem('permanent'), /Siri cache failed/);
  assert.equal(h.docs.get('permanent').isDeleted, true);
  await assert.rejects(h.gear.softDeleteItem('permanent'), /Siri cache failed/);
  assert.equal(h.writes.length, 1); assert.equal(h.suppressed.length, 2);
});
