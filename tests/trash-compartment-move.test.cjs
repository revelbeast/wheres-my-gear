const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const base = { name: 'Gear', vehicleId: 'old', vehicleName: 'Old', compartmentId: 'c', compartmentName: 'Box', roomId: 'r', roomName: 'Room', quantity: 7, status: 'packed', notes: 'notes', source: 'scan', barcode: '001', barcodeType: 'code128', itemPhotoUri: 'file://photo', itemPhotoDownloadUrl: 'photo', itemPhotoStoragePath: 'path', photoBackedUp: true, checklistId: 'checklist', updatedAt: 'before', extra: { keep: true } };
const input = { compartmentId: 'c', compartmentName: 'Box', vehicleId: 'new', vehicleName: 'New', roomId: 'r2', roomName: 'Room 2' };
function setup({ network = { isConnected: true, isInternetReachable: true }, pending = [], before = () => {}, retry = false } = {}) {
  const docs = new Map([
    ['compartments/c', { vehicleId: 'old', roomId: 'r', roomName: 'Room' }],
    ['storageSpaces/old', {}], ['storageSpaces/new', {}],
    ['rooms/r', { storageSpaceId: 'old' }], ['rooms/r2', { storageSpaceId: 'new' }],
    ['inventoryItems/a', structuredClone(base)],
    ['inventoryItems/trash', { ...structuredClone(base), isDeleted: true, deletedAt: 'date', deletedLocation: { vehicleId: 'old', compartmentId: 'c', roomId: 'r' } }],
    ['inventoryItems/unrelated', { ...structuredClone(base), compartmentId: 'other' }],
  ]);
  const writes = [];
  const snap = ref => { const value = structuredClone(docs.get(ref)); return { ref, id: ref.split('/').at(-1), exists: () => value !== undefined, data: () => value }; };
  const api = {
    doc: (...parts) => parts.slice(-2).join('/'), collection: (...parts) => ({ ref: parts.at(-1) }), where: (field, _, value) => ({ field, value }), query: (ref, filter) => ({ ...ref, ...filter }), serverTimestamp: () => 'now',
    getDocsFromServer: async q => ({ docs: [...docs.keys()].filter(k => k.startsWith(q.ref + '/') && docs.get(k)[q.field] === q.value).map(snap) }),
    runTransaction: async (_, fn) => {
      before(docs);
      for (let attempt = 0; ; attempt++) {
        const staged = [];
        const result = await fn({ get: async ref => snap(ref), update: (ref, value) => staged.push([ref, value]) });
        // Model Firestore discarding a conflicted attempt and re-reading on retry.
        if (retry && attempt === 0) { docs.get('inventoryItems/a').isDeleted = true; continue; }
        for (const [ref, value] of staged) { writes.push([ref, value]); docs.set(ref, { ...docs.get(ref), ...value }); }
        return result;
      }
    },
  };
  const forbidden = new Proxy({}, { get: () => () => assert.fail('No photo operation') });
  const mocks = { 'firebase/firestore': api, '../firebaseConfig': { db: {}, auth: { currentUser: { uid: 'u' } } }, '@react-native-community/netinfo': { default: { fetch: async () => network } }, './cloudPhotoStorage': forbidden, './localPhotoStorage': forbidden, './offlineQueue': { getOfflineQueue: async () => pending, enqueueOfflineOperation: () => assert.fail('No queue'), cacheInventoryItems: () => assert.fail('No cache rewrite') } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/gearService.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: id => { assert.ok(id in mocks, id); return mocks[id]; }, console, setTimeout, clearTimeout });
  return { gear: exports, docs, writes };
}
for (const roomOnly of [false, true]) test(`mixed active/Trash move preserves exact fields and restore validation (roomOnly=${roomOnly})`, async () => {
  const h = setup(); const trash = structuredClone(h.docs.get('inventoryItems/trash')); const unrelated = structuredClone(h.docs.get('inventoryItems/unrelated'));
  const move = { ...input, ...(roomOnly ? { vehicleId: 'old', vehicleName: 'Old' } : {}) };
  await h.gear.moveCompartment(move);
  assert.deepEqual(h.docs.get('inventoryItems/a'), { ...base, vehicleId: move.vehicleId, vehicleName: move.vehicleName, compartmentName: 'Box', updatedAt: 'now' });
  assert.deepEqual(h.docs.get('compartments/c'), { vehicleId: move.vehicleId, roomId: 'r2', roomName: 'Room 2', updatedAt: 'now' });
  assert.deepEqual(h.docs.get('inventoryItems/trash'), trash);
  assert.deepEqual(h.docs.get('inventoryItems/unrelated'), unrelated);
  assert.equal(h.writes.length, 2);
  await assert.rejects(h.gear.restoreDeletedItem('trash'), e => e.code === 'NEW_DESTINATION_REQUIRED');
});
for (const state of ['deleted', 'moved', 'missing']) test(`candidate ${state} before authoritative read receives no write`, async () => {
  const h = setup({ before: docs => { if (state === 'deleted') docs.get('inventoryItems/a').isDeleted = true; else if (state === 'moved') docs.get('inventoryItems/a').compartmentId = 'elsewhere'; else docs.delete('inventoryItems/a'); } });
  await h.gear.moveCompartment(input); assert.deepEqual(h.writes.map(([ref]) => ref), ['compartments/c']);
});
test('transaction retry excludes a concurrently soft-deleted candidate', async () => {
  const h = setup({ retry: true }); await h.gear.moveCompartment(input);
  assert.deepEqual(h.writes.map(([ref]) => ref), ['compartments/c']); assert.equal(h.docs.get('inventoryItems/a').updatedAt, 'before');
});
for (const type of ['createItem', 'updateInventoryItem', 'deleteInventoryItem']) test(`pending ${type} refuses without partial changes`, async () => {
  const h = setup({ pending: [{ type, userId: 'u', payload: { itemId: 'a', updates: { isDeleted: true } } }] }); const before = structuredClone([...h.docs]);
  await assert.rejects(h.gear.moveCompartment(input), e => e.code === 'SYNC_REQUIRED'); assert.deepEqual([...h.docs], before); assert.equal(h.writes.length, 0);
});
test('pending operation arriving after discovery blocks transaction', async () => {
  const pending = []; const h = setup({ pending, before: () => pending.push({ userId: 'u', type: 'updateInventoryItem' }) });
  await assert.rejects(h.gear.moveCompartment(input), e => e.code === 'SYNC_REQUIRED'); assert.equal(h.writes.length, 0);
});
for (const network of [{ isConnected: false }, { isConnected: true, isInternetReachable: null }, { isConnected: true, isInternetReachable: false }]) test(`unusable connectivity ${JSON.stringify(network)} refuses`, async () => {
  const h = setup({ network }); await assert.rejects(h.gear.moveCompartment(input), e => e.code === 'CONNECT_REQUIRED'); assert.equal(h.writes.length, 0);
});
test('oversized move refuses without partial mutation', async () => {
  const h = setup(); for (let i = 0; i < 500; i++) h.docs.set(`inventoryItems/extra${i}`, { ...base });
  const before = structuredClone([...h.docs]); await assert.rejects(h.gear.moveCompartment(input), e => e.code === 'MOVE_TOO_LARGE'); assert.deepEqual([...h.docs], before); assert.equal(h.writes.length, 0);
});
test('other-user pending work does not block move', async () => {
  const h = setup({ pending: [{ userId: 'other', type: 'updateInventoryItem' }] }); await h.gear.moveCompartment(input); assert.equal(h.writes.length, 2);
});
