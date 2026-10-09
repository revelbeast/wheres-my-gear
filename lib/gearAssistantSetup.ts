import { isStorageCategory, storageSubtypes, type StorageCategory } from "./storageOptions";
// Preview-only: no services, persistence, or creation APIs.
export type SetupNode = { id: string; kind: 'storage' | 'room' | 'compartment'; name: string; parentId: string | null; category?: StorageCategory; subtype?: string; customSubtype?: string };
export type SetupPreview = { nodes: SetupNode[]; parentQuery?: string; parentKind?: 'storage' | 'room'; parentId?: string };
const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten'];
const count = (s: string) => /^\d+$/.test(s) ? Number(s) : words.indexOf(s.toLowerCase());
export const isSetupRequest = (s: string) => /^\s*create\b/i.test(s) ||
  /^\s*add\s+(?:(?:\w+|\d+)\s+)?(?:rooms?|compartments?|storage\s+spaces?)\b/i.test(s);
const names = (s: string) => s.split(/,\s*(?:and\s+)?|\s+and\s+/i).map(n=>n.trim()).filter(Boolean);

export function storageMetadataErrors(node: SetupNode): string[] {
  if (node.kind !== 'storage') return [];
  if (!isStorageCategory(node.category)) return ['Choose a valid storage category.'];
  if (!node.subtype || !storageSubtypes(node.category).includes(node.subtype)) return ['Choose a subtype for this storage space.'];
  if (node.subtype === 'Other' && (!node.customSubtype?.trim() || node.customSubtype.trim().length > 60)) return ['Custom subtype must contain 1–60 characters.'];
  return [];
}
export function editSetupStorage(preview: SetupPreview, id: string, changes: { category?: StorageCategory; subtype?: string; customSubtype?: string }): SetupPreview {
  return { ...preview, nodes: preview.nodes.map(node => {
    if (node.id !== id || node.kind !== 'storage') return node;
    const next = { ...node, ...changes };
    if (changes.category !== undefined && (!isStorageCategory(next.category) || !storageSubtypes(next.category).includes(next.subtype ?? ''))) {
      next.subtype = ''; next.customSubtype = '';
    }
    if (next.subtype !== 'Other') next.customSubtype = '';
    return next;
  }) };
}
export function validateSetup(preview: SetupPreview, includeMetadata = true): string[] {
  const errors: string[] = [];
  if (!preview.nodes.length || preview.nodes.length > 30) errors.push('Preview must contain 1–30 proposed locations.');
  const ids = new Set(preview.nodes.map(n=>n.id));
  if (ids.size !== preview.nodes.length) errors.push('Invalid preview identity.');
  for (const node of preview.nodes) {
    if (includeMetadata) errors.push(...storageMetadataErrors(node));
    if (!node.name.trim() || node.name.length > 60) errors.push('Names must contain 1–60 characters.');
    const parent = preview.nodes.find(n=>n.id === node.parentId);
    if (node.parentId && (!parent || (node.kind === 'room' ? parent.kind !== 'storage' : node.kind === 'compartment' ? !['storage','room'].includes(parent.kind) : true))) errors.push('Invalid parent relationship.');
    if (!node.parentId && node.kind !== 'storage' && !preview.parentKind) errors.push('Choose a parent.');
    if (preview.nodes.some(n=>n.id !== node.id && n.parentId === node.parentId && n.kind === node.kind && n.name.trim().toLowerCase() === node.name.trim().toLowerCase())) errors.push('Names under the same parent must be distinct.');
  }
  return [...new Set(errors)];
}
export function editSetup(preview: SetupPreview, id: string, name: string): SetupPreview {
  return {...preview,nodes:preview.nodes.map(n=>n.id===id?{...n,name}:n)};
}
export function removeSetup(preview: SetupPreview, id: string): SetupPreview {
  const removed=new Set([id]);
  for(let i=0;i<preview.nodes.length;i++) for(const n of preview.nodes) if(n.parentId && removed.has(n.parentId)) removed.add(n.id);
  return {...preview,nodes:preview.nodes.filter(n=>!removed.has(n.id))};
}
export function parseSetup(text: string): SetupPreview | string {
  const s=text.trim().replace(/[.!]$/,'');
  const preview:SetupPreview={nodes:[]};
  const add=(kind:SetupNode['kind'], name:string,parentId:string|null)=> {
    const id='proposal-'+preview.nodes.length;
    preview.nodes.push({id,kind,name,parentId,...(kind === 'storage' ? {category: 'storage' as const, subtype: '', customSubtype: ''} : {})});return id;
  };
  const addMany=(kind:'room'|'compartment', raw:string, label:string|undefined,parent:string|null)=>{
    const n=count(raw);
    if(!Number.isInteger(n)||n<1||n>20) throw Error('Use a count from 1 to 20.');
    const list=label?names(label):Array.from({length:n},(_,i)=>(kind==='room'?'Room':'Compartment')+' '+(i+1));
    if(list.length!==n) throw Error('The number of names must match the requested count.');
    return list.map(name=>add(kind,name,parent));
  };
  try {
    let m=s.match(/^add (\w+) (rooms?|compartments?) to my (.+)$/i);
    if(m) {
      preview.parentKind=/^room/i.test(m[2])?'storage':'room';
      preview.parentQuery=m[3];
      addMany(preview.parentKind==='storage'?'room':'compartment',m[1],undefined,null);
    } else if((m=s.match(/^create an? RV with (\w+) rooms? called (.+?),? with (\w+) compartments? in (.+?) and (\w+) (?:compartments? )?in (.+)$/i))) {
      const storage=add('storage','RV',null);
      const roomNames=names(m[2].replace(/,$/,''));
      const roomIds=addMany('room',m[1],m[2].replace(/,$/,''),storage);
      for(const [amount,parentName] of [[m[3],m[4]],[m[5],m[6]]]) {
        const matches=roomNames.map((name,i)=>({name,i})).filter(r=>r.name.toLowerCase()===parentName.toLowerCase());
        if(matches.length!==1) throw Error('Each compartment group must name exactly one proposed room.');
        addMany('compartment',amount,undefined,roomIds[matches[0].i]);
      }
    } else if((m=s.match(/^create a storage space called (.+?)(?: with (\w+) rooms? called (.+?) and (\w+) compartments?(?: named (.+))?)?$/i))) {
      if(/\bwith\b/i.test(m[1])) throw Error('Please clarify the proposed hierarchy.');
      const storage=add('storage',m[1],null);
      if(m[2]) {
        if(count(m[2])!==1) throw Error('Specify one room for this compartment group.');
        const room=addMany('room',m[2],m[3],storage)[0];
        addMany('compartment',m[4],m[5],room);
      }
    } else return 'Please clarify: create a named storage space, add rooms to a storage space, or add compartments to a room.';
    // Metadata is collected in the editable preview, not inferred from the request.
    const errors=validateSetup(preview, false);
    return errors.length?errors.join(' '):preview;
  } catch(error) { return error instanceof Error?error.message:'Please clarify the setup request.'; }
}

export type SetupRemoval = { before: SetupPreview; removedIds: string[] };
export function prepareSetupRemoval(preview: SetupPreview, id: string) {
  const after = removeSetup(preview, id);
  const remaining = new Set(after.nodes.map(n => n.id));
  const removedIds = preview.nodes.filter(n => !remaining.has(n.id)).map(n => n.id);
  return { after, undo: { before: preview, removedIds }, requiresConfirmation: removedIds.length > 1 };
}
export function undoSetupRemoval(current: SetupPreview, removal: SetupRemoval): SetupPreview {
  // Restore only the removed subtree; preserve subsequent edits to surviving nodes.
  const restored = new Map(current.nodes.map(n => [n.id, n]));
  for (const n of removal.before.nodes) if (removal.removedIds.includes(n.id)) restored.set(n.id, n);
  const ordered = removal.before.nodes.filter(n => restored.has(n.id)).map(n => restored.get(n.id)!);
  const originalIds = new Set(removal.before.nodes.map(n => n.id));
  return { ...current, nodes: [...ordered, ...current.nodes.filter(n => !originalIds.has(n.id))] };
}
