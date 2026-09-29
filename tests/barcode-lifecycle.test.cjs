const { test } = require('node:test');
const assert = require('node:assert/strict');
// Reuse the existing review harness; importing also runs the AI regression suite.
const { harness } = require('./ai-duplicates.test.cjs');
async function selectLocation(h) {
  await h.press('Select a storage space first.⌄'); await h.press('Garage');
  await h.press('Select a compartment first.⌄'); await h.press('Tool Chest');
}
for (const [label, found] of [['recognized', true], ['unknown', false], ['provider failure (found=false)', false]]) {
  test(`barcode ${label}: review has no legacy reads or writes`, async () => {
    const h = harness({ ai: false, found }); await h.settle();
    assert.equal(h.calls.legacyReads.length + h.calls.drafts.length + h.calls.creates.length, 0);
    assert.ok(h.nodes().some(n => n.type === 'TextInput' && n.props.value === (found ? 'Cordless Drill' : 'Unidentified Item')));
    assert.equal(h.calls.reads.length, 0);
  });
}
for (const action of ['Cancel', 'Back']) test(`barcode ${action} creates nothing`, async () => {
  const h = harness({ ai: false }); await h.settle();
  if (action === 'Cancel') await h.press('Cancel'); else h.remove();
  assert.equal(h.calls.creates.length + h.calls.drafts.length + h.calls.copies.length, 0);
});
test('barcode Save, concurrent taps, and later taps create only one item', async () => {
  const h = harness({ ai: false }); await h.settle(); await selectLocation(h);
  const save = h.nodes().find(n => n.props.onPress && h.text(n).trim() === 'Save');
  await Promise.all([save.props.onPress(), save.props.onPress()]);
  await save.props.onPress();
  assert.equal(h.calls.creates.length, 1); assert.equal(h.calls.drafts.length, 0);
  assert.equal(h.calls.creates[0].source, 'scan');
  assert.equal(h.calls.creates[0].compartmentId, 'tools');
});
test('barcode failed Save releases lock for a deliberate retry', async () => {
  const h = harness({ ai: false, saveFailures: 1 }); await h.settle(); await selectLocation(h);
  await h.press('Save'); assert.equal(h.calls.creates.length, 0);
  await h.press('Save'); assert.equal(h.calls.creates.length, 1);
  assert.equal(h.calls.saveAttempts.length, 2);
});
