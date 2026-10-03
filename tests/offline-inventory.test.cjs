const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const context = { exports, module: { exports }, require: (id) => mocks[id] ?? require(id), console, setTimeout, clearTimeout };
  vm.runInNewContext(source, context, { filename: file });
  return context.module.exports;
}

function setup() {
  const storage = new Map();
  const writes = [];
  const firestore = {
    addDoc: async (ref, data) => { writes.push({ type: 'create', ref, data }); return { id: 'created' }; },
    collection: (...parts) => parts,
    doc: (...parts) => parts,
    updateDoc: async (ref, data) => writes.push({ type: 'update', ref, data }),
    deleteDoc: async (ref) => writes.push({ type: 'delete', ref }),
    getDocs: async () => ({ docs: [] }),
    setDoc: async () => {},
    serverTimestamp: () => 'server-time',
  };
  const asyncStorage = {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => storage.set(key, value),
  };
  const queue = load('lib/offlineQueue.ts', {
    '@react-native-async-storage/async-storage': { default: asyncStorage, ...asyncStorage },
    'firebase/firestore': firestore,
    '../firebaseConfig': { db: {} },
  });
  return { queue, storage, writes, firestore };
}

test('offline gearService update and delete enqueue permanent IDs', async () => {
  const base = setup();
  const gear = load('lib/gearService.ts', {
    '@react-native-community/netinfo': { default: { fetch: async () => ({ isConnected: false, isInternetReachable: false }) }, fetch: async () => ({ isConnected: false, isInternetReachable: false }) },
    'firebase/firestore': base.firestore,
    '../firebaseConfig': { db: {}, auth: { currentUser: { uid: 'u1' } } },
    './cloudPhotoStorage': {},
    './localPhotoStorage': {},
    './offlineQueue': base.queue,
  });
  await base.queue.cacheInventoryItems('u1', [{ id: 'item-1', name: 'Move me', compartmentId: 'old', vehicleId: 'v', barcode: '0001', barcodeType: 'ean13' }]);
  await gear.updateItem('item-1', { quantity: 2 });
  await gear.deleteItem('item-1');
  const queue = await base.queue.getOfflineQueue();
  assert.equal(queue.length, 2);
  assert.equal(queue[0].type, 'updateInventoryItem');
  assert.equal(queue[0].payload.itemId, 'item-1');
  assert.equal(queue[1].type, 'deleteInventoryItem');
  assert.equal(queue[1].payload.itemId, 'item-1');
  assert.equal(base.writes.length, 0);
});

test('offline gearService move updates the persisted projection for both compartments', async () => {
  const base = setup();
  const gear = load('lib/gearService.ts', {
    '@react-native-community/netinfo': { default: { fetch: async () => ({ isConnected: false, isInternetReachable: false }) } },
    'firebase/firestore': base.firestore,
    '../firebaseConfig': { db: {}, auth: { currentUser: { uid: 'u1' } } },
    './cloudPhotoStorage': {}, './localPhotoStorage': {}, './offlineQueue': base.queue,
  });
  await base.queue.cacheInventoryItems('u1', [{ id: 'item-1', name: 'Move me', compartmentId: 'old', vehicleId: 'v', barcode: '0001', barcodeType: 'ean13' }]);
  await gear.updateItem('item-1', { compartmentId: 'new', compartmentName: 'New', vehicleId: 'v2', vehicleName: 'Vehicle 2' });
  assert.equal((await base.queue.getOfflineItemsByCompartment('u1', 'old')).length, 0);
  const destination = await base.queue.getOfflineItemsByCompartment('u1', 'new');
  assert.equal(destination.length, 1);
  assert.equal(destination[0].id, 'item-1');
  assert.equal(destination[0].barcode, '0001');
  assert.equal(destination[0].barcodeType, 'ean13');
  assert.equal((await base.queue.getOfflineItemsByCompartment('u1', 'new')).length, 1);
  await base.queue.flushOfflineQueue();
  assert.equal(base.writes[0].type, 'update');
  assert.equal(base.writes[0].ref.at(-1), 'item-1');
  assert.equal((await base.queue.getOfflineQueue()).length, 0);
});

test('deleting an unsynchronized offline item cancels only its exact create operation', async () => {
  const base = setup();
  const gear = load('lib/gearService.ts', {
    '@react-native-community/netinfo': { default: { fetch: async () => ({ isConnected: false, isInternetReachable: false }) } },
    'firebase/firestore': base.firestore,
    '../firebaseConfig': { db: {}, auth: { currentUser: { uid: 'u1' } } },
    './cloudPhotoStorage': {}, './localPhotoStorage': {}, './offlineQueue': base.queue,
  });
  const first = await gear.createItem({ name: 'Same', vehicleId: 'v', compartmentId: 'c', barcode: 'same', barcodeType: 'code128' });
  const second = await gear.createItem({ name: 'Same', vehicleId: 'v', compartmentId: 'c', barcode: 'same', barcodeType: 'code128' });
  assert.notEqual(first, second);
  assert.equal((await base.queue.getOfflineItems('u1')).length, 2);
  await gear.deleteItem(first);
  const queued = await base.queue.getOfflineQueue();
  assert.equal(queued.length, 1);
  assert.equal(queued[0].type, 'createItem');
  assert.equal(queued[0].id, second);
  assert.equal((await base.queue.getOfflineItems('u1')).length, 1);
  await base.queue.flushOfflineQueue();
  assert.equal(base.writes.length, 1);
  assert.equal((await base.queue.getOfflineQueue()).length, 0);
});

test('pending update projects across all readers and preserves barcode fields', async () => {
  const { queue } = setup();
  await queue.cacheInventoryItems('u1', [{ id: 'item-1', name: 'Old', quantity: 1, status: 'packed', compartmentId: 'a', barcode: '0001', barcodeType: 'ean13' }]);
  await queue.enqueueOfflineOperation({ id: 'u1-update', type: 'updateInventoryItem', userId: 'u1', payload: { itemId: 'item-1', updates: { name: 'New', quantity: 2, compartmentId: 'b', status: 'missing' } }, createdAt: 't1' });
  const all = await queue.getOfflineItems('u1');
  assert.equal(all[0].name, 'New');
  assert.equal(all[0].quantity, 2);
  assert.equal(all[0].status, 'missing');
  assert.equal(all[0].compartmentId, 'b');
  assert.equal(all[0].barcode, '0001');
  assert.equal(all[0].barcodeType, 'ean13');
  assert.equal((await queue.getOfflineItemsByCompartment('u1', 'a')).length, 0);
  assert.equal((await queue.getOfflineItemsByCompartment('u1', 'b')).length, 1);
  assert.equal((await queue.getOfflineItemsByStatus('u1', 'packed')).length, 0);
  assert.equal((await queue.getOfflineItemsByStatus('u1', 'missing')).length, 1);
});

test('sequential update then delete suppresses the item and replays the same ID', async () => {
  const { queue, writes } = setup();
  await queue.cacheInventoryItems('u1', [{ id: 'item-1', name: 'Old', quantity: 1 }]);
  await queue.enqueueOfflineOperation({ id: 'update-1', type: 'updateInventoryItem', userId: 'u1', payload: { itemId: 'item-1', updates: { quantity: 3 } }, createdAt: 't1' });
  await queue.enqueueOfflineOperation({ id: 'delete-1', type: 'deleteInventoryItem', userId: 'u1', payload: { itemId: 'item-1' }, createdAt: 't2' });
  assert.equal((await queue.getOfflineItems('u1')).length, 0);
  await queue.flushOfflineQueue();
  assert.deepEqual(writes.map((w) => [w.type, w.ref.slice(-1)[0]]), [['update', 'item-1'], ['delete', 'item-1']]);
  assert.equal((await queue.getOfflineQueue()).length, 0);
});

test('legacy records without barcode fields remain compatible', async () => {
  const { queue } = setup();
  await queue.cacheInventoryItems('u1', [{ id: 'legacy', name: 'Old', quantity: 1 }]);
  await queue.enqueueOfflineOperation({ id: 'legacy-update', type: 'updateInventoryItem', userId: 'u1', payload: { itemId: 'legacy', updates: { quantity: 2 } }, createdAt: 't1' });
  const item = (await queue.getOfflineItems('u1'))[0];
  assert.equal(item.quantity, 2);
  assert.equal('barcode' in item, false);
  assert.equal('barcodeType' in item, false);
});

test('offline linked checklist deletion queues an absolute quantity update by stable ID', async () => {
  const base = setup();
  const gear = load('lib/gearService.ts', {
    '@react-native-community/netinfo': { default: { fetch: async () => ({ isConnected: false, isInternetReachable: false }) } },
    'firebase/firestore': base.firestore,
    '../firebaseConfig': { db: {}, auth: { currentUser: { uid: 'u1' } } },
    './cloudPhotoStorage': {}, './localPhotoStorage': {}, './offlineQueue': base.queue,
  });
  base.firestore.getDocs = async () => { throw new Error('offline'); };
  await base.queue.cacheInventoryItems('u1', [{ id: 'ABC123', name: 'Tent', quantity: 5, compartmentId: 'c', barcode: '0001', barcodeType: 'ean13' }, { id: 'same-name', name: 'Tent', quantity: 9, compartmentId: 'c' }]);
  await gear.removeOrDecrementInventoryItemFromChecklist({ name: 'Tent', quantity: 2, inventoryItemId: 'ABC123' }, 'c');
  const queue = await base.queue.getOfflineQueue();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].type, 'updateInventoryItem');
  assert.equal(queue[0].payload.itemId, 'ABC123');
  assert.equal(queue[0].payload.updates.quantity, 3);
  assert.equal(queue[0].payload.updates.name, undefined);
  const projected = await base.queue.getOfflineItems('u1');
  assert.equal(projected.find((item) => item.id === 'ABC123').quantity, 3);
  assert.equal(projected.find((item) => item.id === 'ABC123').barcode, '0001');
  assert.equal(projected.find((item) => item.id === 'ABC123').barcodeType, 'ean13');
  assert.equal(projected.find((item) => item.id === 'same-name').quantity, 9);
});

test('offline linked checklist deletion queues exact inventory deletion at or below zero', async () => {
  const base = setup();
  const gear = load('lib/gearService.ts', {
    '@react-native-community/netinfo': { default: { fetch: async () => ({ isConnected: false, isInternetReachable: false }) } },
    'firebase/firestore': base.firestore,
    '../firebaseConfig': { db: {}, auth: { currentUser: { uid: 'u1' } } },
    './cloudPhotoStorage': {}, './localPhotoStorage': {}, './offlineQueue': base.queue,
  });
  base.firestore.getDocs = async () => { throw new Error('offline'); };
  await base.queue.cacheInventoryItems('u1', [{ id: 'ABC123', name: 'Tent', quantity: 2, compartmentId: 'c' }, { id: 'same-name', name: 'Tent', quantity: 8, compartmentId: 'c' }]);
  await gear.removeOrDecrementInventoryItemFromChecklist({ name: 'Tent', quantity: 2, inventoryItemId: 'ABC123' }, 'c');
  const queue = await base.queue.getOfflineQueue();
  assert.equal(queue[0].type, 'deleteInventoryItem');
  assert.equal(queue[0].payload.itemId, 'ABC123');
  assert.equal((await base.queue.getOfflineItems('u1')).some((item) => item.id === 'ABC123'), false);
  assert.equal((await base.queue.getOfflineItems('u1')).find((item) => item.id === 'same-name').quantity, 8);
});

test('offline linked checklist deletion is a no-op for a missing stable target', async () => {
  const base = setup();
  const gear = load('lib/gearService.ts', {
    '@react-native-community/netinfo': { default: { fetch: async () => ({ isConnected: false, isInternetReachable: false }) } },
    'firebase/firestore': base.firestore,
    '../firebaseConfig': { db: {}, auth: { currentUser: { uid: 'u1' } } },
    './cloudPhotoStorage': {}, './localPhotoStorage': {}, './offlineQueue': base.queue,
  });
  base.firestore.getDocs = async () => { throw new Error('offline'); };
  await base.queue.cacheInventoryItems('u1', [{ id: 'same-name', name: 'Tent', quantity: 8, compartmentId: 'c' }]);
  await gear.removeOrDecrementInventoryItemFromChecklist({ name: 'Tent', quantity: 2, inventoryItemId: 'missing' }, 'c');
  assert.equal((await base.queue.getOfflineQueue()).length, 0);
  assert.equal((await base.queue.getOfflineItems('u1'))[0].quantity, 8);
});
