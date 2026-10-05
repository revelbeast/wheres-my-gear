const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('app/(tabs)/(profile)/recently-deleted.tsx', 'utf8');
const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const profile = fs.readFileSync('app/(tabs)/(profile)/profile.tsx', 'utf8');
const profileAst = ts.createSourceFile('profile.tsx', profile, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function functions(tree) {
  const found = {};
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name) found[node.name.text] = node.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree); return found;
}
const funcs = functions(ast);
const context = { Date };
vm.createContext(context);
vm.runInContext(ts.transpileModule(['deletionTime', 'sortedDeletedItems', 'originalLocation'].map(key => funcs[key]).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const row = (id, deletedAt, other = {}) => ({ id, name: 'Same', isDeleted: true, quantity: 2, deletedAt, ...other });
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(connectivity = async () => ({ isConnected: false }), restore = async () => ({ cacheUpdated: true }), hierarchy = {}) {
  const alerts = [];
  let slots = [], index = 0, focus, cleanup, calls = 0;
  let read = async () => [];
  const refs = [];
  let refIndex = 0;
  const createElement = (type, props, ...children) => ({ type, props: props ?? {}, children });
  const react = { createElement, useEffect: () => {}, useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; }, useRef(initial) { const i = refIndex++; return refs[i] ?? (refs[i] = { current: initial }); }, useCallback: fn => fn };
  const exports = {};
  const mocks = {
    react: { ...react, default: react },
    'expo-router': { useFocusEffect: fn => { focus = fn; } },
    '@react-native-community/netinfo': { default: { fetch: connectivity } },
    'react-native': { Alert: { alert: (...args) => alerts.push(args) }, Modal: 'Modal', ActivityIndicator: 'Spinner', Image: 'Image', ScrollView: 'ScrollView', View: 'View', StyleSheet: { create: x => x } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, 'lucide-react-native': { Image: 'Icon' },
    '../../../components/auth/AuthProvider': { useAuth: () => ({ user: { uid: 'u' } }) },
    '../../../components/ui/HapticPressable': { default: 'Pressable' },
    '../../../components/ui/AppHeader': { default: 'Header' }, '../../../components/ui/ScreenBackground': { default: 'Background' },
    '../../../components/ui/Themed': { ThemedButton: 'Button', ThemedCard: 'Card', ThemedText: 'Text', useThemedValues: () => ({ colors: { text: 'black' } }) },
    '../../../lib/gearService': { getDeletedItems: async () => { calls++; return read(); }, restoreDeletedItem: restore, getStorageSpaces: async () => [], getCompartmentsByVehicle: async () => [], getRoomsByStorageSpace: async () => [], ...hierarchy },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: id => { assert.ok(id in mocks, `Unexpected import ${id}`); return mocks[id]; }, Date });
  return { alerts, render() { index = 0; refIndex = 0; return exports.default(); }, focus() { cleanup = focus(); }, blur() { cleanup(); }, read(fn) { read = fn; }, calls: () => calls };
}
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...tree.children.flatMap(nodes)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? tree.children.map(text).join(' ') : String(tree ?? ''); }

test('phone and tablet each contain locked Recently Deleted row between Import and Settings', () => {
  const rows = [];
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(profileAst) === 'ProfileRow') rows.push(node.getText(profileAst));
    ts.forEachChild(node, visit);
  }
  visit(profileAst);
  const indices = rows.map((x, i) => x.includes('title="Recently Deleted"') ? i : -1).filter(i => i >= 0);
  assert.equal(indices.length, 2);
  for (const i of indices) {
    assert.match(rows[i - 1], /title="Import Data"/); assert.match(rows[i + 1], /title="General Settings"/);
    assert.match(rows[i], /disabled=\{rowActionsDisabled\}/); assert.match(rows[i], /onPress=\{handleOpenRecentlyDeleted\}/);
  }
});
test('Profile routes through existing navigation lock and existing routes stay unchanged', () => {
  const funcs = functions(profileAst), routes = [];
  const ctx = { runNavigationAction: fn => fn(), router: { push: value => routes.push(value) } };
  vm.createContext(ctx);
  for (const name of ['handleOpenRecentlyDeleted', 'handleOpenProfileSettings', 'handleOpenFaq', 'handleOpenGeneralSettings']) {
    vm.runInContext(ts.transpileModule(funcs[name], {}).outputText, ctx); ctx[name]();
  }
  assert.deepEqual(routes, ['/recently-deleted', '/profile-settings', '/faq', '/general-settings']);
});
test('sort filters active records, preserves same-name IDs, newest first and ID tie-breaker', () => {
  const input = [row('z', '2026-01-01'), row('b', { seconds: 1767225600 }), row('a', { toMillis: () => 1767225600000 }), row('new', '2026-02-01'), row('active', '2027-01-01', { isDeleted: false })];
  assert.deepEqual(Array.from(context.sortedDeletedItems(input), x => x.id), ['new', 'a', 'b', 'z']);
  assert.equal(input[0].id, 'z');
});
test('missing and malformed dates sort last without crashing', () => {
  for (const value of [undefined, null, '', 'bad', { seconds: Infinity }, { toMillis() { throw Error(); } }]) assert.equal(context.deletionTime(value), null);
  assert.deepEqual(Array.from(context.sortedDeletedItems([row('b', null), row('a', 'bad'), row('c', '2026-01-01')]), x => x.id), ['c', 'a', 'b']);
});
test('location uses snapshot names only and tolerates partial/missing metadata', () => {
  assert.equal(context.originalLocation(row('a', null, { deletedLocation: { vehicleName: 'Truck', roomName: 'Room', compartmentName: 'Box' } })), 'Truck → Room → Box');
  assert.equal(context.originalLocation(row('a', null, { deletedLocation: { roomName: 'Room' } })), 'Room');
  assert.equal(context.originalLocation(row('a')), 'Original location unavailable');
});
test('initial focus loads once; refocus reloads; rendered cards use distinct deleted IDs', async () => {
  const h = harness(); h.render(); assert.equal(h.calls(), 0);
  h.read(async () => [row('a', null), row('b', '2026-02-01'), row('active', null, { isDeleted: false })]);
  h.focus(); await tick(); const view = h.render();
  assert.equal(h.calls(), 1);
  assert.deepEqual(nodes(view).filter(n => n.type === 'Card').map(n => n.props.key), ['b', 'a']);
  assert.match(text(view), /Deletion date unavailable/); assert.match(text(view), /Showing deleted gear saved on this device/);
  h.blur(); h.focus(); await tick(); assert.equal(h.calls(), 2);
});
test('stale response after refocus and response after unmount cannot replace current state', async () => {
  const h = harness(); h.render(); let resolve;
  h.read(() => new Promise(done => { resolve = done; })); h.focus(); h.blur();
  h.read(async () => [row('new', null)]); h.focus(); await tick();
  resolve([row('old', null)]); await tick();
  assert.deepEqual(nodes(h.render()).filter(n => n.type === 'Card').map(n => n.props.key), ['new']);
  h.blur(); h.read(() => new Promise(done => { resolve = done; })); h.focus(); h.blur();
  const before = text(h.render()); resolve([row('late', null)]); await tick(); assert.equal(text(h.render()), before);
});
test('empty, loading and error/retry states render; no unrelated mutations are offered', async () => {
  const h = harness(); h.render(); h.focus(); assert.ok(nodes(h.render()).some(n => n.type === 'Spinner'));
  await tick(); assert.match(text(h.render()), /No Recently Deleted Gear/);
  h.blur(); h.read(async () => { throw Error('failed'); }); h.focus(); await tick();
  const view = h.render(); assert.match(text(view), /Unable to load recently deleted gear/);
  assert.equal(nodes(view).filter(n => n.type === 'Button').length, 1);
  assert.match(text(view), /Retry/);
  assert.doesNotMatch(source, /updateItem|deleteItem|upload|downloadPhoto|recoverMissing|onSnapshot|setInterval/);
  assert.equal(nodes(view).find(n => n.type === 'Header').props.showBackButton, true);
});

test('four visible tabs retain labels and Profile owns the nested routes', () => {
  const file = 'app/(tabs)/_layout.tsx';
  const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visible = [];
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'Tabs.Screen' && !/href:\s*null/.test(node.getText(tree))) {
      const name = node.attributes.properties.find(p => p.name?.text === 'name').initializer.text;
      const title = node.getText(tree).match(/title: "([^"]+)"/)[1];
      visible.push([name, title]);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.deepEqual(visible, [['index', 'Dashboard'], ['inventory', 'Inventory'], ['checklists', 'Checklists'], ['(profile)', 'Profile']]);
  const directory = 'app/(tabs)/(profile)';
  assert.deepEqual(fs.readdirSync(directory).sort(), ['_layout.tsx', 'profile.tsx', 'recently-deleted.tsx']);
  const layout = fs.readFileSync(`${directory}/_layout.tsx`, 'utf8');
  assert.match(layout, /unstable_settings = \{ initialRouteName: "profile" \}/);
  assert.match(layout, /<Stack initialRouteName="profile"/);
  // Group segments do not contribute to the public URL.
  for (const name of ['profile', 'recently-deleted']) {
    assert.equal(`${directory}/${name}`.replace(/^app/, '').replace(/\/\([^/]+\)/g, ''), `/${name}`);
  }
  assert.equal(fs.existsSync('app/recently-deleted.tsx'), false);
  assert.equal(fs.existsSync('app/(tabs)/profile.tsx'), false);
  const header = fs.readFileSync('components/ui/AppHeader.tsx', 'utf8');
  assert.match(header, /router.back\(\)/);
  assert.match(source, /<AppHeader title="Recently Deleted" showBackButton \/>/);
});

for (const [name, read, expected] of [
  ['online', async () => ({ isConnected: true, isInternetReachable: true }), false],
  ['unknown', async () => ({ isConnected: null, isInternetReachable: null }), false],
  ['unknown reachability', async () => ({ isConnected: true, isInternetReachable: null }), false],
  ['failed check', async () => { throw Error('unavailable'); }, false],
  ['disconnected', async () => ({ isConnected: false, isInternetReachable: null }), true],
  ['unreachable', async () => ({ isConnected: true, isInternetReachable: false }), true],
]) {
  test(`connectivity notice: ${name}`, async () => {
    const h = harness(read); h.render(); h.focus(); await tick();
    const rendered = text(h.render());
    assert.equal(rendered.includes('Showing deleted gear saved on this device.'), expected);
    assert.doesNotMatch(rendered, /If a connection is unavailable/);
  });
}


test('Restore is visible online, synchronously locks repeated taps, reloads only on success', async () => {
  let finish, calls = 0;
  const h = harness(async () => ({ isConnected: true, isInternetReachable: true }), () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  h.render(); h.read(async () => [row('a', null)]); h.focus(); await tick();
  const button = nodes(h.render()).find(n => n.type === 'Button');
  assert.equal(text(button), 'Restore'); assert.equal(button.props.disabled, false);
  button.props.onPress(); button.props.onPress(); assert.equal(calls, 1);
  assert.match(text(h.render()), /Restoring/);
  assert.equal(nodes(h.render()).filter(n => n.type === 'Card').length, 1);
  finish({ cacheUpdated: true }); await tick();
  assert.equal(h.alerts[0][0], 'Item restored');
  h.render(); h.blur(); h.read(async () => []); h.focus(); await tick();
  assert.match(text(h.render()), /No Recently Deleted Gear/);
});

test('known offline disables Restore without invoking service', async () => {
  let calls = 0;
  const h = harness(async () => ({ isConnected: false }), async () => { calls++; });
  h.render(); h.read(async () => [row('a', null)]); h.focus(); await tick();
  const button = nodes(h.render()).find(n => n.type === 'Button');
  assert.equal(button.props.disabled, true); button.props.onPress(); await tick(); assert.equal(calls, 0);
});

for (const code of ['NEW_DESTINATION_REQUIRED', 'unavailable']) {
  test(`failed restore keeps card and provides guidance: ${code}`, async () => {
    const h = harness(async () => ({ isConnected: true, isInternetReachable: true }), async () => { throw { code }; });
    h.render(); h.read(async () => [row('a', null)]); h.focus(); await tick();
    nodes(h.render()).find(n => n.type === 'Button').props.onPress(); await tick();
    assert.equal(nodes(h.render()).filter(n => n.type === 'Card').length, 1);
    assert.equal(h.calls(), 1);
    if (code === 'NEW_DESTINATION_REQUIRED') {
      assert.ok(nodes(h.render()).some(n => n.type === 'Modal'));
      assert.match(text(h.render()), /Choose a location for this item/);
    } else assert.equal(h.alerts[0][0], 'Restore unavailable');
  });
}


test('Restore, restoring and Retry labels are Text children rather than raw pressable strings', async () => {
  let finish;
  const h = harness(async () => ({ isConnected: true, isInternetReachable: true }), () => new Promise(resolve => { finish = resolve; }));
  h.render(); h.read(async () => [row('a', null)]); h.focus(); await tick();
  function checkLabel(expected) {
    const button = nodes(h.render()).find(n => n.type === 'Button');
    assert.ok(button);
    const children = button.children.flat().filter(x => x !== null && x !== undefined && x !== false);
    assert.equal(children.length, 1);
    assert.equal(children[0].type, 'Text');
    assert.equal(text(children[0]), expected);
    return button;
  }
  checkLabel('Restore').props.onPress(); checkLabel('Restoring…');
  finish({ cacheUpdated: true }); await tick();
  h.blur(); h.read(async () => { throw Error('read failed'); }); h.focus(); await tick();
  checkLabel('Retry');
});


test('Restore remains a content-sized right-aligned action with a comfortable touch target', async () => {
  const h = harness(async () => ({ isConnected: true, isInternetReachable: true }));
  h.render(); h.read(async () => [row('a', null)]); h.focus(); await tick();
  const view = h.render();
  const button = nodes(view).find(n => n.type === 'Button');
  const parent = nodes(view).find(n => n.children.includes(button));
  assert.equal(parent.type, 'View');
  assert.equal(parent.props.style.flexDirection, 'row');
  assert.equal(parent.props.style.justifyContent, 'flex-end');
  assert.equal(button.props.style.minHeight, 44);
  assert.ok(button.props.style.paddingHorizontal >= 16);
  assert.equal(button.props.style.width, undefined);
  assert.equal(button.props.style.flex, undefined);
  assert.equal(button.props.style.flexGrow, undefined);
  assert.equal(text(button), 'Restore');
});

function pickerHarness(outcome = async () => ({ cacheUpdated: true })) {
  const calls = []; let loads = 0;
  const hierarchy = {
    getStorageSpaces: async () => { loads++; return [{ id: 'v', name: 'Same' }, { id: 'v2', name: 'Same' }, { id: 'archived', isArchived: true }, { id: 'offline-storage-1' }]; },
    getCompartmentsByVehicle: async vehicleId => [{ id: 'c', name: 'Same', vehicleId, roomId: 'r' }, { id: 'c2', name: 'Same', vehicleId, roomId: null }, { id: 'bad', vehicleId, roomId: 'missing' }, { id: 'arch', vehicleId, roomId: 'archived' }, { id: 'offline-compartment-1', vehicleId }, { id: 'wrong', vehicleId: 'other' }],
    getRoomsByStorageSpace: async storageSpaceId => [{ id: 'r', name: 'Room', storageSpaceId }, { id: 'archived', name: 'Hidden', storageSpaceId, isArchived: true }],
  };
  const h = harness(async () => ({ isConnected: true, isInternetReachable: true }), async (id, dest) => {
    calls.push({ id, dest }); if (!dest) throw { code: 'NEW_DESTINATION_REQUIRED' }; return outcome();
  }, hierarchy);
  const modal = () => nodes(h.render()).find(n => n.type === 'Modal');
  const choices = () => nodes(modal()).filter(n => n.type === 'Pressable' && n.props.accessibilityRole === 'button');
  const confirm = () => nodes(modal()).find(n => n.type === 'Button');
  return { ...h, modal, choices, confirm, restoreCalls: calls, loads: () => loads,
    async open() { h.render(); h.read(async () => [row('item', null)]); h.focus(); await tick(); nodes(h.render()).find(n => n.type === 'Button').props.onPress(); await tick(); },
    async select() { choices().find(n => n.props.key === 'v').props.onPress(); await tick(); choices().find(n => n.props.key === 'c').props.onPress(); },
  };
}
test('picker opens only after original restore fails; filters invalid options, keeps same-name IDs and Cancel performs no mutation', async () => {
  const h = pickerHarness(); await h.open();
  assert.equal(h.restoreCalls.length, 1); assert.equal(h.restoreCalls[0].dest, undefined);
  assert.deepEqual(h.choices().map(n => n.props.key), ['v', 'v2']); assert.equal(h.confirm().props.disabled, true);
  await h.select(); assert.deepEqual(h.choices().map(n => n.props.key), ['v', 'v2', 'c', 'c2']);
  assert.match(text(h.modal()), /Room → Same/); assert.equal(h.confirm().props.disabled, false);
  h.choices().find(n => n.props.key === 'v2').props.onPress(); await tick(); assert.equal(h.confirm().props.disabled, true);
  nodes(h.modal()).find(n => n.type === 'Pressable' && text(n) === 'Cancel').props.onPress();
  assert.equal(h.modal(), undefined); assert.equal(h.restoreCalls.length, 1);
});
test('explicit confirmation forwards exact IDs, locks repeated taps, closes picker on success', async () => {
  let finish; const h = pickerHarness(() => new Promise(resolve => { finish = resolve; })); await h.open(); await h.select();
  const button = h.confirm(); button.props.onPress(); button.props.onPress();
  assert.equal(h.restoreCalls.length, 2); assert.deepEqual(JSON.parse(JSON.stringify(h.restoreCalls[1])), { id: 'item', dest: { vehicleId: 'v', compartmentId: 'c', roomId: 'r' } });
  assert.equal(h.confirm().props.disabled, true); assert.match(text(h.confirm()), /Restoring/);
  finish({ cacheUpdated: true }); await tick(); assert.equal(h.modal(), undefined); assert.equal(h.alerts[0][0], 'Item restored');
  h.render(); h.blur(); h.read(async () => []); h.focus(); await tick(); assert.match(text(h.render()), /No Recently Deleted Gear/);
});
test('stale selection clears and reloads; network failure preserves selected IDs', async () => {
  for (const code of ['NEW_DESTINATION_REQUIRED', 'unavailable']) {
    const h = pickerHarness(async () => { throw { code }; }); await h.open(); await h.select();
    h.confirm().props.onPress(); await tick();
    assert.ok(h.modal()); assert.equal(nodes(h.render()).filter(n => n.type === 'Card').length, 1);
    if (code === 'NEW_DESTINATION_REQUIRED') {
      assert.equal(h.loads(), 2); assert.equal(h.confirm().props.disabled, true);
      assert.match(text(h.modal()), /That location changed or is no longer available/);
      assert.equal(h.choices().some(n => n.props.accessibilityState.selected), false);
    } else {
      assert.equal(h.loads(), 1); assert.equal(h.confirm().props.disabled, false);
      assert.equal(h.choices().find(n => n.props.key === 'c').props.accessibilityState.selected, true);
      assert.match(h.alerts[0][1], /connection/);
    }
  }
});

async function deletionHarness(remove = async () => ({ itemDeleted: true, cacheUpdated: true, photoCleanup: 'retained_unverified' }), restore) {
  const calls = [];
  const h = harness(async () => ({ isConnected: true, isInternetReachable: true }), restore,
    { permanentlyDeleteDeletedItem: async id => { calls.push(id); return remove(id); } });
  h.render(); h.read(async () => [row('item', null)]); h.focus(); await tick();
  return { ...h, deleteCalls: calls,
    deleteButton: () => nodes(h.render()).find(n => n.type === 'Pressable' && text(n) === 'Delete Permanently'),
    restoreButton: () => nodes(h.render()).find(n => n.type === 'Button' && text(n) === 'Restore'),
  };
}
test('permanent deletion exposes compact action and requires destructive confirmation; Cancel does nothing', async () => {
  const h = await deletionHarness(); assert.ok(h.restoreButton());
  const button = h.deleteButton(); assert.equal(button.props.style.minHeight, 44); assert.equal(button.props.style.width, undefined);
  button.props.onPress(); assert.equal(h.deleteCalls.length, 0);
  const [title, message, buttons] = h.alerts[0];
  assert.equal(title, 'Delete Permanently?'); assert.equal(message, 'Permanently delete this item? This cannot be undone.');
  assert.equal(buttons[0].style, 'cancel'); assert.equal(buttons[0].onPress, undefined); assert.equal(buttons[1].style, 'destructive');
  assert.equal(h.deleteCalls.length, 0);
});
for (const photoCleanup of ['complete', 'retained_shared', 'retained_unverified']) test(`confirmed deletion refreshes and treats ${photoCleanup} as success`, async () => {
  const h = await deletionHarness(async () => ({ itemDeleted: true, cacheUpdated: true, photoCleanup }));
  h.deleteButton().props.onPress(); h.alerts[0][2][1].onPress(); await tick();
  assert.deepEqual(h.deleteCalls, ['item']); assert.equal(h.alerts[1][0], 'Item permanently deleted');
  assert.equal(nodes(h.render()).filter(n => n.type === 'Card' && n.props.key === 'item').length, 0);
  h.read(async () => []); h.focus(); await tick(); assert.equal(h.calls(), 2);
});
test('delete lock synchronously blocks repeated confirmation and Restore; both actions disabled', async () => {
  let done, restores = 0;
  const h = await deletionHarness(() => new Promise(resolve => { done = resolve; }), async () => { restores++; });
  const restore = h.restoreButton(); h.deleteButton().props.onPress();
  const confirm = h.alerts[0][2][1].onPress; confirm(); confirm(); restore.props.onPress();
  assert.equal(h.deleteCalls.length, 1); assert.equal(restores, 0);
  assert.equal(h.restoreButton().props.disabled, true);
  const deleting = nodes(h.render()).find(n => n.type === 'Pressable' && text(n) === 'Deleting…'); assert.equal(deleting.props.disabled, true);
  done({ itemDeleted: true, cacheUpdated: true, photoCleanup: 'retained_unverified' }); await tick();
});
test('Restore lock blocks an already-open delete confirmation', async () => {
  let done;
  const h = await deletionHarness(undefined, () => new Promise(resolve => { done = resolve; }));
  h.deleteButton().props.onPress(); h.restoreButton().props.onPress(); h.alerts[0][2][1].onPress();
  assert.equal(h.deleteCalls.length, 0); assert.equal(h.deleteButton().props.disabled, true);
  done({ cacheUpdated: true }); await tick();
});
for (const [code, message] of [
  ['CONNECT_REQUIRED', 'Connect to permanently delete an item.'],
  ['SYNC_REQUIRED', 'Let pending inventory changes finish syncing, then try again.'],
  ['ITEM_NOT_FOUND', 'This item is no longer available. Reload Recently Deleted.'],
  ['NOT_DELETED', 'This item is active and cannot be deleted here. Reload Recently Deleted.'],
  ['UNAUTHENTICATED', 'Sign in again to permanently delete this item.'],
  ['INVALID_ITEM_ID', 'This item cannot be deleted here. Reload Recently Deleted.'],
]) test(`permanent deletion maps ${code} and retains failed card`, async () => {
  const h = await deletionHarness(async () => { throw { code }; });
  h.deleteButton().props.onPress(); h.alerts[0][2][1].onPress(); await tick();
  assert.equal(h.alerts[1][0], 'Delete unavailable'); assert.equal(h.alerts[1][1], message);
  assert.ok(nodes(h.render()).find(n => n.type === 'Card' && n.props.key === 'item')); assert.equal(h.deleteButton().props.disabled, false);
});
test('cache failure after document deletion is a success with refresh guidance', async () => {
  const h = await deletionHarness(async () => ({ itemDeleted: true, cacheUpdated: false, photoCleanup: 'retained_unverified' }));
  h.deleteButton().props.onPress(); h.alerts[0][2][1].onPress(); await tick();
  assert.equal(h.alerts[1][0], 'Item permanently deleted'); assert.match(h.alerts[1][1], /Local data could not refresh/);
});
