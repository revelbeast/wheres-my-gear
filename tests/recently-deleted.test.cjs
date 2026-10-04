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
function harness(connectivity = async () => ({ isConnected: false })) {
  let slots = [], index = 0, focus, cleanup, calls = 0;
  let read = async () => [];
  const refs = [];
  let refIndex = 0;
  const createElement = (type, props, ...children) => ({ type, props: props ?? {}, children });
  const react = { createElement, useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; }, useRef(initial) { const i = refIndex++; return refs[i] ?? (refs[i] = { current: initial }); }, useCallback: fn => fn };
  const exports = {};
  const mocks = {
    react: { ...react, default: react },
    'expo-router': { useFocusEffect: fn => { focus = fn; } },
    '@react-native-community/netinfo': { default: { fetch: connectivity } },
    'react-native': { ActivityIndicator: 'Spinner', Image: 'Image', ScrollView: 'ScrollView', View: 'View', StyleSheet: { create: x => x } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, 'lucide-react-native': { Image: 'Icon' },
    '../../../components/auth/AuthProvider': { useAuth: () => ({ user: { uid: 'u' } }) },
    '../../../components/ui/AppHeader': { default: 'Header' }, '../../../components/ui/ScreenBackground': { default: 'Background' },
    '../../../components/ui/Themed': { ThemedButton: 'Button', ThemedCard: 'Card', ThemedText: 'Text', useThemedValues: () => ({ colors: { text: 'black' } }) },
    '../../../lib/gearService': { getDeletedItems: async () => { calls++; return read(); } },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: id => { assert.ok(id in mocks, `Unexpected import ${id}`); return mocks[id]; }, Date });
  return { render() { index = 0; refIndex = 0; return exports.default(); }, focus() { cleanup = focus(); }, blur() { cleanup(); }, read(fn) { read = fn; }, calls: () => calls };
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
test('empty, loading and error/retry states render; no Restore or mutations are offered', async () => {
  const h = harness(); h.render(); h.focus(); assert.ok(nodes(h.render()).some(n => n.type === 'Spinner'));
  await tick(); assert.match(text(h.render()), /No Recently Deleted Gear/);
  h.blur(); h.read(async () => { throw Error('failed'); }); h.focus(); await tick();
  const view = h.render(); assert.match(text(view), /Unable to load recently deleted gear/);
  assert.equal(nodes(view).filter(n => n.type === 'Button').length, 1);
  assert.match(text(view), /Retry/);
  assert.doesNotMatch(source, /restoreDeletedItem|updateItem|deleteItem|upload|downloadPhoto|recoverMissing|onSnapshot|setInterval/);
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
