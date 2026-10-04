const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const checklistServiceSource = fs.readFileSync('lib/checklistsService.ts', 'utf8');
const offlineQueueSource = fs.readFileSync('lib/offlineQueue.ts', 'utf8');

function loadGear(overrides = {}) {
  const source = ts.transpileModule(fs.readFileSync('lib/gearService.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const empty = {};
  const firestore = { collection: () => ({}), doc: () => ({}), serverTimestamp: () => 'timestamp' };
  const queue = { getOfflineStorageSpaces: async () => [], getOfflineCompartments: async () => [], getOfflineItems: async () => [], getCachedStorageSpaces: async () => [], getCachedCompartments: async () => [], getCachedInventoryItems: async () => [], projectInventoryItems: async (_, items) => items };
  const mocks = {
    '@react-native-community/netinfo': { default: { fetch: async () => ({ isConnected: true, isInternetReachable: true }) } },
    'firebase/firestore': firestore,
    '../firebaseConfig': { auth: { currentUser: { uid: 'u1' } }, db: {} },
    './cloudPhotoStorage': empty,
    './localPhotoStorage': empty,
    './offlineQueue': queue,
  };
  Object.assign(mocks, overrides);
  const exports = {};
  vm.runInNewContext(source, { exports, module: { exports }, require: (id) => mocks[id] ?? require(id), console, setTimeout, clearTimeout }, { filename: 'gearService.ts' });
  return exports;
}

function loadOfflineQueue() {
  const source = ts.transpileModule(fs.readFileSync('lib/offlineQueue.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const storage = new Map();
  const asyncStorage = {
    getItem: async (key) => storage.get(key) ?? null,
    setItem: async (key, value) => storage.set(key, value),
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    module: { exports },
    require: (id) => ({
      '@react-native-async-storage/async-storage': { default: asyncStorage },
      'firebase/firestore': { collection: () => ({}), doc: () => ({}) },
      '../firebaseConfig': { db: {} },
    }[id] ?? require(id)),
    console,
  }, { filename: 'offlineQueue.ts' });
  return { queue: exports, storage };
}

const { findChecklistInventoryMatches, findChecklistInventoryItemById } = loadGear();

test('stable inventory ID targets one item despite duplicate names and stale location', () => {
  const items = [
    { id: 'ABC', name: 'Renamed Flashlight', compartmentId: 'new' },
    { id: 'OTHER', name: 'Flashlight', compartmentId: 'old', compartmentName: 'Black Box' },
  ];
  assert.equal(findChecklistInventoryItemById(items, 'ABC').id, 'ABC');
  assert.equal(findChecklistInventoryItemById(items, 'missing'), undefined);
});

test('exact compartment ID prevents same-name cross-location matches', () => {
  const items = [
    { id: 'a', name: 'Flashlight', compartmentId: 'compartment-A', compartmentName: 'Black Box' },
    { id: 'b', name: 'Flashlight', compartmentId: 'compartment-B', compartmentName: 'Black Box' },
  ];
  const matches = findChecklistInventoryMatches(items, { name: 'Flashlight', compartmentId: 'compartment-A', compartmentName: 'Black Box' });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'a');
});

test('exact compartment matching still works and does not create cross-location fallback', () => {
  const items = [{ id: 'a', name: 'Flashlight', compartmentId: 'compartment-A', compartmentName: 'Front' }];
  assert.equal(findChecklistInventoryMatches(items, { name: 'Flashlight', compartmentId: 'compartment-A', compartmentName: 'Renamed' }).length, 1);
  assert.equal(findChecklistInventoryMatches(items, { name: 'Flashlight', compartmentId: 'missing', compartmentName: 'Front' }).length, 0);
});

test('legacy records without a compartment ID retain name fallback', () => {
  const items = [{ id: 'a', name: 'Flashlight', compartmentName: 'Black Box' }];
  assert.equal(findChecklistInventoryMatches(items, { name: 'Flashlight', compartmentName: 'Black Box' }).length, 1);
});

test('stable ID selection is safe for quantity decrement and checklist deletion', () => {
  const items = [
    { id: 'linked', name: 'Flashlight', compartmentId: 'old' },
    { id: 'same-name', name: 'Flashlight', compartmentId: 'old' },
  ];
  assert.equal(findChecklistInventoryItemById(items, 'linked').id, 'linked');
  assert.equal(findChecklistInventoryItemById(items, 'missing'), undefined);
});

test('checklist normalization preserves stable inventory identity and legacy nulls', () => {
  assert.match(checklistServiceSource, /function normalizeChecklistItem[\s\S]*?inventoryItemId:\s*typeof data\.inventoryItemId === "string" \? data\.inventoryItemId : null/);
  assert.match(checklistServiceSource, /inventoryItemId:\s*data\.inventoryItemId \?\? null/);
});

test('offline checklist mutation payloads optionally carry inventory identity', () => {
  for (const operation of ['toggleChecklistItemPacked', 'updateChecklistItemName', 'updateChecklistItemQuantity', 'deleteChecklistItem']) {
    assert.match(checklistServiceSource, new RegExp(`type: "${operation}"`));
  }
  assert.match(checklistServiceSource, /\.\.\.\(item\.inventoryItemId \? \{ inventoryItemId: item\.inventoryItemId \} : \{\}\)/);
  assert.match(checklistServiceSource, /\.\.\.\(inventoryItemId \? \{ inventoryItemId \} : \{\}\)/);
  assert.match(offlineQueueSource, /inventoryItemId\?: string;/);
});

test('phase 2C-1 does not add offline inventory synchronization', () => {
  assert.doesNotMatch(checklistServiceSource, /enqueueOfflineOperation\(\{[\s\S]*type: "updateInventoryItem"/);
});

test('offline packed toggle queues stable-ID inventory status without legacy lookup', () => {
  const screenSource = fs.readFileSync('app/(tabs)/checklists/[checklistId].tsx', 'utf8');
  assert.match(screenSource, /if \(item\.inventoryItemId\) \{[\s\S]*?await updateItem\(item\.inventoryItemId, \{[\s\S]*?status: !item\.packed \? "packed" : "missing"/);
  assert.match(screenSource, /if \(isOnline && item\.compartmentId\) \{[\s\S]*?syncInventoryItemStatusFromChecklist/);
});

test('checklist deletion preserves inventory-before-checklist queue ordering', () => {
  const screenSource = fs.readFileSync('app/(tabs)/checklists/[checklistId].tsx', 'utf8');
  assert.match(screenSource, /removeOrDecrementInventoryItemFromChecklist\([\s\S]*?deleteChecklistItem\(/);
});

test('ordered checklist projection applies mutations, preserves identity, and suppresses deletes', async () => {
  const { queue } = loadOfflineQueue();
  await queue.cacheInventoryItems?.('unused', []);
  await queue.enqueueOfflineOperation({ id: 'toggle-1', type: 'toggleChecklistItemPacked', userId: 'u1', payload: { checklistId: 'c1', itemId: 'i1', packed: true, inventoryItemId: 'inv-1' }, createdAt: '1' });
  await queue.enqueueOfflineOperation({ id: 'toggle-2', type: 'toggleChecklistItemPacked', userId: 'u1', payload: { checklistId: 'c1', itemId: 'i1', packed: false }, createdAt: '2' });
  await queue.enqueueOfflineOperation({ id: 'name-1', type: 'updateChecklistItemName', userId: 'u1', payload: { checklistId: 'c1', itemId: 'i1', name: 'Renamed', inventoryItemId: 'inv-1' }, createdAt: '3' });
  await queue.enqueueOfflineOperation({ id: 'quantity-1', type: 'updateChecklistItemQuantity', userId: 'u1', payload: { checklistId: 'c1', itemId: 'i1', quantity: 3 }, createdAt: '4' });
  const projected = await queue.projectChecklistItems('u1', 'c1', [{ id: 'i1', name: 'Original', quantity: 1, packed: false, inventoryItemId: 'inv-1' }, { id: 'other', name: 'Other' }]);
  assert.deepEqual({ ...projected.find((item) => item.id === 'i1') }, { id: 'i1', name: 'Renamed', quantity: 3, packed: false, inventoryItemId: 'inv-1', packedAt: null, updatedAt: '4' });
  assert.equal(projected.length, 2);
});

test('checklist projection isolates checklists and applies update then delete', async () => {
  const { queue } = loadOfflineQueue();
  await queue.enqueueOfflineOperation({ id: 'update', type: 'updateChecklistItemName', userId: 'u1', payload: { checklistId: 'other', itemId: 'i1', name: 'Wrong' }, createdAt: '1' });
  await queue.enqueueOfflineOperation({ id: 'delete', type: 'deleteChecklistItem', userId: 'u1', payload: { checklistId: 'c1', itemId: 'i1' }, createdAt: '2' });
  const projected = await queue.projectChecklistItems('u1', 'c1', [{ id: 'i1', name: 'Original' }]);
  assert.equal(projected.length, 0);
});

test('offline-created checklist item projection remains functional', async () => {
  const { queue } = loadOfflineQueue();
  await queue.enqueueOfflineOperation({ id: 'offline-item-1', type: 'createChecklistItem', userId: 'u1', payload: { checklistId: 'c1', name: 'New', sortOrder: 1 }, createdAt: '1' });
  const projected = await queue.getOfflineChecklistItems('u1', 'c1');
  assert.equal(projected[0].id, 'offline-item-1');
  assert.equal(projected[0].name, 'New');
  assert.equal(projected[0].inventoryItemId, undefined);
});

function quantityHarness(records, offline = false) {
  const writes = [];
  const queued = [];
  const firestore = {
    collection: (_, ...path) => path,
    doc: (_, ...path) => path,
    serverTimestamp: () => 'timestamp',
    getDocs: async () => ({ docs: records.map(({ id, ...data }) => ({ id, data: () => data })) }),
    updateDoc: async (path, data) => writes.push({ path, data }),
    addDoc: async (path, data) => { writes.push({ path, data }); return { id: 'created' }; },
  };
  const gear = loadGear({
    'firebase/firestore': firestore,
    '@react-native-community/netinfo': { default: { fetch: async () => ({ isConnected: !offline, isInternetReachable: !offline }) } },
    './offlineQueue': {
      cacheInventoryItems: async () => {},
      getCachedInventoryItems: async () => records,
      projectInventoryItems: async (_, items) => items,
      enqueueOfflineOperation: async (operation) => queued.push(operation),
    },
  });
  return { gear, writes, queued };
}

const quantityDestination = { id: 'old', name: 'Old', vehicleId: 'old-vehicle' };
for (const scenario of ['unchanged', 'renamed', 'moved', 'duplicates', 'offline']) {
  test(`quantity increase honors stable identity: ${scenario}`, async () => {
    const target = {
      id: 'linked', name: scenario === 'renamed' ? 'New name' : 'Tent', quantity: 5,
      compartmentId: scenario === 'moved' ? 'new' : 'old', compartmentName: 'Current',
      vehicleId: 'current-vehicle', roomId: 'room', roomName: 'Room', status: 'packed',
      source: 'manual', notes: 'Keep', barcode: '0001', barcodeType: 'ean13',
      itemPhotoUri: 'local', itemPhotoDownloadUrl: 'https://example.com/photo', custom: 'keep',
    };
    const records = [{ id: 'other', name: 'Tent', quantity: 9, compartmentId: 'old' }, target];
    const before = JSON.stringify(records);
    const { gear, writes, queued } = quantityHarness(records, scenario === 'offline');
    assert.equal(await gear.createOrUpdateInventoryItemFromChecklist({ name: 'Tent', quantity: 1, inventoryItemId: 'linked' }, quantityDestination), 'linked');
    if (scenario === 'offline') {
      assert.equal(writes.length, 0);
      assert.equal(queued.length, 1);
      assert.equal(queued[0].type, 'updateInventoryItem');
      assert.equal(queued[0].userId, 'u1');
      assert.equal(queued[0].payload.itemId, 'linked');
      assert.deepEqual({ ...queued[0].payload.updates }, { quantity: 6 });
    } else {
      assert.equal(queued.length, 0);
      assert.equal(writes.length, 1);
      assert.deepEqual(writes[0].path, ['users', 'u1', 'inventoryItems', 'linked']);
      assert.deepEqual({ ...writes[0].data }, { quantity: 6, updatedAt: 'timestamp' });
    }
    assert.equal(JSON.stringify(records), before);
  });
}

for (const records of [[], [{ id: 'other', name: 'Tent', quantity: 9, compartmentId: 'old' }]]) {
  test(`missing stable quantity target creates nothing (alternatives=${records.length})`, async () => {
    const { gear, writes, queued } = quantityHarness(records);
    assert.equal(await gear.createOrUpdateInventoryItemFromChecklist({ name: 'Tent', quantity: 1, inventoryItemId: 'missing' }, quantityDestination), null);
    assert.equal(writes.length, 0);
    assert.equal(queued.length, 0);
  });
}

test('legacy quantity matching and unlinked destination creation remain available', async () => {
  const existing = quantityHarness([{ id: 'legacy', name: ' TENT ', quantity: 5, compartmentId: 'old' }]);
  assert.equal(await existing.gear.createOrUpdateInventoryItemFromChecklist({ name: 'Tent', quantity: 1 }, quantityDestination), 'legacy');
  assert.equal(existing.writes[0].data.quantity, 6);
  assert.equal(existing.writes[0].data.source, 'checklist');
  const unlinked = quantityHarness([]);
  assert.equal(await unlinked.gear.createOrUpdateInventoryItemFromChecklist({ name: 'Tent', quantity: 2 }, quantityDestination), 'created');
  assert.equal(unlinked.writes.length, 1);
  assert.equal(unlinked.writes[0].data.quantity, 2);
  assert.equal(unlinked.writes[0].data.compartmentId, 'old');
});

function relationshipHarness() {
  const writes = [];
  const auth = { currentUser: { uid: 'u1' } };
  const db = {};
  const firestore = {
    collection: (_, ...segments) => ({ path: segments }),
    doc: (base, ...segments) => {
      const path = [...(base.path ?? []), ...segments];
      assert.equal(path.length % 2, 0, 'Firestore document path must have even segment count');
      return { path };
    },
    updateDoc: async (ref, data) => writes.push({ path: ref.path.join('/'), data: { ...data } }),
    serverTimestamp: () => 'timestamp',
  };
  // Export the existing private normalizer only in this VM, without changing production exports.
  const source = ts.transpileModule(checklistServiceSource + '\nexport { normalizeChecklistItem };', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const mocks = {
    'firebase/firestore': firestore,
    '../firebaseConfig': { auth, db },
    '@react-native-community/netinfo': {},
    './cloudPhotoStorage': {}, './localPhotoStorage': {}, './offlineQueue': {},
  };
  vm.runInNewContext(source, { exports, module: { exports }, require: (id) => {
    assert.ok(Object.hasOwn(mocks, id), `Unexpected service dependency: ${id}`);
    return mocks[id];
  }, console }, { filename: 'checklistsService.ts' });
  return { service: exports, auth, writes };
}

test('relationship persistence uses the authenticated checklist document and only relationship/timestamp fields', async () => {
  const { service, writes } = relationshipHarness();
  await service.updateChecklistItemInventoryId('u1', 'checklist', 'item', 'destination-inventory');
  assert.deepEqual(writes, [{
    path: 'users/u1/checklists/checklist/items/item',
    data: { inventoryItemId: 'destination-inventory', updatedAt: 'timestamp' },
  }]);
  assert.ok(writes.every((write) => write.path !== 'u1/checklists/checklist/items/item'));
  assert.equal(service.normalizeChecklistItem('item', writes[0].data).inventoryItemId, 'destination-inventory');
  assert.equal(service.normalizeChecklistItem('legacy', { name: 'Tent' }).inventoryItemId, null);
});

test('relationship persistence rejects unauthenticated and other-user writes', async () => {
  const { service, auth, writes } = relationshipHarness();
  await assert.rejects(service.updateChecklistItemInventoryId('other-user', 'c', 'i', 'inventory'), /not authenticated/);
  auth.currentUser = null;
  await assert.rejects(service.updateChecklistItemInventoryId('u1', 'c', 'i', 'inventory'), /not authenticated/);
  assert.equal(writes.length, 0);
});

for (const exists of [true, false]) {
  test(`assignment service boundary persists the ${exists ? 'matched' : 'created'} destination inventory ID`, async () => {
    const { gear, writes: inventoryWrites } = quantityHarness(exists
      ? [{ id: 'destination-existing', name: 'Tent', quantity: 5, compartmentId: 'old' }]
      : []);
    const { service, writes } = relationshipHarness();
    // Execute the same service boundary as handleSaveAssignment: find/create, then persist its returned ID.
    const inventoryItemId = await gear.createOrUpdateInventoryItemFromChecklist({ name: 'Tent', quantity: 2 }, quantityDestination);
    await service.updateChecklistItemInventoryId('u1', 'checklist', 'item', inventoryItemId);
    assert.equal(inventoryItemId, exists ? 'destination-existing' : 'created');
    assert.equal(inventoryWrites.length, 1);
    assert.equal(inventoryWrites[0].data.quantity, exists ? 7 : 2);
    assert.equal(writes[0].path, 'users/u1/checklists/checklist/items/item');
    assert.equal(writes[0].data.inventoryItemId, inventoryItemId);
  });
}
