const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(overrides={}) {
 const calls=[];
 const service={getAllItems:async options=>{calls.push(options);return [];},getStorageSpaces:async()=>[],getAllCompartments:async()=>[],getRoomsByStorageSpace:async()=>[],getArchivedStorageSpaces:async()=>[],...overrides};
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/gearAssistant.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,
 {module,exports:module.exports,require:id=>id.includes('netinfo')?{fetch:async()=>({isConnected:true,...overrides.network})}:service});
 return {...module.exports,calls};
}
const h=load(),spaces=[{id:'s',name:'RV'},{id:'old',name:'Archive',isArchived:true}],compartments=[{id:'c',name:'Box',vehicleId:'s'}];
const item=(id,quantity=1,extra={})=>({id,name:'Widget',quantity,vehicleId:'s',compartmentId:'c',status:'missing',...extra});
const q=(text)=>h.classifyAssistantIntent(text);
test('supported question wording and location parsing',()=>{
 for(const s of ['How many widgets do I have?','How many widgets do I have on hand?','Where are my widgets?','Do I have any batteries?']) assert.equal(q(s).kind,'question');
 assert.equal(q('How many flashlights are in my RV?').item,'flashlights');
});
test('questions and unsupported commands cannot reach add intent',()=>{
 for(const s of ['Delete all gear','Can you create a room?','What is my stock?'])assert.equal(q(s).kind,'unsupported');
 assert.equal(q('Add two flashlights to my RV').kind,'add');
});
test('deduplicates IDs and sums units independent of packed status',()=>{
 const answer=h.answerInventoryQuestion(q('How many widgets do I have?'),[item('a',3),item('a',3),item('b',4,{status:'packed'})],spaces,compartments,[]);
 assert.match(answer,/7 recorded units across 2 records/);
});
test('trash and archived storage excluded; unknown parent disclosed',()=>{
 const answer=h.answerInventoryQuestion(q('Where are my widgets?'),[item('a',3,{isDeleted:true}),item('b',4,{vehicleId:'old',compartmentId:''}),item('c',2,{vehicleId:'gone',compartmentId:''})],spaces,compartments,[]);
 assert.match(answer,/0 recorded units/);assert.match(answer,/2 items in archived or unknown/);
});
test('partial names clarify rather than sum unrelated records',()=>{
 assert.match(h.answerInventoryQuestion(q('Do I have any batteries?'),[item('a',2,{name:'Battery Charger'})],spaces,compartments,[]),/Please specify/);
});
test('exact current location filters and duplicate location names clarify',()=>{
 assert.match(h.answerInventoryQuestion(q('How many widgets in my RV?'),[item('a',2)],spaces,compartments,[]),/2 recorded units/);
 assert.match(h.answerInventoryQuestion(q('Where are my widgets in RV?'),[],[...spaces,{id:'other',name:'RV'}],[],[]),/Several locations/);
});
test('invalid quantities are not invented',()=>{
 assert.match(h.answerInventoryQuestion(q('Where are my widgets?'),[item('a',NaN)],spaces,compartments,[]),/quantities unavailable/);
});
test('loader uses photo-safe projected reader and honest freshness notice',async()=>{
 const h=load();assert.doesNotMatch(await h.loadInventoryAnswer(q('Do I have widgets?')),/cached|freshness/i);
 assert.equal(h.calls[0].recoverPhotos,false);
});
test('offline notice and service errors',async()=>{
 const h=load({network:{isConnected:false}});assert.match(await h.loadInventoryAnswer(q('Do I have widgets?')),/Offline/);
 await assert.rejects(load({getAllItems:async()=>{throw Error('read');}}).loadInventoryAnswer(q('Do I have widgets?')));
});
test('Dashboard shared routing guards speech, stale responses, loading and save previews',()=>{
 const s=fs.readFileSync('app/(tabs)/index.tsx','utf8');
 assert.match(s,/if \(!assistantSpeechEnabled.current\) return/);
 assert.match(s,/processAssistantText\(transcript\)/);
 assert.match(s,/processAssistantText\(assistantText\)/);
 assert.ok(s.indexOf('classifyAssistantIntent(transcript)')<s.indexOf('const nextReview = buildVoiceAddReview(transcript)'));
 assert.match(s,/request === assistantRequest.current/);
 assert.match(s,/Reading available inventory/);
 assert.match(s,/await createItem\(/);
});
test('actual shared handler preserves add preview and rejects late question answers',async()=>{
 const source=fs.readFileSync('app/(tabs)/index.tsx','utf8');
 const start=source.indexOf('  async function processAssistantText(');
 const end=source.indexOf('\n  useSpeechRecognitionEvent("result"',start);
 let resolve,preview,answer,loading,parsed=0,selected;
 const context={isSavingVoiceItems:false,assistantRequest:{current:0},
 setAssistantItems(){},setVoiceTranscript(){},setVoiceAddReview:v=>preview=v,setSelectedVoiceLocationId:v=>selected=v,
 setAssistantAnswer:v=>answer=v,setAssistantLoading:v=>loading=v,
 classifyAssistantIntent:h.classifyAssistantIntent,
 loadInventoryAnswer:()=>new Promise(r=>resolve=r),
 buildVoiceAddReview:()=>{parsed++;return {items:[{name:'Flashlights',quantity:2}],destinationName:'RV'};},
 voiceLocationOptions:[{id:'storage-s',storageName:'RV'}]};
 vm.createContext(context);
 vm.runInContext(ts.transpileModule(source.slice(start,end)+'\nglobalThis.process=processAssistantText;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 const pending=context.process('How many widgets do I have?');
 assert.equal(loading,true);assert.equal(preview,null);assert.equal(parsed,0);
 await context.process('Add two flashlights to my RV');
 assert.equal(parsed,1);assert.equal(selected,'storage-s');assert.equal(preview.items[0].quantity,2);
 resolve('stale answer');await pending;assert.notEqual(answer,'stale answer');
 await context.process('Delete everything');
 assert.equal(preview,null);assert.equal(parsed,1);assert.match(answer,/Unsupported/);
});
test('concise separate item results use current location names without document IDs',()=>{
 const rows=[];
 const answer=h.answerInventoryQuestion(q('Where are my widgets?'),[item('firebase-a',1),item('firebase-b',3)],spaces,compartments,[],rows);
 assert.match(answer,/4 recorded units across 2 records/);
 assert.doesNotMatch(answer,/firebase|\[s\]|\[c\]/);
 assert.equal(rows.length,2);assert.equal(rows[0].location,'RV → Box');
 assert.equal(rows[0].id,'firebase-a');assert.equal(rows[1].id,'firebase-b');
});
test('View resolves exact permanent ID to current moved compartment using existing Found route',async()=>{
 const service=load({getAllItems:async()=>[item('a',1,{compartmentId:'new'})],
 getStorageSpaces:async()=>spaces,getAllCompartments:async()=>[{id:'new',name:'New',vehicleId:'s'}]});
 const route=await service.resolveAssistantItem('a');
 assert.equal(route.pathname,'/duplicate-inspection');
 assert.equal(route.params.focusItemId,'a');
 assert.equal(route.params.compartmentId,'new');
 assert.equal(route.params.duplicateInspection,'true');
});
test('View refuses deleted, missing, unresolved and temporary items',async()=>{
 for(const items of [[],[item('a',1,{isDeleted:true})],[item('a',1,{compartmentId:'gone'})]]) {
 const service=load({getAllItems:async()=>items,getStorageSpaces:async()=>spaces,getAllCompartments:async()=>compartments});
 assert.equal(await service.resolveAssistantItem('a'),null);
 }
 assert.equal(await h.resolveAssistantItem('offline-item-a'),null);
});
test('actual View handler hides modal, pushes exact route and retains return flag without saving',async()=>{
 const source=fs.readFileSync('app/(tabs)/index.tsx','utf8');
 const start=source.indexOf('  async function handleViewAssistantItem');
 const end=source.indexOf('\n  useSpeechRecognitionEvent("result"',start);
 const pushes=[],visible=[];
 const c={assistantViewing:{current:false},assistantRequest:{current:1},assistantReturn:{current:false},assistantSpeechEnabled:{current:true},
 resolveAssistantItem:async id=>({pathname:'/duplicate-inspection',params:{focusItemId:id}}),
 ExpoSpeechRecognitionModule:{stop(){}},setVoiceAddModalVisible:v=>visible.push(v),router:{push:r=>pushes.push(r)},Alert:{alert(){}}};
 vm.createContext(c);
 vm.runInContext(ts.transpileModule(source.slice(start,end)+'\nglobalThis.view=handleViewAssistantItem;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);
 await c.view('a');assert.equal(pushes[0].params.focusItemId,'a');assert.equal(visible[0],false);assert.equal(c.assistantReturn.current,true);
 assert.match(source,/if \(assistantReturn.current\) \{\s*assistantReturn.current = false;\s*setVoiceAddModalVisible\(true\)/);
});
