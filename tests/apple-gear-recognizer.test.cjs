const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function wrapper(load) {
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
  return async () => JSON.parse(JSON.stringify(await exports.getAvailability()));
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
