const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function harness(options={}) {
 const docs=new Map(),writes=[],calls={transactions:0,allocated:0,entitlements:0};
 const auth={currentUser:{uid:'u'}};
 const cache={};
 function load(file){if(cache[file])return cache[file];const m={exports:{}};cache[file]=m.exports;
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(`lib/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:id=>{
 if(id==='./gearAssistantSetup'||id==='./storageOptions')return load(id.slice(2));
 if(id==='../firebaseConfig')return {auth,db:{}};
 if(id==='@react-native-community/netinfo')return {default:{fetch:async()=>{if(options.networkThrows)throw Error();return options.network??{isConnected:true,isInternetReachable:true};}}};
 if(id==='react-native-purchases')return {default:{getAppUserID:async()=>options.rcUid??'u'}};
 if(id==='./revenuecat')return {getCustomerInfo:async()=>{calls.entitlements++;if(options.changeAccount)auth.currentUser={uid:'other'};if(options.entitlementThrows)throw Error();return options.unavailable?null:{entitlements:{active:options.premiumOnly?{premium:{}}:options.denied?{}:{premium_plus:{}}}};},hasPremiumPlusAccess:info=>!!info.entitlements.active.premium_plus};
 if(id==='firebase/firestore')return {
 collection:(_db,...parts)=>parts.join('/'),
 doc:(...args)=>args.length===1?{id:`new-${++calls.allocated}`,path:`${args[0]}/new-${calls.allocated}`}:{id:args.at(-1),path:args.slice(1).join('/')},
 serverTimestamp:()=> 'SERVER_TIMESTAMP',
 runTransaction:async(_db,callback)=>{
 calls.transactions++;
 const invoke=async()=>{const pending=[];let writing=false;
 const result=await callback({get:async ref=>{assert.equal(writing,false,'read after write');if(options.onRead)options.onRead(ref,auth,docs);const data=docs.get(ref.path);return {exists:()=>data!==undefined,data:()=>data};},set:(ref,data)=>{writing=true;pending.push([ref.path,data]);}});
 return {result,pending};};
 if(options.retry&&calls.transactions===1)await invoke();
 const {result,pending}=await invoke();
 if(options.error&&!options.commitThenError&&pending.length)throw {code:options.error};
 for(const [path,data]of pending){docs.set(path,data);writes.push([path,data]);}
 if(options.error&&options.commitThenError&&pending.length)throw {code:options.error};
 return result;
 }};
 throw Error(`Unexpected dependency ${id}`);
 }});cache[file]=m.exports;return m.exports;}
 const service=load('gearAssistantSetupService'),setup=load('gearAssistantSetup');
 const proposal=()=>{const p=setup.parseSetup('Create a storage space called Garage with one room called Tools and three compartments');return setup.editSetupStorage(p,p.nodes[0].id,{subtype:'Garage'});};
 return {service,proposal,docs,writes,calls,auth,options,setup};
}
test('import/preparation are inert, and confirmation is required',async()=>{
 const h=harness();const a=h.service.createSmartSetupAttempt(h.proposal(),false);
 assert.equal(h.calls.transactions,0);assert.equal(h.calls.allocated,0);assert.equal(h.calls.entitlements,0);
 assert.equal((await a.execute()).reason,'validation');assert.equal(h.writes.length,0);
});
test('new hierarchy is atomic with permanent IDs and exact schema payloads',async()=>{
 const h=harness(),p=h.proposal(),a=h.service.createSmartSetupAttempt(p,true);
 p.nodes[0].name='mutated'; // frozen source or detached snapshot cannot alter the attempt
 const r=await a.execute();assert.equal(r.ok,true);assert.equal(h.calls.transactions,1);assert.equal(h.writes.length,5);
 const storage=h.writes[0][1],room=h.writes[1][1],comp=h.writes[2][1];
 assert.equal(storage.name,'Garage');assert.equal(storage.category,'storage');assert.equal(storage.subtype,'Garage');
 assert.equal(storage.isArchived,false);assert.equal(storage.archivedAt,null);assert.equal(storage.notes,'');
 assert.equal(room.storageSpaceId,r.ids['proposal-0']);assert.equal(room.storageSpaceName,'Garage');assert.equal(room.photoUri,'');
 assert.equal(comp.vehicleId,r.ids['proposal-0']);assert.equal(comp.roomId,r.ids['proposal-1']);assert.equal(comp.roomName,'Tools');
 for(const [path,data]of h.writes){assert.match(path,/^users\/u\//);assert.equal(data.createdAt,'SERVER_TIMESTAMP');assert.equal(data.updatedAt,'SERVER_TIMESTAMP');}
});
for(const kind of ['storage','room'])test(`existing ${kind} is read by ID and never rewritten`,async()=>{
 const h=harness();h.docs.set('users/u/storageSpaces/s',{name:'Existing',category:'office',subtype:'Desk'});
 h.docs.set('users/u/rooms/r',{name:'Room',storageSpaceId:'s'});
 const p=h.setup.parseSetup(kind==='storage'?'Add two rooms to my Existing':'Add two compartments to my Room');p.parentId=kind==='storage'?'s':'r';
 const before=JSON.stringify([...h.docs]);const r=await h.service.createSmartSetupAttempt(p,true).execute();assert.equal(r.ok,true);
 assert.equal(h.writes.length,2);assert.ok(h.writes.every(([path])=>!path.endsWith('/s')&&!path.endsWith('/r')));
 assert.equal(JSON.stringify([...h.docs].slice(0,2)),before);
 const data=h.writes[0][1];assert.equal(kind==='storage'?data.storageSpaceId:data.vehicleId,'s');
});
test('metadata validates Other and never guesses category or subtype',async()=>{
 for(const patch of [{subtype:''},{subtype:'Car'},{category:'home'},{category:undefined},{subtype:'Other',customSubtype:' '},{subtype:'Other',customSubtype:'x'.repeat(61)}]){
 const h=harness(),p=h.proposal();Object.assign(p.nodes[0],patch);
 assert.equal((await h.service.createSmartSetupAttempt(p,true).execute()).reason,'validation');assert.equal(h.writes.length,0);
 }
 const h=harness(),p=h.proposal();Object.assign(p.nodes[0],{subtype:'Other',customSubtype:' Workshop Office '});
 assert.equal((await h.service.createSmartSetupAttempt(p,true).execute()).ok,true);assert.equal(h.writes[0][1].subtype,'Workshop Office');
});
test('malformed proposals, names, ancestry and limits fail before I/O',async()=>{
 const h=harness();const base=()=>JSON.parse(JSON.stringify(h.proposal()));
 const cases=[null,{}, {nodes:[]},{nodes:Array(31).fill(base().nodes[0])}];
 for(const change of [p=>p.nodes[0].name='',p=>p.nodes[0].name='x'.repeat(61),p=>p.nodes[0].parentId='proposal-1',p=>p.nodes[1].parentId='missing',p=>p.nodes[1].parentId='proposal-2',p=>p.nodes[1].id=p.nodes[0].id,p=>p.nodes[1].kind='unknown',p=>p.nodes[1].parentId=[],p=>p.nodes[0].id='a/b']){const p=base();change(p);cases.push(p);}
 for(const p of cases)assert.equal((await h.service.createSmartSetupAttempt(p,true).execute()).reason,'validation');
 for(const id of [undefined,'offline-storage-1','proposal-1','temp-1','a/b','']){
 const p=h.setup.parseSetup('Add one room to my Garage');p.parentId=id;
 assert.equal((await h.service.createSmartSetupAttempt(p,true).execute()).reason,'validation');
 }
 assert.equal(h.calls.transactions,0);assert.equal(h.calls.entitlements,0);
});
for(const variant of ['missing','archived','bad-ancestry','foreign-ancestry','archived-storage'])test(`existing parent rejects ${variant}`,async()=>{
 const h=harness(),p=h.setup.parseSetup('Add one compartment to my Room');p.parentId='r';
 if(variant!=='missing')h.docs.set('users/u/rooms/r',{name:'R',storageSpaceId:variant==='bad-ancestry'?'offline-storage-1':'s',isArchived:variant==='archived'});
 if(variant!=='foreign-ancestry')h.docs.set('users/u/storageSpaces/s',{name:'S',isArchived:variant==='archived-storage'});
 else h.docs.set('users/other/storageSpaces/s',{name:'S'});
 assert.equal((await h.service.createSmartSetupAttempt(p,true).execute()).reason,'parent-state');assert.equal(h.writes.length,0);
});
test('signed out, changed account before execution and during transaction are rejected',async()=>{
 for(const mode of ['out','before','entitlement','transaction']){
 const h=harness({changeAccount:mode==='entitlement',onRead:mode==='transaction'?(_ref,auth)=>{auth.currentUser={uid:'other'};}:undefined});
 if(mode==='out')h.auth.currentUser=null;
 const a=h.service.createSmartSetupAttempt(h.proposal(),true);
 if(mode==='before')h.auth.currentUser={uid:'other'};
 assert.equal((await a.execute()).reason,'authentication');assert.equal(h.writes.length,0);
 }
});
for(const [options,reason]of [[{premiumOnly:true},'entitlement'],[{denied:true},'entitlement'],[{unavailable:true},'entitlement-unavailable'],[{entitlementThrows:true},'entitlement-unavailable'],[{rcUid:'another'},'entitlement-unavailable']])test(`entitlement fails closed ${JSON.stringify(options)}`,async()=>{
 const h=harness(options);assert.equal((await h.service.createSmartSetupAttempt(h.proposal(),true).execute()).reason,reason);assert.equal(h.calls.transactions,0);
});
test('offline and unknown connectivity refuse without allocating or queueing',async()=>{
 for(const network of [{isConnected:false},{isConnected:true,isInternetReachable:null}]){
 const h=harness({network});assert.equal((await h.service.createSmartSetupAttempt(h.proposal(),true).execute()).reason,'offline');assert.equal(h.calls.allocated,0);
 }
});
test('double invocation shares original promise; completed execution is not repeated',async()=>{
 const h=harness(),a=h.service.createSmartSetupAttempt(h.proposal(),true);
 const first=a.execute();assert.equal(a.execute(),first);assert.equal(a.reconcile(),first);
 const r=await first;assert.equal(await a.execute(),r);assert.equal(h.calls.transactions,1);assert.equal(h.calls.allocated,5);
});
test('transaction callback retry reuses IDs and commits once',async()=>{
 const h=harness({retry:true});assert.equal((await h.service.createSmartSetupAttempt(h.proposal(),true).execute()).ok,true);
 assert.equal(h.calls.allocated,5);assert.equal(h.writes.length,5);
});
test('transaction failure is atomic; uncertain absence never automatically recreates',async()=>{
 const h=harness({error:'unavailable'}),a=h.service.createSmartSetupAttempt(h.proposal(),true);
 const r=await a.execute();assert.equal(r.reason,'uncertain-result');assert.equal(h.writes.length,0);
 const reconciled=await a.reconcile();assert.equal(reconciled.reconciliation,'absent');assert.equal(reconciled.ids,r.ids);
 await a.execute();assert.equal(h.calls.allocated,5);assert.equal(h.writes.length,0);
});
test('lost commit acknowledgement reconciles exact allocated IDs without writing again',async()=>{
 const h=harness({error:'unavailable',commitThenError:true}),a=h.service.createSmartSetupAttempt(h.proposal(),true);
 const first=await a.execute();assert.equal(first.reason,'uncertain-result');assert.equal(h.writes.length,5);
 const r=await a.reconcile();assert.equal(r.ok,true);assert.equal(r.reconciliation,'matched');assert.equal(r.ids,first.ids);
 await a.execute();assert.equal(h.calls.allocated,5);assert.equal(h.writes.length,5);
});
test('partial or edited reconciliation records remain uncertain and are not overwritten',async()=>{
 for(const edit of [h=>h.docs.delete(h.writes[1][0]),h=>h.docs.get(h.writes[2][0]).name='Changed']){
 const h=harness({error:'unavailable',commitThenError:true}),a=h.service.createSmartSetupAttempt(h.proposal(),true);
 await a.execute();edit(h);const r=await a.reconcile();assert.equal(r.ok,false);assert.equal(r.reconciliation,'conflict');assert.equal(h.writes.length,5);
 }
});
test('permission failure returns a safe structured result',async()=>{
 const h=harness({error:'permission-denied'}),a=h.service.createSmartSetupAttempt(h.proposal(),true);
 assert.equal((await a.execute()).reason,'permission');assert.equal(h.writes.length,0);
 await a.execute();assert.equal(h.calls.transactions,1);
});
test('execution enforces the per-group 20 limit and consistent external parent kinds',async()=>{
 const h=harness();
 const p={nodes:Array.from({length:21},(_,i)=>({id:`p${i}`,kind:'room',name:`Room ${i}`,parentId:null})),parentKind:'storage',parentId:'s'};
 assert.equal((await h.service.createSmartSetupAttempt(p,true).execute()).reason,'validation');
 p.nodes=p.nodes.slice(0,1);p.parentKind='room';
 assert.equal((await h.service.createSmartSetupAttempt(p,true).execute()).reason,'validation');
 assert.equal(h.calls.transactions,0);
});
test('all supplied categories and exact subtype values survive payload mapping',async()=>{
 for(const [category,subtype]of [['storage','Garage'],['office','Tool Room'],['vehicle','Class B']]){
 const h=harness(),p=h.proposal();Object.assign(p.nodes[0],{category,subtype});
 assert.equal((await h.service.createSmartSetupAttempt(p,true).execute()).ok,true);
 assert.equal(h.writes[0][1].category,category);assert.equal(h.writes[0][1].subtype,subtype);
 }
});
test('parent changes on callback retry are revalidated before any commit',async()=>{
 let reads=0;const h=harness({retry:true,onRead:(ref,_auth,docs)=>{if(ref.path==='users/u/storageSpaces/s'&&++reads===2)docs.set(ref.path,{name:'S',isArchived:true});}});
 h.docs.set('users/u/storageSpaces/s',{name:'S'});
 const p=h.setup.parseSetup('Add one room to my S');p.parentId='s';
 assert.equal((await h.service.createSmartSetupAttempt(p,true).execute()).reason,'parent-state');assert.equal(h.writes.length,0);assert.equal(h.calls.allocated,1);
});
test('reconciliation refuses changed accounts and never overwrites allocated collisions',async()=>{
 const h=harness({onRead:(ref,_auth,docs)=>{if(ref.path.endsWith('/new-1'))docs.set(ref.path,{name:'Unrelated'});}});
 const a=h.service.createSmartSetupAttempt(h.proposal(),true);
 assert.equal((await a.execute()).reason,'uncertain-result');assert.equal(h.writes.length,0);
 h.auth.currentUser={uid:'other'};
 assert.equal((await a.reconcile()).reason,'authentication');assert.equal(h.writes.length,0);
});
