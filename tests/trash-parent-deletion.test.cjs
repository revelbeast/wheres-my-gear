const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const trash = { isDeleted: true, deletedAt: 'keep-date', deletedLocation: { vehicleId: 'v', compartmentId: 'c' }, quantity: 7, status: 'packed', notes: 'keep', source: 'scan', barcode: '0001', barcodeType: 'ean13', itemPhotoUri: 'file://photo', itemPhotoStoragePath: 'cloud', itemPhotoDownloadUrl: 'url', photoBackedUp: true, checklistId: 'linked', extra: 'keep', vehicleId: 'v', compartmentId: 'c' };
function setup({ pending = [], network = { isConnected: true, isInternetReachable: true }, beforeTransaction = () => {} } = {}) {
  const docs = new Map([['storageSpaces/v', {}], ['compartments/c', { vehicleId: 'v', roomId: 'r' }], ['rooms/r', { storageSpaceId: 'v' }], ['inventoryItems/trash', structuredClone(trash)], ['inventoryItems/active', { vehicleId: 'v', compartmentId: 'c' }], ['inventoryItems/via-compartment', { ...structuredClone(trash), vehicleId: 'other' }]]);
  const writes = []; let attempt = 0;
  const snap = ref => ({ ref, id: ref.split('/').at(-1), exists: () => docs.has(ref), data: () => structuredClone(docs.get(ref)) });
  const list = async q => ({ docs: [...docs.keys()].filter(key => key.startsWith(q.ref + '/') && (!q.field || docs.get(key)[q.field] === q.value)).map(snap) });
  const api = {
    doc: (...parts) => parts.slice(-2).join('/'), collection: (...parts) => ({ ref: parts.at(-1) }), where: (field, _, value) => ({ field, value }), query: (ref, where) => ({ ...ref, ...where }),
    getDocs: list, getDocsFromServer: list, serverTimestamp: () => 'now',
    runTransaction: async (_, fn) => {
      beforeTransaction(docs, ++attempt);
      const staged = [];
      await fn({ get: async ref => snap(ref), delete: ref => staged.push(ref), update: () => assert.fail('Trash must not be rewritten') });
      for (const ref of staged) { writes.push(ref); docs.delete(ref); }
    },
    writeBatch: () => { const ops = []; return { delete: ref => ops.push(() => { writes.push(ref); docs.delete(ref); }), update: (ref, values) => ops.push(() => docs.set(ref, { ...docs.get(ref), ...values })), commit: async () => ops.forEach(fn => fn()) }; },
  };
  const forbidden = new Proxy({}, { get: () => () => assert.fail('No photo operations') });
  const mocks = { 'firebase/firestore': api, '../firebaseConfig': { db: {}, auth: { currentUser: { uid: 'u' } } }, '@react-native-community/netinfo': { default: { fetch: async () => network } }, './cloudPhotoStorage': forbidden, './localPhotoStorage': forbidden,
    './offlineQueue': { getOfflineQueue: async () => pending, enqueueOfflineOperation: () => assert.fail('No queue'), cacheInventoryItems: () => assert.fail('Cache remains unchanged'), removeOfflineOperation: () => {} } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/gearService.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: id => { assert.ok(id in mocks, id); return mocks[id]; }, console, setTimeout, clearTimeout });
  return { gear: exports, docs, writes, pending };
}
for (const kind of ['StorageSpace', 'Compartment']) {
  const id = kind === 'StorageSpace' ? 'v' : 'c';
  test(`${kind}: active children hard-delete; Trash survives untouched and original restore becomes invalid`, async () => {
    const h = setup(); const before = structuredClone([...h.docs].filter(([key]) => key.includes('trash') || key.includes('via-compartment')));
    await h.gear[`delete${kind}`](id);
    assert.equal(h.docs.has('inventoryItems/active'), false);
    for (const [key, value] of before) { assert.deepEqual(h.docs.get(key), value); assert.ok(!h.writes.includes(key)); }
    assert.equal(h.docs.has('compartments/c'), false);
    assert.equal(h.docs.has('rooms/r'), true);
    await assert.rejects(h.gear.restoreDeletedItem('trash'), e => e.code === 'NEW_DESTINATION_REQUIRED');
  });
  test(`${kind}: active at discovery, soft-deleted at transaction boundary survives`, async () => {
    const h = setup({ beforeTransaction: docs => { Object.assign(docs.get('inventoryItems/active'), trash); } });
    await h.gear[`delete${kind}`](id);
    assert.equal(h.docs.get('inventoryItems/active').isDeleted, true);
    assert.ok(!h.writes.includes('inventoryItems/active'));
  });
  for (const type of ['createItem', 'updateInventoryItem', 'deleteInventoryItem']) test(`${kind}: pending ${type} refuses without partial destruction`, async () => {
    const h = setup({ pending: [{ type, userId: 'u', payload: { itemId: 'active', updates: { isDeleted: true } } }] });
    await assert.rejects(h.gear[`delete${kind}`](id), e => e.code === 'SYNC_REQUIRED'); assert.equal(h.writes.length, 0);
  });
  for (const network of [{ isConnected: false }, { isConnected: true, isInternetReachable: null }]) test(`${kind}: unusable connectivity refuses without mutations`, async () => {
    const h = setup({ network }); await assert.rejects(h.gear[`delete${kind}`](id), e => e.code === 'CONNECT_REQUIRED'); assert.equal(h.writes.length, 0);
  });
  test(`${kind}: pending work arriving during discovery still blocks transaction`, async () => {
    const pending = [];
    const h = setup({ pending, beforeTransaction: () => pending.push({ type: 'updateInventoryItem', userId: 'u' }) });
    await assert.rejects(h.gear[`delete${kind}`](id), e => e.code === 'SYNC_REQUIRED'); assert.equal(h.writes.length, 0);
  });
}
test('deleteRoom still detaches compartments without changing any inventory', async () => {
  const h = setup(); const before = structuredClone([...h.docs].filter(([key]) => key.startsWith('inventoryItems/')));
  await h.gear.deleteRoom('r');
  assert.equal(h.docs.has('rooms/r'), false); assert.equal(h.docs.get('compartments/c').roomId, '');
  for (const [key, value] of before) assert.deepEqual(h.docs.get(key), value);
});
test('other-user pending operations do not block parent deletion', async () => {
  const h = setup({ pending: [{ type: 'createItem', userId: 'other' }] }); await h.gear.deleteCompartment('c'); assert.equal(h.docs.has('compartments/c'), false);
});
