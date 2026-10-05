const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const context = { exports, module: { exports }, require: (id) => mocks[id] ?? require(id), console, setTimeout, clearTimeout, ...globals };
  vm.runInNewContext(source, context, { filename: file });
  return context.module.exports;
}

function setup(storage = new Map()) {
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
    './siriGearCache': { suppressSiriGearItem: async () => {}, releaseSiriGearItem: async () => {} }, './cloudPhotoStorage': {},
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
    './siriGearCache': { suppressSiriGearItem: async () => {}, releaseSiriGearItem: async () => {} }, './cloudPhotoStorage': {}, './localPhotoStorage': {}, './offlineQueue': base.queue,
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
    './siriGearCache': { suppressSiriGearItem: async () => {}, releaseSiriGearItem: async () => {} }, './cloudPhotoStorage': {}, './localPhotoStorage': {}, './offlineQueue': base.queue,
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
    './siriGearCache': { suppressSiriGearItem: async () => {}, releaseSiriGearItem: async () => {} }, './cloudPhotoStorage': {}, './localPhotoStorage': {}, './offlineQueue': base.queue,
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
    './siriGearCache': { suppressSiriGearItem: async () => {}, releaseSiriGearItem: async () => {} }, './cloudPhotoStorage': {}, './localPhotoStorage': {}, './offlineQueue': base.queue,
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
    './siriGearCache': { suppressSiriGearItem: async () => {}, releaseSiriGearItem: async () => {} }, './cloudPhotoStorage': {}, './localPhotoStorage': {}, './offlineQueue': base.queue,
  });
  base.firestore.getDocs = async () => { throw new Error('offline'); };
  await base.queue.cacheInventoryItems('u1', [{ id: 'same-name', name: 'Tent', quantity: 8, compartmentId: 'c' }]);
  await gear.removeOrDecrementInventoryItemFromChecklist({ name: 'Tent', quantity: 2, inventoryItemId: 'missing' }, 'c');
  assert.equal((await base.queue.getOfflineQueue()).length, 0);
  assert.equal((await base.queue.getOfflineItems('u1'))[0].quantity, 8);
});


// Execute the production screen handlers with real services and persisted queue.
// Checklist base data is supplied explicitly, as it must be available from Firestore cache.
async function checklistQuantitySetup(missing = false) {
  const base = setup();
  base.firestore.getDocs = async () => { throw new Error('offline'); };
  let clock = 100000;
  class TestDate extends Date { static now() { return ++clock; } }
  const mocks = {
    '@react-native-community/netinfo': { default: { fetch: async () => ({ isConnected: false, isInternetReachable: false }) } },
    'firebase/firestore': base.firestore,
    '../firebaseConfig': { db: {}, auth: { currentUser: { uid: 'u1' } } },
    './siriGearCache': { suppressSiriGearItem: async () => {}, releaseSiriGearItem: async () => {} }, './cloudPhotoStorage': {},
    './localPhotoStorage': { localPhotoExists: async () => true },
    './offlineQueue': base.queue,
  };
  const gear = load('lib/gearService.ts', mocks, { Date: TestDate });
  const checklists = load('lib/checklistsService.ts', mocks, { Date: TestDate });
  const inventory = {
    id: 'ABC123', name: 'Tent', quantity: 5, status: 'missing',
    compartmentId: 'actual', compartmentName: 'Actual', vehicleId: 'v',
    roomId: 'r', notes: 'keep', source: 'manual', barcode: '0001', barcodeType: 'ean13',
    itemPhotoUri: 'local', itemPhotoDownloadUrl: 'https://example.com/photo',
    itemPhotoStoragePath: 'photos/keep', photoBackedUp: true, custom: 'keep',
  };
  const alternative = { ...inventory, id: 'XYZ789', quantity: 9, compartmentId: 'old' };
  const inventoryBase = missing ? [alternative] : [inventory, alternative];
  await base.queue.cacheInventoryItems('u1', inventoryBase);
  const checklistBase = [{ id: 'ci', name: 'Tent', quantity: 2, packed: true,
    inventoryItemId: 'ABC123', compartmentId: 'old', compartmentName: 'Old', vehicleId: 'v' }];
  const file = 'app/(tabs)/checklists/[checklistId].tsx';
  const text = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = new Map();
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const source = ['getSafeQuantity', 'handleChangeNeededQuantity', 'confirmDeleteItem', 'handleTogglePacked']
    .map((name) => { assert.ok(functions.has(name)); return functions.get(name); }).join('\n');
  let state = structuredClone(checklistBase);
  let deletion;
  const context = {
    ...gear, ...checklists, getOfflineItems: base.queue.getOfflineItems,
    NetInfo: mocks['@react-native-community/netinfo'].default, setTimeout,
    user: { uid: 'u1' }, checklistId: 'c',
    isBusyWithItemActions: () => false, setUpdatingItemId: () => {},
    runWithLock: async (fn) => fn(), isScreenMountedRef: { current: true },
    setItems: (fn) => { state = fn(state); },
    Alert: { alert: (title, message, buttons) => {
      if (!buttons) throw new Error(`${title}: ${message}`);
      deletion = buttons.find((button) => button.text === 'Delete').onPress;
    } },
    console, Date: TestDate,
  };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { ...base, gear, inventoryBase, checklistBase,
    toggle: async (packed, linked = true) => {
      state[0].packed = packed;
      if (!linked) delete state[0].inventoryItemId;
      await context.handleTogglePacked(state[0]);
      return state[0];
    },
    change: async (delta) => context.handleChangeNeededQuantity(state[0], delta),
    delete: async () => { context.confirmDeleteItem(state[0]); await deletion(); },
  };
}

function queueSummary(queue) {
  return queue.map((op) => {
    if (op.type === 'updateChecklistItemQuantity') return ['C', op.payload.quantity];
    if (op.type === 'deleteChecklistItem') return ['CD'];
    assert.equal(op.type, 'updateInventoryItem');
    assert.equal(op.userId, 'u1');
    assert.equal(op.payload.itemId, 'ABC123');
    const updates = op.payload.updates;
    assert.equal(Object.keys(updates).length, 1);
    return 'quantity' in updates ? ['I', updates.quantity] : ['S', updates.status];
  });
}

for (const [name, deltas, pairs, remove] of [
  ['single +1', [1], [[3, 6]], false],
  ['single -1', [-1], [[1, 4]], false],
  ['A +1 +1', [1, 1], [[3, 6], [4, 7]], false],
  ['B +1 -1', [1, -1], [[3, 6], [2, 5]], false],
  ['C +1 +1 -1', [1, 1, -1], [[3, 6], [4, 7], [3, 6]], false],
  ['D -1 +1', [-1, 1], [[1, 4], [2, 5]], false],
  ['E -1 delete', [-1], [[1, 4]], true],
  ['F +1 delete', [1], [[3, 6]], true],
]) {
  test(`complete offline checklist quantity sequence: ${name}`, async () => {
    const b = await checklistQuantitySetup();
    const expectedOrder = [];
    for (let i = 0; i < deltas.length; i++) {
      await b.change(deltas[i]);
      const [c, q] = pairs[i];
      const checklist = await b.queue.projectChecklistItems('u1', 'c', b.checklistBase);
      assert.equal(checklist[0].quantity, c);
      assert.equal(checklist[0].inventoryItemId, 'ABC123');
      const inventory = await b.queue.getOfflineItems('u1');
      const linked = inventory.find((item) => item.id === 'ABC123');
      const { updatedAt, ...fields } = linked;
      assert.deepEqual(fields, { ...b.inventoryBase[0], quantity: q, status: 'packed' });
      assert.deepEqual({ ...inventory.find((item) => item.id === 'XYZ789') }, b.inventoryBase[1]);
      expectedOrder.push(['C', c], ['I', q], ['S', 'packed']);
    }
    if (remove) {
      await b.delete();
      expectedOrder.push(['I', 3], ['CD']);
      assert.equal((await b.queue.projectChecklistItems('u1', 'c', b.checklistBase)).length, 0);
    }
    const pending = await b.queue.getOfflineQueue();
    assert.deepEqual(JSON.parse(JSON.stringify(queueSummary(pending))), expectedOrder);
    assert.equal(b.writes.length, 0);

    // Reload actual serialized queue/cache using a fresh queue module instance.
    const reloaded = setup(new Map(b.storage));
    assert.equal(JSON.stringify(await reloaded.queue.getOfflineQueue()), JSON.stringify(pending));
    const inventory = await reloaded.queue.getOfflineItems('u1');
    const expectedQuantity = remove ? 3 : pairs.at(-1)[1];
    assert.equal(inventory.find((item) => item.id === 'ABC123').quantity, expectedQuantity);
    const checklist = await reloaded.queue.projectChecklistItems('u1', 'c', b.checklistBase);
    assert.equal(checklist.length, remove ? 0 : 1);
    if (!remove) {
      assert.equal(checklist[0].quantity, pairs.at(-1)[0]);
      assert.equal(checklist[0].inventoryItemId, 'ABC123');
    }
    await reloaded.queue.flushOfflineQueue();
    const inventoryWrites = reloaded.writes.filter((write) => write.ref.includes('inventoryItems'));
    assert.equal(inventoryWrites.length, expectedOrder.filter(([type]) => type === 'I' || type === 'S').length);
    let remoteQuantity = 5;
    for (const write of inventoryWrites) {
      assert.equal(write.ref.at(-1), 'ABC123');
      if ('quantity' in write.data) remoteQuantity = write.data.quantity;
    }
    assert.equal(remoteQuantity, expectedQuantity);
    assert.equal((await reloaded.queue.getOfflineQueue()).length, 0);
  });
}

test('missing stable target preserves checklist changes without any inventory effect', async () => {
  const b = await checklistQuantitySetup(true);
  await b.change(1);
  await b.change(-1);
  const queued = await b.queue.getOfflineQueue();
  assert.deepEqual(Array.from(queued, (op) => op.type), ['updateChecklistItemQuantity', 'updateChecklistItemQuantity']);
  assert.equal((await b.queue.projectChecklistItems('u1', 'c', b.checklistBase))[0].quantity, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(await b.queue.getOfflineItems('u1'))), b.inventoryBase);
  await b.queue.flushOfflineQueue();
  assert.equal(b.writes.some((write) => write.ref.includes('inventoryItems')), false);
});

test('replaying the persisted absolute assignment twice does not increment again', async () => {
  const b = setup();
  await b.queue.enqueueOfflineOperation({ id: 'retry', type: 'updateInventoryItem', userId: 'u1',
    payload: { itemId: 'ABC123', updates: { quantity: 6 } }, createdAt: 't' });
  const beforeCleanup = new Map(b.storage);
  await b.queue.flushOfflineQueue();
  const retried = setup(beforeCleanup);
  await retried.queue.flushOfflineQueue();
  let quantity = 5;
  for (const write of [...b.writes, ...retried.writes]) quantity = write.data.quantity;
  assert.equal(quantity, 6);
  assert.equal(b.writes.length, 1);
  assert.equal(retried.writes.length, 1);
});

for (const packed of [false, true]) {
  for (const scenario of ['existing', 'deleted', 'missing-alternative', 'empty-cache', 'moved', 'legacy']) {
    test(`offline ${packed ? 'unpack' : 'pack'} checks projected stable target: ${scenario}`, async () => {
      const b = await checklistQuantitySetup(scenario === 'missing-alternative');
      if (scenario === 'empty-cache') await b.queue.cacheInventoryItems('u1', []);
      if (scenario === 'deleted') {
        await b.gear.deleteItem('ABC123');
        assert.equal((await b.queue.getOfflineItems('u1')).some((item) => item.id === 'ABC123'), false);
      }
      if (scenario === 'moved') await b.gear.updateItem('ABC123', { compartmentId: 'destination', vehicleId: 'new-vehicle' });
      const before = JSON.parse(JSON.stringify(await b.queue.getOfflineItems('u1')));
      const state = await b.toggle(packed, scenario !== 'legacy');
      assert.equal(state.packed, !packed);
      if (scenario !== 'legacy') assert.equal(state.inventoryItemId, 'ABC123');
      const pending = await b.queue.getOfflineQueue();
      const shouldUpdate = scenario === 'existing' || scenario === 'moved';
      const expectedTypes = [
        ...(scenario === 'deleted' ? ['deleteInventoryItem'] : scenario === 'moved' ? ['updateInventoryItem'] : []),
        'toggleChecklistItemPacked',
        ...(shouldUpdate ? ['updateInventoryItem'] : []),
      ];
      assert.deepEqual(Array.from(pending, (op) => op.type), expectedTypes);
      const statusOps = pending.filter((op) => op.type === 'updateInventoryItem' && 'status' in op.payload.updates);
      assert.equal(statusOps.length, shouldUpdate ? 1 : 0);
      if (shouldUpdate) {
        assert.equal(statusOps[0].payload.itemId, 'ABC123');
        assert.deepEqual({ ...statusOps[0].payload.updates }, { status: packed ? 'missing' : 'packed' });
      }
      const reloaded = setup(new Map(b.storage));
      assert.equal(JSON.stringify(await reloaded.queue.getOfflineQueue()), JSON.stringify(pending));
      const projected = JSON.parse(JSON.stringify(await reloaded.queue.getOfflineItems('u1')));
      assert.deepEqual(projected.find((item) => item.id === 'XYZ789'), before.find((item) => item.id === 'XYZ789'));
      if (!shouldUpdate) assert.deepEqual(projected, before);
      if (scenario === 'moved') {
        assert.equal(projected.find((item) => item.id === 'ABC123').compartmentId, 'destination');
        assert.equal(projected.find((item) => item.id === 'ABC123').vehicleId, 'new-vehicle');
      }
      const checklist = await reloaded.queue.projectChecklistItems('u1', 'c', b.checklistBase);
      assert.equal(checklist[0].packed, !packed);
      // Model Firestore rejecting updates after deletion, rather than silently accepting them.
      let deleted = false;
      const updateDoc = reloaded.firestore.updateDoc;
      const deleteDoc = reloaded.firestore.deleteDoc;
      reloaded.firestore.deleteDoc = async (ref) => { if (ref.includes('inventoryItems')) deleted = true; await deleteDoc(ref); };
      reloaded.firestore.updateDoc = async (ref, data) => {
        if (ref.includes('inventoryItems')) {
          assert.equal(deleted, false, 'must not update a deleted inventory document');
          assert.equal(ref.at(-1), 'ABC123');
        }
        await updateDoc(ref, data);
      };
      await reloaded.queue.flushOfflineQueue();
      assert.equal((await reloaded.queue.getOfflineQueue()).length, 0);
      assert.equal(reloaded.writes.some((write) => write.type === 'create'), false);
    });
  }
}
