// Run with node --test tests/ai-duplicates.test.cjs. No Firebase/native calls.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: (id) => {
    if (id in mocks) return mocks[id];
    if (id.endsWith('.png')) return 1;
    throw Error(`Unexpected module ${id}`);
  }, console, setTimeout, clearTimeout });
  return module.exports;
}
const matching = load('lib/inventoryDuplicates.ts');
const item = (id, name = 'Cordless Drill') => ({ id, name, vehicleId: 'garage', compartmentId: 'tools', compartmentName: 'Tool Chest', itemPhotoUri: 'file:///existing.jpg' });
function harness({ items = [], fail = false, ai = true, found = true, saveFailures = 0 } = {}) {
  let slots = [], cursor = 0, effects = [], tree, dirty = true;
  const calls = { reads: [], creates: [], copies: [], deletes: [], pushes: [], drafts: [], legacyReads: [], saveAttempts: [], checklistWrites: [] };
  const listeners = {};
  const depsEqual = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
    useState: (initial) => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (next) => { const value = typeof next === 'function' ? next(slots[i]) : next; if (!Object.is(value, slots[i])) { slots[i] = value; dirty = true; } }];
    },
    useRef: (value) => { const i = cursor++; return slots[i] ??= { current: value }; },
    useEffect: (fn, deps) => {
      const i = cursor++;
      if (!depsEqual(slots[i]?.deps, deps)) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    },
    useMemo: (fn, deps) => { const i = cursor++; if (!depsEqual(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
  };
  const remove = () => listeners.beforeRemove?.();
  const router = { push: (route) => calls.pushes.push(route), back: remove, replace: remove };
  const native = Object.fromEntries(['Image','ScrollView','Text','TextInput','TouchableOpacity','View'].map(x => [x,x]));
  native.Alert = { alert() {} };
  const component = load('app/scan-result.tsx', {
    react: React, 'react-native': native, 'expo-linking': {},
    'expo-router': { router, useLocalSearchParams: () => ({ ...(ai ? { scanId: 'ai-test' } : { code: '123' }), suggestedName: 'Cordless Drill', found: String(found), image: 'file:///cache/Camera/new.jpg', matchStatus: 'possible' }), useNavigation: () => navigation },
    'expo-file-system/legacy': { cacheDirectory: 'file:///cache/', deleteAsync: async (uri) => calls.deletes.push(uri) },
    'lucide-react-native': {},
    'firebase/firestore': { collection: () => ({}), query: () => ({}), where: () => ({}), getDocs: async () => { calls.legacyReads.push(true); return { empty: true }; }, addDoc: async (ref, data) => { calls.drafts.push(data); return { id: 'draft' }; } },
    '../lib/amazonAffiliate': { buildAmazonAffiliateLink: () => '' },
    '../lib/checklistsService': { subscribeToChecklists: (uid, cb) => { cb([]); return () => {}; }, addChecklistItem: async (...args) => calls.checklistWrites.push(args) },
    '../lib/firebase': { auth: { currentUser: { uid: 'user' } }, db: {} },
    '../lib/gearService': {
      getAllItems: async (options) => { calls.reads.push(options); if (fail) throw Error('offline'); return items; },
      getStorageSpaces: async () => [{ id: 'garage', name: 'Garage' }],
      getCompartmentsByVehicle: async () => [{ id: 'tools', name: 'Tool Chest' }],
      createItem: async (data) => { calls.saveAttempts.push(data); if (saveFailures-- > 0) throw Error('save failed'); calls.creates.push(data); return 'saved'; },
    },
    '../lib/inventoryDuplicates': matching,
    '../lib/localPhotoStorage': { isLocalAppPhotoUri: () => true, localPhotoExists: async () => true, savePhotoToLocalDocumentStorage: async (uri) => { calls.copies.push(uri); return 'file:///documents/new.jpg'; } },
    '../lib/useResponsiveLayout': { useResponsiveLayout: () => ({ isTabletLandscape: false }) },
  }).default;
  const navigation = { addListener: (event, fn) => { listeners[event] = fn; return () => delete listeners[event]; } };
  function nodes(node = tree) { return !node || typeof node !== 'object' ? [] : [node, ...(node.props?.children ?? []).flatMap(nodes)]; }
  function text(node = tree) { return node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : (node.props?.children ?? []).map(text).join(''); }
  async function settle() {
    for (let i = 0; i < 12; i++) {
      if (dirty) { dirty = false; cursor = 0; effects = []; tree = component(); const pending = effects; pending.forEach(fn => fn()); }
      await Promise.resolve();
    }
  }
  async function press(label) {
    const node = nodes().find(n => n.props.onPress && text(n).trim() === label);
    assert.ok(node, `Missing action ${label}`);
    const result = node.props.onPress(); await result; await settle();
  }
  return { calls, settle, text, press, nodes, remove, edit: async (name) => { nodes().find(n => n.type === 'TextInput' && n.props.value === 'Cordless Drill').props.onChangeText(name); await settle(); } };
}

test('shared matcher preserves normalization, substring matching and all results', () => {
  assert.equal(matching.normalizeDuplicateItemName(' DRILL!  Bit '), 'drill bit');
  assert.equal(matching.findPossibleDuplicateItems([item('1')], 'drill').length, 1);
  assert.equal(matching.findPossibleDuplicateItems([item('1')], '').length, 0);
  assert.equal(matching.findPossibleDuplicateItems([item('1')], 'tent').length, 0);
  assert.equal(matching.findPossibleDuplicateItems(Array.from({length: 5}, (_, i) => item(String(i))), 'drill').length, 5);
});
for (const count of [0, 1, 3, 5]) test(`review displays ${count} matches without writes`, async () => {
  const h = harness({ items: Array.from({length: count}, (_, i) => item(String(i))) }); await h.settle();
  assert.match(h.text(), count ? new RegExp(`Possible Duplicates?: ${count}`) : /No matches in the available inventory/);
  if (count > 3) assert.match(h.text(), /Plus 2 more/);
  assert.equal(h.nodes().filter(n => n.props.onPress && h.text(n).includes('View existing item')).length, Math.min(3, count));
  assert.equal(h.calls.creates.length + h.calls.drafts.length + h.calls.copies.length, 0);
  assert.equal(h.calls.reads[0].recoverPhotos, false);
});
test('edited name recalculates locally; recognition wording is separate', async () => {
  const h = harness({ items: [item('1')] }); await h.settle();
  assert.match(h.text(), /Recognition: Possible/); assert.doesNotMatch(h.text(), /Possible Match/);
  await h.edit('Tent'); assert.match(h.text(), /No matches in the available inventory/); assert.equal(h.calls.reads.length, 1);
});
test('view uses push with exact item, retains photo; Cancel removes only new cache photo', async () => {
  const h = harness({ items: [item('1')] }); await h.settle();
  await h.press('View existing item in compartment');
  assert.equal(h.calls.pushes[0].params.focusItemId, '1');
  assert.equal(h.calls.pushes[0].params.duplicateInspection, 'true');
  assert.equal(h.calls.creates.length + h.calls.drafts.length + h.calls.copies.length + h.calls.deletes.length, 0);
  await h.press('Cancel'); assert.equal(h.calls.creates.length, 0);
  assert.deepEqual(h.calls.deletes, ['file:///cache/Camera/new.jpg']);
});
for (const fail of [false, true]) test(`Save stays available, creates once and copies own photo (lookup failure=${fail})`, async () => {
  const h = harness({ items: [item('1')], fail }); await h.settle();
  if (fail) assert.match(h.text(), /Couldn't check inventory. You can still save/);
  await h.press('Select a storage space first.⌄'); await h.press('Garage');
  await h.press('Select a compartment first.⌄'); await h.press('Tool Chest');
  const save = h.nodes().find(n => n.props.onPress && h.text(n).trim() === 'Save');
  await Promise.all([save.props.onPress(), save.props.onPress()]);
  assert.equal(h.calls.creates.length, 1);
  assert.deepEqual(h.calls.copies, ['file:///cache/Camera/new.jpg']);
  assert.equal(h.calls.creates[0].itemPhotoUri, 'file:///documents/new.jpg');
});
test('barcode skips new duplicate lookup and retains recognition wording', async () => {
  const h = harness({ ai: false }); await h.settle();
  assert.equal(h.calls.reads.length, 0); assert.match(h.text(), /Possible Match/);
});

for (const inspect of [true, false]) test(`compartment service recovery behavior (inspection=${inspect})`, async () => {
  const writes = [], downloads = [];
  const existing = { ...item('existing'), itemPhotoUri: '', itemPhotoDownloadUrl: 'https://example.invalid/photo.jpg' };
  const service = load('lib/gearService.ts', {
    '@react-native-community/netinfo': {},
    'firebase/firestore': {
      collection: () => ({}), doc: () => ({}), query: () => ({}), where: () => ({}),
      getDocs: async () => ({ docs: [{ id: existing.id, data: () => ({ ...existing }) }] }),
      updateDoc: async (ref, data) => writes.push(data), serverTimestamp: () => 'timestamp',
      addDoc: () => { throw Error('Unexpected creation'); },
    },
    '../firebaseConfig': { auth: { currentUser: { uid: 'user' } }, db: {} },
    './cloudPhotoStorage': {},
    './localPhotoStorage': {
      localPhotoExists: async () => false,
      downloadPhotoToLocalDocumentStorage: async (url) => { downloads.push(url); return 'file:///recovered.jpg'; },
    },
    './offlineQueue': {
      getOfflineItemsByCompartment: async () => [], getCachedInventoryItems: async () => [],
      cacheInventoryItems: async () => {},
    },
  });
  const result = inspect
    ? await service.getItemsByCompartment('tools', { recoverPhotos: false })
    : await service.getItemsByCompartment('tools');
  assert.equal(writes.length, inspect ? 0 : 1);
  assert.equal(downloads.length, inspect ? 0 : 1);
  assert.equal(result[0].itemPhotoUri, inspect ? '' : 'file:///recovered.jpg');
  if (!inspect) assert.equal(writes[0].updatedAt, 'timestamp');
});

test('destination gates recovery on the explicit inspection flag', () => {
  const source = fs.readFileSync(path.join(root, 'app/(tabs)/vehicles/[vehicleId]/compartments/[compartmentId].tsx'), 'utf8');
  assert.match(source, /isDuplicateInspection = params\.duplicateInspection === "true"/);
  assert.match(source, /getItemsByCompartment\(String\(compartmentId\), \{\s*recoverPhotos: !isDuplicateInspection/);
});

test('push leaves edited review and photo intact across rerender before return', async () => {
  const h = harness({ items: [item('1')] }); await h.settle();
  await h.edit('Drill');
  await h.press('View existing item in compartment');
  // Models the retained review instance; native stack mounting/pop requires device validation.
  await h.settle();
  assert.ok(h.nodes().some(n => n.type === 'TextInput' && n.props.value === 'Drill'));
  assert.equal(h.calls.reads.length, 1);
  assert.equal(h.calls.creates.length + h.calls.drafts.length + h.calls.copies.length + h.calls.deletes.length, 0);
  await h.press('Cancel');
  assert.deepEqual(h.calls.deletes, ['file:///cache/Camera/new.jpg']);
});

module.exports = { harness };
