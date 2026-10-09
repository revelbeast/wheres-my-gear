const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const optionsModule={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/storageOptions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:optionsModule,exports:optionsModule.exports});
const requireOptions=id=>{assert.equal(id,'./storageOptions');return optionsModule.exports;};
const moduleValue={exports:{}};
const source=fs.readFileSync('lib/gearAssistantSetup.ts','utf8');
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:moduleValue,exports:moduleValue.exports,require:requireOptions});
const {parseSetup,editSetup,removeSetup,validateSetup,isSetupRequest}=moduleValue.exports;
const cases=[
 ['Create a storage space called Garage.',1,0,0],
 ['Create a storage space called Garage with one room called Tools and three compartments.',1,1,3],
 ['Create a storage space called Garage with one room called Tools and three compartments named Power Tools, Hand Tools, and Supplies.',1,1,3],
 ['Add three rooms to my RV.',0,3,0],
 ['Add four compartments to my Garage Tool Room.',0,0,4],
 ['Create an RV with two rooms called Kitchen and Bedroom, with three compartments in Kitchen and four in Bedroom.',1,2,7],
];
for(const [command,storage,rooms,compartments] of cases)test(command,()=>{
 const p=parseSetup(command);assert.equal(typeof p,'object');
 for(const [kind,n] of [['storage',storage],['room',rooms],['compartment',compartments]])assert.equal(p.nodes.filter(v=>v.kind===kind).length,n);
 assert.equal(validateSetup(p, false).length,0);
 if(command.startsWith('Add')){assert.ok(p.parentQuery);assert.equal(p.parentId,undefined);}
});
test('named children and placeholders have exact proposed parents',()=>{
 const p=parseSetup(cases[5][0]);const kitchen=p.nodes.find(n=>n.name==='Kitchen'),bedroom=p.nodes.find(n=>n.name==='Bedroom');
 assert.equal(p.nodes.filter(n=>n.parentId===kitchen.id).length,3);
 assert.equal(p.nodes.filter(n=>n.parentId===bedroom.id).length,4);
 assert.equal(p.nodes.find(n=>n.parentId===kitchen.id).name,'Compartment 1');
 const named=parseSetup(cases[2][0]);assert.equal(named.nodes.at(-1).name,'Supplies');
});
test('singular grammar and structure interception',()=>{
 assert.equal(parseSetup('Add one room to my RV').nodes.length,1);
 assert.equal(parseSetup('Add one compartment to my Garage').nodes.length,1);
 assert.equal(isSetupRequest('Add three rooms to my RV'),true);
 assert.equal(isSetupRequest('Add two flashlights to my RV'),false);
});
test('unclear grammar, counts and names reject rather than guess',()=>{
 for(const command of ['Create a garage and whatever else','Add many rooms to my RV','Add 21 rooms to my RV',
 'Create a storage space called Garage with two rooms called A and B and three compartments',
 'Create a storage space called Garage with one room called Tools and three compartments named A and B',
 'Create a storage space called '+'x'.repeat(61)]) assert.equal(typeof parseSetup(command),'string',command);
});
test('preview edits and cascading removal are immutable and validated',()=>{
 const p=parseSetup(cases[1][0]),room=p.nodes.find(n=>n.kind==='room');
 const edited=editSetup(p,room.id,'New Tools');assert.equal(p.nodes.find(n=>n.id===room.id).name,'Tools');
 assert.equal(edited.nodes.find(n=>n.id===room.id).name,'New Tools');
 assert.equal(removeSetup(p,room.id).nodes.length,1);
 assert.ok(validateSetup(editSetup(p,room.id,'')).length);
 assert.ok(validateSetup({...p,nodes:Array.from({length:31},(_,i)=>({...room,id:String(i)}))}).length);
});
test('preview module imports only pure storage options and has no writes; setup routing returns before add parser',()=>{
 assert.doesNotMatch(source,/createItem\(|addDoc\(|setDoc\(/);
 assert.equal((source.match(/^import /gm)||[]).length,1);
 assert.match(source,/from "\.\/storageOptions"/);
 const dashboard=fs.readFileSync('app/(tabs)/index.tsx','utf8');
 const start=dashboard.indexOf('if (intent.kind === "setup")');
 const end=dashboard.indexOf('if (intent.kind === "unsupported")',start);
 assert.match(dashboard.slice(start,end),/parseSetup/);
 assert.match(dashboard.slice(start,end),/return;/);
 assert.doesNotMatch(dashboard.slice(start,end),/await create|addDoc|setDoc/);
 assert.match(dashboard,/Smart Setup preview — not saved/);
 assert.match(dashboard,/onPress=\{requestSetupCreation\}/);
 assert.match(dashboard,/onPress=\{discardSetupPreview\}/);
});
test('Assistant has one shared command field before preview and a themed submit pill',()=>{
 const s=fs.readFileSync('app/(tabs)/index.tsx','utf8');
 assert.equal((s.match(/accessibilityLabel="Gear Assistant command"/g)||[]).length,1);
 assert.ok(s.indexOf('accessibilityLabel="Gear Assistant command"')<s.indexOf('Smart Setup preview — not saved'));
 assert.match(s,/setAssistantText\(transcript\)/);
 const button=s.slice(s.indexOf('<HapticPressable accessibilityRole="button" disabled={!assistantText.trim()'),s.indexOf('{setupPreview ? ('));
 assert.match(button,/borderRadius: 999/);assert.match(button,/minHeight: 44/);
 assert.match(button,/backgroundColor: theme.colors.primary/);assert.match(button,/color: "#FFFFFF", fontWeight: "700"/);
 assert.match(button,/processAssistantText\(assistantText\)/);
});
test('keyboard dismissal is accessible and does not change request or preview',()=>{
 const s=fs.readFileSync('app/(tabs)/index.tsx','utf8');
 const modal=s.slice(s.indexOf('visible={voiceAddModalVisible}'),s.indexOf('</Modal>',s.indexOf('visible={voiceAddModalVisible}')));
 assert.match(modal,/KeyboardAvoidingView/);
 assert.match(modal,/keyboardShouldPersistTaps="handled"/);
 assert.match(modal,/KeyboardDismissAccessory[\s\S]*nativeID="gear-assistant-keyboard"/);
 assert.match(modal,/accessibilityLabel="Dismiss keyboard"\s*onPress=\{\(\) => Keyboard.dismiss\(\)\}/);
});
test('Dashboard and Assistant reuse Inventory accessory with distinct focus refresh keys',()=>{
 const dashboard=fs.readFileSync('app/(tabs)/index.tsx','utf8');
 const inventory=fs.readFileSync('app/(tabs)/inventory.tsx','utf8');
 assert.match(inventory,/KeyboardDismissAccessory/);
 assert.match(dashboard,/DASHBOARD_SEARCH_KEYBOARD_ACCESSORY_ID \+ React.useId\(\)/);
 assert.match(dashboard,/key=\{\x60assistant-keyboard-/);
 assert.match(dashboard,/onLayout=\{\(\) => setDashboardSearchLaidOut\(true\)/);
 assert.match(dashboard,/onFocus=\{\(\) => setAssistantAccessoryVersion/);
 assert.match(dashboard,/selectionColor=\{theme.isLight \? "#2563EB" : "#FFFFFF"\}/);
 const accessory=fs.readFileSync('components/ui/KeyboardDismissAccessory.tsx','utf8');
 assert.match(accessory,/accessibilityLabel="Dismiss keyboard"/);
 assert.match(accessory,/Keyboard.dismiss\(\)/);
});
test('Undo restores exact subtree IDs, names and order while keeping surviving edits',()=>{
 const {prepareSetupRemoval,undoSetupRemoval}=moduleValue.exports;
 const p=parseSetup(cases[5][0]);
 const room=p.nodes.find(n=>n.name==='Kitchen');
 const removal=prepareSetupRemoval(p,room.id);
 assert.equal(removal.requiresConfirmation,true);
 const survivor=removal.after.nodes.find(n=>n.name==='Bedroom');
 const edited=editSetup(removal.after,survivor.id,'Edited Bedroom');
 const restored=undoSetupRemoval(edited,removal.undo);
 assert.deepEqual(Array.from(restored.nodes,n=>n.id),Array.from(p.nodes,n=>n.id));
 for(const id of removal.undo.removedIds)assert.deepEqual(restored.nodes.find(n=>n.id===id),p.nodes.find(n=>n.id===id));
 assert.equal(restored.nodes.find(n=>n.id===survivor.id).name,'Edited Bedroom');
 const all=prepareSetupRemoval(p,p.nodes[0].id);
 assert.equal(all.after.nodes.length,0);
 assert.deepEqual(undoSetupRemoval(all.after,all.undo),p);
});
test('actual removal and discard handlers wait for confirmation; Cancel changes nothing',()=>{
 const s=fs.readFileSync('app/(tabs)/index.tsx','utf8');
 const start=s.indexOf('  function requestSetupRemoval('),end=s.indexOf('  const [assistantText',start);
 let preview=parseSetup(cases[1][0]),undo=null,edited=true,alert;
 const c={setupController:{locked:()=>false,reset(){}},setupPreview:preview,setupPreviewRef:{current:preview},setupEdited:edited,
 prepareSetupRemoval:moduleValue.exports.prepareSetupRemoval,
 setSetupPreview:v=>preview=typeof v==='function'?v(preview):v,
 setSetupUndo:v=>undo=v,setSetupEdited:v=>edited=v,setAssistantText(){},setVoiceTranscript(){},
 Alert:{alert:(...args)=>alert=args}};
 vm.createContext(c);
 vm.runInContext(ts.transpileModule(s.slice(start,end)+'\nglobalThis.remove=requestSetupRemoval;globalThis.discard=discardSetupPreview;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);
 const room=preview.nodes.find(n=>n.kind==='room');
 c.remove(room.id);assert.equal(preview,c.setupPreview);assert.equal(undo,null);
 assert.equal(alert[2][0].style,'cancel');assert.equal(alert[2][0].onPress,undefined);
 alert[2][1].onPress();assert.equal(preview.nodes.length,1);assert.ok(undo);
 c.discard();assert.ok(preview);assert.equal(alert[0],'Discard edited preview?');
 alert[2][1].onPress();assert.equal(preview,null);assert.equal(undo,null);
});
test('empty compartment removal requires no confirmation',()=>{
 const p=parseSetup(cases[1][0]);
 assert.equal(moduleValue.exports.prepareSetupRemoval(p,p.nodes.at(-1).id).requiresConfirmation,false);
});
test('new storage defaults without guessing and requires compatible metadata',()=>{
 const p=parseSetup(cases[0][0]),node=p.nodes[0];
 assert.equal(node.category,'storage');assert.equal(node.subtype,'');
 assert.match(validateSetup(p).join(' '),/Choose a subtype/);
 const {editSetupStorage}=moduleValue.exports;
 const valid=editSetupStorage(p,node.id,{subtype:'Garage'});
 assert.equal(validateSetup(valid).length,0);
 assert.equal(p.nodes[0].subtype,'');
 assert.match(validateSetup(editSetupStorage(valid,node.id,{subtype:'Car'})).join(' '),/subtype/);
 assert.match(validateSetup({...valid,nodes:[{...valid.nodes[0],category:'home'}]}).join(' '),/category/);
 assert.equal(parseSetup(cases[5][0]).nodes[0].category,'storage');
});
test('category changes reset incompatible selections and preserve compatible Other',()=>{
 const {editSetupStorage}=moduleValue.exports;
 let p=parseSetup(cases[0][0]),id=p.nodes[0].id;
 p=editSetupStorage(p,id,{subtype:'Garage'});
 p=editSetupStorage(p,id,{category:'vehicle'});
 assert.equal(p.nodes[0].subtype,'');assert.equal(p.nodes[0].name,'Garage');
 p=editSetupStorage(p,id,{subtype:'Other',customSubtype:'  Custom RV  '});
 assert.equal(validateSetup(p).length,0);
 p=editSetupStorage(p,id,{category:'office'});
 assert.equal(p.nodes[0].subtype,'Other');assert.equal(p.nodes[0].customSubtype,'  Custom RV  ');
 for(const customSubtype of ['', '   ', 'x'.repeat(61)])assert.match(validateSetup(editSetupStorage(p,id,{customSubtype})).join(' '),/Custom subtype/);
 p=editSetupStorage(p,id,{subtype:'Desk'});assert.equal(p.nodes[0].customSubtype,'');
});
test('existing parents receive no metadata; edits and subtree Undo preserve metadata',()=>{
 const {editSetupStorage,prepareSetupRemoval,undoSetupRemoval}=moduleValue.exports;
 const existing={...parseSetup(cases[3][0]),parentId:'existing-storage'};
 const unchanged=editSetupStorage(existing,'existing-storage',{category:'vehicle',subtype:'Truck'});
 assert.equal(JSON.stringify(unchanged),JSON.stringify(existing));
 assert.equal(validateSetup(existing).length,0);
 assert.ok(existing.nodes.every(n=>n.category===undefined));
 let p=parseSetup(cases[1][0]);
 p=editSetupStorage(p,p.nodes[0].id,{subtype:'Other',customSubtype:'Home'});
 p=editSetup(p,p.nodes[0].id,'Edited Garage');
 const removal=prepareSetupRemoval(p,p.nodes[0].id);
 assert.deepEqual(undoSetupRemoval(removal.after,removal.undo),p);
 const roomRemoval=prepareSetupRemoval(p,p.nodes[1].id);
 assert.deepEqual(undoSetupRemoval(roomRemoval.after,roomRemoval.undo),p);
});
test('metadata UI is confined to proposed storage nodes and stays preview-only',()=>{
 const s=fs.readFileSync('app/(tabs)/index.tsx','utf8');
 const start=s.indexOf('{node.kind === "storage" ? (');
 const controls=s.slice(start,s.indexOf('accessibilityLabel={`Remove ${node.name}`}',start));
 assert.match(controls,/STORAGE_CATEGORIES.map/);assert.match(controls,/storageSubtypes/);
 assert.match(controls,/accessibilityState=\{\{ selected:/);
 assert.match(controls,/storageMetadataErrors\(node\)/);
 assert.match(controls,/setSetupEdited\(true\)/);
 assert.doesNotMatch(controls,/createStorageSpace|addDoc|setDoc/);
});
test('dynamic preview name and custom subtype inputs have unique focus-refreshed iOS accessories',()=>{
 const s=fs.readFileSync('app/(tabs)/index.tsx','utf8');
 assert.match(s,/setupKeyboardPrefix = "smart-setup-keyboard-" \+ React.useId\(\)/);
 const declaration=s.slice(s.indexOf('  const setupAccessoryId ='),s.indexOf('  const shouldUseDashboardSearchAccessory'));
 const c={setupKeyboardPrefix:'unique-mount'};vm.createContext(c);
 vm.runInContext(ts.transpileModule(declaration+'\nglobalThis.getId=setupAccessoryId;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);
 const ids=['proposal-0','proposal-1','proposal-2'].flatMap(id=>['name','subtype'].map(field=>c.getId(id,field)));
 assert.equal(new Set(ids).size,6);
 for(const field of ['name','subtype']){
 assert.ok(s.includes(`inputAccessoryViewID={Platform.OS === "ios" ? setupAccessoryId(node.id, "${field}") : undefined}`));
 assert.ok(s.includes(`nativeID={setupAccessoryId(node.id, "${field}")}`));
 assert.ok(s.includes('key={`${setupAccessoryId(node.id, "'+field+'")}-${setupAccessoryVersion}`}'));
 }
 assert.equal((s.match(/onFocus=\{\(\) => setSetupAccessoryVersion\(version => version \+ 1\)\}/g)||[]).length,2);
 const accessories=s.slice(s.indexOf('{Platform.OS === "ios" && setupPreview ?'),s.indexOf('</Modal>',s.indexOf('{Platform.OS === "ios" && setupPreview ?')));
 assert.match(accessories,/node.kind === "storage" && node.subtype === "Other"/);
 assert.doesNotMatch(accessories,/onDismiss=|setSetupPreview|setSetupEdited/);
 const accessory=fs.readFileSync('components/ui/KeyboardDismissAccessory.tsx','utf8');
 assert.match(accessory,/Keyboard.dismiss\(\)/);
 assert.match(accessory,/accessibilityLabel="Dismiss keyboard"/);
});
