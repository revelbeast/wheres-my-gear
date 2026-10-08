const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('app/scan-item.tsx', 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise, resolve, reject}; };
const tick = async () => { for(let i=0;i<15;i++) await Promise.resolve(); };
const plain = x => JSON.parse(JSON.stringify(x));
const available = {available:true,vision:true,guidedGeneration:true};
const appleSuccess = {ok:true,identified:true,itemName:' drill ',brand:null,model:null,description:null};
const photo = {uri:'file:///cache/Camera/test.jpg',base64:'same-capture'};
function provider({platform='ios', availability=available, result=appleSuccess, apple, fetcher}={}) {
  const calls={availability:0,apple:[],aws:[],timers:[],cleared:[],events:[]};
  let active=true;
  const module={exports:{}};
  const context={module,exports:module.exports,AbortController,
    setTimeout(fn,ms){const t={fn,ms};calls.timers.push(t);return t;},
    clearTimeout(t){calls.cleared.push(t);},
    fetch:async (url,options)=>{calls.aws.push({url,options});return fetcher ? fetcher(url,options) : {ok:true,json:async()=>({found:true,title:'AWS drill',confidence:0.8})};},
    require:()=>({getAvailability:async()=>{calls.availability++;return availability;},recognizeImage:async(...args)=>{calls.apple.push(args);return apple ? apple(...args) : result;}})};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/scanAiRecognition.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  const options={platform,photo,requestId:'ai-test',isActive:()=>active,appleStarted:()=>calls.events.push('start'),appleSettled:()=>calls.events.push('settled'),awsStarted:c=>{calls.controller=c;}};
  return {calls,run:(overrides={})=>module.exports.recognizeScanPhoto({...options,...overrides}),stop:()=>{active=false;}};
}
test('Apple usable success maps review fields without AWS or invented confidence',async()=>{
 const h=provider(); const r=plain(await h.run());
 assert.deepEqual(r,{found:true,suggestedName:'drill',source:'Apple Foundation Models',brand:'',image:photo.uri,description:'',matchConfidence:'',matchStatus:'possible'});
 assert.equal(h.calls.aws.length,0);assert.equal(h.calls.timers.length,0);assert.deepEqual(h.calls.apple,[[photo.uri,'ai-test']]);
});
for(const name of ['bag','tool','bottle']) test(`generic Apple name ${name} needs no optional metadata`,async()=>{
 const h=provider({result:{...appleSuccess,itemName:name}});assert.equal((await h.run()).suggestedName,name);assert.equal(h.calls.aws.length,0);
});
for(const availability of [null,{}, {available:'true',vision:true,guidedGeneration:true},{...available,vision:false},{...available,guidedGeneration:false},{available:false,reason:'ios_27_required'}]) test(`availability fallback ${JSON.stringify(availability)}`,async()=>{
 const h=provider({availability});assert.equal((await h.run()).source,'AWS Rekognition');assert.equal(h.calls.apple.length,0);assert.equal(h.calls.aws.length,1);
});
for(const result of [{ok:false,reason:'refusal'},{ok:false,reason:'recognition_failed'},{ok:false,reason:'timeout'},{...appleSuccess,identified:false},...['','  ','NiL','null','N/A','unknown','none',' Unidentified Item ','Product Not Named'].map(itemName=>({...appleSuccess,itemName}))]) test(`Apple fallback ${JSON.stringify(result)}`,async()=>{
 const h=provider({result});const r=await h.run();assert.equal(r.source,'AWS Rekognition');assert.equal(h.calls.aws.length,1);assert.equal(r.image,photo.uri);assert.equal(r.matchConfidence,'0.8');assert.deepEqual(JSON.parse(h.calls.aws[0].options.body),{imageBase64:photo.base64});assert.deepEqual(h.calls.events,['start','settled']);
});
test('Android bypasses Apple and preserves AWS response',async()=>{const h=provider({platform:'android'});await h.run();assert.equal(h.calls.availability,0);assert.equal(h.calls.apple.length,0);assert.equal(h.calls.aws.length,1);});
test('explicit native cancellation is terminal without AWS',async()=>{const h=provider({result:{ok:false,reason:'cancelled'}});assert.equal(await h.run(),null);assert.equal(h.calls.aws.length,0);});
for(const stale of [false,true]) test(`Apple settlement precedes AWS timer, stale=${stale}`,async()=>{
 const gate=deferred();const h=provider({apple:()=>gate.promise});const p=h.run();await tick();assert.equal(h.calls.timers.length,0);assert.equal(h.calls.aws.length,0);if(stale)h.stop();gate.resolve({ok:false,reason:'timeout'});await p;assert.equal(h.calls.aws.length,stale?0:1);if(!stale){assert.equal(h.calls.timers[0].ms,35000);assert.equal(h.calls.cleared.length,1);}
});
test('active AWS timeout throws even if fetch later returns success',async()=>{const gate=deferred();const h=provider({platform:'android',fetcher:()=>gate.promise});const p=h.run();await tick();h.calls.timers[0].fn();assert.equal(h.calls.controller.signal.aborted,true);gate.resolve({ok:true,json:async()=>({found:true,title:'late'})});await assert.rejects(p);assert.equal(h.calls.cleared.length,1);});

// Execute the actual scanner functions and focus cleanup, without a camera or React renderer.
function scanner({capture=async()=>photo,recognize, navigationFails=false, platform='ios'}={}) {
 const calls={deleted:[],cancel:[],navigation:[],alerts:[],scanning:[],capture:0};
 const ref=current=>({current});let uuid=0; let stateListener; const effectCleanups=[]; const timers=[];
 const h=provider({platform});
 const c={React:{}, appStateRef:ref('active'),
  AppState:{addEventListener(event, fn){assert.equal(event,'change');stateListener=fn;return {remove(){stateListener=null;calls.listenerRemoved=true;}};}},
  useEffect:fn=>{effectCleanups.push(fn());},
  FileSystem:{deleteAsync:async uri=>calls.deleted.push(uri)},cancelRecognition:async id=>calls.cancel.push(id),
  currentAttemptRef:ref(null),aiCaptureLockedRef:ref(false),aiReviewOpenedRef:ref(false),autoAiScanStartedRef:ref(false),autoAiTimerRef:ref(null),
  scanSessionRef:ref({active:true}),cameraRef:ref({takePictureAsync:async()=>{calls.capture++;return capture();}}),cameraActive:true,cameraReady:true,isScanning:false,isAiMode:true,
  Crypto:{randomUUID:()=>String(++uuid)},Platform:{OS:platform},setTimeout(fn,ms){const t={fn,ms,cancelled:false};timers.push(t);return t;},clearTimeout(t){t.cancelled=true;},
  checkingPremiumPlusAccess:false,hasPremiumPlusAccess:true,mounted:true,permission:{granted:true},
  setIsScanning:v=>calls.scanning.push(v),setArOverlay(){},Alert:{alert:(...a)=>calls.alerts.push(a)},
  router:{replace:route=>{calls.navigation.push(plain(route));if(navigationFails)throw Error('navigation');}},
  recognizeScanPhoto:recognize||h.run,
  barcodeSessionRef:ref(0),barcodeProcessingRef:ref(false),setBarcodeProcessing(){},setCameraActive(){},discardBarcodePhoto(){},scanHistoryRef:ref([])};
 const helpers=source.slice(source.indexOf('  const cleanupAiPhoto'),source.indexOf('  const { user }'));
 const autoStart=source.indexOf('  useEffect(() => {',source.indexOf('  const handleAnalyzeImageWithAI'));
 const autoBody=source.slice(autoStart+'  useEffect(() => {'.length,source.indexOf('  }, [',autoStart));
 const handler=source.slice(source.indexOf('  const openAiReview'),source.indexOf('\n  useEffect(() => {',source.indexOf('  const handleAnalyzeImageWithAI')));
 const focusStart=source.indexOf('    useCallback(() => {',source.indexOf('// camera lifecycle control'))+'    useCallback(() => {'.length;
 const focus=source.slice(focusStart,source.indexOf('    }, [])',focusStart));
 vm.runInNewContext(ts.transpileModule(helpers+handler+'\n globalThis.start=handleAnalyzeImageWithAI; globalThis.open=openAiReview; globalThis.focus=()=>{'+focus+'}; globalThis.auto=()=>{'+autoBody+'};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);
 let blur=c.focus();
 return {c,calls,provider:h,timers,auto:()=>c.auto(),appState:state=>stateListener?.(state),unmount:()=>{blur();effectCleanups.forEach(fn=>fn?.());},start:()=>c.start(),blur:()=>blur(),refocus:()=>{blur=c.focus();}};
}
test('scanner one capture/navigation and transfer protects review photo',async()=>{
 const h=scanner();const p=h.start();await h.start();await p;assert.equal(h.calls.capture,1);assert.equal(h.calls.navigation.length,1);assert.equal(h.calls.navigation[0].params.scanId,'ai-1');assert.equal(h.calls.navigation[0].params.code,'ai-1');h.blur();assert.equal(h.calls.deleted.length,0);
});
test('departure during capture deletes only returned photo without provider call',async()=>{
 const gate=deferred();const h=scanner({capture:()=>gate.promise});const p=h.start();h.blur();gate.resolve(photo);await p;assert.deepEqual(h.calls.deleted,[photo.uri]);assert.equal(h.provider.calls.availability,0);assert.equal(h.calls.navigation.length,0);
});
for(const result of [appleSuccess,{ok:false,reason:'timeout'},{ok:false,reason:'cancelled'}]) test(`departure during Apple waits for original settlement ${JSON.stringify(result)}`,async()=>{
 const gate=deferred();const providerHarness=provider({apple:()=>gate.promise});const h=scanner({recognize:providerHarness.run});const p=h.start();await tick();h.blur();assert.deepEqual(h.calls.cancel,['ai-1']);assert.equal(h.calls.deleted.length,0);gate.resolve(result);await p;assert.deepEqual(h.calls.deleted,[photo.uri]);assert.equal(providerHarness.calls.aws.length,0);assert.equal(h.calls.navigation.length,0);assert.equal(h.calls.alerts.length,0);
});
test('departure during AWS aborts its controller; stale response never navigates',async()=>{
 const gate=deferred();const ph=provider({platform:'android',fetcher:()=>gate.promise});const h=scanner({platform:'android',recognize:ph.run});const p=h.start();await tick();const controller=h.c.currentAttemptRef.current.awsController;h.blur();assert.equal(controller.signal.aborted,true);gate.resolve({ok:true,json:async()=>({found:true,title:'late'})});await p;assert.equal(h.calls.navigation.length,0);assert.equal(h.calls.alerts.length,0);assert.deepEqual(h.calls.deleted,[photo.uri]);
});
test('old completion cannot clear newer attempt or newer scanning state',async()=>{
 const gate=deferred();const h=scanner({capture:()=>gate.promise});const p=h.start();h.blur();const newer={active:true,photoUri:'file:///new.jpg'};h.c.currentAttemptRef.current=newer;h.c.aiCaptureLockedRef.current=true;const count=h.calls.scanning.length;gate.resolve(photo);await p;assert.equal(h.c.currentAttemptRef.current,newer);assert.equal(h.c.aiCaptureLockedRef.current,true);assert.equal(h.calls.scanning.length,count);assert.deepEqual(h.calls.deleted,[photo.uri]);
});
test('failed navigation reclaims and deletes owned photo exactly once',async()=>{const h=scanner({navigationFails:true});await h.start();h.blur();assert.deepEqual(h.calls.deleted,[photo.uri]);assert.equal(h.calls.alerts.length,1);assert.equal(h.c.aiReviewOpenedRef.current,false);});
test('refocus while cancellation settles cannot overlap and eventually unlocks',async()=>{const gate=deferred();const h=scanner({capture:()=>gate.promise});const p=h.start();h.blur();h.refocus();await h.start();assert.equal(h.calls.capture,1);gate.resolve(photo);await p;assert.equal(h.c.aiCaptureLockedRef.current,false);assert.equal(h.calls.scanning.at(-1),false);});
test('active AWS failure keeps failure UI and cleans capture',async()=>{const ph=provider({platform:'android',fetcher:async()=>{throw Error('network');}});const h=scanner({platform:'android',recognize:ph.run});await h.start();assert.equal(h.calls.alerts.length,1);assert.deepEqual(h.calls.deleted,[photo.uri]);});
test('Premium+ and 2500ms auto-capture gates remain in scanner',()=>{
 assert.match(source,/const hasAccess = await isPremiumPlusUser\(\)/);
 assert.match(source,/if \(checkingPremiumPlusAccess\) return;\s*if \(!hasPremiumPlusAccess\) return;/);
 assert.match(source,/setTimeout\(\(\) => \{\s*void handleAnalyzeImageWithAI\(\);\s*\}, 2500\)/);
});
test('departure during availability prevents both recognition and fallback',async()=>{
 const gate=deferred();const ph=provider({availability:gate.promise});const h=scanner({recognize:ph.run});const p=h.start();await tick();h.blur();gate.resolve(available);await p;assert.equal(ph.calls.apple.length,0);assert.equal(ph.calls.aws.length,0);assert.deepEqual(h.calls.deleted,[photo.uri]);
});
test('review handoff is guarded against repeated navigation and synchronous blur',async()=>{
 const gate=deferred();const h=scanner({recognize:()=>gate.promise});const p=h.start();await tick();const attempt=h.c.currentAttemptRef.current;
 const result={found:true,suggestedName:'tool',source:'Apple Foundation Models',brand:'',description:'',image:photo.uri,matchConfidence:'',matchStatus:'possible'};
 h.c.open(attempt,result);h.c.open(attempt,result);h.blur();gate.resolve(result);await p;assert.equal(h.calls.navigation.length,1);assert.equal(h.calls.deleted.length,0);
});

test('background cancels auto-capture delay and foreground does not rearm it',async()=>{
 const h=scanner();h.auto();assert.equal(h.timers[0].ms,2500);h.appState('inactive');assert.equal(h.timers[0].cancelled,true);h.timers[0].fn();await tick();assert.equal(h.calls.capture,0);h.appState('background');h.appState('active');h.auto();assert.equal(h.timers.length,1);await h.start();assert.equal(h.calls.navigation.length,1);
});
test('background during pending capture invalidates it; manual foreground retry works',async()=>{
 const gate=deferred();let first=true;const h=scanner({capture:()=>{if(first){first=false;return gate.promise;}return {...photo,uri:'file:///cache/Camera/second.jpg'};}});const p=h.start();h.appState('inactive');h.appState('active');gate.resolve(photo);await p;assert.equal(h.calls.navigation.length,0);assert.equal(h.provider.calls.apple.length,0);assert.deepEqual(h.calls.deleted,[photo.uri]);await h.start();assert.equal(h.calls.navigation.length,1);
});
test('background during availability prevents all provider work',async()=>{
 const gate=deferred();const ph=provider({availability:gate.promise});const h=scanner({recognize:ph.run});const p=h.start();await tick();h.appState('background');gate.resolve(available);await p;assert.equal(ph.calls.apple.length,0);assert.equal(ph.calls.aws.length,0);assert.deepEqual(h.calls.deleted,[photo.uri]);
});
for(const result of [appleSuccess,{ok:false,reason:'timeout'},{ok:false,reason:'refusal'}]) test(`AppState interruption during Apple prevents late result ${JSON.stringify(result)}`,async()=>{
 const gate=deferred();const ph=provider({apple:()=>gate.promise});const h=scanner({recognize:ph.run});const p=h.start();await tick();h.appState('inactive');h.appState('background');h.appState('background');assert.deepEqual(h.calls.cancel,['ai-1']);assert.equal(h.calls.deleted.length,0);h.appState('active');assert.equal(h.c.currentAttemptRef.current.active,false);gate.resolve(result);await p;assert.equal(ph.calls.aws.length,0);assert.equal(h.calls.navigation.length,0);assert.equal(h.calls.alerts.length,0);assert.deepEqual(h.calls.deleted,[photo.uri]);
});
test('background aborts exact AWS controller and suppresses late response',async()=>{
 const gate=deferred();const ph=provider({platform:'android',fetcher:()=>gate.promise});const h=scanner({platform:'android',recognize:ph.run});const p=h.start();await tick();const controller=h.c.currentAttemptRef.current.awsController;h.appState('background');assert.equal(controller.signal.aborted,true);h.appState('active');gate.resolve({ok:true,json:async()=>({found:true,title:'late'})});await p;assert.equal(h.calls.navigation.length,0);assert.equal(h.calls.alerts.length,0);assert.deepEqual(h.calls.deleted,[photo.uri]);
});
test('review-owned photo survives background and listener is removed on unmount',async()=>{
 const h=scanner();await h.start();h.appState('inactive');h.appState('background');h.unmount();assert.equal(h.calls.listenerRemoved,true);assert.equal(h.calls.deleted.length,0);assert.equal(h.calls.cancel.length,0);const state=h.c.appStateRef.current;h.appState('active');assert.equal(h.c.appStateRef.current,state);
});
