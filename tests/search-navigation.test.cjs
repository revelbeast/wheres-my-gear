const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness(file, name) {
  const text = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) handler = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(handler);
  const pushes = [];
  const context = {
    isPremium: true,
    router: { push: (route) => pushes.push(JSON.parse(JSON.stringify(route))), replace: () => {} },
    pushWithNavigationLock: (fn) => fn(), runNavigationAction: (fn) => fn(),
    Alert: { alert: () => {} }, handleAssignUnassignedItem: () => {},
  };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { select: context[name], pushes };
}

for (const [screen, file, handler] of [
  ['Dashboard', 'app/(tabs)/index.tsx', 'handleSearchResultPress'],
  ['Inventory', 'app/(tabs)/inventory.tsx', 'handleOpenItem'],
]) {
  test(`${screen} forwards distinct same-name IDs and exact location parameters`, () => {
    const h = harness(file, handler);
    for (const id of ['permanent-A', 'permanent-B', 'offline-item-123-0']) {
      h.select({ type: 'item', id, name: 'Tent', vehicleId: 'space', compartmentId: 'box' });
      assert.deepEqual(h.pushes.at(-1), {
        pathname: '/vehicles/[vehicleId]/compartments/[compartmentId]',
        params: { vehicleId: 'space', compartmentId: 'box', focusItemId: id },
      });
      assert.equal('duplicateInspection' in h.pushes.at(-1).params, false);
    }
    assert.equal(h.pushes.length, 3);
  });
}

test('Dashboard non-item result routes retain their existing parameters', () => {
  const h = harness('app/(tabs)/index.tsx', 'handleSearchResultPress');
  for (const [type, pathname, params] of [
    ['checklistItem', '/checklists/[checklistId]', { checklistId: 'list' }],
    ['checklist', '/checklists/[checklistId]', { checklistId: 'list' }],
    ['templateItem', '/checklists/template-items', { templateId: 'template' }],
    ['storage', '/vehicles/[vehicleId]/compartments', { vehicleId: 'space' }],
    ['room', '/vehicles/[vehicleId]/rooms/[roomId]', { vehicleId: 'space', roomId: 'room' }],
    ['compartment', '/vehicles/[vehicleId]/compartments/[compartmentId]', { vehicleId: 'space', compartmentId: 'box' }],
  ]) {
    h.select({ type, id: 'result', ...params });
    assert.deepEqual(h.pushes.at(-1), { pathname, params });
  }
  assert.equal(h.pushes.length, 6);
});
