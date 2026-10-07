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
  return async () => {
    const value = await exports[method](...args);
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  };
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

test('recognition converts whole-field textual absence markers to null', async () => {
  for (const marker of ['nil', ' NULL ', 'N/A', 'Unknown', 'none', '']) {
    const result = { ...success, brand: marker, model: marker, description: marker };
    assert.deepEqual(await recognize(() => ({ recognizeImage: async () => result }))(),
      { ...success, itemName: 'Hammer', brand: null, model: null, description: null });
  }
});
test('recognition preserves legitimate text containing absence-marker words', async () => {
  const result = { ok: true, identified: true, itemName: 'Vanilla bottle',
    brand: 'None Such', model: 'N/A-42', description: 'Unknown model; visible black handle.' };
  assert.deepEqual(await recognize(() => ({ recognizeImage: async () => result }))(), result);
});
test('absence-marker item names cannot masquerade as identified items', async () => {
  for (const itemName of ['nil', 'null', 'N/A', 'unknown', 'none']) {
    const result = { ...success, itemName };
    assert.deepEqual(await recognize(() => ({ recognizeImage: async () => result }))(),
      { ok: false, reason: 'invalid_native_response' });
  }
  const result = { ...success, identified: false, itemName: 'nil', brand: null, model: null, description: null };
  assert.deepEqual(await recognize(() => ({ recognizeImage: async () => result }))(),
    { ...result, itemName: null });
});

test('native evidence helper enforces conservative brand matching and failure results', () => {
  const { execFileSync } = require('node:child_process');
  const helper = fs.readFileSync('modules/apple-gear-recognizer/ios/AppleGearEvidence.swift', 'utf8');
  const checks = `
func evidence(_ text: String, _ confidence: Float = 0.95) -> [AppleGearEvidence.Observation] {
  [.init(text: text, confidence: confidence)]
}
func accepted(_ proposed: String, _ observed: String, _ confidence: Float = 0.95) -> Bool {
  AppleGearEvidence.acceptedBrand(proposed, observations: evidence(observed, confidence)) != nil
}
precondition(accepted("DEWALT", "DEWALT"))
precondition(accepted("DeWalt", "dewalt"))
precondition(accepted(" Invisible  Glass ", "\\nInvisible\\tGlass  "))
precondition(!accepted("CARPEZETOCH", "EBERLESTOCK"))
precondition(!accepted("MARKLE & CO", "EBERLESTOCK"))
precondition(!accepted("DEWALT", "DEWALT TOOLS"))
precondition(!accepted("DEWALT TOOLS", "DEWALT"))
precondition(!accepted("MARKLE & CO", "MARKLE CO"))
precondition(!accepted("DEWALT", "DEWALT", 0.89))
precondition(accepted("DEWALT", "DEWALT", AppleGearEvidence.minimumBrandOCRConfidence))
precondition(!accepted("DEWALT", "DEWALT", .nan))
precondition(!accepted("DEWALT", "DEWALT", .infinity))
precondition(!accepted("DEWALT", "DEWALT", 1.1))
precondition(!accepted("  ", " "))
precondition(accepted("Café", "Cafe\\u{301}"))
precondition(!accepted("Café", "Cafe"))
precondition(accepted("工具", "工具"))
precondition(!accepted("工具", "工"))
precondition(AppleGearEvidence.acceptedBrand("DEWALT", observations: []) == nil)
precondition(AppleGearEvidence.acceptedBrand(nil, observations: evidence("DEWALT")) == nil)
precondition(AppleGearEvidence.acceptedBrand("Invisible Glass",
  observations: [.init(text: "Invisible", confidence: 1), .init(text: "Glass", confidence: 1)]) == nil)
for observations: [AppleGearEvidence.Observation]? in [nil, [], evidence("DEWALT")] {
  let result = AppleGearEvidence.result(identified: true, itemName: "impact driver",
    proposedBrand: "DEWALT", description: "yellow impact driver", observations: observations)
  precondition(result["ok"] as? Bool == true)
  precondition(result["identified"] as? Bool == true)
  precondition(result["itemName"] as? String == "impact driver")
  precondition(result["description"] as? String == "yellow impact driver")
  precondition(result["model"] is NSNull)
  if observations?.isEmpty != false { precondition(result["brand"] is NSNull) }
  else { precondition(result["brand"] as? String == "DEWALT") }
}
print("Native evidence assertions passed")
`;
  const output = execFileSync('xcrun', ['swift', '-'], {
    input: helper + checks, encoding: 'utf8', timeout: 120000,
  });
  assert.match(output, /Native evidence assertions passed/);
});

test('OCR-filtered success preserves useful recognition fields through the JS wrapper', async () => {
  const result = { ok: true, identified: true, itemName: 'sling bag',
    brand: null, model: null, description: 'green bag with a black zipper' };
  assert.deepEqual(await recognize(() => ({ recognizeImage: async () => result }))(), result);
});

test('native wiring uses one independent OCR pass after generation and suppresses model output', () => {
  const source = fs.readFileSync('modules/apple-gear-recognizer/ios/AppleGearRecognizerModule.swift', 'utf8');
  assert.equal((source.match(/session\.respond\(/g) || []).length, 1);
  assert.equal((source.match(/handler\.perform\(\[request\]\)/g) || []).length, 1);
  assert.ok(source.indexOf('await recognizeText(') > source.indexOf('session.respond('));
  assert.match(source, /request\.recognitionLevel = \.accurate/);
  assert.match(source, /request\.usesLanguageCorrection = false/);
  assert.match(source, /topCandidates\(1\)/);
  assert.match(source, /VNImageRequestHandler\(url: url, orientation: orientation/);
  assert.match(source, /continuation\.resume\(returning: nil\)/);
  assert.doesNotMatch(source, /request\.customWords\s*=/);
  assert.doesNotMatch(source, /clean\(result\.model\)/);
  assert.match(source, /return AppleGearRequestResult/);
});

test('cancellation is safe for absent/old modules, invalid IDs, and native failures', async () => {
  for (const load of [() => null, () => ({}), () => { throw Error('lookup'); },
    () => ({ cancelRecognition: async () => { throw Error('native'); } })]) {
    assert.equal(await wrapper(load, 'cancelRecognition', ['request-1'])(), undefined);
  }
  for (const id of ['', ' ', null, 'x'.repeat(129)]) {
    assert.equal(await wrapper(() => { assert.fail('must not load'); }, 'cancelRecognition', [id])(), undefined);
  }
});
test('cancellation forwards exact IDs and preserves recognition failure reasons', async () => {
  const calls = [];
  const load = () => ({ cancelRecognition: async id => { calls.push(id); } });
  await wrapper(load, 'cancelRecognition', ['request-1'])();
  await wrapper(load, 'cancelRecognition', ['request-1'])();
  assert.deepEqual(calls, ['request-1', 'request-1']);
  for (const reason of ['cancelled', 'timeout']) {
    const result = { ok: false, reason };
    assert.deepEqual(await recognize(() => ({ recognizeImage: async () => result }))(), result);
  }
});

test('native coordinator cancellation, deadlines, OCR settlement, and cleanup', () => {
  const { execFileSync } = require('node:child_process');
  const source = fs.readFileSync('modules/apple-gear-recognizer/ios/AppleGearRequestCoordinator.swift', 'utf8');
  const checks = `
actor Gate {
  var opened = false
  var waiters: [CheckedContinuation<Void, Never>] = []
  func wait() async {
    if opened { return }
    await withCheckedContinuation { waiters.append($0) }
  }
  func open() { opened = true; let all = waiters; waiters = []; all.forEach { $0.resume() } }
}
final class Flag: @unchecked Sendable {
  private let lock = NSLock()
  private var storage = false
  func set() { lock.lock(); storage = true; lock.unlock() }
  var value: Bool { lock.lock(); defer { lock.unlock() }; return storage }
}
let good = AppleGearRequestResult(reason: nil, identified: true, itemName: "bag",
                                  brand: nil, description: "green bag")
func runChecks() async {
  let normal = AppleGearRequestCoordinator()
  let first = await normal.run(id: "normal") { _ in good }
  precondition(first.reason == nil && normal.activeCount == 0)
  precondition(first.dictionary["model"] is NSNull)
  normal.cancel("normal")
  let reused = await normal.run(id: "normal") { _ in fatalError("reused ID ran") }
  precondition(reused.reason == "request_id_reused")
  normal.cancel("early"); normal.cancel("early")
  let early = await normal.run(id: "early") { _ in fatalError("early cancelled operation ran") }
  precondition(early.reason == "cancelled" && normal.activeCount == 0)

  let started = Gate(), release = Gate()
  let settled = Flag(), ocrStarted = Flag()
  let job = Task {
    let result = await normal.run(id: "cancel") { context in
      await started.open()
      await release.wait()
      do { try context.checkCancellation(); ocrStarted.set() }
      catch { return .failure("generation_failed_after_cancel") }
      return good
    }
    settled.set(); return result
  }
  await started.wait()
  let duplicate = await normal.run(id: "cancel") { _ in fatalError("duplicate ran") }
  precondition(duplicate.reason == "duplicate_request_id")
  let busy = await normal.run(id: "other") { _ in fatalError("overlap ran") }
  precondition(busy.reason == "recognition_busy")
  normal.cancel("cancel"); normal.cancel("cancel")
  precondition(!settled.value && normal.activeCount == 1)
  await release.open()
  let cancelled = await job.value
  precondition(cancelled.reason == "cancelled" && !ocrStarted.value && normal.activeCount == 0)

  let newStarted = Gate(), newRelease = Gate()
  let newJob = Task { await normal.run(id: "new") { context in
    await newStarted.open(); await newRelease.wait()
    do { try context.checkCancellation() } catch { return .failure("wrong_cancel") }
    return good
  } }
  await newStarted.wait(); normal.cancel("cancel"); await newRelease.open()
  let newResult = await newJob.value
  precondition(newResult.reason == nil && normal.activeCount == 0)

  for deadlineWins in [false, true] {
    let fire = Gate(), timerStarted = Gate(), visionStarted = Gate(), visionRelease = Gate()
    let visionCancelled = Flag(), done = Flag()
    let coordinator = AppleGearRequestCoordinator(sleepUntilDeadline: { duration in
      precondition(duration == 10_000_000_000)
      await timerStarted.open(); await fire.wait()
    })
    let work = Task {
      let result = await coordinator.run(id: "vision") { context in
        precondition(context.beginVision(cancel: { visionCancelled.set() }))
        await visionStarted.open()
        await visionRelease.wait()
        context.endVision()
        return good
      }
      done.set(); return result
    }
    await timerStarted.wait(); await visionStarted.wait()
    if deadlineWins {
      await fire.open()
      while !visionCancelled.value { await Task.yield() }
      coordinator.cancel("vision")
    } else {
      coordinator.cancel("vision"); await fire.open()
    }
    precondition(visionCancelled.value && !done.value && coordinator.activeCount == 1)
    await visionRelease.open()
    let result = await work.value
    precondition(result.reason == (deadlineWins ? "timeout" : "cancelled"))
    precondition(coordinator.activeCount == 0)
  }

  let timerStarted = Gate(), timerCancelled = Gate()
  let timed = AppleGearRequestCoordinator(sleepUntilDeadline: { duration in
    precondition(duration == 10_000_000_000)
    await timerStarted.open()
    do { try await Task.sleep(nanoseconds: 60_000_000_000) }
    catch { await timerCancelled.open(); throw error }
  })
  let timedResult = await timed.run(id: "fast") { _ in await timerStarted.wait(); return good }
  await timerCancelled.wait()
  precondition(timedResult.reason == nil && timed.activeCount == 0)

  let context = AppleGearRequestContext(id: "finished")
  precondition(context.finish(good).reason == nil)
  context.stop(reason: "timeout")
  do { try context.checkCancellation() } catch { fatalError("late timer changed completion") }
  let beforeVision = AppleGearRequestContext(id: "before-vision")
  beforeVision.stop(reason: "cancelled")
  precondition(!beforeVision.beginVision(cancel: { fatalError("not started") }))
  precondition(beforeVision.finish(good).reason == "cancelled")

  let shutStarted = Gate(), shutRelease = Gate()
  let shut = AppleGearRequestCoordinator()
  let shutJob = Task { await shut.run(id: "shutdown") { _ in
    await shutStarted.open(); await shutRelease.wait(); return good
  } }
  await shutStarted.wait(); shut.shutdown()
  precondition(shut.activeCount == 1)
  await shutRelease.open()
  let shutResult = await shutJob.value
  precondition(shutResult.reason == "cancelled" && shut.activeCount == 0)
  let afterShutdown = await shut.run(id: "later") { _ in fatalError("closed coordinator ran") }
  precondition(afterShutdown.reason == "cancelled")

  let bounded = AppleGearRequestCoordinator(historyLimit: 2)
  bounded.cancel("one"); bounded.cancel("two"); bounded.cancel("three")
  let one = await bounded.run(id: "one") { _ in fatalError("early cancellation lost") }
  let full = await bounded.run(id: "three") { _ in fatalError("overflow ran") }
  precondition(one.reason == "cancelled" && full.reason == "request_history_full")
  precondition(bounded.activeCount == 0)
  print("Native request lifecycle assertions passed")
}
Task { await runChecks(); exit(0) }
dispatchMain()
`;
  const output = execFileSync('xcrun', ['swift', '-'], {
    input: source + checks, encoding: 'utf8', timeout: 120000,
  });
  assert.match(output, /Native request lifecycle assertions passed/);
});

test('recognition wrapper awaits native settlement and preserves timeout and normalization', async () => {
  let settle;
  let done = false;
  const pending = wrapper(() => ({
    recognizeImage: (uri, id) => {
      assert.equal(uri, 'file:///photo.jpg');
      assert.equal(id, 'deadline-id');
      return new Promise(resolve => { settle = resolve; });
    },
  }), 'recognizeImage', ['file:///photo.jpg', 'deadline-id'])().then(result => {
    done = true; return result;
  });
  await Promise.resolve();
  assert.equal(done, false);
  settle({ ok: false, reason: 'timeout' });
  assert.deepEqual(await pending, { ok: false, reason: 'timeout' });
  const success = { ok: true, identified: true, itemName: ' drill ', brand: 'unknown',
    model: null, description: ' tool ' };
  for (const method of ['recognizeImage']) {
    assert.deepEqual(await wrapper(() => ({ [method]: async () => success }),
      method, ['file:///photo.jpg', 'fast'])(),
      { ...success, itemName: 'drill', brand: null, description: 'tool' });
  }
});
