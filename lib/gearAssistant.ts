import NetInfo from '@react-native-community/netinfo';
import { getAllItems, getStorageSpaces, getAllCompartments, getRoomsByStorageSpace, getArchivedStorageSpaces,
  type Item, type StorageSpace, type Compartment, type Room } from './gearService';

export type AssistantIntent = { kind: 'add'; text: string } |
  { kind: 'question'; item: string; location?: string } | { kind: 'unsupported' };
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const singular = (s: string) => s.split(' ').map(word =>
  word.endsWith('ies') ? word.slice(0, -3) + 'y' :
  /(?:ss|us|is)$/.test(word) ? word : word.endsWith('s') ? word.slice(0, -1) : word).join(' ');

export function classifyAssistantIntent(text: string): AssistantIntent {
  const clean = normalize(text).replace(/[?.!]+$/, '');
  if (/^add\s+\S/.test(clean)) return { kind: 'add', text };
  const match = clean.match(/^how many (.+?)(?: do i have(?: on hand)?)?$/) ||
    clean.match(/^where (?:are|is) (?:my |the )?(.+)$/) ||
    clean.match(/^do i have (?:any )?(.+)$/);
  if (!match) return { kind: 'unsupported' };
  const parts = match[1].split(/\s+in\s+(?:my |the )?/);
  if (!parts[0]?.trim() || parts.length > 2) return { kind: 'unsupported' };
  return { kind: 'question', item: parts[0].replace(/\s+(?:are|is)$/, '').trim(), ...(parts[1] ? { location: parts[1].trim() } : {}) };
}

export type AssistantItem = { id: string; name: string; location: string; quantity: number | null; vehicleId: string; compartmentId: string };
export function answerInventoryQuestion(
  question: Extract<AssistantIntent, { kind: 'question' }>,
  items: Item[], spaces: StorageSpace[], compartments: Compartment[], rooms: Room[],
  results: AssistantItem[] = [],
): string {
  const activeSpaces = spaces.filter(s => !s.isArchived);
  const spaceMap = new Map(activeSpaces.map(s => [s.id, s]));
  const compartmentMap = new Map(compartments.map(c => [c.id, c]));
  const roomMap = new Map(rooms.map(r => [r.id, r]));
  const locations = [
    ...activeSpaces.map(s => ({ id: s.id, type: 'space', name: s.name })),
    ...rooms.filter(r => !r.isArchived && spaceMap.has(r.storageSpaceId)).map(r => ({ id: r.id, type: 'room', name: r.name })),
    ...compartments.filter(c => spaceMap.has(c.vehicleId)).map(c => ({ id: c.id, type: 'compartment', name: c.name })),
  ];
  const selected = question.location ? locations.filter(l => normalize(l.name) === normalize(question.location!)) : [];
  if (question.location && selected.length !== 1) return selected.length
    ? 'Several locations have that name. Please choose a uniquely named location before asking again.'
    : 'That location could not be resolved from available data. Check its name or refresh your inventory.';
  const target = selected[0];
  let unresolved = 0;
  const records = [...new Map(items.map(i => [i.id, i])).values()].filter(i => i.isDeleted !== true);
  const needle = singular(normalize(question.item));
  const exact = records.filter(i => singular(normalize(i.name)) === needle);
  if (!exact.length) {
    const partial = [...new Set(records.filter(i => singular(normalize(i.name)).includes(needle)).map(i => i.name))];
    return partial.length ? 'No exact item-name match. Please specify: ' + partial.join(', ') + '.'
      : 'No matching items recorded.';
  }
  let units = 0, count = 0, invalid = 0;
  for (const item of exact) {
    const compartment = item.compartmentId ? compartmentMap.get(item.compartmentId) : undefined;
    const storageId = compartment?.vehicleId ?? item.vehicleId;
    const space = storageId ? spaceMap.get(storageId) : undefined;
    if (!space) { unresolved++; continue; }
    const room = compartment?.roomId ? roomMap.get(compartment.roomId) : undefined;
    if (target && !(target.type === 'space' ? storageId === target.id :
      target.type === 'compartment' ? compartment?.id === target.id : room?.id === target.id)) continue;
    count++;
    const quantity = item.quantity;
    const valid = typeof quantity === 'number' && Number.isFinite(quantity) && quantity >= 0;
    if (!valid) invalid++;
    const n = valid ? quantity : 0;
    units += n;
    const location = [space.name,
      room && room.storageSpaceId === space.id ? room.name : compartment?.roomId ? 'Room unresolved' : '',
      (compartment ? compartment.name : undefined) ?? (item.compartmentId ? 'Compartment unresolved' : '')].filter(Boolean).join(' → ');
    results.push({ id: item.id, name: item.name, location, quantity: valid ? n : null,
      vehicleId: space.id, compartmentId: compartment?.id ?? '' });
  }
  return [
    `${question.item} — ${units} recorded unit${units === 1 ? "" : "s"}${count > 1 ? ` across ${count} records` : ""}`,

    invalid ? `${invalid} quantities unavailable; not included in total.` : '',
    unresolved ? `${unresolved} items in archived or unknown storage excluded.` : '',

  ].filter(Boolean).join('\n');
}

async function loadAssistantInventory() {
  const network = await NetInfo.fetch();
  const [items, spaces, compartments] = await Promise.all([
    getAllItems({ recoverPhotos: false }), getStorageSpaces(), getAllCompartments(),
  ]);
  // Online archive lookup prevents an older active-space cache from including archived inventory.
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const archived = offline ? [] : await getArchivedStorageSpaces();
  const archivedIds = new Set(archived.map(s => s.id));
  const activeSpaces = spaces.filter(s => !s.isArchived && !archivedIds.has(s.id));
  const rooms = (await Promise.all(activeSpaces.map(s => getRoomsByStorageSpace(s.id)))).flat();
  return { items, spaces: activeSpaces, compartments, rooms, offline };
}

export async function loadInventoryAnswer(question: Extract<AssistantIntent, { kind: 'question' }>,
  onItems?: (items: AssistantItem[]) => void): Promise<string> {
  const data = await loadAssistantInventory();
  const results: AssistantItem[] = [];
  const answer = answerInventoryQuestion(question, data.items, data.spaces, data.compartments, data.rooms, results);
  onItems?.(results);
  return answer + (data.offline ? '\nOffline — saved data may be incomplete.' : '');
}

// Resolve identity again at tap time: an item may have moved since the answer.
export async function resolveAssistantItem(id: string) {
  if (!id || id.startsWith('offline-')) return null;
  const data = await loadAssistantInventory();
  const item = data.items.find(i => i.id === id && i.isDeleted !== true);
  const compartment = data.compartments.find(c => c.id === item?.compartmentId);
  if (!item || !compartment || !data.spaces.some(s => s.id === compartment.vehicleId)) return null;
  return { pathname: '/duplicate-inspection' as const, params: {
    vehicleId: compartment.vehicleId, compartmentId: compartment.id,
    focusItemId: item.id, duplicateInspection: 'true',
  } };
}
