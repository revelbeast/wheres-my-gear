import NetInfo from '@react-native-community/netinfo';
import Purchases from 'react-native-purchases';
import { collection, doc, runTransaction, serverTimestamp, type DocumentReference } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { getCustomerInfo, hasPremiumPlusAccess } from './revenuecat';
import { validateSetup, type SetupPreview, type SetupNode } from './gearAssistantSetup';

export type SetupFailure = 'validation' | 'authentication' | 'entitlement' | 'entitlement-unavailable' |
  'offline' | 'parent-state' | 'permission' | 'uncertain-result';
export type SetupOutcome = Readonly<{
  ok: boolean;
  ids: Readonly<Record<string, string>>;
  reason?: SetupFailure;
  message?: string;
  reconciliation?: 'matched' | 'absent' | 'conflict';
}>;
class SetupError extends Error {
  constructor(readonly reason: SetupFailure, message: string) { super(message); }
}
const validId = (value: unknown): value is string => typeof value === 'string' &&
  value.length > 0 && value.length <= 128 && value === value.trim() && !/[\/\x00-\x1f]/.test(value) &&
  value !== '.' && value !== '..' && !/^__.*__$/.test(value);
const permanentId = (value: unknown): value is string => validId(value) && !/^(offline-|proposal-|temp-)/i.test(value);
const validName = (value: unknown): value is string => typeof value === 'string' &&
  value.trim().length > 0 && value.length <= 60;
const collectionName = (kind: SetupNode['kind']) => kind === 'storage' ? 'storageSpaces' : kind === 'room' ? 'rooms' : 'compartments';

// Copy only schema fields, then freeze: caller edits cannot change an approved attempt.
function snapshotProposal(input: unknown, confirmed: boolean): SetupPreview {
  const fail = () => { throw new SetupError('validation', 'Confirm a valid complete storage proposal.'); };
  if (!confirmed || !input || typeof input !== 'object') return fail();
  const value = input as SetupPreview;
  if (!Array.isArray(value.nodes) || value.nodes.length < 1 || value.nodes.length > 30) return fail();
  const nodes = value.nodes.map(node => {
    if (!node || !validId(node.id) || !validName(node.name) ||
        !['storage', 'room', 'compartment'].includes(node.kind) ||
        (node.parentId !== null && !validId(node.parentId))) return fail();
    if (node.kind === 'storage' && (typeof node.subtype !== 'string' ||
        (node.customSubtype !== undefined && typeof node.customSubtype !== 'string'))) return fail();
    return Object.freeze({ id: node.id, kind: node.kind, name: node.name.trim(), parentId: node.parentId,
      ...(node.kind === 'storage' ? { category: node.category, subtype: node.subtype, customSubtype: node.customSubtype } : {}) });
  });
  const external = value.parentKind !== undefined || value.parentId !== undefined || value.parentQuery !== undefined;
  if (external && (!['storage', 'room'].includes(value.parentKind ?? '') || !permanentId(value.parentId))) return fail();
  for (const node of nodes) {
    if (node.kind !== 'storage' && nodes.filter(other => other.kind === node.kind && other.parentId === node.parentId).length > 20) return fail();
    if (node.kind === 'storage' && (external || node.parentId !== null)) return fail();
    if (!node.parentId && node.kind !== 'storage' && (!external ||
        (node.kind === 'room' && value.parentKind !== 'storage'))) return fail();
  }
  const proposal: SetupPreview = { nodes, ...(external ? { parentKind: value.parentKind, parentId: value.parentId } : {}) };
  const errors = validateSetup(proposal);
  if (errors.length) throw new SetupError('validation', errors.join(' '));
  Object.freeze(nodes);
  return Object.freeze(proposal);
}

/** No I/O until execute(). Keep this attempt for retries/reconciliation; do not recreate it on errors.
 * Not durable across app restarts. No UI imports this module yet.
 */
export function createSmartSetupAttempt(input: unknown, confirmed: boolean) {
  const uid = auth.currentUser?.uid;
  let proposal: SetupPreview | undefined;
  let validationError: SetupError | undefined;
  try { proposal = snapshotProposal(input, confirmed === true); }
  catch (error) { validationError = error instanceof SetupError ? error : new SetupError('validation', 'Malformed proposal.'); }
  let ids: Readonly<Record<string, string>> = Object.freeze({});
  let refs: DocumentReference[] = [];
  let expected: Record<string, unknown>[] = [];
  let flight: Promise<SetupOutcome> | undefined;
  let settled: SetupOutcome | undefined;
  let submitted = false;
  const outcome = (ok: boolean, extra: Omit<SetupOutcome, 'ok' | 'ids'> = {}): SetupOutcome => Object.freeze({ ok, ids, ...extra });
  const checkUid = () => {
    if (!uid || auth.currentUser?.uid !== uid) throw new SetupError('authentication', 'Sign in with the account that confirmed this proposal.');
  };
  async function preflight() {
    checkUid();
    let network;
    try { network = await NetInfo.fetch(); } catch { throw new SetupError('offline', 'Online connectivity could not be verified.'); }
    if (network.isConnected !== true || network.isInternetReachable !== true) throw new SetupError('offline', 'An internet connection is required.');
    checkUid();
    // Preserve the existing Premium+ policy, but never use the local boolean-access fallback.
    // RevenueCat SDK customer information can itself be cached; this does not prove server freshness.
    try {
      if (await Purchases.getAppUserID() !== uid) throw new Error('Account not linked');
      const info = await getCustomerInfo();
      checkUid();
      if (!info || await Purchases.getAppUserID() !== uid) throw new Error('Customer information unavailable');
      if (!hasPremiumPlusAccess(info)) throw new SetupError('entitlement', 'Premium+ access is required.');
    } catch (error) {
      if (error instanceof SetupError) throw error;
      throw new SetupError('entitlement-unavailable', 'Premium+ access could not be verified for this account.');
    }
    checkUid();
  }
  const failure = (error: unknown): SetupOutcome => {
    if (error instanceof SetupError) return outcome(false, { reason: error.reason, message: error.message });
    const code = String((error as { code?: unknown })?.code ?? '').replace(/^firestore\//, '');
    if (code === 'permission-denied') return outcome(false, { reason: 'permission', message: 'Permission to create this structure was denied.' });
    if (code === 'unauthenticated') return outcome(false, { reason: 'authentication', message: 'Authentication is required.' });
    return outcome(false, { reason: submitted ? 'uncertain-result' : 'validation', message: submitted ?
      'Creation could not be confirmed. Keep this attempt and reconcile its IDs; do not resubmit with new IDs.' : 'The creation attempt could not be prepared.' });
  };
  async function executeOnce(): Promise<SetupOutcome> {
    try {
      if (validationError) throw validationError;
      await preflight();
      const p = proposal!;
      refs = p.nodes.map(node => doc(collection(db, 'users', uid!, collectionName(node.kind))));
      ids = Object.freeze(Object.fromEntries(p.nodes.map((node, i) => [node.id, refs[i].id])));
      const timestamp = serverTimestamp();
      // Reconciliation compares immutable identity/content fields, not timestamps or copied parent labels.
      expected = p.nodes.map(node => ({ name: node.name, ...(node.kind === 'storage' ? {
        category: node.category, subtype: node.subtype === 'Other' ? node.customSubtype!.trim() : node.subtype,
        notes: '', isArchived: false, archivedAt: null,
      } : {}) }));
      submitted = true;
      await runTransaction(db, async transaction => {
        checkUid();
        let externalStorage: { id: string; name: string } | undefined;
        let externalRoom: { id: string; name: string } | undefined;
        const readParent = async (kind: 'storage' | 'room', id: string) => {
          if (!permanentId(id)) throw new SetupError('parent-state', 'The selected parent is not a permanent record.');
          const snap = await transaction.get(doc(db, 'users', uid!, collectionName(kind), id));
          const data = snap.data();
          if (!snap.exists() || !data || data.isArchived === true || data.isDeleted === true || !validName(data.name))
            throw new SetupError('parent-state', 'The selected parent is missing, archived, or invalid.');
          return data;
        };
        if (p.parentKind === 'storage') {
          const data = await readParent('storage', p.parentId!);
          externalStorage = { id: p.parentId!, name: data.name };
        } else if (p.parentKind === 'room') {
          const room = await readParent('room', p.parentId!);
          if (!permanentId(room.storageSpaceId)) throw new SetupError('parent-state', 'The room has invalid storage ancestry.');
          const storage = await readParent('storage', room.storageSpaceId);
          externalRoom = { id: p.parentId!, name: room.name };
          externalStorage = { id: room.storageSpaceId, name: storage.name };
        }
        // Never overwrite a collision. All reads finish before the first write.
        for (const ref of refs) if ((await transaction.get(ref)).exists())
          throw new SetupError('uncertain-result', 'An allocated ID already exists. Reconcile this attempt.');
        const location = (node: SetupNode): { storage: { id: string; name: string }; room?: { id: string; name: string } } => {
          const parent = p.nodes.find(candidate => candidate.id === node.parentId);
          if (!parent) {
            if (!externalStorage) throw new SetupError('parent-state', 'Storage ancestry is unresolved.');
            return { storage: externalStorage, room: externalRoom };
          }
          if (parent.kind === 'storage') return { storage: { id: ids[parent.id], name: parent.name } };
          return { storage: location(parent).storage, room: { id: ids[parent.id], name: parent.name } };
        };
        const payloads = p.nodes.map((node, i) => {
          const base = { ...expected[i], createdAt: timestamp, updatedAt: timestamp };
          if (node.kind === 'storage') return base;
          const { storage, room } = location(node);
          return node.kind === 'room' ? { ...base, storageSpaceId: storage.id, storageSpaceName: storage.name,
            notes: '', photoUri: '', isArchived: false, archivedAt: null } :
            { ...base, vehicleId: storage.id, roomId: room?.id ?? '', roomName: room?.name ?? '' };
        });
        checkUid(); // Synchronous writes follow immediately; security rules must enforce actual ownership at commit.
        payloads.forEach((payload, i) => transaction.set(refs[i], payload));
      });
      return outcome(true);
    } catch (error) { return failure(error); }
  }
  async function reconcileOnce(): Promise<SetupOutcome> {
    try {
      await preflight();
      // Read-only transaction: no writes, no reallocation, no retrying creation.
      return await runTransaction(db, async transaction => {
        checkUid();
        const snapshots = [];
        for (const ref of refs) snapshots.push(await transaction.get(ref));
        checkUid();
        if (snapshots.every(snap => !snap.exists())) return outcome(false, { reason: 'uncertain-result', reconciliation: 'absent',
          message: 'No allocated records are present now. No automatic retry was performed.' });
        const p = proposal!;
        const storageId = (node: SetupNode): string | undefined => {
          const parent = p.nodes.find(n => n.id === node.parentId);
          if (parent) return parent.kind === 'storage' ? ids[parent.id] : storageId(parent);
          if (p.parentKind === 'storage') return p.parentId;
          return undefined;
        };
        let existingRoomStorage: string | undefined;
        if (p.parentKind === 'room') {
          const room = await transaction.get(doc(db, 'users', uid!, 'rooms', p.parentId!));
          existingRoomStorage = room.data()?.storageSpaceId;
        }
        const matches = snapshots.every((snap, i) => {
          const data = snap.data(), node = p.nodes[i];
          if (!snap.exists() || !data || !Object.entries(expected[i]).every(([key, value]) => data[key] === value)) return false;
          if (node.kind === 'storage') return true;
          const storage = storageId(node) ?? existingRoomStorage;
          if (!permanentId(storage)) return false;
          if (node.kind === 'room') return data.storageSpaceId === storage && data.isArchived === false && data.archivedAt === null && data.notes === '' && data.photoUri === '';
          const parent = p.nodes.find(n => n.id === node.parentId);
          const roomId = parent?.kind === 'room' ? ids[parent.id] : !parent && p.parentKind === 'room' ? p.parentId : '';
          return data.vehicleId === storage && data.roomId === roomId;
        });
        checkUid();
        return matches ? outcome(true, { reconciliation: 'matched' }) : outcome(false, { reason: 'uncertain-result', reconciliation: 'conflict',
          message: 'Allocated records are incomplete or changed. Manual review is required; no records were overwritten.' });
      });
    } catch (error) { return failure(error); }
  }
  return Object.freeze({
    execute(): Promise<SetupOutcome> {
      if (flight) return flight;
      if (settled) return Promise.resolve(settled);
      flight = executeOnce().then(result => { settled = result; flight = undefined; return result; });
      return flight;
    },
    reconcile(): Promise<SetupOutcome> {
      if (flight) return flight;
      if (!settled || settled.ok || settled.reason !== 'uncertain-result') return Promise.resolve(settled ?? outcome(false, { reason: 'validation', message: 'Execute this attempt before reconciliation.' }));
      flight = reconcileOnce().then(result => { if (result.ok) settled = result; flight = undefined; return result; });
      return flight;
    },
  });
}
