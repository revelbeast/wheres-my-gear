const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function wrapper(load, method = 'getAvailability', args = []) {
  const exports = {};
  const source = fs.readFileSync('lib/appleGearRecognizer.ts', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports,
    require(name) {
      assert.equal(name, 'expo-modules-core');
      return { requireOptionalNativeModule(name) {
        assert.equal(name, 'AppleGearRecognizer');
        return load();
      } };
    },
  });
  return async () => JSON.parse(JSON.stringify(await exports[method](...args)));
}
const unavailable = reason => ({ available: false, vision: false, guidedGeneration: false, reason });

test('missing native module safely returns unavailable', async () => {
  assert.deepEqual(await wrapper(() => null)(), unavailable('native_module_unavailable'));
});
test('available model with both capabilities is preserved', async () => {
  const result = { available: true, vision: true, guidedGeneration: true };
  assert.deepEqual(await wrapper(() => ({ getAvailability: async () => result }))(), result);
});
test('unavailable model reason and reported capabilities are preserved', async () => {
  const result = { available: false, vision: true, guidedGeneration: true, reason: 'model_not_ready' };
  assert.deepEqual(await wrapper(() => ({ getAvailability: async () => result }))(), result);
});
test('malformed or contradictory responses fail safely', async () => {
  for (const result of [null, {}, 'available', { available: true, vision: false, guidedGeneration: true },
    { available: false, vision: false, guidedGeneration: false, reason: 1 }]) {
    assert.deepEqual(await wrapper(() => ({ getAvailability: async () => result }))(), unavailable('invalid_native_response'));
  }
});
test('native rejection and module lookup failure do not escape', async () => {
  assert.deepEqual(await wrapper(() => ({ getAvailability: async () => { throw Error('native'); } }))(), unavailable('native_availability_failed'));
  assert.deepEqual(await wrapper(() => { throw Error('lookup'); })(), unavailable('native_availability_failed'));
});

const recognize = load => wrapper(load, 'recognizeImage', ['file:///tmp/gear.jpg', 'request-1']);
const success = { ok: true, identified: true, itemName: ' Hammer ', brand: null, model: null, description: ' A hammer. ' };
test('recognition normalizes structured strings and preserves nullable fields and request identity', async () => {
  const result = await recognize(() => ({ recognizeImage: async (uri, id) => {
    assert.equal(uri, 'file:///tmp/gear.jpg'); assert.equal(id, 'request-1'); return success;
  } }))();
  assert.deepEqual(result, { ...success, itemName: 'Hammer', description: 'A hammer.' });
});
test('recognition tolerates missing module or older availability-only module', async () => {
  for (const native of [null, {}]) assert.deepEqual(await recognize(() => native)(), { ok: false, reason: 'native_module_unavailable' });
});
test('recognition preserves controlled native failure', async () => {
  const result = { ok: false, reason: 'model_not_ready', message: 'Try later' };
  assert.deepEqual(await recognize(() => ({ recognizeImage: async () => result }))(), result);
});
test('recognition rejects malformed and invalid success payloads', async () => {
  for (const result of [null, {}, 'result', { ...success, itemName: ' ' }, { ...success, brand: 7 },
    { ...success, model: undefined }, { ok: false, reason: '' }]) {
    assert.deepEqual(await recognize(() => ({ recognizeImage: async () => result }))(), { ok: false, reason: 'invalid_native_response' });
  }
});
test('recognition handles native rejection and lookup failure', async () => {
  for (const load of [() => { throw Error('lookup'); }, () => ({ recognizeImage: async () => { throw Error('native'); } })]) {
    assert.deepEqual(await recognize(load)(), { ok: false, reason: 'native_recognition_failed' });
  }
});
test('invalid input never invokes native module', async () => {
  const load = () => { assert.fail('must not load'); };
  assert.deepEqual(await wrapper(load, 'recognizeImage', ['https://example.com/image', 'id'])(), { ok: false, reason: 'invalid_image_uri' });
  assert.deepEqual(await wrapper(load, 'recognizeImage', ['file:///tmp/a.jpg', ' '])(), { ok: false, reason: 'invalid_request_id' });
});
test('unidentified result with null fields remains a successful analysis', async () => {
  const result = { ok: true, identified: false, itemName: null, brand: null, model: null, description: null };
  assert.deepEqual(await recognize(() => ({ recognizeImage: async () => result }))(), result);
});
