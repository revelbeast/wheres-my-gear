import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import type { Item } from "./gearService";

const FILE = "wmg-siri-gear-cache.json";
let account: string | null = null;
let generation = 0;
let accountEpoch = 0;
let ready = false;
let accountInitialization: Promise<void> | null = null;
let tail: Promise<unknown> = Promise.resolve();
const blocked = new Map<string, Set<string>>();
export type SiriCachePublication = { uid: string; generation: number };

export class SiriCacheError extends Error {
  readonly code = "SIRI_CACHE_FAILED";
  constructor() {
    super("Inventory was updated, but Siri cache protection could not finish. Reopen the app before using Siri.");
    this.name = "SiriCacheError";
  }
}
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = tail.then(work);
  tail = result.catch(() => {});
  return result;
}
function path() {
  if (!FileSystem.documentDirectory) throw new SiriCacheError();
  return `${FileSystem.documentDirectory}${FILE}`;
}
const key = (uid: string) => `wmg:siri:suppressed:${encodeURIComponent(uid)}`;
async function suppressed(uid: string) {
  const raw = await AsyncStorage.getItem(key(uid));
  const values: unknown = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(values) || values.some(id => typeof id !== "string")) throw new SiriCacheError();
  return new Set<string>([...values, ...(blocked.get(uid) ?? [])]);
}
async function publish(items: unknown[]) {
  // Installed Expo iOS legacy writer uses Data.write(.atomic): preserve the old file on failure.
  await FileSystem.writeAsStringAsync(path(), JSON.stringify({ items, updatedAt: new Date().toISOString() }));
}

/** Synchronously revoke old writers, then clear the account-neutral native file. */
export function setSiriGearCacheAccount(uid: string | null): Promise<void> {
  // Reuse both pending and completed initialization for the same account.
  if (account === uid && accountInitialization) return accountInitialization;
  account = uid;
  ready = false;
  ++generation;
  const version = ++accountEpoch;
  accountInitialization = serialize(async () => {
    await FileSystem.deleteAsync(path(), { idempotent: true });
    if (accountEpoch === version && account === uid) ready = true;
  }).catch(error => {
    // A failed clear remains unready, but a later same-account call may retry it.
    if (accountEpoch === version) accountInitialization = null;
    throw error;
  });
  return accountInitialization;
}
export function beginSiriGearCachePublication(uid: string): SiriCachePublication | null {
  return account === uid ? { uid, generation } : null;
}
export function writeSiriGearCache(items: Item[], token: SiriCachePublication | null): Promise<void> {
  return serialize(async () => {
    if (!token || !ready || token.uid !== account || token.generation !== generation) return;
    const excluded = await suppressed(token.uid);
    if (token.uid !== account || token.generation !== generation) return;
    await publish(items.filter(item => item.isDeleted !== true && !excluded.has(item.id) && item.name.trim().length > 0)
      .map(item => ({ id: item.id, name: item.name, compartmentName: item.compartmentName ?? "", vehicleName: item.vehicleName ?? "" })));
  });
}

export function suppressSiriGearItem(uid: string, itemId: string): Promise<void> {
  const ids = blocked.get(uid) ?? new Set<string>();
  ids.add(itemId);
  blocked.set(uid, ids);
  if (account === uid) ++generation;
  return serialize(async () => {
    // Reapply inside the queue: an earlier queued restore may have released this ID.
    const current = blocked.get(uid) ?? new Set<string>();
    current.add(itemId);
    blocked.set(uid, current);
    let failed = !ready;
    try {
      await AsyncStorage.setItem(key(uid), JSON.stringify([...await suppressed(uid)]));
    } catch { failed = true; }
    // Even if persistence failed, attempt surgical removal and retain the in-memory block.
    if (account === uid) {
      try {
        const cachePath = path();
        const info = await FileSystem.getInfoAsync(cachePath);
        if (info.exists) {
          const raw = await FileSystem.readAsStringAsync(cachePath);
          let entries: unknown;
          try { entries = JSON.parse(raw).items; } catch { entries = []; }
          // Malformed cache is not usable by native readers; repair to an empty list.
          const items = Array.isArray(entries) ? entries : [];
          const excluded = blocked.get(uid)!;
          await publish(items.filter(item => item && typeof item.id === "string" && !excluded.has(item.id)));
        }
      } catch { failed = true; }
    }
    if (failed) throw new SiriCacheError();
  });
}

/** Release only after authoritative restore. Never fabricate a native cache entry. */
export function releaseSiriGearItem(uid: string, itemId: string): Promise<void> {
  if (account === uid) ++generation;
  return serialize(async () => {
    const ids = await suppressed(uid);
    ids.delete(itemId);
    await AsyncStorage.setItem(key(uid), JSON.stringify([...ids]));
    blocked.get(uid)?.delete(itemId);
  });
}
