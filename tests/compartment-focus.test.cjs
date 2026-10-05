const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const path = 'app/(tabs)/vehicles/[vehicleId]/compartments/[compartmentId].tsx';
const source = fs.readFileSync(path, 'utf8');
const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const focusCalls = [];
const effects = [];
let loadItems;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useFocusEffect') focusCalls.push(node.getText(ast));
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') effects.push(node.getText(ast));
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'loadItems') loadItems = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);

function harness(inspection = false) {
  assert.equal(focusCalls.length, 1);
  // There must not also be a mount effect starting a second initial load.
  assert.ok(effects.every((effect) => !/\bloadItems\(/.test(effect)));
  let focus;
  let cleanup;
  let items = [];
  let quantity = 9;
  let read = async () => [{ id: 'linked', quantity }];
  const calls = [];
  const context = {
    compartmentId: 'A', isDuplicateInspection: inspection,
    screenFocusedRef: { current: false }, positionsCompartmentRef: { current: 'A' }, itemCardYPositions: { current: {} }, clearFoundFocus: () => {},
    isMountedRef: { current: true }, loadVersionRef: { current: 0 },
    useCallback: (fn, deps) => { assert.deepEqual(Array.from(deps), ['A', inspection]); return fn; },
    useFocusEffect: (fn) => { focus = fn; },
    loadCompartment: async () => {}, setCompartment: () => {},
    getItemsByCompartment: async (id, options) => { calls.push({ id, ...options }); return read(); },
    setItems: (value) => { items = value; }, console,
  };
  vm.runInNewContext(ts.transpileModule(`${loadItems}\n${focusCalls[0]}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return {
    calls, context, items: () => items,
    focus: () => { cleanup = focus(); }, blur: () => cleanup?.(),
    quantity: (value) => { quantity = value; }, read: (fn) => { read = fn; },
  };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

for (const inspection of [false, true]) {
  test(`initial load and retained-screen refocus replace stale quantity (inspection=${inspection})`, async () => {
    const h = harness(inspection);
    h.focus(); await settle();
    assert.equal(h.calls.length, 1);
    assert.equal(h.items()[0].quantity, 9);
    h.blur(); h.quantity(8);
    assert.equal(h.items()[0].quantity, 9);
    h.focus(); await settle();
    assert.equal(h.calls.length, 2);
    assert.equal(h.items()[0].quantity, 8);
    assert.deepEqual(h.calls, [
      { id: 'A', recoverPhotos: !inspection },
      { id: 'A', recoverPhotos: !inspection },
    ]);
  });
}

test('blur invalidates an older pending load so it cannot overwrite refreshed data', async () => {
  const h = harness();
  let resolveOld;
  h.read(() => new Promise((resolve) => { resolveOld = resolve; }));
  h.focus(); h.blur();
  h.read(async () => [{ id: 'linked', quantity: 8 }]);
  h.focus(); await settle();
  resolveOld([{ id: 'linked', quantity: 9 }]); await settle();
  assert.equal(h.items()[0].quantity, 8);
});

test('unmounted screen ignores pending inventory result', async () => {
  const h = harness();
  let resolve;
  h.read(() => new Promise((done) => { resolve = done; }));
  h.focus(); h.context.isMountedRef.current = false; h.blur();
  resolve([{ id: 'linked', quantity: 9 }]); await settle();
  assert.equal(h.items().length, 0);
});
