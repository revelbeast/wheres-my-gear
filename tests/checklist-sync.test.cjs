const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

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

const { findChecklistInventoryMatches } = loadGear();

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
