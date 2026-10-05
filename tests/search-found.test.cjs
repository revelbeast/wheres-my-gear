const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = 'app/(tabs)/vehicles/[vehicleId]/compartments/[compartmentId].tsx';
const source = fs.readFileSync(path, 'utf8');
const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = {}, effects = []; let focus;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions[node.name.text] = node.getText(ast);
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') effects.push(node.arguments[0].getText(ast));
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useFocusEffect') focus = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
const requestEffect = effects.find(e => e.includes('const id = params.focusItemId'));
const dataEffect = effects.find(e => e.includes('tryFocusRequestedItem()') && !e.includes('const id'));
const unmountEffect = effects.find(e => e.includes('isMountedRef.current = true'));
function harness(inspection = false) {
  let id = 0, found = null, now = 0, focusHandler;
  const timers = new Map(), scrolls = [], announcements = [], params = [], loads = [];
  const ref = current => ({ current });
  const c = {
    params: {}, compartmentId: 'c', isDuplicateInspection: inspection, items: [],
    pendingFocusRef: ref(null), screenFocusedRef: ref(false), positionsCompartmentRef: ref('c'),
    foundTimerRef: ref(null), foundGenerationRef: ref(0), itemCardScrollTimeoutRef: ref(null),
    createBoxScrollTimeoutRef: ref(null), itemCardYPositions: ref({}), isMountedRef: ref(true),
    loadVersionRef: ref(0), actionLockRef: ref(false),
    scrollRef: ref({ scrollTo: value => scrolls.push(value) }),
    setFoundItemId: value => { found = value; },
    router: { setParams: value => { params.push(value); c.params = { ...c.params, ...value }; } },
    AccessibilityInfo: { announceForAccessibility: message => announcements.push(message) },
    setTimeout: (fn, delay) => { const key = ++id; timers.set(key, { fn, at: now + delay }); return key; },
    clearTimeout: key => timers.delete(key),
    useCallback: fn => fn, useFocusEffect: fn => { focusHandler = fn; },
    loadCompartment: () => loads.push('compartment'), loadItems: () => loads.push('items'), setCompartment() {}, setItems() {},
  };
  vm.createContext(c);
  const code = ['clearFoundFocus', 'tryFocusRequestedItem', 'scrollToItemCard'].map(n => functions[n]).join('\n') + '\n' + focus;
  vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, c);
  const effect = text => vm.runInContext(ts.transpileModule(`(${text})()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, c);
  let cleanup = focusHandler();
  const unmount = effect(unmountEffect);
  return { c, params, loads, scrolls, announcements, found: () => found,
    request(value) { c.params.focusItemId = value; effect(requestEffect); },
    data(items) { c.items = items; effect(dataEffect); },
    layout(itemId, y) { c.itemCardYPositions.current[itemId] = y; c.tryFocusRequestedItem(); },
    blur() { cleanup(); }, refocus() { cleanup = focusHandler(); }, unmount,
    timerCallback: () => timers.get(c.foundTimerRef.current)?.fn,
    advance(ms) { now += ms; for (const [key,timer] of [...timers]) if (timer.at <= now) { timers.delete(key); timer.fn(); } },
  };
}
const items = [{ id: 'a', name: 'Hammer' }, { id: 'b', name: 'Hammer' }];
test('exact ID alone receives Found, scroll and one announcement; expires at 3000ms', () => {
  const h = harness(); h.data(items); h.layout('a', 100); h.layout('b', 500); h.request('b');
  assert.equal(h.found(), 'b'); assert.notEqual(h.found(), 'a'); assert.deepEqual(h.announcements, ['Found Hammer']);
  assert.equal(h.params.length, 1); assert.equal(h.c.params.focusItemId, undefined);
  h.advance(180); assert.equal(h.scrolls[0].y, 482); h.advance(2819); assert.equal(h.found(), 'b'); h.advance(1); assert.equal(h.found(), null);
});
test('delayed data and valid measured layout are both required', () => {
  const h = harness(); h.request('a'); h.layout('a', NaN); h.data(items); assert.equal(h.found(), null);
  h.layout('a', 0); assert.equal(h.found(), 'a');
});
test('layout before data is accepted when data arrives', () => {
  const h = harness(); h.request('a'); h.layout('a', 100); assert.equal(h.found(), null); h.data(items); assert.equal(h.found(), 'a');
});
test('replacement request uses retained positions without another layout; stale timer cannot clear newer state', () => {
  const h = harness(); h.data(items); h.layout('a', 100); h.layout('b', 500); h.request('a'); const stale = h.timerCallback();
  h.advance(1000); h.request('b'); stale(); assert.equal(h.found(), 'b'); h.advance(2000); assert.equal(h.found(), 'b'); h.advance(1000); assert.equal(h.found(), null);
});
test('rerender/data/layout cannot replay a consumed request; new request for same ID works', () => {
  const h = harness(); h.data(items); h.layout('a', 100); h.request('a'); h.request(undefined); h.layout('a', 100); h.data(items);
  assert.equal(h.announcements.length, 1); h.advance(3000); h.request('a'); assert.equal(h.announcements.length, 2);
});
for (const lifecycle of ['blur', 'unmount']) test(`${lifecycle} cancels timers and does not linger on return`, () => {
  const h = harness(); h.data(items); h.layout('a', 100); h.request('a'); const stale = h.timerCallback(); h[lifecycle]();
  if (lifecycle === 'blur') { assert.equal(h.found(), null); h.refocus(); h.data(items); assert.equal(h.found(), null); }
  stale(); h.advance(4000); assert.equal(h.scrolls.length, 0); assert.equal(h.c.pendingFocusRef.current, null);
});
test('compartment change clears pending focus and stale positions', () => {
  const h = harness(); h.request('a'); h.layout('a', 100); h.blur(); h.c.compartmentId = 'other'; h.refocus();
  assert.equal(Object.keys(h.c.itemCardYPositions.current).length, 0); h.data(items); assert.equal(h.found(), null);
});
test('missing ID never falls back to same-name item; ordinary entry never highlights', () => {
  const h = harness(); h.data(items); h.layout('a', 100); assert.equal(h.found(), null); h.request('missing'); assert.equal(h.found(), null); assert.equal(h.announcements.length, 0);
});
test('duplicate inspection still scrolls once but never highlights or announces', () => {
  const h = harness(true); h.data(items); h.layout('b', 500); h.request('b'); h.layout('b', 500); h.advance(180);
  assert.equal(h.scrolls.length, 1); assert.equal(h.found(), null); assert.equal(h.announcements.length, 0); assert.equal(h.params.length, 0);
});
test('presentation introduces no additional inventory load or mutation', () => {
  const h = harness(); h.data(items); h.layout('a', 100); h.request('a'); h.advance(3000);
  assert.deepEqual(h.loads, ['compartment', 'items']); assert.deepEqual(h.c.items, items);
  for (const name of ['clearFoundFocus', 'tryFocusRequestedItem']) assert.doesNotMatch(functions[name], /updateItem|createItem|AsyncStorage|loadItems|loadCompartment/);
});
test('Found border and visible badge are exact-ID conditional overlays on unchanged normal styling', () => {
  assert.match(functions.renderItemCard, /foundItemId === item.id && \{ borderColor: theme.colors.primary, borderWidth: 3 \}/);
  assert.match(functions.renderItemCard, /foundItemId === item.id && \([\s\S]*?✓ Found/);
  assert.match(functions.renderItemCard, /borderColor: packed \? theme.colors.success : theme.colors.border/);
  assert.match(functions.renderItemCard, /tryFocusRequestedItem\(\)/);
});
