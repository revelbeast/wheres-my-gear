const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const checklistServiceSource = fs.readFileSync('lib/checklistsService.ts', 'utf8');
const offlineQueueSource = fs.readFileSync('lib/offlineQueue.ts', 'utf8');

function loadGear() {
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
