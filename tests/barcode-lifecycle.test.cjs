const { test } = require('node:test');
const assert = require('node:assert/strict');
// Reuse the existing review harness; importing also runs the AI regression suite.
const { harness, barcodePhoto } = require('./ai-duplicates.test.cjs');
async function selectLocation(h) {
  await h.press('Select a storage space first.⌄'); await h.press('Garage');
  await h.press('Select a compartment first.⌄'); await h.press('Tool Chest');
}
for (const [label, found] of [['recognized', true], ['unknown', false], ['provider failure (found=false)', false]]) {
  test(`barcode ${label}: review has no legacy reads or writes`, async () => {
    const h = harness({ ai: false, found }); await h.settle();
    assert.equal(h.calls.legacyReads.length + h.calls.drafts.length + h.calls.creates.length, 0);
    assert.ok(h.nodes().some(n => n.type === 'TextInput' && n.props.value === (found ? 'Cordless Drill' : 'Unidentified Item')));
    assert.equal(h.calls.reads.length, 1);
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

// Phase 2: optional camera photo and explicit-save ownership.
test('catalog URL wins without capture; missing/invalid image captures once', async () => {
  let captures = 0;
  const capture = async () => { captures++; return { uri: 'file:///cache/Camera/new.jpg' }; };
  const catalog = await barcodePhoto.selectBarcodePhoto('https://example.com/product.jpg', capture);
  assert.equal(catalog.fallback, false); assert.equal(captures, 0);
  assert.equal(catalog.image, 'https://example.com/product.jpg');
  for (const absent of [null, '', 'not a URL']) {
    const result = await barcodePhoto.selectBarcodePhoto(absent, capture);
    assert.equal(result.fallback, true); assert.equal(result.image, 'file:///cache/Camera/new.jpg');
  }
  assert.equal(captures, 3);
});
test('capture rejection still permits review and save without a photo', async () => {
  const result = await barcodePhoto.selectBarcodePhoto(null, async () => { throw Error('camera failure'); });
  assert.equal(result.image, ''); assert.equal(result.fallback, false);
  const h = harness({ ai: false, photo: result.image }); await h.settle(); await selectLocation(h);
  await h.press('Save'); assert.equal(h.calls.creates.length, 1); assert.equal(h.calls.creates[0].itemPhotoUri, '');
});
for (const action of ['Cancel', 'Back']) test(`fallback review ${action} deletes only owned temporary photo`, async () => {
  const h = harness({ ai: false, fallback: true }); await h.settle();
  assert.ok(h.nodes().some(n => n.type === 'Image' && n.props.source?.uri === 'file:///cache/Camera/new.jpg'));
  assert.equal(h.calls.creates.length + h.calls.drafts.length, 0);
  if (action === 'Cancel') await h.press('Cancel'); else h.remove();
  assert.deepEqual(h.calls.deletes, ['file:///cache/Camera/new.jpg']);
  assert.equal(h.calls.creates.length, 0);
});
test('fallback copied before creation, repeated Save creates once, temporary removed', async () => {
  const h = harness({ ai: false, fallback: true }); await h.settle(); await selectLocation(h);
  const save = h.nodes().find(n => n.props.onPress && h.text(n).trim() === 'Save');
  await Promise.all([save.props.onPress(), save.props.onPress()]); await save.props.onPress();
  assert.deepEqual(h.calls.order, ['copy', 'create']);
  assert.equal(h.calls.creates.length, 1); assert.equal(h.calls.creates[0].itemPhotoUri, 'file:///documents/new.jpg');
  assert.deepEqual(h.calls.deletes, ['file:///cache/Camera/new.jpg']);
});
test('photo persistence failure prevents write; later retry can succeed', async () => {
  const h = harness({ ai: false, fallback: true, copyFailures: 1 }); await h.settle(); await selectLocation(h);
  await h.press('Save'); assert.equal(h.calls.creates.length, 0);
  await h.press('Save'); assert.equal(h.calls.creates.length, 1);
});
test('uncertain fallback inventory write is not blindly repeated or its photo deleted', async () => {
  const h = harness({ ai: false, fallback: true, saveFailures: 1 }); await h.settle(); await selectLocation(h);
  await h.press('Save'); await h.press('Save');
  assert.equal(h.calls.saveAttempts.length, 1);
  await h.press('Cancel'); assert.deepEqual(h.calls.deletes, ['file:///cache/Camera/new.jpg']);
});
test('catalog and unrelated local photos are never deleted as owned fallback files', async () => {
  for (const photo of ['https://example.com/image.jpg', 'file:///documents/existing.jpg']) {
    const h = harness({ ai: false, fallback: true, photo }); await h.settle(); await h.press('Cancel');
    assert.equal(h.calls.deletes.length, 0);
  }
});
test('fallback scanner branch excludes WMG QR and AI; capture precedes camera shutdown', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../app/scan-item.tsx'), 'utf8');
  assert.match(source, /const photo = !isAiMode && !isWmgQr/);
  const capture = source.indexOf('? await selectBarcodePhoto');
  assert.ok(capture > source.indexOf('const result') || capture > source.indexOf('result = await resolveBarcode'));
  assert.ok(source.indexOf('setCameraActive(false)', capture) > capture);
  assert.match(source, /barcodeFallbackPhoto: photo.fallback/);
  const transfer = source.indexOf('barcodePhotoRef.current = null;', capture);
  const navigation = source.indexOf('router.replace({', capture);
  assert.ok(transfer > capture && transfer < navigation, 'transfer ownership before navigation/blur');
  assert.doesNotMatch(source.slice(source.indexOf('const handleAnalyzeImageWithAI'), source.indexOf('// permission handling')), /barcodePhotoRef/);
});

// Render the actual footer JSX in isolation; no native camera or network required.
test('scanner footer offers manual AI capture only in dedicated AI mode', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const ts = require('typescript');
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '../app/scan-item.tsx'), 'utf8');
  const start = source.indexOf('<View style={styles.footer}>');
  const end = source.indexOf('</View>', start) + '</View>'.length;
  const jsx = source.slice(start, end);
  const code = ts.transpileModule(`globalThis.rendered = (${jsx});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  for (const isAiMode of [false, true]) {
    const aiAction = () => {};
    const context = {
      React: { createElement: (type, props, ...children) => ({ type, props, children }) },
      View: 'View', Text: 'Text', HapticPressable: 'Button', styles: {},
      isAiMode, arOverlay: null, isScanning: false, barcodeProcessing: false,
      handleAnalyzeImageWithAI: aiAction, setArLabels() {}, router: { back() {} },
    };
    vm.runInNewContext(code, context);
    const buttons = context.rendered.children.filter(child => child && child.type === 'Button');
    assert.equal(buttons.filter(button => button.props.onPress === aiAction).length, isAiMode ? 1 : 0);
    assert.equal(buttons.length, isAiMode ? 2 : 1); // Close stays available in both modes.
  }
  assert.match(source, /const isAiMode = String\(mode \?\? ""\) === "ai"/);
  assert.match(source, /onBarcodeScanned=\{async \(event\) =>/);
  assert.match(source, /if \(!isAiMode\) return;[\s\S]*?setTimeout\(\(\) => \{\s*void handleAnalyzeImageWithAI\(\);\s*\}, 2500\)/);
  const dashboard = fs.readFileSync(path.join(__dirname, '../app/(tabs)/index.tsx'), 'utf8');
  assert.match(dashboard, /pathname: "\/scan-item",\s*params: \{ mode: "ai" \}/);
});

// Phase 3: barcode identity and advisory do not change creation/photo ownership.
for (const found of [true, false]) test(`exact barcode advisory works with catalog found=${found}`, async () => {
  const existing = { id: 'existing', name: 'Different name', barcode: '0036000291452', barcodeType: 'ean13', vehicleId: 'actual-space', compartmentId: 'actual-box', itemPhotoUri: 'file:///existing.jpg' };
  const h = harness({ ai: false, found, fallback: true, items: [existing, { id: 'name-only', name: 'Cordless Drill' }] });
  await h.settle();
  assert.match(h.text(), /Same barcode in inventory: 1/);
  await h.press('View existing item in compartment');
  const route = h.calls.pushes[0];
  assert.equal(route.params.vehicleId, 'actual-space'); assert.equal(route.params.compartmentId, 'actual-box');
  assert.equal(route.params.focusItemId, 'existing'); assert.equal(route.params.duplicateInspection, 'true');
  await h.settle(); // Retained component, as with push/pop; native Back still needs device verification.
  assert.equal(h.calls.deletes.length + h.calls.creates.length + h.calls.copies.length, 0);
  assert.ok(h.nodes().some(n => n.type === 'Image' && n.props.source?.uri === 'file:///cache/Camera/new.jpg'));
  await selectLocation(h); await h.press('Save');
  assert.equal(h.calls.creates.length, 1);
  assert.equal(h.calls.creates[0].barcode, '00036000291452'); assert.equal(h.calls.creates[0].barcodeType, 'upc_a');
  assert.equal(h.calls.creates[0].itemPhotoUri, 'file:///documents/new.jpg');
  assert.equal(existing.itemPhotoUri, 'file:///existing.jpg');
});
test('barcode name fallback counts all matches, edits locally, keeps unsaved review across push', async () => {
  const items = Array.from({ length: 5 }, (_, i) => ({ id: String(i), name: 'Cordless Drill', vehicleId: 'garage', compartmentId: 'tools' }));
  const h = harness({ ai: false, fallback: true, items }); await h.settle();
  assert.match(h.text(), /Possible duplicate by name: 5/); assert.match(h.text(), /Plus 2 more/);
  await h.edit('Drill'); await h.press('View existing item in compartment'); await h.settle();
  assert.ok(h.nodes().some(n => n.type === 'TextInput' && n.props.value === 'Drill'));
  assert.equal(h.calls.reads.length, 1); assert.equal(h.calls.deletes.length, 0);
  await h.press('Cancel'); assert.equal(h.calls.creates.length, 0);
});
test('barcode duplicate lookup failure does not block explicit Save', async () => {
  const h = harness({ ai: false, fail: true }); await h.settle();
  assert.match(h.text(), /Couldn't check inventory/); await selectLocation(h); await h.press('Save');
  assert.equal(h.calls.creates.length, 1);
});
test('commercial camera route forwards decoded code and observed type without altering resolver input', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../app/scan-item.tsx'), 'utf8');
  assert.match(source, /const value = event\?\.data/);
  assert.match(source, /resolveBarcode\(value\)/);
  assert.match(source, /code: result.barcode,\s*barcodeType: !isAiMode && !isWmgQr \? event.type : ""/);
});
