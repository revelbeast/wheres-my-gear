const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = 'file:///documents/wmg-siri-gear-cache.json';
const items = [{ id: 'a', name: 'Gear', compartmentName: 'Box', vehicleName: 'Truck' }, { id: 'b', name: 'Other' }];
function setup(storage = new Map(), files = new Map()) {
  const faults = {};
  const filesystem = {
    documentDirectory: 'file:///documents/',
    getInfoAsync: async p => ({ exists: files.has(p) }),
    readAsStringAsync: async p => { if (faults.read) throw Error('read'); return files.get(p); },
    writeAsStringAsync: async (p, v) => { if (faults.pauseWrite) await faults.pauseWrite; if (faults.write) throw Error('write'); files.set(p, v); },
    moveAsync: async ({ from, to }) => { if (faults.move) throw Error('move'); files.set(to, files.get(from)); files.delete(from); },
    deleteAsync: async p => { if (faults.delete) throw Error('delete'); files.delete(p); },
  };
  const asyncStorage = { getItem: async k => storage.get(k) ?? null, setItem: async (k,v) => { if (faults.storage) throw Error('storage'); storage.set(k,v); } };
  function load() {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/siriGearCache.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: id => id === 'expo-file-system/legacy' ? filesystem : { default: asyncStorage } });
    return exports;
  }
  const api = load();
  return { api, load, storage, files, faults, ids: () => files.has(path) ? JSON.parse(files.get(path)).items.map(i => i.id) : [], publish: (data = items) => api.writeSiriGearCache(data, api.beginSiriGearCachePublication('u')) };
}
test('native-compatible active cache, surgical ID suppression, stale snapshots and restart', async () => {
  const h = setup(); await h.api.setSiriGearCacheAccount('u'); await h.publish();
  const cache = JSON.parse(h.files.get(path)); assert.deepEqual(cache.items[0], items[0]); assert.ok(cache.updatedAt);
  const stale = h.api.beginSiriGearCachePublication('u');
  await h.api.suppressSiriGearItem('u','a'); assert.deepEqual(h.ids(), ['b']);
  await h.api.writeSiriGearCache(items, stale); assert.deepEqual(h.ids(), ['b']);
  await h.publish(); assert.deepEqual(h.ids(), ['b']);
  const restarted = h.load(); await restarted.setSiriGearCacheAccount('u');
  await restarted.writeSiriGearCache(items, restarted.beginSiriGearCachePublication('u')); assert.deepEqual(h.ids(), ['b']);
});
test('queued write followed by suppression cannot resurrect ID', async () => {
  const h = setup(); await h.api.setSiriGearCacheAccount('u');
  const write = h.publish(); const removal = h.api.suppressSiriGearItem('u','a');
  await Promise.all([write, removal]); await h.publish(); assert.deepEqual(h.ids(), ['b']);
});
test('account transition rejects delayed writers, scopes same-ID suppression and clears on logout', async () => {
  const h = setup(); await h.api.setSiriGearCacheAccount('u'); await h.publish();
  await h.api.suppressSiriGearItem('u','a'); const stale = h.api.beginSiriGearCachePublication('u');
  await h.api.setSiriGearCacheAccount('v'); assert.deepEqual(h.ids(), []);
  await h.api.writeSiriGearCache(items, stale); assert.deepEqual(h.ids(), []);
  await h.api.writeSiriGearCache(items, h.api.beginSiriGearCachePublication('v')); assert.deepEqual(h.ids(), ['a','b']);
  await h.api.setSiriGearCacheAccount(null); assert.deepEqual(h.ids(), []);
  await h.api.writeSiriGearCache(items, stale); assert.deepEqual(h.ids(), []);
});
test('restore release does not publish; invalidates older snapshots and permits subsequent refresh', async () => {
  const h = setup(); await h.api.setSiriGearCacheAccount('u'); await h.publish(); await h.api.suppressSiriGearItem('u','a');
  const stale = h.api.beginSiriGearCachePublication('u'); await h.api.releaseSiriGearItem('u','a');
  assert.deepEqual(h.ids(), ['b']); await h.api.writeSiriGearCache(items, stale); assert.deepEqual(h.ids(), ['b']);
  await h.publish(); assert.deepEqual(h.ids(), ['a','b']);
});
for (const fault of ['storage','read','write']) test(`suppression ${fault} failure is explicit and future publication remains suppressed`, async () => {
  const h = setup(); await h.api.setSiriGearCacheAccount('u'); await h.publish(); const before = h.files.get(path); h.faults[fault] = true;
  await assert.rejects(h.api.suppressSiriGearItem('u','a'), e => e.code === 'SIRI_CACHE_FAILED');
  if (fault !== 'storage') assert.equal(h.files.get(path), before);
  h.faults[fault] = false; await h.publish(); assert.deepEqual(h.ids(), ['b']);
});
test('failed suppression release preserves block and never publishes', async () => {
  const h = setup(); await h.api.setSiriGearCacheAccount('u'); await h.publish(); await h.api.suppressSiriGearItem('u','a');
  h.faults.storage = true; await assert.rejects(h.api.releaseSiriGearItem('u','a')); h.faults.storage = false;
  await h.publish(); assert.deepEqual(h.ids(), ['b']);
});
test('failed account clear disables all publication until successful reset', async () => {
  const h = setup(); await h.api.setSiriGearCacheAccount('u'); await h.publish(); h.faults.delete = true;
  await assert.rejects(h.api.setSiriGearCacheAccount('v')); await h.api.writeSiriGearCache([{ id:'v', name:'New' }], h.api.beginSiriGearCachePublication('v'));
  assert.deepEqual(h.ids(), ['a','b']); h.faults.delete = false; await h.api.setSiriGearCacheAccount('v'); assert.deepEqual(h.ids(), []);
});
for (const raw of [undefined, '', 'broken', '{}']) test(`missing/malformed file remains safe (${raw})`, async () => {
  const h = setup(); await h.api.setSiriGearCacheAccount('u'); if (raw !== undefined) h.files.set(path, raw);
  await h.api.suppressSiriGearItem('u','a'); assert.deepEqual(h.ids(), []);
});
test('deleted records and blank names never publish', async () => {
  const h = setup(); await h.api.setSiriGearCacheAccount('u'); await h.publish([{ ...items[0], isDeleted: true }, { id:'blank', name:' ' }, items[1]]); assert.deepEqual(h.ids(), ['b']);
});

for (const transition of [false, true]) test(`in-flight filesystem write completes before removal/account clear (transition=${transition})`, async () => {
  const h = setup(); await h.api.setSiriGearCacheAccount('u');
  let resume; h.faults.pauseWrite = new Promise(resolve => { resume = resolve; });
  const writing = h.publish();
  // Allow the actual writer to enter its pending filesystem operation.
  await new Promise(resolve => setImmediate(resolve));
  const invalidate = transition ? h.api.setSiriGearCacheAccount('v') : h.api.suppressSiriGearItem('u','a');
  resume(); delete h.faults.pauseWrite; await Promise.all([writing, invalidate]);
  assert.deepEqual(h.ids(), transition ? [] : ['b']);
});
test('malformed persistent suppression refuses publication rather than exposing an ID', async () => {
  const h = setup(); await h.api.setSiriGearCacheAccount('u'); h.storage.set('wmg:siri:suppressed:u', 'broken');
  await assert.rejects(h.publish()); assert.deepEqual(h.ids(), []);
});
test('Dashboard captures publication before loading; auth transitions and logout revoke cache scope', () => {
  const dashboard = fs.readFileSync('app/(tabs)/index.tsx','utf8');
  const start = dashboard.indexOf('async function loadDashboardData(');
  assert.ok(dashboard.indexOf('beginSiriGearCachePublication(activeUserId)', start) < dashboard.indexOf('await getAllItems()', start));
  assert.match(dashboard, /writeSiriGearCache\(all, siriPublication\)/);
  const auth = fs.readFileSync('components/auth/AuthProvider.tsx','utf8');
  assert.match(auth, /onAuthStateChanged\(auth, \(nextUser\) => \{\s*void setSiriGearCacheAccount\(nextUser\?\.uid \?\? null\)/);
  assert.match(auth, /async function signOutUser\(\) \{\s*const siriReset = setSiriGearCacheAccount\(null\)/);
});

test('restore followed immediately by re-deletion keeps suppression durable', async () => {
  const h = setup(); await h.api.setSiriGearCacheAccount('u'); await h.publish(); await h.api.suppressSiriGearItem('u','a');
  await Promise.all([h.api.releaseSiriGearItem('u','a'), h.api.suppressSiriGearItem('u','a')]);
  const restarted = h.load(); await restarted.setSiriGearCacheAccount('u');
  await restarted.writeSiriGearCache(items, restarted.beginSiriGearCachePublication('u')); assert.deepEqual(h.ids(), ['b']);
});
test('suppression queued during account initialization does not disable the new scope', async () => {
  const h = setup(); await Promise.all([h.api.setSiriGearCacheAccount('u'), h.api.suppressSiriGearItem('u','a')]);
  await h.publish(); assert.deepEqual(h.ids(), ['b']);
});

test('duplicate same-UID initialization preserves published cache and captured Dashboard token', async () => {
  const h = setup(); h.files.set(path, JSON.stringify({ items: [{ id: 'prior', name: 'Old account' }] }));
  const first = h.api.setSiriGearCacheAccount('u'); await first; assert.deepEqual(h.ids(), []);
  await h.publish(); const contents = h.files.get(path);
  const token = h.api.beginSiriGearCachePublication('u');
  assert.equal(h.api.setSiriGearCacheAccount('u'), first);
  await h.api.setSiriGearCacheAccount('u'); assert.equal(h.files.get(path), contents);
  assert.deepEqual(h.api.beginSiriGearCachePublication('u'), token);
  await h.api.writeSiriGearCache([...items, { id: 'c', name: 'Fresh' }], token);
  assert.deepEqual(h.ids(), ['a','b','c']);
});
test('duplicate same-UID initialization while reset is pending shares its promise and generation', async () => {
  const h = setup(); const first = h.api.setSiriGearCacheAccount('u');
  const token = h.api.beginSiriGearCachePublication('u');
  assert.equal(h.api.setSiriGearCacheAccount('u'), first);
  const writing = h.api.writeSiriGearCache(items, token);
  await Promise.all([first, writing]); assert.deepEqual(h.ids(), ['a','b']);
});
test('duplicate same-UID initialization during filesystem publication does not clear the result', async () => {
  const h = setup(); await h.api.setSiriGearCacheAccount('u');
  let resume; h.faults.pauseWrite = new Promise(resolve => { resume = resolve; });
  const writing = h.publish(); await new Promise(resolve => setImmediate(resolve));
  await h.api.setSiriGearCacheAccount('u'); resume(); delete h.faults.pauseWrite;
  await writing; assert.deepEqual(h.ids(), ['a','b']);
});
test('logout followed by same UID establishes a new scope and rejects pre-logout tokens', async () => {
  const h = setup(); await h.api.setSiriGearCacheAccount('u'); await h.publish();
  const old = h.api.beginSiriGearCachePublication('u');
  await h.api.setSiriGearCacheAccount(null); assert.deepEqual(h.ids(), []);
  await h.api.setSiriGearCacheAccount('u');
  await h.api.writeSiriGearCache(items, old); assert.deepEqual(h.ids(), []);
  await h.publish(); assert.deepEqual(h.ids(), ['a','b']);
});
test('failed first initialization can retry same UID without trusting the failed scope', async () => {
  const h = setup(); h.faults.delete = true;
  await assert.rejects(h.api.setSiriGearCacheAccount('u'));
  const failedToken = h.api.beginSiriGearCachePublication('u');
  await h.publish(); assert.deepEqual(h.ids(), []);
  h.faults.delete = false; await h.api.setSiriGearCacheAccount('u');
  await h.api.writeSiriGearCache(items, failedToken); assert.deepEqual(h.ids(), []);
  await h.publish(); assert.deepEqual(h.ids(), ['a','b']);
});
