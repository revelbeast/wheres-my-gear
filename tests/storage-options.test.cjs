const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/storageOptions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports});
const o=m.exports;
test('exact existing categories, labels and persisted subtype options',()=>{
 assert.equal(JSON.stringify(o.STORAGE_CATEGORIES),JSON.stringify([{value:'storage',label:'Storage'},{value:'office',label:'Office'},{value:'vehicle',label:'Vehicle'}]));
 const expected={
 vehicle:['ATV / UTV','Boat','Car','Class A','Class B','Class C','Fifth Wheel','Motorcycle','Other','SUV','Toy Hauler','Trailer','Truck','Van'],
 storage:['Backpack','Bag','Bin','Cabinet','Cargo Box','Cooler','Drawer','Garage','Luggage','Overhead','Other','Roof Box','Shed','Shelf','Storage Unit','Toolbox','Tote','Trailer Storage','Trunk','Under Seat','Warehouse'],
 office:['Home Office','Corporate Office','Desk','Filing Cabinet','Storage Closet','Supply Room','Warehouse Office','Server Room / IT Closet','Tool Room','Classroom / Training Room','Break Room','Other']};
 for(const [category,options] of Object.entries(expected))assert.deepEqual(Array.from(o.storageSubtypes(category)),options);
 for(const invalid of ['home','RV','',undefined])assert.equal(o.isStorageCategory(invalid),false);
});
test('both existing screens consume shared definitions without replacing their save behavior',()=>{
 for(const screen of ['create','edit']){
 const s=fs.readFileSync(`app/(tabs)/storage/${screen}.tsx`,'utf8');
 assert.match(s,/from "\.\.\/\.\.\/\.\.\/lib\/storageOptions"/);
 assert.doesNotMatch(s,/const VEHICLE_SUBTYPES =/);
 }
 const s=fs.readFileSync('app/(tabs)/storage/create.tsx','utf8');
 assert.match(s,/useState<StorageCategory>\("storage"\)/);
 assert.match(s,/subtype === "Other"\s*\? customSubtype.trim\(\)/);
});
