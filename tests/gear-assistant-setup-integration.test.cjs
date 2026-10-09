const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function harness(){
 const modules={};let creates=0,executions=0,reconciliations=0,refreshes=0,uid='u',premium=true,saved,resolve;
 let result={ok:true,ids:{}},reconcileResult={ok:true,ids:{}},defer=false,refreshFails=false;
 function load(name){if(modules[name])return modules[name];const m={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:id=>{
 if(id==='./gearAssistantSetupService')return {createSmartSetupAttempt:(p,confirmed)=>{creates++;saved=p;assert.equal(confirmed,true);return {execute:()=>{executions++;return defer?new Promise(r=>resolve=r):Promise.resolve(result);},reconcile:async()=>{reconciliations++;return reconcileResult;}};}};
 assert.ok(['./gearAssistantSetup','./storageOptions'].includes(id));return load(id.slice(2));
 }});return modules[name]=m.exports;}
 const api=load('gearAssistantSetupController'),setup=load('gearAssistantSetup');
 const c=api.createSetupController({uid:()=>uid,premiumPlus:()=>premium,changed(){},success:async()=>{refreshes++;if(refreshFails)throw Error();}});
 const p=setup.editSetupStorage(setup.parseSetup('Create a storage space called Garage with one room called Tools and three compartments'),'proposal-0',{subtype:'Garage'});
 return {c,p,api,setup,counts:()=>({creates,executions,reconciliations,refreshes}),saved:()=>saved,
 setResult:r=>result=r,setReconcile:r=>reconcileResult=r,setUid:v=>uid=v,setPremium:v=>premium=v,
 delay:()=>defer=true,settle:r=>resolve(r),failRefresh:()=>refreshFails=true};
}
test('preview operations and confirmation cancellation never invoke creation',()=>{
 const h=harness();h.setup.editSetup(h.p,'proposal-0','Edited');h.setup.removeSetup(h.p,'proposal-1');
 const text=h.c.begin(h.p,'');assert.match(text,/Firebase inventory/);assert.match(text,/Garage/);assert.match(text,/Tools/);assert.match(text,/3 compartments/);
 assert.equal(h.c.locked(),true);h.c.cancel();h.c.reset();assert.equal(h.c.locked(),false);
 assert.deepEqual(h.counts(),{creates:0,executions:0,reconciliations:0,refreshes:0});
});
test('confirm freezes the displayed snapshot, invokes service exactly once and refreshes on success',async()=>{
 const h=harness();h.c.begin(h.p,'');h.p.nodes[0].name='Changed after dialog';
 await h.c.confirm();await h.c.confirm();assert.equal(h.saved().nodes[0].name,'Garage');assert.equal(Object.isFrozen(h.saved()),true);
 assert.deepEqual(h.counts(),{creates:1,executions:1,reconciliations:0,refreshes:1});assert.equal(h.c.state.phase,'success');
});
test('concurrent confirmation and dismissal cannot duplicate or reset the active attempt',async()=>{
 const h=harness();h.delay();h.c.begin(h.p,'');const p=h.c.confirm();assert.equal(h.c.confirm(),p);
 h.c.cancel();h.c.reset();assert.equal(h.c.locked(),true);assert.equal(h.c.begin(h.p,''),null);
 h.settle({ok:true,ids:{}});await p;assert.equal(h.counts().executions,1);
});
for(const reason of ['validation','permission','offline','entitlement','entitlement-unavailable','authentication','parent-state'])test(`definitive ${reason} failure preserves editable preview and never refreshes`,async()=>{
 const h=harness();const before=JSON.stringify(h.p);h.setResult({ok:false,reason,ids:{}});h.c.begin(h.p,'');await h.c.confirm();
 assert.equal(h.c.state.phase,'failed');assert.equal(h.c.locked(),false);assert.ok(h.c.state.message);assert.equal(JSON.stringify(h.p),before);assert.equal(h.counts().refreshes,0);
});
test('uncertain outcome retains original attempt; reconciliation never creates another',async()=>{
 const h=harness();h.setResult({ok:false,reason:'uncertain-result',ids:{a:'fixed'}});h.c.begin(h.p,'');await h.c.confirm();
 h.c.reset();h.c.cancel();assert.equal(h.c.locked(),true);assert.equal(h.c.begin(h.p,''),null);
 await h.c.confirm();assert.equal(h.counts().executions,1);
 h.setReconcile({ok:false,reason:'permission',ids:{a:'fixed'}});await h.c.reconcile();assert.equal(h.c.state.phase,'uncertain');
 h.setReconcile({ok:true,ids:{a:'fixed'}});await h.c.reconcile();assert.equal(h.c.state.phase,'success');
 assert.deepEqual(h.counts(),{creates:1,executions:1,reconciliations:2,refreshes:1});
});
test('absent reconciliation stays locked rather than retrying with new IDs',async()=>{
 const h=harness();h.setResult({ok:false,reason:'uncertain-result',ids:{}});h.setReconcile({ok:false,reason:'uncertain-result',reconciliation:'absent',ids:{}});
 h.c.begin(h.p,'');await h.c.confirm();await h.c.reconcile();assert.equal(h.c.locked(),true);assert.equal(h.counts().creates,1);
});
test('Premium-only, invalid preview and changed account cannot confirm',async()=>{
 const h=harness();h.setPremium(false);assert.equal(h.c.begin(h.p,''),null);h.setPremium(true);
 const invalid={...h.p,nodes:h.p.nodes.map(n=>({...n,subtype:''}))};assert.equal(h.c.begin(invalid,''),null);
 h.c.begin(h.p,'');h.setUid('other');await h.c.confirm();assert.equal(h.counts().creates,0);
});
test('existing parent confirmation uses resolved label and requires permanent selection',()=>{
 const h=harness(),p=h.setup.parseSetup('Add one room to my Garage');assert.equal(h.api.canCreateSetup(p),false);
 p.parentId='offline-storage-1';assert.equal(h.api.canCreateSetup(p),false);
 p.parentId='s';assert.match(h.c.begin(p,'Actual Garage'),/Existing storage space: Actual Garage/);
});
test('refresh failure never causes another creation or hides confirmed success',async()=>{
 const h=harness();h.failRefresh();h.c.begin(h.p,'');await h.c.confirm();assert.equal(h.c.state.phase,'success');assert.match(h.c.state.message,/could not refresh/);await h.c.confirm();assert.equal(h.counts().creates,1);
});
test('actual Dashboard dialog wires only Confirm to creation and success to explicit refresh',async()=>{
 const h=harness(),s=fs.readFileSync('app/(tabs)/index.tsx','utf8');let dialog,refreshes=0,preview=h.p;
 const ctx={setupPreview:h.p,setupController:h.c,allRooms:[],storageNameById:new Map(),assistantRequest:{current:0},assistantSpeechEnabled:{current:true},ExpoSpeechRecognitionModule:{stop(){}},Keyboard:{dismiss(){}},Alert:{alert:(...a)=>dialog=a}};
 vm.createContext(ctx);const start=s.indexOf('  function requestSetupCreation()'),end=s.indexOf('  function requestSetupRemoval',start);
 vm.runInContext(ts.transpileModule(s.slice(start,end)+'\nglobalThis.request=requestSetupCreation;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 ctx.request();assert.equal(h.counts().creates,0);dialog[2][0].onPress();assert.equal(h.counts().creates,0);
 ctx.request();dialog[2][1].onPress();await h.c.confirm();assert.equal(h.counts().creates,1);
 const success=s.slice(s.indexOf('  setupSuccess.current = async'),s.indexOf('  const setupLocked'));
 const sc={setupSuccess:{},isMountedRef:{current:true},setupContext:{current:{uid:'u'}},setSetupPreview:v=>preview=v,setSetupUndo(){},setSetupEdited(){},setAssistantText(){},setVoiceTranscript(){},dashboardLoadVersionRef:{current:0},loadDashboardData:async(uid,v,active)=>{assert.equal(uid,'u');assert.equal(v,1);assert.equal(active(),true);refreshes++;}};
 vm.createContext(sc);vm.runInContext(ts.transpileModule(success,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,sc);await sc.setupSuccess.current();assert.equal(preview,null);assert.equal(refreshes,1);
 assert.match(s,/editable=\{!setupLocked\}/);assert.match(s,/onRequestClose=\{handleCloseVoiceAddModal\}/);
 assert.match(s,/async function handleCloseVoiceAddModal\(\) \{\s*if \(setupController.locked\(\)\) return/);
 const process=s.slice(s.indexOf('async function processAssistantText'),s.indexOf('async function handleViewAssistantItem'));
 assert.doesNotMatch(process,/\.confirm\(|\.execute\(/);
});
