const { test } = require('node:test');
const assert = require('node:assert/strict');
// Shared transpilation loader; importing also runs the shared AI regression checks.
const { load, identity, matching } = require('./ai-duplicates.test.cjs');
const { barcodeIdentity: normalize, barcodeIdentityKey: key } = identity;
test('UPC-A, iOS stripped EAN-13 and leading-zero EAN-13 share GTIN-14 identity', () => {
  const values = [normalize('036000291452', 'upc_a'), normalize('036000291452', 'ean13'), normalize('0036000291452', 'ean13')];
  for (const value of values) {
    assert.equal(value.barcode, '00036000291452'); assert.equal(key(value), key(values[0]));
    assert.equal(key(normalize(value.barcode, value.barcodeType)), key(value));
  }
});
test('invalid checksum/length stays opaque; characters and leading zeros survive', () => {
  for (const value of ['036000291453', '0036', ' 036000291452', '036000-291452']) {
    assert.equal(normalize(value, 'upc_a').barcode, value);
    assert.ok(!key(normalize(value, 'upc_a')).startsWith('gtin:'));
  }
});
test('UPC-E, EAN-8 and non-GTIN formats remain distinct', () => {
  assert.notEqual(key(normalize('96385074', 'upc_e')), key(normalize('96385074', 'ean8')));
  assert.equal(normalize('96385074', 'ean8').barcode, '00000096385074');
  assert.notEqual(key(normalize('000123', 'code128')), key(normalize('000123', 'pdf417')));
  assert.notEqual(key(normalize('036000291452', 'code128')), key(normalize('036000291452', 'upc_a')));
  assert.equal(normalize('00 Ab-12 ', 'code128').barcode, '00 Ab-12 ');
  assert.equal('barcodeType' in normalize('ABC', undefined), false);
});
test('WMG QR, missing and array parameters are not commercial identities', () => {
  for (const value of [undefined, '', [], 'wheresmygear://item/id', ' WHERESMYGEAR://room/id']) assert.equal(normalize(value, 'qr'), null);
});
test('exact barcode takes precedence; name fallback uses exact normalized equality', () => {
  const items = [{ id: 'exact', name: 'Other', barcode: '0036000291452', barcodeType: 'ean13' }, { id: 'legacy', name: ' Drill ' }, { id: 'partial', name: 'Cordless Drill' }];
  const exact = matching.findBarcodeDuplicateItems(items, normalize('036000291452', 'upc_a'), 'Drill');
  assert.equal(exact.kind, 'barcode'); assert.equal(exact.items[0].id, 'exact'); assert.equal(exact.items.length, 1);
  const fallback = matching.findBarcodeDuplicateItems(items, normalize('unknown', 'code128'), 'drill');
  assert.equal(fallback.kind, 'name'); assert.equal(fallback.items[0].id, 'legacy'); assert.equal(fallback.items.length, 1);
  const noExactName = matching.findBarcodeDuplicateItems(items, normalize('unknown', 'code128'), 'Dri');
  assert.equal(noExactName.items.length, 0);
});
function services(online) {
  const storage = new Map(), writes = [];
  const firestore = { collection: (...args) => args.slice(1), serverTimestamp: () => 'timestamp', addDoc: async (ref, data) => { writes.push({ ref, data }); return { id: 'saved' }; } };
  const queue = load('lib/offlineQueue.ts', {
    '@react-native-async-storage/async-storage': { getItem: async k => storage.get(k) ?? null, setItem: async (k,v) => storage.set(k,v) },
    'firebase/firestore': firestore, '../firebaseConfig': { db: {} },
  });
  const gear = load('lib/gearService.ts', {
    '@react-native-community/netinfo': { fetch: async () => ({ isConnected: online, isInternetReachable: online }) },
    'firebase/firestore': firestore, '../firebaseConfig': { db: {}, auth: { currentUser: { uid: 'user' } } },
    './cloudPhotoStorage': {}, './localPhotoStorage': {}, './offlineQueue': queue,
  });
  return { queue, gear, writes };
}
for (const withBarcode of [true, false]) test(`online create serializes optional identity safely (barcode=${withBarcode})`, async () => {
  const { gear, writes } = services(true);
  await gear.createItem({ name: 'Drill', ...(withBarcode ? normalize('036000291452', 'upc_a') : {}) });
  assert.equal(writes.length, 1); assert.deepEqual(writes[0].ref, ['users', 'user', 'inventoryItems']);
  assert.equal(writes[0].data.barcode, withBarcode ? '00036000291452' : undefined);
  assert.equal('barcode' in writes[0].data, withBarcode); assert.equal('barcodeType' in writes[0].data, withBarcode);
});
for (const withBarcode of [true, false]) test(`offline queue, all readers and replay preserve optional identity (barcode=${withBarcode})`, async () => {
  const { gear, queue, writes } = services(false);
  await gear.createItem({ name: 'Drill', vehicleId: 'garage', compartmentId: 'tools', ...(withBarcode ? normalize('036000291452', 'upc_a') : {}) });
  assert.equal(writes.length, 0);
  const queued = await queue.getOfflineQueue();
  const groups = [queued.map(x => x.payload), await queue.getOfflineItems('user'), await queue.getOfflineItemsByCompartment('user', 'tools'), await queue.getOfflineItemsByStatus('user', 'missing')];
  for (const records of groups) {
    assert.equal(records.length, 1); assert.equal(records[0].barcode, withBarcode ? '00036000291452' : undefined);
    assert.equal(records[0].barcodeType, withBarcode ? 'upc_a' : undefined);
    assert.equal('barcode' in records[0], withBarcode); assert.equal('barcodeType' in records[0], withBarcode);
  }
  await queue.flushOfflineQueue(); assert.equal(writes.length, 1);
  assert.equal(writes[0].data.barcode, withBarcode ? '00036000291452' : undefined);
  assert.equal(writes[0].data.barcodeType, withBarcode ? 'upc_a' : undefined);
  assert.equal('barcode' in writes[0].data, withBarcode); assert.equal('barcodeType' in writes[0].data, withBarcode);
  assert.equal((await queue.getOfflineQueue()).length, 0);
});
